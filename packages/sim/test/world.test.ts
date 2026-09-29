import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ISLANDS, validateContent } from '@marea/content';
import type { IslandDef } from '@marea/content';
import { parseIsland } from '../src/world/grid.ts';
import type { GridMap } from '../src/world/grid.ts';
import { newAvatar, stepAvatar } from '../src/world/avatar.ts';
import type { AvatarState } from '../src/world/avatar.ts';
import { boatParams, canBoard, landingSpot, newBoat, stepBoat } from '../src/world/boat.ts';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import type { InputFrame } from '../src/types.ts';

const def = ISLANDS[0]!;
// mappa sintetica: celle da 2 m; roccia 2×2 in mezzo; molo in basso a destra
const TEST_MAP: IslandDef = {
  id: 'test', nome: 'test', tile: 2,
  rows: [
    '~~~~~~~~~~~~',
    '~gggggggggg~',
    '~gggggggggg~',
    '~ggggrrgggg~',
    '~ggggrrgggg~',
    '~gggggggggg~',
    '~gPggggggdd~',
    '~~~~~~~~~B~~',
    '~~~~~~~~~~~~',
  ],
};
const R = BALANCE.avatar.raggio;
const run = (a: AvatarState, f: InputFrame, n: number, m: GridMap): AvatarState => { for (let i = 0; i < n; i++) a = stepAvatar(a, f, m); return a; };
/** Il cerchio dell'avatar sta tutto su celle camminabili (8 punti sul bordo). */
function circleClear(m: GridMap, a: AvatarState, r = R * 0.98): boolean {
  for (let k = 0; k < 8; k++) if (!m.walkable(a.x + Math.cos((k * Math.PI) / 4) * r, a.z + Math.sin((k * Math.PI) / 4) * r)) return false;
  return m.walkable(a.x, a.z);
}

test('contenuti validi', () => assert.deepEqual(validateContent(), []));
test('mappa: spawn a terra, barca in acqua', () => {
  const m = parseIsland(def);
  assert.ok(m.walkable(m.spawn.x, m.spawn.z));
  assert.ok(m.navigable(m.boatSpawn.x, m.boatSpawn.z));
  assert.ok(m.lots.length >= 5);
});
test('avatar: cammina, non entra in acqua, deterministico', () => {
  const m = parseIsland(def);
  const a0 = newAvatar(m.spawn.x, m.spawn.z);
  const a = run(a0, { mx: 0, my: 1, a: false, b: true }, 60 * 30, m);
  assert.ok(circleClear(m, a), 'l’avatar è finito su una cella non camminabile');
  assert.ok(a.z > a0.z + 1, 'non si è mosso');
  assert.equal(hashJson(a), hashJson(run(a0, { mx: 0, my: 1, a: false, b: true }, 60 * 30, m)));
});
test('avatar: in diagonale contro un muro scivola lungo il bordo', () => {
  const m = parseIsland(TEST_MAP);
  const a0 = newAvatar(4, 2.6); // riga 1, vicino all'acqua in alto
  const a = run(a0, { mx: 0.5, my: -0.5, a: false, b: false }, 60, m);
  assert.ok(a.x > a0.x + 1.2, `non scivola: x ${a.x}`);
  assert.ok(Math.abs(a.z - (2 + R)) < 0.05, `resta attaccato al bordo: z ${a.z}`);
  assert.equal(a.anim, 'walk');
});
test('avatar: aggira lo spigolo della roccia invece di incastrarsi', () => {
  const m = parseIsland(TEST_MAP);
  // la roccia occupa x 10..14, z 6..10: parto a sinistra, col centro appena sopra il suo bordo alto (il cerchio lo tocca), e vado a destra
  const a0 = newAvatar(8, 5.8);
  const a = run(a0, { mx: 1, my: 0, a: false, b: false }, 150, m);
  assert.ok(a.x > 14.5, `incastrato allo spigolo: x ${a.x.toFixed(2)} z ${a.z.toFixed(2)}`);
  assert.ok(circleClear(m, a));
  // di fronte pieno si ferma (idle), senza tremare
  const b = run(newAvatar(8, 8), { mx: 1, my: 0, a: false, b: false }, 120, m);
  assert.ok(Math.abs(b.x - (10 - R)) < 0.02 && b.anim === 'idle', `x ${b.x} ${b.anim}`);
});
test('avatar: 10.000 tick casuali: mai dentro celle bloccate, stesso seed → stesso hash', () => {
  const m = parseIsland(def);
  const go = (seed: number) => {
    const rng = createRng(seed);
    let a = newAvatar(m.spawn.x, m.spawn.z);
    let f: InputFrame = { mx: 0, my: 0, a: false, b: false };
    for (let i = 0; i < 10_000; i++) {
      if (i % 30 === 0) f = { mx: rng.next() * 2 - 1, my: rng.next() * 2 - 1, a: false, b: rng.next() < 0.3 };
      a = stepAvatar(a, f, m);
      if (!circleClear(m, a)) throw new Error(`tick ${i}: avatar dentro una cella bloccata a ${a.x}, ${a.z}`);
    }
    return hashJson(a);
  };
  assert.equal(go(5), go(5));
  assert.notEqual(go(5), go(6));
});
test('barca: accelera, resta in acqua, 10.000 tick casuali deterministici', () => {
  const m = parseIsland(def);
  const go = (seed: number) => {
    const rng = createRng(seed);
    let b = newBoat(m.boatSpawn.x, m.boatSpawn.z);
    let f: InputFrame = { mx: 0, my: 0, a: false, b: false };
    const wind = { x: 1.2, z: -0.6 };
    for (let i = 0; i < 10_000; i++) {
      if (i % 45 === 0) f = { mx: rng.next() * 2 - 1, my: rng.next() * 2 - 1, a: rng.next() < 0.6, b: rng.next() < 0.1 };
      b = stepBoat(b, f, m, wind);
      if (!m.navigable(b.x, b.z)) throw new Error(`tick ${i}: barca a terra a ${b.x}, ${b.z}`);
      assert.ok(b.speed >= 0 && b.speed <= BALANCE.barca.maxSpeed + 1e-9);
    }
    return hashJson(b);
  };
  assert.equal(go(9), go(9));
  let b = newBoat(m.boatSpawn.x, m.boatSpawn.z);
  for (let i = 0; i < 60 * 20; i++) b = stepBoat(b, { mx: 1, my: 0.2, a: true, b: false }, m);
  assert.ok(b.speed > 0);
  assert.ok(m.navigable(b.x, b.z));
});
test('barca: il vento sposta di lato senza girare la prua', () => {
  const m = parseIsland({ ...TEST_MAP, rows: TEST_MAP.rows.map((r, i) => (i < 7 ? '~'.repeat(12) : r)).map((r, i) => (i === 0 ? '~P~~~~~~~~~~' : i === 1 ? '~d~~~~~~~~~~' : r)) });
  let b = newBoat(12, 8);
  for (let i = 0; i < 120; i++) b = stepBoat(b, { mx: 0, my: -1, a: true, b: false }, m, { x: 1.5, z: 0 });
  assert.ok(Math.abs(b.yaw) < 1e-9, 'la prua resta a nord');
  assert.ok(b.x > 12 + 2.9 && b.x < 12 + 3.1, `deriva ${b.x - 12}`);
});
test('barca: urto frontale frena molto e non attraversa la costa', () => {
  const m = parseIsland(def);
  const hitWall = (mx: number, my: number): number => {
    let b = { ...newBoat(m.boatSpawn.x, m.boatSpawn.z), yaw: Math.atan2(mx, -my), speed: 9 };
    let minSpeed = 9;
    for (let i = 0; i < 90; i++) { b = stepBoat(b, { mx, my, a: true, b: false }, m); minSpeed = Math.min(minSpeed, b.speed); assert.ok(m.navigable(b.x, b.z)); }
    return minSpeed;
  };
  const head = hitWall(0, -1); // dritto verso il molo/la spiaggia a nord
  assert.ok(head < 9 * 0.6, `frontale: velocità minima ${head}`);
  assert.ok(boatParams().raggio > 0);
});
test('imbarco e sbarco: dal molo si sale, vicino al molo si scende su una cella camminabile', () => {
  const m = parseIsland(def);
  const boat = newBoat(m.boatSpawn.x, m.boatSpawn.z);
  const spot = landingSpot(boat, m);
  assert.ok(spot, 'nessun punto di sbarco accanto allo spawn della barca');
  assert.ok(m.isDock(spot.x, spot.z) && m.walkable(spot.x, spot.z));
  assert.ok(canBoard(newAvatar(spot.x, spot.z), boat, m));
  assert.equal(canBoard(newAvatar(m.spawn.x - 8, m.spawn.z - 8), boat, m), false, 'lontano non si sale');
  assert.equal(landingSpot(newBoat(2, 2), m), null, 'in mare aperto non si scende');
  // sulla sabbia appena accanto al molo si sale lo stesso
  const sand = { ...newAvatar(spot.x, spot.z - 2.2) };
  if (m.walkable(sand.x, sand.z) && Math.hypot(sand.x - boat.x, sand.z - boat.z) <= BALANCE.barca.raggioImbarco) assert.ok(canBoard(sand, boat, m));
});
