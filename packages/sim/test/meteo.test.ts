// Meteo (#361): nuvole pure dall'orologio e dal seed. Stesso cielo per tutti a parità di ora, nuvole che si muovono senza salti,
// meteo del posto giusto sotto e fuori dalla nuvola (piove sotto la nuvola di pioggia, non ovunque), tutto a gradini.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METEO } from '@marea/content';
import { NUVOLA_TIPI, lampoAt, meteoQui, nuvoleAt, ventoIntegrale } from '../src/meteo.ts';
import type { Nuvola } from '../src/meteo.ts';

const T0 = Date.UTC(2026, 9, 16, 12), MIN = 60_000, n = METEO.gradini;
const aGradini = (v: number) => Math.abs(v * n - Math.round(v * n)) < 1e-9;
const finta = (o: Partial<Nuvola>): Nuvola => ({ id: 'x', tipo: 'pioggia', x: 100, z: 100, rx: 50, rz: 40, dx: 1, dz: 0, k: 1, forma: 1, nata: 0, muore: 1e15, ...o });

test('meteo: stesso istante, stesso cielo (anche senza cache) e stesso meteo nello stesso punto', () => {
  for (let i = 0; i < 60; i++) {
    const ms = T0 + i * 437_123;
    assert.deepEqual(nuvoleAt(ms), nuvoleAt(ms));
    assert.deepEqual(nuvoleAt(ms, { ...METEO }), nuvoleAt(ms)); // un'altra copia dei numeri = un altro giocatore
    assert.deepEqual(meteoQui(ms, 300, 300, { ...METEO }), meteoQui(ms, 300, 300));
  }
  assert.ok(nuvoleAt(T0).length > 5, 'poche nuvole');
});

test('meteo: le nuvole si muovono, senza salti, alla velocità del vento', () => {
  const vmax = METEO.vento.nuvolaMs + METEO.vento.ventoMs;
  let prima = nuvoleAt(T0), mosse = 0;
  for (let s = 10; s <= 1200; s += 10) {
    const ora = nuvoleAt(T0 + s * 1000);
    for (const c of ora) {
      const p = prima.find((x) => x.id === c.id);
      if (!p) continue;
      const d = Math.sqrt((c.x - p.x) ** 2 + (c.z - p.z) ** 2);
      if (d > 500) continue; // rientrata dall'altro lato del campo
      assert.ok(d <= vmax * 10 + 1e-6, `salto di ${d.toFixed(2)} m in 10 s`);
      assert.ok(d >= METEO.vento.nuvolaMs * 10 * 0.99, `ferma: ${d.toFixed(2)} m in 10 s`);
      mosse++;
    }
    prima = ora;
  }
  assert.ok(mosse > 100, `poche nuvole seguite: ${mosse}`);
  const a = T0, b = T0 + 7 * MIN, c = T0 + 19 * MIN; // il vento si somma a pezzi
  assert.ok(Math.abs(ventoIntegrale(a, c) - ventoIntegrale(a, b) - ventoIntegrale(b, c)) < 1e-6);
});

test('meteo: sotto la nuvola di pioggia piove, al bordo solo ombra, fuori sereno; a gradini entrando', () => {
  const ns = [finta({})];
  const sotto = meteoQui(T0, 100, 100, METEO, ns);
  assert.equal(sotto.stato, 'pioggia'); assert.equal(sotto.k, 1); assert.equal(sotto.pioggia, 1);
  const bordo = meteoQui(T0, 100 + 50 * 0.9, 100, METEO, ns); // dentro l'ombra, fuori dal raggio della pioggia
  assert.equal(bordo.stato, 'pioggia'); assert.ok(bordo.k > 0 && bordo.k < 1, `k al bordo ${bordo.k}`); assert.equal(bordo.pioggia, 0);
  const fuori = meteoQui(T0, 300, 100, METEO, ns);
  assert.equal(fuori.stato, 'sereno'); assert.equal(fuori.k, 0); assert.equal(fuori.pioggia, 0);
  const visti = new Set<number>();
  for (let x = 100; x <= 160; x += 0.5) { const q = meteoQui(T0, x, 100, METEO, ns); assert.ok(aGradini(q.k) && aGradini(q.pioggia)); visti.add(q.k); }
  assert.equal(visti.size, n + 1, `gradini visti entrando: ${[...visti].join(', ')}`);
  const temp = meteoQui(T0, 100, 100, METEO, [finta({ tipo: 'bianca', rx: 80, rz: 80 }), finta({ tipo: 'temporale' })]);
  assert.equal(temp.stato, 'temporale'); assert.equal(temp.lampi, 1); assert.equal(temp.vento, 1);
  assert.equal(meteoQui(T0, 100, 100, METEO, [finta({ tipo: 'bianca' })]).pioggia, 0); // la bianca fa solo ombra
});

test('meteo: in un giorno tutti i tipi; al Porto piove ogni tanto ma non quasi sempre; lampi solo dai temporali', () => {
  const tipi = new Set<string>();
  let pioggia = 0, minuti = 0;
  for (let i = 0; i < 24 * 60; i += 2, minuti++) {
    const ms = T0 + i * MIN, ns = nuvoleAt(ms);
    for (const c of ns) { tipi.add(c.tipo); assert.ok(aGradini(c.k)); if (c.tipo !== 'temporale') assert.equal(lampoAt(ms, c), null); }
    if (meteoQui(ms, 300, 300, METEO, ns).pioggia > 0) pioggia++;
  }
  for (const t of NUVOLA_TIPI) assert.ok(tipi.has(t), `manca ${t}`);
  assert.ok(pioggia > 0 && pioggia < minuti * 0.3, `pioggia al Porto ${pioggia}/${minuti}`);
});
