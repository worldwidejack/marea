import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLANDS } from '@marea/content';
import { parseIsland } from '../src/world/grid.ts';
import { newLot, build, collect } from '../src/economy/actions.ts';
import { advance } from '../src/economy/advance.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { EconomyError } from '../src/economy/types.ts';

const H = 3_600_000;
test('segheria: costruisci, aspetta, raccogli; invariante ok', () => {
  const m = parseIsland(ISLANDS[0]!);
  const t0 = 1_000_000;
  let lot = newLot('jack', t0, m);
  const cell = m.lots[0]!;
  lot = build(lot, 'segheria', [cell.cx, cell.cz], t0);
  assert.equal(lot.resources.legno, 70);
  assert.ok(lot.construction);
  lot = advance(lot, t0 + 60_000); // cantiere finito (30 s)
  assert.equal(lot.construction, null);
  lot = advance(lot, t0 + 60_000 + 2 * H);
  const seg = lot.buildings.find((b) => b.building === 'segheria')!;
  assert.ok(seg.buffer > 39 && seg.buffer < 41, `buffer ${seg.buffer}`);
  lot = collect(lot, seg.id, t0 + 60_000 + 2 * H);
  assert.equal(lot.resources.legno, 110);
  assert.equal(checkInvariant([lot]), null);
});
test('buffer si ferma a bufferOre; magazzino fa da tetto', () => {
  const m = parseIsland(ISLANDS[0]!);
  const t0 = 0;
  let lot = newLot('a', t0, m);
  const c = m.lots[1]!;
  lot = build(lot, 'segheria', [c.cx, c.cz], t0);
  lot = advance(lot, 100 * H);
  const seg = lot.buildings.find((b) => b.building === 'segheria')!;
  assert.equal(Math.round(seg.buffer), 200); // 20/h × 10 h
  lot = collect(lot, seg.id, 100 * H);
  assert.equal(lot.resources.legno, 200); // tetto capBase
  assert.equal(checkInvariant([lot]), null);
});
test('senza risorse → errore in italiano con quanto manca', () => {
  const m = parseIsland(ISLANDS[0]!);
  const lot = newLot('a', 0, m);
  const c = m.lots[0]!;
  assert.throws(() => build(lot, 'faro', [c.cx, c.cz], 0), (e: unknown) => e instanceof EconomyError && e.code === 'risorse' && e.manca!.legno === 20 && e.manca!.pietra === 80);
});
