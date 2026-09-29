// Sfide differite con posta (GDD §7). Due metà pure:
// 1) operazioni su UN lotto, idempotenti per id sfida (holdStake / releaseStake): il server le chiama sul DO di ciascun lotto e può ripeterle
//    senza doppi addebiti né doppie vincite; ogni operazione da sola tiene l'invariante del lotto;
// 2) la macchina a stati della sfida (newChallenge, playTurn, closeOutcome, refundsFor): nessun I/O, la usa il coordinatore del server.
import { BALANCE } from '@marea/content';
import { getMinigame } from '../minigames/registry.ts';
import type { Medal, MinigameResult } from '../minigames/types.ts';
import { advance } from './advance.ts';
import { applyMinigameResult } from './rewards.ts';
import { EconomyError, total } from './types.ts';
import type { Challenge, LotState, Resources } from './types.ts';
import { acceptWager, cancelWager, isColpoDiCoda, openWager, potFor, settleSide } from './wager.ts';

const HOUR = 3_600_000;
const SETTLED_KEEP = 200;

// ---------- 1) operazioni su un lotto ----------

export type HoldKind = 'apri' | 'accetta';
export type Release =
  | { esito: 'rimborso' }
  | { esito: 'vinta'; pot: Resources; medal: Medal }
  | { esito: 'persa'; medal: Medal }
  | { esito: 'pari'; medal: Medal };

/** true se questo lotto ha in escrow la posta della sfida `cid`. */
export const isHeld = (lot: LotState, cid: string): boolean => !!lot.holds?.[cid];

/**
 * Mette in escrow la posta della sfida `cid`: 'apri' = sfidante (Tavolo, tetto, sfide gratis/Perla), 'accetta' = chi risponde.
 * Idempotente: se la posta c'è già (o la sfida è già regolata su questo lotto) non fa niente.
 */
export function holdStake(lot0: LotState, cid: string, stake: Resources, kind: HoldKind, nowMs: number): LotState {
  if (isHeld(lot0, cid) || (lot0.settled ?? []).includes(cid)) return advance(lot0, nowMs);
  const lot = kind === 'apri' ? openWager(lot0, stake, nowMs) : acceptWager(lot0, stake, nowMs);
  return { ...lot, holds: { ...(lot.holds ?? {}), [cid]: { ...stake } } };
}

/**
 * Chiude la posta della sfida `cid` su questo lotto: rimborso, vinta (prende `pot`), persa (la posta è spesa) o pari (rimborso).
 * Con un esito di gioco arrivano anche le Perle della medaglia (almeno quelle di consolazione) e, a chi vince, il Faro.
 * Idempotente: senza posta in escrow per `cid` non fa niente.
 */
export function releaseStake(lot0: LotState, cid: string, r: Release, nowMs: number): LotState {
  const stake = lot0.holds?.[cid];
  if (!stake) return advance(lot0, nowMs);
  let lot = advance(lot0, nowMs);
  if (r.esito === 'rimborso') lot = cancelWager(lot, stake, nowMs);
  else {
    const side = r.esito === 'vinta' ? 'vince' : r.esito === 'persa' ? 'perde' : 'pari';
    lot = settleSide(lot, stake, side, r.esito === 'vinta' ? r.pot : undefined);
    lot = applyMinigameResult(lot, { medal: r.medal, esito: r.esito === 'vinta' ? 'vittoria' : r.esito === 'persa' ? 'sconfitta' : 'parita' }, nowMs);
  }
  const holds = { ...(lot.holds ?? {}) };
  delete holds[cid];
  return { ...lot, holds, settled: [...(lot.settled ?? []), cid].slice(-SETTLED_KEEP) };
}

// ---------- 2) la sfida ----------

export const CHALLENGE_DIFFICULTY = 2 as const;

/** Nuova sfida (posta non ancora in escrow: la mette holdStake 'apri' sul lotto dello sfidante). Lancia EconomyError in italiano. */
export function newChallenge(o: { id: string; minigame: string; from: string; to: string; stake: Resources; seed: number; nowMs: number }): Challenge {
  try { getMinigame(o.minigame); } catch { throw new EconomyError('sconosciuto', 'Minigioco sconosciuto'); }
  if (o.from === o.to) throw new EconomyError('posta', 'Non puoi sfidare te stesso');
  for (const k of ['legno', 'pietra', 'perle'] as const)
    if (!Number.isInteger(o.stake[k]) || o.stake[k] < 0) throw new EconomyError('posta', 'Posta non valida');
  if (total(o.stake) < BALANCE.wager.min) throw new EconomyError('posta', `La posta minima è ${BALANCE.wager.min}`);
  return {
    id: o.id, minigame: o.minigame, difficulty: CHALLENGE_DIFFICULTY, seed: o.seed >>> 0, from: o.from, to: o.to, stake: { ...o.stake },
    state: 'gioca_sfidante', createdMs: o.nowMs, expiresMs: o.nowMs + BALANCE.wager.scadenzaOre * HOUR,
    scoreFrom: null, medalFrom: null, scoreTo: null, medalTo: null, winner: null, colpoDiCoda: false, pot: null, closedMs: null,
  };
}

export const isActive = (c: Challenge): boolean => c.state === 'gioca_sfidante' || c.state === 'aperta' || c.state === 'accettata';
export const isExpired = (c: Challenge, nowMs: number): boolean => isActive(c) && nowMs >= c.expiresMs;

/** Chi deve giocare adesso (null = nessuno). */
export function turnOf(c: Challenge): string | null {
  return c.state === 'gioca_sfidante' ? c.from : c.state === 'accettata' ? c.to : null;
}

/** Errore in italiano se `who` non può fare `action` adesso, altrimenti null. */
export function actionError(c: Challenge, who: string, action: 'play' | 'accept' | 'decline', nowMs: number): string | null {
  if (who !== c.from && who !== c.to) return 'Questa sfida non è tua';
  if (isExpired(c, nowMs) || c.state === 'scaduta') return 'Sfida scaduta';
  if (!isActive(c)) return 'Sfida già chiusa';
  if (action === 'play') return turnOf(c) === who ? null : 'Non è il tuo turno';
  if (who !== c.to) return 'Solo chi è sfidato può rispondere';
  if (action === 'accept') return c.state === 'aperta' ? null : c.state === 'accettata' ? 'Hai già accettato' : 'Aspetta che lo sfidante giochi il suo turno';
  return c.state === 'accettata' ? 'Hai già accettato: ora gioca' : null;
}

/** Registra la partita (già verificata col replay) di chi è di turno. */
export function playTurn(c: Challenge, who: string, r: MinigameResult): Challenge {
  if (who === c.from && c.state === 'gioca_sfidante') return { ...c, state: 'aperta', scoreFrom: r.score, medalFrom: r.medal };
  if (who === c.to && c.state === 'accettata') return { ...c, scoreTo: r.score, medalTo: r.medal };
  throw new EconomyError('posta', 'Non è il tuo turno');
}

/** All'accettazione: il Colpo di coda si decide sulle risorse di quel momento (escrow compreso). */
export function acceptChallenge(c: Challenge, fromLot: LotState, toLot: LotState): Challenge {
  return { ...c, state: 'accettata', colpoDiCoda: isColpoDiCoda(fromLot, toLot) };
}

/** Esito a partite finite: vince il punteggio più alto, parità = rimborso. Ritorna la sfida chiusa e cosa fare su ciascun lotto. */
export function closeOutcome(c: Challenge, nowMs: number): { challenge: Challenge; releases: { owner: string; release: Release }[] } {
  if (c.scoreFrom === null || c.scoreTo === null) throw new EconomyError('posta', 'La sfida non è finita');
  const winner = c.scoreFrom > c.scoreTo ? 'from' : c.scoreTo > c.scoreFrom ? 'to' : 'pari';
  const pot = winner === 'pari' ? null : potFor(c.stake, winner === 'to' && c.colpoDiCoda);
  const rel = (side: 'from' | 'to'): Release => {
    const medal = side === 'from' ? c.medalFrom : c.medalTo;
    if (winner === 'pari' || !pot) return { esito: 'pari', medal };
    return winner === side ? { esito: 'vinta', pot, medal } : { esito: 'persa', medal };
  };
  return {
    challenge: { ...c, state: 'chiusa', winner, pot, closedMs: nowMs },
    releases: [{ owner: c.from, release: rel('from') }, { owner: c.to, release: rel('to') }],
  };
}

/** Rifiuto o scadenza: rimborso a chi ha la posta in escrow (sempre lo sfidante, anche chi risponde se aveva accettato). */
export function refundsFor(c: Challenge, state: 'rifiutata' | 'scaduta', nowMs: number): { challenge: Challenge; releases: { owner: string; release: Release }[] } {
  const releases: { owner: string; release: Release }[] = [{ owner: c.from, release: { esito: 'rimborso' } }];
  if (c.state === 'accettata') releases.push({ owner: c.to, release: { esito: 'rimborso' } });
  return { challenge: { ...c, state, closedMs: nowMs }, releases };
}
