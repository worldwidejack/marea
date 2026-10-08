// Azioni economiche pure: ogni azione fa prima advance(nowMs), poi controlla e lancia EconomyError in italiano (con `manca` se mancano risorse).
import { AVATAR, BALANCE, DECOR, building } from '@marea/content';
import { advance, storageCap } from './advance.ts';
import { buildCellError, decorCellError, defaultTemplate, dockCell } from './cells.ts';
import type { LotTemplate } from './cells.ts';
import { EconomyError, ZERO, add, geq, missing, sub } from './types.ts';
import type { LotState, PlacedBuilding, PlacedDecor, Resources } from './types.ts';

/** Lotto nuovo: Molo L1 sul molo `d` del template (default: `lotto` di islands.json; va bene anche un GridMap) + partenza da BALANCE. */
export function newLot(owner: string, nowMs: number, tpl: LotTemplate | null = defaultTemplate()): LotState {
  const cell = dockCell(tpl);
  const molo: PlacedBuilding = { id: 'molo', building: 'molo', level: 1, cell, buffer: 0, lastMs: nowMs };
  return {
    owner, version: 0, nowMs, resources: { ...BALANCE.partenza }, buildings: [molo], construction: null, decor: [],
    escrow: { ...ZERO }, ledger: { generated: { ...BALANCE.partenza }, spent: { ...ZERO } }, boostUntilMs: 0,
    challenges: { day: 0, used: 0 }, posseduti: [], holds: {}, settled: [],
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

/** Costruisce in una cella `L` libera del template (default `lotto`; null = nessun controllo sul tipo di cella). */
export function build(lot0: LotState, buildingId: string, cell: [number, number], nowMs: number, tpl: LotTemplate | null = defaultTemplate()): LotState {
  let lot = advance(lot0, nowMs);
  if (lot.construction) throw new EconomyError('cantiere', 'C’è già un cantiere in corso');
  const def = building(buildingId);
  if (lot.buildings.some((b) => b.building === buildingId)) throw new EconomyError('unico', `Hai già: ${def.nome}`);
  if (def.requires && !lot.buildings.some((b) => b.building === def.requires && b.level >= 1)) throw new EconomyError('requisito', `Serve prima: ${building(def.requires).nome}`);
  const bad = buildCellError(lot, cell, tpl);
  if (bad) throw new EconomyError(bad.code, bad.msg);
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

/** Decorazione: costa Perle (il prezzo lo passa il chiamante dal catalogo `DECOR`), istantanea, su sabbia/erba libera del template. */
export function placeDecor(lot0: LotState, decor: string, cell: [number, number], rot: number, nowMs: number, costPerle = 0, tpl: LotTemplate | null = defaultTemplate()): LotState {
  let lot = advance(lot0, nowMs);
  if (!Number.isInteger(costPerle) || costPerle < 0) throw new EconomyError('sconosciuto', 'Prezzo della decorazione non valido');
  const bad = decorCellError(lot, cell, tpl);
  if (bad) throw new EconomyError(bad.code, bad.msg);
  if (!Number.isInteger(rot) || rot < 0 || rot > 3) throw new EconomyError('posizione', 'Rotazione non valida (0-3)');
  lot = pay(lot, { ...ZERO, perle: costPerle });
  const placed: PlacedDecor = { id: `${decor}-${nextDecorN(lot)}`, decor, cell };
  if (rot) placed.rot = rot;
  return { ...lot, version: lot.version + 1, decor: [...lot.decor, placed] };
}

/** Numero per l'id della prossima decorazione (`<decor>-<n>`): oltre tutti quelli già usati, così dopo una vendita non si ripete un id. */
function nextDecorN(lot: LotState): number {
  let n = lot.decor.length;
  for (const d of lot.decor) { const k = Number(d.id.slice(d.id.lastIndexOf('-') + 1)); if (Number.isInteger(k) && k > n) n = k; }
  return n + 1;
}
function findDecor(lot: LotState, id: string): PlacedDecor {
  const d = lot.decor.find((x) => x.id === id);
  if (!d) throw new EconomyError('sconosciuto', 'Decorazione non trovata');
  return d;
}

/** Perle che tornano rivendendo una decorazione (#108): BALANCE.decor.rimborso del prezzo di catalogo, per difetto. Sconosciuta = 0. */
export function decorRimborso(decor: string): number {
  const p = DECOR.find((d) => d.id === decor)?.perle ?? 0;
  return Math.max(0, Math.floor(p * BALANCE.decor.rimborso));
}

/** Sposta una decorazione (#108) in un'altra cella valida (stesse regole di placeDecor; la sua cella di adesso non conta come occupata). */
export function moveDecor(lot0: LotState, id: string, cell: [number, number], nowMs: number, tpl: LotTemplate | null = defaultTemplate()): LotState {
  const lot = advance(lot0, nowMs);
  const d = findDecor(lot, id);
  if (d.cell[0] === cell[0] && d.cell[1] === cell[1]) return lot;
  const bad = decorCellError({ ...lot, decor: lot.decor.filter((x) => x.id !== id) }, cell, tpl);
  if (bad) throw new EconomyError(bad.code, bad.msg);
  return { ...lot, version: lot.version + 1, decor: lot.decor.map((x) => (x.id === id ? { ...x, cell: [cell[0], cell[1]] } : x)) };
}

/** Ruota una decorazione di 90° (#108): rot 0 → 1 → 2 → 3 → 0 (assente = 0). */
export function rotateDecor(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  findDecor(lot, id);
  return {
    ...lot, version: lot.version + 1,
    decor: lot.decor.map((x) => {
      if (x.id !== id) return x;
      const rot = ((x.rot ?? 0) + 1) % 4, out: PlacedDecor = { id: x.id, decor: x.decor, cell: x.cell };
      if (rot) out.rot = rot;
      return out;
    }),
  };
}

/** Rivende una decorazione (#108): sparisce dall'isola e tornano `decorRimborso` Perle (entrata nel libro mastro, come le altre). */
export function sellDecor(lot0: LotState, id: string, nowMs: number): { lot: LotState; perle: number } {
  const lot = advance(lot0, nowMs);
  const d = findDecor(lot, id), perle = decorRimborso(d.decor), back: Resources = { ...ZERO, perle };
  return {
    perle,
    lot: {
      ...lot, version: lot.version + 1, decor: lot.decor.filter((x) => x.id !== id),
      resources: add(lot.resources, back), ledger: { ...lot.ledger, generated: add(lot.ledger.generated, back) },
    },
  };
}

/** Cappelli posseduti: i gratuiti (perle 0) sono di tutti, gli altri solo se comprati. */
export function ownsHat(lot: LotState, hatId: string): boolean {
  const h = AVATAR.cappelli.find((x) => x.id === hatId);
  return !!h && (h.perle <= 0 || (lot.posseduti ?? []).includes(hatId));
}

/** Compra un cappello a pagamento, una volta sola (GDD §4): le Perle sono spese, il cappello va in `posseduti`. */
export function buyHat(lot0: LotState, hatId: string, nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  const h = AVATAR.cappelli.find((x) => x.id === hatId);
  if (!h) throw new EconomyError('sconosciuto', 'Cappello sconosciuto');
  if (h.perle <= 0) throw new EconomyError('cappello', `${h.nome}: è gratis, non serve comprarlo`);
  if (ownsHat(lot, hatId)) throw new EconomyError('unico', `Hai già: ${h.nome}`);
  lot = pay(lot, { ...ZERO, perle: h.perle });
  return { ...lot, version: lot.version + 1, posseduti: [...(lot.posseduti ?? []), hatId] };
}

/** Prossimo livello di un edificio piazzato (costo e secondi), o null se è al massimo. Utile alla UI. */
export function nextLevel(b: PlacedBuilding): { cost: Resources; seconds: number } | null {
  const lvl = building(b.building).levels[b.level];
  return lvl ? { cost: lvl.cost, seconds: lvl.seconds } : null;
}

export { BALANCE };
