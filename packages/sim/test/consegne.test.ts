// Consegne in barca: moli dell'arcipelago vero, rotte in acqua libera, cassette in acqua, l'autopilota fa oro da ogni molo,
// il pilota pigro no, il replay del server coincide, gli input rotti non rompono niente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINIGAMES_CFG } from '@marea/content';
import { consegne, consegneMappa, consegneMoli, lazyConsegne, startFrame } from '../src/minigames/consegne/consegne.ts';
import type { ConsegneState, ConsegneView } from '../src/minigames/consegne/consegne.ts';
import { lunghezza, rotta, trattoLibero } from '../src/minigames/consegne/rotta.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import type { Difficulty } from '../src/minigames/types.ts';
import { isPackedInputs, packInputs, quantize, replay } from '../src/replay.ts';
import { createRng } from '../src/rng.ts';
import type { InputFrame } from '../src/types.ts';

const CFG = MINIGAMES_CFG.consegne;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const view = (s: ConsegneState) => consegne.view(s) as ConsegneView;

/** Partita intera dal molo `start` con `pick` (quantizzato come il client): stato e frame (il primo è startFrame). */
function play(seed: number, start: number, pick: (s: ConsegneState) => InputFrame, difficulty: Difficulty = 2) {
  const s = consegne.create({ seed, difficulty });
  const frames: InputFrame[] = [quantize(startFrame(start))];
  consegne.step(s, frames[0]!);
  while (!s.done && frames.length < consegne.maxTicks) { const f = quantize(pick(s)); frames.push(f); consegne.step(s, f); }
  return { s, frames };
}
const auto = (seed: number) => { const rng = createRng(seed).fork('autopilot'); return (s: ConsegneState) => consegne.autopilot(s, rng); };

test('consegne: nel registro, 150 s al massimo, 5 pacchi', () => {
  assert.equal(getMinigame('consegne'), consegne);
  assert.equal(consegne.maxTicks, CFG.maxSeconds * 60);
  assert.equal(CFG.pacchi, 5);
});

test('consegne: i moli sono le B di Porto, Laguna e lotti, in acqua; il primo frame li codifica esatti', () => {
  const moli = consegneMoli(), map = consegneMappa();
  assert.ok(moli.length >= 8, `${moli.length} moli`);
  assert.equal(moli[0]!.id, 'porto');
  assert.ok(moli.some((m) => m.id === 'laguna') && moli.some((m) => m.id === 'lotto:0'));
  assert.equal(new Set(moli.map((m) => m.id)).size, moli.length);
  for (const m of moli) {
    assert.equal(map.at(Math.floor(m.x / map.tile), Math.floor(m.z / map.tile)), 'B', `${m.id} non è su una B`);
    assert.deepEqual(quantize(startFrame(moli.indexOf(m))), startFrame(moli.indexOf(m)));
  }
});

test('consegne: il percorso dipende dal seed e dal molo di partenza; mai lo stesso molo di fila; distanze giuste', () => {
  const moli = consegneMoli();
  const route = (seed: number, start: number) => { const s = consegne.create({ seed, difficulty: 2 }); consegne.step(s, startFrame(start)); return s.route; };
  assert.deepEqual(route(7, 2), route(7, 2));
  assert.notDeepEqual(route(7, 2), route(8, 2));
  for (const seed of [1, 2, 3, 4, 5]) for (let start = 0; start < moli.length; start++) {
    const r = route(seed, start);
    assert.equal(r[0], start); assert.equal(r.length, CFG.pacchi + 1);
    for (let i = 1; i < r.length; i++) {
      assert.notEqual(r[i], r[i - 1], `seed ${seed}: due volte lo stesso molo`);
      const a = moli[r[i - 1]!]!, b = moli[r[i]!]!, d = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(d >= CFG.distanza[0] - 0.01 && d <= CFG.distanza[1] + 0.01, `${a.id} → ${b.id}: ${d.toFixed(0)} m`);
    }
  }
});

test('consegne: tra ogni coppia di moli c\'è una rotta tutta in acqua, con margine dalla costa', () => {
  const moli = consegneMoli(), map = consegneMappa();
  for (const a of moli) for (const b of moli) {
    if (a === b) continue;
    const p = rotta(map, a, b);
    assert.ok(p && p.length >= 2, `nessuna rotta ${a.id} → ${b.id}`);
    assert.deepEqual(p[0], { x: a.x, z: a.z }); assert.deepEqual(p[p.length - 1], { x: b.x, z: b.z });
    for (let i = 1; i < p.length; i++) assert.ok(trattoLibero(map, p[i - 1]!, p[i]!, 0.9), `${a.id} → ${b.id}: tratto ${i} tocca terra`);
    assert.ok(lunghezza(p) >= Math.hypot(a.x - b.x, a.z - b.z) - 0.01);
  }
});

test('consegne: le cassette galleggiano in acqua libera, vicino alla rotta del tratto', () => {
  const map = consegneMappa();
  for (const seed of [3, 9, 27]) {
    const t = consegne.create({ seed, difficulty: 2 }); consegne.step(t, startFrame(seed % consegneMoli().length));
    assert.equal(t.casse.length, CFG.cassette.perTratto);
    for (const c of t.casse) {
      assert.ok(trattoLibero(map, c, c, 1.2), `cassa ${c.x},${c.z} non in acqua libera`);
      const near = Math.min(...t.path.map((p) => Math.hypot(p.x - c.x, p.z - c.z)), ...t.path.slice(1).map((p, i) => {
        const a = t.path[i]!, dx = p.x - a.x, dz = p.z - a.z, l2 = dx * dx + dz * dz || 1;
        const k = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.z - a.z) * dz) / l2));
        return Math.hypot(a.x + dx * k - c.x, a.z + dz * k - c.z);
      }));
      assert.ok(near <= CFG.cassette.scarto[1] + 0.5, `cassa a ${near.toFixed(1)} m dalla rotta`);
    }
  }
});

test('consegne: l\'autopilota di riferimento fa oro da ogni molo, su tutte le difficoltà, in meno di 2 minuti', () => {
  const moli = consegneMoli();
  for (const d of [1, 2, 3] as const) for (const seed of [1, 42, 999]) for (const start of [0, 1, 2, moli.length - 1]) {
    const { s } = play(seed, start, auto(seed), d);
    const r = consegne.result(s);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d} dal molo ${moli[start]!.id}: ${JSON.stringify(r.detail)}`);
    assert.equal(r.detail['consegne'], CFG.pacchi); assert.equal(r.detail['partenza'], start);
    assert.ok(r.detail['ms']! < 120_000, `${r.detail['ms']} ms`);
  }
});

test('consegne: il pilota pigro (un terzo di gas) non prende l\'oro', () => {
  for (const seed of [2, 5, 11, 77]) {
    const { s } = play(seed, 0, (x) => lazyConsegne(x));
    assert.notEqual(consegne.result(s).medal, 'oro', `seed ${seed}`);
    assert.equal(s.timeUp, true);
  }
});

test('consegne: il replay del server dà lo stesso esito, anche a metà (2 pacchi poi fermo → bronzo)', () => {
  for (const seed of [17, 4242]) {
    const { s, frames } = play(seed, 3, auto(seed));
    assert.deepEqual(replay('consegne', seed, 2, packInputs(frames)), consegne.result(s));
    const pilot = auto(seed);
    const half = play(seed, 3, (x) => (x.consegnate < 2 ? pilot(x) : NO));
    const r = replay('consegne', seed, 2, packInputs(half.frames));
    assert.deepEqual(r, consegne.result(half.s));
    assert.equal(r.medal, 'bronzo'); assert.equal(r.detail['consegne'], 2);
    assert.ok(isPackedInputs(packInputs(half.frames), consegne.maxTicks));
  }
});

test('consegne: senza muoversi il tempo finisce e niente medaglia; la cassetta presa dà secondi in più', () => {
  const { s } = play(5, 0, () => NO);
  assert.equal(s.done && s.timeUp, true);
  assert.equal(consegne.result(s).medal, null); assert.equal(view(s).leftMs, 0);
  const t = consegne.create({ seed: 5, difficulty: 2 }); consegne.step(t, startFrame(0));
  const left = t.left, c = t.casse[0]!;
  t.boat = { ...t.boat, x: c.x, z: c.z, speed: 0 };
  consegne.step(t, NO);
  assert.equal(c.presa, true); assert.equal(t.prese, 1);
  assert.equal(t.left, left - 1 + CFG.cassette.secondi * 60);
});

test('consegne: input rotti — molo fuori scala = Porto, frame a caso non rompono niente', () => {
  const s = consegne.create({ seed: 1, difficulty: 2 });
  consegne.step(s, quantize({ mx: 1, my: 0, a: true, b: true }));
  assert.equal(s.start, 0);
  const t = consegne.create({ seed: 1, difficulty: 2 }); consegne.step(t, quantize({ mx: -1, my: 1, a: false, b: false }));
  assert.equal(t.start, 0);
  for (const seed of [3, 4]) {
    const rng = createRng(seed);
    const frames: InputFrame[] = [];
    for (let i = 0; i < consegne.maxTicks; i++) frames.push(quantize({ mx: rng.next() * 2 - 1, my: rng.next() * 2 - 1, a: rng.next() < 0.5, b: rng.next() < 0.2 }));
    const r = replay('consegne', seed, 2, packInputs(frames));
    assert.equal(r.done, true);
    assert.ok(r.detail['consegne']! >= 0 && r.detail['consegne']! <= CFG.pacchi);
  }
  assert.throws(() => replay('consegne', 1, 2, [[consegne.maxTicks + 1, 0, 0, 0, 0]]));
});
