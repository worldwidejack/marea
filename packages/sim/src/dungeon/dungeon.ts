// Sim del dungeon (CONTRACTS §15, docs/RPG.md §4): eroe, nemici, proiettili, magie, evocazioni, bottino, uscita. Pura e deterministica
// (vedi la regola in dungeon/types.ts: niente funzioni trascendenti). STUB di WP0: lo riempie R-dungeon.
import type { DungeonModule } from './types.ts';

export type DungeonState = { tick: number };
export const dungeon: DungeonModule<DungeonState> = {
  id: 'dungeon', version: 1, maxTicks: 20 * 60 * 60,
  create: () => { throw new Error('TODO R-dungeon: create'); },
  step: () => { throw new Error('TODO R-dungeon: step'); },
  result: () => { throw new Error('TODO R-dungeon: result'); },
  view: () => { throw new Error('TODO R-dungeon: view'); },
  autopilot: () => { throw new Error('TODO R-dungeon: autopilot'); },
};
