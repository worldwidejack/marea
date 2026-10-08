// Regata sulla laguna (F2-regata, CONTRACTS §12): porta la barca alla partenza, fa correre la sim `regata` del registry a 60 Hz
// (un tick per passo del ciclo di main.ts, stesso accumulatore), registra un InputFrame quantizzato per tick in assi mondo e alla fine
// restituisce packInputs(frames). Esc = ritirati (null). Boe dal manifest (prop_boa, prop_boa_next per la prossima), HUD di gara in DOM.
// Le coordinate della sim sono locali all'isola del percorso: qui si somma l'origine dell'isola (laguna) × tile per disegnare.
import * as THREE from 'three';
import { createRng, getMinigame, packInputs, quantize, replay } from '@marea/sim';
import type { BoatState, Difficulty, InputFrame, MinigameModule, MinigameResult, PackedInputs, Rng } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import { PAL } from '../ui/style.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type RegataChallenge = { id: string; minigame: string; difficulty: string | number; seed: number; [k: string]: unknown };
export type RegataDriver = {
  /** true mentre si corre (compresi conto alla rovescia ed esito): main.ts non muove l'avatar. */
  readonly active: boolean;
  /** Un tick (60 Hz) con l'input campionato da main.ts. */
  step(f: InputFrame): void;
  /** Ogni frame: boe, HUD. */
  update(alpha: number, dt: number, t: number): void;
};
type Ctx = { world: GameWorld; loader: Loader; hud: Hud; root: HTMLElement; cameraYaw: () => number };
/** Quello che il client legge da view(): tipo strutturale, così non dipende dai dettagli interni del modulo della sim. */
type View = {
  boat: BoatState; buoys: { x: number; z: number; passed: boolean }[]; next: number; ms: number; maxMs?: number;
  wind: { x: number; z: number }; gust?: number; done: boolean; finished?: boolean; radius?: number;
};
type Phase = 'countdown' | 'race' | 'end';
type Run = {
  challenge: RegataChallenge; mod: MinigameModule<unknown>; s: unknown; difficulty: Difficulty;
  frames: InputFrame[]; phase: Phase; wait: number; auto: Rng | null; speed: number; off: { x: number; z: number };
  lastNext: number; result: MinigameResult | null; finish(v: PackedInputs | null): void;
};

const COUNTDOWN = 3 * 60, END_WAIT = 3 * 60, END_SKIP = 50; // tick
const MAX_BUOYS = 12;
let ctx: Ctx | null = null, driver: (RegataDriver & { start(c: RegataChallenge, signal?: AbortSignal, auto?: { speed: number }): Promise<PackedInputs | null> }) | null = null;

const diffOf = (d: unknown): Difficulty => { const n = Math.round(Number(d)); return (n >= 1 && n <= 3 ? n : 2) as Difficulty; };
const fmt = (ms: number) => { const s = Math.max(0, ms) / 1000; const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
const MEDAL: Record<string, string> = { oro: 'ORO', argento: 'ARGENTO', bronzo: 'BRONZO' };
const MEDAL_C: Record<string, string> = { oro: PAL.giallo, argento: PAL.pietraChiara, bronzo: PAL.arancio };

/**
 * Gioca una Regata e restituisce l'input log (null = annullata con Esc o con `signal`). Il punteggio vero lo decide il server
 * rigiocando questi input: qui l'esito a schermo è solo un'anteprima.
 */
export function runRegata(o: { challenge: RegataChallenge; signal?: AbortSignal }): Promise<PackedInputs | null> {
  if (!driver) return Promise.reject(new Error('Regata non pronta'));
  return driver.start(o.challenge, o.signal);
}

// ---------- boe: un InstancedMesh per mesh del modello prop_boa (poche draw call per quante boe ci sono), prop_boa_next a parte ----------
type Buoys = { group: THREE.Group; set(v: View | null, off: { x: number; z: number }, t: number): void; drawn(): number };
async function createBuoys(loader: Loader): Promise<Buoys> {
  const group = new THREE.Group(); group.name = 'regata_boe'; group.visible = false;
  const fallback = (color: string, r: number) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, 1.4, 6), new THREE.MeshLambertMaterial({ color, flatShading: true })); m.position.y = 0.5; g.add(m); return g; };
  const load = async (name: string, color: string, r: number) => {
    if (loader.has(name)) { try { return (await loader.load(name)).scene; } catch (e) { console.warn('[marea] boa non caricata, uso il segnaposto', e); } }
    return fallback(color, r);
  };
  const [base, next] = await Promise.all([load('prop_boa', PAL.arancio, 0.45), load('prop_boa_next', PAL.rosso, 0.7)]);
  base.updateMatrixWorld(true);
  const parts: { mesh: THREE.InstancedMesh; rel: THREE.Matrix4 }[] = [];
  base.traverse((n) => {
    const m = n as THREE.Mesh; if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, MAX_BUOYS);
    im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false; im.count = 0; im.name = 'boa';
    parts.push({ mesh: im, rel: m.matrixWorld.clone() }); group.add(im);
  });
  const nextAt = new THREE.Group(); nextAt.name = 'boa_prossima'; nextAt.add(next); group.add(nextAt);
  // arrivo (#1): due pali e uno striscione a scacchi attorno all'ultima boa, di traverso rispetto all'ultimo tratto
  const arrivo = new THREE.Group(); arrivo.name = 'regata_arrivo'; group.add(arrivo);
  const legno = new THREE.MeshLambertMaterial({ color: PAL.legnoScuro, flatShading: true });
  const scacchi = document.createElement('canvas'); scacchi.width = 6; scacchi.height = 2;
  const sg = scacchi.getContext('2d')!;
  for (let x = 0; x < 6; x++) for (let y = 0; y < 2; y++) { sg.fillStyle = (x + y) % 2 ? PAL.neroCaldo : PAL.sabbiaChiara; sg.fillRect(x, y, 1, 1); }
  const tela = new THREE.CanvasTexture(scacchi); tela.magFilter = tela.minFilter = THREE.NearestFilter; tela.colorSpace = THREE.SRGBColorSpace;
  const pali = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 6), legno, 2); pali.name = 'arrivo_pali'; pali.frustumCulled = false;
  const banner = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.5), new THREE.MeshLambertMaterial({ map: tela, flatShading: true })); banner.name = 'arrivo_striscione'; banner.rotation.order = 'YXZ'; // prima girato sul tratto, poi inclinato verso la camera
  arrivo.add(pali, banner); arrivo.visible = false;
  const m4 = new THREE.Matrix4(), tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  let drawn = 0;
  return {
    group,
    drawn: () => drawn,
    set(v, off, t) {
      group.visible = !!v; drawn = 0;
      if (!v) return;
      const list = v.buoys.slice(0, MAX_BUOYS);
      let k = 0;
      for (const [i, b] of list.entries()) {
        if (b.passed || i === v.next) continue; // passate: sparite; la prossima la disegna prop_boa_next
        const bob = 0.06 * Math.sin(t * 1.7 + i * 1.3);
        q.setFromAxisAngle(up, i * 0.9 + 0.05 * Math.sin(t * 1.1 + i)); p.set(b.x + off.x, bob, b.z + off.z);
        m4.compose(p, q, one);
        for (const part of parts) part.mesh.setMatrixAt(k, tmp.multiplyMatrices(m4, part.rel));
        k++;
      }
      for (const part of parts) { part.mesh.count = k; part.mesh.instanceMatrix.needsUpdate = true; }
      drawn = k;
      const n = v.buoys[v.next];
      nextAt.visible = !!n && !v.done;
      if (n) { nextAt.position.set(n.x + off.x, 0.08 * Math.sin(t * 2.2), n.z + off.z); nextAt.rotation.y = t * 0.6; drawn++; }
      const fin = list[list.length - 1], prima = list[list.length - 2];
      arrivo.visible = !!fin && !!prima && !fin.passed;
      if (fin && prima) {
        const dx = fin.x - prima.x, dz = fin.z - prima.z, l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l, w = (v.radius ?? 3) + 0.6;
        for (const [k2, s] of [[0, -1], [1, 1]] as const) { m4.makeTranslation(fin.x + off.x + px * w * s, 1.4, fin.z + off.z + pz * w * s); pali.setMatrixAt(k2, m4); }
        pali.instanceMatrix.needsUpdate = true;
        banner.position.set(fin.x + off.x, 2.7 + 0.05 * Math.sin(t * 3), fin.z + off.z);
        banner.rotation.set(-0.5 + 0.05 * Math.sin(t * 2.3), Math.atan2(-pz, px), 0); banner.scale.set(w * 2, 1, 1); // inclinato verso la camera: dall'alto gli scacchi si leggono
      }
    },
  };
}

// ---------- HUD di gara (DOM, palette, bordi netti, niente gradienti) ----------
type RaceHud = { hit(): void; show(on: boolean): void; set(v: View, yaw: number, boat: { x: number; z: number }, off: { x: number; z: number }): void; big(text: string | null, color?: string, sub?: string): void; onQuit(fn: () => void): void };
function createRaceHud(root: HTMLElement): RaceHud {
  const P = PAL;
  if (!document.getElementById('mz-regata-style')) {
    const st = document.createElement('style'); st.id = 'mz-regata-style';
    st.textContent = `
#ui.mz-racing .mz-bar, #ui.mz-racing .mz-work, #ui.mz-racing .mz-labels, #ui.mz-racing #compass { visibility: hidden; }
.mz-race { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: none; justify-content: center; gap: 6px; flex-wrap: wrap; z-index: 14; pointer-events: none !important; font-family: ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; }
.mz-race.on { display: flex; }
.mz-race .c { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 10px; background: rgba(46,30,20,.92); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-size: 18px; font-weight: bold; white-space: nowrap; }
.mz-race .c small { font-size: 12px; color: ${P.sabbia}; }
.mz-race .c.boa { border-color: ${P.rosso}; }
.mz-race .c.boa.hit { border-color: ${P.giallo}; background: ${P.legnoScuro}; color: ${P.giallo}; }
@media (max-width: 480px) { .mz-race { gap: 4px; } .mz-race .c { padding: 0 6px; font-size: 16px; gap: 4px; } .mz-race .c small.l { display: none; } }
.mz-race .c.gust { border-color: ${P.acquaBassa}; }
.mz-race .arr { display: inline-block; width: 14px; height: 18px; fill: ${P.sabbiaChiara}; shape-rendering: crispEdges; }
.mz-race .boa .arr { fill: ${P.rosso}; }
.mz-race-big { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%); display: none; padding: 12px 22px; background: rgba(46,30,20,.95); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; text-align: center; z-index: 15; pointer-events: none !important; font: bold 44px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; }
.mz-race-big.on { display: block; }
.mz-race-big small { display: block; margin-top: 6px; font-size: 15px; color: ${P.sabbia}; }
.mz-race-quit { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: calc(max(8px, env(safe-area-inset-top)) + 52px); display: none; min-height: 44px; min-width: 44px; padding: 0 10px; align-items: center; background: ${P.legnoScuro}; color: ${P.sabbiaChiara}; border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font: bold 14px ui-monospace, Menlo, monospace; z-index: 14; cursor: pointer; }
.mz-race-quit.on { display: flex; }
`;
    document.head.appendChild(st);
  }
  const bar = document.createElement('div'); bar.className = 'mz-race'; bar.id = 'mzRace';
  const chip = (cls: string) => { const c = document.createElement('div'); c.className = 'c ' + cls; bar.appendChild(c); return c; };
  const time = chip('time'), boa = chip('boa'), wind = chip('wind');
  const big = document.createElement('div'); big.className = 'mz-race-big'; big.id = 'mzRaceBig';
  // raffica (#1): righe di vento a pixel che attraversano lo schermo nella direzione del vento, tante quanto è forte
  const vento = document.createElement('canvas'); vento.className = 'mz-race-vento'; vento.id = 'mzRaceVento';
  Object.assign(vento.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '13', imageRendering: 'pixelated', display: 'none' });
  const vg = vento.getContext('2d')!;
  const righe = Array.from({ length: 28 }, (_, i) => ({ u: (i * 0.618) % 1, w: ((i * 0.377) % 1), len: 6 + (i % 4) * 3 }));
  const quit = document.createElement('button'); quit.className = 'mz-race-quit'; quit.id = 'mzRaceQuit'; quit.textContent = 'Esc · Ritirati';
  let quitFn: (() => void) | null = null;
  quit.addEventListener('click', () => quitFn?.());
  root.append(vento, bar, big, quit);
  /** Direzione nel mondo → angolo a schermo (0 = su), con la yaw della camera (inverso di screenToWorld in input.ts). */
  const screenAngle = (dx: number, dz: number, yaw: number) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    return Math.atan2(rx * dx + rz * dz, fx * dx + fz * dz);
  };
  // freccia con asta (punta in su a 0 rad): si legge anche a mezza risoluzione, un triangolo da solo no
  const arrow = (ang: number) => `<svg class="arr" viewBox="0 0 14 18" style="transform:rotate(${ang.toFixed(2)}rad)"><path d="M7 0L14 8H9.5V18H4.5V8H0Z"/></svg>`;
  let last = '', hitT = 0;
  return {
    hit() { boa.classList.add('hit'); clearTimeout(hitT); hitT = window.setTimeout(() => boa.classList.remove('hit'), 700); },
    show(on) { bar.classList.toggle('on', on); quit.classList.toggle('on', on); root.classList.toggle('mz-racing', on); if (!on) { big.classList.remove('on'); vento.style.display = 'none'; } },
    set(v, yaw, b, off) {
      const tot = v.buoys.length, n = v.buoys[v.next];
      const d = n ? Math.hypot(n.x + off.x - b.x, n.z + off.z - b.z) : 0;
      const ws = Math.hypot(v.wind.x, v.wind.z);
      const html = [
        `<small class="l">TEMPO</small>${fmt(v.ms)}`,
        n ? `<small class="l">BOA</small>${Math.min(tot, v.next + 1)}/${tot} ${arrow(screenAngle(n.x + off.x - b.x, n.z + off.z - b.z, yaw))} <small>${Math.round(d)} m</small>` : `<small class="l">BOA</small>${tot}/${tot}`,
        ws > 0.15 ? `<small>VENTO</small>${arrow(screenAngle(v.wind.x, v.wind.z, yaw))} ${ws.toFixed(1)}` : `<small>VENTO</small>calmo`,
      ];
      const key = html.join('|');
      if (key !== last) { last = key; time.innerHTML = html[0]!; boa.innerHTML = html[1]!; wind.innerHTML = html[2]!; } // solo testo nostro, niente dati del server
      wind.classList.toggle('gust', ws > 0.15);
      const g = v.gust ?? 0;
      vento.style.display = g > 0.05 ? 'block' : 'none';
      if (g > 0.05) {
        const W = Math.ceil(root.clientWidth / 4), H = Math.ceil(root.clientHeight / 4); // a metà della metà: pixel grossi
        if (vento.width !== W || vento.height !== H) { vento.width = W; vento.height = H; }
        vg.clearRect(0, 0, W, H);
        const a = screenAngle(v.wind.x, v.wind.z, yaw), sx = Math.sin(a), sy = -Math.cos(a), tt = performance.now() / 1000;
        vg.fillStyle = PAL.sabbiaChiara; vg.globalAlpha = Math.min(0.85, 0.3 + g * 0.6);
        const n2 = Math.round(righe.length * Math.min(1, g * 1.4));
        for (let i = 0; i < n2; i++) {
          const r = righe[i]!, prog = (r.u + tt * (0.5 + r.w * 0.4)) % 1, D = Math.hypot(W, H);
          const cx = W / 2 + sx * (prog - 0.5) * D + -sy * (r.w - 0.5) * D, cy = H / 2 + sy * (prog - 0.5) * D + sx * (r.w - 0.5) * D;
          for (let k = 0; k < r.len; k++) vg.fillRect(Math.round(cx - sx * k), Math.round(cy - sy * k), 1, 1);
        }
        vg.globalAlpha = 1;
        if (g > 0.3 && !wind.querySelector('.raffica')) wind.insertAdjacentHTML('beforeend', '<small class="raffica" style="color:' + PAL.acquaBassa + '">RAFFICA!</small>');
      }
    },
    big(text, color, sub) {
      big.classList.toggle('on', !!text);
      if (!text) return;
      big.textContent = text; big.style.color = color ?? PAL.sabbiaChiara; big.style.borderColor = color ?? PAL.legnoChiaro;
      if (sub) { const s = document.createElement('small'); s.textContent = sub; big.appendChild(s); }
    },
    onQuit(fn) { quitFn = fn; },
  };
}

/** Da chiamare una volta in main.ts dopo il mondo: prepara boe e HUD, registra hook e stato per i test. */
export async function setupRegata(o: Ctx): Promise<RegataDriver> {
  ctx = o;
  const buoys = await createBuoys(o.loader); o.world.scene.add(buoys.group);
  const hud = createRaceHud(o.root);
  const arch = o.world.archipelago;
  let run: Run | null = null;
  /** Autopilot per le gare lanciate dal Tavolo (test e2e e ?autopilot=1): tick di sim per tick del ciclo, 0 = a mano. */
  let autoSpeed = FLAGS.autopilot ? 1 : 0;
  let lastOut: { ticks: number; rows: number; live: MinigameResult | null; replay: MinigameResult | null; cancelled: boolean } | null = null;

  /** Origine (m) dell'isola del percorso: l'isola che ha lo stesso id della mappa della sim, altrimenti la laguna. */
  const offsetOf = (s: unknown) => {
    const id = (s as { map?: { id?: string } } | null)?.map?.id;
    const place = arch.places.find((p) => p.island === id) ?? arch.places.find((p) => p.role === 'laguna');
    return place ? { x: place.origin[0] * arch.tile, z: place.origin[1] * arch.tile } : { x: 0, z: 0 };
  };
  const view = (r: Run) => r.mod.view(r.s) as View;
  const worldBoat = (r: Run, v: View): BoatState => ({ ...v.boat, x: v.boat.x + r.off.x, z: v.boat.z + r.off.z });

  const onKey = (e: KeyboardEvent) => {
    if (!run || e.code !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation(); // il Tavolo non deve chiudersi sotto la gara
    quitRun();
  };
  const quitRun = () => { const r = run; if (!r) return; if (r.phase === 'end') r.finish(packInputs(r.frames)); else r.finish(null); };
  hud.onQuit(quitRun);

  const d: RegataDriver & { start(c: RegataChallenge, signal?: AbortSignal, auto?: { speed: number }): Promise<PackedInputs | null> } = {
    get active() { return !!run; },
    start(challenge, signal, auto) {
      if (run) return Promise.reject(new Error('Una regata è già in corso'));
      const mod = getMinigame(challenge.minigame || 'regata');
      const difficulty = diffOf(challenge.difficulty), seed = Number(challenge.seed) >>> 0;
      const s = mod.create({ seed, difficulty });
      return new Promise<PackedInputs | null>((resolve) => {
        const r: Run = {
          challenge, mod, s, difficulty, frames: [], phase: 'countdown', wait: COUNTDOWN, auto: auto || autoSpeed ? createRng(seed).fork('autopilot') : null,
          speed: Math.max(1, Math.min(20, Math.round(auto?.speed ?? (autoSpeed || 1)))), off: offsetOf(s), lastNext: 0, result: null,
          finish(v) {
            if (run !== r) return;
            run = null;
            removeEventListener('keydown', onKey, true); signal?.removeEventListener('abort', onAbort);
            buoys.set(null, r.off, 0); hud.show(false); o.world.race.end();
            let rep: MinigameResult | null = null;
            if (v) { try { rep = replay(mod.id, seed, difficulty, v); } catch (e) { console.warn('[marea] replay locale fallito', e); } }
            lastOut = { ticks: r.frames.length, rows: v?.length ?? 0, live: r.result ?? mod.result(r.s), replay: rep, cancelled: !v };
            console.log(`[marea] regata ${v ? 'finita' : 'annullata'}: ${r.frames.length} tick, ${v?.length ?? 0} righe`);
            resolve(v);
          },
        };
        const onAbort = () => r.finish(null);
        if (signal?.aborted) { resolve(null); return; }
        signal?.addEventListener('abort', onAbort);
        addEventListener('keydown', onKey, true);
        run = r;
        const v = view(r), b = worldBoat(r, v);
        o.world.race.begin(b.x, b.z, b.yaw);
        hud.show(true); hud.big('3');
        buoys.set(v, r.off, 0);
      });
    },
    step(f) {
      const r = run; if (!r) return;
      if (r.phase === 'countdown') {
        r.wait--;
        const left = Math.ceil(r.wait / 60);
        if (r.wait > 0) { hud.big(String(left)); o.world.race.set(worldBoat(r, view(r))); return; }
        r.phase = 'race'; hud.big('VIA!', PAL.erbaChiara);
        return;
      }
      if (r.phase === 'race') {
        for (let i = 0; i < r.speed && r.phase === 'race'; i++) {
          // input quantizzato come nel replay del server: il punteggio a schermo coincide con quello che il server ricalcola
          const frame = quantize(r.auto ? r.mod.autopilot(r.s, r.auto) : f);
          r.frames.push(frame); r.mod.step(r.s, frame);
          const v = view(r);
          if (r.frames.length === 45) hud.big(null);
          if (v.next !== r.lastNext) { r.lastNext = v.next; hud.hit(); } // boa passata: il chip lampeggia (niente toast: coprirebbe la gara)
          if (v.done || r.frames.length >= r.mod.maxTicks) {
            r.phase = 'end'; r.wait = END_WAIT; r.result = r.mod.result(r.s);
            const m = r.result.medal;
            const finished = v.finished ?? v.next >= v.buoys.length;
            const title = !finished ? 'TEMPO SCADUTO' : m ? MEDAL[m]! : 'ARRIVO';
            hud.big(title, m ? MEDAL_C[m] : PAL.sabbiaChiara, `${fmt(v.ms)} · ${v.next}/${v.buoys.length} boe · il server conferma`);
          }
        }
        const v = view(r); o.world.race.set(worldBoat(r, v));
        return;
      }
      // esito a schermo; poi si torna al Tavolo (o prima, con A/Invio dopo un attimo)
      r.wait--;
      o.world.race.set(worldBoat(r, view(r)));
      if (r.wait <= 0 || (END_WAIT - r.wait > END_SKIP && f.a)) r.finish(packInputs(r.frames));
    },
    update(_alpha, _dt, t) {
      const r = run; if (!r) return;
      const v = view(r);
      buoys.set(v, r.off, t);
      hud.set(v, o.cameraYaw(), o.world.boat.object.position, r.off);
    },
  };
  driver = d;

  registerStateProvider('regata', () => {
    const r = run, v = r ? view(r) : null;
    return {
      active: !!r, phase: r?.phase ?? null, auto: !!r?.auto, tick: r?.frames.length ?? 0, next: v?.next ?? 0, total: v?.buoys.length ?? 0,
      ms: v?.ms ?? 0, done: v?.done ?? false, off: r?.off ?? null, buoysDrawn: buoys.drawn(), boat: v ? worldBoat(r!, v) : null,
      buoys: v && r ? v.buoys.map((b) => ({ x: b.x + r.off.x, z: b.z + r.off.z, passed: b.passed })) : [], last: lastOut,
    };
  });
  const testChallenge = (seed: unknown, diff: unknown): RegataChallenge => ({ id: 'test', minigame: 'regata', difficulty: diffOf(diff ?? 2), seed: Number(seed ?? 1) || 1 });
  /** Autopilot di riferimento della sim (e2e): `speed` tick di sim per tick del ciclo (1-20). Il risultato finisce in state().regata.last. */
  registerTestHook('startRegataAuto', (seed, diff, speed) => { void d.start(testChallenge(seed, diff), undefined, { speed: Number(speed ?? 1) || 1 }); return true; });
  /** Gara a mano (tastiera/joystick), come dal Tavolo. */
  registerTestHook('startRegata', (seed, diff) => { void d.start(testChallenge(seed, diff)); return true; });
  registerTestHook('regataCancel', () => { quitRun(); return true; });
  /** Le gare lanciate dal Tavolo le corre l'autopilot (`speed` 1-20; 0 = di nuovo a mano): per provare il giro completo Tavolo → gara → server. */
  registerTestHook('regataAutopilot', (speed) => { autoSpeed = Math.max(0, Math.min(20, Math.round(Number(speed ?? 1)) || 0)); return autoSpeed; });
  return d;
}

/** Il contesto è pronto (per chi deve decidere se mostrare il Tavolo). */
export const regataReady = (): boolean => !!ctx && !!driver;
