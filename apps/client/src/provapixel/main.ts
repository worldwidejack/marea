// Prova «pixel art più 3D» (issue #46) e stili (#50): pagina a parte, il gioco non cambia. Tre isole vere dell'arcipelago (Porto +
// due lotti vicini) con i pezzi del gioco (isole, luci, avatar, barca, input) e sopra: stile (S: acqua, scogli, fiori, luce, cielo,
// palette), camera più bassa, contorni, luce a gradini, foschia, vento, camera agganciata ai pixel. Tasti S, 1-6, C, P, 0.
// Test: window.__provapixel.perf() / .state() / .goto(x, z) / .boat(x, z, yaw) / .set({...}).
import * as THREE from 'three';
import { canBoard, composeArchipelago, DT, gridFromRows, landingSpot, NO_INPUT } from '@marea/sim';
import type { InputFrame } from '@marea/sim';
import { ARCHIPELAGO, ISLANDS } from '@marea/content';
import type { Look } from '@marea/protocol';
import { FLAGS } from '../flags.ts';
import { createDioramaCamera } from '../render/camera.ts';
import { createLights } from '../render/light.ts';
import { createWater } from '../render/water.ts';
import { createIsland } from '../render/island.ts';
import { createLoader } from '../render/loader.ts';
import { createAvatar } from '../game/avatar.ts';
import { createBoat } from '../game/boat.ts';
import { createInput } from '../game/input.ts';
import { createPost } from './post.ts';
import { addWind, farIslands, setCel, setWind } from './look.ts';
import { STYLES } from './styles.ts';
import type { StyleId } from './styles.ts';
import { createWater2 } from './water2.ts';
import { createDecor } from './decor.ts';

// ---------- le viste da confrontare ----------
const CAMS = [
  { nome: '45° (gioco)', pitch: 45, fov: 30, dist: 28 },
  { nome: '35°', pitch: 35, fov: 32, dist: 26 },
  { nome: '30°', pitch: 30, fov: 34, dist: 24 },
  { nome: '22°', pitch: 22, fov: 38, dist: 22 },
  { nome: '15°', pitch: 15, fov: 42, dist: 19 },
] as const;
const PIXELS = ['gioco', '360', '270'] as const; // gioco = metà risoluzione come oggi; 360/270 = righe di pixel fisse (più grossi)
type Pix = (typeof PIXELS)[number];
type Toggles = { stile: StyleId; contorni: boolean; luce: boolean; foschia: boolean; cielo: boolean; vento: boolean; aggancio: boolean; cam: number; px: Pix };
// 7/10 Jack: «per ora vince pixel gioco» (metà risoluzione) → di partenza; la camera bassa gli piace
const ALL_ON: Toggles = { stile: 'giorno', contorni: true, luce: true, foschia: true, cielo: true, vento: true, aggancio: true, cam: 3, px: 'gioco' };
const GAME: Toggles = { stile: 'gioco', contorni: false, luce: false, foschia: false, cielo: false, vento: false, aggancio: false, cam: 0, px: 'gioco' };

const q = new URLSearchParams(location.search);
const tg: Toggles = { ...(q.has('gioco') ? GAME : ALL_ON) };
for (const k of (q.get('off') ?? '').split(',')) if (k in tg && typeof tg[k as keyof Toggles] === 'boolean') (tg as Record<string, unknown>)[k] = false;
if (q.has('cam')) tg.cam = Math.max(0, Math.min(CAMS.length - 1, Number(q.get('cam')) || 0));
if (PIXELS.includes(q.get('px') as Pix)) tg.px = q.get('px') as Pix;
if (STYLES.some((st) => st.id === q.get('stile'))) tg.stile = q.get('stile') as StyleId;
const styleOf = (id: StyleId) => STYLES.find((st) => st.id === id)!;

const canvas = document.getElementById('gl') as HTMLCanvasElement, root = document.getElementById('ui') as HTMLElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
canvas.style.imageRendering = 'pixelated';
const scene = new THREE.Scene();
const post = createPost();
const view = createDioramaCamera({ aspect: 1, canvas, far: 900 });

// ---------- il mondo: solo Porto + lotto 1 (a nord) + lotto 3 (a ovest); il resto del mare è mare aperto ----------
const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
const pick = arch.places.filter((p) => p.island === 'porto' || (p.island === 'lotto' && (p.slot === 1 || p.slot === 3)));
const inPick = (cx: number, cz: number) => pick.some((p) => cx >= p.origin[0] && cz >= p.origin[1] && cx < p.origin[0] + p.w && cz < p.origin[1] + p.h);
const full = arch.map, T = full.tile;
const rows = full.rows.map((r, cz) => [...r].map((ch, cx) => (inPick(cx, cz) ? ch : '~')).join(''));
const home = arch.spawnOf(null), dock = arch.boatOf(null);
const map = gridFromRows('provapixel', rows, T, { cx: Math.floor(home.x / T), cz: Math.floor(home.z / T) }, { cx: Math.floor(dock.x / T), cz: Math.floor(dock.z / T) });
const inside = (x: number, z: number) => inPick(Math.floor(x / T), Math.floor(z / T));

const LOOK: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };
const loader = await createLoader({ base: '/assets/' });
const lights = createLights(); scene.add(lights.group);
const water = createWater({ size: 0 }); scene.add(water.mesh);
const island = await createIsland({
  map, loader,
  areas: pick.map((p) => ({ id: p.island + (p.slot !== null ? '_' + p.slot : ''), x0: p.origin[0], z0: p.origin[1], w: p.w, h: p.h, style: p.style, scenery: p.scenery })),
  props: arch.props.filter((p) => inside(p.x, p.z)), buildings: arch.buildings.filter((b) => inside(b.x, b.z)), paved: arch.paved,
});
scene.add(island.group);
const far = farIslands(home.x, home.z); scene.add(far);
const avatar = await createAvatar({ loader, look: LOOK, x: home.x, z: home.z }); scene.add(avatar.object);
avatar.setGround(island.groundY);
const boat = await createBoat({ loader, x: dock.x, z: dock.z, look: LOOK }); scene.add(boat.object);
const moor = (x: number, z: number) => { boat.teleport(x, z); const d = landingSpot(boat.state, map); if (d) boat.setYaw(Math.atan2(boat.state.x - d.x, -(boat.state.z - d.z))); };
moor(dock.x, dock.z);
const water2 = createWater2(map); scene.add(water2.mesh);
const decor = createDecor({ map, groundY: island.groundY, avoid: [...(island.props ?? []), ...arch.buildings.filter((b) => inside(b.x, b.z))] });
scene.add(decor.group);
const plants = addWind(island.group) + addWind(decor.group);
const input = createInput({ canvas, root, cameraYaw: () => view.yaw });

// ---------- interruttori ----------
const toast = Object.assign(document.createElement('div'), { style: 'position:absolute;left:50%;top:18%;transform:translateX(-50%);font:bold 15px ui-monospace,Menlo,monospace;color:#F4E3C1;background:rgba(46,30,20,.75);padding:6px 10px;border-radius:4px;pointer-events:none;opacity:0;transition:opacity .3s' });
root.appendChild(toast);
let toastT = 0;
const say = (s: string) => { toast.textContent = s; toast.style.opacity = '1'; toastT = 2.2; };
const panel = document.createElement('div');
panel.style.cssText = 'position:absolute;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));display:flex;flex-wrap:wrap;gap:4px;max-width:min(92vw,560px);font:bold 12px ui-monospace,Menlo,monospace';
root.appendChild(panel);
// sul telefono il pannello parte chiuso: un bottone «stile» lo apre e lo chiude (da PC ci sono anche i tasti)
let open = innerWidth >= 700;
const fold = document.createElement('button');
fold.style.cssText = 'pointer-events:auto;border:2px solid #F2A33A;background:rgba(46,30,20,.82);color:#F5D547;padding:5px 7px;border-radius:4px;font:inherit;cursor:pointer;touch-action:manipulation';
fold.addEventListener('pointerdown', (e) => { e.stopPropagation(); open = !open; paintFold(); });
panel.appendChild(fold);
function paintFold() { fold.textContent = open ? 'stile ▴' : 'stile ▾'; for (const el of [...panel.children].slice(1)) (el as HTMLElement).style.display = open ? '' : 'none'; }
const ROWS: [string, string, () => string, () => void][] = [
  ['S', 'stile', () => styleOf(tg.stile).nome, () => { tg.stile = STYLES[(STYLES.findIndex((st) => st.id === tg.stile) + 1) % STYLES.length]!.id; }],
  ['0', 'come il gioco', () => (same(GAME) ? '●' : '○'), () => { Object.assign(tg, same(GAME) ? ALL_ON : GAME); }],
  ['1', 'contorni', () => (tg.contorni ? '●' : '○'), () => { tg.contorni = !tg.contorni; }],
  ['2', 'luce a gradini', () => (tg.luce ? '●' : '○'), () => { tg.luce = !tg.luce; }],
  ['3', 'foschia', () => (tg.foschia ? '●' : '○'), () => { tg.foschia = !tg.foschia; }],
  ['4', 'cielo', () => (tg.cielo ? '●' : '○'), () => { tg.cielo = !tg.cielo; }],
  ['5', 'vento', () => (tg.vento ? '●' : '○'), () => { tg.vento = !tg.vento; }],
  ['6', 'aggancio pixel', () => (tg.aggancio ? '●' : '○'), () => { tg.aggancio = !tg.aggancio; }],
  ['C', 'camera', () => CAMS[tg.cam]!.nome, () => { tg.cam = (tg.cam + 1) % CAMS.length; }],
  ['P', 'pixel', () => tg.px, () => { tg.px = PIXELS[(PIXELS.indexOf(tg.px) + 1) % PIXELS.length]!; }],
];
function same(t: Toggles) { return (Object.keys(t) as (keyof Toggles)[]).every((k) => t[k] === tg[k]); }
const btns = ROWS.map(([key, label, val, act]) => {
  const b = document.createElement('button');
  b.style.cssText = 'pointer-events:auto;border:2px solid #8E5A2B;background:rgba(46,30,20,.72);color:#F4E3C1;padding:5px 7px;border-radius:4px;font:inherit;cursor:pointer;touch-action:manipulation';
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); act(); apply(); say(`${label}: ${val()}`); });
  panel.appendChild(b);
  return () => { b.textContent = `${key} ${label} ${val()}`; };
});
paintFold();
addEventListener('keydown', (e) => {
  const r = ROWS.find(([k]) => k === e.key.toUpperCase());
  if (!r || e.metaKey || e.ctrlKey) return;
  r[3](); apply(); say(`${r[1]}: ${r[2]()}`);
});

let H = 1;
function resize() {
  const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
  const k = tg.px === 'gioco' ? Math.min(1.5, devicePixelRatio || 1) * (FLAGS.quality === 'low' ? 0.4 : 0.5) : Number(tg.px) / ch;
  const w = Math.max(1, Math.round(cw * k)); H = Math.max(1, Math.round(ch * k));
  gl.setSize(w, H, false); post.setSize(w, H);
  view.camera.aspect = cw / Math.max(1, ch); view.camera.updateProjectionMatrix();
}
// ---------- luce dello stile: colori e direzione del sole; il sole segue il giocatore a passi di un texel della shadow map ----------
const hemi = lights.group.children.find((c) => (c as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight;
const amb = lights.group.children.find((c) => (c as THREE.AmbientLight).isAmbientLight) as THREE.AmbientLight;
const sunDir = new THREE.Vector3(), lightRot = new THREE.Matrix4(), lightInv = new THREE.Matrix4(), sv = new THREE.Vector3();
function setLight(id: StyleId) {
  const L = styleOf(id).light, el = (L.elev * Math.PI) / 180, az = (L.azim * Math.PI) / 180;
  // azimut come in render/light.ts: 225° = da sud-ovest (−X, +Z)
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  lightRot.lookAt(sunDir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)); lightInv.copy(lightRot).invert();
  lights.sun.color.set(L.sun); lights.sun.intensity = L.sunI;
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemiI; amb.color.set(L.amb); amb.intensity = L.ambI;
}
function sunFollow(x: number, z: number) {
  const texel = 60 / 1024;
  sv.set(x, 0, z).applyMatrix4(lightInv);
  sv.x = Math.round(sv.x / texel) * texel; sv.y = Math.round(sv.y / texel) * texel;
  sv.applyMatrix4(lightRot);
  lights.sun.target.position.copy(sv); lights.sun.position.copy(sv).addScaledVector(sunDir, 60);
  lights.sun.target.updateMatrixWorld(); lights.sun.updateMatrixWorld();
}

let camWas = -1, styleWas: StyleId | null = null;
function apply() {
  if (tg.stile !== styleWas) {
    const st = styleOf(tg.stile);
    post.setStyle(st); setLight(st.id); decor.setStyle(st);
    water.mesh.visible = st.water.mode === 0; water2.mesh.visible = st.water.mode !== 0;
    water2.set(st.water.mode, st.water.c, st.water.foam, st.water.line, st.sky.sunDir);
    styleWas = tg.stile;
  }
  post.toggles.contorni = tg.contorni; post.toggles.foschia = tg.foschia; post.toggles.cielo = tg.cielo;
  setCel(scene, tg.luce);
  far.visible = tg.foschia; // senza foschia le sagome lontane sembrano panettoni: vanno insieme
  if (tg.cam !== camWas) { const c = CAMS[tg.cam]!; view.setView!((c.pitch * Math.PI) / 180, c.fov, c.dist); camWas = tg.cam; }
  resize();
  for (const r of btns) r();
}
addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
apply();

// ---------- a piedi e in barca: come game/world.ts, senza rete né sistemi di gioco ----------
let mode: 'walk' | 'boat' = 'walk', aWas = false;
function step(f: InputFrame) {
  const pressA = f.a && !aWas; aWas = f.a;
  if (mode === 'walk') {
    avatar.step(f, map); boat.step(NO_INPUT, map);
    if (pressA && canBoard(avatar.state, boat.state, map)) { mode = 'boat'; boat.setDriver(avatar.state, LOOK); avatar.visible = false; say('In barca: A accelera, joystick vira'); }
  } else {
    boat.step(f, map); avatar.teleport(boat.state.x, boat.state.z);
    if (pressA && boat.state.speed < 2) {
      const spot = landingSpot(boat.state, map);
      if (spot) { mode = 'walk'; boat.setDriver(null); avatar.visible = true; avatar.teleport(spot.x, spot.z); say('A terra'); } else say('Avvicinati a un molo per scendere');
    }
  }
}

// Camera agganciata alla griglia dei pixel: si sposta a passi di un pixel (sul piano del bersaglio), così i bordi non tremolano.
const right = new THREE.Vector3(), up = new THREE.Vector3();
function snapCamera() {
  const cam = view.camera, c = CAMS[tg.cam]!;
  const s = (2 * c.dist * view.zoom * Math.tan((cam.fov * Math.PI) / 360)) / H;
  right.set(1, 0, 0).applyQuaternion(cam.quaternion); up.set(0, 1, 0).applyQuaternion(cam.quaternion);
  const pr = cam.position.dot(right), pu = cam.position.dot(up);
  cam.position.addScaledVector(right, Math.round(pr / s) * s - pr).addScaledVector(up, Math.round(pu / s) * s - pu);
  cam.updateMatrixWorld();
}

// ---------- numeri e ciclo ----------
const perf = { fps: 0, frames: 0, acc: 0 };
let last = performance.now(), acc = 0, time = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; time += dt;
  let n = 0;
  while (acc >= DT && n < 5) { step(input.sample()); acc -= DT; n++; }
  if (n === 5) acc = 0;
  const alpha = acc / DT;
  avatar.update(alpha, dt); boat.update(alpha, dt, time); water.update(time);
  const f = mode === 'walk' ? avatar.object.position : boat.object.position;
  view.follow(f.x, 0.5, f.z); view.update(dt);
  if (tg.aggancio) snapCamera();
  sunFollow(f.x, f.z); water.follow(f.x, f.z); water2.follow(f.x, f.z); water2.update(time); far.position.set(f.x - home.x, 0, f.z - home.z);
  setWind(tg.vento, time);
  for (const c of scene.children) if (c !== lights.group) (c.userData.preRender as (() => void) | undefined)?.(); // il sole lo mette sunFollow
  post.render(gl, scene, view.camera, time);
  if (toastT > 0 && (toastT -= dt) <= 0) toast.style.opacity = '0';
  perf.frames++; perf.acc += dt;
  if (perf.acc >= 0.5) { perf.fps = perf.frames / perf.acc; perf.frames = 0; perf.acc = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const api = {
  ready: false,
  perf: () => ({ drawCalls: post.sceneCalls() + 1, triangles: post.sceneTris() + 2, fps: Math.round(perf.fps * 10) / 10, w: gl.domElement.width, h: gl.domElement.height, piante: plants, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries }),
  state: () => ({ mode, x: avatar.state.x, z: avatar.state.z, boat: { x: boat.state.x, z: boat.state.z }, toggles: { ...tg } }),
  goto: (x: number, z: number) => { if (mode === 'boat') { mode = 'walk'; boat.setDriver(null); avatar.visible = true; } avatar.teleport(x, z); view.follow(x, 0.5, z); view.snap!(); },
  boat: (x: number, z: number, yaw = 0) => { mode = 'boat'; boat.teleport(x, z); boat.setYaw(yaw); boat.setDriver(avatar.state, LOOK); avatar.visible = false; avatar.teleport(x, z); view.follow(x, 0.5, z); view.snap!(); },
  set: (t: Partial<Toggles> | 'gioco' | 'tutto') => { Object.assign(tg, t === 'gioco' ? GAME : t === 'tutto' ? ALL_ON : t); apply(); },
  home, dock,
};
(window as unknown as { __provapixel: typeof api }).__provapixel = api;
requestAnimationFrame(() => requestAnimationFrame(() => { api.ready = true; }));
console.log(`[provapixel] isole ${pick.map((p) => p.island + (p.slot ?? '')).join(', ')} · piante al vento ${plants}`);
