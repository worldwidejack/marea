// Prova 3D dipinto (issue #38): pagina separata, non tocca il gioco. Mondo, giocatore, barca, camera. Niente server né sistemi di gioco.
// Test: window.__prova.perf() (draw call, triangoli, fps), .state(), .goto(x, z), .boat().
import * as THREE from 'three';
import { paintedMaterial } from './paint.ts';
import { SKY, createGlows, createLights, createSea, createSky } from './look.ts';
import { AI_ISLAND, buildWorld } from './world.ts';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCamera, createInput, createPlayer } from './player.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('gl') as HTMLCanvasElement, ui = document.getElementById('ui') as HTMLElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const dprMax = Number(q.get('dpr')) || (matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
renderer.setPixelRatio(Math.min(devicePixelRatio, dprMax));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(q.get('exp')) || 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(SKY.fog, 45, 320);
const t0 = performance.now();
const AI = q.has('ai');
const world = buildWorld({ ai: AI });
const buildMs = performance.now() - t0;
scene.add(world.group);
const sky = createSky(); scene.add(sky);
const sea = createSea(world.df); scene.add(sea);
const glows = createGlows(world.glows); scene.add(glows);
const lights = createLights(scene);
const input = createInput(canvas, ui);
const player = createPlayer(scene, world, paintedMaterial(), input);
const view = createCamera(canvas);

// ---------- ?ai=1: modelli generati con l'AI (SAM 3 dalla reference) accanto a quelli fatti da codice ----------
/** Carica un glb e gli dà luce e nebbia della scena (Lambert con la sua texture dipinta). */
async function loadAi(url: string): Promise<THREE.Object3D> {
  const g = await new GLTFLoader().loadAsync(url);
  g.scene.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    // la texture AI ha già luce e ombra dipinte: metà luce di scena, metà propria (emissiva), entrambe le facce
    m.material = new THREE.MeshLambertMaterial({ map: src.map, emissiveMap: src.map, emissive: new THREE.Color(0.45, 0.42, 0.4), side: THREE.DoubleSide });
    m.castShadow = true; m.receiveShadow = true;
  });
  return g.scene;
}
const aiReady = AI ? Promise.all([loadAi('/prova3d/ai_barca.glb'), loadAi('/prova3d/ai_isola.glb')]).then(([b, isl]) => {
  // la barca AI prende il posto di quella da codice (prua lungo +X come lo scafo da codice)
  const holder = new THREE.Group(); b.rotation.y = -Math.PI / 2; b.position.y = -0.55; holder.add(b);
  player.setBoatModel(holder);
  isl.position.set(AI_ISLAND.x, -4, AI_ISLAND.z); scene.add(isl);
}) : Promise.resolve();

// ---------- HUD minimo: bottone d'azione e nomi delle isole ----------
const btn = document.createElement('button');
btn.style.cssText = 'position:absolute;right:max(18px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));padding:14px 20px;font:600 17px/1 Georgia,serif;color:#3a2414;background:linear-gradient(#f6e6c6,#e3c48e);border:2px solid #7a4d27;border-radius:14px;box-shadow:0 3px 0 #5a361b,0 6px 14px rgba(0,0,0,.3);display:none';
btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.pressAction(); });
ui.appendChild(btn);
const labels = [{ name: 'Maru', x: 68, y: 12, z: -44 }, { name: 'Solara', x: 20, y: 17, z: -84 }].map((l) => {
  const el = document.createElement('div');
  el.textContent = l.name;
  el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);font:600 15px/1 Georgia,serif;color:#fff4dc;text-shadow:0 1px 2px #3a2010,0 0 6px rgba(60,30,10,.6);pointer-events:none;white-space:nowrap';
  ui.appendChild(el);
  return { ...l, el };
});
const tmp = new THREE.Vector3();
function hud() {
  const n = player.near();
  btn.style.display = n ? 'block' : 'none';
  if (n) btn.textContent = n.act === 'salpa' ? '⛵ Salpa  (E)' : `⚓ Sbarca a ${n.m.name}  (E)`;
  for (const l of labels) {
    tmp.set(l.x, l.y, l.z).project(view.cam);
    const d = Math.hypot(view.cam.position.x - l.x, view.cam.position.z - l.z), vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && d > 25;
    l.el.style.display = vis ? 'block' : 'none';
    if (vis) { l.el.style.left = ((tmp.x + 1) / 2) * canvas.clientWidth + 'px'; l.el.style.top = ((1 - tmp.y) / 2) * canvas.clientHeight + 'px'; }
  }
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); view.frame();
  (glows.material as THREE.ShaderMaterial).uniforms['uScale']!.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((view.cam.fov * Math.PI) / 360));
}
addEventListener('resize', resize); resize();

// ---------- numeri a schermo con ?perf (per provarla dal telefono) ----------
const perfEl = q.has('perf') ? Object.assign(document.createElement('div'), { style: 'position:absolute;left:8px;top:max(8px,env(safe-area-inset-top));font:12px/1.3 ui-monospace,Menlo,monospace;color:#fff;background:rgba(40,20,10,.6);padding:4px 6px;border-radius:6px;white-space:pre;pointer-events:none' }) : null;
if (perfEl) ui.appendChild(perfEl);

// ---------- ciclo ----------
const perf = { fps: 0, frames: 0, acc: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0 };
let last = performance.now(), time = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  player.update(dt, time, view.yaw);
  const p = player.pos;
  view.update(p, dt, input.zoom, player.st.mode === 'boat');
  lights.follow(p.x, p.z);
  sky.position.copy(view.cam.position);
  (sky.material as THREE.ShaderMaterial).uniforms['uTime']!.value = time;
  (sea.material as THREE.ShaderMaterial).uniforms['uTime']!.value = time;
  (glows.material as THREE.ShaderMaterial).uniforms['uTime']!.value = time;
  world.update(time);
  renderer.info.reset();
  renderer.render(scene, view.cam);
  perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles;
  perf.maxCalls = Math.max(perf.maxCalls, perf.calls); perf.maxTris = Math.max(perf.maxTris, perf.tris);
  perf.frames++; perf.acc += dt; if (perf.acc >= 1) { perf.fps = perf.frames / perf.acc; perf.frames = 0; perf.acc = 0; }
  hud();
  if (perfEl && perf.frames === 0) perfEl.textContent = `${perf.fps.toFixed(0)} fps · ${perf.calls} draw · ${(perf.tris / 1000).toFixed(0)}k tri · dpr ${renderer.getPixelRatio()}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const api = {
  ready: true, buildMs, aiReady: false,
  perf: () => ({ fps: +perf.fps.toFixed(1), calls: perf.calls, tris: perf.tris, maxCalls: perf.maxCalls, maxTris: perf.maxTris, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, dpr: renderer.getPixelRatio() }),
  state: () => ({ ...player.st, boat: { ...player.st.boat, moored: player.st.boat.moored?.name ?? null } }),
  goto(x: number, z: number, ry?: number) { player.st.x = x; player.st.z = z; player.st.y = world.groundAt(x, z) ?? player.st.y; if (ry !== undefined) player.st.ry = ry; },
  boat(x: number, z: number, ry = 0) { player.st.mode = 'boat'; player.st.boat.moored = null; player.st.boat.x = x; player.st.boat.z = z; player.st.boat.ry = ry; },
  action: () => input.pressAction(),
  moorings: () => world.moorings,
  chunks: () => world.group.children.map((m) => { const g = (m as THREE.Mesh).geometry; return [m.name, g.index ? g.index.count / 3 : g.getAttribute('position').count / 3]; }),
};

(window as unknown as { __prova: unknown }).__prova = api;
void aiReady.then(() => { api.aiReady = true; });
