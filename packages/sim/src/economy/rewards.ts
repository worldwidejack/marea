// Premi dei minigiochi: monete nelle partite da solo e Faro acceso dopo una medaglia (edificio spento).
import { BALANCE, MINIGAMES_CFG, building } from '@marea/content';
import type { PremioExtra } from '@marea/content';
import type { Medal } from '../minigames/types.ts';
import { advance } from './advance.ts';
import { mappeDaOro } from '../world/temi.ts';
import { guadagna } from './monete.ts';
import { EconomyError } from './types.ts';
import type { LotState, SoloState } from './types.ts';

const HOUR = 3_600_000;
/** Fine del boost del Faro dopo una vittoria (un solo Faro attivo: si rinnova, non si somma); senza Faro o senza vittoria resta com'è. */
function faroBoost(lot: LotState, win: boolean, nowMs: number): number {
  const until = lot.boostUntilMs ?? 0;
  const faro = lot.buildings.find((b) => b.building === 'faro' && b.level >= 1);
  if (!win || !faro) return until;
  const hours = building('faro').levels[faro.level - 1]?.boostHours ?? 2;
  return Math.max(until, nowMs + hours * HOUR);
}

// ---------- minigiochi da solo ----------
const DAY = 86_400_000;
const NO_SOLO: SoloState = { day: 0, premiate: 0, giocate: 0, pending: null };
/** Stato «da solo» del lotto, col conteggio azzerato se è cambiato il giorno UTC. */
export function soloOf(lot: LotState, nowMs: number): SoloState {
  const s = lot.solo ?? NO_SOLO, day = Math.floor(nowMs / DAY);
  return s.day === day ? s : { ...s, day, premiate: 0 };
}
/** Monete di una partita da solo per medaglia (senza medaglia = premio di consolazione); più il `premioExtra` del minigioco, se ne ha uno (es. la Caccia alle perle: l'oro dà monete in più). */
export function soloPrize(medal: Medal, minigame?: string): number {
  const p = BALANCE.solo.premi[medal ?? 'nessuna'];
  const cfg = minigame && Object.hasOwn(MINIGAMES_CFG, minigame) ? (MINIGAMES_CFG as Record<string, { premioExtra?: PremioExtra }>)[minigame] : undefined;
  const x = medal ? cfg?.premioExtra?.[medal] : undefined;
  return p + (x ?? 0);
}
/** Partite premiate che restano oggi. */
export function soloLeft(lot: LotState, nowMs: number): number {
  return Math.max(0, BALANCE.solo.premiateAlGiorno - soloOf(lot, nowMs).premiate);
}
/** Il server apre una partita: il seed lo sceglie lui (una sola aperta per volta: la nuova sostituisce la vecchia). */
export function startSolo(lot: LotState, minigame: string, seed: number, nowMs: number, difficulty: 1 | 2 | 3 = 2, opzioni?: Record<string, string>): LotState {
  const s = soloOf(lot, nowMs);
  const pending = { minigame, seed: seed >>> 0, difficulty, startMs: nowMs, ...(opzioni && Object.keys(opzioni).length ? { opzioni: { ...opzioni } } : {}) };
  return { ...lot, version: lot.version + 1, solo: { ...s, pending } };
}
/** `mappe`: mappe delle isole a tema trovate con questa partita (#68: la prima medaglia d'oro regala quella del Giardino). */
export type SoloOutcome = { lot: LotState; premio: number; premiata: boolean; mappe: string[] };
/**
 * Chiude la partita aperta con la medaglia che il server ha ricalcolato rigiocando gli input. Premio pieno finché ci sono partite
 * premiate oggi, poi zero (si gioca lo stesso).
 */
export function finishSolo(lot0: LotState, medal: Medal, nowMs: number): SoloOutcome {
  const s = soloOf(lot0, nowMs);
  if (!s.pending) throw new EconomyError('partita', 'Nessuna partita aperta: riparti dal via');
  const premiata = s.premiate < BALANCE.solo.premiateAlGiorno;
  const premio = premiata ? soloPrize(medal, s.pending.minigame) : 0;
  const lot = advance(lot0, nowMs);
  const mappe = medal === 'oro' ? mappeDaOro().filter((m) => !(lot.mappe ?? []).includes(m)) : [];
  return {
    premio, premiata, mappe,
    lot: guadagna({
      ...lot,
      ...(mappe.length ? { mappe: [...(lot.mappe ?? []), ...mappe] } : {}),
      version: lot.version + 1,
      boostUntilMs: faroBoost(lot, medal !== null, nowMs), // una medaglia accende il Faro come una vittoria
      solo: { day: s.day, premiate: s.premiate + (premiata ? 1 : 0), giocate: s.giocate + 1, pending: null },
    }, premio),
  };
}
