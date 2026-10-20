// I posti barca del molo (sim/world/ormeggi.ts): tra un posto e l'altro un pontile a dito di tavole con due pali, il palo in fondo più
// alto, e una bitta di ferro sul bordo del molo dietro ogni poppa. Tutto fuso in un pezzo solo: una draw call.
import * as THREE from 'three';
import type { PostiMolo } from '@marea/sim';
import { ISLAND, M, P, merged, painted } from './island_parts.ts';

export function creaPostiMolo(molo: PostiMolo): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'molo_posti';
  const p: THREE.BufferGeometry[] = [], top = ISLAND.TOP - 0.06;
  for (const d of molo.dita) {
    const fx = Math.sin(d.yaw), fz = -Math.cos(d.yaw), at = (l: number) => [d.x + fx * l, d.z + fz * l] as const;
    const [cx, cz] = at(d.lungo / 2);
    p.push(painted(new THREE.BoxGeometry(0.5, 0.09, d.lungo), P.legnoChiaro, M(cx, top - 0.045, cz, 0, -d.yaw, 0)));
    for (const s of [-0.21, 0.21]) { const [ex, ez] = at(d.lungo / 2); p.push(painted(new THREE.BoxGeometry(0.06, 0.1, d.lungo), P.legno, M(ex + Math.cos(d.yaw) * s, top - 0.13, ez + Math.sin(d.yaw) * s, 0, -d.yaw, 0))); }
    const [mx, mz] = at(d.lungo * 0.45), [tx, tz] = at(d.lungo - 0.05);
    p.push(painted(new THREE.CylinderGeometry(0.08, 0.09, 1.2, 6), P.legnoScuro, M(mx, top - 0.65, mz)));
    p.push(painted(new THREE.CylinderGeometry(0.1, 0.11, 1.75, 6), P.legnoScuro, M(tx, top - 0.18, tz)));
    p.push(painted(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 6), P.legno, M(tx, top + 0.72, tz)));
  }
  for (const b of molo.posti) {
    p.push(painted(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 6), P.pietraScura, M(b.bitta.x, ISLAND.TOP + 0.1, b.bitta.z)));
    p.push(painted(new THREE.CylinderGeometry(0.13, 0.12, 0.05, 6), P.pietraScura, M(b.bitta.x, ISLAND.TOP + 0.22, b.bitta.z)));
  }
  if (!p.length) return g;
  const mesh = new THREE.Mesh(merged(p), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}
