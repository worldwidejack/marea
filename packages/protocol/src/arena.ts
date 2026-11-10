// Arena (PROTOCOL.md §10, docs/ARENA.md): messaggi del WebSocket `/ws/arena` verso il DO Arena. Quattro modalità (`m`: sopravvivenza,
// stelle, controllo, rapina), ognuna con le sue grandezze di squadra (`f` = eroi per squadra: la Sopravvivenza 1 o 2 su 10 eroi, Stelle e
// Controllo 3, Rapinatori 2 o 3) e due modi di trovare gli altri: la CODA VELOCE (`?modo=coda&m=stelle&f=3`: si parte a partita piena o, dopo
// ARENA.rete.attesaBotSecondi, con chi c'è e i gladiatori automatici sui posti vuoti) e la SALA con codice (`?modo=sala&m=stelle&f=3`: chi la
// apre riceve un codice di ARENA.rete.codice lettere da dire agli amici, che entrano con `?modo=sala&codice=XXXX`; la squadra di chi l'ha
// aperta si riempie per prima e chi l'ha aperta preme `via` quando basta: i posti vuoti sono dei gladiatori). Poi come i dungeon insieme
// (squadra.ts): il server raccoglie gli input di tutti e ogni SQ_TURNO_MS manda a tutti un turno (un input per eroe che vale SQ_TICKS tick, più
// le azioni della barra: slot, ulti, resa); ogni client fa girare la stessa partita con gli stessi turni. Gli input dei gladiatori li decide il
// server e li mette nel turno come quelli di una persona. Il server fa girare anche lui la partita, alla fine la rigioca dal log
// (replayPartita) e decide l'esito: premio nel lotto di ciascuno (niente se tra gli avversari non c'è nessuna persona) e `fine` a tutti.
// Linea persa: la partita si ferma (`attesa`) e chi è caduto ha ARENA.rete.staccatoSecondi per ricollegarsi (`?run=&idx=&n=`, n = il prossimo
// turno che aspetta: il server gli rimanda quelli persi); poi è dato per arreso. Della sim solo `import type` (bundle iniziale).
import type { ArenaAzione, PartitaEsito } from '@marea/sim/arena/partita.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import type { Look } from './messages.ts';
import { isSqInput } from './squadra.ts';
import type { SqInput } from './squadra.ts';

export { SQ_TICKS, SQ_TURNO_MS } from './squadra.ts';
export type { SqInput } from './squadra.ts';
export type ArMembro = { id: string; nome: string };
/** Un giocatore: chi è, come si veste, e la fotografia della sua build (le RunHero degli slot, la dote e l'ulti). `bot`: gladiatore automatico. */
export type ArEroe = ArMembro & { look: Look; eroe: ArenaEroe; bot?: true };
/** Un turno: un input per eroe (in ordine), azioni [eroe, azione] da fare prima del primo tick del turno. */
export type ArTurno = { t: 'T'; n: number; f: SqInput[]; az?: [number, ArenaAzione][] };
/** Le modalità (gli eroi per squadra possibili sono in ARENA.modi). */
const MODI_ARENA: readonly ArenaModo[] = ['sopravvivenza', 'stelle', 'controllo', 'rapina'];
export const isModo = (v: unknown): v is ArenaModo => typeof v === 'string' && (MODI_ARENA as readonly string[]).includes(v);
/** Eroi in una partita: da 4 (Rapinatori 2 contro 2) a 10 (Sopravvivenza). */
const AR_EROI_MAX = 10;

export type ArClientMsg =
  /** L'arena è caricata: il server aspetta tutti (al massimo ARENA.rete.caricoSecondi) prima del primo turno. */
  | { t: 'carico' }
  /** Input per il prossimo turno (solo se è cambiato: il server ripete l'ultimo). */
  | { t: 'in'; f: SqInput }
  /** Azione della barra (slot, ulti, resa): va nel prossimo turno. */
  | { t: 'az'; a: ArenaAzione }
  /** Chi ha aperto la sala: si parte adesso, i posti vuoti li prendono i gladiatori. */
  | { t: 'via' }
  /** Esco dalla coda o dalla sala; in partita vale come resa. */
  | { t: 'esco' };

export type ArServerMsg =
  /** In attesa degli altri: in coda (codice vuoto) o nella sala col suo codice; modalità e eroi per squadra, quanti ci sono già (`dentro`) e
   *  quanti ne servono per riempire tutto (`serve`); `host`: sei tu che hai aperto la sala (puoi premere `via`). */
  | { t: 'attendi'; modo: 'coda' | 'sala'; codice: string; m: ArenaModo; f: number; dentro: number; serve: number; host?: boolean }
  /** Si parte: seed, tutti i giocatori in ordine di squadra (io = il mio indice), modalità, eroi per squadra e mappa (id di ARENA.mappe). */
  | { t: 'parte'; run: string; seed: number; io: number; eroi: ArEroe[]; m: ArenaModo; f: number; mappa: string }
  | ArTurno
  /** Un giocatore ha perso la linea: la partita è ferma e lo aspetta ancora `ms` (chi = suo indice); chi -1 = è tornato, si riparte. */
  | { t: 'attesa'; chi: number; ms: number }
  /** Ricollegato: il server ha i turni fino a `n` escluso e manda subito quelli dal numero chiesto in poi. */
  | { t: 'ripresa'; n: number }
  /** Fine della partita (esito del server dal replay; null = annullata) e il premio di questo giocatore (monete), con `tetto` se il giorno è pieno. */
  | { t: 'fine'; esito: PartitaEsito | null; premio: number; tetto: boolean }
  | { t: 'errore'; msg: string };

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const nEroi = (v: unknown): v is unknown[] => Array.isArray(v) && v.length >= 4 && v.length <= AR_EROI_MAX;

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
    case 'attendi': return (m['modo'] === 'coda' || m['modo'] === 'sala') && typeof m['codice'] === 'string' && isModo(m['m']) ? (m as ArServerMsg) : null;
    case 'parte': return typeof m['run'] === 'string' && isInt(m['seed'], 0, 2 ** 32) && isInt(m['io'], 0, AR_EROI_MAX - 1) && nEroi(m['eroi']) && m['io'] < m['eroi'].length
      && isModo(m['m']) && isInt(m['f'], 1, 3) && typeof m['mappa'] === 'string' ? (m as ArServerMsg) : null;
    case 'attesa': return isInt(m['chi'], -1, AR_EROI_MAX - 1) && typeof m['ms'] === 'number' ? (m as ArServerMsg) : null;
    case 'ripresa': return isInt(m['n'], 0, 1e7) ? { t: 'ripresa', n: m['n'] } : null;
    case 'fine': return typeof m['premio'] === 'number' ? (m as ArServerMsg) : null;
    case 'errore': return typeof m['msg'] === 'string' ? { t: 'errore', msg: m['msg'] } : null;
    default: return null;
  }
}

/** Codice della sala: lettere maiuscole senza quelle che si confondono (I, O, L). */
export const AR_LETTERE = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const isCodiceSala = (v: unknown, n: number): v is string => typeof v === 'string' && v.length === n && [...v].every((c) => AR_LETTERE.includes(c));
