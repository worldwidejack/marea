// Archivio Navigazionale (Epopea della Regata, dungeon 2): correnti d'aria a raffiche con i ripari dietro gli scaffali, la tempesta del
// Condotto Maestro fermata dal timone (per tutti, anche insieme e nel replay), Drone Idro-Ragno sulle grate con l'arpione, Aerostato-Spia
// che vola e sgancia bombe, Archivista a Molla a zig-zag che si ricarica, l'Astrolabio Impazzito (rosa dei venti, raffica, raggio, anelli),
// porta sigillata finché non completi il Drenaggio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeonDef } from '@marea/content/rpg.ts';
import { dungeon, createPartyRun, stepParty } from '../src/dungeon/dungeon.ts';
import { cellOf, isSolid, parseDungeon } from '../src/dungeon/map.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { statoVento } from '../src/dungeon/vento.ts';
import { alto, schermato } from '../src/dungeon/muove.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { startDungeon } from '../src/rpg/run.ts';
import { newLot } from '../src/economy/actions.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { createRng } from '../src/rng.ts';
import { arena, heroBase, heroForte, inp, run } from './dungeon_util.ts';

const immortale = () => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 100 }, magie: [], magia: null });
const nuovo = (hero = immortale(), seed = 3): DungeonState => dungeon.create({ seed, dungeon: 'archivio', hero });
/** Nemici tutti addormentati e lontani: qui conta solo il vento. */
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
const cella = (s: DungeonState, cx: number, cz: number): void => { s.hero.x = (cx + 0.5) * 2; s.hero.z = (cz + 0.5) * 2; };
const corrente = (s: DungeonState, n: number) => s.map.venti.find((v) => v.n === n)!;
/** Avanza finché la corrente n non è nello stato voluto. */
function finoA(s: DungeonState, n: number, stato: string): void {
  for (let i = 0; i < 600 && statoVento(s, corrente(s, n)).stato !== stato; i++) run(s, 1);
  assert.equal(statoVento(s, corrente(s, n)).stato, stato);
}

test('archivio: tre correnti (gallerie a raffiche, Condotto Maestro sempre in tempesta), un timone, grate, porta sigillata dal Drenaggio', () => {
  const d = dungeonDef('archivio'), m = parseDungeon(d);
  assert.equal(d.richiede, 'drenaggio');
  assert.equal(d.stile, 'archivio');
  assert.deepEqual(m.venti.map((v) => [v.n, v.dx, v.dz]), [[1, -1, 0], [2, 0, 1], [3, 0, 1]], 'tutte soffiano verso l’uscita');
  assert.ok(m.venti.every((v) => v.celle.length >= 10));
  assert.equal(m.venti.find((v) => v.n === 3)!.pausa, 0, 'il Condotto non si ferma da solo');
  assert.deepEqual(m.timoni.map((t) => t.n), [3]);
  assert.ok(m.grate.length >= 12);
  for (const i of m.grate) { assert.equal(m.solid[i], 1, 'sulla grata non si cammina'); assert.equal(m.opaque[i], 0, 'ma ci si vede attraverso'); }
  assert.ok(m.nemici.filter((n) => n.tipo === 'idro_ragno').every((n) => m.grata[n.cz * m.w + n.cx]), 'i ragni partono sulle grate');
  const lan = m.altari.find((a) => a.ferme);
  assert.deepEqual(lan?.ferme, [3]);
  // negli altri dungeon niente vento
  const g = dungeon.view(dungeon.create({ seed: 1, dungeon: 'drenaggio', hero: heroBase() }));
  assert.deepEqual([g.venti, g.timoni, g.vicinoTimone], [[], [], false]);
});

test('archivio: la raffica spinge verso l’uscita, nella calma no; dietro uno scaffale si è al riparo', () => {
  const s = nuovo();
  via(s);
  finoA(s, 1, 'soffia');
  cella(s, 22, 23);
  const x0 = s.hero.x;
  run(s, 20);
  assert.ok(s.hero.x < x0 - 1, `spinto a ovest: ${x0} → ${s.hero.x}`);
  assert.equal(dungeon.view(s).hero.vento, true);
  // al riparo: la cella a ovest dello scaffale (23,24)
  finoA(s, 1, 'calma'); finoA(s, 1, 'soffia');
  cella(s, 22, 24);
  const r0 = { x: s.hero.x, z: s.hero.z };
  run(s, 20);
  assert.deepEqual({ x: s.hero.x, z: s.hero.z }, r0, 'dietro lo scaffale non si muove');
  assert.equal(dungeon.view(s).hero.riparo, true);
  // nella calma si sta fermi (e prima della raffica le carte avvisano)
  finoA(s, 1, 'calma');
  cella(s, 21, 23);
  const c0 = s.hero.x;
  run(s, 10);
  assert.equal(s.hero.x, c0);
  finoA(s, 1, 'avviso');
  assert.equal(dungeon.view(s).venti.find((v) => v.n === 1)!.stato, 'avviso');
});

test('archivio: contro la tempesta del Condotto non si passa; A sul timone la ferma per tutti e poi si sale', () => {
  const s = nuovo();
  via(s);
  cella(s, 38, 20);
  run(s, 60 * 6, inp({ my: -1, b: true }));
  assert.ok(Math.floor(s.hero.z / 2) >= 17, `ancora in fondo al Condotto: ${s.hero.z / 2}`);
  const t = s.map.timoni[0]!;
  s.hero.x = t.x; s.hero.z = t.z;
  assert.equal(dungeon.view(s).vicinoTimone, true);
  const ev = run(s, 1, inp({ a: true }));
  assert.ok(ev.some((e) => e.t === 'timone' && e.n === 3));
  assert.equal(s.hero.act, 'idle', 'la A ha girato il timone, non ha attaccato');
  assert.equal(dungeon.view(s).venti.find((v) => v.n === 3)!.stato, 'ferma');
  cella(s, 38, 20);
  run(s, 60 * 7, inp({ my: -1 }));
  assert.ok(Math.floor(s.hero.z / 2) <= 13, `nell'Anticamera: ${s.hero.z / 2}`);
  // insieme: il timone girato da uno ferma il Condotto anche per l'altro
  const p = createPartyRun({ seed: 2, dungeon: 'archivio', eroi: [{ hero: immortale() }, { hero: immortale() }] });
  via(p);
  p.eroi[1]!.hero.x = t.x; p.eroi[1]!.hero.z = t.z;
  stepParty(p, [inp(), inp({ a: true })]);
  assert.equal(p.correnti.find((c) => c.n === 3)!.ferma, true);
});

test('archivio: ripartendo dalla lanterna dell’Anticamera il Condotto è già fermo; dalla prima no', () => {
  const m = parseDungeon(dungeonDef('archivio'));
  const anti = m.altari.findIndex((a) => a.ferme?.includes(3)), prima = m.altari.findIndex((a) => !a.ferme);
  const s = dungeon.create({ seed: 4, dungeon: 'archivio', hero: immortale(), partenza: anti });
  assert.equal(dungeon.view(s).venti.find((v) => v.n === 3)!.stato, 'ferma');
  const s2 = dungeon.create({ seed: 4, dungeon: 'archivio', hero: immortale(), partenza: prima });
  assert.equal(dungeon.view(s2).venti.find((v) => v.n === 3)!.stato, 'soffia');
});

/** Nemico sveglio e in caccia nell'arena dei test. */
function sveglio(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}

test('archivio: l’arpione del Drone Idro-Ragno tira l’eroe verso il ragno', () => {
  const s = arena(heroBase({ max: { vita: 1000, magicka: 100, stamina: 100 } }));
  const r = sveglio(s, 'idro_ragno', s.hero.x + 8, s.hero.z);
  let ev: DungeonState['eventi'] = [], x0 = s.hero.x;
  for (let i = 0; i < 600 && !ev.some((e) => e.t === 'arpionato'); i++) { x0 = s.hero.x; ev = run(s, 1); }
  assert.ok(ev.some((e) => e.t === 'arpionato'), 'arpionato');
  run(s, 20);
  assert.ok(s.hero.x > x0 + 1.5, `tirato verso il ragno: ${x0} → ${s.hero.x} (ragno a ${r.x})`);
});

test('archivio: il Drone Idro-Ragno scappa sulle grate, dove l’eroe non arriva', () => {
  const s = nuovo(immortale(), 5);
  via(s);
  const m = s.map, g = m.grate.find((i) => m.grata[i - 1] && m.grata[i + 1])!; // in mezzo al tavolo delle rotte
  const gx = g % m.w, gz = (g - gx) / m.w;
  const r = sveglio(s, 'idro_ragno', (gx + 0.5) * 2, (gz + 0.5) * 2);
  // l'eroe gli sta accanto, sul pavimento sotto il tavolo
  let px = gx, pz = gz + 1;
  while (isSolid(m, px, pz)) pz++;
  cella(s, px, pz);
  run(s, 120);
  assert.ok(r.st !== 'morto');
  assert.equal(m.grata[cellOf(m, r.x, r.z)], 1, 'resta sulle grate');
});

test('archivio: l’Aerostato-Spia vola sopra le grate, in mischia non si prende finché non scende, e la sua bomba scoppia e spinge', () => {
  const s = arena(heroBase({ max: { vita: 1000, magicka: 100, stamina: 100 } }));
  const b = sveglio(s, 'aerostato_spia', s.hero.x + 4, s.hero.z);
  assert.equal(alto(s, b), true);
  // la lama gli passa sotto
  s.hero.fx = 1; s.hero.fz = 0; b.x = s.hero.x + 1.2; b.z = s.hero.z; b.cdTiro = 999;
  const v0 = b.vita;
  run(s, 1, inp({ a: true })); run(s, 60);
  assert.equal(b.vita, v0, 'alto: niente danno in mischia');
  // sgancia: cerchio d'avviso, poi la bomba scoppia sull'eroe fermo e lo spinge via
  b.cdTiro = 0; b.x = s.hero.x + 4;
  let ev: DungeonState['eventi'] = [];
  const x0 = s.hero.x;
  for (let i = 0; i < 300 && !ev.some((e) => e.t === 'bomba'); i++) ev = run(s, 1);
  assert.ok(ev.some((e) => e.t === 'bomba'), 'bomba');
  assert.ok(dungeon.view(s).geyser.length === 0 || dungeon.view(s).geyser.every((g) => g.bomba));
  run(s, 30);
  assert.ok(Math.abs(s.hero.x - x0) > 1, 'spinto dallo scoppio');
});

test('archivio: l’Archivista a Molla insegue a zig-zag e ogni 3 attacchi si ferma a ricaricare la molla', () => {
  const s = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  s.hero.x = 6; s.hero.z = 14;
  const a = sveglio(s, 'archivista_molla', 30, 14);
  let lato = 0;
  for (let i = 0; i < 90; i++) { run(s, 1); if (Math.abs(a.fz) > 0.3) lato++; }
  assert.ok(lato > 20, `scarta di lato: ${lato}`);
  let lunghi = 0, prima = 0;
  for (let i = 0; i < 60 * 30; i++) {
    run(s, 1);
    if (a.st === 'recupera' && a.stT === 1) { if (a.molla) lunghi++; else prima++; }
  }
  assert.ok(lunghi >= 2 && prima >= 2 * lunghi - 1, `ricariche ${lunghi}, recuperi normali ${prima}`);
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === a.id)!.molla ?? false, a.molla && a.st === 'recupera');
});

/** L'Astrolabio nell'Osservatorio, sveglio, e l'eroe a 6 m da lui; gli altri nemici via. */
function osservatorio(hero = immortale()): { s: DungeonState; k: Enemy } {
  const s = nuovo(hero, 9);
  const k = s.enemies.find((e) => e.capo)!;
  for (const e of s.enemies) if (e !== k) { e.st = 'dorme'; e.x = -100; e.z = -100; }
  s.hero.x = k.x - 6; s.hero.z = k.z;
  k.aggro = true; k.st = 'insegue';
  return { s, k };
}

test('archivio: l’Astrolabio gira rosa dei venti, raffica e raggio, e dopo ogni attacco si ricalibra basso (solo allora la mischia lo prende)', () => {
  const { s, k } = osservatorio();
  const visti: string[] = [];
  let rosa = 0, prep = '';
  for (let i = 0; i < 60 * 40 && visti.length < 4; i++) {
    const n0 = s.proj.filter((p) => p.tipo === 'vento_nemico').length;
    run(s, 1);
    const n1 = s.proj.filter((p) => p.tipo === 'vento_nemico').length;
    if (n1 - n0 >= 8) rosa++;
    if (k.st === 'prepara' && k.modo && k.modo !== prep) { prep = k.modo; visti.push(k.modo); }
    if (k.st !== 'prepara') prep = '';
    if (k.st === 'recupera') assert.equal(alto(s, k), false, 'ricalibra: basso');
    else assert.equal(alto(s, k), true);
  }
  assert.deepEqual(visti, ['rosa', 'raffica', 'rosa', 'raggio']);
  assert.ok(rosa >= 6, `salve della rosa: ${rosa}`);
});

test('archivio: la raffica fa volare via chi gli sta vicino (botta se sbatte contro il muro); il raggio prende sulla linea ma non dietro lo scaffale', () => {
  const { s, k } = osservatorio(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  // raffica: eroe a 3 m, verso il muro ovest (vicino)
  k.attacchi = 1; k.cdTiro = 0;
  s.hero.x = k.x - 3; s.hero.z = k.z;
  let ev: DungeonState['eventi'] = [];
  const d0 = Math.abs(s.hero.x - k.x);
  for (let i = 0; i < 200 && !ev.some((e) => e.t === 'raffica'); i++) ev = run(s, 1);
  run(s, 30);
  assert.ok(Math.abs(s.hero.x - k.x) > d0 + 3, 'volato via');
  // raggio: mira presa all'inizio; chi resta sulla linea è preso
  for (let i = 0; i < 600 && !(k.st === 'insegue'); i++) run(s, 1);
  k.attacchi = 3; k.cdTiro = 0; k.x = 64; k.z = 9; // in mezzo all'Osservatorio
  s.hero.x = 58; s.hero.z = 9;
  for (let i = 0; i < 60 && k.st !== 'prepara'; i++) run(s, 1);
  assert.equal(k.modo, 'raggio');
  assert.ok(dungeon.view(s).nemici.find((n) => n.id === k.id)!.mira, 'linea d’avviso');
  const v0 = s.hero.vita;
  ev = [];
  for (let i = 0; i < 120 && !ev.some((e) => e.t === 'raggio'); i++) ev = run(s, 1);
  assert.ok(s.hero.vita < v0 - 10, 'preso dal raggio');
  // dietro lo scaffale (27,6): la mira la prende quando ti vede, poi ti nascondi dietro lo scaffale sulla stessa linea
  for (let i = 0; i < 600 && k.st !== 'insegue'; i++) run(s, 1);
  k.attacchi = 3; k.cdTiro = 0; k.x = (31 + 0.5) * 2; k.z = (6 + 0.5) * 2;
  cella(s, 29, 6);
  for (let i = 0; i < 60 && k.st !== 'prepara'; i++) run(s, 1);
  const v1 = s.hero.vita;
  ev = [];
  for (let i = 0; i < 120 && !ev.some((e) => e.t === 'raggio'); i++) { cella(s, 25, 6); ev = run(s, 1); }
  assert.ok(ev.some((e) => e.t === 'raggio'));
  assert.ok(s.hero.vita >= v1 - 1, 'lo scaffale ferma il raggio');
});

test('archivio: sotto metà vita l’Astrolabio stacca 4 anelli-scudo; finché ce n’è uno è intoccabile, rotti tutti torna a prendere danni', () => {
  const { s, k } = osservatorio();
  k.vita = k.max * 0.49;
  run(s, 1);
  const anelli = s.enemies.filter((e) => e.padre === k.id);
  assert.equal(anelli.length, 4);
  assert.ok(schermato(s, k));
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === k.id)!.schermo, true);
  // girano attorno a lui (a 2,6 m)
  const a = anelli[0]!, p0 = { x: a.x, z: a.z };
  run(s, 30);
  assert.ok(Math.abs(Math.sqrt((a.x - k.x) ** 2 + (a.z - k.z) ** 2) - 2.6) < 0.01 && (a.x !== p0.x || a.z !== p0.z));
  // una freccia (magia senza esplosione) sull'Astrolabio: parato
  const v = k.vita;
  s.proj.push({ id: 9999, tipo: 'magia', x: k.x - 1.5, y: 1.2, z: k.z, vx: 12, vy: 0, vz: 0, g: 0, danno: 50, life: 60, traits: {}, raggio: 0, colpiti: [], dalNemico: false, contundente: false, magico: true, arrowId: null });
  let ev: DungeonState['eventi'] = [];
  for (let i = 0; i < 20 && !ev.some((e) => e.t === 'parato' || e.t === 'colpo'); i++) ev = run(s, 1);
  if (ev.some((e) => e.t === 'colpo' && e.su === 'nemico' && e.id === k.id)) assert.fail('l’Astrolabio schermato ha preso danno');
  assert.ok(k.vita >= v - 1e-9);
  for (const x of anelli) { x.vita = 0; x.st = 'morto'; }
  assert.equal(schermato(s, k), false);
});

test('archivio: porta sigillata — senza il Drenaggio completato non si entra, dopo sì', () => {
  const lot = newLot('p', 0, null);
  assert.throws(() => startDungeon(lot, 'archivio', 1, 1000), /sigillata/);
  const h = heroOf(lot);
  const fatto = { ...lot, hero: { ...h, completati: ['drenaggio'] } };
  const aperto = startDungeon(fatto, 'archivio', 1, 1000);
  assert.equal(aperto.dungeon?.pending?.dungeon, 'archivio');
  assert.doesNotThrow(() => startDungeon(lot, 'drenaggio', 1, 1000), 'il Drenaggio resta aperto a tutti');
});

test('archivio: una partita col pilota automatico si rigioca uguale (vento, timone, grate, bombe, anelli nel replay)', () => {
  const s = nuovo(heroForte(), 7), log: DungeonInput[] = [], rng = createRng(7);
  const visti = new Set<string>();
  for (let t = 0; t < 60 * 60 * 3 && !s.done; t++) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(visti.has('timone') && visti.has('arpionato') && visti.has('bomba'), [...visti].join(','));
  const r = replayDungeon(7, 'archivio', heroForte(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');
});
