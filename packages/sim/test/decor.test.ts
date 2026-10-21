// Le decorazioni del Mercante stanno in casa come i mobili a terra: comprate vanno nel magazzino di casa («decor:<id>»), con ARREDA si
// posano su una cella della stanza, si girano, si spostano e si rimettono via. Quelle posate nel giardino di prima tornano nel magazzino.
// Libro mastro delle monete in pari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BORGO, DECOR } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { posaMobile, postoMobileError, ritiraMobile, ruotaMobile, spostaMobile, mobile } from '../src/economy/casa.ts';
import { chiaveDecor, compraDecor, decorComeMobile, decorDi, decorInCasa } from '../src/economy/decorazioni.ts';
import type { LotState } from '../src/economy/types.ts';
import { checkMonete } from '../src/economy/monete.ts';
import { conMonete, senzaMonete } from './monete_util.ts';
import { isErr } from './economia_util.ts';

const [X0, Z0] = BORGO.stanza.pavimento;
const ricco = (monete: number): LotState => conMonete(senzaMonete(newLot('a', 0)), monete);
const prezzo = (id: string) => DECOR.find((d) => d.id === id)!.monete;

test('chiavi: «decor:<id>» è una decorazione e un mobile a terra di una cella; un mobile vero non lo è', () => {
  const k = chiaveDecor('lanterna');
  assert.equal(decorDi(k)?.id, 'lanterna');
  assert.equal(decorDi('lanterna'), null, 'senza prefisso non è una chiave di decorazione');
  assert.equal(decorDi(chiaveDecor('inesistente')), null);
  const m = decorComeMobile(k)!;
  assert.deepEqual([m.posto, m.forma, m.celle], ['terra', 'decor', [1, 1]]);
  assert.equal(mobile(k)?.nome, DECOR.find((d) => d.id === 'lanterna')!.nome, 'casa.ts la trova come un mobile');
});

test('compra dal Mercante: monete spese, una nel magazzino di casa; senza monete EconomyError con quante mancano', () => {
  let lot = ricco(500);
  lot = compraDecor(lot, 'torii');
  lot = compraDecor(lot, 'torii');
  assert.equal(lot.monete, 500 - 2 * prezzo('torii'));
  assert.equal(lot.casa?.magazzino?.[chiaveDecor('torii')], 2);
  assert.throws(() => compraDecor(ricco(1), 'torii'), (e: unknown) => isErr('risorse')(e) && (e as { manca: { monete: number } }).manca.monete === prezzo('torii') - 1);
  assert.throws(() => compraDecor(lot, 'nessuna'), isErr('sconosciuto'));
  assert.equal(checkMonete([lot]), null);
});

test('in casa: si posa su una cella libera della stanza, si gira, si sposta, torna nel magazzino; nel giardino no', () => {
  let lot = compraDecor(ricco(200), 'barile');
  const k = chiaveDecor('barile');
  assert.equal(postoMobileError(lot, mobile(k)!, { cell: [X0 + 1, Z0 - 3] })?.code, 'posizione', 'fuori dalla stanza');
  lot = posaMobile(lot, k, { cell: [X0 + 1, Z0 + 1] }, 0, 0);
  const a = lot.casa!.arredi!.find((x) => x.mobile === k)!;
  assert.ok(a && !lot.casa!.magazzino?.[k], 'posata e tolta dal magazzino');
  lot = ruotaMobile(lot, a.id, 0);
  lot = spostaMobile(lot, a.id, { cell: [X0 + 2, Z0 + 1] }, 0);
  assert.deepEqual(lot.casa!.arredi!.find((x) => x.id === a.id)!.cell, [X0 + 2, Z0 + 1]);
  assert.throws(() => posaMobile(lot, k, { cell: [X0 + 3, Z0 + 1] }, 0, 0), isErr('requisito'), 'non ce n’è un’altra nel magazzino');
  lot = ritiraMobile(lot, a.id, 0);
  assert.equal(lot.casa!.magazzino![k], 1);
  assert.equal(checkMonete([lot]), null);
});

test('salvataggio di prima: le decorazioni del giardino finiscono nel magazzino di casa, una volta sola; le sconosciute spariscono', () => {
  const base = ricco(0);
  const vecchio = { ...base, casa: { magazzino: { letto: 1, [chiaveDecor('barile')]: 1 } }, decor: [
    { id: 'barile-1', decor: 'barile', cell: [1, 1] }, { id: 'barile-2', decor: 'barile', cell: [2, 1] },
    { id: 'palma-3', decor: 'palma', cell: [3, 1], rot: 2 }, { id: 'boh-4', decor: 'boh', cell: [4, 1] },
  ] } as LotState;
  const out = decorInCasa(vecchio);
  assert.ok(!('decor' in out));
  assert.deepEqual(out.casa?.magazzino, { letto: 1, [chiaveDecor('barile')]: 3, [chiaveDecor('palma')]: 1 });
  assert.equal(out.monete, base.monete, 'niente monete in più né in meno');
  assert.equal(decorInCasa(out), out, 'un lotto già sistemato torna identico');
  assert.equal(decorInCasa(base), base, 'un lotto nuovo torna identico');
  const vuoto = decorInCasa({ ...base, decor: [] } as LotState);
  assert.ok(!('decor' in vuoto) && vuoto.casa === base.casa);
});
