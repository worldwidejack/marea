// Arrembaggio (Isola della Tempesta): navi, raffiche e lampi dal seed, il pilota di riferimento fa oro su molti seed, il replay è identico,
// gli input rotti non rompono niente, la potenza sale e scende, il vento sposta i colpi, il posto sta sull'isola e il premio extra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, BALANCE, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { arrembaggio, potenzaDi, sparo, volo, ventoAt } from '../src/minigames/arrembaggio.ts';
import type { ArrembaggioState, ArrembaggioView } from '../src/minigames/arrembaggio.ts';
import type { Difficulty, MinigameResult } from '../src/minigames/types.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import { isPackedInputs, packInputs, quantize, replay } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';
import { soloPrize } from '../src/economy/rewards.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';

const C = MINIGAMES_CFG.arrembaggio;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

function gioca(seed: number, difficulty: Difficulty, pilota: (s: ArrembaggioState, t: number) => InputFrame): { s: ArrembaggioState; log: InputFrame[]; r: MinigameResult } {
  const s = arrembaggio.create({ seed, difficulty });
  const log: InputFrame[] = [];
  for (let t = 0; !s.done; t++) { const f = quantize(pilota(s, t)); log.push(f); arrembaggio.step(s, f); }
  return { s, log, r: arrembaggio.result(s) };
}
const auto = (s: ArrembaggioState) => arrembaggio.autopilot(s, createRng(1));

test('arrembaggio: registrato, 60 s a 60 Hz, stesso seed = stessa partita, seed diverso = navi diverse', () => {
  assert.equal(getMinigame('arrembaggio'), arrembaggio);
  assert.equal(arrembaggio.maxTicks, C.maxSeconds * 60);
  const a = arrembaggio.create({ seed: 42, difficulty: 2 }), b = arrembaggio.create({ seed: 42, difficulty: 2 }), c = arrembaggio.create({ seed: 43, difficulty: 2 });
  assert.equal(hashJson(a), hashJson(b));
  assert.notEqual(hashJson(a.navi), hashJson(c.navi));
});

test('arrembaggio: navi di tutti i tipi (la piccola vale più della grande), raffiche entro il massimo, lampi', () => {
  assert.ok(C.navi.sloop.punti > C.navi.brigantino.punti && C.navi.brigantino.punti > C.navi.galeone.punti && C.navi.tesoro.punti > C.navi.sloop.punti);
  assert.ok(C.navi.sloop.velocita > C.navi.galeone.velocita);
  for (const seed of [1, 2, 3, 99, 123456]) {
    const s = arrembaggio.create({ seed, difficulty: 2 });
    const n = (k: string) => s.navi.filter((x) => x.k === k).length;
    assert.ok(s.navi.length >= 24 && n('galeone') >= 3 && n('brigantino') >= 3 && n('sloop') >= 3 && n('tesoro') >= 1, `seed ${seed}: ${s.navi.map((x) => x.k)}`);
    assert.ok(s.navi.some((x) => x.dir > 0) && s.navi.some((x) => x.dir < 0), 'navi da tutte e due le parti');
    for (const r of s.raffiche) assert.ok(Math.abs(r.v) <= C.vento.max * C.difficolta.vento[1] + 1e-12);
    assert.ok(s.raffiche.some((r) => r.v > 0) && s.raffiche.some((r) => r.v < 0), 'il vento gira');
    assert.ok(s.lampi.length >= 4);
    assert.equal(s.totale, s.navi.reduce((t, x) => t + C.navi[x.k].punti, 0));
  }
});

test('arrembaggio: la potenza sale e scende finché tieni premuto; il vento sposta il punto d\'arrivo', () => {
  const T = C.tiro.caricaSecondi * 60;
  assert.equal(potenzaDi(-1), -1); assert.equal(potenzaDi(0), 0); assert.equal(potenzaDi(T), 1); assert.equal(potenzaDi(2 * T), 0); assert.equal(potenzaDi(T / 2), 0.5);
  const s = arrembaggio.create({ seed: 5, difficulty: 2 });
  s.navi = []; // niente navi: guardiamo solo dove cade
  const calma = volo({ ...s, raffiche: [{ t: 0, v: 0 }] }, sparo(0.6), 1).x;
  const destra = volo({ ...s, raffiche: [{ t: 0, v: C.vento.max }] }, sparo(0.6), 1).x;
  const sinistra = volo({ ...s, raffiche: [{ t: 0, v: -C.vento.max }] }, sparo(0.6), 1).x;
  assert.ok(destra > calma + 5 && sinistra < calma - 5, `vento: ${sinistra} ${calma} ${destra}`);
  const corto = volo({ ...s, raffiche: [{ t: 0, v: 0 }] }, sparo(0), 1).x, lungo = volo({ ...s, raffiche: [{ t: 0, v: 0 }] }, sparo(1), 1).x;
  assert.ok(corto < 90 && lungo > 185, `gittata ${corto}..${lungo}`);
  assert.equal(ventoAt([{ t: 0, v: 0 }, { t: 100, v: 1 }], 100 + C.vento.cambioSecondi * 30), 0.5);
});

test('arrembaggio: il pilota di riferimento fa oro su molti seed (difficoltà 1, 2, 3) e il replay dal log compresso è identico', () => {
  for (let seed = 1; seed <= 24; seed++) {
    const d = ((seed % 3) + 1) as Difficulty;
    const { s, log, r } = gioca(seed * 7919, d, auto);
    assert.equal(r.done, true);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${r.score}/${s.totale}`);
    if (seed <= 6) {
      const p = packInputs(log);
      assert.ok(isPackedInputs(p, arrembaggio.maxTicks));
      assert.deepEqual(replay('arrembaggio', seed * 7919, d, p), r, `replay diverso seed ${seed}`);
      const s2 = arrembaggio.create({ seed: seed * 7919, difficulty: d });
      for (const f of log) arrembaggio.step(s2, f);
      assert.equal(hashJson(s2), hashJson(s));
    }
  }
});

test('arrembaggio: chi non spara non prende niente, chi tiene sempre premuto non spara mai, chi spara a caso prende poco', () => {
  const fermo = gioca(5, 2, () => NO).r;
  assert.equal(fermo.score, 0); assert.equal(fermo.medal, null);
  const sempre = gioca(5, 2, () => ({ mx: 0, my: 0, a: true, b: false })).r;
  assert.equal(sempre.detail['spari'], 0);
  // a caso: carica per un tempo a caso e spara finché ha palle (le palle sono contate)
  for (const seed of [5, 6, 7, 8]) {
    const rng = createRng(seed); let quanto = 0;
    const caso = gioca(seed, 2, (s) => { if (s.carica < 0) { quanto = rng.int(5, 60); return { mx: 0, my: 0, a: true, b: false }; } return { mx: 0, my: 0, a: s.carica < quanto, b: false }; }).r;
    assert.equal(caso.detail['spari'], C.tiro.palle);
    assert.ok(caso.score > 0 && caso.medal !== 'oro', `a caso: ${caso.medal} ${caso.score} ${JSON.stringify(caso.detail)}`);
  }
});

test('arrembaggio: input rotti (assi fuori scala, NaN, a che cambia ogni tick) non rompono la sim; log troppo lunghi rifiutati', () => {
  const s = arrembaggio.create({ seed: 8, difficulty: 2 });
  const rng = createRng(8);
  for (let t = 0; t < arrembaggio.maxTicks + 50; t++) {
    arrembaggio.step(s, { mx: rng.next() * 1e9 - 5e8, my: Number.NaN, a: rng.next() < 0.5, b: rng.next() < 0.5 });
    for (const b of s.palle) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y));
  }
  assert.equal(s.done, true); assert.equal(s.tick, arrembaggio.maxTicks, 'dopo la fine la sim sta ferma');
  const v = arrembaggio.view(s) as ArrembaggioView;
  assert.ok(v.done && v.ms === C.maxSeconds * 1000 && v.medals.oro > v.medals.argento && v.medals.argento > v.medals.bronzo);
  assert.equal(isPackedInputs([[arrembaggio.maxTicks + 1, 0, 0, 1, 0]], arrembaggio.maxTicks), false);
  assert.throws(() => replay('arrembaggio', 1, 2, [[arrembaggio.maxTicks + 1, 0, 0, 1, 0]]));
});

test('arrembaggio: il posto sta sull\'Isola della Tempesta, a piedi; l\'oro dà Legno in più', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
  const p = arch.places.find((q) => q.island === C.isola);
  assert.ok(p?.tema, 'isola a tema');
  const [cx, cz] = C.posto;
  assert.ok(['.', 'g'].includes(arch.map.at(p.origin[0] + cx, p.origin[1] + cz)), 'cella camminabile');
  const extra = C.premioExtra?.oro?.legno ?? 0;
  assert.ok(extra > 0);
  assert.deepEqual(soloPrize('oro', 'arrembaggio'), { ...BALANCE.solo.premi.oro, legno: BALANCE.solo.premi.oro.legno + extra });
  assert.deepEqual(soloPrize('argento', 'arrembaggio'), BALANCE.solo.premi.argento);
});
