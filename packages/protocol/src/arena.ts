// Duello dell'Arena (PROTOCOL.md §10, docs/ARENA.md): messaggi del WebSocket `/ws/arena` verso il DO Arena. Tre formati (`f` = eroi per squadra:
// 1 = duello, 2 = 2v2, 3 = 3v3) e due modi di trovare gli altri: la CODA VELOCE (`?modo=coda&f=2`: i primi 2×f in coda si sfidano; nei formati
// a squadre, dopo ARENA.rete.attesaBotSecondi senza altri i posti vuoti li prendono i gladiatori automatici) e la SALA con codice (`?modo=sala&f=2`:
// chi la apre riceve un codice di ARENA.rete.codice lettere da dire agli amici, che entrano con `?modo=sala&codice=XXXX`; la prima squadra si
// riempie per prima e chi l'ha aperta preme `via` quando basta: i posti vuoti sono dei gladiatori). Poi come i dungeon insieme (squadra.ts): il
// server raccoglie gli input di tutti e ogni SQ_TURNO_MS manda a tutti un turno (un input per eroe che vale SQ_TICKS tick, più le azioni della
// barra: slot, pozioni, resa); ogni client fa girare lo stesso duello con gli stessi turni. Gli input dei gladiatori li decide il server e li
// mette nel turno come quelli di una persona. Il server fa girare anche lui il duello, a fine partita lo rigioca dal log (replayDuello) e decide
// l'esito: premio nel lotto di ciascuno (niente se tra gli avversari c'erano gladiatori) e `fine` a tutti.
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
/** Un duellante: chi è, come si veste, e la fotografia del suo set (le RunHero degli slot e le pozioni). `bot`: gladiatore automatico. */
export type ArEroe = ArMembro & { look: Look; eroe: ArenaEroe; bot?: true };
/** Un turno: un input per eroe (in ordine), azioni [eroe, azione] da fare prima del primo tick del turno. */
export type ArTurno = { t: 'T'; n: number; f: SqInput[]; az?: [number, ArenaAzione][] };
/** Eroi per squadra: 1 (duello), 2 (2v2) o 3 (3v3). */
export const isFormato = (v: unknown): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3;

export type ArClientMsg =
  /** Il colosseo è caricato: il server aspetta tutti (al massimo ARENA.rete.caricoSecondi) prima del primo turno. */
  | { t: 'carico' }
  /** Input per il prossimo turno (solo se è cambiato: il server ripete l'ultimo). */
  | { t: 'in'; f: SqInput }
  /** Azione della barra (slot, pozione, resa): va nel prossimo turno. */
  | { t: 'az'; a: ArenaAzione }
  /** Chi ha aperto la sala: si parte adesso, i posti vuoti li prendono i gladiatori. */
  | { t: 'via' }
  /** Esco dalla coda o dalla sala; nel duello vale come resa. */
  | { t: 'esco' };

export type ArServerMsg =
  /** In attesa degli altri: in coda (codice vuoto) o nella sala col suo codice; formato, quanti ci sono già (`dentro`) e quanti ne servono
   *  per riempire tutto (`serve` = 2×f); `host`: sei tu che hai aperto la sala (puoi premere `via`). */
  | { t: 'attendi'; modo: 'coda' | 'sala'; codice: string; f?: number; dentro?: number; serve?: number; host?: boolean }
  /** Si parte: seed, tutti i duellanti in ordine (io = il mio indice), la squadra (0 o 1) di ciascuno e la mappa (id di ARENA.mappe). */
  | { t: 'parte'; run: string; seed: number; io: number; eroi: ArEroe[]; squadre?: number[]; mappa?: string }
  | ArTurno
  /** Un duellante ha perso la linea: il duello è fermo e lo aspetta ancora `ms` (chi = suo indice); chi -1 = è tornato, si riparte. */
  | { t: 'attesa'; chi: number; ms: number }
  /** Ricollegato: il server ha i turni fino a `n` escluso e manda subito quelli dal numero chiesto in poi. */
  | { t: 'ripresa'; n: number }
  /** Fine del duello (esito del server dal replay; null = annullato) e il premio di questo giocatore (monete), con `tetto` se il giorno è pieno. */
  | { t: 'fine'; esito: DuelloEsito | null; premio: number; tetto: boolean }
  | { t: 'errore'; msg: string };

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const nEroi = (v: unknown): v is unknown[] => Array.isArray(v) && (v.length === 2 || v.length === 4 || v.length === 6);

/** Forma dei messaggi del client (l'azione la controlla il server con parseArenaAzione). null = scarta. */
export function parseArClient(text: string): ArClientMsg | null {
  if (typeof text !== 'string' || text.length > 256) return null;
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'carico': return { t: 'carico' };
    case 'esco': return { t: 'esco' };
    case 'via': return { t: 'via' };
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
    case 'T': return isInt(m['n'], 0, 1e7) && nEroi(m['f']) && m['f'].every(isSqInput) && (m['az'] === undefined || Array.isArray(m['az'])) ? (m as ArServerMsg) : null;
    case 'attendi': return (m['modo'] === 'coda' || m['modo'] === 'sala') && typeof m['codice'] === 'string' ? (m as ArServerMsg) : null;
    case 'parte': return typeof m['run'] === 'string' && isInt(m['seed'], 0, 2 ** 32) && isInt(m['io'], 0, 5) && nEroi(m['eroi']) && m['io'] < m['eroi'].length
      && (m['squadre'] === undefined || (Array.isArray(m['squadre']) && m['squadre'].length === m['eroi'].length && m['squadre'].every((q) => q === 0 || q === 1))) && (m['mappa'] === undefined || typeof m['mappa'] === 'string') ? (m as ArServerMsg) : null;
    case 'attesa': return isInt(m['chi'], -1, 5) && typeof m['ms'] === 'number' ? (m as ArServerMsg) : null;
    case 'ripresa': return isInt(m['n'], 0, 1e7) ? { t: 'ripresa', n: m['n'] } : null;
    case 'fine': return typeof m['premio'] === 'number' ? (m as ArServerMsg) : null;
    case 'errore': return typeof m['msg'] === 'string' ? { t: 'errore', msg: m['msg'] } : null;
    default: return null;
  }
}

/** Codice della sala: lettere maiuscole senza quelle che si confondono (I, O, L). */
export const AR_LETTERE = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const isCodiceSala = (v: unknown, n: number): v is string => typeof v === 'string' && v.length === n && [...v].every((c) => AR_LETTERE.includes(c));
