// Vista dell'hub delle Corse (solo in sviluppo, `provahubvista.html`): il mondo da una camera libera, per le foto e per misurare
// il budget senza guidare. Parametri in URL (e in `window.__vista.set`):
//   ?x&z (punto inquadrato, m) &yaw (gradi: da dove guarda la camera, 0 = da sud) &pitch (gradi) &dist (m) &fov (gradi)
//   &nebbia=0 → senza nebbia (per le viste dall'alto di tutta l'isola)
//   &veicolo=1 → camera da gara: come dietro a un veicolo in (x, z) che va verso `yaw` (0 = nord), 6 m dietro e 2,5 m sopra.
// `window.__vista = { ready, set(o), numeri() }`: ready = kit montato; numeri() = draw call e triangoli dell'ultimo frame.
import * as THREE from 'three';
import { creaHub } from './mappa.ts';
import { NEBBIA } from './mondo_cielo.ts';

const q = new URLSearchParams(location.search);
const n = (k: string, d: number) => (q.has(k) ? +q.get(k)! : d);
const v = { x: n('x', 0), z: n('z', 20), yaw: n('yaw', 0), pitch: n('pitch', 50), dist: n('dist', 520), fov: n('fov', 45), veicolo: q.get('veicolo') === '1', nebbia: n('nebbia', 1) };
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, stencil: false, powerPreference: 'high-performance' });
gl.setPixelRatio(1); gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.BasicShadowMap;
gl.info.autoReset = false;
canvas.style.imageRendering = 'pixelated';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(v.fov, 1, 0.3, 900);
const hub = creaHub(); scene.add(hub.gruppo);
const atm = hub.atmosfera(scene);
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;left:6px;top:6px;font:bold 12px ui-monospace,Menlo,monospace;color:#F4E3C1;background:rgba(46,30,20,.85);padding:3px 6px;pointer-events:none';
document.getElementById('ui')!.appendChild(hud);
let ultimi = { drawCalls: 0, triangoli: 0 };
const api = {
  ready: false,
  set(o: Partial<typeof v>) { Object.assign(v, o); },
  numeri: () => ultimi,
  hub,
  /** Mesh per mesh: cosa c'è in inquadratura (nome, triangoli, distanza dalla camera). */
  diag() {
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)), out: [string, number, number][] = [];
    hub.gruppo.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || !m.visible || !m.geometry.attributes.position) return;
      const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      const sf = g.boundingSphere!.clone().applyMatrix4(m.matrixWorld);
      if (m.frustumCulled && !f.intersectsSphere(sf)) return;
      out.push([m.name, Math.round((g.index ? g.index.count : g.attributes.position!.count) / 3 * ((m as THREE.InstancedMesh).count ?? 1)), Math.round(sf.center.distanceTo(camera.position))]);
    });
    return out.sort((a, b) => b[1] - a[1]);
  },
};
(window as unknown as { __vista: typeof api }).__vista = api;
void hub.pronta.then(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => { api.ready = true; }))));

function resize() {
  const k = Math.min(1.5, devicePixelRatio || 1) * 0.5, w = Math.max(1, Math.round(innerWidth * k)), h = Math.max(1, Math.round(innerHeight * k));
  gl.setSize(w, h, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const t0 = performance.now();
function frame() {
  camera.fov = v.fov; camera.updateProjectionMatrix();
  const y = (v.yaw * Math.PI) / 180;
  if (v.veicolo) {
    // il veicolo in (x, z) va verso yaw (0 = nord, −Z); la camera 6 m dietro e 2,5 m sopra, guarda 10 m avanti
    const fx = Math.sin(y), fz = -Math.cos(y), h = hub.quota(v.x, v.z);
    camera.position.set(v.x - fx * 6, h + 2.5, v.z - fz * 6);
    camera.lookAt(v.x + fx * 10, h + 1.0, v.z + fz * 10);
    atm.segui(v.x, v.z);
  } else {
    const pi = (v.pitch * Math.PI) / 180, h = hub.quota(v.x, v.z);
    camera.position.set(v.x + Math.sin(y) * Math.cos(pi) * v.dist, h + Math.sin(pi) * v.dist, v.z + Math.cos(y) * Math.cos(pi) * v.dist);
    camera.lookAt(v.x, h, v.z);
    atm.segui(v.x, v.z);
  }
  hub.aggiorna((performance.now() - t0) / 1000, camera);
  if (!v.nebbia) { camera.far = 3000; camera.updateProjectionMatrix(); (scene.fog as THREE.Fog).far = 1e5; (scene.fog as THREE.Fog).near = 1e5 - 1; hub.gruppo.traverse((o) => { if (/^hub_(terra|pezzi)_/.test(o.name)) o.visible = true; if (/^hub_lontano_/.test(o.name)) o.visible = false; }); }
  else { camera.far = 900; camera.updateProjectionMatrix(); (scene.fog as THREE.Fog).far = NEBBIA.lontano; (scene.fog as THREE.Fog).near = NEBBIA.vicino; }
  gl.info.reset();
  gl.render(scene, camera);
  ultimi = { drawCalls: gl.info.render.calls, triangoli: gl.info.render.triangles };
  hud.textContent = `${ultimi.drawCalls} draw call · ${ultimi.triangoli} triangoli${api.ready ? '' : ' · kit…'}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
