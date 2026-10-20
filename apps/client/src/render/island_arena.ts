// Isola dell'Arena (docs/ARENA.md §5) nell'arcipelago, in un chunk a parte come Adrenalina e Corse (island_temi.ts lo scarica all'avvio e
// createIsland lo aspetta; il JS iniziale ha un tetto, TECH §5): terreni (sabbia battuta, prato curato, riva di pietra) e decorazioni.
// Il COLOSSEO: anello di pietra a due ordini di archi (venti campate), le gradinate dentro che scendono verso la sabbia dell'arena, il
// portone a sud (verso la camera) più grande degli altri archi, gli stendardi rossi e gialli in cima: alto e chiaro, si vede dal mare.
// Lo STENDARDO lungo il viale dal molo al portone. Solo colori della palette, facce piatte. Pivot a terra al centro, il portone verso +Z.
import * as THREE from 'three';
import type { Rng } from '@marea/sim';
import { M, P, merged, painted, px, strata } from './island_parts.ts';
import type { Painter } from './island_parts.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);

// ——— terreni ———
export const PAINT_ARENA: Record<string, Painter> = {
  arena_sabbia: (g) => { px(g, P.sabbia, 0, 0, 32, 32); strata(g, [[P.sabbia, 3], [P.legnoChiaro, 6], [P.legno, 32]]); },
  arena_erba: (g) => {
    px(g, P.erba, 0, 0, 32, 32);
    strata(g, [[P.erbaScura, 3], [P.legno, 7], [P.legnoScuro, 32]]);
  },
  arena_riva: (g) => { px(g, P.pietra, 0, 0, 32, 32); strata(g, [[P.pietraScura, 32]]); },
};
/** Le poche rocce dell'isola: pietra chiara a strati, come i blocchi del colosseo. */
export function rocciaArena(top: boolean, y: number, _h: number, r: Rng): { c: string } {
  if (top) return { c: r.next() < 0.6 ? P.pietraChiara : P.pietra };
  return { c: y < 0.4 ? P.pietraScura : Math.floor(y / 1.2) % 2 ? P.pietra : P.pietraChiara };
}
export const altezzaArena = (d: number, r: Rng): number => 0.7 + d * 0.7 + r.next() * 0.3;

/** Dimensioni del colosseo (m): raggio esterno, spessore dell'anello, altezza dei due ordini, campate. Il portone sta a +Z (campata 0). */
export const COLOSSEO = { r: 12, spessore: 1.6, primo: 4.2, secondo: 3.2, campate: 20 } as const;

function colosseo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [], C = COLOSSEO, N = C.campate, rm = C.r - C.spessore / 2;
  const lato = 2 * Math.PI * rm / N + 0.05; // ogni campata un po' più larga: niente fessure tra i blocchi
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, x = Math.sin(a) * rm, z = Math.cos(a) * rm, ry = a; // campata 0 a +Z (il portone)
    const at = (dy: number, out = 0) => M(x + Math.sin(a) * out, dy, z + Math.cos(a) * out, 0, ry, 0);
    const portone = i === 0;
    // primo ordine: due pilastri e l'architrave, l'arco scuro in mezzo (il portone più alto e largo)
    const ap = portone ? 0.62 : 0.42, hp = portone ? C.primo - 0.6 : C.primo - 1.3;
    for (const s of [-1, 1]) parts.push(painted(box(lato * (1 - ap) / 2, C.primo, C.spessore), P.pietraChiara, at(C.primo / 2).multiply(M(s * lato * (1 + ap) / 4, 0, 0))));
    parts.push(painted(box(lato * ap + 0.02, C.primo - hp, C.spessore), P.pietraChiara, at(hp + (C.primo - hp) / 2)));
    parts.push(painted(box(lato * ap, hp, C.spessore * 0.4), portone ? P.legnoScuro : P.ombraCalda, at(hp / 2, -C.spessore * 0.2))); // l'arco (dentro scuro)
    // cornice tra i due ordini
    parts.push(painted(box(lato + 0.1, 0.3, C.spessore + 0.25), P.pietra, at(C.primo + 0.15)));
    // secondo ordine: finestre più piccole, un po' rientrato
    const y2 = C.primo + 0.3, h2 = C.secondo;
    for (const s of [-1, 1]) parts.push(painted(box(lato * 0.32, h2, C.spessore * 0.85), P.pietraChiara, at(y2 + h2 / 2, -0.12).multiply(M(s * lato * 0.34, 0, 0))));
    parts.push(painted(box(lato * 0.36 + 0.02, h2 * 0.35, C.spessore * 0.85), P.pietraChiara, at(y2 + h2 * 0.825, -0.12)));
    parts.push(painted(box(lato * 0.36, h2 * 0.65, C.spessore * 0.3), P.ombraCalda, at(y2 + h2 * 0.325, -0.4)));
    // in cima: il cornicione e un merlo ogni due campate
    parts.push(painted(box(lato + 0.1, 0.35, C.spessore + 0.15), P.pietra, at(y2 + h2 + 0.17)));
    if (i % 2 === 1) parts.push(painted(box(lato * 0.4, 0.5, C.spessore * 0.7), P.pietraChiara, at(y2 + h2 + 0.6)));
    // dentro: tre gradoni che scendono verso la sabbia (sul portone c'è il corridoio)
    if (!portone) for (let k = 0; k < 3; k++) {
      const rr = rm - C.spessore / 2 - 0.9 - k * 1.5, hh = 2.6 - k * 0.85, l2 = 2 * Math.PI * rr / N + 0.08;
      parts.push(painted(box(l2, hh, 1.5), k % 2 ? P.pietra : P.pietraChiara, M(Math.sin(a) * rr, hh / 2, Math.cos(a) * rr, 0, ry, 0)));
    }
  }
  // la sabbia dell'arena, i corridoio del portone, le due torri del portone con gli stendardi
  parts.push(painted(cyl(C.r - C.spessore - 4.4, C.r - C.spessore - 4.4, 0.16, N), P.sabbia, M(0, 0.08, 0)));
  parts.push(painted(box(3.2, 0.14, 6.5), P.sabbiaChiara, M(0, 0.07, rm - 2.2)));
  for (const s of [-1, 1]) {
    const tx = s * (2 * Math.PI * rm / N) * 0.9, tz = rm + 0.4;
    parts.push(painted(box(1.6, C.primo + C.secondo + 2.2, 1.9), P.pietra, M(tx, (C.primo + C.secondo + 2.2) / 2, tz)));
    parts.push(painted(new THREE.ConeGeometry(1.3, 1.4, 4), P.rosso, M(tx, C.primo + C.secondo + 2.9, tz, 0, Math.PI / 4, 0)));
  }
  // stendardi sull'anello: quattro aste con le bandiere rosse e gialle (visibili dal mare)
  for (const a of [Math.PI * 0.5, Math.PI, Math.PI * 1.5, Math.PI * 0.25, Math.PI * 1.75]) {
    const x = Math.sin(a) * rm, z = Math.cos(a) * rm, y = C.primo + C.secondo + 0.65;
    parts.push(painted(cyl(0.07, 0.09, 3.2, 5), P.legnoScuro, M(x, y + 1.6, z)));
    parts.push(painted(box(1.3, 0.8, 0.06), Math.round(a * 4) % 2 ? P.giallo : P.rosso, M(x + 0.68, y + 2.7, z, 0, -a, 0)));
  }
  return merged(parts);
}

function stendardo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(painted(box(0.5, 0.3, 0.5), P.pietra, M(0, 0.15, 0)));
  parts.push(painted(cyl(0.07, 0.09, 3.4, 5), P.legnoScuro, M(0, 1.85, 0)));
  parts.push(painted(box(0.9, 0.08, 0.08), P.legnoScuro, M(0, 3.4, 0)));
  parts.push(painted(box(0.8, 1.5, 0.05), P.rosso, M(0, 2.6, 0)));
  parts.push(painted(box(0.8, 0.18, 0.06), P.giallo, M(0, 2.0, 0)));
  parts.push(painted(box(0.3, 0.3, 0.06), P.giallo, M(0, 2.85, -0.01, 0, 0, Math.PI / 4))); // il rombo dell'Arena
  return merged(parts);
}

export type ArenaProp = 'colosseo' | 'stendardo';
export function propArena(kind: ArenaProp): THREE.BufferGeometry { return kind === 'colosseo' ? colosseo() : stendardo(); }
