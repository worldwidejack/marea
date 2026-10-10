// Banco di prova dell'hub delle Corse (docs/CORSE.md A3, #185): provahub.html, pagina a parte, il gioco non cambia. L'hub da solo
// (come provapiste.html per le piste): guida libera, porte, garage, minimappa, cartelli. La porta della Spiaggia apre la scelta della
// pista e fa partire una gara LOCALE col motore v2 (senza server, `vista_gara.ts` come nel gioco); finita la gara si torna nell'hub
// davanti alla porta. «Torna in barca» / Esc qui rimettono al molo (nel gioco riportano nell'arcipelago).
// Comandi: telefono joystick (in avanti = gas), DRIFT, FRENO; PC A D o ← → sterzo, W ↑ gas, S ↓ freno, Spazio drift, Invio = VIA,
// Esc = chiude il pannello / ritira dalla gara. T = pilota automatico, G = gas automatico.
// Indirizzo: ?auto=1 (pilota automatico fino alla porta della Spiaggia), ?veicolo=…, ?gas=auto, ?ruota=0|1, ?avatar=0, ?look=…
// Test: window.__provahub = { ready, perf(), state(), set({ x, z, yaw, veicolo, auto, gasAuto, comandi, porta, effetti, pausa }), avanti(tick), via() }.
import * as THREE from 'three';
import { CORSE } from '@marea/content/corse.ts';
import { DT, quantize } from '@marea/sim';
import type { InputFrame } from '@marea/sim';
import { garaCorse, pilotaGara } from '@marea/sim/corse/gara.ts';
import type { GaraState, GaraView } from '@marea/sim/corse/gara.ts';
import type { Look } from '@marea/protocol';
import { FLAGS } from '../../flags.ts';
import { createInput } from '../../game/input.ts';
import { createLights } from '../../render/light.ts';
import { createPost } from '../../render/post.ts';
import { P } from '../../render/island_parts.ts';
import { STYLES } from '../../provapixel/styles.ts';
import { avvisoRuota } from '../avviso_ruota.ts';
import { creaVistaGara, tempoGara } from '../vista_gara.ts';
import { creaSchermoHub } from './index.ts';
import type { IdPorta } from './mappa.ts';
import { creaPilota } from './guida.ts';
import { creaPannelli, leggiScelta, salvaScelta } from './pannelli.ts';

const q = new URLSearchParams(location.search);
const LOOK0: Look = { pelle: 1, capelli: 3, coloreCapelli: 1, vestito: 2, cappello: 0 };
const lookQ = (q.get('look') ?? '').split(',').map(Number);
const look: Look = lookQ.length === 5 && lookQ.every(Number.isFinite) ? { pelle: lookQ[0]!, capelli: lookQ[1]!, coloreCapelli: lookQ[2]!, vestito: lookQ[3]!, cappello: lookQ[4]! } : LOOK0;
const scelta = leggiScelta();
if (q.get('veicolo') && CORSE.veicoli.some((v) => v.id === q.get('veicolo'))) scelta.veicolo = q.get('veicolo')!;
if (q.get('gas') === 'auto') scelta.gasAuto = true;
let auto = q.get('auto') === '1', pausa = false, iniettato: InputFrame | null = null, uscite = 0, gareFatte = 0;

// ---------- resa (come provapiste: immagine a metà risoluzione, passata finale coi contorni) ----------
const canvas = document.getElementById('gl') as HTMLCanvasElement, root = document.getElementById('ui') as HTMLElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
canvas.style.imageRendering = 'pixelated';
const post = createPost(); post.setStyle(STYLES.find((s) => s.id === 'giorno')!);
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 900);
function resize() {
  const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
  const k = Math.min(1.5, devicePixelRatio || 1) * (FLAGS.quality === 'low' ? 0.4 : 0.5);
  gl.setSize(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)), false); post.setSize(Math.max(1, Math.round(cw * k)), Math.max(1, Math.round(ch * k)));
  camera.aspect = cw / Math.max(1, ch); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize); resize();

const input = createInput({ canvas, root, cameraYaw: () => 0 });
const btnA = document.getElementById('btnA'), btnB = document.getElementById('btnB');
if (btnA) { btnA.textContent = 'DRIFT'; btnA.style.fontSize = '17px'; }
if (btnB) { btnB.textContent = 'FRENO'; btnB.style.fontSize = '13px'; }
const ruota = avvisoRuota(root);

// ---------- l'hub ----------
const pannelli = creaPannelli(root);
const hub = creaSchermoHub({
  root, camera, look: () => look, pannelli, avatar: q.get('avatar') !== '0',
  porta: (p) => {
    void pannelli.piste(scelta, { titolo: `🏁 ${p.nome.toUpperCase()}`, sottotitolo: 'Banco di prova · gara locale col motore v2, senza server', esci: 'Torna all’hub' })
      .then((opz) => { if (opz) partiGara(opz, p.id); else hub.riprendi(p.id); });
  },
  veicolo: (id) => { scelta.veicolo = id; salvaScelta(scelta); },
  esci: () => { uscite++; pannelli.chiudi(); hub.davantiA('molo'); hub.messaggio('Qui al banco si resta: nel gioco torni in barca', 2.5); },
});
hub.apri(scelta.veicolo, 'molo');
const pilota = creaPilota(hub.mondo);
const spiaggia = hub.mondo.porte.find((p) => p.id === 'spiaggia') ?? hub.mondo.porte[0]!;
const rotta = () => pilota.verso(hub.auto, spiaggia.x, spiaggia.z);
rotta();

// ---------- la gara locale (porta della Spiaggia) ----------
const gScene = new THREE.Scene(); gScene.background = new THREE.Color(P.acquaBassa);
const luci = createLights(); gScene.add(luci.group);
const mare = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: P.acqua, flatShading: true }));
mare.rotation.x = -Math.PI / 2; mare.position.y = -1.2; mare.receiveShadow = true; gScene.add(mare);
const vista = creaVistaGara({ root, camera, look: () => look, onLuce: (x, z) => luci.follow?.(x, z) });
gScene.add(vista.gruppo);
let gara: { s: GaraState; fine: number; porta: IdPorta } | null = null;
function partiGara(opz: Record<string, string>, porta: IdPorta) {
  hub.sospendi();
  const s = garaCorse.create({ seed: (Math.random() * 1e9) >>> 0, difficulty: 2, opzioni: opz });
  vista.mostra(s); vista.interfaccia(true);
  gara = { s, fine: 0, porta };
}
function finisciGara() {
  const g = gara; if (!g) return;
  const r = garaCorse.result(g.s);
  vista.chiudi(); gara = null; gareFatte++;
  hub.riprendi(g.porta);
  hub.messaggio(r.detail['giri']! >= r.detail['tot']! ? `${r.detail['pos']}° · ${tempoGara(r.detail['ms'] as number)}` : 'RITIRATO', 3);
}

/** Joystick e tasti → sterzo, gas, freno, drift (come le gare del banco di prova). */
function comandi(f: InputFrame): InputFrame {
  const freno = f.b || f.my > 0.5, gas = Math.max(0, Math.min(1, -f.my / 0.6));
  return { mx: Math.max(-1, Math.min(1, f.mx / 0.7)), my: freno ? -1 : scelta.gasAuto ? 1 : gas, a: f.a, b: false };
}
let ripianifica = 0;
function step() {
  const f = input.sample();
  if (gara) {
    const g = gara;
    if (!g.s.done) { garaCorse.step(g.s, quantize(auto ? pilotaGara(g.s) : iniettato ?? comandi(f))); if (g.s.done) vista.suoni.zitto(); }
    else if (++g.fine > 180 || (g.fine > 60 && f.a)) finisciGara();
    return;
  }
  if (auto && ++ripianifica >= 300) { ripianifica = 0; rotta(); }
  hub.step(auto ? pilota.comandi(hub.auto) : iniettato ?? comandi(f));
}

// ---------- tasti ----------
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.repeat) return;
  if (e.code === 'Escape') { if (gara) { gara.s.done = true; gara.fine = 999; } else if (pannelli.aperto()) pannelli.chiudi(); else hub.messaggio('Esc nel gioco = di nuovo nell\'arcipelago'); return; }
  if (e.code === 'Enter' && pannelli.aperto() === 'piste') { pannelli.via(); return; }
  if (e.code === 'KeyT') { auto = !auto; if (auto) rotta(); hub.messaggio(`pilota automatico ${auto ? 'sì' : 'no'}`, 1.2); }
  if (e.code === 'KeyG') { scelta.gasAuto = !scelta.gasAuto; salvaScelta(scelta); hub.messaggio(`gas ${scelta.gasAuto ? 'automatico' : 'in mano'}`, 1.2); }
});

// ---------- ciclo ----------
const perf = { fps: 0, frames: 0, acc: 0 };
let last = performance.now(), acc = 0, time = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; time += dt;
  let n = 0;
  while (acc >= DT && n < 6) { if (!pausa && !ruota.visibile()) step(); acc -= DT; n++; }
  if (n === 6) acc = 0;
  if (gara) {
    vista.aggiorna(gara.s, dt, { cam: scelta.cam, effetti: hub.effetti, auto, gasAuto: scelta.gasAuto, fine: gara.s.done, ritirato: gara.fine >= 999 });
    post.render(gl, gScene, camera, time);
  } else {
    hub.aggiorna(dt);
    post.render(gl, hub.scene, camera, time);
  }
  perf.frames++; perf.acc += dt;
  if (perf.acc >= 0.5) { perf.fps = perf.frames / perf.acc; perf.frames = 0; perf.acc = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const api = {
  ready: false,
  perf: () => ({ drawCalls: post.sceneCalls() + 1, triangles: post.sceneTris() + 2, fps: Math.round(perf.fps * 10) / 10, w: gl.domElement.width, h: gl.domElement.height }),
  state: () => {
    const g = gara, v = g ? (garaCorse.view(g.s) as GaraView) : null;
    return {
      ...hub.info(), auto, gasAuto: scelta.gasAuto, uscite, gareFatte, percorso: pilota.punti.length, ruota: ruota.visibile(),
      gara: g && v ? { pista: g.s.pista, veicolo: g.s.veicoli[0]!.id, tick: g.s.tick, done: g.s.done, giro: v.giro, pos: v.posizioni[0], ms: v.ms } : null,
      mondo: { porte: hub.mondo.porte.map((p) => ({ id: p.id, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, yaw: p.yaw, raggio: p.raggio, aperta: p.aperta })), garage: hub.mondo.garage, molo: hub.mondo.molo, mare: hub.mondo.mare },
    };
  },
  /** Teletrasporto, veicolo, pilota automatico, gas, input iniettato (`comandi`: {mx, my, a} come in gara; null = di nuovo tastiera e
   *  joystick), `porta` = dentro il raggio di una porta / del garage / del molo, `effetti`, `pausa` (la guida si ferma, la resa no). */
  set: (o: { x?: number; z?: number; yaw?: number; veicolo?: string; auto?: boolean; gasAuto?: boolean; comandi?: Partial<InputFrame> | null; porta?: string; fuori?: string; effetti?: boolean; pausa?: boolean }) => {
    if (o.veicolo !== undefined && CORSE.veicoli.some((v) => v.id === o.veicolo)) { hub.cambiaVeicolo(o.veicolo); scelta.veicolo = o.veicolo; salvaScelta(scelta); }
    if (o.x !== undefined && o.z !== undefined) hub.vai(o.x, o.z, o.yaw);
    if (o.porta) hub.davantiA(o.porta as IdPorta, true);
    if (o.fuori) hub.davantiA(o.fuori as IdPorta, false);
    if (o.gasAuto !== undefined) scelta.gasAuto = o.gasAuto;
    if (o.comandi !== undefined) iniettato = o.comandi ? { mx: 0, my: 0, a: false, b: false, ...o.comandi } : null;
    if (o.effetti !== undefined) hub.effetti = o.effetti;
    if (o.pausa !== undefined) pausa = o.pausa;
    if (o.auto !== undefined) auto = o.auto;
    if (auto && (o.auto || o.x !== undefined || o.porta || o.fuori)) rotta();
    return api.state();
  },
  /** Avanza la guida (o la gara) di `tick` passi subito, senza aspettare il tempo vero. */
  avanti: (tick: number) => { for (let i = 0; i < tick; i++) step(); return api.state(); },
  /** La pianta del mondo (costa, strade) e la quota/superficie in un punto: per i test e il pilota automatico. */
  pianta: () => hub.mondo.pianta,
  sonda: (x: number, z: number, r = 3) => ({ quota: hub.mondo.quota(x, z), sup: hub.mondo.superficie(x, z), fuori: hub.mondo.fuori(x, z), ostacoli: hub.mondo.ostacoli(x, z, r).filter((o) => Math.hypot(o.x - x, o.z - z) < r + o.r).length }),
  /** VIA nel pannello della pista. */
  via: () => { pannelli.via(); return api.state(); },
};
(window as unknown as { __provahub: typeof api }).__provahub = api;
void hub.mondo.pronta.then((r) => {
  console.log(`[provahub] mondo pronto: ${r.pezzi} pezzi, ${r.triangoli} triangoli`);
  requestAnimationFrame(() => requestAnimationFrame(() => { api.ready = true; }));
});
