// Formato compatto dell'input log (encodeDungeon / decodeDungeon): roundtrip esatto, stringhe rotte → null, dimensione su 20 minuti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { decodeDungeon, encodeDungeon, isPackedDungeon, packDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import type { PackedDungeon } from '../src/dungeon/types.ts';
import { wake } from '../src/dungeon/combat.ts';
import { heroBase, playAuto } from './dungeon_util.ts';

const MAX = dungeon.maxTicks;
/** Byte → base64 con Buffer (solo nei test, per costruire stringhe rotte). */
const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');

test('dungeon codec: roundtrip esatto su casi limite, fixture d’oro e partita dell’autopilot', () => {
  const casi: PackedDungeon[] = [[], [[1, 0, 0, 0]], [[1, 8, -8, 15], [2, -8, 8, 1], [3, 1, -1, 6], [4, 0, 0, 8], [127 + 4, 3, 3, 3], [128 + 4, -2, 5, 9], [MAX - 300, 0, 0, 0]]];
  for (const p of casi) {
    const s = encodeDungeon(p);
    assert.equal(s, Buffer.from(Buffer.from(s, 'base64')).toString('base64'), 'base64 standard (come Buffer)');
    assert.deepEqual(decodeDungeon(s, MAX), p);
  }
  const fx = JSON.parse(readFileSync(new URL('./fixtures/dungeon_grotta.json', import.meta.url), 'utf8')) as { inputs: PackedDungeon; seed: number; hero: Parameters<typeof replayDungeon>[2]; hash: number };
  const dec = decodeDungeon(encodeDungeon(fx.inputs), MAX)!;
  assert.deepEqual(dec, fx.inputs);
  assert.equal(replayDungeon(fx.seed, 'grotta', fx.hero, dec).hash, fx.hash, 'il log decodificato rigioca la stessa partita');
  const { log } = playAuto('grotta', 9, heroBase());
  const p = packDungeon(log);
  const back = decodeDungeon(encodeDungeon(p), MAX)!;
  assert.deepEqual(back, p);
  assert.ok(isPackedDungeon(back, MAX));
});

test('dungeon codec: stringhe rotte o troppo lunghe → null', () => {
  const ok = encodeDungeon([[5, 1, 2, 3], [200, -1, 0, 1]]);
  assert.ok(decodeDungeon(ok, MAX));
  const bad = [
    '', 'A', 'AAA', '====', 'AQ==AQ==', ok.slice(0, -4), ok + 'A', ok.replace(/./, '!'), 'é' + ok.slice(1),
    encodeDungeon([[1, 0, 0, 0]]).replace(/^A/, 'B'), // versione del formato sbagliata
    b64([1, 31, 0]), // mx fuori scala (23)
    b64([1, 0, 0xc0, 0x80]), // varint che non finisce
    b64([1, 0, 0xc0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01]), // varint troppo lungo
    b64([1, 0]), // riga a metà
  ];
  for (const s of bad) assert.equal(decodeDungeon(s, MAX), null, JSON.stringify(s));
  assert.equal(decodeDungeon(encodeDungeon([[MAX, 0, 0, 0], [1, 0, 0, 0]]), MAX), null, 'oltre maxTicks');
  assert.equal(decodeDungeon(42 as unknown as string, MAX), null);
});

test('dungeon codec: 20 minuti di autopilot (nemici tutti svegli) stanno in ~150 KB', () => {
  const hero = heroBase({ max: { vita: 1e9, magicka: 100, stamina: 100 }, magie: [], magia: null });
  const { log } = playAuto('grotta', 11, hero, (f, st) => { if (st.tick === 0) for (const e of st.enemies) wake(st, e); return { ...f, a: false }; });
  assert.equal(log.length, MAX);
  const p = packDungeon(log), s = encodeDungeon(p);
  const kb = s.length / 1024, jsonKb = JSON.stringify(p).length / 1024;
  console.log(`  20 min: ${p.length} righe RLE → ${kb.toFixed(0)} KB in base64 (JSON ${jsonKb.toFixed(0)} KB, ${(jsonKb / kb).toFixed(1)}× più piccolo)`);
  assert.deepEqual(decodeDungeon(s, MAX), p);
  assert.ok(kb <= 150, `${kb.toFixed(0)} KB`);
});
