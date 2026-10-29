// Segnaposto dell'ingresso del Santuario del Capo Ardente (Isola Vulcano), finché manca prop_ingresso_ceneri.
// Sta in un file a parte e si scarica solo quando serve: il bundle iniziale è al limite (TECH §5).
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r: number, h: number, n = 8) => new THREE.CylinderGeometry(r, r, h, n);

export function santuario(): THREE.Object3D {
  const parts: THREE.BufferGeometry[] = [
    painted(box(3.8, 0.28, 3.0), PAL.neroCaldo, M(0, 0.14, 0.2)),
    painted(box(3.2, 2.4, 2.3), PAL.pietraScura, M(0, 1.34, 0.3)),
    painted(cil(0.34, 2.6, 6), PAL.neroCaldo, M(-1.25, 1.44, -0.75)),
    painted(cil(0.34, 2.6, 6), PAL.neroCaldo, M(1.25, 1.44, -0.75)),
    painted(box(0.56, 0.22, 0.56), PAL.giallo, M(-1.25, 2.83, -0.75)),
    painted(box(0.56, 0.22, 0.56), PAL.giallo, M(1.25, 2.83, -0.75)),
    painted(box(3.1, 0.42, 0.62), PAL.neroCaldo, M(0, 2.75, -0.75)),
    painted(box(1.5, 2.1, 0.28), PAL.abisso, M(0, 1.19, -0.72)),
    painted(cil(0.42, 0.4, 6), PAL.neroCaldo, M(0, 3.15, -0.75)),
  ];
  const g = new THREE.Group(); g.name = 'ingresso_ceneri';
  g.add(new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  g.add(new THREE.Mesh(merged([
    painted(box(2.6, 0.16, 0.08), PAL.arancio, M(0, 2.75, -1.07)),
    painted(new THREE.ConeGeometry(0.28, 0.6, 5), PAL.arancio, M(0, 3.62, -0.75)),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.85 })));
  return g;
}
