// Tiri del bottino sulle tabelle di loot.json (rng dedicato, così l'ordine delle uccisioni non cambia cosa cade). Funzioni pure: le usano
// la creazione della partita (state.ts, i forzieri) e i colpi (combat.ts), senza passare dalla raccolta (loot.ts).
import { LOOT } from '@marea/content/rpg.ts';
import type { LootTable } from '@marea/content/rpg.ts';
import type { Rng } from '../rng.ts';
import type { Bag } from './state.ts';

export function lootTable(id: string): LootTable {
  const t = LOOT.find((x) => x.id === id);
  if (!t) throw new Error(`Tabella di bottino sconosciuta: ${id}`);
  return t;
}

/** Tira una tabella: monete e oggetti. molt = dropMolt (oro); raro = le voci rare cadono sicuro (frecce d'oro). */
export function rollLoot(id: string, rng: Rng, o: { molt: number; raro: boolean }): { items: Bag; monete: number } {
  const t = lootTable(id);
  const items: Bag = {};
  const monete = Math.round(rng.int(t.monete[0], t.monete[1]) * o.molt);
  for (const v of t.voci) {
    const r = rng.next(), n = rng.int(v.n[0], v.n[1]);
    if (r < v.p || (o.raro && v.raro)) items[v.item] = (items[v.item] ?? 0) + Math.max(1, Math.round(n * o.molt));
  }
  return { items, monete };
}
