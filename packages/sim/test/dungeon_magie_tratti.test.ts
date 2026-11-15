// Tratti delle magie solo nel dungeon (magie_tratti.ts, spells.json → `tratto`): ogni magia che somigliava a un'altra fa una cosa sua.
// In Arena (`s.pvp`) niente di tutto questo: né tratti né l'id della magia sullo stato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { newHero, runHeroOf } from '../src/rpg/hero.ts';
import type { RunSpell } from '../src/rpg/types.ts';
import { HZ } from '../src/dungeon/tuning.ts';
import { arena, heroBase, inp, run } from './dungeon_util.ts';

function conMagia(id: string, pvp = false): DungeonState {
  const h = { ...newHero(), magie: [id], equip: { ...newHero().equip, magia: id, mano: 'magia' as const } };
  const sp: RunSpell = runHeroOf(h).magie[0]!;
  const s = arena(heroBase({ magie: [sp], magia: 0, max: { vita: 500, magicka: 400, stamina: 100 } }));
  if (pvp) s.pvp = { squadre: [0], rivela: [0] };
  s.hero.magicka = 400; s.hero.vita = 500;
  run(s, 1, inp({ c: true }));
  return s;
}
function bersaglio(s: DungeonState, dx: number, dz = 0, tipo = 'bandito'): Enemy {
  const e = newEnemy(s, tipo, s.hero.x + dx, s.hero.z + dz);
  e.vita = e.max = 100000; e.st = 'dorme';
  return e;
}
function passi(s: DungeonState, n: number, f = inp(), fermi: Enemy[] = []): DungeonState['eventi'] {
  const pos = fermi.map((e) => [e.x, e.z] as const), ev: DungeonState['eventi'] = [];
  for (let i = 0; i < n && !s.done; i++) {
    dungeon.step(s, f); ev.push(...s.eventi);
    fermi.forEach((e, k) => { e.x = pos[k]![0]; e.z = pos[k]![1]; });
  }
  return ev;
}
/** Lancia (A giù e su) e lascia volare `n` tick. */
const lancia = (s: DungeonState, n: number, fermi: Enemy[] = []): DungeonState['eventi'] => passi(s, 1, inp({ a: true }), fermi).concat(passi(s, n, inp(), fermi));
const danno = (e: Enemy): number => 100000 - e.vita;
const fuochiAmici = (s: DungeonState): number => s.fuochi.filter((f) => f.amico).length;

test('tratti: il proiettile infuocato lascia una fiammella dove colpisce', () => {
  const s = conMagia('fiammata'), e = bersaglio(s, 6);
  lancia(s, 40, [e]);
  assert.ok(danno(e) > 0);
  const f = s.fuochi.find((x) => x.amico);
  assert.ok(f && Math.abs(f.x - e.x) < 1.2, 'una chiazza amica vicino al nemico');
  assert.ok(s.proj.every((p) => p.magia === undefined || p.magia === 'fiammata'));
});

test('tratti: la Salva del Fuciliere butta indietro chi colpisce, un capo no', () => {
  const s = conMagia('salva_fuciliere'), e = bersaglio(s, 5), x0 = e.x;
  passi(s, 1, inp({ a: true }));
  for (let i = 0; i < 30 && danno(e) === 0; i++) passi(s, 1);
  assert.ok(danno(e) > 0, 'colpito');
  assert.ok(e.x > x0 + 0.9, `spinto indietro: ${(e.x - x0).toFixed(2)} m`);
  const b = conMagia('salva_fuciliere'), capo = bersaglio(b, 5);
  capo.def = { ...capo.def, boss: true };
  const c0 = capo.x;
  passi(b, 1, inp({ a: true }));
  for (let i = 0; i < 30 && danno(capo) === 0; i++) passi(b, 1);
  assert.ok(Math.abs(capo.x - c0) < 0.3, 'il capo resta dov’è');
});

test('tratti: il proiettile elettrico attraversa il primo nemico e prende quello dietro, non il terzo', () => {
  const s = conMagia('fulmine'), a = bersaglio(s, 3), b = bersaglio(s, 6), c = bersaglio(s, 9);
  lancia(s, 30, [a, b, c]);
  assert.ok(danno(a) > 0 && danno(b) > 0, `primo ${danno(a)}, secondo ${danno(b)}`);
  assert.equal(danno(c), 0, 'il terzo no');
  assert.ok(b.lentoT! > s.tick, 'anche il secondo è rallentato');
});

test('tratti: il Lampo del Faro abbaglia (stordisce un attimo), i capi no', () => {
  const s = conMagia('lampo_faro'), e = bersaglio(s, 6);
  passi(s, 1, inp({ a: true }), [e]);
  for (let i = 0; i < 20 && danno(e) === 0; i++) passi(s, 1, inp(), [e]);
  assert.ok(e.stordito !== undefined && e.stordito > s.tick, 'stordito');
  assert.ok(e.stordito! - s.tick <= 0.6 * HZ + 1);
  const b = conMagia('lampo_faro'), capo = bersaglio(b, 6);
  capo.def = { ...capo.def, boss: true };
  lancia(b, 20, [capo]);
  assert.ok(!(capo.stordito! > b.tick), 'il capo non si stordisce');
});

test('tratti: la Colata lascia pozze in fondo al raggio, il Fuoco continuo no', () => {
  const s = conMagia('colata'), e = bersaglio(s, 4);
  passi(s, 2 * HZ, inp({ a: true }), [e]);
  assert.ok(fuochiAmici(s) >= 2, `pozze: ${fuochiAmici(s)}`);
  assert.equal(dungeon.view(s).hero.canale?.m, 'colata', 'la vista dice quale raggio è');
  const f = conMagia('fuoco_continuo'), e2 = bersaglio(f, 4);
  passi(f, 2 * HZ, inp({ a: true }), [e2]);
  assert.equal(fuochiAmici(f), 0);
});

test('tratti: la Bussola Fulminante fa sempre più male sullo stesso nemico, fino al tetto', () => {
  const s = conMagia('bussola_fulminante'), e = bersaglio(s, 5);
  passi(s, HZ, inp({ a: true }), [e]);
  const primo = danno(e);
  passi(s, HZ, inp({ a: true }), [e]);
  const secondo = danno(e) - primo;
  passi(s, 4 * HZ, inp({ a: true }), [e]);
  const d5 = danno(e);
  passi(s, HZ, inp({ a: true }), [e]);
  const ultimo = danno(e) - d5;
  assert.ok(secondo > primo * 1.08, `sale: ${primo.toFixed(1)} → ${secondo.toFixed(1)}`);
  assert.ok(ultimo <= primo * 1.65, `con un tetto: ${ultimo.toFixed(1)}`);
  assert.ok((dungeon.view(s).hero.canale?.k ?? 0) > 4, 'la vista mostra la carica');
  passi(s, 2, inp(), [e]);
  assert.equal(s.hero.bussolaT, undefined, 'lasciata la A riparte da zero');
});

test('tratti: la Bomba di fuoco lascia la brace a terra', () => {
  const s = conMagia('bomba_fuoco'), e = bersaglio(s, 6);
  const ev = lancia(s, 2 * HZ, [e]);
  const sc = ev.find((x) => x.t === 'scoppio');
  assert.ok(sc && sc.t === 'scoppio' && sc.m === 'bomba_fuoco', 'lo scoppio dice quale magia è');
  assert.ok(fuochiAmici(s) >= 1, 'brace a terra');
});

test('tratti: la Pioggia di Braci cade in cinque braci sparse, una dopo l’altra', () => {
  const s = conMagia('pioggia_braci'), e = bersaglio(s, 7);
  passi(s, 1, inp({ a: true }), [e]); passi(s, 1, inp(), [e]);
  const b = s.proj.filter((p) => p.bomba);
  assert.equal(b.length, 5);
  assert.ok(new Set(b.map((p) => `${p.bomba![0]},${p.bomba![1]}`)).size === 5, 'cinque punti diversi');
  const quando: number[] = [];
  for (let i = 0; i < 3 * HZ; i++) for (const x of passi(s, 1, inp(), [e])) if (x.t === 'scoppio') quando.push(s.tick);
  assert.equal(quando.length, 5);
  assert.ok(quando[4]! - quando[0]! >= 0.4 * HZ, `una dopo l’altra: ${quando.join(', ')}`);
  assert.ok(danno(e) > 0);
});

test('tratti: lo Squarcio del Vuoto risucchia verso il centro chi è nell’area', () => {
  const s = conMagia('squarcio_vuoto'), centro = bersaglio(s, 6), lato = bersaglio(s, 6, 2.2);
  passi(s, 1, inp({ a: true }), [centro]); passi(s, 1, inp(), [centro]);
  const b = s.proj.find((p) => p.bomba)!;
  const dist = (): number => Math.sqrt((lato.x - b.bomba![0]) ** 2 + (lato.z - b.bomba![1]) ** 2);
  const prima = dist();
  let sc = false;
  for (let i = 0; i < 2 * HZ && !sc; i++) { const ev = passi(s, 1, inp(), [centro]); sc = ev.some((x) => x.t === 'scoppio'); if (!sc) { lato.x = s.hero.x + 6; lato.z = s.hero.z + 2.2; } }
  assert.ok(sc && danno(lato) > 0);
  assert.ok(dist() < prima - 1, `tirato dentro: ${prima.toFixed(2)} → ${dist().toFixed(2)}`);
});

test('tratti: il Valzer delle Lame fa un secondo giro a metà danno', () => {
  const s = conMagia('valzer_lame'), e = bersaglio(s, 6);
  const ev = lancia(s, 3 * HZ, [e]);
  const sc = ev.filter((x) => x.t === 'scoppio');
  assert.equal(sc.length, 2, 'due scoppi');
  assert.ok(sc[1]!.t === 'scoppio' && sc[1]!.giro === true);
  assert.equal(s.proj.length, 0, 'e poi basta');
});

test('tratti: in Arena niente tratti e niente id della magia sullo stato', () => {
  for (const id of ['fiammata', 'fulmine', 'salva_fuciliere', 'lampo_faro', 'bomba_fuoco', 'pioggia_braci', 'valzer_lame']) {
    const s = conMagia(id, true), a = bersaglio(s, 3), b = bersaglio(s, 6);
    passi(s, 1, inp({ a: true }), [a, b]); passi(s, 1, inp(), [a, b]);
    assert.ok(s.proj.length <= 1 && s.proj.every((p) => p.magia === undefined), `${id}: un proiettile solo, senza id`);
    const ev = passi(s, 3 * HZ, inp(), [a, b]);
    assert.equal(fuochiAmici(s), 0, `${id}: niente fuoco`);
    assert.ok(!(a.stordito! > 0), `${id}: niente abbaglio`);
    assert.ok(ev.filter((x) => x.t === 'scoppio').every((x) => x.t === 'scoppio' && x.m === undefined && !x.giro), `${id}: scoppi di sempre`);
    if (id === 'fulmine') assert.equal(danno(b), 0, 'il fulmine non attraversa');
  }
  const r = conMagia('colata', true), e = bersaglio(r, 4);
  passi(r, 2 * HZ, inp({ a: true }), [e]);
  assert.equal(fuochiAmici(r), 0);
  assert.equal(r.hero.canaleM, undefined);
  assert.equal(dungeon.view(r).hero.canale?.m, undefined);
});
