// Consegne in barca (GDD §6, minigioco universale): il corriere del molo ti dà un pacco per un altro molo dell'arcipelago (Porto, Laguna,
// lotti), scelto dal seed; lo porti in barca prima che scada il tempo, poi lì c'è il pacco dopo. Il tempo avanzato passa al pacco
// successivo (come un taxi arcade), le cassette che galleggiano lungo la rotta danno secondi in più. Si gioca sull'arcipelago vero, con
// la stessa barca e le stesse collisioni del mondo (stepBoat). Numeri in content (minigames/consegne.json).
// Il molo di partenza è il PRIMO input della partita: startFrame(molo) (mx = (molo + 1) / 32, esatto dopo la quantizzazione); il primo
// tick non muove la barca. Così il server, che sceglie solo il seed, rigioca la stessa partita da qualunque molo l'hai cominciata.
import { ARCHIPELAGO, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { TICK_HZ } from '../../constants.ts';
import { createRng } from '../../rng.ts';
import type { InputFrame, Vec2 } from '../../types.ts';
import { composeArchipelago } from '../../world/archipelago.ts';
import type { Archipelago } from '../../world/archipelago.ts';
import { newBoat, stepBoat } from '../../world/boat.ts';
import type { BoatState } from '../../world/boat.ts';
import type { GridMap } from '../../world/grid.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from '../types.ts';
import { lunghezza, rotta, trattoLibero } from './rotta.ts';

const CFG = MINIGAMES_CFG.consegne;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const R2 = CFG.raggio * CFG.raggio;
const CR2 = CFG.cassette.raggio * CFG.cassette.raggio;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

/** Un molo dell'arcipelago: `id` = 'porto', 'laguna' o 'lotto:N'; (x, z) = la B, dove si ormeggia (coordinate mondo, m). */
export type Molo = { id: string; nome: string; island: string; slot: number | null; x: number; z: number };
export type Cassa = { x: number; z: number; presa: boolean };
export type ConsegneState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  /** Molo di partenza (−1 finché non arriva il primo input). */
  start: number;
  boat: BoatState;
  /** route[0] = partenza, route[i] = destinazione del pacco i (1-based). */
  route: number[];
  /** Pacchi consegnati (= indice del tratto in corso). */
  consegnate: number;
  /** Tick rimasti al pacco in corso. */
  left: number;
  /** Tick dati al pacco in corso (per la barra del tempo). */
  legTicks: number;
  path: Vec2[];
  metri: number;
  casse: Cassa[];
  prese: number;
  done: boolean;
  timeUp: boolean;
  finishTick: number;
};
export type ConsegneView = {
  started: boolean;
  boat: BoatState;
  /** Molo di partenza e destinazione del pacco in corso (null a partita finita o prima di cominciare). */
  from: Molo | null;
  dest: Molo | null;
  consegnate: number;
  totale: number;
  leftMs: number;
  legMs: number;
  ms: number;
  maxMs: number;
  casse: Cassa[];
  prese: number;
  path: Vec2[];
  raggio: number;
  done: boolean;
  timeUp: boolean;
  medaglie: { oro: number; argento: number; bronzo: number };
};

// ---------- arcipelago e moli (statici: si calcolano una volta) ----------
let ARCH: Archipelago | null = null, MOLI: Molo[] | null = null;
export function consegneMappa(): GridMap {
  ARCH ??= composeArchipelago(ARCHIPELAGO, ISLANDS);
  return ARCH.map;
}
/** I moli delle Consegne, in ordine fisso (quello di archipelago.json): l'indice è quello di startFrame. */
export function consegneMoli(): Molo[] {
  if (MOLI) return MOLI;
  consegneMappa();
  MOLI = ARCH!.places.filter((p) => CFG.moli.includes(p.role)).map((p) => ({
    id: p.role === 'lotto' ? `lotto:${p.slot}` : p.role, nome: p.role === 'lotto' ? `Isola ${(p.slot ?? 0) + 1}` : p.nome.split(' ')[0]!,
    island: p.island, slot: p.slot, x: p.boat.x, z: p.boat.z,
  }));
  return MOLI;
}
/** Il primo frame della partita: si parte dal molo `i` (indice di consegneMoli()). */
export function startFrame(i: number): InputFrame {
  return { mx: (i + 1) / 32, my: 0, a: false, b: false };
}

const d2 = (a: Vec2, b: Vec2) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };

/** Percorso del pacco: dopo la partenza, ogni destinazione è un altro molo a distanza giusta (mai lo stesso di prima, se si può). */
function makeRoute(seed: number, start: number): number[] {
  const rng = createRng(seed).fork('consegne').fork('rotta');
  const moli = consegneMoli(), [dMin, dMax] = CFG.distanza;
  const route = [start];
  for (let i = 0; i < CFG.pacchi; i++) {
    const cur = route[route.length - 1]!, prev = route[route.length - 2] ?? -1;
    const ok = (j: number, strict: boolean) => {
      if (j === cur || (strict && j === prev)) return false;
      const dd = d2(moli[j]!, moli[cur]!);
      return dd >= dMin * dMin && dd <= dMax * dMax; // tutti i moli si raggiungono per mare: la rotta si calcola solo per i tratti giocati
    };
    let cand = moli.map((_, j) => j).filter((j) => ok(j, true));
    if (!cand.length) cand = moli.map((_, j) => j).filter((j) => ok(j, false));
    if (!cand.length) cand = moli.map((_, j) => j).filter((j) => j !== cur);
    route.push(rng.pick(cand));
  }
  return route;
}

/** Punto sulla rotta a frazione `f` della lunghezza, con la direzione del tratto. */
function along(p: readonly Vec2[], f: number): { x: number; z: number; ux: number; uz: number } {
  const total = lunghezza(p);
  let rest = total * f;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!, b = p[i]!, dx = b.x - a.x, dz = b.z - a.z, l = Math.sqrt(dx * dx + dz * dz);
    if (rest <= l || i === p.length - 1) { const t = l ? Math.min(1, rest / l) : 0; return { x: a.x + dx * t, z: a.z + dz * t, ux: l ? dx / l : 1, uz: l ? dz / l : 0 }; }
    rest -= l;
  }
  const last = p[p.length - 1]!;
  return { x: last.x, z: last.z, ux: 1, uz: 0 };
}

/** Cassette del tratto `leg`: lungo la rotta, un po' di lato (dal seed), sempre in acqua libera. */
function makeCasse(seed: number, leg: number, path: readonly Vec2[]): Cassa[] {
  const rng = createRng(seed).fork('consegne').fork(`casse:${leg}`);
  const map = consegneMappa(), n = CFG.cassette.perTratto, [s0, s1] = CFG.cassette.scarto;
  const out: Cassa[] = [];
  for (let k = 0; k < n; k++) {
    const f = 0.22 + (0.6 * (k + 0.5)) / n + (rng.next() - 0.5) * 0.08;
    const p = along(path, Math.max(0.1, Math.min(0.9, f)));
    const side = rng.next() < 0.5 ? -1 : 1, off = s0 + rng.next() * (s1 - s0);
    let spot: Vec2 = { x: p.x, z: p.z };
    for (const o of [off * side, -off * side, (off / 2) * side, 0]) {
      const q = { x: p.x - p.uz * o, z: p.z + p.ux * o };
      if (trattoLibero(map, q, q, 1.6)) { spot = q; break; }
    }
    out.push({ x: Math.round(spot.x * 10) / 10, z: Math.round(spot.z * 10) / 10, presa: false });
  }
  return out;
}

/** Comincia il tratto verso route[consegnate + 1]: rotta, tempo (si somma a quello avanzato), cassette. */
function startLeg(s: ConsegneState): void {
  const moli = consegneMoli(), a = moli[s.route[s.consegnate]!]!, b = moli[s.route[s.consegnate + 1]!]!;
  s.path = rotta(consegneMappa(), a, b) ?? [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
  s.metri = Math.round(lunghezza(s.path));
  const secs = CFG.tempo.base + CFG.tempo.perMetro[s.difficulty - 1]! * s.metri + (s.consegnate === 0 ? CFG.tempo.partenza : 0);
  s.legTicks = Math.round(secs * TICK_HZ) + s.left;
  s.left = s.legTicks;
  s.casse = makeCasse(s.seed, s.consegnate, s.path);
}

function medalOf(s: ConsegneState): Medal {
  const m = CFG.medaglie, c = s.consegnate;
  return c >= m.oro ? 'oro' : c >= m.argento ? 'argento' : c >= m.bronzo ? 'bronzo' : null;
}

/** Autopilota: insegue la rotta (un punto qualche metro più avanti sulla linea) e frena prima delle curve strette. Stato a parte. */
const AUTO = new WeakMap<ConsegneState, { leg: number; seg: number }>();
function pilot(s: ConsegneState, gas: number): InputFrame {
  const p = s.path;
  if (p.length < 2) return NO;
  let a = AUTO.get(s);
  if (!a || a.leg !== s.consegnate) { a = { leg: s.consegnate, seg: 0 }; AUTO.set(s, a); }
  // il tratto più vicino, cercando solo in avanti (la rotta non torna indietro)
  let best = a.seg, bestD = Infinity, bestT = 0;
  for (let i = a.seg; i < Math.min(p.length - 1, a.seg + 4); i++) {
    const A = p[i]!, B = p[i + 1]!, dx = B.x - A.x, dz = B.z - A.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((s.boat.x - A.x) * dx + (s.boat.z - A.z) * dz) / l2));
    const dd = d2(s.boat, { x: A.x + dx * t, z: A.z + dz * t });
    if (dd < bestD - 0.01) { bestD = dd; best = i; bestT = t; }
  }
  a.seg = best;
  // punto da inseguire: `look` m più avanti sulla linea
  const look = 7;
  let rest = look, i = best, t = bestT, tx = 0, tz = 0;
  for (;;) {
    const A = p[i]!, B = p[i + 1]!, dx = B.x - A.x, dz = B.z - A.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
    const avail = l * (1 - t);
    if (rest <= avail || i + 2 >= p.length) { const k = Math.min(1, t + rest / l); tx = A.x + dx * k; tz = A.z + dz * k; break; }
    rest -= avail; i++; t = 0;
  }
  const hx = tx - s.boat.x, hz = tz - s.boat.z, hl = Math.sqrt(hx * hx + hz * hz) || 1;
  // curva in arrivo: angolo tra il tratto in corso e il prossimo; se è stretta e ci si arriva forte, si frena
  const A = p[best]!, B = p[best + 1]!, C = p[best + 2];
  let brake = false;
  if (C) {
    const ux = B.x - A.x, uz = B.z - A.z, vx = C.x - B.x, vz = C.z - B.z;
    const cos = (ux * vx + uz * vz) / ((Math.sqrt(ux * ux + uz * uz) || 1) * (Math.sqrt(vx * vx + vz * vz) || 1));
    const toB = Math.sqrt(d2(s.boat, B));
    const vTurn = 4 + 4 * Math.max(0, cos);
    brake = cos < 0.5 && toB < 3 + s.boat.speed * 0.8 && s.boat.speed > vTurn;
  }
  if (brake) return { mx: hx / hl, my: hz / hl, a: false, b: true };
  return gas >= 1 ? { mx: hx / hl, my: hz / hl, a: true, b: false } : { mx: (hx / hl) * gas, my: (hz / hl) * gas, a: false, b: false };
}
/** Pilota «pigro» per la taratura: un terzo di gas sulla stessa rotta. Non deve arrivare all'oro. */
export function lazyConsegne(s: ConsegneState): InputFrame {
  return s.start < 0 ? startFrame(0) : pilot(s, 0.35);
}

export const consegne: MinigameModule<ConsegneState> = {
  id: 'consegne',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const moli = consegneMoli();
    const m0 = moli[0]!;
    return {
      seed, difficulty, tick: 0, start: -1, boat: newBoat(m0.x, m0.z), route: [], consegnate: 0, left: 0, legTicks: 0, path: [], metri: 0,
      casse: [], prese: 0, done: false, timeUp: false, finishTick: 0,
    };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    if (s.start < 0) {
      // primo input = molo di partenza (fuori scala → il Porto); la barca parte ferma, con la prua verso la rotta
      const moli = consegneMoli(), i = Math.round(input.mx * 32) - 1;
      s.start = i >= 0 && i < moli.length ? i : 0;
      s.route = makeRoute(s.seed, s.start);
      startLeg(s);
      const m = moli[s.start]!, q = s.path[1] ?? m;
      s.boat = { ...newBoat(m.x, m.z), yaw: Math.atan2(q.x - m.x, -(q.z - m.z)) };
      return;
    }
    s.boat = stepBoat(s.boat, input, consegneMappa());
    for (const c of s.casse) if (!c.presa && d2(c, s.boat) <= CR2) { c.presa = true; s.prese++; s.left += CFG.cassette.secondi * TICK_HZ; }
    const dest = consegneMoli()[s.route[s.consegnate + 1]!]!;
    if (d2(dest, s.boat) <= R2) {
      s.consegnate++;
      if (s.consegnate >= CFG.pacchi) { s.done = true; s.finishTick = s.tick; return; }
      startLeg(s);
      return;
    }
    if (--s.left <= 0) { s.left = 0; s.done = true; s.timeUp = true; s.finishTick = s.tick; return; }
    if (s.tick >= MAX_TICKS) { s.done = true; s.timeUp = true; s.finishTick = s.tick; }
  },
  /** score: 1000 a pacco + 10 a secondo avanzato + 5 a cassetta presa. */
  result(s): MinigameResult {
    const ms = Math.round(((s.finishTick || s.tick) / TICK_HZ) * 1000);
    const avanzo = s.timeUp ? 0 : Math.floor(s.left / TICK_HZ);
    return {
      done: s.done, score: s.consegnate * 1000 + avanzo * 10 + s.prese * 5, medal: medalOf(s),
      detail: { consegne: s.consegnate, totale: CFG.pacchi, casse: s.prese, ms, avanzo, partenza: s.start },
    };
  },
  /** Autopilota di riferimento (deve fare oro): parte dal Porto, segue la rotta a tutta, frena prima delle curve strette. */
  autopilot(s): InputFrame {
    return s.start < 0 ? startFrame(0) : pilot(s, 1);
  },
  view(s): ConsegneView {
    const moli = consegneMoli(), toMs = (t: number) => Math.round((t / TICK_HZ) * 1000);
    const on = s.start >= 0 && !s.done;
    return {
      started: s.start >= 0, boat: s.boat, from: on ? moli[s.route[s.consegnate]!]! : null, dest: on ? moli[s.route[s.consegnate + 1]!]! : null,
      consegnate: s.consegnate, totale: CFG.pacchi, leftMs: toMs(s.left), legMs: toMs(s.legTicks), ms: toMs(s.finishTick || s.tick),
      maxMs: CFG.maxSeconds * 1000, casse: s.casse, prese: s.prese, path: s.path, raggio: CFG.raggio, done: s.done, timeUp: s.timeUp,
      medaglie: { ...CFG.medaglie },
    };
  },
};
