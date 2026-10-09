// Gran Premio (Isola delle Corse, docs/CORSE.md): pista chiusa e senza buchi, la guida scelta col primo tick, il pilota automatico che
// guida pulito (niente muro, drift e turbo) e vince con ogni guida, il pilota pigro che arriva ultimo, chi sta fermo senza medaglia, il
// muro che tiene in pista, il drift a mano col turbo a 2 livelli, determinismo del replay e fixture d'oro (seed + input → risultato e hash).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MINIGAMES_CFG } from '@marea/content';
import { corse, corseDove, corsePilota, corsePista, corsePunto, corseStartFrame } from '../src/minigames/corse.ts';
import type { CorseState, CorseView } from '../src/minigames/corse.ts';
import type { MinigameResult } from '../src/minigames/types.ts';
import { hashJson } from '../src/hash.ts';
import { packInputs, replay, quantize } from '../src/replay.ts';
import type { PackedInputs } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const CFG = MINIGAMES_CFG.corse;
function gara(seed: number, guida: number, pilota: 'buono' | 'pigro'): { s: CorseState; log: InputFrame[]; r: MinigameResult } {
  const s = corse.create({ seed, difficulty: 2 });
  const log: InputFrame[] = [quantize(corseStartFrame(guida))];
  corse.step(s, log[0]!);
  while (!s.done) { const f = quantize(corsePilota(s, pilota === 'pigro')); log.push(f); corse.step(s, f); }
  return { s, log, r: corse.result(s) };
}

test('corse: la pista è un anello chiuso, campionato fitto, con la carreggiata dentro i numeri di content', () => {
  const p = corsePista();
  assert.ok(p.n > 100 && p.len > 400 && p.len < 900, `giro ${p.len} m in ${p.n} campioni`);
  for (let i = 0; i < p.n; i++) {
    const j = (i + 1) % p.n, d = Math.hypot(p.x[j]! - p.x[i]!, p.z[j]! - p.z[i]!);
    assert.ok(d > 0.5 && d < CFG.pista.passo * 1.6, `salto di ${d} m al campione ${i}`);
  }
  // la pista non passa troppo vicina a sé stessa (due tratti lontani lungo il giro restano a più di due carreggiate + prato)
  const lim = 2 * (p.w + p.erba) + 2;
  for (let i = 0; i < p.n; i += 3) for (let j = 0; j < p.n; j += 3) {
    const lungo = Math.min(Math.abs(p.s[i]! - p.s[j]!), p.len - Math.abs(p.s[i]! - p.s[j]!));
    if (lungo < 60) continue;
    assert.ok(Math.hypot(p.x[i]! - p.x[j]!, p.z[i]! - p.z[j]!) > lim, `tratti ${i} e ${j} troppo vicini`);
  }
  // corsePunto e corseDove si capiscono: 30 m dopo il via, 2 m a destra
  const q = corsePunto(p, 30, 2), w = corseDove(p, q.x, q.z, q.i);
  assert.ok(Math.abs(w.along - 30) < 0.05 && Math.abs(w.lat - 2) < 0.05, JSON.stringify(w));
});

test('corse: la guida la sceglie il primo tick (e non si muove niente); poi si parte dalla griglia, tu ultimo', () => {
  for (let g = 0; g < CFG.guide.length; g++) {
    const s = corse.create({ seed: 3, difficulty: 2 });
    const k0 = { ...s.karts[0]! };
    corse.step(s, quantize(corseStartFrame(g)));
    assert.equal(s.guida, g);
    assert.equal(s.karts[0]!.x, k0.x); assert.equal(s.karts[0]!.v, 0);
  }
  const s = corse.create({ seed: 3, difficulty: 2 });
  assert.equal(s.karts.length, 1 + CFG.bot.bravura.length);
  assert.ok(s.karts.slice(1).every((b) => b.prog > s.karts[0]!.prog), 'tu parti dietro a tutti');
  assert.equal((corse.view(s) as CorseView).posizioni[0], s.karts.length);
});

test('corse: il pilota automatico guida pulito (mai il muro, drift e turbo) e vince con ogni guida; il pigro arriva ultimo', () => {
  for (const seed of [1, 7, 42]) for (let g = 0; g < CFG.guide.length; g++) {
    const s = corse.create({ seed, difficulty: 2 });
    corse.step(s, quantize(corseStartFrame(g)));
    let muro = 0, drift = 0, turbo = 0;
    while (!s.done) { corse.step(s, quantize(corsePilota(s))); const k = s.karts[0]!; if (k.muro) muro++; if (k.drift) drift++; if (k.turbo > 0) turbo++; }
    const r = corse.result(s);
    assert.equal(r.medal, 'oro', `seed ${seed} guida ${g}: ${JSON.stringify(r.detail)}`);
    assert.equal(r.detail['giri'], CFG.giri);
    assert.ok(r.detail['ms']! > 60_000 && r.detail['ms']! < 120_000, `gara di ${r.detail['ms']} ms`);
    assert.equal(muro, 0, `seed ${seed} guida ${g}: ${muro} tick contro il muro`);
    assert.ok(drift > 100 && turbo > 60, `seed ${seed} guida ${g}: drift ${drift}, turbo ${turbo}`);
  }
  for (const seed of [1, 7]) {
    const { r } = gara(seed, 1, 'pigro');
    assert.equal(r.detail['pos'], 5, `pigro seed ${seed}: ${JSON.stringify(r.detail)}`);
    assert.equal(r.medal, null);
  }
});

test('corse: chi sta fermo non finisce (niente medaglia, punteggio sotto chi arriva); il muro tiene in pista', () => {
  const s = corse.create({ seed: 9, difficulty: 2 });
  corse.step(s, quantize(corseStartFrame(1)));
  while (!s.done) corse.step(s, { mx: 0, my: 0, a: false, b: false });
  const r = corse.result(s);
  assert.equal(r.medal, null); assert.ok(s.timeUp && r.score < 1000, JSON.stringify(r));
  // tutto sterzo a destra a tutto gas: si gira in tondo contro il muro ma non si esce mai
  const t = corse.create({ seed: 9, difficulty: 2 });
  corse.step(t, quantize(corseStartFrame(2)));
  const p = corsePista();
  for (let i = 0; i < 1200; i++) { corse.step(t, { mx: 1, my: 1, a: false, b: false }); assert.ok(Math.abs(t.karts[0]!.lat) <= p.w + p.erba + 0.01, `fuori: ${t.karts[0]!.lat}`); }
});

test('corse: drift a mano — col bottone in curva parte, la carica dà il turbo di livello 1 o 2, lasciando parte la spinta', () => {
  const s = corse.create({ seed: 11, difficulty: 2 });
  corse.step(s, quantize(corseStartFrame(1)));
  while (s.karts[0]!.v < 15) corse.step(s, { mx: 0, my: 1, a: false, b: false });
  const k = s.karts[0]!;
  corse.step(s, { mx: -1, my: 1, a: true, b: false });
  assert.equal(k.drift, -1, 'drift a sinistra');
  for (let i = 0; i < Math.ceil(CFG.drift.carica[1] * 60) + 2; i++) corse.step(s, { mx: 0, my: 1, a: true, b: false });
  corse.step(s, { mx: 0, my: 1, a: false, b: false });
  assert.equal(k.drift, 0); assert.equal(k.livello, 2); assert.ok(k.turbo > CFG.drift.spinta[0], `turbo ${k.turbo}`);
  // drift da solo: sterzo tutto da una parte per autoSecondi
  const u = corse.create({ seed: 11, difficulty: 2 });
  corse.step(u, quantize(corseStartFrame(1)));
  while (u.karts[0]!.v < 15) corse.step(u, { mx: 0, my: 1, a: false, b: false });
  for (let i = 0; i < Math.ceil(CFG.drift.autoSecondi * 60) + 2; i++) corse.step(u, { mx: 1, my: 1, a: false, b: false });
  assert.equal(u.karts[0]!.drift, 1, 'drift da solo a destra');
});

test('corse: replay deterministico (stesso seed e input → stesso risultato)', () => {
  const { log, r } = gara(123, 2, 'buono');
  assert.deepEqual(replay('corse', 123, 2, packInputs(log)), r);
});

test('corse: fixture d’oro v1 (seed + input → risultato e hash dei kart)', () => {
  type Case = { seed: number; guida: number; pilot: string; inputs: PackedInputs; result: MinigameResult; kartHash: number };
  const fx = JSON.parse(readFileSync(new URL('./fixtures/corse_v1.json', import.meta.url), 'utf8')) as { version: number; cases: Case[] };
  assert.equal(fx.version, corse.version, 'fixture di un’altra versione delle corse');
  for (const c of fx.cases) {
    assert.deepEqual(replay('corse', c.seed, 2, c.inputs), c.result, `seed ${c.seed}`);
    const s = corse.create({ seed: c.seed, difficulty: 2 });
    for (const [n, mx, my, a, b] of c.inputs) for (let i = 0; i < n; i++) corse.step(s, { mx: mx / 32, my: my / 32, a: a === 1, b: b === 1 });
    assert.equal(hashJson(s.karts), c.kartHash, `hash kart seed ${c.seed}`);
    const again = gara(c.seed, c.guida, c.pilot === 'pigro' ? 'pigro' : 'buono');
    assert.equal(JSON.stringify(packInputs(again.log)), JSON.stringify(c.inputs), `input del pilota cambiati, seed ${c.seed}`);
  }
});
