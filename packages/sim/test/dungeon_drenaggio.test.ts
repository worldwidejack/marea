// Impianto di Drenaggio (Epopea della Regata, dungeon 1): bacini allagati e valvole (uguali per tutti, anche insieme e nel replay),
// Tubo-strisciante che rallenta, Valvola-SparaVapore ferma che tira getti d'acqua, sbuffo di vapore dell'Operaio, geyser del Capoturno.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import { dungeon, createPartyRun, stepParty } from '../src/dungeon/dungeon.ts';
import { cellOf, isSolid, parseDungeon } from '../src/dungeon/map.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState } from '../src/dungeon/state.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { SCOLO_TICKS } from '../src/dungeon/tuning.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { arena, heroBase, heroForte, inp, playAuto, run } from './dungeon_util.ts';

const immortale = () => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 100 }, magie: [], magia: null });
const nuovo = (hero = immortale(), seed = 3): DungeonState => dungeon.create({ seed, dungeon: 'drenaggio', hero });
/** Mette l'eroe sopra la valvola del bacino n (nemici tutti addormentati e lontani: qui conta solo l'acqua). */
function allaValvola(s: DungeonState, n: number): void {
  const v = s.map.valvole.find((x) => x.n === n)!;
  s.hero.x = v.x; s.hero.z = v.z;
  for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; }
}
const celleDi = (s: DungeonState, n: number): number[] => s.map.bacini.find((b) => b.n === n)!.celle;

test('drenaggio: tre bacini con la loro valvola; l’acqua blocca il passo ma non la vista; la copia della mappa è della partita', () => {
  const m = parseDungeon(dungeonDef('drenaggio'));
  assert.deepEqual(m.bacini.map((b) => b.n), [1, 2, 3]);
  assert.deepEqual(m.valvole.map((v) => v.n).sort(), [1, 2, 3]);
  for (const b of m.bacini) for (const i of b.celle) { assert.equal(m.solid[i], 1); assert.equal(m.opaque[i], 0); }
  const s = nuovo();
  assert.notEqual(s.map.solid, m.solid, 'ogni partita ha il suo `solid` (si svuota solo lì)');
  const v = dungeon.view(s);
  assert.deepEqual(v.acque.map((a) => a.livello), [1, 1, 1]);
  assert.equal(v.valvole.length, 3);
  assert.ok(v.valvole.every((x) => !x.aperta));
  // negli altri dungeon niente acqua
  const g = dungeon.view(dungeon.create({ seed: 1, dungeon: 'grotta', hero: heroBase() }));
  assert.deepEqual([g.acque, g.valvole, g.geyser, g.vicinoValvola], [[], [], [], false]);
});

test('drenaggio: A accanto alla valvola la gira (niente attacco), il bacino scola in 3 s e poi si cammina; l’altra partita resta allagata', () => {
  const s = nuovo();
  allaValvola(s, 1);
  assert.equal(dungeon.view(s).vicinoValvola, true);
  const ev = run(s, 1, inp({ a: true }));
  assert.ok(ev.some((e) => e.t === 'valvola' && e.n === 1), 'evento valvola');
  assert.equal(s.hero.act, 'idle', 'la A ha girato la valvola, non ha attaccato');
  assert.equal(dungeon.view(s).vicinoValvola, false, 'girata: non si gira più');
  run(s, 10);
  const lv = dungeon.view(s).acque.find((a) => a.n === 1)!.livello;
  assert.ok(lv > 0 && lv < 1, `scende: ${lv}`);
  assert.ok(celleDi(s, 1).every((i) => s.map.solid[i] === 1), 'mentre scola non si passa');
  const ev2 = run(s, SCOLO_TICKS);
  assert.ok(ev2.some((e) => e.t === 'asciutto' && e.n === 1));
  assert.ok(celleDi(s, 1).every((i) => s.map.solid[i] === 0), 'asciutto: pavimento');
  assert.ok(celleDi(s, 2).every((i) => s.map.solid[i] === 1), 'gli altri bacini restano pieni');
  const altra = nuovo();
  assert.ok(celleDi(altra, 1).every((i) => altra.map.solid[i] === 1), 'la partita nuova ha l’acqua');
});

test('drenaggio: senza svuotare non si arriva al capo; svuotati i bacini 1 e 2 si cammina fino a lui', () => {
  const s = nuovo();
  const capo = s.enemies.find((e) => e.capo)!, dove = cellOf(s.map, capo.x, capo.z); // allaValvola sposta i nemici
  const raggiungibile = () => {
    const seen = new Uint8Array(s.map.w * s.map.h), q = [cellOf(s.map, s.map.exit.x, s.map.exit.z)];
    seen[q[0]!] = 1;
    while (q.length) {
      const i = q.pop()!, cx = i % s.map.w, cz = (i - cx) / s.map.w;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (isSolid(s.map, cx + dx, cz + dz)) continue;
        const j = (cz + dz) * s.map.w + cx + dx;
        if (!seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    return seen[dove] === 1;
  };
  assert.equal(raggiungibile(), false);
  for (const n of [1, 2]) { allaValvola(s, n); run(s, 1, inp({ a: true })); run(s, SCOLO_TICKS + 1); }
  assert.equal(raggiungibile(), true);
});

test('drenaggio: le valvole si rigiocano (replay = partita) e insieme il bacino si svuota per tutti', () => {
  const s = nuovo(heroBase(), 7), log: DungeonInput[] = [];
  const v = s.map.valvole.find((x) => x.n === 1)!;
  // cammina dall'ingresso alla valvola 1 col pilota automatico (la cerca da solo) fino a girarla
  const rng = { next: () => 0.5, int: (a: number) => a, pick: <T>(a: readonly T[]) => a[0]!, fork: () => rng, seed: 1 } as unknown as Parameters<typeof dungeon.autopilot>[1];
  for (let t = 0; t < 60 * 120 && !s.done && !s.bacini[0]!.aperta; t++) { const f = quantizeDungeon(dungeon.autopilot(s, rng)); log.push(f); dungeon.step(s, f); }
  assert.ok(s.bacini.find((b) => b.n === v.n)!.aperta, 'il pilota automatico gira la valvola 1');
  for (let t = 0; t < SCOLO_TICKS + 5; t++) { const f = quantizeDungeon(inp()); log.push(f); dungeon.step(s, f); }
  const r = replayDungeon(7, 'drenaggio', heroBase(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');
  // insieme: la valvola girata da uno svuota il bacino anche per l'altro
  const p = createPartyRun({ seed: 2, dungeon: 'drenaggio', eroi: [{ hero: immortale() }, { hero: immortale() }] });
  for (const e of p.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; }
  p.eroi[1]!.hero.x = v.x; p.eroi[1]!.hero.z = v.z;
  stepParty(p, [inp(), inp({ a: true })]);
  for (let t = 0; t < SCOLO_TICKS + 1; t++) stepParty(p, [inp(), inp()]);
  assert.ok(celleDi(p, 1).every((i) => p.map.solid[i] === 0));
});

test('drenaggio: ripartendo dalla lanterna dell’officina il canale è già vuoto (si torna alla scala); dalla prima no', () => {
  const m = parseDungeon(dungeonDef('drenaggio'));
  const officina = m.altari.findIndex((a) => a.asciutti?.includes(1)), prima = m.altari.findIndex((a) => !a.asciutti);
  assert.ok(officina >= 0 && prima >= 0);
  const s = dungeon.create({ seed: 4, dungeon: 'drenaggio', hero: immortale(), partenza: officina });
  assert.ok(celleDi(s, 1).every((i) => s.map.solid[i] === 0), 'canale vuoto');
  assert.deepEqual(dungeon.view(s).acque.map((a) => a.livello), [0, 1, 1]);
  assert.equal(dungeon.view(s).valvole.find((v) => v.n === 1)!.aperta, true);
  assert.ok(m.bacini.find((b) => b.n === 1)!.celle.every((i) => m.solid[i] === 1), 'la mappa di partenza (condivisa) resta allagata');
  const s2 = dungeon.create({ seed: 4, dungeon: 'drenaggio', hero: immortale(), partenza: prima });
  assert.ok(celleDi(s2, 1).every((i) => s2.map.solid[i] === 1));
});

test('drenaggio: il colpo del Tubo-strisciante rallenta l’eroe per qualche secondo (vista: rallentato)', () => {
  const s = arena(heroBase({ max: { vita: 1000, magicka: 100, stamina: 100 } }));
  const t = newEnemy(s, 'tubo_strisciante', s.hero.x + 1.2, s.hero.z);
  t.aggro = true; t.st = 'insegue'; t.fx = -1; t.fz = 0;
  let ev: DungeonState['eventi'] = [];
  for (let i = 0; i < 300 && !ev.some((e) => e.t === 'rallentato'); i++) ev = run(s, 1);
  assert.ok(ev.some((e) => e.t === 'rallentato'), 'evento rallentato');
  assert.equal(dungeon.view(s).hero.rallentato, true);
  t.st = 'morto'; // misura la velocità senza altri colpi
  const x0 = s.hero.x;
  run(s, 30, inp({ mx: -1 }));
  const lento = x0 - s.hero.x;
  run(s, 60 * enemyDef('tubo_strisciante').rallenta!.secondi);
  assert.equal(dungeon.view(s).hero.rallentato, false, 'passa');
  const x1 = s.hero.x;
  run(s, 30, inp({ mx: 1 }));
  const normale = s.hero.x - x1;
  assert.ok(lento < normale * 0.7, `rallentato ${lento.toFixed(2)} m contro ${normale.toFixed(2)} m`);
});

test('drenaggio: la Valvola-SparaVapore non si muove (né la spinge niente) e tira getti d’acqua contundenti', () => {
  const s = arena(heroBase({ max: { vita: 1000, magicka: 100, stamina: 100 } }));
  const v = newEnemy(s, 'valvola_sparavapore', s.hero.x + 8, s.hero.z);
  v.aggro = true; v.st = 'insegue';
  const x0 = v.x, z0 = v.z;
  let tiro = false;
  for (let i = 0; i < 400 && !tiro; i++) { run(s, 1, inp({ mx: 0.3 })); tiro = s.proj.some((p) => p.tipo === 'acqua_nemica'); }
  assert.ok(tiro, 'tira un getto d’acqua');
  assert.equal(s.proj.find((p) => p.tipo === 'acqua_nemica')!.contundente, true);
  // l'eroe le va addosso: lei resta dov'è
  run(s, 120, inp({ mx: 1 }));
  assert.deepEqual([v.x, v.z], [x0, z0]);
  // un colpo che sbilancia non la sposta
  const b = newEnemy(s, 'bandito', v.x - 0.6, v.z);
  b.aggro = true; b.st = 'insegue';
  run(s, 30);
  assert.deepEqual([v.x, v.z], [x0, z0], 'separata dagli altri nemici senza muoversi');
});

test('drenaggio: l’Operaio fa lo sbuffo di vapore (area 2,4 m) ogni tre attacchi; il Capoturno fa salire i geyser che prendono chi ci sta sopra', () => {
  const s = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  const o = newEnemy(s, 'operaio_arrugginito', s.hero.x + 1.6, s.hero.z);
  o.aggro = true; o.st = 'insegue';
  const aree: number[] = [];
  for (let i = 0; i < 60 * 15; i++) { run(s, 1); const n = dungeon.view(s).nemici.find((x) => x.id === o.id)!; if (n.area && o.stT === 1) aree.push(n.area); }
  assert.ok(aree.length >= 1 && aree.every((a) => a === 2.4), `sbuffi: ${aree}`);

  const s2 = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  const k = newEnemy(s2, 'capoturno', s2.hero.x + 2.5, s2.hero.z);
  k.aggro = true; k.st = 'insegue';
  let nati = 0, presi = 0;
  for (let i = 0; i < 60 * 20; i++) {
    const prima = s2.geyser.length;
    const ev = run(s2, 1);
    if (s2.geyser.length > prima) nati += s2.geyser.length - prima;
    presi += ev.filter((e) => e.t === 'colpo' && e.su === 'eroe').length;
    const v = dungeon.view(s2);
    for (const g of v.geyser) assert.ok(g.t >= 0 && g.t <= 1);
  }
  assert.ok(nati >= 5, `geyser nati: ${nati}`);
  assert.ok(presi >= 1);
  // un geyser sotto l'eroe: avviso innocuo, poi il getto prende una volta sola
  const s3 = arena(heroBase({ max: { vita: 1000, magicka: 100, stamina: 100 } }));
  s3.geyser.push({ id: 999, x: s3.hero.x, z: s3.hero.z, r: 1.3, t: 0, avviso: 30, getto: 30, danno: 20, colpiti: [] });
  const v0 = s3.hero.vita;
  run(s3, 29);
  assert.ok(s3.hero.vita >= v0, 'l’avviso non fa male');
  const ev = run(s3, 31);
  assert.equal(ev.filter((e) => e.t === 'colpo' && e.su === 'eroe').length, 1, 'un colpo solo');
  assert.ok(ev.some((e) => e.t === 'geyser'));
  assert.equal(s3.geyser.length, 0, 'finito il getto sparisce');
});

test('drenaggio: un eroe forte che ha svuotato i bacini batte il Capoturno; il risultato segna il capo', () => {
  const s = nuovo(heroForte(), 11);
  for (const n of [1, 2]) { const v = s.map.valvole.find((x) => x.n === n)!; s.hero.x = v.x; s.hero.z = v.z; run(s, 1, inp({ a: true })); }
  run(s, SCOLO_TICKS + 1);
  const capo = s.enemies.find((e) => e.capo)!;
  for (const e of s.enemies) if (e !== capo) e.st = 'morto';
  s.hero.x = capo.x - 3; s.hero.z = capo.z + 2;
  capo.max = capo.vita = 200; // il resto lo fa l'autopilot: qui conta che la morte del capo arrivi nel risultato
  const rng = { next: () => 0.5, int: (a: number) => a, pick: <T>(a: readonly T[]) => a[0]!, fork: () => rng, seed: 1 } as unknown as Parameters<typeof dungeon.autopilot>[1];
  for (let t = 0; t < 60 * 90 && capo.st !== 'morto' && !s.done; t++) dungeon.step(s, quantizeDungeon(dungeon.autopilot(s, rng)));
  assert.equal(capo.st, 'morto', `il Capoturno è ancora vivo (vita ${capo.vita}, eroe ${s.hero.vita})`);
  assert.equal(dungeon.result(s).capo, true);
});

test('drenaggio: l’autopilot con l’eroe forte esce vivo (gira le valvole che trova)', () => {
  const { s } = playAuto('drenaggio', 5, heroForte());
  assert.equal(s.outcome, 'uscito', `esito ${s.outcome}`);
  assert.ok(s.bacini.some((b) => b.aperta), 'almeno una valvola girata');
});
