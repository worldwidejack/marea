// Caccia alle perle: fondale dal seed (perle rare, pericoli, alghe e coralli), il pilota di riferimento fa oro, il replay è identico,
// gli input rotti non rompono niente, l'ostrica si apre quando arrivi, il posto mobile (barca ferma su acqua bassa) e il premio extra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, BALANCE, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { PERLE_X0, cercaPerle, fondoAt, ostricaAperta, perle, perleQui } from '../src/minigames/perle.ts';
import type { PerleState, PerleView } from '../src/minigames/perle.ts';
import type { Difficulty, MinigameResult } from '../src/minigames/types.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import { isPackedInputs, packInputs, quantize, replay } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';
import { newLot } from '../src/economy/actions.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { finishSolo, soloPrize, startSolo } from '../src/economy/rewards.ts';
import { add } from '../src/economy/types.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';

const C = MINIGAMES_CFG.perle;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

function gioca(seed: number, difficulty: Difficulty, pilota: (s: PerleState, t: number) => InputFrame): { s: PerleState; log: InputFrame[]; r: MinigameResult } {
  const s = perle.create({ seed, difficulty });
  const log: InputFrame[] = [];
  for (let t = 0; !s.done; t++) { const f = quantize(pilota(s, t)); log.push(f); perle.step(s, f); }
  return { s, log, r: perle.result(s) };
}
const auto = (s: PerleState) => perle.autopilot(s, createRng(1));

test('perle: registrato, 60 s a 60 Hz, stesso seed = stesso fondale, seed diverso = fondale diverso', () => {
  assert.equal(getMinigame('perle'), perle);
  assert.equal(perle.maxTicks, C.maxSeconds * 60);
  const a = perle.create({ seed: 42, difficulty: 2 }), b = perle.create({ seed: 42, difficulty: 2 }), c = perle.create({ seed: 43, difficulty: 2 });
  assert.equal(hashJson(a), hashJson(b));
  assert.notEqual(hashJson(a.fondo), hashJson(c.fondo));
  assert.equal(a.x, PERLE_X0);
  assert.equal(a.aria, 1);
});

test('perle: il fondale ha perle di tutti i tipi (rare comprese), pericoli, alghe e coralli; tutto in acqua e raggiungibile', () => {
  for (const seed of [1, 2, 3, 99, 123456]) {
    const s = perle.create({ seed, difficulty: 2 });
    const n = (k: string) => s.items.filter((i) => i.k === k).length;
    assert.ok(n('bianca') >= 30 && n('conchiglia') >= 4 && n('rosa') >= 3 && n('nera') >= 2 && n('bolla') >= 3, `seed ${seed}: ${JSON.stringify(s.items.map((i) => i.k))}`);
    assert.ok(s.pericoli.some((h) => h.k === 'medusa') && s.pericoli.some((h) => h.k === 'granchio'), `seed ${seed}: pericoli`);
    assert.ok(s.decor.some((d) => d.k === 'alga') && s.decor.some((d) => d.k === 'corallo'), `seed ${seed}: decor`);
    const fine = PERLE_X0 + C.velocita * perle.maxTicks;
    for (const it of s.items) {
      assert.ok(it.x > PERLE_X0 + 100 && it.x < fine, `seed ${seed}: ${it.k} fuori percorso a x=${it.x}`);
      assert.ok(it.y >= 10 && it.y <= fondoAt(s.fondo, it.x), `seed ${seed}: ${it.k} a y=${it.y} fuori dall'acqua (fondo ${fondoAt(s.fondo, it.x)})`);
    }
    for (const d of s.fondo) assert.ok(d >= C.fondale.min - 8 && d <= C.fondale.max, `fondale ${d}`);
    assert.equal(s.totale, s.items.reduce((t, i) => t + (i.k === 'bolla' ? 0 : C.punti[i.k]), 0));
    // più difficile = più meduse (a parità di seed)
    const m = (d: Difficulty) => perle.create({ seed, difficulty: d }).pericoli.filter((h) => h.k === 'medusa').length;
    assert.ok(m(1) <= m(2) && m(2) <= m(3), `meduse ${m(1)} ${m(2)} ${m(3)}`);
  }
});

test('perle: l\'ostrica della perla rosa è aperta quando il sub le passa sopra', () => {
  for (const seed of [5, 6, 7]) {
    const s = perle.create({ seed, difficulty: 2 });
    for (const it of s.items.filter((i) => i.k === 'rosa')) {
      const t = Math.round((it.x - PERLE_X0) / C.velocita);
      assert.ok(ostricaAperta(it, t) && ostricaAperta(it, t - 20) && ostricaAperta(it, t + 8), `seed ${seed}: ostrica chiusa a x=${it.x}`);
    }
  }
});

test('perle: il pilota di riferimento fa oro (difficoltà 1, 2, 3) e il replay dal log compresso dà lo stesso risultato', () => {
  const seeds: [number, Difficulty][] = [[1, 2], [77, 2], [2026, 2], [31337, 2], [9, 1], [10, 3]];
  for (const [seed, d] of seeds) {
    const { s, log, r } = gioca(seed, d, auto);
    assert.equal(r.done, true);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${r.score}/${s.totale} ${JSON.stringify(r.detail)}`);
    assert.equal(log.length, perle.maxTicks);
    const p = packInputs(log);
    assert.ok(isPackedInputs(p, perle.maxTicks));
    const rr = replay('perle', seed, d, p);
    assert.deepEqual(rr, r, `replay diverso seed ${seed}`);
    // stesso log, stato finale identico bit per bit
    const s2 = perle.create({ seed, difficulty: d });
    for (const f of log) perle.step(s2, f);
    assert.equal(hashJson(s2), hashJson(s));
  }
});

test('perle: chi non si tuffa non prende niente, chi tocca a caso prende qualcosa (medaglia bassa), chi tiene sempre premuto finisce lo stesso', () => {
  const fermo = gioca(5, 2, () => NO).r;
  assert.equal(fermo.score, 0); assert.equal(fermo.medal, null);
  const rng = createRng(3); let held = false;
  const caso = gioca(5, 2, (_, t) => { if (t % 30 === 0) held = rng.next() < 0.5; return { mx: 0, my: 0, a: held, b: false }; }).r;
  assert.ok(caso.score > 0 && caso.medal !== 'oro', `a caso: ${caso.medal} ${caso.score}`);
  const giu = gioca(5, 2, () => ({ mx: 0, my: 0, a: true, b: false }));
  assert.ok(giu.r.done && giu.r.detail['affanni']! > 0, 'sempre giù: deve restare senz\'aria almeno una volta');
  assert.ok(Number.isFinite(giu.s.y) && giu.s.y >= 0 && giu.s.aria >= 0 && giu.s.aria <= 1);
});

test('perle: input rotti (assi fuori scala, NaN, a che cambia ogni tick) non rompono la sim; log troppo lunghi rifiutati', () => {
  const s = perle.create({ seed: 8, difficulty: 2 });
  const rng = createRng(8);
  for (let t = 0; t < perle.maxTicks + 50; t++) {
    const f = { mx: rng.next() * 1e9 - 5e8, my: Number.NaN, a: rng.next() < 0.5, b: rng.next() < 0.5 };
    perle.step(s, f);
    assert.ok(Number.isFinite(s.y) && Number.isFinite(s.vy) && s.aria >= 0 && s.aria <= 1, `tick ${t}: ${JSON.stringify({ y: s.y, vy: s.vy, aria: s.aria })}`);
  }
  assert.equal(s.done, true); assert.equal(s.tick, perle.maxTicks, 'dopo la fine la sim sta ferma');
  const v = perle.view(s) as PerleView;
  assert.ok(v.done && v.ms === C.maxSeconds * 1000 && v.medals.oro > v.medals.argento && v.medals.argento > v.medals.bronzo);
  assert.equal(isPackedInputs([[perle.maxTicks + 1, 0, 0, 1, 0]], perle.maxTicks), false);
  assert.equal(isPackedInputs([[10, 0.5, 0, 1, 0]], perle.maxTicks), false);
  assert.equal(isPackedInputs('rotto', perle.maxTicks), false);
  assert.throws(() => replay('perle', 1, 2, [[perle.maxTicks + 1, 0, 0, 1, 0]]));
});

test('perle: si tuffa dalla barca ferma su acqua bassa, lontano dai moli; non su acqua profonda, non in corsa, non accanto al molo', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
  const porto = arch.places.find((p) => p.role === 'porto')!;
  const p = cercaPerle(arch, porto.boat.x, porto.boat.z);
  assert.ok(p, 'nessun punto da tuffo vicino al Porto');
  assert.equal(arch.map.at(Math.floor(p.x / arch.tile), Math.floor(p.z / arch.tile)), ',');
  assert.deepEqual(perleQui(arch, p.x, p.z, 0), { ok: true, perche: null });
  assert.equal(perleQui(arch, p.x, p.z, 3).perche, 'veloce');
  assert.equal(perleQui(arch, porto.boat.x, porto.boat.z, 0).ok, false, 'sulla barca ormeggiata (molo)');
  assert.equal(perleQui(arch, 2, 2, 0).perche, 'acqua', 'in mare aperto si pesca, non ci si tuffa');
});

test('perle: premio della medaglia da balance.solo, più le Perle extra dell\'oro (premioExtra); il libro mastro resta in pari', () => {
  const extra = C.premioExtra?.oro?.perle ?? 0;
  assert.ok(extra > 0, 'premioExtra.oro.perle');
  assert.deepEqual(soloPrize('oro', 'perle'), { ...BALANCE.solo.premi.oro, perle: BALANCE.solo.premi.oro.perle + extra });
  assert.deepEqual(soloPrize('argento', 'perle'), BALANCE.solo.premi.argento);
  assert.deepEqual(soloPrize('oro', 'regata'), BALANCE.solo.premi.oro);
  const T0 = 20_000 * 86_400_000 + 3_600_000, l0 = newLot('ada', T0);
  const out = finishSolo(startSolo(l0, 'perle', 7, T0), 'oro', T0 + 61_000);
  assert.deepEqual(out.premio, soloPrize('oro', 'perle'));
  assert.deepEqual(out.lot.resources, add(l0.resources, out.premio));
  assert.equal(checkInvariant([out.lot]), null);
});
