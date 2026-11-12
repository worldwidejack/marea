// Segnaposto dell'ingresso della Tana del Maggiolone (isola della Difesa), finché manca prop_ingresso_orto: un vaso di terracotta enorme
// rovesciato a est dell'orto (da lì arrivano gli insetti), con la tana scavata sotto (la bocca, verso −Z), il mucchio di terra, il
// cartello «ONDATE» e una lumaca di guardia in cima. Sta in un file a parte e si scarica solo quando serve: il bundle iniziale è al limite.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);

export function vasoRovesciato(): THREE.Object3D {
  const parts: THREE.BufferGeometry[] = [
    painted(cil(1.15, 1.6, 2.3), PAL.arancio, M(0, 1.15, 0.35)), // il vaso a testa in giù
    painted(cil(1.72, 1.72, 0.32, 10), PAL.legnoChiaro, M(0, 0.16, 0.35)), // l'orlo, ora a terra
    painted(cil(1.18, 1.18, 0.1, 10), PAL.legnoChiaro, M(0, 2.25, 0.35)),
    painted(cil(0.28, 0.28, 0.06, 8), PAL.neroCaldo, M(0, 2.31, 0.35)), // il buco di scolo
    painted(box(0.5, 0.9, 0.08), PAL.legnoChiaro, M(0.9, 1.1, -0.92, 0, -0.5, 0.2)), // una crepa riparata
    painted(box(1.5, 1.7, 0.6), PAL.neroCaldo, M(0, 0.85, -1.15)), // la tana scavata sotto
    painted(box(1.9, 0.5, 0.7), PAL.legnoScuro, M(0, 0.2, -1.65)), // il mucchio di terra davanti
    painted(ico(0.45, 0), PAL.legnoScuro, M(-1.0, 0.25, -1.5)), painted(ico(0.35, 0), PAL.legno, M(1.05, 0.2, -1.55)),
    painted(box(0.08, 1.2, 0.08), PAL.legnoScuro, M(1.55, 0.6, -1.7)), // il cartello «ONDATE →»
    painted(box(0.9, 0.36, 0.06), PAL.sabbiaChiara, M(1.55, 1.15, -1.72, 0, 0, -0.08)),
    painted(box(0.5, 0.06, 0.02), PAL.rosso, M(1.5, 1.15, -1.76, 0, 0, -0.08)),
    painted(new THREE.ConeGeometry(0.1, 0.16, 3), PAL.rosso, M(1.82, 1.13, -1.76, 0, 0, -Math.PI / 2 - 0.08)),
    // la lumaca di guardia in cima, col guscio viola
    painted(box(0.3, 0.14, 0.7), PAL.pietraChiara, M(0, 2.37, 0.3)),
    painted(ico(0.26, 1), PAL.viola, M(0, 2.58, 0.42)),
    painted(cil(0.02, 0.02, 0.25, 4), PAL.pietraChiara, M(-0.06, 2.55, -0.02, -0.3, 0, 0.2)), painted(cil(0.02, 0.02, 0.25, 4), PAL.pietraChiara, M(0.06, 2.55, -0.02, -0.3, 0, -0.2)),
  ];
  const g = new THREE.Group(); g.name = 'ingresso_orto';
  g.add(new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  // due lucciole che fanno da lanterna alla bocca della tana
  g.add(new THREE.Mesh(merged([painted(ico(0.08), PAL.giallo, M(-0.95, 1.55, -1.45)), painted(ico(0.08), PAL.giallo, M(0.85, 1.75, -1.4))]),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.giallo, emissiveIntensity: 0.9 })));
  return g;
}
