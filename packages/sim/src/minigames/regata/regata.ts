// Regata (GDD §6 n. 1): giro chiuso di boe fisse nella laguna (mappa `laguna`, coordinate locali all'isola), con raffiche di
// vento da seed che spingono di lato. Il percorso sta in content (minigames/regata.json → course); le medaglie sono multipli del
// tempo del pilota di riferimento con le raffiche di quel seed.
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
import * as trig from '../../trig.ts';

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
  /** Partenza (= boatSpawn della laguna) e isola del percorso: le coordinate sono locali a questa isola. */
  start: Vec2;
  island: string;
};

type RegataCfgFull = {
  maxSeconds: number;
  buoys: { radius: number };
  /** Percorso fisso: isola e boe [x, z] in metri locali all'isola, nell'ordine; l'ultima è l'arrivo (vicino alla partenza). */
  course: { island: string; buoys: [number, number][] };
  wind: { gustEverySeconds: [number, number]; gustSeconds: number; force: number; difficulty?: [number, number, number] };
  /** Soglie delle medaglie come multipli del tempo del pilota di riferimento su questo percorso (con queste raffiche). */
  medalsPar?: { oro: number; argento: number; bronzo: number };
  lazyGas?: number;
  scoreBase: number;
};
const CFG = MINIGAMES_CFG.regata as unknown as RegataCfgFull;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const RADIUS = CFG.buoys.radius;

/** Mappa della regata (per id, non per posizione in islands.json: le sfide in corso si rigiocano sempre sulla stessa mappa). */
let MAP: GridMap | null = null;
export function regataMap(): GridMap {
  if (MAP) return MAP;
  const def = ISLANDS.find((i) => i.id === CFG.course.island);
  if (!def) throw new Error(`Regata: manca l'isola ${CFG.course.island}`);
  MAP = parseIsland(def);
  return MAP;
}
/** Boe del percorso (copie nuove). */
export function regataCourse(): Buoy[] {
  return CFG.course.buoys.map(([x, z]) => ({ x, z, passed: false }));
}

/** Tratto dritto tutto in acqua (campionato ogni mezzo metro): 2 m di margine, 1 m nei primi 3 m (la partenza è sotto il molo). */
export function segmentClear(map: GridMap, a: Vec2, b: Vec2): boolean {
  const len = trig.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len * 2));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    const m = (len * i) / n < 3 ? 1 : 2;
    if (!map.navigable(x, z) || !map.navigable(x + m, z) || !map.navigable(x - m, z) || !map.navigable(x, z + m) || !map.navigable(x, z - m)) return false;
  }
  return true;
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
    out.push({ start: t, len: Math.round(w.gustSeconds * TICK_HZ), dx: trig.cos(a), dz: trig.sin(a), force: w.force * k * (0.7 + 0.3 * rng.next()) });
  }
  return out;
}

/** Vento al tick dato: somma delle raffiche attive, con inviluppo a seno (sale e scende morbido). */
export function windAt(gusts: readonly Gust[], tick: number): { wind: Vec2; gust: number } {
  let x = 0, z = 0, g = 0;
  for (const q of gusts) {
    if (tick < q.start || tick >= q.start + q.len) continue;
    const e = trig.sin((Math.PI * (tick - q.start)) / q.len);
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
  const L = trig.hypot(lx, lz) || 1;
  const ux = lx / L, uz = lz / L;
  const along = Math.max(0, Math.min(L, (s.boat.x - a.x) * ux + (s.boat.z - a.z) * uz));
  const off = Math.abs((s.boat.x - a.x) * uz - (s.boat.z - a.z) * ux); // distanza dalla linea: se sei fuori, rientra quasi di traverso
  const ahead = Math.min(L, along + Math.max(1.5, 6 - off));
  const tx = a.x + ux * ahead - s.boat.x, tz = a.z + uz * ahead - s.boat.z;
  const td = trig.hypot(tx, tz) || 1;
  const v = boatParams().maxSpeed * gas;
  let hx = (tx / td) * v, hz = (tz / td) * v;
  if (compensate) { hx -= s.wind.x; hz -= s.wind.z; }
  const h = trig.hypot(hx, hz) || 1;
  // virata alla boa: quanto gira il tratto dopo; più è stretta, più si arriva piano
  const c = s.buoys[s.next + 1];
  let brake = false;
  const d = trig.hypot(b.x - s.boat.x, b.z - s.boat.z);
  if (c && careful) {
    const nx = c.x - b.x, nz = c.z - b.z;
    const cos = (nx * ux + nz * uz) / (trig.hypot(nx, nz) || 1);
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
  version: 3,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const root = createRng(seed).fork('regata');
    const map = regataMap();
    const buoys = regataCourse();
    let length = 0;
    let from: Vec2 = map.boatSpawn;
    for (const p of buoys) { length += trig.hypot(p.x - from.x, p.z - from.z); from = p; }
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
    if (b && trig.hypot(b.x - s.boat.x, b.z - s.boat.z) <= RADIUS) {
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
      start: { x: s.map.boatSpawn.x, z: s.map.boatSpawn.z }, island: s.map.id,
    };
  },
};
