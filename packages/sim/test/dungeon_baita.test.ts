// Il Tempio della «Doppia Nera» (Isola dell'Adrenalina): difficoltà 7 (tra Mausoleo a 6 e Vuoto a 8);
// Ghiaccio Vivo a griglia con scivolamento cardinale, Colonnine Termiche (1..4) che sciolgono le stanze e aprono i tornelli;
// Acrobata del Fuoripista (trottola 2.5s e capogiro 3s), Alchimista del Bombardino (fiasche sciolina/bombardino e fusto sul retro),
// Sparaneve Automatico (torretta a ventaglio ribaltabile); Boss Jean-Claude «Valanga» (Frenata, Salto in bilico, Slalom con bandierine
// e urlo contro l'arbitro venduto); Drop unico Tavola «Valanga Pro-99» con Trick «Elicottero» e replay deterministico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { parseDungeon } from '../src/dungeon/map.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { hitEnemy } from '../src/dungeon/combat.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { SCOLO_TICKS } from '../src/dungeon/tuning.ts';
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

const sciatore = () => heroBase({
  livello: 24, max: { vita: 280, magicka: 130, stamina: 180 },
  arma: { id: 'spadone_meteorite', kind: 'mischia', skill: 'armiPesanti', classe: 'pesante', danno: 42, tempo: 1.25, portata: 2.2, carica: 1.5, caricaMolt: 3, gittata: 0, traits: { penetra: 0.5 } },
  armatura: { id: 'armatura_meteorite', difesa: 70, malus: 0.05, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1.1 },
  pozioni: [{ id: 'pozione_vita_grande', n: 8, cura: { vita: 180 }, buff: null }],
});

test('baita: difficoltà 7, Isola dell\'Adrenalina, 4 stanze con Colonnine Termiche e Tornelli, nemici e testi ironici', () => {
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

  // Calibrazione nemici e boss secondo documento di design
  const boss = enemyDef('jean_claude');
  assert.equal(boss.vita, 950);
  assert.equal(boss.danno, 26);

  const acrobata = enemyDef('acrobata_fuoripista'), alchimista = enemyDef('alchimista_bombardino'), sparaneve = enemyDef('sparaneve_automatico');
  assert.equal(acrobata.vita, 95); assert.equal(acrobata.danno, 14);
  assert.equal(alchimista.vita, 65); assert.equal(alchimista.danno, 15);
  assert.equal(sparaneve.vita, 110); assert.equal(sparaneve.danno, 16);

  // Mappa, colonnine (valvole), tornelli (bacini), forzieri, lanterne (altari) e lore
  assert.deepEqual(m.bacini.map((b) => b.n).sort(), [1, 2, 3, 4]);
  assert.deepEqual(m.valvole.map((v) => v.n).sort(), [1, 2, 3, 4]);
  assert.equal(m.forzieri.length, 5);
  assert.equal(m.altari.length, 2);
  assert.equal(baita.testi?.voci?.length, 4);
  assert.equal(baita.testi?.letture?.length, 2);

  const s = nuovo(), capo = s.enemies.filter((e) => e.capo);
  assert.deepEqual(capo.map((e) => e.tipo), ['jean_claude']);
  assert.deepEqual(['acrobata_fuoripista', 'alchimista_bombardino', 'sparaneve_automatico'].map((t) => s.enemies.filter((e) => e.tipo === t).length), [6, 5, 3]);
  assert.equal(s.enemies.length, 15);
});

test('baita: Ghiaccio Vivo e Colonnine Termiche — attivare la colonnina scongela la stanza e apre il rispettivo tornello', () => {
  const s = nuovo();
  via(s);

  // Su ghiaccio vivo attivo in stanza 1 il giocatore scivola
  s.hero.x = 11; s.hero.z = 47;
  const evGhiaccio = run(s, 2, inp({ mx: 1, my: 0 }));
  assert.ok(s.hero.slideDir !== null);
  assert.ok(evGhiaccio.some((e) => e.t === 'scivolata'));

  // Le 4 Colonnine Termiche scongelano le rispettive stanze e aprono i tornelli
  for (const n of [1, 2, 3, 4]) {
    const v = s.map.valvole.find((x) => x.n === n)!;
    s.hero.x = v.x; s.hero.z = v.z;
    const evValv = run(s, 1, inp({ a: true }));
    assert.ok(evValv.some((e) => e.t === 'valvola' && e.n === n), `valvola ${n}`);
    assert.ok(evValv.some((e) => e.t === 'scongelato' && e.n === n), `scongelato ${n}`);
    assert.ok(s.sciolti.includes(n), `stanza ${n} sciolta`);

    const evAsciuga = run(s, SCOLO_TICKS + 1);
    assert.ok(evAsciuga.some((e) => e.t === 'asciutto' && e.n === n), `tornello ${n} aperto`);
    assert.ok(s.map.bacini.find((b) => b.n === n)!.celle.every((i) => s.map.solid[i] === 0));
  }

  // Una volta scongelata la stanza 1, il pavimento non scivola più
  s.hero.slideDir = null;
  s.hero.x = 11; s.hero.z = 47;
  const evCalmo = run(s, 2, inp({ mx: 1, my: 0 }));
  assert.equal(s.hero.slideDir, null);
  assert.ok(!evCalmo.some((e) => e.t === 'scivolata'));
});

test('baita: nemici — trottola dell\'acrobata con capogiro, fiasche e retro dell\'alchimista, torretta sparaneve ribaltata', () => {
  // 1. Acrobata del Fuoripista: carica la trottola e poi subisce capogiro (stordito 3s)
  const s1 = arena(immortale());
  const a = sveglio(s1, 'acrobata_fuoripista', 22, 14);
  run(s1, 16); // prepara (0.5s)
  assert.equal(a.st, 'colpisce');
  assert.equal(a.modo, 'trottola');
  const evAcro = run(s1, 80); // rotazione (2.5s)
  assert.ok(evAcro.some((e) => e.t === 'capogiro' && e.id === a.id));
  assert.ok(a.stordito && a.stordito > s1.tick, 'acrobata stordito da capogiro');

  // 2. Alchimista del Bombardino: lancia fiasche e subisce colpo critico alle spalle (fusto)
  const s2 = arena(immortale());
  const alc = sveglio(s2, 'alchimista_bombardino', 26, 14);
  const evAlc = run(s2, 45); // prepara e lancia
  assert.ok(evAlc.some((e) => e.t === 'pozzanghera'));
  assert.ok(s2.pozzanghere.length > 0);

  // Debolezza alle spalle: colpo dal retro raddoppia il danno, stordisce ed esplode
  alc.st = 'recupera'; alc.stDur = 100; alc.fx = 1; alc.fz = 0;
  const evScoppio = hitEnemy(s2, alc, { danno: 10, traits: {}, magico: false, skill: null, caricato: false, dirX: 1, dirZ: 0, daAlleato: false, ox: alc.x - 2, oz: alc.z, mischia: true });
  assert.equal(evScoppio, 20, 'danno raddoppiato dal retro');
  assert.ok(s2.eventi.some((e) => e.t === 'scoppio'));
  assert.ok(alc.stordito && alc.stordito > s2.tick);

  // 3. Sparaneve Automatico: torretta fissa che si ribalta se colpita da colpo caricato in ricarica
  const s3 = arena(immortale());
  const sp = sveglio(s3, 'sparaneve_automatico', 24, 14);
  sp.st = 'recupera'; sp.stDur = 100; sp.fx = -1; sp.fz = 0;
  hitEnemy(s3, sp, { danno: 10, traits: {}, magico: false, skill: null, caricato: true, dirX: 1, dirZ: 0, daAlleato: false, mischia: true, ox: 20, oz: 14 });
  assert.equal(sp.ribaltato, true);
  assert.equal(sp.fx, 1, 'orientamento invertito di 180°');
  assert.ok(s3.eventi.some((e) => e.t === 'sfondato'));
});

test('baita: boss Jean-Claude — Fase 1 (frenata a spruzzo, salto con atterraggio in bilico) e Fase 2 (slalom con bandierine, urlo all\'arbitro)', () => {
  const s = arena(immortale());
  const jc = sveglio(s, 'jean_claude', 24, 14);

  // FASE 1: Frenata a Spruzzo
  jc.attacchi = 0;
  s.hero.x = 22; s.hero.z = 14;
  const evFrenata = run(s, 2);
  assert.equal(jc.modo, 'frenata');
  assert.ok(evFrenata.some((e) => e.t === 'frenata'));

  // Salto acrobatico: il mirino segue il giocatore fino a 0.6s dall'impatto; schivando all'ultimo atterra male (bilico 3s)
  jc.attacchi = 1; jc.st = 'insegue';
  run(s, 2);
  assert.equal(jc.modo, 'salto');
  run(s, 30); // segue fino a 0.9s (si blocca a 0.6s prima dell'atterraggio)
  s.hero.x = 5; s.hero.z = 5; // eroe schiva all'ultimo fuori dall'area 3x3
  const evSalto = run(s, 25);
  assert.ok(evSalto.some((e) => e.t === 'bilico'));
  assert.equal(jc.modo, 'bilico');
  assert.ok(jc.stordito && jc.stordito > s.tick);

  // FASE 2 (< 50% HP): Slalom Gigante con 3 bandierine
  jc.vita = 400; jc.stordito = 0; jc.st = 'insegue'; jc.attacchi = 0;
  run(s, 2);
  assert.equal(jc.fase, 2);
  assert.equal(jc.modo, 'slalom');
  assert.equal(s.bandierine.length, 3);

  // Attaccare e distruggere una bandierina fa infuriare Jean-Claude contro l'arbitro
  run(s, 62); // fine prepara -> inizia corsa slalom
  const bandiera = s.bandierine[0]!;
  s.hero.x = bandiera.x; s.hero.z = bandiera.z;
  const evAbbatti = [...run(s, 1, inp({ a: true })), ...run(s, 20)];
  assert.ok(evAbbatti.some((e) => e.t === 'bandierina' && e.abbattuta));
  assert.ok(evAbbatti.some((e) => e.t === 'arbitro' && e.urlo?.includes('VENDUTO')));
  assert.equal(jc.modo, 'arbitro');
  assert.ok(jc.stordito && jc.stordito > s.tick, 'stordito per 4s a protestare');
});

test('baita: Drop e Trick «Elicottero» (Tavola «Valanga Pro-99») — attacco a 360° su 2 nemici rimborsa 50% stamina e infligge Assideramento', () => {
  const it = itemDef('unico_tavola_valanga');
  assert.equal(it.unico, true);
  assert.equal(it.portata, 4);
  assert.equal(it.danno, 34);
  assert.ok(it.traits);
  const el = it.traits.elicottero!;
  assert.deepEqual(el, { stamina: 0.5, secondi: 3.5, lento: 0.35, dannoExtra: 0.2 });

  const lot = newLot('p', 0), h = heroOf(lot);
  const rh = buildRunHero({ ...h, inv: { ...h.inv, unico_tavola_valanga: 1 }, equip: { ...h.equip, arma: 'unico_tavola_valanga' } });
  const s = arena(heroBase({ arma: rh.arma }));
  const e1 = sveglio(s, 'acrobata_fuoripista', 21, 14);
  const e2 = sveglio(s, 'acrobata_fuoripista', 20, 15);
  s.hero.x = 20; s.hero.z = 14;
  s.hero.stamina = 50;

  // Carica il giro a 360° e rilascia
  const ev1 = run(s, 120, inp({ a: true }));
  const ev2 = run(s, 90, inp({ a: false }));
  const evTot = [...ev1, ...ev2];

  // Trick «Elicottero» attiva rimborso stamina e Assideramento
  assert.ok(evTot.some((e) => e.t === 'elicottero'));
  assert.equal(s.hero.stamina, 100, 'stamina rimborsata del 50% max');
  assert.ok(e1.assiderato && e1.assiderato > s.tick, 'nemico 1 assiderato');
  assert.ok(e2.assiderato && e2.assiderato > s.tick, 'nemico 2 assiderato');
  assert.equal(e1.dannoPresoMolt, 1.2, '+20% danno subito durante assideramento');
});

test('baita: una partita col pilota automatico si rigioca con lo stesso hash (anche partendo dalla lanterna dell’Après-Ski contro Jean-Claude)', () => {
  const s = nuovo(sciatore(), 2), log: DungeonInput[] = [], rng = createRng(2);
  const visti = new Set<string>();
  for (let i = 0; i < 6000 && !s.done; i++) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(['valvola', 'scongelato', 'colpo', 'capogiro'].every((t) => visti.has(t)), [...visti].join(','));
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
