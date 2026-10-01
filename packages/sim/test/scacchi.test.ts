import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCACCHI } from '@marea/content';
import { applyMove, isMate, legalMoves, parseFen, solveMate, toFen } from '../src/minigames/scacchi.ts';

const sq = (s: string) => (8 - Number(s[1])) * 8 + 'abcdefgh'.indexOf(s[0]!);

test('scacchi: FEN avanti e indietro', () => {
  const fen = '2k5/ppp5/7p/1R6/1N6/2N5/5PPP/6K1';
  assert.equal(toFen(parseFen(fen)), fen);
});

test('scacchi: matto del corridoio sì, scacco parabile no', () => {
  assert.equal(isMate(parseFen('3R2k1/5ppp/8/8/8/8/5PPP/6K1')), true);
  assert.equal(isMate(parseFen('2rR2k1/5ppp/8/8/8/8/5PPP/6K1')), false, 'la Torre nera cattura in d8');
  assert.equal(isMate(parseFen('3R2k1/5pp1/8/8/8/8/5PPP/6K1')), false, 'il Re scappa in h7');
});

test('scacchi: un pezzo inchiodato non si muove', () => {
  const b = parseFen('4r1k1/8/8/8/8/8/4N3/4K3');
  assert.equal(legalMoves(b, true).some((m) => m.from === sq('e2')), false);
});

test('scacchi: ogni problema si risolve in esattamente 3 mosse (non meno)', () => {
  assert.equal(SCACCHI.mosse, 3);
  assert.ok(SCACCHI.problemi.length >= 5);
  for (const p of SCACCHI.problemi) {
    const r = solveMate(parseFen(p.fen), SCACCHI.mosse);
    assert.ok(r, `${p.fen}: nessun matto`);
    assert.equal(r.moves, 3, `${p.fen}: matto in ${r.moves}`);
  }
});

test('scacchi: la soluzione scritta del primo problema funziona', () => {
  let b = parseFen(SCACCHI.problemi[0]!.fen);
  for (const [f, t] of [['b5', 'd5'], ['b4', 'c6'], ['d5', 'd8']] as const) b = applyMove(b, { from: sq(f), to: sq(t) });
  assert.equal(isMate(b), true);
});
