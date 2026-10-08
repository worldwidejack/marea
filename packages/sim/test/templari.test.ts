// Partita a ondate dei Templari (docs/TEMPLARI.md): dati validi, mappa chiusa, ondate che salgono, determinismo del replay, premio col tetto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, validateTemplari } from '@marea/content/templari.ts';
import { createRng } from '../src/rng.ts';
import { encodeDungeon, packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { inputsTemplari, parseTAzioni, replayTemplari } from '../src/templari/replay.ts';
import { quantiOndata, vitaOndata } from '../src/templari/stato.ts';
import { finishTemplari, premioOndate, prendiReliquia, startTemplari } from '../src/templari/premio.ts';
import { sbloccoTema, viaggiatore } from '../src/world/temi.ts';
import { EconomyError } from '../src/economy/types.ts';
import { newLot } from '../src/economy/actions.ts';

/** Gioca col pilota fino a `ticks` (o alla fine): input quantizzati e registrati come fa il client. */
function gioca(seed: number, ticks: number, o: { subito?: boolean } = {}): { s: TState; frames: DungeonInput[] } {
  const s = templari.create({ seed, opzioni: o }), rng = createRng(seed).fork('autopilot'), frames: DungeonInput[] = [];
  while (!s.done && s.tick < ticks) { const f = quantizeDungeon(templari.autopilot(s, rng)); frames.push(f); stepTemplari(s, f); }
  return { s, frames };
}

test('templari: dati e arena validi', () => {
  assert.deepEqual(validateTemplari(), []);
  const s = templari.create({ seed: 1 });
  assert.equal(s.fase, 'altare');
  assert.ok(s.arena.finestre.length >= 6, 'finestre');
  assert.ok(s.arena.comparse.length >= 6, 'comparse');
  // l'eroe non esce dalla chiesa: ogni cella calpestabile all'inizio è pavimento della chiesa
  for (const i of s.arena.dentro) assert.equal(s.gr.eroe.solid[i], 0);
});

test('templari: vita e numero degli zombie come COD', () => {
  assert.equal(vitaOndata(1), 150);
  assert.equal(vitaOndata(9), 950);
  assert.ok(Math.abs(vitaOndata(10) - 1045) <= 1);
  assert.ok(vitaOndata(20) > 2600 && vitaOndata(20) < 2800);
  assert.deepEqual([1, 2, 3, 4, 5].map(quantiOndata), [6, 9, 11, 14, 17]);
  assert.ok(quantiOndata(200) <= TEMPLARI.ondate.quanti.max);
});

test('templari: la reliquia sull\'altare fa partire le ondate, il pilota ne supera qualcuna', () => {
  const { s } = gioca(7, 60 * 60 * 6);
  assert.ok(s.ondata >= 3, `ondata ${s.ondata}`);
  assert.ok(s.uccisioni >= 6 + 9, `uccisioni ${s.uccisioni}`);
  assert.ok(s.guadagnati > 0);
  const r = templari.result(s);
  assert.ok(r.superate >= 2);
});

test('templari: subito = ondate già partite, senza altare', () => {
  const s = templari.create({ seed: 3, opzioni: { subito: true } });
  assert.equal(s.fase, 'inizio');
  const { s: s2 } = gioca(3, 60 * 8, { subito: true });
  assert.equal(s2.ondata, 1);
});

test('templari: il replay del server dà lo stesso risultato (anche con gli input compressi e l\'uscita dal menu)', () => {
  const { s, frames } = gioca(11, 60 * 60 * 3);
  const r = templari.result(s);
  const packed = packDungeon(frames);
  const a = replayTemplari(11, {}, packed, []);
  assert.deepEqual(a, r);
  const enc = inputsTemplari(encodeDungeon(packed));
  assert.ok(enc);
  assert.deepEqual(replayTemplari(11, {}, enc!, []), r);
  // uscita dal menu alla fine: esito «uscito», stesse ondate
  const az = parseTAzioni([[frames.length, { t: 'esci' }]])!;
  const u = replayTemplari(11, {}, packed, az);
  assert.equal(u.esito, 'uscito');
  assert.equal(u.superate, r.superate);
  assert.equal(parseTAzioni([[0, { t: 'boh' }]]), null);
});

test('templari: morire costa la partita, l\'eroe fermo cade', () => {
  const s = templari.create({ seed: 5, opzioni: { subito: true } });
  while (!s.done && s.tick < 60 * 60 * 10) stepTemplari(s, { mx: 0, my: 0, a: false, b: false, c: false, d: false });
  assert.equal(s.esito, 'morto');
  assert.equal(templari.result(s).superate, 0);
});

test('templari: premio per ondata superata col tetto del giorno', () => {
  assert.deepEqual(premioOndate(10), { legno: 150, pietra: 80, perle: 20 });
  assert.deepEqual(premioOndate(99), premioOndate(TEMPLARI.premio.maxOndate));
  const now = 1_800_000_000_000;
  let lot = newLot('io', now);
  const r = (superate: number) => ({ done: true, esito: 'morto' as const, ticks: 1, ondata: superate + 1, superate, uccisioni: 0, punti: 0, guadagnati: 0, hash: 0 });
  assert.throws(() => finishTemplari(lot, r(3), now));
  let tot = 0;
  for (let i = 0; i < 6; i++) {
    lot = startTemplari(lot, 100 + i, now);
    const out = finishTemplari(lot, r(20), now);
    lot = out.lot; tot += out.premio.legno;
  }
  assert.equal(tot, TEMPLARI.premio.tetto.legno);
  assert.equal(lot.templari!.record, 21);
  assert.equal(lot.templari!.partite, 6);
  // il giorno dopo si riparte
  lot = startTemplari(lot, 1, now + 86_400_000);
  assert.equal(finishTemplari(lot, r(2), now + 86_400_000).premio.legno, 30);
});

test('il calice della Tempesta: serve la Tempesta aperta (Molo 2), poi resta nel lotto e apre l’isola; la seconda volta non cambia niente', () => {
  const lot = newLot('anna', 1_800_000_000_000);
  assert.throws(() => prendiReliquia(lot), (e: unknown) => e instanceof EconomyError && e.code === 'requisito');
  const molo2 = { ...lot, buildings: lot.buildings.map((b) => (b.building === 'molo' ? { ...b, level: 2 } : b)) };
  const r = prendiReliquia(molo2);
  assert.equal(r.nuova, true);
  assert.deepEqual(r.lot.reliquie, ['templari']);
  assert.equal(r.lot.version, molo2.version + 1);
  assert.ok(sbloccoTema({ tipo: 'reliquia', reliquia: 'templari' }, viaggiatore(r.lot, null)).aperta, 'la nebbia rossa non si dirada');
  const again = prendiReliquia(r.lot);
  assert.equal(again.nuova, false);
  assert.equal(again.lot, r.lot);
});
