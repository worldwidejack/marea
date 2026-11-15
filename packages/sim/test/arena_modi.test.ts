// Le quattro modalità dell'Arena (docs/ARENA.md): Sopravvivenza (casse, monete rosse, nube tossica, ultimo in piedi, posti), Caccia alle
// stelle (taglie, stelle alla squadra, rinascita), Controllo (zone, contesa, conquista), Rapinatori (casseforti, chi vince a tempo); poi partite
// intere di soli gladiatori automatici in ogni modalità, col replay del server che dà lo stesso esito e lo stesso hash.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, arenaMappa, arenaModo, eroiDi } from '@marea/content/arena.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import { buildArenaEroe } from '../src/rpg/arena.ts';
import { botBuildCasuale } from '../src/rpg/arena_bot.ts';
import type { ArenaBuild } from '../src/rpg/types.ts';
import { actPartita, CONTA_TICKS, createPartita, formatoDi, hashPartita, partenza, replayPartita, RINASCITA_TICKS, stepPartita, viewPartita } from '../src/arena/partita.ts';
import type { ArenaAzioni, PartitaState } from '../src/arena/partita.ts';
import { botArena } from '../src/arena/bot.ts';
import { createRng } from '../src/rng.ts';
import { packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { secToTicks } from '../src/dungeon/state.ts';

const fermo = (): DungeonInput => ({ ...NO_DUNGEON_INPUT });
const spadone: ArenaBuild = { dote: 'vita', slot: [{ arma: 'spadone_ferro' }, null], ulti: 'furia' };
/** Una partita già al via, tutti con lo spadone. */
function alVia(modo: ArenaModo, per: number, seed = 5): PartitaState {
  const f = formatoDi(modo, per, seed), eroi = Array.from({ length: eroiDi(arenaModo(modo), per) }, () => buildArenaEroe(spadone));
  const d = createPartita({ seed, eroi, ...f });
  for (let t = 0; t < CONTA_TICKS; t++) stepPartita(d, eroi.map(fermo));
  assert.equal(d.fase, 'gioca');
  return d;
}
const passi = (d: PartitaState, n: number, f: (i: number) => DungeonInput = fermo) => { for (let t = 0; t < n && d.fase === 'gioca'; t++) stepPartita(d, d.eroi.map((_, i) => f(i))); };
/** Mette l'eroe i in (x, z) m, girato verso +x. */
const posa = (d: PartitaState, i: number, x: number, z: number) => { const h = d.s.eroi[i]!.hero; h.x = x; h.z = z; h.fx = 1; h.fz = 0; };
/** L'eroe i a terra, buttato giù da j (-1 = da nessuno). */
const abbatti = (d: PartitaState, i: number, j = -1) => { const r = d.s.eroi[i]!; r.hero.vita = 0; r.done = true; r.outcome = 'morto'; d.s.pvp!.ultimo![i] = j; };
const nemico = (d: PartitaState, id: number) => d.s.enemies.find((e) => e.id === id)!;

describe('Arena — formati e mappe', () => {
  it('ogni modalità ha la sua mappa nuova, le squadre in fila e le partenze giuste', () => {
    for (const m of ARENA.modi.lista) for (const per of m.per) {
      const d = alVia(m.id, per);
      assert.equal(d.eroi.length, eroiDi(m, per));
      assert.equal(d.nSquadre, d.eroi.length / per);
      assert.deepEqual(d.squadre, d.eroi.map((_, i) => Math.floor(i / per)));
      assert.ok(arenaMappa(d.mappa).modi.includes(m.id));
      // ognuno alla sua partenza, nessuno sopra un altro
      const visti = new Set(d.s.eroi.map((r) => `${r.hero.x},${r.hero.z}`));
      assert.equal(visti.size, d.eroi.length, `${m.id} da ${per}: partenze tutte diverse`);
      const [cx, cz] = partenza(arenaMappa(d.mappa), d.nSquadre, per, d.squadre[d.eroi.length - 1]!, per - 1);
      assert.equal(d.s.eroi[d.eroi.length - 1]!.hero.x, (cx + 0.5) * 2);
      assert.equal(d.s.eroi[d.eroi.length - 1]!.hero.z, (cz + 0.5) * 2);
    }
    assert.deepEqual(ARENA.mappe.map((m) => m.id).sort(), ['forte', 'naufragio', 'osservatorio', 'porto']);
  });
});

describe('Arena — Sopravvivenza', () => {
  it('le casse si rompono e lasciano monete rosse; chi le raccoglie ha più Vita e fa più danno', () => {
    const d = alVia('sopravvivenza', 1), S = arenaModo('sopravvivenza');
    assert.ok(d.casse.length >= 10, `casse sparse sulla mappa (${d.casse.length})`);
    const c = nemico(d, d.casse[0]!);
    posa(d, 0, c.x - 1.4, c.z);
    for (let t = 0; t < 600 && c.st !== 'morto'; t++) passi(d, 1, (i) => (i === 0 ? { ...fermo(), a: t % 50 < 3 } : fermo()));
    assert.equal(c.st, 'morto', 'la cassa è rotta');
    passi(d, 1);
    assert.ok(d.mucchi.length || d.rosse[0], 'una moneta rossa a terra (o già presa)');
    const vita0 = d.s.eroi[0]!.runHero.max.vita;
    posa(d, 0, c.x, c.z);
    passi(d, 2);
    assert.equal(d.rosse[0], S.cassa!.monete, 'raccolta');
    assert.equal(viewPartita(d, 0).segno, S.cassa!.monete, 'il numero sopra la testa');
    assert.ok(Math.abs(d.s.eroi[0]!.runHero.max.vita - vita0 * (1 + S.rossa!.vita)) < 1e-6, 'più Vita massima');
    assert.ok(d.s.eroi[0]!.hero.buffs.some((b) => b.mod === 'furiaDanno' && Math.abs(b.valore - S.rossa!.danno) < 1e-9), 'più danno');
  });

  it('chi cade lascia tutte le sue monete rosse a terra; l\'ultimo in piedi vince, gli altri hanno il loro posto', () => {
    const d = alVia('sopravvivenza', 1);
    d.rosse[3] = 4;
    abbatti(d, 3, 1);
    passi(d, 1);
    assert.equal(d.rosse[3], 0);
    assert.ok(d.mucchi.some((m) => m.n === 4), 'le 4 monete sono a terra');
    assert.equal(d.punti[3], 10, 'il primo che esce è decimo');
    passi(d, RINASCITA_TICKS + 5);
    assert.ok(d.s.eroi[3]!.done, 'nella Sopravvivenza non si rinasce');
    for (let i = 2; i < 10; i++) if (i !== 3) abbatti(d, i);
    passi(d, 1);
    assert.equal(d.fase, 'gioca', 'ne restano due');
    abbatti(d, 1);
    passi(d, 1);
    assert.equal(d.fase, 'finita');
    assert.equal(d.esito?.vincitore, 0); assert.equal(d.esito?.perche, 'ultimo');
    assert.equal(d.esito?.punti[0], 1); assert.equal(d.esito?.punti[1], 2);
  });

  it('in coppia: la squadra esce quando cadono tutti e due', () => {
    const d = alVia('sopravvivenza', 2);
    assert.equal(d.nSquadre, 5);
    abbatti(d, 0);
    passi(d, 1);
    assert.equal(d.punti[0], 0, 'il compagno è ancora in piedi');
    abbatti(d, 1);
    passi(d, 1);
    assert.equal(d.punti[0], 5, 'fuori per prima: quinta');
  });

  it('la nube si stringe dal bordo verso il centro e fa male a chi resta fuori', () => {
    const d = alVia('sopravvivenza', 1), N = arenaModo('sopravvivenza').nube!, c = viewPartita(d, 0).nube!;
    for (let i = 1; i < 10; i++) posa(d, i, c.x - 1 + (i % 3), c.z - 1 + Math.floor(i / 3) * 0.7); // gli altri al centro, al riparo
    const r0 = d.nube;
    d.faseT = secToTicks(N.inizio) - 5; passi(d, 1);
    assert.equal(d.nube, r0, 'all\'inizio copre tutta la mappa');
    d.faseT = secToTicks(N.inizio + 80); passi(d, 1);
    assert.ok(d.nube < r0 && d.nube < 24, `si stringe (${r0} → ${d.nube})`);
    // uno verso il bordo della mappa, fuori dal cerchio: perde vita
    const h = d.s.eroi[0]!.hero, v0 = h.vita;
    posa(d, 0, 4 * 2 + 1, 13 * 2 + 1);
    passi(d, 60);
    assert.ok(h.vita < v0 - N.dps * 0.8, `la nube morde (${v0} → ${h.vita})`);
    assert.ok(d.s.eroi.slice(1).every((r) => r.hero.vita === r.runHero.max.vita), 'chi sta dentro no');
    assert.equal(viewPartita(d, 0).nube!.r, Math.round(d.nube * 100) / 100);
    d.faseT = secToTicks(N.fine) + 10; passi(d, 1);
    assert.equal(d.nube, N.raggio, 'alla fine resta il cerchio piccolo');
  });
});

describe('Arena — Caccia alle stelle', () => {
  it('chi butta giù prende le stelle della taglia per la squadra e la sua taglia sale fino al massimo; chi cade riparte da capo', () => {
    const d = alVia('stelle', 3), S = arenaModo('stelle').stelle!;
    assert.deepEqual(d.taglia, d.eroi.map(() => S.inizio));
    abbatti(d, 3, 0);
    passi(d, 1);
    assert.equal(d.punti[0], S.inizio, 'le stelle della taglia di 3');
    assert.equal(d.taglia[0], S.inizio + 1, 'la taglia di 0 sale');
    assert.equal(d.ko[0], 1);
    for (let k = 0; k < 10; k++) { d.s.eroi[4]!.done = false; d.giu[4] = false; d.torna[4] = 0; abbatti(d, 4, 0); passi(d, 1); }
    assert.equal(d.taglia[0], S.max, 'fino al massimo');
    abbatti(d, 0, 5);
    passi(d, 1);
    assert.equal(d.punti[1], S.max, 'la taglia piena va all\'altra squadra');
    assert.equal(d.taglia[0], S.inizio, 'e riparte da capo');
  });

  it('chi cade rinasce alla sua partenza dopo qualche secondo, intoccabile per un attimo', () => {
    const d = alVia('stelle', 3);
    posa(d, 3, 30, 17);
    abbatti(d, 3, 0);
    passi(d, 1);
    assert.equal(viewPartita(d, 3).torna, Math.ceil(RINASCITA_TICKS / 60));
    passi(d, RINASCITA_TICKS);
    const r = d.s.eroi[3]!, [cx, cz] = partenza(arenaMappa(d.mappa), 2, 3, 1, 0);
    assert.equal(r.done, false);
    assert.equal(r.hero.x, (cx + 0.5) * 2); assert.equal(r.hero.z, (cz + 0.5) * 2);
    assert.equal(r.hero.vita, r.runHero.max.vita);
    assert.ok(r.hero.protetto > 0, 'appena rinato non lo si colpisce');
  });

  it('a tempo scaduto vince chi ha più stelle; uguali = pari', () => {
    const d = alVia('stelle', 3);
    d.punti = [5, 3];
    passi(d, secToTicks(arenaModo('stelle').secondi));
    assert.deepEqual(d.esito, { vincitore: 0, perche: 'tempo', punti: [5, 3] });
    const e = alVia('stelle', 3);
    passi(e, secToTicks(arenaModo('stelle').secondi));
    assert.equal(e.esito?.vincitore, null);
  });
});

describe('Arena — Controllo', () => {
  it('la zona sale solo per chi ci sta senza avversari; contesa non sale; a 100 è conquistata; prese tutte si vince', () => {
    const d = alVia('controllo', 3), Z = arenaModo('controllo').zona!;
    assert.ok(d.zone.length >= 2, 'due zone');
    const [z1, z2] = d.zone as [typeof d.zone[0], typeof d.zone[0]];
    posa(d, 0, z1.x, z1.z);
    passi(d, 60);
    assert.ok(Math.abs(z1.prog[0]! - Z.alSecondo) < 0.05, `un secondo: ${z1.prog[0]}`);
    posa(d, 3, z1.x + 1, z1.z);
    const p = z1.prog[0]!;
    passi(d, 60, (i) => (i === 0 || i === 3 ? { ...fermo() } : fermo()));
    assert.equal(z1.prog[0], p, 'contesa: ferma');
    assert.equal(z1.prog[1], 0);
    assert.deepEqual(viewPartita(d, 0).zone[0]!.dentro.sort(), [0, 1]);
    posa(d, 3, 6, 6);
    z1.prog[0] = 99.9;
    passi(d, 10);
    assert.equal(z1.di, 0, 'conquistata');
    assert.equal(d.punti[0], 50, 'metà delle zone');
    posa(d, 0, z2.x, z2.z);
    z2.prog[0] = 99.9;
    passi(d, 10);
    assert.equal(d.fase, 'finita');
    assert.equal(d.esito?.vincitore, 0); assert.equal(d.esito?.perche, 'zone');
  });
});

describe('Arena — Rapinatori', () => {
  it('la propria cassaforte non si colpisce, quella avversaria sì; rotta, vince chi l\'ha rotta', () => {
    const d = alVia('rapina', 3);
    const mia = nemico(d, d.casseforti[0]!), sua = nemico(d, d.casseforti[1]!);
    assert.equal(mia.max, arenaModo('rapina').cassaforte!.vita);
    const colpisci = (c: typeof mia) => { posa(d, 0, c.x - 1.6, c.z); const v = c.vita; passi(d, 90, (i) => (i === 0 ? { ...fermo(), a: true } : fermo())); passi(d, 30); return v - c.vita; };
    assert.equal(colpisci(mia), 0, 'la mia no');
    assert.ok(colpisci(sua) > 0, 'la sua sì');
    assert.ok(d.punti[1]! < 100 && d.punti[0] === 100, `punti in % (${d.punti})`);
    sua.vita = 1; d.s.eroi[0]!.hero.stamina = 100;
    passi(d, 6, (i) => (i === 0 ? { ...fermo(), a: true } : fermo())); passi(d, 60);
    assert.equal(d.fase, 'finita');
    assert.equal(d.esito?.vincitore, 0); assert.equal(d.esito?.perche, 'cassaforte');
  });

  it('a tempo scaduto vince chi ha la cassaforte più integra', () => {
    const d = alVia('rapina', 2);
    nemico(d, d.casseforti[0]!).vita *= 0.5;
    passi(d, secToTicks(arenaModo('rapina').secondi));
    assert.equal(d.esito?.vincitore, 1); assert.equal(d.esito?.perche, 'tempo');
  });
});

/** Partita di soli gladiatori automatici con build a caso, registrata come fa il client (input quantizzati, azioni col tick). */
function partita(modo: ArenaModo, per: number, seed: number) {
  const f = formatoDi(modo, per, seed), n = eroiDi(arenaModo(modo), per);
  const eroi = Array.from({ length: n }, (_, k) => buildArenaEroe(botBuildCasuale(createRng(seed).fork('bot' + k), per > 1)));
  const d = createPartita({ seed, eroi, ...f }), rng = eroi.map((_, i) => createRng(seed + 1 + i));
  const frames: DungeonInput[][] = eroi.map(() => []), azioni: ArenaAzioni = [];
  let ko = 0, rinati = 0;
  for (let t = 0; t < 40000 && d.fase !== 'finita'; t++) {
    const q = eroi.map((_, i) => {
      const x = botArena(d, i, rng[i]!);
      if (x.azione && actPartita(d, i, x.azione)) azioni.push([d.tick, i, x.azione]);
      return quantizeDungeon(x.input);
    });
    q.forEach((x, i) => frames[i]!.push(x));
    stepPartita(d, q);
    for (const e of d.eventi) { if (e.t === 'ko') ko++; if (e.t === 'rinasce') rinati++; }
  }
  return { d, eroi, f, log: { inputs: frames.map((x) => packDungeon(x)), azioni }, ko, rinati };
}

describe('Arena — partite intere di gladiatori', () => {
  for (const [modo, per, seed] of [['sopravvivenza', 1, 3], ['sopravvivenza', 2, 4], ['stelle', 3, 5], ['controllo', 3, 6], ['rapina', 2, 7], ['rapina', 3, 8]] as const) {
    it(`${modo} da ${per}: si gioca fino in fondo e il replay del server dà lo stesso esito e lo stesso hash`, () => {
      const p = partita(modo, per, seed);
      assert.equal(p.d.fase, 'finita');
      assert.ok(p.d.esito);
      assert.ok(p.ko > 0, 'qualcuno cade');
      if (arenaModo(modo).rinasce) assert.ok(p.rinati > 0, 'e rinasce');
      if (modo === 'sopravvivenza') assert.ok(p.d.casse.length < nemiciCasse(modo), 'le casse si rompono');
      if (modo === 'stelle') assert.ok(p.d.punti[0]! + p.d.punti[1]! > 0, 'si prendono stelle');
      if (modo === 'controllo') assert.ok(p.d.zone.some((z) => z.prog.some((x) => x > 0)), 'si conquista');
      const r = replayPartita(seed, p.eroi, p.log, p.f);
      assert.deepEqual(r.esito, p.d.esito);
      assert.equal(r.ticks, p.d.tick);
      assert.equal(r.hash, hashPartita(p.d));
      const viaRete = replayPartita(seed, JSON.parse(JSON.stringify(p.eroi)), JSON.parse(JSON.stringify(p.log)), p.f);
      assert.equal(viaRete.hash, r.hash);
    });
  }
});
const nemiciCasse = (modo: ArenaModo) => arenaMappa(formatoDi(modo, 1, 0).mappa).rows.join('').split('K').length - 1;
