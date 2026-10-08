// Consegne in barca (minigioco universale): «gioco a schermo» che però si gioca nel mondo, in barca. Scaricato con import() alla prima
// partita (minigiochi.ts → registraSchermo). La barca la muove la sim `consegne` (world.race, come la Regata): un tick per passo del ciclo
// di main.ts (minigiochi.tick → step), un InputFrame quantizzato per tick, il PRIMO è startFrame(molo di partenza). Alla fine
// packInputs(frames): il punteggio vero lo decide il server rigiocandoli. Sull'acqua: boa grande con la bandiera al molo da raggiungere,
// puntini gialli sulla rotta davanti a te, cassette che galleggiano (secondi in più). HUD: pacchi, tempo, freccia verso il molo.
// Le coordinate della sim sono quelle del mondo (la mappa è l'arcipelago intero). Esc = ritirati.
import * as THREE from 'three';
import { consegneMoli, createRng, getMinigame, packInputs, quantize, startFrame } from '@marea/sim';
import type { ConsegneView, Difficulty, InputFrame, MinigameModule, MinigameResult, Molo, PackedInputs, Rng } from '@marea/sim';
import type { Api } from '../net/api.ts';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { SchermoGioco } from './minigiochi.ts';
import { PAL, el } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { setTopbarHidden } from '../ui/topbar.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type GiocoBarca = SchermoGioco & { step(f: InputFrame): void; update(t: number): void };
type Phase = 'countdown' | 'race' | 'end';
type Run = { mod: MinigameModule<unknown>; s: unknown; frames: InputFrame[]; phase: Phase; wait: number; auto: Rng | null; speed: number; last: { consegnate: number; prese: number }; flash: number; result: MinigameResult | null; finish(v: PackedInputs | null): void };

const COUNTDOWN = 3 * 60, END_WAIT = 3 * 60, END_SKIP = 50, FLASH = 75; // tick
const MAX_CASSE = 8, DOTS = 16, DOT_STEP = 4;
const MEDAL: Record<string, string> = { oro: 'ORO', argento: 'ARGENTO', bronzo: 'BRONZO' };
const MEDAL_C: Record<string, string> = { oro: PAL.giallo, argento: PAL.pietraChiara, bronzo: PAL.arancio };
const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// i chip dell'HUD sono quelli della Regata (.mz-race, CSS iniettato da game/regata.ts all'avvio): qui solo le aggiunte
const CSS = `
.mz-race .c.cs-time { min-width: 86px; justify-content: center; }
.mz-race .c.cs-time.low { border-color: ${PAL.rosso}; color: ${PAL.rosso}; }
.mz-race .c.cs-time.plus { border-color: ${PAL.giallo}; color: ${PAL.giallo}; }
.mz-race .c.cs-dest { border-color: ${PAL.giallo}; }
.mz-race .c.cs-dest .arr { fill: ${PAL.giallo}; }
.mz-race .cs-bar { display: block; width: 100%; height: 6px; margin-top: 2px; background: ${PAL.legnoScuro}; }
.mz-race .cs-bar i { display: block; height: 100%; background: ${PAL.arancio}; }
.mz-race .cs-time.low .cs-bar i { background: ${PAL.rosso}; }
.mz-cs-tag { position: absolute; left: 0; top: 0; display: none; align-items: center; gap: 6px; padding: 0 8px; min-height: 32px; background: rgba(46,30,20,.94); border: 2px solid ${PAL.giallo}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; color: ${PAL.giallo}; font: bold 14px ui-monospace, Menlo, monospace; white-space: nowrap; z-index: 13; pointer-events: none; transform: translate(-50%, -100%); }
.mz-cs-tag.on { display: flex; }
`;

const v3 = new THREE.Vector3();
/** Yaw della camera (0 = guarda verso −Z), dalla sua direzione sul piano: serve a girare le frecce dell'HUD come lo schermo. */
function cameraYaw(camera: THREE.Camera): number {
  camera.getWorldDirection(v3);
  return Math.atan2(-v3.x, -v3.z);
}
/** Direzione nel mondo → angolo a schermo (0 = su), come nell'HUD della Regata. */
function screenAngle(dx: number, dz: number, yaw: number): number {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return Math.atan2(rx * dx + rz * dz, fx * dx + fz * dz);
}
const arrow = (ang: number) => `<svg class="arr" viewBox="0 0 14 18" style="transform:rotate(${ang.toFixed(2)}rad)"><path d="M7 0L14 8H9.5V18H4.5V8H0Z"/></svg>`;

/** Instanced mesh di un modello del manifest (una per mesh del modello), con il segnaposto se manca. */
async function instanced(loader: Loader, name: string, max: number, fallback: () => THREE.Object3D): Promise<{ group: THREE.Group; set(list: { x: number; y: number; z: number; ry: number; s?: number }[]): void }> {
  let src: THREE.Object3D = fallback();
  if (loader.has(name)) { try { src = (await loader.load(name)).scene; } catch (e) { console.warn('[marea] modello non caricato, uso il segnaposto', name, e); } }
  src.updateMatrixWorld(true);
  const group = new THREE.Group(); group.name = 'cs_' + name;
  const parts: { mesh: THREE.InstancedMesh; rel: THREE.Matrix4 }[] = [];
  src.traverse((n) => {
    const m = n as THREE.Mesh; if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, max);
    im.frustumCulled = false; im.count = 0; im.castShadow = true;
    parts.push({ mesh: im, rel: m.matrixWorld.clone() }); group.add(im);
  });
  const m4 = new THREE.Matrix4(), tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return {
    group,
    set(list) {
      const n = Math.min(max, list.length);
      for (let k = 0; k < n; k++) {
        const it = list[k]!;
        q.setFromAxisAngle(up, it.ry); p.set(it.x, it.y, it.z); sc.setScalar(it.s ?? 1);
        m4.compose(p, q, sc);
        for (const part of parts) part.mesh.setMatrixAt(k, tmp.multiplyMatrices(m4, part.rel));
      }
      for (const part of parts) { part.mesh.count = n; part.mesh.instanceMatrix.needsUpdate = true; }
    },
  };
}

export async function createConsegne(o: { root: HTMLElement; world: GameWorld; loader: Loader; hud: Hud; camera: THREE.Camera; canvas: HTMLCanvasElement; api?: Api | null }): Promise<GiocoBarca> {
  if (!document.getElementById('mz-consegne-style')) { const st = document.createElement('style'); st.id = 'mz-consegne-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mod = getMinigame('consegne') as MinigameModule<unknown>;
  const moli = consegneMoli();
  // i lotti col nome di chi ci abita («Isola di Mia», «Casa tua»); senza link restano «Isola N»
  const abitanti = new Map<number, string>();
  if (o.api?.enabled) void o.api.lots().then((l) => { for (const w of l) abitanti.set(w.slot, w.nome); }).catch(() => {});
  const nomeDi = (m: Molo | null) => !m ? '' : m.slot === null ? m.nome : m.slot === o.world.slot ? 'Casa tua' : abitanti.has(m.slot) ? `Isola di ${abitanti.get(m.slot)}` : m.nome;
  const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

  // ---- nel mondo: boa con bandiera al molo da raggiungere, cassette, puntini sulla rotta ----
  const group = new THREE.Group(); group.name = 'consegne'; group.visible = false; o.world.scene.add(group);
  const meta = new THREE.Group(); meta.name = 'cs_meta'; group.add(meta);
  if (o.loader.has('prop_boa_next')) void o.loader.load('prop_boa_next').then((g) => { g.scene.scale.setScalar(1.6); meta.add(g.scene); }).catch(() => {});
  const asta = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6, 0.16), mat(PAL.legnoScuro)); asta.position.y = 3; meta.add(asta);
  const bandiera = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.08), mat(PAL.giallo)); bandiera.position.set(0.85, 5.4, 0); meta.add(bandiera);
  const casse = await instanced(o.loader, 'prop_cassa', MAX_CASSE, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat(PAL.legnoChiaro)); m.position.y = 0.2; return m; });
  group.add(casse.group);
  const dots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), new THREE.MeshBasicMaterial({ color: PAL.giallo }), DOTS);
  dots.frustumCulled = false; dots.count = 0; dots.name = 'cs_rotta'; group.add(dots);

  // ---- HUD (classi della Regata) ----
  const bar = el('div', 'mz-race'); bar.id = 'mzConsegne';
  const chip = (cls: string) => { const c = el('div', 'c ' + cls); bar.appendChild(c); return c; };
  const cPacchi = chip('cs-pacchi'), cTime = chip('cs-time'), cDest = chip('cs-dest');
  const big = el('div', 'mz-race-big'); big.id = 'mzConsegneBig';
  const quit = el('button', 'mz-race-quit', 'Esc · Ritirati') as HTMLButtonElement; quit.type = 'button';
  const tag = el('div', 'mz-cs-tag'); tag.id = 'mzConsegneTag';
  for (const e of [bar, big, quit, tag]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  o.root.append(bar, big, quit, tag);
  const timeTxt = el('span'), timeBar = el('span', 'cs-bar'), timeFill = document.createElement('i'); timeBar.appendChild(timeFill);
  const timeBox = el('span'); timeBox.style.display = 'flex'; timeBox.style.flexDirection = 'column'; timeBox.append(timeTxt, timeBar);
  cTime.append(timeBox);
  const pacTxt = el('b');
  cPacchi.append(pixIcon('consegne', 16), pacTxt);
  const destArr = el('span'), destName = el('span'), destDist = el('small');
  destArr.style.display = 'inline-flex';
  cDest.append(destArr, destName, destDist);
  const showHud = (on: boolean) => {
    for (const e of [bar, quit]) e.classList.toggle('on', on);
    if (!on) { big.classList.remove('on'); tag.classList.remove('on'); }
    o.root.classList.toggle('mz-racing', on);
  };
  const setBig = (text: string | null, color?: string, sub?: string) => {
    big.classList.toggle('on', !!text);
    if (!text) return;
    big.textContent = text; big.style.color = color ?? PAL.sabbiaChiara; big.style.borderColor = color ?? PAL.legnoChiaro;
    if (sub) big.appendChild(el('small', '', sub));
  };

  let run: Run | null = null;
  let autoSpeed = FLAGS.autopilot ? 1 : 0;
  let lastOut: { ticks: number; rows: number; live: MinigameResult | null; cancelled: boolean } | null = null;
  const view = (r: Run) => r.mod.view(r.s) as ConsegneView;

  const quitRun = () => { const r = run; if (!r) return; r.finish(r.phase === 'end' ? packInputs(r.frames) : null); };
  quit.addEventListener('click', quitRun);
  const onKey = (e: KeyboardEvent) => { if (run && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); quitRun(); } };

  const g: GiocoBarca = {
    run({ seed, difficulty, posto }) {
      if (run) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      const start = Math.max(0, moli.findIndex((m) => m.id === posto));
      const s = mod.create({ seed: seed >>> 0, difficulty: d });
      const first = quantize(startFrame(start));
      mod.step(s, first); // primo tick: si sceglie il molo, la barca resta ferma
      return new Promise<PackedInputs | null>((resolve) => {
        const r: Run = {
          mod, s, frames: [first], phase: 'countdown', wait: COUNTDOWN, auto: autoSpeed ? createRng(seed).fork('autopilot') : null,
          speed: Math.max(1, Math.min(20, autoSpeed || 1)), last: { consegnate: 0, prese: 0 }, flash: 0, result: null,
          finish(v) {
            if (run !== r) return;
            run = null;
            removeEventListener('keydown', onKey, true);
            group.visible = false; showHud(false); setTopbarHidden(false); o.world.race.end();
            lastOut = { ticks: r.frames.length, rows: v?.length ?? 0, live: r.result ?? mod.result(r.s), cancelled: !v };
            console.log(`[marea] consegne ${v ? 'finite' : 'annullate'}: ${r.frames.length} tick, ${v?.length ?? 0} righe`);
            resolve(v);
          },
        };
        run = r;
        addEventListener('keydown', onKey, true);
        const v = view(r);
        o.world.race.begin(v.boat.x, v.boat.z, v.boat.yaw);
        group.visible = true; showHud(true);
        setBig('3', PAL.giallo, `Pacco per: ${nomeDi(v.dest)}`);
      });
    },
    isOpen: () => !!run,
    esito: (d) => `${Number(d['consegne'] ?? 0)}/${Number(d['totale'] ?? 5)} pacchi${Number(d['casse'] ?? 0) ? ` · ${Number(d['casse'])} cassette` : ''}`,
    step(f) {
      const r = run; if (!r) return;
      if (r.phase === 'countdown') {
        r.wait--;
        const v = view(r);
        if (r.wait > 0) { if (r.wait % 60 === 59) setBig(String(Math.ceil(r.wait / 60)), PAL.giallo, `Pacco per: ${nomeDi(v.dest)}`); o.world.race.set(v.boat); return; }
        r.phase = 'race'; setBig('VIA!', PAL.erbaChiara, `Porta il pacco a ${nomeDi(v.dest)}`); r.flash = 45;
        return;
      }
      if (r.phase === 'race') {
        for (let i = 0; i < r.speed && r.phase === 'race'; i++) {
          const frame = quantize(r.auto ? r.mod.autopilot(r.s, r.auto) : f); // quantizzato come nel replay del server
          r.frames.push(frame); r.mod.step(r.s, frame);
          const v = view(r);
          if (v.consegnate !== r.last.consegnate && !v.done) { setBig('CONSEGNATO!', PAL.erbaChiara, `Prossimo: ${nomeDi(v.dest)}`); r.flash = FLASH; }
          if (v.prese !== r.last.prese) { cTime.classList.add('plus'); setTimeout(() => cTime.classList.remove('plus'), 700); }
          r.last = { consegnate: v.consegnate, prese: v.prese };
          if (v.done || r.frames.length >= r.mod.maxTicks) {
            r.phase = 'end'; r.wait = END_WAIT; r.result = r.mod.result(r.s);
            const m = r.result.medal;
            setBig(m ? MEDAL[m]! : v.timeUp ? 'TEMPO SCADUTO' : 'FINITO', m ? MEDAL_C[m] : PAL.sabbiaChiara, `${v.consegnate}/${v.totale} pacchi · il server conferma`);
          }
        }
        if (r.flash > 0 && --r.flash === 0 && r.phase === 'race') setBig(null);
        o.world.race.set(view(r).boat);
        return;
      }
      r.wait--;
      o.world.race.set(view(r).boat);
      if (r.wait <= 0 || (END_WAIT - r.wait > END_SKIP && f.a)) r.finish(packInputs(r.frames));
    },
    update(t) {
      const r = run; if (!r) return;
      setTopbarHidden(true); // main.ts la rimette a posto ogni frame prima di noi
      const v = view(r), yaw = cameraYaw(o.camera), b = o.world.boat.object.position;
      // meta: boa con bandiera al molo di destinazione
      meta.visible = !!v.dest && !v.done;
      if (v.dest) { meta.position.set(v.dest.x, 0.08 * Math.sin(t * 2), v.dest.z); bandiera.rotation.y = 0.3 * Math.sin(t * 3); }
      // cassette che galleggiano (girano piano)
      casse.set(v.casse.filter((c) => !c.presa).map((c, i) => ({ x: c.x, y: 0.05 * Math.sin(t * 2.4 + i), z: c.z, ry: t * 0.8 + i })));
      // puntini sulla rotta: dal punto della rotta più vicino alla barca, uno ogni DOT_STEP m per DOTS × DOT_STEP m
      const p = v.path; let k = 0;
      if (p.length > 1 && !v.done && r.phase !== 'end') {
        let bi = 0, bt = 0, bd = Infinity;
        for (let i = 0; i < p.length - 1; i++) {
          const A = p[i]!, B = p[i + 1]!, dx = B.x - A.x, dz = B.z - A.z, l2 = dx * dx + dz * dz || 1;
          const tt = Math.max(0, Math.min(1, ((b.x - A.x) * dx + (b.z - A.z) * dz) / l2));
          const d = (A.x + dx * tt - b.x) ** 2 + (A.z + dz * tt - b.z) ** 2;
          if (d < bd) { bd = d; bi = i; bt = tt; }
        }
        let i = bi, at = bt * Math.hypot(p[bi + 1]!.x - p[bi]!.x, p[bi + 1]!.z - p[bi]!.z) + DOT_STEP - ((t * 3) % DOT_STEP);
        const m4 = new THREE.Matrix4();
        while (k < DOTS && i < p.length - 1) {
          const A = p[i]!, B = p[i + 1]!, l = Math.hypot(B.x - A.x, B.z - A.z);
          if (at > l) { at -= l; i++; continue; }
          m4.makeTranslation(A.x + ((B.x - A.x) * at) / l, 0.12, A.z + ((B.z - A.z) * at) / l);
          dots.setMatrixAt(k++, m4); at += DOT_STEP;
        }
      }
      dots.count = k; dots.instanceMatrix.needsUpdate = true;
      // HUD
      const low = v.leftMs < 6000 && !v.done;
      const tTxt = fmt(v.leftMs);
      if (timeTxt.textContent !== tTxt) timeTxt.textContent = tTxt;
      timeFill.style.width = `${Math.max(0, Math.min(100, (v.leftMs / Math.max(1, v.legMs)) * 100))}%`;
      cTime.classList.toggle('low', low);
      const pTxt = `${v.consegnate}/${v.totale}`;
      if (pacTxt.textContent !== pTxt) pacTxt.textContent = pTxt;
      if (v.dest) {
        const d = Math.hypot(v.dest.x - b.x, v.dest.z - b.z);
        destArr.innerHTML = arrow(screenAngle(v.dest.x - b.x, v.dest.z - b.z, yaw)); // SVG nostro; i nomi (anche dei giocatori) solo come testo
        const n = nomeDi(v.dest), dd = `${Math.round(d)} m`;
        if (destName.textContent !== n) destName.textContent = n;
        if (destDist.textContent !== dd) destDist.textContent = dd;
        // etichetta sopra la meta
        v3.set(v.dest.x, 7, v.dest.z).project(o.camera);
        const rc = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
        const on = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
        tag.classList.toggle('on', on);
        if (on) {
          if (tag.dataset['id'] !== v.dest.id + abitanti.size) { tag.dataset['id'] = v.dest.id + abitanti.size; tag.replaceChildren(pixIcon('consegne', 16), el('span', '', `CONSEGNA · ${nomeDi(v.dest)}`)); }
          tag.style.left = `${rc.left - rr.left + ((v3.x + 1) / 2) * rc.width}px`; tag.style.top = `${rc.top - rr.top + ((1 - v3.y) / 2) * rc.height}px`;
        }
      } else { destArr.textContent = ''; destName.textContent = 'fatto'; destDist.textContent = ''; tag.classList.remove('on'); }
    },
  };

  registerStateProvider('consegne', () => {
    const r = run, v = r ? view(r) : null;
    return {
      active: !!r, phase: r?.phase ?? null, auto: !!r?.auto, tick: r?.frames.length ?? 0, consegnate: v?.consegnate ?? 0, totale: v?.totale ?? 0,
      dest: v?.dest ?? null, leftMs: v?.leftMs ?? 0, casse: v?.casse.filter((c) => !c.presa).length ?? 0, done: v?.done ?? false, boat: v?.boat ?? null,
      dots: dots.count, last: lastOut,
    };
  });
  /** Le partite di Consegne le corre l'autopilota (`speed` tick di sim per tick del ciclo, 1-20; 0 = di nuovo a mano). */
  registerTestHook('consegneAuto', (speed) => {
    autoSpeed = Math.max(0, Math.min(20, Math.round(Number(speed ?? 1)) || 0));
    if (run) { run.auto = autoSpeed ? run.auto ?? createRng(run.frames.length).fork('autopilot') : null; run.speed = Math.max(1, autoSpeed); } // vale anche per la partita in corso
    return autoSpeed;
  });
  registerTestHook('consegneCancel', () => { quitRun(); return true; });
  return g;
}
