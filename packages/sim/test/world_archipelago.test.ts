import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, BALANCE, ISLANDS, island, validateContent } from '@marea/content';
import { composeArchipelago } from '../src/world/archipelago.ts';
import type { Archipelago } from '../src/world/archipelago.ts';
import { parseIsland } from '../src/world/grid.ts';
import type { GridMap } from '../src/world/grid.ts';
import { canBoard, landingSpot, newBoat, stepBoat } from '../src/world/boat.ts';
import { newAvatar, stepAvatar } from '../src/world/avatar.ts';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import type { InputFrame } from '../src/types.ts';

const arch: Archipelago = composeArchipelago(ARCHIPELAGO, ISLANDS);
const M = arch.map;
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** BFS a 4 vicini sulle celle che `ok` accetta; distanza in celle da `from` (−1 = irraggiungibile). */
function bfs(m: GridMap, from: { cx: number; cz: number }, ok: (cx: number, cz: number) => boolean): Int32Array {
  const dist = new Int32Array(m.w * m.h).fill(-1);
  const q = new Int32Array(m.w * m.h);
  let head = 0, tail = 0;
  dist[from.cz * m.w + from.cx] = 0; q[tail++] = from.cz * m.w + from.cx;
  while (head < tail) {
    const i = q[head++]!, cx = i % m.w, cz = (i / m.w) | 0;
    for (const [dx, dz] of N4) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= m.w || z >= m.h) continue;
      const j = z * m.w + x;
      if (dist[j]! >= 0 || !ok(x, z)) continue;
      dist[j] = dist[i]! + 1; q[tail++] = j;
    }
  }
  return dist;
}
const cellOf = (p: { x: number; z: number }) => M.worldToCell(p.x, p.z);
const NAV = new Set(['~', ',', 'B']);
const WALK = new Set(['.', 'g', 'd', 'P', 'L']);

test('arcipelago: contenuti validi e composizione deterministica', () => {
  assert.deepEqual(validateContent(), []);
  assert.equal(M.w, ARCHIPELAGO.w); assert.equal(M.h, ARCHIPELAGO.h); assert.equal(M.tile, 2);
  assert.equal(hashJson(composeArchipelago(ARCHIPELAGO, ISLANDS).map.rows), hashJson(M.rows));
  assert.equal(ISLANDS[0]!.id, 'prova', 'prova resta la prima isola (regata e test)');
});

test('arcipelago: 8 lotti (slot 0-7), un Porto, una laguna, due facciate', () => {
  assert.deepEqual(arch.lots.map((l) => l.slot), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(arch.lots.every((l) => l.template === 'lotto'));
  assert.equal(arch.places.filter((p) => p.role === 'porto').length, 1);
  assert.ok(arch.laguna);
  assert.equal(arch.places.filter((p) => p.role === 'facciata').length, 2);
  assert.ok(arch.buildings.some((b) => b.kind === 'tavolo'), 'manca lo slot del Tavolo delle Sfide nel Porto');
  assert.ok(arch.buildings.filter((b) => b.kind.startsWith('casa')).length >= 6, 'servono 6-8 case nel Porto');
});

test('arcipelago: ogni isola è copiata identica nella mappa, senza sovrapposizioni', () => {
  const owner = new Int16Array(M.w * M.h).fill(-1);
  for (const p of arch.places) {
    const def = island(p.island);
    for (let z = 0; z < p.h; z++) for (let x = 0; x < p.w; x++) {
      const ch = def.rows[z]![x]!;
      if (ch === '~') continue;
      const i = (p.origin[1] + z) * M.w + p.origin[0] + x;
      assert.equal(owner[i], -1, `${p.island} si sovrappone in ${p.origin[0] + x},${p.origin[1] + z}`);
      owner[i] = p.index;
      assert.equal(M.at(p.origin[0] + x, p.origin[1] + z), ch);
    }
    // tra due isole resta almeno una fascia di mare: il bordo dell'isola non tocca terra altrui
  }
  for (let i = 0; i < arch.places.length; i++) for (let j = i + 1; j < arch.places.length; j++) {
    const a = arch.places[i]!, b = arch.places[j]!;
    const gapX = Math.max(b.origin[0] - (a.origin[0] + a.w), a.origin[0] - (b.origin[0] + b.w));
    const gapZ = Math.max(b.origin[1] - (a.origin[1] + a.h), a.origin[1] - (b.origin[1] + b.h));
    assert.ok(Math.max(gapX, gapZ) >= 4, `${a.island} e ${b.island} troppo vicine (${Math.max(gapX, gapZ)} celle)`);
  }
});

test('arcipelago: spawn a terra, barche in acqua, dal molo si sale e si scende', () => {
  for (const slot of [null, 0, 1, 2, 3, 4, 5, 6, 7]) {
    const s = arch.spawnOf(slot), b = arch.boatOf(slot);
    assert.ok(M.walkable(s.x, s.z), `spawn ${slot} non camminabile`);
    assert.ok(M.navigable(b.x, b.z), `barca ${slot} non in acqua`);
    const spot = landingSpot(newBoat(b.x, b.z), M);
    assert.ok(spot && M.isDock(spot.x, spot.z), `lotto ${slot}: nessun molo accanto alla barca`);
    assert.ok(canBoard(newAvatar(spot.x, spot.z), newBoat(b.x, b.z), M), `lotto ${slot}: dal molo non si sale`);
    // dallo spawn si arriva a piedi al molo
    const d = bfs(M, cellOf(s), (x, z) => WALK.has(M.at(x, z)));
    const c = cellOf(spot);
    assert.ok(d[c.cz * M.w + c.cx]! >= 0, `lotto ${slot}: dallo spawn non si arriva al molo`);
  }
  for (const p of arch.places) assert.ok(M.walkable(p.spawn.x, p.spawn.z) && M.navigable(p.boat.x, p.boat.z), p.island);
  assert.deepEqual(arch.spawnOf(null), { x: M.spawn.x, z: M.spawn.z });
  assert.deepEqual(arch.spawnOf(42), arch.spawnOf(null), 'slot inesistente → Porto');
});

test('arcipelago: ogni lotto, la laguna e le facciate si raggiungono in barca dal Porto (al massimo ~40 s per i lotti: casa, Porto e Regata vicini)', () => {
  const from = cellOf(arch.boatOf(null));
  const d = bfs(M, from, (x, z) => NAV.has(M.at(x, z)));
  const vmax = BALANCE.barca.maxSpeed;
  const times: string[] = [];
  for (const p of arch.places) {
    if (p.role === 'porto') continue;
    const c = cellOf(p.boat), cells = d[c.cz * M.w + c.cx]!;
    assert.ok(cells >= 0, `${p.island}${p.slot !== null ? ' ' + p.slot : ''}: irraggiungibile in barca dal Porto`);
    // percorso a 4 vicini: la barca taglia in diagonale, stima ~0,8 della lunghezza Manhattan-locale
    const s = (cells * M.tile * 0.8) / vmax;
    if (p.role === 'lotto') {
      times.push(`${p.slot}:${Math.round(s)}s`);
      assert.ok(s <= 40, `lotto ${p.slot}: ${Math.round(s)} s di barca dal Porto (attesi al massimo 40 s)`);
    }
  }
  console.log('[marea] barca Porto → lotti (stima a 9 m/s):', times.join(' '));
});

test('arcipelago: ogni cella L del template è una L nel mondo (lotCellToWorld)', () => {
  const tpl = parseIsland(island('lotto'));
  assert.ok(tpl.lots.length >= 7, `il template ha ${tpl.lots.length} slot`);
  for (const l of arch.lots) for (const c of tpl.lots) {
    const w = arch.lotCellToWorld(l.slot, [c.cx, c.cz]);
    assert.equal(M.at(M.worldToCell(w.x, w.z).cx, M.worldToCell(w.x, w.z).cz), 'L');
    assert.equal(arch.placeAt(w.x, w.z)?.slot, l.slot);
  }
  assert.equal(arch.placeAt(1, 1), null, 'in mare aperto nessuna isola');
});

test('arcipelago: avatar e barca restano validi nella mappa grande (sim deterministica)', () => {
  const go = (seed: number) => {
    const rng = createRng(seed);
    let a = newAvatar(arch.spawnOf(3).x, arch.spawnOf(3).z);
    let b = newBoat(arch.boatOf(null).x, arch.boatOf(null).z);
    let f: InputFrame = { mx: 0, my: 0, a: false, b: false };
    for (let i = 0; i < 6000; i++) {
      if (i % 40 === 0) f = { mx: rng.next() * 2 - 1, my: rng.next() * 2 - 1, a: rng.next() < 0.6, b: false };
      a = stepAvatar(a, f, M); b = stepBoat(b, f, M);
      if (!M.walkable(a.x, a.z)) throw new Error(`tick ${i}: avatar fuori terra a ${a.x}, ${a.z}`);
      if (!M.navigable(b.x, b.z)) throw new Error(`tick ${i}: barca a terra a ${b.x}, ${b.z}`);
    }
    return hashJson([a, b]);
  };
  assert.equal(go(4), go(4));
});
