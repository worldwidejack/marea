import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { finishSolo, soloLeft, soloOf, soloPrize, startSolo } from '../src/economy/rewards.ts';
import { EconomyError, add } from '../src/economy/types.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import { packInputs, quantize, replay } from '../src/replay.ts';
import { createRng } from '../src/rng.ts';

const DAY = 86_400_000, T0 = 20_000 * DAY + 3_600_000; // un'ora dopo la mezzanotte UTC di un giorno qualsiasi

test('solo: premio per medaglia da balance.json, consolazione senza medaglia', () => {
  assert.deepEqual(soloPrize('oro'), BALANCE.solo.premi.oro);
  assert.deepEqual(soloPrize(null), BALANCE.solo.premi.nessuna);
  assert.ok(soloPrize('oro').legno > soloPrize('argento').legno && soloPrize('argento').legno > soloPrize('bronzo').legno);
});

test('solo: start apre la partita col seed del server, finish paga e la chiude; libro mastro in pari', () => {
  const l0 = newLot('ada', T0);
  const l1 = startSolo(l0, 'regata', 1234, T0);
  assert.deepEqual(soloOf(l1, T0).pending, { minigame: 'regata', seed: 1234, difficulty: 2, startMs: T0 });
  const out = finishSolo(l1, 'oro', T0 + 30_000);
  assert.ok(out.premiata);
  assert.deepEqual(out.lot.resources, add(l0.resources, BALANCE.solo.premi.oro));
  assert.equal(out.lot.solo?.pending, null);
  assert.equal(out.lot.solo?.giocate, 1);
  assert.equal(checkInvariant([out.lot]), null);
  assert.throws(() => finishSolo(out.lot, 'oro', T0 + 60_000), (e) => e instanceof EconomyError && e.code === 'partita');
});

test('solo: oltre il tetto del giorno si gioca senza premio; il giorno dopo si riparte', () => {
  let l = newLot('bea', T0);
  for (let i = 0; i < BALANCE.solo.premiateAlGiorno; i++) l = finishSolo(startSolo(l, 'regata', i, T0), 'bronzo', T0).lot;
  assert.equal(soloLeft(l, T0), 0);
  const extra = finishSolo(startSolo(l, 'regata', 99, T0), 'oro', T0);
  assert.equal(extra.premiata, false);
  assert.deepEqual(extra.lot.resources, l.resources);
  assert.equal(soloLeft(extra.lot, T0 + DAY), BALANCE.solo.premiateAlGiorno);
  const next = finishSolo(startSolo(extra.lot, 'regata', 7, T0 + DAY), 'argento', T0 + DAY);
  assert.ok(next.premiata);
  assert.equal(checkInvariant([next.lot]), null);
});

test('solo: la medaglia la decide il replay degli input (autopilot di riferimento → medaglia)', () => {
  const m = getMinigame('regata'), seed = 42;
  const s = m.create({ seed, difficulty: 2 }), rng = createRng(seed).fork('autopilot'), frames = [];
  for (let i = 0; i < m.maxTicks; i++) { const f = quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); if (m.result(s).done) break; }
  const r = replay('regata', seed, 2, packInputs(frames));
  assert.ok(r.medal !== null, 'l\'autopilot deve prendere una medaglia');
  const out = finishSolo(startSolo(newLot('cia', T0), 'regata', seed, T0), r.medal, T0);
  assert.deepEqual(out.premio, soloPrize(r.medal));
});
