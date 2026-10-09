// Vista della scenografia (solo in sviluppo, `provascena.html`): la pista vestita vista da una camera libera, per le foto A/B
// della scenografia senza guidare. Parametri: ?pista=…&yaw=gradi&pitch=gradi&dist=m&s=m (punto della pista inquadrato)&lat=m&fov=gradi&centro=1 (inquadra tutta la pista)&nebbia=1.
// `window.__vista = { ready, set({ yaw, pitch, dist, s, lat, fov, pista }) }`: ready diventa true quando i pezzi del kit sono montati.
import * as THREE from 'three';
import { punto } from '@marea/sim/corse/nastro.ts';
import { pistaCorse } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { createLights } from '../../render/light.ts';
import { createPost } from '../../render/post.ts';
import { P } from '../../render/island_parts.ts';
import { STYLES } from '../../provapixel/styles.ts';
import { creaPista3d } from '../nastro3d.ts';
import type { Pista3d } from '../nastro3d.ts';

const q = new URLSearchParams(location.search);
const v = { pista: q.get('pista') ?? 'spiaggia_lungomare', yaw: +(q.get('yaw') ?? 200), pitch: +(q.get('pitch') ?? 35), dist: +(q.get('dist') ?? 120),
  s: +(q.get('s') ?? 40), lat: +(q.get('lat') ?? 0), fov: +(q.get('fov') ?? 45), centro: q.get('centro') === '1' };
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, stencil: false });
gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
canvas.style.imageRendering = 'pixelated';
const scene = new THREE.Scene(); scene.background = new THREE.Color(P.acquaBassa);
const post = createPost(); post.setStyle(STYLES.find((x) => x.id === 'giorno')!);
post.toggles.foschia = q.get('nebbia') === '1'; // dall'alto la foschia del gioco copre tutto
const camera = new THREE.PerspectiveCamera(v.fov, 1, 0.5, 1500);
const lights = createLights(); scene.add(lights.group);
const mare = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: P.acqua, flatShading: true }));
mare.rotation.x = -Math.PI / 2; mare.position.y = -1.2; mare.receiveShadow = true; scene.add(mare);
let p: Pista, p3d: Pista3d | null = null;
const api = { ready: false, set(o: Partial<typeof v>) { const nuova = o.pista && o.pista !== v.pista; Object.assign(v, o); if (nuova) carica(); } };
(window as unknown as { __vista: typeof api }).__vista = api;
function carica() {
  if (p3d) scene.remove(p3d.group);
  api.ready = false; p = pistaCorse(v.pista); p3d = creaPista3d(p); scene.add(p3d.group);
  void (p3d.scena ?? Promise.resolve()).then(() => requestAnimationFrame(() => requestAnimationFrame(() => { api.ready = true; })));
}
carica();
function resize() {
  const w = Math.round(innerWidth * 0.5), h = Math.round(innerHeight * 0.5);
  gl.setSize(w, h, false); post.setSize(w, h); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const o: [number, number, number] = [0, 0, 0];
function frame(t: number) {
  punto(p.n, v.s, v.lat, 0, o);
  if (v.centro && p3d) { const b = p3d.bounds; o[0] = (b.x0 + b.x1) / 2; o[1] = 0; o[2] = (b.z0 + b.z1) / 2; } // tutta la pista
  const y = (v.yaw * Math.PI) / 180, pi = (v.pitch * Math.PI) / 180;
  camera.fov = v.fov; camera.updateProjectionMatrix();
  camera.position.set(o[0] + Math.sin(y) * Math.cos(pi) * v.dist, o[1] + Math.sin(pi) * v.dist, o[2] + Math.cos(y) * Math.cos(pi) * v.dist);
  camera.lookAt(o[0], o[1], o[2]);
  lights.follow?.(o[0], o[2]);
  post.render(gl, scene, camera, t / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
