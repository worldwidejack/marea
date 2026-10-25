// Il lotto nuovo (monete di partenza, baule di serie) e i cappelli comprati una volta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR, BALANCE } from '@marea/content';
import { buyHat, newLot, ownsHat } from '../src/economy/actions.ts';
import { vetrinaMercante } from '../src/economy/mercante.ts';
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

test('cappelli: i gratuiti sono di tutti, quelli a pagamento si comprano una volta (monete), dal Mercante il giorno che li ha', () => {
  const free = AVATAR.cappelli.find((h) => h.monete === 0)!;
  const oggi = vetrinaMercante(1000).cappelli;
  const paid = AVATAR.cappelli.find((h) => h.id === oggi[0])!, altro = AVATAR.cappelli.find((h) => h.id === oggi[1])!;
  const assente = AVATAR.cappelli.find((h) => h.monete > 0 && !oggi.includes(h.id))!;
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
  lot = conMonete(lot, altro.monete + assente.monete);
  assert.throws(() => buyHat(lot, assente.id, 3000), isErr('requisito'), 'oggi il Mercante non ce l’ha');
  lot = buyHat(lot, altro.id, 3000);
  assert.ok(ownsHat(lot, altro.id) && lot.monete === 3 + assente.monete);
  assert.equal(checkMonete([lot]), null);
});
