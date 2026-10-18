// Banco di prova dello sparatutto a missioni (#355): provasparo.html, pagina a parte, il gioco non cambia (docs/SPARO.md).
// Di serie la Missione 0 · Il piazzale (sentinelle, gru da sabotare, rinforzi, barca); ?modo=poligono = i bersagli fermi della Tappa A.
// Sim pura in @marea/sim/sparo (60 Hz fissi); qui la resa: camera in prima persona (l'arma in mano, inmano.ts) o in terza (l'avatar da
// dietro la spalla destra, squadra.ts), succo e suoni dagli eventi (eventi.ts), HUD (hud.ts, missione_ui.ts). Passata pixel del gioco
// (metà risoluzione, palette); H = HD. PC: clic per catturare il mouse, WASD, clic spara, destro mira, R, Spazio, C, Shift, E, 1-2-3;
// V camera, H pixel/HD, T pilota, M muto, Invio ricomincia; Esc = pausa. Telefono (tocco.ts, come COD Mobile): joystick col lucchetto della corsa, due SPARA, MIRA a tocco, trascini per mirare;
// spara e mira, mira assistita (si attacca e rallenta sul nemico) e sparo automatico spegnibili dal pannello «⚙ prove».
// Indirizzo: ?modo=poligono&cam=prima|terza&hd=1&auto=1&fov=90&prova=1 (prova = parte subito, senza briefing né pausa: per i test).
// Test: window.__sparo = { ready, state(), set({...}: anche assistita, automatico), perf(), avanti(n), premi(input, n), partita(), rendi(dt), succoAvanti(s) }.
import * as THREE from 'three';
import { SPARO } from '@marea/content/sparo.ts';
import { TICK_HZ } from '@marea/sim/constants.ts';
import { mappaSparo, raggio, vede } from '@marea/sim/sparo/mappa.ts';
import { autopilota, miraVerso, nuovaPartita, passo } from '@marea/sim/sparo/sparo.ts';
import { conoAdesso } from '@marea/sim/sparo/giocatore.ts';
import { PORTATA_MAX, direzione, toccaCorpo } from '@marea/sim/sparo/colpi.ts';
import { scarto } from '@marea/sim/sparo/coperture.ts';
import { inCerchio } from '@marea/sim/sparo/missione.ts';
import type { SInput, SModo, SState } from '@marea/sim/sparo/stato.ts';
import { NESSUN_INPUT, collo, occhi, quantizzaMira, secTick } from '@marea/sim/sparo/stato.ts';
import { FLAGS } from '../flags.ts';
import { createLights } from '../render/light.ts';
import { createPost } from '../render/post.ts';
import { STYLES } from '../provapixel/styles.ts';
import { creaControlli } from './controlli.ts';
import { creaEventi } from './eventi.ts';
import { creaHud } from './hud.ts';
import { creaInMano } from './inmano.ts';
import { creaMissioneUi } from './missione_ui.ts';
import { creaPiazzale } from './piazzale.ts';
import type { Piazzale } from './piazzale.ts';
import { creaSquadra } from './squadra.ts';
import { creaSucco } from './succo.ts';
import { creaSuoni } from './suoni.ts';
import { creaTocco } from './tocco.ts';

/** `alto` = vista dall'alto del piazzale (solo per le prove, da set()). */
type Cam = 'prima' | 'terza' | 'alto';
const q = new URLSearchParams(location.search), M = SPARO.mappa;
const salvato = (() => { try { return JSON.parse(localStorage.getItem('marea.sparo') ?? '{}') as { cam?: Cam; hd?: boolean; sens?: number; fov?: number; assistita?: boolean; automatico?: boolean; sparaMira?: boolean }; } catch { return {}; } })();
let cam: Cam = (q.get('cam') as Cam) ?? salvato.cam ?? 'prima';
if (cam !== 'prima' && cam !== 'terza' && cam !== 'alto') cam = 'prima';
let modo: SModo = q.get('modo') === 'poligono' ? 'poligono' : 'missione', immortale = false;
let hd = q.has('hd') ? q.get('hd') === '1' : !!salvato.hd, auto = q.get('auto') === '1', pausa = false, muto = false;
let fovBase = Number(q.get('fov')) || salvato.fov || 90, assistita = salvato.assistita ?? true, automatico = salvato.automatico ?? true;
/** Telefono: tenere SPARA mette anche in mira (pistola e mitra; il pompa spara dal fianco), come lo «ADS fire» di COD Mobile. */
let sparaMira = salvato.sparaMira ?? true;
const prova = q.get('prova') === '1';
const salva = () => { try { localStorage.setItem('marea.sparo', JSON.stringify({ cam, hd, sens: ctl.sens, fov: fovBase, assistita, automatico, sparaMira })); } catch { /* niente memoria: pazienza */ } };

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
lights.follow?.(M.larga / 2, M.lunga / 2);
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
const ctl = creaControlli(canvas, M.spawn.yaw);
if (salvato.sens) ctl.sens = salvato.sens;
const tocco = creaTocco(root, ctl);
const succo = creaSucco(scene), suoni = creaSuoni(), hud = creaHud(root, tocco.attivo), mui = creaMissioneUi(root), inMano = creaInMano(camera);

// ---------- la partita ----------
const m = mappaSparo();
const nuova = (): SState => nuovaPartita(Number(q.get('seme')) || 1 + Math.floor(Math.random() * 999), { modo, immortale });
let s: SState = nuova();
let avviata = prova || auto || modo === 'poligono', finita = false; // il briefing solo per la missione
inMano.arma(SPARO.armi[s.g.arma - 1]!.id);
const squadra = creaSquadra(scene, Math.max(M.nemici.length + M.rinforzi.length, M.bersagli.length), SPARO.armi[s.g.arma - 1]!.id);
const prima = { x: s.g.x, y: s.g.y, z: s.g.z };
let kick = 0, scossa = 0, atterra = 0;
const eventi = creaEventi({
  m, camera, succo, suoni, hud, mui, inMano, squadra, prima: () => cam === 'prima', partita: () => s,
  scuoti: (k) => { scossa = Math.min(1, scossa + k); }, calcio: (k) => { kick += k; }, atterra: (k) => { atterra += k; },
});
const avvia = () => { if (avviata) return; avviata = true; mui.briefing(false, tocco.attivo); };
canvas.addEventListener('mousedown', avvia); root.addEventListener('pointerdown', () => { if (tocco.attivo) avvia(); });
if (!avviata) mui.briefing(true, tocco.attivo);

/** TERZA: i colpi partono dagli occhi verso il punto che sta al centro dello schermo (camera dietro la spalla). */
function convergi(): { yaw: number; pitch: number } {
  const [dx, dy, dz] = direzione(ctl.yaw, ctl.pitch), o = camera.position, g = s.g;
  let t = raggio(m, o.x, o.y, o.z, dx, dy, dz, PORTATA_MAX).t;
  for (const b of s.bot) { if (b.morto) continue; const h = toccaCorpo(b, o.x, o.y, o.z, dx, dy, dz, t); if (h) t = h.t; }
  if (t < Math.hypot(o.x - g.x, o.z - g.z) + 1) t = 60;
  return miraVerso(g.x, occhi(g), g.z, o.x + dx * t, o.y + dy * t, o.z + dz * t);
}
/** Il centro dello schermo è su un nemico in vista (per lo sparo automatico del telefono). */
function mirinoSuNemico(): boolean {
  const [dx, dy, dz] = direzione(ctl.yaw, ctl.pitch), o = camera.position, t = Math.min(45, raggio(m, o.x, o.y, o.z, dx, dy, dz, 45).t);
  return s.bot.some((b) => !b.morto && b.tipo === 'nemico' && !!toccaCorpo(b, o.x, o.y, o.z, dx, dy, dz, t));
}
function comandi(): SInput {
  const c = ctl.leggi(), t = tocco.attivo ? tocco.leggi() : null, g = s.g, A = SPARO.armi[g.arma - 1]!;
  let arma = c.arma || (t?.arma ?? 0);
  if (arma === -1) arma = (g.arma % SPARO.armi.length) + 1; else if (arma === -2) arma = ((g.arma + SPARO.armi.length - 2) % SPARO.armi.length) + 1;
  let fuoco = (c.fuoco && ctl.catturato()) || !!t?.fuoco;
  if (t && automatico && !fuoco && mirinoSuNemico()) fuoco = A.auto || !g.grilletto;
  const a = cam === 'terza' ? convergi() : { yaw: ctl.yaw, pitch: ctl.pitch }, cl = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    mx: cl(c.mx + (t?.mx ?? 0)), my: cl(c.my + (t?.my ?? 0)), yaw: quantizzaMira(a.yaw), pitch: quantizzaMira(a.pitch), fuoco,
    mira: c.mira || !!t?.mira || (!!t?.fuoco && sparaMira && A.id !== 'pompa'), ricarica: c.ricarica || !!t?.ricarica, salto: c.salto || !!t?.salto, giu: c.giu || !!t?.giu,
    corsa: c.corsa || !!t?.corsa, azione: c.azione || !!t?.azione, arma,
  };
}
function unPasso(inp: SInput): void {
  prima.x = s.g.x; prima.y = s.g.y; prima.z = s.g.z;
  squadra.ricorda(s);
  passo(s, inp);
  eventi(s.ev);
}
/** Telefono: la mira si attacca un filo al nemico vicino al mirino quando ti muovi o trascini (come la mira assistita di COD Mobile). */
function assisti(dt: number): void {
  if (!tocco.attivo || !assistita || cam === 'alto') return;
  const g = s.g, o = camera.position;
  if (!tocco.mirando && Math.hypot(g.vx, g.vz) < 0.5) return;
  let best: { yaw: number; pitch: number } | null = null, be = 0.1;
  for (const b of s.bot) {
    if (b.morto || b.tipo !== 'nemico' || Math.hypot(b.x - o.x, b.z - o.z) > 40 || !vede(m, o.x, o.y, o.z, b.x, collo(b) - 0.3, b.z)) continue;
    const a = miraVerso(o.x, o.y, o.z, b.x, collo(b) - 0.3, b.z), e = Math.abs(scarto(a.yaw, ctl.yaw)) + Math.abs(a.pitch - ctl.pitch);
    if (e < be) { be = e; best = a; }
  }
  if (!best) return;
  const k = (1 - Math.exp(-dt * 5)) * 0.6;
  ctl.yaw += scarto(best.yaw, ctl.yaw) * k; ctl.pitch += (best.pitch - ctl.pitch) * k;
}

// ---------- prove: tasti e pannello ----------
const opzioni = () => hud.opzioni([
  { id: 'modo', etichetta: () => `modalità: ${modo === 'missione' ? 'MISSIONE 0' : 'POLIGONO'}`, premi: () => { modo = modo === 'missione' ? 'poligono' : 'missione'; ricomincia(); } },
  { id: 'cam', etichetta: () => `camera: ${cam === 'prima' ? 'PRIMA persona' : 'TERZA persona'} (V)`, premi: () => { cam = cam === 'prima' ? 'terza' : 'prima'; salva(); } },
  { id: 'hd', etichetta: () => `grafica: ${hd ? 'HD' : 'PIXEL'} (H)`, premi: () => { hd = !hd; resize(); salva(); } },
  { id: 'sens', etichetta: () => `sensibilità: ${((tocco.attivo ? tocco.sens / 2.8 : ctl.sens) * 1000).toFixed(1)}`, premi: () => { const L = [1.4, 1.8, 2.1, 2.6, 3.2, 4], v = L[(L.findIndex((x) => x >= ctl.sens * 1000 - 0.01) + 1) % L.length]! / 1000; ctl.sens = v; tocco.sens = v * 2.8; salva(); } },
  { id: 'fov', etichetta: () => `campo visivo: ${fovBase}°`, premi: () => { fovBase = fovBase >= 110 ? 80 : fovBase + 10; salva(); } },
  ...(tocco.attivo ? [
    { id: 'assist', etichetta: () => `mira assistita: ${assistita ? 'SÌ' : 'NO'}`, premi: () => { assistita = !assistita; salva(); } },
    { id: 'sparamira', etichetta: () => `spara e mira: ${sparaMira ? 'SÌ' : 'NO'}`, premi: () => { sparaMira = !sparaMira; salva(); } },
    { id: 'autof', etichetta: () => `sparo automatico: ${automatico ? 'SÌ' : 'NO'}`, premi: () => { automatico = !automatico; salva(); } },
  ] : []),
  { id: 'auto', etichetta: () => `pilota automatico: ${auto ? 'SÌ' : 'NO'} (T)`, premi: () => { auto = !auto; avvia(); } },
  { id: 'muto', etichetta: () => `suoni: ${muto ? 'NO' : 'SÌ'} (M)`, premi: () => { muto = !muto; suoni.muto(muto); } },
  { id: 'rifai', etichetta: () => 'ricomincia (Invio)', premi: () => ricomincia() },
]);
opzioni();
if (tocco.attivo) tocco.sens = ctl.sens * 2.8;
function ricomincia() {
  s = nuova(); finita = false; mui.fine(null); avviata = true; mui.briefing(false, tocco.attivo);
  inMano.arma(SPARO.armi[s.g.arma - 1]!.id); squadra.armaIo(SPARO.armi[s.g.arma - 1]!.id);
  ctl.yaw = s.g.yaw; ctl.pitch = 0; prima.x = s.g.x; prima.y = s.g.y; prima.z = s.g.z;
}
mui.suRigioca(() => { ricomincia(); if (!tocco.attivo) ctl.cattura(); });
ctl.suTasto((code) => {
  if (code === 'KeyV') { cam = cam === 'prima' ? 'terza' : 'prima'; salva(); opzioni(); }
  if (code === 'KeyH') { hd = !hd; resize(); salva(); opzioni(); }
  if (code === 'KeyT') { auto = !auto; avvia(); opzioni(); }
  if (code === 'KeyM') { muto = !muto; suoni.muto(muto); opzioni(); }
  if (code === 'KeyP') pausa = !pausa;
  if (code === 'Enter') ricomincia();
});

// ---------- camera ----------
const eul = new THREE.Euler(0, 0, 0, 'YXZ'), piv = new THREE.Vector3(), off = new THREE.Vector3(), pr = new THREE.Vector3();
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
    camera.position.set(M.larga / 2, 40, M.lunga + 22); camera.lookAt(M.larga / 2, 0, M.lunga / 2 - 2);
  } else if (cam === 'prima') {
    const bob = g.aTerra ? Math.abs(Math.sin(fase)) * 0.025 * Math.min(1, vel / 4.6) * (1 - 0.8 * adsT) : 0;
    camera.position.set(gx, gy + occhiK - bob - atterra - (g.morto ? 0.9 : 0), gz);
  } else {
    piv.set(gx, gy + occhiK - 0.02, gz);
    off.set(0.62 - 0.12 * adsT, 0.22, 2.4 - 0.95 * adsT).applyEuler(eul);
    const len = off.length(); off.divideScalar(len);
    const r = raggio(m, piv.x, piv.y, piv.z, off.x, off.y, off.z, len + 0.3);
    camera.position.copy(piv).addScaledVector(off, Math.max(0.35, Math.min(len, r.t - 0.25)));
  }
  inMano.group.visible = cam === 'prima' && !g.morto;
  const A = SPARO.armi[g.arma - 1]!;
  const hf = (cam === 'prima' ? fovBase + (A.zoom - fovBase) * inMano.mira : 80 - 20 * adsT) + 5 * corsaK;
  const vf = (2 * Math.atan(Math.tan((hf * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
  camera.fov += (vf - camera.fov) * Math.min(1, dt * 18); camera.updateProjectionMatrix();
  ctl.mirando = g.mira;
  const d = ctl.scarto(), [fx, fy, fz] = direzione(ctl.yaw, ctl.pitch);
  const muro = raggio(m, camera.position.x, camera.position.y, camera.position.z, fx, fy, fz, 2).t;
  inMano.aggiorna(dt, { muro, mira: g.mira, vel, corre: g.corre, aTerra: g.aTerra, dy: d.dy, dp: d.dp, ricarica: g.ricarica ? 1 - (g.ricarica - s.tick) / secTick(A.ricarica) : -1, atterra: 0 });
  squadra.aggiorna(s, dt, alpha, { x: gx, y: gy, z: gz, visibile: cam !== 'prima', yaw: g.yaw + g.rinculoLato, pitch: g.pitch + g.rinculoSu });
}

// ---------- missione: segnalino, sabotaggio, fine ----------
const OBIETTIVI = ['ELIMINA LE SENTINELLE', 'SABOTA LA GRU', 'RAGGIUNGI LA BARCA', 'MISSIONE COMPIUTA'];
const tempo = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function missione(): void {
  const mi = s.missione, g = s.g;
  if (!mi) { mui.marcatore(null); mui.sabotaggio(-1, null); if (tocco.attivo) tocco.azione(false); return; }
  if (mi.esito && !finita) {
    finita = true;
    mui.fine({ esito: mi.esito, medaglia: mi.medaglia, secondi: (mi.fine - mi.inizio) / TICK_HZ, precisione: g.sparati ? Math.round((100 * g.aSegno) / g.sparati) : 0, teste: g.teste, danno: Math.round(g.dannoPreso), uccisi: g.uccisi });
    if (document.pointerLockElement) document.exitPointerLock();
  }
  const dove = mi.esito || !avviata ? null : mi.obiettivo === 1 ? { x: M.gru.x, y: 3, z: M.gru.z, n: 'GRU' } : mi.obiettivo === 2 ? { x: M.barca.uscita.x, y: 1.5, z: M.barca.uscita.z, n: 'BARCA' } : null;
  if (dove) {
    pr.set(dove.x, dove.y, dove.z).project(camera);
    const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight, dietro = pr.z > 1;
    let x = ((pr.x + 1) / 2) * W, y = ((1 - pr.y) / 2) * H;
    if (dietro) { x = W - x; y = H - 70; }
    mui.marcatore({ x: Math.max(40, Math.min(W - 40, x)), y: Math.max(70, Math.min(H - 70, y)), dist: Math.hypot(dove.x - g.x, dove.z - g.z), etichetta: dove.n });
  } else mui.marcatore(null);
  const allaGru = !mi.esito && mi.obiettivo === 1 && inCerchio(g.x, g.z, M.gru);
  mui.sabotaggio(allaGru && mi.sabota > 0 ? mi.sabota / secTick(SPARO.missione.sabota) : -1, allaGru && mi.sabota === 0 ? (tocco.attivo ? 'TIENI AZIONE PER SABOTARE' : 'TIENI E PER SABOTARE') : null);
  if (tocco.attivo) tocco.azione(allaGru);
}

// ---------- ciclo: sim a 60 Hz fissi, resa a ogni frame ----------
const DT = 1 / TICK_HZ;
let acc = 0, last = performance.now(), frames = 0, ready = false;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // su PC senza mouse catturato (Esc) la missione si ferma; sul telefono si ferma se è in verticale
  const ferma = pausa || !avviata || (!prova && !auto && avviata && !finita && (tocco.attivo ? innerHeight > innerWidth : !ctl.catturato()));
  if (tocco.attivo) tocco.frena = !ferma && assistita && cam !== 'alto' && mirinoSuNemico();
  if (!ferma) { assisti(dt); acc += dt; while (acc >= DT) { unPasso(auto ? autopilota(s) : comandi()); acc -= DT; } } else acc = 0;
  inquadra(dt, ferma ? 1 : acc / DT);
  if (!pausa) succo.aggiorna(dt); // in pausa anche il succo resta fermo (le foto dei test)
  const g = s.g, A = SPARO.armi[g.arma - 1]!, st = g.armi[g.arma - 1]!, mi = s.missione;
  const prec = g.sparati ? Math.round((100 * g.aSegno) / g.sparati) : 0;
  const morte = s.bot.filter((b) => !b.rinforzo && b.morto).length, sentinelle = s.bot.filter((b) => !b.rinforzo).length;
  hud.aggiorna({
    cono: conoAdesso(s), fovV: camera.fov, mira: g.mira, terza: cam === 'terza', colpi: st.colpi, riserva: st.riserva, nome: A.nome,
    ricarica: g.ricarica ? 1 - (g.ricarica - s.tick) / secTick(A.ricarica) : -1, vita: g.vita,
    obiettivo: mi ? `${OBIETTIVI[mi.obiettivo]}${mi.obiettivo === 0 ? ` · ${morte}/${sentinelle}` : ''}` : 'POLIGONO · abbatti i bersagli',
    info: mi ? `tempo ${tempo(((mi.esito ? mi.fine : s.tick) - mi.inizio) / TICK_HZ)} · colpi a segno ${prec}% · alla testa ${g.teste}` : `in piedi ${s.bot.filter((b) => !b.morto).length}/${s.bot.length} · abbattuti ${g.uccisi} · colpi a segno ${prec}% · alla testa ${g.teste}`,
  });
  missione();
  hud.invito(!prova && !auto && avviata && !finita && !tocco.attivo && !ctl.catturato());
  post.render(gl, scene, camera, now / 1000, true);
  frames++;
  if (!ready && frames > 5 && piazzale && squadra.pronta) ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const stato = () => {
  const g = s.g, st = g.armi[g.arma - 1]!, mi = s.missione;
  return { tick: s.tick, cam, hd, auto, modo, avviata, x: g.x, y: g.y, z: g.z, yaw: g.yaw, pitch: g.pitch, vita: g.vita, arma: g.arma, colpi: st.colpi, riserva: st.riserva, mira: g.mira,
    uccisi: g.uccisi, sparati: g.sparati, aSegno: g.aSegno, teste: g.teste, dannoPreso: g.dannoPreso, inPiedi: s.bot.filter((b) => !b.morto).length, nemici: s.bot.length,
    obiettivo: mi?.obiettivo ?? -1, esito: mi?.esito ?? '', medaglia: mi?.medaglia ?? '', pezzi: piazzale?.pezzi ?? 0, soldati: squadra.quanti(), io: !!squadra.io, fov: camera.fov, tocco: tocco.attivo };
};
(window as unknown as { __sparo: unknown }).__sparo = {
  get ready() { return ready; },
  state: stato,
  set(o: { cam?: Cam; hd?: boolean; auto?: boolean; pausa?: boolean; assistita?: boolean; automatico?: boolean; x?: number; z?: number; yaw?: number; pitch?: number; modo?: SModo; immortale?: boolean }) {
    if (o.modo !== undefined || o.immortale !== undefined) { if (o.modo) modo = o.modo; if (o.immortale !== undefined) immortale = o.immortale; ricomincia(); }
    if (o.cam) cam = o.cam;
    if (o.hd !== undefined) { hd = o.hd; resize(); }
    if (o.auto !== undefined) { auto = o.auto; avvia(); }
    if (o.pausa !== undefined) pausa = o.pausa;
    if (o.assistita !== undefined) assistita = o.assistita;
    if (o.automatico !== undefined) automatico = o.automatico;
    if (o.x !== undefined) { s.g.x = o.x; prima.x = o.x; }
    if (o.z !== undefined) { s.g.z = o.z; prima.z = o.z; }
    if (o.yaw !== undefined) { ctl.yaw = o.yaw; s.g.yaw = o.yaw; }
    if (o.pitch !== undefined) { ctl.pitch = o.pitch; s.g.pitch = o.pitch; }
    opzioni();
  },
  perf: () => ({ calls: post.sceneCalls(), tris: post.sceneTris(), piazzale: piazzale?.tris ?? 0 }),
  /** Avanza di `n` tick subito (col pilota automatico se acceso, sennò fermo). */
  avanti(n: number) { for (let i = 0; i < n && !s.missione?.esito; i++) unPasso(auto ? autopilota(s) : { ...NESSUN_INPUT, yaw: ctl.yaw, pitch: ctl.pitch }); return stato(); },
  /** Tiene premuti i comandi `o` per `n` tick (test dei tasti senza mouse catturato). */
  premi(o: Partial<SInput>, n = 1) { for (let i = 0; i < n; i++) unPasso({ ...NESSUN_INPUT, yaw: quantizzaMira(ctl.yaw), pitch: quantizzaMira(ctl.pitch), ...o }); return stato(); },
  /** Prove: la partita, un frame disegnato subito, il succo avanti di `sec` secondi (anche in pausa). */
  partita: () => s,
  rendi(dt = 0) { inquadra(dt, 1); missione(); post.render(gl, scene, camera, performance.now() / 1000, true); },
  succoAvanti(sec: number) { for (let t = 0; t < sec; t += 1 / 60) succo.aggiorna(1 / 60); },
  scene,
};
