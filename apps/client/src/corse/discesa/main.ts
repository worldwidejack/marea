// Banco di prova della discesa in mountain bike (#229): provadiscesa3d.html, pagina a parte, il gioco non cambia.
// Vicino è tutto 3D (bici pilotabile con la fisica di @marea/sim/corse/bici.ts, sentiero, sassi, radici, alberi dal kit Blender `cs_d_*`);
// lontano un video dipinto in loop (fondale.ts) come cielo e orizzonte. Tutto passa dalla stessa passata pixel del gioco (metà
// risoluzione, palette), così il video e il 3D si fondono.
// Comandi: telefono joystick = sterzo (in avanti pedali: consuma l'energia), SALTO (tenuto carica, lasciato stacca; tenuto a lungo in
// piano = impennata), SCATTO (costa metà energia), FRENO; PC A D o ← → sterzo, W o ↑ pedala, S o ↓ o Shift frena, Spazio (o E) = salto,
// Q = scatto. C = camera (occhi col manubrio / dietro bassa), R = ricomincia, T = pilota automatico, M = muto.
// Indirizzo: ?cam=occhi|dietro&auto=1&s=<metri dal via>. Test: window.__discesa = { ready, state(), set({...}), perf() }.
import * as THREE from 'three';
import { BICI, SENTIERI } from '@marea/content/corse_discesa.ts';
import { nuovaBici, pedala, pilotaBici, rilievo, sentiero } from '@marea/sim/corse/bici.ts';
import type { Bici, Comandi } from '@marea/sim/corse/bici.ts';
import { nuovaTerna, terna } from '@marea/sim/corse/nastro.ts';
import { TICK_HZ } from '@marea/sim/constants.ts';
import { FLAGS } from '../../flags.ts';
import { createInput } from '../../game/input.ts';
import { createLights } from '../../render/light.ts';
import { createPost } from '../../render/post.ts';
import { P } from '../../render/island_parts.ts';
import { STYLES } from '../../provapixel/styles.ts';
import { creaLinee } from '../effetti.ts';
import { stileProva } from '../prova/stile.ts';
import { creaBici3d } from './bici3d.ts';
import { creaCiclista } from './ciclista.ts';
import type { Ciclista } from './ciclista.ts';
import { creaFondale } from './fondale.ts';
import { PEZZI, creaScenografia } from './scenografia.ts';
import { caricaPezzi } from './kit.ts';
import { creaSuoni } from './suoni.ts';
import { creaTerreno } from './terreno.ts';

const CAMERE = ['occhi', 'dietro'] as const;
/** Camere solo per le prove (dall'indirizzo o da set()): dall'alto, per guardare il terreno. */
type CamProva = Cam | 'alto';
type Cam = (typeof CAMERE)[number];
const q = new URLSearchParams(location.search);
let cam: CamProva = CAMERE.includes(q.get('cam') as Cam) || q.get('cam') === 'alto' ? (q.get('cam') as CamProva) : 'occhi';
let auto = q.get('auto') === '1', pausa = false, muto = false;

// ---------- resa: immagine piccola, passata finale pixel (palette «giorno»), il cielo è il fondale video ----------
const canvas = document.getElementById('gl') as HTMLCanvasElement, root = document.getElementById('ui') as HTMLElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
canvas.style.imageRendering = 'pixelated';
const scene = new THREE.Scene(); scene.background = new THREE.Color(P.acqua);
const post = createPost();
const giorno = STYLES.find((s) => s.id === 'giorno')!;
// foschia del colore dell'orizzonte del video: il terreno lontano sfuma nel fondale
post.setStyle({ ...giorno, fog: { col: '#9fc7e0', near: 60, far: 260, max: 0.55 } });
post.toggles.cielo = false; post.toggles.contorni = true; post.toggles.foschia = true;
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 700);
const lights = createLights(); scene.add(lights.group);

const S = sentiero(SENTIERI.cresta_bosco!);
const terreno = creaTerreno(S); scene.add(terreno.group);
const fondale = creaFondale({
  src: ['/assets/discesa3d/fondale.webm', '/assets/discesa3d/fondale.mp4'], poster: '/assets/discesa3d/fondale.jpg',
  centro: 0, ampiezza: (160 * Math.PI) / 180, orizzonte: 0.59, cielo: '#1f8fe0', mare: '#1d6fc0',
});
scene.add(fondale.mesh);
const bici3d = creaBici3d(); scene.add(bici3d.group);
let scenografia: ReturnType<typeof creaScenografia> | null = null;
let ciclista: Ciclista | null = null;
caricaPezzi(PEZZI).then(() => { scenografia = creaScenografia(S, terreno); scene.add(scenografia.group); bici3d.monta(); });
// il ciclista col casco (cappello 12): si vede dalla camera dietro
creaCiclista(bici3d.corpo, { pelle: 1, capelli: 3, coloreCapelli: 1, vestito: 2, cappello: 12 }).then((c) => { ciclista = c; }).catch((e) => console.warn('[discesa] ciclista non caricato', e));

stileProva();
const input = createInput({ canvas, root, cameraYaw: () => 0 });
const btnA = document.getElementById('btnA'), btnB = document.getElementById('btnB');
if (btnA) { btnA.textContent = 'SALTO'; btnA.style.fontSize = '15px'; }
// lo SCATTO ha il suo bottone, sopra il SALTO (A del pad è il salto, B il freno); da PC è Q
const btnScatto = document.createElement('div');
btnScatto.id = 'btnScatto'; btnScatto.textContent = 'SCATTO';
const scattoCss = `touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;position:absolute;right:calc(max(16px,env(safe-area-inset-right,0px)) + 10px);bottom:calc(env(safe-area-inset-bottom,0px) + 132px);width:64px;height:64px;border-radius:50%;background:rgba(242,163,58,.8);border:3px solid rgba(244,227,193,.7);color:#F4E3C1;font:bold 12px ui-monospace,Menlo,monospace;display:flex;align-items:center;justify-content:center;`;
btnScatto.style.cssText = scattoCss;
root.appendChild(btnScatto);
let scattoDito = false, scattoTasto = false;
const premi = (on: boolean) => { scattoDito = on; btnScatto.style.cssText = scattoCss + (on ? 'transform:scale(.92);filter:brightness(1.25);' : ''); };
btnScatto.addEventListener('pointerdown', (e) => { e.preventDefault(); premi(true); try { btnScatto.setPointerCapture(e.pointerId); } catch { /* sintetico */ } });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btnScatto.addEventListener(ev, () => premi(false));
btnScatto.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => { if (e.code === 'KeyQ') scattoTasto = true; });
addEventListener('keyup', (e) => { if (e.code === 'KeyQ') scattoTasto = false; });
addEventListener('blur', () => { scattoTasto = false; premi(false); });
if (btnB) { btnB.textContent = 'FRENO'; btnB.style.fontSize = '13px'; }
const hud = document.createElement('div'); hud.className = 'pp-hud'; root.appendChild(hud);
// la barra dell'energia sotto l'HUD: pedalare la consuma, lo scatto (quando è accesa) la svuota, torna quando non si pedala
const barra = document.createElement('div');
barra.style.cssText = `position:absolute;top:calc(max(8px, env(safe-area-inset-top)) + 40px);left:50%;transform:translateX(-50%);width:170px;height:12px;background:rgba(46,30,20,.88);border:2px solid ${P.legnoChiaro};pointer-events:none;z-index:3`;
const pieno = document.createElement('div'); pieno.style.cssText = 'height:100%;width:100%';
barra.appendChild(pieno); root.appendChild(barra);
const big = document.createElement('div'); big.className = 'pp-big'; root.appendChild(big);
const linee = creaLinee(root);
const suoni = creaSuoni();

let H = 1;
function resize() {
  const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
  const k = Math.min(1.5, devicePixelRatio || 1) * (FLAGS.quality === 'low' ? 0.4 : 0.5);
  const w = Math.max(1, Math.round(cw * k)); H = Math.max(1, Math.round(ch * k));
  gl.setSize(w, H, false); post.setSize(w, H);
  camera.aspect = cw / Math.max(1, ch); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
resize();

// ---------- la discesa ----------
let b: Bici = nuovaBici();
const via = Number(q.get('s'));
if (via > 0) b.s = via;
function ricomincia() { b = nuovaBici(); camOk = false; }
function comandi(): Comandi {
  const f = input.sample();
  return { sterzo: f.mx, gas: Math.max(0, -f.my), freno: f.b || f.my > 0.5, scatto: scattoDito || scattoTasto, salto: f.a };
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyC') { cam = CAMERE[(CAMERE.indexOf(cam as Cam) + 1) % CAMERE.length]!; camOk = false; }
  if (e.code === 'KeyR') ricomincia();
  if (e.code === 'KeyT') auto = !auto;
  if (e.code === 'KeyM') { muto = !muto; suoni.muto(muto); }
});

// ---------- posa della bici nel mondo e camere ----------
const T = nuovaTerna(), pos = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), dx = new THREE.Vector3(), tmp = new THREE.Vector3();
const camPos = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0), guardo = new THREE.Vector3();
let camOk = false, piega = 0, scossaT = 0;
const ROLLIO_OCCHI = 0.35, CIELO = new THREE.Vector3(0, 1, 0);
function posa(dt: number) {
  terna(S.n, b.s, T);
  up.set(T.ux, T.uy, T.uz).normalize();
  const c = Math.cos(b.ang), s = Math.sin(b.ang);
  fwd.set(T.tx * c + T.rx * s, T.ty * c + T.ry * s, T.tz * c + T.rz * s).normalize();
  dx.crossVectors(fwd, up).normalize();
  pos.set(T.x + T.rx * b.lat + T.ux * b.h, T.y + T.ry * b.lat + T.uy * b.h, T.z + T.rz * b.lat + T.uz * b.h);
  // piega in curva: tan = v·ω/g (limitata), con un filo di ritardo
  // la piega è rispetto al fondo: in parabolica la sopraelevazione (asin(−ry), + = il lato destro più basso) ne fa già una parte
  const voluta = b.caduto ? 0 : Math.max(-0.75, Math.min(0.75, Math.atan((b.v * b.w) / 9.8) - Math.asin(Math.max(-1, Math.min(1, -T.ry)))));
  piega += (voluta - piega) * Math.min(1, dt * 10);
  // in prima persona bici e testa si piegano insieme (come una camera sul casco): manubrio e braccia restano fermi nell'inquadratura,
  // si inclina l'orizzonte; da fuori la bici si piega tutta
  // beccheggio: a terra la differenza di quota del rilievo tra le due ruote; in aria la direzione del volo (un po' meno)
  const mezzo = BICI.interasse / 2, cs = Math.cos(b.ang);
  const becc = b.aria ? Math.atan2(b.vh, Math.max(1, b.v)) * 0.6
    : Math.atan2(rilievo(S, b.s + mezzo * cs, b.lat).g - rilievo(S, b.s - mezzo * cs, b.lat).g, 2 * mezzo);
  bici3d.posa(pos, fwd, up, cam === 'occhi' ? piega * ROLLIO_OCCHI : piega, becc, b, dt);
  // in prima persona le braccia del kit, da fuori il ciclista intero
  const fuori = cam !== 'occhi';
  bici3d.braccia(!fuori || !ciclista);
  if (ciclista) { ciclista.avatar.object.visible = fuori; if (fuori) { bici3d.group.updateMatrixWorld(true); ciclista.aggiorna(dt, bici3d.prese, bici3d.pedali, piega, bici3d.giu); } }
}
function inquadra(dt: number) {
  const v = b.v, caduto = b.caduto > 0;
  scossaT += dt;
  const sc = b.scossa * (cam === 'occhi' ? 0.06 : 0.1);
  // su = quello del sentiero, inclinato un poco dalla piega: la testa resta quasi dritta, sotto si piega la bici (si vede dal manubrio)
  // nelle paraboliche la testa resta quasi dritta: il su della camera è a metà tra quello del sentiero (sopraelevato) e il cielo
  const rollato = tmp.copy(up).lerp(CIELO, 0.6).normalize().applyAxisAngle(fwd, piega * (cam === 'occhi' ? ROLLIO_OCCHI : 0.2)); // + attorno al davanti = verso destra, come la bici
  camUp.lerp(rollato, camOk ? 1 - Math.exp(-dt * 12) : 1).normalize();
  if (cam === 'alto') {
    camera.position.copy(pos).addScaledVector(fwd, -30).addScaledVector(up, 26).addScaledVector(dx, 10);
    guardo.copy(pos).addScaledVector(fwd, 10);
  } else if (cam === 'occhi') {
    const p = caduto ? tmp.copy(pos).addScaledVector(up, 0.6).addScaledVector(dx, 0.5) : tmp.copy(pos).addScaledVector(camUp, 1.56 - bici3d.giu).addScaledVector(fwd, -0.22); // la testa di chi scende in piedi sui pedali, mezzo metro dietro il manubrio
    if (camOk) camPos.lerp(p, 1 - Math.exp(-dt * 30)); else camPos.copy(p);
    camera.position.copy(camPos);
    if (sc > 0.001) camera.position.add(new THREE.Vector3(Math.sin(scossaT * 61) * sc, Math.sin(scossaT * 47 + 1) * sc, Math.sin(scossaT * 53 + 2) * sc * 0.5));
    guardo.copy(camera.position).addScaledVector(fwd, 10).addScaledVector(up, camera.aspect < 0.8 ? -3.6 : -3.0); // guarda giù di ~17°: il manubrio nel terzo basso, come nei riferimenti
  } else {
    const dist = 3.4 + v * 0.03, alt = 1.35 + v * 0.01;
    const p = tmp.copy(pos).addScaledVector(fwd, -dist).addScaledVector(up, alt);
    if (camOk) camPos.lerp(p, 1 - Math.exp(-dt * 8)); else camPos.copy(p);
    camera.position.copy(camPos);
    if (sc > 0.001) camera.position.addScaledVector(camUp, Math.sin(scossaT * 57) * sc);
    guardo.copy(pos).addScaledVector(fwd, 6).addScaledVector(up, 0.9);
  }
  camera.up.copy(camUp);
  camera.lookAt(guardo);
  // FOV che si allarga con la velocità: il senso di velocità
  const fov = (camera.aspect < 0.8 ? 88 : 74) + Math.max(0, v - 6) * 1.1;
  camera.fov += (Math.min(fov, 104) - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  camOk = true;
}

// ---------- ciclo: sim a 60 Hz fissi, resa a ogni frame ----------
const DT = 1 / TICK_HZ, NIENTE: Comandi = { sterzo: 0, gas: 0, freno: false, scatto: false, salto: false };
let acc = 0, last = performance.now(), frames = 0, ready = false, ultimaCaduta = 0;
const tempo = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!pausa) {
    acc += dt;
    while (acc >= DT) { pedala(S, b, auto ? pilotaBici(S, b) : comandi()); acc -= DT; }
  }
  posa(dt); inquadra(dt); suoni.aggiorna(b);
  fondale.segui(camera);
  lights.follow?.(pos.x, pos.z);
  scenografia?.vicino(pos);
  post.render(gl, scene, camera, now / 1000, true);
  // HUD
  const t = (b.fine || b.tick) / TICK_HZ;
  hud.innerHTML = `<div>${tempo(t)}</div><div>${Math.round(b.v * 3.6)} <small>km/h</small></div><div>${Math.round((b.s / S.def.arrivo) * 100)}<small>%</small></div>${b.energia >= BICI.scatto.energia ? '<div class="turbo">SCATTO</div>' : ''}`;
  pieno.style.width = `${Math.round(b.energia * 100)}%`;
  pieno.style.background = b.energia >= BICI.scatto.energia ? P.arancio : b.energia < 0.2 ? P.rosso : P.sabbia;
  if (b.cadute > ultimaCaduta) { ultimaCaduta = b.cadute; }
  big.style.display = b.caduto > 0 || b.fine ? 'block' : 'none';
  if (b.fine) big.innerHTML = `ARRIVO ${tempo(b.fine / TICK_HZ)}<small>cadute ${b.cadute} · salti ${b.salti} · R per rifare</small>`;
  else if (b.caduto > 0) big.innerHTML = `CADUTO!<small>${b.perche === 'sasso' ? 'contro un sasso' : b.perche === 'muro' ? 'fuori dal sentiero' : b.perche === 'ruscello' ? 'nel ruscello: serve più slancio' : 'atterraggio storto'}</small>`;
  linee.disegna(b.v > 12 && !b.caduto ? Math.min(1, (b.v - 12) / 8) : 0, P.pietraChiara);
  frames++;
  if (!ready && frames > 5) ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const stato = () => ({ s: b.s, lat: b.lat, h: b.h, v: b.v, energia: b.energia, carica: b.carica, impennata: b.impennata, perche: b.perche, ang: b.ang, aria: b.aria, caduto: b.caduto, cadute: b.cadute, salti: b.salti, fine: b.fine, tick: b.tick, cam, auto, sup: b.sup, video: !!fondale.video && !fondale.video.paused, pezzi: scenografia?.pezzi ?? 0 });
(window as unknown as { __discesa: unknown }).__discesa = {
  get ready() { return ready && fondale.pronto(); },
  state: stato,
  set(o: { cam?: CamProva; auto?: boolean; s?: number; pausa?: boolean; lat?: number; v?: number }) {
    if (o.cam) { cam = o.cam; camOk = false; }
    if (o.auto !== undefined) auto = o.auto;
    if (o.pausa !== undefined) pausa = o.pausa;
    if (o.s !== undefined) { b.s = o.s; b.lat = o.lat ?? 0; b.ang = 0; b.h = 0; b.vh = 0; b.volo = 0; b.aria = false; b.caduto = 0; camOk = false; }
    if (o.v !== undefined) b.v = o.v;
  },
  perf: () => ({ calls: post.sceneCalls(), tris: post.sceneTris(), terreno: terreno.tris, scenografia: scenografia?.tris ?? 0 }),
  /** Avanza la discesa di `n` tick subito (test): col pilota automatico se acceso. */
  avanti(n: number) { for (let i = 0; i < n && !b.fine; i++) pedala(S, b, auto ? pilotaBici(S, b) : NIENTE); return stato(); },
  scene,
};
