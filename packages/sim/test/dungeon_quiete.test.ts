// Nemici che non ti hanno visto (quiete.ts): cono visivo, chi dorme non vede ma sente, udito → cerca → ti vede, ronda, ritorno a casa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { arena, heroBase, inp, run } from './dungeon_util.ts';

/** Un nemico in veglia (o che dorme) a (x, z), girato verso (fx, fz). */
function nemico(s: DungeonState, tipo: string, x: number, z: number, fx: number, fz: number, st: 'veglia' | 'dorme' = 'veglia'): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.fx = fx; e.fz = fz; e.st = st;
  return e;
}
const cerca = (s: DungeonState, e: Enemy): boolean => !!dungeon.view(s).nemici.find((n) => n.id === e.id)?.cerca;
/** Avanza finché `ok` (al massimo n tick); ritorna i tick passati, o -1. */
function finche(s: DungeonState, n: number, ok: () => boolean, f = inp()): number {
  for (let i = 0; i < n; i++) { if (ok()) return i; run(s, 1, f); }
  return ok() ? n : -1;
}

test('quiete: davanti ti nota (prima il «?», poi l\'attacco); di spalle, fermo, no', () => {
  const s1 = arena(heroBase()), e1 = nemico(s1, 'bandito', s1.hero.x + 5, s1.hero.z, -1, 0);
  let visto = false;
  const t = finche(s1, 120, () => { visto ||= cerca(s1, e1); return e1.aggro; });
  assert.ok(t > 10 && t < 90, `a 5 m davanti ti nota in meno di 1,5 s, non subito (${t} tick)`);
  assert.ok(visto, 'prima di attaccare ti cerca: il «?»');
  const s2 = arena(heroBase()), e2 = nemico(s2, 'bandito', s2.hero.x + 6.6, s2.hero.z, 1, 0); // alle spalle vede a 0,7 della vista (9 m): 6,3
  run(s2, 18);
  assert.equal(e2.aggro, false);
  assert.equal(e2.q?.sosp, 0, 'di spalle a 6,6 m non ti vede, e fermo non ti sente');
});

test('quiete: chi dorme non ti vede; il rumore di un colpo lo sveglia, si gira e ti vede', () => {
  const s = arena(heroBase()), e = nemico(s, 'bandito', s.hero.x + 1.5, s.hero.z, -1, 0, 'dorme');
  run(s, 180);
  assert.equal(e.st, 'dorme', 'a 1,5 m, guardandoti, ma dorme: niente');
  // tieni premuto A (carichi il colpo, non colpisci): il rumore lo sveglia
  const sveglio = finche(s, 120, () => e.st !== 'dorme', inp({ a: true }));
  assert.ok(sveglio > 0, 'svegliato dal rumore');
  assert.equal(e.aggro, false, 'sveglio ma non ancora all\'attacco');
  assert.ok(cerca(s, e), 'cerca: il «?»');
  assert.ok(finche(s, 120, () => e.aggro) >= 0, 'poi ti vede');
});

test('quiete: sentito alle spalle, si gira a cercare e ti vede', () => {
  const s = arena(heroBase()), e = nemico(s, 'bandito', s.hero.x + 6.6, s.hero.z, 1, 0);
  let visto = false;
  const t = finche(s, 360, () => { visto ||= cerca(s, e); return e.aggro; }, inp({ a: true }));
  assert.ok(t > 30, `non subito: prima ti sente (${t} tick)`);
  assert.ok(visto, 'il «?» prima di vederti');
});

test('quiete: senza nessuno attorno qualcuno fa la ronda vicino a casa, nessuno si allarma', () => {
  const s = arena(heroBase());
  s.hero.x = 36; s.hero.z = 24;
  const es = [[6, 4], [12, 4], [18, 4], [6, 10], [12, 10], [18, 12]].map(([x, z]) => nemico(s, 'bandito', x! + 1, z! + 1, 0, 1));
  const da = es.map((e) => [e.x, e.z] as const);
  let mosso = 0;
  for (let k = 0; k < 10; k++) {
    run(s, 60);
    es.forEach((e, i) => { const d = Math.hypot(e.x - da[i]![0], e.z - da[i]![1]); if (d > 1.5) mosso |= 1 << i; assert.ok(d < 6.6, `${e.id} resta vicino a casa (${d.toFixed(1)} m)`); });
  }
  assert.ok(mosso !== 0, 'almeno uno fa la ronda');
  assert.ok(es.some((e) => !e.q?.ronda.length), 'e qualcuno resta lì a guardarsi intorno');
  assert.ok(es.every((e) => !e.aggro));
});

test('quiete: finita la ricerca torna a casa', () => {
  const s = arena(heroBase());
  s.hero.x = 34; s.hero.z = 24;
  const e = nemico(s, 'scheletro', 10, 8, 1, 0);
  run(s, 1);
  e.q!.ronda = [];
  e.q!.cerca = [16, 8]; e.q!.fino = s.tick + 120; e.q!.sosp = 0.5;
  run(s, 120);
  assert.ok(e.x > 12, `è andato a cercare (${e.x.toFixed(1)})`);
  assert.ok(finche(s, 900, () => Math.hypot(e.x - 10, e.z - 8) < 0.5) >= 0, 'e poi è tornato a casa');
  assert.equal(e.aggro, false);
});

/** Un eroe che corre dritto verso un nemico fermo (sempre girato a +x): la distanza a cui scatta l'allarme. `da`: 1 = davanti, 0 = di lato, -1 = alle spalle. */
function allarmeA(tipo: string, da: -1 | 0 | 1, corre: boolean): number {
  const s = arena(heroBase()), ex = 20, ez = 14, e = nemico(s, tipo, ex, ez, 1, 0);
  s.hero.x = da === 0 ? ex : ex + da * 18; s.hero.z = da === 0 ? ez + 11 : ez;
  if (!corre) s.hero.fruga = true; // prima persona: a passo normale
  run(s, 1); e.q!.ronda = []; e.q!.cambia = 1e9; // fermo a guardare davanti, come nella misura
  const dx = ex - s.hero.x, dz = ez - s.hero.z, L = Math.sqrt(dx * dx + dz * dz), f = inp({ mx: dx / L, my: dz / L, b: corre });
  for (let i = 0; i < 900 && !e.aggro; i++) {
    run(s, 1, f);
    if (Math.sqrt((s.hero.x - e.x) ** 2 + (s.hero.z - e.z) ** 2) < 1.2) return 0;
  }
  return Math.sqrt((s.hero.x - e.x) ** 2 + (s.hero.z - e.z) ** 2);
}

test('quiete: chi corre verso un nemico sveglio viene notato per tempo (davanti e di lato prima dei 3/4 della vista, alle spalle prima di metà)', () => {
  for (const tipo of ['bandito', 'lupo', 'bandito_arciere', 'scheletro_arciere']) {
    const vista = newEnemy(arena(heroBase()), tipo, 20, 14).def.vista;
    for (const corre of [true, false]) {
      assert.ok(allarmeA(tipo, 1, corre) >= vista * 0.75, `${tipo} ${corre ? 'corri' : 'cammini'} davanti: allarme da lontano`);
      if (vista * 1.2 < 11) assert.ok(allarmeA(tipo, 0, corre) >= vista * 0.75, `${tipo} di lato`);
      assert.ok(allarmeA(tipo, -1, corre) >= vista * 0.5, `${tipo} alle spalle: almeno a metà della vista`);
    }
  }
});
