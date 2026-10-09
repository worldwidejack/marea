// Banco di prova delle piste (docs/CORSE.md A11, #155): provapiste.html, pagina a parte, il gioco non cambia. Qui si guida sul motore v2
// (pista a nastro 3D): giri della morte, salti, discese, acqua, scorciatoie, ponti senza muri, eventi firma. Le piste sono quelle di
// tools/corse_piste/ (per ora quelle di prova; poi le grezze delle zone, da provare prima di vestirle).
// Comandi:
// - telefono: joystick = sterzo (il gas è automatico), DRIFT, FRENO;
// - PC: A D o ← →, Spazio = drift, S o ↓ = freno.
// Fughe con l'onda: l'indicatore ONDA in alto dice a quanti metri ti sta dietro (rosso sotto i 25).
// Interruttori: P pista, V veicolo, C camera, B bot, T pilota automatico, R ricomincia, L luce. Indirizzo:
// ?pista=…&veicolo=…&cam=…&bot=0&auto=1.
// Test: window.__provapiste.ready / .perf() / .state() / .set({...}).
import * as THREE from 'three';
import { CORSE, CORSE_PISTE } from '@marea/content/corse.ts';
import { DT, quantize } from '@marea/sim';
import type { InputFrame } from '@marea/sim';
import { famiglieDi, garaCorse, opzioniGara, pilotaGara } from '@marea/sim/corse/gara.ts';
import type { GaraState, GaraView } from '@marea/sim/corse/gara.ts';
import { nuovaTerna, terna } from '@marea/sim/corse/nastro.ts';
import { nastroDi, pistaCorse } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { FLAGS } from '../../flags.ts';
import { createInput } from '../../game/input.ts';
import { createLights } from '../../render/light.ts';
import { createPost } from '../../render/post.ts';
import { P } from '../../render/island_parts.ts';
import { STYLES } from '../../provapixel/styles.ts';
import type { StyleId } from '../../provapixel/styles.ts';
import { creaPista3d } from '../nastro3d.ts';
import { matOnda, ondaGeo } from '../onda3d.ts';
import type { Pista3d } from '../nastro3d.ts';
import { veicoloGeo } from '../veicoli3d.ts';

const PISTE = Object.keys(CORSE_PISTE);
const CAMERE = ['dietro', 'alta', 'pianta', 'giro'] as const;
type Camera = (typeof CAMERE)[number];
const LUCI: StyleId[] = ['giorno', 'tramonto', 'gioco'];
const COLORI = [P.rosso, P.giallo, P.acquaBassa, P.viola, P.erbaChiara];
const CASCHI = [P.pietraChiara, P.neroCaldo, P.neroCaldo, P.neroCaldo, P.neroCaldo];
const VIA = 120;

const q = new URLSearchParams(location.search);
const opz = { ...opzioniGara({ pista: q.get('pista'), veicolo: q.get('veicolo'), bot: q.get('bot') }) };
let cam: Camera = CAMERE.includes(q.get('cam') as Camera) ? (q.get('cam') as Camera) : 'dietro';
let auto = q.get('auto') === '1', luce: StyleId = 'giorno';

// ---------- resa (come provapixel: immagine piccola, passata finale coi contorni, il cielo e la palette) ----------
const canvas = document.getElementById('gl') as HTMLCanvasElement, root = document.getElementById('ui') as HTMLElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
canvas.style.imageRendering = 'pixelated';
const scene = new THREE.Scene(); scene.background = new THREE.Color(P.acquaBassa);
const post = createPost();
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 900);
const lights = createLights(); scene.add(lights.group);
const mare = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: P.acqua, flatShading: true }));
mare.rotation.x = -Math.PI / 2; mare.position.y = -1.2; mare.receiveShadow = true; scene.add(mare);
const input = createInput({ canvas, root, cameraYaw: () => 0 });
const btnA = document.getElementById('btnA'), btnB = document.getElementById('btnB');
if (btnA) { btnA.textContent = 'DRIFT'; btnA.style.fontSize = '17px'; }
if (btnB) { btnB.textContent = 'FRENO'; btnB.style.fontSize = '13px'; }

let H = 1;
function resize() {
  const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
  const k = Math.min(1.5, devicePixelRatio || 1) * (FLAGS.quality === 'low' ? 0.4 : 0.5);
  const w = Math.max(1, Math.round(cw * k)); H = Math.max(1, Math.round(ch * k));
  gl.setSize(w, H, false); post.setSize(w, H);
  camera.aspect = cw / Math.max(1, ch); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
function setLuce(id: StyleId) {
  const st = STYLES.find((x) => x.id === id)!;
  post.setStyle(st); luce = id;
  post.toggles.contorni = id !== 'gioco'; post.toggles.foschia = id !== 'gioco'; post.toggles.cielo = id !== 'gioco';
}

// ---------- la gara ----------
let p: Pista = pistaCorse(opz['pista']!), p3d: Pista3d | null = null;
let s: GaraState = garaCorse.create({ seed: 1, difficulty: 2, opzioni: opz });
let meshes: THREE.Mesh[] = [], ondaMesh: THREE.Mesh | null = null, fase: 'via' | 'gara' | 'fine' = 'via', attesa = VIA, finita = 0;
const matVeicoli = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const materialeOnda = matOnda();

function nuovaGara(cambiaPista: boolean) {
  Object.assign(opz, opzioniGara(opz));
  if (cambiaPista || !p3d) {
    if (p3d) { scene.remove(p3d.group); p3d.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }); }
    p = pistaCorse(opz['pista']!); p3d = creaPista3d(p); scene.add(p3d.group);
  }
  s = garaCorse.create({ seed: (Math.random() * 1e9) >>> 0, difficulty: 2, opzioni: opz });
  for (const m of meshes) { scene.remove(m); m.geometry.dispose(); }
  meshes = s.veicoli.map((k, i) => {
    const m = new THREE.Mesh(veicoloGeo(k.id, COLORI[i % COLORI.length]!, CASCHI[i % CASCHI.length]!), matVeicoli);
    m.castShadow = true; m.matrixAutoUpdate = false; m.name = i ? `corse_bot_${i}` : 'corse_tu'; scene.add(m);
    return m;
  });
  if (ondaMesh) { scene.remove(ondaMesh); ondaMesh.geometry.dispose(); ondaMesh = null; }
  if (p.def.inseguitore) {
    ondaMesh = new THREE.Mesh(ondaGeo(p.def.larghezza + p.def.bordo + 8), materialeOnda);
    ondaMesh.matrixAutoUpdate = false; ondaMesh.name = 'corse_onda'; ondaMesh.frustumCulled = false; scene.add(ondaMesh);
  }
  fase = 'via'; attesa = VIA; finita = 0; camOk = false;
  scrivi();
}

/** Joystick e tasti → sterzo, gas automatico, freno, drift. */
function comandi(f: InputFrame): InputFrame {
  const freno = f.b || f.my > 0.5;
  return { mx: Math.max(-1, Math.min(1, f.mx / 0.7)), my: freno ? -1 : 1, a: f.a, b: false };
}
function step() {
  if (fase === 'via') { if (--attesa <= 0) fase = 'gara'; return; }
  if (fase === 'fine') { if (++finita > 60 * 4 && auto) nuovaGara(false); return; }
  const f = quantize(auto ? pilotaGara(s) : comandi(input.sample()));
  garaCorse.step(s, f);
  if (s.done) fase = 'fine';
}

// ---------- veicoli e camera ----------
const T3 = nuovaTerna(), M4 = new THREE.Matrix4();
const vF = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3(), vP = new THREE.Vector3();
const camF = new THREE.Vector3(1, 0, 0), camU = new THREE.Vector3(0, 1, 0), camP = new THREE.Vector3(), tmp = new THREE.Vector3();
let camOk = false, orbita = 0;
/** Dove sta il veicolo `i` nel mondo: posizione, avanti (muso), sopra (la pista sotto di lui). */
function posa(i: number, pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3) {
  const k = s.veicoli[i]!, n = nastroDi(p, k.ramo);
  terna(n, k.s, T3);
  up.set(T3.ux, T3.uy, T3.uz).normalize();
  pos.set(T3.x + T3.rx * k.lat + up.x * k.h, T3.y + T3.ry * k.lat + up.y * k.h, T3.z + T3.rz * k.lat + up.z * k.h);
  fwd.set(T3.tx * k.hf + T3.rx * k.hl, T3.ty * k.hf + T3.ry * k.hl, T3.tz * k.hf + T3.rz * k.hl).normalize();
  if (k.caduto) pos.addScaledVector(up, -Math.min(6, k.caduto * 8)); // chi è caduto sprofonda
}
function aggiornaVeicoli() {
  if (ondaMesh) { // l'onda sta sul nastro principale, al centro, col muso (la cresta) verso l'arrivo
    const so = Math.max(0, Math.min(p.n.len, p.def.via + s.onda));
    terna(p.n, so, T3);
    vU.set(T3.ux, T3.uy, T3.uz).normalize(); vR.set(T3.rx, T3.ry, T3.rz); vF.set(-T3.tx, -T3.ty, -T3.tz);
    M4.makeBasis(vR, vU, vF).setPosition(T3.x, T3.y, T3.z);
    ondaMesh.matrix.copy(M4); ondaMesh.matrixWorldNeedsUpdate = true;
  }
  for (let i = 0; i < meshes.length; i++) {
    posa(i, vP, vF, vU);
    vR.crossVectors(vF, vU).normalize();
    const back = tmp.copy(vF).negate();
    M4.makeBasis(vR, vU, back).setPosition(vP);
    meshes[i]!.matrix.copy(M4); meshes[i]!.matrixWorldNeedsUpdate = true;
  }
}
function aggiornaCamera(dt: number) {
  posa(0, vP, vF, vU);
  const k = s.veicoli[0]!, n = nastroDi(p, k.ramo);
  terna(n, k.s, T3);
  const lontano = cam === 'pianta'; // dall'alto la foschia sbiadisce tutto
  post.toggles.foschia = luce !== 'gioco' && !lontano; post.toggles.cielo = luce !== 'gioco' && !lontano;
  if (cam === 'pianta' && p3d) {
    // in verticale sullo schermo c'è la z, in orizzontale la x: la distanza è quella che fa stare tutte e due
    const b = p3d.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, tf = Math.tan((camera.fov * Math.PI) / 360);
    const dist = Math.max((b.z1 - b.z0) / 2, (b.x1 - b.x0) / (2 * camera.aspect)) / tf * 1.1;
    camera.up.set(0, 0, -1); camera.position.set(cx, b.y1 + dist + 5, cz); camera.lookAt(cx, b.y0, cz);
    camera.far = 2000; camera.updateProjectionMatrix();
    return;
  }
  if (cam === 'giro') {
    orbita += dt * 0.5;
    camera.up.set(0, 1, 0); camera.position.set(vP.x + Math.cos(orbita) * 9, vP.y + 4, vP.z + Math.sin(orbita) * 9); camera.lookAt(vP.x, vP.y + 0.8, vP.z);
    return;
  }
  // dietro: la camera sta sulla pista qualche metro dietro di te («sui binari»), così nei giri della morte e nelle curve resta sopra
  // la strada; sopra = il sopra della pista lì. Guarda un po' più avanti del veicolo, un filo verso dove punta il muso (in drift lo vedi di traverso).
  const alta = cam === 'alta', tel = camera.aspect < 0.8;
  const dist = (alta ? 13 : tel ? 7.6 : 6.4) + Math.max(0, k.v) * 0.04, alt = (alta ? 7 : tel ? 3.4 : 2.7) + Math.max(0, k.h) * 0.6;
  let nc = n, sc = k.s - dist;
  if (k.ramo >= 0 && sc < 0) { nc = p.n; sc = p.rami[k.ramo]!.def.da + sc; } // sull'imbocco di un ramo la camera è ancora sulla principale
  terna(nc, sc, T3);
  const latc = k.lat * 0.7;
  camP.set(T3.x + T3.rx * latc + T3.ux * alt, T3.y + T3.ry * latc + T3.uy * alt, T3.z + T3.rz * latc + T3.uz * alt);
  // l'onda che si avvicina fa tremare la camera (sotto i 35 m)
  const tremo = p.def.inseguitore ? Math.max(0, 1 - (k.prog - s.onda) / 35) : 0;
  if (tremo > 0) camP.addScaledVector(camU, Math.sin(performance.now() * 0.06) * 0.14 * tremo);
  tmp.set(T3.ux, T3.uy, T3.uz).normalize();
  camU.lerp(tmp, camOk ? 1 - Math.exp(-dt * 10) : 1).normalize();
  camera.position.lerp(camP, camOk ? 1 - Math.exp(-dt * 20) : 1);
  camera.up.copy(camU);
  camF.copy(vF);
  tmp.copy(vP).addScaledVector(camF, 4).addScaledVector(vU, alta ? 0.5 : 1);
  camera.lookAt(tmp);
  const fov = (tel ? 78 : 64) + (k.turbo > 0 ? 8 : 0) + Math.max(0, k.v - 15) * 0.3;
  if (Math.abs(camera.fov - fov) > 0.05 || camera.far !== 900) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 5); camera.far = 900; camera.updateProjectionMatrix(); }
  camOk = true;
}

// ---------- interfaccia ----------
const css = document.createElement('style');
css.textContent = `
.pp-hud { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 6px; pointer-events: none; font: bold 18px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; }
.pp-hud div { padding: 4px 9px; background: rgba(46,30,20,.88); border: 2px solid ${P.legnoChiaro}; white-space: nowrap; }
.pp-hud small { font-size: 11px; color: ${P.sabbia}; }
.pp-big { position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%); padding: 10px 20px; background: rgba(46,30,20,.95); border: 3px solid ${P.legnoChiaro}; font: bold 38px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; text-align: center; pointer-events: none; display: none; white-space: nowrap; }
.pp-big small { display: block; font-size: 14px; color: ${P.sabbia}; margin-top: 4px; }
.pp-panel { position: absolute; left: max(8px, env(safe-area-inset-left)); top: calc(max(8px, env(safe-area-inset-top)) + 44px); display: flex; flex-direction: column; gap: 4px; font: bold 12px ui-monospace, Menlo, monospace; max-width: 60vw; }
.pp-panel button { pointer-events: auto; text-align: left; border: 2px solid ${P.legno}; background: rgba(46,30,20,.78); color: ${P.sabbiaChiara}; padding: 5px 7px; border-radius: 4px; font: inherit; cursor: pointer; touch-action: manipulation; }
.pp-panel button.fold { border-color: ${P.arancio}; color: ${P.giallo}; }
`;
document.head.appendChild(css);
const hud = document.createElement('div'); hud.className = 'pp-hud'; root.appendChild(hud);
const big = document.createElement('div'); big.className = 'pp-big'; root.appendChild(big);
const panel = document.createElement('div'); panel.className = 'pp-panel'; root.appendChild(panel);
let aperto = innerWidth >= 700;
const fold = document.createElement('button'); fold.className = 'fold'; panel.appendChild(fold);
const ferma = (e: Event) => e.stopPropagation();
fold.addEventListener('pointerdown', (e) => { ferma(e); aperto = !aperto; scrivi(); });
const famigliaVeicoli = () => CORSE.veicoli.filter((v) => famiglieDi(p.def).includes(v.famiglia));
const ROWS: [string, string, () => string, () => void][] = [
  ['P', 'pista', () => p.def.nome, () => { opz['pista'] = PISTE[(PISTE.indexOf(opz['pista']!) + 1) % PISTE.length]!; opz['veicolo'] = ''; nuovaGara(true); }],
  ['V', 'veicolo', () => CORSE.veicoli.find((v) => v.id === opz['veicolo'])?.nome ?? '', () => { const l = famigliaVeicoli(); opz['veicolo'] = l[(l.findIndex((v) => v.id === opz['veicolo']) + 1) % l.length]!.id; nuovaGara(false); }],
  ['C', 'camera', () => cam, () => { cam = CAMERE[(CAMERE.indexOf(cam) + 1) % CAMERE.length]!; camOk = false; }],
  ['B', 'bot', () => (opz['bot'] === '0' ? 'no' : 'sì'), () => { opz['bot'] = opz['bot'] === '0' ? '1' : '0'; nuovaGara(false); }],
  ['T', 'pilota automatico', () => (auto ? 'sì' : 'no'), () => { auto = !auto; }],
  ['R', 'ricomincia', () => '', () => nuovaGara(false)],
  ['L', 'luce', () => luce, () => setLuce(LUCI[(LUCI.indexOf(luce) + 1) % LUCI.length]!)],
];
const righe = ROWS.map(([tasto, nome, val, fai]) => {
  const b = document.createElement('button');
  b.addEventListener('pointerdown', (e) => { ferma(e); fai(); scrivi(); });
  panel.appendChild(b);
  return () => { b.textContent = `${tasto} ${nome}${val() ? ': ' + val() : ''}`; b.style.display = aperto ? '' : 'none'; };
});
function scrivi() { fold.textContent = aperto ? 'prove ▴' : 'prove ▾'; for (const r of righe) r(); }
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const r = ROWS.find(([k]) => k === e.key.toUpperCase());
  if (r && e.code !== 'KeyA' && e.code !== 'KeyD' && e.code !== 'KeyS' && e.code !== 'KeyW') { r[3](); scrivi(); }
});
const tempo = (ms: number) => { const t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), sec = t - m * 60; return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1).replace('.', ',')}`; };
function aggiornaHud(v: GaraView) {
  const k = s.veicoli[0]!;
  const tipo = p.def.tipo === 'fuga' ? 'FUGA' : `GIRO ${v.giro}/${v.giri}`;
  const onda = v.onda === null ? '' : `<div style="${v.ondaDist < 25 ? `background:${P.rosso};color:${P.pietraChiara}` : ''}">ONDA ${v.ondaDist < 0 ? '!!' : Math.round(v.ondaDist) + '<small> m</small>'}</div>`;
  hud.innerHTML = `<div>${v.posizioni[0]}°<small>/${s.veicoli.length}</small></div><div>${tipo}</div><div>${tempo(v.ms)}</div><div>${Math.round(Math.abs(k.v) * 3.6)}<small> km/h</small></div>${onda}`;
  if (fase === 'via') { big.style.display = 'block'; big.innerHTML = `${Math.ceil(attesa / 40)}<small>${p.def.nome} · il gas è automatico</small>`; }
  else if (fase === 'fine') {
    big.style.display = 'block';
    big.innerHTML = v.finished ? `${v.posizioni[0]}° · ${tempo(v.ms)}<small>salti ${k.salti} · cadute ${k.cadute} · R per rifare</small>` : `TEMPO SCADUTO<small>R per rifare</small>`;
  } else if (k.caduto) { big.style.display = 'block'; big.innerHTML = 'CADUTO!<small>si riparte</small>'; }
  else if (v.onda !== null && v.ondaDist < 0 && v.ondaDist > -(p.def.inseguitore?.spessore ?? 0)) { big.style.display = 'block'; big.innerHTML = 'TRAVOLTO!<small>l\'onda ti ha preso</small>'; }
  else big.style.display = 'none';
  if (p3d) for (const e of p3d.eventi) e.mesh.visible = k.giro + 1 >= e.daGiro;
}

// ---------- ciclo ----------
setLuce(luce); resize(); nuovaGara(true);
const perf = { fps: 0, frames: 0, acc: 0 };
let last = performance.now(), acc = 0, time = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; time += dt;
  let n = 0;
  while (acc >= DT && n < 6) { step(); acc -= DT; n++; }
  if (n === 6) acc = 0;
  aggiornaVeicoli(); aggiornaCamera(dt);
  lights.follow?.(vP.x, vP.z);
  aggiornaHud(garaCorse.view(s) as GaraView);
  post.render(gl, scene, camera, time);
  perf.frames++; perf.acc += dt;
  if (perf.acc >= 0.5) { perf.fps = perf.frames / perf.acc; perf.frames = 0; perf.acc = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const api = {
  ready: false,
  perf: () => ({ drawCalls: post.sceneCalls() + 1, triangles: post.sceneTris() + 2, fps: Math.round(perf.fps * 10) / 10, w: gl.domElement.width, h: gl.domElement.height }),
  state: () => {
    const k = s.veicoli[0]!, v = garaCorse.view(s) as GaraView;
    return { pista: p.def.id, veicolo: k.id, fase, cam, auto, bot: s.veicoli.length - 1, giro: v.giro, pos: v.posizioni[0], ms: v.ms, done: s.done,
      s: Math.round(k.s * 10) / 10, lat: Math.round(k.lat * 100) / 100, h: Math.round(k.h * 100) / 100, v: Math.round(k.v * 10) / 10,
      ramo: k.ramo, aria: k.aria, caduto: k.caduto > 0, salti: k.salti, cadute: k.cadute, sup: k.sup, onda: v.onda === null ? null : Math.round(v.onda * 10) / 10, ondaDist: Math.round(v.ondaDist * 10) / 10, travolto: k.travolto, risultato: s.done ? garaCorse.result(s) : null };
  },
  /** Cambia pista, veicolo, bot, camera, pilota automatico; `vai` = salta il conto alla rovescia; `fino` = porta il tuo veicolo a quella s (prove). */
  set: (o: { pista?: string; veicolo?: string; bot?: boolean; cam?: Camera; auto?: boolean; luce?: StyleId; vai?: boolean }) => {
    const nuovaPista = o.pista !== undefined && o.pista !== opz['pista'];
    if (o.pista !== undefined) { opz['pista'] = o.pista; if (nuovaPista) opz['veicolo'] = ''; }
    if (o.veicolo !== undefined) opz['veicolo'] = o.veicolo;
    if (o.bot !== undefined) opz['bot'] = o.bot ? '1' : '0';
    if (o.cam) cam = o.cam;
    if (o.auto !== undefined) auto = o.auto;
    if (o.luce) setLuce(o.luce);
    if (o.pista !== undefined || o.veicolo !== undefined || o.bot !== undefined) nuovaGara(nuovaPista);
    if (o.vai) { attesa = 0; fase = 'gara'; }
    camOk = false; scrivi();
    return api.state();
  },
  /** Avanza la gara di `tick` passi subito (pilota automatico), senza aspettare il tempo vero. */
  avanti: (tick: number) => { const a = auto; auto = true; fase = 'gara'; for (let i = 0; i < tick && fase === 'gara'; i++) step(); auto = a; camOk = false; return api.state(); },
  piste: PISTE,
};
(window as unknown as { __provapiste: typeof api }).__provapiste = api;
requestAnimationFrame(() => requestAnimationFrame(() => { api.ready = true; }));
console.log(`[provapiste] ${PISTE.length} piste: ${PISTE.join(', ')}`);
