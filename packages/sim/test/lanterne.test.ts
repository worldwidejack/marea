import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINIGAMES_CFG } from '@marea/content';
import { LANTERNE_N, lanterne, tapFrame } from '../src/minigames/lanterne.ts';
import type { LanterneState, LanterneView } from '../src/minigames/lanterne.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import { packInputs, quantize, replay } from '../src/replay.ts';
import { createRng } from '../src/rng.ts';
import type { InputFrame } from '../src/types.ts';

const CFG = MINIGAMES_CFG.lanterne;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const view = (s: LanterneState) => lanterne.view(s) as LanterneView;

/** Gioca con `pick(s)` (frame per tick, quantizzato come fa il client) fino alla fine: stato finale e frame. */
function play(seed: number, pick: (s: LanterneState) => InputFrame, difficulty: 1 | 2 | 3 = 2) {
  const s = lanterne.create({ seed, difficulty });
  const frames: InputFrame[] = [];
  for (let i = 0; i < lanterne.maxTicks && !s.done; i++) { const f = quantize(pick(s)); frames.push(f); lanterne.step(s, f); }
  return { s, frames };
}

test('lanterne: nel registro, 60 s, 6 lanterne', () => {
  assert.equal(getMinigame('lanterne'), lanterne);
  assert.equal(lanterne.maxTicks, CFG.maxSeconds * 60);
  assert.equal(LANTERNE_N, 6);
});

test('lanterne: stesso seed = stessa sequenza, seed diversi = sequenze diverse; mai due uguali di fila', () => {
  const a = lanterne.create({ seed: 7, difficulty: 2 }), b = lanterne.create({ seed: 7, difficulty: 2 }), c = lanterne.create({ seed: 8, difficulty: 2 });
  assert.deepEqual(a.seq, b.seq);
  assert.notDeepEqual(a.seq, c.seq);
  for (let i = 1; i < a.seq.length; i++) assert.notEqual(a.seq[i], a.seq[i - 1]);
  assert.ok(a.seq.every((x) => x >= 0 && x < LANTERNE_N));
});

test('lanterne: il tocco sopravvive alla quantizzazione (mx esatto a 1/32)', () => {
  for (let i = 0; i < LANTERNE_N; i++) assert.deepEqual(quantize(tapFrame(i)), tapFrame(i));
});

test('lanterne: l\'autopilot di riferimento fa oro, su tutte le difficoltà', () => {
  for (const d of [1, 2, 3] as const) for (const seed of [1, 42, 999, 123456]) {
    const rng = createRng(seed).fork('autopilot');
    const { s } = play(seed, (x) => lanterne.autopilot(x, rng), d);
    const r = lanterne.result(s);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${JSON.stringify(r.detail)}`);
    assert.equal(s.wrong, -1);
    assert.equal(r.score, r.detail['giuste']! * r.detail['sequenze']!);
  }
});

test('lanterne: un errore chiude subito la partita; si vede la lanterna giusta', () => {
  const s = lanterne.create({ seed: 5, difficulty: 2 });
  while (s.phase === 'mostra') lanterne.step(s, NO);
  const wrong = (s.seq[0]! + 1) % LANTERNE_N;
  lanterne.step(s, tapFrame(wrong));
  assert.equal(s.done, true);
  const v = view(s);
  assert.equal(v.wrong, wrong); assert.equal(v.expected, s.seq[0]); assert.equal(v.timeUp, false);
  assert.equal(lanterne.result(s).medal, null);
});

test('lanterne: i tocchi mentre si accendono non contano; tenere premuto non tocca due volte', () => {
  const s = lanterne.create({ seed: 11, difficulty: 2 });
  lanterne.step(s, tapFrame((s.seq[0]! + 1) % LANTERNE_N)); // durante la sequenza: ignorato, niente errore
  assert.equal(s.done, false);
  lanterne.step(s, NO);
  while (s.phase === 'mostra') lanterne.step(s, NO);
  const first = s.seq[0]!;
  lanterne.step(s, tapFrame(first));
  for (let i = 0; i < 20; i++) lanterne.step(s, tapFrame(first)); // tenuto premuto: un tocco solo
  assert.equal(s.giuste, 1); assert.equal(s.done, false);
});

test('lanterne: sequenza completata → la prossima ha una lanterna in più e riparte la mostra', () => {
  const rng = createRng(3);
  const s = lanterne.create({ seed: 3, difficulty: 2 });
  while (s.completate === 0 && !s.done) lanterne.step(s, quantize(lanterne.autopilot(s, rng)));
  assert.equal(s.completate, 1); assert.equal(s.len, CFG.primaSequenza + 1); assert.equal(s.phase, 'mostra'); assert.equal(s.pos, 0);
});

test('lanterne: la mostra accende le lanterne della sequenza, una alla volta e in ordine', () => {
  const s = lanterne.create({ seed: 21, difficulty: 2 });
  const seen: number[] = [];
  let was = -1;
  while (s.phase === 'mostra') {
    const v = view(s);
    if (v.lit >= 0 && v.lit !== was) seen.push(v.lit);
    was = v.lit;
    lanterne.step(s, NO);
  }
  assert.deepEqual(seen, s.seq.slice(0, CFG.primaSequenza));
});

test('lanterne: senza toccare niente finisce a 60 s, senza medaglia', () => {
  const { s } = play(9, () => NO);
  assert.equal(s.done, true); assert.equal(s.tick, lanterne.maxTicks);
  const r = lanterne.result(s);
  assert.equal(r.medal, null); assert.equal(r.score, 0); assert.equal(view(s).timeUp, true);
});

test('lanterne: chi tocca a caso non prende medaglie', () => {
  for (const seed of [2, 4, 6, 8, 10]) {
    const rng = createRng(seed).fork('caso');
    const { s } = play(seed, (x) => (x.phase === 'tocca' && !x.prevA && rng.next() < 0.1 ? tapFrame(rng.int(0, LANTERNE_N - 1)) : NO));
    assert.notEqual(lanterne.result(s).medal, 'oro', `seed ${seed}`);
  }
});

test('lanterne: il replay del server dà lo stesso esito degli input impacchettati', () => {
  for (const seed of [17, 4242]) {
    const rng = createRng(seed).fork('autopilot');
    // gioca bene per 4 sequenze, poi sbaglia
    const { s, frames } = play(seed, (x) => (x.completate < 4 ? lanterne.autopilot(x, rng) : x.phase === 'tocca' && !x.prevA ? tapFrame((x.seq[x.pos]! + 1) % LANTERNE_N) : NO));
    const local = lanterne.result(s);
    const r = replay('lanterne', seed, 2, packInputs(frames));
    assert.deepEqual(r, local);
    assert.equal(r.medal, 'argento');
    assert.equal(r.detail['sequenze'], 4);
  }
});
