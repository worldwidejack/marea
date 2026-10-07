// Spedizioni nel dungeon lato economia (CONTRACTS §15): il server apre (fotografia + seed) e chiude (applica RunResult). Pure.
// Esiti: 'uscito' tiene tutto; 'morto', 'tempo' e partita non finita (outcome null) seguono RPG.dungeon.morte (bottino e monete × bottino,
// xp × xp), ma il bottino e le monete salvati all'ultimo altare (RunResult.salvato) restano sempre. Usati e rotti restano persi in ogni
// caso. Confermata da Riccardo (docs/RPG.md §4). Dungeon v5: si tolgono anche i buttati via, l'equipaggiamento cambiato nel dungeon resta
// (gli slot con un oggetto perso tornano a quello di prima) e uscendo da una lanterna la si ricorda per la discesa dopo (hero.lanterne).
import { DUNGEONS, RPG, SKILLS } from '@marea/content/rpg.ts';
import { advance } from '../economy/advance.ts';
import { EconomyError } from '../economy/types.ts';
import type { LotState } from '../economy/types.ts';
import { equipError, fixEquip, removeFrom, stow } from './bag.ts';
import { buildRunHero } from './derived.ts';
import { gainSkillXp, heroOf } from './hero.ts';
import { hasItem, itemDef } from './items.ts';
import { EQUIP_SLOTS } from './types.ts';
import type { HeroState, RunResult } from './types.ts';

/** Apre una spedizione: lot.dungeon.pending = { dungeon, seed, startMs, hero: runHeroOf(hero), stato: hero, partenza }. Una sola aperta (la
 *  nuova sostituisce). `lanterna`: riparte dalla lanterna da cui sei uscito l'ultima volta (hero.lanterne), se c'è; se no dall'ingresso. */
export function startDungeon(lot0: LotState, dungeon: string, seed: number, nowMs: number, o: { lanterna?: boolean } = {}): LotState {
  const lot = advance(lot0, nowMs);
  if (typeof dungeon !== 'string' || !dungeon || dungeon.length > 40) throw new EconomyError('sconosciuto', 'Dungeon sconosciuto');
  // finché R-dungeon non ha scritto dungeons.json la lista è vuota: allora va bene qualunque id
  if (DUNGEONS.length > 0 && !DUNGEONS.some((d) => d.id === dungeon)) throw new EconomyError('sconosciuto', 'Dungeon sconosciuto');
  const hero = heroOf(lot);
  const l = hero.lanterne?.[dungeon];
  const partenza = o.lanterna && typeof l === 'number' && Number.isInteger(l) && l >= 0 ? l : null;
  return { ...lot, version: lot.version + 1, hero, dungeon: { pending: { dungeon, seed: seed >>> 0, startMs: nowMs, hero: buildRunHero(hero), stato: hero, partenza } } };
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
  for (const bag of [r.usati, r.rotti, r.buttati]) for (const [id, n] of Object.entries(bag ?? {})) inv = removeFrom(inv, id, Math.min(cleanCount(n), inv[id] ?? 0));
  const usura = { ...h.usura };
  for (const [id, n] of Object.entries(r.usura ?? {})) {
    const fragile = hasItem(id) ? itemDef(id).traits?.fragile ?? 0 : 0;
    const u = cleanCount(n);
    usura[id] = fragile > 0 && u >= fragile ? 0 : u; // arrivata al limite = quella copia si è rotta, la prossima è nuova
  }
  for (const id of Object.keys(usura)) if (!inv[id] || !usura[id]) delete usura[id];
  h = fixEquip({ ...h, inv, usura });
  // 2) bottino: zaino fino al peso massimo, poi Forziere, il resto è perso; quello dell'ultimo altare resta comunque
  const k = salvo ? 1 : M.bottino;
  const sv = salvo ? null : r.salvato ?? null;
  const tenuto: Record<string, number> = {};
  let state: LotState = lot;
  for (const id of [...new Set([...Object.keys(r.bottino ?? {}), ...Object.keys(sv?.bottino ?? {})])].sort()) {
    const n = Math.max(Math.floor(cleanCount(r.bottino?.[id]) * k), cleanCount(sv?.bottino[id]));
    if (n < 1 || !hasItem(id)) continue;
    const s = stow(state, h, id, n);
    h = s.hero;
    if (s.chest > 0) state = { ...state, forziere: s.forziere };
    if (s.zaino + s.chest > 0) tenuto[id] = s.zaino + s.chest;
  }
  const monete = Math.max(Math.floor(cleanCount(r.monete) * k), cleanCount(sv?.monete));
  // 2b) equipaggiamento cambiato nel dungeon: resta; uno slot con un oggetto che non hai più (perso morendo, buttato) torna a com'era
  if (r.equip && typeof r.equip === 'object') {
    const prima = h.equip, equip: HeroState['equip'] = {};
    for (const sl of EQUIP_SLOTS) {
      const want = r.equip[sl], hh = { ...h, equip };
      if (typeof want === 'string' && !equipError(hh, sl, want)) equip[sl] = want;
      else if (want !== undefined && typeof prima[sl] === 'string' && !equipError(hh, sl, prima[sl]!)) equip[sl] = prima[sl];
    }
    h = fixEquip({ ...h, equip });
  }
  // 3) esperienza (con la morte: × morte.xp), statistiche
  const livello0 = h.livello;
  const kx = salvo ? 1 : M.xp;
  for (const s of SKILLS) {
    const x = r.xp?.[s];
    if (typeof x === 'number' && x > 0) h = gainSkillXp(h, s, x * kx);
  }
  h = { ...h, monete: h.monete + monete, discese: h.discese + 1, morti: h.morti + (r.outcome === 'morto' ? 1 : 0) + cleanCount(r.cadute) };
  // capo ucciso = dungeon completato (anche se poi sei morto: scelta di Riccardo, 7 ott 2026)
  const id = lot.dungeon.pending.dungeon;
  if (r.capo === true && !(h.completati ?? []).includes(id)) h = { ...h, completati: [...(h.completati ?? []), id] };
  // uscito da una lanterna: la discesa dopo può ripartire da lì
  if (salvo && typeof r.lanterna === 'number' && Number.isInteger(r.lanterna) && r.lanterna >= 0 && r.lanterna < 64) h = { ...h, lanterne: { ...(h.lanterne ?? {}), [id]: r.lanterna } };
  const out: LotState = { ...state, version: lot.version + 1, hero: h, dungeon: { pending: null } };
  return { lot: out, tenuto, monete, livelliSu: h.livello - livello0 };
}
