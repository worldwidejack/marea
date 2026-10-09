// L'onda gigante della Fuga (inseguitore, docs/CORSE.md A11): un muro d'acqua a facce piatte che avanza lungo la pista.
// Una geometria sola, con colori per vertice (blu profondo alla base, turchese, schiuma bianca sulla cresta che si piega in avanti).
// Il profilo è in coordinate (avanti, su): dietro sale piano, davanti la cresta sporge e scende ripida. Muso verso −Z come i veicoli.
import * as THREE from 'three';
import { P } from '../render/island_parts.ts';

/** (avanti m, su m, colore della fascia che parte da qui) del profilo: dietro sale a fasce (blu, turchese, righe di schiuma), la cresta
 *  si piega in avanti e davanti scende ripida. */
const PROFILO: [number, number, string][] = [
  [-26, 0, P.acquaProfonda], [-21, 3.5, P.acqua], [-17, 6, P.pietraChiara], [-15, 7.5, P.acquaProfonda], [-10, 12, P.acqua],
  [-7, 14, P.pietraChiara], [-5, 15, P.acquaBassa], [-1, 18, P.acquaBassa], [3, 20, P.pietraChiara], [7, 18, P.pietraChiara],
  [6, 13, P.acquaBassa], [3.5, 7, P.acqua], [5, 0, P.pietraChiara],
];
/** Colori vivi, senza luce: l'onda deve restare azzurra e bianca anche nella foschia. */
export const matOnda = () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

/** `larghezza` = metà della larghezza (m): copre la carreggiata e un po' di bordo. */
export function ondaGeo(larghezza: number): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color();
  const passi = Math.max(6, Math.round((larghezza * 2) / 4));
  // ogni striscia laterale ha un po' di sfalsamento (sin) così il bordo della cresta è frastagliato
  const dz = (i: number) => Math.sin(i * 2.1) * 1.4 + Math.sin(i * 0.7) * 1.1, dy = (i: number) => Math.sin(i * 1.3 + 0.5) * 1.6;
  const v = (i: number, k: number): [number, number, number] => {
    const x = -larghezza + (2 * larghezza * i) / passi, [f, y] = PROFILO[k]!;
    const oscilla = k >= 3 ? 1 : k === 0 || k === PROFILO.length - 1 ? 0 : 0.5;
    return [x, y + dy(i) * oscilla, -(f + dz(i) * oscilla)];
  };
  for (let i = 0; i < passi; i++) for (let k = 0; k + 1 < PROFILO.length; k++) {
    const a = v(i, k), b = v(i + 1, k), cc = v(i, k + 1), d = v(i + 1, k + 1);
    pos.push(...a, ...b, ...cc, ...b, ...d, ...cc);
    for (const q of [PROFILO[k]![2], PROFILO[k]![2], PROFILO[k + 1]![2], PROFILO[k]![2], PROFILO[k + 1]![2], PROFILO[k + 1]![2]]) { c.set(q); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
