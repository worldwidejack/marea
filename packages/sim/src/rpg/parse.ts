// Controllo di forma delle azioni GDR che arrivano dalla rete (POST /api/rpg). Solo forma: i controlli di gioco li fa applyRpgAction.
import { ATTRS } from '@marea/content/rpg.ts';
import type { AttrId } from '@marea/content/rpg.ts';
import { EQUIP_SLOTS } from './types.ts';
import type { EquipSlot, RpgAction } from './types.ts';

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;
const qty = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 999;

/** Controllo di forma di un'azione che arriva dalla rete (null = non valida). Restituisce un oggetto pulito (niente campi in più). */
export function parseRpgAction(v: unknown): RpgAction | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  switch (o.t) {
    case 'attributo': return ATTRS.includes(o.attr as AttrId) ? { t: 'attributo', attr: o.attr as AttrId } : null;
    case 'perk': return str(o.perk) ? { t: 'perk', perk: o.perk } : null;
    case 'equip':
      if (!EQUIP_SLOTS.includes(o.slot as EquipSlot)) return null;
      if (o.item !== null && !str(o.item)) return null;
      return { t: 'equip', slot: o.slot as EquipSlot, item: o.item as string | null };
    case 'leggi': return str(o.item) ? { t: 'leggi', item: o.item } : null;
    case 'forgia':
      if (!str(o.item) || (o.n !== undefined && !qty(o.n))) return null;
      return o.n === undefined ? { t: 'forgia', item: o.item } : { t: 'forgia', item: o.item, n: o.n as number };
    case 'alchimia':
      if (!str(o.ricetta) || (o.n !== undefined && !qty(o.n))) return null;
      return o.n === undefined ? { t: 'alchimia', ricetta: o.ricetta } : { t: 'alchimia', ricetta: o.ricetta, n: o.n as number };
    case 'compra': case 'deposita': case 'preleva': case 'butta':
      return str(o.item) && qty(o.n) ? { t: o.t, item: o.item, n: o.n } : null;
    case 'serra': return { t: 'serra' };
    case 'contrabbando':
      return (o.op === 'compra' || o.op === 'vendi') && str(o.item) && qty(o.n) ? { t: 'contrabbando', op: o.op, item: o.item, n: o.n } : null;
    default: return null;
  }
}
