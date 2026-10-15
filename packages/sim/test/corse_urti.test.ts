// Urti tra veicoli delle Corse (#255, Jack 12 ott 2026: «bisogna aggiungere le collisioni tra veicoli», scelta A = urti veri coi bot).
// Cosa si controlla: di fianco si rimbalza da parti opposte e la spinta si smorza; chi tampona rallenta e chi è tamponato accelera;
// il più pesante sposta di più; una gara intera coi bot ha urti ed è deterministica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { garaCorse, opzioniGara, pilotaGara } from '../src/corse/gara.ts';
import { pistaCorse } from '../src/corse/pista.ts';
import { nuovoVeicolo, urti } from '../src/corse/veicolo.ts';
import { hashJson } from '../src/hash.ts';

const p = pistaCorse('spiaggia_lungomare');
const coppia = (latA: number, latB: number, avanti = 0) => {
  const a = nuovoVeicolo(p, 'kart', 40, latA), b = nuovoVeicolo(p, 'kart', 40 + avanti, latB);
  b.s = a.s + avanti; // stesso nastro, avanti di `avanti` m
  return [a, b] as const;
};

test('urti (#255): di fianco si rimbalza da parti opposte, la spinta si smorza e conta un urto solo', () => {
  const [a, b] = coppia(0, 1.2);
  a.v = b.v = 15;
  urti(p, [a, b], [1, 1]);
  assert.ok(a.spinta < -2 && b.spinta > 2, `spinte ${a.spinta} ${b.spinta}`);
  assert.ok(a.botta > 0 && b.botta > 0 && a.urti === 1 && b.urti === 1);
  const s0 = b.spinta;
  for (let i = 0; i < 30; i++) urti(p, [a, b], [1, 1]);
  assert.ok(b.lat - a.lat > 2.5, `si allontanano: ${a.lat} ${b.lat}`);
  assert.ok(Math.abs(b.spinta) < Math.abs(s0) * 0.2, `la spinta si smorza: ${s0} → ${b.spinta}`);
  assert.equal(a.urti, 1, 'un urto solo finché si toccano');
});

test('urti (#255): chi tampona rallenta, chi è tamponato prende una spinta', () => {
  const [a, b] = coppia(0, 0, 1.6);
  a.v = 22; b.v = 12;
  urti(p, [a, b], [1, 1]);
  assert.ok(a.v < 20 && b.v > 14, `velocità ${a.v} ${b.v}`);
  assert.ok(a.v <= b.v + 1e-9, 'dopo l\'urto il tamponatore non è più veloce');
});

test('urti (#255): il più pesante sposta di più', () => {
  const [a, b] = coppia(0, 1.2);
  a.v = b.v = 15;
  urti(p, [a, b], [1.4, 0.6]); // a pesa più del doppio di b
  assert.ok(Math.abs(b.spinta) > Math.abs(a.spinta) * 1.5, `spinte ${a.spinta} ${b.spinta}`);
});

test('urti (#255): una gara coi bot ha urti ed è deterministica', () => {
  const corri = () => {
    const s = garaCorse.create({ seed: 5, difficulty: 2, opzioni: opzioniGara({ pista: 'spiaggia_lungomare', bot: '1' }) });
    while (!s.done) garaCorse.step(s, pilotaGara(s));
    return s;
  };
  const a = corri(), b = corri();
  assert.ok(a.veicoli.reduce((n, k) => n + k.urti, 0) > 0, 'nessun urto in tutta la gara');
  assert.equal(hashJson(garaCorse.result(a)), hashJson(garaCorse.result(b)));
});
