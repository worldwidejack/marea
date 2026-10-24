// Arena, allenamento a squadre: i gladiatori con build casuale o scelta a mano (rpg/arena_bot.ts) e la distanza d'atterraggio della bomba (l'ombra
// di mira del client).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, mappaPer } from '@marea/content/arena.ts';
import { SPELLS } from '@marea/content/rpg.ts';
import { newHero } from '../src/rpg/hero.ts';
import { erroreLoadout, slotArma, slotMagia } from '../src/rpg/arena.ts';
import { botLoadoutCasuale, catalogoBot, eroeBot, MAGIE_BOT } from '../src/rpg/arena_bot.ts';
import { itemDef } from '../src/rpg/items.ts';
import type { ArenaLoadout } from '../src/rpg/types.ts';
import { CONTA_TICKS, createDuello, formatoDi, stepDuello } from '../src/arena/duello.ts';
import { botArena } from '../src/arena/bot.ts';
import { distanzaBomba } from '../src/dungeon/magie.ts';
import { quantizeDungeon } from '../src/dungeon/replay.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { createRng } from '../src/rng.ts';

const hb = { ...newHero(), magie: [...MAGIE_BOT] };
const tuttiSuoi = () => 99;
const conta = (l: ArenaLoadout) => ({ armi: l.slot.filter(slotArma).length, magie: l.slot.filter(slotMagia).length });

describe('arena: gladiatori con build casuale', () => {
  it('il set casuale è sempre valido e rispetta le regole (3-4 armi: armatura, 3-4 magie: veste da mago, 2 e 2: un vestito)', () => {
    const visti = { armi: new Set<number>(), armatura: 0, veste: 0 };
    for (let seed = 0; seed < 300; seed++) {
      const l = botLoadoutCasuale(createRng(seed));
      assert.equal(erroreLoadout(hb, l, tuttiSuoi), null, `seed ${seed}`);
      const { armi, magie } = conta(l);
      assert.equal(armi + magie, ARENA.slot, 'quattro slot pieni');
      visti.armi.add(armi);
      assert.ok(l.corpo, 'un vestito c’è sempre');
      const k = itemDef(l.corpo!).kind;
      if (armi >= 3) assert.equal(k, 'armatura', `con ${armi} armi un’armatura (seed ${seed})`);
      else if (magie >= 3) assert.equal(k, 'veste', `con ${magie} magie una veste (seed ${seed})`);
      else assert.ok(k === 'armatura' || k === 'veste');
      if (k === 'armatura') visti.armatura++; else visti.veste++;
      assert.ok(l.anello1 && l.anello2 && l.anello1 !== l.anello2, 'due anelli diversi');
      for (const id of [l.corpo!, l.anello1, l.anello2, ...l.slot.filter(slotArma).map((s) => s.arma)]) assert.ok(!itemDef(id).unico, `${id} è un unico`);
      if (magie) assert.ok(l.slot.filter(slotMagia).some((s) => SPELLS.find((x) => x.id === s.magia && !x.cura && !x.furia)), 'almeno una magia che fa danno o evoca');
      assert.ok(l.pozioni.every((p) => p !== null), 'due pozioni');
    }
    assert.deepEqual([...visti.armi].sort(), [0, 1, 2, 3, 4], 'escono tutte le divisioni armi/magie');
    assert.ok(visti.armatura > 0 && visti.veste > 0);
  });

  it('con lo stesso seme esce lo stesso set; con semi diversi no', () => {
    assert.deepEqual(botLoadoutCasuale(createRng(7)), botLoadoutCasuale(createRng(7)));
    assert.notDeepEqual(botLoadoutCasuale(createRng(7)), botLoadoutCasuale(createRng(8)));
  });

  it('il catalogo a mano ha armi, archi, vesti, armature e anelli, e tutte le magie', () => {
    for (const k of ['arma', 'arco', 'veste', 'armatura', 'anello']) assert.ok(catalogoBot([k]).length > 0, k);
    assert.ok(MAGIE_BOT.includes('bomba_fuoco') && MAGIE_BOT.length === SPELLS.length);
    assert.ok(catalogoBot(['armatura', 'veste']).includes('unico_veste_arcimago'), 'a mano si possono scegliere anche gli unici');
  });

  it('un gladiatore dal set a mano ha esattamente quello (anche cose che il tuo personaggio non ha)', () => {
    const l: ArenaLoadout = { corpo: 'veste_distruzione', anello1: 'anello_mago', anello2: 'anello_vita', slot: [{ magia: 'bomba_fuoco' }, { magia: 'cura_bomba' }, { arma: 'martello_oro' }, { arma: 'arco_ferro', frecce: 'frecce_ferro' }], pozioni: ['pozione_vita', null] };
    const e = eroeBot(newHero(), l);
    assert.equal(e.varianti.length, 4);
    assert.ok(e.varianti.every((v) => v), 'tutti gli slot pieni');
    assert.equal(e.varianti[0]!.magie[e.varianti[0]!.magia!]!.id, 'bomba_fuoco');
    assert.equal(e.varianti[2]!.arma.id, 'martello_oro');
    assert.equal(e.varianti[3]!.arma.kind, 'arco');
    assert.equal(e.pozioni.length, 1);
  });

  it('2v2 e 3v3 di soli gladiatori a caso: la partita gira senza errori', () => {
    for (const n of [2, 3]) for (let seed = 1; seed <= 3; seed++) {
      const eroi = Array.from({ length: 2 * n }, (_, k) => eroeBot(newHero(), botLoadoutCasuale(createRng(seed).fork('bot' + k))));
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
    const h = newHero(); h.magie = ['bomba_fuoco'];
    const l: ArenaLoadout = { slot: [{ magia: 'bomba_fuoco' }, null, null, null], pozioni: [null, null] };
    const lanciata = (davanti: number | null): { stimata: number; vera: number } => {
      const e = eroeBot(h, l), d = createDuello({ seed: 9, eroi: [e, e] });
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
