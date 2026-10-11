// Piste ibride (#228, docs/CORSE.md A11 «Binari»): la Miniera del tempio. Si corre col proprio veicolo a ruote e solo nella miniera ci si
// aggancia alle rotaie. Cosa si controlla:
// - fuori dalla miniera si guida a ruote, dentro si sta su una rotaia, all'uscita ci si sgancia;
// - il pilota automatico arriva senza cadute con ogni veicolo a ruote;
// - la scorciatoia del tunnel (rotaia rotta da saltare) vale ~1-1,3 s a giro, ben visibile;
// - si cade solo dove manca la rotaia: chi tiene solo il gas nella miniera (non si piega, non salta, non cambia rotaia) cade nei buchi,
//   ma arriva lo stesso, molto dopo;
// - coi bot: uno sì e uno no prendono il tunnel; deterministico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { garaCorse, pilotaGara } from '../src/corse/gara.ts';
import type { GaraState } from '../src/corse/gara.ts';
import { pistaCorse, rotaieDi, suBinari } from '../src/corse/pista.ts';
import { hashJson } from '../src/hash.ts';
import { quantize } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const PISTA = 'giungla_miniera';
const nuova = (veicolo = 'kart', bot = false, seed = 7): GaraState =>
  garaCorse.create({ seed, difficulty: 2, opzioni: { pista: PISTA, veicolo, bot: bot ? '1' : '0' } });
function corri(s: GaraState, pilota: (s: GaraState) => InputFrame) {
  const p = pistaCorse(PISTA);
  let tunnel = 0, fuoriRotaia = 0, agganciatoFuori = 0;
  const bot = new Set<number>();
  while (!s.done) {
    garaCorse.step(s, quantize(pilota(s)));
    const k = s.veicoli[0]!;
    if (k.ramo >= 0) tunnel++;
    const su = suBinari(p, k.ramo, k.s, 'ruote');
    if (k.agg !== su && !k.caduto) agganciatoFuori++;
    if (k.agg && !k.aria && !k.caduto && !rotaieDi(p, k.ramo).some((x) => Math.abs(x - k.lat) < 0.05)) fuoriRotaia++;
    s.veicoli.forEach((b, i) => { if (i > 0 && b.ramo >= 0) bot.add(i); });
  }
  return { r: garaCorse.result(s), k: s.veicoli[0]!, ms: Number(garaCorse.result(s).detail['ms']), tunnel, fuoriRotaia, agganciatoFuori, bot };
}

test('ibride: la Miniera è a ruote, con la miniera agganciata (3 rotaie) e il tunnel a binari', () => {
  const p = pistaCorse(PISTA);
  assert.equal(p.def.famiglia, 'ruote');
  assert.equal(p.def.agganci?.length, 1);
  assert.deepEqual(p.def.binari, [-2.6, 0, 2.6]);
  assert.deepEqual(rotaieDi(p, 0), [0]);
  const a = p.def.agganci![0]!, lungo = a.a - a.da;
  assert.ok(lungo > 150 && lungo < p.n.len / 2, `miniera di ${Math.round(lungo)} m su ${Math.round(p.n.len)}`);
  assert.ok(p.rami[0]!.def.da > a.da && p.rami[0]!.def.a < a.a, 'il bivio sta dentro la miniera');
});

test('ibride: il pilota automatico arriva senza cadute; agganciato solo nella miniera e sempre sopra una rotaia', () => {
  for (const v of ['kart', 'auto', 'carrello']) {
    const o = corri(nuova(v), (s) => pilotaGara(s));
    assert.ok(o.k.fine > 0 && o.r.detail['giri'] === 2, `${v} arriva`);
    assert.equal(o.k.cadute, 0, `${v} senza cadute`);
    assert.ok(o.agganciatoFuori <= 4, `${v}: agganciato giusto (al più un tick di ritardo all'entrata e all'uscita: ${o.agganciatoFuori})`);
    assert.ok(o.fuoriRotaia < 30, `${v}: a terra fuori rotaia per ${o.fuoriRotaia} tick (solo gli scambi dopo il bivio)`);
    assert.ok(o.tunnel > 120, `${v} prende il tunnel`);
    assert.ok(o.ms > 60000 && o.ms < 90000, `${v} ${o.ms} ms`);
  }
});

test('ibride: il tunnel vale 1-2 s a giro', () => {
  for (const v of ['kart', 'auto']) {
    const osa = corri(nuova(v), (s) => pilotaGara(s, false, true)), sicuro = corri(nuova(v), (s) => pilotaGara(s, false, false));
    assert.equal(sicuro.tunnel, 0, `${v}: chi non osa resta sul giro largo`);
    assert.equal(sicuro.k.cadute, 0);
    const aGiro = (sicuro.ms - osa.ms) / 2;
    assert.ok(aGiro > 900 && aGiro < 2500, `${v}: il tunnel vale ${aGiro} ms a giro`);
  }
});

test('ibride: chi nella miniera tiene solo il gas cade nei buchi (rotaia rotta, tunnel) ma arriva, molto dopo', () => {
  const bravo = corri(nuova(), (s) => pilotaGara(s, false, false));
  const gas = corri(nuova(), (s) => (s.veicoli[0]!.agg ? { mx: 0, my: 1, a: false, b: false } : pilotaGara(s)));
  assert.ok(gas.k.fine > 0, 'arriva');
  assert.ok(gas.k.cadute >= 4, `cadute ${gas.k.cadute}`);
  assert.ok(gas.ms > bravo.ms + 2000 * gas.k.cadute, `gas ${gas.ms} ms contro ${bravo.ms}: ogni caduta costa più di 2 s`);
});

test('ibride: coi bot si arriva, i bot stanno vicini e uno sì e uno no prendono il tunnel', () => {
  const s = nuova('kart', true), o = corri(s, (x) => pilotaGara(x));
  assert.ok(o.k.fine > 0);
  assert.ok(o.bot.has(1) && o.bot.has(3) && !o.bot.has(2) && !o.bot.has(4), `bot nel tunnel: ${[...o.bot]}`);
  const dietro = s.veicoli.slice(1).map((b) => o.k.prog - b.prog);
  assert.ok(Math.min(...dietro) < 150, `il bot più vicino a ${Math.round(Math.min(...dietro))} m (sul Lungomare ~200)`);
});

test('ibride: deterministico', () => {
  const a = nuova('auto', true, 11), b = nuova('auto', true, 11);
  for (let i = 0; i < 60 * 40; i++) {
    const f = quantize(pilotaGara(a));
    garaCorse.step(a, f); garaCorse.step(b, f);
  }
  assert.equal(hashJson(a.veicoli), hashJson(b.veicoli));
});
