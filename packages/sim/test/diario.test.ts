// Diario del capitano: contenuti validi, conteggi dalle partite rigiocate (perle per tipo, medaglia migliore; i pesci dalla
// collezione della canna), avvistamenti validati e deduplicati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIARIO, ISOLE_DIARIO, validateDiario } from '@marea/content/diario.ts';
import { validateContent } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { diarioOf, isolaValida, registraDiscesa, registraPartita, registraVisti } from '../src/economy/diario.ts';
import type { LotState } from '../src/economy/types.ts';
import { MINIGAMES, getMinigame } from '../src/minigames/registry.ts';
import '../src/adrenalina/registra.ts'; // lo snowboard e le Corse sono nel registro solo dal lato server (come lo vede il DO del lotto)
import '../src/corse/registra.ts';
import { createRng } from '../src/rng.ts';
import { packInputs, quantize, replay, replayPartita } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const T0 = 1_800_000_000_000;

test('diario: contenuti validi, minigiochi del diario = minigiochi registrati', () => {
  assert.deepEqual(validateDiario(), []);
  assert.deepEqual(validateContent(), []);
  assert.deepEqual(DIARIO.minigiochi.map((m) => m.id).sort(), Object.keys(MINIGAMES).sort(), 'ogni minigioco ha la sua riga nella pagina Medaglie');
  assert.ok(ISOLE_DIARIO.some((i) => i.id === 'porto') && !ISOLE_DIARIO.some((i) => i.id === 'lotto'));
});

/** Partita giocata dall'autopilota (come il server: input quantizzati, poi replay). */
function partita(id: string, seed: number, opzioni?: Record<string, string>) {
  const m = getMinigame(id), s = m.create({ seed, difficulty: 2, ...(opzioni ? { opzioni } : {}) }), rng = createRng(seed), frames: InputFrame[] = [];
  for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
  return replayPartita(id, seed, 2, packInputs(frames), opzioni);
}

test('raccolta: la caccia conta le perle per tipo; replay() resta uguale', () => {
  const q = partita('perle', 11);
  assert.deepEqual(q.raccolta, { bianca: q.result.detail['bianche'], conchiglia: q.result.detail['conchiglie'], rosa: q.result.detail['rosa'], nera: q.result.detail['nere'] });
  const r = partita('regata', 3);
  assert.deepEqual(r.raccolta, {}, 'la regata non raccoglie niente');
});

test('registraPartita: perle nella loro pagina, partite per minigioco, medaglia migliore (mai peggiorata)', () => {
  let lot = newLot('ada', T0);
  lot = registraPartita(lot, 'perle', 'bronzo', { bianca: 3, bolla: 4 });
  lot = registraPartita(lot, 'perle', 'oro', { bianca: 17, nera: 1 });
  lot = registraPartita(lot, 'perle', 'argento', {});
  lot = registraPartita(lot, 'regata', 'argento', { sardina: 99 });
  const d = diarioOf(lot);
  assert.deepEqual(d.pesci, {}, 'i pesci non arrivano più dai minigiochi');
  assert.deepEqual(d.perle, { bianca: 20, nera: 1 }, 'id fuori catalogo ignorati');
  assert.deepEqual(d.giocati, { perle: 3, regata: 1 });
  assert.deepEqual(d.medaglie, { perle: 'oro', regata: 'argento' });
  assert.equal(lot.version, newLot('ada', T0).version, 'non tocca la versione (va con la partita)');
});

test('registraVisti: solo id dei cataloghi, niente doppioni, mai la propria isola; versione +1 solo con novità', () => {
  const lot0 = newLot('ada', T0);
  const a = registraVisti(lot0, { animali: ['gabbiano', 'gatto', 'gabbiano', 'drago'], isole: ['porto', 'lotto:mia', 'lotto:ada', 'atlantide', 'lotto:A B'] });
  assert.deepEqual(a.nuovi, { animali: ['gabbiano', 'gatto'], isole: ['porto', 'lotto:mia'] });
  assert.equal(a.lot.version, lot0.version + 1);
  const b = registraVisti(a.lot, { animali: ['gatto'], isole: ['porto'] });
  assert.deepEqual(b.nuovi, { animali: [], isole: [] });
  assert.equal(b.lot, a.lot, 'niente di nuovo: stesso oggetto');
  assert.ok(isolaValida('laguna', 'ada') && !isolaValida('lotto:ada', 'ada') && !isolaValida('lotto', 'ada'));
  let c = a.lot;
  for (let i = 0; i < 80; i++) c = registraVisti(c, { isole: [`lotto:p${i}`] }).lot;
  assert.equal(diarioOf(c).isole.filter((x) => x.startsWith('lotto:')).length, 64, 'tetto alle visite dei lotti');
});

test('una caccia alle perle vera dell’autopilota finisce nel diario: medaglia, partita e perle (come fa il server dopo il replay)', () => {
  const seed = 42, p = partita('perle', seed);
  assert.equal(replay('perle', seed, 2, packInputs([])).score, 0);
  const d = diarioOf(registraPartita(newLot('ada', T0), 'perle', p.result.medal, p.raccolta));
  assert.equal(d.giocati['perle'], 1);
  assert.equal(d.medaglie['perle'], p.result.medal ?? undefined);
  for (const [id, n] of Object.entries(p.raccolta)) if (n > 0) assert.equal(d.perle[id], n, id);
});

test('registraDiscesa: ogni spedizione tornata conta una volta, senza toccare la versione', () => {
  const l0 = newLot('ada', T0), l2 = registraDiscesa(registraDiscesa(l0));
  assert.equal(diarioOf(l2).dungeon, 2);
  assert.equal(l2.version, l0.version);
});
