// La Difesa a corsie alla Plants vs Zombies (banco provadifesa.html, #358; src/difesa/, docs/DIFESA.md). Cosa si controlla:
// - è deterministica: stesso seme e stesse mosse, stessa partita (hash dello stato uguale);
// - col profilo `pvz` fa le stesse cose dell'originale: 10 colpi per il nemico base, 28 per il cono, 65 per il secchio; un nemico mangia
//   il muro in 40 s; il produttore dà la prima moneta in 3-12,5 s e poi ogni 23,5-25 s; il budget delle ondate è ondata ÷ 3 + 1 e
//   l'ondata bandiera ×2,5 col nemico con la bandiera; il cielo rallenta da ~5,6 s a ~10,9 s tra una moneta e l'altra;
// - le carte: costo, ricarica, carte lente scariche a inizio livello; casella occupata e corsia chiusa rifiutate;
// - il saltatore salta il primo difensore; il gelo dimezza il passo; la bomba e la mina fanno 1800 di danno;
// - il tosaerba parte una volta per corsia e spazza la corsia; dopo, un nemico in fondo fa perdere;
// - il pilota automatico «bravo» vince tutti e 6 i livelli; chi non fa niente perde il livello 3; la Sopravvivenza non finisce da sola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFESA, profiloDifesa } from '@marea/content/difesa.ts';
import { TICK_HZ } from '../src/constants.ts';
import { hashJson } from '../src/hash.ts';
import type { DState } from '../src/difesa/stato.ts';
import { tick } from '../src/difesa/stato.ts';
import { nuovaPartita, passo } from '../src/difesa/difesa.ts';
import { autopilota, creaBot } from '../src/difesa/bot.ts';
import { componiOndata, eBandiera, nuovoNemico, puntiOndata } from '../src/difesa/ondate.ts';
import { ferisci } from '../src/difesa/nemici.ts';
import { pianta } from '../src/difesa/unita.ts';

const P = profiloDifesa('pvz');
/** Una partita senza ondate né cielo (per provare un pezzo alla volta): livello 6, tutte le carte cariche, tanta valuta. */
function banco(livello = 5): DState {
  const s = nuovaPartita(3, livello, { profilo: 'pvz' });
  s.conto = 1e9; s.cielo.conto = 1e9; s.valuta = 99999;
  for (const c of s.carte) c.pronta = 0;
  return s;
}
const per = (s: DState, sec: number) => { for (let i = 0; i < sec * TICK_HZ && !s.esito; i++) passo(s); };
const colpiPer = (tipo: 'base' | 'cono' | 'secchio') => {
  const s = banco(), e = nuovoNemico(s, tipo, 2, 8, 0);
  s.nemici.push(e);
  let n = 0;
  while (e.testa && n < 500) { ferisci(s, e, 20); n++; }
  return n;
};

test('deterministica: stesso seme e stesse mosse, stessa partita', () => {
  const gioca = () => { const s = nuovaPartita(42, 4, { profilo: 'marea' }), b = creaBot('medio', 9); for (let i = 0; i < 90 * TICK_HZ; i++) passo(s, autopilota(s, b)); return hashJson(s); };
  assert.equal(gioca(), gioca());
});

test('profilo pvz: 10 colpi per il base, 28 per il cono, 65 per il secchio; senza testa sparisce dopo 1 s', () => {
  assert.equal(colpiPer('base'), 10);
  assert.equal(colpiPer('cono'), 28);
  assert.equal(colpiPer('secchio'), 65);
  const s = banco(), e = nuovoNemico(s, 'base', 2, 8, 0);
  s.nemici.push(e);
  for (let i = 0; i < 10; i++) ferisci(s, e, 20);
  assert.equal(e.testa, false);
  per(s, 0.9); assert.ok(s.nemici.includes(e), 'ancora in piedi a 0,9 s');
  per(s, 0.2); assert.ok(!s.nemici.includes(e), 'sparito dopo 1 s');
});

test('profilo pvz: un nemico mangia il muro in 40 s (100 di danno al secondo), lo sparatore in 3 s', () => {
  for (const [tipo, sec] of [['muro', 40], ['sparatore', 3]] as const) {
    const s = banco(), u = pianta(s, tipo, 2, 3)!;
    const e = nuovoNemico(s, 'base', 2, 4.1, 0); // già addosso
    s.nemici.push(e);
    let t = 0;
    while (s.unita.includes(u) && t < 60 * TICK_HZ) { e.vita = 270; passo(s); t++; }
    assert.ok(Math.abs(t / TICK_HZ - sec) < 0.6, `${tipo}: mangiato in ${t / TICK_HZ} s`);
  }
});

test('profilo pvz: il produttore dà la prima moneta in 3-12,5 s, poi una ogni 23,5-25 s', () => {
  for (let seme = 1; seme <= 8; seme++) {
    const s = banco(); s.caso = seme * 977;
    pianta(s, 'produttore', 1, 0);
    const quando: number[] = [];
    for (let i = 0; i < 80 * TICK_HZ; i++) { passo(s); for (const ev of s.ev) if (ev.e === 'moneta' && !ev.cielo) quando.push(s.tick / TICK_HZ); }
    assert.ok(quando[0]! >= 2.9 && quando[0]! <= 12.6, `prima ${quando[0]}`);
    for (let k = 1; k < quando.length; k++) { const d = quando[k]! - quando[k - 1]!; assert.ok(d >= 23.4 && d <= 25.1, `intervallo ${d}`); }
  }
});

test('profilo pvz: budget delle ondate n ÷ 3 + 1, bandiera ×2,5 col nemico con la bandiera, ultima ondata con tutti i tipi', () => {
  const s = nuovaPartita(5, 5, { profilo: 'pvz' }); // livello 6: 20 ondate, bandiere alla 10ª e alla 20ª
  for (let n = 0; n < 20; n++) assert.equal(puntiOndata(s, n), Math.floor(n / 3) + 1);
  assert.deepEqual([...Array(20).keys()].filter((n) => eBandiera(s, n)), [9, 19]);
  const o9 = componiOndata(s, 9), punti9 = o9.reduce((a, t) => a + P.nemici[t].punti, 0);
  assert.ok(o9.includes('bandiera'), 'nella 10ª c\'è la bandiera');
  assert.ok(o9.filter((t) => t === 'base').length >= Math.min(puntiOndata(s, 9), 8), 'più i nemici base della bandiera');
  assert.ok(punti9 >= Math.floor(puntiOndata(s, 9) * 2.5), `punti della bandiera ${punti9}`);
  const ultima = componiOndata(s, 19);
  for (const t of DIFESA.livelli[5]!.nemici) assert.ok(ultima.includes(t), `nell'ultima ondata c'è ${t}`);
  const l1 = nuovaPartita(5, 0, { profilo: 'pvz' });
  assert.ok(![0, 1, 2, 3].some((n) => eBandiera(l1, n)), 'nel tutorial niente bandiere');
  assert.ok(!componiOndata(s, 2).includes('saltatore'), 'il saltatore non esce prima della 5ª ondata');
});

test('profilo pvz: il cielo all\'inizio fa cadere una moneta ogni ~5,6 s, poi ogni ~10,9 s', () => {
  const s = nuovaPartita(11, 3, { profilo: 'pvz' });
  s.conto = 1e9;
  const quando: number[] = [];
  for (let i = 0; i < 600 * TICK_HZ; i++) { passo(s); for (const ev of s.ev) if (ev.e === 'moneta' && ev.cielo) quando.push(s.tick / TICK_HZ); }
  const media = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const d = quando.slice(1).map((t, k) => t - quando[k]!);
  assert.ok(Math.abs(media(d.slice(0, 8)) - 5.8) < 1, `prime: ${media(d.slice(0, 8))}`);
  assert.ok(Math.abs(media(d.slice(-15)) - 10.9) < 1, `a regime: ${media(d.slice(-15))}`);
});

test('carte: costo e ricarica, le carte lente partono scariche, casella occupata e corsia chiusa rifiutate', () => {
  const s = nuovaPartita(1, 5, { profilo: 'pvz' });
  assert.equal(s.carte.find((c) => c.tipo === 'bomba')!.pronta, tick(35));
  assert.equal(s.carte.find((c) => c.tipo === 'muro')!.pronta, tick(20));
  assert.equal(s.carte.find((c) => c.tipo === 'sparatore')!.pronta, 0);
  s.valuta = 150;
  assert.ok(pianta(s, 'sparatore', 2, 2));
  assert.equal(s.valuta, 50);
  assert.equal(pianta(s, 'sparatore', 3, 2), null, 'in ricarica');
  s.carte.find((c) => c.tipo === 'sparatore')!.pronta = 0;
  assert.equal(pianta(s, 'sparatore', 3, 2), null, 'valuta');
  s.valuta = 999;
  assert.equal(pianta(s, 'produttore', 2, 2), null, 'occupata');
  const l2 = nuovaPartita(1, 1, { profilo: 'pvz' }); l2.valuta = 999;
  assert.equal(pianta(l2, 'sparatore', 0, 2), null, 'nel livello 2 la corsia 0 è chiusa');
});

test('saltatore, gelo, bomba e mina', () => {
  // il saltatore corre, salta il primo difensore e atterra dietro, poi cammina piano
  let s = banco();
  pianta(s, 'muro', 2, 6);
  const sal = nuovoNemico(s, 'saltatore', 2, 9, 0);
  s.nemici.push(sal);
  per(s, 12);
  assert.equal(sal.salto, 2, 'ha saltato');
  assert.ok(sal.x < 6, `è dietro al muro: ${sal.x}`);
  assert.ok(s.unita.some((u) => u.tipo === 'muro'), 'il muro è intatto');
  // il gelo dimezza il passo
  s = banco();
  const a = nuovoNemico(s, 'base', 1, 8, 0), g = nuovoNemico(s, 'base', 3, 8, 0);
  g.passo = a.passo; s.nemici.push(a, g);
  ferisci(s, g, 0, true);
  per(s, 5);
  assert.ok(Math.abs((8 - g.x) / (8 - a.x) - 0.5) < 0.02, `gelato ${8 - g.x} contro ${8 - a.x}`);
  // la bomba: 1800 nel 3 × 3 dopo la miccia; il secchio (1370) sparisce, quello a 3 corsie di distanza no
  s = banco();
  const vicino = nuovoNemico(s, 'secchio', 3, 5.6, 0), lontano = nuovoNemico(s, 'secchio', 0, 5.6, 0);
  s.nemici.push(vicino, lontano);
  pianta(s, 'bomba', 2, 5);
  per(s, 1.1);
  assert.ok(!s.nemici.includes(vicino) && s.nemici.includes(lontano));
  // la mina: si arma in 15 s, poi scoppia a chi la tocca
  s = banco();
  pianta(s, 'mina', 2, 3);
  const m = nuovoNemico(s, 'cono', 2, 6.5, 0);
  s.nemici.push(m);
  per(s, 30);
  assert.ok(!s.nemici.includes(m), 'il cono è saltato in aria');
  assert.ok(!s.unita.some((u) => u.tipo === 'mina'), 'la mina è andata');
});

test('tosaerba: parte una volta per corsia e spazza la corsia; dopo, un nemico in fondo fa perdere', () => {
  const s = banco();
  s.nemici.push(nuovoNemico(s, 'base', 2, 0.6, 0), nuovoNemico(s, 'cono', 2, 3, 0), nuovoNemico(s, 'base', 1, 7, 0));
  per(s, 8);
  assert.equal(s.stats.tosaerba, 1);
  assert.equal(s.tosa[2]!.stato, 2, 'tosaerba usato');
  assert.equal(s.nemici.filter((e) => e.corsia === 2).length, 0, 'corsia 2 spazzata');
  assert.equal(s.nemici.filter((e) => e.corsia === 1).length, 1, 'la corsia 1 no');
  s.nemici.push(nuovoNemico(s, 'base', 2, 0.2, 0));
  per(s, 10);
  assert.equal(s.esito, 'persa');
});

test('il pilota automatico «bravo» vince tutti e 6 i livelli (profilo marea)', () => {
  for (let lv = 0; lv < DIFESA.livelli.length; lv++) {
    for (const seme of [1, 2]) {
      const s = nuovaPartita(seme, lv, { profilo: 'marea' }), b = creaBot('bravo', seme);
      while (!s.esito && s.tick < 30 * 60 * TICK_HZ) passo(s, autopilota(s, b));
      assert.equal(s.esito, 'vinta', `livello ${lv + 1}, seme ${seme}: ${s.esito} all'ondata ${s.ondata}`);
    }
  }
});

test('chi non fa niente perde il livello 3; nel tutorial le ondate aspettano la prima pianta', () => {
  const s = nuovaPartita(4, 2, { profilo: 'marea' });
  while (!s.esito && s.tick < 20 * 60 * TICK_HZ) passo(s);
  assert.equal(s.esito, 'persa');
  const t = nuovaPartita(4, 0, { profilo: 'marea' });
  per(t, 60);
  assert.equal(t.ondata, 0, 'nessuna ondata senza piante');
  assert.equal(t.monete.length, 0, 'nessuna moneta dal cielo');
  pianta(t, 'sparatore', 2, 2);
  per(t, 30);
  assert.equal(t.ondata, 1, 'dopo la prima pianta parte la prima ondata');
});

test('Sopravvivenza: non finisce da sola, il budget cresce (n × 2 ÷ 5 + 1)', () => {
  const s = nuovaPartita(8, -1, { profilo: 'marea' }), b = creaBot('bravo', 3);
  assert.equal(puntiOndata(s, 0), 1); assert.equal(puntiOndata(s, 10), 5); assert.equal(puntiOndata(s, 30), 13);
  while (!s.esito && s.tick < 8 * 60 * TICK_HZ) passo(s, autopilota(s, b));
  assert.equal(s.esito, '', 'dopo 8 minuti si gioca ancora');
  assert.ok(s.ondata >= 12, `ondate lanciate: ${s.ondata}`);
});
