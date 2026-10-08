// Pilota automatico (test e modalità demo): esplora verso nemici e bottini vicini, combatte schivando i colpi telegrafati,
// beve sotto il 35 % di vita, torna alla scala quando non c'è più niente (o lo zaino è pieno, o il tempo stringe) e preme A.
// Non tocca lo stato della sim: la sua memoria sta in una WeakMap (il replay non la vede).
import type { Rng } from '../rng.ts';
import type { DungeonInput } from './types.ts';
import { NO_DUNGEON_INPUT } from './types.ts';
import type { DungeonState, Enemy } from './state.ts';
import { parte } from './state.ts';
import { bfs, cellCenter, cellOf, clearPath, lineOfSight, stepDown } from './map.ts';
import { fits, pesoZaino } from './loot.ts';
import { vicinoUscita } from './hero.ts';
import { HZ } from './tuning.ts';

type Mem = {
  field: Int32Array; fieldGoal: number; fieldTick: number;
  heroField: Int32Array; heroFieldTick: number;
  prevA: boolean; prevC: boolean; prevD: boolean;
  goal: string; anchorX: number; anchorZ: number; anchorTick: number;
  ban: Map<string, number>;
};
/** Una memoria per eroe (insieme ognuno ha il suo pilota). */
const MEM = new WeakMap<DungeonState, Map<number, Mem>>();
function mem(s: DungeonState): Mem {
  let all = MEM.get(s);
  if (!all) { all = new Map(); MEM.set(s, all); }
  let m = all.get(s.cur);
  if (!m) {
    const n = s.map.w * s.map.h;
    m = { field: new Int32Array(n), fieldGoal: -2, fieldTick: -999, heroField: new Int32Array(n), heroFieldTick: -999, prevA: false, prevC: false, prevD: false, goal: '', anchorX: s.hero.x, anchorZ: s.hero.z, anchorTick: s.tick, ban: new Map() };
    all.set(s.cur, m);
  }
  return m;
}

type Out = { mx: number; my: number; a: boolean; b: boolean; c: boolean; d: boolean };
const norm = (dx: number, dz: number): { x: number; z: number } => {
  const d = Math.sqrt(dx * dx + dz * dz);
  return d > 1e-6 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
};

/** Direzione verso un punto: dritto se il corridoio è libero, altrimenti lungo il campo BFS dalla meta. null = irraggiungibile. */
function nav(s: DungeonState, m: Mem, gx: number, gz: number): { x: number; z: number } | null {
  const h = s.hero, r = s.runHero.raggio + 0.05;
  if (clearPath(s.map, h.x, h.z, gx, gz, r)) return norm(gx - h.x, gz - h.z);
  const goal = cellOf(s.map, gx, gz);
  if (goal !== m.fieldGoal || s.tick - m.fieldTick > 120) { bfs(s.map, goal, m.field); m.fieldGoal = goal; m.fieldTick = s.tick; }
  const here = cellOf(s.map, h.x, h.z);
  if (here < 0 || m.field[here]! < 0) return null;
  const n1 = stepDown(s.map, m.field, here);
  if (n1 < 0) return norm(gx - h.x, gz - h.z);
  const n2 = stepDown(s.map, m.field, n1);
  const p = n2 >= 0 && clearPath(s.map, h.x, h.z, cellCenter(s.map, n2).x, cellCenter(s.map, n2).z, r) ? cellCenter(s.map, n2) : cellCenter(s.map, n1);
  return norm(p.x - h.x, p.z - h.z);
}

function heroField(s: DungeonState, m: Mem): Int32Array {
  if (s.tick - m.heroFieldTick >= 30) { bfs(s.map, cellOf(s.map, s.hero.x, s.hero.z), m.heroField); m.heroFieldTick = s.tick; }
  return m.heroField;
}

/** Combattimento contro `e`: schiva i colpi in preparazione, si avvicina, attacca (mischia, arco o magia). */
function fight(s: DungeonState, m: Mem, e: Enemy, o: Out): void {
  const h = s.hero, rh = s.runHero, a = h.arma;
  const dx = e.x - h.x, dz = e.z - h.z, d = Math.sqrt(dx * dx + dz * dz), u = norm(dx, dz);
  const vede = lineOfSight(s.map, h.x, h.z, e.x, e.z);
  // magia: distruzione se vede il bersaglio, evocazione se non c'è già un alleato
  const sp = rh.magia !== null ? rh.magie[rh.magia] : undefined;
  if (sp && h.act === 'idle' && h.cdMagia === 0 && h.magicka >= sp.costo && !m.prevC && vede && d < 14) {
    const alleato = s.enemies.some((x) => x.alleato && x.st !== 'morto' && (x.padrone ?? 0) === s.cur);
    if (sp.scuola === 'distruzione' || !alleato) { o.c = true; o.mx = u.x * 0.2; o.my = u.z * 0.2; return; }
  }
  // schivata: il nemico sta per colpire e siamo nel suo raggio → via (correndo se il colpo è ad area)
  if (e.st === 'prepara' && !e.tiro && (h.act === 'idle' || h.act === 'press')) {
    const raggio = e.area ? e.def.portata * 1.7 + rh.raggio + 0.6 : e.def.portata + e.def.raggio + rh.raggio + 0.6;
    if (d < raggio) {
      const back = nav(s, m, h.x - u.x * 3, h.z - u.z * 3) ?? { x: -u.x, z: -u.z };
      o.mx = back.x; o.my = back.z; o.b = e.area;
      return;
    }
  }
  if (a.kind === 'arco') {
    if (h.frecce <= 0) return;
    if (!vede || d > 14) { const v = nav(s, m, e.x, e.z); if (v) { o.mx = v.x; o.my = v.z; } return; }
    if (h.act === 'tende') { o.a = h.carica < 1; o.mx = u.x * 0.15; o.my = u.z * 0.15; return; }
    if (h.act === 'idle' && !m.prevA) { o.a = true; o.mx = u.x * 0.15; o.my = u.z * 0.15; }
    return;
  }
  const reach = a.portata + e.def.raggio - 0.15;
  if (d > reach || !vede) { const v = nav(s, m, e.x, e.z); if (v) { o.mx = v.x; o.my = v.z; } return; }
  // attacco normale: premi un tick, rilascia il successivo (lo swing parte al rilascio)
  if (h.act === 'idle' && !m.prevA) { o.a = true; o.mx = u.x * 0.15; o.my = u.z * 0.15; }
}

export function autopilot(s: DungeonState, rng: Rng): DungeonInput {
  void rng;
  if (s.done) return { ...NO_DUNGEON_INPUT };
  const m = mem(s), h = s.hero, rh = s.runHero;
  const o: Out = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
  const finish = (): DungeonInput => { m.prevA = o.a; m.prevC = o.c; m.prevD = o.d; return o; };
  // tieni A mentre carichi o tendi (lo decide fight); altrimenti un tocco per volta
  if (h.vita < rh.max.vita * 0.35 && h.pozioni > 0 && h.act === 'idle' && !m.prevD) { o.d = true; return finish(); }
  for (const [k, until] of m.ban) if (until <= s.tick) m.ban.delete(k);
  const libero = rh.caricoMax - pesoZaino(s);
  const tempo = s.tick > 20 * 60 * HZ - 3 * 60 * HZ;
  const ritirata = h.vita < rh.max.vita * 0.25 && h.pozioni <= 0;
  const disarmato = h.arma.kind === 'arco' && h.frecce <= 0;
  // minaccia: un ostile in aggro vicino, o uno che si vede da vicino
  let threat: Enemy | null = null, td = Infinity;
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto' || e.st === 'scappa') continue;
    const dx = e.x - h.x, dz = e.z - h.z, d2 = dx * dx + dz * dz;
    if (d2 >= td) continue;
    if ((e.aggro && d2 < 14 * 14) || (d2 < 7 * 7 && lineOfSight(s.map, h.x, h.z, e.x, e.z))) { threat = e; td = d2; }
  }
  if (threat && !tempo && !ritirata && !disarmato) { fight(s, m, threat, o); m.goal = 'fight'; m.anchorTick = s.tick; return finish(); }
  // meta: il bottino o il nemico più vicino (per strada), poi la scala
  let goal = 'exit', gx = s.map.exit.x, gz = s.map.exit.z;
  if (!tempo && !ritirata && libero >= 0.5) {
    const f = heroField(s, m);
    let best = Infinity;
    for (const l of s.loot) {
      if (parte(s, l).vuoto || m.ban.has(`l${l.id}`) || !fits(s, l)) continue;
      const c = f[cellOf(s.map, l.x, l.z)] ?? -1;
      if (c >= 0 && c < best) { best = c; goal = `l${l.id}`; gx = l.x; gz = l.z; }
    }
    if (!disarmato)
      for (const e of s.enemies) {
        if (e.alleato || e.st === 'morto' || e.st === 'scappa' || m.ban.has(`e${e.id}`)) continue;
        const c = f[cellOf(s.map, e.x, e.z)] ?? -1;
        if (c >= 0 && c < best) { best = c; goal = `e${e.id}`; gx = e.x; gz = e.z; }
      }
  }
  // bloccati? se in 1,5 s non ci siamo mossi di 0,6 m, la meta va in castigo per 20 s
  if (goal !== m.goal) { m.goal = goal; m.anchorX = h.x; m.anchorZ = h.z; m.anchorTick = s.tick; }
  else if (s.tick - m.anchorTick >= 90) {
    const mx = h.x - m.anchorX, mz = h.z - m.anchorZ;
    if (mx * mx + mz * mz < 0.36 && goal !== 'exit') m.ban.set(goal, s.tick + 20 * HZ);
    m.anchorX = h.x; m.anchorZ = h.z; m.anchorTick = s.tick;
  }
  if (goal === 'exit' && vicinoUscita(s)) { o.a = !m.prevA; return finish(); }
  const v = nav(s, m, gx, gz);
  if (!v) { if (goal !== 'exit') m.ban.set(goal, s.tick + 20 * HZ); return finish(); }
  o.mx = v.x; o.my = v.z;
  // corre verso la scala o quando ha stamina in abbondanza
  o.b = goal === 'exit' ? h.stamina > 10 : h.stamina > rh.max.stamina * 0.6;
  return finish();
}
