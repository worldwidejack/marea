// Azioni sul lotto per gli insetti di Borgo Marea (#445): comprare il retino al negozio dei mobili (finisce nello zaino in «Strumenti» a
// peso 0), colpire un sasso con la pala e scuotere un albero (estrae il server: uno al giorno a testa), prendere un insetto col retino
// (va nello zaino a peso 0 e diventa «visto» nel Diario) e consegnarlo al mobiliere (sparisce, diventa «posseduto»). Puro.
// Venderlo al Contrabbandiere è l'azione `contrabbando` di sempre (rpg/contrabbando.ts `offertaLosca`: prezzo pieno di insetti.json).
import { RETINO } from '@marea/content/insetti.ts';
import { advance } from '../economy/advance.ts';
import { ALBERI_BORGO, SASSI_BORGO, esceDa, insettiOf, insettoDef, liberoValido, possiedeRetino } from '../economy/insetti.ts';
import type { InsettiState, InsettoUscito } from '../economy/insetti.ts';
import { spendi } from '../economy/monete.ts';
import { possiedePala } from '../economy/pala.ts';
import { EconomyError } from '../economy/types.ts';
import type { LotState } from '../economy/types.ts';
import { addTo, removeFrom } from './bag.ts';
import { heroOf } from './hero.ts';

const con = (lot: LotState, s: InsettiState): LotState => ({ ...lot, version: lot.version + 1, insetti: s });

/** Compra il retino (`insetti.json` `retino.monete`, 500): una volta sola, peso 0. */
export function compraRetino(lot0: LotState, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  if (possiedeRetino(lot)) throw new EconomyError('unico', 'Hai già il retino');
  const pagato = spendi(lot, RETINO.monete), h = heroOf(lot);
  return { ...pagato, version: lot.version + 1, hero: { ...h, inv: addTo(h.inv, RETINO.id, 1) } };
}

/**
 * Colpisce il sasso `idx` con la pala o scuote l'albero `idx` (a mani nude o col retino): la prima volta del giorno può uscire un
 * insetto, che resta «uscito» per la sua finestra (più un margine di rete). Le volte dopo non succede niente (`uscito: null`, `gia: true`).
 */
export function cercaInsetto(lot0: LotState, tipo: 'sasso' | 'albero', idx: number, nowMs: number): { lot: LotState; uscito: InsettoUscito | null; gia: boolean } {
  const lot = advance(lot0, nowMs), max = tipo === 'sasso' ? SASSI_BORGO.length : ALBERI_BORGO.length;
  if (!Number.isInteger(idx) || idx < 0 || idx >= max) throw new EconomyError('sconosciuto', tipo === 'sasso' ? 'Sasso sconosciuto' : 'Albero sconosciuto');
  if (tipo === 'sasso' && !possiedePala(lot)) throw new EconomyError('oggetto', 'Serve la pala per colpire i sassi');
  const s = insettiOf(lot, nowMs), fatti = tipo === 'sasso' ? s.sassi : s.alberi;
  if (fatti.includes(idx)) return { lot, uscito: null, gia: true };
  const d = esceDa(tipo, idx, lot.owner, nowMs);
  const uscito: InsettoUscito | null = d ? { k: `${tipo === 'sasso' ? 's' : 'a'}:${s.giorno}:${idx}`, id: d.id, t: nowMs } : null;
  const usciti = uscito ? [...s.usciti.filter((u) => u.k !== uscito.k), uscito] : s.usciti;
  const next: InsettiState = tipo === 'sasso' ? { ...s, sassi: [...s.sassi, idx], usciti } : { ...s, alberi: [...s.alberi, idx], usciti };
  return { lot: con(lot, next), uscito, gia: false };
}

/** Prende col retino l'insetto con chiave `k` (in giro: `p:…`, uscito da un sasso o da un albero: `s:…` / `a:…`). Nello zaino a peso 0. */
export function catturaInsetto(lot0: LotState, k: string, nowMs: number): { lot: LotState; id: string } {
  const lot = advance(lot0, nowMs);
  if (!possiedeRetino(lot)) throw new EconomyError('oggetto', 'Serve il retino');
  const s = insettiOf(lot, nowMs);
  let id: string, usciti = s.usciti, presi = s.presi;
  if (k.startsWith('p:')) {
    const l = liberoValido(k, nowMs);
    if (!l) throw new EconomyError('posizione', 'Questo insetto è già volato via');
    if (presi.includes(k)) throw new EconomyError('unico', 'Questo insetto l’hai già preso');
    id = l.id; presi = [...presi, k];
  } else {
    const u = usciti.find((x) => x.k === k);
    if (!u) throw new EconomyError('posizione', 'Questo insetto è già scappato');
    id = u.id; usciti = usciti.filter((x) => x !== u);
  }
  if (!insettoDef(id)) throw new EconomyError('sconosciuto', 'Insetto sconosciuto');
  const h = heroOf(lot), visti = { ...s.visti, [id]: (s.visti[id] ?? 0) + 1 };
  return { lot: { ...con(lot, { ...s, visti, presi, usciti }), hero: { ...h, inv: addTo(h.inv, id, 1) } }, id };
}

/** Consegna un insetto dello zaino al mobiliere: gratis, sparisce, e nella collezione diventa «posseduto» (si legge la sua scheda). */
export function consegnaInsetto(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), d = insettoDef(id);
  if (!d) throw new EconomyError('sconosciuto', 'Insetto sconosciuto');
  const h = heroOf(lot), s = insettiOf(lot, nowMs);
  if ((h.inv[id] ?? 0) < 1) throw new EconomyError('oggetto', `Non hai ${d.nome} nello zaino`);
  if (s.posseduti.includes(id)) throw new EconomyError('unico', `${d.nome} ce l’ha già: vendilo al Contrabbandiere`);
  return { ...con(lot, { ...s, posseduti: [...s.posseduti, id] }), hero: { ...h, inv: removeFrom(h.inv, id, 1) } };
}
