// Zaino e Forziere: aggiungere, togliere, pesare, riporre. Puro, niente eccezioni (le decide chi chiama).
import { PESI, caricoMaxOf, carriedOf, forziereCap } from './derived.ts';
import { hasItem, itemDef } from './items.ts';
import type { LotState } from '../economy/types.ts';
import type { EquipSlot, HeroState, SlotOggetto } from './types.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
export type Bag = Record<string, number>;

export function addTo(bag: Bag, id: string, n: number): Bag {
  if (n <= 0) return bag;
  return { ...bag, [id]: (bag[id] ?? 0) + n };
}
export function removeFrom(bag: Bag, id: string, n: number): Bag {
  if (n <= 0) return bag;
  const left = (bag[id] ?? 0) - n;
  const out = { ...bag };
  if (left > 0) out[id] = left; else delete out[id];
  return out;
}
export function bagWeight(bag: Bag): number {
  let w = 0;
  for (const [id, n] of Object.entries(bag)) w += (PESI[id] ?? 0) * n;
  return r2(w);
}

/** Livello del Forziere costruito (0 se non c'è o è in costruzione). */
export function buildingLevel(lot: LotState, id: string): number {
  return lot.buildings.find((b) => b.building === id)?.level ?? 0;
}
export function chestCap(lot: LotState): number { return forziereCap(buildingLevel(lot, 'forziere')); }

/** Quante unità di `id` stanno in `room` kg (peso 0 = tutte). */
function fitting(id: string, n: number, room: number): number {
  const p = PESI[id] ?? 0;
  if (p <= 0) return n;
  return Math.max(0, Math.min(n, Math.floor((room + 1e-9) / p)));
}

/** Che tipo di oggetto va in ogni slot (la magia si sceglie tra quelle conosciute, le mani tengono arma o magia). */
export const SLOT_KINDS: Record<SlotOggetto, readonly string[]> = {
  arma: ['arma', 'arco'], frecce: ['frecce'], corpo: ['armatura', 'veste'], anello1: ['anello'], anello2: ['anello'], pozione: ['pozione'],
};
/** null se `id` si può mettere in `slot` (lo zaino è h.inv, la magia tra h.magie, in mano solo la magia preparata), altrimenti il motivo in italiano. */
export function equipError(h: HeroState, slot: EquipSlot, id: string): string | null {
  if (slot === 'magia') return h.magie.includes(id) ? null : 'Non conosci questa magia';
  if (slot === 'mano') return id === 'magia' && h.equip.magia && h.magie.includes(h.equip.magia) ? null : 'Prepara prima una magia';
  if (!hasItem(id)) return 'Oggetto sconosciuto';
  const it = itemDef(id);
  if (!SLOT_KINDS[slot].includes(it.kind)) return `${it.nome} non va qui`;
  const other = slot === 'anello1' ? h.equip.anello2 : slot === 'anello2' ? h.equip.anello1 : undefined;
  return (h.inv[id] ?? 0) < (other === id ? 2 : 1) ? `Non hai: ${it.nome}` : null;
}

/** L'equipaggiamento dopo aver messo `id` in `slot` (null = togli); i controlli li ha già fatti equipError. Le mani (v6): preparare una magia
 *  la mette in mano, impugnare un'arma (anche quella già equipaggiata ma a riposo) rimette l'arma, togliere la magia libera le mani. */
export function withEquip(equip: HeroState['equip'], slot: EquipSlot, id: string | null): HeroState['equip'] {
  const e = { ...equip };
  if (id === null) { delete e[slot]; if (slot === 'magia') delete e.mano; return e; }
  e[slot] = id;
  if (slot === 'magia') e.mano = 'magia'; else if (slot === 'arma') delete e.mano;
  return e;
}

/** Toglie gli slot che puntano a un oggetto non più nello zaino (o al secondo anello uguale senza la seconda copia). */
export function fixEquip(h: HeroState): HeroState {
  const equip = { ...h.equip };
  let changed = false;
  for (const s of Object.keys(equip) as EquipSlot[]) {
    const id = equip[s];
    if (!id || s === 'magia' || s === 'mano') continue;
    const need = s === 'anello2' && equip.anello1 === id ? 2 : 1;
    if ((h.inv[id] ?? 0) < need) { delete equip[s]; changed = true; }
  }
  return changed ? { ...h, equip } : h;
}

/** Ripone n oggetti: prima nello zaino fin dove regge il peso, poi nel Forziere se c'è spazio; il resto è `perso`. */
export function stow(lot: LotState, h: HeroState, id: string, n: number): { hero: HeroState; forziere: Bag; zaino: number; chest: number; perso: number } {
  const forziere0 = lot.forziere ?? {};
  const zaino = fitting(id, n, caricoMaxOf(h) - carriedOf(h));
  const cap = chestCap(lot);
  const chest = cap > 0 ? fitting(id, n - zaino, cap - bagWeight(forziere0)) : 0;
  return {
    hero: zaino > 0 ? { ...h, inv: addTo(h.inv, id, zaino) } : h,
    forziere: chest > 0 ? addTo(forziere0, id, chest) : forziere0,
    zaino, chest, perso: n - zaino - chest,
  };
}

/** Quanto c'è tra zaino (oggetti non equipaggiati) e Forziere. */
export function available(lot: LotState, h: HeroState, id: string): number {
  return (h.inv[id] ?? 0) + ((lot.forziere ?? {})[id] ?? 0);
}
/** Prende n oggetti prima dallo zaino e poi dal Forziere (chi chiama ha già controllato `available`). */
export function takeItems(lot: LotState, h: HeroState, id: string, n: number): { hero: HeroState; forziere: Bag } {
  const fromInv = Math.min(n, h.inv[id] ?? 0);
  const hero = fixEquip({ ...h, inv: removeFrom(h.inv, id, fromInv) });
  return { hero, forziere: removeFrom(lot.forziere ?? {}, id, n - fromInv) };
}
