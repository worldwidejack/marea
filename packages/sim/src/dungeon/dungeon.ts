// Sim del dungeon (CONTRACTS §15, docs/RPG.md §4): eroe, nemici, proiettili, magie, evocazioni, bottino, uscita. Pura e deterministica
// (vedi la regola in dungeon/types.ts: niente funzioni trascendenti). Moduli: map, state, hero, enemies, projectiles, loot, combat, view, autopilot.
// Dungeon insieme (#118): createPartyRun / stepParty / actParty, più eroi nella stessa partita (un input per eroe a ogni tick). Da solo
// `step` è stepParty con un eroe: stessi passi nello stesso ordine di sempre.
import { RPG, dungeonDef } from '@marea/content/rpg.ts';
import type { DungeonAzione, DungeonEvent, DungeonInput, DungeonModule } from './types.ts';
import { NO_DUNGEON_INPUT } from './types.ts';
import { conEroe, createParty, createState, finita } from './state.ts';
import type { DungeonState, EroeDef } from './state.ts';
import { stepHero } from './hero.ts';
import { stepEnemies } from './enemies.ts';
import { stepProjectiles } from './projectiles.ts';
import { pickup } from './loot.ts';
import { esciQui, salvaQui, stepAltari } from './altari.ts';
import { buttaNow, equipNow } from './zaino.ts';
import { resultOf, viewOf } from './view.ts';
import { autopilot } from './autopilot.ts';
import { HZ } from './tuning.ts';

export type { DungeonState, EroeDef } from './state.ts';
export const MAX_TICKS = (RPG.dungeon?.maxMinuti ?? 20) * 60 * HZ;

/** Un tick per tutti: prima ogni eroe in gioco col suo input (in ordine), poi nemici, proiettili, raccolta, lanterne. L'eroe di turno
 *  (`s.cur`) alla fine è quello di prima. */
export function stepParty(s: DungeonState, inputs: readonly DungeonInput[]): void {
  s.eventi = [];
  if (finita(s)) return;
  const prima = s.cur;
  for (let i = 0; i < s.eroi.length; i++) {
    if (s.eroi[i]!.done) continue;
    s.cur = i;
    stepHero(s, inputs[i] ?? NO_DUNGEON_INPUT);
  }
  s.cur = prima;
  if (!finita(s)) stepEnemies(s);
  if (!finita(s)) stepProjectiles(s);
  if (!finita(s)) pickup(s);
  if (!finita(s)) stepAltari(s);
  s.tick++;
  if (!finita(s) && s.tick >= MAX_TICKS) for (const r of s.eroi) if (!r.done) { r.done = true; r.outcome = 'tempo'; }
}

/** Azione dal menu dell'eroe i (insieme gli eventi portano `eroe: i`); null = non si può. */
export function actParty(s: DungeonState, i: number, a: DungeonAzione): DungeonEvent[] | null {
  if (!Number.isInteger(i) || i < 0 || i >= s.eroi.length) return null;
  return conEroe(s, i, () => {
    const ev = dungeon.act(s, a);
    return ev && s.eroi.length > 1 ? ev.map((e) => ({ ...e, eroe: i })) : ev;
  });
}

/** Spedizione insieme: tutti dall'ingresso. */
export function createPartyRun(o: { seed: number; dungeon: string; eroi: readonly EroeDef[] }): DungeonState {
  return createParty(dungeonDef(o.dungeon), o.seed, o.eroi, null);
}

export const dungeon: DungeonModule<DungeonState> = {
  // v2: altari di salvataggio (mappe, risveglio, salvato nel risultato e nell'hash) · v3: colpi di mischia ad arco spazzato (swing.ts), caricato = giro · v4: capo per dungeon (RunResult.capo), nella Grotta il Capo dei banditi
  // v5: azioni dal menu (equip, butta, salva ed esci sulla lanterna: le lanterne non salvano più da sole), ripartenza da una lanterna, consumi anche dal bottino
  // (insieme, #118: più eroi nella stessa partita; da solo non cambia niente, la versione resta 5)
  id: 'dungeon', version: 5, maxTicks: MAX_TICKS,
  create: ({ seed, dungeon: id, hero, stato, partenza }) => createState(dungeonDef(id), seed, hero, { stato: stato ?? null, partenza: partenza ?? null }),
  step(s, input) { stepParty(s, [input]); },
  act(s, a) {
    if (s.done || !a || typeof a !== 'object') return null;
    switch (a.t) {
      case 'equip': return equipNow(s, a.slot, a.item);
      case 'butta': return buttaNow(s, a.item, a.n);
      case 'salva': return salvaQui(s);
      case 'esci': return esciQui(s);
      // insieme: il giocatore se n'è andato, per lui la spedizione finisce senza esito (gli altri continuano)
      case 'ritira': s.done = true; s.outcome = null; return [{ t: 'ritirato' }];
      default: return null;
    }
  },
  result: resultOf,
  view: viewOf,
  autopilot,
};
