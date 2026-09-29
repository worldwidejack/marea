// Produzione pigra: lo stato avanza fino a nowMs. Pura. Il Faro moltiplica la produzione solo dentro la sua finestra.
import { BALANCE, building } from '@marea/content';
import type { LotState, PlacedBuilding } from './types.ts';

const HOUR = 3_600_000;

/** Tetto per risorsa: quello del Magazzino, mai sotto capBase (costruire il Magazzino non può abbassarlo). Le Perle non hanno tetto. */
export function storageCap(lot: LotState): number {
  const mag = lot.buildings.find((b) => b.building === 'magazzino');
  const lvl = mag && mag.level >= 1 ? building('magazzino').levels[mag.level - 1] : undefined;
  return Math.max(BALANCE.capBase, lvl?.cap ?? 0);
}

/** Moltiplicatore del Faro (1 se non c'è o non è costruito). */
export function boostFactor(lot: LotState): number {
  const faro = lot.buildings.find((b) => b.building === 'faro' && b.level >= 1);
  if (!faro) return 1;
  return building('faro').levels[faro.level - 1]?.boost ?? 1.5;
}

/**
 * Deposito in due tempi: a piena velocità per `bufferOre` ore, poi (opzionale) a `bufferLentoQuota` della velocità
 * per altre `bufferLentoOre` ore. Con bufferLentoOre = 0 (default) è il tetto secco di GDD §5.
 * Serve alla taratura: chi entra di rado non resta troppo indietro (vedi test/economy_30days.test.ts).
 */
export function bufferParams(): { fastH: number; slowH: number; slowQ: number } {
  const b = BALANCE as unknown as { bufferOre: number; bufferLentoOre?: number; bufferLentoQuota?: number };
  const slowQ = Math.max(0, Math.min(1, b.bufferLentoQuota ?? 0));
  return { fastH: b.bufferOre, slowH: slowQ > 0 ? Math.max(0, b.bufferLentoOre ?? 0) : 0, slowQ };
}

/** Tetto del deposito di un edificio produttivo in unità, 0 se non produce. */
export function bufferCap(b: PlacedBuilding): number {
  if (b.level < 1) return 0;
  const rate = building(b.building).levels[b.level - 1]?.rate ?? 0;
  const p = bufferParams();
  return rate * (p.fastH + p.slowQ * p.slowH);
}

/** Riempie `buf` per `hours` ore a velocità rate × k, rispettando i due tempi del deposito. */
function fill(buf: number, rate: number, hours: number, k: number): number {
  if (hours <= 0 || rate <= 0) return buf;
  const p = bufferParams();
  const fastCap = rate * p.fastH;
  const cap = rate * (p.fastH + p.slowQ * p.slowH);
  let b = buf;
  let h = hours;
  if (b < fastCap) {
    const need = (fastCap - b) / (rate * k);
    if (h <= need) return b + rate * k * h;
    b = fastCap;
    h -= need;
  }
  return Math.max(buf, Math.min(cap, b + rate * k * p.slowQ * h));
}

/** Porta ogni deposito a `t` (t ≥ lastMs), con il Faro attivo fino a boostUntilMs. */
function produceTo(buildings: PlacedBuilding[], t: number, boostUntilMs: number, k: number): PlacedBuilding[] {
  return buildings.map((b) => {
    if (t <= b.lastMs) return b;
    if (b.level < 1) return { ...b, lastMs: t };
    const rate = building(b.building).levels[b.level - 1]?.rate;
    if (!rate) return { ...b, lastMs: t };
    const boosted = Math.max(0, Math.min(t, boostUntilMs) - b.lastMs); // la finestra del Faro sta all'inizio del tratto
    const buffer = fill(fill(b.buffer, rate, boosted / HOUR, k), rate, (t - b.lastMs - boosted) / HOUR, 1);
    return { ...b, buffer, lastMs: t };
  });
}

export function advance(lot: LotState, nowMs: number): LotState {
  if (nowMs <= lot.nowMs) return lot;
  const boostUntil = lot.boostUntilMs ?? 0;
  const k = boostFactor(lot);
  let buildings = lot.buildings;
  let construction = lot.construction;
  if (construction && nowMs >= construction.endsMs) {
    const c = construction;
    // fino alla fine del cantiere si produce al livello vecchio, poi al nuovo
    buildings = produceTo(buildings, Math.max(c.endsMs, lot.nowMs), boostUntil, k);
    buildings = buildings.map((b) => (b.id === c.placedId ? { ...b, level: c.level, lastMs: Math.max(b.lastMs, c.endsMs) } : b));
    construction = null;
  }
  const kAfter = boostFactor({ ...lot, buildings }); // il Faro appena finito vale da subito
  buildings = produceTo(buildings, nowMs, boostUntil, kAfter);
  return { ...lot, nowMs, construction, buildings, version: lot.version + 1 };
}
