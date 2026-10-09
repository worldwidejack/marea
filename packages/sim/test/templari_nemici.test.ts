// Nemici e boss dei Templari (docs/TEMPLARI.md §8): pirati veloci dalla 3ª ondata, cannoniere che bombarda dove sei, Templare a cavallo
// alle ondate 5, 15, 25 (e dalla 20 anche nelle altre) che carica, de Molay alle 10, 20, 30 che lascia fiamme, tira palle di fuoco e a
// metà vita scappa ridendo (punti, ma non muore); l'ondata del boss finisce solo quando il boss non c'è più.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, nemicoDef } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { bossDi } from '../src/templari/ondate.ts';
import { colpisci } from '../src/templari/colpi.ts';
import { nuovoZombie, quantiOndata } from '../src/templari/stato.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const passi = (s: TState, n: number) => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, F); };
function arena(seed = 1, ondata = 1): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = ondata; s.quanti = 0; s.usciti = 0; s.prossima = 1e9;
  return s;
}
/** Uno zombie fermo a (dx, dz) dall'eroe, già in piedi. */
function zombie(s: TState, tipo: string, dx: number, dz: number) {
  const z = nuovoZombie(s, tipo, s.eroe.x + dx, s.eroe.z + dz, nemicoDef(tipo).velocita.cammina);
  z.st = 'insegue'; z.cd = 0;
  return z;
}

test('boss delle ondate: cavaliere alle 5, 15, 25 (dalla 20 sempre), de Molay alle 10, 20, 30', () => {
  assert.equal(bossDi(4), null);
  assert.deepEqual(bossDi(5), { tipo: 'cavaliere', solo: true });
  assert.deepEqual(bossDi(10), { tipo: 'molay', solo: true });
  assert.deepEqual(bossDi(15), { tipo: 'cavaliere', solo: true });
  assert.deepEqual(bossDi(20), { tipo: 'molay', solo: true });
  assert.deepEqual(bossDi(21), { tipo: 'cavaliere', solo: false });
  assert.equal(bossDi(19), null);
});

test('ondata 5: meno fanti, il cavaliere esce dopo l\'attesa e l\'ondata non finisce finché c\'è', () => {
  const s = templari.create({ seed: 4, opzioni: { subito: true } });
  s.fase = 'pausa'; s.ondata = 4; s.faseT = 0;
  passi(s, Math.round(TEMPLARI.ondate.pausa * 60) + 1);
  assert.equal(s.ondata, 5);
  assert.equal(s.quanti, Math.round(quantiOndata(5) * TEMPLARI.boss.quotaFanti));
  passi(s, Math.round(TEMPLARI.boss.attesa * 60) + 2);
  const cav = s.zombie.find((z) => z.tipo === 'cavaliere');
  assert.ok(cav, 'il cavaliere non è uscito');
  assert.equal(cav.max, Math.round(550 * 12));
  // tutti gli altri morti, il cavaliere vivo: l'ondata resta aperta
  s.usciti = s.quanti;
  for (const z of s.zombie) if (z !== cav) { z.st = 'morto'; z.vita = 0; }
  passi(s, Math.round(nemicoDef('cavaliere').sorge * 60) + 5); // esce da terra
  assert.equal(s.fase, 'combatti');
  colpisci(s, cav, { danno: 1e9, mischia: true, caricato: false, dirX: 1, dirZ: 0, spinta: 0 });
  passi(s, 2);
  assert.equal(s.fase, 'pausa');
});

test('cavaliere: si impenna e carica: ti prende, ti ferisce e ti butta via', () => {
  const s = arena(2, 5);
  const h = s.eroe, x0 = h.x;
  const cav = zombie(s, 'cavaliere', -7, 0);
  cav.vel = 0; // solo la carica lo muove
  const v0 = h.vita;
  passi(s, Math.round((nemicoDef('cavaliere').carica!.preparazione + 1.4) * 60));
  assert.ok(h.vita <= v0 - nemicoDef('cavaliere').carica!.danno + 1, `vita ${h.vita}`);
  assert.ok(Math.abs(h.x - x0) > 0.5, 'non è stato spinto');
});

test('cannoniere: lancia la bomba dove sei, esplode dopo il volo', () => {
  const s = arena(3, 12);
  const h = s.eroe;
  const b = nemicoDef('cannoniere').bomba!;
  zombie(s, 'cannoniere', -6, 0).vel = 0;
  passi(s, Math.round(b.preparazione * 60) + 2);
  assert.equal(s.tiri.length, 1, 'nessuna bomba');
  const t = s.tiri[0]!;
  assert.ok(Math.abs(t.tx - h.x) < 0.01 && Math.abs(t.tz - h.z) < 0.01, 'la bomba non mira dove sei');
  const v0 = h.vita;
  passi(s, Math.round(b.volo * 60) + 2);
  assert.ok(h.vita <= v0 - b.danno + 1, `vita ${h.vita}`);
});

test('de Molay: fiamme dove passa che bruciano, a metà vita ride e scappa, poi sparisce e dà i punti', () => {
  const s = arena(5, 10);
  const m = zombie(s, 'molay', -2.5, 0);
  passi(s, 70);
  assert.ok(s.fiamme.some((f) => f.nemico), 'nessuna fiamma di de Molay');
  const p0 = s.punti;
  colpisci(s, m, { danno: m.max * 0.8, mischia: true, caricato: false, dirX: -1, dirZ: 0, spinta: 0 });
  assert.equal(m.st, 'fugge');
  assert.equal(m.vita, m.max * 0.5);
  assert.equal(colpisci(s, m, { danno: 1e9, mischia: true, caricato: false, dirX: -1, dirZ: 0, spinta: 0 }), 'no', 'mentre scappa prende colpi');
  passi(s, 6.2 * 60);
  assert.equal(m.st, 'morto');
  assert.ok(s.punti >= p0 + (nemicoDef('molay').punti ?? 0), `punti ${s.punti - p0}`);
  assert.equal(s.uccisioni, 0, 'de Molay non muore: non conta come uccisione');
});

test('pirati dalla 3ª ondata, veloci e fragili; i fanti restano la maggioranza', () => {
  const s = templari.create({ seed: 9, opzioni: { subito: true } });
  s.fase = 'pausa'; s.ondata = 7; s.faseT = 0;
  const tipi: Record<string, number> = {};
  for (let i = 0; i < 60 * 60 && s.ondata === 8 || i < 700; i++) {
    stepTemplari(s, F);
    for (const z of s.zombie) if (z.st === 'sorge' && z.stT === 1) tipi[z.tipo] = (tipi[z.tipo] ?? 0) + 1;
    if (s.done) break;
    if (s.usciti >= s.quanti && s.ondata >= 8) break;
  }
  const pir = s.zombie.find((z) => z.tipo === 'pirata');
  assert.ok((tipi['pirata'] ?? 0) >= 1, `nessun pirata: ${JSON.stringify(tipi)}`);
  assert.ok((tipi['fante'] ?? 0) > (tipi['pirata'] ?? 0), `${JSON.stringify(tipi)}`);
  if (pir) assert.ok(pir.vel >= nemicoDef('pirata').velocita.cammina);
});
