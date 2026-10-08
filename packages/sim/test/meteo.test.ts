// Meteo (#85): funzione pura dell'orologio. Deterministica, copre tutti gli stati in un giorno, periodi contigui, gradini.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METEO } from '@marea/content';
import { METEO_STATI, meteoAt, periodiMeteo } from '../src/meteo.ts';

const DAY = 86_400_000, T0 = Date.UTC(2026, 9, 8);

test('meteo: stesso istante, stesso tempo (anche ricalcolando i periodi)', () => {
  for (let i = 0; i < 200; i++) {
    const ms = T0 + i * 437_123;
    assert.deepEqual(meteoAt(ms), meteoAt(ms));
    assert.deepEqual(meteoAt(ms, { ...METEO }), meteoAt(ms)); // senza cache = con cache
  }
});

test('meteo: in un giorno ci sono tutti gli stati; il sereno è il più frequente; pioggia 3-5 min', () => {
  const tempo: Record<string, number> = {}, pioggia: number[] = [];
  const L = METEO.cicloMin * 60_000;
  for (let c = Math.floor(T0 / L); c * L < T0 + DAY; c++) {
    for (const p of periodiMeteo(c)) {
      tempo[p.stato] = (tempo[p.stato] ?? 0) + (p.a - p.da);
      if (p.stato === 'pioggia') pioggia.push((p.a - p.da) / 60_000);
    }
  }
  for (const s of METEO_STATI) assert.ok((tempo[s] ?? 0) > 0, `manca ${s} in un giorno: ${JSON.stringify(tempo)}`);
  const sereno = tempo['sereno']!;
  for (const s of METEO_STATI) if (s !== 'sereno') assert.ok(sereno > tempo[s]!, `${s} più del sereno: ${JSON.stringify(tempo)}`);
  assert.ok(pioggia.length > 0 && pioggia.every((m) => m <= 5.001), `piogge: ${pioggia.join(', ')}`);
  assert.ok(pioggia.filter((m) => m >= 3).length >= pioggia.length * 0.7, `piogge troppo corte: ${pioggia.join(', ')}`);
});

test('meteo: periodi contigui, che coprono il ciclo, mai due uguali di fila; il ciclo parte sereno', () => {
  const L = METEO.cicloMin * 60_000;
  for (let c = Math.floor(T0 / L); c < Math.floor(T0 / L) + 100; c++) {
    const ps = periodiMeteo(c);
    assert.equal(ps[0]!.da, c * L); assert.equal(ps[ps.length - 1]!.a, (c + 1) * L); assert.equal(ps[0]!.stato, 'sereno');
    for (let i = 1; i < ps.length; i++) { assert.equal(ps[i]!.da, ps[i - 1]!.a); assert.notEqual(ps[i]!.stato, ps[i - 1]!.stato); }
  }
});

test('meteo: intensità a gradini, sale all\'inizio e scende alla fine del periodo', () => {
  const L = METEO.cicloMin * 60_000;
  const p = periodiMeteo(Math.floor(T0 / L)).find((x) => x.stato !== 'sereno' && x.a - x.da >= 2 * METEO.transizioneS * 1000)!;
  assert.ok(p, 'nessun periodo abbastanza lungo');
  const ks = new Set<number>();
  for (let ms = p.da; ms < p.a; ms += 1000) {
    const m = meteoAt(ms); ks.add(m.k);
    assert.equal(m.stato, p.stato);
    assert.ok(Number.isInteger(Math.round(m.k * METEO.gradini * 1e6) / 1e6), `k non a gradini: ${m.k}`);
  }
  assert.equal(meteoAt(p.da).k, 0);
  assert.equal(meteoAt(Math.floor((p.da + p.a) / 2)).k, 1);
  assert.equal(meteoAt(p.a - 1).k, 0);
  assert.equal(ks.size, METEO.gradini + 1, `gradini visti: ${[...ks].join(', ')}`);
  // il sereno ha k = 0
  const s = periodiMeteo(Math.floor(T0 / L))[0]!;
  assert.equal(meteoAt(s.da + 1000).k, 0);
});
