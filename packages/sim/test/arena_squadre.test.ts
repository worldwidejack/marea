// Arena a squadre (docs/ARENA.md): 2v2 e 3v3 sulle mappe nuove, fine del round per squadra, resa, e l'erba alta (chi ci sta dentro non lo vedono
// gli avversari, i compagni sì; lo scoprono vicinanza, attacco e colpi presi).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, ARENA_SQUADRA_MAX, arenaMappa, mappaPer, validateArena } from '@marea/content/arena.ts';
import { RPG } from '@marea/content/rpg.ts';
import { newHero } from '../src/rpg/hero.ts';
import { buildArenaEroe } from '../src/rpg/arena.ts';
import type { ArenaLoadout, HeroState } from '../src/rpg/types.ts';
import { actDuello, CONTA_TICKS, createDuello, formatoDi, hashDuello, replayDuello, ROUND_TICKS, stepDuello, viewDuello } from '../src/arena/duello.ts';
import type { ArenaAzioni, DuelloState } from '../src/arena/duello.ts';
import { botArena } from '../src/arena/bot.ts';
import { createRng } from '../src/rng.ts';
import { packDungeon, quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { aimIndex } from '../src/dungeon/mira.ts';
import { aim } from '../src/dungeon/hero.ts';
import { scoperto, scopri, visibileDa } from '../src/dungeon/erba.ts';

const fermo = (): DungeonInput => ({ ...NO_DUNGEON_INPUT });
/** Un combattente: spadone, arco e un fulmine, armatura di ferro e una pozione. */
function forte(arma = 'spadone_ferro'): HeroState {
  const h = newHero();
  h.inv = { ...h.inv, [arma]: 1, armatura_ferro: 1, arco_ferro: 1, pozione_vita: 1 }; h.magie = [...new Set([...h.magie, 'fulmine'])];
  const l: ArenaLoadout = { corpo: 'armatura_ferro', slot: [{ arma }, { arma: 'arco_ferro' }, { magia: 'fulmine' }, null], pozioni: ['pozione_vita', null] };
  h.arena = l;
  return h;
}
const eroiDi = (n: number) => Array.from({ length: n }, (_, i) => { const h = forte(i % 2 ? 'martello_ferro' : 'spadone_ferro'); return buildArenaEroe(h, h.arena!); });
/** Duello di `n` per squadra già al via. */
function alVia(n: number, mappa: string, seed = 5): DuelloState {
  const d = createDuello({ seed, eroi: eroiDi(2 * n), ...formatoDi(n, mappa) });
  for (let t = 0; t < CONTA_TICKS; t++) stepDuello(d, d.eroi.map(fermo));
  assert.equal(d.fase, 'gioca');
  return d;
}
const passi = (d: DuelloState, n: number, f: (i: number) => DungeonInput = fermo) => { for (let t = 0; t < n && d.fase === 'gioca'; t++) stepDuello(d, d.eroi.map((_, i) => f(i))); };
const abbatti = (d: DuelloState, ...hh: number[]) => { for (const i of hh) { const r = d.s.eroi[i]!; r.done = true; r.outcome = 'morto'; r.hero.vita = 0; } };
/** Sposta l'eroe i al centro della cella (cx, cz). */
const posa = (d: DuelloState, i: number, cx: number, cz: number) => { const h = d.s.eroi[i]!.hero, t = d.s.map.tile; h.x = (cx + 0.5) * t; h.z = (cz + 0.5) * t; };
/** Le celle d'erba della mappa. */
const erbe = (d: DuelloState): [number, number][] => { const m = d.s.map, out: [number, number][] = []; for (let i = 0; i < m.erba.length; i++) if (m.erba[i]) out.push([i % m.w, Math.floor(i / m.w)]); return out; };

/** Partita di soli gladiatori automatici registrata come fa il client (input quantizzati, azioni col tick). */
function partita(n: number, mappa: string, seed: number) {
  const eroi = eroiDi(2 * n), f = formatoDi(n, mappa);
  const d = createDuello({ seed, eroi, ...f }), rng = eroi.map((_, i) => createRng(seed + 1 + i));
  const frames: DungeonInput[][] = eroi.map(() => []), azioni: ArenaAzioni = [];
  for (let t = 0; t < 40000 && d.fase !== 'finita'; t++) {
    const q = eroi.map((_, i) => {
      const x = botArena(d, i, rng[i]!);
      if (x.azione && actDuello(d, i, x.azione)) azioni.push([d.tick, i, x.azione]);
      return quantizeDungeon(x.input);
    });
    q.forEach((x, i) => frames[i]!.push(x));
    stepDuello(d, q);
  }
  return { d, eroi, f, log: { inputs: frames.map((x) => packDungeon(x)), azioni } };
}

describe('Arena a squadre — mappe e formati', () => {
  it('i dati sono validi: ogni formato ha le sue mappe, tutte con l\'erba alta', () => {
    assert.deepEqual(validateArena(), []);
    for (let f = 1; f <= ARENA_SQUADRA_MAX; f++) assert.ok(ARENA.mappe.some((m) => m.formati.includes(f)), `una mappa per il ${f}v${f}`);
    assert.ok(ARENA.mappe.length >= 3, 'il colosseo più due mappe nuove');
    for (const m of ARENA.mappe) assert.ok(m.rows.some((r) => r.includes('E')), `${m.id} ha l'erba alta`);
    assert.ok(mappaPer(3, 1).formati.includes(3));
    assert.equal(mappaPer(2, 7).id, mappaPer(2, 7).id, 'la scelta dipende solo dal seed');
    assert.notEqual(new Set([0, 1, 2, 3, 4, 5].map((s) => mappaPer(2, s).id)).size, 1, 'nel 2v2 si giocano più mappe');
  });

  it('gli eroi partono dalle partenze della loro squadra, in ordine', () => {
    for (const [n, id] of [[1, 'colosseo'], [2, 'colosseo'], [2, 'giardino'], [3, 'giardino'], [3, 'rovine']] as const) {
      const d = createDuello({ seed: 1, eroi: eroiDi(2 * n), ...formatoDi(n, id) }), m = arenaMappa(id);
      d.eroi.forEach((_, i) => {
        const q = i < n ? 0 : 1, [cx, cz] = m.spawn[q]![i - q * n]!, h = d.s.eroi[i]!.hero;
        assert.deepEqual([h.x, h.z], [(cx + 0.5) * 2, (cz + 0.5) * 2], `${n}v${n} ${id} eroe ${i}`);
      });
      assert.deepEqual(d.s.pvp?.squadre, d.squadre);
    }
  });

  it('formati sbagliati si rifiutano: squadre diverse, 4v4, mappa piccola', () => {
    assert.throws(() => createDuello({ seed: 1, eroi: eroiDi(3), squadre: [0, 0, 1] }));
    assert.throws(() => createDuello({ seed: 1, eroi: eroiDi(8), squadre: [0, 0, 0, 0, 1, 1, 1, 1] }));
    assert.throws(() => createDuello({ seed: 1, eroi: eroiDi(6), ...formatoDi(3, 'colosseo') }));
    assert.throws(() => createDuello({ seed: 1, eroi: eroiDi(4), squadre: [0, 1, 2, 3] }));
  });
});

describe('Arena a squadre — il round', () => {
  it('il round finisce quando una squadra è tutta a terra, non prima', () => {
    const d = alVia(2, 'giardino');
    abbatti(d, 0);
    passi(d, 3);
    assert.equal(d.fase, 'gioca', 'un compagno è ancora in piedi');
    abbatti(d, 2);
    passi(d, 3);
    assert.equal(d.fase, 'gioca', 'anche gli altri hanno un compagno');
    abbatti(d, 3);
    passi(d, 3);
    assert.equal(d.fase, 'pausa');
    assert.deepEqual(d.rounds[0], { vincitore: 0, perche: 'ko' });
    assert.deepEqual(d.vinti, [1, 0]);
  });

  it('cadute insieme = pari; a tempo scaduto conta la vita di tutta la squadra', () => {
    const a = alVia(3, 'giardino');
    abbatti(a, 0, 1, 2, 3, 4, 5);
    passi(a, 3);
    assert.deepEqual(a.rounds[0], { vincitore: null, perche: 'pari' });
    const b = alVia(2, 'rovine');
    b.s.eroi[0]!.hero.vita = 10; b.s.eroi[1]!.hero.vita = 100; b.s.eroi[2]!.hero.vita = 60; b.s.eroi[3]!.hero.vita = 60; // 110 contro 120
    for (let t = 0; t < ROUND_TICKS; t++) stepDuello(b, b.eroi.map(fermo));
    assert.deepEqual(b.rounds[0], { vincitore: 1, perche: 'tempo' });
  });

  it('la resa di uno di due lascia fuori solo lui, anche nei round dopo; quella di tutta la squadra chiude la partita', () => {
    const d = alVia(2, 'colosseo');
    assert.ok(actDuello(d, 1, { t: 'resa' }));
    assert.equal(d.fase, 'gioca');
    assert.equal(d.s.eroi[1]!.done, true);
    assert.equal(actDuello(d, 1, { t: 'resa' }), null, 'non si arrende due volte');
    abbatti(d, 2, 3);
    passi(d, 3);
    assert.equal(d.fase, 'pausa');
    assert.deepEqual(d.rounds[0], { vincitore: 0, perche: 'ko' });
    for (let t = 0; t < 400 && d.fase !== 'conta'; t++) stepDuello(d, d.eroi.map(fermo));
    assert.equal(d.fase, 'conta');
    assert.equal(d.s.eroi[1]!.done, true, 'nel round nuovo resta fuori');
    assert.equal(d.s.eroi[0]!.done, false);
    assert.ok(actDuello(d, 0, { t: 'resa' }));
    assert.deepEqual(d.esito, { vincitore: 1, perche: 'resa', vinti: [1, 0] });
    assert.equal(d.fase, 'finita');
  });

  it('un duello 1v1 si comporta come prima: la resa chiude subito', () => {
    const d = createDuello({ seed: 2, eroi: eroiDi(2) });
    assert.deepEqual(d.squadre, [0, 1]);
    assert.ok(actDuello(d, 1, { t: 'resa' }));
    assert.deepEqual(d.esito, { vincitore: 0, perche: 'resa', vinti: [0, 0] });
  });
});

describe('Arena a squadre — erba alta', () => {
  it('chi sta nell\'erba non lo vedono gli avversari, i compagni sì', () => {
    const d = alVia(2, 'giardino'), s = d.s, [cx, cz] = erbe(d)[0]!;
    posa(d, 0, cx, cz);
    assert.equal(visibileDa(s, 0, 1), false, 'gli avversari non lo vedono');
    assert.equal(visibileDa(s, 0, 0), true, 'la sua squadra sì');
    assert.equal(visibileDa(s, 2, 0), true, 'chi sta fuori dall\'erba si vede');
    // sullo schermo degli avversari non c'è, su quello del compagno sì
    assert.ok(!viewDuello(d, 2).dungeon.compagni.some((c) => c.i === 0));
    assert.ok(viewDuello(d, 1).dungeon.compagni.some((c) => c.i === 0));
    assert.equal(viewDuello(d, 2).altri.find((a) => a.i === 0)!.nascosto, true);
    assert.equal(viewDuello(d, 0).nascosto, true, 'io so di essere nascosto');
    assert.equal(viewDuello(d, 1).nascosto, false, 'il compagno fuori dall\'erba no');
  });

  it('un avversario vicino lo scopre; lontano no', () => {
    const d = alVia(2, 'giardino'), s = d.s, [cx, cz] = erbe(d)[0]!;
    posa(d, 0, cx, cz);
    const h0 = s.eroi[0]!.hero, h2 = s.eroi[2]!.hero;
    h2.x = h0.x + RPG.arena.erba.raggio + 0.5; h2.z = h0.z;
    assert.equal(visibileDa(s, 0, 1), false);
    h2.x = h0.x + RPG.arena.erba.raggio - 0.2;
    assert.equal(visibileDa(s, 0, 1), true);
    h2.x = h0.x + 1; abbatti(d, 2, 3);
    assert.equal(visibileDa(s, 0, 1), false, 'un avversario a terra non scopre nessuno');
  });

  it('chi attacca si scopre per un attimo, poi torna nascosto', () => {
    const d = alVia(2, 'giardino'), s = d.s, [cx, cz] = erbe(d)[0]!;
    posa(d, 0, cx, cz);
    assert.equal(scoperto(s, 0), false);
    passi(d, 2, (i) => (i === 0 ? { ...fermo(), a: true, m: aimIndex(1, 0) } : fermo()));
    assert.equal(scoperto(s, 0), true, 'ha attaccato');
    assert.equal(visibileDa(s, 0, 1), true);
    passi(d, 4);
    for (let t = 0; t < 400 && scoperto(s, 0); t++) stepDuello(d, d.eroi.map(fermo));
    assert.equal(visibileDa(s, 0, 1), false, 'passato il tempo è di nuovo nascosto');
    scopri(s, 0);
    assert.equal(visibileDa(s, 0, 1), true);
  });

  it('un colpo preso nell\'erba scopre chi lo prende, anche se non lo si vedeva', () => {
    const d = alVia(2, 'giardino'), s = d.s, [cx, cz] = erbe(d)[0]!;
    posa(d, 0, cx, cz);
    // l'avversario 2 è a 6 m dietro l'erba, tira una freccia nella sua direzione senza vederlo
    const h0 = s.eroi[0]!.hero, h2 = s.eroi[2]!.hero;
    h2.x = h0.x + 6; h2.z = h0.z; h2.fx = -1; h2.fz = 0;
    s.eroi[3]!.hero.x = h0.x + 20; s.eroi[3]!.hero.z = h0.z + 6;
    assert.ok(actDuello(d, 2, { t: 'slot', n: 1 }));
    passi(d, 70, (i) => (i === 2 ? { ...fermo(), a: true, m: aimIndex(-1, 0) } : fermo()));
    for (let t = 0; t < 200 && h0.vita >= 100; t++) stepDuello(d, d.eroi.map(fermo));
    assert.ok(h0.vita < 100, 'la freccia l\'ha preso');
    assert.equal(scoperto(s, 0), true, 'colpito = scoperto');
    assert.equal(visibileDa(s, 0, 1), true);
  });

  it('la mira assistita non punta chi non si vede', () => {
    const d = alVia(2, 'giardino'), s = d.s, [cx, cz] = erbe(d)[0]!;
    posa(d, 0, cx, cz);
    const h0 = s.eroi[0]!.hero, h2 = s.eroi[2]!.hero;
    h2.x = h0.x - 6; h2.z = h0.z; h2.fx = 1; h2.fz = 0;
    abbatti(d, 1);
    s.cur = 2;
    assert.equal(aim(s, 12, 0.5, 8, true), null, 'nell\'erba: nessun bersaglio');
    scopri(s, 0);
    assert.ok(aim(s, 12, 0.5, 8, true), 'scoperto: bersaglio');
    s.cur = 0;
  });

  it('un gladiatore automatico non vede chi è nell\'erba e lo cerca dove l\'ha visto', () => {
    const d = alVia(2, 'giardino'), s = d.s, [cx, cz] = erbe(d)[0]!;
    posa(d, 0, cx, cz);
    const rng = createRng(4);
    const h2 = s.eroi[2]!.hero, h0 = s.eroi[0]!.hero;
    h2.x = h0.x + 12; h2.z = h0.z; // lontano: fuori dal raggio che scopre
    abbatti(d, 3);
    for (let t = 0; t < 30; t++) { const b = botArena(d, 2, rng); assert.equal(b.input.a, false, 'non attacca chi non vede'); }
  });
});

describe('Arena a squadre — partite intere', () => {
  for (const [n, id, seed] of [[2, 'colosseo', 3], [2, 'giardino', 7], [2, 'rovine', 9], [3, 'giardino', 11], [3, 'rovine', 13]] as const) {
    it(`${n}v${n} sul ${id}: i gladiatori giocano fino in fondo e il replay del server dà lo stesso esito e lo stesso hash`, () => {
      const p = partita(n, id, seed);
      assert.equal(p.d.fase, 'finita');
      assert.ok(p.d.esito);
      const e = p.d.esito!;
      assert.ok(e.vincitore === null || e.vincitore === 0 || e.vincitore === 1);
      if (e.vincitore !== null && e.perche === 'round') assert.equal(e.vinti[e.vincitore], ARENA.round.vittorie);
      const r = replayDuello(seed, JSON.parse(JSON.stringify(p.eroi)), JSON.parse(JSON.stringify(p.log)), p.f);
      assert.deepEqual(r.esito, p.d.esito);
      assert.equal(r.ticks, p.d.tick);
      assert.equal(r.hash, hashDuello(p.d));
    });
  }
});
