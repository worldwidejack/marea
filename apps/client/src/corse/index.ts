// Gran Premio (Isola delle Corse, docs/CORSE.md) lato client: chunk scaricato alla prima partita (game/minigiochi.ts → registraSchermo).
// È un «gioco nel mondo» (SchermoGioco con step/update, come Consegne): minigiochi gli passa un input per tick e il mondo intanto sta
// fermo. Prende lo schermo con una scena sua (renderer.setScene) e la camera dietro al kart; alla fine restituisce gli input compressi,
// che il server rigioca (stesso tempo, stessa posizione). Giro: scelta della guida (MORBIDA / MEDIA / NERVOSA, la prova A/B di Jack:
// è il primo input della partita) → semaforo 3-2-1 → 3 giri → arrivo → consegna.
// Comandi: il joystick (o A/D, frecce) sterza, il gas è automatico, giù (S, freccia giù, B) frena e fa retromarcia; DRIFT = A (Spazio
// da PC) tenuto in curva, oppure tieni lo sterzo tutto da una parte e parte da solo. Il drift carica il turbo: scintille gialle, poi rosa.
import * as THREE from 'three';
import { MINIGAMES_CFG } from '@marea/content';
import { corse, corsePilota, corsePista, corseStartFrame, createRng, packInputs, quantize } from '@marea/sim';
import type { CorseState, CorseView, InputFrame, Kart, PackedInputs } from '@marea/sim';
import type { SchermoGioco } from '../game/minigiochi.ts';
import type { GameWorld } from '../game/world.ts';
import type { Renderer } from '../render/scene.ts';
import { createLights } from '../render/light.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { kartGeo } from '../render/island_corse.ts';
import { suona } from '../audio/ponte.ts';
import { PAL, el } from '../ui/style.ts';
import { setTopbarHidden } from '../ui/topbar.ts';
import { tempoCorsa } from '../ui/porto_amici_ui.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { creaPista3d } from './pista3d.ts';

const CFG = MINIGAMES_CFG.corse;
const COUNTDOWN = 180, END_WAIT = 240, END_SKIP = 45, LAP_FLASH = 90;
const COLORI = [P.giallo, P.acquaBassa, P.viola, P.arancio, P.erbaChiara];
const CASCHI = [P.rosso, P.pietraChiara, P.pietraChiara, P.pietraChiara, P.pietraChiara];
const SCINTILLE = 160;
const GUIDA_KEY = 'mz-gp-guida';
const PAS = 'pointer-events: none !important;';

const CSS = `
body.mz-gp #compass, body.mz-gp #mzTop, body.mz-gp #mzGuida, body.mz-gp #mzGuidaPtr, body.mz-gp .mz-bar, body.mz-gp .mz-work, body.mz-gp .mz-labels,
body.mz-gp #mzPlay, body.mz-gp #mzEmoteRow, body.mz-gp #mzEmotes, body.mz-gp #mzSheet, body.mz-gp #mzMini, body.mz-gp #mzMetePtr, body.mz-gp #mzTarghe,
body.mz-gp #mzTrag, body.mz-gp .mz-play { display: none !important; }
.mz-gp-hud { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: none; justify-content: center; gap: 6px; z-index: 14; ${PAS} font-family: ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara}; }
.mz-gp-hud.on { display: flex; }
.mz-gp-hud .c { display: flex; align-items: baseline; gap: 6px; min-height: 40px; padding: 4px 10px 0; box-sizing: border-box; background: rgba(46,30,20,.92); border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; font-size: 20px; font-weight: bold; white-space: nowrap; }
.mz-gp-hud .c small { font-size: 12px; color: ${PAL.sabbia}; }
.mz-gp-hud .pos b { font-size: 28px; color: ${PAL.giallo}; }
.mz-gp-hud .turbo { border-color: ${PAL.arancio}; color: ${PAL.arancio}; }
@media (max-width: 480px) { .mz-gp-hud { gap: 4px; } .mz-gp-hud .c { padding: 4px 6px 0; font-size: 16px; } .mz-gp-hud .pos b { font-size: 22px; } }
.mz-gp-map { position: absolute; right: max(8px, env(safe-area-inset-right, 0px)); top: calc(max(8px, env(safe-area-inset-top)) + 52px); width: 112px; height: 86px; display: none; background: rgba(46,30,20,.7); border: 2px solid ${PAL.legnoChiaro}; image-rendering: pixelated; z-index: 14; ${PAS} }
.mz-gp-map.on { display: block; }
.mz-gp-big { position: absolute; left: 50%; top: 32%; transform: translate(-50%, -50%); display: none; padding: 12px 22px; background: rgba(46,30,20,.95); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; text-align: center; z-index: 15; ${PAS} font: bold 44px ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara}; white-space: nowrap; }
.mz-gp-big.on { display: block; }
.mz-gp-big small { display: block; margin-top: 6px; font-size: 15px; color: ${PAL.sabbia}; }
.mz-gp-quit { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: calc(max(8px, env(safe-area-inset-top)) + 52px); display: none; min-height: 44px; min-width: 44px; padding: 0 10px; align-items: center; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; font: bold 14px ui-monospace, Menlo, monospace; z-index: 14; cursor: pointer; }
.mz-gp-quit.on { display: flex; }
.mz-gp-intro { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(380px, calc(100% - 32px)); box-sizing: border-box; padding: 16px; display: none; background: rgba(46,30,20,.97); border: 3px solid ${PAL.rosso}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; text-align: center; font-family: ui-monospace, Menlo, monospace; color: ${PAL.sabbiaChiara}; }
.mz-gp-intro.on { display: block; }
.mz-gp-intro h2 { margin: 0; font-size: 26px; letter-spacing: .06em; }
.mz-gp-intro .sub { color: ${PAL.sabbia}; font-size: 14px; margin: 4px 0 12px; }
.mz-gp-intro .lbl { font-size: 13px; color: ${PAL.sabbia}; margin-bottom: 6px; letter-spacing: .08em; }
.mz-gp-intro .guide { display: flex; gap: 6px; margin-bottom: 8px; }
.mz-gp-intro .guide button { flex: 1; min-height: 48px; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; padding: 0 4px; }
.mz-gp-intro .guide button.on { background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border-color: ${PAL.neroCaldo}; }
.mz-gp-intro .desc { font-size: 13px; min-height: 34px; color: ${PAL.sabbiaChiara}; margin-bottom: 10px; }
.mz-gp-intro .cmd { font-size: 12px; color: ${PAL.sabbia}; line-height: 1.5; margin-bottom: 12px; text-align: left; }
.mz-gp-intro .cmd b { color: ${PAL.sabbiaChiara}; }
.mz-gp-intro .via { width: 100%; min-height: 56px; background: ${PAL.erbaChiara}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 22px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-gp-intro .esci { margin-top: 10px; background: none; border: none; color: ${PAL.sabbia}; font: 13px ui-monospace, Menlo, monospace; text-decoration: underline; cursor: pointer; min-height: 32px; }
`;
const DESCRIZIONE = [
  'Tiene la strada: sterza piano e scivola poco. Per cominciare.',
  'La via di mezzo: curve svelte, il drift si sente.',
  'Scatta e sterza secca, scivola tanto: veloce se la domi.',
];

type Fase = 'intro' | 'via' | 'gara' | 'fine';
type Run = {
  s: CorseState; frames: InputFrame[]; fase: Fase; wait: number; auto: boolean; speed: number; giro: number; flash: number;
  esito: ReturnType<typeof corse.result> | null; finish(v: PackedInputs | null): void;
};

export function createCorse(o: { root: HTMLElement; renderer: Renderer; world: GameWorld }): SchermoGioco {
  if (!document.getElementById('mz-gp-style')) { const st = document.createElement('style'); st.id = 'mz-gp-style'; st.textContent = CSS; document.head.appendChild(st); }
  const pista = corsePista();
  const stop = (e: Event) => e.stopPropagation();

  // ---- scena ----
  const scene = new THREE.Scene(); scene.name = 'gran_premio';
  scene.background = o.renderer.sky.texture;
  scene.fog = new THREE.Fog(P.acquaBassa, 120, 300);
  const p3 = creaPista3d(pista); scene.add(p3.group);
  const luci = createLights(); scene.add(luci.group);
  const kartMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const karts = COLORI.map((c, i) => {
    const g = merged([
      kartGeo(c, i),
      painted(new THREE.BoxGeometry(0.55, 0.55, 0.4), c, M(0, 0.85, 0.2)), // busto del pilota
      painted(new THREE.BoxGeometry(0.46, 0.44, 0.48), CASCHI[i]!, M(0, 1.32, 0.12)), // casco
      painted(new THREE.BoxGeometry(0.4, 0.14, 0.06), P.neroCaldo, M(0, 1.34, -0.13)), // visiera
    ]);
    const m = new THREE.Mesh(g, kartMat); m.castShadow = true; m.name = i ? `gp_bot_${i}` : 'gp_tu';
    scene.add(m); return m;
  });
  // scintille del drift e fiammate del turbo: cubetti che volano via (un solo InstancedMesh)
  const sc = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshBasicMaterial({ color: 0xffffff }), SCINTILLE);
  sc.name = 'gp_scintille'; sc.frustumCulled = false; sc.count = 0; scene.add(sc);
  const parts: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; c: string }[] = [];
  const m4 = new THREE.Matrix4(), cc = new THREE.Color();

  // ---- interfaccia ----
  const hud = el('div', 'mz mz-gp-hud'); hud.id = 'mzGpHud';
  const chip = (cls: string) => { const c = el('div', 'c ' + cls); hud.appendChild(c); return c; };
  const cPos = chip('pos'), cGiro = chip('giro'), cTempo = chip('tempo');
  const map = el('canvas', 'mz-gp-map') as HTMLCanvasElement; map.width = 112; map.height = 86; map.id = 'mzGpMappa';
  const big = el('div', 'mz-gp-big'); big.id = 'mzGpBig';
  const quit = el('button', 'mz-gp-quit', 'Esc · Ritirati') as HTMLButtonElement; quit.type = 'button'; quit.id = 'mzGpEsci';
  const intro = el('div', 'mz mz-gp-intro'); intro.id = 'mzGpIntro';
  for (const e of [hud, map, big, quit, intro]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, stop);
  o.root.append(hud, map, big, quit, intro);
  const setBig = (t: string | null, color?: string, sub?: string) => {
    big.classList.toggle('on', !!t); if (!t) return;
    big.textContent = t; big.style.color = color ?? PAL.sabbiaChiara; big.style.borderColor = color ?? PAL.legnoChiaro;
    if (sub) big.appendChild(el('small', '', sub));
  };

  // la minimappa della pista (scalata nel riquadro, Nord in alto)
  const mb = p3.bounds, mk = Math.min((112 - 10) / (mb.x1 - mb.x0), (86 - 10) / (mb.z1 - mb.z0));
  const mx = (x: number) => 5 + (x - mb.x0) * mk + ((112 - 10) - (mb.x1 - mb.x0) * mk) / 2, mz = (z: number) => 5 + (z - mb.z0) * mk + ((86 - 10) - (mb.z1 - mb.z0) * mk) / 2;
  const disegnaMappa = (v: CorseView) => {
    const g = map.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, 112, 86);
    g.strokeStyle = P.pietraChiara; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= pista.n; i += 3) { const k = i % pista.n; if (i) g.lineTo(mx(pista.x[k]!), mz(pista.z[k]!)); else g.moveTo(mx(pista.x[k]!), mz(pista.z[k]!)); }
    g.closePath(); g.stroke();
    for (let i = v.karts.length - 1; i >= 0; i--) { const k = v.karts[i]!; g.fillStyle = i ? COLORI[i]! : P.rosso; const r = i ? 2 : 3; g.fillRect(Math.round(mx(k.x)) - r, Math.round(mz(k.z)) - r, r * 2, r * 2); }
  };

  // scelta della guida
  let guida = CFG.guidaDiSerie;
  try { const g = Number(localStorage.getItem(GUIDA_KEY)); if (Number.isInteger(g) && g >= 0 && g < CFG.guide.length) guida = g; } catch { /* niente memoria: di serie */ }
  const tocco = matchMedia('(pointer: coarse)').matches;
  const guideBtns = CFG.guide.map((g, i) => {
    const b = el('button', '', g.nome.toUpperCase()) as HTMLButtonElement; b.type = 'button'; b.dataset['guida'] = g.id;
    b.addEventListener('click', () => { scegli(i); suona('click'); }); return b;
  });
  const desc = el('div', 'desc');
  const via = el('button', 'via', 'VIA!') as HTMLButtonElement; via.type = 'button'; via.id = 'mzGpVia';
  const esci = el('button', 'esci', 'Torna all’isola') as HTMLButtonElement; esci.type = 'button';
  const guideRow = el('div', 'guide'); guideRow.append(...guideBtns);
  const cmd = el('div', 'cmd');
  cmd.innerHTML = tocco
    ? '<b>Joystick</b>: sterza (il gas è automatico) · giù: frena<br><b>DRIFT</b> tenuto in curva, oppure sterzo tutto da una parte: carica il turbo, lascia e parti'
    : '<b>A D</b> o <b>← →</b>: sterza (il gas è automatico) · <b>S ↓</b>: frena<br><b>Spazio</b> tenuto in curva = DRIFT (o sterzo tenuto): carica il turbo, lascia e parti';
  intro.append(el('h2', '', `🏁 ${CFG.nome.toUpperCase()}`), el('div', 'sub', `${CFG.pista.nome} · ${CFG.giri} giri · 4 avversari`), el('div', 'lbl', 'COME VUOI LA GUIDA?'), guideRow, desc, cmd, via, esci);
  function scegli(i: number): void {
    guida = i; desc.textContent = DESCRIZIONE[i] ?? '';
    guideBtns.forEach((b, k) => b.classList.toggle('on', k === i));
    try { localStorage.setItem(GUIDA_KEY, String(i)); } catch { /* pazienza */ }
  }
  scegli(guida);

  // ---- partita ----
  let run: Run | null = null, autoSpeed = FLAGS.autopilot ? 4 : 0;
  let last: { ticks: number; rows: number; result: unknown; cancelled: boolean; guida: number } | null = null;
  let btnA: string | null = null, btnB: string | null = null;
  const fov0 = { fov: o.renderer.camera.fov, far: o.renderer.camera.far };
  const cam = { x: 0, y: 3, z: 0, lx: 0, ly: 1, lz: 0, yaw: 0, fov: 64, ok: false };

  const parti = () => {
    const r = run; if (!r || r.fase !== 'intro') return;
    intro.classList.remove('on');
    const f = quantize(corseStartFrame(guida)); r.frames.push(f); corse.step(r.s, f);
    r.fase = 'via'; r.wait = COUNTDOWN; setBig('3', PAL.rosso, 'Il gas è automatico: tu sterza'); suona('bip');
  };
  via.addEventListener('click', parti);
  const quitRun = () => { const r = run; if (!r) return; r.finish(r.fase === 'fine' ? packInputs(r.frames) : null); };
  quit.addEventListener('click', quitRun); esci.addEventListener('click', quitRun);
  const onKey = (e: KeyboardEvent) => {
    if (!run) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); quitRun(); return; }
    if (run.fase === 'intro') {
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (n >= 0 && n < CFG.guide.length) { scegli(n); return; }
      if (e.code === 'Enter') { e.preventDefault(); parti(); }
    }
  };
  /** L'input del mondo (assi mondo, game/input.ts) → schermo: sterzo, gas automatico, freno, drift. */
  const comandi = (f: InputFrame): InputFrame => {
    const yaw = o.renderer.diorama.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const sx = rx * f.mx + rz * f.my, sy = -(fx * f.mx + fz * f.my);
    const freno = f.b || sy > 0.5;
    return { mx: Math.max(-1, Math.min(1, sx / 0.7)), my: freno ? -1 : 1, a: f.a, b: false };
  };
  const pulsanti = (on: boolean) => {
    const a = document.getElementById('btnA'), b = document.getElementById('btnB');
    if (on) { if (a) { btnA ??= a.textContent; a.textContent = 'DRIFT'; a.style.fontSize = '17px'; } if (b) { btnB ??= b.textContent; b.textContent = 'FRENO'; b.style.fontSize = '13px'; } }
    else { if (a && btnA !== null) { a.textContent = btnA; a.style.fontSize = ''; } if (b && btnB !== null) { b.textContent = btnB; b.style.fontSize = ''; } btnA = btnB = null; }
  };

  const view = (r: Run) => corse.view(r.s) as CorseView;
  const g: SchermoGioco = {
    run({ seed, difficulty }) {
      if (run) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as 1 | 2 | 3;
      const s = corse.create({ seed: seed >>> 0, difficulty: d });
      return new Promise<PackedInputs | null>((resolve) => {
        const r: Run = {
          s, frames: [], fase: 'intro', wait: 0, auto: autoSpeed > 0, speed: Math.max(1, autoSpeed), giro: 1, flash: 0, esito: null,
          finish(v) {
            if (run !== r) return;
            run = null;
            removeEventListener('keydown', onKey, true);
            for (const e of [hud, map, quit, intro]) e.classList.remove('on');
            setBig(null); document.body.classList.remove('mz-gp'); setTopbarHidden(false); pulsanti(false);
            const c = o.renderer.camera; c.fov = fov0.fov; c.far = fov0.far; c.updateProjectionMatrix();
            o.renderer.setScene(null); o.renderer.diorama.snap?.();
            parts.length = 0; sc.count = 0;
            last = { ticks: r.frames.length, rows: v?.length ?? 0, result: r.esito ?? corse.result(r.s), cancelled: !v, guida };
            console.log(`[marea] gran premio ${v ? 'finito' : 'annullato'}: ${r.frames.length} tick, ${v?.length ?? 0} righe`);
            resolve(v);
          },
        };
        run = r; cam.ok = false;
        addEventListener('keydown', onKey, true);
        o.renderer.setScene(scene);
        document.body.classList.add('mz-gp'); pulsanti(true);
        for (const e of [hud, map, quit]) e.classList.add('on');
        if (r.auto) parti(); else intro.classList.add('on');
      });
    },
    isOpen: () => !!run,
    esito: (d) => {
      const n = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0);
      return n('giri') >= n('tot') && n('tot') > 0 ? `${n('pos')}° su 5 · ${tempoCorsa(n('ms'))} · giro migliore ${tempoCorsa(n('giro'))}` : 'Gara non finita';
    },
    step(f) {
      const r = run; if (!r) return;
      if (r.fase === 'intro') { return; }
      if (r.fase === 'via') {
        r.wait--;
        if (r.wait > 0) { if (r.wait % 60 === 59) { setBig(String(Math.ceil(r.wait / 60)), r.wait > 60 ? PAL.rosso : PAL.giallo, 'Il gas è automatico: tu sterza'); suona('bip'); } return; }
        r.fase = 'gara'; r.flash = 50; setBig('VIA!', PAL.erbaChiara); suona('via');
        return;
      }
      if (r.fase === 'gara') {
        for (let i = 0; i < r.speed && r.fase === 'gara'; i++) {
          const frame = quantize(r.auto ? corsePilota(r.s) : comandi(f)); // quantizzato come nel replay del server
          r.frames.push(frame); corse.step(r.s, frame);
          const v = view(r);
          if (v.giro !== r.giro && !v.done) { r.giro = v.giro; r.flash = LAP_FLASH; setBig(v.giro === v.giri ? 'ULTIMO GIRO!' : `GIRO ${v.giro}`, v.giro === v.giri ? PAL.arancio : PAL.sabbiaChiara, v.bestMs ? `giro migliore ${tempoCorsa(v.bestMs)}` : undefined); suona('boa'); }
          if (v.done || r.frames.length >= corse.maxTicks) {
            r.fase = 'fine'; r.wait = END_WAIT; r.esito = corse.result(r.s);
            const pos = v.posizioni[0]!, m = r.esito.medal;
            setBig(v.finished ? `${pos}° POSTO!` : 'TEMPO SCADUTO', m === 'oro' ? PAL.giallo : m === 'argento' ? PAL.pietraChiara : m === 'bronzo' ? PAL.arancio : PAL.sabbiaChiara, v.finished ? `${tempoCorsa(v.ms)} · il server conferma` : undefined);
            suona(v.finished ? 'arrivo' : 'fine');
          }
        }
        if (r.flash > 0 && --r.flash === 0 && r.fase === 'gara') setBig(null);
        return;
      }
      r.wait--;
      if (r.wait <= 0 || (END_WAIT - r.wait > END_SKIP && f.a)) r.finish(packInputs(r.frames));
    },
    update() {
      const r = run; if (!r) return;
      setTopbarHidden(true); // main.ts la rimette a posto ogni frame prima di noi
      const v = view(r), dt = 1 / 60;
      // kart
      v.karts.forEach((k: Kart, i) => {
        const m = karts[i]!;
        m.position.set(k.x, 0.02, k.z);
        m.rotation.set(0, Math.atan2(k.fx, k.fz) + Math.PI, k.drift ? -k.drift * 0.12 : 0); // il modello guarda verso −Z, la sim col muso (fx, fz)
      });
      const me = v.karts[0]!;
      // scintille: dal posteriore in drift (giallo, poi rosa al secondo livello) e fiammate col turbo
      const D = CFG.drift, rng = createRng(r.s.tick);
      const emetti = (k: Kart, c: string, n: number) => {
        for (let j = 0; j < n && parts.length < SCINTILLE; j++) {
          const lato = j % 2 ? 1 : -1, rx = -k.fz * lato, rz = k.fx * lato; // la ruota dietro a destra o a sinistra
          parts.push({ x: k.x - k.fx + rx * 0.75, y: 0.12, z: k.z - k.fz + rz * 0.75, vx: k.ux * k.v * 0.85 + rx * (1 + rng.next() * 1.5), vy: 1 + rng.next() * 1.8, vz: k.uz * k.v * 0.85 + rz * (1 + rng.next() * 1.5), t: 0.18 + rng.next() * 0.17, c }); // vanno avanti quasi col kart: restano attaccate alle ruote
        }
      };
      for (const k of v.karts) {
        if (k.drift) emetti(k, k.carica >= D.carica[1] ? P.rosaNeon : k.carica >= D.carica[0] ? P.giallo : P.pietraChiara, k.carica >= D.carica[0] ? 2 : 1);
        if (k.turbo > 0) emetti(k, k.livello === 2 ? P.rosso : P.arancio, 2);
      }
      let n = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i]!; q.t -= dt; if (q.t <= 0) { parts.splice(i, 1); continue; }
        q.vy -= 9 * dt; q.x += q.vx * dt; q.y = Math.max(0.05, q.y + q.vy * dt); q.z += q.vz * dt;
      }
      for (const q of parts) { m4.makeTranslation(q.x, q.y, q.z); sc.setMatrixAt(n, m4); sc.setColorAt(n, cc.set(q.c)); n++; }
      sc.count = n; sc.instanceMatrix.needsUpdate = true; if (sc.instanceColor) sc.instanceColor.needsUpdate = true;
      // camera dietro al kart: segue il muso, un po' il moto (in drift si vede il kart di traverso); più larga col turbo
      const yaw = Math.atan2(me.fx, me.fz), moto = Math.atan2(me.ux, me.uz), yawT = yaw + 0.35 * Math.atan2(Math.sin(moto - yaw), Math.cos(moto - yaw));
      if (!cam.ok) { cam.yaw = yawT; cam.ok = true; } else cam.yaw += Math.atan2(Math.sin(yawT - cam.yaw), Math.cos(yawT - cam.yaw)) * Math.min(1, dt * 6);
      const c = o.renderer.camera, alto = c.aspect < 0.8; // telefono in verticale: camera più alta e più larga, si vede più strada
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), dist = (alto ? 7.6 : 6.4) + Math.max(0, me.v) * 0.04, alt = alto ? 3.6 : 2.7;
      const tx = me.x - fx * dist, tz = me.z - fz * dist;
      const k = cam.ok && r.frames.length > 1 ? Math.min(1, dt * 10) : 1;
      cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k; cam.y += (alt - cam.y) * k;
      const fov = (alto ? 80 : 64) + (me.turbo > 0 ? 8 : 0) + Math.max(0, me.v - 15) * 0.3;
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 5);
      c.position.set(cam.x, cam.y, cam.z); c.lookAt(me.x + fx * 4, alto ? 0.6 : 1.0, me.z + fz * 4);
      if (Math.abs(c.fov - cam.fov) > 0.05 || c.far !== 320) { c.fov = cam.fov; c.far = 320; c.updateProjectionMatrix(); }
      luci.sun.position.set(me.x - 30, 40, me.z + 20); luci.sun.target.position.set(me.x, 0, me.z);
      // HUD
      const pos = v.posizioni[0]!;
      cPos.replaceChildren(el('b', '', `${pos}°`), el('small', '', '/5'));
      cGiro.replaceChildren(el('small', '', 'GIRO'), document.createTextNode(`${v.giro}/${v.giri}`));
      cTempo.replaceChildren(document.createTextNode(tempoCorsa(v.ms)));
      cTempo.classList.toggle('turbo', me.turbo > 0);
      disegnaMappa(v);
    },
  };

  registerStateProvider('corse', () => {
    const r = run;
    if (!r) return { active: false, last, guida };
    const v = view(r);
    return { active: true, fase: r.fase, auto: r.auto, guida, frames: r.frames.length, giro: v.giro, pos: v.posizioni[0], ms: v.ms, done: v.done, v: Math.round((v.karts[0]?.v ?? 0) * 10) / 10, drift: v.karts[0]?.drift ?? 0, last };
  });
  /** Le gare le corre il pilota automatico (`speed` tick di sim per tick del ciclo, 1-20; 0 = di nuovo a mano). */
  registerTestHook('corseAuto', (speed) => {
    autoSpeed = Math.max(0, Math.min(20, Number(speed) || 0));
    if (run) { run.auto = autoSpeed > 0; run.speed = Math.max(1, autoSpeed); if (run.auto) parti(); }
    return autoSpeed;
  });
  registerTestHook('corseGuida', (i) => { scegli(Math.max(0, Math.min(CFG.guide.length - 1, Number(i) || 0))); return guida; });
  registerTestHook('corseVia', () => { parti(); return !!run; });
  registerTestHook('corseEsci', () => { quitRun(); return true; });
  return g;
}
