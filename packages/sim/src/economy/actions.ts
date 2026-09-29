// Azioni economiche pure: ogni azione fa prima advance(nowMs), poi controlla e lancia EconomyError in italiano (con `manca` se mancano risorse).
import { BALANCE, building } from '@marea/content';
import type { GridMap } from '../world/grid.ts';
import { advance, storageCap } from './advance.ts';
import { EconomyError, ZERO, add, geq, missing, sub } from './types.ts';
import type { LotState, PlacedBuilding, Resources } from './types.ts';

export function newLot(owner: string, nowMs: number, map?: GridMap): LotState {
  const sp = map ? map.worldToCell(map.spawn.x, map.spawn.z) : { cx: 0, cz: 0 };
  const cell: [number, number] = map ? [sp.cx, sp.cz + 1] : [0, 0];
  const molo: PlacedBuilding = { id: 'molo', building: 'molo', level: 1, cell, buffer: 0, lastMs: nowMs };
  return {
    owner, version: 0, nowMs, resources: { ...BALANCE.partenza }, buildings: [molo], construction: null, decor: [],
    escrow: { ...ZERO }, ledger: { generated: { ...BALANCE.partenza }, spent: { ...ZERO } }, boostUntilMs: 0,
    challenges: { day: 0, used: 0 },
  };
}

/** Sposta nel Magazzino il deposito di un edificio, fino al tetto. Edificio non produttivo o deposito vuoto → stato invariato (dopo advance). */
export function collect(lot0: LotState, placedId: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const b = lot.buildings.find((x) => x.id === placedId);
  if (!b) throw new EconomyError('sconosciuto', 'Edificio non trovato');
  const res = building(b.building).produces;
  if (!res || b.buffer < 1) return lot;
  const room = Math.max(0, storageCap(lot) - lot.resources[res]);
  const take = Math.min(Math.floor(b.buffer), room);
  if (take <= 0) return lot;
  const gained: Resources = { ...ZERO, [res]: take };
  return {
    ...lot,
    version: lot.version + 1,
    resources: add(lot.resources, gained),
    ledger: { ...lot.ledger, generated: add(lot.ledger.generated, gained) },
    buildings: lot.buildings.map((x) => (x.id === placedId ? { ...x, buffer: x.buffer - take } : x)),
  };
}

/** Raccoglie da tutti gli edifici produttivi (comodo per client, server e test). */
export function collectAll(lot0: LotState, nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  for (const b of lot.buildings) if (building(b.building).produces) lot = collect(lot, b.id, nowMs);
  return lot;
}

export function pay(lot: LotState, cost: Resources): LotState {
  if (!geq(lot.resources, cost)) throw new EconomyError('risorse', 'Risorse insufficienti', missing(lot.resources, cost));
  return { ...lot, resources: sub(lot.resources, cost), ledger: { ...lot.ledger, spent: add(lot.ledger.spent, cost) } };
}

function occupied(lot: LotState, cell: [number, number]): boolean {
  return lot.buildings.some((b) => b.cell[0] === cell[0] && b.cell[1] === cell[1]) || lot.decor.some((d) => d.cell[0] === cell[0] && d.cell[1] === cell[1]);
}

export function build(lot0: LotState, buildingId: string, cell: [number, number], nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  if (lot.construction) throw new EconomyError('cantiere', 'C’è già un cantiere in corso');
  const def = building(buildingId);
  if (lot.buildings.some((b) => b.building === buildingId)) throw new EconomyError('unico', `Hai già: ${def.nome}`);
  if (def.requires && !lot.buildings.some((b) => b.building === def.requires && b.level >= 1)) throw new EconomyError('requisito', `Serve prima: ${building(def.requires).nome}`);
  if (occupied(lot, cell)) throw new EconomyError('cella', 'Cella occupata');
  const lvl = def.levels[0];
  if (!lvl) throw new EconomyError('livello', 'Edificio senza livelli');
  lot = pay(lot, lvl.cost);
  const id = `${buildingId}-${lot.buildings.length + 1}`;
  const placed: PlacedBuilding = { id, building: buildingId, level: 0, cell, buffer: 0, lastMs: nowMs };
  return { ...lot, version: lot.version + 1, buildings: [...lot.buildings, placed], construction: { building: buildingId, level: 1, endsMs: nowMs + lvl.seconds * 1000, placedId: id } };
}

export function upgrade(lot0: LotState, placedId: string, nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  if (lot.construction) throw new EconomyError('cantiere', 'C’è già un cantiere in corso');
  const b = lot.buildings.find((x) => x.id === placedId);
  if (!b) throw new EconomyError('sconosciuto', 'Edificio non trovato');
  const def = building(b.building);
  if (b.level < 1) throw new EconomyError('cantiere', `${def.nome}: ancora in costruzione`);
  const lvl = def.levels[b.level];
  if (!lvl) throw new EconomyError('livello', `${def.nome}: livello massimo raggiunto`);
  lot = pay(lot, lvl.cost);
  return { ...lot, version: lot.version + 1, construction: { building: b.building, level: b.level + 1, endsMs: nowMs + lvl.seconds * 1000, placedId } };
}

/** Decorazione: costa Perle (il prezzo lo passa il chiamante dal catalogo), istantanea, una per cella libera. */
export function placeDecor(lot0: LotState, decor: string, cell: [number, number], rot: number, nowMs: number, costPerle = 0): LotState {
  let lot = advance(lot0, nowMs);
  if (!Number.isInteger(costPerle) || costPerle < 0) throw new EconomyError('sconosciuto', 'Prezzo della decorazione non valido');
  if (occupied(lot, cell)) throw new EconomyError('cella', 'Cella occupata');
  lot = pay(lot, { ...ZERO, perle: costPerle });
  return { ...lot, version: lot.version + 1, decor: [...lot.decor, { id: `${decor}-${lot.decor.length + 1}`, decor, cell, rot }] };
}

/** Prossimo livello di un edificio piazzato (costo e secondi), o null se è al massimo. Utile alla UI. */
export function nextLevel(b: PlacedBuilding): { cost: Resources; seconds: number } | null {
  const lvl = building(b.building).levels[b.level];
  return lvl ? { cost: lvl.cost, seconds: lvl.seconds } : null;
}

export { BALANCE };
