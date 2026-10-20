// «Mentre eri via» e libro degli ospiti: soglia dell'assenza, riepilogo (firme arrivate, missioni nuove), «ci sono» che non torna
// indietro, firma una al giorno, tetto del libro, nome pulito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR, RIENTRO } from '@marea/content';
import { MISSIONI } from '@marea/content/porto.ts';
import { newLot } from '../src/economy/actions.ts';
import { firmaLibro, firmatoOggi, firmeRecenti, nomeFirma, riepilogoAssenza, rientra, segnaVisto } from '../src/economy/rientro.ts';
import { EconomyError } from '../src/economy/types.ts';

const DAY = 86_400_000, H = 3_600_000, MIN = 60_000;
const T0 = 20_000 * DAY + 2 * H; // le due di notte UTC
const isFirma = (e: unknown) => e instanceof EconomyError && e.code === 'firma';


test('rientro: al primo ingresso niente scheda, solo visto; sotto la soglia niente; oltre la soglia il riepilogo', () => {
  const l0 = newLot('bea', T0);
  const a = rientra(l0, T0);
  assert.equal(a.riepilogo, null);
  assert.equal(a.lot.visto, T0);
  const b = rientra(a.lot, T0 + (RIENTRO.sogliaMinuti - 1) * MIN);
  assert.equal(b.riepilogo, null, 'sotto la soglia');
  assert.equal(b.lot.visto, T0 + (RIENTRO.sogliaMinuti - 1) * MIN);
  const c = rientra(b.lot, b.lot.visto! + RIENTRO.sogliaMinuti * MIN);
  assert.ok(c.riepilogo, 'oltre la soglia');
  assert.equal(c.riepilogo.assenteMs, RIENTRO.sogliaMinuti * MIN);
  assert.ok(RIENTRO.sogliaMinuti >= 5 && RIENTRO.sogliaMinuti <= 60, 'soglia ragionevole');
});

test('rientro: il riepilogo dice da quanto mancavi e le missioni nuove (il giorno dopo); niente depositi né cantieri', () => {
  const l = rientra(newLot('bea', T0 + 10 * MIN), T0 + 10 * MIN).lot; // visto alle 2:10
  const t = T0 + 6 * H, r = rientra(l, t);
  assert.ok(r.riepilogo);
  assert.equal(r.riepilogo.assenteMs, 6 * H - 10 * MIN);
  assert.equal(r.riepilogo.missioniNuove, 0, 'stesso giorno UTC');
  assert.ok(!('depositi' in r.riepilogo) && !('cantiere' in r.riepilogo));
  assert.equal(rientra(r.lot, t + DAY).riepilogo?.missioniNuove, MISSIONI.alGiorno);
});

test('rientro: «ci sono» non torna indietro e sposta l’inizio dell’assenza', () => {
  const l = rientra(newLot('bea', T0), T0).lot;
  const v = segnaVisto(l, T0 + H);
  assert.equal(v.visto, T0 + H);
  assert.equal(segnaVisto(v, T0 + 30 * MIN), v, 'indietro no');
  assert.equal(rientra(v, T0 + H + 5 * MIN).riepilogo, null, 'giocava fino a 5 minuti fa');
  assert.equal(v.version, l.version, '«ci sono» non tocca la versione');
});

test('libro: firma con nome ed emote; mai sul proprio; una al giorno UTC per persona; il giorno dopo di nuovo', () => {
  const l0 = newLot('bea', T0);
  const e = AVATAR.emote[0]!;
  const a = firmaLibro(l0, 'marco', 'Marco', e, T0 + H);
  assert.deepEqual(a.ospiti, [{ chi: 'marco', nome: 'Marco', emote: e, quando: T0 + H }]);
  assert.ok(firmatoOggi(a, 'marco', T0 + 2 * H) && !firmatoOggi(a, 'anna', T0 + 2 * H));
  assert.throws(() => firmaLibro(a, 'marco', 'Marco', e, T0 + 3 * H), isFirma, 'due volte lo stesso giorno');
  assert.throws(() => firmaLibro(a, 'bea', 'Bea', e, T0 + 3 * H), isFirma, 'sul proprio libro');
  assert.throws(() => firmaLibro(a, 'anna', 'Anna', 'tango', T0 + 3 * H), isFirma, 'emote inesistente');
  assert.throws(() => firmaLibro(a, 'anna', '  <> ', e, T0 + 3 * H), isFirma, 'nome vuoto');
  const b = firmaLibro(a, 'anna', 'Anna', AVATAR.emote[1]!, T0 + 3 * H);
  const domani = (T0 - (T0 % DAY)) + DAY + 60_000;
  const c = firmaLibro(b, 'marco', 'Marco', e, domani);
  assert.equal(c.ospiti?.length, 3);
  assert.deepEqual(firmeRecenti(c, 2).map((f) => f.chi), ['marco', 'anna'], 'le più recenti prima');
  assert.equal(c.monete, l0.monete, 'firmare non tocca l’economia');
});

test('libro: tetto di firme (le più vecchie escono), nome tagliato e pulito; le firme dell’assenza nel riepilogo', () => {
  let l = rientra(newLot('bea', T0), T0).lot;
  const n = RIENTRO.firme.tetto + 7;
  for (let i = 0; i < n; i++) l = firmaLibro(l, `amico-${i}`, `Amico ${i}`, AVATAR.emote[i % AVATAR.emote.length]!, T0 + (i + 1) * MIN);
  assert.equal(l.ospiti?.length, RIENTRO.firme.tetto);
  assert.equal(l.ospiti?.[0]?.chi, 'amico-7', 'escono le più vecchie');
  assert.equal(nomeFirma('  Un nome\u0000 lunghissimo <b>che non finisce mai  '), 'Un nome lunghiss'.slice(0, RIENTRO.firme.nomeMax));
  assert.ok(nomeFirma('x'.repeat(40)).length === RIENTRO.firme.nomeMax);
  const r = riepilogoAssenza(l, T0 + 30 * MIN, T0 + 2 * H);
  assert.equal(r.ospitiTot, n - 30, 'firme arrivate dopo le 2:30');
  assert.equal(r.ospiti.length, Math.min(RIENTRO.firme.mostra, n - 30));
  assert.equal(r.ospiti[0]?.chi, `amico-${n - 1}`, 'la più recente prima');
  assert.ok(RIENTRO.firme.mostra <= RIENTRO.firme.tetto);
});
