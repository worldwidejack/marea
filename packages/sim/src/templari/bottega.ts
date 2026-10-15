// Mercante e Strega (docs/TEMPLARI.md §7b). Stanno fuori dal campo, sul bordo: il Mercante sulla barca davanti alla spiaggia, la Strega nella
// capanna oltre il cimitero. Vicino a loro AZIONE apre il loro menù (lo fa il client); quello che compri è un'azione registrata col tick
// (TAzione «compra», come «esci»), così il server la rigioca uguale.
//   Mercante: munizioni piene per qualsiasi arma (anche quelle della cassa) e il potenziamento dell'arma (una volta: danno, caricatore,
//             riserva e ricarica migliori, nome nuovo), come il Pack-a-Punch.
//   Strega:   pozioni da bere (al massimo `strega.max` insieme), effetti in stato.ts (armaDi, fiatoMax), eroe.ts (corsa, rigenerazione) e
//             colpi.ts (l'Elisir del risorto ti rialza quando cadi).
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import type { TPozione } from '@marea/content/templari.ts';
import type { TAzione, TEvento, TOfferta } from './types.ts';
import type { Slot, TState } from './stato.ts';
import { ev, haPozione, pozioneDef, potenziata, secToTicks, slotDi, vitaBase } from './stato.ts';
import { spendi } from './colpi.ts';
import { acceso } from './fuochi.ts';

/** Sei abbastanza vicino al Mercante o alla Strega per parlarci. */
export function vicinoA(s: TState, chi: 'mercante' | 'strega'): boolean {
  const p = s.arena.personaggi.find((x) => x.id === chi), h = s.eroe, r = TEMPLARI[chi].raggio;
  if (!p) return false;
  const dx = p.x - h.x, dz = p.z - h.z;
  return dx * dx + dz * dz <= r * r;
}
export const chiVicino = (s: TState): 'mercante' | 'strega' | null => (vicinoA(s, 'mercante') ? 'mercante' : vicinoA(s, 'strega') ? 'strega' : null);

/** Munizioni piene dal Mercante: il prezzo del muro, sennò quello delle armi della cassa (miracolose di più); potenziata × `potenziata`.
 *  null = arma senza munizioni (mischia). */
export function prezzoMunizioni(sl: Slot): number | null {
  const a = armaDef(sl.id), m = TEMPLARI.mercante.munizioni;
  if (a.tipo === 'mischia') return null;
  const base = a.prezzoMunizioni ?? (a.miracolosa ? m.miracolosa : m.cassa);
  return Math.round(base * (sl.pot ? m.potenziata : 1));
}
const piena = (sl: Slot): boolean => { const p = slotDi(armaDef(sl.id), sl.pot); return sl.colpi >= p.colpi && sl.riserva >= p.riserva; };

/** Il menù del Mercante: per ogni arma che hai, potenziarla e comprarne le munizioni. */
export function offerteMercante(s: TState): TOfferta[] {
  const out: TOfferta[] = [], k = TEMPLARI.mercante.potenzia;
  s.eroe.armi.forEach((sl, slot) => {
    if (!sl) return;
    const a = armaDef(sl.id);
    out.push(sl.pot
      ? { da: 'mercante', cosa: 'potenzia', slot, nome: `Potenzia: ${a.nomePot}`, descr: 'Già potenziata', prezzo: k.prezzo, puoi: false }
      : { da: 'mercante', cosa: 'potenzia', slot, nome: `Potenzia: ${a.nome}`, descr: `Diventa «${a.nomePot}»: danno ×${a.miracolosa ? k.dannoMiracolosa : k.danno}${a.tipo === 'mischia' ? '' : `, caricatore e munizioni in più, ricarica più svelta`}`, prezzo: k.prezzo, puoi: s.eroe.punti >= k.prezzo });
    const pm = prezzoMunizioni(sl);
    if (pm !== null) {
      const nome = sl.pot ? a.nomePot : a.nome, pieno = piena(sl);
      out.push({ da: 'mercante', cosa: 'munizioni', slot, nome: `Munizioni: ${nome}`, descr: pieno ? 'Sono già piene' : 'Caricatore e riserva pieni', prezzo: pm, puoi: !pieno && s.eroe.punti >= pm });
    }
  });
  return out;
}

/** Il menù della Strega: le sue pozioni, con cosa fanno e perché non puoi berle (già bevuta, ne hai già troppe, finite). */
export function offerteStrega(s: TState): TOfferta[] {
  const h = s.eroe, max = TEMPLARI.strega.max;
  return TEMPLARI.strega.pozioni.map((p): TOfferta => {
    const gia = haPozione(s, p.id), finita = p.volte !== undefined && h.elisir >= p.volte, piene = !gia && h.pozioni.length >= max;
    const perche = gia ? 'Già bevuta' : finita ? 'Finita per questa partita' : piene ? `Ne hai già ${max}` : null;
    return { da: 'strega', cosa: p.id, nome: p.nome, descr: perche ?? p.descr, prezzo: p.prezzo, puoi: !perche && s.eroe.punti >= p.prezzo, ...(gia ? { presa: true } : {}) };
  });
}

/** Un acquisto dal menù (TAzione «compra»): vale solo vicino a chi vende, coi punti e se si può. Ritorna gli eventi, null se non vale. */
export function compra(s: TState, a: Extract<TAzione, { t: 'compra' }>): TEvento[] | null {
  if (!vicinoA(s, a.da) || !acceso(s, a.da)) return null; // la Strega dorme e la nave è al largo finché il loro fuoco è spento
  const n0 = s.eventi.length, h = s.eroe;
  if (a.da === 'mercante') {
    const sl = h.armi[a.slot];
    const o = offerteMercante(s).find((x) => x.cosa === a.cosa && x.slot === a.slot);
    if (!sl || !o || !o.puoi || !spendi(s, o.prezzo)) return null;
    if (a.cosa === 'potenzia') {
      h.armi[a.slot] = slotDi(armaDef(sl.id), true);
      if (a.slot === h.cur) { h.ricarica = 0; h.cd = 0; }
      ev(s, { t: 'potenziata', arma: sl.id, nome: potenziata(armaDef(sl.id)).nome });
    } else {
      h.armi[a.slot] = slotDi(armaDef(sl.id), !!sl.pot);
      ev(s, { t: 'compra', arma: sl.id, munizioni: true });
    }
    return s.eventi.slice(n0);
  }
  const o = offerteStrega(s).find((x) => x.cosa === a.cosa);
  if (!o || !o.puoi || !spendi(s, o.prezzo)) return null;
  bevi(s, a.cosa);
  return s.eventi.slice(n0);
}

/** La pozione bevuta (comprata, o il premio delle campanelle: segreti.ts): l'effetto parte subito (la vita in più della Zuppa di pietra si aggiunge), l'eroe beve per un attimo e non attacca. */
export function bevi(s: TState, id: TPozione): void {
  const h = s.eroe, p = pozioneDef(id);
  h.pozioni.push(id);
  if (p.vita) { const m = vitaBase(h) + p.vita - TEMPLARI.eroe.vita; h.vita += m - h.max; h.max = m; } // la Zuppa: +100 sulla vita dell'eroe
  if (p.volte !== undefined) h.elisir++;
  h.act = 'beve'; h.actT = 0; h.actDur = secToTicks(TEMPLARI.strega.beve); h.ricarica = 0; h.carica = 0;
  ev(s, { t: 'pozione', id });
}
