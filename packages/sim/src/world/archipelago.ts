// L'arcipelago come un solo mondo continuo (CONTRACTS §11): le isole di islands.json posate su una griglia w×h, il resto acqua
// profonda. Un GridMap unico per collisioni di avatar e barca (niente cambi di mappa) + dove stanno Porto, lotti, laguna e facciate.
// Pura e deterministica: niente DOM, niente orologio, niente casualità.
import type { ArchipelagoDef, ArchipelagoRole, IslandDef, IslandStyle, TemaDef } from '@marea/content';
import { gridFromRows } from './grid.ts';
import type { Cell, GridMap } from './grid.ts';

type XZ = { x: number; z: number };
/** Un'isola posata nel mondo. `origin` e `w`/`h` in celle; `spawn` (la P) e `boat` (la B) in metri, coordinate mondo. */
export type ArchPlace = {
  index: number;
  island: string;
  nome: string;
  role: ArchipelagoRole;
  slot: number | null;
  style: IslandStyle | null;
  scenery: number;
  origin: [number, number];
  w: number;
  h: number;
  spawn: XZ;
  boat: XZ;
  /** Isola a tema (#68): come si sblocca e quanta barriera in mare ha. null per le altre isole. */
  tema: TemaDef | null;
};
/** Lotto di una persona: le celle di LotState sono locali al template (`[cx, cz]` dall'angolo dell'isola); mondo = origin + cella. */
export type ArchLot = { slot: number; origin: [number, number]; template: string };
/** Decorazione fissa in coordinate mondo (m); `rot` = rotazione Y (radianti, convenzione three). */
export type ArchProp = { k: string; x: number; z: number; rot: number; island: string };
/** Edificio fisso del Porto (slot del villaggio: case, Tavolo delle Sfide), in coordinate mondo. */
export type ArchBuilding = { kind: string; x: number; z: number; rot: number; cell: [number, number]; island: string };
export type Archipelago = {
  id: string;
  map: GridMap;
  tile: number;
  lots: ArchLot[];
  porto: { origin: [number, number] };
  laguna: { origin: [number, number] } | null;
  places: ArchPlace[];
  props: ArchProp[];
  buildings: ArchBuilding[];
  /** Rettangoli lastricati in celle del mondo [x0, z0, x1, z1] (inclusi). */
  paved: [number, number, number, number][];
  /** Spawn a piedi: la P del lotto `slot`, o del Porto se `slot` è null o non esiste. */
  spawnOf(slot: number | null): XZ;
  /** Dove sta ormeggiata la barca: la B del lotto `slot` (o del Porto). */
  boatOf(slot: number | null): XZ;
  /** Centro nel mondo di una cella locale del lotto `slot` (per gli edifici di LotState). */
  lotCellToWorld(slot: number, cell: readonly [number, number]): XZ;
  /** L'isola che contiene il punto (x, z) in metri, o null in mare aperto. */
  placeAt(x: number, z: number): ArchPlace | null;
};

function findChar(rows: readonly string[], ch: string): Cell | null {
  for (let cz = 0; cz < rows.length; cz++) {
    const cx = (rows[cz] ?? '').indexOf(ch);
    if (cx >= 0) return { cx, cz };
  }
  return null;
}

export function composeArchipelago(def: ArchipelagoDef, islands: readonly IslandDef[]): Archipelago {
  const { w, h, tile } = def;
  const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '~'));
  const places: ArchPlace[] = [];
  const props: ArchProp[] = [];
  const buildings: ArchBuilding[] = [];
  const lots: ArchLot[] = [];
  const paved: [number, number, number, number][] = [];
  let porto: ArchPlace | null = null, laguna: ArchPlace | null = null;
  const toWorld = (cx: number, cz: number): XZ => ({ x: (cx + 0.5) * tile, z: (cz + 0.5) * tile });

  for (const [index, e] of def.islands.entries()) {
    const isl = islands.find((d) => d.id === e.island);
    if (!isl) throw new Error(`Arcipelago ${def.id}: isola sconosciuta ${e.island}`);
    if (isl.tile !== tile) throw new Error(`Arcipelago ${def.id}: ${isl.id} ha tile ${isl.tile}, attesa ${tile}`);
    const [ox, oz] = e.at;
    const iw = isl.rows[0]?.length ?? 0, ih = isl.rows.length;
    if (ox < 0 || oz < 0 || ox + iw > w || oz + ih > h) throw new Error(`Arcipelago ${def.id}: ${isl.id} esce dalla griglia`);
    for (let z = 0; z < ih; z++) {
      const row = isl.rows[z] ?? '', dst = grid[oz + z]!;
      for (let x = 0; x < iw; x++) {
        const ch = row[x] ?? '~';
        if (ch === '~') continue; // l'acqua profonda del bordo non cancella un vicino
        if (dst[ox + x] !== '~') throw new Error(`Arcipelago ${def.id}: ${isl.id} si sovrappone a un'altra isola in ${ox + x},${oz + z}`);
        dst[ox + x] = ch;
      }
    }
    const p = findChar(isl.rows, 'P'), b = findChar(isl.rows, 'B');
    if (!p || !b) throw new Error(`Isola ${isl.id}: mancano P o B`);
    const place: ArchPlace = {
      index, island: isl.id, nome: isl.nome, role: e.role, slot: e.role === 'lotto' ? (e.slot ?? null) : null,
      style: isl.style ?? null, scenery: isl.scenery ?? 1, origin: [ox, oz], w: iw, h: ih,
      spawn: toWorld(ox + p.cx, oz + p.cz), boat: toWorld(ox + b.cx, oz + b.cz),
      tema: e.role === 'tema' && e.tema ? e.tema : null,
    };
    places.push(place);
    for (const pr of isl.props ?? []) props.push({ k: pr.k, x: (ox + pr.at[0] + 0.5) * tile, z: (oz + pr.at[1] + 0.5) * tile, rot: pr.rot ?? 0, island: isl.id });
    for (const r of isl.paved ?? []) paved.push([ox + r[0], oz + r[1], ox + r[2], oz + r[3]]);
    if (e.role === 'lotto' && e.slot !== undefined) lots.push({ slot: e.slot, origin: [ox, oz], template: isl.id });
    if (e.role === 'porto') {
      porto = place;
      for (const s of isl.slots ?? []) {
        const c = toWorld(ox + s.at[0], oz + s.at[1]);
        buildings.push({ kind: s.kind, x: c.x, z: c.z, rot: s.rot ?? 0, cell: [ox + s.at[0], oz + s.at[1]], island: isl.id });
      }
    }
    if (e.role === 'laguna' && !laguna) laguna = place;
  }
  if (!porto) throw new Error(`Arcipelago ${def.id}: manca il Porto`);
  lots.sort((a, b) => a.slot - b.slot);

  const rows = grid.map((r) => r.join(''));
  const P = porto;
  const map = gridFromRows(def.id, rows, tile, { cx: Math.floor(P.spawn.x / tile), cz: Math.floor(P.spawn.z / tile) }, { cx: Math.floor(P.boat.x / tile), cz: Math.floor(P.boat.z / tile) });
  const lotPlace = (slot: number | null): ArchPlace => (slot === null ? P : places.find((q) => q.role === 'lotto' && q.slot === slot) ?? P);
  return {
    id: def.id, map, tile, lots, places, props, buildings, paved,
    porto: { origin: [...P.origin] },
    laguna: laguna ? { origin: [...laguna.origin] } : null,
    spawnOf: (slot) => ({ ...lotPlace(slot).spawn }),
    boatOf: (slot) => ({ ...lotPlace(slot).boat }),
    lotCellToWorld: (slot, cell) => {
      const l = lots.find((q) => q.slot === slot);
      if (!l) throw new Error(`Lotto ${slot} inesistente`);
      return toWorld(l.origin[0] + cell[0], l.origin[1] + cell[1]);
    },
    placeAt: (x, z) => {
      const cx = Math.floor(x / tile), cz = Math.floor(z / tile);
      return places.find((q) => cx >= q.origin[0] && cz >= q.origin[1] && cx < q.origin[0] + q.w && cz < q.origin[1] + q.h) ?? null;
    },
  };
}
