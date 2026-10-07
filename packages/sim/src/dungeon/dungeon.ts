// Sim del dungeon (CONTRACTS §15, docs/RPG.md §4): eroe, nemici, proiettili, magie, evocazioni, bottino, uscita. Pura e deterministica
// (vedi la regola in dungeon/types.ts: niente funzioni trascendenti). Moduli: map, state, hero, enemies, projectiles, loot, combat, view, autopilot.
import { RPG, dungeonDef } from '@marea/content/rpg.ts';
import type { DungeonModule } from './types.ts';
import { createState } from './state.ts';
import type { DungeonState } from './state.ts';
import { stepHero } from './hero.ts';
import { stepEnemies } from './enemies.ts';
import { stepProjectiles } from './projectiles.ts';
import { pickup } from './loot.ts';
import { stepAltari } from './altari.ts';
import { resultOf, viewOf } from './view.ts';
import { autopilot } from './autopilot.ts';
import { HZ } from './tuning.ts';

export type { DungeonState } from './state.ts';
export const MAX_TICKS = (RPG.dungeon?.maxMinuti ?? 20) * 60 * HZ;

export const dungeon: DungeonModule<DungeonState> = {
  // v2: altari di salvataggio (mappe, risveglio, salvato nel risultato e nell'hash)
  id: 'dungeon', version: 2, maxTicks: MAX_TICKS,
  create: ({ seed, dungeon: id, hero }) => createState(dungeonDef(id), seed, hero),
  step(s, input) {
    s.eventi = [];
    if (s.done) return;
    stepHero(s, input);
    if (!s.done) stepEnemies(s);
    if (!s.done) stepProjectiles(s);
    if (!s.done) pickup(s);
    if (!s.done) stepAltari(s);
    s.tick++;
    if (!s.done && s.tick >= MAX_TICKS) { s.done = true; s.outcome = 'tempo'; }
  },
  result: resultOf,
  view: viewOf,
  autopilot,
};
