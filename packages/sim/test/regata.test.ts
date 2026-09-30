// Regata v3 sulla laguna: percorso fisso da content (boe in acqua libera, giro chiuso), taratura delle medaglie sul pilota
// di riferimento, determinismo del replay e fixture d'oro (seed + input → punteggio e hash della barca).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { lazyAutopilot, regata, regataMap, segmentClear } from '../src/minigames/regata/regata.ts';
import type { RegataState, RegataView } from '../src/minigames/regata/regata.ts';
import type { Difficulty, MinigameResult } from '../src/minigames/types.ts';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import { packInputs, replay, quantize } from '../src/replay.ts';
import type { PackedInputs } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

function race(seed: number, difficulty: Difficulty, pilot: 'buono' | 'pigro'): { s: RegataState; log: InputFrame[]; r: MinigameResult } {
  const s = regata.create({ seed, difficulty });
  const rng = createRng(seed);
  const log: InputFrame[] = [];
  while (!s.done) {
    const f = quantize(pilot === 'pigro' ? lazyAutopilot(s) : regata.autopilot(s, rng));
    log.push(f);
    regata.step(s, f);
  }
  return { s, log, r: regata.result(s) };
}

test('regata v3: si gioca sulla laguna, con la partenza sul B del molo', () => {
  assert.equal(regata.version, 3);
  const map = regataMap();
  assert.equal(map.id, 'laguna');
  assert.equal(ISLANDS[0]!.id, 'prova', 'prova resta la prima isola');
  const s = regata.create({ seed: 1, difficulty: 2 });
  assert.deepEqual({ x: s.boat.x, z: s.boat.z }, map.boatSpawn);
  assert.equal(map.at(Math.floor(s.boat.x / map.tile), Math.floor(s.boat.z / map.tile)), 'B');
});

test('regata: percorso di 3-5 boe in acqua libera, tratti dritti tutti in acqua, giro chiuso vicino alla partenza', () => {
  const map = regataMap();
  const s = regata.create({ seed: 1, difficulty: 2 });
  assert.ok(s.buoys.length >= 3 && s.buoys.length <= 5, `${s.buoys.length} boe`);
  const course = (MINIGAMES_CFG.regata as unknown as { course: { buoys: [number, number][] } }).course.buoys;
  assert.deepEqual(s.buoys.map((b) => [b.x, b.z]), course, 'le boe vengono da content');
  const W = map.w * map.tile, H = map.h * map.tile;
  for (const b of s.buoys) {
    assert.ok(b.x > 0 && b.z > 0 && b.x < W && b.z < H, `boa fuori dall'isola: ${b.x},${b.z}`);
    // acqua libera: nessuna cella di terra, molo o roccia entro 5 m (raggio della boa 3 m + la barca)
    for (let cz = 0; cz < map.h; cz++)
      for (let cx = 0; cx < map.w; cx++) {
        if (map.navigable((cx + 0.5) * map.tile, (cz + 0.5) * map.tile)) continue;
        const nx = Math.max(cx * map.tile, Math.min((cx + 1) * map.tile, b.x)), nz = Math.max(cz * map.tile, Math.min((cz + 1) * map.tile, b.z));
        assert.ok(Math.hypot(nx - b.x, nz - b.z) >= 5, `boa ${b.x},${b.z} a meno di 5 m da '${map.at(cx, cz)}' (${cx},${cz})`);
      }
  }
  let from = map.boatSpawn;
  for (const b of s.buoys) {
    assert.ok(segmentClear(map, from, b), `tratto ${from.x},${from.z} → ${b.x},${b.z} non tutto in acqua`);
    assert.ok(Math.hypot(b.x - from.x, b.z - from.z) >= 15, 'tratto troppo corto');
    from = b;
  }
  const last = s.buoys[s.buoys.length - 1]!;
  assert.ok(Math.hypot(last.x - map.boatSpawn.x, last.z - map.boatSpawn.z) <= 16, 'l’arrivo non è vicino alla partenza');
  // giro chiuso: il poligono partenza → boe gira sempre dallo stesso lato (niente incroci né tornanti)
  const pts = [map.boatSpawn, ...s.buoys];
  const sign: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!, c = pts[(i + 2) % pts.length]!;
    sign.push(Math.sign((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)));
  }
  assert.ok(sign.every((v) => v === sign[0]), `il giro non è convesso: ${sign}`);
});

test('regata: medaglie tarate — il pilota di riferimento fa oro, il pigro bronzo o niente, soglie crescenti', () => {
  const pigro: Record<string, number> = {};
  for (const d of [1, 2, 3] as const)
    for (let seed = 0; seed < 12; seed++) {
      const buono = race(seed, d, 'buono');
      assert.equal(buono.r.medal, 'oro', `seed ${seed} diff ${d}: ${JSON.stringify(buono.r.detail)}`);
      const lazy = race(seed, d, 'pigro');
      assert.ok(lazy.r.done && lazy.r.detail['boe'] === lazy.r.detail['tot'], 'il pigro deve comunque finire');
      assert.ok(lazy.r.medal === 'bronzo' || lazy.r.medal === null, `pigro ${lazy.r.medal}`);
      assert.ok(buono.r.score > lazy.r.score);
      pigro[String(lazy.r.medal)] = (pigro[String(lazy.r.medal)] ?? 0) + 1;
      const m = regata.view(buono.s) as RegataView;
      assert.ok(m.medals.oro < m.medals.argento && m.medals.argento < m.medals.bronzo && m.medals.bronzo <= m.maxMs);
      // un giro della laguna dura una ventina di secondi al pilota di riferimento
      assert.ok(buono.r.detail['parMs']! > 15_000 && buono.r.detail['parMs']! < 30_000, `par ${buono.r.detail['parMs']}`);
    }
  assert.ok((pigro['null'] ?? 0) > 0, 'il pigro prende sempre una medaglia: soglie troppo larghe');
});

test('regata: l’autopilot finisce e il replay dà lo stesso punteggio', () => {
  const { log, r } = race(123, 1, 'buono');
  assert.ok(r.done);
  assert.ok(r.detail['boe'] === r.detail['tot'], `boe ${r.detail['boe']}/${r.detail['tot']}`);
  const again = replay('regata', 123, 1, packInputs(log));
  assert.equal(again.score, r.score);
  assert.ok(log.length > 60);
});

test('regata: view() espone boe locali, prossima boa, tempo, vento e medaglie', () => {
  const s = regata.create({ seed: 5, difficulty: 2 });
  const v0 = regata.view(s) as RegataView;
  assert.equal(v0.island, 'laguna');
  assert.deepEqual(v0.start, regataMap().boatSpawn);
  assert.equal(v0.next, 0);
  assert.equal(v0.ms, 0);
  assert.equal(v0.buoys.length, s.buoys.length);
  assert.ok(v0.buoys.every((b) => typeof b.x === 'number' && typeof b.z === 'number' && b.passed === false));
  assert.ok(typeof v0.wind.x === 'number' && typeof v0.wind.z === 'number');
  assert.ok(v0.medals.oro > 0 && v0.radius > 0 && v0.maxMs === (regata.maxTicks * 1000) / 60);
  const rng = createRng(5);
  while (!s.done && s.next < 1) regata.step(s, quantize(regata.autopilot(s, rng)));
  const v1 = regata.view(s) as RegataView;
  assert.equal(v1.next, 1);
  assert.equal(v1.buoys[0]!.passed, true);
  assert.ok(v1.ms > 0 && !v1.done);
});

test('regata: fixture d’oro v3 (seed + input → punteggio, medaglia e hash della barca)', () => {
  type Case = { seed: number; difficulty: Difficulty; pilot: string; inputs: PackedInputs; result: MinigameResult; boatHash: number };
  const fx = JSON.parse(readFileSync(new URL('./fixtures/regata_v3.json', import.meta.url), 'utf8')) as { version: number; cases: Case[] };
  assert.equal(fx.version, regata.version, 'fixture di un’altra versione della regata');
  for (const c of fx.cases) {
    assert.deepEqual(replay('regata', c.seed, c.difficulty, c.inputs), c.result, `seed ${c.seed}`);
    const s = regata.create({ seed: c.seed, difficulty: c.difficulty });
    for (const [n, mx, my, a, b] of c.inputs) for (let i = 0; i < n; i++) regata.step(s, { mx: mx / 32, my: my / 32, a: a === 1, b: b === 1 });
    assert.equal(hashJson(s.boat), c.boatHash, `hash barca seed ${c.seed}`);
    // e il pilota di oggi rifà gli stessi input
    const again = race(c.seed, c.difficulty, c.pilot === 'pigro' ? 'pigro' : 'buono');
    assert.equal(JSON.stringify(packInputs(again.log)), JSON.stringify(c.inputs), `input del pilota cambiati, seed ${c.seed}`); // via JSON: −0 = 0
  }
});
