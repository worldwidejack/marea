// Isola della Difesa (docs/DIFESA.md §6) nell'arcipelago, in un chunk a parte come Arena e Corse (island_temi.ts lo scarica all'avvio e
// createIsland lo aspetta; il JS iniziale ha un tetto, TECH §5): terreni (terra dell'orto, prato, riva di sassi) e decorazioni.
// Il primo mondo della Difesa è L'ORTO: il CASALE da difendere a ovest, davanti l'ORTO a 5 corsie × 9 caselle come il campo del gioco
// (porchetta di legno, aiuole rialzate, i difensori a sinistra, le lumache che arrivano da destra), la STACCIONATA col cancello verso il
// casale; il MULINO a nord-est si vede dal mare. Gli altri mondi avranno la loro zona dell'isola. Solo colori della palette, facce piatte.
// Pivot a terra al centro; le facciate guardano +Z (verso la camera).
import * as THREE from 'three';
import type { Rng } from '@marea/sim';
import { M, P, merged, painted, px, speckle, strata } from './island_parts.ts';
import type { Painter } from './island_parts.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);

// ——— terreni ———
export const PAINT_DIFESA: Record<string, Painter> = {
  difesa_sabbia: (g, r) => { px(g, P.sabbia, 0, 0, 32, 32); speckle(g, r, P.sabbiaChiara, 40, 0, 32); speckle(g, r, P.legnoChiaro, 12, 0, 32); strata(g, [[P.sabbia, 3], [P.legnoChiaro, 6], [P.legno, 32]]); },
  difesa_erba: (g, r) => {
    px(g, P.erba, 0, 0, 32, 32); speckle(g, r, P.erbaChiara, 28, 0, 32); speckle(g, r, P.erbaScura, 22, 0, 32, 1, 2); speckle(g, r, P.giallo, 3, 0, 32); speckle(g, r, P.sabbiaChiara, 2, 0, 32);
    strata(g, [[P.erbaScura, 3], [P.legno, 7], [P.legnoScuro, 32]]);
    for (let x = 0; x < 32; x++) if (r.next() < 0.45) px(g, P.erbaScura, x, 35, 1, r.int(1, 2));
  },
  difesa_riva: (g, r) => { px(g, P.pietra, 0, 0, 32, 32); speckle(g, r, P.pietraChiara, 30, 0, 32, 2, 1); speckle(g, r, P.sabbia, 20, 0, 32); strata(g, [[P.pietraScura, 32]]); },
};
/** La collinetta dietro il casale: prato in cima, terra e pietra sui fianchi. */
export function rocciaDifesa(top: boolean, y: number, h: number, r: Rng): { c: string } {
  if (top) return { c: r.next() < 0.7 ? P.erbaScura : P.erba };
  return { c: h - y < 0.5 ? P.erbaScura : y < 0.4 ? P.legnoScuro : Math.floor(y / 1.1) % 2 ? P.legno : P.pietraScura };
}
export const altezzaDifesa = (d: number, r: Rng): number => 0.8 + d * 0.7 + r.next() * 0.3;

/** Il campo dell'orto (m): 9 caselle × 5 corsie da 2 m, come il campo del gioco. Centro del prop = centro del campo; il casale sta a −X. */
export const ORTO = { col: 9, corsie: 5, casella: 2 } as const;

// ——— i personaggi dell'orto, piccoli e fermi (gli stessi del gioco: docs/DIFESA.md §6) ———
function carota(parts: THREE.BufferGeometry[], x: number, z: number, gelata = false): void {
  const c = gelata ? P.acquaBassa : P.arancio;
  parts.push(painted(new THREE.ConeGeometry(0.26, 0.9, 6), c, M(x, 0.75, z, Math.PI, 0, 0)));
  parts.push(painted(cyl(0.26, 0.24, 0.2, 6), c, M(x, 1.25, z)));
  for (const a of [-0.5, 0, 0.5]) parts.push(painted(box(0.08, 0.5, 0.16), P.erbaScura, M(x + a * 0.25, 1.55, z, 0, 0, a)));
  for (const s of [-1, 1]) parts.push(painted(box(0.07, 0.1, 0.03), P.neroCaldo, M(x + 0.27, 1.0, z + s * 0.09))); // gli occhi guardano verso destra (+X)
  parts.push(painted(cyl(0.07, 0.09, 0.16, 6), P.legnoScuro, M(x + 0.3, 0.85, z, 0, 0, Math.PI / 2))); // la bocca-cannone
}
function cavolo(parts: THREE.BufferGeometry[], x: number, z: number): void {
  parts.push(painted(ico(0.45, 0), P.erbaChiara, M(x, 0.62, z, 0.3, 0.6, 0)));
  for (const a of [0, 2.1, 4.2]) parts.push(painted(box(0.5, 0.06, 0.32), P.erba, M(x + Math.cos(a) * 0.35, 0.4, z + Math.sin(a) * 0.35, 0, -a, 0.35)));
}
function zucca(parts: THREE.BufferGeometry[], x: number, z: number, s = 1): void {
  parts.push(painted(ico(0.5 * s, 1), P.arancio, M(x, 0.4 + 0.32 * s, z, 0, 0, 0, 1.15, 0.7, 1.15)));
  parts.push(painted(cyl(0.06 * s, 0.09 * s, 0.25 * s, 5), P.erbaScura, M(x, 0.4 + 0.75 * s, z, 0, 0, 0.3)));
}
function peperoncino(parts: THREE.BufferGeometry[], x: number, z: number): void {
  parts.push(painted(new THREE.ConeGeometry(0.2, 0.8, 6), P.rosso, M(x, 0.75, z, 0, 0, Math.PI + 0.35)));
  parts.push(painted(box(0.12, 0.18, 0.12), P.erbaScura, M(x - 0.15, 1.18, z, 0, 0, 0.35)));
}
function lumaca(parts: THREE.BufferGeometry[], x: number, z: number, bandiera = false): void {
  // come nel gioco: corpo lilla lungo verso −X (arriva da destra), guscio viola a spirale, due antenne con gli occhi
  parts.push(painted(box(1.0, 0.24, 0.34), P.pietraChiara, M(x, 0.52, z)));
  parts.push(painted(box(0.3, 0.42, 0.32), P.pietraChiara, M(x - 0.48, 0.66, z)));
  for (const s of [-1, 1]) {
    parts.push(painted(box(0.05, 0.32, 0.05), P.pietraChiara, M(x - 0.55, 1.0, z + s * 0.09, s * 0.25, 0, 0.3)));
    parts.push(painted(ico(0.07, 0), P.sabbiaChiara, M(x - 0.6, 1.17, z + s * 0.13)));
  }
  parts.push(painted(cyl(0.42, 0.42, 0.34, 8), P.violaNeon, M(x + 0.12, 0.92, z, Math.PI / 2, 0, 0)));
  parts.push(painted(cyl(0.27, 0.27, 0.36, 8), P.viola, M(x + 0.16, 0.95, z, Math.PI / 2, 0, 0)));
  parts.push(painted(cyl(0.11, 0.11, 0.38, 6), P.violaNeon, M(x + 0.18, 0.98, z, Math.PI / 2, 0, 0)));
  if (bandiera) {
    parts.push(painted(box(0.04, 0.9, 0.04), P.legnoScuro, M(x + 0.1, 1.75, z)));
    parts.push(painted(box(0.45, 0.3, 0.03), P.rosso, M(x + 0.34, 2.02, z, 0, 0, -0.1)));
  }
}
/** L'annaffiatoio a molla in testa a ogni corsia (il «tosaerba» del gioco): base di legno, molla, annaffiatoio verde col beccuccio a +X. */
function annaffiatoio(parts: THREE.BufferGeometry[], x: number, z: number): void {
  parts.push(painted(box(0.7, 0.14, 0.5), P.arancio, M(x, 0.07, z)));
  for (let k = 0; k < 3; k++) parts.push(painted(cyl(0.16, 0.16, 0.07, 8), P.pietraChiara, M(x, 0.2 + k * 0.11, z)));
  parts.push(painted(cyl(0.24, 0.27, 0.42, 8), P.erbaScura, M(x, 0.75, z)));
  parts.push(painted(cyl(0.24, 0.24, 0.05, 8), P.erbaChiara, M(x, 0.97, z)));
  parts.push(painted(cyl(0.05, 0.07, 0.5, 6), P.erbaScura, M(x + 0.38, 0.85, z, 0, 0, -1.0)));
  parts.push(painted(cyl(0.12, 0.08, 0.1, 8), P.pietra, M(x + 0.6, 0.99, z, 0, 0, -1.0)));
  parts.push(painted(box(0.08, 0.32, 0.06), P.erbaScura, M(x - 0.3, 0.8, z)));
}

// ——— il campo dell'orto ———
function campo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [], C = ORTO, L = C.col * C.casella, W = C.corsie * C.casella;
  for (let k = 0; k < C.corsie; k++) {
    const z = -W / 2 + C.casella * (k + 0.5);
    // aiuola rialzata: terra scura, bordo di assi
    parts.push(painted(box(L - 0.2, 0.22, 1.5), P.legnoScuro, M(0, 0.11, z)));
    for (const s of [-1, 1]) parts.push(painted(box(L - 0.1, 0.3, 0.1), P.legnoChiaro, M(0, 0.15, z + s * 0.78)));
    // i solchi: una riga più chiara per casella
    for (let c = 0; c < C.col; c++) parts.push(painted(box(1.4, 0.04, 1.2), (c + k) % 2 ? P.legno : P.legnoScuro, M(-L / 2 + C.casella * (c + 0.5), 0.23, z)));
  }
  // i difensori nelle prime colonne (corsia → cosa), le lumache in fondo a destra
  const X = (c: number) => -L / 2 + C.casella * (c + 0.5), Z = (k: number) => -W / 2 + C.casella * (k + 0.5);
  carota(parts, X(1), Z(0)); carota(parts, X(1), Z(2)); carota(parts, X(2), Z(3), true); carota(parts, X(1), Z(4));
  cavolo(parts, X(0), Z(1)); cavolo(parts, X(0), Z(3));
  zucca(parts, X(3), Z(2)); zucca(parts, X(3), Z(4), 0.9);
  peperoncino(parts, X(2), Z(1));
  lumaca(parts, X(7) + 0.3, Z(0)); lumaca(parts, X(8), Z(2), true); lumaca(parts, X(6) + 0.5, Z(4));
  for (let k = 0; k < C.corsie; k++) annaffiatoio(parts, -L / 2 - 0.15, Z(k)); // in testa a ogni corsia, dentro la staccionata
  // staccionata attorno al campo, col cancello aperto a ovest (verso il casale) sulla corsia di mezzo
  const fx = L / 2 + 0.6, fz = W / 2 + 0.6;
  const palo = (x: number, z: number) => parts.push(painted(box(0.16, 1.1, 0.16), P.legnoChiaro, M(x, 0.55, z)));
  const traverse = (x0: number, z0: number, x1: number, z1: number) => {
    const l = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const y of [0.45, 0.85]) parts.push(painted(box(l, 0.1, 0.07), P.legnoChiaro, M(mx, y, mz, 0, -a, 0)));
  };
  for (let x = -fx; x <= fx + 0.01; x += 2.06) { palo(x, -fz); palo(x, fz); }
  traverse(-fx, -fz, fx, -fz); traverse(-fx, fz, fx, fz);
  for (let z = -fz; z <= fz + 0.01; z += 2.06) palo(fx, z);
  traverse(fx, -fz, fx, fz);
  // lato ovest: due pezzi e il cancello aperto in mezzo
  for (const s of [-1, 1]) { palo(-fx, s * fz); palo(-fx, s * 1.2); traverse(-fx, s * fz, -fx, s * 1.2); }
  // l'arco del cancello: due pali alti, la traversa e il cartello con la carota (si vede dal casale)
  for (const s of [-1, 1]) parts.push(painted(box(0.22, 2.9, 0.22), P.legnoScuro, M(-fx, 1.45, s * 1.2)));
  parts.push(painted(box(0.26, 0.22, 2.9), P.legnoScuro, M(-fx, 2.8, 0)));
  parts.push(painted(box(0.1, 0.62, 1.9), P.legnoChiaro, M(-fx - 0.1, 2.35, 0)));
  parts.push(painted(new THREE.ConeGeometry(0.14, 0.75, 5), P.arancio, M(-fx - 0.18, 2.35, -0.45, 0, 0, 0, 1, 1, 1).multiply(M(0, 0, 0, Math.PI / 2, 0, 0))));
  for (const a of [-0.5, 0.5]) parts.push(painted(box(0.05, 0.24, 0.08), P.erbaScura, M(-fx - 0.18, 2.35 + a * 0.12, -0.9 + a * 0.08, a, 0, 0)));
  for (const z of [-0.05, 0.25, 0.55]) parts.push(painted(box(0.04, 0.08, 0.2), P.legnoScuro, M(-fx - 0.17, 2.4, z))); // la scritta (tre trattini)
  return merged(parts);
}

// ——— il casale da difendere ———
const CASALE_FINESTRE: [number, number, number, number][] = [[-1.9, 1.7, 2.76, 0], [1.9, 1.7, 2.76, 0], [3.56, 1.7, 0.6, Math.PI / 2]];
function casale(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(painted(box(7.4, 0.3, 5.9), P.pietra, M(0, 0.15, 0))); // zoccolo
  parts.push(painted(box(7.0, 3.0, 5.5), P.sabbiaChiara, M(0, 1.8, 0)));
  parts.push(painted(box(7.04, 0.5, 5.54), P.pietraChiara, M(0, 0.55, 0))); // fascia bassa
  // tetto a capanna di coppi (falde verso ±Z), timpani sui lati corti
  for (const s of [-1, 1]) parts.push(painted(box(7.9, 0.28, 3.6), s < 0 ? P.rosso : P.arancio, M(0, 4.15, s * 1.45, s * 0.55, 0, 0)));
  parts.push(painted(box(7.9, 0.24, 0.3), P.legnoScuro, M(0, 5.0, 0)));
  const tri = new THREE.Shape([new THREE.Vector2(-2.75, 0), new THREE.Vector2(2.75, 0), new THREE.Vector2(0, 1.7)]);
  for (const s of [-1, 1]) parts.push(painted(new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }), P.sabbiaChiara, M(s * 3.44 - 0.06, 3.3, 0, 0, Math.PI / 2, 0)));
  parts.push(painted(box(0.6, 1.4, 0.6), P.pietra, M(-2.3, 5.0, -1.0))); // comignolo
  parts.push(painted(box(0.75, 0.15, 0.75), P.pietraScura, M(-2.3, 5.75, -1.0)));
  // porta e finestre con le persiane verdi
  parts.push(painted(box(1.2, 2.1, 0.12), P.legnoScuro, M(0, 1.35, 2.76)));
  parts.push(painted(box(1.45, 0.2, 0.16), P.legno, M(0, 2.5, 2.77)));
  for (const [x, y, z, ry] of CASALE_FINESTRE) {
    parts.push(painted(box(1.0, 1.0, 0.1), P.legnoScuro, M(x, y, z, 0, ry, 0)));
    for (const s of [-1, 1]) parts.push(painted(box(0.42, 1.05, 0.08), P.erbaScura, M(x + (ry ? 0 : s * 0.72), y, z + (ry ? s * 0.72 : 0) + 0.02, 0, ry, 0)));
    parts.push(painted(box(1.15, 0.22, 0.32), P.legno, M(x, y - 0.62, z + (ry ? 0 : 0.12), 0, ry, 0))); // fioriera
    for (const f of [-0.35, 0, 0.35]) parts.push(painted(ico(0.13, 0), f ? P.rosso : P.giallo, M(x + (ry ? 0 : f), y - 0.42, z + (ry ? f : 0.14), 0, 0, 0)));
  }
  // portichetto davanti alla porta: pavimento, due pali, tettoia
  parts.push(painted(box(3.0, 0.2, 1.5), P.legno, M(0, 0.32, 3.45)));
  for (const s of [-1, 1]) parts.push(painted(box(0.18, 2.5, 0.18), P.legnoChiaro, M(s * 1.35, 1.55, 4.05)));
  parts.push(painted(box(3.4, 0.16, 1.9), P.arancio, M(0, 2.85, 3.5, -0.22, 0, 0)));
  // la panca e le cassette di verdura sotto il portico
  parts.push(painted(box(1.2, 0.12, 0.4), P.legnoChiaro, M(-0.9, 0.75, 3.1)));
  for (const s of [-1, 1]) parts.push(painted(box(0.1, 0.35, 0.36), P.legnoScuro, M(-0.9 + s * 0.5, 0.55, 3.1)));
  for (const [x, c] of [[1.8, P.arancio], [2.5, P.erbaChiara]] as const) {
    parts.push(painted(box(0.6, 0.4, 0.45), P.legnoChiaro, M(x, 0.62, 3.7)));
    for (const d of [-0.15, 0.12]) parts.push(painted(ico(0.14, 0), c, M(x + d, 0.88, 3.7 + d * 0.5)));
  }
  return merged(parts);
}
/** Le finestre accese di notte (materiale non illuminato). */
function casaleLuci(): THREE.BufferGeometry {
  return merged(CASALE_FINESTRE.map(([x, y, z, ry]) => painted(box(0.8, 0.8, 0.06), P.giallo, M(x + (ry ? 0.04 : 0), y, z + (ry ? 0 : 0.04), 0, ry, 0))));
}

// ——— il mulino a vento: il segno dell'isola visto dal mare ———
function mulino(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(painted(cyl(2.2, 2.4, 0.5, 8), P.pietra, M(0, 0.25, 0)));
  parts.push(painted(cyl(1.35, 2.0, 7.5, 8), P.pietraChiara, M(0, 4.2, 0)));
  for (const y of [2.2, 5.0]) parts.push(painted(cyl(1.9 - y * 0.07, 1.95 - y * 0.07, 0.25, 8), P.pietra, M(0, y, 0)));
  parts.push(painted(new THREE.ConeGeometry(1.8, 2.2, 8), P.rosso, M(0, 9.05, 0)));
  parts.push(painted(box(1.0, 1.9, 0.2), P.legnoScuro, M(0, 1.2, 1.95, -0.08, 0, 0)));
  parts.push(painted(box(0.6, 0.7, 0.15), P.legnoScuro, M(0, 5.6, 1.45, -0.08, 0, 0)));
  // il mozzo e le quattro pale a graticcio, girate di 20° (ferme: aspetto)
  parts.push(painted(cyl(0.3, 0.3, 0.8, 6), P.legnoScuro, M(0, 7.3, 1.75, Math.PI / 2, 0, 0)));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.35;
    const R = new THREE.Matrix4().makeRotationZ(a), T = M(0, 7.3, 2.2);
    const pala = (geo: THREE.BufferGeometry, c: string, x: number, y: number) => parts.push(painted(geo, c, T.clone().multiply(R).multiply(M(x, y, 0))));
    pala(box(0.18, 4.6, 0.14), P.legno, 0, 2.5);
    pala(box(1.1, 3.6, 0.06), P.sabbiaChiara, 0.62, 2.9);
    for (let k = 0; k < 4; k++) pala(box(1.15, 0.07, 0.1), P.legno, 0.62, 1.4 + k * 1.0);
  }
  return merged(parts);
}

function spaventapasseri(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(painted(box(0.14, 2.3, 0.14), P.legno, M(0, 1.15, 0)));
  parts.push(painted(box(1.7, 0.12, 0.12), P.legno, M(0, 1.7, 0)));
  parts.push(painted(box(0.7, 0.85, 0.4), P.rosso, M(0, 1.5, 0)));
  for (const s of [-1, 1]) parts.push(painted(box(0.5, 0.26, 0.3), P.rosso, M(s * 0.55, 1.72, 0)));
  for (const s of [-1, 1]) parts.push(painted(new THREE.ConeGeometry(0.12, 0.3, 4), P.giallo, M(s * 0.9, 1.68, 0, 0, 0, s * Math.PI / 2))); // paglia dalle maniche
  parts.push(painted(box(0.46, 0.46, 0.42), P.sabbia, M(0, 2.2, 0)));
  for (const s of [-1, 1]) parts.push(painted(box(0.08, 0.08, 0.03), P.neroCaldo, M(s * 0.11, 2.26, 0.22)));
  parts.push(painted(cyl(0.6, 0.6, 0.06, 8), P.giallo, M(0, 2.45, 0)));
  parts.push(painted(cyl(0.26, 0.3, 0.32, 8), P.giallo, M(0, 2.62, 0)));
  parts.push(painted(cyl(0.31, 0.31, 0.07, 8), P.rosso, M(0, 2.5, 0)));
  return merged(parts);
}

function carriola(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(painted(box(0.9, 0.35, 0.65), P.rosso, M(0, 0.55, 0, 0, 0, 0.08)));
  parts.push(painted(cyl(0.22, 0.22, 0.1, 8), P.neroCaldo, M(0.55, 0.22, 0, Math.PI / 2, 0, 0)));
  for (const s of [-1, 1]) {
    parts.push(painted(box(0.9, 0.06, 0.06), P.legno, M(-0.6, 0.55, s * 0.28, 0, 0, 0.12)));
    parts.push(painted(box(0.06, 0.38, 0.06), P.legno, M(-0.2, 0.2, s * 0.25)));
  }
  zucca(parts, 0, 0, 0.55); // dentro una zucca piccola
  return merged(parts);
}

function cassette(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const una = (x: number, y: number, z: number, c: string) => {
    parts.push(painted(box(0.7, 0.42, 0.5), P.legnoChiaro, M(x, y + 0.21, z)));
    for (const d of [-0.18, 0.05, 0.2]) parts.push(painted(ico(0.15, 0), c, M(x + d, y + 0.48, z + d * 0.4)));
  };
  una(0, 0, 0, P.arancio); una(0.75, 0, 0.05, P.erbaChiara); una(0.38, 0.44, 0.02, P.rosso);
  return merged(parts);
}

export type DifesaProp = 'casale' | 'orto_campo' | 'mulino' | 'spaventapasseri' | 'carriola' | 'cassette';
export function propDifesa(kind: DifesaProp): THREE.BufferGeometry {
  switch (kind) {
    case 'casale': return casale();
    case 'orto_campo': return campo();
    case 'mulino': return mulino();
    case 'spaventapasseri': return spaventapasseri();
    case 'carriola': return carriola();
    case 'cassette': return cassette();
  }
}
export function propDifesaGlow(kind: DifesaProp): THREE.BufferGeometry | null { return kind === 'casale' ? casaleLuci() : null; }
