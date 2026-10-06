// @marea/content/rpg.ts: dati del Mondo Sotterraneo (docs/RPG.md). Entry separata da index.ts: il client principale non la importa,
// la carica solo il chunk GDR (apps/client/src/rpg/**) quando serve. Nessuna logica: formule in @marea/sim/rpg e @marea/sim/dungeon.
import balance from './rpg/balance.json' with { type: 'json' };
import materials from './rpg/materials.json' with { type: 'json' };
import weapons from './rpg/weapons.json' with { type: 'json' };
import items from './rpg/items.json' with { type: 'json' };
import spells from './rpg/spells.json' with { type: 'json' };
import perks from './rpg/perks.json' with { type: 'json' };
import recipes from './rpg/recipes.json' with { type: 'json' };
import enemies from './rpg/enemies.json' with { type: 'json' };
import loot from './rpg/loot.json' with { type: 'json' };
import dungeons from './rpg/dungeons.json' with { type: 'json' };
import type { DungeonDef, EnemyDef, ItemDefRaw, LootTable, MaterialDef, PerkDef, RecipeDef, RpgBalance, SpellDef, WeaponTypeDef } from './rpg_types.ts';

export type * from './rpg_types.ts';
export { ATTRS, SKILLS } from './rpg_types.ts';

export const RPG = balance as unknown as RpgBalance;
export const MATERIALS = materials as unknown as readonly MaterialDef[];
export const WEAPON_TYPES = weapons as unknown as readonly WeaponTypeDef[];
export const ITEMS_RAW = items as unknown as readonly ItemDefRaw[];
export const SPELLS = spells as unknown as readonly SpellDef[];
export const PERKS = perks as unknown as readonly PerkDef[];
export const RECIPES = recipes as unknown as readonly RecipeDef[];
export const ENEMIES = enemies as unknown as readonly EnemyDef[];
export const LOOT = loot as unknown as readonly LootTable[];
export const DUNGEONS = dungeons as unknown as readonly DungeonDef[];

export function dungeonDef(id: string): DungeonDef {
  const d = DUNGEONS.find((x) => x.id === id);
  if (!d) throw new Error(`Dungeon sconosciuto: ${id}`);
  return d;
}
export function enemyDef(id: string): EnemyDef {
  const e = ENEMIES.find((x) => x.id === id);
  if (!e) throw new Error(`Nemico sconosciuto: ${id}`);
  return e;
}
export function spellDef(id: string): SpellDef {
  const s = SPELLS.find((x) => x.id === id);
  if (!s) throw new Error(`Magia sconosciuta: ${id}`);
  return s;
}
