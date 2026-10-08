// Premi dei minigiochi: Perle per medaglia nelle sfide (mai zero), premio in risorse nelle partite da solo, Faro acceso dopo una vittoria.
import { BALANCE, building } from '@marea/content';
import type { Medal } from '../minigames/types.ts';
import { advance } from './advance.ts';
import { EconomyError, ZERO, add } from './types.ts';
import type { LotState, Resources, SoloState } from './types.ts';

const HOUR = 3_600_000;
/** `esito` c'è solo nelle sfide: 'sconfitta' → almeno le Perle di consolazione; 'vittoria' accende il Faro anche senza medaglia. Senza esito (partita da solo) vince chi prende una medaglia. */
export type GameOutcome = { medal: Medal; esito?: 'vittoria' | 'sconfitta' | 'parita' };

export function perleFor(o: GameOutcome): number {
  const P = BALANCE.perleMedaglia;
  const m = o.medal ? P[o.medal] : 0;
  return Math.max(m, P.sconfitta);
}

/** Fine del boost del Faro dopo una vittoria (un solo Faro attivo: si rinnova, non si somma); senza Faro o senza vittoria resta com'è. */
function faroBoost(lot: LotState, win: boolean, nowMs: number): number {
  const until = lot.boostUntilMs ?? 0;
  const faro = lot.buildings.find((b) => b.building === 'faro' && b.level >= 1);
  if (!win || !faro) return until;
  const hours = building('faro').levels[faro.level - 1]?.boostHours ?? 2;
  return Math.max(until, nowMs + hours * HOUR);
}

export function applyMinigameResult(lot0: LotState, result: GameOutcome, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const gained: Resources = { ...ZERO, perle: perleFor(result) };
  const win = result.esito ? result.esito === 'vittoria' : result.medal !== null;
  return {
    ...lot,
    version: lot.version + 1,
    resources: add(lot.resources, gained),
    ledger: { ...lot.ledger, generated: add(lot.ledger.generated, gained) },
    boostUntilMs: faroBoost(lot, win, nowMs),
  };
}

// ---------- minigiochi da solo (senza posta) ----------
const DAY = 86_400_000;
const NO_SOLO: SoloState = { day: 0, premiate: 0, giocate: 0, pending: null };
/** Stato «da solo» del lotto, col conteggio azzerato se è cambiato il giorno UTC. */
export function soloOf(lot: LotState, nowMs: number): SoloState {
  const s = lot.solo ?? NO_SOLO, day = Math.floor(nowMs / DAY);
  return s.day === day ? s : { ...s, day, premiate: 0 };
}
/** Premio di una partita da solo per medaglia (senza medaglia = premio di consolazione). */
export function soloPrize(medal: Medal): Resources {
  const p = BALANCE.solo.premi[medal ?? 'nessuna'];
  return { legno: p.legno, pietra: p.pietra, perle: p.perle };
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
export type SoloOutcome = { lot: LotState; premio: Resources; premiata: boolean };
/**
 * Chiude la partita aperta con la medaglia che il server ha ricalcolato rigiocando gli input. Premio pieno finché ci sono partite
 * premiate oggi, poi zero (si gioca lo stesso).
 */
export function finishSolo(lot0: LotState, medal: Medal, nowMs: number): SoloOutcome {
  const s = soloOf(lot0, nowMs);
  if (!s.pending) throw new EconomyError('partita', 'Nessuna partita aperta: riparti dal via');
  const premiata = s.premiate < BALANCE.solo.premiateAlGiorno;
  const premio = premiata ? soloPrize(medal) : { ...ZERO };
  const lot = advance(lot0, nowMs);
  return {
    premio, premiata,
    lot: {
      ...lot,
      version: lot.version + 1,
      resources: add(lot.resources, premio),
      ledger: { ...lot.ledger, generated: add(lot.ledger.generated, premio) },
      boostUntilMs: faroBoost(lot, medal !== null, nowMs), // una medaglia accende il Faro come una vittoria
      solo: { day: s.day, premiate: s.premiate + (premiata ? 1 : 0), giocate: s.giocate + 1, pending: null },
    },
  };
}
