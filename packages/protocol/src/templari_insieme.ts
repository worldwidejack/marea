// Templari insieme (PROTOCOL.md §9, 10 ott 2026): messaggi del WebSocket `/ws/templari` verso il DO TemplariInsieme. Una sala sola alla
// porta della chiesa: chi è lì con altri preme GIOCA INSIEME ed entra in sala; con almeno 2 chiunque dice SI PARTE. Poi come i dungeon
// insieme (squadra.ts): il server raccoglie gli input di tutti e ogni SQ_TURNO_MS manda a tutti un turno (un input per eroe che vale
// SQ_TICKS tick della sim); ogni client fa girare la stessa partita con gli stessi turni; il server tiene il log e a fine partita il DO del
// lotto di ciascuno la rigioca (replayTemplariInsieme) e paga le ondate superate. Della sim solo `import type` (bundle iniziale).
// Ripresa (15 ott 2026): se la connessione cade (linea persa, o il DO che si riavvia a ogni deploy) il client si ricollega con
// `?run=&idx=&n=` (n = il prossimo turno che aspetta); il server risponde `ripresa` col primo turno che non ha salvato e il client gli
// rimanda in `storia` quelli che ha già ricevuto da lì in poi; poi il server gli manda i turni che gli mancano e la partita va avanti.
import type { TAzione } from '@marea/sim/templari/types.ts';
import type { TClasse } from '@marea/content/templari.ts';
import type { Look } from './messages.ts';
import { isSqInput } from './squadra.ts';
import type { SqInput } from './squadra.ts';

export { SQ_TICKS, SQ_TURNO_MS } from './squadra.ts';
export type { SqInput } from './squadra.ts';
/** Al massimo 4 nella stessa partita (MAX_EROI della sim). */
export const TI_MAX = 4;
/** Turni che il client tiene per la ripresa (60 s): il server salva ogni 5 s, ne servono molti meno. */
export const TI_STORIA = 1200;
/** `classe`: l'eroe del menù d'ingresso (id di templari.json `eroi`; assente = senza). Si sceglie prima di entrare in sala e va
 *  nell'indirizzo del WebSocket (`?classe=`). */
export type TiMembro = { id: string; nome: string; look: Look; classe?: TClasse };

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
  | { t: 'esco' }
  /** Risposta a `ripresa`: i turni ricevuti dal numero chiesto in poi, in ordine (anche nessuno). */
  | { t: 'storia'; turni: TiTurno[] };

/** Un turno della partita: un input per eroe (in ordine); `via` = eroi che escono prima del primo tick del turno, `az` = [eroe, acquisto]
 *  da fare prima del primo tick (dopo le uscite). */
export type TiTurno = { t: 'T'; n: number; f: SqInput[]; via?: number[]; az?: [number, TAzione][] };

export type TiServerMsg =
  /** La sala alla porta (a ogni cambio). */
  | { t: 'sala'; membri: TiMembro[]; max: number }
  /** Si parte: seed della partita, gli eroi in ordine (io = il mio indice). */
  | { t: 'parte'; run: string; seed: number; io: number; membri: TiMembro[] }
  /** Un turno (sopra). */
  | TiTurno
  /** Ricollegato alla partita: il server ha i turni fino a `n` escluso; il client risponde con `storia` da `n` in poi. */
  | { t: 'ripresa'; n: number }
  | { t: 'errore'; msg: string };

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Un turno ben fatto per `eroi` eroi (la storia della ripresa arriva dal client: si controlla tutto). */
export function isTiTurno(v: unknown, eroi: number): v is TiTurno {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const m = v as Record<string, unknown>;
  return m['t'] === 'T' && isInt(m['n'], 0, 1e7) && Array.isArray(m['f']) && m['f'].length === eroi && m['f'].every(isSqInput)
    && (m['via'] === undefined || (Array.isArray(m['via']) && m['via'].every((i) => isInt(i, 0, eroi - 1))))
    && (m['az'] === undefined || (Array.isArray(m['az']) && m['az'].every((x) => Array.isArray(x) && x.length === 2 && isInt(x[0], 0, eroi - 1) && !!x[1] && typeof x[1] === 'object')));
}

/** Forma dei messaggi del client. null = scarta. La `storia` può essere lunga (fino a TI_STORIA turni): i turni li controlla il server
 *  con isTiTurno, quando sa quanti eroi ha la partita. */
export function parseTiClient(text: string): TiClientMsg | null {
  if (typeof text !== 'string') return null;
  if (text.startsWith('{"t":"storia"')) {
    if (text.length > 400_000) return null;
    try { const v = JSON.parse(text) as { turni?: unknown }; return Array.isArray(v.turni) && v.turni.length <= TI_STORIA ? { t: 'storia', turni: v.turni as TiTurno[] } : null; } catch { return null; }
  }
  if (text.length > 256) return null;
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
    case 'ripresa': return isInt(m['n'], 0, 1e7) ? { t: 'ripresa', n: m['n'] } : null;
    case 'errore': return typeof m['msg'] === 'string' ? { t: 'errore', msg: m['msg'] } : null;
    default: return null;
  }
}
