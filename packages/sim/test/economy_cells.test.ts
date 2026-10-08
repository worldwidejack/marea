// Celle del lotto (template `lotto`), Molo sul molo, lotti vecchi rimessi in regola, cappelli comprati una volta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR } from '@marea/content';
import { build, buyHat, newLot, ownsHat, placeDecor } from '../src/economy/actions.ts';
import { buildCellError, cellsOf, dockCell, fitToTemplate, lotTemplate, tileAt } from '../src/economy/cells.ts';
import type { LotTemplate } from '../src/economy/cells.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { EconomyError } from '../src/economy/types.ts';

const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
/** Template sintetico con la stessa grammatica di `lotto`: 4 slot L, roccia, molo dd sotto lo spawn. */
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

test('template: il Molo iniziale sta sul primo `d`, le celle L sono gli slot', () => {
  assert.deepEqual(dockCell(T), [4, 6]);
  const lot = newLot('a', 0, T);
  assert.deepEqual(lot.buildings[0]!.cell, [4, 6]);
  assert.equal(tileAt(T, 4, 6), 'd');
  assert.equal(L.length, 4);
  assert.deepEqual(lot.posseduti, []);
  assert.deepEqual(lot.holds, {});
});

test('build: solo celle L libere del template; decor: solo sabbia/erba libere', () => {
  let lot = newLot('a', 0, T);
  for (const bad of [[0, 0], [4, 3], [4, 6], [4, 5], [2, 2], [99, 1], [-1, 2]] as [number, number][])
    assert.throws(() => build(lot, 'segheria', bad, 0, T), isErr('posizione'), `cella ${bad} accettata`);
  lot = build(lot, 'segheria', L[0]!, 0, T);
  assert.equal(buildCellError(lot, L[0]!, T)?.code, 'cella');
  assert.throws(() => build({ ...lot, construction: null }, 'cava', L[0]!, 0, T), isErr('cella'));
  const rich = { ...lot, resources: { ...lot.resources, perle: 50 }, ledger: { ...lot.ledger, generated: { ...lot.ledger.generated, perle: 50 } } };
  for (const bad of [L[1]!, [4, 6], [4, 5], [4, 3], [0, 0]] as [number, number][])
    assert.throws(() => placeDecor(rich, 'barile', bad, 0, 0, 5, T), isErr('posizione'), `decor su ${bad} accettata`);
  assert.throws(() => placeDecor(placeDecor(rich, 'barile', [1, 1], 0, 0, 5, T), 'cassa', [1, 1], 0, 0, 5, T), isErr('cella'));
  const d = placeDecor(rich, 'barile', [1, 1], 0, 0, 5, T);
  assert.equal(d.resources.perle, 45);
  assert.equal(checkInvariant([d]), null);
});

test('senza template (null) le celle non si validano; col template vero di islands.json il Molo sta su un `d`', () => {
  const lot = newLot('a', 0, null);
  assert.deepEqual(lot.buildings[0]!.cell, [0, 0]);
  assert.doesNotThrow(() => build(lot, 'segheria', [0, 1], 0, null));
  const real = lotTemplate();
  if (real) {
    const l = newLot('b', 0);
    assert.equal(tileAt(real, l.buildings[0]!.cell[0], l.buildings[0]!.cell[1]), 'd');
    const slot = cellsOf(real, 'L')[0];
    assert.ok(slot, 'il template lotto non ha celle L');
    assert.doesNotThrow(() => build(l, 'segheria', slot, 0));
    assert.throws(() => build(l, 'segheria', l.buildings[0]!.cell, 0), isErr('posizione'));
  }
});

test('fitToTemplate: un lotto vecchio (celle arbitrarie) torna nel template senza toccare risorse né libro mastro', () => {
  const old = newLot('vecchio', 0, null);
  const messy = {
    ...old,
    buildings: [...old.buildings, { id: 'segheria-2', building: 'segheria', level: 1, cell: [3, 4] as [number, number], buffer: 3, lastMs: 0 },
      { id: 'cava-3', building: 'cava', level: 1, cell: [3, 2] as [number, number], buffer: 0, lastMs: 0 }],
    decor: [{ id: 'barile-1', decor: 'barile', cell: [0, 0] as [number, number], rot: 0 }],
  };
  const fit = fitToTemplate(messy, T);
  assert.deepEqual(fit.buildings.map((b) => b.cell), [[4, 6], [3, 4], [3, 2]], 'molo sul d, gli altri restano sulle loro L');
  assert.deepEqual(fit.decor[0]!.cell, [1, 1]);
  const dup = { ...messy, buildings: [...messy.buildings, { id: 'casa-4', building: 'casa', level: 1, cell: [3, 4] as [number, number], buffer: 0, lastMs: 0 }] };
  const fit2 = fitToTemplate(dup, T);
  const cells = fit2.buildings.map((b) => b.cell.join(','));
  assert.equal(new Set(cells).size, cells.length, 'celle duplicate dopo fitToTemplate');
  for (const b of fit2.buildings.slice(1)) assert.equal(tileAt(T, b.cell[0], b.cell[1]), 'L');
  assert.deepEqual(fit2.resources, messy.resources);
  assert.equal(fitToTemplate(fit2, T), fit2, 'già in regola → stesso oggetto');
});

test('cappelli: i gratuiti sono di tutti, quelli a Perle si comprano una volta', () => {
  const free = AVATAR.cappelli.find((h) => h.perle === 0)!;
  const paid = AVATAR.cappelli.find((h) => h.perle > 0)!;
  let lot = newLot('a', 0, T);
  assert.ok(ownsHat(lot, free.id));
  assert.ok(!ownsHat(lot, paid.id));
  assert.throws(() => buyHat(lot, paid.id, 0), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.perle === paid.perle);
  assert.throws(() => buyHat(lot, free.id, 0), isErr('cappello'));
  assert.throws(() => buyHat(lot, 'tiara_inesistente', 0), isErr('sconosciuto'));
  const perle = paid.perle + 3;
  lot = { ...lot, resources: { ...lot.resources, perle }, ledger: { ...lot.ledger, generated: { ...lot.ledger.generated, perle } } };
  lot = buyHat(lot, paid.id, 1000);
  assert.equal(lot.resources.perle, 3);
  assert.ok(ownsHat(lot, paid.id));
  assert.throws(() => buyHat(lot, paid.id, 2000), isErr('unico'));
  // gli esclusivi del Mercante (#63) si comprano allo stesso modo, una volta
  const ex = AVATAR.cappelli.find((h) => h.mercante)!;
  lot = { ...lot, resources: { ...lot.resources, perle: lot.resources.perle + ex.perle }, ledger: { ...lot.ledger, generated: { ...lot.ledger.generated, perle: lot.ledger.generated.perle + ex.perle } } };
  lot = buyHat(lot, ex.id, 3000);
  assert.ok(ownsHat(lot, ex.id) && lot.resources.perle === 3);
  assert.equal(checkInvariant([lot]), null);
});
