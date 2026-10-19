// Azioni sul lotto per i pesci (#457): comprare la canna al negozio dei mobili (nello zaino in «Strumenti» a peso 0), tirare su un pesce
// (va nello zaino a peso 0 e diventa «visto» nel Diario) e consegnarlo al mobiliere (sparisce, diventa «catturato»). Puro.
// Le ombre sono uguali per tutti nel turno (economy/pesci.ts): il server controlla solo che la chiave esista adesso e che quell'ombra non
// l'abbia già pescata tu. Venderlo al Contrabbandiere è l'azione `contrabbando` di sempre (prezzo pieno di pesci.json, come gli insetti).
import { CANNA } from '@marea/content/pesci.ts';
import { advance } from '../economy/advance.ts';
import { ombraValida, pesceDef, pesciOf, possiedeCanna } from '../economy/pesci.ts';
import type { PesciState } from '../economy/pesci.ts';
import { spendi } from '../economy/monete.ts';
import { EconomyError } from '../economy/types.ts';
import type { LotState } from '../economy/types.ts';
import { addTo, removeFrom } from './bag.ts';
import { heroOf } from './hero.ts';

const con = (lot: LotState, s: PesciState): LotState => ({ ...lot, version: lot.version + 1, pesci: s });

/** Compra la canna (`pesci.json` `canna.monete`): una volta sola, peso 0. */
export function compraCanna(lot0: LotState, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  if (possiedeCanna(lot)) throw new EconomyError('unico', 'Hai già la canna da pesca');
  const pagato = spendi(lot, CANNA.monete), h = heroOf(lot);
  return { ...pagato, version: lot.version + 1, hero: { ...h, inv: addTo(h.inv, CANNA.id, 1) } };
}

/** Tira su il pesce dell'ombra `k` (`r:…` di riva, `b:…` della barca): nello zaino a peso 0, +1 visto. */
export function catturaPesce(lot0: LotState, k: string, nowMs: number): { lot: LotState; id: string } {
  const lot = advance(lot0, nowMs);
  if (!possiedeCanna(lot)) throw new EconomyError('oggetto', 'Serve la canna da pesca');
  const o = ombraValida(k, nowMs);
  if (!o) throw new EconomyError('posizione', 'Questo pesce è già andato via');
  const s = pesciOf(lot, nowMs);
  if (s.presi.includes(k)) throw new EconomyError('unico', 'Questo pesce l’hai già preso');
  if (!pesceDef(o.id)) throw new EconomyError('sconosciuto', 'Pesce sconosciuto');
  const h = heroOf(lot), visti = { ...s.visti, [o.id]: (s.visti[o.id] ?? 0) + 1 };
  return { lot: { ...con(lot, { ...s, visti, presi: [...s.presi, k] }), hero: { ...h, inv: addTo(h.inv, o.id, 1) } }, id: o.id };
}

/** Consegna un pesce dello zaino al mobiliere: gratis, sparisce, e nella collezione diventa «catturato» (si legge la sua scheda). */
export function consegnaPesce(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), d = pesceDef(id);
  if (!d) throw new EconomyError('sconosciuto', 'Pesce sconosciuto');
  const h = heroOf(lot), s = pesciOf(lot, nowMs);
  if ((h.inv[id] ?? 0) < 1) throw new EconomyError('oggetto', `Non hai ${d.nome} nello zaino`);
  if (s.posseduti.includes(id)) throw new EconomyError('unico', `${d.nome} ce l’ha già: vendilo al Contrabbandiere`);
  return { ...con(lot, { ...s, posseduti: [...s.posseduti, id] }), hero: { ...h, inv: removeFrom(h.inv, id, 1) } };
}
