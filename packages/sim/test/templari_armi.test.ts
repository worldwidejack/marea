// Armi dei Templari (docs/TEMPLARI.md §6-7): arco teso che tira anche fuori dalle finestre, pistola con la ricarica, trombone a ventaglio,
// fuoco greco con le fiamme, armi sul muro (compra e munizioni), cassa del tesoro (arma, teschio che rende i punti e la sposta),
// scudo templare (para davanti in mano e dietro sulle spalle), scudato che para i colpi da davanti e lascia lo scudo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { daiArma } from '../src/templari/eroe.ts';
import { ferisci } from '../src/templari/colpi.ts';
import { nuovoZombie, slotDi } from '../src/templari/stato.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const passi = (s: TState, n: number, f: Partial<DungeonInput> = {}) => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, { ...F, ...f }); };
/** Partita in combattimento senza comparse (ondata 1 già finita di uscire): gli zombie li mettiamo noi. */
function arena(seed = 1): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = 1; s.quanti = 0; s.usciti = 0; s.prossima = 1e9;
  return s;
}
function zombie(s: TState, x: number, z: number, tipo = 'fante') {
  const zz = nuovoZombie(s, tipo, x, z, 0); zz.st = 'insegue'; zz.stT = 0; zz.vel = 0;
  return zz;
}
const vai = (s: TState, x: number, z: number) => { s.eroe.x = x; s.eroe.z = z; };

test('arco: tieni per tendere, lascia: la freccia colpisce da lontano, anche fuori da una finestra', () => {
  const s = arena();
  daiArma(s, 'arco');
  const h = s.eroe, f = s.arena.finestre[0]!;
  // l'eroe dentro davanti alla finestra, lo zombie fuori dietro le assi
  vai(s, f.dentro.x, f.dentro.z);
  const dx = f.fuori.x - f.dentro.x, dz = f.fuori.z - f.dentro.z;
  const z = zombie(s, f.fuori.x + dx * 2, f.fuori.z + dz * 2); z.vita = 400; z.max = 400;
  h.fx = dx; h.fz = dz;
  const colpi0 = h.armi[h.cur]!.colpi;
  passi(s, Math.round(armaDef('arco').tempo * 60) + 2, { a: true });
  passi(s, 40);
  assert.equal(h.armi[h.cur]!.colpi, colpi0 - 1, 'una freccia in meno');
  assert.equal(z.st, 'morto', `zombie ancora vivo: ${z.vita}`);
});

test('pistola: un colpo, poi la ricarica da sola dalla riserva', () => {
  const s = arena();
  daiArma(s, 'pistola');
  const sl = s.eroe.armi[s.eroe.cur]!, a = armaDef('pistola');
  zombie(s, s.eroe.x - 6, s.eroe.z).vita = 1e6;
  passi(s, 1, { a: true }); passi(s, 1);
  assert.equal(sl.colpi, 0);
  assert.ok(s.eroe.ricarica > 0, 'ricarica partita');
  passi(s, Math.round(a.ricarica! * 60) + 2);
  assert.equal(sl.colpi, 1);
  assert.equal(sl.riserva, a.riserva! - 1);
});

test('trombone: i pallini a ventaglio prendono più zombie da vicino', () => {
  const s = arena();
  daiArma(s, 'trombone');
  const h = s.eroe; h.fx = -1; h.fz = 0;
  const zs = [-0.9, 0, 0.9].map((o) => { const z = zombie(s, h.x - 4, h.z + o); z.vita = 1e6; z.max = 1e6; return z; });
  passi(s, 1, { a: true }); passi(s, 30);
  assert.ok(zs.filter((z) => z.vita < 1e6).length >= 2, `colpiti ${zs.filter((z) => z.vita < 1e6).length} su 3`);
});

test('fuoco greco: il vaso esplode e lascia fiamme che bruciano', () => {
  const s = arena();
  daiArma(s, 'fuoco_greco');
  const h = s.eroe; h.fx = -1; h.fz = 0;
  const z = zombie(s, h.x - 6, h.z); z.vita = 1e6; z.max = 1e6;
  passi(s, 1, { a: true }); passi(s, 60);
  assert.ok(z.vita < 1e6 - armaDef('fuoco_greco').danno + 1, `danno dell'esplosione: ${1e6 - z.vita}`);
  assert.ok(s.fiamme.length >= 1, 'niente fiamme');
  const v0 = z.vita; passi(s, 60);
  assert.ok(z.vita < v0, 'le fiamme non bruciano');
});

test('armi sul muro: compra coi punti, poi munizioni a metà prezzo; senza punti niente', () => {
  const s = arena();
  const m = s.arena.muri.find((x) => x.arma === 'mazza')!, prezzo = armaDef('mazza').prezzo!;
  vai(s, m.x, m.z);
  s.punti = prezzo - 1;
  passi(s, 1, { d: true }); passi(s, 1);
  assert.ok(!s.eroe.armi.some((x) => x?.id === 'mazza'), 'comprata senza punti');
  s.punti = prezzo + 10;
  passi(s, 1, { d: true }); passi(s, 1);
  assert.ok(s.eroe.armi.some((x) => x?.id === 'mazza'), 'mazza non comprata');
  assert.equal(s.punti, 10);
  // l'arco sull'altare laterale è gratis, le frecce costano
  const r = s.arena.muri.find((x) => x.arma === 'arco')!;
  vai(s, r.x, r.z); passi(s, 1, { d: true }); passi(s, 1);
  const sl = s.eroe.armi.find((x) => x?.id === 'arco')!;
  assert.ok(sl, 'arco non preso');
  sl.colpi = 0; s.punti = 1000;
  passi(s, 1, { d: true }); passi(s, 1);
  assert.equal(s.punti, 1000 - armaDef('arco').prezzoMunizioni!);
  assert.deepEqual(s.eroe.armi.find((x) => x?.id === 'arco'), slotDi(armaDef('arco')), 'frecce non ricaricate');
});

test('cassa del tesoro: gira, esce un\'arma che non hai, la prendi; al teschio i punti tornano e la cassa si sposta', () => {
  const s = arena(3);
  const c = s.cassa, p = s.arena.casse[c.posto]!, k = TEMPLARI.cassa;
  vai(s, p.x + p.fx * 1.2, p.z + p.fz * 1.2);
  s.punti = 10 * k.prezzo;
  c.max = 2;
  passi(s, 1, { d: true }); passi(s, 1);
  assert.equal(c.fase, 'gira');
  passi(s, Math.round(k.gira * 60) + 2);
  assert.equal(c.fase, 'pronta');
  const arma = c.arma!;
  assert.ok(arma && arma !== 'spada' && (armaDef(arma).cassa ?? 0) > 0, `arma: ${arma}`);
  passi(s, 1, { d: true }); passi(s, 1);
  assert.ok(s.eroe.armi.some((x) => x?.id === arma), 'arma della cassa non presa');
  const punti = s.punti, posto = c.posto;
  passi(s, 1, { d: true }); passi(s, 1);
  passi(s, Math.round(k.gira * 60) + 2);
  assert.equal(c.fase, 'teschio');
  assert.equal(s.punti, punti, 'il teschio non ha reso i punti');
  passi(s, Math.round((3 + k.vola) * 60) + 4);
  assert.equal(c.fase, 'chiusa');
  assert.notEqual(c.posto, posto, 'la cassa non si è spostata');
});

test('scudo: in mano para davanti, sulle spalle para dietro, a zero si spacca', () => {
  const s = arena();
  const h = s.eroe; h.fx = 1; h.fz = 0;
  h.scudo = { vita: TEMPLARI.scudo.vita };
  ferisci(s, 40, h.x - 2, h.z); // da dietro, scudo sulle spalle
  assert.equal(h.vita, 100); assert.equal(h.scudo.vita, TEMPLARI.scudo.vita - 40);
  ferisci(s, 40, h.x + 2, h.z); // da davanti: passa
  assert.equal(h.vita, 60);
  h.inMano = true; h.vita = 100;
  ferisci(s, 40, h.x + 2, h.z); // in mano, da davanti: para
  assert.equal(h.vita, 100);
  ferisci(s, 1e5, h.x + 2, h.z);
  assert.equal(h.scudo, null); assert.equal(h.inMano, false);
});

test('scudato: para i colpi da davanti, da dietro si ferisce; morto lascia lo scudo, AZIONE lo prende', () => {
  const s = arena();
  const h = s.eroe;
  const z = zombie(s, h.x - 1.6, h.z, 'scudato'); z.vita = 5000; z.max = 5000;
  z.fx = 1; z.fz = 0; h.fx = -1; h.fz = 0; // si guardano
  passi(s, 1, { a: true }); passi(s, 50);
  assert.equal(z.vita, 5000, 'il colpo da davanti è passato');
  z.fx = -1; // girato di spalle
  z.vita = 100;
  passi(s, 1, { a: true }); passi(s, 50);
  assert.equal(z.st, 'morto');
  assert.equal(s.drops.length, 1);
  vai(s, s.drops[0]!.x + 0.5, s.drops[0]!.z);
  passi(s, 1, { d: true }); passi(s, 1);
  assert.ok(h.scudo && h.scudo.vita === TEMPLARI.scudo.vita, 'scudo non preso');
  // SCAMBIA: arma → scudo in mano → arma
  passi(s, 1, { c: true }); passi(s, 1);
  assert.equal(h.inMano, true);
  passi(s, 1, { c: true }); passi(s, 1);
  assert.equal(h.inMano, false);
});
