// Diario del capitano e traguardi (#87): contenuti validi, conteggi dalle partite rigiocate (pesci per specie, perle per tipo, medaglia
// migliore), avvistamenti validati e deduplicati, sblocco dei traguardi, RISCUOTI una volta sola col libro mastro in pari, titoli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIARIO, ISOLE_DIARIO, PESCI_DIARIO, TRAGUARDI, validateDiario } from '@marea/content/diario.ts';
import { validateContent } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { daRiscuotere, diarioOf, isolaValida, progresso, registraDiscesa, registraPartita, registraVisti, riscuotiTraguardo, scegliTitolo, titoloDi, traguardiOf } from '../src/economy/diario.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { MINIGAMES, getMinigame } from '../src/minigames/registry.ts';
import { createRng } from '../src/rng.ts';
import { packInputs, quantize, replay, replayPartita } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const T0 = 1_800_000_000_000;
const CTX = { amici: 2 };
const t = (id: string) => TRAGUARDI.find((x) => x.id === id)!;
const stato = (lot: LotState, id: string) => traguardiOf(lot, CTX).find((x) => x.id === id)!;

test('diario: contenuti validi, minigiochi del diario = minigiochi registrati, traguardi ~20 con premi 5-30 Perle', () => {
  assert.deepEqual(validateDiario(), []);
  assert.deepEqual(validateContent(), []);
  assert.deepEqual(DIARIO.minigiochi.map((m) => m.id).sort(), Object.keys(MINIGAMES).sort(), 'ogni minigioco ha la sua riga nella pagina Medaglie');
  assert.ok(TRAGUARDI.length >= 18 && TRAGUARDI.length <= 26, `${TRAGUARDI.length} traguardi`);
  assert.ok(TRAGUARDI.every((x) => x.perle >= 5 && x.perle <= 30));
  assert.ok(ISOLE_DIARIO.some((i) => i.id === 'porto') && !ISOLE_DIARIO.some((i) => i.id === 'lotto'));
  assert.equal(titoloDi('pescatore'), 'Pescatore');
  assert.equal(titoloDi('boh'), null);
});

/** Partita giocata dall'autopilota (come il server: input quantizzati, poi replay). */
function partita(id: string, seed: number, opzioni?: Record<string, string>) {
  const m = getMinigame(id), s = m.create({ seed, difficulty: 2, ...(opzioni ? { opzioni } : {}) }), rng = createRng(seed), frames: InputFrame[] = [];
  for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
  return replayPartita(id, seed, 2, packInputs(frames), opzioni);
}

test('raccolta: la pesca conta i pesci per specie, la caccia le perle per tipo; replay() resta uguale', () => {
  const p = partita('pesca', 7, { mare: 'porto' });
  const tot = Object.values(p.raccolta).reduce((a, b) => a + b, 0);
  assert.equal(tot, p.result.detail['pesci'], 'pesci per specie = pesci presi');
  assert.ok(Object.keys(p.raccolta).every((id) => PESCI_DIARIO.some((f) => f.id === id)));
  const q = partita('perle', 11);
  assert.deepEqual(q.raccolta, { bianca: q.result.detail['bianche'], conchiglia: q.result.detail['conchiglie'], rosa: q.result.detail['rosa'], nera: q.result.detail['nere'] });
  const r = partita('regata', 3);
  assert.deepEqual(r.raccolta, {}, 'la regata non raccoglie niente');
});

test('registraPartita: pesci e perle nelle loro pagine, partite per minigioco, medaglia migliore (mai peggiorata)', () => {
  let lot = newLot('ada', T0);
  lot = registraPartita(lot, 'pesca', 'bronzo', { sardina: 3, tonno: 1, boh: 9 });
  lot = registraPartita(lot, 'pesca', 'oro', { sardina: 1 });
  lot = registraPartita(lot, 'pesca', 'argento', {});
  lot = registraPartita(lot, 'perle', null, { bianca: 20, nera: 1, bolla: 4 });
  lot = registraPartita(lot, 'regata', 'argento', { sardina: 99 });
  const d = diarioOf(lot);
  assert.deepEqual(d.pesci, { sardina: 4, tonno: 1 }, 'id fuori catalogo ignorati');
  assert.deepEqual(d.perle, { bianca: 20, nera: 1 });
  assert.deepEqual(d.giocati, { pesca: 3, perle: 1, regata: 1 });
  assert.deepEqual(d.medaglie, { pesca: 'oro', regata: 'argento' });
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

test('progresso dei traguardi: conteggi, «tutti» sul catalogo, amici dal contesto, edifici e partite di prima del diario', () => {
  let lot = newLot('ada', T0);
  assert.equal(daRiscuotere(lot, CTX).length, 0, 'lotto nuovo: niente da riscuotere');
  lot = registraPartita(lot, 'pesca', 'oro', { sardina: 5, orata: 3, tonno: 1, polpo: 1 });
  assert.deepEqual(progresso(lot, t('pescatore'), CTX), { fatto: 10, n: 10 });
  assert.deepEqual(progresso(lot, t('re_della_lenza'), CTX), { fatto: 10, n: 50 });
  assert.deepEqual(progresso(lot, t('tutte_le_specie'), CTX), { fatto: 4, n: PESCI_DIARIO.length });
  assert.equal(stato(lot, 'leggenda').compiuto, true);
  assert.equal(stato(lot, 'primo_oro').compiuto, true);
  assert.deepEqual(progresso(lot, t('oro_ovunque'), CTX), { fatto: 1, n: DIARIO.minigiochi.length });
  // amici: dal contesto (quanti hanno un'isola), senza amici non si compie mai
  lot = registraVisti(lot, { isole: ['lotto:mia'] }).lot;
  assert.deepEqual(progresso(lot, t('ospite_d_onore'), CTX), { fatto: 1, n: 2 });
  assert.deepEqual(progresso(lot, t('ospite_d_onore'), { amici: 1 }), { fatto: 1, n: 1 });
  assert.equal(progresso(lot, t('buon_vicino'), { amici: 0 }).fatto, 1);
  assert.deepEqual(progresso(newLot('ugo', T0), t('ospite_d_onore'), { amici: 0 }), { fatto: 0, n: 1 });
  // partite: anche quelle contate prima del diario (solo.giocate)
  const vecchio: LotState = { ...newLot('bea', T0), solo: { day: 0, premiate: 0, giocate: 60, pending: null } };
  assert.equal(stato(vecchio, 'lupo_di_mare').compiuto, true);
  // edifici: livello ≥ 1 (in costruzione = livello 0 non conta); Segheria L3
  const isola: LotState = { ...newLot('cri', T0), buildings: [
    ...newLot('cri', T0).buildings,
    ...['segheria', 'cava', 'magazzino', 'casa'].map((b, i) => ({ id: b, building: b, level: b === 'segheria' ? 3 : 1, cell: [i, 0] as [number, number], buffer: 0, lastMs: T0 })),
    { id: 'faro', building: 'faro', level: 0, cell: [9, 9], buffer: 0, lastMs: T0 },
  ] };
  assert.deepEqual(progresso(isola, t('capomastro'), CTX), { fatto: 4, n: 5 });
  assert.equal(stato(isola, 'boscaiolo').compiuto, true);
  // spedizioni
  assert.equal(stato(registraDiscesa(newLot('dan', T0)), 'speleologo').compiuto, true);
});

test('RISCUOTI: paga le Perle una volta sola, libro mastro in pari; non compiuto o sconosciuto = errore; poi il titolo', () => {
  let lot = registraPartita(newLot('ada', T0), 'pesca', 'bronzo', { sardina: 1 });
  assert.throws(() => riscuotiTraguardo(lot, 'pescatore', T0, CTX), (e: unknown) => e instanceof EconomyError && e.code === 'traguardo' && /1 su 10/.test(e.message));
  assert.throws(() => riscuotiTraguardo(lot, 'boh', T0, CTX), (e: unknown) => e instanceof EconomyError && e.code === 'sconosciuto');
  assert.throws(() => scegliTitolo(lot, 'primo_pesce'), (e: unknown) => e instanceof EconomyError && e.code === 'traguardo');
  const r = riscuotiTraguardo(lot, 'primo_pesce', T0, CTX);
  assert.deepEqual(r.premio, { legno: 0, pietra: 0, perle: t('primo_pesce').perle });
  assert.equal(r.lot.resources.perle, lot.resources.perle + t('primo_pesce').perle);
  assert.equal(r.traguardo.riscosso, true);
  assert.equal(checkInvariant([r.lot], { legno: 0, pietra: 0, perle: 0 }), null);
  assert.throws(() => riscuotiTraguardo(r.lot, 'primo_pesce', T0, CTX), (e: unknown) => e instanceof EconomyError && /già riscosso/.test(e.message));
  assert.ok(!daRiscuotere(r.lot, CTX).includes('primo_pesce'));
  lot = scegliTitolo(r.lot, 'primo_pesce');
  assert.equal(diarioOf(lot).titolo, 'primo_pesce');
  assert.equal(scegliTitolo(lot, 'primo_pesce'), lot, 'stesso titolo: niente cambia');
  assert.equal(diarioOf(scegliTitolo(lot, null)).titolo, null, 'null toglie il titolo');
  assert.throws(() => scegliTitolo(lot, 'boh'), (e: unknown) => e instanceof EconomyError && e.code === 'sconosciuto');
});

test('una pesca vera dell\'autopilota sblocca «Primo pesce» e «Primo oro» (come fa il server dopo il replay)', () => {
  const seed = 42, mare = { mare: 'largo' };
  const p = partita('pesca', seed, mare);
  assert.equal(replay('pesca', seed, 2, packInputs([]), mare).score, 0);
  const lot = registraPartita(newLot('ada', T0), 'pesca', p.result.medal, p.raccolta);
  const pronti = daRiscuotere(lot, CTX);
  assert.ok(pronti.includes('primo_pesce') && pronti.includes('prima_medaglia'), pronti.join(','));
  if (p.result.medal === 'oro') assert.ok(pronti.includes('primo_oro'));
});
