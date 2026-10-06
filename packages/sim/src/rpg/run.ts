// Spedizioni nel dungeon lato economia (CONTRACTS §15): il server apre (fotografia + seed) e chiude (applica RunResult). Pure. STUB di WP0: R-rpg.
import type { LotState } from '../economy/types.ts';
import type { RunResult } from './types.ts';

/** Apre una spedizione: lot.dungeon.pending = { dungeon, seed, startMs, hero: runHeroOf(hero) }. Una sola aperta (la nuova sostituisce). */
export function startDungeon(lot: LotState, dungeon: string, seed: number, nowMs: number): LotState { void lot; void dungeon; void seed; void nowMs; throw new Error('TODO R-rpg: startDungeon'); }
export type DungeonOutcome = { lot: LotState; tenuto: Record<string, number>; monete: number; livelliSu: number };
/** Chiude la spedizione aperta col risultato ricalcolato dal server: bottino (regole di morte), monete, xp, consumati, armi rotte. */
export function finishDungeon(lot: LotState, r: RunResult, nowMs: number): DungeonOutcome { void lot; void r; void nowMs; throw new Error('TODO R-rpg: finishDungeon'); }
/** Esperienza di Navigazione dopo una partita alla Regata (server, solo_play): RPG.xp per medaglia. */
export function regataXp(lot: LotState, medal: 'oro' | 'argento' | 'bronzo' | null): LotState { void medal; return lot; }
