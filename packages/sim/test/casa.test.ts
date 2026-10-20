// La casa arredabile (#265): mobili comprati nel magazzino, posati a terra o a parete nella stanza, spostati, girati, ritirati; pavimenti
// e carte comprati una volta e scelti; il baule (Forziere) si sposta sul pavimento; le decorazioni del giardino in casa no. Libro mastro in pari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BORGO, MOBILI } from '@marea/content';
import { build, newLot, placeDecor } from '../src/economy/actions.ts';
import { compraFinitura, compraMobile, finitureScelte, posaMobile, possiedeFinitura, ritiraMobile, ruotaBaule, ruotaMobile, scegliFinitura, spostaBaule, spostaMobile } from '../src/economy/casa.ts';
import { decorCellError, fitToTemplate, lotTemplate } from '../src/economy/cells.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import type { LotState } from '../src/economy/types.ts';
import { checkMonete } from '../src/economy/monete.ts';
import { conMonete, senzaMonete } from './monete_util.ts';
import { isErr } from './economia_util.ts';

const T = lotTemplate()!;
const ST = BORGO.stanza, [X0, Z0, X1, Z1] = ST.pavimento;
/** Un lotto con `monete` monete (e le risorse di prima per costruire il baule, codice spento). */
function ricco(monete: number): LotState {
  const l = newLot('a', 0, T);
  return conMonete(senzaMonete({ ...l, resources: { ...l.resources, legno: 5000, pietra: 5000 }, ledger: { ...l.ledger, generated: { ...l.ledger.generated, legno: l.ledger.generated.legno + 5000 - l.resources.legno, pietra: l.ledger.generated.pietra + 5000 - l.resources.pietra } } }), monete);
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
  assert.equal(checkInvariant([lot]), null);
  assert.equal(checkMonete([lot]), null);
});

test('posa a terra: solo sul pavimento libero, non sui passaggi; gira; sposta; ritira nel magazzino', () => {
  let lot = compraMobile(compraMobile(ricco(500), terra.id, 0), terra.id, 0);
  assert.throws(() => posaMobile(lot, terra.id, { cell: [X0 - 1, Z0] }, 0, 0), isErr('posizione'));
  assert.throws(() => posaMobile(lot, terra.id, { cell: [ST.corridoio[0], Z1 - 1] }, 0, 0), isErr('posizione'), 'sbocco del corridoio');
  assert.throws(() => posaMobile(lot, terra.id, { cell: [ST.retro[0], ST.retro[1]] }, 0, 0), isErr('posizione'), 'davanti alla porta in fondo');
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
  assert.equal(checkInvariant([lot]), null);
});

test('posa a parete: sul bordo del muro giusto, non sulla porta in fondo, uno per cella di muro; non si gira', () => {
  let lot = compraMobile(compraMobile(ricco(500), parete.id, 0), parete.id, 0);
  assert.throws(() => posaMobile(lot, parete.id, { cell: [X0 + 1, Z0 + 1], muro: 'n' }, 0, 0), isErr('posizione'), 'non sul bordo');
  assert.throws(() => posaMobile(lot, parete.id, { cell: [ST.retro[0], Z0], muro: 'n' }, 0, 0), isErr('posizione'), 'sulla porta');
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

test('finiture: compri una volta (si mette subito), scegli solo le tue; quella di serie è di tutti', () => {
  const p = BORGO.pavimenti[1]!, k = BORGO.carte[1]!;
  let lot = ricco((p.monete ?? 0) + (k.monete ?? 0));
  assert.deepEqual(finitureScelte(lot), { pavimento: BORGO.pavimenti[0]!.id, carta: BORGO.carte[0]!.id });
  assert.ok(possiedeFinitura(lot, 'pavimento', BORGO.pavimenti[0]!.id));
  assert.throws(() => scegliFinitura(lot, 'pavimento', p.id, 0), isErr('requisito'));
  lot = compraFinitura(lot, 'pavimento', p.id, 0);
  lot = compraFinitura(lot, 'carta', k.id, 0);
  assert.equal(lot.monete, 0);
  assert.deepEqual(finitureScelte(lot), { pavimento: p.id, carta: k.id });
  assert.throws(() => compraFinitura(lot, 'pavimento', p.id, 0), isErr('unico'));
  lot = scegliFinitura(lot, 'pavimento', BORGO.pavimenti[0]!.id, 0);
  assert.equal(finitureScelte(lot).pavimento, BORGO.pavimenti[0]!.id);
  lot = scegliFinitura(lot, 'pavimento', p.id, 0);
  assert.equal(finitureScelte(lot).pavimento, p.id);
  assert.throws(() => scegliFinitura(lot, 'carta', 'inesistente', 0), isErr('sconosciuto'));
  assert.equal(checkInvariant([lot]), null);
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
  assert.equal(checkInvariant([lot]), null);
});

test('baule: il Forziere costruito in casa si sposta sul pavimento e si gira; resta lì ricaricando', () => {
  let lot = ricco(0);
  assert.throws(() => spostaBaule(lot, [X0 + 3, Z0 + 3], 0), isErr('sconosciuto'));
  lot = build(lot, 'forziere', [X0 + 1, Z0 + 1], 0);
  lot = spostaBaule(lot, [X0 + 3, Z0 + 3], 0);
  assert.deepEqual(lot.buildings.find((b) => b.building === 'forziere')!.cell, [X0 + 3, Z0 + 3]);
  assert.deepEqual(fitToTemplate(lot, T).buildings, lot.buildings, 'il baule sul pavimento non viene rimesso su una L');
  assert.throws(() => spostaBaule(lot, [ST.corridoio[0], Z1 - 1], 0), isErr('posizione'));
  lot = ruotaBaule(lot, 0);
  assert.equal(lot.casa!.bauleRot, 1);
});

test('decorazioni del giardino: in casa no (stanza e corridoio), e quelle già finite in casa tornano in giardino', () => {
  const lot = ricco(100);
  assert.equal(decorCellError(lot, [X0 + 1, Z0 + 1], T)?.code, 'posizione');
  assert.equal(decorCellError(lot, [ST.corridoio[0], ST.corridoio[1]], T)?.code, 'posizione');
  assert.throws(() => placeDecor(lot, 'barile', [X0 + 1, Z0 + 1], 0, 0, 5, T), isErr('posizione'));
  const vecchio: LotState = { ...lot, decor: [{ id: 'barile-1', decor: 'barile', cell: [X0 + 1, Z0 + 1] }] };
  const d = fitToTemplate(vecchio, T).decor[0]!;
  assert.ok(d.cell[1] < Z0 - 1, 'tornata in giardino: ' + d.cell.join(','));
});
