// Mausoleo Cinetico (Epopea della Regata, dungeon 4): le lancette dell'orologio (prendono gli eroi una volta per passata, gli automi no),
// il cancello del Santuario e la chiave di carica (per tutti, anche insieme; dalla lanterna dell'Anticamera è già aperto), il Chierico a
// Ingranaggi che ripara e potenzia, lo scudo della Sentinella (para e respinge, il caricato lo sfonda), le combinazioni e le lame d'acqua
// della Guardia d'Onore, il Custode dell'Egida (tre fasi col cambio di cuore, l'ondata coi varchi e le colonne, lo scatto alle spalle, la
// scarica della Barriera), il sarcofago col bottino e l'Anello dell'Onda, gli unici della Regina, la porta sigillata dalla Fucina, il replay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import type { DungeonDef } from '@marea/content/rpg.ts';
import { dungeon, createPartyRun, stepParty } from '../src/dungeon/dungeon.ts';
import { cellOf, parseDungeon } from '../src/dungeon/map.ts';
import { createState, newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { hitEnemy, hitHero, kill } from '../src/dungeon/combat.ts';
import { lancettaDir, ondaDa, versore } from '../src/dungeon/onde.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { SCOLO_TICKS } from '../src/dungeon/tuning.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import type { RunWeapon } from '../src/rpg/types.ts';
import { startDungeon } from '../src/rpg/run.ts';
import { buildRunHero } from '../src/rpg/derived.ts';
import { itemDef } from '../src/rpg/items.ts';
import { newLot } from '../src/economy/actions.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { createRng } from '../src/rng.ts';
import { ARENA, arena, heroBase, heroForte, inp, katana, run } from './dungeon_util.ts';

const immortale = (o: Parameters<typeof heroBase>[0] = {}) => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 100 }, magie: [], magia: null, ...o });
const nuovo = (hero = immortale(), seed = 3, partenza: number | null = null): DungeonState => dungeon.create({ seed, dungeon: 'mausoleo', hero, partenza });
/** Nemici tutti addormentati e lontani: qui conta solo il posto. */
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
/** Nemico sveglio e in caccia. */
function sveglio(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}
/** Un colpo normale: A premuto un tick e lasciato. */
const colpo = (s: DungeonState): void => { run(s, 1, inp({ a: true })); run(s, 1); };
const dati = (ev: DungeonState['eventi'], su: 'eroe' | 'nemico') => ev.filter((e): e is Extract<typeof e, { t: 'colpo' }> => e.t === 'colpo' && e.su === su).map((e) => e.danno);

test('mausoleo: tre lancette sui perni, il cancello con la sua chiave, il sarcofago, porta sigillata dalla Fucina, il capo è il Custode', () => {
  const d = dungeonDef('mausoleo'), m = parseDungeon(d);
  assert.equal(d.richiede, 'fucina');
  assert.equal(d.stile, 'mausoleo');
  assert.equal(d.difficolta, 7);
  assert.equal(d.ingresso.island, 'laguna');
  assert.deepEqual(m.lancette.map((l) => l.n), [1, 2, 3]);
  for (const l of m.lancette) assert.equal(m.solid[cellOf(m, l.x, l.z)], 1, 'il perno è una colonna');
  assert.deepEqual(m.bacini.map((b) => [b.n, b.celle.length]), [[1, 3]], 'il cancello è un bacino di tre sbarre');
  for (const i of m.bacini[0]!.celle) { assert.equal(m.solid[i], 1, 'chiuso non si passa'); assert.equal(m.opaque[i], 0, 'ma ci si vede attraverso'); }
  assert.deepEqual(m.valvole.map((v) => v.n), [1], 'la chiave di carica');
  assert.ok(m.sarcofago);
  const sf = cellOf(m, m.sarcofago.x, m.sarcofago.z);
  assert.deepEqual([m.solid[sf], m.opaque[sf]], [1, 0]);
  assert.equal(m.solid[sf + m.w], 0, 'davanti al sarcofago si cammina (lì compare il bottino)');
  assert.deepEqual(m.altari.map((a) => a.asciutti ?? []), [[1], []], 'la lanterna dell’Anticamera trova il cancello aperto');
  const s = nuovo(), k = s.enemies.find((e) => e.capo)!;
  assert.equal(k.tipo, 'custode_egida');
  assert.equal(s.enemies.filter((e) => e.tipo === 'guardia_onore').length, 7, 'dodici lame, ne restano sette (il Breviario)');
  // negli altri dungeon niente lancette, onde né sarcofago
  const a = dungeon.view(dungeon.create({ seed: 1, dungeon: 'fucina', hero: heroBase() }));
  assert.deepEqual([a.lancette, a.onde, a.sarcofago], [[], [], undefined]);
});

test('mausoleo: il versore delle lancette senza seno e coseno torna con Math (entro 1e-12)', () => {
  for (let a = -20; a <= 20; a += 0.37) {
    const [c, s] = versore(a);
    assert.ok(Math.abs(c - Math.cos(a)) < 1e-12 && Math.abs(s - Math.sin(a)) < 1e-12, `angolo ${a}`);
  }
});

test('mausoleo: la lancetta prende chi le sta sopra e lo butta avanti nel giro, una volta per passata; agli automi non fa niente', () => {
  const s = nuovo();
  via(s);
  const l = s.map.lancette[0]!, [dx, dz] = lancettaDir(l, s.tick + 1);
  s.hero.x = l.x + dx * 4; s.hero.z = l.z + dz * 4;
  const g = newEnemy(s, 'guardia_onore', l.x + dx * 6, l.z + dz * 6); g.st = 'dorme';
  const v0 = s.hero.vita, x0 = s.hero.x, z0 = s.hero.z;
  const ev = run(s, 1);
  assert.ok(ev.some((e) => e.t === 'lancetta'));
  assert.ok(s.hero.vita < v0);
  assert.ok(s.hero.spT > 0, 'spinto via');
  run(s, 20);
  const fx = s.hero.x - x0, fz = s.hero.z - z0;
  assert.ok(fx * -dz * Math.sign(l.giro) + fz * dx * Math.sign(l.giro) > 1.5, 'via nel verso del giro');
  assert.equal(g.vita, g.max, 'la Guardia sulla lancetta non si fa niente');
  // la stessa lancetta non lo riprende subito
  const ev2 = run(s, 60);
  assert.equal(ev2.filter((e) => e.t === 'lancetta').length, 0);
  // fuori dalla sua lunghezza non prende nessuno
  const s2 = nuovo();
  via(s2);
  const [ex, ez] = lancettaDir(l, s2.tick + 1);
  s2.hero.x = l.x - ex * 3; s2.hero.z = l.z - ez * 3; // dalla parte opposta: la lancetta arriva tra mezzo giro
  assert.equal(run(s2, 30).filter((e) => e.t === 'lancetta').length, 0);
});

test('mausoleo: la chiave di carica apre il cancello del Santuario (per tutti, anche insieme); dall’Anticamera è già aperto', () => {
  const s = nuovo();
  via(s);
  const v = s.map.valvole[0]!;
  s.hero.x = v.x; s.hero.z = v.z;
  assert.equal(dungeon.view(s).vicinoValvola, true);
  const ev = run(s, 1, inp({ a: true }));
  assert.ok(ev.some((e) => e.t === 'valvola' && e.n === 1));
  assert.equal(s.hero.act, 'idle', 'la A ha girato la chiave, non ha attaccato');
  assert.ok(run(s, SCOLO_TICKS + 1).some((e) => e.t === 'asciutto' && e.n === 1));
  assert.ok(s.map.bacini[0]!.celle.every((i) => s.map.solid[i] === 0), 'aperto: si passa');
  const p = createPartyRun({ seed: 2, dungeon: 'mausoleo', eroi: [{ hero: immortale() }, { hero: immortale() }] });
  via(p);
  p.eroi[1]!.hero.x = v.x; p.eroi[1]!.hero.z = v.z;
  stepParty(p, [inp(), inp({ a: true })]);
  assert.equal(p.bacini[0]!.aperta, true);
  const anti = nuovo(immortale(), 4, 0), sala = nuovo(immortale(), 4, 1);
  assert.equal(dungeon.view(anti).acque[0]!.livello, 0);
  assert.equal(dungeon.view(sala).acque[0]!.livello, 1);
});

test('mausoleo: il Chierico a Ingranaggi ripara l’automa ferito e lo potenzia (i suoi colpi fanno di più per un po’)', () => {
  const s = arena(immortale());
  const c = sveglio(s, 'chierico_ingranaggi', 30, 14), g = sveglio(s, 'guardia_onore', 31, 18);
  g.vita = 40;
  let ev: DungeonState['eventi'] = [];
  for (let i = 0; i < 180 && !ev.some((e) => e.t === 'cura'); i++) ev = run(s, 1);
  const cura = ev.find((e) => e.t === 'cura');
  assert.ok(cura, 'ha pregato');
  assert.ok(g.vita > 40 + enemyDef('chierico_ingranaggi').cura!.vita - 1, 'riparata');
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === g.id)!.potenziato, true);
  void c;
  // potenziata, la Guardia colpisce × molt
  const t = arena(immortale());
  t.hero.protetto = 0;
  const a = sveglio(t, 'guardia_onore', 21.2, 14); a.fx = -1; a.fz = 0;
  const normale = dati(run(t, 90), 'eroe')[0]!;
  const u = arena(immortale());
  const b = sveglio(u, 'guardia_onore', 21.2, 14); b.fx = -1; b.fz = 0; b.potT = 1e9; b.potM = 1.25;
  const forte = dati(run(u, 90), 'eroe')[0]!;
  assert.ok(Math.abs(forte / normale - 1.25) < 0.08, `${normale} → ${forte}`);
});

test('mausoleo: la Guardia d’Onore attacca a coppie di fendenti e da lontano tira lame d’acqua', () => {
  const s = arena(immortale());
  const g = sveglio(s, 'guardia_onore', 21.2, 14); g.fx = -1; g.fz = 0;
  const colpi = dati(run(s, 100), 'eroe');
  assert.equal(colpi.length, 2, 'una combinazione: due fendenti');
  const t = arena(immortale());
  sveglio(t, 'guardia_onore', 29, 14);
  let lama = false;
  for (let i = 0; i < 90 && !lama; i++) { run(t, 1); lama = t.proj.some((p) => p.tipo === 'lama_nemica'); }
  assert.ok(lama, 'lama d’acqua da lontano');
});

test('mausoleo: lo scudo della Sentinella para da davanti e respinge; il caricato lo sfonda; alle spalle prende di più', () => {
  const forte = katana({ danno: 60 });
  const s = arena(immortale({ arma: forte }));
  const e = sveglio(s, 'sentinella_egida', 21.5, 14); e.fx = -1; e.fz = 0; e.cdTiro = 999;
  s.hero.fx = 1; s.hero.fz = 0;
  const v0 = e.vita;
  run(s, 1, inp({ a: true }));
  const ev = run(s, 40);
  assert.ok(ev.some((x) => x.t === 'parato' && x.perche === 'scudo'));
  assert.equal(e.vita, v0, 'parato');
  assert.ok(ev.some(() => true) && s.hero.x < 20 - 0.5, 'respinto indietro');
  // caricato da davanti: sfondato, il colpo passa
  const t = arena(immortale({ arma: forte }));
  const f = sveglio(t, 'sentinella_egida', 21.6, 14); f.fx = -1; f.fz = 0; f.stordito = 1e9; // ferma mentre carichi
  t.hero.fx = 1; t.hero.fz = 0;
  const ev2 = run(t, 80, inp({ a: true }));
  ev2.push(...run(t, 60));
  assert.ok(ev2.some((x) => x.t === 'sfondato'), 'sfondato');
  assert.ok(f.vita < f.max, 'il caricato passa');
  assert.equal(dungeon.view(t).nemici.find((n) => n.id === f.id)!.rotto, true);
  // alle spalle: × retro
  const u = arena(immortale({ arma: forte }));
  const r = sveglio(u, 'sentinella_egida', 21.5, 14); r.fx = 1; r.fz = 0; r.stordito = 1e9;
  u.hero.fx = 1; u.hero.fz = 0;
  colpo(u);
  const d = dati(run(u, 40), 'nemico')[0]!;
  assert.equal(d, Math.round((60 - 12) * 1.25));
});

test('mausoleo: il Custode cambia cuore ai due terzi e a un terzo (intanto è intoccabile), e nella terza fase scarica la Barriera', () => {
  const s = arena(immortale());
  const k = sveglio(s, 'custode_egida', 30, 14);
  k.vita = k.max * 0.6;
  const ev = run(s, 1);
  assert.ok(ev.some((e) => e.t === 'fase' && e.n === 1));
  assert.equal(k.modo, 'cambio');
  assert.equal(hitEnemy(s, k, { danno: 100, traits: {}, magico: false, skill: null, caricato: false, dirX: 0, dirZ: 0, daAlleato: false }), 0, 'intoccabile');
  run(s, 2 * 60 + 2);
  assert.notEqual(k.modo, 'cambio');
  k.vita = k.max * 0.3;
  assert.ok(run(s, 1).some((e) => e.t === 'fase' && e.n === 2));
  run(s, 2 * 60 + 2);
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === k.id)!.colpi, 5);
  for (let i = 0; i < 4; i++) hitEnemy(s, k, { danno: 30, traits: {}, magico: false, skill: null, caricato: false, dirX: 0, dirZ: 0, daAlleato: false });
  assert.equal(s.onde.length, 0);
  hitEnemy(s, k, { danno: 30, traits: {}, magico: false, skill: null, caricato: false, dirX: 0, dirZ: 0, daAlleato: false });
  assert.equal(s.onde.length, 1, 'al quinto colpo la scarica');
  assert.equal(s.onde[0]!.barriera, true);
  assert.deepEqual(s.onde[0]!.varchi, [], 'senza varchi');
});

test('mausoleo: l’onda prende chi sta sulla cresta, non chi sta nel varco né dietro una colonna', () => {
  const s = arena(immortale());
  ondaDa(s, 14, 14, { velocita: 7, raggio: 15, spessore: 0.8, danno: 26, spinta: 3, largo: 0.93 }, [[0, 1]]);
  const ev = run(s, 90);
  assert.ok(dati(ev, 'eroe').length === 1, 'presa una volta');
  const t = arena(immortale());
  ondaDa(t, 14, 14, { velocita: 7, raggio: 15, spessore: 0.8, danno: 26, spinta: 3, largo: 0.93 }, [[1, 0]]);
  assert.equal(dati(run(t, 90), 'eroe').length, 0, 'nel varco');
  const COL: DungeonDef = { ...ARENA, id: 'arena_colonna', rows: ARENA.rows.map((r, z) => (z === 7 ? r.slice(0, 8) + 'o' + r.slice(9) : r)), legenda: { o: { colonna: true } } };
  const u = createState(COL, 1, immortale());
  u.hero.x = 20; u.hero.z = 15;
  ondaDa(u, 13, 15, { velocita: 7, raggio: 15, spessore: 0.8, danno: 26, spinta: 3, largo: 0.93 }, []);
  assert.equal(dati(run(u, 90), 'eroe').length, 0, 'dietro la colonna');
});

test('mausoleo: nella nebbia il Custode segna dove ricompare (alle spalle dell’eroe), ricompare lì e batte a terra', () => {
  const s = arena(immortale());
  s.hero.fx = 1; s.hero.fz = 0;
  const k = sveglio(s, 'custode_egida', 30, 14);
  k.fase = 1; k.attacchi = 0; // ciclo del vapore: scatto, geyser, scatto
  let mira: [number, number] | undefined;
  for (let i = 0; i < 10 && !mira; i++) { run(s, 1); mira = dungeon.view(s).nemici.find((n) => n.id === k.id)!.mira; }
  assert.ok(mira);
  assert.ok(Math.abs(mira[0] - 17.5) < 0.6 && Math.abs(mira[1] - 14) < 0.6, `alle spalle: ${mira}`);
  const ev = run(s, 120);
  assert.ok(ev.some((e) => e.t === 'scatto'));
  assert.ok(Math.abs(k.x - 17.5) < 1.5, 'è ricomparso lì');
  assert.ok(dati(ev, 'eroe').length >= 1, 'e ha battuto a terra');
});

test('mausoleo: morto il Custode il sarcofago si apre e il bottino compare lì davanti, sempre con l’Anello dell’Onda', () => {
  for (const seed of [1, 2, 3]) {
    const s = nuovo(immortale(), seed), k = s.enemies.find((e) => e.capo)!;
    const ev: DungeonState['eventi'] = [];
    s.eventi = ev;
    kill(s, k);
    assert.ok(ev.some((e) => e.t === 'sarcofago'));
    const l = s.loot[s.loot.length - 1]!, sf = s.map.sarcofago!;
    assert.deepEqual([l.x, l.z], [sf.x, sf.z + s.map.tile]);
    assert.equal(l.items['unico_anello_onda'], 1);
    assert.equal(dungeon.view(s).sarcofago?.aperto, true);
    assert.equal(dungeon.result(s).capo, true);
  }
});

test('mausoleo: Armatura del Moto Perpetuo — muoversi carica la Barriera, che annulla un colpo e respinge chi è vicino', () => {
  const b = itemDef('unico_armatura_moto').traits!.barriera!;
  const s = arena(immortale({ armatura: { ...heroBase().armatura, id: 'unico_armatura_moto', difesa: 45, barriera: b } }));
  run(s, 60);
  assert.equal(s.hero.barr, 0, 'da fermo non si carica');
  const ev = run(s, Math.ceil(b.secondi * 60) + 2, inp({ mx: 1 }));
  assert.ok(ev.some((e) => e.t === 'barrieraPronta'));
  assert.equal(dungeon.view(s).hero.barriera, 1);
  const e = newEnemy(s, 'bandito', s.hero.x + 1.2, s.hero.z); e.st = 'prepara'; e.stDur = 99;
  const v0 = s.hero.vita;
  s.eventi = [];
  hitHero(s, 50, 'taglio', s.hero.x, s.hero.z);
  assert.equal(s.hero.vita, v0, 'annullato');
  assert.ok(s.eventi.some((x) => x.t === 'barriera'));
  assert.equal(e.st, 'recupera', 'interrotto');
  assert.ok(e.x > s.hero.x + 2, 'respinto');
  hitHero(s, 50, 'taglio', s.hero.x, s.hero.z);
  assert.ok(s.hero.vita < v0, 'scarica: il colpo dopo arriva');
  // correndo si carica il doppio più in fretta
  const t = arena(immortale({ armatura: { ...heroBase().armatura, barriera: b } }));
  run(t, Math.ceil((b.secondi / b.corsa) * 60) + 4, inp({ mx: 1, b: true }));
  assert.equal(t.hero.barr, 1);
});

test('mausoleo: Fendiflutti — ogni colpo scaglia una lama d’acqua che trapassa, il caricato cinque; finita la pressione si ricarica stando fermi', () => {
  const L = itemDef('unico_fendiflutti').traits!.lame!;
  const arma: RunWeapon = katana({ id: 'unico_fendiflutti', danno: 24, traits: { lame: L } });
  const s = arena(immortale({ arma }));
  s.hero.fx = 1; s.hero.fz = 0;
  const a = newEnemy(s, 'golem', 24, 14), b = newEnemy(s, 'golem', 26, 14);
  for (const e of [a, b]) { e.st = 'dorme'; e.stordito = 1e9; }
  colpo(s);
  assert.equal(s.proj.filter((p) => p.tipo === 'lama').length, 1);
  run(s, 50);
  assert.ok(a.vita < a.max && b.vita < b.max, 'trapassa: presi tutti e due');
  let lame = 1;
  for (let i = 0; i < 12; i++) { const n0 = s.nextId; colpo(s); lame += s.proj.filter((p) => p.tipo === 'lama' && p.id >= n0).length; run(s, 50); }
  assert.equal(lame, L.cariche, 'dieci di pressione');
  run(s, Math.ceil(L.ricarica * 60) + 2);
  colpo(s);
  assert.equal(s.proj.filter((p) => p.tipo === 'lama').length, 1, 'fermo due secondi: pressione piena');
  run(s, 60);
  const t = arena(immortale({ arma }));
  run(t, 80, inp({ a: true }));
  run(t, 1);
  assert.equal(t.proj.filter((p) => p.tipo === 'lama').length, L.ventaglio, 'il caricato: un ventaglio');
});

test('mausoleo: La Grande Lancetta — i colpi a tempo col tic salgono di danno, il quinto è il Rintocco che stordisce; un colpo preso azzera', () => {
  const R = itemDef('unico_grande_lancetta').traits!.ritmo!;
  const arma: RunWeapon = { ...katana(), id: 'unico_grande_lancetta', classe: 'pesante', skill: 'armiPesanti', danno: 38, tempo: 1.25, portata: 2.2, traits: { ritmo: R } };
  const s = arena(immortale({ arma }));
  s.hero.fx = 1; s.hero.fz = 0; s.hero.protetto = 1e9;
  const e = newEnemy(s, 'golem_evocato', 21.6, 14); e.st = 'dorme'; e.vita = e.max = 1e6; e.stordito = 1e9;
  const danni: number[] = [];
  let rintocco = false;
  colpo(s); // il primo dà il via
  for (let k = 0; k < 6; k++) {
    while (s.hero.act !== 'idle' || s.hero.tic < 0 || s.tick < s.hero.tic - 1) danni.push(...dati(run(s, 1), 'nemico'));
    const ev = run(s, 1, inp({ a: true }));
    ev.push(...run(s, 1));
    if (ev.some((x) => x.t === 'rintocco')) {
      rintocco = true; assert.equal(k, R.colpi - 1, 'il quinto a tempo');
      while (s.hero.act !== 'idle') danni.push(...dati(run(s, 1), 'nemico'));
      assert.ok(e.stordito! < 1e9 && e.stordito! > s.tick, 'stordito');
    }
  }
  while (s.hero.act !== 'idle') danni.push(...dati(run(s, 1), 'nemico'));
  assert.ok(rintocco);
  const netto = (k: number) => Math.round(38 * (1 + R.passo * k) - 14);
  assert.deepEqual(danni.slice(0, 7), [netto(0), netto(1), netto(2), netto(3), netto(4), netto(5), netto(1)], 'sale a ogni colpo a tempo, dopo il Rintocco riparte');
  // fuori tempo: da zero; un colpo preso: da zero
  s.hero.ritmo = 3;
  run(s, 200);
  assert.equal(s.hero.ritmo, 0, 'fermo troppo: perso');
  s.hero.ritmo = 3; s.hero.protetto = 0;
  hitHero(s, 5, 'taglio', s.hero.x, s.hero.z);
  assert.equal(s.hero.ritmo, 0, 'colpito: perso');
});

test('mausoleo: Arco Carillon — tre colpi pieni subito, poi scarico; una molla ogni due secondi e mezzo; frecce più tese', () => {
  const M = itemDef('unico_arco_carillon').traits!.carillon!;
  const arma: RunWeapon = { id: 'unico_arco_carillon', kind: 'arco', skill: 'arceria', classe: null, danno: 26, tempo: 1, portata: 0, carica: 1, caricaMolt: 1, gittata: 30, traits: { carillon: M } };
  const s = arena(immortale({ arma, frecce: { id: 'frecce_ferro', n: 20, danno: 8, gittata: 10, gravita: 6, traits: {} } }));
  for (let i = 0; i < M.colpi; i++) { colpo(s); run(s, 25); }
  assert.equal(s.hero.frecce, 20 - M.colpi, 'tre tiri senza tendere');
  const f = s.proj.find((p) => p.tipo === 'freccia');
  assert.ok(!f || f.g === 6 * M.gravita);
  run(s, 1, inp({ a: true }));
  assert.ok(s.eventi.some((e) => e.t === 'scarico'));
  run(s, 1);
  const ev = run(s, Math.ceil(M.ricarica * 60) + 2);
  assert.ok(ev.some((e) => e.t === 'carillon' && e.n === 1));
  assert.equal(dungeon.view(s).hero.carico?.tipo, 'molla');
});

test('mausoleo: Anello dell’Onda — il colpo in mischia libera un’onda sugli altri nemici attorno (non più di una ogni mezzo secondo); due anelli non si sommano', () => {
  const E = itemDef('unico_anello_onda').traits!.eco!;
  const s = arena(immortale({ arma: katana({ danno: 40 }), eco: E }));
  s.hero.fx = 1; s.hero.fz = 0;
  const a = newEnemy(s, 'golem_evocato', 21.6, 14), b = newEnemy(s, 'golem_evocato', 23.2, 14);
  for (const e of [a, b]) { e.st = 'dorme'; e.vita = e.max = 1e4; e.stordito = 1e9; }
  b.x = 23.2; // fuori portata della katana, dentro l'onda
  colpo(s);
  const ev = run(s, 40);
  assert.ok(ev.some((e) => e.t === 'eco'));
  assert.ok(b.vita < b.max, 'l’onda prende anche quello dietro');
  assert.equal(b.max - b.vita, Math.max(1, 40 * E.frazione - 14));
  // due anelli uguali: l'Eco una volta sola
  const h = heroOf(newLot('p', 0, null));
  const due = buildRunHero({ ...h, inv: { ...h.inv, unico_anello_onda: 2 }, equip: { ...h.equip, anello1: 'unico_anello_onda', anello2: 'unico_anello_onda' } });
  assert.deepEqual(due.eco, E);
  assert.equal(buildRunHero(h).eco, undefined);
});

test('mausoleo: porta sigillata — senza la Fucina completata non si entra, dopo sì', () => {
  const lot = newLot('p', 0, null);
  const h = heroOf(lot);
  assert.throws(() => startDungeon({ ...lot, hero: { ...h, completati: ['drenaggio', 'archivio'] } }, 'mausoleo', 1, 1000), /sigillata/);
  const aperto = startDungeon({ ...lot, hero: { ...h, completati: ['drenaggio', 'archivio', 'fucina'] } }, 'mausoleo', 1, 1000);
  assert.equal(aperto.dungeon?.pending?.dungeon, 'mausoleo');
});

test('mausoleo: una partita col pilota automatico si rigioca uguale (lancette, cancello, chierici, scudi e Guardia nel replay)', () => {
  const s = nuovo(heroForte(), 1), log: DungeonInput[] = [], rng = createRng(1);
  const visti = new Set<string>();
  while (!s.done) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(['valvola', 'asciutto', 'lancetta', 'parato'].every((t) => visti.has(t)), [...visti].join(','));
  const r = replayDungeon(1, 'mausoleo', heroForte(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');
  // il Custode, dalla lanterna dell'Anticamera, anche nel replay
  const t = nuovo(heroForte(), 2, 0), log2: DungeonInput[] = [], rng2 = createRng(2);
  while (!t.done && !t.enemies.find((e) => e.capo)!.fase) { const f = quantizeDungeon(dungeon.autopilot(t, rng2)); log2.push(f); dungeon.step(t, f); }
  const r2 = replayDungeon(2, 'mausoleo', heroForte(), packDungeon(log2), { partenza: 0 });
  assert.equal(r2.hash, dungeon.result(t).hash);
});
