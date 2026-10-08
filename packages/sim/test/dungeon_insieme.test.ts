// Dungeon insieme (#118): più eroi nella stessa partita. Da solo = come sempre; replay della squadra = partita giocata; vita dei nemici
// più alta; ogni eroe raccoglie la sua parte; i nemici puntano l'eroe più vicino; chi se ne va (ritira) esce senza fermare gli altri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enemyDef } from '@marea/content/rpg.ts';
import { actParty, createPartyRun, dungeon, stepParty } from '../src/dungeon/dungeon.ts';
import { packDungeon, quantizeDungeon, replayDungeon, replayParty } from '../src/dungeon/replay.ts';
import { conEroe, createParty, moltVita, newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState } from '../src/dungeon/state.ts';
import type { DungeonAzioni, DungeonInput } from '../src/dungeon/types.ts';
import { createRng } from '../src/rng.ts';
import { ARENA, heroBase, heroForte, inp, playAuto } from './dungeon_util.ts';

/** Partita insieme con un autopilota per eroe; ritorna lo stato e i log (uno per eroe). */
function playParty(id: string, seed: number, n: number, maxTicks = 20_000): { s: DungeonState; logs: DungeonInput[][] } {
  const eroi = Array.from({ length: n }, (_, i) => ({ hero: i % 2 ? heroForte() : heroBase() }));
  const s = createPartyRun({ seed, dungeon: id, eroi });
  const rngs = eroi.map((_, i) => createRng(seed + i));
  const logs: DungeonInput[][] = eroi.map(() => []);
  while (!s.eroi.every((e) => e.done) && s.tick < maxTicks) {
    const f = s.eroi.map((e, i) => (e.done ? inp() : conEroe(s, i, () => quantizeDungeon(dungeon.autopilot(s, rngs[i]!)))));
    f.forEach((x, i) => logs[i]!.push(x));
    stepParty(s, f);
  }
  return { s, logs };
}

test('insieme: con un eroe solo createPartyRun e replayParty sono la spedizione di sempre', () => {
  const { s, log } = playAuto('grotta', 11, heroBase());
  const p = packDungeon(log);
  const solo = replayDungeon(11, 'grotta', heroBase(), p);
  const [party] = replayParty(11, 'grotta', [{ hero: heroBase() }], { inputs: [p], azioni: [[]] });
  assert.deepEqual(party, solo);
  assert.deepEqual(solo, dungeon.result(s));
  assert.equal(createPartyRun({ seed: 11, dungeon: 'grotta', eroi: [{ hero: heroBase() }] }).enemies[0]!.max, enemyDef(s.enemies[0]!.tipo).vita);
});

test('insieme: la vita dei nemici cresce con la squadra (+60% per ogni compagno)', () => {
  assert.equal(moltVita(1), 1);
  assert.ok(Math.abs(moltVita(2) - 1.6) < 1e-9);
  assert.ok(Math.abs(moltVita(4) - 2.8) < 1e-9);
  const due = createPartyRun({ seed: 3, dungeon: 'cripta', eroi: [{ hero: heroBase() }, { hero: heroBase() }] });
  for (const e of due.enemies) { assert.ok(Math.abs(e.max - e.def.vita * 1.6) < 1e-9, e.tipo); assert.equal(e.vita, e.max); }
});

test('insieme: due autopiloti nella Grotta, il replay della squadra dà a ognuno il suo esito (e lo stesso hash)', () => {
  const { s, logs } = playParty('grotta', 21, 2);
  const live = s.eroi.map((_, i) => conEroe(s, i, () => dungeon.result(s)));
  const inputs = logs.map((l) => packDungeon(l));
  const r = replayParty(21, 'grotta', [{ hero: heroBase() }, { hero: heroForte() }], { inputs, azioni: [[], []] });
  assert.deepEqual(r, live, 'il replay coincide con la partita');
  assert.equal(r[0]!.hash, r[1]!.hash, 'lo stato è uno solo');
  const uccisi = r.map((x) => Object.values(x.uccisi).reduce((a, b) => a + b, 0));
  console.log(`  grotta insieme: ${r.map((x) => x.outcome).join(' / ')} in ${s.tick} tick, uccisi ${uccisi.join(' + ')}, monete ${r.map((x) => x.monete).join(' + ')}`);
  assert.ok(uccisi[0]! + uccisi[1]! >= 10, 'hanno combattuto');
  assert.ok(r.every((x) => x.monete > 0), 'tutti e due hanno raccolto');
});

test('insieme: ogni eroe raccoglie la sua parte dello stesso forziere', () => {
  const s = createParty(ARENA, 1, [{ hero: heroBase() }, { hero: heroBase() }]);
  for (const e of s.eroi) { e.hero.x = 20; e.hero.z = 14; }
  s.loot.push({ id: 999, x: 20, z: 14, tipo: 'forziere', items: { lingotto_ferro: 2 }, monete: 7, vuoto: false, pieno: false, altri: [{ items: { lingotto_ferro: 2 }, monete: 7, vuoto: false, pieno: false }] });
  stepParty(s, [inp(), inp()]);
  for (const e of s.eroi) { assert.equal(e.monete, 7); assert.deepEqual(e.bottino, { lingotto_ferro: 2 }); }
  assert.equal(s.loot.at(-1)!.vuoto, true);
  assert.equal(s.loot.at(-1)!.altri![0]!.vuoto, true);
  assert.ok(s.eventi.some((e) => e.t === 'monete' && e.eroe === 1), 'gli eventi dicono di chi sono');
});

test('insieme: il nemico punta l’eroe più vicino, e i colpi li prende quello', () => {
  const s = createParty(ARENA, 2, [{ hero: heroBase() }, { hero: heroBase() }]);
  s.eroi[0]!.hero.x = 4; s.eroi[0]!.hero.z = 4;
  s.eroi[1]!.hero.x = 30; s.eroi[1]!.hero.z = 14;
  // l'arena è vuota: un lupo sveglio accanto al secondo eroe
  const e = newEnemy(s, 'lupo', 32, 14);
  e.st = 'insegue'; e.aggro = true;
  for (let t = 0; t < 600 && s.eroi[1]!.danniPresi === 0; t++) stepParty(s, [inp(), inp()]);
  assert.ok(s.eroi[1]!.danniPresi > 0, 'il secondo eroe (vicino) è stato colpito');
  assert.equal(s.eroi[0]!.danniPresi, 0, 'il primo (lontano) no');
});

test('insieme: chi se ne va (ritira) esce senza esito, gli altri continuano; l’azione la rigioca anche il server', () => {
  const s = createPartyRun({ seed: 5, dungeon: 'grotta', eroi: [{ hero: heroBase() }, { hero: heroBase() }] });
  const logs: DungeonInput[][] = [[], []];
  const azioni: DungeonAzioni[] = [[], []];
  for (let t = 0; t < 120; t++) { const f = [inp({ mx: 1 }), inp({ my: 1 })]; logs[0]!.push(f[0]!); logs[1]!.push(f[1]!); stepParty(s, f); }
  const ev = actParty(s, 1, { t: 'ritira' });
  azioni[1]!.push([s.tick, { t: 'ritira' }]);
  assert.deepEqual(ev, [{ t: 'ritirato', eroe: 1 }]);
  assert.equal(s.eroi[1]!.done, true);
  assert.equal(s.eroi[1]!.outcome, null);
  assert.equal(s.eroi[0]!.done, false);
  for (let t = 0; t < 60; t++) { const f = [inp({ my: -1 }), inp()]; logs[0]!.push(f[0]!); logs[1]!.push(f[1]!); stepParty(s, f); }
  assert.equal(s.tick, 180, 'la partita va avanti per chi resta');
  const r = replayParty(5, 'grotta', [{ hero: heroBase() }, { hero: heroBase() }], { inputs: logs.map((l) => packDungeon(l)), azioni });
  assert.deepEqual(r, s.eroi.map((_, i) => conEroe(s, i, () => dungeon.result(s))));
  assert.equal(r[1]!.done, true);
  assert.equal(r[1]!.outcome, null);
});
