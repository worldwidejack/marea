// Banco di prova dello sparatutto a missioni (#355): provasparo.html, pagina a parte, il gioco non cambia (docs/SPARO.md).
// Tappa A: il poligono nel piazzale dei container del Porto. Sim pura in @marea/sim/sparo (60 Hz fissi), qui la resa: camera in prima
// persona (l'arma in mano, inmano.ts) o in terza (l'avatar con l'arma da dietro la spalla destra, soldato.ts), il succo dei colpi
// (succo.ts), i suoni (suoni.ts), l'HUD (hud.ts). Tutto passa dalla passata pixel del gioco (metà risoluzione, palette); H = HD.
// PC: clic per catturare il mouse, WASD, clic spara, destro mira, R, Spazio, C, Shift, 1-2-3; V camera, H pixel/HD, T pilota, M muto.
// Indirizzo: ?cam=prima|terza&hd=1&auto=1&fov=90&prova=1 (prova = niente invito «clicca per giocare», per i test).
// Test: window.__sparo = { ready, state(), set({...}), perf(), avanti(n), premi(input, n) }.
import * as THREE from 'three';
import { SPARO } from '@marea/content/sparo.ts';
import type { Look } from '@marea/protocol';
import { TICK_HZ } from '@marea/sim/constants.ts';
import { mappaSparo, raggio } from '@marea/sim/sparo/mappa.ts';
import { autopilota, miraVerso, nuovaPartita, passo } from '@marea/sim/sparo/sparo.ts';
import { conoAdesso } from '@marea/sim/sparo/giocatore.ts';
import { PORTATA_MAX, direzione, toccaCorpo } from '@marea/sim/sparo/colpi.ts';
import type { SEvento, SInput, SState } from '@marea/sim/sparo/stato.ts';
import { NESSUN_INPUT, occhi, quantizzaMira, secTick } from '@marea/sim/sparo/stato.ts';
import { FLAGS } from '../flags.ts';
import { createLights } from '../render/light.ts';
import { createPost } from '../render/post.ts';
import { STYLES } from '../provapixel/styles.ts';
import { creaControlli } from './controlli.ts';
import { creaHud } from './hud.ts';
import { creaInMano } from './inmano.ts';
import { creaPiazzale } from './piazzale.ts';
import type { Piazzale } from './piazzale.ts';
import { creaSoldato } from './soldato.ts';
import type { Soldato } from './soldato.ts';
import { creaSucco } from './succo.ts';
import type { Materia } from './succo.ts';
import { creaSuoni } from './suoni.ts';

/** `alto` = vista dall'alto del piazzale (solo per le prove, da set()). */
type Cam = 'prima' | 'terza' | 'alto';
const q = new URLSearchParams(location.search);
const salvato = (() => { try { return JSON.parse(localStorage.getItem('marea.sparo') ?? '{}') as { cam?: Cam; hd?: boolean; sens?: number; fov?: number }; } catch { return {}; } })();
let cam: Cam = (q.get('cam') as Cam) ?? salvato.cam ?? 'prima';
if (cam !== 'prima' && cam !== 'terza' && cam !== 'alto') cam = 'prima';
let hd = q.has('hd') ? q.get('hd') === '1' : !!salvato.hd, auto = q.get('auto') === '1', pausa = false, muto = false;
let fovBase = Number(q.get('fov')) || salvato.fov || 90;
const prova = q.get('prova') === '1';
const salva = () => { try { localStorage.setItem('marea.sparo', JSON.stringify({ cam, hd, sens: ctl.sens, fov: fovBase })); } catch { /* niente memoria: pazienza */ } };

// ---------- resa ----------
const canvas = document.getElementById('gl') as HTMLCanvasElement, root = document.getElementById('ui') as HTMLElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
canvas.style.imageRendering = 'pixelated';
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2ce8f5');
const post = createPost();
post.setStyle(STYLES.find((st) => st.id === 'giorno')!);
post.toggles.cielo = true; post.toggles.contorni = true; post.toggles.foschia = false; // niente foschia (#282)
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 600); scene.add(camera);
const lights = createLights(); scene.add(lights.group);
lights.follow?.(SPARO.mappa.larga / 2, SPARO.mappa.lunga / 2);
function resize() {
  const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
  const k = hd ? Math.min(1.5, devicePixelRatio || 1) : Math.min(1.5, devicePixelRatio || 1) * (FLAGS.quality === 'low' ? 0.4 : 0.5);
  gl.setSize(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)), false); post.setSize(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)));
  camera.aspect = cw / Math.max(1, ch); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
resize();

let piazzale: Piazzale | null = null;
creaPiazzale().then((p) => { piazzale = p; scene.add(p.group); }).catch((e) => console.warn('[sparo] piazzale non caricato', e));
const succo = creaSucco(scene), suoni = creaSuoni(), hud = creaHud(root), inMano = creaInMano(camera);
const ctl = creaControlli(canvas, SPARO.mappa.spawn.yaw);
if (salvato.sens) ctl.sens = salvato.sens;

// ---------- la partita ----------
const m = mappaSparo();
let s: SState = nuovaPartita(Number(q.get('seme')) || 1);
inMano.arma(SPARO.armi[s.g.arma - 1]!.id);
const LOOK_IO: Look = { pelle: 1, capelli: 1, coloreCapelli: 2, vestito: 3, cappello: 0 };
const LOOK_NEMICO: Look = { pelle: 2, capelli: 4, coloreCapelli: 0, vestito: 1, cappello: 12 }; // l'elmetto: il tricorno sul modello AI sembra un vassoio
let io: Soldato | null = null;
const nemici: (Soldato | null)[] = [];
let soldatiPronti = false;
void (async () => {
  try {
    io = await creaSoldato(scene, LOOK_IO, { arma: SPARO.armi[s.g.arma - 1]!.id });
    for (let i = 0; i < s.bot.length; i++) nemici.push(await creaSoldato(scene, LOOK_NEMICO, { arma: 'mitra' }));
  } catch (e) { console.warn('[sparo] soldati non caricati', e); }
  soldatiPronti = true;
})();
const prima = { x: s.g.x, y: s.g.y, z: s.g.z };

/** TERZA: i colpi partono dagli occhi verso il punto che sta al centro dello schermo (camera dietro la spalla). */
function convergi(): { yaw: number; pitch: number } {
  const [dx, dy, dz] = direzione(ctl.yaw, ctl.pitch), o = camera.position, g = s.g;
  let t = raggio(m, o.x, o.y, o.z, dx, dy, dz, PORTATA_MAX).t;
  for (const b of s.bot) { if (b.morto) continue; const h = toccaCorpo(b, o.x, o.y, o.z, dx, dy, dz, t); if (h) t = h.t; }
  const lontano = Math.hypot(o.x - g.x, o.z - g.z) + 1;
  if (t < lontano) t = 60;
  return miraVerso(g.x, occhi(g), g.z, o.x + dx * t, o.y + dy * t, o.z + dz * t);
}
function comandi(): SInput {
  const c = ctl.leggi();
  let arma = c.arma;
  if (arma === -1) arma = (s.g.arma % SPARO.armi.length) + 1; else if (arma === -2) arma = ((s.g.arma + SPARO.armi.length - 2) % SPARO.armi.length) + 1;
  const a = cam === 'terza' ? convergi() : { yaw: ctl.yaw, pitch: ctl.pitch };
  return { mx: c.mx, my: c.my, yaw: quantizzaMira(a.yaw), pitch: quantizzaMira(a.pitch), fuoco: c.fuoco && ctl.catturato(), mira: c.mira, ricarica: c.ricarica, salto: c.salto, giu: c.giu, corsa: c.corsa, azione: c.azione, arma };
}

// ---------- eventi della sim → succo, suoni, HUD ----------
const bocca = new THREE.Vector3(), punto = new THREE.Vector3(), nor = new THREE.Vector3(), dir = new THREE.Vector3(), esp = new THREE.Vector3();
const destra = new THREE.Vector3(), su = new THREE.Vector3();
let kick = 0, scossa = 0, atterra = 0;
const materia = (i: number): Materia => { const t = m.scatole[i]?.tipo; return t === 'cassa' ? 'legno' : t === 'barriera' ? 'plastica' : 'metallo'; };
function eventi(ev: readonly SEvento[]): void {
  for (const e of ev) {
    if (e.t === 'sparo') {
      const mia = e.chi < 0;
      if (mia) {
        if (cam === 'prima') inMano.bocca(bocca); else if (io) io.bocca(bocca); else bocca.set(s.g.x, occhi(s.g), s.g.z);
        const c0 = e.colpi[0]!;
        dir.set(c0.x - bocca.x, c0.y - bocca.y, c0.z - bocca.z).normalize();
        succo.lampo(bocca, dir, cam === 'prima' ? 0.2 : 1);
        suoni.sparo(e.arma);
        const forza = e.arma === 'pompa' ? 2.4 : e.arma === 'pistola' ? 1.3 : 0.8;
        inMano.sparo(forza); kick += 0.004 * forza; scossa = Math.min(1, scossa + 0.1 * forza);
        if (e.arma !== 'pompa') {
          if (cam === 'prima') inMano.espulsione(esp); else esp.copy(bocca);
          destra.set(1, 0, 0).applyQuaternion(camera.quaternion); su.set(0, 1, 0);
          succo.bossolo(esp, destra, su, s.g.y);
        }
      }
      e.colpi.forEach((c, k) => {
        punto.set(c.x, c.y, c.z);
        if (k < 4) succo.scia(bocca, punto);
        if (c.cosa === 'nulla') return;
        const mat: Materia = c.cosa === 'attore' ? 'corpo' : c.cosa === 'acqua' ? 'acqua' : c.cosa === 'terra' ? 'cemento' : materia(c.scatola);
        nor.set(c.nx, c.ny, c.nz);
        succo.impatto(punto, nor, mat, c.cosa === 'muro' || c.cosa === 'terra');
        if (k === 0 && c.cosa === 'muro') suoni.impatto(mat === 'metallo', punto.distanceTo(camera.position));
      });
    } else if (e.t === 'colpito') {
      if (e.da < 0 && e.chi >= 0) { nemici[e.chi]?.colpito(e.testa ? 1.5 : 1); hud.segno(e.testa, false); suoni.segno(e.testa); }
    } else if (e.t === 'ucciso') {
      if (e.da < 0) { hud.segno(e.testa, true); suoni.ucciso(); if (e.testa) hud.messaggio('COLPO ALLA TESTA', 0.9); }
    } else if (e.t === 'ricarica') { const A = SPARO.armi[e.arma - 1]!; suoni.ricarica(A.id, A.ricarica); }
    else if (e.t === 'carico') suoni.carico(SPARO.armi[e.arma - 1]!.id);
    else if (e.t === 'vuoto') suoni.vuoto();
    else if (e.t === 'cambio') { const A = SPARO.armi[e.arma - 1]!; inMano.cambio(A.id, A.estrai); io?.arma(A.id); }
    else if (e.t === 'salto') suoni.salto();
    else if (e.t === 'atterra') { suoni.atterra(e.forte); atterra += e.forte * 0.03; }
  }
}
function unPasso(inp: SInput): void {
  prima.x = s.g.x; prima.y = s.g.y; prima.z = s.g.z;
  passo(s, inp);
  eventi(s.ev);
}

// ---------- prove: tasti e pannello ----------
const opzioni = () => hud.opzioni([
  { id: 'cam', etichetta: () => `camera: ${cam === 'prima' ? 'PRIMA persona' : 'TERZA persona'} (V)`, premi: () => { cam = cam === 'prima' ? 'terza' : 'prima'; salva(); } },
  { id: 'hd', etichetta: () => `grafica: ${hd ? 'HD' : 'PIXEL'} (H)`, premi: () => { hd = !hd; resize(); salva(); } },
  { id: 'sens', etichetta: () => `sensibilità mouse: ${(ctl.sens * 1000).toFixed(1)}`, premi: () => { const L = [1.4, 1.8, 2.1, 2.6, 3.2, 4]; ctl.sens = (L[(L.findIndex((v) => v >= ctl.sens * 1000 - 0.01) + 1) % L.length]!) / 1000; salva(); } },
  { id: 'fov', etichetta: () => `campo visivo: ${fovBase}°`, premi: () => { fovBase = fovBase >= 110 ? 80 : fovBase + 10; salva(); } },
  { id: 'auto', etichetta: () => `pilota automatico: ${auto ? 'SÌ' : 'NO'} (T)`, premi: () => { auto = !auto; } },
  { id: 'muto', etichetta: () => `suoni: ${muto ? 'NO' : 'SÌ'} (M)`, premi: () => { muto = !muto; suoni.muto(muto); } },
  { id: 'rifai', etichetta: () => 'ricomincia (Invio)', premi: () => ricomincia() },
]);
opzioni();
function ricomincia() { s = nuovaPartita((s.caso % 1000) + 1); inMano.arma(SPARO.armi[s.g.arma - 1]!.id); io?.arma(SPARO.armi[s.g.arma - 1]!.id); ctl.yaw = s.g.yaw; ctl.pitch = 0; }
ctl.suTasto((code) => {
  if (code === 'KeyV') { cam = cam === 'prima' ? 'terza' : 'prima'; salva(); opzioni(); }
  if (code === 'KeyH') { hd = !hd; resize(); salva(); opzioni(); }
  if (code === 'KeyT') { auto = !auto; opzioni(); }
  if (code === 'KeyM') { muto = !muto; suoni.muto(muto); opzioni(); }
  if (code === 'KeyP') pausa = !pausa;
  if (code === 'Enter') ricomincia();
});

// ---------- camera ----------
const eul = new THREE.Euler(0, 0, 0, 'YXZ'), piv = new THREE.Vector3(), off = new THREE.Vector3();
let occhiK = SPARO.giocatore.occhi, adsT = 0, corsaK = 0, fase = 0, passi = 0;
function inquadra(dt: number, alpha: number): void {
  const g = s.g, gx = prima.x + (g.x - prima.x) * alpha, gy = prima.y + (g.y - prima.y) * alpha, gz = prima.z + (g.z - prima.z) * alpha;
  if (auto) { ctl.yaw = g.yaw; ctl.pitch = g.pitch; }
  occhiK += ((g.giu ? SPARO.giocatore.occhiGiu : SPARO.giocatore.occhi) - occhiK) * Math.min(1, dt * 12);
  kick *= Math.exp(-dt * 14); scossa = Math.max(0, scossa - dt * 2.2); atterra *= Math.exp(-dt * 8);
  adsT += ((g.mira ? 1 : 0) - adsT) * Math.min(1, dt * 14); corsaK += ((g.corre ? 1 : 0) - corsaK) * Math.min(1, dt * 8);
  const vel = Math.hypot(g.vx, g.vz);
  if (g.aTerra && vel > 0.5) { fase += dt * vel * 1.9; passi += dt * vel; if (passi > (g.corre ? 2.4 : 1.9)) { passi = 0; suoni.passo(g.corre ? 1.3 : g.giu ? 0.5 : 1); } }
  const sc = scossa * scossa * 0.06, t = performance.now() / 1000;
  eul.set(ctl.pitch + g.rinculoSu + kick + Math.sin(t * 47) * sc * 0.3, ctl.yaw + g.rinculoLato + Math.sin(t * 39 + 1) * sc * 0.3, 0);
  camera.quaternion.setFromEuler(eul);
  if (cam === 'alto') {
    camera.position.set(SPARO.mappa.larga / 2, 40, SPARO.mappa.lunga + 22); camera.lookAt(SPARO.mappa.larga / 2, 0, SPARO.mappa.lunga / 2 - 2);
  } else if (cam === 'prima') {
    const bob = g.aTerra ? Math.abs(Math.sin(fase)) * 0.025 * Math.min(1, vel / 4.6) * (1 - 0.8 * adsT) : 0;
    camera.position.set(gx, gy + occhiK - bob - atterra, gz);
  } else {
    piv.set(gx, gy + occhiK - 0.02, gz);
    off.set(0.62 - 0.12 * adsT, 0.22, 2.4 - 0.95 * adsT).applyEuler(eul);
    const len = off.length(); off.divideScalar(len);
    const r = raggio(m, piv.x, piv.y, piv.z, off.x, off.y, off.z, len + 0.3);
    camera.position.copy(piv).addScaledVector(off, Math.max(0.35, Math.min(len, r.t - 0.25)));
  }
  inMano.group.visible = cam === 'prima';
  io?.visibile(cam !== 'prima');
  const A = SPARO.armi[g.arma - 1]!;
  const hf = (cam === 'prima' ? fovBase + (A.zoom - fovBase) * inMano.mira : 80 - 20 * adsT) + 5 * corsaK;
  const vf = (2 * Math.atan(Math.tan((hf * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
  camera.fov += (vf - camera.fov) * Math.min(1, dt * 18); camera.updateProjectionMatrix();
  ctl.mirando = g.mira;
  const d = ctl.scarto(), [fx, fy, fz] = direzione(ctl.yaw, ctl.pitch);
  const muro = raggio(m, camera.position.x, camera.position.y, camera.position.z, fx, fy, fz, 2).t;
  inMano.aggiorna(dt, { muro, mira: g.mira, vel, corre: g.corre, aTerra: g.aTerra, dy: d.dy, dp: d.dp, ricarica: g.ricarica ? 1 - (g.ricarica - s.tick) / secTick(A.ricarica) : -1, atterra: 0 });
  io?.aggiorna(dt, { x: gx, y: gy, z: gz, yaw: g.yaw + g.rinculoLato, pitch: g.pitch + g.rinculoSu, vel, giu: g.giu, morto: !!g.morto });
  s.bot.forEach((b, i) => nemici[i]?.aggiorna(dt, { x: b.x, y: b.y, z: b.z, yaw: b.yaw, pitch: 0, vel: 0, giu: b.giu, morto: !!b.morto }));
}

// ---------- ciclo: sim a 60 Hz fissi, resa a ogni frame ----------
const DT = 1 / TICK_HZ;
let acc = 0, last = performance.now(), frames = 0, ready = false;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!pausa) { acc += dt; while (acc >= DT) { unPasso(auto ? autopilota(s) : comandi()); acc -= DT; } }
  inquadra(dt, pausa ? 1 : acc / DT);
  if (!pausa) succo.aggiorna(dt); // in pausa anche il succo resta fermo (le foto dei test)
  const g = s.g, A = SPARO.armi[g.arma - 1]!, st = g.armi[g.arma - 1]!;
  const vivi = s.bot.filter((b) => !b.morto).length;
  hud.aggiorna({
    cono: conoAdesso(s), fovV: camera.fov, mira: g.mira, terza: cam === 'terza', colpi: st.colpi, riserva: st.riserva, nome: A.nome,
    ricarica: g.ricarica ? 1 - (g.ricarica - s.tick) / secTick(A.ricarica) : -1, vita: g.vita,
    obiettivo: 'POLIGONO · abbatti i bersagli', info: `in piedi ${vivi}/${s.bot.length} · abbattuti ${g.uccisi} · colpi a segno ${g.sparati ? Math.round((100 * g.aSegno) / g.sparati) : 0}% · alla testa ${g.teste}`,
  });
  hud.invito(!prova && !auto && !ctl.catturato());
  post.render(gl, scene, camera, now / 1000, true);
  frames++;
  if (!ready && frames > 5 && piazzale && soldatiPronti) ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const stato = () => {
  const g = s.g, st = g.armi[g.arma - 1]!;
  return { tick: s.tick, cam, hd, auto, x: g.x, y: g.y, z: g.z, yaw: g.yaw, pitch: g.pitch, vita: g.vita, arma: g.arma, colpi: st.colpi, riserva: st.riserva, mira: g.mira,
    uccisi: g.uccisi, sparati: g.sparati, aSegno: g.aSegno, teste: g.teste, inPiedi: s.bot.filter((b) => !b.morto).length, pezzi: piazzale?.pezzi ?? 0,
    soldati: nemici.filter(Boolean).length, io: !!io, fov: camera.fov };
};
(window as unknown as { __sparo: unknown }).__sparo = {
  get ready() { return ready; },
  state: stato,
  set(o: { cam?: Cam; hd?: boolean; auto?: boolean; pausa?: boolean; x?: number; z?: number; yaw?: number; pitch?: number }) {
    if (o.cam) cam = o.cam;
    if (o.hd !== undefined) { hd = o.hd; resize(); }
    if (o.auto !== undefined) auto = o.auto;
    if (o.pausa !== undefined) pausa = o.pausa;
    if (o.x !== undefined) { s.g.x = o.x; prima.x = o.x; }
    if (o.z !== undefined) { s.g.z = o.z; prima.z = o.z; }
    if (o.yaw !== undefined) { ctl.yaw = o.yaw; s.g.yaw = o.yaw; }
    if (o.pitch !== undefined) { ctl.pitch = o.pitch; s.g.pitch = o.pitch; }
    opzioni();
  },
  perf: () => ({ calls: post.sceneCalls(), tris: post.sceneTris(), piazzale: piazzale?.tris ?? 0 }),
  /** Avanza di `n` tick subito (col pilota automatico se acceso, sennò fermo). */
  avanti(n: number) { for (let i = 0; i < n; i++) unPasso(auto ? autopilota(s) : { ...NESSUN_INPUT, yaw: ctl.yaw, pitch: ctl.pitch }); return stato(); },
  /** Tiene premuti i comandi `o` per `n` tick (test dei tasti senza mouse catturato). */
  premi(o: Partial<SInput>, n = 1) { for (let i = 0; i < n; i++) unPasso({ ...NESSUN_INPUT, yaw: quantizzaMira(ctl.yaw), pitch: quantizzaMira(ctl.pitch), ...o }); return stato(); },
  /** Prove: la partita, un frame disegnato subito, il succo avanti di `sec` secondi (anche in pausa). */
  partita: () => s,
  rendi(dt = 0) { inquadra(dt, 1); post.render(gl, scene, camera, performance.now() / 1000, true); },
  succoAvanti(sec: number) { for (let t = 0; t < sec; t += 1 / 60) succo.aggiorna(1 / 60); },
  scene,
};
