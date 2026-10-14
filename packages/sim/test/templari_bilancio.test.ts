// Bilanciamento dei Templari alla Call of Duty Zombies (Black Ops): vita degli zombie che cresce a ogni ondata (+100 fino alla 9, poi ×1,1),
// armi che uccidono con un colpo fino a un'ondata che dipende dal prezzo, potenziamento del Mercante da 5000 che allunga la vita di un'arma
// di qualche ondata ma mai fino in fondo, pozioni della Strega ai prezzi di Black Ops, e un'economia per cui le cose care arrivano tardi.
// «Un colpo fino all'ondata n» = il danno di un colpo (trombone: tutti i pallini, da vicino) basta per la vita dell'ondata n.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { potenziata, quantiOndata, vitaOndata } from '../src/templari/stato.ts';

const colpo = (id: string, pot = false) => { const a = pot ? potenziata(armaDef(id)) : armaDef(id); return a.danno * (a.pallini ?? 1); };
/** Ultima ondata in cui un colpo uccide un fante. */
function unColpoFino(id: string, pot = false): number {
  const d = colpo(id, pot);
  let n = 0;
  while (n < 80 && vitaOndata(n + 1) <= d) n++;
  return n;
}
const MURO = ['mazza', 'ascia', 'pistola', 'moschetto', 'trombone'];
const CASSA = ['arco_lungo', 'martello', 'pistola_doppia'];
const MIRACOLOSE = ['fuoco_greco', 'spada_molay'];

test('vita degli zombie: +100 a ondata fino alla 9, poi ×1,1 (come COD)', () => {
  assert.deepEqual([1, 5, 9].map(vitaOndata), [150, 550, 950]);
  assert.equal(vitaOndata(10), 1045);
  assert.ok(vitaOndata(20) > 2700 && vitaOndata(20) < 2720);
  for (let n = 1; n < 50; n++) assert.ok(vitaOndata(n + 1) > vitaOndata(n) && quantiOndata(n + 1) >= quantiOndata(n));
});

test('armi: un colpo fino a un\'ondata che sale col prezzo, mai oltre la 16 per quelle normali', () => {
  assert.equal(unColpoFino('spada'), 2);
  for (const id of ['mazza', 'ascia', 'pistola']) { const n = unColpoFino(id); assert.ok(n >= 5 && n <= 10, `${id}: un colpo fino alla ${n}`); }
  for (const id of ['moschetto', 'trombone']) { const n = unColpoFino(id); assert.ok(n >= 11 && n <= 16, `${id}: un colpo fino alla ${n}`); }
  for (const id of CASSA) { const n = unColpoFino(id); assert.ok(n >= 10 && n <= 16, `${id}: un colpo fino alla ${n}`); }
  for (const id of MIRACOLOSE) assert.ok(unColpoFino(id) >= 20, id);
  // più costa sul muro, più dura (a parità di prezzo vale tutto)
  const muro = MURO.map((id) => [armaDef(id).prezzo!, unColpoFino(id)] as const).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < muro.length; i++) if (muro[i]![0] > muro[i - 1]![0]) assert.ok(muro[i]![1] >= muro[i - 1]![1], JSON.stringify(muro));
});

test('potenziamento del Mercante: 5000 punti, qualche ondata in più, mai un colpo solo fino in fondo', () => {
  assert.equal(TEMPLARI.mercante.potenzia.prezzo, 5000); // il Pack-a-Punch di Black Ops
  for (const id of ['spada', 'arco', ...MURO, ...CASSA]) {
    const prima = unColpoFino(id), dopo = unColpoFino(id, true);
    assert.ok(dopo - prima >= 2 && dopo - prima <= 9, `${id}: da ${prima} a ${dopo}`);
    assert.ok(dopo <= 23, `${id} potenziata: un colpo fino alla ${dopo}`);
  }
  // alla 30 nessuna arma normale, nemmeno potenziata, uccide con un colpo; servono almeno 2 colpi
  for (const id of [...MURO, ...CASSA]) assert.ok(colpo(id, true) * 2 <= vitaOndata(30) * 1.2, id);
  // le miracolose si potenziano meno (sono già fortissime)
  for (const id of MIRACOLOSE) assert.ok(colpo(id, true) / colpo(id) < TEMPLARI.mercante.potenzia.danno, id);
  // caricatore e munizioni crescono, la ricarica si accorcia
  const m = potenziata(armaDef('moschetto'));
  assert.ok(m.riserva! > armaDef('moschetto').riserva! && m.ricarica! < armaDef('moschetto').ricarica!);
  assert.equal(m.nome, armaDef('moschetto').nomePot);
});

test('pozioni della Strega: prezzi di Black Ops, la Zuppa di pietra ti fa reggere 4 colpi invece di 2', () => {
  const p = Object.fromEntries(TEMPLARI.strega.pozioni.map((x) => [x.id, x]));
  assert.deepEqual([p['pietra']!.prezzo, p['viandante']!.prezzo, p['lesto']!.prezzo, p['bombardiere']!.prezzo, p['risorto']!.prezzo], [2500, 2000, 3000, 2000, 1500]);
  const fante = TEMPLARI.nemici.find((n) => n.id === 'fante')!.danno, retti = (vita: number) => Math.ceil(vita / fante) - 1;
  assert.equal(retti(TEMPLARI.eroe.vita), 2);
  assert.equal(retti(p['pietra']!.vita!), 4);
  assert.equal(TEMPLARI.strega.max, 4);
});

/** Il massimo di punti alla fine dell'ondata n: tutti uccisi con la spada di partenza (i colpi in mischia rendono di più), tutte le assi. */
function puntiMassimi(n: number): number {
  const k = TEMPLARI.punti, spada = armaDef('spada').danno;
  let tot = TEMPLARI.partenza.punti;
  for (let o = 1; o <= n; o++) tot += quantiOndata(o) * (k.colpo * (Math.ceil(vitaOndata(o) / spada) - 1) + k.mischia) + k.assiMaxOndata;
  return tot;
}

test('economia: il potenziamento non arriva prima della 5ª ondata, quattro pozioni non prima della 6ª', () => {
  const po = TEMPLARI.porte;
  const allaSpiaggia = Math.min(po['portale']!.prezzo + po['taverna']!.prezzo + po['spiaggia_taverna']!.prezzo, po['cimitero']!.prezzo + po['spiaggia_cimitero']!.prezzo);
  const potenziare = allaSpiaggia + TEMPLARI.mercante.potenzia.prezzo;
  assert.ok(puntiMassimi(4) < potenziare, `alla fine della 4ª: ${puntiMassimi(4)} punti al massimo, il potenziamento ne costa ${potenziare}`);
  const quattro = po['cimitero']!.prezzo + TEMPLARI.strega.pozioni.map((p) => p.prezzo).sort((a, b) => a - b).slice(0, 4).reduce((a, b) => a + b, 0);
  assert.ok(puntiMassimi(5) < quattro, `alla fine della 5ª: ${puntiMassimi(5)} punti al massimo, quattro pozioni ne costano ${quattro}`);
  // ma si arriva: con un gioco buono (metà dei punti massimi) tutto entro la 12ª
  assert.ok(puntiMassimi(12) / 2 > potenziare + quattro, `alla 12ª: ${puntiMassimi(12) / 2}`);
});
