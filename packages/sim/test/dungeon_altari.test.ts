// Altari di salvataggio, le «lanterne» (docs/RPG.md §4): almeno 2 per dungeon fuori dalla vista dei boss, salvataggio con l'azione SALVA
// (dal v5 passarci sopra non salva), risveglio dopo la morte, bottino dell'altare tenuto a fine spedizione (morte, tempo, partita lasciata a
// metà) e chiusura dal server di una spedizione interrotta (input + azioni).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, RPG, enemyDef } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import type { LotState } from '../src/economy/types.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import type { DungeonState } from '../src/dungeon/dungeon.ts';
import { bfs, cellCenter, cellOf, parseDungeon, stepDown } from '../src/dungeon/map.ts';
import { encodeDungeon, packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { chiudiSalvata, chiudiScaduta } from '../src/dungeon/settle.ts';
import { hitHero } from '../src/dungeon/combat.ts';
import type { DungeonAzioni, DungeonInput } from '../src/dungeon/types.ts';
import { finishDungeon, startDungeon } from '../src/rpg/run.ts';
import { heroOf } from '../src/rpg/hero.ts';
import type { RunHero, RunResult } from '../src/rpg/types.ts';
import { heroBase, inp, run } from './dungeon_util.ts';

const T0 = 1_800_000_000_000;
/** Eroe che non muore e non attacca: serve a camminare fino agli altari senza dipendere dai combattimenti. */
const immortale = (): RunHero => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 100 }, magie: [], magia: null });

/** Cammina verso la cella `to` lungo le distanze BFS, registrando input quantizzati come il client; si ferma lì sopra o a `max` tick. */
function walkTo(s: DungeonState, to: number, log: DungeonInput[], max = 60 * 90): void {
  const m = s.map, field = bfs(m, to), goal = cellCenter(m, to);
  for (let t = 0; t < max && !s.done; t++) {
    const c = cellOf(m, s.hero.x, s.hero.z);
    const next = c === to ? to : stepDown(m, field, c);
    const p = next >= 0 && next !== to ? cellCenter(m, next) : goal;
    const dx = p.x - s.hero.x, dz = p.z - s.hero.z, d = Math.sqrt(dx * dx + dz * dz);
    if (c === to && d < 0.3) return;
    const f = quantizeDungeon(inp(d > 1e-6 ? { mx: dx / d, my: dz / d } : {}));
    log.push(f); dungeon.step(s, f);
  }
}
const cellAt = (s: DungeonState, i: number): number => { const a = s.map.altari[i]!; return a.cz * s.map.w + a.cx; };

test('altari: almeno 2 per dungeon, sul pavimento raggiungibile e fuori dalla vista dei boss', () => {
  for (const d of DUNGEONS) {
    const m = parseDungeon(d);
    assert.ok(m.altari.length >= 2, `${d.id}: ${m.altari.length} altari`);
    const dist = bfs(m, m.exit.cz * m.w + m.exit.cx);
    for (const a of m.altari) {
      assert.ok(dist[a.cz * m.w + a.cx]! > 0, `${d.id}: altare ${a.cx},${a.cz} irraggiungibile`);
      for (const n of m.nemici) {
        const e = enemyDef(n.tipo);
        if (!e.boss) continue;
        const dx = (n.cx - a.cx) * m.tile, dz = (n.cz - a.cz) * m.tile;
        assert.ok(Math.sqrt(dx * dx + dz * dz) > e.vista, `${d.id}: l'altare ${a.cx},${a.cz} è nella vista di ${n.tipo}`);
      }
    }
  }
});

test('lanterne: passarci sopra non salva; SALVA sì (una volta), di nuovo solo se è cambiato qualcosa; lontano niente SALVA né ESCI', () => {
  const s = dungeon.create({ seed: 4, dungeon: 'grotta', hero: immortale() });
  const log: DungeonInput[] = [];
  assert.equal(dungeon.act(s, { t: 'salva' }), null, 'all’ingresso non c’è una lanterna');
  assert.equal(dungeon.act(s, { t: 'esci' }), null);
  walkTo(s, cellAt(s, 1), log);
  const v = dungeon.view(s);
  assert.equal(s.salvato, null, 'passandoci sopra non salva più');
  assert.equal(v.lanterna, 1);
  assert.equal(v.salvatoQui, false);
  const ev = dungeon.act(s, { t: 'salva' });
  assert.deepEqual(ev, [{ t: 'altare', n: 1 }]);
  assert.equal(s.salvato!.altare, 1);
  assert.equal(dungeon.view(s).altari.filter((a) => a.attivo).length, 1);
  assert.equal(dungeon.view(s).salvatoQui, true);
  assert.equal(dungeon.act(s, { t: 'salva' }), null, 'niente di nuovo da salvare');
  // raccoglie qualcosa (finto): SALVA di nuovo col bottino nuovo
  s.bottino['lingotto_ferro'] = 2; s.monete += 7;
  assert.equal(dungeon.view(s).salvatoQui, false);
  assert.ok(dungeon.act(s, { t: 'salva' }));
  assert.deepEqual(s.salvato!.bottino, s.bottino);
  assert.equal(s.salvato!.monete, s.monete);
  // lontano dalla lanterna: niente
  s.hero.x += 4; run(s, 1);
  assert.equal(dungeon.view(s).lanterna, -1);
  assert.equal(dungeon.act(s, { t: 'salva' }), null);
});

test('lanterne: ESCI = fuori col bottino («uscito», come la scala) e la lanterna nel risultato; il server la ricorda e ci si riparte', () => {
  const s = dungeon.create({ seed: 4, dungeon: 'grotta', hero: immortale() });
  s.hero.x = s.map.altari[1]!.x; s.hero.z = s.map.altari[1]!.z; run(s, 1);
  s.bottino = { lingotto_ferro: 3 }; s.monete = 9;
  assert.deepEqual(dungeon.act(s, { t: 'esci' }), [{ t: 'uscita', lanterna: 1 }]);
  assert.equal(s.done, true);
  const r = dungeon.result(s);
  assert.equal(r.outcome, 'uscito');
  assert.equal(r.lanterna, 1);
  assert.equal(dungeon.act(s, { t: 'salva' }), null, 'a partita finita niente azioni');
  const l0 = startDungeon(newLot('jack', T0, null), 'grotta', 9, T0 + 1000);
  const out = finishDungeon(l0, r, T0 + 60_000);
  assert.deepEqual(out.tenuto, { lingotto_ferro: 3 });
  assert.equal(out.monete, 9);
  assert.deepEqual(heroOf(out.lot).lanterne, { grotta: 1 });
  // alla discesa dopo: dall'ingresso o dalla lanterna (sopra la lanterna, già attiva per i risvegli, niente bottino)
  assert.equal(startDungeon(out.lot, 'grotta', 10, T0 + 70_000).dungeon!.pending!.partenza, null);
  const p = startDungeon(out.lot, 'grotta', 10, T0 + 70_000, { lanterna: true }).dungeon!.pending!;
  assert.equal(p.partenza, 1);
  assert.equal(startDungeon(out.lot, 'cripta', 10, T0 + 70_000, { lanterna: true }).dungeon!.pending!.partenza, null, 'nella Cripta non sei mai uscito da una lanterna');
  const s2 = dungeon.create({ seed: p.seed, dungeon: 'grotta', hero: p.hero, stato: p.stato!, partenza: p.partenza! });
  assert.equal(s2.hero.x, s2.map.altari[1]!.x);
  assert.equal(s2.hero.z, s2.map.altari[1]!.z);
  assert.equal(s2.salvato?.altare, 1);
  assert.equal(dungeon.view(s2).lanterna, 1);
  // uscendo dalla scala la lanterna resta quella di prima
  const fuori = finishDungeon(startDungeon(out.lot, 'grotta', 11, T0), { ...r, lanterna: null }, T0 + 1);
  assert.deepEqual(heroOf(fuori.lot).lanterne, { grotta: 1 });
});

test('altari: morendo dopo un altare ti risvegli lì, barre piene, solo il bottino dell’altare, qualche secondo protetto', () => {
  const s = dungeon.create({ seed: 4, dungeon: 'grotta', hero: heroBase({ pozioni: [], pozione: null }) });
  s.hero.x = s.map.altari[0]!.x; s.hero.z = s.map.altari[0]!.z;
  s.bottino = { lingotto_bronzo: 1 }; s.monete = 5;
  run(s, 1);
  assert.ok(dungeon.act(s, { t: 'salva' }));
  assert.equal(s.salvato?.altare, 0);
  // altro bottino dopo l'altare, poi muore lontano
  s.bottino['lingotto_ferro'] = 3; s.monete = 20;
  s.hero.x = s.map.spawn.x; s.hero.z = s.map.spawn.z; s.hero.vita = 1;
  hitHero(s, 50, 'taglio', s.hero.x, s.hero.z);
  assert.equal(s.done, false, 'la spedizione continua');
  assert.equal(s.cadute, 1);
  assert.equal(s.hero.x, s.map.altari[0]!.x);
  assert.equal(s.hero.vita, s.runHero.max.vita);
  assert.deepEqual(s.bottino, { lingotto_bronzo: 1 });
  assert.equal(s.monete, 5);
  assert.ok(s.eventi.some((e) => e.t === 'risveglio'));
  assert.ok(s.enemies.every((e) => !e.aggro), 'i nemici smettono di inseguire');
  // protetto per RPG.dungeon.altare.protezione secondi
  hitHero(s, 50, 'taglio', s.hero.x, s.hero.z);
  assert.equal(s.hero.vita, s.runHero.max.vita);
  assert.equal(dungeon.view(s).hero.protetto, true);
  run(s, Math.round(RPG.dungeon.altare.protezione * 60));
  assert.equal(dungeon.view(s).hero.protetto, false);
  hitHero(s, 10, 'taglio', s.hero.x, s.hero.z);
  assert.ok(s.hero.vita < s.runHero.max.vita, 'dopo la protezione i colpi tornano a far male');
  const r = dungeon.result(s);
  assert.deepEqual(r.salvato, { bottino: { lingotto_bronzo: 1 }, monete: 5 });
  assert.equal(r.cadute, 1);
});

test('altari: a fine spedizione si tiene il bottino dell’altare (morte, tempo, partita lasciata a metà); uscendo tutto', () => {
  const l = startDungeon(newLot('jack', T0, null), 'grotta', 9, T0 + 1000);
  const base: RunResult = { done: true, outcome: 'morto', ticks: 3600, bottino: { lingotto_bronzo: 2, lingotto_ferro: 3 }, monete: 30, xp: {}, usati: {}, rotti: {}, usura: {}, uccisi: {}, danniFatti: 0, danniPresi: 0, hash: 1, salvato: { bottino: { lingotto_bronzo: 2 }, monete: 12 }, cadute: 2 };
  for (const outcome of ['morto', 'tempo', null] as const) {
    const out = finishDungeon(l, { ...base, outcome, done: outcome !== null }, T0 + 60_000);
    assert.deepEqual(out.tenuto, { lingotto_bronzo: 2 }, `${outcome}: tiene il bottino dell'altare`);
    assert.equal(out.monete, 12);
    assert.equal(heroOf(out.lot).morti, 2 + (outcome === 'morto' ? 1 : 0), 'i risvegli contano come morti');
  }
  const uscito = finishDungeon(l, { ...base, outcome: 'uscito' }, T0 + 60_000);
  assert.deepEqual(uscito.tenuto, { lingotto_bronzo: 2, lingotto_ferro: 3 });
  assert.equal(uscito.monete, 30);
});

test('altari: il replay degli input fino all’altare ritrova il salvataggio; il server chiude la spedizione interrotta col suo bottino', () => {
  const hero = immortale(), seed = 21;
  const s = dungeon.create({ seed, dungeon: 'grotta', hero });
  const log: DungeonInput[] = [];
  // prima al forziere più vicino all'uscita (bottino vero), poi all'altare più vicino all'uscita (i nemici svegli possono sbarrare
  // un corridoio stretto all'eroe che non combatte: questi due percorsi restano liberi)
  const m = s.map, fromExit = bfs(m, m.exit.cz * m.w + m.exit.cx), near = (cx: number, cz: number) => fromExit[cz * m.w + cx]!;
  const chest = [...m.forzieri].sort((a, b) => near(a.cx, a.cz) - near(b.cx, b.cz))[0]!;
  walkTo(s, chest.cz * m.w + chest.cx, log);
  assert.ok(Object.keys(s.bottino).length > 0 || s.monete > 0, 'il forziere dà qualcosa');
  const alt = m.altari.map((_, i) => i).sort((a, b) => near(m.altari[a]!.cx, m.altari[a]!.cz) - near(m.altari[b]!.cx, m.altari[b]!.cz))[0]!;
  walkTo(s, cellAt(s, alt), log);
  const azioni: DungeonAzioni = [[s.tick, { t: 'salva' }]];
  assert.ok(dungeon.act(s, { t: 'salva' }));
  assert.equal(s.salvato?.altare, alt);
  const salvato = { bottino: { ...s.salvato!.bottino }, monete: s.salvato!.monete };
  assert.equal(replayDungeon(seed, 'grotta', hero, packDungeon(log)).salvato, null, 'senza l’azione SALVA niente salvataggio');
  const r = replayDungeon(seed, 'grotta', hero, packDungeon(log), { azioni });
  assert.equal(r.done, false);
  assert.deepEqual(r.salvato, salvato);
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash del client');

  // il server: spedizione aperta con quel salvataggio, mai chiusa (scheda chiusa)
  const l0 = startDungeon(newLot('jack', T0, null), 'grotta', seed, T0);
  const lot: LotState = { ...l0, dungeon: { pending: { ...l0.dungeon!.pending!, hero, stato: undefined, salvataggio: { inputs: encodeDungeon(packDungeon(log)), ticks: r.ticks, azioni } } } };
  assert.equal(chiudiScaduta(lot, T0 + 60_000), null, 'una spedizione ancora in corso non si chiude da sola');
  for (const out of [chiudiSalvata(lot, T0 + 60_000), chiudiScaduta(lot, T0 + (RPG.dungeon.maxMinuti + 6) * 60_000)]) {
    assert.ok(out);
    assert.equal(out.lot.dungeon?.pending, null);
    assert.equal(out.monete, salvato.monete);
    for (const [id, n] of Object.entries(salvato.bottino)) assert.equal(out.tenuto[id], n, id);
  }
  assert.equal(chiudiSalvata(l0, T0), null, 'senza salvataggio non c’è niente da chiudere');
});
