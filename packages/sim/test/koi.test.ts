// Carpe koi (Isola Giardino): cibo dal seed, il tocco chiama la carpa giusta, la nera ruba e scappa quando la tocchi, la combo,
// l'autopilota fa oro su molti seed, chi non tocca niente non prende medaglia, il replay del server coincide, input rotti innocui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ISLANDS, ARCHIPELAGO, MINIGAMES_CFG } from '@marea/content';
import { KOI_COLORATE, KOI_H, KOI_W, koi, koiMolt, koiPunto, koiTocco } from '../src/minigames/koi.ts';
import type { KoiState } from '../src/minigames/koi.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import type { Difficulty, MinigameResult } from '../src/minigames/types.ts';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import { isPackedInputs, packInputs, quantize, replay } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';
import { soloPrize } from '../src/economy/rewards.ts';

const CFG = MINIGAMES_CFG.koi;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
function gioca(seed: number, difficulty: Difficulty, pilota: (s: KoiState) => InputFrame): { s: KoiState; log: InputFrame[]; r: MinigameResult } {
  const s = koi.create({ seed, difficulty });
  const log: InputFrame[] = [];
  while (!s.done) { const f = quantize(pilota(s)); log.push(f); koi.step(s, f); }
  return { s, log, r: koi.result(s) };
}
const auto = (seed: number) => { const rng = createRng(seed); return (s: KoiState) => koi.autopilot(s, rng); };
/** Fa passare n tick senza toccare. */
const aspetta = (s: KoiState, n: number) => { for (let i = 0; i < n; i++) koi.step(s, NO); };
const tocca = (s: KoiState, x: number, y: number) => { koi.step(s, quantize(koiTocco(x, y))); koi.step(s, NO); };

test('koi: registrato, 60 s, posto sul ponticello del Giardino; stesso seed = stesso stagno, seed diverso = cibo diverso', () => {
  assert.equal(getMinigame('koi'), koi);
  assert.equal(koi.maxTicks, CFG.maxSeconds * 60);
  assert.ok(ARCHIPELAGO.islands.some((i) => i.island === CFG.isola && i.tema));
  const isl = ISLANDS.find((i) => i.id === CFG.isola)!;
  assert.equal(isl.rows[CFG.posto[1]]![CFG.posto[0]], 'd', 'il posto dev\'essere sul ponticello');
  const a = koi.create({ seed: 42, difficulty: 2 }), b = koi.create({ seed: 42, difficulty: 2 }), c = koi.create({ seed: 43, difficulty: 2 });
  assert.equal(hashJson(a), hashJson(b));
  assert.notEqual(hashJson(a.cibo), hashJson(c.cibo));
  assert.equal(a.carpe.length, KOI_COLORATE + 1);
  assert.ok(a.cibo.length >= 30 && a.cibo.length <= 70, `cibo: ${a.cibo.length}`);
  for (const x of a.cibo) assert.ok(x.x >= CFG.stagno.bordo && x.x <= KOI_W - CFG.stagno.bordo && x.y >= CFG.stagno.bordo && x.y <= KOI_H - CFG.stagno.bordo);
  assert.ok(a.cibo.some((x) => x.oro) && a.cibo.some((x) => !x.oro));
});

test('koi: un tocco sul cibo manda la carpa colorata libera più vicina, che lo mangia (punti e combo)', () => {
  const s = koi.create({ seed: 5, difficulty: 2 });
  const c = s.cibo[0]!;
  aspetta(s, c.t0 - s.tick); // a galla
  assert.equal(c.stato, 1);
  const vicina = [0, 1, 2].reduce((b, i) => (Math.hypot(s.carpe[i]!.x - c.x, s.carpe[i]!.y - c.y) < Math.hypot(s.carpe[b]!.x - c.x, s.carpe[b]!.y - c.y) ? i : b), 0);
  // la nera via, perché non rubi
  const n = s.carpe[KOI_COLORATE]!; n.x = 4; n.y = 4; n.modo = 'spavento'; n.t = 400;
  tocca(s, c.x + 3, c.y - 2);
  assert.equal(s.carpe[vicina]!.modo, 'corsa'); assert.equal(s.carpe[vicina]!.meta, c.id);
  for (let i = 0; i < 300 && c.stato === 1; i++) koi.step(s, NO);
  assert.equal(c.stato, 2); assert.equal(c.da, vicina);
  assert.equal(s.punti, c.oro ? CFG.punti.oro : CFG.punti.petalo); assert.equal(s.combo, 1); assert.equal(s.mangiati, 1);
  assert.equal(s.carpe[vicina]!.modo, 'mangia');
});

test('koi: il tocco sull\'acqua lontano dal cibo non chiama nessuno; la nera ruba (combo a zero) e toccata scappa', () => {
  const s = koi.create({ seed: 11, difficulty: 3 });
  const c = s.cibo[0]!;
  aspetta(s, c.t0 - s.tick);
  // tocco lontano da tutto il cibo e dalla nera
  const n = s.carpe[KOI_COLORATE]!;
  let fx = c.x > KOI_W / 2 ? 8 : KOI_W - 8, fy = c.y > KOI_H / 2 ? 8 : KOI_H - 8;
  if (Math.hypot(fx - n.x, fy - n.y) < 30) fy = KOI_H - fy;
  tocca(s, fx, fy);
  assert.equal(s.tocco?.cosa, 'acqua');
  assert.ok(s.carpe.slice(0, KOI_COLORATE).every((k) => k.modo !== 'corsa'));
  // la nera vicina al cibo e nessuno lo chiama: lo ruba
  s.combo = 4;
  n.x = c.x + 20; n.y = c.y; n.modo = 'giro';
  for (let i = 0; i < 200 && c.stato === 1; i++) koi.step(s, NO);
  assert.equal(c.stato, 3); assert.equal(s.rubati, 1); assert.equal(s.combo, 0); assert.equal(n.modo, 'sazia');
  // toccata: scappa e non ruba
  tocca(s, n.x, n.y);
  assert.equal(n.modo, 'spavento'); assert.equal(s.spaventi, 1); assert.equal(s.tocco?.cosa, 'nera');
});

test('koi: combo e moltiplicatore; il totale (base delle medaglie) è il cibo intero mangiato in fila', () => {
  assert.equal(koiMolt(0), 1); assert.equal(koiMolt(CFG.punti.combo - 1), 1); assert.equal(koiMolt(CFG.punti.combo), 2);
  assert.equal(koiMolt(1000), CFG.punti.comboMax);
  const s = koi.create({ seed: 1, difficulty: 2 });
  const tot = s.cibo.reduce((a, c, k) => a + (c.oro ? CFG.punti.oro : CFG.punti.petalo) * koiMolt(k), 0);
  assert.equal(s.totale, tot);
  const v = koi.view(s) as { medals: { oro: number; argento: number; bronzo: number } };
  assert.equal(v.medals.oro, Math.ceil(tot * CFG.medaglie.oro));
});

test('koi: l\'autopilota fa oro su tante partite e difficoltà; il replay del server coincide', () => {
  for (const d of [1, 2, 3] as const) for (let seed = 1; seed <= 16; seed++) {
    const { r, log } = gioca(seed * 104729, d, auto(seed));
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${JSON.stringify(r.detail)}`);
    if (seed % 4 === 0) {
      const p = packInputs(log);
      assert.ok(isPackedInputs(p, koi.maxTicks));
      assert.deepEqual(replay('koi', seed * 104729, d, p), r);
    }
  }
});

test('koi: chi non tocca niente non prende medaglia; chi chiama le carpe ma non scaccia mai la nera perde dei bocconi', () => {
  const { r } = gioca(3, 2, () => NO);
  assert.equal(r.medal, null); assert.equal(r.score, 0); assert.ok(r.detail['rubati']! > 5);
  // un giocatore lento che non scaccia mai la nera: qualche furto, niente oro garantito, ma una medaglia sì
  let last = -99;
  const lento = (s: KoiState): InputFrame => {
    if (s.prevA || s.tick - last < 20) return NO;
    const c = s.cibo.find((c) => c.stato === 1 && s.tick - c.t0 >= 40 && !s.carpe.some((k, i) => i < KOI_COLORATE && k.modo === 'corsa' && k.meta === c.id));
    if (!c) return NO;
    last = s.tick; return koiTocco(c.x, c.y);
  };
  const l = gioca(8, 2, lento).r;
  assert.ok(l.detail['rubati']! > 0 && l.medal !== null, JSON.stringify(l.detail));
});

test('koi: tocchi a caso e frame rotti non rompono niente (carpe dentro lo stagno, punti coerenti), il replay coincide', () => {
  for (const seed of [1, 2, 3]) {
    const rng = createRng(seed);
    const { s, log, r } = gioca(seed, 2, () => ({ mx: rng.next() * 2.4 - 1.2, my: rng.next() * 2.4 - 1.2, a: rng.next() < 0.3, b: rng.next() < 0.5 }));
    for (const k of s.carpe) assert.ok(k.x >= 0 && k.x <= KOI_W && k.y >= 0 && k.y <= KOI_H && Number.isFinite(k.hx));
    assert.equal(s.mangiati + s.rubati + s.affondati + s.cibo.filter((c) => c.stato < 2).length, s.cibo.length);
    assert.deepEqual(replay('koi', seed, 2, packInputs(log)), r);
  }
  const p = koiPunto(quantize(koiTocco(80, 56)));
  assert.ok(Math.abs(p.x - 80) <= 2.5 && Math.abs(p.y - 56) <= 2);
});

test('koi: l\'oro paga balance.solo più il premio extra del json', () => {
  const p = soloPrize('oro', 'koi'), b = BALANCE.solo.premi.oro, x = CFG.premioExtra?.oro ?? {};
  assert.deepEqual(p, { legno: b.legno + (x.legno ?? 0), pietra: b.pietra + (x.pietra ?? 0), perle: b.perle + (x.perle ?? 0) });
});
