// Il lotto nuovo (monete di partenza, baule di serie) e i cappelli comprati una volta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR, BALANCE } from '@marea/content';
import { buyHat, newLot, ownsHat } from '../src/economy/actions.ts';
import { checkMonete } from '../src/economy/monete.ts';
import { conMonete, senzaMonete } from './monete_util.ts';
import type { EconomyError } from '../src/economy/types.ts';
import { isErr } from './economia_util.ts';

test('lotto nuovo: monete di partenza nel libro mastro, il baule di serie in casa, niente giardino', () => {
  const lot = newLot('a', 0);
  assert.equal(lot.monete, BALANCE.monete.partenza);
  assert.equal(lot.casa?.baule?.livello, 1);
  assert.ok(!('buildings' in lot) && !('resources' in lot));
  assert.equal(checkMonete([lot]), null);
});

test('cappelli: i gratuiti sono di tutti, quelli a pagamento si comprano una volta (monete)', () => {
  const free = AVATAR.cappelli.find((h) => h.monete === 0)!;
  const paid = AVATAR.cappelli.find((h) => h.monete > 0)!;
  let lot = senzaMonete(newLot('a', 0));
  assert.ok(ownsHat(lot, free.id));
  assert.ok(!ownsHat(lot, paid.id));
  assert.throws(() => buyHat(lot, paid.id, 0), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.monete === paid.monete);
  assert.throws(() => buyHat(lot, free.id, 0), isErr('cappello'));
  assert.throws(() => buyHat(lot, 'tiara_inesistente', 0), isErr('sconosciuto'));
  lot = conMonete(lot, paid.monete + 3);
  lot = buyHat(lot, paid.id, 1000);
  assert.equal(lot.monete, 3);
  assert.ok(ownsHat(lot, paid.id));
  assert.throws(() => buyHat(lot, paid.id, 2000), isErr('unico'));
  // gli esclusivi del Mercante si comprano allo stesso modo, una volta
  const ex = AVATAR.cappelli.find((h) => h.mercante)!;
  lot = conMonete(lot, ex.monete);
  lot = buyHat(lot, ex.id, 3000);
  assert.ok(ownsHat(lot, ex.id) && lot.monete === 3);
  assert.equal(checkMonete([lot]), null);
});
