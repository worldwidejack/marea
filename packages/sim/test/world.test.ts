import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLANDS, validateContent } from '@marea/content';
import { parseIsland } from '../src/world/grid.ts';
import { newAvatar, stepAvatar } from '../src/world/avatar.ts';
import { newBoat, stepBoat } from '../src/world/boat.ts';
import { hashJson } from '../src/hash.ts';

const def = ISLANDS[0]!;
test('contenuti validi', () => assert.deepEqual(validateContent(), []));
test('mappa: spawn a terra, barca in acqua', () => {
  const m = parseIsland(def);
  assert.ok(m.walkable(m.spawn.x, m.spawn.z));
  assert.ok(m.navigable(m.boatSpawn.x, m.boatSpawn.z));
  assert.ok(m.lots.length >= 5);
});
test('avatar: cammina, non entra in acqua, deterministico', () => {
  const m = parseIsland(def);
  let a = newAvatar(m.spawn.x, m.spawn.z);
  const a0 = a;
  for (let i = 0; i < 60 * 30; i++) a = stepAvatar(a, { mx: 0, my: 1, a: false, b: true }, m); // verso il mare a sud
  assert.ok(m.walkable(a.x, a.z), 'l’avatar è finito su una cella non camminabile');
  assert.ok(a.z > a0.z + 1, 'non si è mosso');
  let b = a0;
  for (let i = 0; i < 60 * 30; i++) b = stepAvatar(b, { mx: 0, my: 1, a: false, b: true }, m);
  assert.equal(hashJson(a), hashJson(b));
});
test('barca: accelera e resta in acqua', () => {
  const m = parseIsland(def);
  let b = newBoat(m.boatSpawn.x, m.boatSpawn.z);
  for (let i = 0; i < 60 * 20; i++) b = stepBoat(b, { mx: 1, my: 0.2, a: true, b: false }, m);
  assert.ok(b.speed > 0);
  assert.ok(m.navigable(b.x, b.z));
});
