// Mobili da più celle (#304, mobili.json `celle`): l'ingombro gira con il mobile, deve stare tutto nella stanza e non toccare altri mobili.
// Il catalogo è dati: id unici, categorie vere, un testo per ogni mobile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BORGO, MOBILI, MOBILI_CATEGORIE, validateContent } from '@marea/content';
import type { MobileDef } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { celleMobile, compraMobile, posaMobile, ruotaMobile, spostaMobile } from '../src/economy/casa.ts';
import type { LotState } from '../src/economy/types.ts';
import { conMonete } from './monete_util.ts';
import { isErr } from './economia_util.ts';

const [X0, Z0, X1] = BORGO.stanza.pavimento;
// un divano 2×1 e un armadio 1×2 finti, aggiunti al catalogo solo per questo test (ogni file di test è un processo a parte)
const DIVANO: MobileDef = { id: 'divano_prova', nome: 'Divano', categoria: 'sedersi', monete: 10, posto: 'terra', colori: ['#C98A4B'], celle: [2, 1] };
const ARMADIO: MobileDef = { id: 'armadio_prova', nome: 'Armadio', categoria: 'contenitori', monete: 10, posto: 'terra', colori: ['#5A3A1E'], celle: [1, 2] };
(MOBILI as MobileDef[]).push(DIVANO, ARMADIO);

function conMobili(...ids: string[]): LotState {
  const l0 = newLot('a', 0), { baule: _b, ...casa } = l0.casa ?? {}; // senza baule: la stanza tutta libera
  let l = conMonete({ ...l0, casa }, 5000);
  for (const id of ids) l = compraMobile(l, id, 1000);
  return l;
}

test('celleMobile: l’ingombro parte dall’ancora e gira a quarti di giro (x,z → z,−x, come ry della vista)', () => {
  assert.deepEqual(celleMobile(DIVANO, [5, 5], 0), [[5, 5], [6, 5]]);
  assert.deepEqual(celleMobile(DIVANO, [5, 5], 1), [[5, 5], [5, 4]]);
  assert.deepEqual(celleMobile(DIVANO, [5, 5], 2), [[5, 5], [4, 5]]);
  assert.deepEqual(celleMobile(DIVANO, [5, 5], 3), [[5, 5], [5, 6]]);
  assert.deepEqual(celleMobile(MOBILI[0]!, [5, 5], 3), [[5, 5]], 'senza `celle` è una cella sola');
  assert.equal(celleMobile({ posto: 'parete', celle: [2, 2] }, [5, 5], 0).length, 1, 'a parete sempre una cella');
});

test('posa: il mobile lungo deve stare tutto nella stanza', () => {
  const l = conMobili('divano_prova');
  assert.throws(() => posaMobile(l, 'divano_prova', { cell: [X1 - 1, Z0 + 1] }, 0, 1000), isErr('posizione'), 'la seconda cella esce a destra');
  const ok = posaMobile(l, 'divano_prova', { cell: [X1 - 2, Z0 + 1] }, 0, 1000);
  assert.equal(ok.casa?.arredi?.length, 1);
  const girato = posaMobile(l, 'divano_prova', { cell: [X1 - 1, Z0 + 1] }, 2, 1000); // girato di 180° la coda è a sinistra: ci sta
  assert.equal(girato.casa?.arredi?.length, 1);
});

test('posa: due mobili non si sovrappongono in nessuna cella, nemmeno in quelle “di coda”', () => {
  let l = conMobili('divano_prova', 'divano_prova', 'armadio_prova');
  l = posaMobile(l, 'divano_prova', { cell: [X0, Z0 + 1] }, 0, 1000); // occupa (X0,Z0+1) e (X0+1,Z0+1)
  assert.throws(() => posaMobile(l, 'divano_prova', { cell: [X0 + 1, Z0 + 1] }, 0, 1000), isErr('cella'), 'parte dalla cella di coda del primo');
  assert.throws(() => posaMobile(l, 'armadio_prova', { cell: [X0 + 1, Z0] }, 0, 1000), isErr('cella'), 'l’armadio 1×2 scende sulla coda del divano');
  assert.throws(() => posaMobile(l, 'armadio_prova', { cell: [X0 + 1, Z0 + 2] }, 2, 1000), isErr('cella'), 'girato di 180° sale sulla coda del divano');
  const ok = posaMobile(l, 'divano_prova', { cell: [X0, Z0 + 2] }, 0, 1000); // la riga sotto è libera
  assert.equal(ok.casa?.arredi?.length, 2);
});

test('sposta e gira: l’ingombro conta anche lì, e il mobile non si urta da solo', () => {
  let l = conMobili('divano_prova');
  l = posaMobile(l, 'divano_prova', { cell: [X0, Z0 + 1] }, 0, 1000);
  const id = l.casa!.arredi![0]!.id;
  const l2 = spostaMobile(l, id, { cell: [X0 + 1, Z0 + 1] }, 1000); // si sovrappone alla sua stessa vecchia coda: va bene
  assert.deepEqual(l2.casa!.arredi![0]!.cell, [X0 + 1, Z0 + 1]);
  assert.throws(() => spostaMobile(l, id, { cell: [X1 - 1, Z0 + 1] }, 1000), isErr('posizione'));
  // sul bordo sinistro girato di 180° uscirebbe dalla stanza: la rotazione viene rifiutata
  const bordo = posaMobile(conMobili('divano_prova'), 'divano_prova', { cell: [X0, Z0 + 1] }, 0, 1000);
  const r1 = ruotaMobile(bordo, bordo.casa!.arredi![0]!.id, 1000); // rot 1: la coda va su (z−1): ci sta
  assert.equal(r1.casa!.arredi![0]!.rot, 1);
  assert.throws(() => ruotaMobile(r1, r1.casa!.arredi![0]!.id, 1000), isErr('posizione')); // rot 2: la coda va a sinistra (x−1): fuori
});

test('catalogo: id unici, categorie vere, 1-3 celle, un testo per ogni mobile e nessun testo orfano', () => {
  const veri = (MOBILI as MobileDef[]).filter((m) => m !== DIVANO && m !== ARMADIO);
  assert.ok(veri.length >= 3);
  assert.equal(new Set(veri.map((m) => m.id)).size, veri.length);
  for (const m of veri) assert.ok(MOBILI_CATEGORIE.some((c) => c.id === m.categoria), `${m.id}: categoria ${m.categoria}`);
  const testi = JSON.parse(readFileSync(new URL('../../content/src/mobili_testi.json', import.meta.url), 'utf8')).testi as Record<string, string>;
  for (const m of veri) assert.ok(typeof testi[m.id] === 'string' && testi[m.id]!.length >= 20 && testi[m.id]!.length <= 200, `${m.id}: descrizione mancante o fuori misura (20-200 caratteri)`);
  for (const k of Object.keys(testi)) assert.ok(veri.some((m) => m.id === k), `mobili_testi.json: «${k}» non è un mobile`);
});

test('validateContent: il catalogo (finti compresi) non produce errori sui mobili', () => {
  assert.deepEqual(validateContent().filter((e) => e.startsWith('mobili:')), []);
});
