import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RPG } from '@marea/content/rpg.ts';
import { arena, heroBase, inp, run } from './dungeon_util.ts';
import { hitHero } from '../src/dungeon/combat.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { faseSwing } from '../src/dungeon/swing.ts';
import { COLPI } from '../src/dungeon/tuning.ts';
import { decodeDungeon, encodeDungeon, packDungeon, unpackDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { gridFromRows } from '../src/world/grid.ts';
import { newAvatar, stepAvatar } from '../src/world/avatar.ts';

test('roll: costo unico, direzione bloccata, recupero e niente ripetizione tenendo premuto', () => {
  const s = arena(heroBase()), x = s.hero.x, z = s.hero.z;
  run(s, 1, inp({ roll: true, mx: 1 }));
  assert.equal(s.hero.act, 'schiva'); assert.equal(s.hero.stamina, 100 - RPG.schivata.stamina);
  run(s, 25, inp({ roll: true, my: 1 }));
  assert.ok(s.hero.x > x + 2); assert.equal(s.hero.z, z); assert.equal(s.hero.stamina, 76);
  run(s, 90, inp({ roll: true })); assert.equal(s.hero.act, 'idle');
  assert.ok(s.hero.stamina > 76); assert.ok(s.hero.x < x + 3.1);
  run(s, 1); run(s, 1, inp({ roll: true })); assert.equal(s.hero.act, 'schiva');
});

test('roll: stamina insufficiente, attacco impegnato e invulnerabilità solo nella finestra attiva', () => {
  const s = arena(heroBase()); s.hero.stamina = RPG.schivata.stamina - 1;
  run(s, 1, inp({ roll: true })); assert.equal(s.hero.act, 'idle');
  s.hero.stamina = 100; run(s, 1); run(s, 1, inp({ roll: true }));
  assert.equal(hitHero(s, 10, 'taglio', s.hero.x + 1, s.hero.z), true);
  run(s, 8); const hp = s.hero.vita;
  assert.equal(hitHero(s, 10, 'magia', s.hero.x + 1, s.hero.z), false); assert.equal(s.hero.vita, hp);
  run(s, 16); assert.equal(hitHero(s, 10, 'contundente', s.hero.x + 1, s.hero.z), true);
  run(s, 60); run(s, 1, inp({ a: true })); run(s, 1); assert.equal(s.hero.act, 'swing');
  run(s, 1, inp({ roll: true })); assert.equal(s.hero.act, 'swing');
});

test('roll: collisioni con muri e acqua, anche in diagonale', () => {
  const s = arena(heroBase()); s.hero.x = 3; s.hero.z = 3;
  run(s, 36, inp({ roll: true, mx: -1, my: -1 }));
  assert.ok(s.hero.x >= 2.35 && s.hero.z >= 2.35);
  const map = gridFromRows('roll', ['~~~~~', '~ggg~', '~gPg~', '~ggg~', '~~~~~'], 2, { cx: 2, cz: 2 }, { cx: 0, cz: 0 });
  let a = newAvatar(3, 3);
  for (let i = 0; i < 60; i++) a = stepAvatar(a, { mx: -1, my: -1, a: false, b: false, roll: true }, map);
  assert.ok(map.walkable(a.x, a.z)); assert.ok(a.x >= 2.35 && a.z >= 2.35);
});

test('roll: codec v4 e replay conservano il nuovo comando, i vecchi formati restano leggibili', () => {
  const frames = [inp({ roll: true, mx: 1, e: true, m: 120 }), inp(), inp({ roll: true, my: -1 })].map(quantizeDungeon);
  const packed = packDungeon(frames), encoded = encodeDungeon(packed);
  assert.equal(Buffer.from(encoded, 'base64')[0], 4);
  assert.deepEqual(unpackDungeon(decodeDungeon(encoded, 100)!), frames);
  for (const f of [inp(), inp({ m: 5 }), inp({ e: true })]) assert.deepEqual(decodeDungeon(encodeDungeon(packDungeon([f])), 10), packDungeon([f]));
  const h = heroBase(), s = dungeon.create({ seed: 7, dungeon: 'grotta', hero: h });
  const log = Array.from({ length: 120 }, (_, i) => inp({ roll: i === 0 || i === 60, mx: 1 }));
  for (const f of log) dungeon.step(s, f);
  assert.deepEqual(replayDungeon(7, 'grotta', h, packDungeon(log)), dungeon.result(s));
});

test('armi: un martello lento prepara più a lungo ma lo swing resta rapido e monotono', () => {
  const window = (duration: number) => {
    const phases = Array.from({ length: Math.round(duration * 600) + 1 }, (_, i) => faseSwing('fendente', i / (duration * 600), duration));
    assert.ok(phases.every((v, i) => i === 0 || v >= phases[i - 1]!));
    const start = phases.findIndex((v) => v >= COLPI.fendente.da) / 600, end = phases.findIndex((v) => v >= COLPI.fendente.a) / 600;
    assert.equal(phases.at(-1), 1); return { start, swing: end - start };
  };
  const light = window(1.2), heavy = window(2.9);
  assert.ok(heavy.start > light.start + 0.8);
  assert.ok(Math.abs(heavy.swing - light.swing) < 0.005); assert.ok(heavy.swing < 0.18);
});
