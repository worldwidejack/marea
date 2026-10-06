// Catalogo degli oggetti (CONTRACTS §15): armi, archi, frecce e armature generati da tipo × materiale (rpg/materials.json, rpg/weapons.json)
// più gli oggetti scritti a mano (rpg/items.json: anelli, vesti, pozioni, libri, ingredienti, materiali, unici). STUB di WP0: lo riempie R-rpg.
import type { ItemDef } from './types.ts';

/** id: `<tipo>_<materiale>` (katana_ferro), `arco_<materiale>`, `frecce_<materiale>`, `armatura_<materiale>`; il resto come in items.json. */
export const ITEMS: readonly ItemDef[] = [];
export function hasItem(id: string): boolean { return ITEMS.some((i) => i.id === id); }
export function itemDef(id: string): ItemDef {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) throw new Error(`Oggetto sconosciuto: ${id}`);
  return it;
}
