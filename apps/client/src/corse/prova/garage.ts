// Il garage delle Corse (#178): tutti i veicoli del kit in fila, ognuno col suo animale pilota, che girano piano su una piattaforma.
// Serve a guardarli da vicino (seduta, scala, colori) senza correre. ?solo=cs_v_pizza = uno solo grande; ?giro=0 = fermi (per le foto);
// ?angolo=gradi = da dove si guarda; ?animali=0 = col pilota segnaposto.
import * as THREE from 'three';
import { P } from '../../render/island_parts.ts';
import { veicoloGeo } from '../veicoli3d.ts';
import { ASPETTI, PILOTI, caricaKit } from '../veicoli_kit.ts';

const q = new URLSearchParams(location.search);
const solo = q.get('solo'), giro = q.get('giro') !== '0', animali = q.get('animali') !== '0', angolo = Number(q.get('angolo') ?? 150) * Math.PI / 180;
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const gl = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
gl.setPixelRatio(Math.min(2, devicePixelRatio || 1)); gl.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(P.acquaBassa);
scene.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 1.5));
const sole = new THREE.DirectionalLight(0xfff0d8, 2.2); sole.position.set(-6, 10, -4); scene.add(sole);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const asfalto = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshLambertMaterial({ color: P.pietraScura })); asfalto.rotation.x = -Math.PI / 2; scene.add(asfalto);

const modelli = solo ? [solo] : [...ASPETTI];
const giranti: THREE.Mesh[] = [];
const nome = document.getElementById('nome')!;
function resize() { gl.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

await caricaKit();
const cols = solo ? 1 : 5, passo = 4.6;
modelli.forEach((m, i) => {
  const a = animali ? PILOTI[i % PILOTI.length]! : null;
  const mesh = new THREE.Mesh(veicoloGeo('kart', P.rosso, P.pietraChiara, m, a), mat);
  mesh.position.set((i % cols - (cols - 1) / 2) * passo, 0, Math.floor(i / cols) * 5.4 - (solo ? 0 : 5.4));
  mesh.rotation.y = angolo; scene.add(mesh); if (giro) giranti.push(mesh);
});
nome.textContent = modelli.map((m, i) => m.replace('cs_v_', '') + (animali ? ' + ' + PILOTI[i % PILOTI.length]!.replace('cs_p_', '') : '')).join(' · ');
const dist = solo ? 8 : (cols * passo * 1.5) / (2 * Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
camera.position.set(0, solo ? 3.4 : dist * 0.42, solo ? 8 : dist * 0.62); camera.lookAt(0, solo ? 0.9 : 0, 0);
(window as unknown as { __garage: unknown }).__garage = { ready: true, modelli };
let t0 = performance.now();
function frame(now: number) {
  const dt = (now - t0) / 1000; t0 = now;
  for (const g of giranti) g.rotation.y += dt * 0.5;
  gl.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
