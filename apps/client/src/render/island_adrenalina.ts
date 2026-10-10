// Isola dell'Adrenalina (docs/ADRENALINA.md §3) nell'arcipelago, tutta in un chunk a parte (island_temi.ts lo scarica all'avvio e createIsland
// lo aspetta, come le Corse; il JS iniziale ha un tetto, TECH §5): terreni, montagna innevata e decorazioni procedurali. Le stazioni della funivia a valle e in vetta, il guardiano del cancello, il cartello delle piste a
// colori, la piattaforma del lancio sul bordo nord, le porte dello slalom sul fianco e gli abeti del bosco. Il cavo, i piloni e le cabine che
// si muovono li disegna game/adrenalina_funivia.ts. Solo colori della palette, facce piatte. Pivot a terra, −Z avanti.
import * as THREE from 'three';
import type { Rng } from '@marea/sim';
import { M, P, merged, painted, px, speckle, strata } from './island_parts.ts';
import type { Painter } from './island_parts.ts';
import type { TemaProp } from './island_temi.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
/** Blu delle piste (il blu della palette). */
const BLU = P.acquaProfonda;

/** Quota (m sopra il pivot) dove il cavo esce dalle due stazioni e distanza dal pivot verso il cavo (lato +Z locale a valle, −Z in vetta); `scarto`: mezzo passo tra i due cavi. */
export const FUNIVIA = { valle: { y: 4.1, z: 2.2 }, monte: { y: 3.3, z: -1.8 }, scarto: 0.7 } as const;
// ——— terreni: neve battuta sulla spiaggia di ghiaia, prato di montagna, riva di sassi ———
export const PAINT_ADRENALINA: Record<string, Painter> = {
  adrenalina_sabbia: (g, r) => { px(g, P.pietra, 0, 0, 32, 32); speckle(g, r, P.pietraChiara, 40, 0, 32); speckle(g, r, P.pietraScura, 22, 0, 32); strata(g, [[P.pietra, 3], [P.pietraScura, 6], [P.roccia, 32]]); },
  adrenalina_erba: (g, r) => {
    px(g, P.erbaScura, 0, 0, 32, 32); speckle(g, r, P.bosco, 34, 0, 32, 1, 2); speckle(g, r, P.erba, 18, 0, 32); speckle(g, r, P.pietraChiara, 5, 0, 32); speckle(g, r, P.legno, 6, 0, 32);
    strata(g, [[P.bosco, 3], [P.legnoScuro, 6], [P.roccia, 32]]);
  },
  adrenalina_riva: (g, r) => { px(g, P.pietraScura, 0, 0, 32, 32); speckle(g, r, P.pietra, 34, 0, 32, 2, 1); speckle(g, r, P.roccia, 20, 0, 32); strata(g, [[P.roccia, 32]]); },
};

// ——— montagna: roccia scura in basso, bande di pietra, neve sopra i 9 m e sulle facce in su delle colonne alte ———
export function rocciaAdrenalina(top: boolean, y: number, h: number, r: Rng): { c: string } {
  if (top) return { c: h > 7 ? (r.next() < 0.85 ? P.pietraChiara : P.sabbiaChiara) : r.next() < 0.5 ? P.erbaScura : P.pietraScura };
  if (y < 0.4) return { c: P.neroCaldo };
  if (y > 9 || (y > 6.5 && h - y < 1.4) || (y > 7.5 && r.next() < 0.45)) return { c: P.pietraChiara }; // neve che cola dalle cime
  return { c: Math.floor(y / 1.4) % 2 ? P.roccia : P.pietraScura };
}
/** Un picco solo: sale in fretta verso il centro (le colonne interne superano i 20 m). */
export const altezzaAdrenalina = (d: number, r: Rng): number => 0.8 + d * 1.75 + r.next() * 0.5;


function abete(parts: THREE.BufferGeometry[], s: number, neve: boolean): void {
  parts.push(painted(cyl(0.12 * s, 0.16 * s, 0.9 * s, 5), P.legnoScuro, M(0, 0.45 * s, 0)));
  for (let i = 0; i < 3; i++) {
    const r = (1.15 - i * 0.3) * s, h = (1.3 - i * 0.2) * s, y = (0.8 + i * 0.85) * s;
    parts.push(painted(new THREE.ConeGeometry(r, h, 6), i % 2 ? P.boscoOmbra : P.bosco, M(0, y + h / 2, 0, 0, i * 0.5, 0)));
    if (neve) parts.push(painted(new THREE.ConeGeometry(r * 0.55, h * 0.35, 6), P.pietraChiara, M(0, y + h * 0.82, 0, 0, i * 0.5, 0)));
  }
}
/** Stazione: basamento di pietra, pareti di legno, tetto rosso a due falde, la ruota del cavo sul retro. `grande` = quella a valle. */
function stazione(parts: THREE.BufferGeometry[], grande: boolean): void {
  const w = grande ? 5.2 : 4.0, d = grande ? 4.2 : 3.4, h = grande ? 3.2 : 2.5, retro = grande ? 1 : -1;
  parts.push(painted(box(w + 0.4, 0.5, d + 0.4), P.pietraScura, M(0, 0.25, 0)));
  // pareti: retro e fianchi pieni, davanti aperto con due pilastri (si vede la cabina ferma)
  parts.push(painted(box(w, h, 0.25), P.legno, M(0, 0.5 + h / 2, (d / 2 - 0.12) * retro)));
  for (const s of [-1, 1]) parts.push(painted(box(0.25, h, d), P.legnoChiaro, M(s * (w / 2 - 0.12), 0.5 + h / 2, 0)));
  for (const s of [-1, 1]) parts.push(painted(box(0.35, h, 0.35), P.legnoScuro, M(s * (w / 2 - 0.3), 0.5 + h / 2, (-d / 2 + 0.2) * retro)));
  for (const s of [-1, 1]) parts.push(painted(box(0.2, 0.7, 0.9), P.acquaBassa, M(s * (w / 2 + 0.01), 0.5 + h * 0.6, 0.3 * retro))); // finestre sui fianchi
  // tetto a due falde rosso, colmo lungo Z, con la gronda scura
  const falda = w / 2 + 0.5, a = 0.42;
  for (const s of [-1, 1]) parts.push(painted(box(falda * 1.08, 0.18, d + 1.0), P.rosso, M(s * falda * 0.5, 0.5 + h + falda * Math.sin(a) * 0.5, 0, 0, 0, -s * a)));
  parts.push(painted(box(0.3, 0.2, d + 1.05), P.neroCaldo, M(0, 0.5 + h + falda * Math.sin(a) + 0.05, 0)));
  // la ruota del cavo e il castello che la regge, dalla parte del cavo
  const zr = (d / 2 + 0.6) * retro, yr = grande ? FUNIVIA.valle.y : FUNIVIA.monte.y;
  for (const s of [-1, 1]) parts.push(painted(box(0.25, yr, 0.25), P.pietraScura, M(s * 1.0, yr / 2, zr)));
  parts.push(painted(box(2.3, 0.25, 0.4), P.pietraScura, M(0, yr - 0.3, zr)));
  parts.push(painted(cyl(1.0, 1.0, 0.18, 10), P.roccia, M(0, yr, zr)));
  parts.push(painted(cyl(0.3, 0.3, 0.3, 6), P.giallo, M(0, yr + 0.05, zr)));
  // la cabina ferma dentro (si vede dall'apertura) e l'insegna a strisce sopra l'ingresso
  parts.push(painted(box(1.5, 1.3, 1.1), P.rosso, M(0, 1.35, -0.3 * retro)));
  parts.push(painted(box(1.3, 0.5, 1.12), P.acquaBassa, M(0, 1.6, -0.3 * retro)));
  parts.push(painted(box(w * 0.7, 0.55, 0.12), P.pietraChiara, M(0, 0.5 + h - 0.1, (-d / 2 - 0.05) * retro)));
  for (let i = 0; i < 4; i++) parts.push(painted(box(w * 0.14, 0.32, 0.13), [P.erbaScura, BLU, P.rosso, P.neroCaldo][i]!, M((i - 1.5) * w * 0.16, 0.5 + h - 0.1, (-d / 2 - 0.06) * retro)));
  if (grande) {
    // il cancello: due colonnine, la sbarra a righe bianche e rosse e il tornello
    const zc = -d / 2 - 0.9;
    for (const s of [-1, 1]) parts.push(painted(box(0.3, 1.1, 0.3), P.pietraScura, M(s * 1.2, 0.55, zc)));
    for (let i = 0; i < 4; i++) parts.push(painted(box(0.6, 0.12, 0.12), i % 2 ? P.pietraChiara : P.rosso, M(-0.9 + i * 0.6, 1.0, zc)));
    parts.push(painted(box(0.5, 0.9, 0.5), P.roccia, M(-1.9, 0.45, zc + 0.2)));
  }
}

/** Corpo della decorazione (materiale illuminato, colori per vertice). Pivot a terra al centro, −Z avanti. */
export function propAdrenalina(kind: TemaProp): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  switch (kind) {
    case 'funivia_valle': stazione(parts, true); break;
    case 'funivia_monte': stazione(parts, false); break;
    case 'abete': abete(parts, 1, false); break;
    case 'guardiano': {
      // casco arancione, giacca rossa del parco, pantaloni scuri, la cartellina delle liberatorie in mano
      for (const s of [-1, 1]) parts.push(painted(box(0.2, 0.8, 0.22), P.ombraCalda, M(s * 0.13, 0.4, 0)));
      parts.push(painted(box(0.56, 0.7, 0.34), P.rosso, M(0, 1.15, 0)));
      parts.push(painted(box(0.58, 0.12, 0.36), P.pietraChiara, M(0, 1.2, 0)));
      for (const s of [-1, 1]) parts.push(painted(box(0.16, 0.62, 0.18), P.rosso, M(s * 0.36, 1.15, -0.08, 0.5, 0, 0)));
      parts.push(painted(box(0.34, 0.34, 0.32), P.sabbia, M(0, 1.7, 0)));
      parts.push(painted(box(0.4, 0.2, 0.38), P.arancio, M(0, 1.92, 0)));
      parts.push(painted(box(0.34, 0.06, 0.12), P.neroCaldo, M(0, 1.84, -0.22)));
      parts.push(painted(box(0.34, 0.44, 0.04), P.pietraChiara, M(0, 1.05, -0.36, 0.3, 0, 0)));
      parts.push(painted(box(0.1, 0.06, 0.05), P.legnoScuro, M(0, 1.27, -0.4, 0.3, 0, 0)));
      break;
    }
    case 'cartello_piste': {
      // palo e tabellone con le quattro piste: verde, blu, rossa, nera (una riga a testa con il simbolo del colore)
      for (const s of [-1, 1]) parts.push(painted(box(0.14, 2.6, 0.14), P.legnoScuro, M(s * 0.8, 1.3, 0)));
      parts.push(painted(box(2.0, 1.8, 0.12), P.pietraChiara, M(0, 1.8, 0)));
      parts.push(painted(box(2.1, 0.16, 0.18), P.legno, M(0, 2.75, 0)));
      const cols = [P.erbaScura, BLU, P.rosso, P.neroCaldo];
      for (let i = 0; i < 4; i++) {
        parts.push(painted(box(0.3, 0.3, 0.06), cols[i]!, M(-0.7, 2.4 - i * 0.4, -0.08, 0, 0, i === 3 ? 0.785 : 0)));
        parts.push(painted(box(1.1, 0.12, 0.05), P.pietraScura, M(0.15, 2.4 - i * 0.4, -0.08)));
      }
      break;
    }
    case 'piattaforma_lancio': {
      // assi di legno a sbalzo verso −Z, ringhiera, la manica a vento a strisce bianche e arancio
      parts.push(painted(box(2.8, 0.25, 4.2), P.legno, M(0, 0.3, -0.8)));
      for (let i = 0; i < 6; i++) parts.push(painted(box(2.8, 0.05, 0.08), P.legnoScuro, M(0, 0.44, -2.6 + i * 0.7)));
      for (const s of [-1, 1]) {
        parts.push(painted(box(0.1, 1.0, 4.2), P.legnoChiaro, M(s * 1.35, 0.9, -0.8)));
        parts.push(painted(box(0.18, 1.3, 0.18), P.legnoScuro, M(s * 1.35, 0.8, -2.8)));
        parts.push(painted(box(0.25, 2.4, 0.25), P.legnoScuro, M(s * 1.1, -0.8, -1.8, 0.35, 0, 0))); // puntoni sotto lo sbalzo
      }
      parts.push(painted(box(0.08, 3.0, 0.08), P.pietraScura, M(1.4, 1.5, 1.0)));
      for (let i = 0; i < 4; i++) parts.push(painted(cyl(0.2 - i * 0.03, 0.22 - i * 0.03, 0.35, 6), i % 2 ? P.pietraChiara : P.arancio, M(1.4 + 0.2 + i * 0.33, 2.85, 1.0, 0, 0, Math.PI / 2 - 0.15)));
      break;
    }
    case 'porta_slalom': {
      // due pali con le bandierine, uno rosso e uno blu, a 2 m
      const c = [P.rosso, BLU];
      for (let s = 0; s < 2; s++) {
        const x = s ? 1 : -1;
        parts.push(painted(box(0.07, 1.6, 0.07), P.pietraChiara, M(x, 0.8, 0)));
        parts.push(painted(box(0.5, 0.42, 0.04), c[s]!, M(x - 0.25 * x, 1.35, 0)));
      }
      break;
    }
    default: break;
  }
  return merged(parts);
}
