// Pinguini sul ghiaccio (Isola dei Ghiacci): livelli validi con la soluzione minima dichiarata e un pinguino che fa da sponda nelle fasce
// a più pinguini, scivolate che si fermano dove devono (iceberg, pinguino, bordo, buca), l'autopilota fa oro, il replay del server
// coincide, gli input rotti non rompono niente, il premio extra dell'oro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { PG_LATO, PG_RICOMINCIA, parsePinguini, pgMossaFrame, pgRisolto, pinguini, righePinguini, risolviPinguini, scivola } from '../src/minigames/pinguini.ts';
import type { PinguiniState } from '../src/minigames/pinguini.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import type { Difficulty } from '../src/minigames/types.ts';
import { packInputs, quantize, replay } from '../src/replay.ts';
import { createRng } from '../src/rng.ts';
import type { InputFrame } from '../src/types.ts';
import { soloPrize } from '../src/economy/rewards.ts';
import { BALANCE } from '@marea/content';

const CFG = MINIGAMES_CFG.pinguini;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
function play(seed: number, pick: (s: PinguiniState) => InputFrame, difficulty: Difficulty = 2) {
  const s = pinguini.create({ seed, difficulty });
  const frames: InputFrame[] = [];
  while (!s.done) { const f = quantize(pick(s)); frames.push(f); pinguini.step(s, f); }
  return { s, frames };
}
const auto = (seed: number) => { const rng = createRng(seed).fork('autopilot'); return (s: PinguiniState) => pinguini.autopilot(s, rng); };

test('pinguini: nel registro, 90 s, tre livelli a partita, posto sui Ghiacci su una cella dove si cammina', () => {
  assert.equal(getMinigame('pinguini'), pinguini);
  assert.equal(pinguini.maxTicks, CFG.maxSeconds * 60);
  for (const d of ['1', '2', '3'] as const) assert.equal(CFG.partite[d].length, 3);
  assert.ok(ARCHIPELAGO.islands.some((i) => i.island === CFG.isola && i.tema), 'l\'isola dei Pinguini dev\'essere a tema');
  const isl = ISLANDS.find((i) => i.id === CFG.isola)!;
  const ch = isl.rows[CFG.posto[1]]![CFG.posto[0]]!;
  assert.ok('g.sdP'.includes(ch), `posto su '${ch}'`);
});

test('pinguini: ogni livello è valido, la sua soluzione più corta ha davvero le mosse dichiarate, nella fascia giusta', () => {
  for (const [f, fascia] of Object.entries(CFG.fasce)) {
    const l = CFG.livelli[f]!;
    assert.ok(l.length >= 10, `fascia ${f}: ${l.length} livelli`);
    assert.equal(new Set(l.map((x) => x.righe.join(''))).size, l.length, `fascia ${f}: doppioni`);
    for (const lv of l) {
      const { lastra, pos } = parsePinguini(lv.righe);
      assert.equal(lastra.lato, PG_LATO);
      assert.deepEqual(righePinguini(lastra, pos), lv.righe);
      assert.ok(pos.length >= fascia.pinguini[0] && pos.length <= fascia.pinguini[1], `fascia ${f}: ${pos.length} pinguini`);
      assert.ok(pos.every((c) => !lastra.buca[c] && !lastra.muro[c]));
      const sol = risolviPinguini(lastra, pos);
      assert.ok(sol, 'senza soluzione: ' + lv.righe.join('/'));
      assert.equal(sol.length, lv.mosse, `${lv.righe.join('/')}: ${sol.length} ≠ ${lv.mosse}`);
      assert.ok(lv.mosse >= fascia.mosse[0] && lv.mosse <= fascia.mosse[1], `fascia ${f}: ${lv.mosse} mosse`);
      // la soluzione funziona davvero mossa per mossa
      const p = pos.slice();
      for (const m of sol) { const sc = scivola(lastra, p, m.p, m.dir)!; p[m.p] = sc.tuffo ? -1 : sc.a; }
      assert.ok(pgRisolto(p));
    }
  }
});

test('pinguini: la scivolata si ferma contro iceberg, pinguino e bordo; passando su una buca ci si tuffa', () => {
  const { lastra, pos } = parsePinguini(['......', '.A..#.', '......', '.B..o.', '......', '......']);
  assert.deepEqual(scivola(lastra, pos, 0, 1), { a: 9, passi: 2, tuffo: false }); // contro l'iceberg in (4,1)
  assert.deepEqual(scivola(lastra, pos, 0, 2), { a: 13, passi: 1, tuffo: false }); // contro B in (1,3)
  assert.deepEqual(scivola(lastra, pos, 0, 0), { a: 1, passi: 1, tuffo: false }); // contro il bordo
  assert.deepEqual(scivola(lastra, pos, 1, 1), { a: 22, passi: 3, tuffo: true }); // nella buca in (4,3)
  assert.equal(scivola(lastra, [6, 0], 1, 3), null); // già contro il bordo: non si muove
  assert.equal(scivola(lastra, [-1, 19], 0, 1), null); // già tuffato
});

test('pinguini: le mosse sopravvivono alla quantizzazione; stesso seed = stessi livelli, dalle fasce giuste, senza doppioni', () => {
  for (let p = 0; p < 3; p++) for (let d = 0; d < 4; d++) assert.deepEqual(quantize(pgMossaFrame(p, d)), pgMossaFrame(p, d));
  const a = pinguini.create({ seed: 7, difficulty: 2 }), b = pinguini.create({ seed: 7, difficulty: 2 });
  assert.deepEqual(a.livelli, b.livelli);
  const diversi = new Set([1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(pinguini.create({ seed, difficulty: 2 }).livelli)));
  assert.ok(diversi.size >= 5, `seed diversi, livelli uguali: ${diversi.size}`);
  for (const d of [1, 2, 3] as const) for (const seed of [1, 2, 3, 4]) {
    const s = pinguini.create({ seed, difficulty: d });
    s.livelli.forEach((l, i) => assert.ok(CFG.livelli[CFG.partite[String(d) as '1'][i]!]!.includes(l)));
    assert.equal(new Set(s.livelli).size, 3);
  }
});

test('pinguini: l\'autopilota fa oro su tutte le difficoltà e su tanti seed, con le mosse minime e ben dentro il tempo', () => {
  for (const d of [1, 2, 3] as const) for (let seed = 1; seed <= 40; seed++) {
    const { s, frames } = play(seed * 7919, auto(seed), d);
    const r = pinguini.result(s);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${JSON.stringify(r.detail)}`);
    assert.equal(r.detail['mosse'], r.detail['ottimo']);
    assert.ok(r.detail['ms']! < 30_000, `troppo lento: ${r.detail['ms']}`);
    if (seed % 10 === 0) assert.deepEqual(replay('pinguini', seed * 7919, d, packInputs(frames)), r);
  }
});

test('pinguini: l\'autopilota dopo mosse a caso (anche un pinguino incastrato) ricomincia il livello se serve e fa oro lo stesso', () => {
  let ricominciati = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const rng = createRng(seed), pilot = auto(seed);
    let caso = 4, t = 0;
    const { s } = play(seed, (x) => {
      t++;
      if (caso > 0 && x.idx === 0 && !x.prevA) { caso--; return pgMossaFrame(rng.int(0, x.pos.length - 1), rng.int(0, 3)); }
      return caso > 0 && t % 2 ? NO : pilot(x);
    });
    assert.equal(pinguini.result(s).medal, 'oro', `seed ${seed}: ${JSON.stringify(pinguini.result(s).detail)}`);
    ricominciati += s.ripartenze;
  }
  assert.ok(ricominciati >= 1, 'nessun livello incastrato in 30 partite: il test non prova niente');
});

test('pinguini: regole —mosse a vuoto e pinguini che non ci sono ignorati; tenuta premuta conta una volta; RICOMINCIA rimette tutto', () => {
  const s = pinguini.create({ seed: 3, difficulty: 2 });
  const prima = JSON.stringify(s.pos);
  pinguini.step(s, quantize(pgMossaFrame(7, 1))); pinguini.step(s, NO);
  pinguini.step(s, quantize({ mx: 1 / 32, my: 9 / 32, a: true, b: false })); pinguini.step(s, NO); // direzione 8: non esiste
  assert.equal(JSON.stringify(s.pos), prima); assert.equal(s.mosse, 0);
  const m = risolviPinguini(s.lastra, s.pos)![0]!;
  for (let k = 0; k < 10; k++) pinguini.step(s, quantize(pgMossaFrame(m.p, m.dir)));
  assert.equal(s.mosse, 1);
  assert.equal(s.ultima?.p, m.p);
  pinguini.step(s, NO); pinguini.step(s, PG_RICOMINCIA);
  assert.equal(JSON.stringify(s.pos), prima);
  assert.equal(s.ripartenze, 1); assert.equal(s.mosse, 0); assert.equal(s.ultima, null);
});

test('pinguini: a metà partita il replay coincide (1 livello → bronzo); senza toccare niente niente medaglia; frame a caso non rompono niente', () => {
  for (const seed of [17, 4242]) {
    const pilot = auto(seed);
    const { s, frames } = play(seed, (x) => (x.esiti.length < 1 ? pilot(x) : NO));
    assert.equal(s.timeUp, true);
    const r = replay('pinguini', seed, 2, packInputs(frames));
    assert.deepEqual(r, pinguini.result(s));
    assert.equal(r.medal, 'bronzo'); assert.equal(r.detail['risolti'], 1);
  }
  const { s } = play(9, () => NO);
  assert.equal(s.tick, pinguini.maxTicks);
  assert.equal(pinguini.result(s).medal, null); assert.equal(pinguini.result(s).score, 0);
  for (const seed of [1, 2, 3]) {
    const rng = createRng(seed);
    const t = pinguini.create({ seed, difficulty: 2 });
    const frames: InputFrame[] = [];
    while (!t.done) {
      const f = quantize({ mx: rng.next() * 2 - 1, my: rng.next() * 2 - 1, a: rng.next() < 0.5, b: rng.next() < 0.01 });
      frames.push(f); pinguini.step(t, f);
      assert.ok(t.pos.every((c) => c === -1 || (c >= 0 && c < PG_LATO * PG_LATO && !t.lastra.muro[c])));
      assert.equal(new Set(t.pos.filter((c) => c >= 0)).size, t.pos.filter((c) => c >= 0).length, 'due pinguini sulla stessa cella');
    }
    assert.deepEqual(replay('pinguini', seed, 2, packInputs(frames)), pinguini.result(t));
  }
});

test('pinguini: l\'oro paga balance.solo più il premio extra del json', () => {
  const p = soloPrize('oro', 'pinguini'), b = BALANCE.solo.premi.oro, x = CFG.premioExtra?.oro ?? {};
  assert.deepEqual(p, { legno: b.legno + (x.legno ?? 0), pietra: b.pietra + (x.pietra ?? 0), perle: b.perle + (x.perle ?? 0) });
  assert.deepEqual(soloPrize('argento', 'pinguini'), { ...BALANCE.solo.premi.argento });
});
