// Test della pala di Borgo Marea (#438): acquisto al negozio dei mobili (500 monete, peso 0 in categoria "strumento"),
// celle scavabili di Borgo Marea, bottino giornaliero (10-200 monete, sparisce solo per chi lo scava), seppellimento e
// dissotterramento di oggetti dello zaino, mobili non posati e quantità a scelta di monete.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BORGO, MOBILI } from '@marea/content';
import { compraMobile, newLot } from '../src/index.ts';
import { bottinoDelGiorno, bottinoRiscossoOggi, celleScavabiliBorgo, isCellaScavabileBorgo, possiedePala, riscuotiBottino } from '../src/economy/pala.ts';
import { carried, heroOf } from '../src/rpg/hero.ts';
import { itemDef } from '../src/rpg/items.ts';
import { compraPala, parseBucaDono, prelevaPerSeppellire, riceviSeppellito } from '../src/rpg/pala.ts';
import { conMonete } from './monete_util.ts';

test('pala: definita come strumento a peso 0, si compra al negozio dei mobili per 500 monete', () => {
  const def = itemDef('pala');
  assert.equal(def.kind, 'strumento');
  assert.equal(def.peso, 0);
  assert.equal(BORGO.pala.monete, 500);

  let lot = conMonete(newLot('alice', 1000), 600);
  const monetePrima = lot.monete;
  const pesoPrima = carried(heroOf(lot));
  assert.equal(possiedePala(lot), false);

  lot = compraPala(lot, 2000);
  assert.equal(possiedePala(lot), true);
  assert.equal(lot.monete, monetePrima - 500);
  assert.equal(heroOf(lot).inv['pala'], 1);
  assert.equal(carried(heroOf(lot)), pesoPrima, 'la pala pesa 0 kg nello zaino');

  assert.throws(() => compraPala(lot, 3000), /Hai già la pala/);
});

test('pala: celle scavabili di Borgo Marea e bottino giornaliero (10-200 monete, personale per ogni player)', () => {
  const celle = celleScavabiliBorgo();
  assert.ok(celle.length > 200, `attese > 200 celle scavabili, trovate ${celle.length}`);
  for (const c of celle) assert.equal(isCellaScavabileBorgo(c), true);
  assert.equal(isCellaScavabileBorgo([0, 0]), false);

  const t0 = Date.UTC(2026, 9, 19, 10, 0, 0);
  const b = bottinoDelGiorno(t0);
  assert.equal(isCellaScavabileBorgo(b.cell), true);
  assert.ok(b.monete >= 10 && b.monete <= 200, `monete bottino: ${b.monete}`);
  assert.deepEqual(bottinoDelGiorno(t0 + 3600_000), b, 'stesso giorno = stesso bottino');

  // Alice e Bob vedono lo stesso bottino; quando Alice lo scava sparisce per lei ma resta per Bob
  const alice0 = compraPala(conMonete(newLot('alice', t0), 1000), t0);
  const bob0 = compraPala(conMonete(newLot('bob', t0), 1000), t0);
  assert.equal(bottinoRiscossoOggi(alice0, t0), false);
  assert.equal(bottinoRiscossoOggi(bob0, t0), false);

  const rAlice = riscuotiBottino(alice0, t0);
  assert.equal(rAlice.monete, b.monete);
  assert.equal(rAlice.lot.monete, alice0.monete + b.monete);
  assert.equal(bottinoRiscossoOggi(rAlice.lot, t0), true);
  assert.throws(() => riscuotiBottino(rAlice.lot, t0), /già scavato/);

  // Per Bob il bottino è ancora disponibile oggi
  assert.equal(bottinoRiscossoOggi(bob0, t0), false);
  const rBob = riscuotiBottino(bob0, t0);
  assert.equal(rBob.monete, b.monete);
  assert.equal(bottinoRiscossoOggi(rBob.lot, t0), true);

  // Il giorno dopo ritorna disponibile anche per Alice
  const domani = t0 + 86_400_000;
  assert.equal(bottinoRiscossoOggi(rAlice.lot, domani), false);
});

test('pala: seppellire e dissotterrare oggetti dello zaino, mobili non posati e monete tra due player', () => {
  const t0 = 10_000;
  const mobId = MOBILI[0]!.id;
  let alice = compraPala(conMonete(newLot('alice', t0), 2000), t0);
  let bob = compraPala(conMonete(newLot('bob', t0), 1000), t0);

  // La pala stessa non si può seppellire
  assert.throws(() => prelevaPerSeppellire(alice, { tipo: 'oggetto', id: 'pala', n: 1 }, t0), /non si può seppellire/);

  // 1. Passaggio di un oggetto dello zaino (katana_legno equipaggiata → si toglie anche dall'equip)
  const pOggetto = prelevaPerSeppellire(alice, { tipo: 'oggetto', id: 'katana_legno', n: 1 }, t0);
  alice = pOggetto.lot;
  assert.equal(heroOf(alice).inv['katana_legno'] ?? 0, 0);
  assert.equal(heroOf(alice).equip.arma, undefined);

  const rOggetto = riceviSeppellito(bob, pOggetto.dono, t0);
  bob = rOggetto.lot;
  assert.equal(heroOf(bob).inv['katana_legno'], 2);

  // 2. Passaggio di un mobile non posato nella casa
  alice = compraMobile(alice, mobId, t0);
  assert.equal(alice.casa?.magazzino?.[mobId], 1);
  const pMobile = prelevaPerSeppellire(alice, { tipo: 'mobile', id: mobId, n: 1 }, t0);
  alice = pMobile.lot;
  assert.equal(alice.casa?.magazzino?.[mobId] ?? 0, 0);

  const rMobile = riceviSeppellito(bob, pMobile.dono, t0);
  bob = rMobile.lot;
  assert.equal(bob.casa?.magazzino?.[mobId], 1);

  // 3. Passaggio di una quantità a scelta di monete
  const moneteAlice = alice.monete;
  const moneteBob = bob.monete;
  const pMonete = prelevaPerSeppellire(alice, { tipo: 'monete', monete: 125 }, t0);
  alice = pMonete.lot;
  assert.equal(alice.monete, moneteAlice - 125);

  const rMonete = riceviSeppellito(bob, pMonete.dono, t0);
  bob = rMonete.lot;
  assert.equal(bob.monete, moneteBob + 125);

  // Validazione di parseBucaDono
  assert.deepEqual(parseBucaDono({ tipo: 'monete', monete: 50 }), { tipo: 'monete', monete: 50 });
  assert.deepEqual(parseBucaDono({ tipo: 'mobile', id: mobId, n: 1 }), { tipo: 'mobile', id: mobId, n: 1 });
  assert.equal(parseBucaDono({ tipo: 'monete', monete: 0 }), null);
});
