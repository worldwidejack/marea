// Modalità modifica rapida edifici (#403): rotazione, riponi nel magazzino, riponi tutto, posa da magazzino, disposizione batch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyBuildingLayout, build, newLot, placeStoredBuilding, rotateBuilding, stowAllBuildings, stowBuilding } from '../src/economy/actions.ts';
import { cellsOf, dockCell } from '../src/economy/cells.ts';
import type { LotTemplate } from '../src/economy/cells.ts';
import { isErr } from './economia_util.ts';


const T: LotTemplate = { rows: [
  '~~~~~~~~~~',
  '~..gggg..~',
  '~.gLggLg.~',
  '~.ggrrgg.~',
  '~.gLggLg.~',
  '~...P....~',
  '~,,.dd.,,~',
  '~,,,,B,,,~',
] };
const L = cellsOf(T, 'L');

test('rotateBuilding: ruota di 90 gradi ad ogni chiamata (0 -> 1 -> 2 -> 3 -> 0)', () => {
  let lot = newLot('a', 0, T);
  lot = build(lot, 'segheria', L[0]!, 0, T);
  const seg = lot.buildings.find((b) => b.building === 'segheria')!;
  assert.equal(seg.rot, undefined);

  lot = rotateBuilding(lot, seg.id, 10);
  assert.equal(lot.buildings.find((b) => b.id === seg.id)!.rot, 1);

  lot = rotateBuilding(lot, seg.id, 20);
  assert.equal(lot.buildings.find((b) => b.id === seg.id)!.rot, 2);

  lot = rotateBuilding(lot, seg.id, 30);
  assert.equal(lot.buildings.find((b) => b.id === seg.id)!.rot, 3);

  lot = rotateBuilding(lot, seg.id, 40);
  assert.equal(lot.buildings.find((b) => b.id === seg.id)!.rot, undefined);

  // Molo non si ruota
  const molo = lot.buildings.find((b) => b.building === 'molo')!;
  assert.throws(() => rotateBuilding(lot, molo.id, 50), isErr('posizione'));
});

test('stowBuilding e placeStoredBuilding: riponi nel magazzino e riposiziona', () => {
  let lot = newLot('a', 0, T);
  lot = build(lot, 'segheria', L[0]!, 0, T);
  const segId = lot.buildings.find((b) => b.building === 'segheria')!.id;

  // Non si può riporre se c'è un cantiere attivo
  assert.throws(() => stowBuilding(lot, segId, 10), isErr('cantiere'));

  // Cantiere finito
  lot = { ...lot, construction: null, buildings: lot.buildings.map((b) => (b.id === segId ? { ...b, level: 1 } : b)) };

  // Molo non si ripone
  const moloId = lot.buildings.find((b) => b.building === 'molo')!.id;
  assert.throws(() => stowBuilding(lot, moloId, 20), isErr('posizione'));

  // Riponi segheria
  lot = stowBuilding(lot, segId, 30);
  assert.equal(lot.buildings.some((b) => b.id === segId), false);
  assert.equal(lot.magazzinoEdifici?.length, 1);
  assert.equal(lot.magazzinoEdifici?.[0]!.id, segId);

  // Riposiziona segheria su L[1]
  lot = placeStoredBuilding(lot, segId, L[1]!, 2, 40, T);
  assert.equal(lot.magazzinoEdifici?.length, 0);
  const placed = lot.buildings.find((b) => b.id === segId)!;
  assert.deepEqual(placed.cell, L[1]!);
  assert.equal(placed.rot, 2);
});

test('stowAllBuildings: riponi tutti gli edifici tranne il Molo e i cantieri attivi', () => {
  let lot = newLot('a', 0, T);
  lot = {
    ...lot,
    buildings: [
      ...lot.buildings,
      { id: 'segheria-1', building: 'segheria', level: 1, cell: L[0]!, buffer: 5, lastMs: 0 },
      { id: 'cava-1', building: 'cava', level: 1, cell: L[1]!, buffer: 3, lastMs: 0 },
    ],
  };

  lot = stowAllBuildings(lot, 50);
  assert.equal(lot.buildings.length, 1);
  assert.equal(lot.buildings[0]!.building, 'molo');
  assert.equal(lot.magazzinoEdifici?.length, 2);
  assert.deepEqual(lot.magazzinoEdifici?.map((b) => b.id), ['segheria-1', 'cava-1']);
});

test('applyBuildingLayout: sposta, ruota e riponi in batch con salvataggio atomico', () => {
  let lot = newLot('a', 0, T);
  const molo = lot.buildings[0]!;
  lot = {
    ...lot,
    buildings: [
      molo,
      { id: 'segheria-1', building: 'segheria', level: 1, cell: L[0]!, buffer: 5, lastMs: 0 },
      { id: 'cava-1', building: 'cava', level: 1, cell: L[1]!, buffer: 3, lastMs: 0 },
    ],
  };

  // Scambia celle tra segheria e cava, ruota la cava e salva
  const next = applyBuildingLayout(lot, {
    placed: [
      { id: 'segheria-1', cell: L[1]!, rot: 1 },
      { id: 'cava-1', cell: L[0]!, rot: 3 },
    ],
    stowed: [],
  }, 100, T);

  assert.equal(next.buildings.length, 3);
  const seg = next.buildings.find((b) => b.id === 'segheria-1')!;
  const cav = next.buildings.find((b) => b.id === 'cava-1')!;
  assert.deepEqual(seg.cell, L[1]!);
  assert.equal(seg.rot, 1);
  assert.deepEqual(cav.cell, L[0]!);
  assert.equal(cav.rot, 3);
  // Il Molo è rimasto al suo posto anche se non esplicitamente passato
  assert.deepEqual(next.buildings.find((b) => b.id === molo.id)!.cell, dockCell(T));

  // Riponi segheria in magazzino tramite layout
  const next2 = applyBuildingLayout(next, {
    placed: [
      { id: 'cava-1', cell: L[0]! },
    ],
    stowed: ['segheria-1'],
  }, 200, T);

  assert.equal(next2.buildings.length, 2);
  assert.equal(next2.magazzinoEdifici?.length, 1);
  assert.equal(next2.magazzinoEdifici?.[0]!.id, 'segheria-1');
});
