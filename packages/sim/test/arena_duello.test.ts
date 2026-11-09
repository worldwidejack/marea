// Arena PvP (docs/ARENA.md): le build uguali per tutti (dote, 2 slot, ulti) salvate col personaggio, la fotografia coi numeri dell'Arena, colpi
// tra eroi, Vigore dei colpi, Cura e Furia solo a squadre, le sei ulti, round al meglio di 3, pareggio a tempo, resa, replay del server uguale
// al client, premio col tetto del giorno.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, arenaMappa, arenaUlti, validateArena } from '@marea/content/arena.ts';
import { RPG } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import type { LotState } from '../src/economy/types.ts';
import { newHero, runHeroOf } from '../src/rpg/hero.ts';
import { applyRpgAction, parseRpgAction } from '../src/rpg/actions.ts';
import { BUILD_BASE, buildArenaEroe, buildsDi, erroreBuild, passoDi } from '../src/rpg/arena.ts';
import type { ArenaBuild, ArenaSlot } from '../src/rpg/types.ts';
import { actDuello, createDuello, CONTA_TICKS, hashDuello, parseArenaAzione, PAUSA_TICKS, replayDuello, ROUND_TICKS, stepDuello, viewDuello } from '../src/arena/duello.ts';
import type { ArenaAzioni, DuelloState } from '../src/arena/duello.ts';
import { botArena } from '../src/arena/bot.ts';
import { arenaOf, finishArena, startArena } from '../src/arena/premio.ts';
import { createRng } from '../src/rng.ts';
import { packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { aimIndex } from '../src/dungeon/mira.ts';
import { visibileDa } from '../src/dungeon/erba.ts';
import { dungeon as Dungeon } from '../src/dungeon/dungeon.ts';

const fermo = (): DungeonInput => ({ ...NO_DUNGEON_INPUT });
const build = (slot: (ArenaSlot | null)[], dote = 'vita', ulti = 'furia'): ArenaBuild => ({ dote, slot, ulti });
/** Duello già al via (passato il conto alla rovescia), eroi uno davanti all'altro a `dist` m sulla riga 3 del colosseo (tutta libera). */
function alVia(a: ArenaBuild, b: ArenaBuild, dist = 1.2, seed = 3): DuelloState {
  const d = createDuello({ seed, eroi: [buildArenaEroe(a), buildArenaEroe(b)] });
  for (let t = 0; t < CONTA_TICKS; t++) stepDuello(d, [fermo(), fermo()]);
  assert.equal(d.fase, 'gioca');
  const [h0, h1] = [d.s.eroi[0]!.hero, d.s.eroi[1]!.hero];
  h0.x = 14; h0.z = 7; h0.fx = 1; h0.fz = 0;
  h1.x = 14 + dist; h1.z = 7; h1.fx = -1; h1.fz = 0;
  return d;
}
function passi(d: DuelloState, n: number, f0: DungeonInput = fermo(), f1: DungeonInput = fermo()): void {
  for (let t = 0; t < n && d.fase === 'gioca'; t++) stepDuello(d, [f0, f1]);
}
const katana = build([{ arma: 'katana_ferro' }, null]);
/** L'ulti dell'eroe i piena. */
const piena = (d: DuelloState, i: number) => { d.ul[i]!.carica = ARENA.ulti.carica.max; };

describe('Arena — le build', () => {
  it('i dati dell\'Arena sono validi e le mappe chiuse e simmetriche', () => {
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
    // quello che non c'è nel catalogo dell'Arena non si mette
    const male = (b: ArenaBuild) => applyRpgAction(lot, { t: 'arena', builds: { build: [b], scelta: 0 } }, 1000);
    assert.throws(() => male(build([{ arma: 'spadone_meteorite' }, null])), /non valida/);
    assert.throws(() => male(build([{ magia: 'golem_evocato' }, null])), /non valida/, 'niente evocazioni');
    assert.throws(() => male(build([{ magia: 'cura_bomba' }, { magia: 'furia_bomba' }])), /attacco/, 'serve qualcosa che fa danno');
    assert.throws(() => male(build([{ arma: 'katana_ferro' }, { arma: 'katana_ferro' }])), /due volte/);
    assert.throws(() => male(build([{ arma: 'katana_ferro' }, null], 'forza')), /dote/);
    assert.throws(() => male(build([{ arma: 'katana_ferro' }, null], 'vita', 'meteora')), /ulti/);
    assert.throws(() => applyRpgAction(lot, { t: 'arena', builds: { build: Array.from({ length: ARENA.build.salvate + 1 }, () => katana), scelta: 0 } }, 1000), /Build/);
    assert.equal(parseRpgAction({ t: 'arena', builds: { build: [{ dote: 'vita', slot: [{ arma: 3 }], ulti: 'furia' }], scelta: 0 } }), null);
    // un salvataggio di prima (il set con armatura e pozioni) diventa BUILD_BASE
    const vecchio = { ...h0, arena: { corpo: 'armatura_legno', slot: [{ arma: 'katana_legno' }, null, null, null], pozioni: [null, null] } } as unknown as typeof h0;
    assert.deepEqual(buildsDi(vecchio), { build: [BUILD_BASE], scelta: 0 });
  });

  it('la fotografia: una RunHero arena per slot coi numeri di arena.json, la dote, il passo dell\'arma; niente del personaggio', () => {
    const e = buildArenaEroe(build([{ arma: 'martello_ferro' }, { arma: 'arco_ferro' }], 'vigore', 'scatto'));
    const [m, a] = e.varianti as [NonNullable<typeof e.varianti[0]>, NonNullable<typeof e.varianti[0]>];
    assert.equal(e.dote, 'vigore'); assert.equal(e.ulti, 'scatto');
    for (const v of [m, a]) { assert.ok(v.arena); assert.equal(v.max.vita, ARENA.build.attributi.vita); assert.equal(v.max.stamina, ARENA.build.attributi.stamina * 1.5); assert.equal(v.perk, undefined); assert.equal(v.armatura.difesa, 0); }
    assert.equal(m.arma.danno, ARENA.build.armi['martello_ferro']!.danno);
    assert.ok(m.arma.fatica! > 0, 'i colpi costano Vigore');
    assert.equal(a.arma.kind, 'arco'); assert.equal(a.frecce?.n, ARENA.frecce); assert.equal(a.arma.danno, ARENA.build.armi['arco_ferro']!.danno);
    assert.ok(m.camminata < a.camminata, 'il martello rallenta, l\'arco no');
    assert.equal(m.camminata, Math.round(RPG.movimento.camminata * passoDi(20) * 100) / 100);
    const v = buildArenaEroe(build([{ magia: 'fulmine' }, null], 'magia')).varianti[0]!;
    assert.ok(v.manoMagia); assert.equal(v.max.magicka, 150); assert.equal(v.regen.magicka, ARENA.build.regen.magicka * 1.5);
    assert.equal(v.magie[0]!.costo, ARENA.build.magie['fulmine']!.costo);
    assert.equal(buildArenaEroe(build([{ arma: 'katana_ferro' }, null], 'vita')).varianti[0]!.max.vita, 120);
    assert.equal(erroreBuild(BUILD_BASE), null);
  });
});

describe('Arena — combattimento tra eroi', () => {
  const spadone = build([{ arma: 'spadone_ferro' }, null]);

  it('la mischia colpisce l\'avversario, mai un colpo solo che uccide', () => {
    const d = alVia(spadone, spadone);
    passi(d, 4, { ...fermo(), a: true });
    passi(d, 60);
    const v1 = d.s.eroi[1]!.hero.vita;
    assert.ok(v1 < 120 && v1 > 8, `colpito ma vivo (${v1})`);
    const e = d.s.eroi[1]!;
    e.hero.vita = 100;
    passi(d, 200, { ...fermo(), a: true });
    passi(d, 60);
    assert.ok(e.hero.vita > 0 && e.hero.vita >= 100 - RPG.arena.dannoMax - 1, `niente one-shot (${e.hero.vita})`);
  });

  it('i colpi costano Vigore: a secco non si attacca finché non torna', () => {
    const d = alVia(katana, katana);
    const h = d.s.eroi[0]!.hero, prima = h.stamina;
    passi(d, 4, { ...fermo(), a: true }); passi(d, 2);
    assert.ok(h.stamina < prima, `il colpo ha consumato (${prima} → ${h.stamina})`);
    passi(d, 60);
    h.stamina = 0;
    const v = d.s.eroi[1]!.hero.vita;
    passi(d, 3, { ...fermo(), a: true });
    assert.notEqual(h.act, 'press', 'a secco il colpo non parte');
    passi(d, 40);
    assert.equal(d.s.eroi[1]!.hero.vita, v);
  });

  it('la schivata: costa Vigore e chi rotola non prende il colpo; passa dalla rete', () => {
    const d = alVia(katana, katana, 1.2);
    const h1 = d.s.eroi[1]!.hero;
    passi(d, 4, { ...fermo(), a: true }, { ...fermo(), mx: 1, roll: true });
    assert.equal(h1.act, 'schiva', 'rotola');
    assert.ok(h1.stamina <= 100 - RPG.schivata.stamina + 1, `la schivata costa Vigore (${h1.stamina})`);
    passi(d, 60);
    assert.equal(h1.vita, 120, 'il colpo non l\'ha preso');
    assert.equal(quantizeDungeon({ ...fermo(), roll: true }).roll, true);
  });

  it('frecce e magie colpiscono l\'avversario; l\'arco consuma solo le sue frecce', () => {
    const d = alVia(build([{ arma: 'arco_ferro' }, { magia: 'fiammata' }]), spadone, 6);
    const mira = aimIndex(1, 0);
    passi(d, 70, { ...fermo(), a: true, m: mira });
    passi(d, 90);
    const dopoFreccia = d.s.eroi[1]!.hero.vita;
    assert.ok(dopoFreccia < 120, 'la freccia è arrivata');
    assert.equal(viewDuello(d, 0).frecce[0], ARENA.frecce - 1);
    assert.ok(actDuello(d, 0, { t: 'slot', n: 1 }));
    assert.equal(d.s.eroi[0]!.hero.incanta, true);
    passi(d, 3, { ...fermo(), a: true, m: mira });
    passi(d, 90);
    assert.ok(d.s.eroi[1]!.hero.vita < dopoFreccia, 'la magia è arrivata');
    actDuello(d, 0, { t: 'slot', n: 0 });
    assert.equal(d.s.eroi[0]!.hero.frecce, ARENA.frecce - 1);
  });

  it('Cura e Furia: nel 1 contro 1 lo slot resta vuoto', () => {
    const e = buildArenaEroe(build([{ magia: 'cura_bomba' }, { arma: 'katana_ferro' }]));
    assert.ok(e.varianti[0], 'nella build c\'è');
    const d = createDuello({ seed: 1, eroi: [e, buildArenaEroe(katana)] });
    assert.equal(d.eroi[0]!.varianti[0], null, 'nel duello no');
    assert.equal(d.rt[0]!.slot, 1);
    assert.equal(actDuello(d, 0, { t: 'slot', n: 0 }), null);
  });

  it('i dungeon non cambiano: senza Arena l\'eroe non vede altri bersagli', () => {
    const s = Dungeon.create({ seed: 1, dungeon: 'grotta', hero: runHeroOf(newHero()) });
    assert.equal(s.pvp, undefined);
  });
});

describe('Arena — le ulti', () => {
  it('la carica sale col tempo e col danno, si lancia solo piena e resta tra i round', () => {
    const d = alVia(katana, katana);
    assert.equal(actDuello(d, 0, { t: 'ulti' }), null, 'vuota: non parte');
    passi(d, 60);
    const dopoUnSecondo = d.ul[0]!.carica;
    assert.ok(Math.abs(dopoUnSecondo - ARENA.ulti.carica.alSecondo) < 0.05, `un secondo di gioco (${dopoUnSecondo})`);
    passi(d, 4, { ...fermo(), a: true }); passi(d, 40);
    assert.ok(d.ul[0]!.carica > dopoUnSecondo + 1, 'il colpo dato carica');
    assert.ok(d.ul[1]!.carica > dopoUnSecondo, 'il colpo preso anche');
    piena(d, 0);
    assert.ok(actDuello(d, 0, { t: 'ulti' }));
    assert.equal(d.ul[0]!.carica, 0);
    assert.equal(actDuello(d, 0, { t: 'ulti' }), null, 'una volta sola');
    // fine round: la carica dell'altro resta
    const c1 = d.ul[1]!.carica;
    d.s.eroi[0]!.hero.vita = 0.5; d.s.eroi[0]!.hero.protetto = 0;
    passi(d, 4, fermo(), { ...fermo(), a: true }); passi(d, 60);
    for (let t = 0; t < PAUSA_TICKS + 2; t++) stepDuello(d, [fermo(), fermo()]);
    assert.equal(d.round, 1);
    assert.ok(d.ul[1]!.carica >= c1, `la carica resta (${c1} → ${d.ul[1]!.carica})`);
  });

  it('Furia: danni doppi per qualche secondo', () => {
    const colpo = (furia: boolean) => {
      const d = alVia(katana, katana);
      if (furia) { piena(d, 0); assert.ok(actDuello(d, 0, { t: 'ulti' })); }
      passi(d, 4, { ...fermo(), a: true }); passi(d, 40);
      return 120 - d.s.eroi[1]!.hero.vita;
    };
    const [x, y] = [colpo(false), colpo(true)];
    assert.ok(x > 0 && Math.abs(y - 2 * x) < 0.6, `normale ${x}, con Furia ${y}`);
  });

  it('Scatto: il doppio di passo e la corsa non stanca', () => {
    const corsa = (scatto: boolean) => {
      const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'scatto'), katana, 12);
      if (scatto) { piena(d, 0); actDuello(d, 0, { t: 'ulti' }); }
      const h = d.s.eroi[0]!.hero, x0 = h.x;
      passi(d, 30, { ...fermo(), mx: 1, b: true });
      return { dx: h.x - x0, st: h.stamina };
    };
    const [a, b] = [corsa(false), corsa(true)];
    assert.ok(b.dx > a.dx * 1.9, `${a.dx} → ${b.dx}`);
    assert.ok(b.st > a.st, 'con lo Scatto la corsa non consuma');
  });

  it('Aura: cura chi le sta vicino per qualche secondo', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'aura'), katana, 8);
    const h = d.s.eroi[0]!.hero; h.vita = 50;
    piena(d, 0); actDuello(d, 0, { t: 'ulti' });
    passi(d, 120);
    const U = arenaUlti('aura');
    assert.ok(h.vita > 50 + (U.cura ?? 0) * 1.5, `${h.vita}`);
    assert.equal(d.s.eroi[1]!.hero.vita, 120, 'l\'avversario no');
  });

  it('Raggio della Marea: fermo carica, poi colpisce chi è sulla linea', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'marea'), katana, 8);
    piena(d, 0); actDuello(d, 0, { t: 'ulti' });
    const h = d.s.eroi[0]!.hero, x0 = h.x;
    passi(d, 20, { ...fermo(), mx: -1 });
    assert.equal(h.x, x0, 'mentre carica sta fermo');
    passi(d, 120);
    assert.ok(d.s.eroi[1]!.hero.vita < 120 - 20, `${d.s.eroi[1]!.hero.vita}`);
  });

  it('Arpione: chi è preso viene tirato davanti e resta fermo un attimo', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'arpione'), katana, 8);
    piena(d, 0); actDuello(d, 0, { t: 'ulti' });
    let preso = false, vicino = 99, fermoDopo = false;
    const [a, b] = [d.s.eroi[0]!.hero, d.s.eroi[1]!.hero];
    for (let t = 0; t < 90 && d.fase === 'gioca'; t++) {
      const era = d.ul[0]!.fase === 'tiro';
      stepDuello(d, [fermo(), { ...fermo(), mx: 1 }]);
      preso ||= d.ul[0]!.fase === 'tiro'; vicino = Math.min(vicino, b.x - a.x);
      if (era && d.ul[0]!.fase === 'no') { const x = b.x; passi(d, 10, fermo(), { ...fermo(), mx: 1 }); fermoDopo = b.x === x; }
    }
    assert.ok(preso, 'l\'arpione ha preso');
    assert.ok(vicino < 1.3, `tirato vicino (${vicino})`);
    assert.ok(fermoDopo, 'e resta fermo un attimo');
    assert.ok(b.vita < 120);
  });

  it('Velo di nebbia: gli avversari non ti vedono, finché non attacchi', () => {
    const d = alVia(build([{ arma: 'katana_ferro' }, null], 'vita', 'velo'), katana, 8);
    piena(d, 0); actDuello(d, 0, { t: 'ulti' });
    passi(d, 2);
    assert.equal(visibileDa(d.s, 0, 1), false);
    assert.ok(viewDuello(d, 0).nascosto);
    assert.ok(viewDuello(d, 1).altri.find((x) => x.i === 0)!.nascosto);
    passi(d, 3, { ...fermo(), a: true });
    assert.equal(visibileDa(d.s, 0, 1), true, 'attaccando si scopre');
  });
});

/** Partita bot contro bot registrata come farebbe il client (input quantizzati, azioni col tick). */
function partita(a: ArenaBuild, b: ArenaBuild, seed: number, maxT = 40000) {
  const eroi = [buildArenaEroe(a), buildArenaEroe(b)];
  const d = createDuello({ seed, eroi }), rng = [createRng(seed + 1), createRng(seed + 2)];
  const frames: DungeonInput[][] = [[], []], azioni: ArenaAzioni = [];
  let maxColpo = 0, ulti = 0;
  for (let t = 0; t < maxT && d.fase !== 'finita'; t++) {
    const f = [0, 1].map((i) => {
      const x = botArena(d, i, rng[i]!);
      if (x.azione && actDuello(d, i, x.azione)) { azioni.push([d.tick, i, x.azione]); if (x.azione.t === 'ulti') ulti++; }
      return quantizeDungeon(x.input);
    });
    frames[0]!.push(f[0]!); frames[1]!.push(f[1]!);
    stepDuello(d, f);
    for (const e of d.s.eventi) if (e.t === 'colpo' && e.su === 'eroe') maxColpo = Math.max(maxColpo, e.danno);
  }
  return { d, eroi, log: { inputs: frames.map((x) => packDungeon(x)), azioni }, maxColpo, ulti };
}

describe('Arena — il duello al meglio di 3', () => {
  const forte = (arma: string, ulti: string) => build([{ arma }, { magia: 'fulmine' }], 'vita', ulti);

  it('bot contro bot: round con vincitore, ulti lanciate, partita a 2 round vinti, il replay del server dà lo stesso esito e lo stesso hash', () => {
    const p = partita(forte('spadone_ferro', 'arpione'), forte('martello_ferro', 'marea'), 11);
    assert.equal(p.d.fase, 'finita');
    assert.ok(p.d.esito);
    const { vincitore, vinti } = p.d.esito!;
    if (vincitore !== null) assert.equal(vinti[vincitore], ARENA.round.vittorie);
    assert.ok(p.d.rounds.length >= ARENA.round.vittorie && p.d.rounds.length <= ARENA.round.massimo);
    assert.ok(p.maxColpo < 100 && p.maxColpo <= RPG.arena.dannoMax, `nessun colpo da 100 (${p.maxColpo})`);
    assert.ok(p.ulti > 0, 'i gladiatori usano le ulti');
    const r = replayDuello(11, p.eroi, p.log);
    assert.deepEqual(r.esito, p.d.esito);
    assert.equal(r.ticks, p.d.tick);
    assert.equal(r.hash, hashDuello(p.d));
    const viaRete = replayDuello(11, JSON.parse(JSON.stringify(p.eroi)), JSON.parse(JSON.stringify(p.log)));
    assert.equal(viaRete.hash, r.hash);
  });

  it('round nuovo: vita, posizioni, slot e frecce tornano come all\'inizio, col conto alla rovescia', () => {
    const arco = build([{ arma: 'spadone_ferro' }, { arma: 'arco_ferro' }]);
    const d = alVia(arco, arco);
    actDuello(d, 0, { t: 'slot', n: 1 });
    d.s.eroi[1]!.hero.vita = 1;
    passi(d, 60, { ...fermo(), a: true, m: aimIndex(1, 0) });
    passi(d, 120);
    assert.equal(d.fase, 'pausa');
    assert.deepEqual(d.vinti, [1, 0]);
    assert.deepEqual(d.rounds[0], { vincitore: 0, perche: 'ko' });
    for (let t = 0; t < PAUSA_TICKS; t++) stepDuello(d, [fermo(), fermo()]);
    assert.equal(d.fase, 'conta');
    assert.equal(d.round, 1);
    const [x0, x1] = arenaMappa('colosseo').spawn.map((l) => l[0]!);
    assert.equal(d.s.eroi[0]!.hero.x, (x0![0] + 0.5) * 2);
    assert.equal(d.s.eroi[1]!.hero.x, (x1![0] + 0.5) * 2);
    assert.deepEqual(d.s.eroi.map((r) => r.hero.vita), [120, 120]);
    assert.equal(d.rt[0]!.slot, 0);
    assert.equal(viewDuello(d, 0).frecce[1], ARENA.frecce);
    const x = d.s.eroi[0]!.hero.x;
    stepDuello(d, [{ ...fermo(), mx: 1 }, fermo()]);
    assert.equal(d.s.eroi[0]!.hero.x, x, 'nel conto alla rovescia non ci si muove');
  });

  it('a tempo scaduto vince chi ha più vita; vita uguale = round pari; dopo il massimo dei round, pareggio', () => {
    const d = alVia(katana, katana);
    d.s.eroi[0]!.hero.vita = 50;
    for (let t = 0; t < ROUND_TICKS; t++) stepDuello(d, [fermo(), fermo()]);
    assert.deepEqual(d.rounds[0], { vincitore: 1, perche: 'tempo' });
    for (let t = 0; t < 40000 && d.fase !== 'finita'; t++) stepDuello(d, [fermo(), fermo()]);
    assert.equal(d.rounds.length, ARENA.round.massimo);
    assert.ok(d.rounds.slice(1).every((r) => r.vincitore === null && r.perche === 'pari'));
    assert.deepEqual(d.esito, { vincitore: 1, perche: 'round', vinti: [0, 1] });
  });

  it('la resa (anche quella che il server mette a chi ha perso la linea) chiude subito la partita', () => {
    const d = alVia(katana, katana);
    assert.ok(actDuello(d, 1, { t: 'resa' }));
    assert.deepEqual(d.esito, { vincitore: 0, perche: 'resa', vinti: [0, 0] });
    assert.equal(d.fase, 'finita');
    assert.equal(actDuello(d, 0, { t: 'slot', n: 1 }), null);
    const r = replayDuello(3, d.eroi, { inputs: [packDungeon([fermo()]), packDungeon([fermo()])], azioni: [[5, 0, { t: 'resa' }]] });
    assert.deepEqual(r.esito, { vincitore: 1, perche: 'resa', vinti: [0, 0] });
  });

  it('azioni dalla rete: solo forme valide', () => {
    assert.deepEqual(parseArenaAzione({ t: 'slot', n: 1 }), { t: 'slot', n: 1 });
    assert.deepEqual(parseArenaAzione({ t: 'ulti', x: 1 }), { t: 'ulti' });
    assert.deepEqual(parseArenaAzione({ t: 'resa', x: 1 }), { t: 'resa' });
    assert.equal(parseArenaAzione({ t: 'slot', n: ARENA.slot }), null);
    assert.equal(parseArenaAzione({ t: 'pozione', n: 0 }), null);
    assert.equal(parseArenaAzione({ t: 'equip' }), null);
  });
});

describe('Arena — premio', () => {
  it('monete per la partita vinta o persa, entro il tetto del giorno; il duello sbagliato non paga', () => {
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
    assert.equal(finishArena(lot, 'altro', 'vinta', 86_400_000 + 9).premio, 0, 'un duello che non è quello aperto non paga');
    const f = finishArena(lot, 'x', 'persa', 86_400_000 + 9);
    assert.equal(f.premio, P.persa);
    assert.equal(finishArena(startArena(f.lot, 'y', 0, 86_400_000 + 9), 'y', 'arreso', 86_400_000 + 10).premio, 0);
  });
});
