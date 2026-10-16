// Ripari e punti d'attacco dei nemici (#355, Tappa B). I ripari possibili si calcolano una volta: celle libere a ridosso di una scatola
// alta almeno quanto una cassa (container, gambe della gru: riparo alto; casse e barriere: riparo basso, ci si accuccia). In partita un
// nemico sceglie il riparo che lo nasconde da te (dal tuo occhio non si vede la sua testa), a una distanza giusta, vicino da raggiungere
// e lontano dai compagni. Da un riparo alto si sporge di lato (una cella da cui ti vede), da uno basso si alza in piedi.
// Chi aggira cerca un punto da cui ti vede, a qualche metro, in una direzione diversa da quella dei compagni.
import { SPARO } from '@marea/content/sparo.ts';
import { cellCenter, isSolid } from '../dungeon/map.ts';
import { atan2 } from '../trig.ts';
import type { SMappa } from './mappa.ts';
import { vede } from './mappa.ts';
import type { SBot, SState } from './stato.ts';
import { GIRO, GRADI, occhi } from './stato.ts';

export type Riparo = { cella: number; x: number; z: number; alto: boolean };

const CACHE = new WeakMap<SMappa, Riparo[]>();
/** Teste dietro il riparo: accucciati dietro una cassa, in piedi dietro un container. */
const TESTA_BASSA = 0.95, TESTA_ALTA = 1.5;

export function ripari(m: SMappa): Riparo[] {
  const c = CACHE.get(m);
  if (c) return c;
  const out: Riparo[] = [];
  for (let i = 0; i < m.w * m.h; i++) {
    if (m.solid[i]) continue;
    const p = cellCenter(m, i);
    let alto = -1;
    for (const s of m.scatole) {
      if (s.top < 0.85) continue;
      const nx = p.x < s.x0 ? s.x0 : p.x > s.x1 ? s.x1 : p.x, nz = p.z < s.z0 ? s.z0 : p.z > s.z1 ? s.z1 : p.z;
      const dx = p.x - nx, dz = p.z - nz;
      if (dx * dx + dz * dz < 0.75 * 0.75) alto = Math.max(alto, s.top >= 1.6 ? 1 : 0);
    }
    if (alto >= 0) out.push({ cella: i, x: p.x, z: p.z, alto: alto === 1 });
  }
  CACHE.set(m, out);
  return out;
}

const dist = (ax: number, az: number, bx: number, bz: number): number => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));

/** Il riparo migliore per `b` contro il giocatore in (gx, gz); `campo` = distanze BFS dalla cella del nemico. */
export function scegliRiparo(s: SState, m: SMappa, b: SBot, campo: Int32Array): Riparo | null {
  const C = SPARO.nemici.copertura, g = s.g, oy = occhi(g);
  const presi = new Set<number>();
  for (const o of s.bot) if (o !== b && !o.morto && o.meta >= 0) presi.add(o.meta);
  let best: Riparo | null = null, bp = Infinity;
  for (const r of ripari(m)) {
    const d = dist(r.x, r.z, g.x, g.z);
    if (d < C.min || d > C.max || presi.has(r.cella)) continue;
    const passi = campo[r.cella]!;
    if (passi < 0 || passi > 70) continue;
    let p = passi * m.tile + 0.25 * Math.abs(d - 14);
    for (const o of s.bot) if (o !== b && !o.morto && dist(o.x, o.z, r.x, r.z) < 3) p += 8;
    if (p >= bp) continue;
    if (vede(m, g.x, oy, g.z, r.x, r.alto ? TESTA_ALTA : TESTA_BASSA, r.z)) continue; // da lì lo vedresti: non è un riparo
    best = r; bp = p;
  }
  return best;
}

/** Da dove si sporge dal riparo `r`: da uno basso dalla stessa cella (in piedi), da uno alto una cella di lato da cui ti vede. */
export function sbirciata(s: SState, m: SMappa, r: Riparo): number {
  const g = s.g, gy = occhi(g) - 0.4;
  if (!r.alto) return r.cella;
  const cx = r.cella % m.w, cz = (r.cella - cx) / m.w;
  let best = -1, bd = Infinity;
  for (let dz = -3; dz <= 3; dz++)
    for (let dx = -3; dx <= 3; dx++) {
      if (!dx && !dz || isSolid(m, cx + dx, cz + dz)) continue;
      const i = (cz + dz) * m.w + cx + dx, p = cellCenter(m, i), d = dx * dx + dz * dz;
      if (d < bd && vede(m, p.x, SPARO.giocatore.occhi, p.z, g.x, gy, g.z)) { best = i; bd = d; }
    }
  return best;
}

/** Angolo (rad) da (ax, az) verso (bx, bz) nella convenzione della sim (0 = −Z, + a sinistra). */
export const rotta = (ax: number, az: number, bx: number, bz: number): number => atan2(-(bx - ax), -(bz - az));
/** Differenza tra due angoli in (−π, π]. */
export function scarto(a: number, b: number): number {
  const d = a - b;
  return d - GIRO * Math.round(d / GIRO);
}

/** Il punto da cui `b` ti prende di lato: ti vede in piedi, tra `min` e `max` m, lontano (in angolo, visto da te) dai compagni in
 *  allerta; il più vicino da raggiungere. */
export function puntoFianco(s: SState, m: SMappa, b: SBot, campo: Int32Array): number {
  const A = SPARO.nemici.aggira, g = s.g, gy = occhi(g) - 0.4;
  const altri: number[] = [];
  for (const o of s.bot) if (o !== b && !o.morto && o.tipo === 'nemico' && o.stato !== 'pattuglia' && o.stato !== 'fermo') altri.push(rotta(g.x, g.z, o.x, o.z));
  let best = -1, bp = Infinity;
  for (let i = 0; i < m.w * m.h; i++) {
    if (m.solid[i]) continue;
    const passi = campo[i]!;
    if (passi < 0 || passi * m.tile >= bp) continue;
    const p = cellCenter(m, i), d = dist(p.x, p.z, g.x, g.z);
    if (d < A.min || d > A.max) continue;
    const r = rotta(g.x, g.z, p.x, p.z);
    if (altri.some((a) => Math.abs(scarto(r, a)) < A.angolo * GRADI)) continue;
    if (!vede(m, p.x, SPARO.giocatore.occhi, p.z, g.x, gy, g.z)) continue;
    best = i; bp = passi * m.tile;
  }
  return best;
}
