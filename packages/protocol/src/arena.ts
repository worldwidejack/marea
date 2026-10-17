// Duello dell'Arena (PROTOCOL.md §10, docs/ARENA.md): messaggi del WebSocket `/ws/arena` verso il DO Arena. Due modi di trovare l'avversario:
// la CODA VELOCE (`?modo=coda`: i primi due in coda si sfidano) e la SALA con codice (`?modo=sala`: chi la apre riceve un codice di
// ARENA.rete.codice lettere da dire all'amico, che entra con `?modo=sala&codice=XXXX`). Poi come i dungeon insieme (squadra.ts): il server
// raccoglie gli input dei due e ogni SQ_TURNO_MS manda a tutti e due un turno (un input per eroe che vale SQ_TICKS tick, più le azioni della
// barra: slot, pozioni, resa); ogni client fa girare lo stesso duello con gli stessi turni. Il server fa girare anche lui il duello, a fine
// partita lo rigioca dal log (replayDuello) e decide l'esito: premio nel lotto di ciascuno e `fine` a tutti e due.
// Linea persa: il duello si ferma (`attesa`) e chi è caduto ha ARENA.rete.staccatoSecondi per ricollegarsi (`?run=&idx=&n=`, n = il prossimo
// turno che aspetta: il server gli rimanda quelli persi); poi è dato per arreso. Della sim solo `import type` (bundle iniziale).
import type { ArenaAzione, DuelloEsito } from '@marea/sim/arena/duello.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import type { Look } from './messages.ts';
import { isSqInput } from './squadra.ts';
import type { SqInput } from './squadra.ts';

export { SQ_TICKS, SQ_TURNO_MS } from './squadra.ts';
export type { SqInput } from './squadra.ts';
export type ArMembro = { id: string; nome: string };
/** Un duellante: chi è, come si veste, e la fotografia del suo set (le RunHero degli slot e le pozioni). */
export type ArEroe = ArMembro & { look: Look; eroe: ArenaEroe };
/** Un turno: un input per eroe (in ordine), azioni [eroe, azione] da fare prima del primo tick del turno. */
export type ArTurno = { t: 'T'; n: number; f: SqInput[]; az?: [number, ArenaAzione][] };

export type ArClientMsg =
  /** Il colosseo è caricato: il server aspetta tutti e due (al massimo ARENA.rete.caricoSecondi) prima del primo turno. */
  | { t: 'carico' }
  /** Input per il prossimo turno (solo se è cambiato: il server ripete l'ultimo). */
  | { t: 'in'; f: SqInput }
  /** Azione della barra (slot, pozione, resa): va nel prossimo turno. */
  | { t: 'az'; a: ArenaAzione }
  /** Esco dalla coda o dalla sala; nel duello vale come resa. */
  | { t: 'esco' };

export type ArServerMsg =
  /** In attesa dell'avversario: in coda (codice vuoto) o nella sala col suo codice. */
  | { t: 'attendi'; modo: 'coda' | 'sala'; codice: string }
  /** Si parte: seed, i due duellanti in ordine (io = il mio indice). */
  | { t: 'parte'; run: string; seed: number; io: number; eroi: ArEroe[] }
  | ArTurno
  /** L'avversario ha perso la linea: il duello è fermo e lo aspetta ancora `ms` (chi = suo indice); chi -1 = è tornato, si riparte. */
  | { t: 'attesa'; chi: number; ms: number }
  /** Ricollegato: il server ha i turni fino a `n` escluso e manda subito quelli dal numero chiesto in poi. */
  | { t: 'ripresa'; n: number }
  /** Fine del duello (esito del server dal replay; null = annullato) e il premio di questo giocatore (monete), con `tetto` se il giorno è pieno. */
  | { t: 'fine'; esito: DuelloEsito | null; premio: number; tetto: boolean }
  | { t: 'errore'; msg: string };

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Forma dei messaggi del client (l'azione la controlla il server con parseArenaAzione). null = scarta. */
export function parseArClient(text: string): ArClientMsg | null {
  if (typeof text !== 'string' || text.length > 256) return null;
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'carico': return { t: 'carico' };
    case 'esco': return { t: 'esco' };
    case 'in': return isSqInput(m['f']) ? { t: 'in', f: m['f'] } : null;
    case 'az': return m['a'] && typeof m['a'] === 'object' && !Array.isArray(m['a']) ? { t: 'az', a: m['a'] as ArenaAzione } : null;
    default: return null;
  }
}

/** Messaggi del server (lato client): controllo leggero, il server è fidato. */
export function parseArServer(text: string): ArServerMsg | null {
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'T': return isInt(m['n'], 0, 1e7) && Array.isArray(m['f']) && m['f'].length === 2 && m['f'].every(isSqInput) && (m['az'] === undefined || Array.isArray(m['az'])) ? (m as ArServerMsg) : null;
    case 'attendi': return (m['modo'] === 'coda' || m['modo'] === 'sala') && typeof m['codice'] === 'string' ? (m as ArServerMsg) : null;
    case 'parte': return typeof m['run'] === 'string' && isInt(m['seed'], 0, 2 ** 32) && isInt(m['io'], 0, 1) && Array.isArray(m['eroi']) && m['eroi'].length === 2 ? (m as ArServerMsg) : null;
    case 'attesa': return isInt(m['chi'], -1, 1) && typeof m['ms'] === 'number' ? (m as ArServerMsg) : null;
    case 'ripresa': return isInt(m['n'], 0, 1e7) ? { t: 'ripresa', n: m['n'] } : null;
    case 'fine': return typeof m['premio'] === 'number' ? (m as ArServerMsg) : null;
    case 'errore': return typeof m['msg'] === 'string' ? { t: 'errore', msg: m['msg'] } : null;
    default: return null;
  }
}

/** Codice della sala: lettere maiuscole senza quelle che si confondono (I, O, L). */
export const AR_LETTERE = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const isCodiceSala = (v: unknown, n: number): v is string => typeof v === 'string' && v.length === n && [...v].every((c) => AR_LETTERE.includes(c));
