// I nemici in caccia si accorgono delle evocazioni: puntano quella più vicina dell'eroe e la colpiscono (mischia, tiri, area); da addormentati
// non le vedono. L'evocazione ferma (stato recupera) serve a tenere la prova ripetibile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { BOSS_AREA_OGNI } from '../src/dungeon/tuning.ts';
import { arena, heroBase, run } from './dungeon_util.ts';

/** Evocazione ferma (finge di recuperare per sempre) in (x, z). */
function alleato(s: DungeonState, x: number, z: number, tipo = 'lupo_spettrale'): Enemy {
  const a = newEnemy(s, tipo, x, z, true);
  a.aggro = true; a.scade = Number.MAX_SAFE_INTEGER; a.st = 'recupera'; a.stT = 0; a.stDur = 1e9;
  return a;
}
function nemico(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}
const colpiSu = (ev: DungeonState['eventi'], id: number): number[] => ev.flatMap((x) => (x.t === 'colpo' && x.su === 'nemico' && x.id === id ? [x.danno] : []));

test('contro alleati: il nemico in caccia attacca l’evocazione vicina e lascia stare l’eroe lontano', () => {
  const s = arena(heroBase());
  const a = alleato(s, 6, 6), e = nemico(s, 'nonmorto', 9, 6);
  const vitaEroe = s.hero.vita;
  const ev = run(s, 300);
  assert.ok(colpiSu(ev, a.id).length >= 1, 'l’evocazione prende dei colpi');
  assert.ok(a.vita < a.max || a.st === 'morto');
  assert.equal(s.hero.vita, vitaEroe, 'l’eroe è lontano e non viene toccato');
  assert.equal(e.bersaglio === a.id || a.st === 'morto', true);
});

test('contro alleati: tra eroe ed evocazione vince chi è più vicino', () => {
  const s = arena(heroBase());
  const e = nemico(s, 'nonmorto', 20, 8), a = alleato(s, 25, 8); // l'eroe è a (20, 14): 6 m; l'evocazione 5 m
  run(s, 1);
  assert.equal(e.bersaglio, a.id, 'punta l’evocazione, più vicina');
  const s2 = arena(heroBase());
  const e2 = nemico(s2, 'nonmorto', 20, 10), a2 = alleato(s2, 25, 6); // l'eroe è a 4 m, l'evocazione a ~6,4 m
  run(s2, 1);
  assert.equal(e2.bersaglio, -1, 'punta l’eroe, più vicino');
  assert.equal(a2.vita, a2.max);
});

test('contro alleati: l’arciere tira all’evocazione e il tiro la ferisce', () => {
  const s = arena(heroBase());
  const a = alleato(s, 6, 6, 'golem_evocato'), arc = nemico(s, 'scheletro_arciere', 12, 6);
  const ev = run(s, 400);
  assert.ok(colpiSu(ev, a.id).length >= 1, 'una freccia arriva');
  assert.ok(a.vita < a.max);
  assert.equal(arc.bersaglio, a.id);
  assert.equal(s.hero.vita, s.runHero.max.vita);
});

test('contro alleati: caduta l’evocazione il nemico torna sull’eroe', () => {
  const s = arena(heroBase());
  const a = alleato(s, 12, 14), e = nemico(s, 'nonmorto', 15, 14);
  a.vita = 1;
  const ev = run(s, 200);
  assert.equal(a.st, 'morto');
  assert.ok(ev.some((x) => x.t === 'morte' && x.id === a.id));
  const x0 = e.x;
  run(s, 120);
  assert.equal(e.bersaglio, -1);
  assert.ok(e.x > x0, 'va verso l’eroe, a destra');
});

test('contro alleati: il colpo ad area del boss prende anche l’evocazione', () => {
  const s = arena(heroBase());
  const a = alleato(s, 6, 6, 'golem_evocato'), boss = nemico(s, 're_ossa', 8.5, 6);
  boss.attacchi = BOSS_AREA_OGNI - 1;
  let area = false;
  const ev: DungeonState['eventi'] = [];
  for (let i = 0; i < 400 && !area; i++) { ev.push(...run(s, 1)); if (boss.st === 'prepara' && boss.area) area = true; }
  assert.ok(area, 'prepara il colpo ad area');
  const dopo = run(s, 120);
  assert.ok(colpiSu(dopo, a.id).length >= 1, 'l’evocazione è dentro il cerchio e lo prende');
});

test('contro alleati: un nemico addormentato non vede le evocazioni', () => {
  const s = arena(heroBase());
  const a = alleato(s, 6, 6), e = newEnemy(s, 'nonmorto', 8, 6);
  e.st = 'dorme';
  run(s, 200);
  assert.equal(e.st, 'dorme');
  assert.equal(a.vita, a.max);
});
