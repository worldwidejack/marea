// Guida sui binari (#228, docs/CORSE.md A6): i carrelli da miniera sulla pista di prova dei carrelli (tutta a binari). Cosa si controlla:
// - si parte e si resta sopra una rotaia;
// - il salto (DRIFT) con lo sterzo porta sulla rotaia accanto; senza sterzo si ricade sulla stessa;
// - in curva non si cade (Jack, 11 ott): chi entra lanciato senza piegarsi va su due ruote e rallenta, chi si piega esce più veloce
//   (e piegati al limite si carica il turbo); si cade solo dove manca la rotaia;
// - il pilota automatico prende il tunnel (bivio), salta la rotaia rotta, arriva senza cadute e batte chi non frena mai;
// - chi tiene sempre il gas arriva lo stesso (le cadute non lo bloccano: si riparte su una rotaia senza buchi);
// - deterministico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORSE } from '@marea/content/corse.ts';
import { garaCorse, pilotaGara } from '../src/corse/gara.ts';
import type { GaraState } from '../src/corse/gara.ts';
import { campo } from '../src/corse/nastro.ts';
import { pistaCorse, rotaieDi } from '../src/corse/pista.ts';
import { hashJson } from '../src/hash.ts';
import { quantize } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const PISTA = 'prova_binari';
const nuova = (veicolo = 'carrello_miniera', bot = false, seed = 7): GaraState =>
  garaCorse.create({ seed, difficulty: 2, opzioni: { pista: PISTA, veicolo, bot: bot ? '1' : '0' } });
const via = (s: GaraState) => { while (s.tick < 1) garaCorse.step(s, { mx: 0, my: 0, a: false, b: false }); return s; };
const sullaRotaia = (s: GaraState) => { const k = s.veicoli[0]!, r = rotaieDi(pistaCorse(PISTA), k.ramo); return r.some((x) => Math.abs(x - k.lat) < 0.05); };
function corri(s: GaraState, pilota: (s: GaraState) => InputFrame) {
  let ramo = 0, fuori = 0;
  while (!s.done) {
    garaCorse.step(s, quantize(pilota(s)));
    const k = s.veicoli[0]!;
    if (k.ramo >= 0) ramo++;
    if (!k.aria && !k.caduto && !sullaRotaia(s)) fuori++;
  }
  return { r: garaCorse.result(s), ramo, fuori, k: s.veicoli[0]! };
}

test('binari: tre carrelli della famiglia, la pista ha tre rotaie e il bivio del tunnel su una rotaia sola', () => {
  assert.deepEqual(CORSE.veicoli.filter((v) => v.famiglia === 'binari').map((v) => v.id), ['carrello_miniera', 'carrello_corsa', 'carrello_corazzato']);
  const p = pistaCorse(PISTA);
  assert.deepEqual(p.def.binari, [-2.6, 0, 2.6]);
  assert.equal(p.rami.length, 1);
  assert.deepEqual(rotaieDi(p, 0), [0]);
});

test('binari: si parte sopra una rotaia; il salto con lo sterzo porta sulla rotaia accanto, senza sterzo si ricade sulla stessa', () => {
  const s = via(nuova()), k = s.veicoli[0]!, rot = rotaieDi(pistaCorse(PISTA), -1);
  assert.ok(sullaRotaia(s));
  for (let i = 0; i < 60; i++) garaCorse.step(s, { mx: 0, my: 1, a: false, b: false }); // un secondo di leva sul rettilineo del via
  const da = k.rot;
  assert.ok(da >= 0 && da < rot.length - 1, `parte dalla rotaia ${da}`);
  garaCorse.step(s, { mx: 1, my: 1, a: true, b: false });
  assert.ok(k.aria, 'salta');
  while (k.aria) garaCorse.step(s, { mx: 1, my: 1, a: false, b: false });
  assert.equal(k.caduto, 0);
  assert.equal(k.rot, da + 1);
  assert.ok(Math.abs(k.lat - rot[da + 1]!) < 0.05, `atterra a ${k.lat}`);
  garaCorse.step(s, { mx: 0, my: 1, a: true, b: false });
  while (k.aria) garaCorse.step(s, { mx: 0, my: 1, a: false, b: false });
  assert.equal(k.rot, da + 1, 'senza sterzo resta sulla stessa');
});

test('binari: nel tornante sopra la cascata chi arriva lanciato senza piegarsi non cade ma va su due ruote e rallenta; chi si piega arriva prima', () => {
  const p = pistaCorse(PISTA);
  // il tornante: la curva più stretta dei primi 200 m
  let sT = 0, kT = 0;
  for (let s = 0; s < 200; s++) { const k = Math.abs(campo(p.n, p.n.k, s)); if (k > kT) { kT = k; sT = s; } }
  const prova = (pilota: (s: GaraState) => InputFrame) => {
    const s = via(nuova()), k = s.veicoli[0]!;
    let vmin = 99;
    while (k.prog < sT + 30 && !k.caduto && s.tick < 3000) { garaCorse.step(s, pilota(s)); if (k.prog > sT - 15) vmin = Math.min(vmin, k.v); }
    return { k, vmin, tick: s.tick };
  };
  const lanciato = prova(() => ({ mx: 0, my: 1, a: false, b: false }));
  assert.equal(lanciato.k.cadute, 0, 'in curva non si cade');
  const bravo = prova((s) => pilotaGara(s));
  assert.equal(bravo.k.cadute, 0, 'il pilota automatico passa');
  assert.ok(lanciato.vmin < bravo.vmin - 0.5, `su due ruote si rallenta: ${lanciato.vmin.toFixed(1)} contro ${bravo.vmin.toFixed(1)} m/s piegati`);
});

test('binari: piegati al limite in curva si carica il turbo (livelli come il drift) e parte uscendo', () => {
  const s = via(nuova());
  let carica = 0, turbo = 0;
  while (!s.done && s.tick < 60 * 40) {
    garaCorse.step(s, quantize(pilotaGara(s)));
    const k = s.veicoli[0]!;
    if (k.drift) carica = Math.max(carica, k.carica);
    if (k.turbo > 0 && k.livello >= 1) turbo++;
  }
  assert.ok(carica >= CORSE.drift.carica[0], `carica massima ${carica}`);
  assert.ok(turbo > 60, `tick col turbo ${turbo}`);
});

test('binari: il pilota automatico prende il tunnel, resta sulle rotaie, arriva senza cadute e batte chi tiene sempre il gas (che arriva lo stesso)', () => {
  const auto = corri(nuova(), (s) => pilotaGara(s));
  assert.ok(auto.r.detail['giri'] === 2 && auto.k.fine > 0, 'arriva');
  assert.equal(auto.k.cadute, 0);
  assert.ok(auto.ramo > 60, `nel tunnel per ${auto.ramo} tick`);
  assert.ok(auto.fuori <= 6, `a terra su una rotaia (a parte qualche tick dopo un atterraggio, mentre si accosta: ${auto.fuori})`);
  const ms = Number(auto.r.detail['ms']);
  assert.ok(ms > 70000 && ms < 95000, `pilota automatico ${ms} ms`);
  const gas = corri(nuova(), () => ({ mx: 0, my: 1, a: false, b: false }));
  assert.ok(gas.k.fine > 0, 'chi tiene il gas arriva');
  assert.ok(gas.k.cadute >= 1, 'ma cade (la rotaia rotta, il tornante)');
  assert.ok(Number(gas.r.detail['ms']) > ms + 8000, `gas ${gas.r.detail['ms']} ms contro ${ms}`);
});

test('binari: coi bot si arriva e i bot stanno vicini; ogni carrello arriva', () => {
  for (const v of ['carrello_miniera', 'carrello_corsa', 'carrello_corazzato']) {
    const s = nuova(v, true), out = corri(s, (x) => pilotaGara(x));
    assert.ok(out.k.fine > 0, `${v} arriva`);
    const dietro = s.veicoli.slice(1).map((b) => out.k.prog - b.prog);
    assert.ok(Math.min(...dietro) < 120, `${v}: il bot più vicino a ${Math.round(Math.min(...dietro))} m`);
  }
});

test('binari: deterministico (stessi input → stessi veicoli)', () => {
  const a = nuova('carrello_corsa', true, 11), b = nuova('carrello_corsa', true, 11);
  for (let i = 0; i < 60 * 30; i++) {
    const f = quantize(pilotaGara(a));
    garaCorse.step(a, f); garaCorse.step(b, f);
  }
  assert.equal(hashJson(a.veicoli), hashJson(b.veicoli));
});
