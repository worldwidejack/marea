// Bilanciamento del Templare scudato (docs/TEMPLARI.md §8): lo scudo davanti prende i colpi finché non si spacca, poi lo zombie è scoperto;
// da dietro si colpisce pieno. Arriva piano piano: al massimo uno nelle prime ondate in cui compare, poi qualcuno in più.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, armaDef, nemicoDef } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { colpisci } from '../src/templari/colpi.ts';
import { maxInOndata, tipoNuovo } from '../src/templari/ondate.ts';
import { nuovoZombie, quantiOndata, vitaOndata } from '../src/templari/stato.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

function arena(ondata: number, seed = 1): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = ondata; s.quanti = 0; s.usciti = 0; s.prossima = 1e9;
  return s;
}
/** Uno scudato a 2 m davanti all'eroe che lo guarda (fx, fz verso l'eroe). */
function scudato(s: TState) {
  const z = nuovoZombie(s, 'scudato', s.eroe.x + 2, s.eroe.z, 1);
  z.st = 'insegue'; z.fx = -1; z.fz = 0;
  return z;
}
/** Colpi (o spari: il trombone sono `pallini` colpi) per abbattere lo scudato, da davanti o da dietro. */
function colpiPerUccidere(ondata: number, arma: string, davanti: boolean): number {
  const s = arena(ondata), z = scudato(s), a = armaDef(arma), pallini = a.pallini ?? 1;
  const dir = davanti ? 1 : -1; // il colpo va dall'eroe allo zombie: da davanti +X (lo zombie guarda −X), da dietro −X
  for (let n = 1; n <= 200; n++) {
    for (let p = 0; p < pallini; p++) colpisci(s, z, { danno: a.danno, mischia: a.tipo === 'mischia', caricato: false, dirX: dir, dirZ: 0, spinta: 0 });
    if (z.vita <= 0) return n;
  }
  return Infinity;
}

test('scudato: la vita è quella del fante, lo scudo regge 3/4 della vita dell\'ondata', () => {
  assert.equal(nemicoDef('scudato').vitaMolt, 1);
  const s = arena(6), z = scudato(s);
  assert.equal(z.max, vitaOndata(6));
  assert.equal(z.scudo, Math.round(vitaOndata(6) * 0.75));
});

test('scudato: da davanti lo scudo si spacca e poi muore; da dietro come un fante', () => {
  // il problema di prima: col trombone servivano ~4 caricatori; adesso uno o due spari
  assert.ok(colpiPerUccidere(6, 'trombone', true) <= 2, `trombone ondata 6: ${colpiPerUccidere(6, 'trombone', true)}`);
  assert.ok(colpiPerUccidere(10, 'trombone', true) <= 2, `trombone ondata 10: ${colpiPerUccidere(10, 'trombone', true)}`);
  assert.ok(colpiPerUccidere(15, 'trombone', true) <= 3, `trombone ondata 15: ${colpiPerUccidere(15, 'trombone', true)}`);
  assert.equal(colpiPerUccidere(6, 'trombone', false), 1);
  // spada arrugginita all'ondata 6: 2 colpi per lo scudo + 3 per lui, da dietro solo 3
  assert.equal(colpiPerUccidere(6, 'spada', true), 5);
  assert.equal(colpiPerUccidere(6, 'spada', false), 3);
  // ascia e moschetto: uno per lo scudo, uno per lui
  assert.equal(colpiPerUccidere(6, 'ascia', true), 2);
  assert.equal(colpiPerUccidere(10, 'moschetto', true), 2);
  // lo scudo resta un vantaggio: da davanti costa sempre più colpi che da dietro
  for (const n of [6, 10, 15, 20]) for (const a of ['spada', 'mazza', 'ascia', 'pistola', 'moschetto']) {
    assert.ok(colpiPerUccidere(n, a, true) > colpiPerUccidere(n, a, false), `${a} ondata ${n}`);
  }
});

test('scudato: scudo spaccato = evento, niente scudo a terra; morto con lo scudo intero lo lascia', () => {
  const s = arena(6), z = scudato(s);
  colpisci(s, z, { danno: 2000, mischia: false, caricato: false, dirX: 1, dirZ: 0, spinta: 0 });
  assert.equal(z.scudo, 0);
  assert.ok(s.eventi.some((e) => e.t === 'scudoSpaccato' && e.id === z.id));
  assert.equal(templari.view(s).zombie.find((v) => v.id === z.id)?.scudo, false);
  colpisci(s, z, { danno: 2000, mischia: false, caricato: false, dirX: 1, dirZ: 0, spinta: 0 });
  assert.equal(z.st, 'morto');
  assert.ok(!s.drops.some((d) => d.tipo === 'scudo'), 'lo scudo spaccato non resta a terra');
  const s2 = arena(6), z2 = scudato(s2);
  colpisci(s2, z2, { danno: 5000, mischia: true, caricato: false, dirX: -1, dirZ: 0, spinta: 0 }); // da dietro
  assert.equal(z2.st, 'morto');
  assert.ok(s2.drops.some((d) => d.tipo === 'scudo'), 'morto con lo scudo intero: lo scudo a terra');
});

test('scudato: Ira di Dio spacca lo scudo e uccide col primo colpo', () => {
  const s = arena(12), z = scudato(s);
  s.poteri.ira = s.tick + 600;
  colpisci(s, z, { danno: 250, mischia: true, caricato: false, dirX: 1, dirZ: 0, spinta: 0 });
  assert.equal(z.st, 'morto');
});

test('scudati per ondata: nessuno prima della 6, al massimo 1 alla 6 e alla 7, poi piano piano fino a 8', () => {
  assert.equal(maxInOndata('scudato', 5), 0);
  assert.equal(maxInOndata('scudato', 6), 1);
  assert.equal(maxInOndata('scudato', 7), 1);
  assert.equal(maxInOndata('scudato', 8), 2);
  assert.equal(maxInOndata('scudato', 10), 3);
  assert.equal(maxInOndata('scudato', 20), 8);
  assert.equal(maxInOndata('fante', 20), Infinity);
  // chi esce davvero in un'ondata intera, su tanti seed: mai oltre il tetto, e dall'8ª in media più di uno
  for (const n of [5, 6, 7, 8, 10, 14, 20, 30]) {
    let tot = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = arena(n, seed); s.tipiUsciti = {};
      let k = 0;
      for (let i = 0; i < quantiOndata(n); i++) { const t = tipoNuovo(s); s.tipiUsciti[t] = (s.tipiUsciti[t] ?? 0) + 1; if (t === 'scudato') k++; }
      assert.ok(k <= maxInOndata('scudato', n), `ondata ${n} seed ${seed}: ${k} scudati`);
      tot += k;
    }
    const media = tot / 40;
    if (n < 6) assert.equal(media, 0);
    if (n >= 10) assert.ok(media >= 1.5, `ondata ${n}: in media ${media} scudati`);
    // mai la maggioranza: gli scudati restano pochi rispetto all'ondata
    assert.ok(media <= quantiOndata(n) * 0.25, `ondata ${n}: in media ${media} su ${quantiOndata(n)}`);
  }
});

test('scudati in partita: l\'ondata 6 giocata fa uscire al massimo uno scudato', () => {
  const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
  for (let seed = 1; seed <= 6; seed++) {
    const s = templari.create({ seed, opzioni: { subito: true } });
    s.fase = 'pausa'; s.ondata = 5; s.faseT = 0;
    s.eroe.vita = 1e9;
    let visti = new Set<number>(), arrivato = false;
    for (let i = 0; i < 60 * 200 && s.ondata <= 6; i++) {
      if (s.ondata === 6) arrivato = true;
      stepTemplari(s, F);
      if (s.ondata === 6) for (const z of s.zombie) if (z.tipo === 'scudato') visti.add(z.id);
      // gli zombie muoiono subito: così l'ondata scorre e tutti escono
      for (const z of s.zombie) if (z.st === 'insegue') { z.vita = 0; z.st = 'morto'; z.stT = 0; }
    }
    assert.ok(arrivato && s.ondata === 7, `seed ${seed}: l'ondata 6 non è finita (ondata ${s.ondata})`);
    assert.ok(visti.size <= 1, `seed ${seed}: ${visti.size} scudati all'ondata 6`);
    visti = new Set();
  }
  assert.ok(TEMPLARI.nemici.some((n) => n.id === 'scudato' && n.maxOndata));
});
