// La tua barca (#107) e barche al molo (#6): nome ripulito, colori validi e tuoi, acquisto una volta sola, ormeggi che non si toccano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, AVATAR, ISLANDS, validateContent } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { BARCA_DI_SERIE, barcaDi, compraColoreBarca, diSerie, nomeBarca, possiedeColore, validaBarca } from '../src/economy/barca.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';
import { barcheSovrapposte, landingSpot, newBoat, ormeggioLibero, scafoInAcqua, yawOrmeggio } from '../src/world/boat.ts';

const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code;
const B = AVATAR.barca;
const gratis = B.colori.filter((k) => k.perle === 0), esclusivi = B.colori.filter((k) => k.perle > 0);
const conPerle = (lot: LotState, n: number): LotState => ({ ...lot, resources: { ...lot.resources, perle: lot.resources.perle + n }, ledger: { ...lot.ledger, generated: { ...lot.ledger.generated, perle: lot.ledger.generated.perle + n } } });

test('barca: contenuti validi, 4-6 colori gratis e 4-6 esclusivi del Mercante, di serie = la barca a remi di prima', () => {
  assert.deepEqual(validateContent(), []);
  assert.ok(gratis.length >= 4 && gratis.length <= 6, `gratis ${gratis.length}`);
  assert.ok(esclusivi.length >= 4 && esclusivi.length <= 6, `esclusivi ${esclusivi.length}`);
  assert.ok(esclusivi.every((k) => k.mercante));
  assert.equal(BARCA_DI_SERIE.vela, 'nessuna');
  assert.equal(B.colori.find((k) => k.id === BARCA_DI_SERIE.scafo)?.hex, '#8E5A2B', 'lo scafo di serie è il legno di sempre');
  assert.ok(diSerie(BARCA_DI_SERIE));
});

test('barca: nome ripulito (accenti, simboli, spazi, lunghezza)', () => {
  assert.equal(nomeBarca('  La   Perla  '), 'La Perla');
  assert.equal(nomeBarca('Àncora è già!'), 'Ancora e gia!');
  assert.equal(nomeBarca('<script>alert(1)</script>'), 'scriptalert1sc');
  assert.equal(nomeBarca('Gabbiana Veloce Due'), 'Gabbiana Veloc');
  assert.equal(nomeBarca('Gabbiana Veloce Due').length, B.nomeMax);
  assert.equal(nomeBarca('🐟🐟'), '');
  assert.equal(nomeBarca(42), '');
  assert.equal(nomeBarca("L'Onda-2?"), "L'Onda-2?");
});

test('barca: un look qualunque dà sempre una barca valida (vecchi look = di serie)', () => {
  assert.deepEqual(barcaDi({ pelle: 1 }), BARCA_DI_SERIE);
  assert.deepEqual(barcaDi(null), BARCA_DI_SERIE);
  assert.deepEqual(barcaDi({ barca: { scafo: 'rosso', vela: 'tela', nome: 'Rossa' } }), { scafo: 'rosso', vela: 'tela', nome: 'Rossa' });
  assert.deepEqual(barcaDi({ barca: { scafo: 'oro_finto', vela: 42, nome: '<b>' } }), { ...BARCA_DI_SERIE, nome: 'b' });
});

test('barca: validazione della scelta (colori esistenti e tuoi)', () => {
  const lot = newLot('a', 0);
  const ex = esclusivi[0]!;
  assert.deepEqual(validaBarca({ scafo: 'rosso', vela: 'nessuna', nome: ' Rossa ' }, lot), { scafo: 'rosso', vela: 'nessuna', nome: 'Rossa' });
  assert.deepEqual(validaBarca({ scafo: 'rosso', vela: 'tela' }, lot), { scafo: 'rosso', vela: 'tela', nome: '' });
  assert.equal(typeof validaBarca({ scafo: 'nessuna', vela: 'tela' }, lot), 'string', 'lo scafo c\'è sempre');
  assert.equal(typeof validaBarca({ scafo: 'rosso', vela: 'arcobaleno' }, lot), 'string');
  assert.equal(typeof validaBarca({ scafo: 'rosso', vela: 'tela', nome: 5 }, lot), 'string');
  assert.equal(typeof validaBarca('rosso', lot), 'string');
  assert.match(String(validaBarca({ scafo: ex.id, vela: 'tela' }, lot)), /Mercante/);
  assert.match(String(validaBarca({ scafo: 'legno', vela: ex.id }, lot)), /non è tuo/);
  assert.deepEqual(validaBarca({ scafo: ex.id, vela: ex.id }, null), { scafo: ex.id, vela: ex.id, nome: '' }, 'senza lotto solo la forma');
});

test('barca: un colore esclusivo si compra una volta, poi vale per scafo e vela', () => {
  const ex = esclusivi[1]!, free = gratis[2]!;
  let lot = newLot('a', 0);
  assert.ok(possiedeColore(lot, free.id) && !possiedeColore(lot, ex.id));
  assert.throws(() => compraColoreBarca(lot, ex.id, 0), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca!.perle === ex.perle);
  assert.throws(() => compraColoreBarca(lot, free.id, 0), isErr('unico'));
  assert.throws(() => compraColoreBarca(lot, 'oro_finto', 0), isErr('sconosciuto'));
  lot = conPerle(lot, ex.perle + 2);
  const v0 = lot.version;
  lot = compraColoreBarca(lot, ex.id, 1000);
  assert.equal(lot.resources.perle, 2);
  assert.ok(lot.version > v0);
  assert.ok(possiedeColore(lot, ex.id));
  assert.ok((lot.posseduti ?? []).includes('barca:' + ex.id));
  assert.throws(() => compraColoreBarca(conPerle(lot, 100), ex.id, 2000), isErr('unico'));
  assert.deepEqual(validaBarca({ scafo: ex.id, vela: ex.id, nome: 'Mia' }, lot), { scafo: ex.id, vela: ex.id, nome: 'Mia' });
  assert.equal(checkInvariant([lot]), null);
});

test('ormeggi (#6): scafi che si toccano e no', () => {
  assert.ok(barcheSovrapposte({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 0, yaw: 1 }));
  assert.ok(barcheSovrapposte({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 4, yaw: 0 }), 'in fila, 4 m: le punte si toccano');
  assert.ok(!barcheSovrapposte({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 5, yaw: 0 }));
  assert.ok(!barcheSovrapposte({ x: 0, z: 0, yaw: 0 }, { x: 2, z: 0, yaw: 0 }), 'affiancate a 2 m');
  assert.ok(barcheSovrapposte({ x: 0, z: 0, yaw: 0 }, { x: 1.2, z: 0, yaw: 0 }));
  assert.ok(barcheSovrapposte({ x: 0, z: 0, yaw: 0 }, { x: 2.5, z: 0, yaw: Math.PI / 2 }), 'a T');
  assert.ok(!barcheSovrapposte({ x: 0, z: 0, yaw: 0 }, { x: 3.2, z: 0, yaw: Math.PI / 2 }));
});

test('ormeggi (#6): posto libero vicino al molo, mai sopra un\'altra barca, si scende ancora', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS), map = arch.map;
  for (const slot of [null, ...arch.lots.map((l) => l.slot)]) {
    const b = arch.boatOf(slot);
    const altra = { x: b.x, z: b.z, yaw: yawOrmeggio(b.x, b.z, map) };
    const p = ormeggioLibero(map, b.x, b.z, [altra]);
    assert.ok(p, `nessun posto vicino al molo dello slot ${slot}`);
    assert.ok(!barcheSovrapposte(p, altra), 'sopra l\'altra barca');
    assert.ok(Math.hypot(p.x - b.x, p.z - b.z) <= 12);
    assert.ok(map.navigable(p.x, p.z) && landingSpot(newBoat(p.x, p.z), map), 'da lì si scende al molo');
    assert.ok(scafoInAcqua(p, map) && scafoInAcqua(altra, map), 'la prua sta in acqua');
    const terza = ormeggioLibero(map, b.x, b.z, [altra, p]);
    assert.ok(terza && !barcheSovrapposte(terza, altra) && !barcheSovrapposte(terza, p), 'c\'è posto anche per una terza');
    assert.deepEqual(ormeggioLibero(map, b.x, b.z, []), { x: b.x, z: b.z, yaw: altra.yaw }, 'libero: resta dov\'è');
  }
});
