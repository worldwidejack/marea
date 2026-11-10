// Controllo di forma delle azioni GDR che arrivano dalla rete (POST /api/rpg). Solo forma: i controlli di gioco li fa applyRpgAction.
import { ATTRS, SKILLS } from '@marea/content/rpg.ts';
import type { AttrId, SkillId } from '@marea/content/rpg.ts';
import { EQUIP_SLOTS } from './types.ts';
import type { ArenaBuild, ArenaBuilds, ArenaSlot, EquipSlot, RpgAction } from './types.ts';

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
    case 'vetrina':
      return (o.bottega === 'fabbro' || o.bottega === 'alchimista') && str(o.item) && qty(o.n) ? { t: 'vetrina', bottega: o.bottega, item: o.item, n: o.n } : null;
    case 'contrabbando':
      return (o.op === 'compra' || o.op === 'vendi') && str(o.item) && qty(o.n) ? { t: 'contrabbando', op: o.op, item: o.item, n: o.n } : null;
    case 'ripristina_skill': return SKILLS.includes(o.skill as SkillId) ? { t: 'ripristina_skill', skill: o.skill as SkillId } : null;
    case 'arena': { const b = parseBuilds(o.builds); return b ? { t: 'arena', builds: b } : null; }
    case 'armatura_fuori': return { t: 'armatura_fuori', ...(typeof o.attiva === 'boolean' ? { attiva: o.attiva } : {}) };
    default: return null;
  }
}

/** Forma delle build dell'Arena (ArenaBuilds): id corti, al massimo 9 build di 9 slot (i numeri giusti li controlla erroreBuilds). */
function parseBuilds(v: unknown): ArenaBuilds | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.build) || o.build.length > 9 || typeof o.scelta !== 'number' || !Number.isInteger(o.scelta)) return null;
  const build: ArenaBuild[] = [];
  for (const x of o.build) { const b = parseBuild(x); if (!b) return null; build.push(b); }
  return { build, scelta: o.scelta };
}
function parseBuild(v: unknown): ArenaBuild | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!str(o.dote) || !str(o.ulti) || !Array.isArray(o.slot) || o.slot.length > 9) return null;
  const slot: (ArenaSlot | null)[] = [];
  for (const x of o.slot) {
    if (x === null) { slot.push(null); continue; }
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const s = x as Record<string, unknown>;
    if (str(s.magia) && s.arma === undefined) slot.push({ magia: s.magia });
    else if (str(s.arma) && s.magia === undefined) slot.push({ arma: s.arma });
    else return null;
  }
  return { dote: o.dote, slot, ulti: o.ulti };
}
