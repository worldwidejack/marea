// I nemici e la Missione 0 dello sparatutto (banco provasparo.html, #355; src/sparo/bot.ts, coperture.ts, missione.ts). Cosa si controlla:
// - le sentinelle fanno la ronda; non ti vedono alle spalle, ti vedono davanti;
// - uno sparo mette in allerta chi lo sente; chi è lontano no;
// - in allerta, dopo la reazione, un nemico corre a un riparo da cui non lo vedi (o ti aggira) e poi esce a sparare;
// - un nemico che ti vede ti colpisce (il danno arriva, la mira si stringe);
// - la gru si sabota tenendo AZIONE per 3 s nel cerchio: se lasci si ricomincia; intanto non spari;
// - a terra la missione è persa; il pilota automatico (immortale) la finisce con rinforzi, gru sabotata e medaglia;
// - è deterministico: stessi comandi, stessa partita.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPARO } from '@marea/content/sparo.ts';
import { TICK_HZ } from '../src/constants.ts';
import { hashJson } from '../src/hash.ts';
import { mappaSparo, vede } from '../src/sparo/mappa.ts';
import { cellCenter } from '../src/dungeon/map.ts';
import { ferisci } from '../src/sparo/colpi.ts';
import { ripari } from '../src/sparo/coperture.ts';
import { autopilota, nuovaPartita, passo } from '../src/sparo/sparo.ts';
import type { SInput, SState } from '../src/sparo/stato.ts';
import { NESSUN_INPUT, occhi } from '../src/sparo/stato.ts';

const m = mappaSparo();
const per = (s: SState, sec: number, c: (s: SState) => SInput) => { for (let i = 0; i < sec * TICK_HZ && !s.missione?.esito; i++) passo(s, c(s)); };
const fermo = (s: SState): SInput => ({ ...NESSUN_INPUT, yaw: s.g.yaw, pitch: s.g.pitch });
const missione = (seme = 3) => nuovaPartita(seme, { modo: 'missione' });
/** Tiene solo il nemico `i` (gli altri a terra, fuori gioco). */
const solo = (s: SState, i: number) => { s.bot.forEach((b, k) => { if (k !== i) { b.vita = 0; b.morto = 1; } }); return s.bot[i]!; };

test('le sentinelle fanno la ronda', () => {
  const s = missione();
  s.g.x = -8; s.g.z = 22; // fuori dal muro di container: nessuno lo vede né lo sente
  const prima = s.bot.map((b) => [b.x, b.z]);
  per(s, 8, fermo);
  const mosse = s.bot.filter((b, i) => Math.hypot(b.x - prima[i]![0]!, b.z - prima[i]![1]!) > 2).length;
  assert.ok(mosse >= 4, `si sono mosse ${mosse} sentinelle su ${s.bot.length}`);
  assert.equal(s.bot[5]!.stato, 'fermo', 'quella alla barca sta ferma');
});

test('non ti vede alle spalle, ti vede davanti', () => {
  // la sentinella 1 parte verso ovest lungo il muro nord (z 5,5, prima tappa x 24): tu dietro, a est
  const s = missione(), b = solo(s, 1);
  s.g.x = 37; s.g.z = 5.2;
  per(s, 1, fermo);
  assert.equal(b.stato, 'pattuglia', `alle spalle: ${b.stato}`);
  s.g.x = b.x - 7 * Math.sin(b.yaw); s.g.z = b.z - 7 * Math.cos(b.yaw); // 7 m davanti a lei
  per(s, 0.3, fermo);
  assert.equal(b.stato, 'allerta', `davanti: ${b.stato}`);
});

test('uno sparo mette in allerta chi lo sente, chi è lontano no', () => {
  const s = missione();
  s.g.x = 5; s.g.z = 5.5;
  passo(s, { ...fermo(s), pitch: 0.6, fuoco: true });
  const vicini = s.bot.filter((b) => Math.hypot(b.x - 5, b.z - 5.5) <= SPARO.nemici.udito), lontani = s.bot.filter((b) => Math.hypot(b.x - 5, b.z - 5.5) > SPARO.nemici.udito + 3);
  assert.ok(vicini.length >= 1 && vicini.every((b) => b.stato === 'allerta'), vicini.map((b) => b.stato).join());
  assert.ok(lontani.length >= 1 && lontani.every((b) => b.stato === 'pattuglia' || b.stato === 'fermo'), lontani.map((b) => b.stato).join());
});

test('in allerta corre a un riparo da cui non lo vedi, poi esce a sparare', () => {
  const s = missione(), b = solo(s, 2);
  s.g.x = 9; s.g.z = 29; // in campo aperto a ovest della gru
  b.x = 22; b.z = 29.5; b.ux = s.g.x; b.uz = s.g.z; b.vistoT = s.tick; b.stato = 'allerta'; b.allertaT = 0; b.timer = 0;
  const stati = new Set<string>();
  for (let i = 0; i < 8 * TICK_HZ; i++) { passo(s, fermo(s)); stati.add(b.stato); if (b.stato === 'copertura' && b.timer > 0) break; }
  assert.equal(b.stato, 'copertura', [...stati].join(' → '));
  const c = cellCenter(m, b.meta), r = ripari(m).find((x) => x.cella === b.meta)!;
  assert.ok(!vede(m, s.g.x, occhi(s.g), s.g.z, c.x, r.alto ? 1.5 : 0.95, c.z), 'dal tuo occhio la sua testa non si vede');
  per(s, 3.5, fermo);
  assert.ok(stati.add(b.stato) && (b.stato === 'sporge' || s.g.dannoPreso > 0), `dopo un po' esce: ${b.stato}`);
});

test('un nemico che ti vede ti colpisce', () => {
  const s = missione(), b = solo(s, 0);
  s.g.x = 6.5; s.g.z = 28.5;
  b.x = 13.5; b.z = 28.5; b.yaw = Math.PI / 2; b.stato = 'sporge'; b.timer = 9999; b.allertaT = 0; b.vistoT = 0; b.ux = s.g.x; b.uz = s.g.z;
  per(s, 4, fermo);
  assert.ok(s.g.dannoPreso > 0 && s.g.vita < 100, `danno preso ${s.g.dannoPreso}`);
});

test('la gru si sabota tenendo AZIONE 3 s nel cerchio; se lasci si ricomincia; intanto non spari', () => {
  const s = missione();
  s.bot.forEach((b) => { b.vita = 0; b.morto = 1; });
  passo(s, fermo(s));
  assert.equal(s.missione!.obiettivo, 1);
  assert.equal(s.bot.filter((b) => b.rinforzo).length, 3, 'arrivano i rinforzi');
  s.bot.forEach((b) => { b.vita = 0; b.morto = 1; });
  s.g.x = SPARO.mappa.gru.x; s.g.z = SPARO.mappa.gru.z + 1;
  const sab = (x: SState): SInput => ({ ...fermo(x), azione: true, fuoco: true, pitch: 0.4 });
  per(s, 2, sab);
  passo(s, fermo(s));
  per(s, 1.5, sab);
  assert.equal(s.missione!.obiettivo, 1, 'lasciato a metà: si ricomincia');
  assert.equal(s.g.sparati, 0, 'sabotando non si spara');
  per(s, 3.1, sab);
  assert.equal(s.missione!.obiettivo, 2);
});

test('a terra la missione è persa', () => {
  const s = missione();
  passo(s, fermo(s));
  ferisci(s, -1, 0, 500, false, s.g.x, 1, s.g.z);
  per(s, SPARO.missione.caduto + 0.2, fermo);
  assert.equal(s.missione!.esito, 'persa');
});

test('il pilota automatico (immortale) finisce la missione', () => {
  const s = nuovaPartita(7, { modo: 'missione', immortale: true });
  let t = 0;
  while (!s.missione!.esito && t < 6 * 60 * TICK_HZ) { passo(s, autopilota(s)); t++; }
  assert.equal(s.missione!.esito, 'vinta', `obiettivo ${s.missione!.obiettivo} dopo ${(t / TICK_HZ).toFixed(0)} s, vivi ${s.bot.filter((b) => !b.morto).length}`);
  assert.ok(s.missione!.rinforzi && s.missione!.medaglia !== '');
  assert.ok(s.g.dannoPreso > 0, 'i nemici hanno sparato e colpito');
});

test('deterministico anche coi nemici', () => {
  const gioca = () => { const s = nuovaPartita(11, { modo: 'missione', immortale: true }); per(s, 40, autopilota); return hashJson(s); };
  assert.equal(gioca(), gioca());
});
