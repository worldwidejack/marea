// Dungeon insieme (#118, PROTOCOL.md §7): messaggi del WebSocket `/ws/squadra/<dungeon>` verso il DO Spedizioni. Squadra all'ingresso,
// poi partita in tempo reale: il server raccoglie gli input di tutti e ogni SQ_TURNO_MS manda a tutti un turno (un input per eroe, che vale
// SQ_TICKS tick della sim, più le azioni dal menu); ogni client fa girare la stessa sim con gli stessi turni, il server tiene il log e a fine
// spedizione il DO del lotto la rigioca (replayParty). Tipi della sim solo come `import type`: questo file va anche nel bundle iniziale.
import type { DungeonAzione } from '@marea/sim/dungeon/types.ts';
import type { HeroState, RunHero } from '@marea/sim/rpg/types.ts';
import type { Look } from './messages.ts';

/** Un turno ogni 50 ms = 3 tick della sim a 60 Hz. */
export const SQ_TURNO_MS = 50;
export const SQ_TICKS = 3;
/** Input di un eroe per un turno: [mx×8, my×8, bit a|b<<1|c<<2|d<<3, mira?] (come una riga di PackedDungeon senza il conteggio). La mira col
 *  mouse (1..SQ_MIRA_MAX) c'è solo se l'eroe sta puntando; SQ_MIRA_MAX = AIM_N di sim/dungeon/mira.ts (qui non si importa: bundle iniziale). */
export type SqInput = [number, number, number, number?];
export const SQ_MIRA_MAX = 240;
export type SqMembro = { id: string; nome: string };
export type SqEroe = SqMembro & { look: Look; hero: RunHero; stato: HeroState | null };

export type SqClientMsg =
  /** Si parte (chiunque della squadra, con almeno 2 persone). */
  | { t: 'via' }
  /** Il dungeon è caricato: il server aspetta tutti (o al massimo 20 s) prima del primo turno. */
  | { t: 'carico' }
  /** Input per il prossimo turno (solo se è cambiato: il server ripete l'ultimo). */
  | { t: 'in'; f: SqInput }
  /** Azione dal menu (equip, butta, salva, esci): va nel prossimo turno. */
  | { t: 'az'; a: DungeonAzione }
  /** Esco dalla squadra o dalla spedizione (per gli altri l'eroe se ne va: azione `ritira`). */
  | { t: 'esco' };

export type SqServerMsg =
  /** La squadra all'ingresso (a ogni cambio). */
  | { t: 'squadra'; dungeon: string; membri: SqMembro[]; max: number }
  /** Si scende: seed, gli eroi in ordine (io = il mio indice). */
  | { t: 'parte'; run: string; dungeon: string; seed: number; io: number; eroi: SqEroe[] }
  /** Un turno: un input per eroe (in ordine), azioni [eroe, azione] da applicare prima del primo tick del turno. */
  | { t: 'T'; n: number; f: SqInput[]; az?: [number, DungeonAzione][] }
  | { t: 'errore'; msg: string };

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
export const isSqInput = (v: unknown): v is SqInput =>
  Array.isArray(v) && (v.length === 3 || v.length === 4) && isInt(v[0], -8, 8) && isInt(v[1], -8, 8) && isInt(v[2], 0, 15) && (v.length === 3 || isInt(v[3], 0, SQ_MIRA_MAX));

/** Forma dei messaggi del client (l'azione la controlla il server con parseDungeonAzione). null = scarta. */
export function parseSqClient(text: string): SqClientMsg | null {
  if (typeof text !== 'string' || text.length > 1024) return null;
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'via': return { t: 'via' };
    case 'carico': return { t: 'carico' };
    case 'esco': return { t: 'esco' };
    case 'in': return isSqInput(m['f']) ? { t: 'in', f: m['f'] } : null;
    case 'az': return m['a'] && typeof m['a'] === 'object' ? { t: 'az', a: m['a'] as DungeonAzione } : null;
    default: return null;
  }
}

/** Messaggi del server (lato client): controllo leggero, il server è fidato. */
export function parseSqServer(text: string): SqServerMsg | null {
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'T': return isInt(m['n'], 0, 1e7) && Array.isArray(m['f']) && m['f'].every(isSqInput) ? (m as SqServerMsg) : null;
    case 'squadra': return typeof m['dungeon'] === 'string' && Array.isArray(m['membri']) ? (m as SqServerMsg) : null;
    case 'parte': return typeof m['run'] === 'string' && isInt(m['seed'], 0, 2 ** 32) && isInt(m['io'], 0, 7) && Array.isArray(m['eroi']) ? (m as SqServerMsg) : null;
    case 'errore': return typeof m['msg'] === 'string' ? { t: 'errore', msg: m['msg'] } : null;
    default: return null;
  }
}
