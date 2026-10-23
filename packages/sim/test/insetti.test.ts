// Test degli insetti di Borgo Marea (#445): catalogo, stagioni e notte, insetti in giro uguali per tutti, sassi e alberi (uno al giorno
// a testa), retino, cattura (zaino a peso 0, «visto»), consegna al mobiliere («posseduto») e vendita al Contrabbandiere (non posseduto).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSETTI, RETINO, validateInsetti } from '@marea/content/insetti.ts';
import { newLot } from '../src/index.ts';
import { compraPala } from '../src/rpg/pala.ts';
import { ALBERI_BORGO, SASSI_BORGO, disponibile, esceDa, faseCiclo, insettiOf, liberiDelTurno, liberoValido, notteAt, possiedeRetino, stagioneAt, turnoAt, turnoMs } from '../src/economy/insetti.ts';
import { isCellaScavabileBorgo as isCellaScavabileOk } from '../src/economy/pala.ts';
import { carried, heroOf } from '../src/rpg/hero.ts';
import { itemDef } from '../src/rpg/items.ts';
import { applyRpgAction } from '../src/rpg/actions.ts';
import { catturaInsetto, compraRetino, cercaInsetto, consegnaInsetto } from '../src/rpg/insetti.ts';
import { conMonete } from './monete_util.ts';

/** Le chiavi di PAL (apps/client/src/ui/style.ts, ART_BIBLE §2). */
const PALETTE = ['sabbiaChiara', 'sabbia', 'legnoChiaro', 'legno', 'legnoScuro', 'ombraCalda', 'erbaChiara', 'erba', 'erbaScura', 'bosco', 'acquaBassa', 'acqua', 'acquaProfonda', 'abisso',
  'pietraChiara', 'pietra', 'pietraScura', 'roccia', 'neroCaldo', 'rosso', 'arancio', 'giallo', 'viola', 'rosaNeon'];
const OTT = Date.UTC(2026, 9, 19, 10, 0, 0);

test('insetti: catalogo valido, 62 specie nello zaino a peso 0, retino strumento a peso 0', () => {
  assert.deepEqual(validateInsetti(PALETTE), []);
  assert.equal(INSETTI.length, 62);
  for (const i of INSETTI) {
    const it = itemDef(i.id);
    assert.equal(it.kind, 'insetto');
    assert.equal(it.peso, 0);
    assert.equal(it.valore, i.prezzo);
  }
  assert.equal(itemDef('retino').kind, 'strumento');
  assert.equal(itemDef('retino').peso, 0);
  assert.equal(RETINO.monete, 500);
  // i prezzi sono quelli dell'Excel ÷ 10
  assert.equal(INSETTI.find((i) => i.id === 'ercole')!.prezzo, 1200);
  assert.equal(INSETTI.find((i) => i.id === 'porcellino')!.prezzo, 25);
  assert.equal(INSETTI.find((i) => i.id === 'atlante')!.prezzo, 1000, 'seconda infornata: Excel ÷ 10 anche lei');
  assert.equal(INSETTI.find((i) => i.id === 'mosca')!.prezzo, 6);
  for (const c of SASSI_BORGO) assert.equal(isCellaScavabileOk(c), false, 'sul sasso non si scava');
  assert.ok(ALBERI_BORGO.length >= 8);
});

test('insetti: stagioni dal calendario di Roma, notte dal ciclo di 24 ore', () => {
  assert.equal(stagioneAt(OTT), 'autunno');
  assert.equal(stagioneAt(Date.UTC(2026, 11, 28, 20)), 'inverno');
  assert.equal(stagioneAt(Date.UTC(2027, 3, 1, 12)), 'primavera');
  assert.equal(stagioneAt(Date.UTC(2027, 6, 1, 12)), 'estate');
  assert.equal(stagioneAt(Date.UTC(2026, 10, 30, 23, 30)), 'inverno', 'a Roma è già il primo dicembre');
  const giro = 24 * 3600_000, t0 = Date.UTC(2026, 9, 19, 4, 0, 0); // ore 06:00 a Roma (CEST, UTC+2)
  assert.equal(faseCiclo(t0), 0);
  assert.equal(notteAt(t0 + giro * 0.3), false);
  assert.equal(notteAt(t0 + giro * 0.75), true);
  const falena = INSETTI.find((i) => i.id === 'falena')!, cavolaia = INSETTI.find((i) => i.id === 'cavolaia')!, cicala = INSETTI.find((i) => i.id === 'cicala')!;
  assert.equal(disponibile(falena, t0 + giro * 0.75), true);
  assert.equal(disponibile(falena, t0 + giro * 0.3), false);
  assert.equal(disponibile(cavolaia, t0 + giro * 0.3), true);
  assert.equal(disponibile(cicala, OTT), false, 'la cicala è estiva');
});

test('insetti: in giro uguali per tutti, della stagione e dell\'ora giusta, sulle celle del Borgo', () => {
  const giro = 24 * 3600_000;
  let notte = 0, giorno = 0;
  for (let t = OTT; t < OTT + giro; t += 3600_000) {
    const turno = turnoAt(t), liberi = liberiDelTurno(turno), [a, b] = turnoMs(turno), meta = (a + b) / 2;
    assert.deepEqual(liberiDelTurno(turno), liberi, 'deterministico');
    assert.ok(liberi.length >= 5);
    for (const l of liberi) {
      const d = INSETTI.find((i) => i.id === l.id)!;
      assert.ok(d.tipo === 'volante' || d.tipo === 'terra');
      assert.equal(disponibile(d, meta), true, `${d.id} fuori stagione o fuori ora`);
      assert.equal(isCellaScavabileOk(l.cell), true);
      assert.equal(liberoValido(l.k, meta)?.id, l.id);
      if (notteAt(meta)) notte++; else giorno++;
    }
    assert.equal(liberoValido(liberi[0]!.k, b + 5 * 60_000), null, 'due turni dopo è volato via');
  }
  assert.ok(notte > 0 && giorno > 0);
});

test('insetti: retino, sassi con la pala e alberi una volta al giorno a testa, cattura nello zaino a peso 0', () => {
  let lot = conMonete(newLot('alice', OTT), 2000);
  assert.throws(() => catturaInsetto(lot, 'a:0:0', OTT), /Serve il retino/);
  const m0 = lot.monete;
  lot = compraRetino(lot, OTT);
  assert.equal(possiedeRetino(lot), true);
  assert.equal(lot.monete, m0 - 500);
  assert.throws(() => compraRetino(lot, OTT), /già il retino/);
  assert.throws(() => cercaInsetto(lot, 'sasso', 0, OTT), /Serve la pala/);
  lot = compraPala(lot, OTT);
  const peso0 = carried(heroOf(lot));

  // cerca un sasso da cui oggi esce qualcosa per alice
  const idx = SASSI_BORGO.findIndex((_, i) => esceDa('sasso', i, 'alice', OTT));
  assert.ok(idx >= 0);
  const r = cercaInsetto(lot, 'sasso', idx, OTT);
  assert.ok(r.uscito);
  assert.equal(r.uscito!.id, esceDa('sasso', idx, 'alice', OTT)!.id);
  const again = cercaInsetto(r.lot, 'sasso', idx, OTT + 1000);
  assert.equal(again.uscito, null);
  assert.equal(again.gia, true);
  // dopo la finestra (più il margine) è scappato
  assert.throws(() => catturaInsetto(r.lot, r.uscito!.k, OTT + 60_000), /scappato/);
  const c = catturaInsetto(r.lot, r.uscito!.k, OTT + 1500);
  assert.equal(heroOf(c.lot).inv[c.id], 1);
  assert.equal(carried(heroOf(c.lot)), peso0, 'gli insetti non pesano');
  assert.equal(insettiOf(c.lot, OTT).visti[c.id], 1);
  assert.throws(() => catturaInsetto(c.lot, r.uscito!.k, OTT + 1600), /scappato/);
  // domani il sasso torna buono
  const domani = OTT + 86_400_000;
  assert.deepEqual(insettiOf(c.lot, domani).sassi, []);
  assert.equal(cercaInsetto(c.lot, 'sasso', idx, domani).gia, false);

  // gli alberi non vogliono attrezzi
  const nuda = newLot('bob', OTT);
  const ia = ALBERI_BORGO.findIndex((_, i) => esceDa('albero', i, 'bob', OTT));
  const ra = cercaInsetto(nuda, 'albero', ia, OTT);
  assert.ok(ra.uscito);
  assert.equal(cercaInsetto(ra.lot, 'albero', ia, OTT).gia, true);
  assert.throws(() => cercaInsetto(nuda, 'albero', 999, OTT), /sconosciuto/);
});

test('insetti: in giro si prende una volta sola; consegna al mobiliere (posseduto) o vendita al Contrabbandiere (no)', () => {
  let lot = compraRetino(conMonete(newLot('alice', OTT), 600), OTT);
  const l = liberiDelTurno(turnoAt(OTT))[0]!;
  const c = catturaInsetto(lot, l.k, OTT);
  assert.equal(c.id, l.id);
  assert.throws(() => catturaInsetto(c.lot, l.k, OTT + 10), /già preso/);
  lot = c.lot;
  // consegna: sparisce dallo zaino, posseduto
  const dato = consegnaInsetto(lot, l.id, OTT + 20);
  assert.equal(heroOf(dato).inv[l.id] ?? 0, 0);
  assert.deepEqual(insettiOf(dato, OTT).posseduti, [l.id]);
  assert.throws(() => consegnaInsetto(dato, l.id, OTT + 30), /Non hai/);
  // un altro uguale: il mobiliere ce l'ha già, si vende al Contrabbandiere a prezzo pieno
  const l2 = liberiDelTurno(turnoAt(OTT)).find((x) => x.id === l.id && x.k !== l.k) ?? null;
  const preso = l2 ? catturaInsetto(dato, l2.k, OTT + 40).lot : { ...dato, hero: { ...heroOf(dato), inv: { ...heroOf(dato).inv, [l.id]: 1 } } };
  assert.throws(() => consegnaInsetto(preso, l.id, OTT + 50), /ce l’ha già/);
  const prima = preso.monete, prezzo = INSETTI.find((i) => i.id === l.id)!.prezzo;
  const venduto = applyRpgAction(preso, { t: 'contrabbando', op: 'vendi', item: l.id, n: 1 }, OTT + 60);
  assert.equal(venduto.monete, prima + prezzo);
  assert.equal(heroOf(venduto).inv[l.id] ?? 0, 0);
  // venderlo non lo rende posseduto
  const solo = catturaInsetto(compraRetino(conMonete(newLot('carla', OTT), 600), OTT), l.k, OTT).lot;
  const v2 = applyRpgAction(solo, { t: 'contrabbando', op: 'vendi', item: l.id, n: 1 }, OTT + 10);
  assert.equal(insettiOf(v2, OTT).posseduti.length, 0);
  assert.equal(insettiOf(v2, OTT).visti[l.id], 1);
});
