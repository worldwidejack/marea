// Arena, allenamento a squadre: i gladiatori con build casuale (rpg/arena_bot.ts) e la distanza d'atterraggio della bomba (l'ombra di mira del
// client).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, mappaPer } from '@marea/content/arena.ts';
import { buildArenaEroe, erroreBuild, slotArma, slotMagia, soloSquadre } from '../src/rpg/arena.ts';
import { botBuildCasuale } from '../src/rpg/arena_bot.ts';
import type { ArenaBuild } from '../src/rpg/types.ts';
import { CONTA_TICKS, createDuello, formatoDi, stepDuello } from '../src/arena/duello.ts';
import { botArena } from '../src/arena/bot.ts';
import { distanzaBomba } from '../src/dungeon/magie.ts';
import { quantizeDungeon } from '../src/dungeon/replay.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { createRng } from '../src/rng.ts';

describe('arena: gladiatori con build casuale', () => {
  it('la build casuale è sempre valida: due slot diversi, almeno uno d\'attacco, Cura e Furia solo se a squadre', () => {
    const visti = { doti: new Set<string>(), ulti: new Set<string>(), armi: 0, magie: 0, supporto: 0 };
    for (let seed = 0; seed < 400; seed++) {
      const b = botBuildCasuale(createRng(seed)), solo = botBuildCasuale(createRng(seed), false);
      assert.equal(erroreBuild(b), null, `seed ${seed}`);
      assert.equal(erroreBuild(solo), null, `seed ${seed}`);
      assert.ok(b.slot.every((s) => s), 'due slot pieni');
      assert.ok(!solo.slot.some(soloSquadre), 'nel 1 contro 1 niente Cura né Furia');
      visti.doti.add(b.dote); visti.ulti.add(b.ulti);
      visti.armi += b.slot.filter(slotArma).length; visti.magie += b.slot.filter(slotMagia).length; visti.supporto += b.slot.filter(soloSquadre).length;
    }
    assert.equal(visti.doti.size, ARENA.build.doti.length, 'escono tutte le doti');
    assert.equal(visti.ulti.size, ARENA.ulti.lista.length, 'e tutte le ulti');
    assert.ok(visti.armi > 0 && visti.magie > 0 && visti.supporto > 0);
  });

  it('con lo stesso seme esce la stessa build; con semi diversi no', () => {
    assert.deepEqual(botBuildCasuale(createRng(7)), botBuildCasuale(createRng(7)));
    assert.notDeepEqual(botBuildCasuale(createRng(7)), botBuildCasuale(createRng(8)));
  });

  it('2v2 e 3v3 di soli gladiatori a caso: la partita gira senza errori', () => {
    for (const n of [2, 3]) for (let seed = 1; seed <= 3; seed++) {
      const eroi = Array.from({ length: 2 * n }, (_, k) => buildArenaEroe(botBuildCasuale(createRng(seed).fork('bot' + k))));
      const d = createDuello({ seed, eroi, ...formatoDi(n, mappaPer(n, seed).id) });
      const rng = eroi.map((_, i) => createRng(seed + i));
      for (let t = 0; t < CONTA_TICKS + 1200; t++) {
        stepDuello(d, eroi.map((_, i) => { const x = botArena(d, i, rng[i]!); return quantizeDungeon(x.input); }));
      }
      assert.ok(d.tick >= CONTA_TICKS, 'il duello è andato avanti');
      assert.ok(d.s.eroi.every((r) => Number.isFinite(r.hero.vita)));
    }
  });
});

describe('arena: ombra di mira della bomba', () => {
  it('distanzaBomba dice dov’è atterrata la bomba davvero lanciata (nemico davanti, e nel vuoto)', () => {
    const bomba: ArenaBuild = { dote: 'magia', slot: [{ magia: 'bomba_fuoco' }, null], ulti: 'furia' };
    const lanciata = (davanti: number | null): { stimata: number; vera: number } => {
      const e = buildArenaEroe(bomba), d = createDuello({ seed: 9, eroi: [e, e] });
      for (let t = 0; t < CONTA_TICKS; t++) stepDuello(d, d.eroi.map(() => ({ ...NO_DUNGEON_INPUT })));
      const me = d.s.eroi[0]!.hero, lui = d.s.eroi[1]!.hero;
      if (davanti !== null) { lui.x = me.x + me.fx * davanti; lui.z = me.z + me.fz * davanti; } else { lui.x = me.x - me.fx * 30; lui.z = me.z - me.fz * 30; }
      d.s.cur = 0;
      const rh = d.s.eroi[0]!.runHero, sp = rh.magie[rh.magia!]!;
      const stimata = distanzaBomba(d.s, sp, me.fx, me.fz);
      const px = me.x, pz = me.z, fx = me.fx, fz = me.fz;
      const frame = (a: boolean) => [quantizeDungeon({ ...NO_DUNGEON_INPUT, a }), quantizeDungeon({ ...NO_DUNGEON_INPUT })];
      stepDuello(d, frame(true)); stepDuello(d, frame(true)); stepDuello(d, frame(false));
      const p = d.s.proj.find((x) => x.bomba);
      assert.ok(p?.bomba, 'la bomba è partita');
      return { stimata, vera: Math.sqrt((p!.bomba![0] - px) ** 2 + (p!.bomba![1] - pz) ** 2) * Math.sign((p!.bomba![0] - px) * fx + (p!.bomba![1] - pz) * fz) };
    };
    const a = lanciata(4), b = lanciata(null);
    assert.ok(Math.abs(a.stimata - a.vera) < 0.02, `col nemico davanti: ${a.stimata} contro ${a.vera}`);
    assert.ok(Math.abs(b.stimata - b.vera) < 0.02, `nel vuoto: ${b.stimata} contro ${b.vera}`);
    assert.ok(a.stimata <= 4.01 && a.stimata < b.stimata, 'col nemico a 4 m la bomba cade lì, nel vuoto più lontano');
  });
});
