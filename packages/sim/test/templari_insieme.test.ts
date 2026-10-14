// Templari insieme (2-4 giocatori nella stessa partita): eroi accanto alla partenza, gli zombie puntano il più vicino, chi cade si rialza
// all'ondata dopo, la partita finisce quando non resta nessuno in piedi; il replay del server (log della squadra) dà lo stesso risultato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.ts';
import { packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { stepTemplariInsieme, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { parseTAzioniInsieme, replayTemplariInsieme } from '../src/templari/replay.ts';
import { nuovoZombie, quantiOndata, usa } from '../src/templari/stato.ts';
import { apriPorta } from '../src/templari/porte.ts';
import { TEMPLARI } from '@marea/content/templari.ts';
import { ferisci } from '../src/templari/colpi.ts';
import type { TEventoDi } from '../src/templari/types.ts';

const FERMO: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };

/** Due (o più) piloti automatici nella stessa partita, input registrati per eroe come fa il server (un turno = 3 tick uguali). */
function giocaInsieme(seed: number, n: number, ticks: number, uscite: (number | null)[] = []): { s: TState; frames: DungeonInput[][]; eventi: TEventoDi[] } {
  const s = templari.create({ seed, opzioni: { subito: true, eroi: n } });
  const rng = Array.from({ length: n }, (_, i) => createRng(seed + i).fork('autopilot'));
  const frames: DungeonInput[][] = Array.from({ length: n }, () => []), eventi: TEventoDi[] = [];
  let turno: DungeonInput[] = [];
  while (!s.done && s.tick < ticks) {
    for (let k = 0; k < n; k++) if (uscite[k] === s.tick) templari.act(s, { t: 'ritira', eroe: k });
    if (s.done) break;
    if (s.tick % 3 === 0) turno = s.eroi.map((h, k) => { if (h.giu || h.fuori) return FERMO; usa(s, k); return quantizeDungeon(templari.autopilot(s, rng[k]!)); });
    turno.forEach((f, k) => frames[k]!.push(f));
    stepTemplariInsieme(s, turno);
    eventi.push(...s.eventi);
  }
  return { s, frames, eventi };
}

test('insieme: due eroi accanto alla partenza, da solo la partita è quella di sempre', () => {
  const s = templari.create({ seed: 5, opzioni: { subito: true, eroi: 2 } });
  assert.equal(s.eroi.length, 2);
  assert.deepEqual(s.opzioni, { subito: true, eroi: 2 });
  const [a, b] = s.eroi;
  const d = Math.sqrt((a!.x - b!.x) ** 2 + (a!.z - b!.z) ** 2);
  assert.ok(d > 0.5 && d < 2, `distanza tra i due ${d}`);
  const v = templari.view(s, 1);
  assert.equal(v.io, 1); assert.equal(v.eroe.x, Math.round(b!.x * 100) / 100);
  assert.deepEqual(v.compagni.map((c) => c.i), [0]);
  // da solo: niente compagni, eventi senza `e`, uguale a prima
  const solo = templari.create({ seed: 5, opzioni: { subito: true } });
  assert.equal(solo.eroi.length, 1); assert.deepEqual(solo.opzioni, { subito: true });
  assert.deepEqual(templari.view(solo).compagni, []);
});

test('insieme: due piloti superano ondate, il replay della squadra dà lo stesso risultato', () => {
  const { s, frames, eventi } = giocaInsieme(11, 2, 60 * 60 * 3);
  assert.ok(s.ondata >= 2, `ondata ${s.ondata}`);
  assert.ok(s.uccisioni >= 6, `uccisioni ${s.uccisioni}`);
  assert.ok(eventi.some((e) => e.t === 'fendente' && e.e === 1) && eventi.some((e) => e.t === 'fendente' && e.e === 0), 'colpiscono tutti e due');
  const live = templari.result(s);
  for (const io of [0, 1]) {
    const r = replayTemplariInsieme(11, frames.map((f) => packDungeon(f)), [null, null], io);
    assert.equal(r.hash, live.hash, `replay di ${io}`);
    assert.equal(r.superate, live.superate);
  }
});

test('insieme: chi cade si rialza all’ondata dopo; finisce quando cadono tutti', () => {
  const s = templari.create({ seed: 3, opzioni: { subito: true, eroi: 2 } });
  s.eroi[0]!.vita = s.eroi[0]!.max = 1e6;
  usa(s, 1); ferisci(s, 1e6, s.eroe.x + 1, s.eroe.z);
  assert.equal(s.eroi[1]!.giu, true); assert.equal(s.done, false, 'uno è ancora in piedi');
  assert.equal(templari.view(s, 1).posa.anim, 'morto');
  assert.equal(templari.view(s, 1).prompt, null);
  // fino all'inizio della prima ondata (fase `inizio`): si rialza lì
  const eventi: TEventoDi[] = [];
  while (s.ondata < 1 && !s.done) { stepTemplariInsieme(s, [FERMO, FERMO]); eventi.push(...s.eventi); }
  assert.ok(eventi.some((e) => e.t === 'rialzato' && e.e === 1), 'nessun rialzato');
  assert.equal(s.eroi[1]!.giu, false); assert.equal(s.eroi[1]!.vita, s.eroi[1]!.max);
  // cadono tutti e due: fine
  usa(s, 1); ferisci(s, 1e6, 0, 0);
  usa(s, 0); s.eroe.vita = 1; ferisci(s, 10, 0, 0);
  assert.equal(s.done, true); assert.equal(s.esito, 'morto');
});

test('insieme: gli zombie puntano l’eroe in piedi più vicino', () => {
  const s = templari.create({ seed: 8, opzioni: { subito: true, eroi: 2 } });
  for (const h of s.eroi) h.vita = h.max = 1e6;
  // il secondo eroe lontano dal primo, uno zombie accanto a lui
  const b = s.eroi[1]!;
  const z = nuovoZombie(s, 'fante', b.x + 2.5, b.z, 1.5);
  z.st = 'insegue';
  const d0 = Math.sqrt((z.x - b.x) ** 2 + (z.z - b.z) ** 2);
  for (let i = 0; i < 40; i++) stepTemplariInsieme(s, [FERMO, FERMO]);
  const d1 = Math.sqrt((z.x - b.x) ** 2 + (z.z - b.z) ** 2);
  assert.ok(d1 < d0, `lo zombie non va verso il più vicino: ${d0.toFixed(2)} → ${d1.toFixed(2)}`);
});

test('insieme: chi esce lascia gli altri in partita; usciti tutti la partita è finita', () => {
  const s = templari.create({ seed: 4, opzioni: { subito: true, eroi: 3 } });
  templari.act(s, { t: 'ritira', eroe: 2 });
  assert.equal(s.eroi[2]!.fuori, true); assert.equal(s.done, false);
  for (let i = 0; i < 30; i++) stepTemplariInsieme(s, [FERMO, FERMO, { ...FERMO, mx: 1 }]);
  assert.equal(s.eroi[2]!.x, templari.create({ seed: 4, opzioni: { subito: true, eroi: 3 } }).eroi[2]!.x, 'chi è uscito non si muove più');
  templari.act(s, { t: 'ritira', eroe: 0 }); templari.act(s, { t: 'ritira', eroe: 1 });
  assert.equal(s.done, true); assert.equal(s.esito, 'uscito');
});

test('insieme: il premio di chi esce prima conta le ondate fino a quando è uscito', () => {
  const esce = 60 * 60; // dopo un minuto
  const { s, frames } = giocaInsieme(21, 2, 60 * 60 * 3, [esce, null]);
  const tutto = replayTemplariInsieme(21, frames.map((f) => packDungeon(f)), [esce, null], 1);
  const mio = replayTemplariInsieme(21, frames.map((f) => packDungeon(f)), [esce, null], 0);
  assert.equal(tutto.hash, templari.result(s).hash);
  assert.ok(mio.superate <= tutto.superate, `${mio.superate} > ${tutto.superate}`);
  assert.equal(mio.hash, tutto.hash, 'la partita è la stessa');
});

test('insieme: più eroi, più zombie a ondata (perEroe a testa in più)', () => {
  const q = TEMPLARI.ondate.quanti;
  assert.equal(quantiOndata(1), q.base);
  assert.equal(quantiOndata(1, 2), Math.round(q.base * (1 + q.perEroe)));
  assert.equal(quantiOndata(1, 4), Math.round(q.base * (1 + 3 * q.perEroe)));
  const s = templari.create({ seed: 6, opzioni: { subito: true, eroi: 3 } });
  while (s.ondata < 1) stepTemplariInsieme(s, [FERMO, FERMO, FERMO]);
  assert.equal(s.quanti, quantiOndata(1, 3));
});

test('insieme: chi compra dalla Strega beve lui, coi punti della squadra; cadendo perde le pozioni', () => {
  const s = templari.create({ seed: 9, opzioni: { subito: true, eroi: 2 } });
  const p = s.arena.personaggi.find((x) => x.id === 'strega')!, b = s.eroi[1]!;
  for (const q of s.arena.porte) { s.punti += TEMPLARI.porte[q.id]?.prezzo ?? 0; apriPorta(s, q); }
  s.punti = 100000;
  const a = { t: 'compra', da: 'strega', cosa: 'pietra' } as const;
  assert.equal(templari.act(s, a, 1), null, 'lontano dalla Strega non si compra');
  b.x = p.x - p.fx * 1.2; b.z = p.z - p.fz * 1.2;
  assert.ok(templari.act(s, a, 1), 'vicino sì');
  assert.deepEqual(b.pozioni, ['pietra']); assert.deepEqual(s.eroi[0]!.pozioni, []);
  assert.ok(s.punti < 100000, 'i punti sono della squadra');
  s.eroi[0]!.vita = s.eroi[0]!.max = 1e6;
  usa(s, 1); ferisci(s, 1e6, b.x + 1, b.z);
  assert.equal(b.giu, true); assert.deepEqual(b.pozioni, [], 'a terra le pozioni finiscono (come in COD)');
  assert.equal(templari.act(s, a, 1), null, 'a terra non si compra');
});

test('insieme: gli acquisti di ciascuno arrivano dalla rete come [tick, eroe, azione] e si scartano se storti', () => {
  const a = { t: 'compra', da: 'mercante', cosa: 'munizioni', slot: 0 };
  assert.deepEqual(parseTAzioniInsieme([[30, 1, a]], 2), [[30, 1, a]]);
  assert.equal(parseTAzioniInsieme([[30, 2, a]], 2), null, 'eroe che non c’è');
  assert.equal(parseTAzioniInsieme([[30, 0, { t: 'esci' }]], 2), null, 'insieme si esce col server, non con un’azione');
  assert.equal(parseTAzioniInsieme([[30, 0, a], [10, 1, a]], 2), null, 'tick all’indietro');
  // il replay le applica all'eroe giusto: lo stesso log con e senza un acquisto impossibile dà la stessa partita
  const { frames } = giocaInsieme(13, 2, 600);
  const log = frames.map((f) => packDungeon(f));
  assert.equal(replayTemplariInsieme(13, log, [null, null], 0, [[60, 1, a as never]]).hash, replayTemplariInsieme(13, log, [null, null], 0).hash);
});
