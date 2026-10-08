// Pesca dalla barca (#66): l'autopilota fa sempre oro, il replay del server dà lo stesso risultato, input rotti o a raffica non pagano,
// il mare cambia i pesci (non il premio), il bottone PESCA compare solo in acqua profonda lontano dalla riva e a barca ferma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { MARI, PESCI, RARITA, cercaPesca, cursorePesca, mareDi, marePesca, pesca, pescaQui } from '../src/minigames/pesca.ts';
import type { PescaState } from '../src/minigames/pesca.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import type { Difficulty, MinigameResult } from '../src/minigames/types.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';
import { createRng } from '../src/rng.ts';
import { isPackedInputs, packInputs, quantize, replay } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const CFG = MINIGAMES_CFG.pesca;
function gioca(seed: number, difficulty: Difficulty, mare: string, pilota: (s: PescaState, i: number) => InputFrame = (s) => pesca.autopilot(s, createRng(seed))): { s: PescaState; log: InputFrame[]; r: MinigameResult } {
  const s = pesca.create({ seed, difficulty, opzioni: { mare } });
  const log: InputFrame[] = [];
  for (let i = 0; !s.done; i++) { const f = quantize(pilota(s, i)); log.push(f); pesca.step(s, f); }
  return { s, log, r: pesca.result(s) };
}

test('pesca: registrata, 60 s, contenuti coerenti (8-12 pesci, ogni mare ha almeno un pesce per rarità, colori della palette)', () => {
  assert.equal(getMinigame('pesca'), pesca);
  assert.equal(pesca.maxTicks, CFG.maxSeconds * 60);
  assert.ok(PESCI.length >= 8 && PESCI.length <= 12, `${PESCI.length} pesci`);
  assert.equal(new Set(PESCI.map((p) => p.id)).size, PESCI.length, 'id doppi');
  const PAL = ['sabbiaChiara', 'sabbia', 'legnoChiaro', 'legno', 'legnoScuro', 'ombraCalda', 'erbaChiara', 'erba', 'erbaScura', 'bosco', 'acquaBassa', 'acqua', 'acquaProfonda', 'abisso', 'pietraChiara', 'pietra', 'pietraScura', 'roccia', 'neroCaldo', 'rosso', 'arancio', 'giallo', 'viola', 'rosaNeon'];
  for (const p of PESCI) for (const c of p.colori) assert.ok(PAL.includes(c), `${p.id}: colore ${c} fuori palette`);
  assert.ok(MARI.includes(CFG.mareDiSerie));
  for (const m of MARI) {
    for (const id of CFG.mari[m]!.pesci) assert.ok(PESCI.some((p) => p.id === id), `${m}: pesce sconosciuto ${id}`);
    for (const r of RARITA) assert.ok(CFG.mari[m]!.pesci.some((id) => PESCI.find((p) => p.id === id)!.rarita === r), `${m}: manca un pesce ${r}`);
    for (const isl of CFG.mari[m]!.isole) assert.ok(ISLANDS.some((i) => i.id === isl), `${m}: isola sconosciuta ${isl}`);
  }
});

test('pesca: il pilota di riferimento fa oro in ogni mare e difficoltà (200 seed)', () => {
  for (const mare of MARI)
    for (const d of [1, 2, 3] as Difficulty[])
      for (let seed = 1; seed <= 200; seed++) {
        const { r, s } = gioca(seed * 7919 + d, d, mare);
        assert.equal(r.done, true);
        assert.equal(r.medal, 'oro', `${mare} d${d} seed ${seed}: ${r.score} punti`);
        assert.ok(s.presi.every((id) => CFG.mari[mare]!.pesci.includes(id)), `${mare}: pesce di un altro mare`);
      }
});

test('pesca: replay identico (pack → replay del server con il mare) e stesso seed = stessa partita', () => {
  for (const mare of MARI) {
    const a = gioca(424242, 2, mare), b = gioca(424242, 2, mare);
    assert.deepEqual(a.r, b.r);
    const packed = packInputs(a.log);
    assert.ok(isPackedInputs(packed, pesca.maxTicks));
    assert.deepEqual(replay('pesca', 424242, 2, packed, { mare }), a.r);
  }
  // senza opzioni = mare di serie
  const largo = gioca(7, 2, CFG.mareDiSerie);
  assert.deepEqual(replay('pesca', 7, 2, packInputs(largo.log)), largo.r);
});

test('pesca: il mare cambia i pesci; opzioni normalizzate (mare sconosciuto → di serie)', () => {
  const p = pesca.create({ seed: 99, difficulty: 2, opzioni: { mare: 'porto' } }), l = pesca.create({ seed: 99, difficulty: 2, opzioni: { mare: 'laguna' } });
  assert.notDeepEqual(p.lanci.map((x) => x.pesce), l.lanci.map((x) => x.pesce));
  assert.deepEqual(pesca.opzioni!({ mare: 'porto' }), { mare: 'porto' });
  assert.deepEqual(pesca.opzioni!({ mare: 'atlantide' }), { mare: CFG.mareDiSerie });
  assert.deepEqual(pesca.opzioni!('rotto'), { mare: CFG.mareDiSerie });
  assert.equal(marePesca(42), CFG.mareDiSerie);
  // rarità: stessi pesi e punti in ogni mare → dichiarare un altro mare non cambia il premio atteso
  for (const r of RARITA) assert.ok(CFG.rarita[r].punti > 0 && CFG.rarita[r].peso > 0);
});

test('pesca: tocchi a raffica (troppo presto) o nessun tocco = niente medaglia; input fuori forma rifiutati', () => {
  const raffica = gioca(5, 2, 'largo', (_s, i) => ({ mx: 0, my: 0, a: i % 2 === 0, b: false }));
  assert.equal(raffica.r.medal, null, `raffica: ${raffica.r.score} punti`);
  assert.ok(raffica.r.score <= 1);
  const fermo = gioca(5, 2, 'largo', () => ({ mx: 0, my: 0, a: false, b: false }));
  assert.equal(fermo.r.score, 0);
  assert.equal(fermo.r.medal, null);
  assert.equal(isPackedInputs('rotto', pesca.maxTicks), false);
  assert.equal(isPackedInputs([[pesca.maxTicks + 1, 0, 0, 0, 0]], pesca.maxTicks), false);
  assert.equal(isPackedInputs([[10, 0, 0, 2, 0]], pesca.maxTicks), false);
  assert.throws(() => replay('pesca', 1, 2, [[pesca.maxTicks, 0, 0, 0, 0], [1, 0, 0, 1, 0]]));
});

test('pesca: tirare durante l\'attesa spaventa il pesce; tardi = scappa; nel recupero gli strappi lo perdono', () => {
  const s = pesca.create({ seed: 3, difficulty: 2 });
  const tap = { mx: 0, my: 0, a: true, b: false }, no = { mx: 0, my: 0, a: false, b: false };
  pesca.step(s, tap); assert.equal(s.fase, 'lancio');
  pesca.step(s, no);
  while (s.fase === 'lancio') pesca.step(s, no);
  assert.equal(s.fase, 'attesa');
  pesca.step(s, tap); assert.equal(s.fase, 'presto');
  while (s.fase !== 'pronto') pesca.step(s, no);
  pesca.step(s, tap); pesca.step(s, no);
  while (s.fase !== 'abbocca') pesca.step(s, no);
  while (s.fase === 'abbocca') pesca.step(s, no);
  assert.equal(s.fase, 'scappato'); assert.equal(s.perche, 'lento');
  while (s.fase !== 'pronto') pesca.step(s, no);
  pesca.step(s, tap); pesca.step(s, no);
  while (s.fase !== 'abbocca') pesca.step(s, no);
  pesca.step(s, tap); assert.equal(s.fase, 'recupero');
  // tocchi sempre fuori zona: dopo `strappi` + 1 scappa
  let n = 0;
  while (s.fase === 'recupero' && n < 400) {
    const l = s.lanci[s.n]!, c = l.centri[s.colpi]!, w = CFG.rarita[l.rarita].zona;
    const fuori = Math.abs(cursorePesca(l.rarita, s.tick + 1 - s.faseTick) - c) > w / 2 + 20;
    pesca.step(s, s.prevA || !fuori ? no : tap); n++;
  }
  assert.equal(s.fase, 'scappato'); assert.equal(s.perche, 'strappi');
  assert.equal(s.punti, 0);
});

test('pesca: la barra va avanti e indietro tra 0 e 1000', () => {
  for (const r of RARITA) {
    let lo = 1e9, hi = -1;
    for (let t = 0; t < 600; t++) { const v = cursorePesca(r, t); lo = Math.min(lo, v); hi = Math.max(hi, v); assert.ok(v >= 0 && v <= 1000); }
    assert.ok(lo <= 30 && hi >= 970, `${r}: ${lo}..${hi}`);
  }
});

test('pesca: si pesca solo in acqua profonda lontano dalla riva e a barca ferma; il mare viene dall\'isola vicina', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
  const porto = arch.places.find((p) => p.role === 'porto')!;
  assert.equal(pescaQui(arch, porto.spawn.x, porto.spawn.z, 0).perche, 'terra');
  assert.notEqual(pescaQui(arch, porto.boat.x, porto.boat.z, 0).ok, true, 'al molo non si pesca');
  for (const mare of MARI) {
    const p = cercaPesca(arch, mare, porto.spawn.x, porto.spawn.z);
    assert.ok(p, `nessun punto da pesca nel mare ${mare}`);
    const q = pescaQui(arch, p.x, p.z, 0);
    assert.deepEqual(q, { ok: true, mare, perche: null });
    assert.equal(pescaQui(arch, p.x, p.z, 3).perche, 'veloce');
    assert.equal(mareDi(arch, p.x, p.z), mare);
  }
  // in mezzo al nulla (angolo della mappa) è mare aperto
  assert.equal(mareDi(arch, 4, arch.map.h * arch.tile - 4), CFG.mareDiSerie);
});
