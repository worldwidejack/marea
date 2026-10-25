// La casa arredabile (#265): mobili comprati nel magazzino, posati a terra o a parete nella stanza, spostati, girati, ritirati; pavimenti
// e carte comprati una volta e scelti; il baule di serie (il Forziere) si sposta sul pavimento. Libro mastro in pari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BORGO, MOBILI } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { compraFinitura, compraMobile, conBaule, finitureScelte, posaMobile, possiedeFinitura, ritiraMobile, ruotaBaule, ruotaMobile, scegliFinitura, spostaBaule, spostaMobile, svuotaStanza } from '../src/economy/casa.ts';
import type { LotState } from '../src/economy/types.ts';
import { checkMonete } from '../src/economy/monete.ts';
import { conMonete, senzaMonete } from './monete_util.ts';
import { isErr } from './economia_util.ts';

const ST = BORGO.stanza, [X0, Z0, X1, Z1] = ST.pavimento;
/** Un lotto con `monete` monete, senza baule (la stanza tutta libera: il baule lo mettono i test che ne parlano). */
function ricco(monete: number): LotState {
  const l = newLot('a', 0), { baule: _b, ...casa } = l.casa ?? {};
  return conMonete(senzaMonete({ ...l, casa }), monete);
}
const terra = MOBILI.find((m) => m.posto === 'terra')!, parete = MOBILI.find((m) => m.posto === 'parete')!;

test('catalogo: almeno tre mobili, almeno uno a terra e uno a parete; finiture di serie gratis', () => {
  assert.ok(MOBILI.length >= 3);
  assert.ok(terra && parete);
  assert.equal(BORGO.pavimenti[0]!.monete ?? 0, 0);
  assert.equal(BORGO.carte[0]!.monete ?? 0, 0);
  assert.ok(BORGO.pavimenti.length >= 4 && BORGO.carte.length >= 4);
});

test('compra: monete spese, il mobile va nel magazzino; senza monete errore e niente cambia', () => {
  let lot = ricco(terra.monete + parete.monete);
  lot = compraMobile(lot, terra.id, 1000);
  lot = compraMobile(lot, parete.id, 1000);
  assert.equal(lot.monete, 0);
  assert.deepEqual(lot.casa?.magazzino, { [terra.id]: 1, [parete.id]: 1 });
  assert.throws(() => compraMobile(lot, terra.id, 1000), isErr('risorse'));
  assert.throws(() => compraMobile(lot, 'inesistente', 1000), isErr('sconosciuto'));
  assert.equal(checkMonete([lot]), null);
});

test('posa a terra: solo sul pavimento libero, non sui passaggi; gira; sposta; ritira nel magazzino', () => {
  let lot = compraMobile(compraMobile(ricco(500), terra.id, 0), terra.id, 0);
  assert.throws(() => posaMobile(lot, terra.id, { cell: [X0 - 1, Z0] }, 0, 0), isErr('posizione'));
  assert.throws(() => posaMobile(lot, terra.id, { cell: [ST.corridoio[0], Z1 - 1] }, 0, 0), isErr('posizione'), 'sbocco del corridoio');
  assert.throws(() => posaMobile(lot, terra.id, { cell: [X0, Z0], muro: 'n' }, 0, 0), isErr('posizione'), 'a terra non va sul muro');
  lot = posaMobile(lot, terra.id, { cell: [X0, Z0] }, 1, 0);
  const a = lot.casa!.arredi![0]!;
  assert.equal(a.rot, 1);
  assert.throws(() => posaMobile(lot, terra.id, { cell: [X0, Z0] }, 0, 0), isErr('cella'));
  lot = posaMobile(lot, terra.id, { cell: [X0 + 1, Z0] }, 0, 0);
  assert.equal(lot.casa!.magazzino![terra.id], undefined, 'magazzino vuoto');
  assert.throws(() => posaMobile(lot, terra.id, { cell: [X0 + 2, Z0] }, 0, 0), isErr('requisito'));
  assert.throws(() => spostaMobile(lot, a.id, { cell: [X0 + 1, Z0] }, 0), isErr('cella'));
  lot = spostaMobile(lot, a.id, { cell: [X1 - 1, Z1 - 1] }, 0);
  lot = ruotaMobile(ruotaMobile(ruotaMobile(lot, a.id, 0), a.id, 0), a.id, 0);
  const b = lot.casa!.arredi!.find((x) => x.id === a.id)!;
  assert.deepEqual(b.cell, [X1 - 1, Z1 - 1]);
  assert.equal(b.rot, undefined, '1 + 3 quarti = 0');
  lot = ritiraMobile(lot, a.id, 0);
  assert.equal(lot.casa!.magazzino![terra.id], 1);
  assert.equal(lot.casa!.arredi!.length, 1);
  assert.notEqual(posaMobile(lot, terra.id, { cell: [X0 + 3, Z0 + 2] }, 0, 0).casa!.arredi![1]!.id, lot.casa!.arredi![0]!.id, 'id nuovo');
});

test('posa a parete: sul bordo del muro giusto, uno per cella di muro; non si gira', () => {
  let lot = compraMobile(compraMobile(ricco(500), parete.id, 0), parete.id, 0);
  assert.throws(() => posaMobile(lot, parete.id, { cell: [X0 + 1, Z0 + 1], muro: 'n' }, 0, 0), isErr('posizione'), 'non sul bordo');
  assert.throws(() => posaMobile(lot, parete.id, { cell: [X0, Z0] }, 0, 0), isErr('posizione'), 'senza muro');
  lot = posaMobile(lot, parete.id, { cell: [X0, Z0 + 2], muro: 'o' }, 0, 0);
  assert.throws(() => posaMobile(lot, parete.id, { cell: [X0, Z0 + 2], muro: 'o' }, 0, 0), isErr('cella'));
  lot = posaMobile(lot, parete.id, { cell: [X0, Z0], muro: 'n' }, 0, 0);
  const [o, n] = lot.casa!.arredi!;
  assert.equal(o!.muro, 'o'); assert.equal(n!.muro, 'n');
  assert.throws(() => ruotaMobile(lot, o!.id, 0), isErr('posizione'));
  lot = spostaMobile(lot, o!.id, { cell: [X1 - 1, Z0 + 3], muro: 'e' }, 0);
  assert.equal(lot.casa!.arredi![0]!.muro, 'e');
  // un mobile a terra nella stessa cella di uno a parete va bene (sta per terra, l'altro sul muro)
  lot = posaMobile(compraMobile(lot, terra.id, 0), terra.id, { cell: [X0, Z0] }, 0, 0);
  assert.equal(lot.casa!.arredi!.length, 3);
});

test('finiture: compri una volta (va nelle finiture possedute), scegli solo le tue; quella di serie è di tutti', () => {
  const p = BORGO.pavimenti[1]!, k = BORGO.carte[1]!;
  let lot = ricco((p.monete ?? 0) + (k.monete ?? 0));
  assert.deepEqual(finitureScelte(lot), { pavimento: BORGO.pavimenti[0]!.id, carta: BORGO.carte[0]!.id });
  assert.ok(possiedeFinitura(lot, 'pavimento', BORGO.pavimenti[0]!.id));
  assert.throws(() => scegliFinitura(lot, 'pavimento', p.id, 0), isErr('requisito'));
  lot = compraFinitura(lot, 'pavimento', p.id, 0);
  lot = compraFinitura(lot, 'carta', k.id, 0);
  assert.equal(lot.monete, 0);
  assert.ok(possiedeFinitura(lot, 'pavimento', p.id));
  assert.ok(possiedeFinitura(lot, 'carta', k.id));
  // Non si applica subito al piano terra: restano quelle di prima
  assert.deepEqual(finitureScelte(lot), { pavimento: BORGO.pavimenti[0]!.id, carta: BORGO.carte[0]!.id });
  assert.throws(() => compraFinitura(lot, 'pavimento', p.id, 0), isErr('unico'));
  lot = scegliFinitura(lot, 'pavimento', p.id, 0);
  lot = scegliFinitura(lot, 'carta', k.id, 0);
  assert.deepEqual(finitureScelte(lot), { pavimento: p.id, carta: k.id });
  lot = scegliFinitura(lot, 'pavimento', BORGO.pavimenti[0]!.id, 0);
  assert.equal(finitureScelte(lot).pavimento, BORGO.pavimenti[0]!.id);
  assert.throws(() => scegliFinitura(lot, 'carta', 'inesistente', 0), isErr('sconosciuto'));
});

test('finiture: indipendenti tra piano terra e primo piano', () => {
  const p1 = BORGO.pavimenti[1]!, p2 = BORGO.pavimenti[2]!;
  const k1 = BORGO.carte[1]!, k2 = BORGO.carte[2]!;
  let lot = ricco((p1.monete ?? 0) + (p2.monete ?? 0) + (k1.monete ?? 0) + (k2.monete ?? 0));
  lot = compraFinitura(lot, 'pavimento', p1.id, 0);
  lot = compraFinitura(lot, 'pavimento', p2.id, 0);
  lot = compraFinitura(lot, 'carta', k1.id, 0);
  lot = compraFinitura(lot, 'carta', k2.id, 0);

  // Inizialmente 'piano' usa quelle di serie se non impostate
  assert.deepEqual(finitureScelte(lot, 'piano'), { pavimento: BORGO.pavimenti[0]!.id, carta: BORGO.carte[0]!.id });

  // Imposta finiture sul primo piano
  lot = scegliFinitura(lot, 'pavimento', p1.id, 0, 'piano');
  lot = scegliFinitura(lot, 'carta', k1.id, 0, 'piano');

  // Imposta finiture diverse a piano terra
  lot = scegliFinitura(lot, 'pavimento', p2.id, 0, 'terra');
  lot = scegliFinitura(lot, 'carta', k2.id, 0, 'terra');

  // Le scelte rimangono indipendenti
  assert.deepEqual(finitureScelte(lot, 'terra'), { pavimento: p2.id, carta: k2.id });
  assert.deepEqual(finitureScelte(lot, 'piano'), { pavimento: p1.id, carta: k1.id });
});

test('baule: si sposta sul pavimento e si gira', () => {
  let lot = ricco(0);
  assert.throws(() => spostaBaule(lot, [X0 + 3, Z0 + 3], 0), isErr('sconosciuto'));
  lot = conBaule(lot);
  lot = spostaBaule(lot, [X0 + 3, Z0 + 3], 0);
  assert.deepEqual(lot.casa?.baule, { livello: 1, cell: [X0 + 3, Z0 + 3] });
  assert.throws(() => spostaBaule(lot, [ST.corridoio[0], Z1 - 1], 0), isErr('posizione'));
  lot = ruotaBaule(lot, 0);
  assert.equal(lot.casa!.bauleRot, 1);
});

test('svuotaStanza: svuota solo i mobili posati nella stanza richiesta e li rimette nel magazzino', () => {
  let lot = ricco(5000);
  lot = compraMobile(compraMobile(lot, terra.id, 0), parete.id, 0);
  lot = posaMobile(lot, terra.id, { cell: [X0, Z0] }, 0, 0);
  lot = posaMobile(lot, parete.id, { cell: [X0, Z0], muro: 'n' }, 0, 0);
  assert.equal(lot.casa!.arredi!.length, 2);
  assert.deepEqual(lot.casa!.magazzino, {});

  // Se svuoto 'piano' (dove non ci sono mobili), 'terra' resta intatta
  lot = svuotaStanza(lot, 'piano', 0);
  assert.equal(lot.casa!.arredi!.length, 2);
  assert.deepEqual(lot.casa!.magazzino, {});

  // Svuoto 'terra'
  lot = svuotaStanza(lot, 'terra', 0);
  assert.equal(lot.casa!.arredi!.length, 0);
  assert.deepEqual(lot.casa!.magazzino, { [terra.id]: 1, [parete.id]: 1 });
});

test('baule di serie: chi non l’ha costruito lo trova in casa, livello 1, in una cella libera della stanza; chi ce l’ha resta com’è', () => {
  let lot = ricco(5000);
  const m = MOBILI.find((x) => x.posto === 'terra' && !x.celle)!;
  lot = posaMobile(compraMobile(lot, m.id, 0), m.id, { cell: [X0, Z0] }, 0, 0); // la prima cella è presa da un mobile
  const con = conBaule(lot), b = con.casa!.baule!;
  assert.ok(b && b.livello === 1, 'baule di serie: ' + JSON.stringify(con.casa));
  assert.ok(b.cell[0] >= X0 && b.cell[0] < X1 && b.cell[1] >= Z0 && b.cell[1] < Z1 && !(b.cell[0] === X0 && b.cell[1] === Z0), 'cella: ' + b.cell.join(','));
  assert.equal(conBaule(con), con, 'una seconda volta non ne aggiunge un altro');
  const suo = { ...ricco(500), casa: { baule: { livello: 3, cell: [X0 + 2, Z0 + 2] as [number, number] } } };
  assert.equal(conBaule(suo), suo, 'chi ce l’ha tiene il suo');
  assert.ok(newLot('b', 0).casa?.baule, 'un lotto nuovo ce l’ha già');
  assert.equal(checkMonete([con]), null);
});
