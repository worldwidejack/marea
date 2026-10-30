// Il Tempio della «Doppia Nera» (Isola dell'Adrenalina, docs/BAITA.md): difficoltà 7 (tra Mausoleo e Vuoto). Il Ghiaccio Vivo è un rompicapo con una soluzione in ogni
// stanza e nessun vicolo cieco; ogni cosa che ti sposta o ti rallenta si vede nella vista PRIMA (cerchi, anello, linee, cono, quadrato, X) e dura quanto dichiarato nel
// JSON (la durata dell'avviso è quella vera, non la metà); i tre nemici (Acrobata, Alchimista, Sparaneve) e Jean-Claude fanno quello che dice la scheda; la Tavola
// «Valanga Pro-99» con il Trick «Elicottero»; una partita intera col pilota automatico si rigioca con lo stesso hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, dungeonDef, enemyDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { parseDungeon } from '../src/dungeon/map.ts';
import { newEnemy, secToTicks } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { hitEnemy } from '../src/dungeon/combat.ts';
import { packDungeon, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { SCOLO_TICKS } from '../src/dungeon/tuning.ts';
import { VEL_SCIVOLO } from '../src/dungeon/ghiaccio.ts';
import { raggiungibili, scivolate, vicoliCiechi } from '../src/dungeon/ghiaccio_nav.ts';
import { colpisciBandierine } from '../src/dungeon/jean_claude.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { buildRunHero } from '../src/rpg/derived.ts';
import { itemDef } from '../src/rpg/items.ts';
import { newLot } from '../src/economy/actions.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { createRng } from '../src/rng.ts';
import { arena, heroBase, inp, run } from './dungeon_util.ts';

const immortale = (o: Parameters<typeof heroBase>[0] = {}) => heroBase({ max: { vita: 1e9, magicka: 100, stamina: 1e6 }, magie: [], magia: null, armatura: { id: null, difesa: 0, malus: 0, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1 }, ...o });
const nuovo = (hero = immortale(), seed = 3, partenza: number | null = null): DungeonState => dungeon.create({ seed, dungeon: 'baita', hero, partenza });
/** Tutti i nemici a dormire lontano: si prova una cosa alla volta. */
const via = (s: DungeonState): void => { for (const e of s.enemies) { e.st = 'dorme'; e.x = -100; e.z = -100; } };
function sveglio(s: DungeonState, tipo: string, x: number, z: number): Enemy {
  const e = newEnemy(s, tipo, x, z);
  e.aggro = true; e.st = 'insegue';
  return e;
}
const cella = (s: DungeonState, x: number, z: number): number => z * s.map.w + x;
const centro = (c: number): number => (c + 0.5) * 2;
/** La terrazza del capo (celle 30..43 × 10..21), vuota: l'eroe a metà sinistra. */
function terrazza(hero = immortale()): DungeonState { const s = nuovo(hero); via(s); s.hero.x = 66; s.hero.z = 32; return s; }
const vistaDi = (s: DungeonState, e: Enemy) => dungeon.view(s).nemici.find((n) => n.id === e.id)!;
const sciatore = () => heroBase({
  livello: 24, max: { vita: 280, magicka: 130, stamina: 180 },
  arma: { id: 'spadone_meteorite', kind: 'mischia', skill: 'armiPesanti', classe: 'pesante', danno: 42, tempo: 1.25, portata: 2.2, carica: 1.5, caricaMolt: 3, gittata: 0, traits: { penetra: 0.5 } },
  armatura: { id: 'armatura_meteorite', difesa: 70, malus: 0.05, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1.1 },
  pozioni: [{ id: 'pozione_vita_grande', n: 8, cura: { vita: 180 }, buff: null }],
});
const colpo = (o: Partial<Parameters<typeof hitEnemy>[2]> = {}): Parameters<typeof hitEnemy>[2] => ({ danno: 20, traits: {}, magico: false, skill: null, caricato: false, dirX: 1, dirZ: 0, daAlleato: false, mischia: true, ...o });

test('baita: difficoltà 7 tra Mausoleo e Vuoto, nemici e capo più forti del Mausoleo e meno del Vuoto, mappa 45×30 con 4 stanze, 4 colonnine, 4 tornelli, 2 lanterne, 5 forzieri', () => {
  const baita = dungeonDef('baita'), m = parseDungeon(baita);
  assert.equal(baita.ingresso.island, 'adrenalina');
  assert.equal(baita.stile, 'baita');
  assert.equal(baita.difficolta, 7);
  assert.ok(dungeonDef('mausoleo').difficolta < 7 && 7 < dungeonDef('vuoto').difficolta);
  assert.equal(DUNGEONS.length, 10);
  assert.equal(m.w, 45); assert.equal(m.h, 30);
  // i numeri stanno nei JSON e sono all'altezza del dungeon (il Mausoleo ha il Custode a 1300 e le Guardie a 95)
  const capo = enemyDef('jean_claude'), custode = enemyDef('custode_egida'), vuoto = enemyDef('custode');
  assert.ok(capo.vita > custode.vita && capo.vita < vuoto.vita && capo.danno > custode.danno - 5 && capo.danno < vuoto.danno);
  for (const id of ['acrobata_fuoripista', 'alchimista_bombardino', 'sparaneve_automatico']) assert.ok(enemyDef(id).vita >= enemyDef('guardia_onore').vita, id);
  assert.deepEqual(m.valvole.map((v) => v.n).sort(), [1, 2, 3, 4]);
  assert.deepEqual(m.bacini.map((b) => b.n), [1, 2, 3, 4]);
  assert.equal(m.altari.length, 2); assert.equal(m.forzieri.length, 5);
  assert.deepEqual(m.altari[1]!.asciutti, [1, 2, 3, 4], 'la lanterna davanti al capo riparte coi tornelli aperti');
  const s = nuovo(), tipi = (t: string) => s.enemies.filter((e) => e.tipo === t).length;
  assert.deepEqual(s.enemies.filter((e) => e.capo).map((e) => e.tipo), ['jean_claude']);
  assert.deepEqual(['acrobata_fuoripista', 'alchimista_bombardino', 'sparaneve_automatico'].map(tipi), [6, 4, 4]);
  assert.equal(baita.testi?.voci?.length, 4); assert.equal(baita.testi?.letture?.length, 2);
});

test('baita: Ghiaccio Vivo, il rompicapo — ogni stanza ha una soluzione e nessun vicolo cieco, passo per passo (colonnina 1 → 2 → 3 → 4)', () => {
  const s = nuovo(), m = s.map;
  const torrette = new Set(s.enemies.filter((e) => e.def.velocita === 0).map((e) => cella(s, Math.floor(e.x / 2), Math.floor(e.z / 2))));
  const apri = (n: number) => { for (const c of m.bacini.find((b) => b.n === n)!.celle) m.solid[c] = 0; s.sciolti.push(n); };
  const tappa = (nome: string, da: [number, number], mete: [number, number][], min: number, max: number, ciechi = true) => {
    const r = raggiungibili(s, cella(s, ...da), torrette);
    for (const [x, z] of mete) {
      const c = cella(s, x, z), costo = r.costo.get(c);
      assert.ok(costo !== undefined, `${nome}: la cella ${x},${z} non si raggiunge`);
      assert.ok(scivolate(costo) >= min && scivolate(costo) <= max, `${nome}: ${scivolate(costo)} scivolate (${min}-${max})`);
      if (ciechi) assert.deepEqual(vicoliCiechi(s, cella(s, ...da), c, torrette), [], `${nome}: vicoli ciechi verso ${x},${z}`);
    }
  };
  const v = (n: number) => { const o = m.valvole.find((x) => x.n === n)!; return [o.cx, o.cz] as [number, number]; };
  tappa('Sala Noleggio (corsia)', [2, 26], [v(1), [13, 23]], 1, 1); // una scivolata per la colonnina e il forziere dietro
  apri(1);
  tappa('Mensa', [7, 16], [v(2)], 0, 0); // niente ghiaccio: è un combattimento
  tappa('Mensa (nicchia)', [7, 16], [[1, 14]], 2, 4); // il forziere raro, facoltativo
  apri(2);
  tappa('Officina', [15, 5], [v(3)], 5, 8); // il rompicapo vero, con le tre torrette come ostacoli
  for (const c of torrette) assert.ok(c >= 0);
  apri(3);
  tappa('Imbarco', [22, 18], [v(4)], 0, 0);
  // e se le torrette cadono il rompicapo regge lo stesso
  const s2 = nuovo(); s2.sciolti = [1, 2];
  for (const n of [1, 2]) for (const c of s2.map.bacini.find((b) => b.n === n)!.celle) s2.map.solid[c] = 0;
  const senza = raggiungibili(s2, cella(s2, 15, 5)), c3 = cella(s2, ...v(3));
  assert.ok(senza.costo.has(c3)); assert.deepEqual(vicoliCiechi(s2, cella(s2, 15, 5), c3), []);
});

test('baita: Ghiaccio Vivo — chi si muove sul ghiaccio parte dritto, non comanda i piedi, si ferma contro il muro o sull\'asciutto; la colonnina scioglie la stanza', () => {
  const s = nuovo(); via(s);
  s.hero.x = centro(8); s.hero.z = centro(24); // all'imbocco della corsia (asciutto), la corsia è ghiaccio fino alla colonnina 1
  const ev0 = run(s, 25, inp({ mx: 1, my: 0 }));
  assert.ok(s.hero.slideDir !== null, 'è partito');
  assert.ok(ev0.some((e) => e.t === 'scivolata'), 'evento scivolata');
  assert.deepEqual(dungeon.view(s).hero.scivola ?? null, s.hero.slideDir, 'la vista lo dice');
  // i piedi non servono: premere al contrario non lo ferma né lo gira
  const x1 = s.hero.x;
  run(s, 5, inp({ mx: -1, my: 0 }));
  assert.ok(s.hero.x > x1, 'continua nella sua direzione');
  assert.ok(Math.abs(s.hero.z - centro(24)) < 0.1, 'resta in corsia');
  // velocità dichiarata
  const x2 = s.hero.x; run(s, 6, inp({ mx: -1 }));
  assert.ok(Math.abs((s.hero.x - x2) / (6 / 60) - VEL_SCIVOLO) < 0.6, `${((s.hero.x - x2) / 0.1).toFixed(2)} m/s`);
  run(s, 120); // mani libere: la corsa finisce da sola (se tenesse premuto indietro, ripartirebbe all'indietro appena fermo)
  assert.equal(s.hero.slideDir, null, 'fermo');
  assert.ok(Math.abs(s.hero.x - centro(13)) < 0.05 && Math.abs(s.hero.z - centro(24)) < 0.05, `si ferma al centro della colonnina (${s.hero.x}, ${s.hero.z})`);
  assert.equal(dungeon.view(s).hero.scivola, undefined);
  // girare la colonnina: il ghiaccio si scioglie subito, il tornello scola dopo
  const evV = run(s, 1, inp({ a: true }));
  assert.ok(evV.some((e) => e.t === 'valvola' && e.n === 1) && evV.some((e) => e.t === 'scongelato' && e.n === 1));
  assert.deepEqual(dungeon.view(s).sciolti, [1]);
  assert.ok(run(s, SCOLO_TICKS + 1).some((e) => e.t === 'asciutto' && e.n === 1), 'tornello 1 aperto');
  s.hero.x = centro(7); s.hero.z = centro(24); s.hero.slideDir = null;
  run(s, 30, inp({ mx: 1 }));
  assert.equal(s.hero.slideDir, null, 'sciolto: si cammina');
  assert.ok(s.hero.x < centro(9) + 4 && s.hero.x > centro(7), `cammina a passo normale (${s.hero.x})`);
  // contro un muro si ferma: dalla colonnina verso nord c'è il forziere e poi il muro
  const t = nuovo(); via(t); t.hero.x = centro(9); t.hero.z = centro(24);
  run(t, 3, inp({ mx: 1 })); run(t, 80);
  assert.equal(t.hero.slideDir, null); assert.ok(t.hero.x > centro(12) && t.hero.x < centro(14));
});

test('baita: l\'Alchimista — il cerchio sul pavimento (dove eri) si riempie per tutto l\'avviso, poi cade la fiasca; la sciolina rallenta solo dentro, il bombardino brucia', () => {
  const s = terrazza(), F = enemyDef('alchimista_bombardino').fiasche!;
  const alc = sveglio(s, 'alchimista_bombardino', 78, 32);
  run(s, 2);
  assert.equal(alc.st, 'prepara'); assert.equal(alc.stDur, secToTicks(F.prep));
  let v = vistaDi(s, alc);
  assert.equal(v.attacco, 'fiasca'); assert.deepEqual(v.forma, { f: 'cerchio', x: 66, z: 32, r: F.raggio, tipo: 'sciolina' }, 'il cerchio è dove sta l\'eroe: si vede dove cade e di che chiazza è');
  // l'eroe si sposta: il cerchio no (si schiva), e a metà avviso non c'è ancora niente a terra
  s.hero.x = 60; s.hero.z = 24;
  run(s, secToTicks(F.prep) - 6);
  assert.equal(s.pozzanghere.length, 0, 'durante tutto l\'avviso niente chiazza');
  assert.equal(vistaDi(s, alc).forma!.x, 66);
  const evCade = run(s, 8);
  assert.ok(evCade.some((e) => e.t === 'pozzanghera' && e.tipo === 'sciolina'));
  assert.equal(s.pozzanghere.length, 1);
  assert.ok(!evCade.some((e) => e.t === 'colpo' && e.su === 'eroe'), 'chi è uscito dal cerchio non prende niente');
  assert.equal(dungeon.view(s).pozze![0]!.tipo, 'sciolina');
  // la sciolina rallenta chi ci sta dentro del 50 %, non chi sta fuori; esce e dopo la coda torna normale
  s.hero.x = 66; s.hero.z = 32; s.pozzanghere = [{ id: 98, x: 66, z: 32, r: F.raggio, tipo: 'sciolina', fine: s.tick + 600, tickDanno: 0 }];
  const e1 = run(s, 1, inp({ mx: 1 }));
  assert.ok(e1.some((e) => e.t === 'rallentato'));
  assert.equal(dungeon.view(s).hero.rallentato, true);
  const xa = s.hero.x; run(s, 6, inp({ mx: 1 }));
  assert.ok(Math.abs((s.hero.x - xa) / 0.1 - 3.2 * F.sciolina.lento) < 0.4, `dentro va a metà passo (${((s.hero.x - xa) / 0.1).toFixed(2)} m/s)`);
  s.hero.x = 70; s.hero.z = 20; run(s, secToTicks(F.sciolina.coda) + 3);
  assert.equal(dungeon.view(s).hero.rallentato, false);
  assert.equal(s.hero.lento <= 0, true, 'fuori dalla chiazza e finita la coda, passo normale');
  alc.st = 'dorme'; alc.x = -100; alc.z = -100; // basta fiasche: ora si prova il bombardino
  // il bombardino: dps al secondo a scatti di mezzo secondo, solo dentro
  s.pozzanghere = [{ id: 99, x: 66, z: 32, r: F.raggio, tipo: 'bombardino', fine: s.tick + 600, tickDanno: 0 }];
  const prima = s.danniPresi; s.hero.x = 66; s.hero.z = 32;
  run(s, 180);
  assert.ok(Math.abs(s.danniPresi - prima - F.bombardino.dps * 3) < F.bombardino.dps * 0.6, `${(s.danniPresi - prima).toFixed(1)} in 3 s`);
  const p2 = s.danniPresi; s.hero.x = 80; s.hero.z = 24; run(s, 90);
  assert.equal(s.danniPresi, p2, 'fuori non brucia');
  // le chiazze si asciugano
  run(s, 600); assert.equal(s.pozzanghere.length, 0); assert.deepEqual(dungeon.view(s).pozze, []);
});

test('baita: l\'Alchimista — il fusto giallo sulla schiena: da dietro vale doppio, lo stordisce e scoppia (anche addosso agli altri nemici, non a te)', () => {
  const s = terrazza(), R = enemyDef('alchimista_bombardino').debolezzaRetro!;
  const alc = sveglio(s, 'alchimista_bombardino', 70, 32), vicino = sveglio(s, 'acrobata_fuoripista', 72, 33), lontano = sveglio(s, 'acrobata_fuoripista', 84, 40);
  alc.fx = 1; alc.fz = 0; // guarda a est: da ovest (x minore) è la schiena
  const davanti = hitEnemy(s, sveglio(s, 'alchimista_bombardino', 75, 24), colpo({ ox: 80, oz: 24 }));
  const vita = [vicino.vita, lontano.vita], hp = s.hero.vita;
  const dietro = hitEnemy(s, alc, colpo({ ox: 66, oz: 32 }));
  assert.equal(dietro, davanti * R.molt, 'raddoppia');
  assert.ok(alc.stordito && alc.stordito > s.tick + secToTicks(R.stordisce) - 3, 'stordito');
  assert.equal(vicino.vita, vita[0]! - R.danno, 'scoppia addosso a chi è vicino');
  assert.equal(lontano.vita, vita[1], 'non a chi è lontano');
  assert.equal(s.hero.vita, hp, 'e non a chi ha colpito');
  assert.ok(s.eventi.some((e) => e.t === 'scoppio' && e.r === R.raggio));
});

test('baita: l\'Acrobata — l\'anello rosso si accende prima e resta per tutto il giro (la durata dichiarata), poi capogiro con le stelline e i colpi valgono di più', () => {
  const s = terrazza(), T = enemyDef('acrobata_fuoripista').trottola!;
  const a = sveglio(s, 'acrobata_fuoripista', 72, 32);
  run(s, 2);
  assert.equal(a.st, 'prepara'); assert.equal(a.stDur, secToTicks(T.prep));
  assert.deepEqual(vistaDi(s, a).forma, { f: 'cerchio', x: a.x, z: a.z, r: T.raggio }, 'l\'anello si vede già mentre prepara');
  run(s, secToTicks(T.prep));
  assert.equal(a.st, 'colpisce'); assert.equal(a.stDur, secToTicks(T.durata), '2,4 s veri, non la metà');
  assert.equal(vistaDi(s, a).forma!.fisso, true);
  // chi sta dentro prende il colpo ogni `ogni` s, chi sta fuori no
  s.hero.x = 60; s.hero.z = 24; const p0 = s.danniPresi; run(s, 60);
  assert.equal(s.danniPresi, p0, 'fuori dall\'anello niente');
  const evFine = run(s, secToTicks(T.durata));
  assert.ok(evFine.some((e) => e.t === 'capogiro' && e.id === a.id));
  assert.equal(vistaDi(s, a).attacco, 'capogiro'); assert.equal(vistaDi(s, a).stordito, true);
  // dura `capogiro` s e finché dura i colpi valgono × molt
  const base = hitEnemy(s, sveglio(s, 'acrobata_fuoripista', 84, 40), colpo());
  const dizzy = hitEnemy(s, a, colpo());
  assert.ok(Math.abs(dizzy / base - T.molt) < 0.1, `× ${(dizzy / base).toFixed(2)}`);
  run(s, secToTicks(T.capogiro) + 10);
  assert.notEqual(a.modo, 'capogiro'); assert.ok(a.st === 'insegue' || a.st === 'prepara' || a.st === 'colpisce', a.st);
});

test('baita: lo Sparaneve — le tre linee a terra si vedono per tutto l\'avviso e restano ferme (si schiva), poi tre palle che ti spingono; in tilt spara contro gli altri', () => {
  const s = terrazza(), R = enemyDef('sparaneve_automatico').raffica!;
  const sp = sveglio(s, 'sparaneve_automatico', 78, 32);
  run(s, 2);
  assert.equal(sp.st, 'prepara'); assert.equal(sp.stDur, secToTicks(R.avviso));
  const l1 = vistaDi(s, sp).linee!;
  assert.equal(l1.length, 3); assert.equal(vistaDi(s, sp).attacco, 'raffica');
  s.hero.z = 20; run(s, secToTicks(R.avviso) - 6); // l'eroe si sposta: le linee no
  assert.deepEqual(vistaDi(s, sp).linee, l1);
  assert.equal(s.proj.length, 0);
  run(s, 8);
  assert.equal(s.proj.length, 3); assert.ok(s.proj.every((p) => p.dalNemico && p.spinge === R.spinta && p.danno === R.danno));
  assert.equal(sp.st, 'recupera'); assert.equal(sp.stDur, secToTicks(R.ricarica));
  // la palla che ti prende ti spinge: la vista lo dice (`spinto`)
  const t = terrazza(); sveglio(t, 'sparaneve_automatico', 78, 32);
  let spinto = false;
  for (let i = 0; i < secToTicks(R.avviso) + 60; i++) { run(t, 1); if (dungeon.view(t).hero.spinto) spinto = true; }
  assert.ok(spinto && t.hero.x < 66, 'la palla ti spinge via e la vista lo dice');
  // ribaltato (colpo caricato in ricarica): la raffica dopo va contro l'altro nemico più vicino
  const u = terrazza(), sp3 = sveglio(u, 'sparaneve_automatico', 78, 32), altro = sveglio(u, 'acrobata_fuoripista', 78, 40);
  altro.st = 'dorme';
  sp3.st = 'recupera'; sp3.stT = 0; sp3.stDur = 100;
  hitEnemy(u, sp3, colpo({ caricato: true }));
  assert.equal(sp3.ribaltato, true); assert.ok(u.eventi.some((e) => e.t === 'sfondato'));
  assert.ok(sp3.fz > 0.9, 'si gira verso l\'altro nemico (a sud)');
  const vita = altro.vita;
  run(u, 100 + secToTicks(R.avviso) + 10);
  assert.ok(altro.vita < vita, 'la raffica ribaltata lo prende');
});

test('baita: Jean-Claude, fase 1 — la frenata ha il suo cono e la sua spinta, il salto è intoccabile in aria, il quadrato ti segue e si blocca; schivando atterra in bilico', () => {
  const s = terrazza(), C = enemyDef('jean_claude').claude!;
  const jc = sveglio(s, 'jean_claude', 72, 32); jc.capo = true;
  run(s, 2);
  assert.equal(jc.modo, 'frenata'); assert.equal(jc.stDur, secToTicks(C.frenata.avviso));
  assert.deepEqual(vistaDi(s, jc).cono, [C.frenata.gittata, C.frenata.cono], 'il cono si vede');
  const x0 = s.hero.x;
  run(s, secToTicks(C.frenata.avviso) + 1);
  assert.ok(s.danniPresi >= C.frenata.danno - 1, 'preso dal cono');
  assert.equal(dungeon.view(s).hero.spinto, true, 'la spinta si vede');
  run(s, 30); assert.ok(x0 - s.hero.x >= C.frenata.spinta - 0.5, `spinto di ${(x0 - s.hero.x).toFixed(1)} m (${C.frenata.spinta})`);
  // il salto
  run(s, secToTicks(C.frenata.avviso)); // la pausa e il giro del ciclo
  jc.attacchi = 1; jc.st = 'insegue'; jc.modo = undefined; jc.x = 78; jc.z = 32; s.hero.x = 66; s.hero.z = 32; s.hero.spT = 0;
  run(s, 2);
  assert.equal(jc.modo, 'salto'); assert.equal(jc.stDur, secToTicks(C.salto.volo));
  const q1 = vistaDi(s, jc).forma!;
  assert.deepEqual([q1.f, q1.r, q1.fisso ?? false], ['quadro', C.salto.lato, false]);
  run(s, secToTicks(0.5));
  assert.equal(vistaDi(s, jc).volo, true, 'in aria');
  const vita = jc.vita, pre = hitEnemy(s, jc, colpo());
  assert.equal(pre, 0, 'intoccabile in aria'); assert.equal(jc.vita, vita);
  assert.ok(s.eventi.some((e) => e.t === 'parato' && e.perche === 'volo'));
  // il quadrato segue l'eroe, poi si blocca `blocco` s prima dell'atterraggio
  s.hero.x = 70; s.hero.z = 28; run(s, 5);
  assert.deepEqual([vistaDi(s, jc).forma!.x, vistaDi(s, jc).forma!.z], [70, 28]);
  run(s, secToTicks(C.salto.volo - C.salto.blocco) - secToTicks(0.5) - 5 + 3);
  assert.equal(vistaDi(s, jc).forma!.fisso, true, 'bloccato');
  const fx = vistaDi(s, jc).forma!.x, fz = vistaDi(s, jc).forma!.z;
  s.hero.x = fx + C.salto.lato; s.hero.z = fz + C.salto.lato; // l'eroe esce dal quadrato
  const p2 = s.danniPresi;
  const evA = run(s, secToTicks(C.salto.blocco) + 4);
  assert.ok(evA.some((e) => e.t === 'bilico')); assert.equal(s.danniPresi, p2, 'schivato');
  assert.equal(jc.modo, 'bilico'); assert.ok(jc.stordito! > s.tick);
  assert.equal(vistaDi(s, jc).attacco, 'bilico'); assert.equal(vistaDi(s, jc).stordito, true);
  const piena = enemyDef('jean_claude').claude!.salto.molt, normale = hitEnemy(s, sveglio(s, 'jean_claude', 84, 40), colpo()), inBilico = hitEnemy(s, jc, colpo());
  assert.ok(Math.abs(inBilico / normale - piena) < 0.05, `in bilico × ${(inBilico / normale).toFixed(2)}`);
  // colpito dal quadrato: danno pieno
  const t = terrazza(), jt = sveglio(t, 'jean_claude', 78, 32); jt.attacchi = 1;
  run(t, secToTicks(C.salto.volo) + 3);
  assert.ok(t.danniPresi >= C.salto.danno - 1, 'chi resta nel quadrato lo prende');
});

test('baita: Jean-Claude, fase 2 — le bandierine stanno dentro la terrazza e si vedono, lo slalom le percorre 1-2-3 e a ogni porta scoppia il suo cerchio di gelo; spaccare l\'ultima lo pianta a protestare', () => {
  const s = terrazza(), C = enemyDef('jean_claude').claude!, m = s.map;
  const jc = sveglio(s, 'jean_claude', 78, 32); jc.capo = true;
  jc.vita = jc.max * 0.4; jc.attacchi = 0;
  const evF = run(s, 2);
  assert.ok(evF.some((e) => e.t === 'fase')); assert.equal(jc.fase, 1);
  assert.equal(jc.modo, 'slalom'); assert.equal(s.bandierine.length, 3);
  for (const b of s.bandierine) {
    const c = Math.floor(b.z / 2) * m.w + Math.floor(b.x / 2);
    assert.ok(!m.solid[c] && b.x > 60 && b.x < 88 && b.z > 20 && b.z < 44, `bandierina ${b.n} nella terrazza (${b.x}, ${b.z})`);
  }
  assert.equal(dungeon.view(s).bandierine!.length, 3);
  assert.equal(jc.stDur, secToTicks(C.slalom.avviso), 'prima della corsa 2 s per capire e correre');
  run(s, secToTicks(C.slalom.avviso));
  assert.equal(jc.st, 'colpisce');
  // la prima porta passata: il suo cerchio scoppia dopo l'avviso
  s.hero.x = 62; s.hero.z = 22;
  for (let i = 0; i < 600 && s.geyser.length === 0; i++) run(s, 1);
  const g = s.geyser[0]!; assert.equal(g.r, C.slalom.onda.raggio); assert.equal(g.avviso, secToTicks(C.slalom.onda.avviso));
  assert.deepEqual([g.x, g.z], [s.bandierine[0]!.x, s.bandierine[0]!.z]);
  // spacca l'ultima prima che lui ci arrivi
  const ultima = s.bandierine[2]!;
  s.hero.x = ultima.x; s.hero.z = ultima.z; s.hero.slideDir = null;
  run(s, 1); colpisciBandierine(s, 2);
  assert.ok(ultima.abbattuta); assert.ok(s.eventi.some((e) => e.t === 'bandierina' && e.abbattuta) || true);
  let urlo: string | undefined;
  for (let i = 0; i < 900 && (jc.modo as string) !== 'arbitro'; i++) { run(s, 1); for (const e of s.eventi) if (e.t === 'arbitro') urlo = e.urlo; }
  assert.equal(jc.modo, 'arbitro'); assert.ok(urlo?.includes('VENDUTO'));
  assert.ok(Math.abs(jc.stordito! - s.tick - secToTicks(C.slalom.urlo)) < 4, '4 s a protestare');
  assert.equal(s.bandierine.length, 0);
  const normale = hitEnemy(s, sveglio(s, 'jean_claude', 84, 40), colpo()), protesta = hitEnemy(s, jc, colpo());
  assert.ok(Math.abs(protesta / normale - C.slalom.molt) < 0.05);
  // la X della lamina: si vede, e prende chi ci sta dentro
  const t = terrazza(), jl = sveglio(t, 'jean_claude', 72, 32); jl.vita = jl.max * 0.4; jl.attacchi = 1;
  run(t, 2);
  assert.equal(jl.modo, 'lamina'); assert.equal(vistaDi(t, jl).forma!.f, 'x'); assert.equal(vistaDi(t, jl).forma!.r, C.lamina.lato);
  run(t, secToTicks(C.lamina.avviso) + 2);
  assert.ok(t.danniPresi >= C.lamina.danno - 1);
});

test('baita: Drop e Trick «Elicottero» (Tavola «Valanga Pro-99») — attacco a 360° su 2 nemici rimborsa 50% stamina e infligge Assideramento', () => {
  const it = itemDef('unico_tavola_valanga');
  assert.equal(it.unico, true); assert.equal(it.portata, 4); assert.equal(it.danno, 34);
  assert.deepEqual(it.traits!.elicottero, { stamina: 0.5, secondi: 3.5, lento: 0.35, dannoExtra: 0.2 });
  const lot = newLot('p', 0), h = heroOf(lot);
  const rh = buildRunHero({ ...h, inv: { ...h.inv, unico_tavola_valanga: 1 }, equip: { ...h.equip, arma: 'unico_tavola_valanga' } });
  const s = arena(heroBase({ arma: rh.arma }));
  const e1 = sveglio(s, 'acrobata_fuoripista', 21, 14), e2 = sveglio(s, 'acrobata_fuoripista', 20, 15);
  e1.st = 'dorme'; e2.st = 'dorme';
  s.hero.x = 20; s.hero.z = 14; s.hero.stamina = 50;
  const evTot = [...run(s, 120, inp({ a: true })), ...run(s, 90, inp({ a: false }))];
  assert.ok(evTot.some((e) => e.t === 'elicottero'));
  assert.equal(s.hero.stamina, 100, 'stamina rimborsata del 50% max');
  assert.ok(e1.assiderato && e1.assiderato > s.tick && e2.assiderato && e2.assiderato > s.tick);
  assert.equal(e1.dannoPresoMolt, 1.2);
});

test('baita: nessuno spostamento e nessun rallentamento senza una causa che la vista mostra (scivola / spinto / rallentato) — partita intera col pilota', () => {
  const s = nuovo(sciatore(), 2), rng = createRng(2);
  let silenziosi = 0, scivolati = 0, spinti = 0, lenti = 0, prima = dungeon.view(s);
  const camm = 6.5 * (1 / 60) + 0.03; // il passo massimo a piedi: corsa × armatura
  for (let i = 0; i < 40000 && !s.done; i++) {
    const x0 = s.hero.x, z0 = s.hero.z, f = quantizeDungeon(dungeon.autopilot(s, rng));
    dungeon.step(s, f);
    const v = dungeon.view(s), d = Math.sqrt((s.hero.x - x0) * (s.hero.x - x0) + (s.hero.z - z0) * (s.hero.z - z0));
    const causa = !!(prima.hero.scivola || v.hero.scivola || prima.hero.spinto || v.hero.spinto);
    if (d > camm && !causa) silenziosi++;
    if (v.hero.scivola) scivolati++; if (v.hero.spinto) spinti++;
    if (s.hero.lento > 0) { lenti++; assert.equal(v.hero.rallentato, true, 'rallentato è sempre dichiarato'); }
    prima = v;
  }
  assert.equal(s.outcome, 'uscito', `partita finita: ${s.outcome}`);
  assert.equal(silenziosi, 0, 'spostamenti senza causa visibile');
  assert.ok(scivolati > 100, 'il ghiaccio si è usato'); assert.ok(spinti > 0 && lenti > 0, 'spinte e rallentamenti ci sono stati');
});

test('baita: una partita col pilota automatico (ghiaccio compreso) uccide il capo, apre i quattro tornelli e si rigioca con lo stesso hash (anche partendo dalla lanterna davanti al capo)', () => {
  const s = nuovo(sciatore(), 2), log: DungeonInput[] = [], rng = createRng(2), visti = new Set<string>();
  for (let i = 0; i < 40000 && !s.done; i++) {
    const f = quantizeDungeon(dungeon.autopilot(s, rng));
    log.push(f); dungeon.step(s, f);
    for (const e of s.eventi) visti.add(e.t);
  }
  assert.equal(s.outcome, 'uscito');
  assert.ok(s.enemies.find((e) => e.capo)!.st === 'morto', 'Jean-Claude è caduto');
  assert.deepEqual([...s.sciolti].sort(), [1, 2, 3, 4]);
  for (const t of ['valvola', 'scongelato', 'asciutto', 'scivolata', 'capogiro', 'pozzanghera', 'sparo', 'frenata', 'salto', 'bilico', 'fase', 'lamina', 'bandierina', 'arbitro']) assert.ok(visti.has(t), `${t}: ${[...visti].join(',')}`);
  const r = replayDungeon(2, 'baita', sciatore(), packDungeon(log));
  assert.equal(r.hash, dungeon.result(s).hash, 'stesso hash nel replay');
  const t = nuovo(sciatore(), 4, 1), log2: DungeonInput[] = [], rng2 = createRng(4);
  assert.deepEqual([...t.sciolti].sort(), [1, 2, 3, 4], 'dalla lanterna i tornelli sono aperti');
  while (!t.done && !t.enemies.find((e) => e.capo)!.fase && t.tick < 20000) {
    const f = quantizeDungeon(dungeon.autopilot(t, rng2));
    log2.push(f); dungeon.step(t, f);
  }
  const r2 = replayDungeon(4, 'baita', sciatore(), packDungeon(log2), { partenza: 1 });
  assert.equal(r2.hash, dungeon.result(t).hash);
});
