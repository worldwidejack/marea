// Produzione pigra: lo stato avanza fino a nowMs. Pura. Stub funzionante (WP0); WP3 tara e completa.
import { BALANCE, building } from '@marea/content';
import type { LotState } from './types.ts';

export function storageCap(lot: LotState): number {
  const mag = lot.buildings.find((b) => b.building === 'magazzino');
  const lvl = mag ? building('magazzino').levels[mag.level - 1] : undefined;
  return lvl?.cap ?? BALANCE.capBase;
}

export function advance(lot: LotState, nowMs: number): LotState {
  if (nowMs <= lot.nowMs) return lot;
  let construction = lot.construction;
  let buildings = lot.buildings;
  if (construction && nowMs >= construction.endsMs) {
    const c = construction;
    buildings = buildings.map((b) => (b.id === c.placedId ? { ...b, level: c.level, lastMs: c.endsMs } : b));
    construction = null;
  }
  const boost = nowMs < lot.boostUntilMs ? 1.5 : 1;
  buildings = buildings.map((b) => {
    const def = building(b.building);
    const lvl = def.levels[b.level - 1];
    if (!lvl?.rate || b.level < 1) return b;
    const hours = (nowMs - b.lastMs) / 3_600_000;
    const cap = lvl.rate * BALANCE.bufferOre;
    const buffer = Math.min(cap, b.buffer + lvl.rate * hours * boost);
    return { ...b, buffer, lastMs: nowMs };
  });
  return { ...lot, nowMs, construction, buildings, version: lot.version + 1 };
}
