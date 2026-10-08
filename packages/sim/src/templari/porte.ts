// Porte e trappole (docs/TEMPLARI.md §9). Porte: macerie e cancelli col prezzo sopra; AZIONE vicino la compra, si apre per tutta la
// partita (le sue celle diventano pavimento per tutti) e accende le comparse della sua zona. Trappole: AZIONE alla leva (1000 punti) la
// accende per 25 s: chi ci passa muore (i boss perdono vita), l'eroe che ci sta dentro si fa male; poi 60 s per ricaricarsi.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { TPortaDef, TTrappolaDef } from '@marea/content/templari.ts';
import { cellOf } from '../dungeon/map.ts';
import type { Porta } from './mappa.ts';
import type { TState } from './stato.ts';
import { ev, secToTicks } from './stato.ts';
import { danneggia, ferisciDiretto, spendi, uccidi } from './colpi.ts';

export const portaDef = (id: string): TPortaDef => TEMPLARI.porte[id] ?? { nome: id, prezzo: 0, zona: id };
export const trappolaDef = (id: string): TTrappolaDef => TEMPLARI.trappole[id]!;

/** La zona è aperta: 'fuori' (il sagrato) sempre, le altre quando una delle loro porte è aperta. */
export function zonaAperta(s: TState, zona: string): boolean {
  if (zona === 'fuori') return true;
  for (const id in s.porte) if (s.porte[id] && portaDef(id).zona === zona) return true;
  return false;
}

/** La porta chiusa più vicina a portata (dalla sua cella più vicina), o null. */
export function portaVicina(s: TState): Porta | null {
  const h = s.eroe, a = s.arena, r = TEMPLARI.porta.raggio;
  let best: Porta | null = null, bd = r * r;
  for (const p of a.porte) {
    if (s.porte[p.id]) continue;
    for (const i of p.celle) {
      const x = ((i % a.w) + 0.5) * a.tile, z = (Math.floor(i / a.w) + 0.5) * a.tile, d = (x - h.x) * (x - h.x) + (z - h.z) * (z - h.z);
      if (d <= bd) { bd = d; best = p; }
    }
  }
  return best;
}

/** Compra e apre la porta: le celle diventano libere in tutte le griglie, gli zombie ricalcolano la strada. */
export function apriPorta(s: TState, p: Porta): boolean {
  if (s.porte[p.id] || !spendi(s, portaDef(p.id).prezzo)) return false;
  s.porte[p.id] = true;
  for (const i of p.celle) { s.gr.eroe.solid[i] = 0; s.gr.zombie.solid[i] = 0; s.gr.percorso.solid[i] = 0; }
  s.flowCell = -1; s.flowTick = -999;
  ev(s, { t: 'porta', id: p.id });
  return true;
}

/** La leva a portata (indice della trappola), o -1. */
export function levaVicina(s: TState): number {
  const h = s.eroe, r = TEMPLARI.muro.raggio;
  let best = -1, bd = r * r;
  s.arena.trappole.forEach((t, i) => { const d = (t.leva.x - h.x) * (t.leva.x - h.x) + (t.leva.z - h.z) * (t.leva.z - h.z); if (d <= bd) { bd = d; best = i; } });
  return best;
}
export const trappolaAccesa = (s: TState, i: number): boolean => s.tick < (s.trappole[i]?.fine ?? 0);
export const trappolaPronta = (s: TState, i: number): boolean => s.tick >= (s.trappole[i]?.pronta ?? 0);

/** AZIONE alla leva: paga e accende (se è pronta). */
export function accendiTrappola(s: TState, i: number): boolean {
  const t = s.arena.trappole[i], st = s.trappole[i];
  if (!t || !st || !trappolaPronta(s, i)) return false;
  const d = trappolaDef(t.id);
  if (!spendi(s, d.prezzo)) return false;
  st.fine = s.tick + secToTicks(d.durata); st.pronta = st.fine + secToTicks(d.ricarica); st.colpo = s.tick;
  ev(s, { t: 'trappola', id: t.id, fase: 'accesa' });
  return true;
}

export function stepTrappole(s: TState): void {
  const a = s.arena, h = s.eroe;
  a.trappole.forEach((t, i) => {
    const st = s.trappole[i]!;
    if (st.fine > 0 && s.tick === st.fine) ev(s, { t: 'trappola', id: t.id, fase: 'spenta' });
    if (st.pronta > 0 && s.tick === st.pronta) ev(s, { t: 'trappola', id: t.id, fase: 'pronta' });
    if (!trappolaAccesa(s, i) || s.done) return;
    const d = trappolaDef(t.id);
    for (const z of s.zombie) {
      if (z.st === 'morto' || z.st === 'sorge' || z.st === 'fugge' || a.trappolaDi[cellOf(s.gr.percorso, z.x, z.z)] !== i) continue;
      if (z.def.boss) danneggia(s, z, d.boss / 60, 0);
      else uccidi(s, z); // le uccisioni delle trappole non danno punti (come in COD)
    }
    if (a.trappolaDi[cellOf(s.gr.percorso, h.x, h.z)] === i && s.tick >= st.colpo) {
      st.colpo = s.tick + secToTicks(d.eroe.ogni);
      ferisciDiretto(s, d.eroe.danno, t.id === 'rogo' ? 'brucia' : 'ferito');
    }
  });
}
