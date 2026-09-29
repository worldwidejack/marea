// Regata: gara in barca tra boe nella laguna. Stub funzionante (WP0): boe da seed, cronometro, punteggio. WP3: vento, medaglie tarate, laguna vera.
import { ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { TICK_HZ } from '../../constants.ts';
import { createRng } from '../../rng.ts';
import type { Rng } from '../../rng.ts';
import type { InputFrame } from '../../types.ts';
import { newBoat, stepBoat } from '../../world/boat.ts';
import type { BoatState } from '../../world/boat.ts';
import { parseIsland } from '../../world/grid.ts';
import type { GridMap } from '../../world/grid.ts';
import type { Difficulty, MinigameModule, MinigameResult } from '../types.ts';

export type Buoy = { x: number; z: number; passed: boolean };
export type RegataState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  boat: BoatState;
  buoys: Buoy[];
  next: number;
  done: boolean;
  finishTick: number;
  wind: { x: number; z: number };
  map: GridMap;
};

const CFG = MINIGAMES_CFG.regata;

/** Tratto dritto tutto in acqua (campionato ogni metro): l'autopilot naviga in linea retta, quindi il percorso deve esserlo. */
function segmentClear(map: GridMap, a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    if (!map.navigable(x, z) || !map.navigable(x + 2, z) || !map.navigable(x - 2, z) || !map.navigable(x, z + 2) || !map.navigable(x, z - 2)) return false;
  }
  return true;
}

function pickWater(rng: Rng, map: GridMap, from: { x: number; z: number }, spread: number): { x: number; z: number } {
  let fallback = { x: from.x, z: from.z };
  for (let i = 0; i < 400; i++) {
    const x = from.x + (rng.next() * 2 - 1) * spread;
    const z = from.z + (rng.next() * 2 - 1) * spread;
    if (Math.hypot(x - from.x, z - from.z) < 8) continue;
    if (!map.navigable(x, z)) continue;
    fallback = { x, z };
    if (segmentClear(map, from, { x, z })) return { x, z };
  }
  return fallback;
}

export const regata: MinigameModule<RegataState> = {
  id: 'regata',
  version: 1,
  maxTicks: CFG.maxSeconds * TICK_HZ,
  create({ seed, difficulty }) {
    const rng = createRng(seed).fork('regata');
    const def = ISLANDS[0];
    if (!def) throw new Error('Nessuna isola');
    const map = parseIsland(def);
    const n = rng.int(CFG.buoys.min, CFG.buoys.max);
    const buoys: Buoy[] = [];
    let from = { x: map.boatSpawn.x, z: map.boatSpawn.z };
    for (let i = 0; i < n; i++) {
      const p = pickWater(rng, map, from, CFG.buoys.spread);
      buoys.push({ ...p, passed: false });
      from = p;
    }
    return { seed, difficulty, tick: 0, boat: newBoat(map.boatSpawn.x, map.boatSpawn.z), buoys, next: 0, done: false, finishTick: 0, wind: { x: 0, z: 0 }, map };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    s.boat = stepBoat(s.boat, input, s.map, s.wind);
    const b = s.buoys[s.next];
    if (b && Math.hypot(b.x - s.boat.x, b.z - s.boat.z) <= CFG.buoys.radius) {
      b.passed = true;
      s.next++;
    }
    if (s.next >= s.buoys.length) {
      s.done = true;
      s.finishTick = s.tick;
    } else if (s.tick >= this.maxTicks) {
      s.done = true;
      s.finishTick = 0;
    }
  },
  result(s): MinigameResult {
    const ms = s.finishTick ? (s.finishTick / TICK_HZ) * 1000 : CFG.maxSeconds * 1000;
    const finished = s.done && s.finishTick > 0;
    const score = finished ? Math.max(0, CFG.scoreBase - Math.floor(ms / 10)) : Math.max(0, s.next * 100);
    const sec = ms / 1000;
    const medal = !finished ? null : sec <= CFG.medals.oro ? 'oro' : sec <= CFG.medals.argento ? 'argento' : sec <= CFG.medals.bronzo ? 'bronzo' : null;
    return { done: s.done, score, medal, detail: { ms: Math.round(ms), boe: s.next, tot: s.buoys.length } };
  },
  autopilot(s): InputFrame {
    const b = s.buoys[s.next];
    if (!b) return { mx: 0, my: 0, a: false, b: false };
    const dx = b.x - s.boat.x;
    const dz = b.z - s.boat.z;
    const d = Math.hypot(dx, dz) || 1;
    return { mx: dx / d, my: dz / d, a: d > 8, b: false };
  },
  view(s) {
    return { boat: s.boat, buoys: s.buoys, next: s.next, ms: (s.tick / TICK_HZ) * 1000, wind: s.wind, done: s.done };
  },
};
