// Regata (GDD §6 n. 1): gara in barca tra 6-8 boe nella laguna, con raffiche di vento da seed che spingono di lato.
// Le boe sono tutte raggiungibili in linea retta dalla precedente. Le medaglie scalano con la lunghezza del percorso.
import { ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { TICK_HZ } from '../../constants.ts';
import { createRng } from '../../rng.ts';
import type { Rng } from '../../rng.ts';
import type { InputFrame, Vec2 } from '../../types.ts';
import { boatParams, newBoat, stepBoat } from '../../world/boat.ts';
import type { BoatState } from '../../world/boat.ts';
import { parseIsland } from '../../world/grid.ts';
import type { GridMap } from '../../world/grid.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from '../types.ts';

export type Buoy = { x: number; z: number; passed: boolean };
/** Raffica: dal tick `start` per `len` tick, direzione (dx, dz) unitaria, forza in m/s al picco (inviluppo a seno). */
export type Gust = { start: number; len: number; dx: number; dz: number; force: number };
export type RegataState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  boat: BoatState;
  buoys: Buoy[];
  next: number;
  done: boolean;
  finishTick: number;
  wind: Vec2;
  gusts: Gust[];
  /** Lunghezza del percorso in linea retta (m) e soglie delle medaglie in tick per questo percorso. */
  length: number;
  medalTicks: { oro: number; argento: number; bronzo: number };
  /** Tick impiegati dal pilota di riferimento (autopilot) su questo percorso. */
  parTicks: number;
  map: GridMap;
};
export type RegataView = {
  boat: BoatState;
  buoys: Buoy[];
  next: number;
  ms: number;
  maxMs: number;
  wind: Vec2;
  /** 0..1: intensità della raffica in corso (per l'effetto a schermo). */
  gust: number;
  done: boolean;
  finished: boolean;
  medals: { oro: number; argento: number; bronzo: number };
  radius: number;
};

type RegataCfgFull = {
  maxSeconds: number;
  buoys: { min: number; max: number; radius: number; spread: number; minLeg?: number; margin?: number };
  wind: { gustEverySeconds: [number, number]; gustSeconds: number; force: number; difficulty?: [number, number, number] };
  medals: { oro: number; argento: number; bronzo: number };
  /** Soglie delle medaglie come multipli del tempo del pilota di riferimento su questo percorso (con queste raffiche). */
  medalsPar?: { oro: number; argento: number; bronzo: number };
  lazyGas?: number;
  scoreBase: number;
};
const CFG = MINIGAMES_CFG.regata as unknown as RegataCfgFull;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const RADIUS = CFG.buoys.radius;

/** Tratto dritto tutto in acqua (campionato ogni mezzo metro): 2 m di margine, 1 m nei primi 3 m (la partenza è sotto il molo). */
export function segmentClear(map: GridMap, a: Vec2, b: Vec2): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len * 2));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    const m = (len * i) / n < 3 ? 1 : 2;
    if (!map.navigable(x, z) || !map.navigable(x + m, z) || !map.navigable(x - m, z) || !map.navigable(x, z + m) || !map.navigable(x, z - m)) return false;
  }
  return true;
}

function pickWater(rng: Rng, map: GridMap, from: Vec2, prev: Vec2 | null): Vec2 {
  const spread = CFG.buoys.spread, minLeg = CFG.buoys.minLeg ?? 8, mg = CFG.buoys.margin ?? 3;
  const W = map.w * map.tile, Hh = map.h * map.tile;
  let fallback: Vec2 | null = null;
  for (let i = 0; i < 600; i++) {
    const x = from.x + (rng.next() * 2 - 1) * spread;
    const z = from.z + (rng.next() * 2 - 1) * spread;
    if (x < mg || z < mg || x > W - mg || z > Hh - mg) continue; // dentro la laguna visibile
    if (Math.hypot(x - from.x, z - from.z) < minLeg) continue;
    if (prev && Math.hypot(x - prev.x, z - prev.z) < minLeg) continue; // niente avanti-indietro sulla stessa boa
    if (prev) {
      // niente tornanti: la virata alla boa è al massimo di ~120°
      const ax = from.x - prev.x, az = from.z - prev.z, bx = x - from.x, bz = z - from.z;
      if ((ax * bx + az * bz) / ((Math.hypot(ax, az) || 1) * (Math.hypot(bx, bz) || 1)) < -0.5) continue;
    }
    if (!segmentClear(map, from, { x, z })) continue;
    if (!fallback) fallback = { x, z };
    return { x, z };
  }
  // non dovrebbe capitare: un punto a minLeg in una direzione libera
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const p = { x: from.x + Math.cos(a) * minLeg, z: from.z + Math.sin(a) * minLeg };
    if (segmentClear(map, from, p)) return p;
  }
  return fallback ?? { x: from.x, z: from.z - minLeg };
}

function makeGusts(rng: Rng, difficulty: Difficulty): Gust[] {
  const w = CFG.wind;
  const k = (w.difficulty ?? [0.6, 1, 1.4])[difficulty - 1] ?? 1;
  const out: Gust[] = [];
  let t = 0;
  for (;;) {
    t += Math.round((w.gustEverySeconds[0] + rng.next() * (w.gustEverySeconds[1] - w.gustEverySeconds[0])) * TICK_HZ);
    if (t >= MAX_TICKS) break;
    const a = rng.next() * Math.PI * 2;
    out.push({ start: t, len: Math.round(w.gustSeconds * TICK_HZ), dx: Math.cos(a), dz: Math.sin(a), force: w.force * k * (0.7 + 0.3 * rng.next()) });
  }
  return out;
}

/** Vento al tick dato: somma delle raffiche attive, con inviluppo a seno (sale e scende morbido). */
export function windAt(gusts: readonly Gust[], tick: number): { wind: Vec2; gust: number } {
  let x = 0, z = 0, g = 0;
  for (const q of gusts) {
    if (tick < q.start || tick >= q.start + q.len) continue;
    const e = Math.sin((Math.PI * (tick - q.start)) / q.len);
    x += q.dx * q.force * e;
    z += q.dz * q.force * e;
    g = Math.max(g, e);
  }
  return { wind: { x, z }, gust: g };
}

function medalOf(s: RegataState): Medal {
  if (!s.finishTick) return null;
  const m = s.medalTicks;
  return s.finishTick <= m.oro ? 'oro' : s.finishTick <= m.argento ? 'argento' : s.finishTick <= m.bronzo ? 'bronzo' : null;
}

/** Velocità di virata dell'autopilot: base + extra × (quanto è dritta la virata), zona di frenata = 2 m + v × k. */
const TURN_V: [number, number, number] = [5, 4, 0.6];
const LAZY_GAS = CFG.lazyGas ?? 0.35;

/** Inizio del tratto verso la boa `i` (la boa precedente o la partenza). */
function legStart(s: RegataState, i: number): Vec2 {
  const p = s.buoys[i - 1];
  return p ? { x: p.x, z: p.z } : { x: s.map.boatSpawn.x, z: s.map.boatSpawn.z };
}

/**
 * Pilota che segue la linea del tratto (che è tutta in acqua): punta un punto 6 m più avanti sulla linea, compensa il vento
 * se richiesto e frena prima delle virate strette. `gas` 0..1: 1 = tutta forza (tasto A).
 */
function pilot(s: RegataState, gas: number, compensate: boolean, careful: boolean): InputFrame {
  const b = s.buoys[s.next];
  if (!b) return { mx: 0, my: 0, a: false, b: false };
  const a = legStart(s, s.next);
  const lx = b.x - a.x, lz = b.z - a.z;
  const L = Math.hypot(lx, lz) || 1;
  const ux = lx / L, uz = lz / L;
  const along = Math.max(0, Math.min(L, (s.boat.x - a.x) * ux + (s.boat.z - a.z) * uz));
  const off = Math.abs((s.boat.x - a.x) * uz - (s.boat.z - a.z) * ux); // distanza dalla linea: se sei fuori, rientra quasi di traverso
  const ahead = Math.min(L, along + Math.max(1.5, 6 - off));
  const tx = a.x + ux * ahead - s.boat.x, tz = a.z + uz * ahead - s.boat.z;
  const td = Math.hypot(tx, tz) || 1;
  const v = boatParams().maxSpeed * gas;
  let hx = (tx / td) * v, hz = (tz / td) * v;
  if (compensate) { hx -= s.wind.x; hz -= s.wind.z; }
  const h = Math.hypot(hx, hz) || 1;
  // virata alla boa: quanto gira il tratto dopo; più è stretta, più si arriva piano
  const c = s.buoys[s.next + 1];
  let brake = false;
  const d = Math.hypot(b.x - s.boat.x, b.z - s.boat.z);
  if (c && careful) {
    const nx = c.x - b.x, nz = c.z - b.z;
    const cos = (nx * ux + nz * uz) / (Math.hypot(nx, nz) || 1);
    const vTurn = TURN_V[0] + TURN_V[1] * Math.max(0, (cos + 1) / 2);
    brake = d < 2 + s.boat.speed * TURN_V[2] && s.boat.speed > vTurn;
  }
  if (brake) return { mx: hx / h, my: hz / h, a: false, b: true };
  return gas >= 1 ? { mx: hx / h, my: hz / h, a: true, b: false } : { mx: (hx / h) * gas, my: (hz / h) * gas, a: false, b: false };
}

/** Autopilot «pigro» di riferimento per la taratura: un terzo di gas, niente compensazione del vento, non frena mai. Deve fare bronzo o niente. */
export function lazyAutopilot(s: RegataState): InputFrame {
  return pilot(s, LAZY_GAS, false, false);
}

export const regata: MinigameModule<RegataState> = {
  id: 'regata',
  version: 2,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const root = createRng(seed).fork('regata');
    const rng = root.fork('boe');
    // percorso fissato per id (non per posizione in islands.json): le sfide in corso si rigiocano sempre sulla stessa mappa. Fetta 2: laguna.
    const def = ISLANDS.find((i) => i.id === 'prova') ?? ISLANDS[0];
    if (!def) throw new Error('Nessuna isola');
    const map = parseIsland(def);
    const n = rng.int(CFG.buoys.min, CFG.buoys.max);
    const buoys: Buoy[] = [];
    let from: Vec2 = { x: map.boatSpawn.x, z: map.boatSpawn.z };
    let prev: Vec2 | null = null;
    let length = 0;
    for (let i = 0; i < n; i++) {
      const p = pickWater(rng, map, from, prev);
      length += Math.hypot(p.x - from.x, p.z - from.z);
      buoys.push({ ...p, passed: false });
      prev = from;
      from = p;
    }
    const st: RegataState = {
      seed, difficulty, tick: 0, boat: newBoat(map.boatSpawn.x, map.boatSpawn.z), buoys, next: 0, done: false, finishTick: 0,
      wind: { x: 0, z: 0 }, gusts: makeGusts(root.fork('vento'), difficulty), length: Math.round(length * 10) / 10,
      medalTicks: { oro: MAX_TICKS, argento: MAX_TICKS, bronzo: MAX_TICKS }, parTicks: MAX_TICKS, map,
    };
    // tempo di riferimento: il pilota automatico su una copia dello stesso percorso con le stesse raffiche
    const ghost: RegataState = { ...st, buoys: buoys.map((b) => ({ ...b })) };
    while (!ghost.done) regata.step(ghost, pilot(ghost, 1, true, true));
    const par = ghost.finishTick || MAX_TICKS;
    const P = CFG.medalsPar ?? { oro: 1.15, argento: 1.5, bronzo: 2.3 };
    const mt = (k: number) => Math.min(MAX_TICKS, Math.ceil(par * k));
    st.parTicks = par;
    st.medalTicks = { oro: mt(P.oro), argento: mt(P.argento), bronzo: mt(P.bronzo) };
    return st;
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    s.wind = windAt(s.gusts, s.tick).wind;
    s.boat = stepBoat(s.boat, input, s.map, s.wind);
    const b = s.buoys[s.next];
    if (b && Math.hypot(b.x - s.boat.x, b.z - s.boat.z) <= RADIUS) {
      b.passed = true;
      s.next++;
    }
    if (s.next >= s.buoys.length) {
      s.done = true;
      s.finishTick = s.tick;
    } else if (s.tick >= MAX_TICKS) {
      s.done = true;
      s.finishTick = 0;
    }
  },
  /** score più alto = meglio: chi finisce prende max(boe, scoreBase − ms/10) (sempre sopra chi non finisce); chi non finisce prende le boe passate. */
  result(s): MinigameResult {
    const finished = s.done && s.finishTick > 0;
    const ms = finished ? Math.round((s.finishTick / TICK_HZ) * 1000) : Math.round((s.tick / TICK_HZ) * 1000);
    const score = finished ? Math.max(s.buoys.length, CFG.scoreBase - Math.floor(ms / 10)) : s.next;
    const toMs = (t: number) => Math.round((t / TICK_HZ) * 1000);
    return {
      done: s.done, score, medal: medalOf(s),
      detail: { ms, boe: s.next, tot: s.buoys.length, lunghezza: Math.round(s.length), parMs: toMs(s.parTicks), oroMs: toMs(s.medalTicks.oro), argentoMs: toMs(s.medalTicks.argento), bronzoMs: toMs(s.medalTicks.bronzo) },
    };
  },
  /** Autopilot di riferimento (deve fare oro): segue la linea, compensa il vento, frena prima delle virate strette. */
  autopilot(s): InputFrame {
    return pilot(s, 1, true, true);
  },
  view(s): RegataView {
    const toMs = (t: number) => Math.round((t / TICK_HZ) * 1000);
    return {
      boat: s.boat, buoys: s.buoys, next: s.next, ms: toMs(s.finishTick || s.tick), maxMs: CFG.maxSeconds * 1000, wind: s.wind,
      gust: windAt(s.gusts, s.tick).gust, done: s.done, finished: s.finishTick > 0,
      medals: { oro: toMs(s.medalTicks.oro), argento: toMs(s.medalTicks.argento), bronzo: toMs(s.medalTicks.bronzo) }, radius: RADIUS,
    };
  },
};
