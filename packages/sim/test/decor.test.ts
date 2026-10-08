// Decorazioni libere (#108): sposta, ruota, rivendi. Stesse celle di placeDecor, rimborso a metà per difetto, libro mastro in pari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, DECOR, RIENTRO } from '@marea/content';
import { decorRimborso, moveDecor, newLot, placeDecor, rotateDecor, sellDecor } from '../src/economy/actions.ts';
import { cellsOf, decorCellError, lotTemplate, riservate } from '../src/economy/cells.ts';
import type { LotTemplate } from '../src/economy/cells.ts';
import { advance } from '../src/economy/advance.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';

const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
const T: LotTemplate = { rows: [
  '~~~~~~~~~~',
  '~..gggg..~',
  '~.gLggLg.~',
  '~.ggrrgg.~',
  '~.gLggLg.~',
  '~...P....~',
  '~,,.dd.,,~',
  '~,,,,B,,,~',
] };
/** Lotto con `perle` Perle già nel libro mastro (così l'invariante torna). */
function ricco(perle: number, tpl: LotTemplate | null = T): LotState {
  const l = newLot('a', 0, tpl);
  return { ...l, resources: { ...l.resources, perle }, ledger: { ...l.ledger, generated: { ...l.ledger.generated, perle } } };
}
const prezzo = (id: string) => DECOR.find((d) => d.id === id)!.perle;

test('rimborso: metà del prezzo per difetto, numero in balance.json', () => {
  assert.equal(BALANCE.decor.rimborso, 0.5);
  for (const d of DECOR) assert.equal(decorRimborso(d.id), Math.floor(d.perle / 2), d.id);
  assert.equal(decorRimborso('lanterna'), 2, '5 Perle → 2');
  assert.equal(decorRimborso('inesistente'), 0);
});

test('sposta: su sabbia/erba libera sì; su edifici, slot, molo, altre decorazioni o fuori no', () => {
  let lot = ricco(50);
  lot = placeDecor(lot, 'barile', [1, 1], 0, 0, 5, T);
  lot = placeDecor(lot, 'cassa', [2, 1], 0, 0, 5, T);
  const [barile, cassa] = lot.decor;
  const mosso = moveDecor(lot, barile!.id, [8, 4], 10, T);
  assert.deepEqual(mosso.decor.find((d) => d.id === barile!.id)!.cell, [8, 4]);
  assert.equal(mosso.version, advance(lot, 10).version + 1);
  assert.deepEqual(mosso.resources, lot.resources, 'spostare non costa');
  assert.throws(() => moveDecor(lot, barile!.id, cassa!.cell, 10, T), isErr('cella'), 'sopra un’altra decorazione');
  assert.throws(() => moveDecor(lot, barile!.id, [4, 6], 10, T), isErr('posizione'), 'sul molo');
  const conCasa = { ...lot, buildings: [...lot.buildings, { id: 'x-9', building: 'casa', level: 1, cell: [8, 4] as [number, number], buffer: 0, lastMs: 0 }] };
  assert.throws(() => moveDecor(conCasa, barile!.id, [8, 4], 10, T), isErr('cella'), 'sopra un edificio');
  for (const bad of [[3, 2], [4, 5], [5, 6], [4, 3], [0, 0], [99, 1], [-1, 2]] as [number, number][])
    assert.throws(() => moveDecor(lot, barile!.id, bad, 10, T), isErr('posizione'), `cella ${bad} accettata`);
  assert.throws(() => moveDecor(lot, 'barile-99', [8, 4], 10, T), isErr('sconosciuto'));
  // nella stessa cella: niente da fare, niente versione nuova
  assert.equal(moveDecor(lot, barile!.id, [1, 1], 10, T).version, advance(lot, 10).version);
  // la cella lasciata libera torna buona per un'altra
  assert.doesNotThrow(() => moveDecor(mosso, cassa!.id, [1, 1], 20, T));
  assert.equal(checkInvariant([mosso]), null);
});

test('ruota: un quarto di giro a ogni tocco, dopo 4 torna a 0; il campo assente vale 0', () => {
  let lot = placeDecor(ricco(10), 'torii', [1, 1], 0, 0, 5, T);
  const id = lot.decor[0]!.id;
  assert.equal(lot.decor[0]!.rot, undefined, 'rot 0 non si salva');
  const giri: (number | undefined)[] = [];
  for (let i = 0; i < 4; i++) { lot = rotateDecor(lot, id, i); giri.push(lot.decor[0]!.rot); }
  assert.deepEqual(giri, [1, 2, 3, undefined]);
  // un lotto salvato con rot esplicito resta valido
  const vecchio = { ...lot, decor: [{ id: 'barile-7', decor: 'barile', cell: [2, 1] as [number, number], rot: 3 }] };
  assert.equal(rotateDecor(vecchio, 'barile-7', 0).decor[0]!.rot, undefined);
  assert.throws(() => rotateDecor(lot, 'nessuna', 0), isErr('sconosciuto'));
  assert.throws(() => placeDecor(ricco(10), 'barile', [1, 1], 4, 0, 5, T), isErr('posizione'));
  assert.equal(placeDecor(ricco(10), 'barile', [1, 1], 2, 0, 5, T).decor[0]!.rot, 2);
});

test('rivendi: toglie la decorazione, rimborsa metà delle Perle, libro mastro in pari', () => {
  let lot = ricco(100);
  lot = placeDecor(lot, 'statua', [1, 1], 0, 0, prezzo('statua'), T);
  lot = placeDecor(lot, 'lanterna', [2, 1], 0, 0, prezzo('lanterna'), T);
  const perle0 = lot.resources.perle;
  const out = sellDecor(lot, lot.decor[0]!.id, 50);
  assert.equal(out.perle, Math.floor(prezzo('statua') / 2));
  assert.equal(out.lot.resources.perle, perle0 + out.perle);
  assert.equal(out.lot.decor.length, 1);
  assert.equal(out.lot.decor[0]!.decor, 'lanterna');
  assert.equal(out.lot.ledger.generated.perle, lot.ledger.generated.perle + out.perle, 'il rimborso è un’entrata');
  assert.equal(checkInvariant([out.lot]), null);
  const out2 = sellDecor(out.lot, out.lot.decor[0]!.id, 60);
  assert.equal(out2.perle, 2);
  assert.equal(out2.lot.decor.length, 0);
  assert.equal(checkInvariant([out2.lot]), null);
  assert.throws(() => sellDecor(out2.lot, 'lanterna-2', 70), isErr('sconosciuto'), 'già venduta');
  // comprare e rivendere non crea Perle
  assert.ok(out2.lot.resources.perle < 100);
});

test('dopo una vendita il nuovo id non ripete quelli rimasti', () => {
  let lot = ricco(100);
  lot = placeDecor(lot, 'barile', [1, 1], 0, 0, 5, T);
  lot = placeDecor(lot, 'cassa', [2, 1], 0, 0, 5, T);
  lot = sellDecor(lot, 'barile-1', 0).lot;
  lot = placeDecor(lot, 'cassa', [1, 1], 0, 0, 5, T);
  const ids = lot.decor.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, `id ripetuti: ${ids}`);
  assert.deepEqual(ids, ['cassa-2', 'cassa-3']);
});

test('template vero: niente decorazioni sul libro degli ospiti né sulle decorazioni fisse del molo', () => {
  const real = lotTemplate();
  assert.ok(real, 'manca il template lotto');
  const ris = riservate(real);
  assert.ok(ris.some((c) => c[0] === RIENTRO.libro.lotto[0] && c[1] === RIENTRO.libro.lotto[1]), 'il libro non è riservato');
  assert.equal(riservate(T).length, 0, 'i template dei test non hanno riservate');
  const lot = ricco(50, real);
  assert.equal(decorCellError(lot, RIENTRO.libro.lotto, real)?.code, 'posizione');
  assert.throws(() => placeDecor(lot, 'barile', RIENTRO.libro.lotto, 0, 0, 5), isErr('posizione'));
  const libera = [...cellsOf(real, 'g'), ...cellsOf(real, '.')].find((c) => !decorCellError(lot, c, real))!;
  const l2 = placeDecor(lot, 'barile', libera, 0, 0, 5);
  assert.throws(() => moveDecor(l2, l2.decor[0]!.id, RIENTRO.libro.lotto, 0), isErr('posizione'));
});
