// Colpi di mischia ad arco (swing.ts): il fendente spazza 150° da destra a sinistra e colpisce quando la lama passa, non dietro;
// il caricato pieno è un giro completo; la lancia è un affondo stretto; l'arcotangente polinomiale coincide con Math.atan2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { angolo, bladeAngle, sweepTo } from '../src/dungeon/swing.ts';
import { COLPI, HOLD_TICKS } from '../src/dungeon/tuning.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { arena, heroBase, inp, katana, run } from './dungeon_util.ts';

const DEG = Math.PI / 180;
/** Bandito fermo ad angolo φ (+ = destra della faccia) e distanza d dall'eroe. */
function at(s: DungeonState, phiDeg: number, d: number): Enemy {
  const h = s.hero, p = phiDeg * DEG, rx = -h.fz, rz = h.fx;
  const e = newEnemy(s, 'bandito', h.x + d * (h.fx * Math.cos(p) + rx * Math.sin(p)), h.z + d * (h.fz * Math.cos(p) + rz * Math.sin(p)));
  e.vita = e.max = 1000; e.st = 'dorme';
  return e;
}
/** Tick (dall'inizio) in cui ogni nemico prende il primo colpo. */
function hitTicks(s: DungeonState, n: number, first: ReturnType<typeof inp>): Map<number, number> {
  const out = new Map<number, number>();
  for (let t = 0; t < n; t++) {
    run(s, 1, t === 0 ? first : inp());
    for (const e of s.eventi) if (e.t === 'colpo' && e.su === 'nemico' && e.id !== undefined && !out.has(e.id)) out.set(e.id, t);
  }
  return out;
}

test('swing: angolo() = Math.atan2 entro 1e-4 rad su tutto il giro', () => {
  let worst = 0;
  for (let i = 0; i < 3600; i++) {
    const a = (i / 3600) * 2 * Math.PI - Math.PI, r = 0.1 + (i % 7);
    const y = r * Math.sin(a), x = r * Math.cos(a);
    worst = Math.max(worst, Math.abs(angolo(y, x) - Math.atan2(y, x)));
  }
  assert.ok(worst < 1e-4, `errore massimo ${worst}`);
  assert.equal(angolo(0, 0), 0);
});

test('swing: la lama parte a destra e finisce a sinistra; sweepTo è 0 per chi sta sull’inizio dell’arco o addosso', () => {
  const c = COLPI.fendente;
  assert.equal(bladeAngle('fendente', 0), c.inizio);
  assert.ok(Math.abs(bladeAngle('fendente', 1) - (c.inizio - c.arco)) < 1e-12);
  assert.ok(bladeAngle('fendente', (c.da + c.a) / 2) < 1e-9 && bladeAngle('fendente', (c.da + c.a) / 2) > -1e-9, 'a metà finestra la lama è davanti');
  // faccia verso −z: destra = +x
  assert.equal(sweepTo('fendente', 0, -1, 1.5 * Math.sin(c.inizio), -1.5 * Math.cos(c.inizio), 0.4, false), 0);
  assert.equal(sweepTo('fendente', 0, -1, 0, 1.5, 0.4, true), 0);
  // davanti: a metà arco (meno la mezza larghezza del bersaglio)
  const w = Math.asin(0.4 / 1.5);
  assert.ok(Math.abs(sweepTo('fendente', 0, -1, 0, -1.5, 0.4, false) - (c.inizio - w)) < 1e-4);
  // dietro: oltre l'arco
  assert.ok(sweepTo('fendente', 0, -1, 0, 1.5, 0.4, false) > c.arco);
});

test('swing: fendente — colpisce anche di lato (65°), prima a destra poi a sinistra, mai dietro', () => {
  const s = arena(heroBase());
  const davanti = at(s, 0, 1.5), destra = at(s, 65, 1.6), sinistra = at(s, -65, 1.6), dietro = at(s, 180, 1.5);
  const hit = hitTicks(s, 60, inp({ a: true }));
  assert.ok(s.hero.fx > 0.99, 'la mira assistita resta sul nemico davanti');
  assert.ok(hit.has(davanti.id) && hit.has(destra.id) && hit.has(sinistra.id), `colpiti: ${[...hit.keys()]}`);
  assert.ok(!hit.has(dietro.id), 'chi sta dietro non si prende il fendente');
  assert.ok(hit.get(destra.id)! < hit.get(davanti.id)! && hit.get(davanti.id)! < hit.get(sinistra.id)!, `ordine ${JSON.stringify([...hit])}`);
  // fuori dall'arco (90° di lato): niente
  const s2 = arena(heroBase());
  at(s2, 0, 1.5); const lato = at(s2, 100, 1.5);
  assert.ok(!hitTicks(s2, 60, inp({ a: true })).has(lato.id));
});

test('swing: caricato pieno = giro completo, prende anche chi sta dietro (e lo spinge via dall’eroe se sbilancia)', () => {
  const s = arena(heroBase({ arma: katana({ traits: { sbilancia: true } }) }));
  const davanti = at(s, 0, 1.5), dietro = at(s, 180, 1.5);
  const carica = Math.ceil(s.runHero.arma.carica * (1 + s.runHero.armatura.malus) * 60) + HOLD_TICKS + 5;
  run(s, carica, inp({ a: true }));
  assert.equal(dungeon.view(s).hero.carica, 1);
  const x0 = dietro.x;
  const hit = hitTicks(s, 90, inp());
  assert.ok(hit.has(davanti.id) && hit.has(dietro.id), `colpiti: ${[...hit.keys()]}`);
  assert.ok(dietro.x < x0, 'spinto via dall’eroe (verso −x)');
  // il giro dura di più di uno swing normale e la vista lo dice
  const s2 = arena(heroBase()); at(s2, 0, 1.5);
  run(s2, carica, inp({ a: true })); run(s2, 1);
  assert.equal(dungeon.view(s2).hero.stile, 'giro');
});

test('swing: lancia = affondo stretto — lontano davanti sì, di lato no', () => {
  const lancia = katana({ id: 'lancia_ferro', classe: 'pesante', skill: 'armiPesanti', portata: 3, tempo: 0.9 });
  const s = arena(heroBase({ arma: lancia }));
  const lontano = at(s, 0, 2.7), lato = at(s, 55, 2.9); // la mira assistita prende il più vicino davanti
  run(s, 1, inp({ a: true })); run(s, 1);
  assert.equal(dungeon.view(s).hero.stile, 'affondo');
  const hit = hitTicks(s, 60, inp());
  assert.ok(hit.has(lontano.id), 'la punta arriva a 2,7 m');
  assert.ok(!hit.has(lato.id), 'l’affondo non spazza di lato');
});
