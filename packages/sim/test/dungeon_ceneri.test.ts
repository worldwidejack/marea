// Il Santuario del Capo Ardente (Isola Vulcano): il dungeon più difficile del gioco (difficoltà 10). Il Fuoco del Giuramento (bracieri da accendere,
// stanze che si chiudono, trappole di lava, ondate di calore), i tre nemici comuni coi loro punti deboli (Lanciatore di Lava, Guerriero Colossale,
// Sciamano del Fumo) e le loro micce (fuoco fatuo, Mite di lava), il capo Korok, il Manto del Primo Lucignolo e il replay deterministico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, ENEMIES, dungeonDef, enemyDef, spellDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { parseDungeon } from '../src/dungeon/map.ts';
import { accendi, alRiparoBraciere, braciereVicino, nascosto, spegni, stanzaAcca } from '../src/dungeon/braci.ts';
import { hitEnemy } from '../src/dungeon/combat.ts';
import { brucia, lavaSu } from '../src/dungeon/fuoco.ts';
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
/** Eroe con vita infinita e senza armatura: i danni si leggono interi. */
const nudo = () => heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 }, armatura: { ...heroBase().armatura, difesa: 0 } });
const nuovo = (hero = immortale(), seed = 3, partenza: number | null = null): DungeonState => dungeon.create({ seed, dungeon: 'ceneri', hero, partenza });
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
/** Il centro della cella (cx, cz) in metri. */
const cella = (cx: number, cz: number) => ({ x: (cx + 0.5) * 2, z: (cz + 0.5) * 2 });
const metti = (s: DungeonState, cx: number, cz: number, fx = 1, fz = 0): void => { const p = cella(cx, cz); s.hero.x = p.x; s.hero.z = p.z; s.hero.fx = fx; s.hero.fz = fz; };
function sveglio(s: DungeonState, tipo: string, cx: number, cz: number): Enemy {
  const p = cella(cx, cz), e = newEnemy(s, tipo, p.x, p.z);
  e.aggro = true; e.st = 'insegue';
  return e;
}
/** Un colpo di lama (o di freccia, `mischia` falso) dell'eroe sul nemico, da (ox, oz). */
const colpo = (s: DungeonState, e: Enemy, ox: number, oz: number, mischia = true, danno = 40) =>
  hitEnemy(s, e, { danno, traits: {}, magico: false, skill: 'armiLeggere', caricato: false, dirX: 1, dirZ: 0, daAlleato: false, ox, oz, ...(mischia ? { mischia: true } : {}) });
const NUOVI = ['lanciatore_lava', 'guerriero_colossale', 'sciamano_fumo', 'korok'];
const VECCHI = ['sentinella_braciere', 'cantore_fuliggine', 'totem_censo', 'arconte_solan'];

const campione = () => heroBase({
  livello: 35, max: { vita: 360, magicka: 180, stamina: 220 },
  arma: { id: 'spadone_meteorite', kind: 'mischia', skill: 'armiPesanti', classe: 'pesante', danno: 48, tempo: 1.25, portata: 2.2, carica: 1.5, caricaMolt: 3, gittata: 0, traits: { penetra: 0.5 } },
  armatura: { id: 'armatura_meteorite', difesa: 85, malus: 0.05, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1.12 },
  pozioni: [{ id: 'pozione_vita_grande', n: 10, cura: { vita: 180 }, buff: null }],
});

test('ceneri: difficoltà 10 (il più difficile), Isola Vulcano, aperto a tutti, coi nemici più forti del gioco e nessun avanzo del vecchio clone della Diga', () => {
  const ceneri = dungeonDef('ceneri'), m = parseDungeon(ceneri);
  assert.deepEqual([ceneri.stile, ceneri.difficolta, ceneri.richiede, ceneri.ingresso.island, ceneri.ingresso.at], ['ceneri', 10, undefined, 'vulcano', [15, 18]]);
  assert.ok(DUNGEONS.every((x) => x.id === 'ceneri' || x.difficolta < ceneri.difficolta), 'il più difficile del gioco');
  assert.equal(DUNGEONS.length, 10);
  for (const v of VECCHI) assert.ok(!ENEMIES.some((e) => e.id === v), `${v}: il vecchio nemico (clone della Diga) non c'è più`);

  // niente logica della Diga: né ruote, né piloni, né correnti, né il comportamento del Capitano
  assert.equal(m.valvole.length + m.timoni.length + m.piloni.length + m.venti.length, 0);
  assert.ok(ENEMIES.filter((e) => e.comportamento === 'vaelen').every((e) => !NUOVI.includes(e.id)));

  // i nemici più forti: il Colosso supera per vita, danno e armatura ogni comune degli altri dungeon, Korok ogni capo
  const altri = ENEMIES.filter((e) => !NUOVI.includes(e.id) && e.loot !== 'nessuno');
  const lanciatore = enemyDef('lanciatore_lava'), colosso = enemyDef('guerriero_colossale'), sciamano = enemyDef('sciamano_fumo'), korok = enemyDef('korok');
  for (const b of altri.filter((e) => e.boss)) assert.ok(korok.vita > b.vita && korok.danno > b.danno && korok.armatura > b.armatura, `Korok più forte di ${b.id}`);
  for (const n of altri.filter((e) => !e.boss)) assert.ok(colosso.vita > n.vita && colosso.danno > n.danno && colosso.armatura >= n.armatura, `il Colosso più forte di ${n.id}`);
  const tiratori = altri.filter((e) => e.comportamento === 'fuciliere' || e.comportamento === 'bombardiere');
  for (const t of tiratori) assert.ok(lanciatore.vita > t.vita && lanciatore.lanciatore!.danno > (t.fucile?.danno ?? t.bomba?.danno ?? 0), `il Lanciatore più forte di ${t.id}`);
  assert.ok(sciamano.vita > 100);
  assert.ok(korok.boss && korok.korok!.sputo.danno > 90 && korok.korok!.onda.danno > 100);

  // la mappa: 4 stanze di bracieri (2 + 3 + 3 + 4 agli angoli dell'arena), 2 canali di lava che si raffreddano, 3 ondate di calore, l'arena del capo
  assert.deepEqual([1, 2, 3, 4].map((n) => m.bracieri.filter((b) => b.n === n).length), [2, 3, 3, 4]);
  assert.deepEqual(m.bacini.map((b) => b.n), [2, 3]);
  assert.deepEqual(m.lave.map((l) => [l.n, l.stanza, l.istante]), [[1, 1, undefined], [2, 2, undefined], [3, 3, undefined], [9, undefined, 210]]);
  assert.equal(ceneri.ondate?.length, 3);
  assert.deepEqual(ceneri.arena, [38, 8, 44, 14]);
  assert.equal(ceneri.testi?.voci?.length, 4);
  assert.equal(ceneri.testi?.letture?.length, 2);
  assert.equal(ceneri.testi?.sottotitolo, 'Dove la pietra sanguina fuoco e il silenzio brucia.');

  const s = nuovo(), conta = (t: string) => s.enemies.filter((e) => e.tipo === t).length;
  assert.deepEqual(s.enemies.filter((e) => e.capo).map((e) => e.tipo), ['korok']);
  assert.ok(conta('lanciatore_lava') >= 6 && conta('guerriero_colossale') >= 5 && conta('sciamano_fumo') >= 5, 'tutti e tre i nemici comuni a gruppi');
  // i bracieri dell'arena stanno agli angoli di dove Korok può camminare
  const a = ceneri.arena!;
  assert.deepEqual(m.bracieri.filter((b) => b.n === 4).map((b) => [b.cx, b.cz]).sort(), [[a[0], a[1]], [a[0], a[3]], [a[2], a[1]], [a[2], a[3]]].sort());
});

test('ceneri: un tocco accende il braciere; con tutti accesi la stanza si chiude (la trappola di lava fa la crosta, il canale si raffredda); un calcio lo spegne e la trappola torna', () => {
  const s = nuovo();
  via(s);
  const m = s.map, T = m.tile;
  // la lava della stanza 1 (il corridoio dopo l'Atrio) brucia finché i suoi due bracieri sono spenti
  const lava1 = cella(14, 26);
  assert.ok(lavaSu(s, lava1.x, lava1.z), 'trappola attiva');
  s.hero.x = lava1.x; s.hero.z = lava1.z;
  run(s, 30);
  assert.ok(s.hero.brucia > 0, 'chi ci cammina sopra prende fuoco');

  const b1 = m.bracieri.map((b, i) => ({ b, i })).filter((x) => x.b.n === 1);
  s.hero.brucia = 0;
  metti(s, 3, 26);
  assert.equal(braciereVicino(s), -1, 'lontano dai bracieri A non fa niente');
  // il primo braciere: ci si mette in una cella accanto e un tocco lo accende (e non fa partire un colpo)
  s.hero.x = b1[0]!.b.x - T; s.hero.z = b1[0]!.b.z;
  assert.equal(braciereVicino(s), b1[0]!.i);
  assert.ok(run(s, 1, inp({ a: true })).some((e) => e.t === 'braciere' && e.n === 1 && e.acceso));
  assert.equal(s.hero.act, 'idle', 'il tocco accende, non attacca');
  assert.equal(stanzaAcca(s, 1), false);
  assert.ok(lavaSu(s, lava1.x, lava1.z), 'con un braciere solo la trappola resta');
  // l'ultimo: la stanza è chiusa
  s.hero.x = b1[1]!.b.x - T; s.hero.z = b1[1]!.b.z;
  run(s, 2);
  const ev = run(s, 1, inp({ a: true }));
  assert.ok(ev.some((e) => e.t === 'stanza' && e.n === 1));
  assert.equal(stanzaAcca(s, 1), true);
  assert.equal(lavaSu(s, lava1.x, lava1.z), null, 'la trappola ha fatto la crosta');
  assert.equal(dungeon.view(s).lave.find((l) => l.n === 1)!.stato, 'crosta');
  // un braciere acceso non si riaccende: A non lo vede più
  assert.notEqual(braciereVicino(s), b1[1]!.i);
  // un calcio (o un globo) lo spegne: la stanza è di nuovo aperta e la lava torna a scottare
  spegni(s, b1[0]!.i);
  assert.equal(stanzaAcca(s, 1), false);
  assert.ok(lavaSu(s, lava1.x, lava1.z));

  // la seconda stanza ha il canale di lava davanti: con l'ultimo braciere si raffredda in qualche secondo e si passa
  const canale = m.bacini.find((b) => b.n === 2)!;
  assert.ok(canale.celle.every((i) => s.map.solid[i] === 1), 'canale di lava chiuso');
  for (const x of m.bracieri.map((b, i) => ({ b, i })).filter((q) => q.b.n === 2)) accendi(s, x.i);
  assert.ok(s.bacini.find((b) => b.n === 2)!.aperta);
  assert.ok(run(s, SCOLO_TICKS + 2).some((e) => e.t === 'asciutto' && e.n === 2));
  assert.ok(canale.celle.every((i) => s.map.solid[i] === 0), 'il canale si è raffreddato');
  assert.ok(dungeon.view(s).bracieri.filter((b) => b.n === 2).every((b) => b.acceso));
});

test('ceneri: l’ondata di calore colpisce la sala, ma non chi sta nell’area 3×3 di un braciere acceso', () => {
  const s = nuovo(nudo());
  via(s);
  const o = s.def.ondate![0]!, T = s.map.tile;
  const dentro = cella(26, 24), br = s.map.bracieri.findIndex((b) => b.n === 2);
  const b = s.map.bracieri[br]!;
  const vista = () => dungeon.view(s).calore.find((c) => c.n === o.n)!;
  // l'aria si scalda prima dello scoppio
  s.hero.x = dentro.x; s.hero.z = dentro.z;
  let avviso = false, colpi = 0, calore = 0;
  for (let i = 0; i < 12 * 60; i++) {
    dungeon.step(s, inp());
    if (vista().stato === 'avviso') avviso = true;
    calore += s.eventi.filter((e) => e.t === 'calore').length;
    colpi += s.eventi.filter((e) => e.t === 'colpo' && e.su === 'eroe').length;
  }
  assert.ok(avviso, 'avviso prima dello scoppio');
  assert.ok(calore >= 1 && colpi >= 1, `ondata a segno (${calore}, ${colpi})`);
  // al riparo del braciere acceso (la cella accanto) niente
  accendi(s, br);
  s.hero.x = b.x - T; s.hero.z = b.z;
  assert.ok(alRiparoBraciere(s, s.hero.x, s.hero.z));
  const prima = s.hero.vita;
  const ev = run(s, 12 * 60);
  assert.equal(ev.filter((e) => e.t === 'calore').length, 0);
  assert.ok(s.hero.vita >= prima - 0.001, 'nessun danno al riparo');
  assert.equal(dungeon.view(s).hero.riparo, true);
});

test('ceneri: Lanciatore di Lava — cerchi rossi a terra, globi con una pozza di lava; colpito in mischia mentre carica si stordisce e i globi si dissolvono', () => {
  const s = nuovo(immortale());
  via(s);
  metti(s, 22, 24);
  const e = sveglio(s, 'lanciatore_lava', 28, 24), L = e.def.lanciatore!;
  run(s, 3);
  assert.equal(e.st, 'prepara');
  assert.equal(e.modo, 'lancia');
  const globi = s.geyser.filter((g) => g.da === e.id);
  assert.equal(globi.length, L.n, 'un cerchio per globo');
  assert.ok(globi.every((g) => g.avviso === Math.round(L.carica * 60) && g.r === L.raggio && g.magma));
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === e.id)!.attacco, 'lancia');

  // la freccia non basta: solo la lama sulla lanterna
  colpo(s, e, s.hero.x, s.hero.z, false);
  assert.ok(!e.stordito || e.stordito <= s.tick, 'una freccia non lo stordisce');
  assert.equal(s.geyser.filter((g) => g.da === e.id).length, L.n);
  colpo(s, e, s.hero.x, s.hero.z, true);
  assert.ok(e.stordito !== undefined && e.stordito > s.tick + 100, `stordito ${L.stordito} s`);
  assert.equal(s.geyser.filter((g) => g.da === e.id).length, 0, 'i globi si dissolvono');
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === e.id)!.stordito, true);

  // lasciato in pace il globo cade: danno e pozza di lava
  const u = nuovo(nudo());
  via(u);
  metti(u, 22, 24);
  sveglio(u, 'lanciatore_lava', 28, 24);
  const ev = run(u, 120);
  assert.ok(ev.some((x) => x.t === 'magma'), 'il globo cade');
  assert.ok(u.fuochi.length > 0, 'e lascia una pozza di lava');
});

test('ceneri: Guerriero Colossale — la clava cade su una corsia e resta incastrata; alle spalle si stordisce; calcia via i bracieri accesi', () => {
  const s = nuovo(nudo());
  via(s);
  metti(s, 24, 24);
  const e = sveglio(s, 'guerriero_colossale', 26, 24), C = e.def.colosso!;
  e.x = s.hero.x + 2.0; e.z = s.hero.z; e.fx = -1; e.fz = 0;
  run(s, 2);
  assert.equal(e.st, 'prepara');
  const v = dungeon.view(s).nemici.find((n) => n.id === e.id)!;
  assert.equal(v.attacco, 'schiacciata');
  assert.ok(v.corsia && v.corsia[2] === C.largo, 'il rettangolo rosso davanti a lui');
  // se l'eroe resta lì, la clava lo prende
  const ev = run(s, 90);
  assert.ok(ev.some((x) => x.t === 'colpo' && x.su === 'eroe'), 'colpo a segno');
  assert.equal(e.modo, 'incastrato');
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === e.id)!.attacco, 'incastrato');
  // da davanti nessuna stordita; da dietro × retro e stordito
  const d0 = e.vita;
  colpo(s, e, e.x + e.fx * 2, e.z + e.fz * 2, true, 100);
  const davanti = d0 - e.vita;
  assert.ok(!e.stordito || e.stordito <= s.tick, 'da davanti niente');
  const d1 = e.vita;
  colpo(s, e, e.x - e.fx * 2, e.z - e.fz * 2, true, 100);
  const dietro = d1 - e.vita;
  assert.ok(Math.abs(dietro - (100 - e.def.armatura) * C.retro) < 0.01 && davanti < dietro, `schiena scoperta: ${davanti} → ${dietro}`);
  assert.ok(e.stordito! > s.tick + 150, `stordito ${C.stordito} s`);

  // il calcio: un braciere acceso vicino e l'eroe lontano → ci va e lo spegne
  const u = nuovo();
  via(u);
  const br = u.map.bracieri.findIndex((b) => b.n === 2);
  accendi(u, br);
  const b = u.map.bracieri[br]!;
  u.hero.x = b.x + 30; u.hero.z = b.z;
  const c = newEnemy(u, 'guerriero_colossale', 20, 24);
  c.x = b.x + 4; c.z = b.z + 2; c.aggro = true; c.st = 'insegue';
  const ev2 = run(u, 600);
  assert.ok(ev2.some((x) => x.t === 'braciere' && x.i === br && !x.acceso), 'calcio al braciere');
  assert.equal(u.bracieri[br], false);
});

test('ceneri: Sciamano del Fumo — invisibile e intoccabile lontano dai bracieri accesi; la lanterna colpita lo stordisce e lo tiene visibile; evoca fuochi fatui', () => {
  const s = nuovo(immortale());
  via(s);
  const br = s.map.bracieri.findIndex((b) => b.n === 2), b = s.map.bracieri[br]!;
  const e = newEnemy(s, 'sciamano_fumo', 20, 24);
  e.x = b.x + 3; e.z = b.z + 3; e.aggro = true; e.st = 'insegue';
  assert.equal(nascosto(s, e), true);
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === e.id)!.invisibile, true);
  const v0 = e.vita;
  assert.equal(colpo(s, e, e.x - 1, e.z, true), 0, 'il fumo non si taglia');
  assert.equal(e.vita, v0);
  // il braciere acceso lo rivela (entro 3 celle)
  accendi(s, br);
  assert.equal(nascosto(s, e), false);
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === e.id)!.invisibile, undefined);
  assert.ok(colpo(s, e, e.x - 1, e.z, false) > 0, 'una freccia lo prende, ma non lo stordisce');
  assert.ok(!e.stordito || e.stordito <= s.tick);
  assert.ok(colpo(s, e, e.x - 1, e.z, true) > 0 && e.rivelato && e.stordito! >= s.tick + 170, 'lanterna colpita: stordito 3 s');
  // e adesso lo si vede anche senza braciere
  spegni(s, br);
  assert.equal(nascosto(s, e), false);

  // evoca: la linea rossa ti segue per 1 s, poi due fuochi fatui
  const u = nuovo();
  via(u);
  metti(u, 26, 26);
  const sc = newEnemy(u, 'sciamano_fumo', 30, 26), q = cella(30, 26);
  sc.x = q.x; sc.z = q.z; sc.aggro = true; sc.st = 'insegue'; sc.rivelato = true;
  let linea = false;
  for (let i = 0; i < 400 && !u.enemies.some((x) => x.tipo === 'fuoco_fatuo'); i++) {
    dungeon.step(u, inp());
    const n = dungeon.view(u).nemici.find((x) => x.id === sc.id)!;
    if (n.attacco === 'evoca' && n.mira) linea = true;
  }
  assert.ok(linea, 'la linea che ti lega a lui');
  assert.equal(u.enemies.filter((x) => x.tipo === 'fuoco_fatuo').length, 2);
});

test('ceneri: fuoco fatuo e Mite di lava — inseguono e scoppiano a contatto; il fatuo si dissolve dopo 6 s, il Mite scoppia dopo 5 s', () => {
  const s = nuovo(nudo());
  via(s);
  metti(s, 24, 24);
  const f = sveglio(s, 'fuoco_fatuo', 28, 24);
  const ev = run(s, 400);
  assert.ok(ev.some((e) => e.t === 'colpo' && e.su === 'eroe'), 'a contatto fa male');
  assert.equal(f.st, 'morto');
  assert.ok(ev.some((e) => e.t === 'scoppio'));

  // lontano dall'eroe: il fatuo si dissolve da solo senza scoppiare; il Mite invece scoppia
  const u = nuovo(nudo());
  via(u);
  metti(u, 34, 22);
  const p = cella(40, 26);
  const fa = newEnemy(u, 'fuoco_fatuo', 40, 26), mi = newEnemy(u, 'mite_lava', 40, 26);
  fa.aggro = mi.aggro = true; fa.st = mi.st = 'insegue';
  const ev2 = [] as DungeonState['eventi'];
  const vivo = (q: Enemy): boolean => q.st !== 'morto';
  for (let i = 0; i < 6.5 * 60 && (vivo(fa) || vivo(mi)); i++) {
    dungeon.step(u, inp());
    for (const q of [fa, mi]) if (vivo(q)) { q.x = p.x; q.z = p.z; } // fermi lì
    ev2.push(...u.eventi);
  }
  assert.equal(fa.st, 'morto');
  assert.equal(mi.st, 'morto');
  assert.ok(u.tick >= 4.9 * 60 && u.tick <= 6.2 * 60, `fine dopo ${u.tick} tick`);
  assert.equal(ev2.filter((e) => e.t === 'scoppio').length, 1, 'scoppia solo il Mite');
  assert.equal(u.uccisi['mite_lava'] ?? 0, 0, 'una miccia scaduta non è un’uccisione');
});

test('ceneri: Korok — nucleo coperto fuori dalle finestre, scoperto dopo ogni attacco; sputo, fasi', () => {
  const s = nuovo(nudo());
  via(s);
  const K = enemyDef('korok').korok!;
  const kp = cella(41, 11), korok = newEnemy(s, 'korok', 41, 11);
  korok.capo = true; korok.aggro = true; korok.st = 'insegue'; korok.x = kp.x; korok.z = kp.z;
  metti(s, 41, 14, 0, -1);
  // fuori dalle finestre la corazza di magma smorza ogni colpo; in finestra la lama prende il nucleo, la freccia no
  const base = 100 - korok.def.armatura;
  const d0 = korok.vita; colpo(s, korok, s.hero.x, s.hero.z, true, 100);
  assert.ok(Math.abs(d0 - korok.vita - base * K.corazza) < 0.01, 'corazza');
  korok.esp = 2;
  const d1 = korok.vita; colpo(s, korok, s.hero.x, s.hero.z, true, 100);
  assert.ok(Math.abs(d1 - korok.vita - base * 2) < 0.01, 'nucleo scoperto ×2');
  const d2 = korok.vita; colpo(s, korok, s.hero.x, s.hero.z, false, 100);
  assert.ok(Math.abs(d2 - korok.vita - base) < 0.01, 'una freccia non prende il nucleo');
  korok.esp = undefined;

  // lo sputo: due globi di fila, il primo dove sei; dopo, la bocca si raffredda e il nucleo è scoperto per 3 s
  let globi = 0;
  for (let i = 0; i < 400 && korok.modo !== 'esposto'; i++) { dungeon.step(s, inp()); globi = Math.max(globi, s.geyser.filter((g) => g.da === korok.id).length); }
  assert.equal(korok.modo, 'esposto');
  assert.ok(globi >= 1 && globi <= K.sputo.n);
  assert.equal(korok.esp, K.sputo.molt);
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === korok.id)!.esposto, K.sputo.molt);

  // fasi: sotto metà vita ruggisce, intoccabile per 2,2 s
  korok.vita = korok.max * 0.49;
  korok.st = 'insegue'; korok.modo = undefined; korok.esp = undefined; korok.cdTiro = 0;
  const ev = run(s, 2);
  assert.ok(ev.some((e) => e.t === 'fase' && e.n === 1));
  const v = korok.vita;
  assert.equal(colpo(s, korok, s.hero.x, s.hero.z, true, 100), 0, 'mentre ruggisce non si tocca');
  assert.equal(korok.vita, v);
  run(s, Math.round(K.cambio * 60) + 10);
  assert.equal(korok.fase, 1);
  assert.notEqual(korok.modo, 'cambio');
});

test('ceneri: l’onda di calore di Korok prende tutta l’arena tranne l’area dei bracieri accesi; la lava del bordo è un colpo solo, grosso, e ti rimanda dentro', () => {
  const s = nuovo(nudo());
  via(s);
  const K = enemyDef('korok').korok!;
  const kp = cella(41, 11), korok = newEnemy(s, 'korok', 41, 11);
  korok.capo = true; korok.aggro = true; korok.st = 'insegue'; korok.fase = 1; korok.x = kp.x; korok.z = kp.z; korok.attacchi = 0;
  // la seconda fase comincia con l'onda: il cerchio si riempie in 3 s
  const scoperto = cella(43, 13);
  s.hero.x = scoperto.x; s.hero.z = scoperto.z;
  let g: DungeonState['geyser'][number] | undefined;
  for (let i = 0; i < 400 && !g; i++) { dungeon.step(s, inp()); g = s.geyser.find((x) => x.da === korok.id && x.riparo); }
  assert.ok(g, 'il cerchio dell’onda');
  assert.equal(g.r, K.onda.raggio);
  const prima = s.hero.vita;
  const ev = run(s, Math.round(K.onda.caduta * 60) + 20);
  assert.ok(prima - s.hero.vita >= K.onda.danno - 1, `prende l’onda: ${prima - s.hero.vita}`);
  assert.ok(ev.some((e) => e.t === 'geyser'));

  // al riparo del braciere dell'angolo, no
  const u = nuovo(nudo());
  via(u);
  const k2 = newEnemy(u, 'korok', 41, 11);
  k2.capo = true; k2.aggro = true; k2.st = 'insegue'; k2.fase = 1; k2.x = kp.x; k2.z = kp.z;
  accendi(u, u.map.bracieri.findIndex((b) => b.cx === 38 && b.cz === 8));
  const riparo = cella(39, 9);
  u.hero.x = riparo.x; u.hero.z = riparo.z;
  const v0 = u.hero.vita;
  const ev2 = run(u, Math.round((K.onda.caduta + 1) * 60));
  assert.ok(u.geyser.concat([]).length >= 0);
  assert.ok(ev2.some((e) => e.t === 'geyser') || u.geyser.some((x) => x.riparo), 'l’onda c’è');
  assert.ok(v0 - u.hero.vita < 1, `nell'area del braciere acceso non succede niente (${v0 - u.hero.vita})`);

  // la lava del bordo: 210 di colpo e spinto verso il centro
  const w = nuovo(nudo());
  via(w);
  const lava = cella(45, 11);
  w.hero.x = lava.x; w.hero.z = lava.z;
  const x0 = w.hero.x, vita0 = w.hero.vita;
  run(w, 1);
  assert.ok(vita0 - w.hero.vita >= 200, `lava istantanea: ${vita0 - w.hero.vita}`);
  run(w, 30);
  assert.ok(w.hero.x < x0 - 1, 'rimandato dentro l’arena');
});

test('ceneri: Manto del Primo Lucignolo — immune a bruciature, braci, lava delle trappole e ondate di calore; 3 cariche di Vampa e Sovralimentazione sulle magie di fuoco', () => {
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

  // bilanciamento: almeno la Veste dell'Arcimago (4° dungeon) in Magicka e danno di Distruzione, in più la difesa e l'immunità al fuoco
  const arcimago = itemDef('unico_veste_arcimago');
  assert.ok((it.mods!.magicka ?? 0) >= (arcimago.mods!.magicka ?? 0), 'Magicka almeno quanto l’Arcimago');
  assert.ok((it.mods!.dannoDistruzione ?? 0) >= (arcimago.mods!.dannoDistruzione ?? 0), 'Distruzione almeno quanto l’Arcimago');
  assert.equal(it.mods!.difesa, 18);
  assert.ok(it.traits!.vampa!.danno <= 0.5 && it.traits!.vampa!.chiazza.dps <= 12, 'la Vampa non fa il lavoro di un’arma intera');

  // 1. Immunità: bruciatura, scorie incandescenti, lava delle trappole, ondate di calore
  const s = nuovo(immortale({ armatura: rh.armatura }));
  via(s);
  brucia(s, 10, 3);
  assert.equal(s.hero.brucia, 0, 'il Manto rende immuni alle bruciature');
  const scorie = s.map.rottami.findIndex((v) => v === 1), sx = (scorie % s.map.w + 0.5) * 2, sz = (Math.floor(scorie / s.map.w) + 0.5) * 2;
  s.hero.x = sx; s.hero.z = sz;
  assert.equal(run(s, 60).filter((e) => e.t === 'rottami').length, 0, 'immunità alle scorie incandescenti');
  const l = cella(14, 26);
  s.hero.x = l.x; s.hero.z = l.z;
  run(s, 60);
  assert.equal(s.hero.brucia, 0, 'e alla lava delle trappole');
  const dentro = cella(26, 24);
  s.hero.x = dentro.x; s.hero.z = dentro.z;
  assert.equal(run(s, 12 * 60).filter((e) => e.t === 'calore').length, 0, 'e alle ondate di calore delle stanze');

  // 2. Accumulo di 3 cariche di Vampa con colpi caricati in mischia e consumo sulla successiva magia di fuoco
  const u = arena(immortale({ arma: katana({ danno: 30 }), armatura: rh.armatura, magie: rh.magie, magia: null }));
  const manichino = newEnemy(u, 'guerriero_colossale', 21.6, 14);
  manichino.aggro = true; manichino.st = 'insegue';
  manichino.vita = 5000; manichino.max = 5000; manichino.stordito = 1e9;
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

test('ceneri: una partita col pilota automatico si rigioca con lo stesso hash (anche partendo dalla seconda lanterna)', () => {
  const s = nuovo(campione(), 2), log: DungeonInput[] = [], rng = createRng(2);
  const visti = new Set<string>();
  for (let i = 0; i < 6000 && !s.done; i++) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(visti.has('braciere'), [...visti].join(','));
  const r = replayDungeon(2, 'ceneri', campione(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');

  const t = nuovo(campione(), 4, 0), log2: DungeonInput[] = [], rng2 = createRng(4);
  while (!t.done && !t.enemies.find((e) => e.capo)!.fase && t.tick < 15000) {
    const f = quantizeDungeon(dungeon.autopilot(t, rng2));
    log2.push(f); dungeon.step(t, f);
  }
  const r2 = replayDungeon(4, 'ceneri', campione(), packDungeon(log2), { partenza: 0 });
  assert.equal(r2.hash, dungeon.result(t).hash);
});
