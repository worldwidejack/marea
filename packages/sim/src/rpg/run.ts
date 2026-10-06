// Spedizioni nel dungeon lato economia (CONTRACTS §15): il server apre (fotografia + seed) e chiude (applica RunResult). Pure.
// Esiti: 'uscito' tiene tutto; 'morto', 'tempo' e partita non finita (outcome null) seguono RPG.dungeon.morte (bottino e monete × bottino,
// xp × xp). Usati e rotti restano persi in ogni caso. [scelta provvisoria: docs/RPG.md §4]
import { DUNGEONS, RPG, SKILLS } from '@marea/content/rpg.ts';
import { advance } from '../economy/advance.ts';
import { EconomyError } from '../economy/types.ts';
import type { LotState } from '../economy/types.ts';
import { fixEquip, removeFrom, stow } from './bag.ts';
import { buildRunHero } from './derived.ts';
import { gainSkillXp, heroOf } from './hero.ts';
import { hasItem, itemDef } from './items.ts';
import type { HeroState, RunResult } from './types.ts';

/** Apre una spedizione: lot.dungeon.pending = { dungeon, seed, startMs, hero: runHeroOf(hero) }. Una sola aperta (la nuova sostituisce). */
export function startDungeon(lot0: LotState, dungeon: string, seed: number, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  if (typeof dungeon !== 'string' || !dungeon || dungeon.length > 40) throw new EconomyError('sconosciuto', 'Dungeon sconosciuto');
  // finché R-dungeon non ha scritto dungeons.json la lista è vuota: allora va bene qualunque id
  if (DUNGEONS.length > 0 && !DUNGEONS.some((d) => d.id === dungeon)) throw new EconomyError('sconosciuto', 'Dungeon sconosciuto');
  const hero = heroOf(lot);
  return { ...lot, version: lot.version + 1, hero, dungeon: { pending: { dungeon, seed: seed >>> 0, startMs: nowMs, hero: buildRunHero(hero) } } };
}

export type DungeonOutcome = { lot: LotState; tenuto: Record<string, number>; monete: number; livelliSu: number };
const cleanCount = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Chiude la spedizione aperta col risultato ricalcolato dal server: bottino (regole di morte), monete, xp, consumati, armi rotte. */
export function finishDungeon(lot0: LotState, r: RunResult, nowMs: number): DungeonOutcome {
  const lot = advance(lot0, nowMs);
  if (!lot.dungeon?.pending) throw new EconomyError('spedizione', 'Nessuna spedizione aperta');
  let h: HeroState = heroOf(lot);
  const salvo = r.outcome === 'uscito';
  const M = RPG.dungeon.morte;
  // 1) consumati e rotti escono dallo zaino; l'usura dell'arma fragile è quella a fine spedizione (colpi sulla copia in uso)
  let inv = h.inv;
  for (const bag of [r.usati, r.rotti]) for (const [id, n] of Object.entries(bag ?? {})) inv = removeFrom(inv, id, Math.min(cleanCount(n), inv[id] ?? 0));
  const usura = { ...h.usura };
  for (const [id, n] of Object.entries(r.usura ?? {})) {
    const fragile = hasItem(id) ? itemDef(id).traits?.fragile ?? 0 : 0;
    const u = cleanCount(n);
    usura[id] = fragile > 0 && u >= fragile ? 0 : u; // arrivata al limite = quella copia si è rotta, la prossima è nuova
  }
  for (const id of Object.keys(usura)) if (!inv[id] || !usura[id]) delete usura[id];
  h = fixEquip({ ...h, inv, usura });
  // 2) bottino: zaino fino al peso massimo, poi Forziere, il resto è perso
  const k = salvo ? 1 : M.bottino;
  const tenuto: Record<string, number> = {};
  let state: LotState = lot;
  for (const id of Object.keys(r.bottino ?? {}).sort()) {
    const n = Math.floor(cleanCount(r.bottino[id]) * k);
    if (n < 1 || !hasItem(id)) continue;
    const s = stow(state, h, id, n);
    h = s.hero;
    if (s.chest > 0) state = { ...state, forziere: s.forziere };
    if (s.zaino + s.chest > 0) tenuto[id] = s.zaino + s.chest;
  }
  const monete = Math.floor(cleanCount(r.monete) * k);
  // 3) esperienza (con la morte: × morte.xp), statistiche
  const livello0 = h.livello;
  const kx = salvo ? 1 : M.xp;
  for (const s of SKILLS) {
    const x = r.xp?.[s];
    if (typeof x === 'number' && x > 0) h = gainSkillXp(h, s, x * kx);
  }
  h = { ...h, monete: h.monete + monete, discese: h.discese + 1, morti: h.morti + (r.outcome === 'morto' ? 1 : 0) };
  const out: LotState = { ...state, version: lot.version + 1, hero: h, dungeon: { pending: null } };
  return { lot: out, tenuto, monete, livelliSu: h.livello - livello0 };
}

/** Esperienza di Navigazione dopo una partita alla Regata (server, solo_play): RPG.xp per medaglia. */
export function regataXp(lot: LotState, medal: 'oro' | 'argento' | 'bronzo' | null): LotState {
  const xp = RPG.xp[`regata_${medal ?? 'nessuna'}`] ?? 0;
  if (xp <= 0) return lot;
  return { ...lot, version: lot.version + 1, hero: gainSkillXp(heroOf(lot), 'navigazione', xp) };
}
