// «Mentre eri via» e libro degli ospiti (#86): soglia dell'assenza, riepilogo (depositi, cantiere finito anche se qualcuno ha guardato
// l'isola nel frattempo, firme arrivate, missioni nuove), «ci sono» che non torna indietro, firma una al giorno, tetto del libro, nome pulito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR, RIENTRO } from '@marea/content';
import { MISSIONI } from '@marea/content/porto.ts';
import { build, collectAll, newLot } from '../src/economy/actions.ts';
import { advance } from '../src/economy/advance.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { firmaLibro, firmatoOggi, firmeRecenti, nomeFirma, riepilogoAssenza, rientra, segnaVisto } from '../src/economy/rientro.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';

const DAY = 86_400_000, H = 3_600_000, MIN = 60_000;
const T0 = 20_000 * DAY + 2 * H; // le due di notte UTC
const SEG: [number, number] = [6, 10], CAVA: [number, number] = [12, 5];
const isFirma = (e: unknown) => e instanceof EconomyError && e.code === 'firma';

/** Lotto con Segheria e Cava finite all'ora `t`. */
function conEdifici(t: number): LotState {
  let l = newLot('bea', t);
  l = build(l, 'segheria', SEG, t);
  l = advance(l, t + 60_000);
  l = build(l, 'cava', CAVA, t + 60_000);
  return advance(l, t + 10 * MIN);
}

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

test('rientro: depositi pieni, cantiere finito durante l’assenza (anche dopo una visita che ha avanzato il lotto), missioni nuove', () => {
  let l = rientra(conEdifici(T0), T0 + 10 * MIN).lot; // visto alle 2:10
  l = build(l, 'magazzino', [12, 10], T0 + 11 * MIN); // finisce 5 min dopo
  const visita = advance(l, T0 + 2 * H); // un amico guarda l'isola: il cantiere si chiude e sparisce
  assert.equal(visita.construction, null);
  const t = T0 + 6 * H;
  const r = rientra(visita, t);
  assert.ok(r.riepilogo);
  assert.equal(r.riepilogo.assenteMs, 6 * H - 10 * MIN);
  assert.deepEqual(r.riepilogo.cantiere && { b: r.riepilogo.cantiere.building, l: r.riepilogo.cantiere.level }, { b: 'magazzino', l: 1 });
  assert.ok(r.riepilogo.depositi.legno >= 100 && r.riepilogo.depositi.pietra >= 60, JSON.stringify(r.riepilogo.depositi));
  assert.equal(r.riepilogo.depositi.perle, 0);
  assert.equal(r.riepilogo.missioniNuove, 0, 'stesso giorno UTC');
  // RACCOGLI TUTTO: i depositi arrivano nelle risorse (sotto il tetto del Magazzino), il libro mastro resta in pari
  const dopo = collectAll(r.lot, t);
  assert.equal(dopo.resources.legno - r.lot.resources.legno, r.riepilogo.depositi.legno);
  assert.equal(dopo.resources.pietra - r.lot.resources.pietra, r.riepilogo.depositi.pietra);
  assert.equal(checkInvariant([dopo]), null);
  // il giorno dopo: missioni nuove; il cantiere di ieri non si ripete
  const dom = rientra(dopo, t + DAY);
  assert.equal(dom.riepilogo?.missioniNuove, MISSIONI.alGiorno);
  assert.equal(dom.riepilogo?.cantiere, null);
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
  assert.throws(() => firmaLibro(a, 'anna', 'Anna', 'balla', T0 + 3 * H), isFirma, 'emote inesistente');
  assert.throws(() => firmaLibro(a, 'anna', '  <> ', e, T0 + 3 * H), isFirma, 'nome vuoto');
  const b = firmaLibro(a, 'anna', 'Anna', AVATAR.emote[1]!, T0 + 3 * H);
  const domani = (T0 - (T0 % DAY)) + DAY + 60_000;
  const c = firmaLibro(b, 'marco', 'Marco', e, domani);
  assert.equal(c.ospiti?.length, 3);
  assert.deepEqual(firmeRecenti(c, 2).map((f) => f.chi), ['marco', 'anna'], 'le più recenti prima');
  assert.deepEqual(c.resources, l0.resources, 'firmare non tocca l’economia');
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
