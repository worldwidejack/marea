// Arena PvP (docs/ARENA.md): le build uguali per tutti (dote, 2 slot, ulti) salvate col personaggio, la fotografia coi numeri dell'Arena, colpi
// tra eroi, Vigore della schivata, Cura e Furia solo con dei compagni, le sei ulti, l'erba alta, la resa, le azioni dalla rete, il premio col tetto
// del giorno. Le regole delle quattro modalità sono in arena_modi.test.ts.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, arenaUlti, validateArena } from '@marea/content/arena.ts';
import { RPG } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import type { LotState } from '../src/economy/types.ts';
import { newHero, runHeroOf } from '../src/rpg/hero.ts';
import { applyRpgAction, parseRpgAction } from '../src/rpg/actions.ts';
import { BUILD_BASE, buildArenaEroe, buildsDi, erroreBuild, passoDi } from '../src/rpg/arena.ts';
import type { ArenaBuild, ArenaSlot } from '../src/rpg/types.ts';
import { actPartita, CONTA_TICKS, createPartita, formatoDi, parseArenaAzione, replayPartita, RINASCITA_TICKS, stepPartita, viewPartita } from '../src/arena/partita.ts';
import type { PartitaState } from '../src/arena/partita.ts';
import { botArena } from '../src/arena/bot.ts';
import { arenaOf, finishArena, startArena } from '../src/arena/premio.ts';
import { createRng } from '../src/rng.ts';
import { packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { lineOfSight, moveCircle } from '../src/dungeon/map.ts';
import { aimIndex } from '../src/dungeon/mira.ts';
import { aim } from '../src/dungeon/hero.ts';
import { scoperto, scopri, visibileDa } from '../src/dungeon/erba.ts';
import { dungeon as Dungeon } from '../src/dungeon/dungeon.ts';

const fermo = (): DungeonInput => ({ ...NO_DUNGEON_INPUT });
const build = (slot: (ArenaSlot | null)[], dote = 'vita', ulti = 'furia'): ArenaBuild => ({ dote, slot, ulti });
const katana = build([{ arma: 'katana_ferro' }, null]);
/** A e B, uno contro l'altro: Caccia alle stelle 3 contro 3 sull'Osservatorio, A è l'eroe 0 e B il 3 (gli altri restano fermi alle partenze). */
const A = 0, B = 3;
/** La partita già al via, A e B uno davanti all'altro a `dist` m sulla riga 8 dell'Osservatorio (libera da x = 6 a 16). */
function alVia(a: ArenaBuild, b: ArenaBuild, dist = 1.2, seed = 3): PartitaState {
  const eroi = [a, katana, katana, b, katana, katana].map(buildArenaEroe);
  const d = createPartita({ seed, eroi, ...formatoDi('stelle', 3, seed, 'osservatorio') });
  for (let t = 0; t < CONTA_TICKS; t++) stepPartita(d, eroi.map(fermo));
  assert.equal(d.fase, 'gioca');
  const [h0, h1] = [d.s.eroi[A]!.hero, d.s.eroi[B]!.hero];
  h0.x = 15; h0.z = 17; h0.fx = 1; h0.fz = 0;
  h1.x = 15 + dist; h1.z = 17; h1.fx = -1; h1.fz = 0;
  return d;
}
/** `n` passi con l'input di A e di B (gli altri fermi). */
function passi(d: PartitaState, n: number, fa: DungeonInput = fermo(), fb: DungeonInput = fermo()): void {
  for (let t = 0; t < n && d.fase === 'gioca'; t++) stepPartita(d, d.eroi.map((_, i) => (i === A ? fa : i === B ? fb : fermo())));
}
/** L'ulti dell'eroe i piena. */
const piena = (d: PartitaState, i: number) => { d.ul[i]!.carica = ARENA.ulti.carica.max; };
/** La vita piena di B (dote Vita: +10%). */
const PIENA = 110;

describe('Arena — le build', () => {
  it('i dati dell\'Arena sono validi: le modalità, le mappe chiuse, quelle a due squadre simmetriche', () => {
    assert.deepEqual(validateArena(), []);
  });

  it('si parte da BUILD_BASE; le build si salvano col personaggio senza toccare zaino, equipaggiamento e dungeon', () => {
    const lot = { ...newLot('a', 0), hero: newHero() }, h0 = lot.hero;
    assert.deepEqual(buildsDi(h0), { build: [BUILD_BASE], scelta: 0 });
    const due = { build: [build([{ magia: 'fiammata' }, { arma: 'martello_ferro' }], 'magia', 'marea'), build([{ arma: 'arco_ferro' }, { magia: 'cura_bomba' }], 'vigore', 'arpione')], scelta: 1 };
    const a = parseRpgAction({ t: 'arena', builds: due });
    assert.ok(a);
    const dopo = applyRpgAction(lot, a, 1000);
    assert.deepEqual(dopo.hero!.arena, due);
    assert.deepEqual(buildsDi(dopo.hero!), due);
    assert.deepEqual(dopo.hero!.inv, h0.inv, 'lo zaino non cambia');
    assert.deepEqual(dopo.hero!.equip, h0.equip, 'l\'equipaggiamento dei dungeon non cambia');
    assert.deepEqual(runHeroOf(dopo.hero!), runHeroOf(h0), 'la fotografia dei dungeon è la stessa');
    const male = (b: ArenaBuild) => applyRpgAction(lot, { t: 'arena', builds: { build: [b], scelta: 0 } }, 1000);
    assert.throws(() => male(build([{ arma: 'spadone_meteorite' }, null])), /non valida/);
    assert.throws(() => male(build([{ magia: 'golem_evocato' }, null])), /non valida/, 'niente evocazioni');
    assert.throws(() => male(build([{ magia: 'cura_bomba' }, { magia: 'furia_bomba' }])), /attacco/, 'serve qualcosa che fa danno');
    assert.throws(() => male(build([{ arma: 'katana_ferro' }, { arma: 'katana_ferro' }])), /due volte/);
    assert.throws(() => male(build([{ arma: 'katana_ferro' }, null], 'forza')), /dote/);
    assert.throws(() => male(build([{ arma: 'katana_ferro' }, null], 'vita', 'meteora')), /ulti/);
  });

  it('la fotografia: una RunHero arena per slot coi numeri di arena.json, la dote, il passo dell\'arma; niente del personaggio', () => {
    const e = buildArenaEroe(build([{ arma: 'martello_ferro' }, { arma: 'arco_ferro' }], 'vigore', 'scatto'));
    const [m, a] = e.varianti as [NonNullable<typeof e.varianti[0]>, NonNullable<typeof e.varianti[0]>];
    assert.equal(e.dote, 'vigore'); assert.equal(e.ulti, 'scatto');
    for (const v of [m, a]) { assert.ok(v.arena); assert.equal(v.max.vita, ARENA.build.attributi.vita); assert.equal(v.max.stamina, ARENA.build.attributi.stamina * 2); assert.equal(v.perk, undefined); assert.equal(v.armatura.difesa, 0); }
    assert.equal(m.arma.danno, ARENA.build.armi['martello_ferro']!.danno);
    assert.equal(a.arma.kind, 'arco'); assert.equal(a.frecce?.n, ARENA.frecce);
    assert.ok(m.camminata < a.camminata, 'il martello rallenta, l\'arco no');
    assert.equal(m.camminata, Math.round(RPG.movimento.camminata * passoDi(20) * 100) / 100);
    assert.equal(buildArenaEroe(build([{ arma: 'katana_ferro' }, null], 'vita')).varianti[0]!.max.vita, PIENA);
    assert.equal(erroreBuild(BUILD_BASE), null);
  });
});

describe('Arena — combattimento tra eroi', () => {
  it('recupera Vita dopo una pausa, anche schivando, e ricomincia ad aspettare dopo un attacco', () => {
    const d = alVia(katana, katana, 10), h = d.s.eroi[A]!.hero;
    const { attesa, alSecondo } = ARENA.build.recuperoVita;
    h.vita = 50;
    passi(d, attesa * 60 - 1);
    assert.equal(h.vita, 50);
    passi(d, 60, { ...fermo(), roll: true });
    assert.ok(Math.abs(h.vita - (50 + alSecondo)) < 0.001);
    passi(d, 4, { ...fermo(), a: true });
    const vita = h.vita;
    passi(d, attesa * 60 - 1);
    assert.equal(h.vita, vita);
    passi(d, attesa * 60);
    assert.ok(h.vita > vita);
    h.vita = PIENA - 0.01;
    passi(d, 1);
    assert.equal(h.vita, PIENA);
  });

  const spadone = build([{ arma: 'spadone_ferro' }, null]);

  it('la mischia colpisce l\'avversario, mai un colpo solo che uccide', () => {
    const d = alVia(spadone, spadone);
    passi(d, 4, { ...fermo(), a: true });
    passi(d, 60);
    const v1 = d.s.eroi[B]!.hero.vita;
    assert.ok(v1 < PIENA && v1 > 8, `colpito ma vivo (${v1})`);
    const e = d.s.eroi[B]!;
    e.hero.vita = 100;
    passi(d, 200, { ...fermo(), a: true });
    passi(d, 60);
    assert.ok(e.hero.vita > 0 && e.hero.vita >= 100 - RPG.arena.dannoMax - 1, `niente one-shot (${e.hero.vita})`);
  });

  it('i colpi non costano Vigore: a Vigore zero si attacca lo stesso; la schivata sì', () => {
    const d = alVia(katana, katana);
    const h = d.s.eroi[A]!.hero;
    h.stamina = 0;
    const v = d.s.eroi[B]!.hero.vita;
    passi(d, 4, { ...fermo(), a: true });
    passi(d, 60);
    assert.ok(d.s.eroi[B]!.hero.vita < v, 'il colpo parte e arriva');
    h.stamina = ARENA.build.staminaSchivata - 1;
    passi(d, 4, { ...fermo(), mx: 1, roll: true });
    assert.notEqual(h.act, 'schiva', 'a corto di Vigore non rotola');
  });

  it('la schivata: costa Vigore e chi rotola non prende il colpo', () => {
    const d = alVia(katana, katana, 1.2);
    const h1 = d.s.eroi[B]!.hero;
    passi(d, 4, { ...fermo(), a: true }, { ...fermo(), mx: 1, roll: true });
    assert.equal(h1.act, 'schiva', 'rotola');
    assert.ok(h1.stamina <= 200 - ARENA.build.staminaSchivata + 1, `la schivata costa Vigore (${h1.stamina})`);
    passi(d, 60);
    assert.equal(h1.vita, PIENA, 'il colpo non l\'ha preso');
  });

  it('frecce e magie colpiscono l\'avversario; l\'arco consuma solo le sue frecce', () => {
    const d = alVia(build([{ arma: 'arco_ferro' }, { magia: 'fiammata' }]), spadone, 6);
    const mira = aimIndex(1, 0);
    passi(d, 70, { ...fermo(), a: true, m: mira });
    passi(d, 90);
    const dopoFreccia = d.s.eroi[B]!.hero.vita;
    assert.ok(dopoFreccia < PIENA, 'la freccia è arrivata');
    assert.equal(viewPartita(d, A).frecce[0], ARENA.frecce - 1);
    assert.ok(actPartita(d, A, { t: 'slot', n: 1 }));
    assert.equal(d.s.eroi[A]!.hero.incanta, true);
    passi(d, 3, { ...fermo(), a: true, m: mira });
    passi(d, 90);
    assert.ok(d.s.eroi[B]!.hero.vita < dopoFreccia, 'la magia è arrivata');
    actPartita(d, A, { t: 'slot', n: 0 });
    assert.equal(d.s.eroi[A]!.hero.frecce, ARENA.frecce - 1);
  });

  it('le bombe possono atterrare e colpire oltre un muro', () => {
    const d = alVia(build([{ magia: 'bomba_elettrica' }, null]), katana);
    const a = d.s.eroi[A]!.hero, b = d.s.eroi[B]!.hero;
    a.x = 30; b.x = 37; b.z = 17.5;
    assert.equal(lineOfSight(d.s.map, a.x, a.z, b.x, b.z), false);
    passi(d, 3, { ...fermo(), a: true });
    passi(d, 1);
    assert.deepEqual(d.s.proj[0]?.bomba, [b.x, b.z]);
    passi(d, 90);
    assert.ok(b.vita < PIENA);
  });

  it('Cura e Furia: tutti contro tutti lo slot resta vuoto, con dei compagni no', () => {
    const e = buildArenaEroe(build([{ magia: 'cura_bomba' }, { arma: 'katana_ferro' }]));
    const solo = createPartita({ seed: 1, eroi: Array.from({ length: 10 }, () => e), ...formatoDi('sopravvivenza', 1, 1) });
    assert.equal(solo.eroi[0]!.varianti[0], null, 'da solo no');
    assert.equal(solo.rt[0]!.slot, 1);
    assert.equal(actPartita(solo, 0, { t: 'slot', n: 0 }), null);
    const coppie = createPartita({ seed: 1, eroi: Array.from({ length: 10 }, () => e), ...formatoDi('sopravvivenza', 2, 1) });
    assert.ok(coppie.eroi[0]!.varianti[0], 'in coppia sì');
  });

  it('i dungeon non cambiano: senza Arena l\'eroe non vede altri bersagli', () => {
    const s = Dungeon.create({ seed: 1, dungeon: 'grotta', hero: runHeroOf(newHero()) });
    assert.equal(s.pvp, undefined);
  });
});

describe('Arena — le ulti', () => {
  it('la carica sale col tempo e col danno, si lancia solo piena e resta anche dopo una caduta', () => {
    const d = alVia(katana, katana);
    assert.equal(actPartita(d, A, { t: 'ulti' }), null, 'vuota: non parte');
    passi(d, 60);
    const dopoUnSecondo = d.ul[A]!.carica;
    assert.ok(Math.abs(dopoUnSecondo - ARENA.ulti.carica.alSecondo) < 0.05, `un secondo di gioco (${dopoUnSecondo})`);
    passi(d, 4, { ...fermo(), a: true }); passi(d, 40);
    assert.ok(d.ul[A]!.carica > dopoUnSecondo + 1, 'il colpo dato carica');
    assert.ok(d.ul[B]!.carica > dopoUnSecondo, 'il colpo preso anche');
    piena(d, A);
    assert.ok(actPartita(d, A, { t: 'ulti' }));
    assert.equal(d.ul[A]!.carica, 0);
    assert.equal(actPartita(d, A, { t: 'ulti' }), null, 'una volta sola');
    // B cade e rinasce: la carica resta
    const c1 = d.ul[B]!.carica;
    d.s.eroi[B]!.hero.vita = 0.5;
    passi(d, 4, { ...fermo(), a: true }); passi(d, 40);
    assert.ok(d.s.eroi[B]!.done, 'B è a terra');
    passi(d, RINASCITA_TICKS + 2);
    assert.equal(d.s.eroi[B]!.done, false, 'B è rinato');
    assert.ok(d.ul[B]!.carica >= c1 && d.ul[B]!.carica < c1 + 20, `la carica resta (${c1} → ${d.ul[B]!.carica})`);
  });

  it('Furia: danni doppi per qualche secondo', () => {
    const colpo = (furia: boolean) => {
      const d = alVia(katana, katana);
      if (furia) { piena(d, A); assert.ok(actPartita(d, A, { t: 'ulti' })); }
      passi(d, 4, { ...fermo(), a: true }); passi(d, 40);
      return PIENA - d.s.eroi[B]!.hero.vita;
    };
    const [x, y] = [colpo(false), colpo(true)];
    assert.ok(x > 0 && Math.abs(y - 2 * x) < 0.6, `normale ${x}, con Furia ${y}`);
  });

  it('Scatto: il doppio di passo e la corsa non stanca', () => {
    const corsa = (scatto: boolean) => {
      const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'scatto'), katana, 12);
      if (scatto) { piena(d, A); actPartita(d, A, { t: 'ulti' }); }
      const h = d.s.eroi[A]!.hero, x0 = h.x;
      passi(d, 30, { ...fermo(), mx: 1, b: true });
      return { dx: h.x - x0, st: h.stamina };
    };
    const [a, b] = [corsa(false), corsa(true)];
    assert.ok(b.dx > a.dx * 1.9, `${a.dx} → ${b.dx}`);
    assert.ok(b.st > a.st, 'con lo Scatto la corsa non consuma');
  });

  it('Aura: cura chi le sta vicino per qualche secondo', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'aura'), katana, 8);
    const h = d.s.eroi[A]!.hero; h.vita = 50;
    piena(d, A); actPartita(d, A, { t: 'ulti' });
    passi(d, 120);
    assert.ok(h.vita > 50 + (arenaUlti('aura').cura ?? 0) * 1.5, `${h.vita}`);
    assert.equal(d.s.eroi[B]!.hero.vita, PIENA, 'l\'avversario no');
  });

  it('Raggio della Marea: fermo carica, poi colpisce chi è sulla linea', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'marea'), katana, 8);
    piena(d, A); actPartita(d, A, { t: 'ulti' });
    const h = d.s.eroi[A]!.hero, x0 = h.x;
    passi(d, 20, { ...fermo(), mx: -1 });
    assert.equal(h.x, x0, 'mentre carica sta fermo');
    passi(d, 120);
    assert.ok(d.s.eroi[B]!.hero.vita < PIENA - 20, `${d.s.eroi[B]!.hero.vita}`);
  });

  it('Raggio della Marea: si gira con la mira (stick destro, mouse), non solo col joystick', () => {
    const verso = (dx: number, dz: number) => {
      const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'marea'), katana, 8);
      const h = d.s.eroi[A]!.hero; h.fx = 0; h.fz = 1; // guarda di lato: B è davanti a +x
      piena(d, A); actPartita(d, A, { t: 'ulti' });
      passi(d, 120, { ...fermo(), m: aimIndex(dx, dz) });
      return d.s.eroi[B]!.hero.vita;
    };
    assert.ok(verso(1, 0) < PIENA - 20, 'mirata su B lo prende');
    assert.equal(verso(-1, 0), PIENA, 'mirata dalla parte opposta no');
  });

  it('Arena: le magie elettriche non rallentano, hanno più raggio di quelle di fuoco', () => {
    const e = buildArenaEroe(build([{ magia: 'fulmine' }, { magia: 'bomba_elettrica' }])), f = buildArenaEroe(build([{ magia: 'fiammata' }, { magia: 'bomba_fuoco' }]));
    const [fulmine, bomba] = [e.varianti[0]!.magie[0]!, e.varianti[1]!.magie[0]!];
    assert.equal(fulmine.rallenta, undefined); assert.equal(bomba.rallenta, undefined);
    assert.ok(fulmine.raggio! > f.varianti[0]!.magie[0]!.raggio!, 'il proiettile è più largo');
    assert.ok(bomba.raggio! > f.varianti[1]!.magie[0]!.raggio!, 'lo scoppio è più grande');
    assert.ok(fulmine.costo < f.varianti[0]!.magie[0]!.costo + 1, 'costa meno del fuoco');
  });

  it('Arpione: chi è preso viene tirato davanti e resta fermo un attimo', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'arpione'), katana, 8);
    piena(d, A); actPartita(d, A, { t: 'ulti' });
    let preso = false, vicino = 99, fermoDopo = false;
    const [a, b] = [d.s.eroi[A]!.hero, d.s.eroi[B]!.hero];
    for (let t = 0; t < 90 && d.fase === 'gioca'; t++) {
      const era = d.ul[A]!.fase === 'tiro';
      passi(d, 1, fermo(), { ...fermo(), mx: 1 });
      preso ||= d.ul[A]!.fase === 'tiro'; vicino = Math.min(vicino, b.x - a.x);
      if (era && d.ul[A]!.fase === 'no') { const x = b.x; passi(d, 10, fermo(), { ...fermo(), mx: 1 }); fermoDopo = b.x === x; }
    }
    assert.ok(preso, 'l\'arpione ha preso');
    assert.ok(vicino < 1.3, `tirato vicino (${vicino})`);
    assert.ok(fermoDopo, 'e resta fermo un attimo');
    assert.ok(b.vita < PIENA);
  });

  it('Velo di nebbia: gli avversari non ti vedono, finché non attacchi', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'velo'), katana, 8);
    piena(d, A); actPartita(d, A, { t: 'ulti' });
    passi(d, 2);
    assert.equal(visibileDa(d.s, A, 1), false);
    assert.ok(viewPartita(d, A).nascosto);
    assert.ok(viewPartita(d, B).altri.find((x) => x.i === A)!.nascosto);
    passi(d, 3, { ...fermo(), a: true });
    assert.equal(visibileDa(d.s, A, 1), true, 'attaccando si scopre');
  });
});

describe('Arena — passaggi', () => {
  it('si passa tra la palma e il relitto; il tronco e le pareti restano solidi', () => {
    const seed = 3, eroi = Array.from({ length: 10 }, () => buildArenaEroe(katana));
    const d = createPartita({ seed, eroi, ...formatoDi('sopravvivenza', 1, seed, 'naufragio') });
    const { map } = d.s, r = d.s.eroi[0]!.runHero.raggio;
    const bordoPalma = { x: 22.25, z: 12.5 };
    moveCircle(map, bordoPalma, 0, 1, r);
    assert.deepEqual(bordoPalma, { x: 22.25, z: 13.5 });
    const controTronco = { x: 23, z: 12 };
    moveCircle(map, controTronco, 0, 1, r);
    assert.ok(controTronco.z < 12.5);
    const scoglio = { x: 33, z: 10 };
    moveCircle(map, scoglio, 0, 1, r);
    assert.ok(scoglio.z < 10);

    const stelle = alVia(katana, katana).s.map, bordoSiepe = { x: 10.1, z: 16.3 };
    moveCircle(stelle, bordoSiepe, 0, 1, r);
    assert.deepEqual(bordoSiepe, { x: 10.1, z: 17.3 });
  });
});

describe('Arena — erba alta', () => {
  /** A dentro l'erba dell'Osservatorio (il prato in alto a sinistra), B a `dx` m alla sua destra. */
  function nellErba(dx: number): PartitaState {
    const d = alVia(katana, katana, 8), h0 = d.s.eroi[A]!.hero, h1 = d.s.eroi[B]!.hero;
    h0.x = 8 * 2 + 1; h0.z = 3 * 2 + 1; h1.x = h0.x + dx; h1.z = h0.z;
    return d;
  }
  it('chi sta nell\'erba non lo vedono gli avversari, i compagni sì; vicino lo si scopre', () => {
    const d = nellErba(RPG.arena.erba.raggio + 4), s = d.s;
    assert.equal(visibileDa(s, A, 1), false, 'gli avversari non lo vedono');
    assert.equal(visibileDa(s, A, 0), true, 'la sua squadra sì');
    assert.ok(!viewPartita(d, B).dungeon.compagni.some((c) => c.i === A));
    assert.ok(viewPartita(d, 1).dungeon.compagni.some((c) => c.i === A));
    assert.equal(viewPartita(d, A).nascosto, true, 'io so di essere nascosto');
    s.eroi[B]!.hero.x = s.eroi[A]!.hero.x + RPG.arena.erba.raggio - 0.2;
    assert.equal(visibileDa(s, A, 1), true, 'un avversario vicino lo scopre');
  });

  it('chi attacca si scopre per un attimo; la mira assistita non punta chi non si vede', () => {
    const d = nellErba(6), s = d.s;
    assert.equal(scoperto(s, A), false);
    s.cur = B;
    assert.equal(aim(s, 12, 0.5, 8, true), null, 'nell\'erba: nessun bersaglio');
    s.cur = 0;
    passi(d, 2, { ...fermo(), a: true, m: aimIndex(-1, 0) });
    assert.equal(scoperto(s, A), true, 'ha attaccato');
    for (let t = 0; t < 400 && scoperto(s, A); t++) passi(d, 1);
    assert.equal(visibileDa(s, A, 1), false, 'passato il tempo è di nuovo nascosto');
    scopri(s, A);
    s.cur = B;
    assert.ok(aim(s, 12, 0.5, 8, true), 'scoperto: bersaglio');
    s.cur = 0;
  });

  it('un gladiatore automatico non attacca chi è nascosto nell\'erba', () => {
    const d = nellErba(5), rng = createRng(4);
    for (let t = 0; t < 30; t++) { const b = botArena(d, B, rng); assert.equal(b.input.a, false, 'non attacca chi non vede'); }
  });
});

describe('Arena — resa e rete', () => {
  it('la resa di uno lascia la squadra a giocare; quella di tutta la squadra chiude la partita (anche nel replay)', () => {
    const d = alVia(katana, katana);
    assert.ok(actPartita(d, 4, { t: 'resa' }));
    assert.equal(d.fase, 'gioca', 'gli altri due continuano');
    assert.ok(d.s.eroi[4]!.done);
    passi(d, RINASCITA_TICKS + 5);
    assert.ok(d.s.eroi[4]!.done, 'chi si arrende non rinasce');
    actPartita(d, 3, { t: 'resa' }); actPartita(d, 5, { t: 'resa' });
    assert.equal(d.fase, 'finita');
    assert.equal(d.esito?.vincitore, 0); assert.equal(d.esito?.perche, 'resa');
    assert.equal(actPartita(d, 0, { t: 'slot', n: 1 }), null);
    const vuoto = d.eroi.map(() => packDungeon([fermo()]));
    const r = replayPartita(3, d.eroi, { inputs: vuoto, azioni: [[5, 0, { t: 'resa' }], [5, 1, { t: 'resa' }], [6, 2, { t: 'resa' }]] }, formatoDi('stelle', 3, 3, 'osservatorio'));
    assert.equal(r.esito?.vincitore, 1);
  });

  it('nel conto alla rovescia non ci si muove', () => {
    const eroi = [katana, katana, katana, katana, katana, katana].map(buildArenaEroe);
    const d = createPartita({ seed: 2, eroi, ...formatoDi('stelle', 3, 2) }), x = d.s.eroi[0]!.hero.x;
    stepPartita(d, eroi.map((_, i) => (i === 0 ? quantizeDungeon({ ...fermo(), mx: 1 }) : fermo())));
    assert.equal(d.s.eroi[0]!.hero.x, x);
  });

  it('formati sbagliati si rifiutano', () => {
    const e = buildArenaEroe(katana);
    assert.throws(() => createPartita({ seed: 1, eroi: [e, e, e, e], ...formatoDi('stelle', 3, 1) }), /vuole 6 eroi/);
    assert.throws(() => createPartita({ seed: 1, eroi: [e, e, e, e, e, e], modo: 'stelle', per: 3, mappa: 'porto' }), /non vanno/);
    assert.deepEqual(formatoDi('rapina', 9, 1), { modo: 'rapina', per: 2, mappa: 'porto' }, 'grandezza che non c\'è: la prima');
  });

  it('azioni dalla rete: solo forme valide', () => {
    assert.deepEqual(parseArenaAzione({ t: 'slot', n: 1 }), { t: 'slot', n: 1 });
    assert.deepEqual(parseArenaAzione({ t: 'ulti', x: 1 }), { t: 'ulti' });
    assert.deepEqual(parseArenaAzione({ t: 'resa', x: 1 }), { t: 'resa' });
    assert.equal(parseArenaAzione({ t: 'slot', n: ARENA.slot }), null);
    assert.equal(parseArenaAzione({ t: 'pozione', n: 0 }), null);
  });
});

describe('Arena — premio', () => {
  it('monete per la partita vinta o persa, entro il tetto del giorno; la partita sbagliata non paga', () => {
    let lot: LotState = { ...newLot('a', 0), hero: newHero() };
    const m0 = lot.monete, P = ARENA.premio;
    let preso = 0;
    for (let k = 0; k < 10; k++) {
      lot = startArena(lot, 'r' + k, 0, 1000);
      const f = finishArena(lot, 'r' + k, 'vinta', 2000);
      preso += f.premio; lot = f.lot;
    }
    assert.equal(preso, P.tetto);
    assert.equal(lot.monete, m0 + P.tetto);
    assert.equal(arenaOf(lot, 2000).vinte, 10);
    lot = startArena(lot, 'x', 1, 86_400_000 + 5);
    assert.equal(finishArena(lot, 'altro', 'vinta', 86_400_000 + 9).premio, 0, 'una partita che non è quella aperta non paga');
    const f = finishArena(lot, 'x', 'persa', 86_400_000 + 9);
    assert.equal(f.premio, P.persa);
    assert.equal(finishArena(startArena(f.lot, 'y', 0, 86_400_000 + 9), 'y', 'arreso', 86_400_000 + 10).premio, 0);
    assert.equal(finishArena(startArena(f.lot, 'z', 0, 86_400_000 + 9), 'z', 'vinta', 86_400_000 + 10, true).premio, 0, 'contro soli gladiatori niente monete');
  });
});
