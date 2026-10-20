// Percorsi della gente che passeggia (Borgo Marea): una rete a quadretti da `passo` m sopra la mappa a celle, aperta dove ci sta una persona
// di raggio `raggio` con un margine attorno, lontano da acqua, rocce e solidi fissi (world/ostacoli.ts). A* a 8 vicini che non taglia gli
// angoli, poi il filo tirato: da ogni punto si va dritti finché la linea resta aperta. Il margine copre il passo (≥ mezza diagonale di un
// quadretto): così ogni punto di un tratto aperto sta ad almeno `raggio` da tutto. Puro e deterministico.
import type { GridMap } from './grid.ts';
import { penetra } from './ostacoli.ts';
import type { Solido } from './ostacoli.ts';

type XZ = { x: number; z: number };
export type Rete = {
  x0: number; z0: number; w: number; h: number; passo: number;
  /** Costo per metro di ogni quadretto; 0 = chiuso. */
  costo: Float32Array;
  /** Il punto (m) cade in un quadretto aperto. */
  aperta(x: number, z: number): boolean;
  /** La linea da a a b resta tutta aperta. */
  vede(a: XZ, b: XZ): boolean;
  /** Il centro del quadretto aperto più vicino a (x, z), entro `entro` m (null se non c'è). */
  vicino(x: number, z: number, entro?: number): XZ | null;
  /** Centri dei quadretti aperti della zona più grande (dove si arriva da quasi tutto il resto): lì si sceglie dove andare. */
  aperti(): XZ[];
  /** Il punto sta nella zona più grande (gli angoli chiusi tra le case e le rocce non ci stanno). */
  nelGrande(x: number, z: number): boolean;
};
export type ReteOpts = {
  /** Riquadro in m [x0, z0, x1, z1). */
  riquadro: readonly [number, number, number, number];
  raggio: number; margine: number; passo: number;
  /** Costo per metro in (x, z) (1 = normale); assente = 1 dappertutto. */
  costo?(x: number, z: number): number;
};

export function creaRete(map: GridMap, fissi: readonly Solido[], o: ReteOpts): Rete {
  const [rx0, rz0, rx1, rz1] = o.riquadro, P = o.passo, R = o.raggio + o.margine;
  const w = Math.max(1, Math.floor((rx1 - rx0) / P)), h = Math.max(1, Math.floor((rz1 - rz0) / P));
  const costo = new Float32Array(w * h);
  const cx = (i: number) => rx0 + (i + 0.5) * P, cz = (j: number) => rz0 + (j + 0.5) * P;
  const D = R * 0.7071;
  const terra = (x: number, z: number) => map.walkable(x, z) && map.walkable(x + R, z) && map.walkable(x - R, z) && map.walkable(x, z + R) && map.walkable(x, z - R)
    && map.walkable(x + D, z + D) && map.walkable(x - D, z + D) && map.walkable(x + D, z - D) && map.walkable(x - D, z - D);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const x = cx(i), z = cz(j); costo[j * w + i] = terra(x, z) ? Math.max(0.1, o.costo?.(x, z) ?? 1) : 0; }
  for (const s of fissi) {
    const g = ('hx' in s ? Math.sqrt(s.hx * s.hx + s.hz * s.hz) : s.r) + R;
    const i0 = Math.max(0, Math.floor((s.x - g - rx0) / P)), i1 = Math.min(w - 1, Math.floor((s.x + g - rx0) / P));
    const j0 = Math.max(0, Math.floor((s.z - g - rz0) / P)), j1 = Math.min(h - 1, Math.floor((s.z + g - rz0) / P));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (costo[j * w + i]! > 0 && penetra(s, cx(i), cz(j), R).d > 0) costo[j * w + i] = 0;
  }
  const idx = (x: number, z: number): number => {
    const i = Math.floor((x - rx0) / P), j = Math.floor((z - rz0) / P);
    return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i;
  };
  const aperta = (x: number, z: number) => { const k = idx(x, z); return k >= 0 && costo[k]! > 0; };
  // le zone collegate (8 vicini, come A*: niente angoli tagliati) e la più grande
  const zona = new Int32Array(w * h).fill(-1), coda = new Int32Array(w * h);
  let grande = -1, nGrande = 0;
  for (let k0 = 0, z = 0; k0 < w * h; k0++) {
    if (!(costo[k0]! > 0) || zona[k0]! >= 0) continue;
    let a = 0, b = 0; coda[b++] = k0; zona[k0] = z;
    while (a < b) {
      const k = coda[a++]!, i = k % w, j = (k - i) / w;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj, q = nj * w + ni;
        if ((!di && !dj) || ni < 0 || nj < 0 || ni >= w || nj >= h || zona[q]! >= 0 || !(costo[q]! > 0)) continue;
        if (di && dj && (!(costo[j * w + ni]! > 0) || !(costo[nj * w + i]! > 0))) continue;
        zona[q] = z; coda[b++] = q;
      }
    }
    if (b > nGrande) { nGrande = b; grande = z; }
    z++;
  }
  const nelGrande = (x: number, z: number) => { const k = idx(x, z); return k >= 0 && zona[k] === grande; };
  return {
    x0: rx0, z0: rz0, w, h, passo: P, costo, aperta, nelGrande,
    vede(a, b) {
      const dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (P * 0.3));
      for (let k = 0; k <= n; k++) if (!aperta(a.x + (dx * k) / Math.max(1, n), a.z + (dz * k) / Math.max(1, n))) return false;
      return true;
    },
    vicino(x, z, entro = 4) { // nella zona più grande
      const r = Math.ceil(entro / P), i0 = Math.floor((x - rx0) / P), j0 = Math.floor((z - rz0) / P);
      let best: XZ | null = null, bd = Infinity;
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || j < 0 || i >= w || j >= h || zona[j * w + i] !== grande) continue;
        const d = (cx(i) - x) * (cx(i) - x) + (cz(j) - z) * (cz(j) - z);
        if (d < bd) { bd = d; best = { x: cx(i), z: cz(j) }; }
      }
      return best;
    },
    aperti() { const out: XZ[] = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (zona[j * w + i] === grande) out.push({ x: cx(i), z: cz(j) }); return out; },
  };
}

/** Il percorso da `da` ad `a` (punti in m, il primo è `da`, l'ultimo `a`): A* sui quadretti, poi il filo tirato. null = non si arriva.
 *  `vieta(x, z)`: quadretti chiusi solo per questa ricerca (per girare attorno a chi sta fermo in mezzo). */
export function cercaPercorso(rete: Rete, da: XZ, a: XZ, vieta?: (x: number, z: number) => boolean): XZ[] | null {
  const { w, h, passo: P, x0, z0, costo } = rete;
  const node = (p: XZ) => { const i = Math.floor((p.x - x0) / P), j = Math.floor((p.z - z0) / P); return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i; };
  const s = node(da), t = node(a);
  if (s < 0 || t < 0 || !(costo[t]! > 0)) return null;
  const chiuso = (k: number) => !(costo[k]! > 0) || (!!vieta && k !== s && vieta(x0 + ((k % w) + 0.5) * P, z0 + (Math.floor(k / w) + 0.5) * P));
  const n = w * h, g = new Float32Array(n).fill(Infinity), da0 = new Int32Array(n).fill(-1), fatto = new Uint8Array(n);
  // mucchio binario di [f, nodo]
  const hf: number[] = [], hk: number[] = [];
  const push = (f: number, k: number) => {
    let i = hf.length; hf.push(f); hk.push(k);
    while (i > 0) { const p = (i - 1) >> 1; if (hf[p]! <= f) break; hf[i] = hf[p]!; hk[i] = hk[p]!; i = p; }
    hf[i] = f; hk[i] = k;
  };
  const pop = (): number => {
    const top = hk[0]!, lf = hf.pop()!, lk = hk.pop()!;
    if (hf.length) {
      let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i, mf = lf; if (l < hf.length && hf[l]! < mf) { m = l; mf = hf[l]!; } if (r < hf.length && hf[r]! < mf) m = r; if (m === i) break; hf[i] = hf[m]!; hk[i] = hk[m]!; i = m; }
      hf[i] = lf; hk[i] = lk;
    }
    return top;
  };
  let cmin = Infinity; for (let k = 0; k < n; k++) if (costo[k]! > 0 && costo[k]! < cmin) cmin = costo[k]!;
  const ti = t % w, tj = Math.floor(t / w);
  const heur = (k: number) => { const di = Math.abs((k % w) - ti), dj = Math.abs(Math.floor(k / w) - tj); return (Math.max(di, dj) + 0.4142 * Math.min(di, dj)) * P * cmin; };
  g[s] = 0; push(heur(s), s);
  const VIC = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  while (hf.length) {
    const k = pop();
    if (fatto[k]) continue;
    fatto[k] = 1;
    if (k === t) break;
    const i = k % w, j = Math.floor(k / w);
    for (const [di, dj] of VIC) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const q = nj * w + ni;
      if (fatto[q] || chiuso(q)) continue;
      if (di && dj && (chiuso(j * w + ni) || chiuso(nj * w + i))) continue; // niente angoli tagliati
      const ng = g[k]! + (di && dj ? 1.4142 : 1) * P * (costo[k]! + costo[q]!) / 2;
      if (ng < g[q]!) { g[q] = ng; da0[q] = k; push(ng + heur(q), q); }
    }
  }
  if (!fatto[t]) return null;
  const centri: XZ[] = [];
  for (let k = t; k >= 0; k = da0[k]!) centri.push({ x: x0 + ((k % w) + 0.5) * P, z: z0 + (Math.floor(k / w) + 0.5) * P });
  centri.reverse();
  centri[0] = { x: da.x, z: da.z }; centri[centri.length - 1] = { x: a.x, z: a.z };
  // filo tirato: dal punto fermo si salta al più lontano che si vede (e su cui si passa allo stesso costo: le vie restano vie)
  const out: XZ[] = [centri[0]!];
  let i = 0;
  while (i < centri.length - 1) {
    let j = centri.length - 1;
    while (j > i + 1 && !(rete.vede(centri[i]!, centri[j]!) && pari(rete, centri[i]!, centri[j]!))) j--;
    out.push(centri[j]!); i = j;
  }
  return out;
}

/** Il tratto dritto non attraversa quadretti più cari di dove parte e arriva (un prato non si taglia per evitare la via). */
function pari(rete: Rete, a: XZ, b: XZ): boolean {
  const { w, passo: P, x0, z0, costo } = rete;
  const c = (p: XZ) => costo[Math.floor((p.z - z0) / P) * w + Math.floor((p.x - x0) / P)] ?? 0;
  const tetto = Math.max(c(a), c(b)) + 0.01;
  const dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (P * 0.5));
  for (let k = 1; k < n; k++) if (c({ x: a.x + (dx * k) / n, z: a.z + (dz * k) / n }) > tetto) return false;
  return true;
}
