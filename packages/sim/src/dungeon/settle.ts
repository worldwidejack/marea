// Spedizione rimasta aperta con un salvataggio all'altare (scheda chiusa a metà, connessione persa): il server la chiude rigiocando gli
// input fino all'altare, così il bottino salvato lì arriva nello zaino o nel Forziere (docs/RPG.md §4). Pura.
import { RPG } from '@marea/content/rpg.ts';
import type { LotState } from '../economy/types.ts';
import { finishDungeon } from '../rpg/run.ts';
import type { DungeonOutcome } from '../rpg/run.ts';
import { dungeon } from './dungeon.ts';
import { decodeDungeon, replayDungeon } from './replay.ts';

/** Chiude la spedizione aperta col suo salvataggio (null se non c'è niente da chiudere). */
export function chiudiSalvata(lot: LotState, nowMs: number): DungeonOutcome | null {
  const p = lot.dungeon?.pending, sv = p?.salvataggio;
  if (!p || !sv) return null;
  const inputs = decodeDungeon(sv.inputs, dungeon.maxTicks);
  if (!inputs) return null;
  return finishDungeon(lot, replayDungeon(p.seed, p.dungeon, p.hero, inputs), nowMs);
}

/** Come chiudiSalvata, ma solo se la spedizione è scaduta da un pezzo (durata massima + 5 minuti): nessuno la sta più giocando. */
export function chiudiScaduta(lot: LotState, nowMs: number): DungeonOutcome | null {
  const p = lot.dungeon?.pending;
  if (!p?.salvataggio || nowMs - p.startMs < (RPG.dungeon.maxMinuti + 5) * 60_000) return null;
  return chiudiSalvata(lot, nowMs);
}
