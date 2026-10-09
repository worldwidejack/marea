// Banco di prova delle piste (docs/CORSE.md A11, #155): provapiste.html, pagina a parte, il gioco non cambia. Qui si guida sul motore v2
// (pista a nastro 3D): giri della morte, salti, discese, acqua, scorciatoie, ponti senza muri, eventi firma. Le piste sono quelle di
// tools/corse_piste/ (per ora quelle di prova; poi le grezze delle zone, da provare prima di vestirle).
// Comandi:
// - telefono: joystick = sterzo, in avanti = gas (in diagonale sterzi e acceleri), in giù o FRENO = freno, DRIFT;
// - PC: A D o ← → sterzo, W o ↑ gas (tenuto quando compare l'1: turbo alla partenza), S o ↓ freno, Spazio = drift (in aria: acrobazia).
// La guida (#170): drift col saltello e 3 livelli di scintille (blu, arancio, viola), turbo alla partenza, acrobazie, scia, turbo
// che si sommano; fiammate, linee di velocità, scossa, FOV e suoni. Ogni regola ha il suo interruttore A/B nel pannello «prove».
// Fughe con l'onda: l'indicatore ONDA in alto dice a quanti metri ti sta dietro (rosso sotto i 25).
// Interruttori: P pista, V veicolo, B bot, T pilota automatico, R ricomincia, L luce, 1-6 le regole A/B; C camera e ⚙ opzioni (camera
// dietro / alta / cofano, suoni). La pista intera è la minimappa nell'angolo. Indirizzo: ?pista=…&veicolo=…&cam=…&bot=0&auto=1
// e le regole (?scia=0…). Test: window.__provapiste.ready / .perf() / .state() / .set({...}) / .avanti(tick).
import * as THREE from 'three';
import { CORSE, CORSE_PISTE } from '@marea/content/corse.ts';
import { DT, quantize } from '@marea/sim';
import type { InputFrame } from '@marea/sim';
import { famiglieDi, garaCorse, opzioniGara, pilotaGara } from '@marea/sim/corse/gara.ts';
import type { GaraState, GaraView } from '@marea/sim/corse/gara.ts';
import { nuovaTerna, terna } from '@marea/sim/corse/nastro.ts';
import { nastroDi, pistaCorse, veicoloCorse } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { livelloDrift } from '@marea/sim/corse/veicolo.ts';
import { FLAGS } from '../../flags.ts';
import { createInput } from '../../game/input.ts';
import { createLights } from '../../render/light.ts';
import { createPost } from '../../render/post.ts';
import { P } from '../../render/island_parts.ts';
import { STYLES } from '../../provapixel/styles.ts';
import type { StyleId } from '../../provapixel/styles.ts';
import { creaLinee, creaMinimappa, creaParticelle, emettiVeicolo } from '../effetti.ts';
import { creaPista3d } from '../nastro3d.ts';
import type { Pista3d } from '../nastro3d.ts';
import { matOnda, ondaGeo } from '../onda3d.ts';
import { creaSuoni } from '../suoni.ts';
import { veicoloGeo } from '../veicoli3d.ts';
import { ASPETTI, PILOTI, caricaKit } from '../veicoli_kit.ts';
import { creaRegia } from './camera.ts';
import { stileProva } from './stile.ts';

const PISTE = Object.keys(CORSE_PISTE);
const CAMERE = ['dietro', 'alta', 'cofano'] as const;
type Camera = (typeof CAMERE)[number];
const NOME_CAMERA: Record<Camera, string> = { dietro: 'dietro', alta: 'alta', cofano: 'cofano' };
const REGOLE = [
  ['sterzo', 'sterzo', 'nuovo', 'vecchio'],
  ['partenza', 'turbo alla partenza', 'sì', 'no'],
  ['acrobazie', 'acrobazie', 'sì', 'no'],
  ['scia', 'scia', 'sì', 'no'],
  ['somma', 'turbo sommati', 'sì', 'no'],
] as const;
const LUCI: StyleId[] = ['giorno', 'tramonto', 'gioco'];
const COLORI = [P.rosso, P.giallo, P.acquaBassa, P.viola, P.erbaChiara];
const CASCHI = [P.pietraChiara, P.neroCaldo, P.neroCaldo, P.neroCaldo, P.neroCaldo];

const q = new URLSearchParams(location.search);
const opz = { ...opzioniGara({ pista: q.get('pista'), veicolo: q.get('veicolo'), bot: q.get('bot'), ...Object.fromEntries(REGOLE.map(([id]) => [id, q.get(id)])) }) };
const camQ = q.get('cam') === 'vicina' ? 'cofano' : q.get('cam');
let cam: Camera = CAMERE.includes(camQ as Camera) ? (camQ as Camera) : 'dietro';
let aspetto = ASPETTI.includes(q.get('aspetto') as never) ? q.get('aspetto')! : '', animali = q.get('animali') !== '0';
let gasAuto = q.get('gas') === 'auto', auto = q.get('auto') === '1', luce: StyleId = 'giorno', effetti = q.get('effetti') !== '0', pausa = false;

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
const fx = creaParticelle(); scene.add(fx.mesh);
const suoni = creaSuoni();
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

// ---------- la gara (il conto alla rovescia è nella sim: tick negativi fino al VIA) ----------
let p: Pista = pistaCorse(opz['pista']!), p3d: Pista3d | null = null;
let s: GaraState = garaCorse.create({ seed: 1, difficulty: 2, opzioni: opz });
let meshes: THREE.Mesh[] = [], ondaMesh: THREE.Mesh | null = null, fase: 'gara' | 'fine' = 'gara', finita = 0;
const matVeicoli = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const materialeOnda = matOnda();
/** Quello che serve alla resa per ogni veicolo: saltello del drift, angolo di traverso, e i valori di prima per vedere cosa è cambiato. */
type Vis = { hop: number; traverso: number; drift: number; lv: number; turbo: number; aria: boolean; vh: number; acro: number; scia: number };
let vis: Vis[] = [];

function nuovaGara(cambiaPista: boolean) {
  Object.assign(opz, opzioniGara(opz));
  if (cambiaPista || !p3d) {
    if (p3d) { scene.remove(p3d.group); p3d.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }); }
    p = pistaCorse(opz['pista']!); p3d = creaPista3d(p); scene.add(p3d.group);
    mappa.pista(p);
  }
  s = garaCorse.create({ seed: (Math.random() * 1e9) >>> 0, difficulty: 2, opzioni: opz });
  for (const m of meshes) { scene.remove(m); m.geometry.dispose(); }
  meshes = s.veicoli.map((k, i) => {
    const m = new THREE.Mesh(veicoloGeo(k.id, COLORI[i % COLORI.length]!, CASCHI[i % CASCHI.length]!, aspetto, animali && i ? PILOTI[(i - 1) % PILOTI.length]! : null), matVeicoli);
    m.castShadow = true; m.matrixAutoUpdate = false; m.name = i ? `corse_bot_${i}` : 'corse_tu'; scene.add(m);
    return m;
  });
  if (ondaMesh) { scene.remove(ondaMesh); ondaMesh.geometry.dispose(); ondaMesh = null; }
  if (p.def.inseguitore) {
    ondaMesh = new THREE.Mesh(ondaGeo(p.def.larghezza + p.def.bordo + 8), materialeOnda);
    ondaMesh.matrixAutoUpdate = false; ondaMesh.name = 'corse_onda'; ondaMesh.frustumCulled = false; scene.add(ondaMesh);
  }
  vis = s.veicoli.map(() => ({ hop: 0, traverso: 0, drift: 0, lv: 0, turbo: 0, aria: false, vh: 0, acro: 0, scia: 0 }));
  fase = 'gara'; finita = 0; regia.st.ok = false; fx.svuota(); toast(null); contoPrima = 0; viaFlash = 0;
  scrivi();
}

/** Joystick e tasti → sterzo, gas, freno, drift. Il gas si dà (Jack: lasciarlo è il modo di prendere bene le curve): W o ↑, joystick in
 *  avanti (in proporzione); «gas automatico» nel menù opzioni per chi non gioca mai. Curva e rampa dello sterzo le fa la sim. */
function comandi(f: InputFrame): InputFrame {
  const freno = f.b || f.my > 0.5, gas = Math.max(0, Math.min(1, -f.my / 0.6));
  return { mx: Math.max(-1, Math.min(1, f.mx / 0.7)), my: freno ? -1 : gasAuto ? 1 : gas, a: f.a, b: false };
}
function step() {
  if (fase === 'fine') { if (++finita > 60 * 4 && auto) nuovaGara(false); return; }
  const f = quantize(auto ? pilotaGara(s) : comandi(input.sample()));
  garaCorse.step(s, f);
  if (s.done) { fase = 'fine'; suoni.zitto(); }
}

// ---------- veicoli, effetti e camera ----------
const T3 = nuovaTerna(), M4 = new THREE.Matrix4();
const vF = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3(), vP = new THREE.Vector3(), vM = new THREE.Vector3();
const tmp = new THREE.Vector3();
const regia = creaRegia(camera);
/** Dove sta il veicolo `i` nel mondo: posizione, avanti (muso), sopra (la pista sotto di lui), destra e moto. */
function posa(i: number, pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3, moto?: THREE.Vector3) {
  const k = s.veicoli[i]!, n = nastroDi(p, k.ramo);
  terna(n, k.s, T3);
  up.set(T3.ux, T3.uy, T3.uz).normalize();
  pos.set(T3.x + T3.rx * k.lat + up.x * k.h, T3.y + T3.ry * k.lat + up.y * k.h, T3.z + T3.rz * k.lat + up.z * k.h);
  fwd.set(T3.tx * k.hf + T3.rx * k.hl, T3.ty * k.hf + T3.ry * k.hl, T3.tz * k.hf + T3.rz * k.hl).normalize();
  moto?.set(T3.tx * k.mf + T3.rx * k.ml, T3.ty * k.mf + T3.ry * k.ml, T3.tz * k.mf + T3.rz * k.ml).normalize();
  if (k.caduto) pos.addScaledVector(up, -Math.min(6, k.caduto * 8)); // chi è caduto sprofonda
}
function aggiornaVeicoli(dt: number) {
  if (ondaMesh) { // l'onda sta sul nastro principale, al centro, col muso (la cresta) verso l'arrivo
    const so = Math.max(0, Math.min(p.n.len, p.def.via + s.onda));
    terna(p.n, so, T3);
    vU.set(T3.ux, T3.uy, T3.uz).normalize(); vR.set(T3.rx, T3.ry, T3.rz); vF.set(-T3.tx, -T3.ty, -T3.tz);
    M4.makeBasis(vR, vU, vF).setPosition(T3.x, T3.y, T3.z);
    ondaMesh.matrix.copy(M4); ondaMesh.matrixWorldNeedsUpdate = true;
  }
  for (let i = 0; i < meshes.length; i++) {
    const k = s.veicoli[i]!, w = vis[i]!;
    posa(i, vP, vF, vU, vM);
    vR.crossVectors(vF, vU).normalize();
    // il saltello quando parte il drift, e il kart di traverso (un po' più di quanto dice la sim: si deve vedere)
    if (k.drift && !w.drift) w.hop = 0.001;
    if (w.hop > 0) { w.hop += dt; if (w.hop > 0.26) w.hop = 0; }
    w.traverso += (k.drift * 0.32 - w.traverso) * Math.min(1, dt * 10);
    const hop = w.hop > 0 ? 4 * 0.38 * (w.hop / 0.26) * (1 - w.hop / 0.26) : 0;
    const c = Math.cos(w.traverso), sn = Math.sin(w.traverso);
    tmp.copy(vF).multiplyScalar(c).addScaledVector(vR, sn); vF.copy(tmp); vR.crossVectors(vF, vU).normalize();
    // l'acrobazia: un avvitamento intorno al muso
    if (k.acro > 0) {
      const a = Math.PI * 2 * Math.min(1, k.acro / 0.42), ca = Math.cos(a), sa = Math.sin(a);
      tmp.copy(vU).multiplyScalar(ca).addScaledVector(vR, sa); vU.copy(tmp); vR.crossVectors(vF, vU).normalize();
    }
    vP.addScaledVector(vU, hop);
    if (k.fermo > 0) vP.addScaledVector(vR, (Math.random() - 0.5) * 0.08); // motore ingolfato: trema
    M4.makeBasis(vR, vU, tmp.copy(vF).negate()).setPosition(vP);
    meshes[i]!.matrix.copy(M4); meshes[i]!.matrixWorldNeedsUpdate = true;
    if (effetti && !k.caduto && (i === 0 || camera.position.distanceToSquared(vP) < 60 * 60)) emettiVeicolo(fx, k, i === 0 && k.scia > 0.15 && w.scia <= k.scia, pausa ? 0 : Math.max(0, k.v), vP, vF, vU, vR, vM);
  }
}
/** Messaggi e suoni quando cambia qualcosa (livello del drift, turbo, acrobazia, scia, atterraggi). */
function eventi() {
  const k = s.veicoli[0]!, w = vis[0]!, lv = k.drift ? livelloDrift(k.carica) : 0;
  if (lv > w.lv) suoni.livello(lv);
  if (k.turbo > w.turbo + 0.05) {
    suoni.turbo(k.livello); regia.st.pugno = 8 + 2 * Math.min(3, k.livello); regia.st.scossa = Math.max(regia.st.scossa, 0.1);
    if (w.scia > CORSE.scia.secondi * 0.6 && k.scia === 0) { toast('SCIA!', P.pietraChiara); suoni.scia(); }
    else if (w.acro > 0 && k.acro === 0) toast('ACROBAZIA!', P.ambraNeon);
  }
  if (k.acro > 0 && w.acro === 0) suoni.acrobazia();
  if (w.aria && !k.aria && !k.caduto) { const urto = Math.max(0, -w.vh); suoni.atterra(urto); regia.st.scossa = Math.max(regia.st.scossa, Math.min(0.35, urto * 0.025)); }
  for (let i = 0; i < vis.length; i++) {
    const x = s.veicoli[i]!, y = vis[i]!;
    y.drift = x.drift; y.turbo = x.turbo; y.aria = x.aria; y.vh = x.vh; y.acro = x.acro; y.scia = x.scia;
  }
  w.lv = lv;
}
function aggiornaCamera(dt: number) {
  posa(0, vP, vF, vU, vM);
  post.toggles.foschia = luce !== 'gioco'; post.toggles.cielo = luce !== 'gioco';
  const w = vis[0]!, hop = w.hop > 0 ? 1.52 * (w.hop / 0.26) * (1 - w.hop / 0.26) : 0;
  regia.segui(cam, { pos: vP, fwd: vF, up: vU, moto: vM, k: s.veicoli[0]!, p, onda: s.onda, hop, effetti, dt });
}

// ---------- interfaccia ----------
stileProva();
const linee = creaLinee(root);
const mappa = creaMinimappa(root);
const hud = document.createElement('div'); hud.className = 'pp-hud'; root.appendChild(hud);
const big = document.createElement('div'); big.className = 'pp-big'; root.appendChild(big);
const tst = document.createElement('div'); tst.className = 'pp-toast'; root.appendChild(tst);
let tstT = 0;
function toast(t: string | null, colore: string = P.sabbiaChiara) {
  tst.style.display = t ? 'block' : 'none'; if (!t) return;
  tst.textContent = t; tst.style.color = colore; tstT = 1.1;
}
const ferma = (e: Event) => e.stopPropagation();

// il pannello delle prove (a sinistra)
const panel = document.createElement('div'); panel.className = 'pp-panel'; root.appendChild(panel);
let aperto = innerWidth >= 700;
const fold = document.createElement('button'); fold.className = 'fold'; panel.appendChild(fold);
fold.addEventListener('pointerdown', (e) => { ferma(e); aperto = !aperto; scrivi(); });
const famigliaVeicoli = () => CORSE.veicoli.filter((v) => famiglieDi(p.def).includes(v.famiglia));
type Riga = [tasto: string, nome: string, val: () => string, fai: () => void, ab?: () => boolean];
const ROWS: Riga[] = [
  ['P', 'pista', () => p.def.nome, () => { opz['pista'] = PISTE[(PISTE.indexOf(opz['pista']!) + 1) % PISTE.length]!; opz['veicolo'] = ''; nuovaGara(true); }],
  ['V', 'veicolo', () => CORSE.veicoli.find((v) => v.id === opz['veicolo'])?.nome ?? '', () => { const l = famigliaVeicoli(); opz['veicolo'] = l[(l.findIndex((v) => v.id === opz['veicolo']) + 1) % l.length]!.id; nuovaGara(false); }],
  ['B', 'bot', () => (opz['bot'] === '0' ? 'no' : 'sì'), () => { opz['bot'] = opz['bot'] === '0' ? '1' : '0'; nuovaGara(false); }],
  ['S', 'aspetto', () => (aspetto ? aspetto.replace('cs_v_', '').replace('_', ' ') : 'del veicolo'), () => { aspetto = aspetto ? (ASPETTI[ASPETTI.indexOf(aspetto as never) + 1] ?? '') : ASPETTI[0]; nuovaGara(false); }],
  ['A', 'animali piloti', () => (animali ? 'sì' : 'no'), () => { animali = !animali; nuovaGara(false); }, () => animali],
  ['T', 'pilota automatico', () => (auto ? 'sì' : 'no'), () => { auto = !auto; }],
  ['R', 'ricomincia', () => '', () => nuovaGara(false)],
  ['L', 'luce', () => luce, () => setLuce(LUCI[(LUCI.indexOf(luce) + 1) % LUCI.length]!)],
  ...REGOLE.map(([id, nome, si, no], j): Riga => [String(j + 1), nome, () => (opz[id] === '0' ? no : si), () => { opz[id] = opz[id] === '0' ? '1' : '0'; nuovaGara(false); }, () => opz[id] !== '0']),
  ['6', 'effetti', () => (effetti ? 'sì' : 'no'), () => { effetti = !effetti; if (!effetti) fx.svuota(); }, () => effetti],
];
const righe = ROWS.map(([tasto, nome, val, fai, ab]) => {
  const b = document.createElement('button');
  if (ab) b.classList.add('ab');
  b.addEventListener('pointerdown', (e) => { ferma(e); fai(); scrivi(); });
  panel.appendChild(b);
  return () => { b.textContent = `${tasto} ${nome}${val() ? ': ' + val() : ''}`; b.style.display = aperto ? '' : 'none'; if (ab) b.classList.toggle('off', !ab()); };
});

// il menù opzioni (a destra): camera e suoni
const ingr = document.createElement('button'); ingr.className = 'pp-ingr'; ingr.textContent = '⚙ opzioni'; ingr.id = 'ppOpzioni'; root.appendChild(ingr);
const menu = document.createElement('div'); menu.className = 'pp-opz'; menu.id = 'ppMenu'; root.appendChild(menu);
const bottoni: (() => void)[] = [];
const riga = (titolo: string, voci: [string, () => boolean, () => void][]) => {
  const t = document.createElement('div'); t.textContent = titolo; menu.appendChild(t);
  const r = document.createElement('div'); r.className = 'riga'; menu.appendChild(r);
  for (const [nome, sel, fai] of voci) {
    const b = document.createElement('button'); b.textContent = nome; b.dataset['voce'] = nome;
    b.addEventListener('pointerdown', (e) => { ferma(e); fai(); scrivi(); });
    r.appendChild(b); bottoni.push(() => b.classList.toggle('sel', sel()));
  }
};
riga('camera', CAMERE.map((c): [string, () => boolean, () => void] => [NOME_CAMERA[c], () => cam === c, () => { cam = c; regia.st.ok = false; }]));
riga('gas', [['manuale', () => !gasAuto, () => { gasAuto = false; }], ['automatico', () => gasAuto, () => { gasAuto = true; }]]);
riga('suoni', [['sì', () => suoni.acceso, () => { suoni.acceso = true; }], ['no', () => !suoni.acceso, () => { suoni.acceso = false; }]]);
let menuAperto = false;
ingr.addEventListener('pointerdown', (e) => { ferma(e); menuAperto = !menuAperto; scrivi(); });
for (const e of [menu, linee.el]) e.addEventListener('pointerdown', ferma);

function scrivi() {
  fold.textContent = aperto ? 'prove ▴' : 'prove ▾';
  for (const r of righe) r();
  menu.classList.toggle('on', menuAperto); mappa.el.style.display = menuAperto ? 'none' : '';
  for (const b of bottoni) b();
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.repeat) return;
  if (e.code === 'KeyC') { cam = CAMERE[(CAMERE.indexOf(cam) + 1) % CAMERE.length]!; regia.st.ok = false; scrivi(); return; }
  if (e.code === 'Escape' || e.code === 'KeyO') { menuAperto = !menuAperto; scrivi(); return; }
  const r = ROWS.find(([k]) => k === e.key.toUpperCase());
  if (r && e.code !== 'KeyA' && e.code !== 'KeyD' && e.code !== 'KeyS' && e.code !== 'KeyW') { r[3](); scrivi(); }
});
const tempo = (ms: number) => { const t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), sec = t - m * 60; return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1).replace('.', ',')}`; };
let contoPrima = 0, viaFlash = 0;
function aggiornaHud(v: GaraView, dt: number) {
  const k = s.veicoli[0]!;
  const tipo = p.def.tipo === 'fuga' ? 'FUGA' : `GIRO ${v.giro}/${v.giri}`;
  const onda = v.onda === null ? '' : `<div style="${v.ondaDist < 25 ? `background:${P.rosso};color:${P.pietraChiara}` : ''}">ONDA ${v.ondaDist < 0 ? '!!' : Math.round(v.ondaDist) + '<small> m</small>'}</div>`;
  hud.innerHTML = `<div>${v.posizioni[0]}°<small>/${s.veicoli.length}</small></div><div>${tipo}</div><div>${tempo(v.ms)}</div><div class="${k.turbo > 0 ? 'turbo' : ''}">${Math.round(Math.abs(k.v) * 3.6)}<small> km/h</small></div>${onda}`;
  // il semaforo: 3, 2, 1, VIA (coi bip), e com'è andata la partenza
  const conto = Math.ceil(v.via);
  if (conto !== contoPrima) {
    if (conto > 0) suoni.bip(false);
    else if (contoPrima > 0 && s.tick < 30) { // (se il semaforo l'hanno saltato i test, niente VIA in ritardo)
      suoni.bip(true); viaFlash = 0.8;
      if (k.partenza === 2) toast('PARTENZA RAZZO!', P.violaNeon);
      else if (k.partenza === 1) toast('BUONA PARTENZA', P.cianoNeon);
      else if (k.partenza === -1) { toast('MOTORE INGOLFATO!', P.rosso); suoni.ingolfato(); }
    }
    contoPrima = conto;
  }
  viaFlash = Math.max(0, viaFlash - dt);
  tstT -= dt; if (tstT <= 0 && tst.style.display !== 'none') toast(null);
  if (v.via > 0) {
    big.style.display = 'block'; big.style.color = conto > 1 ? P.rosso : P.giallo;
    big.innerHTML = `${conto}<small>${s.regole.partenza ? (auto ? 'pilota automatico' : 'dai GAS quando compare l\'1') : p.def.nome + (gasAuto ? ' · il gas è automatico' : ' · W o ↑ = gas')}</small>`;
  } else if (viaFlash > 0) { big.style.display = 'block'; big.style.color = P.erbaChiara; big.innerHTML = 'VIA!'; }
  else if (fase === 'fine') {
    big.style.display = 'block'; big.style.color = P.sabbiaChiara;
    big.innerHTML = v.finished ? `${v.posizioni[0]}° · ${tempo(v.ms)}<small>giro migliore ${tempo(v.bestMs)} · salti ${k.salti} · cadute ${k.cadute} · R per rifare</small>` : `TEMPO SCADUTO<small>R per rifare</small>`;
  } else if (k.caduto) { big.style.display = 'block'; big.style.color = P.sabbiaChiara; big.innerHTML = 'CADUTO!<small>si riparte</small>'; }
  else if (v.onda !== null && v.ondaDist < 0 && v.ondaDist > -(p.def.inseguitore?.spessore ?? 0)) { big.style.display = 'block'; big.style.color = P.sabbiaChiara; big.innerHTML = 'TRAVOLTO!<small>l\'onda ti ha preso</small>'; }
  else big.style.display = 'none';
  if (p3d) for (const e of p3d.eventi) e.mesh.visible = k.giro + 1 >= e.daGiro;
  mappa.disegna(s.veicoli.map((x, i) => {
    terna(nastroDi(p, x.ramo), x.s, T3);
    return { x: T3.x + T3.rx * x.lat, z: T3.z + T3.rz * x.lat, colore: COLORI[i % COLORI.length]!, tu: i === 0 };
  }));
  linee.disegna(effetti && fase === 'gara' ? (k.turbo > 0 ? 1 : k.scia > 0.2 ? 0.35 : 0) : 0, k.turbo > 0 ? P.sabbiaChiara : P.pietraChiara);
}

// ---------- ciclo ----------
setLuce(luce); resize(); nuovaGara(true);
void caricaKit().then(() => nuovaGara(false)); // i veicoli veri arrivano appena i glb sono scaricati; intanto ci sono i segnaposto
const perf = { fps: 0, frames: 0, acc: 0 };
let last = performance.now(), acc = 0, time = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; time += dt;
  let n = 0;
  while (acc >= DT && n < 6) { if (!pausa) step(); acc -= DT; n++; }
  if (n === 6) acc = 0;
  aggiornaVeicoli(dt); fx.aggiorna(dt); aggiornaCamera(dt); eventi();
  const k = s.veicoli[0]!;
  if (fase === 'gara' && s.tick > 0) suoni.motore(k.v, veicoloCorse(k.id).velocita, k.turbo > 0, k.drift !== 0, !k.aria);
  lights.follow?.(vP.x, vP.z);
  aggiornaHud(garaCorse.view(s) as GaraView, dt);
  post.render(gl, scene, camera, time);
  perf.frames++; perf.acc += dt;
  if (perf.acc >= 0.5) { perf.fps = perf.frames / perf.acc; perf.frames = 0; perf.acc = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const api = {
  ready: false,
  perf: () => ({ drawCalls: post.sceneCalls() + 1, triangles: post.sceneTris() + 2, fps: Math.round(perf.fps * 10) / 10, w: gl.domElement.width, h: gl.domElement.height, scintille: fx.mesh.count }),
  state: () => {
    const k = s.veicoli[0]!, v = garaCorse.view(s) as GaraView;
    return { pista: p.def.id, veicolo: k.id, fase, cam, auto, bot: s.veicoli.length - 1, giro: v.giro, pos: v.posizioni[0], ms: v.ms, done: s.done, via: v.via,
      s: Math.round(k.s * 10) / 10, lat: Math.round(k.lat * 100) / 100, h: Math.round(k.h * 100) / 100, v: Math.round(k.v * 10) / 10,
      ramo: k.ramo, aria: k.aria, caduto: k.caduto > 0, salti: k.salti, cadute: k.cadute, sup: k.sup,
      onda: v.onda === null ? null : Math.round(v.onda * 10) / 10, ondaDist: Math.round(v.ondaDist * 10) / 10, travolto: k.travolto,
      drift: k.drift, livello: livelloDrift(k.carica), turbo: Math.round(k.turbo * 100) / 100, partenza: k.partenza, regole: s.regole, menu: menuAperto,
      risultato: s.done ? garaCorse.result(s) : null };
  },
  /** Cambia pista, veicolo, bot, regole, camera, pilota automatico; `vai` = salta il conto alla rovescia; `pausa` = ferma la gara. */
  set: (o: { pista?: string; veicolo?: string; aspetto?: string; animali?: boolean; bot?: boolean; cam?: Camera; auto?: boolean; luce?: StyleId; vai?: boolean; regole?: Record<string, boolean>; effetti?: boolean; pausa?: boolean }) => {
    const nuovaPista = o.pista !== undefined && o.pista !== opz['pista'];
    if (o.pista !== undefined) { opz['pista'] = o.pista; if (nuovaPista) opz['veicolo'] = ''; }
    if (o.veicolo !== undefined) opz['veicolo'] = o.veicolo;
    if (o.aspetto !== undefined) aspetto = o.aspetto;
    if (o.animali !== undefined) animali = o.animali;
    if (o.bot !== undefined) opz['bot'] = o.bot ? '1' : '0';
    if (o.regole) for (const [id, on] of Object.entries(o.regole)) opz[id] = on ? '1' : '0';
    if (o.cam) cam = o.cam;
    if (o.auto !== undefined) auto = o.auto;
    if (o.effetti !== undefined) effetti = o.effetti;
    if (o.pausa !== undefined) pausa = o.pausa; // la gara si ferma, la resa e gli effetti no (per le foto dei test)
    if (o.luce) setLuce(o.luce);
    if (o.pista !== undefined || o.veicolo !== undefined || o.aspetto !== undefined || o.animali !== undefined || o.bot !== undefined || o.regole) nuovaGara(nuovaPista);
    if (o.vai && s.tick < 0) s.tick = 0;
    regia.st.ok = false; scrivi();
    return api.state();
  },
  /** Avanza la gara di `tick` passi subito (pilota automatico), senza aspettare il tempo vero. */
  avanti: (tick: number) => { const a = auto; auto = true; for (let i = 0; i < tick && fase === 'gara'; i++) step(); auto = a; regia.st.ok = false; return api.state(); },
  piste: PISTE,
};
(window as unknown as { __provapiste: typeof api }).__provapiste = api;
requestAnimationFrame(() => requestAnimationFrame(() => { api.ready = true; }));
console.log(`[provapiste] ${PISTE.length} piste: ${PISTE.join(', ')}`);
