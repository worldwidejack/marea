// Segnaposto degli ingressi dei dungeon (game/ingressi.ts) quando manca il modello prop_ingresso_<stile> nel manifest: arco di pietra,
// e per l'Impianto di Drenaggio un casotto di lamiera (una draw call). Bundle iniziale: piccolo.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

/** Segnaposto se il modello manca: arco di pietra scura con la bocca nera (colori di palette). */
export function placeholder(stile?: string): THREE.Object3D {
  if (stile === 'drenaggio') return boccaporto();
  const g = new THREE.Group(), stone = new THREE.MeshLambertMaterial({ color: '#4A4340', flatShading: true }), dark = new THREE.MeshLambertMaterial({ color: '#23201F' });
  for (const sx of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 1.2), stone); p.position.set(sx, 1.3, 0); g.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.2), stone); top.position.y = 2.9; g.add(top);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.2), dark); hole.position.set(0, 1.25, -0.2); g.add(hole);
  return g;
}
/** Impianto di Drenaggio (Epopea della Regata 1), finché manca prop_ingresso_drenaggio: casotto di lamiera chiodata sull'anello della Laguna,
 *  portellone tondo d'ottone (la bocca, verso −Z), tubi che scendono nel terreno, valvola rossa e comignolo. */
function boccaporto(): THREE.Object3D {
  const cil = (r: number, h: number, n = 8) => new THREE.CylinderGeometry(r, r, h, n);
  const geo = merged([ // un solo pezzo a colori per vertice: una draw call sull'isola
    painted(new THREE.BoxGeometry(3.4, 2.7, 2), PAL.pietraScura, M(0, 1.35, 0.4)),
    painted(new THREE.BoxGeometry(3.7, 0.3, 2.3), PAL.roccia, M(0, 2.85, 0.4)),
    painted(new THREE.BoxGeometry(3.5, 0.18, 2.1), PAL.legno, M(0, 0.55, 0.4)), // fascia di ruggine
    painted(cil(1.05, 0.22, 10), PAL.arancio, M(0, 1.3, -0.62, Math.PI / 2)),
    painted(cil(0.82, 0.24, 10), PAL.neroCaldo, M(0, 1.3, -0.62, Math.PI / 2)),
    painted(cil(0.2, 3.1, 5), PAL.legno, M(-1.95, 1.55, -0.1)),
    painted(cil(0.2, 2.4, 5), PAL.legno, M(1.95, 1.2, -0.1)),
    painted(cil(0.28, 0.16, 6), PAL.arancio, M(-1.95, 2.3, -0.1)),
    painted(cil(0.38, 0.07, 8), PAL.rosso, M(1.95, 2.1, -0.38, Math.PI / 2)),
    painted(cil(0.17, 1, 5), PAL.neroCaldo, M(1.1, 3.45, 0.95)),
  ]);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.name = 'ingresso_drenaggio';
  return m;
}
