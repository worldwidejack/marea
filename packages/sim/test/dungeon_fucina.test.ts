// Fucina a Pressione (Epopea della Regata, dungeon 3): colate di lava che respirano (crosta e lava a giro), la bruciatura e le cascate che
// la spengono, la chiusa che raffredda la Colata Maestra (per tutti, anche insieme e nel replay), Scintilla-Vapore che dà fuoco e si spegne
// nell'acqua, scia di fuoco della Fornace Semovente, scafandro del Golem-Palombaro (para da davanti, le valvole dietro), il Mastro
// Forgiatore (intoccabile acceso, si spegne caricando dentro una cascata, magma), porta sigillata finché non completi l'Archivio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import { dungeon, createPartyRun, stepParty } from '../src/dungeon/dungeon.ts';
import { cellOf, parseDungeon } from '../src/dungeon/map.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { grigliaDi } from '../src/dungeon/muove.ts';
import { statoLava } from '../src/dungeon/fuoco.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { SCOLO_TICKS } from '../src/dungeon/tuning.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { startDungeon } from '../src/rpg/run.ts';
import { newLot } from '../src/economy/actions.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { createRng } from '../src/rng.ts';
import { arena, heroBase, heroForte, inp, run } from './dungeon_util.ts';

const immortale = () => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 100 }, magie: [], magia: null });
const nuovo = (hero = immortale(), seed = 3): DungeonState => dungeon.create({ seed, dungeon: 'fucina', hero });
/** Nemici tutti addormentati e lontani: qui conta solo il posto. */
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
const cella = (s: DungeonState, cx: number, cz: number): void => { s.hero.x = (cx + 0.5) * 2; s.hero.z = (cz + 0.5) * 2; };
const colata = (s: DungeonState, n: number) => s.map.lave.find((v) => v.n === n)!;
/** Avanza finché la colata n non è nello stato voluto. */
function finoA(s: DungeonState, n: number, stato: string): void {
  for (let i = 0; i < 600 && statoLava(s, colata(s, n)).stato !== stato; i++) run(s, 1);
  assert.equal(statoLava(s, colata(s, n)).stato, stato);
}
/** Nemico sveglio e in caccia. */
function sveglio(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}

test('fucina: due colate che respirano, la Colata Maestra con la sua chiusa, otto cascate, porta sigillata dall’Archivio', () => {
  const d = dungeonDef('fucina'), m = parseDungeon(d);
  assert.equal(d.richiede, 'archivio');
  assert.equal(d.stile, 'fucina');
  assert.equal(d.difficolta, 5);
  assert.deepEqual(m.lave.map((v) => v.n), [1, 2]);
  for (const v of m.lave) for (const i of v.celle) assert.equal(m.solid[i], 0, 'sulla lava si cammina sempre');
  assert.deepEqual(m.bacini.map((b) => b.n), [1], 'la Colata Maestra è un bacino');
  for (const i of m.bacini[0]!.celle) { assert.equal(m.solid[i], 1, 'calda non si passa'); assert.equal(m.opaque[i], 0, 'ma ci si vede'); }
  assert.deepEqual(m.valvole.map((v) => v.n), [1], 'la chiusa è la sua valvola');
  assert.equal(m.getti.length, 8);
  for (const g of m.getti) assert.equal(m.solid[g.cz * m.w + g.cx], 0, 'sotto la cascata si cammina');
  assert.deepEqual(m.altari.find((a) => a.asciutti)?.asciutti, [1]);
  // il Mastro cammina attorno alle cascate: per lui sono muri
  const s = nuovo(), k = s.enemies.find((e) => e.capo)!;
  assert.equal(k.tipo, 'mastro_forgiatore');
  const g = grigliaDi(s, k);
  for (const c of m.getti) assert.equal(g.solid[c.cz * m.w + c.cx], 1);
  // negli altri dungeon niente lava né fuoco
  const a = dungeon.view(dungeon.create({ seed: 1, dungeon: 'archivio', hero: heroBase() }));
  assert.deepEqual([a.lave, a.fuochi, a.hero.brucia], [[], [], undefined]);
});

test('fucina: sulla lava che scorre si prende fuoco, sulla crosta no; prima di scorrere le crepe avvisano; il fuoco dura e brucia vita', () => {
  const s = nuovo();
  via(s);
  const c = colata(s, 1).celle[0]!, cx = c % s.map.w, cz = (c - cx) / s.map.w;
  finoA(s, 1, 'crosta');
  cella(s, cx, cz);
  run(s, 20);
  assert.equal(s.hero.brucia, 0, 'sulla crosta non si brucia');
  finoA(s, 1, 'avviso');
  assert.equal(dungeon.view(s).lave.find((v) => v.n === 1)!.stato, 'avviso');
  const v0 = s.hero.vita;
  let ev: DungeonState['eventi'] = [];
  for (let i = 0; i < 200 && !ev.some((e) => e.t === 'bruciato'); i++) ev = run(s, 1);
  assert.equal(statoLava(s, colata(s, 1)).stato, 'scorre');
  assert.ok(ev.some((e) => e.t === 'bruciato'));
  assert.equal(dungeon.view(s).hero.brucia, true);
  // si toglie dalla lava: brucia ancora un paio di secondi, poi si spegne da solo
  cella(s, cx - 2, cz);
  const ev2 = run(s, 60);
  assert.ok(s.hero.vita < v0 - colata(s, 1).dps * 0.9, `brucia: ${v0} → ${s.hero.vita}`);
  assert.ok(ev2.some((e) => e.t === 'colpo' && e.su === 'eroe'), 'numeri del fuoco');
  run(s, 120);
  assert.equal(s.hero.brucia, 0);
});

test('fucina: sotto una cascata il fuoco si spegne (e lì non riprende); la cascata non fa male', () => {
  const s = nuovo();
  via(s);
  s.hero.brucia = 300; s.hero.bruciaDps = 10;
  const g = s.map.getti[0]!;
  s.hero.x = g.x; s.hero.z = g.z;
  const v0 = s.hero.vita, ev = run(s, 2);
  assert.ok(ev.some((e) => e.t === 'estinto'));
  assert.equal(s.hero.brucia, 0);
  assert.equal(dungeon.view(s).hero.bagnato, true);
  // una chiazza di fuoco proprio sotto la cascata non attacca
  s.fuochi.push({ id: 999, x: g.x, z: g.z, r: 1, fine: s.tick + 600, durata: 600, dps: 9, secondi: 2 });
  run(s, 30);
  assert.equal(s.hero.brucia, 0);
  assert.ok(s.hero.vita >= v0 - 10);
});

test('fucina: la Scintilla-Vapore dà fuoco a chi colpisce, e sotto una cascata si spegne', () => {
  const s = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  sveglio(s, 'scintilla_vapore', s.hero.x + 4, s.hero.z);
  let ev: DungeonState['eventi'] = [];
  for (let i = 0; i < 600 && !ev.some((e) => e.t === 'bruciato'); i++) ev = run(s, 1);
  assert.ok(ev.some((e) => e.t === 'bruciato'), 'presa fuoco');
  assert.ok(s.hero.brucia > 0);
  // nella Fucina, sotto una cascata, la scintilla si spegne da sola
  const f = nuovo();
  via(f);
  const g = f.map.getti.find((x) => x.cz > 15)!;
  const sc = sveglio(f, 'scintilla_vapore', g.x, g.z);
  f.hero.x = g.x + 30; f.hero.z = g.z;
  const ev2 = run(f, 90);
  assert.equal(sc.st, 'morto');
  assert.ok(ev2.some((e) => e.t === 'morte' && e.id === sc.id));
  assert.equal(enemyDef('scintilla_vapore').kind, 'mostro', 'scarto della macchina: l’argento fa ×2');
});

test('fucina: la Fornace Semovente lascia una scia di fuoco che brucia chi ci passa, e poi si spegne', () => {
  const s = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  s.hero.x = 6; s.hero.z = 14;
  const f = sveglio(s, 'fornace_semovente', 32, 14);
  run(s, 120);
  assert.ok(s.fuochi.length >= 3, `chiazze: ${s.fuochi.length}`);
  assert.ok(s.fuochi.every((c) => c.x > f.x - 0.1), 'dietro di lei');
  assert.equal(dungeon.view(s).fuochi.length, s.fuochi.length);
  // l'eroe in una chiazza prende fuoco
  const c = s.fuochi[0]!;
  f.st = 'dorme'; f.x = 3; f.z = 3; s.hero.x = c.x; s.hero.z = c.z;
  const ev = run(s, 2);
  assert.ok(ev.some((e) => e.t === 'bruciato'));
  // dopo la sua durata la chiazza non c'è più
  run(s, Math.round(enemyDef('fornace_semovente').scia!.durata * 60) + 2);
  assert.ok(!s.fuochi.some((x) => x.id === c.id));
});

test('fucina: lo scafandro del Golem-Palombaro para da davanti; alle spalle le valvole prendono di più; si gira piano', () => {
  const s = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  const g = sveglio(s, 'golem_palombaro', 20, 14);
  g.fx = -1; g.fz = 0; // guarda verso ovest
  // da davanti (eroe a ovest): parato
  s.hero.x = 18.2; s.hero.z = 14; s.hero.fx = 1; s.hero.fz = 0;
  const v0 = g.vita;
  let ev = run(s, 1, inp({ a: true }));
  ev = ev.concat(run(s, 60));
  assert.equal(g.vita, v0, 'davanti non entra niente');
  assert.ok(ev.some((e) => e.t === 'parato' && e.perche === 'scafandro'));
  // da dietro (eroe a est, il golem guarda ancora quasi a ovest): danno × 1,5
  const s2 = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } })), s3 = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } }));
  const dietro = sveglio(s2, 'golem_palombaro', 20, 14), fianco = sveglio(s3, 'golem_palombaro', 20, 14);
  dietro.fx = -1; dietro.fz = 0; fianco.fx = 0; fianco.fz = 1; // fianco: l'eroe gli sta a destra
  for (const [st, e] of [[s2, dietro], [s3, fianco]] as const) { st.hero.x = 21.8; st.hero.z = 14; st.hero.fx = -1; st.hero.fz = 0; e.cdTiro = 999; run(st, 1, inp({ a: true })); }
  run(s2, 40); run(s3, 40);
  const dDietro = dietro.max - dietro.vita, dFianco = fianco.max - fianco.vita;
  assert.ok(dFianco > 0, 'di fianco entra');
  assert.ok(Math.abs(dDietro - dFianco * 1.5) < 0.01, `dietro × 1,5: ${dDietro} contro ${dFianco}`);
  // si gira piano: in mezzo secondo non arriva a guardare chi gli sta alle spalle
  const s4 = arena(heroBase({ max: { vita: 1e6, magicka: 100, stamina: 100 } })), p = sveglio(s4, 'golem_palombaro', 20, 14);
  p.fx = -1; p.fz = 0; s4.hero.x = 22; s4.hero.z = 14;
  run(s4, 30);
  assert.ok(p.fx < 0.2, `si è girato troppo in fretta: ${p.fx}`);
  assert.equal(p.st, 'insegue', 'non attacca chi gli sta dietro');
  run(s4, 150);
  assert.ok(p.fx > 0.8, 'alla fine si gira');
});

/** Il Mastro Forgiatore nell'Altoforno, sveglio; gli altri nemici via. */
function altoforno(hero = immortale()): { s: DungeonState; k: Enemy } {
  const s = nuovo(hero, 9);
  const k = s.enemies.find((e) => e.capo)!;
  for (const e of s.enemies) if (e !== k) { e.st = 'dorme'; e.x = -100; e.z = -100; }
  k.aggro = true; k.st = 'insegue';
  return { s, k };
}

test('fucina: il Mastro acceso è intoccabile; caricando dentro una cascata si spegne, prende danni (doppi) e poi si riaccende', () => {
  const { s, k } = altoforno();
  // acceso: parato
  s.hero.x = k.x - 2.5; s.hero.z = k.z; s.hero.fx = 1; s.hero.fz = 0; k.cdTiro = 999;
  const ev0 = run(s, 1, inp({ a: true })).concat(run(s, 40));
  assert.equal(k.vita, k.max);
  assert.ok(ev0.some((e) => e.t === 'parato' && e.perche === 'fornace'));
  // carica verso l'eroe con la cascata (27,2) in mezzo: lui a est della cascata, l'eroe a ovest
  const g = s.map.getti.find((x) => x.cx === 27 && x.cz === 2)!;
  run(s, 60); // finisce il colpo da vicino che stava preparando
  k.x = g.x + 7; k.z = g.z; k.st = 'insegue'; k.stT = 0; k.attacchi = 0; k.cdTiro = 0; k.modo = undefined;
  s.hero.x = g.x - 3; s.hero.z = g.z;
  let ev: DungeonState['eventi'] = [];
  const fase = (): string => k.st;
  for (let i = 0; i < 60 && fase() !== 'prepara'; i++) run(s, 1);
  assert.equal(k.modo, 'carica');
  assert.ok(dungeon.view(s).nemici.find((n) => n.id === k.id)!.mira, 'linea d’avviso della carica');
  for (let i = 0; i < 200 && !ev.some((e) => e.t === 'spento'); i++) ev = run(s, 1);
  assert.ok(ev.some((e) => e.t === 'spento'), 'spento dalla cascata');
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === k.id)!.spento, true);
  // spento: prende danni, doppi (8 di armatura, poi × 2)
  const v1 = k.vita;
  s.hero.x = k.x - 2.4; s.hero.z = k.z; s.hero.fx = 1; s.hero.fz = 0;
  run(s, 1, inp({ a: true })); run(s, 40);
  assert.ok(Math.abs(v1 - k.vita - (10 - 8) * 2) < 0.01, `danno ${v1 - k.vita}`);
  // poi si riaccende
  const ev2 = run(s, Math.round(enemyDef('mastro_forgiatore').forgiatore!.spento * 60) + 5);
  assert.ok(ev2.some((e) => e.t === 'riacceso'));
  assert.equal(k.spento, false);
});

test('fucina: il Mastro non entra da sé nelle cascate; con l’eroe sotto la cascata non carica ma tira il magma, che lascia una pozza', () => {
  const { s, k } = altoforno();
  const g = s.map.getti.find((x) => x.cx === 37 && x.cz === 6)!;
  s.hero.x = g.x; s.hero.z = g.z; // l'eroe sotto la cascata
  k.x = g.x - 10; k.z = g.z; k.attacchi = 0; k.cdTiro = 0; // al suo turno toccherebbe la carica
  const modi = new Set<string>();
  let ev: DungeonState['eventi'] = [];
  for (let i = 0; i < 60 * 8; i++) {
    const e = run(s, 1);
    ev = ev.concat(e);
    if (k.st === 'prepara' && k.modo) modi.add(k.modo);
    const dx = k.x - g.x, dz = k.z - g.z;
    assert.ok(Math.sqrt(dx * dx + dz * dz) > 1.9, 'camminando non entra nella cascata');
  }
  assert.ok(!modi.has('carica'), `ha caricato contro la cascata: ${[...modi]}`);
  assert.ok(modi.has('magma'), `modi: ${[...modi]}`);
  assert.ok(ev.some((e) => e.t === 'magma'));
  // fuori dall'acqua, la palla di magma lascia la pozza che brucia
  const { s: s2, k: k2 } = altoforno();
  s2.hero.x = k2.x - 9; s2.hero.z = k2.z; k2.attacchi = 1; k2.cdTiro = 0; // tocca il magma
  let ev2: DungeonState['eventi'] = [];
  for (let i = 0; i < 300 && !ev2.some((e) => e.t === 'magma'); i++) ev2 = run(s2, 1, inp());
  assert.ok(ev2.some((e) => e.t === 'magma'));
  assert.ok(s2.fuochi.length >= 1, 'pozza di magma');
  assert.ok(dungeon.view(s2).geyser.every((x) => x.magma));
});

test('fucina: A sulla chiusa raffredda la Colata Maestra (per tutti, anche insieme); dalla lanterna dell’Anticamera è già fredda', () => {
  const s = nuovo();
  via(s);
  const v = s.map.valvole[0]!;
  s.hero.x = v.x; s.hero.z = v.z;
  assert.equal(dungeon.view(s).vicinoValvola, true);
  const ev = run(s, 1, inp({ a: true }));
  assert.ok(ev.some((e) => e.t === 'valvola' && e.n === 1));
  assert.equal(s.hero.act, 'idle', 'la A ha aperto la chiusa, non ha attaccato');
  const ev2 = run(s, SCOLO_TICKS + 1);
  assert.ok(ev2.some((e) => e.t === 'asciutto' && e.n === 1));
  assert.ok(s.map.bacini[0]!.celle.every((i) => s.map.solid[i] === 0), 'fredda: si passa');
  // insieme: la chiusa aperta da uno vale per l'altro
  const p = createPartyRun({ seed: 2, dungeon: 'fucina', eroi: [{ hero: immortale() }, { hero: immortale() }] });
  via(p);
  p.eroi[1]!.hero.x = v.x; p.eroi[1]!.hero.z = v.z;
  stepParty(p, [inp(), inp({ a: true })]);
  assert.equal(p.bacini[0]!.aperta, true);
  // ripartendo dall'Anticamera la Colata è già fredda, dalla Sala delle Presse no
  const m = parseDungeon(dungeonDef('fucina'));
  const anti = m.altari.findIndex((a) => a.asciutti?.includes(1)), presse = m.altari.findIndex((a) => !a.asciutti);
  const s3 = dungeon.create({ seed: 4, dungeon: 'fucina', hero: immortale(), partenza: anti });
  assert.equal(dungeon.view(s3).acque[0]!.livello, 0);
  const s4 = dungeon.create({ seed: 4, dungeon: 'fucina', hero: immortale(), partenza: presse });
  assert.equal(dungeon.view(s4).acque[0]!.livello, 1);
  assert.ok(s4.map.bacini[0]!.celle.every((i) => s4.map.solid[i] === 1));
  assert.equal(cellOf(s3.map, s3.hero.x, s3.hero.z), m.altari[anti]!.cz * m.w + m.altari[anti]!.cx);
});

test('fucina: porta sigillata — senza l’Archivio completato non si entra, dopo sì', () => {
  const lot = newLot('p', 0, null);
  const h = heroOf(lot);
  assert.throws(() => startDungeon({ ...lot, hero: { ...h, completati: ['drenaggio'] } }, 'fucina', 1, 1000), /sigillata/);
  const aperto = startDungeon({ ...lot, hero: { ...h, completati: ['drenaggio', 'archivio'] } }, 'fucina', 1, 1000);
  assert.equal(aperto.dungeon?.pending?.dungeon, 'fucina');
});

test('fucina: una partita col pilota automatico si rigioca uguale (lava, chiusa, fuoco, cascate e il Mastro spento nel replay)', () => {
  const s = nuovo(heroForte(), 1), log: DungeonInput[] = [], rng = createRng(1);
  const visti = new Set<string>();
  while (!s.done) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.ok(['valvola', 'asciutto', 'bruciato', 'spento', 'riacceso'].every((t) => visti.has(t)), [...visti].join(','));
  assert.equal(dungeon.result(s).capo, true, 'il pilota spegne il Mastro sotto le cascate e lo batte');
  const r = replayDungeon(1, 'fucina', heroForte(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');
});
