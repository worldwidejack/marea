// Gli oggetti alla Mario Kart delle Corse (#250, docs/CORSE.md A7): scatole, roulette, i cinque effetti, i bot che li usano,
// la pesca dal seed (il server rigioca uguale) e le gare senza oggetti identiche a prima.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORSE, validateCorse } from '@marea/content/corse.ts';
import { garaCorse, opzioniGara, pilotaGara } from '../src/corse/gara.ts';
import type { GaraState } from '../src/corse/gara.ts';
import '../src/corse/registra.ts';
import { oggettoDef } from '../src/corse/oggetti.ts';
import { packInputs, quantize, replayPartita } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const nuova = (pista: string, oggetti = true, seed = 7, bot = true): GaraState =>
  garaCorse.create({ seed, difficulty: 2, opzioni: opzioniGara({ pista, bot: bot ? '1' : '0', ...(oggetti ? { oggetti: '1' } : {}) }) });
const via = (s: GaraState) => { while (s.tick < 1) garaCorse.step(s, { mx: 0, my: 0, a: false, b: false }); return s; };
function corri(s: GaraState): InputFrame[] {
  const frames: InputFrame[] = [];
  while (!s.done) { const f = quantize(pilotaGara(s)); frames.push(f); garaCorse.step(s, f); }
  return frames;
}

test('oggetti (#250): i dati sono validi e le opzioni li accendono solo con oggetti = 1', () => {
  assert.deepEqual(validateCorse(), []);
  assert.ok(CORSE.oggetti.catalogo.filter((o) => o.livello === 'base').length >= 5);
  assert.equal(opzioniGara({ pista: 'spiaggia_lungomare' })['oggetti'], undefined);
  assert.equal(opzioniGara({ pista: 'spiaggia_lungomare', oggetti: '1' })['oggetti'], '1');
  assert.equal(nuova('spiaggia_lungomare', false).oggetti, null);
  const s = nuova('spiaggia_lungomare');
  assert.equal(s.oggetti!.scatole.length, CORSE.oggetti.scatole.righe.length * CORSE.oggetti.scatole.lat.length);
  assert.equal(s.oggetti!.tasche.length, s.veicoli.length);
});

test('oggetti (#250): senza oggetti la gara è identica (stessi input → stesso risultato), anche col bottone b premuto', () => {
  const a = nuova('spiaggia_lungomare', false), fa = corri(a);
  const b = nuova('spiaggia_lungomare', false);
  for (const f of fa) garaCorse.step(b, { ...f, b: true });
  assert.deepEqual(garaCorse.result(b), garaCorse.result(a));
});

test('oggetti (#250): si pesca da una scatola, la roulette gira e USA allo scatto consuma l\'oggetto', () => {
  const s = via(nuova('spiaggia_lungomare', true, 7, false)), o = s.oggetti!, k = s.veicoli[0]!, b = o.scatole[1]!;
  // mettiti sopra una scatola
  k.prog = b.prog; k.lat = b.lat; k.s = (CORSE_S(s, b.prog));
  garaCorse.step(s, { mx: 0, my: 1, a: false, b: false });
  const t = o.tasche[0]!;
  assert.ok(t.ogg && t.roulette > 0, `pescato ${t.ogg}`);
  assert.ok(b.t > 0, 'la scatola sparisce');
  // finché la roulette gira USA non fa niente
  garaCorse.step(s, { mx: 0, my: 1, a: false, b: true });
  assert.ok(t.ogg);
  while (t.roulette > 0) garaCorse.step(s, { mx: 0, my: 1, a: false, b: false });
  const cariche = t.cariche;
  garaCorse.step(s, { mx: 0, my: 1, a: false, b: true });
  assert.equal(t.cariche, cariche - 1);
  // tenuto premuto non lo usa di nuovo
  const c2 = t.cariche;
  garaCorse.step(s, { mx: 0, my: 1, a: false, b: true });
  assert.equal(t.cariche, c2);
  assert.equal(o.usati[0], 1);
});
const CORSE_S = (s: GaraState, prog: number) => { const v = s.veicoli[0]!; return v.s + (prog - v.prog); };

test('oggetti (#250): ogni effetto fa quello che deve (turbo, scudo, trappola, colpo dritto, colpo a ricerca)', () => {
  const prova = (id: string, my = 1) => {
    const s = via(nuova('spiaggia_lungomare', true, 3, true)), o = s.oggetti!;
    for (let i = 0; i < 60; i++) garaCorse.step(s, { mx: 0, my: 1, a: false, b: false });
    for (const t of o.tasche) { t.ogg = ''; t.roulette = 0; } // i bot non usano niente
    o.scatole.length = 0;
    const t = o.tasche[0]!;
    t.ogg = id; t.cariche = oggettoDef(id).cariche; t.roulette = 0;
    garaCorse.step(s, { mx: 0, my, a: false, b: true });
    return s;
  };
  const tu = prova('turbo');
  assert.ok(tu.veicoli[0]!.turbo > 1, 'turbo');
  const tr = prova('tris');
  assert.equal(tr.oggetti!.tasche[0]!.cariche, 2, 'tris: restano due lattine');
  const sc = prova('scudo');
  assert.ok(sc.oggetti!.tasche[0]!.scudo > 7, 'scudo');
  const bu = prova('buccia');
  assert.equal(bu.oggetti!.trappole.length, 1);
  assert.ok(bu.oggetti!.trappole[0]!.prog < bu.veicoli[0]!.prog, 'la buccia sta dietro');
  // il razzo: insegue chi sta subito davanti e lo prende
  const ra = prova('razzo');
  for (let i = 0; i < 400 && ra.oggetti!.colpi.length; i++) garaCorse.step(ra, { mx: 0, my: 1, a: false, b: false });
  assert.equal(ra.oggetti!.colpi.length, 0);
  assert.ok(ra.oggetti!.presi[0] === 0 && ra.oggetti!.presi.reduce((x, y) => x + y, 0) === 1, `il razzo prende uno davanti (${ra.oggetti!.presi})`);
  // il colpo dritto: va avanti e sparisce dopo la sua vita
  const pa = prova('palla');
  assert.ok(pa.oggetti!.colpi.length + pa.oggetti!.presi.reduce((x, y) => x + y, 0) === 1);
  for (let i = 0; i < 300; i++) garaCorse.step(pa, { mx: 0, my: 1, a: false, b: false });
  assert.equal(pa.oggetti!.colpi.length, 0);
  // col freno tenuto si lancia dall'altra parte (Jack, 12 ott): la buccia vola avanti (e chi l'ha lanciata non ci inciampa), la palla va indietro
  const ba = prova('buccia', -1), tv = ba.oggetti!.trappole[0]!;
  assert.ok(tv.prog > ba.veicoli[0]!.prog + 15 && tv.t < 0, `buccia avanti: ${tv.prog} vs ${ba.veicoli[0]!.prog}`);
  for (let i = 0; i < 120; i++) garaCorse.step(ba, { mx: 0, my: 1, a: false, b: false });
  assert.equal(ba.oggetti!.presi[0], 0, 'chi la lancia avanti non ci inciampa');
  const pi = prova('palla', -1);
  assert.ok(pi.oggetti!.colpi.length === 0 || pi.oggetti!.colpi[0]!.v < 0, 'palla indietro');
  const ri = prova('razzo', -1), ci = ri.oggetti!.colpi[0];
  assert.ok(!ci || ci.v < 0, 'razzo indietro');
  // lo scudo para un colpo
  const sp = prova('scudo');
  const j = 1, tj = sp.oggetti!.tasche[j]!;
  tj.scudo = 5;
  sp.oggetti!.colpi.push({ ogg: 'razzo', da: 0, prog: sp.veicoli[j]!.prog - 1, lat: 0, t: 0, v: 30, bersaglio: j });
  garaCorse.step(sp, { mx: 0, my: 1, a: false, b: false });
  assert.equal(sp.oggetti!.presi[j], 0);
  assert.equal(tj.scudo, 0, 'lo scudo si consuma');
});

test('oggetti (#250): una gara intera coi bot usa oggetti, è deterministica e il server la rigioca uguale', () => {
  for (const pista of ['spiaggia_lungomare', 'spiaggia_baia', 'giungla_miniera']) {
    const a = nuova(pista, true, 11), fa = corri(a), ra = garaCorse.result(a);
    assert.ok(a.veicoli[0]!.fine > 0, `${pista}: arriva`);
    const usati = a.oggetti!.usati.reduce((x, y) => x + y, 0);
    assert.ok(usati >= 4, `${pista}: oggetti usati ${usati}`);
    assert.ok(a.oggetti!.usati.slice(1).some((n) => n > 0), `${pista}: anche i bot usano gli oggetti`);
    const b = nuova(pista, true, 11);
    for (const f of fa) garaCorse.step(b, f);
    assert.deepEqual(garaCorse.result(b), ra, `${pista}: deterministica`);
    const r = replayPartita('corse', 11, 2, packInputs(fa), opzioniGara({ pista, bot: '1', oggetti: '1' }));
    assert.deepEqual(r.result, ra, `${pista}: replay del server`);
  }
});
