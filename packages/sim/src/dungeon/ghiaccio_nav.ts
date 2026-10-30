// Il rompicapo del Ghiaccio Vivo come grafo (stessa regola di ghiaccio.ts, a celle): da una cella si può camminare di un passo su un pavimento asciutto
// o, se la cella accanto è ghiaccio (o ci si sta sopra), partire in quella direzione e finire dove ti ferma un muro o il primo asciutto. Serve al pilota
// automatico e ai test: ogni stanza di ghiaccio deve avere una soluzione e nessun vicolo cieco.
import type { DungeonState } from './state.ts';
import { gelo } from './ghiaccio.ts';

/** Una mossa: la cella dove finisci, in quale direzione spingere, se è una scivolata (se no un passo a piedi) e quante celle fa. */
export type Mossa = { a: number; dir: [number, number]; scivola: boolean; celle: number };
const DIR: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Costo di una scivolata (le camminate costano 1 a cella): meno scivolate, poi meno passi. */
const SCIVOLATA = 1000;

/** Dove puoi andare dalla cella `da` con un passo (a piedi su asciutto) o una scivolata intera: le celle solide (muri, tornelli chiusi) e quelle con un nemico fermo
 *  (`blocchi`, le torrette) non si attraversano. */
function mosse(s: DungeonState, da: number, blocchi: ReadonlySet<number>): Mossa[] {
  const m = s.map, out: Mossa[] = [], cx = da % m.w, cz = (da - cx) / m.w;
  const libera = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < m.w && z < m.h && !m.solid[z * m.w + x] && !blocchi.has(z * m.w + x);
  for (const [dx, dz] of DIR) {
    let x = cx + dx, z = cz + dz, celle = 1;
    if (!libera(x, z)) continue;
    if (!gelo(s, da) && !gelo(s, z * m.w + x)) { out.push({ a: z * m.w + x, dir: [dx, dz], scivola: false, celle }); continue; }
    for (let g = 0; g < 200; g++) {
      if (!gelo(s, z * m.w + x)) break; // arrivato sull'asciutto: si ferma lì
      if (!libera(x + dx, z + dz)) break;
      x += dx; z += dz; celle++;
    }
    out.push({ a: z * m.w + x, dir: [dx, dz], scivola: true, celle });
  }
  return out;
}

/** Costi da `da` a tutte le celle (scivolate × 1000 + passi) e, per ognuna, la prima mossa del percorso migliore. */
export function raggiungibili(s: DungeonState, da: number, blocchi: ReadonlySet<number> = new Set()): { costo: Map<number, number>; prima: Map<number, Mossa> } {
  const costo = new Map<number, number>([[da, 0]]), prima = new Map<number, Mossa>(), coda: [number, number][] = [[0, da]];
  while (coda.length) {
    let k = 0;
    for (let i = 1; i < coda.length; i++) if (coda[i]![0] < coda[k]![0]) k = i;
    const [c0, c] = coda.splice(k, 1)[0]!;
    if (c0 > costo.get(c)!) continue;
    for (const mo of mosse(s, c, blocchi)) {
      const nd = c0 + (mo.scivola ? SCIVOLATA + mo.celle : 1), vecchio = costo.get(mo.a);
      if (vecchio !== undefined && vecchio <= nd) continue;
      costo.set(mo.a, nd); prima.set(mo.a, c === da ? mo : prima.get(c)!); coda.push([nd, mo.a]);
    }
  }
  return { costo, prima };
}
/** Quante scivolate servono per arrivare a una cella di cui `raggiungibili` ha dato il costo. */
export const scivolate = (costo: number): number => Math.floor(costo / SCIVOLATA);

/** La prima mossa verso una qualunque tra le celle `metas`: null se non ci si arriva (o ci si è già). */
export function viaGhiaccio(s: DungeonState, da: number, metas: readonly number[], blocchi?: ReadonlySet<number>): Mossa | null {
  const { costo, prima } = raggiungibili(s, da, blocchi);
  let best: number | null = null;
  for (const c of metas) if (costo.has(c) && (best === null || costo.get(c)! < costo.get(best)!)) best = c;
  return best === null || best === da ? null : prima.get(best) ?? null;
}

/** Vicoli ciechi: celle raggiungibili da `da` da cui `meta` non si raggiunge più (devono essere zero). */
export function vicoliCiechi(s: DungeonState, da: number, meta: number, blocchi?: ReadonlySet<number>): number[] {
  const ciechi: number[] = [];
  for (const c of raggiungibili(s, da, blocchi).costo.keys()) if (!raggiungibili(s, c, blocchi).costo.has(meta)) ciechi.push(c);
  return ciechi;
}
