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
import { esciQui, salvaQui, stepAltari } from './altari.ts';
import { buttaNow, equipNow } from './zaino.ts';
import { resultOf, viewOf } from './view.ts';
import { autopilot } from './autopilot.ts';
import { HZ } from './tuning.ts';

export type { DungeonState } from './state.ts';
export const MAX_TICKS = (RPG.dungeon?.maxMinuti ?? 20) * 60 * HZ;

export const dungeon: DungeonModule<DungeonState> = {
  // v2: altari di salvataggio (mappe, risveglio, salvato nel risultato e nell'hash) · v3: colpi di mischia ad arco spazzato (swing.ts), caricato = giro · v4: capo per dungeon (RunResult.capo), nella Grotta il Capo dei banditi
  // v5: azioni dal menu (equip, butta, salva ed esci sulla lanterna: le lanterne non salvano più da sole), ripartenza da una lanterna, consumi anche dal bottino
  id: 'dungeon', version: 5, maxTicks: MAX_TICKS,
  create: ({ seed, dungeon: id, hero, stato, partenza }) => createState(dungeonDef(id), seed, hero, { stato: stato ?? null, partenza: partenza ?? null }),
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
  act(s, a) {
    if (s.done || !a || typeof a !== 'object') return null;
    switch (a.t) {
      case 'equip': return equipNow(s, a.slot, a.item);
      case 'butta': return buttaNow(s, a.item, a.n);
      case 'salva': return salvaQui(s);
      case 'esci': return esciQui(s);
      default: return null;
    }
  },
  result: resultOf,
  view: viewOf,
  autopilot,
};
