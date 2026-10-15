// Mira dei Templari col mouse o col joystick di mira (docs/TEMPLARI.md §5): `m` = indice d'angolo come nel dungeon (dungeon/mira.ts).
// Archi, pistole e vaso vanno dove punta l'indice, anche fuori dal cono della mira assistita; senza `m` (o con un `m` fuori scala) vale
// la mira assistita di sempre; la mischia non lo guarda; il log col `m` si comprime e si rigioca uguale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armaDef } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { daiArma } from '../src/templari/eroe.ts';
import { nuovoZombie } from '../src/templari/stato.ts';
import { replayTemplari } from '../src/templari/replay.ts';
import { createRng } from '../src/rng.ts';
import { lineOfSight } from '../src/dungeon/map.ts';
import { AIM_N, aimDir, aimIndex } from '../src/dungeon/mira.ts';
import { packDungeon, quantizeDungeon, unpackDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const passi = (s: TState, n: number, f: Partial<DungeonInput> = {}) => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, { ...F, ...f }); };
function arena(seed = 1): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = 1; s.quanti = 0; s.usciti = 0; s.prossima = 1e9;
  return s;
}
/** Uno zombie fermo e quasi indistruttibile a `d` metri dall'eroe nella direzione dell'indice di mira `m`. */
function bersaglio(s: TState, m: number, d: number) {
  const v = aimDir(m)!, z = nuovoZombie(s, 'fante', s.eroe.x + v[0] * d, s.eroe.z + v[1] * d, 0);
  z.st = 'insegue'; z.stT = 0; z.vel = 0; z.vita = z.max = 1e6;
  return z;
}
/** Un indice di mira con la linea libera per `d` metri e ben fuori dal cono assistito (>60° da dove guarda l'eroe, che guarda a −x). */
function lontanoDalCono(s: TState, d: number): number {
  for (let m = 1; m <= AIM_N; m += 5) {
    const v = aimDir(m)!;
    if (-v[0] > 0.5) continue; // dentro o vicino al cono davanti
    if (lineOfSight(s.gr.percorso, s.eroe.x, s.eroe.z, s.eroe.x + v[0] * d, s.eroe.z + v[1] * d)) return m;
  }
  throw new Error('nessuna direzione libera vicino all\'eroe');
}
const colpito = (z: { vita: number; max: number }) => z.vita < z.max;

test('pistola: con la mira spara dove punta il cursore, anche fuori dal cono; senza mira (o con una mira fuori scala) va dritta', () => {
  for (const m2 of [undefined, 0, 999, -3, 1.5]) {
    const s = arena();
    daiArma(s, 'pistola'); s.eroe.fx = -1; s.eroe.fz = 0;
    const m = lontanoDalCono(s, 5), z = bersaglio(s, m, 5);
    passi(s, 1, m2 === undefined ? { a: true } : { a: true, m: m2 }); passi(s, 30);
    assert.equal(colpito(z), false, `senza mira valida non colpisce fuori dal cono (m=${m2})`);
  }
  const s = arena();
  daiArma(s, 'pistola'); s.eroe.fx = -1; s.eroe.fz = 0;
  const m = lontanoDalCono(s, 5), z = bersaglio(s, m, 5);
  passi(s, 1, { a: true, m }); passi(s, 30);
  assert.equal(colpito(z), true, 'col m colpisce');
  const v = aimDir(m)!;
  assert.ok(Math.abs(s.eroe.fx - v[0]) < 1e-9 && Math.abs(s.eroe.fz - v[1]) < 1e-9, 'l\'eroe si è girato verso la mira');
});

test('arco: teso e lasciato con la mira, la freccia va dove punta il cursore (e segue il cursore mentre è teso)', () => {
  const s = arena();
  daiArma(s, 'arco'); s.eroe.fx = -1; s.eroe.fz = 0;
  const m = lontanoDalCono(s, 6), z = bersaglio(s, m, 6);
  const tende = Math.round(armaDef('arco').tempo * 60) + 2;
  passi(s, tende, { a: true, m });
  assert.equal(s.eroe.act, 'tende');
  passi(s, 1, { a: false, m }); // rilascio: la mira viaggia anche nel tick del rilascio
  passi(s, 40);
  assert.equal(colpito(z), true, 'la freccia ha preso il bersaglio fuori dal cono');
});

test('fuoco greco: il vaso cade sul primo zombie lungo la mira, senza zombie a 3/5 della gittata', () => {
  const s = arena();
  daiArma(s, 'fuoco_greco'); s.eroe.fx = -1; s.eroe.fz = 0;
  const m = lontanoDalCono(s, 6), z = bersaglio(s, m, 6);
  passi(s, 1, { a: true, m }); passi(s, 60);
  assert.equal(colpito(z), true, 'il vaso è scoppiato sullo zombie');
  const s2 = arena();
  daiArma(s2, 'fuoco_greco'); s2.eroe.fx = -1; s2.eroe.fz = 0;
  const m2 = lontanoDalCono(s2, 6);
  passi(s2, 1, { a: true, m: m2 });
  const p = s2.proj[0]!;
  assert.ok(p, 'vaso in volo');
  const g = armaDef('fuoco_greco').gittata ?? 20, v = armaDef('fuoco_greco').velocita ?? 30;
  assert.ok(Math.abs(p.vita - Math.round(((g * 0.6) / v) * 60)) <= 1, `vola per 3/5 della gittata (vita ${p.vita})`);
});

test('mischia: la spada non guarda la mira, il fendente resta assistito', () => {
  const run = (m: number | undefined) => {
    const s = arena(); s.eroe.fx = -1; s.eroe.fz = 0;
    const z = nuovoZombie(s, 'fante', s.eroe.x - 1.2, s.eroe.z, 0); z.st = 'insegue'; z.stT = 0; z.vel = 0; z.vita = z.max = 1e6;
    passi(s, 1, m === undefined ? { a: true } : { a: true, m }); passi(s, 1, m === undefined ? {} : { m }); passi(s, 40);
    return [z.vita, s.eroe.fx, s.eroe.fz];
  };
  assert.deepEqual(run(lontanoDalCono(arena(), 5)), run(undefined));
});

test('indice di mira: il versore della sim e quello del client coincidono e il log col `m` si comprime e si rigioca', () => {
  for (const m of [1, 37, 120, AIM_N]) assert.equal(aimIndex(aimDir(m)![0], aimDir(m)![1]), m);
  const frames: DungeonInput[] = [];
  for (let t = 0; t < 600; t++) frames.push(quantizeDungeon({ ...F, mx: t % 90 < 45 ? 1 : -0.5, my: 0.25, a: t % 20 < 8, ...(t % 20 < 8 || t % 7 === 0 ? { m: 1 + ((t * 7) % AIM_N) } : {}) }));
  const unpacked = unpackDungeon(packDungeon(frames));
  assert.deepEqual(unpacked, frames, 'pack/unpack porta la mira');
  const s = templari.create({ seed: 4, opzioni: { subito: true } });
  for (const f of frames) stepTemplari(s, f);
  assert.deepEqual(replayTemplari(4, { subito: true }, packDungeon(frames), []), templari.result(s));
});

test('replay del server: una partita del pilota con la mira su ogni colpo si rigioca identica (armi a distanza comprese)', () => {
  const s = templari.create({ seed: 11 }), rng = createRng(11).fork('autopilot'), frames: DungeonInput[] = [];
  let spari = 0, conMira = 0;
  while (!s.done && s.tick < 60 * 60 * 5) {
    const f: DungeonInput = { ...templari.autopilot(s, rng) };
    if (f.a) {
      let z = null as null | { x: number; z: number }, bd = Infinity;
      for (const q of s.zombie) { const d = (q.x - s.eroe.x) ** 2 + (q.z - s.eroe.z) ** 2; if (q.st !== 'morto' && q.st !== 'sorge' && d < bd) { bd = d; z = q; } }
      const m = z ? aimIndex(z.x - s.eroe.x, z.z - s.eroe.z) : 0;
      if (m) f.m = m;
    }
    const q = quantizeDungeon(f);
    frames.push(q); if (q.m) conMira++;
    stepTemplari(s, q);
    spari += s.eventi.filter((e) => e.t === 'sparo').length;
  }
  assert.ok(conMira > 20, `colpi con la mira: ${conMira}`);
  assert.ok(spari > 0, 'il pilota non ha mai tirato con un\'arma a distanza');
  assert.deepEqual(replayTemplari(11, {}, packDungeon(frames), []), templari.result(s));
});
