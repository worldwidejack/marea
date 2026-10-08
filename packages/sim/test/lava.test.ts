// Fuga dalla lava (Isola Vulcano): percorso dal seed (colonne, rocce che affondano, geyser, premi), il pilota di riferimento fa oro su molti
// seed, il replay è identico, gli input rotti non rompono niente, salto corto e lungo, la lava scotta, il posto sull'isola e il premio extra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, BALANCE, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { LAVA_X0, LAVA_Y, cimaAt, colonnaSotto, getto, lava } from '../src/minigames/lava.ts';
import type { LavaState, LavaView } from '../src/minigames/lava.ts';
import type { Difficulty, MinigameResult } from '../src/minigames/types.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import { isPackedInputs, packInputs, quantize, replay } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';
import { soloPrize } from '../src/economy/rewards.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';

const C = MINIGAMES_CFG.lava;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

function gioca(seed: number, difficulty: Difficulty, pilota: (s: LavaState, t: number) => InputFrame): { s: LavaState; log: InputFrame[]; r: MinigameResult } {
  const s = lava.create({ seed, difficulty });
  const log: InputFrame[] = [];
  for (let t = 0; !s.done; t++) { const f = quantize(pilota(s, t)); log.push(f); lava.step(s, f); }
  return { s, log, r: lava.result(s) };
}
const auto = (s: LavaState) => lava.autopilot(s, createRng(1));

test('lava: registrato, 60 s a 60 Hz, stesso seed = stesso percorso, seed diverso = percorso diverso', () => {
  assert.equal(getMinigame('lava'), lava);
  assert.equal(lava.maxTicks, C.maxSeconds * 60);
  const a = lava.create({ seed: 42, difficulty: 2 }), b = lava.create({ seed: 42, difficulty: 2 }), c = lava.create({ seed: 43, difficulty: 2 });
  assert.equal(hashJson(a), hashJson(b));
  assert.notEqual(hashJson(a.colonne), hashJson(c.colonne));
  assert.equal(a.x, LAVA_X0);
  assert.equal(a.terra, 0, 'si parte coi piedi sulla prima colonna');
});

test('lava: colonne ordinate e separate fino in fondo, rocce che affondano, geyser, premi di tutti i tipi sopra la lava', () => {
  for (const seed of [1, 2, 3, 99, 123456]) {
    const s = lava.create({ seed, difficulty: 2 });
    const fine = LAVA_X0 + C.velocita * lava.maxTicks;
    assert.ok(s.colonne.at(-1)!.x1 > fine + 100, 'il percorso arriva oltre il traguardo');
    for (let i = 1; i < s.colonne.length; i++) {
      const a = s.colonne[i - 1]!, b = s.colonne[i]!;
      assert.ok(b.x0 - a.x1 >= 10 && b.x0 - a.x1 <= 40, `seed ${seed}: buco di ${b.x0 - a.x1} px a x=${a.x1}`);
      assert.ok(b.top >= C.scena.alto && b.top <= C.scena.basso);
    }
    assert.ok(s.colonne.some((c) => c.k === 'affonda') && s.geyser.length >= 3, `seed ${seed}: affonda/geyser`);
    const n = (k: string) => s.items.filter((i) => i.k === k).length;
    assert.ok(n('ossidiana') >= 60 && n('scintilla') >= 8 && n('rubino') >= 1, `seed ${seed}: premi ${n('ossidiana')} ${n('scintilla')} ${n('rubino')}`);
    for (const it of s.items) assert.ok(it.y < LAVA_Y - 4 && it.x < fine, `seed ${seed}: ${it.k} a ${it.x},${it.y}`);
    assert.equal(s.totale, s.items.reduce((t, i) => t + C.punti[i.k], 0));
  }
});

test('lava: salto corto e salto lungo (tenendo premuto si va più in alto e più lontano); la roccia crepata affonda dopo il primo passo', () => {
  const alto = (hold: number) => {
    const s = lava.create({ seed: 1, difficulty: 2 });
    let minY = s.y;
    for (let t = 0; t < 70; t++) { lava.step(s, { mx: 0, my: 0, a: t < hold, b: false }); minY = Math.min(minY, s.y); }
    return 92 - minY;
  };
  const corto = alto(1), lungo = alto(30);
  assert.ok(corto > 20 && corto < 32 && lungo > corto + 12, `salti: corto ${corto} lungo ${lungo}`);
  const s = lava.create({ seed: 1, difficulty: 2 });
  const i = s.colonne.findIndex((c) => c.k === 'affonda');
  assert.equal(cimaAt(s.colonne[i]!, -1, 500), s.colonne[i]!.top, 'non toccata: ferma');
  assert.ok(cimaAt(s.colonne[i]!, 100, 200) > s.colonne[i]!.top + 20, 'toccata: scende');
  assert.equal(colonnaSotto(s.colonne, 10), 0);
  const g = s.geyser[0]!;
  const acceso = Array.from({ length: g.per }, (_, t) => getto(g, t) > 0).filter(Boolean).length;
  assert.equal(acceso, Math.round(C.geyser.attivoSecondi * 60));
});

test('lava: il pilota di riferimento fa oro su molti seed (difficoltà 1, 2, 3) quasi senza scottarsi; il replay dal log compresso è identico', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const d = ((seed % 3) + 1) as Difficulty;
    const { s, log, r } = gioca(seed * 7919, d, auto);
    assert.equal(r.done, true);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${r.score}/${s.totale} ${JSON.stringify(r.detail)}`);
    assert.ok(r.detail['scottature']! <= 3, `seed ${seed}: ${r.detail['scottature']} scottature`);
    if (seed <= 4) {
      const p = packInputs(log);
      assert.ok(isPackedInputs(p, lava.maxTicks));
      assert.deepEqual(replay('lava', seed * 7919, d, p), r, `replay diverso seed ${seed}`);
      const s2 = lava.create({ seed: seed * 7919, difficulty: d });
      for (const f of log) lava.step(s2, f);
      assert.equal(hashJson(s2), hashJson(s));
    }
  }
});

test('lava: chi non salta si scotta e non prende medaglia; chi tocca a caso non fa oro; chi tiene sempre premuto finisce lo stesso', () => {
  for (const seed of [5, 6, 7, 8, 9]) {
    const fermo = gioca(seed, 2, () => NO);
    assert.ok(fermo.r.detail['scottature']! > 10 && fermo.r.medal === null, `fermo seed ${seed}: ${fermo.r.medal} ${JSON.stringify(fermo.r.detail)}`);
  }
  const rng = createRng(3);
  const caso = gioca(5, 2, (_, t) => ({ mx: 0, my: 0, a: t % 20 < 4 && rng.next() < 0.5, b: false })).r;
  assert.ok(caso.medal !== 'oro', `a caso: ${caso.medal} ${caso.score}`);
  const sempre = gioca(5, 2, () => ({ mx: 0, my: 0, a: true, b: false }));
  assert.ok(sempre.r.done && Number.isFinite(sempre.s.y) && sempre.s.y < LAVA_Y);
});

test('lava: input rotti (assi fuori scala, NaN, a che cambia ogni tick) non rompono la sim; log troppo lunghi rifiutati', () => {
  const s = lava.create({ seed: 8, difficulty: 2 });
  const rng = createRng(8);
  for (let t = 0; t < lava.maxTicks + 50; t++) {
    lava.step(s, { mx: rng.next() * 1e9 - 5e8, my: Number.NaN, a: rng.next() < 0.5, b: rng.next() < 0.5 });
    assert.ok(Number.isFinite(s.y) && Number.isFinite(s.vy) && s.y < LAVA_Y && s.punti >= 0, `tick ${t}: ${s.y} ${s.vy}`);
  }
  assert.equal(s.done, true); assert.equal(s.tick, lava.maxTicks, 'dopo la fine la sim sta ferma');
  const v = lava.view(s) as LavaView;
  assert.ok(v.done && v.ms === C.maxSeconds * 1000 && v.medals.oro > v.medals.argento && v.medals.argento > v.medals.bronzo);
  assert.equal(isPackedInputs([[lava.maxTicks + 1, 0, 0, 1, 0]], lava.maxTicks), false);
  assert.throws(() => replay('lava', 1, 2, [[lava.maxTicks + 1, 0, 0, 1, 0]]));
});

test('lava: il posto sta sull\'Isola Vulcano, a piedi; l\'oro dà Pietra in più', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
  const p = arch.places.find((q) => q.island === C.isola);
  assert.ok(p?.tema, 'isola a tema');
  const [cx, cz] = C.posto;
  assert.ok(['.', 'g'].includes(arch.map.at(p.origin[0] + cx, p.origin[1] + cz)), 'cella camminabile');
  const extra = C.premioExtra?.oro?.pietra ?? 0;
  assert.ok(extra > 0);
  assert.deepEqual(soloPrize('oro', 'lava'), { ...BALANCE.solo.premi.oro, pietra: BALANCE.solo.premi.oro.pietra + extra });
});
