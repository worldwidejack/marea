// Arena: la portata della bomba la sceglie chi mira (stick, mouse), la sim non si aggancia più al nemico davanti; senza una portata scelta
// (tocco veloce) resta la mira assistita.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildArenaEroe } from '../src/rpg/arena.ts';
import type { ArenaBuild } from '../src/rpg/types.ts';
import { CONTA_TICKS, createPartita, formatoDi, stepPartita } from '../src/arena/partita.ts';
import type { PartitaState } from '../src/arena/partita.ts';
import { distanzaBomba } from '../src/dungeon/magie.ts';
import { aimIndex } from '../src/dungeon/mira.ts';
import { portataDist, portataIndex } from '../src/dungeon/portata.ts';
import { frameOfRiga, isPackedDungeon, packDungeon, quantizeDungeon, unpackDungeon } from '../src/dungeon/replay.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { SQ_ALZO_MAX, isSqInput } from '../../protocol/src/squadra.ts';

const GITTATA = 9;

/** Una partita a due squadre con la Bomba di fuoco in mano al giocatore 0, sulla banchina sopra il canale: lui a (5, 13) guarda a +x, gli
 *  altri tre lontano; `nemico` = dove sta l'avversario 2 rispetto a lui (davanti, a destra…). */
function scena(nemico: { davanti: number; lato: number } | null): PartitaState {
  const bomba: ArenaBuild = { dote: 'magia', slot: [{ magia: 'bomba_fuoco' }, null], ulti: 'furia' };
  const e = buildArenaEroe(bomba), d = createPartita({ seed: 9, eroi: [e, e, e, e], ...formatoDi('rapina', 2, 9) });
  for (let t = 0; t < CONTA_TICKS; t++) stepPartita(d, d.eroi.map(() => ({ ...NO_DUNGEON_INPUT })));
  const me = d.s.eroi[0]!.hero, lui = d.s.eroi[2]!.hero;
  for (const j of [1, 3]) { d.s.eroi[j]!.hero.x = 3; d.s.eroi[j]!.hero.z = 3; }
  me.x = 5; me.z = 13; me.fx = 1; me.fz = 0;
  if (nemico) { lui.x = me.x + nemico.davanti; lui.z = me.z + nemico.lato; } else { lui.x = me.x - 30; lui.z = me.z; }
  d.s.cur = 0;
  return d;
}
/** Il giocatore 0 tiene A, poi la lascia; `punta` = l'input dei tick in cui mira, `rilascio` = quello del tick (o dei tick) del rilascio. */
function lancia(d: PartitaState, punta: { m?: number; p?: number }, rilascio: { m?: number; p?: number } = punta): { x: number; z: number } {
  const frame = (a: boolean, mira: { m?: number; p?: number }) => d.eroi.map((_, i) => quantizeDungeon(i === 0 ? { ...NO_DUNGEON_INPUT, a, ...mira } : { ...NO_DUNGEON_INPUT }));
  stepPartita(d, frame(true, punta)); stepPartita(d, frame(true, punta)); stepPartita(d, frame(false, rilascio));
  const p = d.s.proj.find((x) => x.bomba);
  assert.ok(p?.bomba, 'la bomba è partita');
  return { x: p!.bomba![0], z: p!.bomba![1] };
}

describe('arena: portata della bomba scelta da chi mira', () => {
  it('l\'indice di portata e i metri si corrispondono, dal minimo alla gittata', () => {
    assert.equal(portataIndex(0, GITTATA), 1);
    assert.equal(portataIndex(99, GITTATA), 81);
    assert.ok(Math.abs(portataDist(1, GITTATA) - 0.4) < 1e-9 && Math.abs(portataDist(81, GITTATA) - GITTATA) < 1e-9);
    let prima = -1;
    for (let p = 1; p <= 81; p++) { const d = portataDist(p, GITTATA); assert.ok(d > prima, 'cresce'); prima = d; assert.equal(portataIndex(d, GITTATA), p, 'andata e ritorno'); }
    assert.ok(portataDist(41, GITTATA) - portataDist(40, GITTATA) < 0.12, 'un passo è circa 11 cm: si può scegliere il punto');
  });

  it('con la portata scelta la bomba cade lì, anche con un avversario davanti a un\'altra distanza', () => {
    const m = aimIndex(1, 0);
    for (const metri of [0.4, 1.5, 3, 5, 7.5, 8.5]) {
      const d = scena({ davanti: 4, lato: 0 }), p = portataIndex(metri, GITTATA);
      const a = lancia(d, { m, p });
      assert.ok(Math.abs(a.x - 5 - portataDist(p, GITTATA)) < 0.02 && Math.abs(a.z - 13) < 0.02, `scelta ${metri} m: caduta a (${a.x}, ${a.z})`);
    }
  });

  it('distanzaBomba con la portata dice dove cade davvero la bomba', () => {
    const m = aimIndex(1, 0), d = scena({ davanti: 4, lato: 0 }), p = portataIndex(6, GITTATA);
    const rh = d.s.eroi[0]!.runHero, sp = rh.magie[rh.magia!]!;
    assert.ok(Math.abs(distanzaBomba(d.s, sp, 1, 0, p) - portataDist(p, GITTATA)) < 1e-9);
    const a = lancia(d, { m, p });
    assert.ok(Math.abs(a.x - 5 - distanzaBomba(d.s, sp, 1, 0, p)) < 0.02);
  });

  it('il rilascio senza mira (un turno intero di rete senza `m` né `p`) tiene direzione e portata, e non si gira verso il nemico vicino', () => {
    const m = aimIndex(1, 0), d = scena({ davanti: 5, lato: -1.3 }), p = portataIndex(7, GITTATA); // il nemico è dentro il cono dell'aggancio
    const a = lancia(d, { m, p }, {});
    assert.ok(Math.abs(a.x - 5 - portataDist(p, GITTATA)) < 0.02 && Math.abs(a.z - 13) < 0.02, `caduta a (${a.x}, ${a.z})`);
  });

  it('senza portata scelta (tocco veloce) vale ancora la mira assistita: sul nemico davanti', () => {
    const d = scena({ davanti: 4, lato: 0 }), a = lancia(d, {});
    assert.ok(Math.abs(a.x - 9) < 0.5, `caduta a ${a.x - 5} m, il nemico era a 4`);
  });

  it('la portata non fa lanciare nel muro: arretra fino a terra libera, e il minimo è 0,4 m', () => {
    const d = scena(null), rh = d.s.eroi[0]!.runHero, sp = rh.magie[rh.magia!]!;
    d.s.eroi[0]!.hero.x = 1.5; d.s.eroi[0]!.hero.z = 13; // vicino al bordo ovest: mirando a ovest il punto è oltre il muro
    const dist = distanzaBomba(d.s, sp, -1, 0, portataIndex(9, GITTATA));
    assert.ok(dist >= 0.4 && dist < 9, `arretra: ${dist}`);
    assert.ok(distanzaBomba(d.s, sp, 1, 0, 1) >= 0.4);
  });

  it('fuori dall\'Arena `p` resta l\'alzo: il dungeon non cambia', () => {
    const frames = [{ ...NO_DUNGEON_INPUT, a: true, m: 5, p: 41 }, { ...NO_DUNGEON_INPUT, m: 5, p: 41 }].map(quantizeDungeon);
    assert.deepEqual(unpackDungeon(packDungeon(frames)), frames);
  });
});

describe('arena: la portata nei log e nella rete', () => {
  it('`p` viaggia con `m` nel log e nell\'input di rete, e senza `m` si perde', () => {
    assert.equal(quantizeDungeon({ ...NO_DUNGEON_INPUT, m: 7, p: 33 }).p, 33);
    assert.equal(quantizeDungeon({ ...NO_DUNGEON_INPUT, p: 33 }).p, undefined, 'senza mira la portata non c\'è');
    const riga = packDungeon([{ ...NO_DUNGEON_INPUT, a: true, m: 7, p: 33 }]);
    assert.deepEqual(riga, [[1, 0, 0, 1, 7, 33]]);
    assert.ok(isPackedDungeon(riga, 100));
    assert.equal(frameOfRiga([3, 0, 0, 1, 7, 33]).p, 33);
    assert.ok(isSqInput([0, 0, 1, 7, 33]) && isSqInput([0, 0, 1, 7, SQ_ALZO_MAX]) && !isSqInput([0, 0, 1, 7, SQ_ALZO_MAX + 1]));
  });
});
