// Porto tra amici (#110 #111): Faro comune (versamento dal lotto idempotente e in pari col libro mastro, livelli dalle soglie di content,
// bonus di produzione in `advance` dal momento della salita, solo per gli edifici del faro) e Tabellone dei record (migliore di oggi e
// di sempre, giorno UTC, chi viene superato).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { building } from '@marea/content';
import { FARO, alGioco, validatePortoAmici } from '@marea/content/porto_amici.ts';
import { build, newLot } from '../src/economy/actions.ts';
import { advance, faroComuneK, faroComuneLivello } from '../src/economy/advance.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { classificaFaro, controllaFaro, donaAlFaro, dosaDono, faroDi, faroManca, faroNuovo, faroProssimo, livelloDa, segnaFaro, versaNelFaro } from '../src/economy/faro.ts';
import type { FaroStato } from '../src/economy/faro.ts';
import { detailCorto, recordDi, segnaRecord, tabelloneNuovo } from '../src/economy/record.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';

const DAY = 86_400_000, H = 3_600_000, MIN = 60_000;
const T0 = 20_000 * DAY + 2 * H;
const SEG: [number, number] = [6, 10], CAVA: [number, number] = [12, 5];
const L1 = FARO.livelli[0]!, L2 = FARO.livelli[1]!;

/** Lotto con Segheria e Cava finite all'ora `t` e tante risorse (per versare). */
function conEdifici(owner: string, t: number, ricco = 0): LotState {
  let l = newLot(owner, t);
  l = build(l, 'segheria', SEG, t);
  l = advance(l, t + MIN);
  l = build(l, 'cava', CAVA, t + MIN);
  l = advance(l, t + 10 * MIN);
  if (ricco) l = { ...l, resources: { ...l.resources, legno: l.resources.legno + ricco, pietra: l.resources.pietra + ricco }, ledger: { ...l.ledger, generated: { ...l.ledger.generated, legno: l.ledger.generated.legno + ricco, pietra: l.ledger.generated.pietra + ricco } } };
  return l;
}
const buf = (l: LotState, b: string) => l.buildings.find((x) => x.building === b)!.buffer;

test('content: porto_amici.json valido; soglie crescenti; nomi «alla Pesca»', () => {
  assert.deepEqual(validatePortoAmici(), []);
  assert.equal(FARO.livelli.length, 3);
  assert.equal(alGioco('pesca'), 'alla Pesca');
  assert.equal(alGioco('nuovo', 'Nuovo'), 'a Nuovo');
});

test('faro: livello dalle soglie (in ordine), prossimo livello, quanto manca, versamento dosato', () => {
  assert.equal(livelloDa({ legno: L1.legno - 1, pietra: L1.pietra }), 0);
  assert.equal(livelloDa({ legno: L1.legno, pietra: L1.pietra }), 1);
  assert.equal(livelloDa({ legno: L2.legno, pietra: L1.pietra }), 1, 'il 2 vuole anche la Pietra');
  assert.equal(livelloDa({ legno: 1e9, pietra: 1e9 }), 3);
  const f = faroNuovo();
  assert.equal(faroProssimo(f)?.livello, 1);
  const fine = FARO.livelli[2]!;
  assert.deepEqual(faroManca(f), { legno: fine.legno, pietra: fine.pietra });
  assert.deepEqual(dosaDono(f, { legno: 50.7, pietra: -3 }), { legno: 50, pietra: 0 });
  assert.deepEqual(dosaDono(f, { legno: 1e9, pietra: 'tanto' }), { legno: fine.legno, pietra: 0 }, 'mai oltre il faro completo');
  const pieno: FaroStato = { ...f, legno: fine.legno, pietra: fine.pietra };
  assert.deepEqual(dosaDono(pieno, { legno: 10, pietra: 10 }), { legno: 0, pietra: 0 });
});

test('faro: versamento dal lotto = spesa nel libro mastro, idempotente per id; totali del faro in pari coi lotti', () => {
  let a = conEdifici('ada', T0, 3000), b = conEdifici('bo', T0, 3000);
  let f = faroNuovo();
  const dona = (l: LotState, chi: string, id: string, d: { legno: number; pietra: number }, t: number) => {
    const dopo = donaAlFaro(l, id, d, t);
    if (dopo !== l && !faroDi(l).doni.includes(id)) f = versaNelFaro(f, chi, d, t).faro;
    return dopo;
  };
  const a0 = a.resources;
  a = dona(a, 'ada', 'v1', { legno: 200, pietra: 50 }, T0 + H);
  assert.equal(a.resources.legno, a0.legno - 200 + 0, 'Legno uscito dal Magazzino');
  assert.equal(a.resources.pietra, a0.pietra - 50);
  assert.deepEqual(faroDi(a).versato, { legno: 200, pietra: 50 });
  // ripetuto (il coordinatore dopo un crash): niente di nuovo
  const again = donaAlFaro(a, 'v1', { legno: 200, pietra: 50 }, T0 + 2 * H);
  assert.equal(again, a);
  b = dona(b, 'bo', 'v2', { legno: 50, pietra: 200 }, T0 + H);
  assert.equal(checkInvariant([a, b]), null, 'Σ risorse = generato − speso');
  assert.equal(controllaFaro([a, b], f), null);
  assert.deepEqual({ legno: f.legno, pietra: f.pietra }, { legno: 250, pietra: 250 });
  assert.deepEqual(classificaFaro(f).map((x) => x.chi), ['ada', 'bo'].sort(), 'pari merito: ordine dell’id');
  // senza risorse: errore con quanto manca, lotto invariato
  assert.throws(() => donaAlFaro(b, 'v3', { legno: 1e6, pietra: 0 }, T0 + H), (e: unknown) => e instanceof EconomyError && e.code === 'risorse' && (e.manca?.legno ?? 0) > 0);
  assert.throws(() => donaAlFaro(b, 'v4', { legno: 0, pietra: 0 }, T0 + H), (e: unknown) => e instanceof EconomyError && e.code === 'faro');
  // gli id tenuti sono al massimo doniTenuti
  let c = conEdifici('cy', T0, 3000);
  for (let i = 0; i < FARO.doniTenuti + 5; i++) c = donaAlFaro(c, 'x' + i, { legno: 1, pietra: 0 }, T0 + H);
  assert.equal(faroDi(c).doni.length, FARO.doniTenuti);
  assert.equal(faroDi(c).versato.legno, FARO.doniTenuti + 5);
});

test('faro: le soglie fanno salire il livello nel momento del versamento; più livelli in un colpo', () => {
  let f = faroNuovo();
  let r = versaNelFaro(f, 'ada', { legno: L1.legno, pietra: L1.pietra - 1 }, T0);
  assert.deepEqual(r.saliti, []);
  r = versaNelFaro(r.faro, 'bo', { legno: 0, pietra: 1 }, T0 + H);
  assert.deepEqual(r.saliti, [1]);
  assert.deepEqual(r.faro.livelli, [T0 + H]);
  f = r.faro;
  r = versaNelFaro(f, 'ada', { legno: 1e6, pietra: 1e6 }, T0 + 2 * H);
  assert.deepEqual(r.saliti, [2, 3]);
  assert.deepEqual(r.faro.livelli, [T0 + H, T0 + 2 * H, T0 + 2 * H]);
  assert.equal(faroProssimo(r.faro), null);
  assert.deepEqual(classificaFaro(r.faro).map((x) => x.chi), ['ada', 'bo']);
});

test('faro: il bonus si applica in advance dal momento della salita, solo a Segheria e Cava, anche se il lotto lo scopre dopo', () => {
  const base = conEdifici('ada', T0);
  const sale = T0 + 2 * H, fine = T0 + 4 * H;
  const senza = advance(base, fine);
  const con = advance(segnaFaro(base, [sale]), fine);
  const rate = (b: string) => building(b).levels[0]!.rate!;
  for (const b of ['segheria', 'cava']) {
    const atteso = buf(senza, b) + rate(b) * 2 * L1.bonus; // 2 ore su 4 col bonus del livello 1
    assert.ok(Math.abs(buf(con, b) - atteso) < 1e-6, `${b}: ${buf(con, b)} invece di ${atteso}`);
  }
  // il lotto che impara la salita dopo averla già passata in advance: il tratto già fatto resta senza bonus (niente regali indietro)
  const tardi = advance(segnaFaro(advance(base, T0 + 3 * H), [sale]), fine);
  for (const b of ['segheria', 'cava']) assert.ok(buf(tardi, b) > buf(senza, b) && buf(tardi, b) < buf(con, b), `${b} tardi`);
  // livelli e moltiplicatori
  assert.equal(faroComuneLivello([sale], sale - 1), 0);
  assert.equal(faroComuneLivello([sale, sale + H], sale + H), 2);
  assert.equal(faroComuneK(2, 'segheria'), 1 + L2.bonus);
  assert.equal(faroComuneK(3, 'magazzino'), 1);
  assert.equal(faroComuneK(0, 'cava'), 1);
});

test('faro: segnaFaro non torna mai indietro e tiene i momenti crescenti', () => {
  const l = newLot('ada', T0);
  const a = segnaFaro(l, [T0, T0 + H]);
  assert.deepEqual(faroDi(a).livelli, [T0, T0 + H]);
  assert.equal(segnaFaro(a, [T0]), a, 'meno livelli: invariato');
  assert.equal(segnaFaro(a, [T0, T0 + H]), a, 'gli stessi: invariato');
  const b = segnaFaro(a, [1, 2, T0 + 2 * H, T0 + 9 * H]);
  assert.deepEqual(faroDi(b).livelli, [T0, T0 + H, T0 + 2 * H], 'i noti restano, al massimo 3');
  assert.deepEqual(faroDi(segnaFaro(l, ['x', -1, T0])).livelli, [T0], 'solo numeri validi');
});

test('record: migliore di oggi e di sempre, pari = resta chi c’era, il giorno nuovo azzera oggi, chi viene superato', () => {
  let t = tabelloneNuovo();
  let r = segnaRecord(t, 'pesca', { chi: 'ada', score: 20, medal: 'oro', detail: { pesci: 9, x: 'no' } }, T0);
  assert.ok(r.oggi && r.sempre && r.superato === null);
  assert.deepEqual(r.tab.oggi['pesca']?.detail, { pesci: 9 });
  t = r.tab;
  r = segnaRecord(t, 'pesca', { chi: 'bo', score: 20, medal: 'oro' }, T0 + H);
  assert.ok(!r.oggi && !r.sempre, 'a pari punteggio resta Ada');
  assert.equal(r.tab, t);
  r = segnaRecord(t, 'pesca', { chi: 'bo', score: 25, medal: 'oro' }, T0 + H);
  assert.ok(r.oggi && r.sempre);
  assert.equal(r.superato, 'ada', 'Ada era la migliore di sempre');
  t = r.tab;
  r = segnaRecord(t, 'pesca', { chi: 'bo', score: 30, medal: 'oro' }, T0 + 2 * H);
  assert.equal(r.superato, null, 'battere sé stessi non avvisa nessuno');
  t = r.tab;
  // il giorno dopo: oggi vuoto, sempre resta; una partita peggiore diventa la migliore di oggi
  assert.deepEqual(recordDi(t, T0 + DAY).oggi, {});
  assert.equal(recordDi(t, T0 + DAY).sempre['pesca']?.score, 30);
  r = segnaRecord(t, 'pesca', { chi: 'ada', score: 5, medal: 'bronzo' }, T0 + DAY);
  assert.ok(r.oggi && !r.sempre && r.superato === null);
  assert.equal(recordDi(r.tab, T0 + DAY).oggi['pesca']?.chi, 'ada');
  assert.equal(recordDi(r.tab, T0 + DAY).sempre['pesca']?.chi, 'bo');
  // minigiochi separati
  r = segnaRecord(r.tab, 'regata', { chi: 'cy', score: 9000, medal: 'argento', detail: { ms: 30000 } }, T0 + DAY);
  assert.equal(recordDi(r.tab, T0 + DAY).sempre['regata']?.detail['ms'], 30000);
  assert.equal(recordDi(r.tab, T0 + DAY).sempre['pesca']?.chi, 'bo');
  assert.equal(Object.keys(detailCorto(Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['k' + i, i])))).length, 16);
});
