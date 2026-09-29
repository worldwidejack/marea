// Mappa a celle da 2 m letta dalle righe ASCII di islands.json (contratto: docs/CONTRACTS.md §4).
import type { IslandDef } from '@marea/content';

export type Tile = '~' | ',' | '.' | 'g' | 'r' | 'd' | 'P' | 'B' | 'L';
export type Cell = { cx: number; cz: number };
export type GridMap = {
  id: string;
  w: number;
  h: number;
  tile: number;
  at(cx: number, cz: number): Tile;
  worldToCell(x: number, z: number): Cell;
  cellToWorld(cx: number, cz: number): { x: number; z: number };
  walkable(x: number, z: number): boolean;
  navigable(x: number, z: number): boolean;
  isDock(x: number, z: number): boolean;
  spawn: { x: number; z: number };
  boatSpawn: { x: number; z: number };
  lots: Cell[];
  rows: readonly string[];
};

const WALK = new Set<Tile>(['.', 'g', 'd', 'P', 'L']);
const NAV = new Set<Tile>(['~', ',', 'B']);

export function parseIsland(def: IslandDef): GridMap {
  const rows = def.rows;
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const tile = def.tile;
  let spawn: Cell | null = null;
  let boat: Cell | null = null;
  const lots: Cell[] = [];
  for (let cz = 0; cz < h; cz++) {
    const row = rows[cz] ?? '';
    for (let cx = 0; cx < w; cx++) {
      const ch = row[cx];
      if (ch === 'P') spawn = { cx, cz };
      else if (ch === 'B') boat = { cx, cz };
      else if (ch === 'L') lots.push({ cx, cz });
    }
  }
  if (!spawn || !boat) throw new Error(`Isola ${def.id}: mancano P o B`);
  const at = (cx: number, cz: number): Tile => {
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return '~';
    return ((rows[cz] ?? '')[cx] ?? '~') as Tile;
  };
  const worldToCell = (x: number, z: number): Cell => ({ cx: Math.floor(x / tile), cz: Math.floor(z / tile) });
  const cellToWorld = (cx: number, cz: number) => ({ x: (cx + 0.5) * tile, z: (cz + 0.5) * tile });
  const tileAtWorld = (x: number, z: number): Tile => {
    const c = worldToCell(x, z);
    return at(c.cx, c.cz);
  };
  return {
    id: def.id, w, h, tile, rows, at, worldToCell, cellToWorld,
    walkable: (x, z) => WALK.has(tileAtWorld(x, z)),
    navigable: (x, z) => NAV.has(tileAtWorld(x, z)),
    isDock: (x, z) => tileAtWorld(x, z) === 'd',
    spawn: cellToWorld(spawn.cx, spawn.cz),
    boatSpawn: cellToWorld(boat.cx, boat.cz),
    lots,
  };
}
