// Gli indizi (docs/TEMPLARI.md §12b punto 4): sei scheletri col biglietto, uno per segreto, e quattro scritte col sangue. Ogni scheletro
// si raggiunge; davanti, AZIONE dà l'evento del suo biglietto (il client lo apre) e non cambia niente della partita; non ruba l'AZIONE a
// un'arma sul muro, a una finestra, a una porta o a una leva vicine. Insieme l'evento dice chi l'ha letto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI } from '@marea/content/templari.ts';
import { stepTemplari, stepTemplariInsieme, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { apriPorta } from '../src/templari/porte.ts';
import { prompt } from '../src/templari/eroe.ts';
import { rompiMuro, scheletroVicino } from '../src/templari/segreti.ts';
import { raggiungibili } from '../src/templari/raggiungi.ts';
import { cellOf } from '../src/dungeon/map.ts';
import { C } from '../src/templari/mappa.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
function partita(seed = 3): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = 5; s.quanti = 0; s.usciti = 0; s.prossima = 1e9; s.eroe.punti = 50000;
  s.eroe.vita = s.eroe.max = 1e6;
  return s;
}

test('la mappa: uno scheletro e una scritta per ogni testo, gli scheletri si raggiungono con le porte aperte e il muro rotto', () => {
  const s = partita(), a = s.arena;
  assert.deepEqual(a.scheletri.map((k) => k.id).sort(), Object.keys(TEMPLARI.indizi.scheletri).sort());
  assert.deepEqual(a.sangue.map((k) => k.id).sort(), Object.keys(TEMPLARI.indizi.sangue).sort());
  for (const q of a.porte) apriPorta(s, q);
  rompiMuro(s);
  const d = raggiungibili(s);
  for (const k of a.scheletri) {
    assert.ok(d[cellOf(s.gr.eroe, k.x, k.z)]! >= 0, `lo scheletro ${k.id} non si raggiunge`);
    // la schiena al muro: dietro c'è un muro, davanti no
    assert.equal(a.cell[Math.floor(k.z - k.fz) * a.w + Math.floor(k.x - k.fx)], C.muro, `lo scheletro ${k.id} non ha il muro dietro`);
  }
  // le scritte sui muri stanno sulla faccia che guarda una cella libera
  for (const w of a.sangue) if (w.nx || w.nz) assert.notEqual(a.cell[Math.floor(w.z + w.nz * 0.5) * a.w + Math.floor(w.x + w.nx * 0.5)], C.muro, `la scritta ${w.id} guarda un muro`);
  // il primo si raggiunge dalla partenza, senza comprare niente
  const s0 = partita(), d0 = raggiungibili(s0), coro = s0.arena.scheletri.find((k) => k.id === 'coro')!;
  assert.ok(d0[cellOf(s0.gr.eroe, coro.x, coro.z)]! >= 0, 'lo scheletro del coro non si raggiunge dalla partenza');
});

test('davanti a uno scheletro AZIONE dà il suo biglietto e non cambia la partita', () => {
  for (const id of Object.keys(TEMPLARI.indizi.scheletri)) {
    const s = partita(), k = s.arena.scheletri.find((x) => x.id === id)!;
    s.eroe.x = k.x + k.fx * 0.6; s.eroe.z = k.z + k.fz * 0.6;
    assert.equal(prompt(s)?.cosa, 'biglietto', `davanti allo scheletro ${id}: ${JSON.stringify(prompt(s))}`);
    const punti = s.eroe.punti, armi = JSON.stringify(s.eroe.armi);
    stepTemplari(s, { ...F, d: true });
    assert.deepEqual(s.eventi.filter((e) => e.t === 'biglietto'), [{ t: 'biglietto', id }]);
    assert.equal(s.eroe.punti, punti); assert.equal(JSON.stringify(s.eroe.armi), armi);
    // tenere premuto non lo riapre a ogni passo
    stepTemplari(s, { ...F, d: true });
    assert.equal(s.eventi.filter((e) => e.t === 'biglietto').length, 0);
  }
});

test('gli scheletri non rubano AZIONE ad armi sul muro, finestre, porte e leve', () => {
  const s = partita(), a = s.arena, g = s.gr.eroe;
  const punti: [string, number, number][] = [
    ...a.muri.map((m): [string, number, number] => [`l'arma ${m.arma}`, m.x, m.z]),
    ...a.finestre.map((f, i): [string, number, number] => [`la finestra ${i}`, f.dentro.x, f.dentro.z]),
    ...a.trappole.map((t): [string, number, number] => [`la leva ${t.id}`, t.leva.x, t.leva.z]),
  ];
  // le porte: dalle celle libere accanto
  for (const p of a.porte) for (const i of p.celle) {
    const cx = i % a.w, cz = Math.floor(i / a.w);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!g.solid[(cz + dz) * a.w + cx + dx]) punti.push([`la porta ${p.id}`, cx + dx + 0.5, cz + dz + 0.5]);
  }
  for (const [cosa, x, z] of punti) { s.eroe.x = x; s.eroe.z = z; assert.equal(scheletroVicino(s), null, `uno scheletro ruba AZIONE al${cosa.startsWith('l\'') ? '' : 'la'} ${cosa}`); }
});

test('insieme: il biglietto è di chi l\'ha letto', () => {
  const s = templari.create({ seed: 7, opzioni: { subito: true, eroi: 2 } }), k = s.arena.scheletri.find((x) => x.id === 'coro')!;
  const h = s.eroi[1]!; h.x = k.x + k.fx * 0.6; h.z = k.z + k.fz * 0.6;
  stepTemplariInsieme(s, [F, { ...F, d: true }]);
  assert.deepEqual(s.eventi.filter((e) => e.t === 'biglietto'), [{ t: 'biglietto', id: 'coro', e: 1 }]);
});
