// Zaino nel dungeon (dungeon v5, docs/RPG.md §4): cambio d'equipaggiamento dal menu (anche con quello raccolto), Butta via, consumi anche
// dal bottino, azioni rigiocate dal server (stesso hash), chiusura della spedizione con equipaggiamento e buttati; Butta via sull'isola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newLot } from '../src/economy/actions.ts';
import { EconomyError } from '../src/economy/types.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import type { DungeonState } from '../src/dungeon/dungeon.ts';
import { packDungeon, parseDungeonAzioni, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { heroNow } from '../src/dungeon/zaino.ts';
import { pesoZaino } from '../src/dungeon/loot.ts';
import type { DungeonAzione, DungeonAzioni, DungeonInput } from '../src/dungeon/types.ts';
import { applyRpgAction, parseRpgAction } from '../src/rpg/actions.ts';
import { finishDungeon, startDungeon } from '../src/rpg/run.ts';
import { heroOf, newHero } from '../src/rpg/hero.ts';
import { buildRunHero } from '../src/rpg/derived.ts';
import type { HeroState } from '../src/rpg/types.ts';
import { inp, run } from './dungeon_util.ts';

const T0 = 1_800_000_000_000;
/** Spedizione vera: eroe di partenza (katana di legno, arco, 20 frecce, 2 pozioni) con la sua fotografia e lo stato. */
function partenza(h: HeroState = newHero(), seed = 3): DungeonState {
  return dungeon.create({ seed, dungeon: 'grotta', hero: buildRunHero(h), stato: h });
}

test('zaino: cambio d’arma dal menu (katana → arco): RunHero rifatto, arma in mano, l’azione in corso si interrompe', () => {
  const s = partenza();
  assert.equal(s.hero.arma.id, 'katana_legno');
  run(s, 3, inp({ a: true })); // A tenuto: sta per caricare
  assert.equal(s.hero.act, 'press');
  const ev = dungeon.act(s, { t: 'equip', slot: 'arma', item: 'arco_legno' });
  assert.deepEqual(ev, [{ t: 'equip', slot: 'arma', item: 'arco_legno' }]);
  assert.equal(s.hero.arma.kind, 'arco');
  assert.equal(s.hero.act, 'idle');
  assert.equal(dungeon.view(s).hero.arma, 'arco_legno');
  assert.equal(s.hero.frecce, 20);
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'arma', item: 'arco_legno' }), null, 'già in mano');
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'arma', item: 'katana_ferro' }), null, 'non ce l’hai');
  assert.equal(dungeon.act(s, { t: 'equip', slot: 'corpo', item: 'pozione_vita_minore' }), null, 'slot sbagliato');
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'arma', item: null }));
  assert.equal(s.hero.arma.kind, 'pugni');
  // senza `stato` (spedizioni aperte prima del v5, test) niente cambi
  const vecchia = dungeon.create({ seed: 3, dungeon: 'grotta', hero: buildRunHero(newHero()) });
  assert.equal(dungeon.act(vecchia, { t: 'equip', slot: 'arma', item: 'arco_legno' }), null);
});

test('zaino: si equipaggia quello raccolto nel dungeon; uscendo resta, morendo (perso) lo slot torna a com’era', () => {
  const s = partenza();
  s.bottino['katana_ferro'] = 1; s.bottino['anello_vita_debole'] = 1;
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'arma', item: 'katana_ferro' }));
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'anello1', item: 'anello_vita_debole' }));
  assert.equal(s.hero.arma.id, 'katana_ferro');
  assert.ok(s.runHero.max.vita > 100, 'l’anello alza la Vita massima');
  assert.equal(s.hero.vita, 100, 'la barra non si riempie da sola');
  assert.equal(heroNow(s)!.equip.arma, 'katana_ferro');
  const r = dungeon.result(s);
  assert.deepEqual(r.equip, { ...newHero().equip, arma: 'katana_ferro', anello1: 'anello_vita_debole' });
  const lot = startDungeon(newLot('jack', T0, null), 'grotta', 3, T0);
  const ok = heroOf(finishDungeon(lot, { ...r, done: true, outcome: 'uscito' }, T0 + 1).lot);
  assert.equal(ok.equip.arma, 'katana_ferro');
  assert.equal(ok.equip.anello1, 'anello_vita_debole');
  assert.equal(ok.inv['katana_ferro'], 1);
  const morto = heroOf(finishDungeon(lot, { ...r, done: true, outcome: 'morto' }, T0 + 1).lot);
  assert.equal(morto.equip.arma, 'katana_legno', 'la katana di ferro è persa: torna quella di legno');
  assert.equal(morto.equip.anello1, undefined);
  assert.equal(morto.inv['katana_ferro'], undefined);
});

test('zaino: Butta via prima dal bottino, poi da quello portato da casa; il peso scende, l’equipaggiato rimasto senza si toglie', () => {
  const s = partenza();
  s.bottino['lingotto_ferro'] = 2; s.bottino['frecce_legno'] = 5;
  const p0 = pesoZaino(s);
  assert.deepEqual(dungeon.act(s, { t: 'butta', item: 'lingotto_ferro', n: 5 }), [{ t: 'buttato', item: 'lingotto_ferro', n: 2 }], 'al massimo quelli che hai');
  assert.equal(s.bottino['lingotto_ferro'], undefined);
  assert.ok(pesoZaino(s) < p0);
  // 25 frecce (20 da casa + 5 raccolte): via 10 → prima le 5 raccolte, poi 5 da casa
  assert.ok(dungeon.act(s, { t: 'butta', item: 'frecce_legno', n: 10 }));
  assert.equal(s.bottino['frecce_legno'], undefined);
  assert.deepEqual(s.buttati, { frecce_legno: 5 });
  assert.equal(s.hero.frecce, 15, 'le frecce pronte seguono lo zaino');
  // la katana in mano buttata: si combatte coi pugni
  assert.ok(dungeon.act(s, { t: 'butta', item: 'katana_legno', n: 1 }));
  assert.equal(s.equip.arma, undefined);
  assert.equal(s.hero.arma.kind, 'pugni');
  assert.equal(dungeon.act(s, { t: 'butta', item: 'katana_legno', n: 1 }), null, 'non ne hai più');
  const r = dungeon.result(s);
  assert.deepEqual(r.buttati, { frecce_legno: 5, katana_legno: 1 });
  const h = heroOf(finishDungeon(startDungeon(newLot('jack', T0, null), 'grotta', 3, T0), { ...r, done: true, outcome: 'uscito' }, T0 + 1).lot);
  assert.equal(h.inv['katana_legno'], undefined);
  assert.equal(h.inv['frecce_legno'], 15);
  assert.equal(h.equip.arma, undefined);
});

test('zaino: le pozioni raccolte si bevono dopo quelle di casa (escono dal bottino, `usati` resta dentro lo zaino di casa)', () => {
  const s = partenza();
  s.bottino['pozione_vita_minore'] = 2;
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'pozione', item: null }));
  assert.ok(dungeon.act(s, { t: 'equip', slot: 'pozione', item: 'pozione_vita_minore' }));
  assert.equal(s.hero.pozioni, 4);
  for (let i = 0; i < 4; i++) { run(s, 1, inp({ d: true })); run(s, 40); }
  assert.equal(s.hero.pozioni, 0);
  assert.deepEqual(s.usati, { pozione_vita_minore: 2 });
  assert.equal(s.bottino['pozione_vita_minore'], undefined);
});

test('zaino: le azioni si rigiocano col log (stesso hash del client); forma controllata, azioni impossibili ignorate', () => {
  const h = newHero(), rh = buildRunHero(h), seed = 12;
  const s = dungeon.create({ seed, dungeon: 'grotta', hero: rh, stato: h });
  const log: DungeonInput[] = [], az: DungeonAzioni = [];
  const act = (a: DungeonAzione) => { if (dungeon.act(s, a)) az.push([s.tick, a]); };
  for (let t = 0; t < 600; t++) {
    if (t === 100) act({ t: 'equip', slot: 'arma', item: 'arco_legno' });
    if (t === 220) act({ t: 'butta', item: 'frecce_legno', n: 3 });
    if (t === 400) act({ t: 'equip', slot: 'arma', item: 'katana_legno' });
    const f = quantizeDungeon(inp({ mx: t < 300 ? 0.5 : -0.5, my: 0.25, a: t % 50 < 20 }));
    log.push(f); dungeon.step(s, f);
  }
  act({ t: 'equip', slot: 'pozione', item: null }); // dopo l'ultimo input: si applica a fine log
  assert.equal(az.length, 4);
  const r = replayDungeon(seed, 'grotta', rh, packDungeon(log), { stato: h, azioni: az });
  assert.equal(r.hash, dungeon.result(s).hash);
  assert.deepEqual(r.equip, s.equip);
  assert.notEqual(replayDungeon(seed, 'grotta', rh, packDungeon(log), { stato: h }).hash, r.hash, 'senza azioni è un’altra partita');
  // dalla rete: forma
  assert.deepEqual(parseDungeonAzioni(JSON.parse(JSON.stringify(az)), dungeon.maxTicks), az);
  assert.deepEqual(parseDungeonAzioni(undefined, 10), []);
  for (const bad of [{}, [[1]], [[2, { t: 'salva' }], [1, { t: 'salva' }]], [[1, { t: 'vola' }]], [[1, { t: 'equip', slot: 'testa', item: 'x' }]], [[1, { t: 'butta', item: 'x', n: 0 }]], [[-1, { t: 'esci' }]], [[11, { t: 'esci' }]]])
    assert.equal(parseDungeonAzioni(bad, 10), null, JSON.stringify(bad));
  // impossibili (oggetto che non hai): il replay le ignora come il client
  const strana: DungeonAzioni = [[0, { t: 'equip', slot: 'arma', item: 'martello_meteorite' }], [0, { t: 'butta', item: 'perla_nera', n: 2 }]];
  assert.equal(replayDungeon(seed, 'grotta', rh, packDungeon(log), { stato: h, azioni: strana }).hash, replayDungeon(seed, 'grotta', rh, packDungeon(log), { stato: h }).hash);
});

test('Butta via sull’isola: toglie dallo zaino (gli slot rimasti senza si svuotano); forma controllata', () => {
  const lot = newLot('jack', T0, null);
  const a = applyRpgAction(lot, { t: 'butta', item: 'frecce_legno', n: 5 }, T0 + 1);
  assert.equal(heroOf(a).inv['frecce_legno'], 15);
  const b = applyRpgAction(a, { t: 'butta', item: 'katana_legno', n: 1 }, T0 + 2);
  assert.equal(heroOf(b).inv['katana_legno'], undefined);
  assert.equal(heroOf(b).equip.arma, undefined);
  assert.throws(() => applyRpgAction(b, { t: 'butta', item: 'katana_legno', n: 1 }, T0 + 3), EconomyError);
  assert.deepEqual(parseRpgAction({ t: 'butta', item: 'frecce_legno', n: 2, extra: 1 }), { t: 'butta', item: 'frecce_legno', n: 2 });
  assert.equal(parseRpgAction({ t: 'butta', item: 'frecce_legno', n: 0 }), null);
});
