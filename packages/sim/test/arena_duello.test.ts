// Arena PvP (docs/ARENA.md): loadout del duello, colpi tra eroi (mischia, frecce, magie, evocazioni), Cura e Furia solo sui propri,
// round al meglio di 3 con conto alla rovescia, pareggio a tempo, resa, replay del server uguale al client, premio col tetto del giorno.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, validateArena } from '@marea/content/arena.ts';
import { RPG } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import type { LotState } from '../src/economy/types.ts';
import { heroOf, newHero, runHeroOf } from '../src/rpg/hero.ts';
import { applyRpgAction, parseRpgAction } from '../src/rpg/actions.ts';
import { buildArenaEroe, erroreLoadout, loadoutDi, possiedeZaino, pulisciLoadout } from '../src/rpg/arena.ts';
import type { ArenaLoadout, HeroState } from '../src/rpg/types.ts';
import { actDuello, createDuello, CONTA_TICKS, hashDuello, parseArenaAzione, PAUSA_TICKS, replayDuello, ROUND_TICKS, stepDuello, viewDuello } from '../src/arena/duello.ts';
import type { ArenaAzioni, DuelloState } from '../src/arena/duello.ts';
import { botArena } from '../src/arena/bot.ts';
import { arenaOf, finishArena, startArena } from '../src/arena/premio.ts';
import { createRng } from '../src/rng.ts';
import { packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { aimIndex } from '../src/dungeon/mira.ts';
import { dungeon as Dungeon } from '../src/dungeon/dungeon.ts';

const fermo = (): DungeonInput => ({ ...NO_DUNGEON_INPUT });
/** Un eroe con queste cose nello zaino e queste magie, e il set dato. */
function eroe(inv: Record<string, number>, magie: string[], l: ArenaLoadout): HeroState {
  const h = newHero();
  h.inv = { ...h.inv, ...inv }; h.magie = [...new Set([...h.magie, ...magie])];
  assert.equal(erroreLoadout(h, l, possiedeZaino(h)), null);
  h.arena = l;
  return h;
}
const set = (slot: ArenaLoadout['slot'], pozioni: ArenaLoadout['pozioni'] = [null, null], corpo = 'armatura_legno'): ArenaLoadout => ({ corpo, slot, pozioni });
/** Duello già al via (passato il conto alla rovescia), eroi uno davanti all'altro a `dist` m. */
function alVia(a: HeroState, b: HeroState, dist = 1.2, seed = 3): DuelloState {
  const d = createDuello({ seed, eroi: [buildArenaEroe(a, a.arena!), buildArenaEroe(b, b.arena!)] });
  for (let t = 0; t < CONTA_TICKS; t++) stepDuello(d, [fermo(), fermo()]);
  assert.equal(d.fase, 'gioca');
  const [h0, h1] = [d.s.eroi[0]!.hero, d.s.eroi[1]!.hero];
  h0.x = 14; h0.z = 7; h0.fx = 1; h0.fz = 0; // la riga 3 della mappa è tutta libera
  h1.x = 14 + dist; h1.z = 7; h1.fx = -1; h1.fz = 0;
  return d;
}
function passi(d: DuelloState, n: number, f0: DungeonInput = fermo(), f1: DungeonInput = fermo()): void {
  for (let t = 0; t < n && d.fase === 'gioca'; t++) stepDuello(d, [f0, f1]);
}

describe('Arena — loadout del duello', () => {
  it('i dati dell\'Arena sono validi e la mappa è chiusa e simmetrica', () => {
    assert.deepEqual(validateArena(), []);
  });

  it('il set di partenza viene dall\'equipaggiamento e si salva col personaggio senza toccare zaino e dungeon', () => {
    const lot = { ...newLot('a', 0), hero: newHero() };
    const h0 = heroOf(lot), l = loadoutDi(h0);
    assert.equal(l.slot.length, ARENA.slot);
    assert.equal(l.pozioni.length, ARENA.pozioni);
    assert.deepEqual(l.slot[0], { arma: 'katana_legno' });
    assert.deepEqual(l.slot[1], { arma: 'arco_legno', frecce: 'frecce_legno' });
    assert.deepEqual(l.slot[2], { magia: 'fiammata' });
    const nuovo: ArenaLoadout = { corpo: 'armatura_legno', slot: [{ magia: 'fiammata' }, { arma: 'arco_legno' }, null, { arma: 'katana_legno' }], pozioni: ['pozione_vita_minore', null] };
    const a = parseRpgAction({ t: 'arena', loadout: nuovo });
    assert.ok(a);
    const dopo = applyRpgAction(lot, a, 1000);
    assert.deepEqual(dopo.hero!.arena, nuovo);
    assert.deepEqual(dopo.hero!.inv, h0.inv, 'lo zaino non cambia');
    assert.deepEqual(dopo.hero!.equip, h0.equip, 'l\'equipaggiamento dei dungeon non cambia');
    assert.deepEqual(runHeroOf(dopo.hero!), runHeroOf(h0), 'la fotografia dei dungeon è la stessa');
    // quello che non hai non si mette
    assert.throws(() => applyRpgAction(lot, { t: 'arena', loadout: { ...nuovo, slot: [{ arma: 'spadone_meteorite' }, null, null, null] } }, 1000), /Non hai/);
    assert.throws(() => applyRpgAction(lot, { t: 'arena', loadout: { ...nuovo, slot: [{ magia: 'golem_evocato' }, null, null, null] } }, 1000), /magia/);
    assert.throws(() => applyRpgAction(lot, { t: 'arena', loadout: { ...nuovo, slot: [null, null, null, null] } }, 1000), /almeno/);
    assert.equal(parseRpgAction({ t: 'arena', loadout: { slot: [{ arma: 3 }], pozioni: [] } }), null);
    // venduto l'arco dopo averlo messo nel set: all'inizio del duello lo slot si svuota
    const senza = { ...dopo.hero!, inv: { ...dopo.hero!.inv, arco_legno: 0 } };
    assert.equal(pulisciLoadout(senza, nuovo, possiedeZaino(senza)).slot[1], null);
  });

  it('la fotografia del duello: una RunHero arena per slot, frecce legate all\'arco, pozioni una a testa', () => {
    const h = eroe({ arco_ferro: 1, frecce_ferro: 3, pozione_vita: 1 }, ['cura_bomba'], set([{ arma: 'katana_legno' }, { arma: 'arco_ferro', frecce: 'frecce_ferro' }, { magia: 'cura_bomba' }, null], ['pozione_vita', 'pozione_vita_minore']));
    const e = buildArenaEroe(h, h.arena!);
    assert.equal(e.varianti.length, 4);
    assert.equal(e.varianti[3], null);
    for (const v of e.varianti.slice(0, 3)) { assert.ok(v?.arena); assert.deepEqual(v!.max, RPG.arena.attributi); }
    assert.equal(e.varianti[0]!.arma.id, 'katana_legno');
    assert.equal(e.varianti[1]!.arma.kind, 'arco');
    assert.equal(e.varianti[1]!.frecce?.id, 'frecce_ferro');
    assert.equal(e.varianti[1]!.frecce?.n, ARENA.frecce, 'frecce fuori dagli slot, tante quante dice arena.json (non quelle dello zaino)');
    assert.ok(e.varianti[2]!.manoMagia);
    assert.equal(e.varianti[2]!.magie[e.varianti[2]!.magia!]!.id, 'cura_bomba');
    assert.deepEqual(e.pozioni.map((p) => [p.id, p.n]), [['pozione_vita', 1], ['pozione_vita_minore', 1]]);
  });
});

describe('Arena — combattimento tra eroi', () => {
  const lama = () => eroe({ spadone_ferro: 1 }, [], set([{ arma: 'spadone_ferro' }, null, null, null]));

  it('la mischia colpisce l\'avversario, mai un colpo solo che uccide', () => {
    const d = alVia(lama(), lama());
    passi(d, 4, { ...fermo(), a: true });
    passi(d, 60);
    const v1 = d.s.eroi[1]!.hero.vita;
    assert.ok(v1 < 100 && v1 > 8, `colpito ma vivo (${v1})`);
    // caricato al massimo, anche col tetto: mai 100 in un colpo
    const e = d.s.eroi[1]!;
    e.hero.vita = 100;
    passi(d, 200, { ...fermo(), a: true });
    passi(d, 60);
    assert.ok(e.hero.vita > 0 && e.hero.vita >= 100 - (RPG.arena.dannoMax) - 1, `niente one-shot (${e.hero.vita})`);
  });

  it('frecce e magie colpiscono l\'avversario; l\'arco consuma solo le sue frecce', () => {
    const h = eroe({ arco_ferro: 1 }, [], set([{ arma: 'arco_ferro' }, { magia: 'fiammata' }, null, null]));
    const d = alVia(h, lama(), 6);
    const mira = aimIndex(1, 0);
    passi(d, 70, { ...fermo(), a: true, m: mira });
    passi(d, 90);
    const dopoFreccia = d.s.eroi[1]!.hero.vita;
    assert.ok(dopoFreccia < 100, 'la freccia è arrivata');
    assert.equal(viewDuello(d, 0).frecce[0], ARENA.frecce - 1);
    assert.ok(actDuello(d, 0, { t: 'slot', n: 1 }));
    assert.equal(d.s.eroi[0]!.hero.incanta, true);
    passi(d, 3, { ...fermo(), a: true, m: mira });
    passi(d, 90);
    assert.ok(d.s.eroi[1]!.hero.vita < dopoFreccia, 'la magia è arrivata');
    // tornando all'arco le frecce sono quelle rimaste
    actDuello(d, 0, { t: 'slot', n: 0 });
    assert.equal(d.s.eroi[0]!.hero.frecce, ARENA.frecce - 1);
  });

  it('le evocazioni attaccano l\'eroe avversario (e le sue evocazioni sono bersagli)', () => {
    const h = eroe({}, ['lupo_spettrale'], set([{ magia: 'lupo_spettrale' }, null, null, null]));
    const d = alVia(h, lama(), 7);
    passi(d, 3, { ...fermo(), a: true, m: aimIndex(1, 0) });
    passi(d, 3);
    const lupo = d.s.enemies.find((e) => e.alleato && e.st !== 'morto');
    assert.ok(lupo, 'il lupo è evocato');
    let presi = 0;
    for (let t = 0; t < 600 && d.fase === 'gioca'; t++) { stepDuello(d, [fermo(), fermo()]); for (const e of d.s.eventi) if (e.t === 'colpo' && e.su === 'eroe' && e.eroe === 1) presi++; }
    assert.ok(presi > 0, 'il lupo morde l\'avversario');
    assert.ok(d.s.eroi[0]!.hero.vita === 100 || d.s.eroi[0]!.hero.vita > 99, 'e non il suo padrone');
  });

  it('Cura e Furia valgono su di sé e sui propri, mai sull\'avversario', () => {
    const h = eroe({}, ['cura_bomba', 'furia_flusso'], set([{ magia: 'cura_bomba' }, { magia: 'furia_flusso' }, null, null]));
    const d = alVia(h, lama(), 1.5);
    d.s.eroi[0]!.hero.vita = 40; d.s.eroi[1]!.hero.vita = 40;
    passi(d, 3, { ...fermo(), a: true });
    passi(d, 120);
    assert.ok(d.s.eroi[0]!.hero.vita > 60, `la Cura a bomba cade ai piedi di chi la lancia (${d.s.eroi[0]!.hero.vita})`);
    assert.ok(d.s.eroi[1]!.hero.vita < 45, `e non cura l'avversario (${d.s.eroi[1]!.hero.vita})`);
    actDuello(d, 0, { t: 'slot', n: 1 });
    passi(d, 40, { ...fermo(), a: true });
    assert.ok(d.s.eroi[0]!.hero.buffs.some((b) => b.mod === 'furiaDanno'), 'Furia a flusso su di sé');
    assert.ok(!d.s.eroi[1]!.hero.buffs.some((b) => b.mod === 'furiaDanno'), 'mai sull\'avversario');
  });

  it('le pozioni rapide: una a testa per round, solo mentre si gioca', () => {
    const h = eroe({ pozione_vita: 1 }, [], set([{ arma: 'katana_legno' }, null, null, null], ['pozione_vita', 'pozione_vita_minore']));
    const d = alVia(h, lama());
    d.s.eroi[0]!.hero.vita = 30;
    assert.ok(actDuello(d, 0, { t: 'pozione', n: 0 }));
    assert.ok(d.s.eroi[0]!.hero.vita > 30);
    assert.equal(actDuello(d, 0, { t: 'pozione', n: 0 }), null, 'già bevuta');
    assert.ok(actDuello(d, 0, { t: 'pozione', n: 1 }));
    assert.equal(d.s.eroi[0]!.hero.pozioni, 0);
    assert.equal(actDuello(d, 0, { t: 'pozione', n: 3 }), null);
  });

  it('i dungeon non cambiano: senza Arena l\'eroe non vede altri bersagli e la scala si usa', () => {
    const s = Dungeon.create({ seed: 1, dungeon: 'grotta', hero: runHeroOf(newHero()) });
    assert.equal(s.pvp, undefined);
  });
});

/** Partita bot contro bot registrata come farebbe il client (input quantizzati, azioni col tick). */
function partita(a: HeroState, b: HeroState, seed: number, maxT = 40000) {
  const eroi = [buildArenaEroe(a, a.arena!), buildArenaEroe(b, b.arena!)];
  const d = createDuello({ seed, eroi }), rng = [createRng(seed + 1), createRng(seed + 2)];
  const frames: DungeonInput[][] = [[], []], azioni: ArenaAzioni = [];
  let maxColpo = 0;
  for (let t = 0; t < maxT && d.fase !== 'finita'; t++) {
    const f = [0, 1].map((i) => {
      const x = botArena(d, i, rng[i]!);
      if (x.azione && actDuello(d, i, x.azione)) azioni.push([d.tick, i, x.azione]);
      return quantizeDungeon(x.input);
    });
    frames[0]!.push(f[0]!); frames[1]!.push(f[1]!);
    stepDuello(d, f);
    for (const e of d.s.eventi) if (e.t === 'colpo' && e.su === 'eroe') maxColpo = Math.max(maxColpo, e.danno);
  }
  return { d, eroi, log: { inputs: frames.map((x) => packDungeon(x)), azioni }, maxColpo };
}

describe('Arena — il duello al meglio di 3', () => {
  const forte = (arma: string) => eroe({ [arma]: 1, armatura_ferro: 1, arco_ferro: 1, pozione_vita: 1 }, ['fulmine'], set([{ arma }, { arma: 'arco_ferro' }, { magia: 'fulmine' }, null], ['pozione_vita', null], 'armatura_ferro'));

  it('bot contro bot: round con vincitore, partita a 2 round vinti, il replay del server dà lo stesso esito e lo stesso hash', () => {
    const p = partita(forte('spadone_ferro'), forte('martello_ferro'), 11);
    assert.equal(p.d.fase, 'finita');
    assert.ok(p.d.esito);
    const { vincitore, vinti } = p.d.esito!;
    assert.ok(vincitore === 0 || vincitore === 1 || vincitore === null);
    if (vincitore !== null) assert.equal(vinti[vincitore], ARENA.round.vittorie);
    assert.ok(p.d.rounds.length >= ARENA.round.vittorie && p.d.rounds.length <= ARENA.round.massimo);
    assert.ok(p.maxColpo < 100 && p.maxColpo <= RPG.arena.dannoMax, `nessun colpo da 100 (${p.maxColpo})`);
    const r = replayDuello(11, p.eroi, p.log);
    assert.deepEqual(r.esito, p.d.esito);
    assert.equal(r.ticks, p.d.tick);
    assert.equal(r.hash, hashDuello(p.d));
    // anche passando dal JSON (come arriva al server)
    const viaRete = replayDuello(11, JSON.parse(JSON.stringify(p.eroi)), JSON.parse(JSON.stringify(p.log)));
    assert.equal(viaRete.hash, r.hash);
  });

  it('round nuovo: vita, posizioni, slot, frecce e pozioni tornano come all\'inizio, col conto alla rovescia', () => {
    const d = alVia(forte('spadone_ferro'), forte('spadone_ferro'));
    actDuello(d, 0, { t: 'slot', n: 1 });
    actDuello(d, 0, { t: 'pozione', n: 0 });
    d.s.eroi[1]!.hero.vita = 1;
    passi(d, 30); // finisce di bere
    passi(d, 60, { ...fermo(), a: true, m: aimIndex(1, 0) });
    passi(d, 120);
    assert.equal(d.fase, 'pausa');
    assert.deepEqual(d.vinti, [1, 0]);
    assert.deepEqual(d.rounds[0], { vincitore: 0, perche: 'ko' });
    for (let t = 0; t < PAUSA_TICKS; t++) stepDuello(d, [fermo(), fermo()]);
    assert.equal(d.fase, 'conta');
    assert.equal(d.round, 1);
    const [x0, x1] = ARENA.mappa.spawn;
    assert.equal(d.s.eroi[0]!.hero.x, (x0![0] + 0.5) * 2);
    assert.equal(d.s.eroi[1]!.hero.x, (x1![0] + 0.5) * 2);
    assert.deepEqual(d.s.eroi.map((r) => r.hero.vita), [100, 100]);
    assert.equal(d.rt[0]!.slot, 0);
    assert.deepEqual(d.rt[0]!.bevute, [false]);
    assert.equal(viewDuello(d, 0).frecce[1], ARENA.frecce);
    // nel conto alla rovescia non ci si muove
    const x = d.s.eroi[0]!.hero.x;
    stepDuello(d, [{ ...fermo(), mx: 1 }, fermo()]);
    assert.equal(d.s.eroi[0]!.hero.x, x);
  });

  it('a tempo scaduto vince chi ha più vita; vita uguale = round pari; dopo il massimo dei round, pareggio', () => {
    const d = alVia(forte('spadone_ferro'), forte('spadone_ferro'));
    d.s.eroi[0]!.hero.vita = 50;
    for (let t = 0; t < ROUND_TICKS; t++) stepDuello(d, [fermo(), fermo()]);
    assert.deepEqual(d.rounds[0], { vincitore: 1, perche: 'tempo' });
    // gli altri round tutti fermi: pari
    for (let t = 0; t < 40000 && d.fase !== 'finita'; t++) stepDuello(d, [fermo(), fermo()]);
    assert.equal(d.rounds.length, ARENA.round.massimo);
    assert.ok(d.rounds.slice(1).every((r) => r.vincitore === null && r.perche === 'pari'));
    assert.deepEqual(d.esito, { vincitore: 1, perche: 'round', vinti: [0, 1] });
  });

  it('la resa (anche quella che il server mette a chi ha perso la linea) chiude subito la partita', () => {
    const d = alVia(forte('spadone_ferro'), forte('spadone_ferro'));
    assert.ok(actDuello(d, 1, { t: 'resa' }));
    assert.deepEqual(d.esito, { vincitore: 0, perche: 'resa', vinti: [0, 0] });
    assert.equal(d.fase, 'finita');
    assert.equal(actDuello(d, 0, { t: 'slot', n: 1 }), null);
    // nel replay la resa dopo l'ultimo input conta lo stesso
    const eroi = d.eroi;
    const r = replayDuello(3, eroi, { inputs: [packDungeon([fermo()]), packDungeon([fermo()])], azioni: [[5, 0, { t: 'resa' }]] });
    assert.deepEqual(r.esito, { vincitore: 1, perche: 'resa', vinti: [0, 0] });
  });

  it('azioni dalla rete: solo forme valide', () => {
    assert.deepEqual(parseArenaAzione({ t: 'slot', n: 2 }), { t: 'slot', n: 2 });
    assert.deepEqual(parseArenaAzione({ t: 'resa', x: 1 }), { t: 'resa' });
    assert.equal(parseArenaAzione({ t: 'slot', n: ARENA.slot }), null);
    assert.equal(parseArenaAzione({ t: 'pozione', n: 1.5 }), null);
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
    // il giorno dopo si riparte
    lot = startArena(lot, 'x', 1, 86_400_000 + 5);
    assert.equal(finishArena(lot, 'altro', 'vinta', 86_400_000 + 9).premio, 0, 'un duello che non è quello aperto non paga');
    const f = finishArena(lot, 'x', 'persa', 86_400_000 + 9);
    assert.equal(f.premio, P.persa);
    assert.equal(finishArena(startArena(f.lot, 'y', 0, 86_400_000 + 9), 'y', 'arreso', 86_400_000 + 10).premio, 0);
  });
});
