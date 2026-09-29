import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.ts';

test('stesso seed → stessa sequenza', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
});
test('seed diversi → sequenze diverse; fork indipendente e ripetibile', () => {
  const a = createRng('marea'), b = createRng('marea2');
  assert.notEqual(a.next(), b.next());
  const f1 = createRng(7).fork('vento'), f2 = createRng(7).fork('vento'), f3 = createRng(7).fork('boe');
  assert.equal(f1.next(), f2.next());
  assert.notEqual(f1.next(), f3.next());
});
test('int e pick restano nei limiti', () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) { const v = r.int(3, 9); assert.ok(v >= 3 && v <= 9); }
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
});
