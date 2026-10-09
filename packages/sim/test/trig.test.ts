// Seno, coseno e arcotangente deterministici (#169): vicini a Math (≤ 2 ulp), zeri col segno e infiniti come Math, bit fissati da
// un'impronta. Se l'impronta cambia cambiano le partite che il server rigioca (barca, Regata, Consegne): va fatto apposta, non per sbaglio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import * as trig from '../src/trig.ts';

const f64 = new Float64Array(1), i64 = new BigInt64Array(f64.buffer);
const bits = (v: number): bigint => { f64[0] = v; return i64[0]!; };
const ulp = (a: number, b: number): number => (Object.is(a, b) ? 0 : Number(bits(a) > bits(b) ? bits(a) - bits(b) : bits(b) - bits(a)));
const SCALE = [1e-6, 1, 4, 40, 1000];
/** Coppie (a, b) pseudo-casuali su scale diverse, sempre le stesse. */
function coppie(n: number): [number, number][] {
  const rng = createRng(169), out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([(rng.next() - 0.5) * 2 * SCALE[i % 5]!, (rng.next() - 0.5) * 2 * SCALE[(i >> 2) % 5]!]);
  return out;
}

test('trig: sin, cos, atan, atan2 a meno di 2 ulp da Math, su angoli piccoli e grandi', () => {
  for (const [a, b] of coppie(20000)) {
    for (const [nome, mio, suo] of [['sin', trig.sin(a), Math.sin(a)], ['cos', trig.cos(a), Math.cos(a)], ['atan', trig.atan(a), Math.atan(a)], ['atan2', trig.atan2(a, b), Math.atan2(a, b)]] as const)
      assert.ok(ulp(mio, suo) <= 2, `${nome}(${a}${nome === 'atan2' ? ', ' + b : ''}) = ${mio}, Math dà ${suo}`);
  }
  for (const k of [1, 2, 3, 4, 100]) assert.ok(Math.abs(trig.sin(k * Math.PI)) < 1e-13 && ulp(trig.cos(k * Math.PI), k % 2 ? -1 : 1) <= 1, `multipli di π: ${k}`);
  assert.equal(trig.hypot(3, 4), 5);
});

test('trig: zeri col segno, infiniti e NaN come Math (i denormali di atan2 no: fdlibm guarda l\'esponente, qui il rapporto)', () => {
  const sp = [0, -0, 1, -1, 0.5, -2, Infinity, -Infinity, NaN, Math.PI, 1e-300, -1e-280];
  for (const y of sp) for (const x of sp) assert.ok(Object.is(trig.atan2(y, x), Math.atan2(y, x)), `atan2(${y}, ${x}) = ${trig.atan2(y, x)}, Math dà ${Math.atan2(y, x)}`);
  for (const x of [0, -0, Infinity, -Infinity, NaN]) {
    assert.ok(Object.is(trig.sin(x), Math.sin(x)), `sin(${x})`);
    assert.ok(Object.is(trig.cos(x), Math.cos(x)), `cos(${x})`);
    assert.ok(Object.is(trig.atan(x), Math.atan(x)), `atan(${x})`);
  }
});

test('trig: i bit non cambiano (impronta fissa: gli stessi in Node, workerd, Chrome e Safari)', () => {
  const v = coppie(4000).flatMap(([a, b]) => [trig.sin(a), trig.cos(a), trig.atan(a), trig.atan2(a, b), trig.hypot(a, b)]);
  assert.equal(hashJson(v), IMPRONTA);
});
const IMPRONTA = 3165733421;
