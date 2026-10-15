// La Diga dei Disertori (docs/RPG.md §2g): le Ruote di Sentina (prosciugano, fermano la risacca, abbassano il ponte mobile; dalla lanterna
// del Timone è già tutto fatto), la risacca che spinge sui rottami acuminati, la Guardia della Paratia (portello che para, il caricato lo
// manda in frantumi per sempre, la schiacciata sulla corsia), il Fuciliere d'Acquafonda (la linea che segue e poi si blocca, il balzo),
// l'Albatros di Pece (sgancia e poi atterra), il Capitano Vaelen (affondi, spazzata e lancia incastrata con la catena alle spalle; le
// catene spezzate, la carica che fracassa i piloni, la salva con lo scudo), l'Albero della «Stella del Mattino» (Vento in Poppa), la porta
// sigillata dal Portale del Vuoto, il replay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, ENEMIES, dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { cellOf, parseDungeon } from '../src/dungeon/map.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { alto } from '../src/dungeon/muove.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { HZ, SCOLO_TICKS } from '../src/dungeon/tuning.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { startDungeon } from '../src/rpg/run.ts';
import { buildRunHero } from '../src/rpg/derived.ts';
import { itemDef } from '../src/rpg/items.ts';
import { newLot } from '../src/economy/actions.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { createRng } from '../src/rng.ts';
import { arena, heroBase, inp, katana, run } from './dungeon_util.ts';

const immortale = (o: Parameters<typeof heroBase>[0] = {}) => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 1e6 }, magie: [], magia: null, ...o });
const nuovo = (hero = immortale(), seed = 3, partenza: number | null = null): DungeonState => dungeon.create({ seed, dungeon: 'diga', hero, partenza });
/** Nemici tutti addormentati e lontani: qui conta solo il posto. */
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
function sveglio(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}
/** Il modo di adesso (senza il restringimento di TypeScript dopo un assert). */
const modoDi = (e: Enemy): string | undefined => e.modo;
const centro = (cx: number, cz: number) => ({ x: (cx + 0.5) * 2, z: (cz + 0.5) * 2 });
const colpo = (s: DungeonState): void => { run(s, 1, inp({ a: true })); run(s, 1); };
const dati = (ev: DungeonState['eventi'], su: 'eroe' | 'nemico') => ev.filter((e): e is Extract<typeof e, { t: 'colpo' }> => e.t === 'colpo' && e.su === su).map((e) => e.danno);
const DIGA = ['guardiano_paratia', 'fuciliere_acquafonda', 'albatros_pece', 'capitano_vaelen'];
/** Eroe da fine gioco (ha fatto il Portale del Vuoto): spadone di meteorite, piastre, pozioni grandi. */
const leggenda = () => heroBase({
  livello: 30, max: { vita: 320, magicka: 150, stamina: 200 },
  arma: { id: 'spadone_meteorite', kind: 'mischia', skill: 'armiPesanti', classe: 'pesante', danno: 46, tempo: 1.25, portata: 2.2, carica: 1.5, caricaMolt: 3, gittata: 0, traits: { penetra: 0.5 } },
  armatura: { id: 'armatura_meteorite', difesa: 80, malus: 0.05, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1.12 },
  pozioni: [{ id: 'pozione_vita_grande', n: 8, cura: { vita: 180 }, buff: null }],
});

test('diga: ruote, risacca, rottami, piloni e lanterne; sull’Isola della Tempesta, sigillata dal Portale del Vuoto, la più difficile; il capo è Vaelen', () => {
  const d = dungeonDef('diga'), m = parseDungeon(d);
  assert.deepEqual([d.stile, d.difficolta, d.richiede, d.ingresso.island], ['diga', 9, 'vuoto', 'tempesta']);
  assert.ok(DUNGEONS.every((x) => x.id === 'diga' || x.difficolta < d.difficolta), 'la più difficile del gioco');
  assert.deepEqual(m.bacini.map((b) => b.n), [1, 2, 5, 6], 'la sentina, l’infermeria, il ponte mobile e i canali di scolo dell’arena');
  assert.deepEqual(m.valvole.map((v) => v.n).sort(), [1, 2, 5], 'le ruote che prosciugano (e quella del ponte)');
  assert.deepEqual(m.timoni.map((t) => t.n), [4], 'la ruota che ferma la risacca del corridoio');
  assert.deepEqual(m.venti.map((v) => [v.n, v.dx, v.dz, v.pausa]), [[3, 0, 1, 2.2], [4, -1, 0, 0]], 'i getti della Batteria a raffiche, il corridoio sempre');
  assert.equal(m.piloni.length, 4);
  for (const p of m.piloni) assert.deepEqual([m.solid[p.i], m.opaque[p.i]], [1, 1], 'un pilone ferma come una colonna');
  assert.equal(m.rottami.reduce((a, b) => a + b, 0), 12);
  for (let i = 0; i < m.rottami.length; i++) if (m.rottami[i]) assert.ok(m.zona[i], 'i rottami stanno in fondo alla risacca, dove spinge');
  assert.deepEqual(m.altari.map((a) => [a.asciutti ?? [], a.ferme ?? []]), [[[], []], [[5], [4]]], 'dalla lanterna del Timone il ponte è giù e la risacca ferma');
  const s = nuovo(), capo = s.enemies.filter((e) => e.capo);
  assert.deepEqual(capo.map((e) => e.tipo), ['capitano_vaelen']);
  assert.deepEqual(DIGA.slice(0, 3).map((t) => s.enemies.filter((e) => e.tipo === t).length), [6, 8, 5]);
  // i nemici più forti del gioco: il Capitano più di ogni altro capo, la Guardia della Paratia più di ogni altro nemico comune
  const altri = ENEMIES.filter((e) => !DIGA.includes(e.id) && e.loot !== 'nessuno');
  const V = enemyDef('capitano_vaelen'), G = enemyDef('guardiano_paratia');
  for (const b of altri.filter((e) => e.boss)) assert.ok(V.vita > b.vita && V.danno >= b.danno && V.armatura >= b.armatura, `Vaelen contro ${b.id}`);
  for (const n of altri.filter((e) => !e.boss)) assert.ok(G.vita > n.vita && G.danno > n.danno, `la Guardia contro ${n.id}`);
});

test('diga: le Ruote di Sentina prosciugano, fermano la risacca e abbassano il ponte; dalla lanterna del Timone è già fatto', () => {
  const s = nuovo();
  via(s);
  for (const n of [1, 2, 5]) {
    const v = s.map.valvole.find((x) => x.n === n)!;
    s.hero.x = v.x; s.hero.z = v.z;
    assert.equal(dungeon.view(s).vicinoValvola, true);
    const ev = run(s, 1, inp({ a: true }));
    assert.ok(ev.some((e) => e.t === 'valvola' && e.n === n), `ruota ${n}`);
    assert.equal(s.hero.act, 'idle', 'la A ha girato la ruota, non ha attaccato');
    assert.ok(run(s, SCOLO_TICKS + 1).some((e) => e.t === 'asciutto' && e.n === n));
    assert.ok(s.map.bacini.find((b) => b.n === n)!.celle.every((i) => s.map.solid[i] === 0), `${n}: si passa`);
  }
  assert.ok(s.map.bacini.find((b) => b.n === 6)!.celle.every((i) => s.map.solid[i] === 1), 'i canali dell’arena restano pieni');
  const t = s.map.timoni[0]!;
  s.hero.x = t.x; s.hero.z = t.z;
  assert.equal(dungeon.view(s).vicinoTimone, true);
  assert.ok(run(s, 1, inp({ a: true })).some((e) => e.t === 'timone' && e.n === 4));
  assert.equal(dungeon.view(s).venti.find((v) => v.n === 4)!.stato, 'ferma');
  const timone = nuovo(immortale(), 4, 1), v = dungeon.view(timone);
  assert.equal(v.acque.find((a) => a.n === 5)!.livello, 0, 'ponte giù');
  assert.equal(v.venti.find((x) => x.n === 4)!.stato, 'ferma');
  assert.equal(v.acque.find((a) => a.n === 1)!.livello, 1, 'la sentina si riprosciuga a ogni discesa');
});

test('diga: la risacca del corridoio ti butta sui rottami (che tagliano ogni 0,8 s); ferma, si passa', () => {
  const s = nuovo();
  via(s);
  const p = centro(32, 19);
  s.hero.x = p.x; s.hero.z = p.z;
  const ev = run(s, 60);
  assert.ok(s.hero.x < centro(31, 19).x - 0.5, 'spinto a ovest');
  assert.ok(s.map.rottami[cellOf(s.map, s.hero.x, s.hero.z)], 'finito sui rottami contro il muro');
  const tagli = ev.filter((e) => e.t === 'rottami').length;
  assert.ok(tagli >= 1 && tagli <= 2, `${tagli} tagli in un secondo`);
  assert.equal(dati(ev, 'eroe')[0], Math.round(22 * (1 - 30 / 130)), 'taglio: l’armatura conta');
  // la ruota del corridoio la ferma: da lì in poi resti dove sei
  const t = nuovo(immortale(), 3, 1);
  via(t);
  t.hero.x = p.x; t.hero.z = p.z;
  run(t, 60);
  assert.ok(Math.abs(t.hero.x - p.x) < 1e-6, 'ferma: nessuna spinta');
  // i getti della Batteria: a raffiche verso sud (tre celle), il cannone ripara la cella sotto
  const u = nuovo();
  via(u);
  const q = centro(16, 17), r = centro(17, 19);
  u.hero.x = q.x; u.hero.z = q.z;
  run(u, Math.round(3.2 * HZ));
  assert.ok(u.hero.z > q.z + 5, `spinto a sud di ${(u.hero.z - q.z).toFixed(1)} m`);
  const w = nuovo();
  via(w);
  w.hero.x = r.x; w.hero.z = r.z;
  run(w, Math.round(3.2 * HZ));
  assert.ok(Math.abs(w.hero.z - r.z) < 1e-6, 'al riparo sotto il cannone');
});

test('diga: il portello della Guardia della Paratia para da davanti; il caricato lo manda in frantumi per sempre', () => {
  const forte = katana({ danno: 70 });
  const s = arena(immortale({ arma: forte }));
  const g = sveglio(s, 'guardiano_paratia', 22, 14); g.fx = -1; g.fz = 0; g.stordito = 1e9;
  s.hero.fx = 1; s.hero.fz = 0;
  colpo(s);
  const ev = run(s, 40);
  assert.ok(ev.some((x) => x.t === 'parato' && x.perche === 'scudo'));
  assert.equal(g.vita, g.max, 'parato');
  const t = arena(immortale({ arma: forte }));
  const f = sveglio(t, 'guardiano_paratia', 22, 14); f.fx = -1; f.fz = 0; f.stordito = 1e9;
  t.hero.fx = 1; t.hero.fz = 0;
  const ev2 = [...run(t, 80, inp({ a: true })), ...run(t, 60)];
  assert.ok(ev2.some((x) => x.t === 'sfondato'), 'in frantumi');
  assert.ok(f.vita < f.max, 'il caricato passa');
  assert.equal(f.rotto, Number.MAX_SAFE_INTEGER, 'per sempre');
  f.stordito = undefined;
  const n = () => dungeon.view(t).nemici.find((x) => x.id === f.id)!;
  assert.equal(n().senza, true);
  run(t, Math.round(3 * HZ));
  assert.notEqual(n().rotto, true, 'barcolla solo all’inizio');
  assert.equal(n().senza, true, 'ma il portello non torna');
  const v0 = f.vita; f.stordito = 1e9; f.fx = -1; f.fz = 0;
  t.hero.x = 20; t.hero.z = 14; t.hero.fx = 1; t.hero.fz = 0;
  colpo(t);
  run(t, 40);
  assert.ok(f.vita < v0, 'senza portello il colpo normale passa');
});

test('diga: la schiacciata d’ancora cade sulla corsia davanti alla Guardia: chi ne esce di lato non la prende', () => {
  const s = arena(immortale());
  const g = sveglio(s, 'guardiano_paratia', 22.6, 14); g.fx = -1; g.fz = 0;
  run(s, 2);
  assert.equal(g.st, 'prepara');
  const n = dungeon.view(s).nemici.find((x) => x.id === g.id)!;
  assert.equal(n.attacco, 'schiacciata');
  assert.ok(n.corsia && n.corsia[0] < 20 && Math.abs(n.corsia[1] - 14) < 0.01, 'la corsia va verso l’eroe');
  const ev = run(s, 80);
  assert.deepEqual(dati(ev, 'eroe'), [Math.round(42 * (1 - 30 / 130))], 'fermo sulla corsia: la prende');
  const t = arena(immortale());
  const h = sveglio(t, 'guardiano_paratia', 22.6, 14); h.fx = -1; h.fz = 0;
  run(t, 2);
  t.hero.z = 16.2; // di lato, ancora a due passi da lei
  const ev2 = run(t, 80);
  assert.deepEqual(dati(ev2, 'eroe'), []);
  assert.ok(ev2.some((x) => x.t === 'schivato'));
});

test('diga: il Fuciliere mira con la linea che ti segue, poi la blocca e spara lungo la linea; di lato all’ultimo la eviti; dopo balza indietro', () => {
  const s = arena(immortale());
  const f = sveglio(s, 'fuciliere_acquafonda', 34, 14);
  run(s, 2);
  assert.deepEqual([f.st, f.modo], ['prepara', 'fucile']);
  s.hero.z = 18; run(s, 3);
  const vista = () => dungeon.view(s).nemici.find((x) => x.id === f.id)!;
  assert.ok(Math.abs(vista().mira![1] - 18) < 1.5, 'la linea segue');
  assert.notEqual(vista().fisso, true);
  run(s, Math.round(1.25 * HZ));
  assert.equal(vista().fisso, true, 'gli ultimi 0,4 s la linea si blocca (gialla)');
  const z0 = vista().mira![1];
  s.hero.z = 15; // a metà strada: la linea non si muove più
  run(s, 2);
  assert.equal(vista().mira![1], z0);
  s.hero.z = 18; // e sulla linea bloccata la palla arriva
  const x0 = f.x;
  const ev = run(s, 40);
  assert.ok(ev.some((e) => e.t === 'sparo'));
  assert.deepEqual(dati(ev, 'eroe'), [Math.round(40 * (1 - 30 / 130))]);
  assert.ok(f.x > x0 + 3, 'balza indietro dopo il tiro');
  // di lato dopo che la linea si è bloccata: la palla passa
  const t = arena(immortale());
  const g = sveglio(t, 'fuciliere_acquafonda', 34, 14);
  run(t, Math.round(1.25 * HZ));
  t.hero.z = 16.5;
  const ev2 = run(t, 60);
  assert.ok(ev2.some((e) => e.t === 'sparo'));
  assert.deepEqual(dati(ev2, 'eroe'), [], 'schivata di lato');
  assert.equal(g.st === 'recupera' || g.st === 'insegue', true);
});

test('diga: l’Albatros di Pece vola alto, sgancia il barile dove sei (cerchio largo, un secondo e mezzo) e poi atterra tre secondi', () => {
  const s = arena(immortale());
  const a = sveglio(s, 'albatros_pece', 26, 14);
  assert.equal(alto(s, a), true, 'in volo la lama non lo prende');
  let barile = s.geyser.find((g) => g.spinta !== undefined);
  for (let i = 0; i < 200 && !barile; i++) { run(s, 1); barile = s.geyser.find((g) => g.spinta !== undefined); }
  assert.ok(barile, 'barile sganciato');
  assert.deepEqual([barile.r, barile.avviso], [2, Math.round(1.5 * HZ)]);
  assert.ok(Math.abs(barile.x - s.hero.x) < 0.01 && Math.abs(barile.z - s.hero.z) < 0.01, 'dove stai');
  run(s, 12);
  assert.equal(a.st, 'recupera');
  assert.equal(alto(s, a), false, 'atterrato: in mischia lo prendi');
  run(s, Math.round(2.8 * HZ));
  assert.equal(alto(s, a), false, 'ancora a terra dopo quasi tre secondi');
  run(s, Math.round(0.4 * HZ));
  assert.equal(alto(s, a), true, 'riparte col barile nuovo');
});

test('diga: Vaelen, prima fase — doppio affondo (due corsie, la seconda rimirata) e spazzata con la lancia incastrata e la catena alle spalle', () => {
  const s = arena(immortale({ arma: katana({ danno: 60 }) }));
  const v = sveglio(s, 'capitano_vaelen', 26, 14);
  run(s, 1);
  assert.deepEqual([v.modo, v.st], ['affondo', 'prepara']);
  assert.ok(dungeon.view(s).nemici.find((x) => x.id === v.id)!.corsia, 'la corsia rossa');
  const ev = run(s, Math.round(0.8 * HZ));
  assert.deepEqual(dati(ev, 'eroe'), [Math.round(50 * 0.9 * (1 - 30 / 130))], 'primo affondo: fermo sulla corsia');
  assert.equal(v.st, 'prepara', 'subito il secondo');
  s.hero.z = 18; // il secondo è già mirato: di lato lo eviti
  const ev2 = run(s, Math.round(0.8 * HZ) + 2);
  assert.deepEqual(dati(ev2, 'eroe'), []);
  // la spazzata: anello attorno a lui, poi la lancia resta incastrata 3 s
  const t = arena(immortale({ arma: katana({ danno: 60 }) }));
  const w = sveglio(t, 'capitano_vaelen', 23, 14); w.attacchi = 1;
  run(t, 1);
  assert.deepEqual([w.modo, w.area], ['spazzata', true]);
  assert.equal(dungeon.view(t).nemici.find((x) => x.id === w.id)!.area, 4.5);
  const ev3 = run(t, Math.round(1 * HZ));
  assert.equal(dati(ev3, 'eroe').length, 1);
  assert.ok(ev3.some((e) => e.t === 'incastrato'));
  assert.deepEqual([w.modo, w.st], ['incastrato', 'recupera']);
  // alle spalle la catena: × 1,3; davanti normale
  w.fx = -1; w.fz = 0;
  t.hero.x = 25.5; t.hero.z = 14; t.hero.fx = -1; t.hero.fz = 0;
  colpo(t);
  const dietro = dati(run(t, 50), 'nemico')[0]!;
  assert.equal(dietro, Math.round((60 - 16) * 1.3));
  t.hero.x = 20.5; t.hero.fx = 1;
  colpo(t);
  const davanti = dati(run(t, 30), 'nemico')[0]!;
  assert.equal(davanti, 60 - 16);
  run(t, Math.round(2.2 * HZ));
  assert.equal(w.modo === 'incastrato', false, 'dopo tre secondi si libera');
});

test('diga: Vaelen, seconda fase — spezza le catene (intoccabile), la carica fracassa il pilone e lo lascia stordito tra i detriti', () => {
  const s = nuovo(immortale({ arma: katana({ danno: 60 }) }));
  via(s);
  const k = s.enemies.find((e) => e.capo)!, p = s.map.piloni[0]!; // il pilone in alto a sinistra (33, 5)
  const a = centro(37, 5), b = centro(31, 5);
  k.x = a.x; k.z = a.z; k.st = 'insegue'; k.aggro = true;
  s.hero.x = b.x; s.hero.z = b.z;
  k.vita = k.max * 0.49;
  const ev = run(s, 1);
  assert.ok(ev.some((e) => e.t === 'fase' && e.n === 1));
  assert.equal(k.modo, 'cambio');
  k.fx = 1; k.fz = 0; s.hero.x = k.x - 2.5; s.hero.z = k.z; s.hero.fx = 1; s.hero.fz = 0;
  colpo(s);
  const parati = run(s, 20);
  assert.ok(parati.some((e) => e.t === 'parato' && e.perche === 'catene'));
  // la carica parte quando ti vede (qui di sbieco, allo scoperto); la freccia ti segue: ti metti dietro il pilone prima che si blocchi
  const c = centro(32, 8);
  s.hero.x = c.x; s.hero.z = c.z;
  for (let i = 0; i < 400 && modoDi(k) !== 'carica'; i++) run(s, 1);
  assert.equal(k.modo, 'carica');
  assert.equal(k.pilone, -1, 'allo scoperto la freccia arriva al muro');
  s.hero.x = b.x; s.hero.z = b.z;
  run(s, 3);
  assert.equal(k.pilone, 0, 'dietro il pilone la freccia ci sbatte contro');
  run(s, Math.round(0.9 * HZ));
  assert.equal(dungeon.view(s).nemici.find((x) => x.id === k.id)!.fisso, true, 'gli ultimi 0,4 s non ti segue più');
  const ev2 = run(s, Math.round(2.5 * HZ));
  assert.ok(ev2.some((e) => e.t === 'pilone'));
  assert.equal(s.piloni[0], true);
  assert.deepEqual([s.map.solid[p.i], s.map.opaque[p.i]], [0, 0], 'dove c’era il pilone si passa');
  assert.deepEqual([k.modo, k.st], ['detriti', 'recupera']);
  assert.deepEqual(dati(ev2, 'eroe'), [], 'dietro il pilone la carica non ti prende');
  assert.equal(dungeon.view(s).piloni[0]!.rotto, true);
  run(s, Math.round(1.5 * HZ));
  assert.equal(k.modo, 'detriti', 'stordito quattro secondi');
  run(s, Math.round(2.5 * HZ));
  assert.notEqual(k.modo, 'detriti', 'poi si libera');
});

test('diga: Vaelen, la salva — fermo con lo scudo davanti mentre cadono le cannonate; un caricato da davanti lo sfonda e la seconda ondata non arriva', () => {
  const salva = (caricato: boolean) => {
    const s = arena(immortale({ arma: katana({ danno: 60 }) }));
    const v = sveglio(s, 'capitano_vaelen', 24, 14); v.fase = 1; v.attacchi = 1;
    run(s, Math.round(0.5 * HZ) + 2);
    assert.deepEqual([v.modo, v.st], ['salva', 'colpisce']);
    assert.equal(dungeon.view(s).nemici.find((x) => x.id === v.id)!.scudo, true);
    assert.equal(s.geyser.filter((g) => g.cannone).length, 3, 'la prima ondata: tre cannonate');
    s.hero.x = 21.5; s.hero.z = 14; s.hero.fx = 1; s.hero.fz = 0; v.fx = -1; v.fz = 0;
    if (caricato) s.geyser = []; // le cannonate della prima ondata lo spingerebbero via mentre carica
    const ev = caricato ? [...run(s, Math.round(1.3 * HZ), inp({ a: true })), ...run(s, 30)] : (colpo(s), run(s, 30));
    return { s, v, ev };
  };
  const a = salva(false);
  assert.ok(a.ev.some((e) => e.t === 'parato' && e.perche === 'scudo'));
  assert.equal(a.v.vita, a.v.max);
  run(a.s, Math.round(1.6 * HZ));
  assert.ok(a.s.geyser.filter((g) => g.cannone).length >= 2 || a.v.salve === 2, 'la seconda ondata');
  const b = salva(true);
  assert.ok(b.ev.some((e) => e.t === 'sfondato'));
  assert.ok(b.v.vita < b.v.max, 'il caricato passa');
  assert.equal(b.v.modo, 'sbilanciato');
  assert.equal(b.s.geyser.filter((g) => g.cannone && g.t <= g.avviso).length, 0, 'le cannonate ancora in aria non cadono');
  run(b.s, Math.round(2 * HZ));
  assert.equal(b.s.geyser.filter((g) => g.cannone).length, 0, 'niente più ondate');
});

test('diga: l’Albero della «Stella del Mattino» — affondo lungo; correndo la Brezza si carica, piena il caricato è in metà tempo, fa di più, respinge e sfonda gli scudi', () => {
  const it = itemDef('unico_albero_stella');
  assert.equal(it.unico, true);
  assert.equal(it.portata, 4.2);
  const lot = newLot('p', 0, null), h = heroOf(lot);
  const rh = buildRunHero({ ...h, inv: { ...h.inv, unico_albero_stella: 1 }, equip: { ...h.equip, arma: 'unico_albero_stella' } });
  assert.equal(rh.arma.portata, 4.2);
  assert.deepEqual(rh.arma.traits.poppa, { metri: 6, cariche: 3, carica: 0.5, danno: 0.45, spinta: 4 });
  const P = rh.arma.traits.poppa!;
  // la Brezza: solo correndo, una carica ogni 6 m, al massimo tre
  const s = arena(immortale({ arma: rh.arma }));
  s.hero.x = 4; s.hero.z = 14;
  const ev = run(s, Math.round(1.5 * HZ), inp({ mx: 1, my: 0, b: true }));
  assert.ok(ev.some((e) => e.t === 'brezza' && e.n === 1));
  run(s, Math.round(3 * HZ), inp({ mx: 1, my: 0, b: true }));
  assert.equal(s.hero.brezza, 3);
  assert.equal(dungeon.view(s).hero.carico?.tipo, 'brezza');
  const c = arena(immortale({ arma: rh.arma }));
  c.hero.x = 4; c.hero.z = 14;
  run(c, Math.round(4 * HZ), inp({ mx: 1, my: 0 }));
  assert.equal(c.hero.brezza, 0, 'camminando no');
  // piena: il caricato si carica in metà tempo
  const tempo = (brezza: number) => {
    const t = arena(immortale({ arma: rh.arma }));
    t.hero.brezza = brezza;
    run(t, 13, inp({ a: true }));
    return t.hero.actDur;
  };
  assert.equal(tempo(3), Math.round(tempo(0) * P.carica));
  // l'onda d'urto: sfonda lo scudo della Sentinella da davanti, fa +45 % e la respinge di 4 m
  const u = arena(immortale({ arma: rh.arma }));
  const e = sveglio(u, 'sentinella_egida', 23, 14); e.fx = -1; e.fz = 0; e.stordito = 1e9;
  u.hero.fx = 1; u.hero.fz = 0; u.hero.brezza = 3;
  const x0 = e.x;
  const ev2 = [...run(u, Math.round(1 * HZ), inp({ a: true })), ...run(u, 60)];
  assert.ok(ev2.some((x) => x.t === 'poppa'));
  assert.ok(ev2.some((x) => x.t === 'sfondato'));
  assert.equal(dati(ev2, 'nemico')[0], Math.round(rh.arma.danno * rh.arma.caricaMolt * (1 + P.danno) - 12));
  assert.ok(e.x > x0 + 3.5, 'respinta');
  assert.equal(u.hero.brezza, 0, 'consumata');
});

test('diga: porta sigillata — senza il Portale del Vuoto completato non si entra, dopo sì', () => {
  const lot = newLot('p', 0, null), h = heroOf(lot);
  assert.throws(() => startDungeon({ ...lot, hero: { ...h, completati: ['drenaggio', 'archivio', 'fucina', 'mausoleo'] } }, 'diga', 1, 1000), /sigillata/);
  const aperto = startDungeon({ ...lot, hero: { ...h, completati: ['mausoleo', 'vuoto'] } }, 'diga', 1, 1000);
  assert.equal(aperto.dungeon?.pending?.dungeon, 'diga');
});

test('diga: una partita col pilota automatico si rigioca uguale (ruote, risacca, rottami, fucili e barili); dalla lanterna del Timone anche il Capitano', () => {
  const s = nuovo(leggenda(), 1), log: DungeonInput[] = [], rng = createRng(1);
  const visti = new Set<string>();
  for (let i = 0; i < 9000 && !s.done; i++) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(['valvola', 'asciutto', 'sparo', 'bomba', 'rottami'].every((t) => visti.has(t)), [...visti].join(','));
  const r = replayDungeon(1, 'diga', leggenda(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');
  const t = nuovo(leggenda(), 4, 1), log2: DungeonInput[] = [], rng2 = createRng(4), visti2 = new Set<string>();
  while (!t.done && !t.enemies.find((e) => e.capo)!.fase && t.tick < 20000) {
    const f = quantizeDungeon(dungeon.autopilot(t, rng2)); log2.push(f); dungeon.step(t, f);
    for (const e of t.eventi) visti2.add(e.t);
  }
  assert.ok(visti2.has('incastrato'), [...visti2].join(','));
  const r2 = replayDungeon(4, 'diga', leggenda(), packDungeon(log2), { partenza: 1 });
  assert.equal(r2.hash, dungeon.result(t).hash);
});
