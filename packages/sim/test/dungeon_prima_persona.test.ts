// Prima persona nel dungeon (docs/PRIMA_PERSONA.md): alzo della mira (frecce, magie e raggi dove punta il mirino, nemici alti quanto il loro
// modello), bottino a mano (azioni `fruga` e `prendi`), attacco furtivo, il log del formato 5 e le bombe che si vedono partire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RPG } from '@marea/content/rpg.ts';
import type { RunSpell } from '../src/rpg/types.ts';
import { newHero, runHeroOf } from '../src/rpg/hero.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { ALZO_N, OCCHI_Y, alzoDir, alzoIndex, quotaNemico } from '../src/dungeon/alzo.ts';
import { aimIndex } from '../src/dungeon/mira.ts';
import { decodeDungeon, encodeDungeon, frameOfRiga, packDungeon, parseDungeonAzione, quantizeDungeon, replayDungeon } from '../src/dungeon/replay.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import type { DungeonAzioni, DungeonInput } from '../src/dungeon/types.ts';
import { aPortata, contenuto } from '../src/dungeon/fruga.ts';
import { createRng } from '../src/rng.ts';
import { arena, heroBase, inp, run } from './dungeon_util.ts';

const GRADO = Math.PI / 180;
const arco = () => heroBase({
  arma: { id: 'arco_ferro', kind: 'arco', skill: 'arceria', classe: null, danno: 14, tempo: 0.9, portata: 0, carica: 0.9, caricaMolt: 1, gittata: 28, traits: {} },
  frecce: { id: 'frecce_ferro', n: 20, danno: 6, gittata: 6, gravita: 7, traits: {} },
});
function bersaglio(s: DungeonState, dx: number, tipo = 'bandito', dz = 0): Enemy {
  const e = newEnemy(s, tipo, s.hero.x + dx, s.hero.z + dz);
  e.vita = e.max = 100000; e.st = 'dorme';
  return e;
}
/** Tende l'arco verso +x con l'alzo `gradi` e lascia: quanta vita perde chi sta davanti. */
function tiro(tipo: string, d: number, gradi: number): number {
  const s = arena(arco()), e = bersaglio(s, d, tipo), m = { m: aimIndex(1, 0), p: alzoIndex(gradi * GRADO) };
  run(s, 70, inp({ a: true, ...m })); run(s, 1, inp(m));
  for (let i = 0; i < 120; i++) { dungeon.step(s, inp()); e.x = s.hero.x + d; e.z = s.hero.z; }
  return 100000 - e.vita;
}

test('alzo: la tabella va da −60° a +60° a passi di 1,5°, il centro è piatto', () => {
  assert.equal(ALZO_N, 81);
  assert.deepEqual(alzoDir(alzoIndex(0)), [1, 0]);
  assert.ok(Math.abs(alzoDir(alzoIndex(30 * GRADO))![1] - 0.5) < 1e-9);
  assert.equal(alzoIndex(-80 * GRADO), 1, 'oltre i 60° si taglia');
  assert.equal(alzoDir(0), null); assert.equal(alzoDir(ALZO_N + 1), null); assert.equal(alzoDir(2.5), null);
});

test('alzo: la freccia mirata va dove punta il mirino (il ragno va mirato in basso)', () => {
  assert.ok(tiro('bandito', 8, 0) > 0, 'a occhi dritti il bandito si prende');
  assert.equal(tiro('ragno', 5, 0), 0, 'il ragno, basso, a occhi dritti si sorvola');
  assert.ok(tiro('ragno', 5, -10) > 0, 'mirato in basso si prende');
  assert.equal(tiro('bandito', 8, 40), 0, 'mirata al soffitto la freccia si ferma lì');
  assert.equal(tiro('bandito', 8, -30), 0, 'mirata a terra si pianta prima');
  // in terza persona (senza alzo) come sempre: il ragno lo prende anche la freccia dritta
  const s = arena(arco()), e = bersaglio(s, 5, 'ragno');
  run(s, 70, inp({ a: true, m: aimIndex(1, 0) })); run(s, 1, inp({ m: aimIndex(1, 0) }));
  for (let i = 0; i < 120; i++) { dungeon.step(s, inp()); e.x = s.hero.x + 5; e.z = s.hero.z; }
  assert.ok(e.vita < 100000);
});

test('alzo: chi vola sta alla sua quota, chi cammina da terra alla sua altezza', () => {
  const s = arena(heroBase()), b = bersaglio(s, 3), r = bersaglio(s, 4, 'ragno');
  assert.deepEqual(quotaNemico(s, b), [0, 1.75]);
  assert.ok(quotaNemico(s, r)[1] < OCCHI_Y - 0.3, 'il ragno sta sotto gli occhi anche col margine');
  const a = bersaglio(s, 6, 'aerostato_spia'); a.st = 'insegue';
  assert.ok(quotaNemico(s, a)[0] > 1, 'l\'aerostato in volo sta in alto');
});

function conRaggio(id: string): DungeonState {
  const h = { ...newHero(), magie: [id], equip: { ...newHero().equip, magia: id, mano: 'magia' as const } };
  const sp: RunSpell = runHeroOf(h).magie[0]!;
  const s = arena(heroBase({ magie: [sp], magia: 0, max: { vita: 500, magicka: 400, stamina: 100 } }));
  s.hero.magicka = 400; run(s, 1, inp({ c: true }));
  return s;
}
test('alzo: il raggio continuo si piega con lo sguardo, si ferma a terra e brucia chi sta sotto il mirino', () => {
  const giu = conRaggio('fuoco_continuo'), m = aimIndex(1, 0);
  run(giu, 20, inp({ a: true, m, p: alzoIndex(-30 * GRADO) }));
  const v = dungeon.view(giu).hero.canale!;
  assert.ok(Math.abs(v.len - OCCHI_Y / 0.5) < 0.05, `guardando giù di 30° il raggio tocca terra a ${v.len}`);
  assert.equal(v.n, -0.5);
  // il ragno a 3 m: a occhi dritti il raggio sottile (elettrico) gli passa sopra, mirato su di lui lo prende
  const prova = (gradi: number): number => {
    const s = conRaggio('elettro_continuo'), e = bersaglio(s, 3, 'ragno');
    for (let i = 0; i < 60; i++) { dungeon.step(s, inp({ a: true, m, p: alzoIndex(gradi * GRADO) })); e.x = s.hero.x + 3; e.z = s.hero.z; }
    return 100000 - e.vita;
  };
  assert.equal(prova(0), 0);
  assert.ok(prova(-12) > 0);
  // e si vede finire sul primo che prende
  const s = conRaggio('elettro_continuo'), e = bersaglio(s, 4);
  for (let i = 0; i < 30; i++) { dungeon.step(s, inp({ a: true, m, p: alzoIndex(0) })); e.x = s.hero.x + 4; e.z = s.hero.z; }
  const c = dungeon.view(s).hero.canale!;
  assert.ok(c.fin !== undefined && c.fin < c.len && Math.abs(c.fin - 4) < 0.6, `fin ${c.fin} len ${c.len}`);
});

test('bottino a mano: con `fruga` passarci sopra non raccoglie, `prendi` sceglie cosa e controlla la portata', () => {
  const s = arena(heroBase());
  assert.deepEqual(dungeon.act(s, { t: 'fruga' }), []);
  assert.equal(dungeon.act(s, { t: 'fruga' }), null, 'una volta basta');
  const l = { id: s.nextId++, x: s.hero.x + 1, z: s.hero.z, tipo: 'cadavere' as const, items: { lingotto_ferro: 2, zanna_lupo: 3 }, monete: 7, vuoto: false, pieno: false };
  s.loot.push(l);
  run(s, 40, inp({ mx: 0.4 })); // ci cammina sopra
  assert.equal(s.monete, 0); assert.deepEqual(s.bottino, {});
  assert.deepEqual(contenuto(s, l.id), { tipo: 'cadavere', items: { lingotto_ferro: 2, zanna_lupo: 3 }, monete: 7, vuoto: false });
  const ev = dungeon.act(s, { t: 'prendi', id: l.id, item: 'zanna_lupo' })!;
  assert.deepEqual(ev, [{ t: 'raccolto', item: 'zanna_lupo', n: 3 }]);
  assert.deepEqual(s.bottino, { zanna_lupo: 3 }); assert.equal(s.monete, 0);
  assert.equal(dungeon.act(s, { t: 'prendi', id: l.id, item: 'zanna_lupo' }), null, 'non ce n\'è più');
  const tutto = dungeon.act(s, { t: 'prendi', id: l.id })!;
  assert.ok(tutto.some((e) => e.t === 'monete' && e.n === 7) && tutto.some((e) => e.t === 'raccolto' && e.item === 'lingotto_ferro'));
  assert.equal(l.vuoto, true);
  // lontano: non si fruga
  const l2 = { id: s.nextId++, x: s.hero.x + 8, z: s.hero.z, tipo: 'forziere' as const, items: { pepita_oro: 1 }, monete: 0, vuoto: false, pieno: false };
  s.loot.push(l2);
  assert.equal(dungeon.act(s, { t: 'prendi', id: l2.id }), null);
  // in terza persona (senza fruga) si raccoglie passandoci sopra come sempre
  const t = arena(heroBase());
  t.loot.push({ id: t.nextId++, x: t.hero.x + 1, z: t.hero.z, tipo: 'cadavere', items: { zanna_lupo: 1 }, monete: 4, vuoto: false, pieno: false });
  run(t, 40, inp({ mx: 0.4 }));
  assert.equal(t.monete, 4);
});

test('bottino a mano: le azioni passano dalla rete e il server rigioca lo stesso esito', () => {
  assert.deepEqual(parseDungeonAzione({ t: 'fruga' }), { t: 'fruga' });
  assert.deepEqual(parseDungeonAzione({ t: 'prendi', id: 3, item: 'monete' }), { t: 'prendi', id: 3, item: 'monete' });
  assert.deepEqual(parseDungeonAzione({ t: 'prendi', id: 3 }), { t: 'prendi', id: 3 });
  assert.equal(parseDungeonAzione({ t: 'prendi', id: -1 }), null);
  assert.equal(parseDungeonAzione({ t: 'prendi', id: 2.5 }), null);
  // una Grotta vera giocata dall'autopilota frugando: appena un bottino è a portata se ne prende tutto; il replay dà lo stesso hash
  const hero = heroBase({ max: { vita: 400, magicka: 100, stamina: 100 } });
  const s = dungeon.create({ seed: 9, dungeon: 'grotta', hero }), azioni: DungeonAzioni = [], frames: DungeonInput[] = [], rng = createRng(4);
  const fa = (a: Parameters<typeof dungeon.act>[1]): boolean => { const ok = !!dungeon.act(s, a); if (ok) azioni.push([s.tick, a]); return ok; };
  fa({ t: 'fruga' });
  let presi = 0;
  for (let i = 0; i < 20000 && presi < 2 && !s.done; i++) {
    for (const l of s.loot) if (!l.vuoto && aPortata(s, l) && fa({ t: 'prendi', id: l.id })) presi++;
    const f = quantizeDungeon(dungeon.autopilot(s, rng)); frames.push(f); dungeon.step(s, f);
  }
  assert.ok(presi >= 1, "l'autopilota è passato vicino a un bottino");
  const diretto = dungeon.result(s);
  const log = decodeDungeon(encodeDungeon(packDungeon(frames)), dungeon.maxTicks)!;
  const r = replayDungeon(9, 'grotta', hero, log, { azioni });
  assert.equal(r.hash, diretto.hash); assert.deepEqual(r.bottino, diretto.bottino); assert.equal(r.monete, diretto.monete);
  // senza le azioni (niente fruga) il server raccoglierebbe da solo: l'esito sarebbe un altro
  assert.notEqual(replayDungeon(9, 'grotta', hero, log).hash, diretto.hash);
});

test('log: il formato 5 porta l\'alzo solo con la mira, i formati di prima si leggono uguali', () => {
  const righe = packDungeon([inp({ a: true, m: 12, p: 40 }), inp({ a: true, m: 12, p: 40 }), inp({ m: 3 }), inp()]);
  assert.deepEqual(righe, [[2, 0, 0, 1, 12, 40], [1, 0, 0, 0, 3], [1, 0, 0, 0]]);
  assert.deepEqual(decodeDungeon(encodeDungeon(righe), 100), righe);
  assert.deepEqual(frameOfRiga([1, 0, 0, 0, 12, 40]), { ...inp(), m: 12, p: 40 });
  assert.deepEqual(frameOfRiga([1, 0, 0, 0, 0, 40]), inp(), 'alzo senza mira: niente');
  assert.equal(quantizeDungeon(inp({ p: 40 })).p, undefined);
  assert.equal(quantizeDungeon(inp({ m: 4, p: ALZO_N + 1 })).p, undefined);
  assert.equal(Buffer.from(encodeDungeon([[1, 0, 0, 32]]), 'base64')[0], 4, 'senza alzo resta il formato 4');
});

test('attacco furtivo: in prima persona chi dorme prende il doppio (i boss no, in terza persona niente)', () => {
  const colpo = (fruga: boolean, tipo = 'bandito'): { danno: number; furtivo: boolean } => {
    const s = arena(heroBase());
    if (fruga) dungeon.act(s, { t: 'fruga' });
    const e = bersaglio(s, 1.8, tipo); // camminando piano chi dorme non ti nota finché non gli arrivi addosso
    const ev = [...run(s, 2, inp({ a: true, m: aimIndex(1, 0) })), ...run(s, 60, inp({ m: aimIndex(1, 0) }))];
    return { danno: 100000 - e.vita, furtivo: ev.some((x) => x.t === 'furtivo') };
  };
  const pp = colpo(true), tp = colpo(false), capo = colpo(true, 're_ossa');
  assert.ok(pp.furtivo && !tp.furtivo && !capo.furtivo);
  assert.ok(Math.abs(pp.danno / tp.danno - (RPG.dungeon.furtivo?.danno ?? 1)) < 0.05, `${pp.danno} contro ${tp.danno}`);
});

test('bombe nemiche: la vista dice da dove sono partite (prima persona: si vedono arrivare)', () => {
  const s = arena(heroBase({ max: { vita: 900, magicka: 100, stamina: 100 } }));
  const a = newEnemy(s, 'aerostato_spia', s.hero.x + 4, s.hero.z); a.aggro = true; a.st = 'insegue';
  let g: ReturnType<typeof dungeon.view>['geyser'][number] | undefined;
  for (let i = 0; i < 400 && !g; i++) { dungeon.step(s, inp()); g = dungeon.view(s).geyser.find((x) => x.bomba); }
  assert.ok(g?.da, 'la bomba ha il suo punto di partenza');
});
