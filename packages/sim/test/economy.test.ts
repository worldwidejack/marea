import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ISLANDS, building } from '@marea/content';
import { parseIsland } from '../src/world/grid.ts';
import { build, collect, newLot, placeDecor, upgrade } from '../src/economy/actions.ts';
import { advance, bufferCap, storageCap } from '../src/economy/advance.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { cellsOf } from '../src/economy/cells.ts';
import { EconomyError, ZERO } from '../src/economy/types.ts';
import type { LotState, Resources } from '../src/economy/types.ts';

const H = 3_600_000;
const m = parseIsland(ISLANDS[0]!);
const cell = (i: number): [number, number] => [m.lots[i]!.cx, m.lots[i]!.cz];
const grass = (i: number): [number, number] => cellsOf(m, 'g')[i]!;
const lvl = (id: string, l: number) => building(id).levels[l - 1]!;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
/** Un lotto ricco, col Faro al livello dato. */
function richLot(owner: string, t: number, faro = 0): LotState {
  const l = newLot(owner, t, m);
  const rich: Resources = { legno: 5000, pietra: 5000, perle: 100 };
  const bs = [...l.buildings];
  if (faro) bs.push({ id: 'faro-3', building: 'faro', level: faro, cell: cell(1), buffer: 0, lastMs: t });
  return { ...l, buildings: bs, monete: 100, resources: rich, ledger: { generated: rich, spent: { ...ZERO }, monete: { generated: 100, spent: 0 } } };
}

test('segheria: costruisci, aspetta, raccogli; invariante ok', () => {
  const t0 = 1_000_000;
  let lot = newLot('jack', t0, m);
  lot = build(lot, 'segheria', cell(0), t0, m);
  assert.equal(lot.resources.legno, BALANCE.partenza.legno - lvl('segheria', 1).cost.legno);
  assert.ok(lot.construction);
  const end = t0 + lvl('segheria', 1).seconds * 1000;
  lot = advance(lot, end + 2 * H);
  assert.equal(lot.construction, null);
  const seg = lot.buildings.find((b) => b.building === 'segheria')!;
  assert.ok(Math.abs(seg.buffer - 2 * lvl('segheria', 1).rate!) < 1e-6, `buffer ${seg.buffer}`);
  const before = lot.resources.legno;
  lot = collect(lot, seg.id, end + 2 * H);
  assert.equal(lot.resources.legno, before + Math.floor(2 * lvl('segheria', 1).rate!));
  assert.equal(checkInvariant([lot]), null);
});

test('deposito in due tempi: pieno per bufferOre, poi lento fino al tetto; il magazzino fa da tetto', () => {
  let lot = newLot('a', 0, m);
  lot = build(lot, 'segheria', cell(1), 0, m);
  const r = lvl('segheria', 1).rate!;
  const T0 = lvl('segheria', 1).seconds * 1000;
  const bOre = BALANCE.bufferOre;
  const q = (BALANCE as unknown as { bufferLentoQuota?: number }).bufferLentoQuota ?? 0;
  const at = (h: number) => advance(lot, T0 + h * H).buildings.find((b) => b.building === 'segheria')!.buffer;
  assert.ok(Math.abs(at(bOre) - r * bOre) < 1e-6);
  assert.ok(Math.abs(at(bOre + 4) - r * (bOre + 4 * q)) < 1e-6, 'dopo bufferOre la velocità scende a bufferLentoQuota');
  const seg = advance(lot, T0 + 10_000 * H).buildings.find((b) => b.building === 'segheria')!;
  assert.ok(Math.abs(seg.buffer - bufferCap(seg)) < 1e-6, 'tetto del deposito');
  // lazy = a passi: stesso risultato che avanzare in un colpo
  let step = lot;
  for (let h = 1; h <= 30; h++) step = advance(step, T0 + h * H);
  assert.ok(Math.abs(step.buildings.find((b) => b.building === 'segheria')!.buffer - at(30)) < 1e-6);
  lot = { ...lot, resources: { ...lot.resources, legno: storageCap(lot) - 5 } };
  const after = collect(lot, 'segheria-2', T0 + 10 * H);
  assert.equal(after.resources.legno, storageCap(lot), 'si raccoglie fino al tetto del magazzino');
  assert.ok(after.buildings.find((b) => b.building === 'segheria')!.buffer > 0, 'il resto resta nel deposito');
});

test('cantiere unico; miglioramento: produce al livello vecchio fino alla fine del cantiere', () => {
  let lot = richLot('a', 0);
  lot = build(lot, 'segheria', cell(2), 0, m);
  assert.throws(() => build(lot, 'cava', cell(3), 1000, m), isErr('cantiere'));
  const t1 = lvl('segheria', 1).seconds * 1000;
  lot = upgrade(lot, 'segheria-2', t1);
  assert.throws(() => upgrade(lot, 'segheria-2', t1 + 1), isErr('cantiere'));
  const t2 = t1 + lvl('segheria', 2).seconds * 1000;
  lot = advance(lot, t2 + H);
  const seg = lot.buildings.find((b) => b.id === 'segheria-2')!;
  assert.equal(seg.level, 2);
  const expect = (lvl('segheria', 1).rate! * (t2 - t1)) / H + lvl('segheria', 2).rate!;
  assert.ok(Math.abs(seg.buffer - expect) < 1e-6, `buffer ${seg.buffer} atteso ${expect}`);
});

test('errori in italiano: risorse (con manca), unico, cella, requisito, livello massimo, sconosciuto', () => {
  const lot = newLot('a', 0, m);
  const faro = lvl('faro', 1).cost;
  assert.throws(() => build({ ...lot, resources: { ...ZERO } }, 'faro', cell(0), 0, m), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.legno === faro.legno && (e as EconomyError).manca!.pietra === faro.pietra);
  const l2 = build(richLot('b', 0), 'segheria', cell(0), 0, m);
  const l3 = advance(l2, H);
  assert.throws(() => build(l3, 'segheria', cell(1), H, m), isErr('unico'));
  assert.throws(() => build(l3, 'cava', cell(0), H, m), isErr('cella'));
  assert.throws(() => build({ ...l3, buildings: l3.buildings.filter((b) => b.building !== 'molo') }, 'cava', cell(1), H, m), isErr('requisito'));
  assert.throws(() => upgrade(l3, 'nessuno', H), isErr('sconosciuto'));
  const max = { ...l3, buildings: l3.buildings.map((b) => (b.building === 'segheria' ? { ...b, level: building('segheria').levels.length } : b)) };
  assert.throws(() => upgrade(max, 'segheria-2', H), isErr('livello'));
});

test('decorazioni: costano monete, cella libera', () => {
  let lot = richLot('a', 0);
  lot = placeDecor(lot, 'lanterna', grass(0), 0, 0, 5, m);
  assert.equal(lot.monete, 95);
  assert.throws(() => placeDecor(lot, 'lanterna', grass(0), 0, 0, 5, m), isErr('cella'));
  assert.throws(() => placeDecor({ ...lot, monete: 1 }, 'torii', grass(1), 0, 0, 5, m), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.monete === 4);
  assert.equal(checkInvariant([lot]), null);
});

test('Faro: produzione col boost solo dentro la finestra', () => {
  const hours = lvl('faro', 1).boostHours!;
  let s = richLot('s', 0, 1);
  s = { ...s, boostUntilMs: hours * H, buildings: [...s.buildings, { id: 'seg', building: 'segheria', level: 1, cell: cell(4), buffer: 0, lastMs: 0 }] };
  const b = advance(s, 4 * H).buildings.find((x) => x.id === 'seg')!.buffer;
  const r = lvl('segheria', 1).rate!, k = lvl('faro', 1).boost!;
  assert.ok(Math.abs(b - r * (hours * k + (4 - hours))) < 1e-6, `buffer col Faro ${b}`);
});
