// Azioni sul lotto per i paesani di Borgo Marea: parlarci (primo incontro, messaggio portato, favore riscosso o scaduto),
// accettare o rifiutare il favore che chiedono, regalare il pesce o l'insetto chiesto. Puro: le usa il DO del lotto, che salva.
// Il favore lo calcola economy/paesani.ts uguale sul server e sul client: qui si ricontrolla che sia proprio quello della fascia.
import { MOBILI } from '@marea/content';
import { PAESANI_CFG } from '@marea/content/paesani.ts';
import { advance } from '../economy/advance.ts';
import { cosaSuccede, isPaesano, offertaSlot, paesaniOf, puoChiedere, slotAt } from '../economy/paesani.ts';
import type { EventoPaesano, Favore, PaesaniState, Premio } from '../economy/paesani.ts';
import { guadagna } from '../economy/monete.ts';
import { EconomyError } from '../economy/types.ts';
import type { LotState } from '../economy/types.ts';
import { removeFrom } from './bag.ts';
import { heroOf } from './hero.ts';

const MIN = 60_000, F = PAESANI_CFG.favori;
const con = (lot: LotState, s: PaesaniState): LotState => ({ ...lot, version: lot.version + 1, paesani: s });
const chi = (id: string) => { if (!isPaesano(id)) throw new EconomyError('sconosciuto', 'Non conosco nessuno con questo nome'); };

/** Il premio di un favore nel lotto: monete (libro mastro in pari) o un mobile nel magazzino di casa. */
function dai(lot: LotState, p: Premio): LotState {
  if ('monete' in p) return guadagna(lot, p.monete);
  if (!MOBILI.some((m) => m.id === p.mobile)) return lot;
  const c = lot.casa ?? {}, mag = { ...(c.magazzino ?? {}) };
  mag[p.mobile] = (mag[p.mobile] ?? 0) + 1;
  return { ...lot, casa: { ...c, magazzino: mag } };
}

/**
 * Parli col paesano `id`: da adesso lo conosci; se è lui che aspetta il tuo messaggio lo riceve; se torni da chi te l'ha mandato a dire
 * ti paga; se il favore che ti aveva chiesto è scaduto lo dimentica. `cambiato` = il lotto da salvare è diverso (se no, si può non scrivere).
 */
export function parlaPaesano(lot0: LotState, id: string, nowMs: number): { lot: LotState; evento: EventoPaesano; premio: Premio | null; cambiato: boolean } {
  chi(id);
  const lot = advance(lot0, nowMs), s = paesaniOf(lot, nowMs), ev = cosaSuccede(lot, id, nowMs);
  let next: PaesaniState = s, premio: Premio | null = null;
  if (!s.conosciuti.includes(id)) next = { ...next, conosciuti: [...next.conosciuti, id] };
  if (ev.k === 'messaggio') next = { ...next, favore: { ...ev.favore, detto: true } };
  else if (ev.k === 'scaduto') next = { ...next, favore: null };
  else if (ev.k === 'fatto') { next = { ...next, favore: null, pausaFino: nowMs + F.pausaMin.fatto * MIN }; premio = ev.favore.premio; }
  if (next === s) return { lot: lot0, evento: ev, premio: null, cambiato: false };
  const out = con(lot, next);
  return { lot: premio ? dai(out, premio) : out, evento: ev, premio, cambiato: true };
}

/** Accetti il favore che il paesano `id` ti ha chiesto nella fascia `slot` (questa o quella prima: la rete può arrivare tardi). */
export function accettaFavore(lot0: LotState, id: string, slot: number, nowMs: number): { lot: LotState; favore: Favore } {
  chi(id);
  const lot = advance(lot0, nowMs), cur = slotAt(nowMs);
  if (!Number.isInteger(slot) || (slot !== cur && slot !== cur - 1) || !puoChiedere(lot, id, nowMs)) throw new EconomyError('requisito', 'Ci ha ripensato: riparlaci tra un po\'');
  const s = paesaniOf(lot, nowMs), o = offertaSlot(lot, id, slot, s.accettati);
  if (!o) throw new EconomyError('requisito', 'Non ti ha chiesto niente');
  const scade = nowMs + o.durata;
  const favore: Favore = o.tipo === 'parla'
    ? { tipo: 'parla', da: o.da, a: o.a, msg: o.msg, scade, detto: false, premio: o.premio }
    : { tipo: 'porta', da: o.da, cosa: o.cosa, id: o.id, scade, premio: o.premio };
  return { lot: con(lot, { ...s, favore, accettati: s.accettati + 1 }), favore };
}

/** NON ORA: per un po' (`pausaMin.no`) nessuno ti chiede favori. */
export function rifiutaFavore(lot0: LotState, id: string, nowMs: number): LotState {
  chi(id);
  const lot = advance(lot0, nowMs), s = paesaniOf(lot, nowMs);
  return con(lot, { ...s, pausaFino: Math.max(s.pausaFino, nowMs + F.pausaMin.no * MIN) });
}

/** Regali al paesano `id` il pesce o l'insetto che ti ha chiesto (dallo zaino, uno): ti paga, e il favore è fatto. */
export function donaFavore(lot0: LotState, id: string, nowMs: number): { lot: LotState; premio: Premio } {
  chi(id);
  const lot = advance(lot0, nowMs), ev = cosaSuccede(lot, id, nowMs);
  if (ev.k === 'scaduto') throw new EconomyError('requisito', 'Troppo tardi: il tempo è scaduto');
  if (ev.k === 'promemoria') throw new EconomyError('oggetto', 'Non ce l\'hai nello zaino');
  if (ev.k !== 'dono') throw new EconomyError('requisito', 'Non ti ha chiesto niente');
  const s = paesaniOf(lot, nowMs), h = heroOf(lot), f = ev.favore;
  const out = con({ ...lot, hero: { ...h, inv: removeFrom(h.inv, f.id, 1) } }, { ...s, favore: null, pausaFino: nowMs + F.pausaMin.fatto * MIN });
  return { lot: dai(out, f.premio), premio: f.premio };
}
