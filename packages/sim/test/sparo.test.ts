// Lo sparatutto a missioni (banco provasparo.html, #355; src/sparo/). Cosa si controlla:
// - è deterministico: stessi comandi, stessa partita (hash dello stato uguale);
// - il pilota automatico abbatte i 6 bersagli del poligono in meno di un minuto;
// - il colpo alla testa vale il doppio, il danno cala con la distanza;
// - i container fermano i colpi; la cassa (copertura bassa) protegge chi sta accucciato, non chi sta in piedi;
// - si sale su una cassa saltando, non camminando; sulla base della gru col gradino;
// - il caricatore si svuota e si ricarica da solo; il pompa ricarica un colpo alla volta e sparare la interrompe;
// - il rinculo sale coi colpi di fila e torna giù quando smetti; la vita torna dopo qualche secondo senza colpi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPARO } from '@marea/content/sparo.ts';
import { TICK_HZ } from '../src/constants.ts';
import { hashJson } from '../src/hash.ts';
import { mappaSparo, raggio, suolo } from '../src/sparo/mappa.ts';
import { spara } from '../src/sparo/colpi.ts';
import { autopilota, miraVerso, nuovaPartita, passo } from '../src/sparo/sparo.ts';
import type { SInput, SState } from '../src/sparo/stato.ts';
import { NESSUN_INPUT, collo, occhi } from '../src/sparo/stato.ts';

const m = mappaSparo();
const per = (s: SState, sec: number, c: (s: SState) => SInput) => { for (let i = 0; i < sec * TICK_HZ; i++) passo(s, c(s)); };
const fermo = (s: SState): SInput => ({ ...NESSUN_INPUT, yaw: s.g.yaw, pitch: s.g.pitch });
/** Mette il giocatore in (x, z) e gli toglie i bersagli tranne quelli in `tieni` (indici), spostati dove serve. */
function scena(x: number, z: number, bersagli: { x: number; z: number }[] = []): SState {
  const s = nuovaPartita(7);
  s.g.x = x; s.g.z = z;
  s.bot = s.bot.slice(0, bersagli.length);
  bersagli.forEach((p, i) => { const b = s.bot[i]!; b.x = p.x; b.z = p.z; b.casa = { ...b.casa, x: p.x, z: p.z }; });
  return s;
}

test('deterministico: stessi comandi, stessa partita', () => {
  const gioca = () => { const s = nuovaPartita(42); per(s, 30, autopilota); return hashJson(s); };
  assert.equal(gioca(), gioca());
});

test('il pilota automatico abbatte i 6 bersagli del poligono in meno di un minuto', () => {
  const s = nuovaPartita(1);
  let t = 0;
  while (s.g.uccisi < 6 && t < 60 * TICK_HZ) { passo(s, autopilota(s)); t++; }
  assert.ok(s.g.uccisi >= 6, `abbattuti ${s.g.uccisi} in ${(t / TICK_HZ).toFixed(1)} s`);
  assert.ok(s.g.aSegno / s.g.sparati > 0.5, `precisione ${s.g.aSegno}/${s.g.sparati}`);
});

test('colpo alla testa ×2, il danno cala con la distanza', () => {
  const pistola = SPARO.armi[0]!;
  for (const [dist, atteso] of [[6, 1], [29, 1 - (0.4 * 11) / 22]] as const) {
    // corridoio libero lungo il muro nord (z = 5)
    const s = scena(5, 5, [{ x: 5 + dist, z: 5 }]), b = s.bot[0]!;
    const testa = miraVerso(s.g.x, occhi(s.g), s.g.z, b.x, occhi(b), b.z);
    spara(s, m, -1, pistola, s.g.x, occhi(s.g), s.g.z, testa.yaw, testa.pitch, 0);
    assert.ok(Math.abs(b.vita - (100 - 60 * atteso)) < 0.5, `testa a ${dist} m: vita ${b.vita}`);
    b.vita = 100;
    const petto = miraVerso(s.g.x, occhi(s.g), s.g.z, b.x, collo(b) - 0.3, b.z);
    spara(s, m, -1, pistola, s.g.x, occhi(s.g), s.g.z, petto.yaw, petto.pitch, 0);
    assert.ok(Math.abs(b.vita - (100 - 30 * atteso)) < 0.5, `petto a ${dist} m: vita ${b.vita}`);
  }
});

test('i container fermano i colpi; la cassa protegge solo chi sta accucciato', () => {
  const pistola = SPARO.armi[0]!;
  // container a (10, 12), rot 0: da x = 6 a x = 14 lungo z = 12 c'è la lamiera in mezzo
  const s = scena(6, 12, [{ x: 12.4, z: 12 }]), b = s.bot[0]!;
  const a = miraVerso(s.g.x, occhi(s.g), s.g.z, b.x, collo(b) - 0.3, b.z);
  spara(s, m, -1, pistola, s.g.x, occhi(s.g), s.g.z, a.yaw, a.pitch, 0);
  assert.equal(b.vita, 100, 'il container ha fermato il colpo');
  const ev = s.ev.find((e) => e.t === 'sparo');
  assert.ok(ev && ev.t === 'sparo' && ev.colpi[0]!.cosa === 'muro');
  // cassa a (14.5, 12): il bersaglio subito dietro (x = 13.6), il giocatore a (20, 12) spara al petto
  const c = scena(20, 12, [{ x: 13.6, z: 12 }]), t = c.bot[0]!;
  for (const [giu, presa] of [[false, true], [true, false]] as const) {
    t.vita = 100; t.giu = giu;
    const mira = miraVerso(c.g.x, occhi(c.g), c.g.z, t.x, collo(t) - 0.35, t.z);
    spara(c, m, -1, pistola, c.g.x, occhi(c.g), c.g.z, mira.yaw, mira.pitch, 0);
    assert.equal(t.vita < 100, presa, giu ? 'accucciato dietro la cassa è coperto' : 'in piedi dietro la cassa si prende');
  }
});

test('si sale su una cassa saltando, non camminando; sulla base della gru col gradino', () => {
  // cassa a (6, 16): ci si cammina contro da sud
  const s = scena(6, 18.5);
  const avanti = (salto: boolean) => (x: SState): SInput => ({ ...fermo(x), yaw: 0, my: 1, salto });
  per(s, 1.5, avanti(false));
  assert.equal(s.g.y, 0, 'camminando la cassa ferma');
  assert.ok(s.g.z > 16.6, `contro la cassa: z ${s.g.z.toFixed(2)}`);
  let sopra = false;
  for (let i = 0; i < 1.2 * TICK_HZ && !sopra; i++) {
    passo(s, avanti(i === 0)(s));
    if (s.g.aTerra && Math.abs(s.g.y - 0.9) < 1e-6) sopra = true;
  }
  assert.ok(sopra, `sopra la cassa: y ${s.g.y.toFixed(2)} z ${s.g.z.toFixed(2)}`);
  // la gru: base alta 0,5 a (21, 24), si sale camminando
  const g = scena(21, 29);
  per(g, 1, (x) => ({ ...fermo(x), yaw: 0, my: 1 }));
  assert.ok(Math.abs(suolo(m, g.g.x, g.g.z, 0.32, g.g.y) - 0.5) < 1e-6 && g.g.y === 0.5, `sulla base della gru: y ${g.g.y}`);
});

test('il caricatore si svuota e si ricarica da solo; il pompa un colpo alla volta', () => {
  const s = scena(20, 38);
  const p = SPARO.armi[0]!;
  let premi = false;
  for (let i = 0; i < 2 * TICK_HZ; i++) { premi = !premi; passo(s, { ...fermo(s), pitch: 0.3, fuoco: premi }); }
  assert.equal(s.g.armi[0]!.colpi, 0, 'svuotato');
  assert.ok(s.g.ricarica > 0, 'ricarica partita da sola');
  per(s, p.ricarica + 0.1, fermo);
  assert.deepEqual(s.g.armi[0], { colpi: 12, riserva: 84 });
  // il pompa: due colpi, poi ricarica un colpo alla volta, e sparare la interrompe
  const q = scena(20, 38);
  passo(q, { ...fermo(q), arma: 3 });
  per(q, 0.6, (x) => ({ ...fermo(x), arma: 3 }));
  for (let k = 0; k < 2; k++) { passo(q, { ...fermo(q), pitch: 0.3, fuoco: true, arma: 3 }); per(q, 0.9, (x) => ({ ...fermo(x), arma: 3 })); }
  assert.equal(q.g.armi[2]!.colpi, 4);
  passo(q, { ...fermo(q), ricarica: true, arma: 3 });
  per(q, 0.55, (x) => ({ ...fermo(x), arma: 3 }));
  assert.equal(q.g.armi[2]!.colpi, 5, 'un colpo dentro');
  passo(q, { ...fermo(q), pitch: 0.3, fuoco: true, arma: 3 });
  assert.equal(q.g.armi[2]!.colpi, 4, 'ha sparato a metà ricarica');
  assert.equal(q.g.ricarica, 0);
});

test('il rinculo sale sparando e torna giù; la vita torna dopo qualche secondo', () => {
  const s = scena(20, 38);
  passo(s, { ...fermo(s), arma: 2 });
  per(s, 0.6, (x) => ({ ...fermo(x), arma: 2 }));
  per(s, 0.8, (x) => ({ ...fermo(x), pitch: 0.2, fuoco: true, arma: 2 }));
  assert.ok(s.g.rinculoSu > 3 * (Math.PI / 180), `rinculo dopo una raffica: ${(s.g.rinculoSu * 180 / Math.PI).toFixed(1)}°`);
  per(s, 1.5, (x) => ({ ...fermo(x), arma: 2 }));
  assert.equal(s.g.rinculoSu, 0);
  s.g.vita = 40; s.g.colpitoT = s.tick;
  per(s, 3, fermo);
  assert.equal(s.g.vita, 40, 'prima di 4 s non torna');
  per(s, 2.6, fermo);
  assert.equal(s.g.vita, 100);
});

test('il raggio si ferma sulla faccia del container (i fori stanno sulla lamiera)', () => {
  // container a (10, 12) rot 0: faccia est a x = 11.3
  const r = raggio(m, 20, 1.5, 12, -1, 0, 0, 100);
  assert.equal(r.cosa, 'muro');
  assert.ok(Math.abs(r.x - 11.3) < 1e-9 && r.nx === 1, `x ${r.x} n ${r.nx}`);
  // verso il basso tocca la banchina, oltre il bordo il mare
  assert.equal(raggio(m, 20, 1.6, 30, 0, -1, 0, 100).cosa, 'terra');
  assert.equal(raggio(m, 20, 1.6, 43, 0, -0.2, 0.98, 100).cosa, 'acqua');
});
