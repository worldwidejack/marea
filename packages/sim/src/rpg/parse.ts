// Controllo di forma delle azioni GDR che arrivano dalla rete (POST /api/rpg). Solo forma: i controlli di gioco li fa applyRpgAction.
import { ATTRS } from '@marea/content/rpg.ts';
import type { AttrId } from '@marea/content/rpg.ts';
import { EQUIP_SLOTS } from './types.ts';
import type { ArenaLoadout, ArenaSlot, EquipSlot, RpgAction } from './types.ts';

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
    case 'vetrina':
      return (o.bottega === 'fabbro' || o.bottega === 'alchimista') && str(o.item) && qty(o.n) ? { t: 'vetrina', bottega: o.bottega, item: o.item, n: o.n } : null;
    case 'contrabbando':
      return (o.op === 'compra' || o.op === 'vendi') && str(o.item) && qty(o.n) ? { t: 'contrabbando', op: o.op, item: o.item, n: o.n } : null;
    case 'arena': { const l = parseLoadout(o.loadout); return l ? { t: 'arena', loadout: l } : null; }
    default: return null;
  }
}

/** Forma del set dell'Arena (ArenaLoadout): id corti, slot e pozioni come array (le lunghezze le controlla erroreLoadout). */
export function parseLoadout(v: unknown): ArenaLoadout | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.slot) || o.slot.length > 9 || !Array.isArray(o.pozioni) || o.pozioni.length > 4) return null;
  const slot: (ArenaSlot | null)[] = [];
  for (const x of o.slot) {
    if (x === null) { slot.push(null); continue; }
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const s = x as Record<string, unknown>;
    if (str(s.magia) && s.arma === undefined) slot.push({ magia: s.magia });
    else if (str(s.arma) && s.magia === undefined && (s.frecce === undefined || str(s.frecce))) slot.push(str(s.frecce) ? { arma: s.arma, frecce: s.frecce } : { arma: s.arma });
    else return null;
  }
  const pozioni: (string | null)[] = [];
  for (const x of o.pozioni) { if (x === null) pozioni.push(null); else if (str(x)) pozioni.push(x); else return null; }
  const out: ArenaLoadout = { slot, pozioni };
  for (const k of ['corpo', 'anello1', 'anello2'] as const) { const x = o[k]; if (x === undefined || x === null) continue; if (!str(x)) return null; out[k] = x; }
  return out;
}
