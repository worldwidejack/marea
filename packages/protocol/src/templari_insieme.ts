// Templari insieme (PROTOCOL.md §9, 10 ott 2026): messaggi del WebSocket `/ws/templari` verso il DO TemplariInsieme. Una sala sola alla
// porta della chiesa: chi è lì con altri preme GIOCA INSIEME ed entra in sala; con almeno 2 chiunque dice SI PARTE. Poi come i dungeon
// insieme (squadra.ts): il server raccoglie gli input di tutti e ogni SQ_TURNO_MS manda a tutti un turno (un input per eroe che vale
// SQ_TICKS tick della sim); ogni client fa girare la stessa partita con gli stessi turni; il server tiene il log e a fine partita il DO del
// lotto di ciascuno la rigioca (replayTemplariInsieme) e paga le ondate superate. Della sim solo `import type` (bundle iniziale).
import type { TAzione } from '@marea/sim/templari/types.ts';
import type { Look } from './messages.ts';
import { isSqInput } from './squadra.ts';
import type { SqInput } from './squadra.ts';

export { SQ_TICKS, SQ_TURNO_MS } from './squadra.ts';
export type { SqInput } from './squadra.ts';
/** Al massimo 4 nella stessa partita (MAX_EROI della sim). */
export const TI_MAX = 4;
export type TiMembro = { id: string; nome: string; look: Look };

export type TiClientMsg =
  /** Si parte (chiunque in sala, con almeno 2 persone). */
  | { t: 'via' }
  /** La chiesa è caricata: il server aspetta tutti (o al massimo 20 s) prima del primo turno. */
  | { t: 'carico' }
  /** Input per il prossimo turno (solo se è cambiato: il server ripete l'ultimo). */
  | { t: 'in'; f: SqInput }
  /** Acquisto dal Mercante o dalla Strega: va nel prossimo turno (la forma la controlla il server con parseTAzioniInsieme). */
  | { t: 'az'; a: TAzione }
  /** Esco dalla sala o dalla partita (per gli altri il mio eroe se ne va: `via` nel turno dopo). */
  | { t: 'esco' };

export type TiServerMsg =
  /** La sala alla porta (a ogni cambio). */
  | { t: 'sala'; membri: TiMembro[]; max: number }
  /** Si parte: seed della partita, gli eroi in ordine (io = il mio indice). */
  | { t: 'parte'; run: string; seed: number; io: number; membri: TiMembro[] }
  /** Un turno: un input per eroe (in ordine); `via` = eroi che escono prima del primo tick del turno, `az` = [eroe, acquisto] da fare
   *  prima del primo tick (dopo le uscite). */
  | { t: 'T'; n: number; f: SqInput[]; via?: number[]; az?: [number, TAzione][] }
  | { t: 'errore'; msg: string };

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Forma dei messaggi del client. null = scarta. */
export function parseTiClient(text: string): TiClientMsg | null {
  if (typeof text !== 'string' || text.length > 256) return null;
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'via': return { t: 'via' };
    case 'carico': return { t: 'carico' };
    case 'esco': return { t: 'esco' };
    case 'in': return isSqInput(m['f']) ? { t: 'in', f: m['f'] } : null;
    case 'az': return m['a'] && typeof m['a'] === 'object' && !Array.isArray(m['a']) ? { t: 'az', a: m['a'] as TAzione } : null;
    default: return null;
  }
}

/** Messaggi del server (lato client): controllo leggero, il server è fidato. */
export function parseTiServer(text: string): TiServerMsg | null {
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'T': return isInt(m['n'], 0, 1e7) && Array.isArray(m['f']) && m['f'].every(isSqInput) && (m['via'] === undefined || (Array.isArray(m['via']) && m['via'].every((i) => isInt(i, 0, TI_MAX - 1)))) && (m['az'] === undefined || Array.isArray(m['az'])) ? (m as TiServerMsg) : null;
    case 'sala': return Array.isArray(m['membri']) ? (m as TiServerMsg) : null;
    case 'parte': return typeof m['run'] === 'string' && isInt(m['seed'], 0, 2 ** 32) && isInt(m['io'], 0, TI_MAX - 1) && Array.isArray(m['membri']) ? (m as TiServerMsg) : null;
    case 'errore': return typeof m['msg'] === 'string' ? { t: 'errore', msg: m['msg'] } : null;
    default: return null;
  }
}
