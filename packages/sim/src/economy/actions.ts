// Azioni economiche pure: lanciano EconomyError in italiano. Stub funzionante (WP0); WP3 completa.
import { BALANCE, building } from '@marea/content';
import type { GridMap } from '../world/grid.ts';
import { advance, storageCap } from './advance.ts';
import { EconomyError, ZERO, add, geq, sub } from './types.ts';
import type { LotState, PlacedBuilding, Resources } from './types.ts';

export function newLot(owner: string, nowMs: number, map?: GridMap): LotState {
  const cell: [number, number] = map ? [map.worldToCell(map.spawn.x, map.spawn.z).cx, map.worldToCell(map.spawn.x, map.spawn.z).cz + 1] : [0, 0];
  const molo: PlacedBuilding = { id: 'molo', building: 'molo', level: 1, cell, buffer: 0, lastMs: nowMs };
  return {
    owner, version: 0, nowMs, resources: { ...BALANCE.partenza }, buildings: [molo], construction: null, decor: [],
    escrow: { ...ZERO }, ledger: { generated: { ...BALANCE.partenza }, spent: { ...ZERO } }, boostUntilMs: 0,
  };
}

export function collect(lot0: LotState, placedId: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const b = lot.buildings.find((x) => x.id === placedId);
  if (!b) throw new EconomyError('sconosciuto', 'Edificio non trovato');
  const def = building(b.building);
  const res = def.produces;
  if (!res || b.buffer < 1) return lot;
  const cap = storageCap(lot);
  const room = Math.max(0, cap - lot.resources[res]);
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

function pay(lot: LotState, cost: Resources): LotState {
  if (!geq(lot.resources, cost)) {
    const manca = sub(cost, lot.resources);
    throw new EconomyError('risorse', 'Risorse insufficienti', { legno: Math.max(0, manca.legno), pietra: Math.max(0, manca.pietra), perle: Math.max(0, manca.perle) });
  }
  return { ...lot, resources: sub(lot.resources, cost), ledger: { ...lot.ledger, spent: add(lot.ledger.spent, cost) } };
}

export function build(lot0: LotState, buildingId: string, cell: [number, number], nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  if (lot.construction) throw new EconomyError('cantiere', 'C’è già un cantiere in corso');
  const def = building(buildingId);
  if (def.requires && !lot.buildings.some((b) => b.building === def.requires && b.level >= 1)) throw new EconomyError('requisito', `Serve prima: ${building(def.requires).nome}`);
  if (lot.buildings.some((b) => b.cell[0] === cell[0] && b.cell[1] === cell[1])) throw new EconomyError('cella', 'Cella occupata');
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
  const lvl = def.levels[b.level];
  if (!lvl) throw new EconomyError('livello', 'Livello massimo raggiunto');
  lot = pay(lot, lvl.cost);
  return { ...lot, version: lot.version + 1, construction: { building: b.building, level: b.level + 1, endsMs: nowMs + lvl.seconds * 1000, placedId } };
}

export function placeDecor(lot0: LotState, decor: string, cell: [number, number], rot: number, nowMs: number, costPerle: number): LotState {
  let lot = advance(lot0, nowMs);
  lot = pay(lot, { ...ZERO, perle: costPerle });
  return { ...lot, version: lot.version + 1, decor: [...lot.decor, { id: `${decor}-${lot.decor.length + 1}`, decor, cell, rot }] };
}

export { BALANCE };
