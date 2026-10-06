// Spedizione nel dungeon lato client (R-scena): scena, eroe, nemici, HUD, controlli C/D, registrazione input. STUB di WP0.
import type { RunHero } from '@marea/sim/rpg/types.ts';
import type { DungeonFinish, DungeonRun, RunCtx } from './types.ts';

export function startRun(ctx: RunCtx, o: { dungeon: string; seed: number; hero: RunHero }): DungeonRun {
  void ctx; void o;
  return { active: false, step() {}, update() {}, abort() {}, done: Promise.resolve(null) };
}
/** Scheda dell'esito (quello del server): bottino tenuto, monete, xp, livelli. Risolve quando il giocatore chiude. */
export async function showResult(ctx: RunCtx, r: DungeonFinish): Promise<void> { void ctx; void r; }
