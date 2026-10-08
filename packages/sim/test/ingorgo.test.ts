// Ingorgo al porto: livelli validi con la soluzione minima dichiarata, mosse esatte dopo la quantizzazione, regole (niente salti,
// niente sovrapposizioni), l'autopilota fa oro, il replay del server coincide, gli input rotti non rompono niente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINIGAMES_CFG } from '@marea/content';
import { LATO, RICOMINCIA, RIGA_USCITA, ingorgo, limiti, mossaFrame, parseLivello, righeDi, risolto, risolvi } from '../src/minigames/ingorgo.ts';
import type { Barca, IngorgoState, IngorgoView } from '../src/minigames/ingorgo.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import type { Difficulty } from '../src/minigames/types.ts';
import { packInputs, quantize, replay } from '../src/replay.ts';
import { createRng } from '../src/rng.ts';
import type { InputFrame } from '../src/types.ts';

const CFG = MINIGAMES_CFG.ingorgo;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const view = (s: IngorgoState) => ingorgo.view(s) as IngorgoView;

function play(seed: number, pick: (s: IngorgoState) => InputFrame, difficulty: Difficulty = 2) {
  const s = ingorgo.create({ seed, difficulty });
  const frames: InputFrame[] = [];
  while (!s.done) { const f = quantize(pick(s)); frames.push(f); ingorgo.step(s, f); }
  return { s, frames };
}
const auto = (seed: number) => { const rng = createRng(seed).fork('autopilot'); return (s: IngorgoState) => ingorgo.autopilot(s, rng); };
/** Ogni cella al massimo una barca, tutte dentro la griglia. */
function sane(barche: readonly Barca[]): boolean {
  const seen = new Set<number>();
  for (const b of barche) for (let k = 0; k < b.len; k++) {
    const x = b.h ? b.x + k : b.x, y = b.h ? b.y : b.y + k;
    if (x < 0 || y < 0 || x >= LATO || y >= LATO || seen.has(y * LATO + x)) return false;
    seen.add(y * LATO + x);
  }
  return true;
}

test('ingorgo: nel registro, 120 s, tre ingorghi a partita', () => {
  assert.equal(getMinigame('ingorgo'), ingorgo);
  assert.equal(ingorgo.maxTicks, CFG.maxSeconds * 60);
  for (const d of ['1', '2', '3'] as const) assert.equal(CFG.partite[d].length, 3);
});

test('ingorgo: ogni livello è valido e la sua soluzione più corta ha davvero le mosse dichiarate', () => {
  const fasce: Record<string, [number, number]> = { a: [3, 6], b: [6, 10], c: [10, 16] };
  for (const [f, [lo, hi]] of Object.entries(fasce)) {
    const l = CFG.livelli[f]!;
    assert.ok(l.length >= 8, `fascia ${f}: ${l.length} livelli`);
    assert.equal(new Set(l.map((x) => x.righe.join(''))).size, l.length, `fascia ${f}: doppioni`);
    for (const lv of l) {
      const b = parseLivello(lv.righe);
      assert.ok(sane(b) && !risolto(b), lv.righe.join('/'));
      assert.equal(b[0]!.y, RIGA_USCITA); assert.equal(b[0]!.h, true);
      assert.deepEqual(righeDi(b).map((r) => r.replace(/[B-Z]/g, '#')), lv.righe.map((r) => r.replace(/[B-Z]/g, '#')));
      const sol = risolvi(b);
      assert.ok(sol, 'senza soluzione: ' + lv.righe.join('/'));
      assert.equal(sol.length, lv.mosse, `${lv.righe.join('/')}: ${sol.length} ≠ ${lv.mosse}`);
      assert.ok(lv.mosse >= lo && lv.mosse <= hi, `fascia ${f}: ${lv.mosse} mosse`);
    }
  }
});

test('ingorgo: la mossa sopravvive alla quantizzazione; stesso seed = stessi livelli, dalle fasce giuste e senza doppioni', () => {
  for (let b = 0; b < 14; b++) for (const d of [-5, -1, 1, 4]) assert.deepEqual(quantize(mossaFrame(b, d)), mossaFrame(b, d));
  const a = ingorgo.create({ seed: 7, difficulty: 2 }), b = ingorgo.create({ seed: 7, difficulty: 2 }), c = ingorgo.create({ seed: 8, difficulty: 2 });
  assert.deepEqual(a.livelli, b.livelli);
  assert.notDeepEqual(a.livelli, c.livelli);
  for (const d of [1, 2, 3] as const) for (const seed of [1, 2, 3, 4]) {
    const s = ingorgo.create({ seed, difficulty: d });
    s.livelli.forEach((l, i) => assert.ok(CFG.livelli[CFG.partite[String(d) as '1'][i]!]!.includes(l)));
    assert.equal(new Set(s.livelli).size, 3);
  }
});

test('ingorgo: l\'autopilota fa oro su tutte le difficoltà, con le mosse minime e ben dentro il tempo', () => {
  for (const d of [1, 2, 3] as const) for (const seed of [1, 42, 999, 123456]) {
    const { s } = play(seed, auto(seed), d);
    const r = ingorgo.result(s);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${JSON.stringify(r.detail)}`);
    assert.equal(r.detail['mosse'], r.detail['ottimo']);
    assert.ok(r.detail['ms']! < 60_000);
  }
});

test('ingorgo: le regole — niente salti sopra le altre barche, niente fuori griglia, delta 0 e barche inesistenti ignorati', () => {
  const s = ingorgo.create({ seed: 3, difficulty: 2 });
  const before = JSON.stringify(s.barche);
  for (let i = 0; i < s.barche.length; i++) {
    const [lo, hi] = limiti(s.barche, i);
    for (const d of [lo - 1, hi + 1, 0]) { ingorgo.step(s, quantize(mossaFrame(i, d))); ingorgo.step(s, NO); }
  }
  ingorgo.step(s, quantize(mossaFrame(s.barche.length + 2, 1))); ingorgo.step(s, NO);
  assert.equal(JSON.stringify(s.barche), before);
  assert.equal(s.mosse, 0);
  // una mossa valida, tenuta premuta: conta una volta
  const i = s.barche.findIndex((_, k) => limiti(s.barche, k)[1] > 0);
  for (let k = 0; k < 10; k++) ingorgo.step(s, quantize(mossaFrame(i, 1)));
  assert.equal(s.mosse, 1);
  assert.ok(sane(s.barche));
  // RICOMINCIA: la griglia torna com'era e le mosse ripartono da zero (il tempo invece corre)
  ingorgo.step(s, NO); ingorgo.step(s, RICOMINCIA);
  assert.equal(JSON.stringify(s.barche), before);
  assert.equal(s.ripartenze, 1); assert.equal(s.mosse, 0);
});

test('ingorgo: risolto un ingorgo, pausa e poi il prossimo; a metà partita il replay coincide (1 risolto → bronzo)', () => {
  for (const seed of [17, 4242]) {
    const pilot = auto(seed);
    const { s, frames } = play(seed, (x) => (x.esiti.length < 1 ? pilot(x) : NO));
    assert.equal(s.timeUp, true);
    const r = replay('ingorgo', seed, 2, packInputs(frames));
    assert.deepEqual(r, ingorgo.result(s));
    assert.equal(r.medal, 'bronzo'); assert.equal(r.detail['risolti'], 1);
    assert.equal(view(s).idx, 1);
    const full = play(seed, auto(seed));
    assert.deepEqual(replay('ingorgo', seed, 2, packInputs(full.frames)), ingorgo.result(full.s));
  }
});

test('ingorgo: senza toccare niente finisce a 120 s senza medaglia; frame a caso non rompono niente', () => {
  const { s } = play(9, () => NO);
  assert.equal(s.tick, ingorgo.maxTicks);
  assert.equal(ingorgo.result(s).medal, null); assert.equal(ingorgo.result(s).score, 0);
  for (const seed of [1, 2, 3]) {
    const rng = createRng(seed);
    const t = ingorgo.create({ seed, difficulty: 2 });
    const frames: InputFrame[] = [];
    while (!t.done) {
      const f = quantize({ mx: rng.next() * 2 - 1, my: rng.next() * 2 - 1, a: rng.next() < 0.5, b: rng.next() < 0.01 });
      frames.push(f); ingorgo.step(t, f);
      assert.ok(sane(t.barche));
    }
    assert.deepEqual(replay('ingorgo', seed, 2, packInputs(frames)), ingorgo.result(t));
  }
});
