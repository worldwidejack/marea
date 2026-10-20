// Porto tra amici: Tabellone dei record (migliore di oggi e di sempre, giorno UTC, chi viene superato). Il Faro comune è stato tolto
// (tag archivio/spenti-faro): del faro resta il posto sullo scoglio, solo scenografia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alGioco, validatePortoAmici } from '@marea/content/porto_amici.ts';
import { detailCorto, recordDi, segnaRecord, tabelloneNuovo } from '../src/economy/record.ts';

const DAY = 86_400_000, H = 3_600_000;
const T0 = 20_000 * DAY + 2 * H;

test('content: porto_amici.json valido; nomi «alla Pesca»', () => {
  assert.deepEqual(validatePortoAmici(), []);
  assert.equal(alGioco('perle'), 'alla Caccia alle perle');
  assert.equal(alGioco('nuovo', 'Nuovo'), 'a Nuovo');
});

test('record: migliore di oggi e di sempre, pari = resta chi c’era, il giorno nuovo azzera oggi, chi viene superato', () => {
  let t = tabelloneNuovo();
  let r = segnaRecord(t, 'perle', { chi: 'ada', score: 20, medal: 'oro', detail: { perle: 9, x: 'no' } }, T0);
  assert.ok(r.oggi && r.sempre && r.superato === null);
  assert.deepEqual(r.tab.oggi['perle']?.detail, { perle: 9 });
  t = r.tab;
  r = segnaRecord(t, 'perle', { chi: 'bo', score: 20, medal: 'oro' }, T0 + H);
  assert.ok(!r.oggi && !r.sempre, 'a pari punteggio resta Ada');
  assert.equal(r.tab, t);
  r = segnaRecord(t, 'perle', { chi: 'bo', score: 25, medal: 'oro' }, T0 + H);
  assert.ok(r.oggi && r.sempre);
  assert.equal(r.superato, 'ada', 'Ada era la migliore di sempre');
  t = r.tab;
  r = segnaRecord(t, 'perle', { chi: 'bo', score: 30, medal: 'oro' }, T0 + 2 * H);
  assert.equal(r.superato, null, 'battere sé stessi non avvisa nessuno');
  t = r.tab;
  // il giorno dopo: oggi vuoto, sempre resta; una partita peggiore diventa la migliore di oggi
  assert.deepEqual(recordDi(t, T0 + DAY).oggi, {});
  assert.equal(recordDi(t, T0 + DAY).sempre['perle']?.score, 30);
  r = segnaRecord(t, 'perle', { chi: 'ada', score: 5, medal: 'bronzo' }, T0 + DAY);
  assert.ok(r.oggi && !r.sempre && r.superato === null);
  assert.equal(recordDi(r.tab, T0 + DAY).oggi['perle']?.chi, 'ada');
  assert.equal(recordDi(r.tab, T0 + DAY).sempre['perle']?.chi, 'bo');
  // minigiochi separati
  r = segnaRecord(r.tab, 'regata', { chi: 'cy', score: 9000, medal: 'argento', detail: { ms: 30000 } }, T0 + DAY);
  assert.equal(recordDi(r.tab, T0 + DAY).sempre['regata']?.detail['ms'], 30000);
  assert.equal(recordDi(r.tab, T0 + DAY).sempre['perle']?.chi, 'bo');
  assert.equal(Object.keys(detailCorto(Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['k' + i, i])))).length, 16);
});
