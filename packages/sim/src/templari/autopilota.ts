// Pilota automatico per i test (e ?autopilot=1): prende l'arco sull'altare laterale e posa la reliquia; in combattimento attacca come
// AUTO (autoA) e va incontro allo zombie più vicino dentro la chiesa; nei momenti tranquilli raccoglie lo scudo, compra le armi sul muro
// che si può permettere e ripara le finestre. Cammina lungo le distanze BFS della griglia dell'eroe (aggira colonne e stalli).
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import type { Rng } from '../rng.ts';
import { bfs, cellCenter, cellOf, stepDown } from '../dungeon/map.ts';
import type { TInput } from './types.ts';
import type { TState } from './stato.ts';
import { armaIn } from './stato.ts';
import { autoA, finestraVicina, miraTiro } from './eroe.ts';

const sq = (v: number): number => v * v;
const FERMO: TInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const campi = new WeakMap<TState, Map<number, Int32Array>>();

/** Passo verso (x, z) lungo il campo BFS della griglia dell'eroe (in cache per cella d'arrivo). */
function verso(s: TState, x: number, z: number): TInput {
  const g = s.gr.eroe, h = s.eroe;
  let to = cellOf(g, x, z);
  if (to < 0) return FERMO;
  if (g.solid[to]) { // bersaglio su una cella piena (cassa, altare): la cella libera accanto più vicina all'eroe
    const cx = to % g.w, cz = (to - cx) / g.w;
    let best = -1, bd = Infinity;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const j = (cz + dz) * g.w + cx + dx; if (g.solid[j]) continue; const c = cellCenter(g, j), d = sq(c.x - h.x) + sq(c.z - h.z); if (d < bd) { bd = d; best = j; } }
    if (best < 0) return FERMO;
    to = best;
  }
  let m = campi.get(s);
  if (!m) { m = new Map(); campi.set(s, m); }
  let f = m.get(to);
  if (!f) { f = bfs(g, to); m.set(to, f); }
  const qui = cellOf(g, h.x, h.z), nx = qui === to ? to : stepDown(g, f, qui);
  const p = nx >= 0 && nx !== to ? cellCenter(g, nx) : cellCenter(g, to);
  const dx = p.x - h.x, dz = p.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
  return d < 0.05 ? FERMO : { ...FERMO, mx: dx / d, my: dz / d };
}
const vicino = (s: TState, x: number, z: number, r: number) => sq(x - s.eroe.x) + sq(z - s.eroe.z) <= r * r;
/** Premi d (un tocco ogni due tick: il fronte di salita lo vede la sim). */
const tocca = (s: TState): TInput => ({ ...FERMO, d: s.tick % 2 === 0 });

export function autopilota(s: TState, _rng: Rng): TInput {
  const h = s.eroe;
  if (s.done) return FERMO;
  if (s.fase === 'altare') {
    const arco = s.arena.muri.find((m) => m.arma === 'arco');
    if (arco && !h.armi.some((x) => x?.id === 'arco')) return vicino(s, arco.x, arco.z, 1.0) ? tocca(s) : verso(s, arco.x, arco.z);
    const a = s.arena.altare;
    if (!vicino(s, a.x, a.z, TEMPLARI.altare.raggio - 0.5)) return verso(s, a.x, a.z);
    return tocca(s);
  }
  // attacca come AUTO; con l'arco tenuto teso resta fermo finché non tira
  if (autoA(s)) return { ...FERMO, a: true };
  if (h.act === 'tende') return FERMO;
  // lo zombie dentro più vicino (che non stia ancora strappando fuori)
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (const z of s.zombie) {
    if (z.st === 'morto' || z.st === 'sorge' || z.st === 'strappa') continue;
    const c = cellOf(s.gr.eroe, z.x, z.z);
    if (c < 0 || s.gr.eroe.solid[c]) continue;
    const d = sq(z.x - h.x) + sq(z.z - h.z);
    if (d < bd) { bd = d; best = { x: z.x, z: z.z }; }
  }
  const a = armaIn(s), aDistanza = a.tipo !== 'mischia';
  // con l'arco o le pistole: se ha un bersaglio in vista sta fermo e tira (autoA), se il caricatore è vuoto passa all'altra arma
  const sl = h.armi[h.cur];
  if (aDistanza && sl && sl.colpi <= 0 && sl.riserva <= 0 && h.armi.some((x, i) => i !== h.cur && x)) return { ...FERMO, c: s.tick % 2 === 0 };
  if (best && bd < 14 * 14) {
    if (aDistanza && miraTiro(s, (a.gittata ?? 20) * 0.9) && bd > 9) return FERMO;
    if (!aDistanza || bd <= 9) {
      // da vicino: la mischia se ce l'ha
      const mischia = h.armi.findIndex((x) => x && armaDef(x.id).tipo === 'mischia');
      if (aDistanza && mischia >= 0 && mischia !== h.cur && h.act === 'idle') return { ...FERMO, c: s.tick % 2 === 0 };
    }
    return verso(s, best.x, best.z);
  }
  // tranquillo: lo scudo a terra, poi le armi sul muro che si può permettere, poi le finestre
  const d0 = s.drops[0];
  if (d0 && (!h.scudo || h.scudo.vita < TEMPLARI.scudo.vita)) return vicino(s, d0.x, d0.z, 1.2) ? tocca(s) : verso(s, d0.x, d0.z);
  for (const m of s.arena.muri) {
    const ad = armaDef(m.arma);
    const meglio = Math.max(0, ...h.armi.map((x) => (x ? armaDef(x.id).prezzo ?? 0 : 0)));
    if (h.armi.some((x) => x?.id === m.arma) || s.punti < (ad.prezzo ?? 0) + (ad.prezzo ? 200 : 0) || ((ad.prezzo ?? 0) > 0 && (ad.prezzo ?? 0) <= meglio)) continue;
    return vicino(s, m.x, m.z, 1.0) ? tocca(s) : verso(s, m.x, m.z);
  }
  // la cassa del tesoro quando avanza qualcosa (o l'arma uscita da prendere)
  const c = s.cassa, pc = s.arena.casse[c.posto];
  if (pc && ((c.fase === 'chiusa' && s.punti >= TEMPLARI.cassa.prezzo + 600) || c.fase === 'pronta')) return vicino(s, pc.x, pc.z, TEMPLARI.cassa.raggio - 0.4) ? tocca(s) : verso(s, pc.x, pc.z);
  if (finestraVicina(s) >= 0) return { ...FERMO, d: true };
  let fi = -1, fa = Infinity;
  s.arena.finestre.forEach((f, i) => { const n = s.assi[i] ?? 0; if (n < TEMPLARI.barricate.assi && n < fa) { fa = n; fi = i; } });
  if (fi >= 0) { const f = s.arena.finestre[fi]!; return verso(s, f.dentro.x, f.dentro.z); }
  if (best) return verso(s, best.x, best.z);
  return FERMO;
}
