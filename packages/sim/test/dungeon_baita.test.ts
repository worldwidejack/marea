// Il Tempio della «Doppia Nera» (Isola dell'Adrenalina): difficoltà calibrata tra i dungeon dell'Isola della Regata (Mausoleo, 6) e il
// Portale del Vuoto a Borgo Marea (8); statistiche dei nemici calibrate tra Mausoleo e Vuoto; Turbine Spara-Neve, cannoni da tormenta,
// bastoncini spezzati, pupazzi di neve corazzati, Controllore dello Skipass, Maestro della Racchetta d'Oro, Cornacchia da Bombardino,
// Jean-Claude «Valanga», Tavola «Valanga Pro-99» (Carica in Scivolata / fresca) e replay deterministico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { parseDungeon } from '../src/dungeon/map.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { HZ, SCOLO_TICKS } from '../src/dungeon/tuning.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { buildRunHero } from '../src/rpg/derived.ts';
import { itemDef } from '../src/rpg/items.ts';
import { newLot } from '../src/economy/actions.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { createRng } from '../src/rng.ts';
import { arena, heroBase, inp, run } from './dungeon_util.ts';

const immortale = (o: Parameters<typeof heroBase>[0] = {}) => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 1e6 }, magie: [], magia: null, ...o });
const nuovo = (hero = immortale(), seed = 3, partenza: number | null = null): DungeonState => dungeon.create({ seed, dungeon: 'baita', hero, partenza });
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
function sveglio(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}
const dati = (ev: DungeonState['eventi'], su: 'eroe' | 'nemico') => ev.filter((e): e is Extract<typeof e, { t: 'colpo' }> => e.t === 'colpo' && e.su === su).map((e) => e.danno);

const sciatore = () => heroBase({
  livello: 24, max: { vita: 280, magicka: 130, stamina: 180 },
  arma: { id: 'spadone_meteorite', kind: 'mischia', skill: 'armiPesanti', classe: 'pesante', danno: 42, tempo: 1.25, portata: 2.2, carica: 1.5, caricaMolt: 3, gittata: 0, traits: { penetra: 0.5 } },
  armatura: { id: 'armatura_meteorite', difesa: 70, malus: 0.05, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1.1 },
  pozioni: [{ id: 'pozione_vita_grande', n: 8, cura: { vita: 180 }, buff: null }],
});

test('baita: difficoltà 7 (più difficile dell’Isola della Regata, più facile del Portale del Vuoto), sull’Isola dell’Adrenalina, aperta e con testi ironici', () => {
  const baita = dungeonDef('baita'), m = parseDungeon(baita);
  const regata = ['drenaggio', 'archivio', 'fucina', 'mausoleo'].map((id) => dungeonDef(id));
  const vuoto = dungeonDef('vuoto'), diga = dungeonDef('diga');
  assert.equal(baita.ingresso.island, 'adrenalina');
  assert.equal(baita.stile, 'baita');
  assert.equal(baita.difficolta, 7);
  for (const r of regata) assert.ok(baita.difficolta > r.difficolta, `baita (${baita.difficolta}) > ${r.id} (${r.difficolta})`);
  assert.ok(baita.difficolta < vuoto.difficolta, `baita (${baita.difficolta}) < vuoto (${vuoto.difficolta})`);
  assert.ok(vuoto.difficolta < diga.difficolta, `vuoto (${vuoto.difficolta}) < diga (${diga.difficolta})`);
  assert.equal(DUNGEONS.length, 10);

  // Calibrazione nemici: tra il Mausoleo Cinetico e il Portale del Vuoto / Diga
  const bossMausoleo = enemyDef('custode_egida'), bossBaita = enemyDef('jean_claude'), bossVuoto = enemyDef('custode');
  assert.ok(bossMausoleo.vita < bossBaita.vita && bossBaita.vita < bossVuoto.vita, `boss HP: ${bossMausoleo.vita} < ${bossBaita.vita} < ${bossVuoto.vita}`);
  assert.ok(bossMausoleo.danno < bossBaita.danno && bossBaita.danno < bossVuoto.danno, `boss danno: ${bossMausoleo.danno} < ${bossBaita.danno} < ${bossVuoto.danno}`);

  const tankMausoleo = enemyDef('sentinella_egida'), tankBaita = enemyDef('controllore_skipass'), tankVuoto = enemyDef('golem');
  assert.ok(tankMausoleo.vita < tankBaita.vita && tankBaita.vita < tankVuoto.vita, `tank HP: ${tankMausoleo.vita} < ${tankBaita.vita} < ${tankVuoto.vita}`);
  assert.ok(tankMausoleo.danno < tankBaita.danno && tankBaita.danno < tankVuoto.danno, `tank danno: ${tankMausoleo.danno} < ${tankBaita.danno} < ${tankVuoto.danno}`);

  // Mappa, turbine, cannoni, pupazzi di neve e lore ironica
  assert.deepEqual(m.bacini.map((b) => b.n), [1, 2, 5, 6]);
  assert.deepEqual(m.valvole.map((v) => v.n).sort(), [1, 2, 5]);
  assert.deepEqual(m.timoni.map((t) => t.n), [4]);
  assert.equal(m.piloni.length, 4);
  assert.equal(m.rottami.reduce((a, b) => a + b, 0), 12);
  assert.equal(baita.testi?.voci?.length, 4);
  assert.equal(baita.testi?.letture?.length, 2);

  const s = nuovo(), capo = s.enemies.filter((e) => e.capo);
  assert.deepEqual(capo.map((e) => e.tipo), ['jean_claude']);
  assert.deepEqual(['controllore_skipass', 'maestro_racchetta', 'cornacchia_bombardino'].map((t) => s.enemies.filter((e) => e.tipo === t).length), [6, 8, 5]);
});

test('baita: le Turbine Spara-Neve liberano le piste e abbassano il cancelletto di slalom; l’interruttore spegne la tormenta', () => {
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

test('baita: Tavola «Valanga Pro-99» — correre per 2,5 m attiva la Carica in Scivolata (fresca), e il prossimo colpo fa +35 %, rallenta e solleva una valanga', () => {
  const it = itemDef('unico_tavola_valanga');
  assert.equal(it.unico, true);
  assert.equal(it.model, 'arm_spadone');
  const lot = newLot('p', 0), h = heroOf(lot);
  const rh = buildRunHero({ ...h, inv: { ...h.inv, unico_tavola_valanga: 1 }, equip: { ...h.equip, arma: 'unico_tavola_valanga' } });
  const F = rh.arma.traits.fresca!;
  assert.deepEqual(F, { metri: 2.5, durata: 2.5, danno: 0.35, rallenta: { molt: 0.7, secondi: 3 } });

  // Camminando non si attiva; correndo per 2,5 m sì
  const s = arena(immortale({ arma: rh.arma }));
  s.hero.x = 6; s.hero.z = 14;
  run(s, Math.round(2 * HZ), inp({ mx: 1, my: 0 }));
  assert.equal(s.hero.fresca, 0, 'camminando non attiva fresca');
  const ev = run(s, Math.round(1 * HZ), inp({ mx: 1, my: 0, b: true }));
  assert.ok(ev.some((e) => e.t === 'fresca' && e.n === 1));
  assert.ok(s.hero.fresca > 0);
  assert.deepEqual(dungeon.view(s).hero.carico, { tipo: 'fresca', n: 1, max: 1 });

  // Il colpo in mischia consuma fresca, fa +35 % danno, emette 'valanga' e rallenta il bersaglio
  const u = arena(immortale({ arma: rh.arma }));
  const bersaglio = sveglio(u, 'maestro_racchetta', 21.8, 14);
  bersaglio.stordito = 1e9;
  u.hero.x = 20; u.hero.z = 14; u.hero.fx = 1; u.hero.fz = 0;
  u.hero.fresca = Math.round(F.durata * HZ);
  const ev2 = [...run(u, 1, inp({ a: true })), ...run(u, 45)];
  assert.ok(ev2.some((e) => e.t === 'valanga'), 'emette valanga');
  assert.equal(u.hero.fresca, 0, 'fresca consumata');
  assert.equal(dati(ev2, 'nemico')[0], Math.round(rh.arma.danno * (1 + F.danno)) - bersaglio.def.armatura);
  assert.equal(dungeon.view(u).nemici.find((x) => x.id === bersaglio.id)!.lento, true, 'bersaglio rallentato dalla neve fresca');
});

test('baita: una partita col pilota automatico si rigioca con lo stesso hash (anche partendo dalla lanterna dell’Après-Ski contro Jean-Claude)', () => {
  const s = nuovo(sciatore(), 2), log: DungeonInput[] = [], rng = createRng(2);
  const visti = new Set<string>();
  for (let i = 0; i < 6000 && !s.done; i++) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(['valvola', 'asciutto', 'sparo', 'bomba'].every((t) => visti.has(t)), [...visti].join(','));
  const r = replayDungeon(2, 'baita', sciatore(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');

  const t = nuovo(sciatore(), 4, 1), log2: DungeonInput[] = [], rng2 = createRng(4);
  while (!t.done && !t.enemies.find((e) => e.capo)!.fase && t.tick < 15000) {
    const f = quantizeDungeon(dungeon.autopilot(t, rng2));
    log2.push(f); dungeon.step(t, f);
  }
  const r2 = replayDungeon(4, 'baita', sciatore(), packDungeon(log2), { partenza: 1 });
  assert.equal(r2.hash, dungeon.result(t).hash);
});
