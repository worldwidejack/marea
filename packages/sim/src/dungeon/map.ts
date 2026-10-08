// Mappa del dungeon: griglia da DungeonDef, collisioni cerchio-griglia, linea di vista (DDA) e distanze BFS (flow field).
// Celle: (cx, cz) = (colonna, riga); centro in mondo ((cx + 0.5) × tile, (cz + 0.5) × tile).
import type { DungeonDef } from '@marea/content/rpg.ts';

export type Spawn = { cx: number; cz: number; ch: string };
export type DMap = {
  id: string; w: number; h: number; tile: number;
  /** 1 = non calpestabile (muro, vuoto, colonna). */
  solid: Uint8Array;
  /** 1 = blocca la vista e i proiettili (muro, colonna; il vuoto no). */
  opaque: Uint8Array;
  exit: { cx: number; cz: number; x: number; z: number };
  spawn: { x: number; z: number; fx: number; fz: number };
  /** `capo`: ucciso lui, il dungeon è completato (legenda `capo`). */
  nemici: (Spawn & { tipo: string; capo?: true })[];
  forzieri: (Spawn & { tabella: string })[];
  libri: (Spawn & { item: string })[];
  /** Altari di salvataggio (legenda `altare`), in ordine di lettura: l'indice è quello di `salvato.altare`. */
  altari: (Spawn & { x: number; z: number; asciutti?: number[] })[];
  /** Drenaggio: bacini allagati (legenda `acqua: n`, in ordine di n) con le loro celle (solide finché c'è l'acqua, non opache) e le
   *  valvole (legenda `valvola: n`, in ordine di lettura) che li svuotano. Negli altri dungeon vuoti. */
  bacini: { n: number; celle: number[] }[];
  valvole: (Spawn & { x: number; z: number; n: number })[];
  /** Celle calpestabili (indici), per i test e l'autopilot. */
  floor: number[];
};

/** Quel che serve a collisioni, vista e distanze: anche griglie che non sono un dungeon (l'arena dei Templari, con le porte che si aprono). */
export type Griglia = Pick<DMap, 'w' | 'h' | 'tile' | 'solid' | 'opaque'>;

const MAPS = new WeakMap<DungeonDef, DMap>();

export function parseDungeon(def: DungeonDef): DMap {
  const cached = MAPS.get(def);
  if (cached) return cached;
  const h = def.rows.length, w = Math.max(...def.rows.map((r) => r.length)), tile = def.tile;
  const solid = new Uint8Array(w * h), opaque = new Uint8Array(w * h);
  let exit: { cx: number; cz: number } | null = null;
  const nemici: DMap['nemici'] = [], forzieri: DMap['forzieri'] = [], libri: DMap['libri'] = [], altari: DMap['altari'] = [], floor: number[] = [];
  const bacini = new Map<number, number[]>(), valvole: DMap['valvole'] = [];
  for (let cz = 0; cz < h; cz++)
    for (let cx = 0; cx < w; cx++) {
      const ch = def.rows[cz]![cx] ?? ' ';
      const i = cz * w + cx;
      if (ch === '#') { solid[i] = 1; opaque[i] = 1; continue; }
      if (ch === ' ') { solid[i] = 1; continue; }
      if (ch === '<') exit = { cx, cz };
      else if (ch !== '.') {
        const l = def.legenda[ch];
        if (!l) throw new Error(`Dungeon ${def.id}: lettera '${ch}' senza legenda (${cx},${cz})`);
        if (l.colonna) { solid[i] = 1; opaque[i] = 1; continue; }
        if (l.acqua !== undefined) { solid[i] = 1; const b = bacini.get(l.acqua) ?? []; b.push(i); bacini.set(l.acqua, b); continue; }
        if (l.valvola !== undefined) valvole.push({ cx, cz, ch, x: (cx + 0.5) * tile, z: (cz + 0.5) * tile, n: l.valvola });
        if (l.nemico) nemici.push(l.capo ? { cx, cz, ch, tipo: l.nemico, capo: true } : { cx, cz, ch, tipo: l.nemico });
        if (l.forziere) forzieri.push({ cx, cz, ch, tabella: l.forziere });
        if (l.libro) libri.push({ cx, cz, ch, item: l.libro });
        if (l.altare) altari.push({ cx, cz, ch, x: (cx + 0.5) * tile, z: (cz + 0.5) * tile, ...(l.asciutti ? { asciutti: l.asciutti } : {}) });
      }
      floor.push(i);
    }
  if (!exit) throw new Error(`Dungeon ${def.id}: manca la scala d'uscita '<'`);
  // spawn: la prima cella libera accanto alla scala (sopra, destra, sinistra, sotto), guardando via dalla scala
  const ex = exit;
  let spawn = { x: (ex.cx + 0.5) * tile, z: (ex.cz + 0.5) * tile, fx: 0, fz: -1 };
  for (const [dx, dz] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as const) {
    const nx = ex.cx + dx, nz = ex.cz + dz;
    if (nx < 0 || nz < 0 || nx >= w || nz >= h || solid[nz * w + nx]) continue;
    spawn = { x: (nx + 0.5) * tile, z: (nz + 0.5) * tile, fx: dx, fz: dz };
    break;
  }
  for (const v of valvole) if (!bacini.has(v.n)) throw new Error(`Dungeon ${def.id}: valvola ${v.n} senza bacino`);
  const m: DMap = {
    id: def.id, w, h, tile, solid, opaque, exit: { ...ex, x: (ex.cx + 0.5) * tile, z: (ex.cz + 0.5) * tile }, spawn, nemici, forzieri, libri, altari, floor,
    bacini: [...bacini].sort((a, b) => a[0] - b[0]).map(([n, celle]) => ({ n, celle })), valvole,
  };
  MAPS.set(def, m);
  return m;
}

export function cellOf(m: Griglia,x: number, z: number): number {
  const cx = Math.floor(x / m.tile), cz = Math.floor(z / m.tile);
  if (cx < 0 || cz < 0 || cx >= m.w || cz >= m.h) return -1;
  return cz * m.w + cx;
}
export function isSolid(m: Griglia,cx: number, cz: number): boolean {
  return cx < 0 || cz < 0 || cx >= m.w || cz >= m.h || m.solid[cz * m.w + cx] === 1;
}
export function isOpaque(m: Griglia,cx: number, cz: number): boolean {
  return cx < 0 || cz < 0 || cx >= m.w || cz >= m.h || m.opaque[cz * m.w + cx] === 1;
}

/** Spinge fuori un cerchio dalle celle solide che tocca. */
function resolve(m: Griglia,p: { x: number; z: number }, r: number): void {
  const t = m.tile;
  const c0 = Math.floor((p.x - r) / t), c1 = Math.floor((p.x + r) / t);
  const r0 = Math.floor((p.z - r) / t), r1 = Math.floor((p.z + r) / t);
  for (let cz = r0; cz <= r1; cz++)
    for (let cx = c0; cx <= c1; cx++) {
      if (!isSolid(m, cx, cz)) continue;
      const nx = Math.max(cx * t, Math.min((cx + 1) * t, p.x)), nz = Math.max(cz * t, Math.min((cz + 1) * t, p.z));
      const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2), k = (r - d) / d;
        p.x += dx * k; p.z += dz * k;
      } else {
        // centro dentro la cella: esci dal lato più vicino
        const l = p.x - cx * t, rr = (cx + 1) * t - p.x, u = p.z - cz * t, dd = (cz + 1) * t - p.z;
        const mn = Math.min(l, rr, u, dd);
        if (mn === l) p.x = cx * t - r; else if (mn === rr) p.x = (cx + 1) * t + r; else if (mn === u) p.z = cz * t - r; else p.z = (cz + 1) * t + r;
      }
    }
}

/** Muove un cerchio di (dx, dz) scivolando sui muri; a passi ≤ r per non attraversarli. */
export function moveCircle(m: Griglia,p: { x: number; z: number }, dx: number, dz: number, r: number): void {
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len === 0) return;
  const n = Math.max(1, Math.ceil(len / (r * 0.9)));
  const sx = dx / n, sz = dz / n;
  for (let i = 0; i < n; i++) {
    p.x += sx; resolve(m, p, r);
    p.z += sz; resolve(m, p, r);
  }
}

/** Linea di vista tra due punti (DDA di Amanatides-Woo): false se attraversa una cella opaca. */
export function lineOfSight(m: Griglia,x0: number, z0: number, x1: number, z1: number): boolean {
  const t = m.tile;
  let cx = Math.floor(x0 / t), cz = Math.floor(z0 / t);
  const ex = Math.floor(x1 / t), ez = Math.floor(z1 / t);
  const dx = x1 - x0, dz = z1 - z0;
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(t / dx) : Infinity, tdz = dz !== 0 ? Math.abs(t / dz) : Infinity;
  let tmx = dx !== 0 ? ((sx > 0 ? (cx + 1) * t - x0 : x0 - cx * t) / Math.abs(dx)) : Infinity;
  let tmz = dz !== 0 ? ((sz > 0 ? (cz + 1) * t - z0 : z0 - cz * t) / Math.abs(dz)) : Infinity;
  for (let guard = 0; guard < 512; guard++) {
    if (isOpaque(m, cx, cz)) return false;
    if (cx === ex && cz === ez) return true;
    if (tmx < tmz) { if (tmx > 1) return true; tmx += tdx; cx += sx; }
    else { if (tmz > 1) return true; tmz += tdz; cz += sz; }
  }
  return true;
}

/** Linea percorribile da un cerchio (per l'autopilot): campiona il segmento ogni mezzo raggio e controlla le celle solide. */
export function clearPath(m: Griglia,x0: number, z0: number, x1: number, z1: number, r: number): boolean {
  const dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz);
  const n = Math.max(1, Math.ceil(len / (r * 0.5)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (dx * i) / n, z = z0 + (dz * i) / n;
    for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r], [0, 0]] as const)
      if (isSolid(m, Math.floor((x + ox) / m.tile), Math.floor((z + oz) / m.tile))) return false;
  }
  return true;
}

const N8: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Distanze BFS (passi, 8 vicini senza tagliare gli spigoli) da una cella a tutte le altre; -1 = irraggiungibile. Con più celle di
 *  partenza (dungeon insieme: una per eroe) la distanza è dalla più vicina. */
export function bfs(m: Griglia,from: number | readonly number[], out?: Int32Array): Int32Array {
  const d = out && out.length === m.w * m.h ? out : new Int32Array(m.w * m.h);
  d.fill(-1);
  const q = new Int32Array(m.w * m.h);
  let qh = 0, qt = 0;
  for (const f of typeof from === 'number' ? [from] : from) if (f >= 0 && !m.solid[f] && d[f] === -1) { q[qt++] = f; d[f] = 0; }
  if (qt === 0) return d;
  while (qh < qt) {
    const i = q[qh++]!, cx = i % m.w, cz = (i - cx) / m.w, nd = d[i]! + 1;
    for (const [dx, dz] of N8) {
      const nx = cx + dx, nz = cz + dz;
      if (isSolid(m, nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (isSolid(m, cx + dx, cz) || isSolid(m, cx, cz + dz))) continue;
      const j = nz * m.w + nx;
      if (d[j] !== -1) continue;
      d[j] = nd; q[qt++] = j;
    }
  }
  return d;
}

/** Prossima cella verso l'origine del campo (vicino con distanza minore), o -1. */
export function stepDown(m: Griglia,field: Int32Array, from: number): number {
  if (from < 0) return -1;
  const cx = from % m.w, cz = (from - cx) / m.w;
  let best = -1, bd = field[from]!;
  if (bd <= 0) return bd === 0 ? from : -1;
  for (const [dx, dz] of N8) {
    const nx = cx + dx, nz = cz + dz;
    if (isSolid(m, nx, nz)) continue;
    if (dx !== 0 && dz !== 0 && (isSolid(m, cx + dx, cz) || isSolid(m, cx, cz + dz))) continue;
    const j = nz * m.w + nx, v = field[j]!;
    if (v >= 0 && v < bd) { bd = v; best = j; }
  }
  return best;
}
export function cellCenter(m: Griglia,i: number): { x: number; z: number } {
  const cx = i % m.w, cz = (i - cx) / m.w;
  return { x: (cx + 0.5) * m.tile, z: (cz + 0.5) * m.tile };
}
