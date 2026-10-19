// Dove arriva l'eroe con le porte aperte adesso (e il piano di sotto, dalle scale aperte: §9c, §12b) (power-up a terra, posti della cassa, autopilota): distanze BFS sulla griglia dell'eroe
// dalla partenza, in cache finché non si apre un'altra porta (dipendono solo dalle porte: le finestre per l'eroe sono sempre chiuse).
import { bfs, cellOf } from '../dungeon/map.ts';
import type { TState } from './stato.ts';
import { passaggioAperto } from './segreti.ts';

const CACHE = new WeakMap<TState, { n: number; d: Int32Array }>();
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function raggiungibili(s: TState): Int32Array {
  let n = s.segreti.muro ? 1000 : 0;
  for (const k in s.porte) if (s.porte[k]) n++;
  const c = CACHE.get(s);
  if (c && c.n === n) return c.d;
  // dalle scale aperte (la cripta col muro rotto, le grate comprate): dall'altro capo di una scala che si raggiunge si va avanti
  const da = [cellOf(s.gr.eroe, s.arena.spawn.x, s.arena.spawn.z)], ap = s.arena.passaggi.filter((p) => passaggioAperto(s, p));
  let d = bfs(s.gr.eroe, da);
  for (let giro = 0; giro < ap.length; giro++) {
    let nuovi = false;
    for (const p of ap) for (const [x, y] of [[p.a, p.b], [p.b, p.a]] as const) {
      const c = cellOf(s.gr.eroe, y.davanti.x, y.davanti.z);
      if ((d[x.cella] ?? -1) >= 0 && (d[c] ?? -1) < 0) { da.push(c); nuovi = true; }
    }
    if (!nuovi) break;
    d = bfs(s.gr.eroe, da);
  }
  CACHE.set(s, { n, d });
  return d;
}
/** La cella `i` si raggiunge (o, se è piena, una delle 4 accanto: la cassa, una leva). */
export function raggiunge(s: TState, i: number): boolean {
  const d = raggiungibili(s), g = s.gr.eroe;
  if (i < 0) return false;
  if ((d[i] ?? -1) >= 0) return true;
  const cx = i % g.w, cz = (i - cx) / g.w;
  return N4.some(([dx, dz]) => { const x = cx + dx, z = cz + dz; return x >= 0 && z >= 0 && x < g.w && z < g.h && (d[z * g.w + x] ?? -1) >= 0; });
}
export const raggiungePunto = (s: TState, x: number, z: number): boolean => raggiunge(s, cellOf(s.gr.eroe, x, z));
/** Il punto raggiungibile più vicino a (x, z) entro `r` celle (il centro della cella), o null. */
export function vicinoRaggiungibile(s: TState, x: number, z: number, r: number): { x: number; z: number } | null {
  const g = s.gr.eroe, d = raggiungibili(s), c = cellOf(g, x, z);
  if (c >= 0 && (d[c] ?? -1) >= 0) return { x, z };
  const cx = Math.floor(x / g.tile), cz = Math.floor(z / g.tile);
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const nx = cx + dx, nz = cz + dz;
    if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h || (d[nz * g.w + nx] ?? -1) < 0) continue;
    const px = (nx + 0.5) * g.tile, pz = (nz + 0.5) * g.tile, dd = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (dd < bd) { bd = dd; best = { x: px, z: pz }; }
  }
  return best;
}
