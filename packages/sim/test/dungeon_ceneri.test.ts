// Il Santuario del Capo Ardente (Isola Vulcano): il nuovo dungeon più difficile del gioco (difficoltà 10, sopra la Diga dei Disertori a 9);
// statistiche dei nemici calibrate per essere i più forti del gioco fin'ora (Sentinella del Braciere, Cantore della Fuliggine, Totem del
// Censo e Arconte Solan); ruote termali, soffioni piroclastici, scorie incandescenti, sfiati termici nell'arena, Manto del Primo Lucignolo
// (Sovralimentazione della Brace / vampa) e replay deterministico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, ENEMIES, dungeonDef, enemyDef, spellDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { cellOf, parseDungeon } from '../src/dungeon/map.ts';
import { brucia } from '../src/dungeon/fuoco.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { SCOLO_TICKS } from '../src/dungeon/tuning.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { buildRunHero } from '../src/rpg/derived.ts';
import { itemDef } from '../src/rpg/items.ts';
import { newLot } from '../src/economy/actions.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { createRng } from '../src/rng.ts';
import { arena, heroBase, inp, katana, run } from './dungeon_util.ts';

const immortale = (o: Parameters<typeof heroBase>[0] = {}) => heroBase({ max: { vita: 1e9, magicka: 1e6, stamina: 1e6 }, ...o });
const nuovo = (hero = immortale(), seed = 3, partenza: number | null = null): DungeonState => dungeon.create({ seed, dungeon: 'ceneri', hero, partenza });
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
function sveglio(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}
const CENERI = ['sentinella_braciere', 'cantore_fuliggine', 'totem_censo', 'arconte_solan'];

const campione = () => heroBase({
  livello: 35, max: { vita: 360, magicka: 180, stamina: 220 },
  arma: { id: 'spadone_meteorite', kind: 'mischia', skill: 'armiPesanti', classe: 'pesante', danno: 48, tempo: 1.25, portata: 2.2, carica: 1.5, caricaMolt: 3, gittata: 0, traits: { penetra: 0.5 } },
  armatura: { id: 'armatura_meteorite', difesa: 85, malus: 0.05, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1.12 },
  pozioni: [{ id: 'pozione_vita_grande', n: 10, cura: { vita: 180 }, buff: null }],
});

test('ceneri: difficoltà 10 (il più difficile del gioco), sull’Isola Vulcano, aperto a tutti, e coi nemici più forti del gioco fin’ora', () => {
  const ceneri = dungeonDef('ceneri'), m = parseDungeon(ceneri);
  const diga = dungeonDef('diga');
  assert.deepEqual([ceneri.stile, ceneri.difficolta, ceneri.richiede, ceneri.ingresso.island], ['ceneri', 10, undefined, 'vulcano']);
  assert.ok(ceneri.difficolta > diga.difficolta);
  assert.ok(DUNGEONS.every((x) => x.id === 'ceneri' || x.difficolta < ceneri.difficolta), 'il più difficile del gioco');
  assert.equal(DUNGEONS.length, 10);

  // Calibrazione nemici: più forti di qualsiasi altro dungeon (inclusa la Diga dei Disertori e il Portale del Vuoto)
  const altri = ENEMIES.filter((e) => !CENERI.includes(e.id) && e.loot !== 'nessuno');
  const solan = enemyDef('arconte_solan'), sentinella = enemyDef('sentinella_braciere');
  const cantore = enemyDef('cantore_fuliggine'), totem = enemyDef('totem_censo');
  const fuciliere = enemyDef('fuciliere_acquafonda'), albatros = enemyDef('albatros_pece');

  for (const b of altri.filter((e) => e.boss)) {
    assert.ok(solan.vita > b.vita && solan.danno > b.danno && solan.armatura > b.armatura, `Arconte Solan più forte di ${b.id}`);
  }
  for (const n of altri.filter((e) => !e.boss)) {
    assert.ok(sentinella.vita > n.vita && sentinella.danno > n.danno && sentinella.armatura >= n.armatura, `Sentinella del Braciere più forte di ${n.id}`);
  }
  assert.ok(cantore.vita > fuciliere.vita && cantore.danno > fuciliere.danno && cantore.fucile!.danno > fuciliere.fucile!.danno);
  assert.ok(totem.vita > albatros.vita && totem.bomba!.danno > albatros.bomba!.danno && totem.armatura > albatros.armatura);

  // Mappa, ruote termali, soffioni, sfiati termici, scorie incandescenti e lore
  assert.deepEqual(m.bacini.map((b) => b.n), [1, 2, 5, 6]);
  assert.deepEqual(m.valvole.map((v) => v.n).sort(), [1, 2, 5]);
  assert.deepEqual(m.timoni.map((t) => t.n), [4]);
  assert.equal(m.piloni.length, 4);
  assert.equal(m.rottami.reduce((a, b) => a + b, 0), 12);
  assert.equal(ceneri.testi?.voci?.length, 4);
  assert.equal(ceneri.testi?.letture?.length, 2);

  const s = nuovo(), capo = s.enemies.filter((e) => e.capo);
  assert.deepEqual(capo.map((e) => e.tipo), ['arconte_solan']);
  assert.deepEqual(CENERI.slice(0, 3).map((t) => s.enemies.filter((e) => e.tipo === t).length), [7, 8, 5]);
});

test('ceneri: le ruote termali solidificano le vasche di lava e abbassano il ponte d’ossidiana; il soffione placa il getto piroclastico', () => {
  const s = nuovo();
  via(s);
  for (const n of [1, 2, 5]) {
    const v = s.map.valvole.find((x) => x.n === n)!;
    s.hero.x = v.x; s.hero.z = v.z;
    assert.ok(run(s, 1, inp({ a: true })).some((e) => e.t === 'valvola' && e.n === n));
    assert.ok(run(s, SCOLO_TICKS + 1).some((e) => e.t === 'asciutto' && e.n === n));
    assert.ok(s.map.bacini.find((b) => b.n === n)!.celle.every((i) => s.map.solid[i] === 0));
  }
  const t = s.map.timoni[0]!;
  s.hero.x = t.x; s.hero.z = t.z;
  assert.ok(run(s, 1, inp({ a: true })).some((e) => e.t === 'timone' && e.n === 4));
  assert.equal(dungeon.view(s).venti.find((v) => v.n === 4)!.stato, 'ferma');
});

test('ceneri: Manto del Primo Lucignolo — immunità a bruciature e scorie, 3 cariche di Vampa e Sovralimentazione della Brace sulle magie di fuoco', () => {
  const it = itemDef('unico_manto_lucignolo');
  assert.equal(it.unico, true);
  assert.equal(it.kind, 'veste');
  const lot = newLot('p', 0), h = heroOf(lot);
  const rh = buildRunHero({
    ...h,
    magie: ['fiammata', 'bomba_fuoco'],
    inv: { ...h.inv, unico_manto_lucignolo: 1 },
    equip: { ...h.equip, corpo: 'unico_manto_lucignolo', magia: 'fiammata', mano: 'magia' },
  });
  const V = rh.armatura.vampa!;
  assert.deepEqual(V, { cariche: 3, raggioMolt: 2, danno: 0.4, chiazza: { raggio: 2, durata: 3, dps: 8 } });
  assert.equal(rh.armatura.difesa, 18);

  // 1. Immunità passiva a bruciature e scorie incandescenti
  const s = nuovo(immortale({ armatura: rh.armatura }));
  via(s);
  brucia(s, 10, 3);
  assert.equal(s.hero.brucia, 0, 'il Manto del Primo Lucignolo rende immuni alle bruciature');
  const p = { x: (30 + 0.5) * 2, z: (19 + 0.5) * 2 };
  s.hero.x = p.x; s.hero.z = p.z;
  assert.ok(s.map.rottami[cellOf(s.map, s.hero.x, s.hero.z)]);
  const evScorie = run(s, 60);
  assert.equal(evScorie.filter((e) => e.t === 'rottami').length, 0, 'immunità alle scorie incandescenti');

  // 2. Accumulo di 3 cariche di Vampa con colpi caricati in mischia e consumo sulla successiva magia di fuoco
  const u = arena(immortale({ arma: katana({ danno: 30 }), armatura: rh.armatura, magie: rh.magie, magia: null }));
  const manichino = sveglio(u, 'sentinella_braciere', 21.6, 14);
  manichino.vita = 5000; manichino.max = 5000; manichino.stordito = 1e9; manichino.rotto = Number.MAX_SAFE_INTEGER;
  u.hero.x = 20; u.hero.z = 14; u.hero.fx = 1; u.hero.fz = 0;

  for (let c = 1; c <= 3; c++) {
    const ev = [...run(u, 80, inp({ a: true })), ...run(u, 60)];
    assert.ok(ev.some((e) => e.t === 'vampa' && e.n === c), `carica vampa ${c}`);
    assert.equal(u.hero.vampa, c);
  }
  assert.deepEqual(dungeon.view(u).hero.carico, { tipo: 'vampa', n: 3, max: 3 });

  // 3. Passa a Proiettile infuocato (fiammata) e lancia: consuma le 3 cariche, raddoppia il raggio, fa +40 % danno e lascia una chiazza di brace a terra
  u.runHero.magia = 0; u.hero.incanta = true;
  const vitaPrima = manichino.vita;
  const evCast = [...run(u, 1, inp({ a: true })), ...run(u, 30)];
  assert.equal(u.hero.vampa, 0, 'cariche di Vampa consumate al lancio');
  assert.ok(evCast.some((e) => e.t === 'sovralimentata'), 'esplosione sovralimentata');
  const dBase = rh.magie[0]!.danno;
  const dAtteso = Math.round(dBase * (1 + V.danno));
  assert.ok(vitaPrima - manichino.vita >= dAtteso, `danno Fiammata sovralimentata (+40 %): ${vitaPrima - manichino.vita} >= ${dAtteso}`);
  const chiazza = u.fuochi.find((f) => f.amico);
  assert.ok(chiazza, 'lascia una chiazza di brace viva a terra');
  assert.equal(chiazza.r, V.chiazza.raggio);
  assert.equal(chiazza.dps, V.chiazza.dps);
  assert.equal(spellDef('fiammata').elemento, 'fuoco');
});

test('ceneri: una partita col pilota automatico si rigioca con lo stesso hash (anche partendo dalla lanterna del Crinale contro Solan)', () => {
  const s = nuovo(campione(), 2), log: DungeonInput[] = [], rng = createRng(2);
  const visti = new Set<string>();
  for (let i = 0; i < 6000 && !s.done; i++) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(['valvola', 'asciutto', 'sparo', 'bomba'].every((t) => visti.has(t)), [...visti].join(','));
  const r = replayDungeon(2, 'ceneri', campione(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');

  const t = nuovo(campione(), 4, 1), log2: DungeonInput[] = [], rng2 = createRng(4);
  while (!t.done && !t.enemies.find((e) => e.capo)!.fase && t.tick < 15000) {
    const f = quantizeDungeon(dungeon.autopilot(t, rng2));
    log2.push(f); dungeon.step(t, f);
  }
  const r2 = replayDungeon(4, 'ceneri', campione(), packDungeon(log2), { partenza: 1 });
  assert.equal(r2.hash, dungeon.result(t).hash);
});
