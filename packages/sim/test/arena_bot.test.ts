// Arena: i gladiatori con build casuale (rpg/arena_bot.ts) e la distanza d'atterraggio della bomba (l'ombra di mira del
// client).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, arenaModo, eroiDi } from '@marea/content/arena.ts';
import { buildArenaEroe, erroreBuild, slotArma, slotMagia, soloSquadre } from '../src/rpg/arena.ts';
import { botBuildCasuale } from '../src/rpg/arena_bot.ts';
import type { ArenaBuild } from '../src/rpg/types.ts';
import { CONTA_TICKS, createPartita, formatoDi, stepPartita } from '../src/arena/partita.ts';
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
      assert.ok(!solo.slot.some(soloSquadre), 'senza compagni niente Cura né Furia');
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

  it('ogni modalità di soli gladiatori a caso: la partita gira senza errori', () => {
    for (const m of ARENA.modi.lista) for (const per of m.per) for (let seed = 1; seed <= 2; seed++) {
      const eroi = Array.from({ length: eroiDi(arenaModo(m.id), per) }, (_, k) => buildArenaEroe(botBuildCasuale(createRng(seed).fork('bot' + k), per > 1)));
      const d = createPartita({ seed, eroi, ...formatoDi(m.id, per, seed) });
      const rng = eroi.map((_, i) => createRng(seed + i));
      for (let t = 0; t < CONTA_TICKS + 1200; t++) {
        stepPartita(d, eroi.map((_, i) => { const x = botArena(d, i, rng[i]!); return quantizeDungeon(x.input); }));
      }
      assert.ok(d.tick >= CONTA_TICKS, 'la partita è andata avanti');
      assert.ok(d.s.eroi.every((r) => Number.isFinite(r.hero.vita)));
    }
  });
});

describe('arena: ombra di mira della bomba', () => {
  it('distanzaBomba dice dov’è atterrata la bomba davvero lanciata (nemico davanti, e nel vuoto)', () => {
    const bomba: ArenaBuild = { dote: 'magia', slot: [{ magia: 'bomba_fuoco' }, null], ulti: 'furia' };
    const lanciata = (davanti: number | null): { stimata: number; vera: number } => {
      const e = buildArenaEroe(bomba), d = createPartita({ seed: 9, eroi: [e, e, e, e], ...formatoDi('rapina', 2, 9) });
      for (let t = 0; t < CONTA_TICKS; t++) stepPartita(d, d.eroi.map(() => ({ ...NO_DUNGEON_INPUT })));
      const me = d.s.eroi[0]!.hero, lui = d.s.eroi[2]!.hero;
      for (const j of [1, 3]) { d.s.eroi[j]!.hero.x = 3; d.s.eroi[j]!.hero.z = 3; } // gli altri due lontano
      me.x = 5; me.z = 13; me.fx = 1; me.fz = 0; // sulla banchina sopra il canale, davanti c'è spazio
      if (davanti !== null) { lui.x = me.x + me.fx * davanti; lui.z = me.z + me.fz * davanti; } else { lui.x = me.x - me.fx * 30; lui.z = me.z - me.fz * 30; }
      d.s.cur = 0;
      const rh = d.s.eroi[0]!.runHero, sp = rh.magie[rh.magia!]!;
      const stimata = distanzaBomba(d.s, sp, me.fx, me.fz);
      const px = me.x, pz = me.z, fx = me.fx, fz = me.fz;
      const frame = (a: boolean) => d.eroi.map((_, i) => quantizeDungeon({ ...NO_DUNGEON_INPUT, a: a && i === 0 }));
      stepPartita(d, frame(true)); stepPartita(d, frame(true)); stepPartita(d, frame(false));
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
