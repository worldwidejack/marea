// Pilota automatico per i test (e ?autopilot=1): posa la reliquia, ripara le finestre quando non c'è nessuno addosso, va incontro allo
// zombie più vicino dentro la chiesa e lo colpisce. Cammina lungo le distanze BFS della griglia dell'eroe (aggira colonne e stalli).
import { TEMPLARI } from '@marea/content/templari.ts';
import type { Rng } from '../rng.ts';
import { bfs, cellCenter, cellOf, stepDown } from '../dungeon/map.ts';
import type { TInput } from './types.ts';
import type { TState } from './stato.ts';
import { aPortata, finestraVicina } from './eroe.ts';

const FERMO: TInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const campi = new WeakMap<TState, Map<number, Int32Array>>();

/** Passo verso (x, z) lungo il campo BFS della griglia dell'eroe (in cache per cella d'arrivo). */
function verso(s: TState, x: number, z: number): TInput {
  const g = s.gr.eroe, to = cellOf(g, x, z), h = s.eroe;
  if (to < 0) return FERMO;
  let m = campi.get(s);
  if (!m) { m = new Map(); campi.set(s, m); }
  let f = m.get(to);
  if (!f) { f = bfs(g, to); m.set(to, f); }
  const qui = cellOf(g, h.x, h.z), nx = qui === to ? to : stepDown(g, f, qui);
  const p = nx >= 0 && nx !== to ? cellCenter(g, nx) : { x, z };
  const dx = p.x - h.x, dz = p.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
  return d < 0.05 ? FERMO : { ...FERMO, mx: dx / d, my: dz / d };
}

export function autopilota(s: TState, _rng: Rng): TInput {
  const h = s.eroe;
  if (s.done) return FERMO;
  if (s.fase === 'altare') {
    const a = s.arena.altare, dx = a.x - h.x, dz = a.z - h.z;
    if (dx * dx + dz * dz > TEMPLARI.altare.raggio * TEMPLARI.altare.raggio) return verso(s, a.x - 1.5, a.z);
    return { ...FERMO, d: s.tick % 2 === 0 };
  }
  // colpisci chi è a portata (tocco breve: un fendente)
  if (aPortata(s)) return { ...FERMO, a: h.act === 'idle' && !h.prevA };
  // lo zombie dentro più vicino (che non stia ancora strappando fuori)
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (const z of s.zombie) {
    if (z.st === 'morto' || z.st === 'sorge' || z.st === 'strappa') continue;
    const c = cellOf(s.gr.eroe, z.x, z.z);
    if (c < 0 || s.gr.eroe.solid[c]) continue;
    const d = (z.x - h.x) * (z.x - h.x) + (z.z - h.z) * (z.z - h.z);
    if (d < bd) { bd = d; best = { x: z.x, z: z.z }; }
  }
  if (best && bd < 14 * 14) return verso(s, best.x, best.z);
  // nessuno vicino: ripara la finestra più rotta (tenendo AZIONE quando ci sei)
  if (finestraVicina(s) >= 0) return { ...FERMO, d: true };
  let fi = -1, fa = Infinity;
  s.arena.finestre.forEach((f, i) => { const n = s.assi[i] ?? 0; if (n < TEMPLARI.barricate.assi && n < fa) { fa = n; fi = i; } });
  if (fi >= 0) { const f = s.arena.finestre[fi]!; return verso(s, f.dentro.x, f.dentro.z); }
  if (best) return verso(s, best.x, best.z);
  return FERMO;
}
