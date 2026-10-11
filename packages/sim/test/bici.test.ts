// La mountain bike della discesa (banco provadiscesa3d.html, #229; src/corse/bici.ts). Cosa si controlla:
// - il pilota automatico arriva in fondo al sentiero in 60-120 s (ADRENALINA §4) senza cadere, e salta tutte le rampe;
// - è deterministica: due discese con gli stessi comandi finiscono identiche;
// - in discesa senza pedalare si va (spinge la pendenza), il freno ferma, lo scatto dà la spinta e poi ricarica;
// - sterzo che dipende dalla velocità: forte la presa limita la svolta;
// - un sasso preso forte fa cadere, si perdono 2 s e si riparte da lì; piano ci si ferma contro;
// - il muro di traverso fa cadere, di striscio no.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BICI, SENTIERI } from '@marea/content/corse_discesa.ts';
import { TICK_HZ } from '../src/constants.ts';
import { campo } from '../src/corse/nastro.ts';
import { nuovaBici, pedala, pilotaBici, sentiero } from '../src/corse/bici.ts';
import type { Bici, Comandi } from '../src/corse/bici.ts';

const S = sentiero(SENTIERI.cresta_bosco!);
const NIENTE: Comandi = { sterzo: 0, gas: 0, freno: false, scatto: false };
const per = (b: Bici, sec: number, c: (b: Bici) => Comandi) => { for (let i = 0; i < sec * TICK_HZ && !b.fine; i++) pedala(S, b, c(b)); };

test('il pilota automatico arriva in 60-120 s senza cadere e salta le rampe', () => {
  const b = nuovaBici();
  per(b, 200, (x) => pilotaBici(S, x));
  assert.ok(b.fine > 0, 'arriva');
  const sec = b.fine / TICK_HZ;
  assert.ok(sec >= 60 && sec <= 120, `tempo ${sec.toFixed(1)} s`);
  assert.equal(b.cadute, 0);
  assert.ok(b.salti >= S.def.rampe.length, `salti ${b.salti}`);
});

test('deterministica: stessi comandi, stessa discesa', () => {
  const corri = () => { const b = nuovaBici(); per(b, 200, (x) => pilotaBici(S, x, 0.95)); return JSON.stringify(b); };
  assert.equal(corri(), corri());
});

test('la pendenza spinge, il freno ferma, lo scatto spinge e ricarica', () => {
  const b = nuovaBici(); b.s = 50;
  per(b, 3, () => NIENTE);
  assert.ok(b.v > 4, `senza pedalare in discesa si va (${b.v.toFixed(1)} m/s)`);
  per(b, 3, () => ({ ...NIENTE, freno: true }));
  assert.ok(b.v < 0.5, `il freno ferma (${b.v.toFixed(2)})`);
  const v0 = b.v;
  pedala(S, b, { ...NIENTE, scatto: true });
  assert.ok(b.v > v0 + BICI.scatto.spinta * 0.9, 'lo scatto spinge');
  const v1 = b.v;
  pedala(S, b, { ...NIENTE, scatto: true });
  assert.ok(b.v < v1 + 0.5, 'subito dopo ricarica');
});

test('sterzo che dipende dalla velocità: forte gira meno', () => {
  const svolta = (v: number) => { const b = nuovaBici(); b.s = 40; b.v = v; b.st = 1; pedala(S, b, { ...NIENTE, sterzo: 1 }); return b.w; };
  assert.ok(svolta(3) > 1, `piano gira stretto (${svolta(3).toFixed(2)} rad/s)`);
  assert.ok(svolta(15) < 0.7, `forte la presa limita (${svolta(15).toFixed(2)} rad/s)`);
});

test('sasso preso forte = caduta, 2 s persi, si riparte da lì; piano ci si ferma contro', () => {
  const o = S.def.ostacoli[0]!;
  const b = nuovaBici(); b.s = o.s - 3; b.lat = o.lat; b.v = 10;
  for (let i = 0; i < TICK_HZ && !b.cadute; i++) pedala(S, b, NIENTE);
  assert.equal(b.cadute, 1); assert.equal(b.perche, 'sasso');
  const dove = b.s, t0 = b.tick;
  while (b.caduto > 0) pedala(S, b, NIENTE);
  assert.ok(Math.abs((b.tick - t0) / TICK_HZ - BICI.caduta.secondi) < 0.05, 'due secondi');
  assert.ok(Math.abs(b.s - dove) < 0.5, 'riparte da lì');
  assert.ok(Math.abs(b.lat) <= campo(S.n, S.n.l, b.s) * 0.3 + 1e-9, 'verso il centro');
  const p = nuovaBici(); p.s = o.s - 1.5; p.lat = o.lat; p.v = 3;
  per(p, 1, () => ({ ...NIENTE, freno: true }));
  assert.equal(p.cadute, 0, 'piano non si cade');
  assert.ok(p.s < o.s, 'fermo prima del sasso');
});

test('il muro di traverso fa cadere, di striscio no', () => {
  const lim = campo(S.n, S.n.l, 60) + S.def.bordo;
  const a = nuovaBici(); a.s = 60; a.lat = lim - 0.3; a.v = 9; a.ang = 0.9;
  per(a, 0.5, () => NIENTE);
  assert.equal(a.perche, 'muro');
  const b = nuovaBici(); b.s = 60; b.lat = lim - 0.3; b.v = 9; b.ang = 0.12;
  per(b, 0.5, () => NIENTE);
  assert.equal(b.cadute, 0);
});
