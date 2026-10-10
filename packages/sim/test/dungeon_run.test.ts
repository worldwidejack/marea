// Partite intere: autopilot nella Grotta, determinismo, replay = partita giocata, fixture d'oro, boss della Cripta, morte, tempo di replay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { isPackedDungeon, packDungeon, quantizeDungeon, replayDungeon, unpackDungeon } from '../src/dungeon/replay.ts';
import { kill, wake } from '../src/dungeon/combat.ts';
import type { RunHero } from '../src/rpg/types.ts';
import type { PackedDungeon } from '../src/dungeon/types.ts';
import { newHero, runHeroOf } from '../src/rpg/hero.ts';
import { heroBase, heroForte, inp, playAuto, run } from './dungeon_util.ts';

test('dungeon: l’autopilot finisce la Grotta «uscito» con bottino, per 3 seed', () => {
  for (const seed of [1, 2, 3]) {
    const { s } = playAuto('grotta', seed, heroBase());
    const r = dungeon.result(s);
    const pezzi = Object.values(r.bottino).reduce((a, b) => a + b, 0);
    console.log(`  grotta seed ${seed}: ${r.outcome} in ${r.ticks} tick (${(r.ticks / 3600).toFixed(1)} min), vita ${s.hero.vita.toFixed(0)}, uccisi ${JSON.stringify(r.uccisi)}, monete ${r.monete}, oggetti ${pezzi}, danni presi ${r.danniPresi}`);
    assert.equal(r.outcome, 'uscito', `seed ${seed}`);
    assert.ok(r.ticks < dungeon.maxTicks);
    assert.ok(pezzi > 0 && r.monete > 0, 'bottino vuoto');
    assert.ok((r.xp.armiLeggere ?? 0) > 0, 'xp di armi leggere');
    assert.ok(Object.values(r.uccisi).reduce((a, b) => a + b, 0) >= 10, 'ha combattuto');
  }
});

test('dungeon: anche l’eroe di partenza vero (runHeroOf(newHero()), katana di legno) esce vivo dalla Grotta con l’autopilot', () => {
  const { s } = playAuto('grotta', 4, runHeroOf(newHero()));
  const r = dungeon.result(s);
  console.log(`  eroe di partenza: ${r.outcome} in ${r.ticks} tick, vita ${s.hero.vita.toFixed(0)}, uccisi ${Object.values(r.uccisi).reduce((a, b) => a + b, 0)}, monete ${r.monete}`);
  assert.equal(r.outcome, 'uscito');
  assert.ok(r.monete > 0);
});

test('dungeon: stesso seed + stessi input = stesso hash; replay (pack/unpack) = partita giocata', () => {
  const a = playAuto('grotta', 7, heroBase());
  const packed = packDungeon(a.log);
  assert.deepEqual(unpackDungeon(packed), a.log, 'pack/unpack senza perdite (input già quantizzati)');
  assert.ok(isPackedDungeon(packed, dungeon.maxTicks));
  const r1 = replayDungeon(7, 'grotta', heroBase(), packed), r2 = replayDungeon(7, 'grotta', heroBase(), packed);
  assert.deepEqual(r1, dungeon.result(a.s), 'il replay coincide con la partita');
  assert.deepEqual(r1, r2, 'due replay identici');
  // un seed diverso con gli stessi input dà un'altra partita
  assert.notEqual(replayDungeon(8, 'grotta', heroBase(), packed).hash, r1.hash);
  // quantizzazione a 1/8
  assert.deepEqual(quantizeDungeon({ mx: 0.33, my: -2, a: true, b: false, c: true, d: false }), { mx: 0.375, my: -1, a: true, b: false, c: true, d: false });
});

test('dungeon: isPackedDungeon rifiuta log malformati o troppo lunghi', () => {
  assert.ok(isPackedDungeon([[3, 8, -8, 15], [1, 0, 0, 0]], 10));
  for (const bad of [null, {}, [[0, 0, 0, 0]], [[1, 9, 0, 0]], [[1, 0, 0, 16]], [[1, 0, 0]], [[1.5, 0, 0, 0]], [[11, 0, 0, 0]], [[6, 0, 0, 0], [6, 0, 0, 0]]])
    assert.equal(isPackedDungeon(bad, 10), false, JSON.stringify(bad));
  assert.throws(() => replayDungeon(1, 'grotta', heroBase(), [[dungeon.maxTicks + 1, 0, 0, 0]]));
});

test('dungeon: fixture d’oro della Grotta (seed + eroe + input → hash ed esito)', () => {
  const url = new URL('./fixtures/dungeon_grotta.json', import.meta.url);
  type Fx = { dungeon: string; version: number; seed: number; hero: RunHero; inputs: PackedDungeon; outcome: string; ticks: number; hash: number };
  if (process.env['DUNGEON_FIXTURE'] === '1' || !existsSync(url)) {
    const seed = 2026;
    const { s, log } = playAuto('grotta', seed, heroBase());
    const r = dungeon.result(s);
    const fx: Fx = { dungeon: 'grotta', version: dungeon.version, seed, hero: heroBase(), inputs: packDungeon(log), outcome: r.outcome!, ticks: r.ticks, hash: r.hash };
    writeFileSync(url, JSON.stringify(fx) + '\n');
    console.log(`  fixture riscritta: ${fx.inputs.length} righe, ${fx.ticks} tick, hash ${fx.hash}`);
  }
  const fx = JSON.parse(readFileSync(url, 'utf8')) as Fx;
  assert.equal(fx.version, dungeon.version, 'fixture di un’altra versione del dungeon');
  const r = replayDungeon(fx.seed, fx.dungeon, fx.hero, fx.inputs);
  assert.equal(r.outcome, fx.outcome);
  assert.equal(r.ticks, fx.ticks);
  assert.equal(r.hash, fx.hash, 'hash diverso: la sim del dungeon è cambiata (se è voluto: DUNGEON_FIXTURE=1 e alza dungeon.version)');
});

test('dungeon: un eroe forte batte il Re delle Ossa nella sua sala', () => {
  const s = dungeon.create({ seed: 5, dungeon: 'cripta', hero: heroForte() });
  const boss = s.enemies.find((e) => e.tipo === 're_ossa')!;
  for (const e of s.enemies) if (e !== boss) e.st = 'morto';
  // l'eroe entra dal cancello sotto la sala
  s.hero.x = boss.x; s.hero.z = boss.z + 12;
  const rng = { seed: 0, next: () => 0, int: (a: number) => a, pick: <T>(a: readonly T[]) => a[0]!, fork: () => rng };
  let t = 0;
  while (boss.st !== 'morto' && !s.done && t++ < 60 * 120) dungeon.step(s, quantizeDungeon(dungeon.autopilot(s, rng)));
  const r = dungeon.result(s);
  console.log(`  Re delle Ossa: ${boss.st} in ${t} tick, vita eroe ${s.hero.vita.toFixed(0)}/${s.runHero.max.vita}, pozioni usate ${r.usati['pozione_vita'] ?? 0}, danni presi ${r.danniPresi}`);
  assert.equal(boss.st, 'morto');
  assert.notEqual(s.outcome, 'morto');
  assert.equal(r.uccisi['re_ossa'], 1);
  // il cadavere del boss lascia le ossa di mostro
  const cad = s.loot.at(-1)!;
  assert.ok((cad.items['ossa_mostro'] ?? 0) >= 3 || s.bottino['ossa_mostro']! >= 3, 'ossa di mostro dal boss');
});

test('dungeon: un eroe a 1 di vita in mezzo ai nemici muore', () => {
  const s = dungeon.create({ seed: 3, dungeon: 'grotta', hero: heroBase({ pozioni: [], pozione: null }) });
  const b = s.enemies.find((e) => e.tipo === 'bandito')!;
  s.hero.x = b.x; s.hero.z = b.z + 1.2; s.hero.vita = 1;
  for (const e of s.enemies) wake(s, e);
  run(s, 600);
  assert.equal(s.outcome, 'morto');
  assert.equal(dungeon.view(s).hero.anim, 'morto');
  assert.equal(dungeon.result(s).done, true);
});

test('dungeon: la vista ha la forma di DungeonView e gli eventi sono solo del tick', () => {
  const s = dungeon.create({ seed: 1, dungeon: 'cripta', hero: heroBase() });
  const v = dungeon.view(s);
  assert.deepEqual(Object.keys(v).sort(), ['acque', 'altari', 'bottini', 'compagni', 'done', 'dungeon', 'eventi', 'finita', 'fuochi', 'geyser', 'hero', 'io', 'lancette', 'lanterna', 'lave', 'nemici', 'onde', 'outcome', 'proiettili', 'salvato', 'salvatoQui', 'tick', 'timoni', 'uscita', 'valvole', 'venti', 'vicinoTimone', 'vicinoUscita', 'vicinoValvola', 'zaino']);
  assert.ok(v.nemici.some((n) => n.boss && n.model === 'nem_re_ossa'));
  assert.ok(v.bottini.some((b) => b.tipo === 'libro'));
  assert.ok(v.bottini.filter((b) => b.tipo === 'forziere').length >= 3);
  assert.equal(v.hero.pozioni, 3);
  run(s, 1, inp({ c: true, a: true }));
  assert.ok(dungeon.view(s).eventi.some((e) => e.t === 'magia'));
  run(s, 1);
  assert.ok(!dungeon.view(s).eventi.some((e) => e.t === 'magia'));
});

test('dungeon: replay di una partita di 20 minuti (caso peggiore: nemici tutti vivi e svegli) sotto ~2 s', () => {
  // eroe immortale che esplora con l'autopilot ma non attacca mai e non esce: arriva a «tempo» con la Grotta tutta addosso
  const hero = heroBase({ max: { vita: 1e9, magicka: 100, stamina: 100 }, magie: [], magia: null });
  // tutti svegli dal primo tick: si svegliano a mano sia nella partita registrata sia nel replay misurato
  const { s, log } = playAuto('grotta', 11, hero, (f, st) => { if (st.tick === 0) for (const e of st.enemies) wake(st, e); return { ...f, a: false }; });
  assert.equal(s.outcome, 'tempo');
  assert.equal(log.length, dungeon.maxTicks);
  const packed = packDungeon(log);
  const t0 = performance.now();
  const rs = dungeon.create({ seed: 11, dungeon: 'grotta', hero });
  for (const e of rs.enemies) wake(rs, e);
  for (const f of unpackDungeon(packed)) dungeon.step(rs, f);
  const r = dungeon.result(rs);
  const ms = performance.now() - t0;
  const t1 = performance.now();
  replayDungeon(11, 'grotta', hero, packed);
  const ms2 = performance.now() - t1;
  const svegli = s.enemies.filter((e) => e.aggro).length;
  console.log(`  replay 20 min: ${ms.toFixed(0)} ms per ${r.ticks} tick (${((ms * 1000) / r.ticks).toFixed(1)} µs/tick), ${packed.length} righe RLE (${(JSON.stringify(packed).length / 1024).toFixed(0)} KB), ${svegli} nemici svegli, danni presi ${r.danniPresi.toFixed(0)}; replayDungeon della stessa partita senza sveglia ${ms2.toFixed(0)} ms`);
  assert.equal(r.hash, dungeon.result(s).hash);
  assert.ok(ms < 2000, `replay troppo lento: ${ms.toFixed(0)} ms`);
});

test('dungeon: RunResult.capo solo quando muore il capo (nella Grotta il Capo dei banditi, un po’ più forte degli arcieri); la vista lo segna', () => {
  for (const d of ['grotta', 'cripta', 'vuoto']) {
    const s = dungeon.create({ seed: 2, dungeon: d, hero: heroBase() });
    const capo = s.enemies.filter((e) => e.capo);
    assert.equal(capo.length, 1, d);
    const altro = s.enemies.find((e) => !e.capo)!;
    kill(s, altro);
    assert.equal(dungeon.result(s).capo, false, d + ': un nemico qualunque non completa');
    kill(s, capo[0]!);
    assert.equal(dungeon.result(s).capo, true, d);
  }
  const g = dungeon.create({ seed: 2, dungeon: 'grotta', hero: heroBase() });
  const capo = g.enemies.find((e) => e.capo)!, arciere = g.enemies.find((e) => e.tipo === 'bandito_arciere')!;
  assert.equal(capo.tipo, 'capo_banditi');
  assert.ok(capo.max > arciere.max && capo.def.danno > arciere.def.danno && !capo.def.boss, 'il capo è un po’ più forte, non un boss');
  const v = dungeon.view(g).nemici;
  assert.deepEqual(v.filter((n) => n.capo).map((n) => n.id), [capo.id], 'nella vista solo il capo ha capo: true');
});
