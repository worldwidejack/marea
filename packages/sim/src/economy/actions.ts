// Azioni economiche pure: ogni azione fa prima advance(nowMs), poi controlla e lancia EconomyError in italiano (con `manca` se mancano risorse).
import { AVATAR, BALANCE, DECOR, building } from '@marea/content';
import { advance, storageCap } from './advance.ts';
import { buildCellError, decorCellError, defaultTemplate, dockCell } from './cells.ts';
import type { LotTemplate } from './cells.ts';
import { EconomyError, ZERO, add, geq, missing, sub } from './types.ts';
import type { LotState, PlacedBuilding, PlacedDecor, Resources, StoredBuilding } from './types.ts';

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

/** Costruisce in una cella libera dell'isola (#382; default template `lotto`; null = nessun controllo sul tipo di cella). */
export function build(lot0: LotState, buildingId: string, cell: [number, number], nowMs: number, tpl: LotTemplate | null = defaultTemplate()): LotState {
  let lot = advance(lot0, nowMs);
  if (lot.construction) throw new EconomyError('cantiere', 'C’è già un cantiere in corso');
  const def = building(buildingId);
  if (lot.buildings.some((b) => b.building === buildingId)) throw new EconomyError('unico', `Hai già: ${def.nome}`);
  if (def.requires && !lot.buildings.some((b) => b.building === def.requires && b.level >= 1)) throw new EconomyError('requisito', `Serve prima: ${building(def.requires).nome}`);
  const bad = buildCellError(lot, cell, tpl, buildingId);
  if (bad) throw new EconomyError(bad.code, bad.msg);
  const lvl = def.levels[0];
  if (!lvl) throw new EconomyError('livello', 'Edificio senza livelli');
  lot = pay(lot, lvl.cost);
  const id = `${buildingId}-${lot.buildings.length + 1}`;
  const placed: PlacedBuilding = { id, building: buildingId, level: 0, cell, buffer: 0, lastMs: nowMs };
  return { ...lot, version: lot.version + 1, buildings: [...lot.buildings, placed], construction: { building: buildingId, level: 1, endsMs: nowMs + lvl.seconds * 1000, placedId: id } };
}

/** Sposta un edificio (#382) in un'altra cella valida dell'isola (stessa cella = invariato; la sua cella attuale non conta come occupata). */
export function moveBuilding(lot0: LotState, id: string, cell: [number, number], nowMs: number, tpl: LotTemplate | null = defaultTemplate()): LotState {
  const lot = advance(lot0, nowMs);
  const b = lot.buildings.find((x) => x.id === id);
  if (!b) throw new EconomyError('sconosciuto', 'Edificio non trovato');
  if (b.building === 'molo') throw new EconomyError('posizione', 'Il Molo deve restare all’attracco');
  if (b.cell[0] === cell[0] && b.cell[1] === cell[1]) return lot;
  const bad = buildCellError({ ...lot, buildings: lot.buildings.filter((x) => x.id !== id) }, cell, tpl, b.building);
  if (bad) throw new EconomyError(bad.code, bad.msg);
  return { ...lot, version: lot.version + 1, buildings: lot.buildings.map((x) => (x.id === id ? { ...x, cell: [cell[0], cell[1]] } : x)) };
}

/** Ruota un edificio di 90° (#403): rot 0 → 1 → 2 → 3 → 0 (assente = 0). Il Molo non si ruota. */
export function rotateBuilding(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const b = lot.buildings.find((x) => x.id === id);
  if (!b) throw new EconomyError('sconosciuto', 'Edificio non trovato');
  if (b.building === 'molo') throw new EconomyError('posizione', 'Il Molo non si ruota');
  const rot = ((b.rot ?? 0) + 1) % 4;
  return {
    ...lot,
    version: lot.version + 1,
    buildings: lot.buildings.map((x) => {
      if (x.id !== id) return x;
      const next: PlacedBuilding = { ...x };
      if (rot) next.rot = rot; else delete next.rot;
      return next;
    }),
  };
}

/** Ripone un edificio nel magazzino (#403): esce dall'isola e va in magazzinoEdifici. Il Molo e i cantieri non si ripongono. */
export function stowBuilding(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const b = lot.buildings.find((x) => x.id === id);
  if (!b) throw new EconomyError('sconosciuto', 'Edificio non trovato');
  if (b.building === 'molo') throw new EconomyError('posizione', 'Il Molo non si può riporre');
  if (lot.construction?.placedId === id) throw new EconomyError('cantiere', 'L’edificio è in costruzione');
  const stored: StoredBuilding = { id: b.id, building: b.building, level: b.level, buffer: b.buffer, lastMs: b.lastMs };
  if (b.rot) stored.rot = b.rot;
  return {
    ...lot,
    version: lot.version + 1,
    buildings: lot.buildings.filter((x) => x.id !== id),
    magazzinoEdifici: [...(lot.magazzinoEdifici ?? []), stored],
  };
}

/** Ripone tutti gli edifici possibili nel magazzino (#403, "Riponi tutto" stile Clash of Clans). Il Molo e i cantieri restano. */
export function stowAllBuildings(lot0: LotState, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const keep: PlacedBuilding[] = [];
  const toStow: StoredBuilding[] = [];
  for (const b of lot.buildings) {
    if (b.building === 'molo' || lot.construction?.placedId === b.id) {
      keep.push(b);
    } else {
      const s: StoredBuilding = { id: b.id, building: b.building, level: b.level, buffer: b.buffer, lastMs: b.lastMs };
      if (b.rot) s.rot = b.rot;
      toStow.push(s);
    }
  }
  return {
    ...lot,
    version: lot.version + 1,
    buildings: keep,
    magazzinoEdifici: [...(lot.magazzinoEdifici ?? []), ...toStow],
  };
}

/** Posa un edificio dal magazzino sull'isola (#403). */
export function placeStoredBuilding(lot0: LotState, id: string, cell: [number, number], rot = 0, nowMs: number, tpl: LotTemplate | null = defaultTemplate()): LotState {
  const lot = advance(lot0, nowMs);
  const mag = lot.magazzinoEdifici ?? [];
  const b = mag.find((x) => x.id === id);
  if (!b) throw new EconomyError('sconosciuto', 'Edificio non trovato nel magazzino');
  const bad = buildCellError(lot, cell, tpl, b.building);
  if (bad) throw new EconomyError(bad.code, bad.msg);
  if (!Number.isInteger(rot) || rot < 0 || rot > 3) throw new EconomyError('posizione', 'Rotazione non valida (0-3)');
  const placed: PlacedBuilding = { id: b.id, building: b.building, level: b.level, cell: [cell[0], cell[1]], buffer: b.buffer, lastMs: nowMs };
  const r = rot || (b.rot ?? 0);
  if (r) placed.rot = r;
  return {
    ...lot,
    version: lot.version + 1,
    buildings: [...lot.buildings, placed],
    magazzinoEdifici: mag.filter((x) => x.id !== id),
  };
}

export type BuildingPlacement = { id: string; cell: [number, number]; rot?: number };
export type LayoutChange = { placed: BuildingPlacement[]; stowed?: string[] };

/**
 * Applica una disposizione completa degli edifici sull'isola (#403, modalità modifica rapida):
 * valida che tutti gli edifici piazzati stiano su celle libere e valide, che il Molo sia al suo posto,
 * e sposta / ruota / ripone in un'unica transazione atomica.
 */
export function applyBuildingLayout(lot0: LotState, layout: LayoutChange, nowMs: number, tpl: LotTemplate | null = defaultTemplate()): LotState {
  const lot = advance(lot0, nowMs);
  const currentBuildings = new Map<string, PlacedBuilding | StoredBuilding>();
  for (const b of lot.buildings) currentBuildings.set(b.id, b);
  for (const b of (lot.magazzinoEdifici ?? [])) currentBuildings.set(b.id, b);

  const placedIds = new Set(layout.placed.map((p) => p.id));
  const stowedIds = new Set(layout.stowed ?? []);

  // Controllo duplicati
  if (layout.placed.length !== placedIds.size) throw new EconomyError('posizione', 'Edifici duplicati nella disposizione');
  for (const id of stowedIds) {
    if (placedIds.has(id)) throw new EconomyError('posizione', `Edificio sia posato che riposto: ${id}`);
  }

  // Verifica che tutti gli id esistano nel lotto
  for (const id of placedIds) {
    if (!currentBuildings.has(id)) throw new EconomyError('sconosciuto', `Edificio sconosciuto: ${id}`);
  }
  for (const id of stowedIds) {
    if (!currentBuildings.has(id)) throw new EconomyError('sconosciuto', `Edificio sconosciuto: ${id}`);
  }

  // Molo deve essere posato e non può andare in magazzino
  const molo = lot.buildings.find((b) => b.building === 'molo');
  if (molo) {
    if (stowedIds.has(molo.id)) throw new EconomyError('posizione', 'Il Molo deve restare all’attracco');
    if (!placedIds.has(molo.id)) {
      layout.placed.push({ id: molo.id, cell: molo.cell, rot: molo.rot });
      placedIds.add(molo.id);
    }
  }

  // Se c'è un cantiere in corso, non può essere riposto
  if (lot.construction && stowedIds.has(lot.construction.placedId)) {
    throw new EconomyError('cantiere', 'L’edificio in cantiere non si può riporre');
  }

  // Controllo sovrapposizioni tra edifici posati
  const seenCells = new Set<string>();
  for (const p of layout.placed) {
    const k = `${p.cell[0]},${p.cell[1]}`;
    if (seenCells.has(k)) throw new EconomyError('cella', 'Due edifici sulla stessa cella');
    seenCells.add(k);
  }

  // Verifica validità celle rispetto al terreno, template e decorazioni
  const emptyLot: LotState = { ...lot, buildings: [] };
  for (const p of layout.placed) {
    const b = currentBuildings.get(p.id)!;
    const err = buildCellError(emptyLot, p.cell, tpl, b.building);
    if (err) throw new EconomyError(err.code, err.msg);
    if (p.rot !== undefined && (!Number.isInteger(p.rot) || p.rot < 0 || p.rot > 3)) {
      throw new EconomyError('posizione', 'Rotazione non valida (0-3)');
    }
  }

  // Costruisci il nuovo elenco edifici
  const newBuildings: PlacedBuilding[] = layout.placed.map((p) => {
    const orig = currentBuildings.get(p.id)!;
    const pb: PlacedBuilding = {
      id: orig.id,
      building: orig.building,
      level: orig.level,
      cell: [p.cell[0], p.cell[1]],
      buffer: orig.buffer,
      lastMs: orig.lastMs,
    };
    const rot = p.rot !== undefined ? p.rot : orig.rot;
    if (rot) pb.rot = rot;
    return pb;
  });

  // Costruisci il nuovo elenco magazzino
  const newMagazzino: StoredBuilding[] = [];
  for (const id of stowedIds) {
    const orig = currentBuildings.get(id)!;
    const sb: StoredBuilding = {
      id: orig.id,
      building: orig.building,
      level: orig.level,
      buffer: orig.buffer,
      lastMs: orig.lastMs,
    };
    if (orig.rot) sb.rot = orig.rot;
    newMagazzino.push(sb);
  }
  for (const sb of (lot.magazzinoEdifici ?? [])) {
    if (!placedIds.has(sb.id) && !stowedIds.has(sb.id)) {
      newMagazzino.push(sb);
    }
  }
  for (const pb of lot.buildings) {
    if (!placedIds.has(pb.id) && !stowedIds.has(pb.id)) {
      if (pb.building === 'molo') {
        newBuildings.push(pb);
      } else {
        const sb: StoredBuilding = { id: pb.id, building: pb.building, level: pb.level, buffer: pb.buffer, lastMs: pb.lastMs };
        if (pb.rot) sb.rot = pb.rot;
        newMagazzino.push(sb);
      }
    }
  }

  return {
    ...lot,
    version: lot.version + 1,
    buildings: newBuildings,
    magazzinoEdifici: newMagazzino,
  };
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

export { BALANCE };
