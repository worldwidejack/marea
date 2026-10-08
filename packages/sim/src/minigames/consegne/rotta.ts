// Rotta in barca tra due punti dell'arcipelago (Consegne): A* sulle celle navigabili (8 direzioni, niente angoli tagliati, costo più alto
// rasente la costa), poi la linea si tira dritta dove l'acqua è libera (margine dalla costa). Pura e deterministica: costi interi,
// spareggi per ordine di inserimento, solo + − × ÷ e Math.sqrt (il replay deve coincidere su ogni motore JS).
import type { Vec2 } from '../../types.ts';
import type { GridMap } from '../../world/grid.ts';

const NAV = new Set(['~', ',', 'B']);
/** Costi per cella: 10 in acqua libera, di più rasente la costa (la barca ha un raggio e rimbalza). */
const COSTO = { libera: 10, vicina: 20, rasente: 45 };

type Costi = { w: number; h: number; c: Uint8Array };
const COSTI = new Map<string, Costi>();
function costi(map: GridMap): Costi {
  const hit = COSTI.get(map.id);
  if (hit && hit.w === map.w && hit.h === map.h) return hit;
  const { w, h } = map;
  const nav = new Uint8Array(w * h);
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) nav[z * w + x] = NAV.has(map.at(x, z)) ? 1 : 0;
  // distanza (Chebyshev, fino a 2 celle) dalla terra più vicina
  const c = new Uint8Array(w * h);
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    if (!nav[z * w + x]) { c[z * w + x] = 0; continue; }
    let d = 3;
    for (let dz = -2; dz <= 2 && d > 1; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, zz = z + dz;
      const land = xx < 0 || zz < 0 || xx >= w || zz >= h ? false : !nav[zz * w + xx];
      if (land) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dz)));
    }
    c[z * w + x] = d === 1 ? COSTO.rasente : d === 2 ? COSTO.vicina : COSTO.libera;
  }
  const out = { w, h, c };
  COSTI.set(map.id, out);
  return out;
}

/** Coda con priorità (min-heap) su interi: priorità, poi ordine di inserimento. */
function heap() {
  const pr: number[] = [], ord: number[] = [], val: number[] = [];
  let n = 0;
  const less = (i: number, j: number) => pr[i]! < pr[j]! || (pr[i] === pr[j] && ord[i]! < ord[j]!);
  const swap = (i: number, j: number) => {
    [pr[i], pr[j]] = [pr[j]!, pr[i]!]; [ord[i], ord[j]] = [ord[j]!, ord[i]!]; [val[i], val[j]] = [val[j]!, val[i]!];
  };
  let seq = 0;
  return {
    get size() { return pr.length; },
    push(p: number, v: number) {
      pr.push(p); ord.push(seq++); val.push(v); n = pr.length - 1;
      while (n > 0) { const up = (n - 1) >> 1; if (!less(n, up)) break; swap(n, up); n = up; }
    },
    pop(): number {
      const top = val[0]!, last = pr.length - 1;
      swap(0, last); pr.pop(); ord.pop(); val.pop();
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < pr.length && less(l, m)) m = l;
        if (r < pr.length && less(r, m)) m = r;
        if (m === i) break;
        swap(i, m); i = m;
      }
      return top;
    },
  };
}

/** Celle della rotta più economica da `a` a `b` (indici z × w + x), o null se non c'è. */
function astar(map: GridMap, a: Vec2, b: Vec2): number[] | null {
  const { w, h, c } = costi(map);
  const ca = map.worldToCell(a.x, a.z), cb = map.worldToCell(b.x, b.z);
  const start = ca.cz * w + ca.cx, goal = cb.cz * w + cb.cx;
  if (!c[start] || !c[goal]) return null;
  const g = new Int32Array(w * h).fill(-1), from = new Int32Array(w * h).fill(-1), chiusa = new Uint8Array(w * h);
  const hDist = (i: number) => { const dx = Math.abs((i % w) - cb.cx), dz = Math.abs(Math.floor(i / w) - cb.cz); return 10 * Math.max(dx, dz) + 4 * Math.min(dx, dz); };
  const q = heap();
  g[start] = 0; q.push(hDist(start), start);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  while (q.size) {
    const i = q.pop();
    if (chiusa[i]) continue;
    chiusa[i] = 1;
    if (i === goal) break;
    const x = i % w, z = Math.floor(i / w);
    for (const [dx, dz] of DIRS) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= w || zz >= h) continue;
      const j = zz * w + xx;
      if (!c[j] || chiusa[j]) continue;
      if (dx !== 0 && dz !== 0 && (!c[z * w + xx] || !c[zz * w + x])) continue; // niente angoli tagliati
      const step = ((c[j]! + c[i]!) * (dx !== 0 && dz !== 0 ? 14 : 10)) / 20;
      const ng = g[i]! + Math.round(step);
      if (g[j] === -1 || ng < g[j]!) { g[j] = ng; from[j] = i; q.push(ng + hDist(j), j); }
    }
  }
  if (g[goal] === -1) return null;
  const out: number[] = [];
  for (let i = goal; i !== -1; i = from[i]!) out.push(i);
  return out.reverse();
}

/** Tratto dritto tutto in acqua con `margine` m attorno (campionato ogni mezzo metro); vicino agli estremi (molo) basta 0,9 m. */
export function trattoLibero(map: GridMap, a: Vec2, b: Vec2, margine: number, estremi: readonly Vec2[] = []): boolean {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.sqrt(dx * dx + dz * dz);
  const n = Math.max(1, Math.ceil(len * 2));
  for (let i = 0; i <= n; i++) {
    const x = a.x + (dx * i) / n, z = a.z + (dz * i) / n;
    let m = margine;
    for (const e of estremi) { const ex = x - e.x, ez = z - e.z; if (ex * ex + ez * ez < 36) m = 0.9; }
    if (!map.navigable(x, z) || !map.navigable(x + m, z) || !map.navigable(x - m, z) || !map.navigable(x, z + m) || !map.navigable(x, z - m)) return false;
    const d = m * 0.7;
    if (!map.navigable(x + d, z + d) || !map.navigable(x - d, z + d) || !map.navigable(x + d, z - d) || !map.navigable(x - d, z - d)) return false;
  }
  return true;
}

export const lunghezza = (p: readonly Vec2[]): number => {
  let l = 0;
  for (let i = 1; i < p.length; i++) { const dx = p[i]!.x - p[i - 1]!.x, dz = p[i]!.z - p[i - 1]!.z; l += Math.sqrt(dx * dx + dz * dz); }
  return l;
};

/** Margine dalla costa per tirare dritta la rotta (m): la barca ha raggio 0,8 e un po' di deriva in curva. */
const MARGINE = 2.2;

/** Rotta da `a` a `b` in metri (estremi compresi), già tirata dritta; null se non c'è passaggio. Cache per mappa e coppia di punti. */
const CACHE = new Map<string, Vec2[] | null>();
export function rotta(map: GridMap, a: Vec2, b: Vec2): Vec2[] | null {
  const key = `${map.id}:${a.x},${a.z}>${b.x},${b.z}`;
  if (CACHE.has(key)) return CACHE.get(key)!;
  const celle = astar(map, a, b);
  let out: Vec2[] | null = null;
  if (celle) {
    const pts: Vec2[] = celle.map((i) => map.cellToWorld(i % map.w, Math.floor(i / map.w)));
    pts[0] = { x: a.x, z: a.z }; pts[pts.length - 1] = { x: b.x, z: b.z };
    // tira dritto: dal punto i, il più lontano j raggiungibile in linea retta con il margine
    out = [pts[0]!];
    let i = 0;
    while (i < pts.length - 1) {
      let j = i + 1;
      while (j + 1 < pts.length && trattoLibero(map, pts[i]!, pts[j + 1]!, MARGINE, [a, b])) j++;
      out.push(pts[j]!);
      i = j;
    }
  }
  CACHE.set(key, out);
  return out;
}
