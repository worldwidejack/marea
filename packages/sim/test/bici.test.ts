// La mountain bike della discesa (banco provadiscesa3d.html, #229; src/corse/bici.ts). Cosa si controlla:
// - il pilota automatico arriva in fondo al sentiero in 80-140 s (~2 minuti, come la speciale vera) senza cadere, e salta tutte le rampe;
// - è deterministica: due discese con gli stessi comandi finiscono identiche;
// - in discesa senza pedalare si va (spinge la pendenza), il freno ferma, lo scatto dà la spinta e costa metà energia, che torna da sola;
// - il SALTO: tenuto e lasciato stacca e passa sopra un sasso preso in pieno; tenuto a lungo in piano è l'impennata; sulla rampa si
//   somma al volo;
// - il ruscello: il pilota lo salta; anche piano si passa (si casca in acqua e si esce); quasi fermi ci si pianta, e si riparte
//   sull'altra sponda;
// - le salite: senza pedalare ci si ferma, pedalando si sale e l'energia cala; a secco si sale lo stesso, piano;
// - la parabolica tiene di più della stessa curva piatta;
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
const NIENTE: Comandi = { sterzo: 0, gas: 0, freno: false, scatto: false, salto: false };
const per = (b: Bici, sec: number, c: (b: Bici) => Comandi) => { for (let i = 0; i < sec * TICK_HZ && !b.fine; i++) pedala(S, b, c(b)); };

test('il pilota automatico arriva in 80-140 s senza cadere e salta le rampe', () => {
  const b = nuovaBici();
  per(b, 200, (x) => pilotaBici(S, x));
  assert.ok(b.fine > 0, 'arriva');
  const sec = b.fine / TICK_HZ;
  assert.ok(sec >= 80 && sec <= 140, `tempo ${sec.toFixed(1)} s`);
  assert.equal(b.cadute, 0);
  assert.ok(b.salti >= S.def.rampe.length, `salti ${b.salti}`);
});

test('deterministica: stessi comandi, stessa discesa', () => {
  const corri = () => { const b = nuovaBici(); per(b, 200, (x) => pilotaBici(S, x, 0.95)); return JSON.stringify(b); };
  assert.equal(corri(), corri());
});

test("la pendenza spinge, il freno ferma, lo scatto spinge e costa metà dell'energia", () => {
  const b = nuovaBici(); b.s = 50;
  per(b, 3, () => NIENTE);
  assert.ok(b.v > 4, `senza pedalare in discesa si va (${b.v.toFixed(1)} m/s)`);
  per(b, 3, () => ({ ...NIENTE, freno: true }));
  assert.ok(b.v < 0.5, `il freno ferma (${b.v.toFixed(2)})`);
  const v0 = b.v;
  pedala(S, b, { ...NIENTE, scatto: true });
  assert.ok(b.v > v0 + BICI.scatto.spinta * 0.9, 'lo scatto spinge');
  assert.ok(Math.abs(b.energia - (1 - BICI.scatto.costo)) < 0.01, `costa metà (${b.energia.toFixed(2)})`);
  pedala(S, b, NIENTE); // si lascia il tasto
  pedala(S, b, { ...NIENTE, scatto: true }); // il secondo, con l'altra metà
  assert.ok(b.energia < 0.05, `due scatti la svuotano (${b.energia.toFixed(2)})`);
  pedala(S, b, NIENTE);
  const v1 = b.v;
  pedala(S, b, { ...NIENTE, scatto: true });
  assert.ok(b.v < v1 + 0.5, 'a secco non si scatta');
  per(b, 1, () => ({ ...NIENTE, freno: true }));
  per(b, 4, () => ({ ...NIENTE, freno: true }));
  assert.ok(b.energia >= BICI.scatto.energia, `non pedalando torna (${b.energia.toFixed(2)})`);
  const v2 = b.v;
  pedala(S, b, { ...NIENTE, scatto: true });
  assert.ok(b.v > v2 + BICI.scatto.spinta * 0.9, 'di nuovo carica: si scatta');
  const v3 = b.v;
  for (let i = 0; i < 30; i++) pedala(S, b, { ...NIENTE, scatto: true });
  assert.ok(b.v < v3 + 1, 'tenendo premuto non si scatta di nuovo');
});

/** L'inizio della salita più ripida del sentiero. */
function salita(): number {
  let best = 0, s0 = 0;
  for (let s = 0; s < S.n.len - 30; s += 1) { const p = campo(S.n, S.n.ty, s); if (p > best) { best = p; s0 = s; } }
  assert.ok(best > 0.1, `c'è una salita vera (${(best * 100).toFixed(0)} %)`);
  while (campo(S.n, S.n.ty, s0) > 0.02) s0--;
  return s0;
}

test('le salite: senza pedalare ci si ferma, pedalando si sale consumando energia; a secco piano, ma si sale', () => {
  const s0 = salita();
  // dal lato del sentiero senza sassi
  const sassi = S.def.ostacoli.filter((o) => o.s > s0 - 2 && o.s < s0 + 50), lat = sassi.some((o) => o.lat > 0) ? -0.6 : 0.6;
  assert.ok(!sassi.some((o) => Math.sign(o.lat) === Math.sign(lat)), 'un lato libero');
  const ferma = nuovaBici(); ferma.s = s0; ferma.lat = lat; ferma.v = 4;
  per(ferma, 6, () => NIENTE);
  assert.ok(ferma.v < 0.3, `senza pedalare ci si ferma (${ferma.v.toFixed(2)} m/s)`);
  const su = nuovaBici(); su.s = s0; su.lat = lat; su.v = 4;
  per(su, 6, () => ({ ...NIENTE, gas: 1 }));
  assert.ok(su.s > ferma.s + 10 && su.v > 1.5, `pedalando si sale (${(su.s - s0).toFixed(1)} m, ${su.v.toFixed(1)} m/s)`);
  assert.ok(su.energia < 0.4, `e l'energia cala (${su.energia.toFixed(2)})`);
  const secco = nuovaBici(); secco.s = s0 + 5; secco.lat = lat; secco.v = 0; secco.energia = 0;
  per(secco, 4, () => ({ ...NIENTE, gas: 1 }));
  assert.ok(secco.v > 0.5 && secco.v < su.v, `a secco si sale piano (${secco.v.toFixed(2)} m/s)`);
});

test('la parabolica tiene di più della stessa curva piatta', () => {
  let s = 0, banca = 0;
  for (let x = 0; x < S.n.len; x += 1) { const r = Math.abs(campo(S.n, S.n.ry, x)); if (r > banca) { banca = r; s = x; } }
  assert.ok(banca > 0.4, `c'è una parabolica (${banca.toFixed(2)})`);
  const verso = campo(S.n, S.n.k, s) >= 0 ? 1 : -1;
  const svolta = (piatta: boolean) => {
    const b = nuovaBici(); b.s = s; b.v = 12; b.st = verso;
    const ry = S.n.ry.slice();
    if (piatta) S.n.ry.fill(0);
    pedala(S, b, { ...NIENTE, sterzo: verso });
    S.n.ry.splice(0, ry.length, ...ry);
    return Math.abs(b.w);
  };
  assert.ok(svolta(false) > svolta(true) * 1.3, `in parabolica si gira di più (${svolta(false).toFixed(2)} contro ${svolta(true).toFixed(2)} rad/s)`);
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

test('la rampa: si sale sopra (a terra) e si stacca dal labbro, dalla sua altezza', () => {
  const r = S.def.rampe.find((x) => x.tipo === 'rampa')!;
  const b = nuovaBici(); b.s = r.s - r.alto * 3 - 4; b.v = 12;
  let hSulla = 0;
  while (!b.aria && b.s < r.s + 2) { pedala(S, b, NIENTE); if (b.s < r.s - 0.3) hSulla = Math.max(hSulla, b.h); }
  assert.ok(hSulla > r.alto * 0.8, `sulla rampa a terra, alta ${hSulla.toFixed(2)} m`);
  assert.ok(b.aria && Math.abs(b.s - r.s) < 0.5, `stacca al labbro (s ${(b.s - r.s).toFixed(2)} m dal labbro)`);
  assert.ok(b.h >= r.alto * 0.95 && b.vh > 4, `da lassù e verso l'alto (h ${b.h.toFixed(2)}, vh ${b.vh.toFixed(1)})`);
  assert.equal(b.cadute, 0);
});

test('i sassi si urtano con le ruote: a 0,25 m dal bordo del sasso si passa forte', () => {
  const o = S.def.ostacoli[0]!;
  const b = nuovaBici(); b.s = o.s - 4; b.v = 10;
  b.lat = o.lat + (o.lat > 0 ? -1 : 1) * (o.r * BICI.sasso.base + 0.25);
  for (let i = 0; i < TICK_HZ; i++) pedala(S, b, NIENTE);
  assert.equal(b.cadute, 0);
  assert.ok(b.s > o.s + 2, 'passato');
});

/** Un tratto dritto e senza sassi, rampe, tronchi e ruscelli nei 30 m dopo `da`. */
function libero(da: number): number {
  for (let s = da; s < S.n.len - 40; s += 2) {
    let ok = true;
    for (let x = s; x < s + 30 && ok; x += 1) if (Math.abs(campo(S.n, S.n.k, x)) > 0.01) ok = false;
    if (ok && !S.def.ostacoli.some((o) => o.s > s - 2 && o.s < s + 32) && !S.def.rampe.some((r) => r.s > s - 6 && r.s < s + 36)) return s;
  }
  throw new Error('nessun tratto libero');
}

test('il SALTO: tenuto carica, lasciato stacca e passa sopra un sasso preso in pieno; tenuto a lungo è l\'impennata', () => {
  const o = S.def.ostacoli[0]!;
  // in pieno contro il sasso a 7 m/s: senza saltare si cade
  const a = nuovaBici(); a.s = o.s - 6; a.lat = o.lat; a.v = 7;
  per(a, 1.5, () => NIENTE);
  assert.equal(a.perche, 'sasso', 'senza salto contro il sasso');
  // tenendo il salto e lasciandolo 2 m prima (la ruota davanti tocca a ~1 m): si passa sopra
  const b = nuovaBici(); b.s = o.s - 6; b.lat = o.lat; b.v = 7;
  per(b, 1.5, (x) => ({ ...NIENTE, salto: x.s < o.s - 2 }));
  assert.equal(b.cadute, 0, `col salto si passa (${b.perche})`);
  assert.ok(b.s > o.s + 3 && b.salti === 1, `passato in volo (salti ${b.salti})`);
  // tenuto a lungo in piano: impennata, e lasciato stacca
  const s0 = libero(20), c = nuovaBici(); c.s = s0; c.v = 6;
  per(c, BICI.salto.impennata + 0.1, () => ({ ...NIENTE, salto: true }));
  assert.ok(c.impennata && !c.aria && c.carica === 1, 'tenuto a lungo: impennata, carica piena, ancora a terra');
  pedala(S, c, NIENTE); pedala(S, c, NIENTE);
  assert.ok(c.aria && c.vh > BICI.salto.max * 0.8, `lasciato stacca (vh ${c.vh.toFixed(2)})`);
});

test('il salto sulla rampa si somma al volo', () => {
  const r = S.def.rampe.find((x) => x.tipo === 'rampa' && !S.def.ruscelli.some((q) => q.s === x.s))!;
  const vola = (salta: boolean) => {
    const b = nuovaBici(); b.s = r.s - r.alto * 3 - 4; b.v = 11;
    let hMax = 0;
    for (let i = 0; i < 4 * TICK_HZ && b.s < r.s + 40; i++) { pedala(S, b, { ...NIENTE, salto: salta && b.s < r.s - 0.3 }); if (b.aria) hMax = Math.max(hMax, b.h); }
    return hMax;
  };
  assert.ok(vola(true) > vola(false) + 0.3, `col salto più alto (${vola(true).toFixed(2)} contro ${vola(false).toFixed(2)} m)`);
});

test('il ruscello: il pilota lo salta; anche piano si passa; quasi fermi ci si pianta, e si riparte di là', () => {
  const r = S.def.ruscelli[0]!;
  assert.ok(r && S.def.rampe.some((x) => Math.abs(x.s - r.s) < 0.01), 'c\'è il ruscello col suo trampolino');
  const b = nuovaBici(); b.s = r.s - 40;
  let saltato = false;
  for (let i = 0; i < 10 * TICK_HZ && b.s < r.s + r.largo + 5; i++) { pedala(S, b, pilotaBici(S, b)); if (b.aria && b.s > r.s + r.largo * 0.5) saltato = true; }
  assert.ok(saltato && b.cadute === 0, `il pilota lo salta (cadute ${b.cadute})`);
  // anche piano (13-30 km/h verso il trampolino) si passa: si casca in acqua, si esce dall'altra sponda
  for (const v of [4, 6, 8]) {
    const x = nuovaBici(); x.s = r.s - 5; x.v = v;
    for (let i = 0; i < 6 * TICK_HZ && x.s < r.s + r.largo + 3; i++) pedala(S, x, NIENTE);
    assert.ok(x.cadute === 0 && x.s > r.s + r.largo, `a ${v} m/s si passa (cadute ${x.cadute})`);
  }
  // quasi fermi (sul labbro a ~1 m/s): ci si pianta nell'acqua, e si riparte sull'altra sponda
  const y = nuovaBici(); y.s = r.s - 5; y.v = 2;
  for (let i = 0; i < 6 * TICK_HZ && !y.cadute; i++) pedala(S, y, NIENTE);
  assert.equal(y.perche, 'ruscello', 'piantati nell\'acqua');
  while (y.caduto > 0) pedala(S, y, NIENTE);
  assert.ok(y.s > r.s + r.largo, 'si riparte di là');
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
