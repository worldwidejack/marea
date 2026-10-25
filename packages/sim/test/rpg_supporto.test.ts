// Supporto: l'abilità di Cura e Furia. Sale curando e potenziando; ha i suoi perk (potenza, costo, ricarica, durata) e quattro effetti:
// Cuore generoso, Fascio che attraversa, Furia condivisa, Benedizione.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERKS, RPG, SKILLS, SPELLS } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { evocaAlleato, secToTicks } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { gainSkillXp, heroOf, newHero, runHeroArenaOf, runHeroOf } from '../src/rpg/hero.ts';
import { fitHero } from '../src/rpg/hero.ts';
import { newLot } from '../src/economy/actions.ts';
import type { RunHero } from '../src/rpg/types.ts';
import { arena, inp, run } from './dungeon_util.ts';

/** L'eroe vero con una magia di supporto in mano, `lv` di Supporto e questi perk. */
function eroe(magia: string, perk: string[] = [], lv = 15, arenaPvp = false): RunHero {
  const h = newHero();
  const c = { ...h, perk, magie: [magia], equip: { ...h.equip, magia, mano: 'magia' as const }, skill: { ...h.skill, supporto: { lv, xp: 0 } } };
  return arenaPvp ? runHeroArenaOf(c) : runHeroOf(c);
}
/** Un lupo alleato ferito (resta `mancano` vita sotto il massimo), a `dx` metri davanti all'eroe. */
function lupo(s: DungeonState, dx: number, mancano = 40): Enemy {
  const e = evocaAlleato(s, 'lupo_spettrale', secToTicks(60), s.hero.fx, s.hero.fz);
  e.x = s.hero.x + dx; e.z = s.hero.z; e.vita = e.max - mancano;
  return e;
}
const tieni = (s: DungeonState, n: number): void => { run(s, n, inp({ a: true })); };

test('Supporto: è un\'abilità, le quattro magie di cura e furia sono sue e i perk hanno la loro catena', () => {
  assert.ok(SKILLS.includes('supporto'));
  assert.equal(newHero().skill.supporto.lv, RPG.livelli.skillIniziale);
  for (const id of ['cura_flusso', 'cura_bomba', 'furia_flusso', 'furia_bomba']) assert.equal(SPELLS.find((x) => x.id === id)?.scuola, 'supporto', id);
  const perk = PERKS.filter((p) => p.skill === 'supporto');
  assert.ok(perk.length >= 8 && perk.length <= 14, `${perk.length} perk`);
  assert.ok(perk.some((p) => p.livello >= 90), 'ha un perk finale');
  assert.ok(RPG.xpDanno?.supporto && RPG.xp.supportoLancio > 0, 'xp nel bilancio');
});

test('Supporto: chi aveva un personaggio salvato prima parte a livello iniziale e sale come le altre', () => {
  const vecchio = { ...newHero(), skill: { ...newHero().skill } } as ReturnType<typeof newHero>;
  delete (vecchio.skill as Record<string, unknown>)['supporto'];
  assert.equal(runHeroOf(vecchio).skill.supporto, RPG.livelli.skillIniziale);
  const lot = fitHero({ ...newLot('p1', 0), hero: vecchio });
  assert.equal(heroOf(lot).livello, 1);
  const su = gainSkillXp(vecchio, 'supporto', 1000);
  assert.ok(su.skill.supporto.lv > RPG.livelli.skillIniziale && su.livello >= 1);
});

test('Supporto: livello e perk alzano Cura e Furia; costo e ricarica scendono; Evocazione non c\'entra più', () => {
  const base = runHeroOf({ ...newHero(), magie: ['cura_flusso', 'cura_bomba', 'furia_flusso'] });
  const sp = (r: RunHero, id: string) => r.magie.find((m) => m.id === id)!;
  assert.equal(sp(base, 'cura_flusso').cura, 24);
  assert.equal(sp(base, 'cura_bomba').cura, 45);
  assert.deepEqual(sp(base, 'furia_flusso').furia, { danno: 0.35, velocita: 0.25, secondi: 2.5 });
  const mk = (perk: string[], lv = 15) => { const h = newHero(); return runHeroOf({ ...h, perk, magie: ['cura_flusso', 'cura_bomba', 'furia_flusso'], skill: { ...h.skill, supporto: { lv, xp: 0 } } }); };
  assert.equal(sp(mk([], 55), 'cura_flusso').cura, 28.8, '+0,5 % per livello sopra il 15');
  assert.equal(sp(mk(['su_luce']), 'cura_flusso').cura, 30);
  assert.equal(sp(mk(['su_luce', 'su_cuore', 'su_fonte']), 'cura_flusso').cura, 38.4, 'i due perk di potenza si sommano');
  assert.deepEqual(sp(mk(['su_ardore', 'su_fiamma']), 'furia_flusso').furia, { danno: 0.44, velocita: 0.31, secondi: 3.75 });
  assert.equal(sp(mk(['su_luce', 'su_serenita']), 'cura_flusso').costo, 14);
  assert.equal(sp(mk(['su_luce', 'su_serenita', 'su_mani']), 'cura_bomba').ricarica, 0.9);
  assert.equal(sp(mk(['su_luce', 'su_serenita', 'su_mani']), 'cura_flusso').ricarica, 0.18);
  // i perk di Evocazione non toccano più Cura e Furia
  assert.equal(sp(mk(['ev_legame', 'ev_richiamo']), 'cura_flusso').costo, 18);
  // in Arena la potenza ha un tetto
  const h = newHero();
  const forte = runHeroArenaOf({ ...h, perk: ['su_luce', 'su_cuore', 'su_fonte', 'su_ardore', 'su_fiamma', 'su_condivisa', 'su_furore'], magie: ['cura_flusso', 'furia_flusso'], skill: { ...h.skill, supporto: { lv: 100, xp: 0 } } });
  assert.equal(sp(forte, 'cura_flusso').cura, 24 * RPG.arena.supportoMax);
  assert.ok(sp(forte, 'furia_flusso').furia!.danno <= 0.35 * RPG.arena.supportoMax + 0.005);
});

test('Cura a flusso: xp di Supporto sulla vita ridata davvero (mai sul vuoto), niente xp di Evocazione', () => {
  const s = arena(eroe('cura_flusso'));
  const l = lupo(s, 2, 10);
  tieni(s, 90);
  assert.equal(l.vita, l.max, 'guarito del tutto');
  const xp = dungeon.result(s).xp;
  assert.ok(Math.abs((xp.supporto ?? 0) - 10 * RPG.xpDanno!.supporto!) < 1e-6, `xp ${xp.supporto}`);
  assert.equal(xp.evocazione ?? 0, 0);
  tieni(s, 60);
  assert.ok(Math.abs((dungeon.result(s).xp.supporto ?? 0) - 10 * RPG.xpDanno!.supporto!) < 1e-6, 'a vita piena non cresce');
});

test('Furia a flusso e bombe: xp di Supporto mentre potenzi o al lancio', () => {
  const f = arena(eroe('furia_flusso'));
  const l = lupo(f, 2, 0);
  tieni(f, 60);
  assert.ok((l.potT ?? 0) > f.tick, 'il lupo è furioso');
  assert.ok((dungeon.result(f).xp.supporto ?? 0) > 0);
  const nessuno = arena(eroe('furia_flusso'));
  tieni(nessuno, 60);
  assert.equal(dungeon.result(nessuno).xp.supporto ?? 0, 0, 'a vuoto niente');
  const b = arena(eroe('cura_bomba'));
  tieni(b, 3); run(b, 80);
  assert.ok(Math.abs((dungeon.result(b).xp.supporto ?? 0) - 42 * RPG.xp.supportoLancio) < 1e-6, 'la bomba conta al lancio');
  assert.equal(dungeon.result(b).xp.evocazione ?? 0, 0);
});

test('Cuore generoso: quello che dai a un altro in parte torna a te', () => {
  const con = arena(eroe('cura_flusso', ['su_luce', 'su_cuore']));
  lupo(con, 2); con.hero.vita = 50;
  tieni(con, 30);
  assert.ok(con.hero.vita >= 50 + 4, `con il perk ${con.hero.vita.toFixed(1)}`);
  const senza = arena(eroe('cura_flusso'));
  lupo(senza, 2); senza.hero.vita = 50;
  tieni(senza, 30);
  assert.ok(senza.hero.vita < 51, `senza ${senza.hero.vita.toFixed(1)}`);
});

test('Fascio che attraversa: il raggio prende tutti gli alleati sulla linea, non solo il primo', () => {
  const prova = (perk: string[]) => {
    const s = arena(eroe('cura_flusso', perk));
    const a = lupo(s, 2, 50), b = lupo(s, 3.5, 50);
    tieni(s, 20);
    return [a.vita - (a.max - 50), b.vita - (b.max - 50)] as const;
  };
  const [a0, b0] = prova([]);
  assert.ok(a0 > 0 && b0 === 0, `senza: ${a0} ${b0}`);
  const [a1, b1] = prova(['su_luce', 'su_serenita', 'su_fascio']);
  assert.ok(a1 > 0 && b1 > 0, `con: ${a1} ${b1}`);
});

test('Furia condivisa: dai Furia a un altro e ne prendi metà anche tu', () => {
  const con = arena(eroe('furia_flusso', ['su_ardore', 'su_fiamma', 'su_condivisa']));
  const l = lupo(con, 2, 0);
  tieni(con, 30);
  assert.ok((l.potT ?? 0) > con.tick);
  const mia = con.hero.buffs.find((b) => b.mod === 'furiaDanno' && b.fine > con.tick);
  const sua = l.potM! - 1;
  assert.ok(mia && Math.abs(mia.valore - sua / 2) < 0.011, `mia ${mia?.valore} sua ${sua}`);
  const senza = arena(eroe('furia_flusso', ['su_ardore']));
  lupo(senza, 2, 0);
  tieni(senza, 30);
  assert.equal(senza.hero.buffs.filter((b) => b.mod === 'furiaDanno').length, 0);
});

test('Benedizione: la Cura porta anche mezza Furia, la Furia cura un po\'', () => {
  const B = RPG.perk!.benedizione;
  const perk = ['su_luce', 'su_cuore', 'su_fonte', 'su_benedizione'];
  const c = arena(eroe('cura_flusso', perk));
  const l = lupo(c, 2, 20);
  tieni(c, 30);
  assert.ok((l.potT ?? 0) > c.tick, 'la Cura ha dato Furia');
  assert.ok(Math.abs(l.potM! - (1 + B.furia.danno)) < 0.011);
  const n = arena(eroe('cura_flusso', ['su_luce', 'su_cuore', 'su_fonte']));
  const l2 = lupo(n, 2, 20);
  tieni(n, 30);
  assert.equal(l2.potT, undefined, 'senza perk niente Furia');
  const f = arena(eroe('furia_flusso', perk));
  const l3 = lupo(f, 2, 20);
  tieni(f, 30);
  assert.ok(l3.vita > l3.max - 20, `la Furia cura un po': ${l3.vita}`);
  const f0 = arena(eroe('furia_flusso', ['su_ardore']));
  const l4 = lupo(f0, 2, 20);
  tieni(f0, 30);
  assert.equal(l4.vita, l4.max - 20);
});
