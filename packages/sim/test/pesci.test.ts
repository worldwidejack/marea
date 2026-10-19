// Test dei pesci (#457): catalogo dall'Excel di Riccardo, ombre uguali per tutti (riva sulle acque del Borgo, barca al largo) della
// stagione e dell'ora giuste, dove si pesca dalla barca, canna, cattura (zaino a peso 0, «visto»), consegna al mobiliere («catturato»),
// vendita al Contrabbandiere, traguardi dei pesci, e il vecchio minigioco della Pesca che non c'è più.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, ISLANDS } from '@marea/content';
import { ACQUA_RIVA, CANNA, PESCI, PESCI_CFG, tagliaDi, validatePesci } from '@marea/content/pesci.ts';
import { DIARIO, TRAGUARDI, validateDiario } from '@marea/content/diario.ts';
import { newLot } from '../src/index.ts';
import { barcaQui, ombraValida, ombreDelTurno, pesceDisponibile, pesciAt, pesciOf, possiedeCanna, turnoPesciAt, turnoPesciMs } from '../src/economy/pesci.ts';
import { notteAt } from '../src/economy/insetti.ts';
import { progresso } from '../src/economy/diario.ts';
import { MINIGAMES } from '../src/minigames/registry.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';
import { carried, heroOf } from '../src/rpg/hero.ts';
import { itemDef } from '../src/rpg/items.ts';
import { applyRpgAction } from '../src/rpg/actions.ts';
import { catturaPesce, compraCanna, consegnaPesce } from '../src/rpg/pesci.ts';
import { conMonete } from './monete_util.ts';

const PALETTE = ['sabbiaChiara', 'sabbia', 'legnoChiaro', 'legno', 'legnoScuro', 'ombraCalda', 'erbaChiara', 'erba', 'erbaScura', 'bosco', 'acquaBassa', 'acqua', 'acquaProfonda', 'abisso',
  'pietraChiara', 'pietra', 'pietraScura', 'roccia', 'neroCaldo', 'rosso', 'arancio', 'giallo', 'viola', 'rosaNeon'];
const OTT = Date.UTC(2026, 9, 19, 10, 0, 0);

test('pesci: catalogo valido, 32 specie nello zaino a peso 0, canna strumento a peso 0, prezzi Excel ÷ 10', () => {
  assert.deepEqual(validatePesci(PALETTE), []);
  assert.deepEqual(validateDiario(), []);
  assert.equal(PESCI.length, 32);
  assert.equal(PESCI.filter((p) => p.zona === 'riva').length, 16);
  for (const p of PESCI) {
    const it = itemDef(p.id);
    assert.equal(it.kind, 'pesce');
    assert.equal(it.peso, 0);
    assert.equal(it.valore, p.prezzo);
  }
  assert.equal(itemDef('canna').kind, 'strumento');
  assert.equal(itemDef('canna').peso, 0);
  assert.equal(CANNA.monete, 500);
  assert.equal(PESCI.find((p) => p.id === 'ghiozzo')!.prezzo, 10);
  assert.equal(PESCI.find((p) => p.id === 'squalo_bianco')!.prezzo, 1500);
  assert.equal(tagliaDi(PESCI.find((p) => p.id === 'celacanto')!).id, 'xl');
  // più è grande l'ombra, più tocchi servono
  for (let i = 1; i < PESCI_CFG.taglie.length; i++) assert.ok(PESCI_CFG.taglie[i]!.strappi > PESCI_CFG.taglie[i - 1]!.strappi);
  assert.ok(ACQUA_RIVA.length > 100, `${ACQUA_RIVA.length} celle d'acqua di riva`);
});

test('pesci: il vecchio minigioco della Pesca non c\'è più, e nemmeno nelle medaglie del Diario', () => {
  assert.equal(Object.hasOwn(MINIGAMES, 'pesca'), false);
  assert.equal(DIARIO.minigiochi.some((m) => m.id === 'pesca'), false);
});

test('pesci: le ombre del turno sono uguali per tutti, della stagione, dell\'ora e della zona giuste', () => {
  const giro = 24 * 60_000;
  let notte = 0, giorno = 0;
  for (let t = OTT; t < OTT + giro * 3; t += PESCI_CFG.turno.minuti * 60_000) {
    const turno = turnoPesciAt(t), ombre = ombreDelTurno(turno), [a, b] = turnoPesciMs(turno), meta = (a + b) / 2;
    assert.deepEqual(ombreDelTurno(turno), ombre, 'deterministico');
    assert.equal(ombre.filter((o) => o.zona === 'riva').length, PESCI_CFG.turno.riva);
    assert.equal(ombre.filter((o) => o.zona === 'barca').length, PESCI_CFG.turno.barca);
    for (const o of ombre) {
      const d = PESCI.find((p) => p.id === o.id)!;
      assert.equal(d.zona, o.zona);
      assert.equal(pesceDisponibile(d, meta), true, `${d.id} fuori stagione o fuori ora`);
      assert.equal(ombraValida(o.k, meta)?.id, o.id);
      if (o.zona === 'riva') assert.ok(ACQUA_RIVA.some((c) => c[0] === o.cell![0] && c[1] === o.cell![1]), 'riva sulle acque del Borgo');
      else assert.equal(o.cell, null);
    }
    assert.equal(ombraValida(ombre[0]!.k, b + 5 * 60_000), null, 'due turni dopo è andata via');
    if (notteAt(meta)) notte++; else giorno++;
  }
  assert.ok(notte > 0 && giorno > 0);
  assert.equal(ombraValida('r:abc:1', OTT), null);
  assert.equal(ombraValida('x:1:1', OTT), null);
  // d'autunno: niente pesci dell'estate
  assert.equal(pesciAt('barca', OTT).some((p) => p.id === 'pesce_spada'), false);
  assert.ok(pesciAt('riva', OTT).some((p) => p.id === 'triglia'));
});

test('pesci: dalla barca si pesca in acqua, lontano dalla riva e a barca ferma', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
  const porto = arch.places.find((p) => p.role === 'porto')!;
  assert.equal(barcaQui(arch, porto.spawn.x, porto.spawn.z, 0).perche, 'terra');
  assert.notEqual(barcaQui(arch, porto.boat.x, porto.boat.z, 0).ok, true, 'al molo si pesca da riva');
  let largo: { x: number; z: number } | null = null;
  for (let r = 20; r < 200 && !largo; r += 4) for (let a = 0; a < 6.28 && !largo; a += 0.3) {
    const x = porto.boat.x + Math.sin(a) * r, z = porto.boat.z + Math.cos(a) * r;
    if (barcaQui(arch, x, z, 0).ok) largo = { x, z };
  }
  assert.ok(largo, 'al largo del Porto si pesca');
  assert.equal(barcaQui(arch, largo.x, largo.z, 3).perche, 'veloce');
});

test('pesci: canna, cattura nello zaino a peso 0 e una volta sola per ombra, consegna, vendita', () => {
  let lot = conMonete(newLot('alice', OTT), 1200);
  const o = ombreDelTurno(turnoPesciAt(OTT))[0]!;
  assert.throws(() => catturaPesce(lot, o.k, OTT), /Serve la canna/);
  const m0 = lot.monete;
  lot = compraCanna(lot, OTT);
  assert.equal(possiedeCanna(lot), true);
  assert.equal(lot.monete, m0 - 500);
  assert.throws(() => compraCanna(lot, OTT), /già la canna/);
  const peso0 = carried(heroOf(lot));
  const c = catturaPesce(lot, o.k, OTT + 1000);
  assert.equal(c.id, o.id);
  assert.equal(heroOf(c.lot).inv[o.id], 1);
  assert.equal(carried(heroOf(c.lot)), peso0, 'i pesci non pesano');
  assert.equal(pesciOf(c.lot, OTT).visti[o.id], 1);
  assert.throws(() => catturaPesce(c.lot, o.k, OTT + 1100), /già preso/);
  assert.throws(() => catturaPesce(c.lot, 'r:1:99', OTT), /andato via/);
  // un altro giocatore la stessa ombra la pesca anche lui
  const bob = catturaPesce(compraCanna(conMonete(newLot('bob', OTT), 600), OTT), o.k, OTT + 2000);
  assert.equal(bob.id, o.id);
  // consegna: sparisce dallo zaino, «catturato»
  const dato = consegnaPesce(c.lot, o.id, OTT + 3000);
  assert.equal(heroOf(dato).inv[o.id] ?? 0, 0);
  assert.deepEqual(pesciOf(dato, OTT).posseduti, [o.id]);
  assert.throws(() => consegnaPesce(dato, o.id, OTT + 3100), /Non hai/);
  const dinuovo = { ...dato, hero: { ...heroOf(dato), inv: { ...heroOf(dato).inv, [o.id]: 1 } } };
  assert.throws(() => consegnaPesce(dinuovo, o.id, OTT + 3200), /ce l’ha già/);
  // il Contrabbandiere lo paga a prezzo pieno
  const prima = dinuovo.monete, prezzo = PESCI.find((p) => p.id === o.id)!.prezzo;
  const venduto = applyRpgAction(dinuovo, { t: 'contrabbando', op: 'vendi', item: o.id, n: 1 }, OTT + 3300);
  assert.equal(venduto.monete, prima + prezzo);
  // le ombre pescate dei turni vecchi si dimenticano
  const tardi = OTT + 30 * 60_000;
  assert.deepEqual(pesciOf(c.lot, tardi).presi, []);
});

test('pesci: i traguardi dei pesci contano la collezione nuova', () => {
  let lot = compraCanna(conMonete(newLot('alice', OTT), 600), OTT);
  const t = TRAGUARDI.find((x) => x.id === 'primo_pesce')!, specie = TRAGUARDI.find((x) => x.id === 'naturalista')!;
  assert.equal(progresso(lot, t, { amici: 0 }).fatto, 0);
  lot = catturaPesce(lot, ombreDelTurno(turnoPesciAt(OTT))[0]!.k, OTT).lot;
  assert.equal(progresso(lot, t, { amici: 0 }).fatto, 1);
  assert.equal(progresso(lot, specie, { amici: 0 }).fatto, 1);
});
