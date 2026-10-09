// Isola delle Corse (docs/CORSE.md) nell'arcipelago: decorazioni procedurali del circuito sull'isola (arco del via a scacchi, tribune,
// pile di gomme, kart parcheggiati, bandierine). La pista vera del Gran Premio è nel chunk apps/client/src/corse/. Solo colori della
// palette, facce piatte. Pivot a terra, −Z avanti. `kartGeo` serve anche al chunk (lo stesso kart sull'isola e in gara).
import * as THREE from 'three';
import { M, P, merged, painted } from './island_parts.ts';
import type { TemaProp } from './island_temi.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);

/** Scacchiera di cubetti bianchi e neri: `nx` × `ny` caselle da `q` m, centrata in (x, y, z), piatta su XY (ruotata di `ry`). */
export function scacchi(parts: THREE.BufferGeometry[], nx: number, ny: number, q: number, x: number, y: number, z: number, ry = 0, d = 0.12): void {
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const ox = (i - (nx - 1) / 2) * q, oy = (j - (ny - 1) / 2) * q;
    parts.push(painted(box(q, q, d), (i + j) % 2 ? P.neroCaldo : P.pietraChiara, M(x + Math.cos(ry) * ox, y + oy, z - Math.sin(ry) * ox, 0, ry, 0)));
  }
}

/** Il kart (un posto, muso verso −Z, ~1,6 × 2,4 m): telaio, scocca col colore, ruote nere, volante e roll-bar. Il pilota lo mette chi lo usa. */
export function kartGeo(colore: string, numero = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(painted(box(1.2, 0.18, 2.3), P.roccia, M(0, 0.28, 0))); // telaio
  parts.push(painted(box(1.0, 0.32, 0.9), colore, M(0, 0.5, -0.7))); // muso
  parts.push(painted(box(1.3, 0.14, 0.35), colore, M(0, 0.42, -1.2))); // paraurti davanti
  parts.push(painted(box(0.5, 0.42, 0.7), colore, M(0, 0.55, 0.55))); // schienale e motore
  parts.push(painted(box(1.5, 0.12, 0.3), colore, M(0, 0.95, 1.05))); // alettone
  for (const s of [-1, 1]) parts.push(painted(box(0.08, 0.4, 0.12), P.roccia, M(s * 0.6, 0.75, 1.05)));
  parts.push(painted(box(0.35, 0.08, 0.08), P.neroCaldo, M(0, 0.82, -0.3, 0.5, 0, 0))); // volante
  parts.push(painted(box(0.06, 0.32, 0.06), P.roccia, M(0, 0.66, -0.2, 0.5, 0, 0)));
  parts.push(painted(box(0.7, 0.05, 0.24), numero % 2 ? P.pietraChiara : P.giallo, M(0, 0.67, -0.95))); // targhetta col numero
  for (const [x, z, r] of [[-0.72, -0.8, 0.27], [0.72, -0.8, 0.27], [-0.75, 0.8, 0.33], [0.75, 0.8, 0.33]] as const) {
    parts.push(painted(cyl(r, r, 0.32, 8), P.neroCaldo, M(x, r, z, 0, 0, Math.PI / 2)));
    parts.push(painted(cyl(r * 0.45, r * 0.45, 0.34, 6), P.pietra, M(x, r, z, 0, 0, Math.PI / 2)));
  }
  return merged(parts);
}

/** Decorazioni dell'Isola delle Corse. */
export function propCorse(kind: TemaProp): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  switch (kind) {
    case 'arco_via': {
      // portale sopra la pista: due piloni a bande rosse e bianche, traversa a scacchi, semaforo
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) parts.push(painted(box(0.5, 0.9, 0.5), i % 2 ? P.pietraChiara : P.rosso, M(s * 3.2, 0.45 + i * 0.9, 0)));
        parts.push(painted(box(0.8, 0.3, 0.8), P.roccia, M(s * 3.2, 0.15, 0)));
      }
      parts.push(painted(box(7.0, 1.0, 0.4), P.roccia, M(0, 4.8, 0)));
      scacchi(parts, 12, 2, 0.5, 0, 4.8, -0.22);
      scacchi(parts, 12, 2, 0.5, 0, 4.8, 0.22);
      parts.push(painted(box(1.6, 0.5, 0.3), P.neroCaldo, M(0, 5.6, -0.1)));
      for (let i = 0; i < 3; i++) parts.push(painted(box(0.3, 0.3, 0.1), i === 2 ? P.erbaChiara : P.rosso, M(-0.5 + i * 0.5, 5.6, -0.3)));
      break;
    }
    case 'tribuna': {
      // gradinata di legno con la tettoia a strisce, pubblico a cubetti colorati
      for (let i = 0; i < 4; i++) parts.push(painted(box(7, 0.45, 0.9), i % 2 ? P.legno : P.legnoChiaro, M(0, 0.25 + i * 0.45, -1.2 + i * 0.9)));
      parts.push(painted(box(7, 1.9, 0.2), P.legnoScuro, M(0, 0.95, 2.3)));
      const pubblico = [P.rosso, P.giallo, P.acquaBassa, P.viola, P.arancio, P.pietraChiara, P.erba];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3) % 4) {
        parts.push(painted(box(0.35, 0.5, 0.35), pubblico[(i * 5 + j * 2) % pubblico.length]!, M(-3.1 + j * 0.78, 0.75 + i * 0.45, -1.2 + i * 0.9)));
      }
      for (const s of [-1, 1]) parts.push(painted(box(0.18, 3.4, 0.18), P.roccia, M(s * 3.4, 1.7, 2.2)));
      for (let i = 0; i < 7; i++) parts.push(painted(box(1.0, 0.14, 3.6), i % 2 ? P.pietraChiara : P.rosso, M(-3 + i, 3.5, 0.6, 0.18, 0, 0)));
      break;
    }
    case 'gomme': {
      // pila di gomme a muretto (3 colonne × 3), una bianca ogni tanto
      for (let c = 0; c < 3; c++) for (let h = 0; h < 3; h++) parts.push(painted(cyl(0.42, 0.42, 0.3, 8), (c + h) % 3 === 1 ? P.pietraChiara : P.neroCaldo, M((c - 1) * 0.86, 0.15 + h * 0.3, 0)));
      break;
    }
    case 'kart_fermo': return kartGeo(P.rosso, 7);
    case 'bandierina': {
      // asta con la bandiera a scacchi
      parts.push(painted(cyl(0.05, 0.06, 3.2, 5), P.pietra, M(0, 1.6, 0)));
      scacchi(parts, 4, 3, 0.3, 0.65, 2.75, 0, 0, 0.04);
      break;
    }
    default: break;
  }
  return merged(parts);
}
