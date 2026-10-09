// Pista a nastro 3D (docs/CORSE.md A11). Il centro passa per i punti di controllo (Catmull-Rom uniforme) ed è campionato a passo
// costante. In ogni campione c'è la terna della pista: avanti T, destra R, sopra U. Il «sopra» viene dal suggerimento dei punti
// (`su`, di serie il cielo): nei giri della morte il generatore lo fa puntare al centro del giro, nelle curve sopraelevate lo inclina.
// Un veicolo sta in coordinate di pista: s (m lungo il centro), lat (m a destra), h (m sopra la superficie).
// Per ogni campione ci sono anche:
// - k, la curvatura nel piano della pista (+ = curva a destra);
// - kv, la curvatura verso il sopra (+ = conca, come dentro un giro della morte; − = dosso);
// - th, la svolta cumulata.
// Solo + − × ÷ e Math.sqrt (tools/check_static.mjs): il replay del server deve coincidere con quello del telefono.
import type { CPuntoDef } from '@marea/content/corse.ts';

export type Nastro = {
  /** Campioni, metri tra due campioni (esatti), lunghezza totale, anello chiuso o no. */
  n: number; passo: number; len: number; chiuso: boolean;
  x: number[]; y: number[]; z: number[];
  tx: number[]; ty: number[]; tz: number[];
  rx: number[]; ry: number[]; rz: number[];
  ux: number[]; uy: number[]; uz: number[];
  /** Mezza carreggiata (m), tratto aderente (1/0), curvatura nel piano (+ = destra) e verso il sopra (+ = conca), svolta cumulata (rad). */
  l: number[]; ad: number[]; k: number[]; kv: number[]; th: number[];
  /** s (m) di ogni punto di controllo. */
  sPunti: number[];
};

const DENSO = 0.25;
const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
function cr(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

/** Costruisce il nastro dai punti di controllo. `larghezza` = mezza carreggiata dove il punto non la dice. */
export function costruisciNastro(punti: readonly CPuntoDef[], o: { chiuso: boolean; passo: number; larghezza: number }): Nastro {
  const N = punti.length;
  if (N < (o.chiuso ? 3 : 2)) throw new Error('Nastro: servono almeno 3 punti (2 se aperto)');
  const P = (i: number): readonly [number, number, number] => {
    if (o.chiuso) return punti[((i % N) + N) % N]!.p;
    if (i < 0) { const a = punti[0]!.p, b = punti[1]!.p; return [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]]; }
    if (i >= N) { const a = punti[N - 1]!.p, b = punti[N - 2]!.p; return [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]]; }
    return punti[i]!.p;
  };
  // ---- campionamento fitto lungo la spline, con la lunghezza d'arco ----
  const dx: number[] = [], dy: number[] = [], dz: number[] = [], ds: number[] = [], dSeg: number[] = [], dT: number[] = [];
  const sPunti: number[] = [];
  const segs = o.chiuso ? N : N - 1;
  let acc = 0;
  const aggiungi = (x: number, y: number, z: number, seg: number, t: number) => {
    const m = dx.length;
    if (m) acc += len3(x - dx[m - 1]!, y - dy[m - 1]!, z - dz[m - 1]!);
    dx.push(x); dy.push(y); dz.push(z); ds.push(acc); dSeg.push(seg); dT.push(t);
  };
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const m = Math.max(1, Math.ceil(len3(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]) / DENSO));
    for (let j = 0; j < m; j++) {
      const t = j / m;
      aggiungi(cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t), cr(p0[2], p1[2], p2[2], p3[2], t), i, t);
      if (j === 0) sPunti.push(ds[ds.length - 1]!);
    }
  }
  if (o.chiuso) {
    acc += len3(dx[0]! - dx[dx.length - 1]!, dy[0]! - dy[dy.length - 1]!, dz[0]! - dz[dz.length - 1]!);
  } else {
    const q = punti[N - 1]!.p; aggiungi(q[0], q[1], q[2], N - 2, 1); sPunti.push(acc);
  }
  const len = acc;
  const D = dx.length;
  // ---- ricampionamento a passo costante ----
  const n = o.chiuso ? Math.max(8, Math.round(len / o.passo)) : Math.max(2, Math.round(len / o.passo) + 1);
  const pe = o.chiuso ? len / n : len / (n - 1);
  const x: number[] = [], y: number[] = [], z: number[] = [], l: number[] = [], ad: number[] = [], hx: number[] = [], hy: number[] = [], hz: number[] = [];
  const attr = (seg: number, t: number) => {
    const a = punti[seg % N]!, b = punti[(seg + 1) % N]!;
    const la = a.l ?? o.larghezza, lb = b.l ?? o.larghezza;
    const sa = a.su ?? [0, 1, 0], sb = b.su ?? [0, 1, 0];
    l.push(la + (lb - la) * t);
    hx.push(sa[0] + (sb[0] - sa[0]) * t); hy.push(sa[1] + (sb[1] - sa[1]) * t); hz.push(sa[2] + (sb[2] - sa[2]) * t);
    ad.push(a.aderente && b.aderente ? 1 : 0);
  };
  let d = 0;
  for (let k = 0; k < n; k++) {
    const sk = k * pe;
    while (d < D - 1 && ds[d + 1]! <= sk) d++;
    const fine = d + 1 >= D; // dopo l'ultimo campione fitto: sulla chiusa si torna al primo, sull'aperta si resta lì
    const e = !fine ? d + 1 : o.chiuso ? 0 : d;
    const se = !fine ? ds[d + 1]! : o.chiuso ? len : ds[d]!;
    const span = se - ds[d]!, t = span > 1e-9 ? (sk - ds[d]!) / span : 0;
    x.push(dx[d]! + (dx[e]! - dx[d]!) * t); y.push(dy[d]! + (dy[e]! - dy[d]!) * t); z.push(dz[d]! + (dz[e]! - dz[d]!) * t);
    // gli attributi dei punti si interpolano col parametro della spline (segmento + t)
    const segE = !fine ? dSeg[d + 1]! : o.chiuso ? N : dSeg[d]!, tE = !fine ? dT[d + 1]! : o.chiuso ? 0 : dT[d]!;
    const segD = dSeg[d]!, tD = dT[d]!;
    const pD = segD + tD, pE = (segE < segD ? segE + N : segE) + tE, pp = pD + (pE - pD) * t;
    const seg = Math.min(Math.floor(pp), o.chiuso ? N * 2 : N - 2);
    attr(o.chiuso ? seg % N : seg, pp - seg);
  }
  // ---- terna: tangente dalle differenze, sopra dal suggerimento, destra = T × U ----
  const tx: number[] = [], ty: number[] = [], tz: number[] = [], rx: number[] = [], ry: number[] = [], rz: number[] = [], ux: number[] = [], uy: number[] = [], uz: number[] = [];
  const idx = (i: number) => (o.chiuso ? ((i % n) + n) % n : i < 0 ? 0 : i >= n ? n - 1 : i);
  for (let i = 0; i < n; i++) {
    const a = idx(i - 1), b = idx(i + 1);
    let Tx = x[b]! - x[a]!, Ty = y[b]! - y[a]!, Tz = z[b]! - z[a]!;
    const lt = len3(Tx, Ty, Tz) || 1; Tx /= lt; Ty /= lt; Tz /= lt;
    let Ux = hx[i]!, Uy = hy[i]!, Uz = hz[i]!;
    const dot = Ux * Tx + Uy * Ty + Uz * Tz;
    Ux -= Tx * dot; Uy -= Ty * dot; Uz -= Tz * dot;
    let lu = len3(Ux, Uy, Uz);
    if (lu < 1e-6) { Ux = i ? ux[i - 1]! : 0; Uy = i ? uy[i - 1]! : 1; Uz = i ? uz[i - 1]! : 0; lu = len3(Ux, Uy, Uz) || 1; }
    Ux /= lu; Uy /= lu; Uz /= lu;
    let Rx = Ty * Uz - Tz * Uy, Ry = Tz * Ux - Tx * Uz, Rz = Tx * Uy - Ty * Ux;
    const lr = len3(Rx, Ry, Rz) || 1; Rx /= lr; Ry /= lr; Rz /= lr;
    // di nuovo U = R × T: la terna è ortonormale anche se il suggerimento non era perpendicolare
    Ux = Ry * Tz - Rz * Ty; Uy = Rz * Tx - Rx * Tz; Uz = Rx * Ty - Ry * Tx;
    tx.push(Tx); ty.push(Ty); tz.push(Tz); rx.push(Rx); ry.push(Ry); rz.push(Rz); ux.push(Ux); uy.push(Uy); uz.push(Uz);
  }
  // ---- curvature e svolta cumulata ----
  const kk: number[] = [], kv: number[] = [], th: number[] = [0];
  for (let i = 0; i < n; i++) {
    const a = idx(i - 1), b = idx(i + 1), span = (b - a + (o.chiuso && b < a ? n : 0)) * pe || pe;
    const dTx = tx[b]! - tx[a]!, dTy = ty[b]! - ty[a]!, dTz = tz[b]! - tz[a]!;
    kk.push((dTx * rx[i]! + dTy * ry[i]! + dTz * rz[i]!) / span);
    kv.push((dTx * ux[i]! + dTy * uy[i]! + dTz * uz[i]!) / span);
  }
  for (let i = 0; i < (o.chiuso ? n : n - 1); i++) th.push(th[i]! + kk[i]! * pe);
  return { n, passo: pe, len, chiuso: o.chiuso, x, y, z, tx, ty, tz, rx, ry, rz, ux, uy, uz, l, ad, k: kk, kv, th, sPunti };
}

/** Dove cade `s` tra i campioni: i e j = i+1 (sulla chiusa j torna a 0), t = frazione, q = s riportato dentro la pista. */
export type Cella = { i: number; j: number; t: number; q: number };
const CELLA: Cella = { i: 0, j: 1, t: 0, q: 0 };
/** La cella di `s` (un oggetto condiviso: si legge subito, non si tiene). */
export function cella(n: Nastro, s: number): Cella {
  let q = s;
  if (n.chiuso) { q = s - Math.floor(s / n.len) * n.len; if (q >= n.len) q = 0; } else q = s < 0 ? 0 : s > n.len ? n.len : s;
  const f = q / n.passo;
  let i = Math.floor(f);
  if (n.chiuso) { if (i >= n.n) i = n.n - 1; CELLA.j = i + 1 < n.n ? i + 1 : 0; } else { if (i > n.n - 2) i = n.n - 2; CELLA.j = i + 1; }
  CELLA.i = i; CELLA.t = f - i; CELLA.q = q;
  return CELLA;
}
const lerp = (a: number[], c: Cella) => a[c.i]! + (a[c.j]! - a[c.i]!) * c.t;
/** Valore interpolato di un campo del nastro a `s`. */
export function campo(n: Nastro, a: number[], s: number): number { return lerp(a, cella(n, s)); }

/** Terna interpolata a `s` (non rinormalizzata: per la grafica e per le stime basta). */
export type Terna = { x: number; y: number; z: number; tx: number; ty: number; tz: number; rx: number; ry: number; rz: number; ux: number; uy: number; uz: number };
export function terna(n: Nastro, s: number, out: Terna): Terna {
  const c = cella(n, s);
  out.x = lerp(n.x, c); out.y = lerp(n.y, c); out.z = lerp(n.z, c);
  out.tx = lerp(n.tx, c); out.ty = lerp(n.ty, c); out.tz = lerp(n.tz, c);
  out.rx = lerp(n.rx, c); out.ry = lerp(n.ry, c); out.rz = lerp(n.rz, c);
  out.ux = lerp(n.ux, c); out.uy = lerp(n.uy, c); out.uz = lerp(n.uz, c);
  return out;
}
export const nuovaTerna = (): Terna => ({ x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1, rx: -1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0 });

/** Punto del mondo a (s, lat, h). */
export function punto(n: Nastro, s: number, lat: number, h: number, out: [number, number, number]): [number, number, number] {
  const c = cella(n, s);
  out[0] = lerp(n.x, c) + lerp(n.rx, c) * lat + lerp(n.ux, c) * h;
  out[1] = lerp(n.y, c) + lerp(n.ry, c) * lat + lerp(n.uy, c) * h;
  out[2] = lerp(n.z, c) + lerp(n.rz, c) * lat + lerp(n.uz, c) * h;
  return out;
}

/** Svolta della pista tra s0 e s1 (s1 ≥ s0; rad, + = a destra). */
export function svoltaTra(n: Nastro, s0: number, s1: number): number {
  const giro = n.chiuso ? n.th[n.n]! : 0;
  const th = (s: number) => {
    if (!n.chiuso) { const c = cella(n, s); return n.th[c.i]! + (n.th[c.j]! - n.th[c.i]!) * c.t; }
    const lap = Math.floor(s / n.len), c = cella(n, s);
    return lap * giro + n.th[c.i]! + (n.th[c.i + 1]! - n.th[c.i]!) * c.t;
  };
  return th(s1) - th(s0);
}

/** Dove sta un punto del mondo rispetto al nastro: s, lat, h. Cerca tra i campioni vicini a `hint` (finestra in m); con `hint` < 0 ovunque. */
export function dove(n: Nastro, px: number, py: number, pz: number, hint: number, finestra = 40): { s: number; lat: number; h: number; d2: number } {
  let bi = 0, bd = Infinity;
  const prova = (i: number) => {
    const ex = n.x[i]! - px, ey = n.y[i]! - py, ez = n.z[i]! - pz, d2 = ex * ex + ey * ey + ez * ez;
    if (d2 < bd) { bd = d2; bi = i; }
  };
  if (hint < 0) for (let i = 0; i < n.n; i++) prova(i);
  else {
    const c = cella(n, hint).i, w = Math.ceil(finestra / n.passo);
    for (let k = -w; k <= w; k++) {
      const i = c + k;
      if (n.chiuso) prova(((i % n.n) + n.n) % n.n); else if (i >= 0 && i < n.n) prova(i);
    }
  }
  // affina sul segmento prima o dopo il campione più vicino
  let s = bi * n.passo, lat = 0, h = 0, best = Infinity;
  for (const [a, b] of [[bi - 1, bi], [bi, bi + 1]] as const) {
    if (!n.chiuso && (a < 0 || b >= n.n)) continue;
    const ia = ((a % n.n) + n.n) % n.n, ib = ((b % n.n) + n.n) % n.n;
    const sx = n.x[ib]! - n.x[ia]!, sy = n.y[ib]! - n.y[ia]!, sz = n.z[ib]! - n.z[ia]!, l2 = sx * sx + sy * sy + sz * sz || 1;
    let t = ((px - n.x[ia]!) * sx + (py - n.y[ia]!) * sy + (pz - n.z[ia]!) * sz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = n.x[ia]! + sx * t, cy = n.y[ia]! + sy * t, cz = n.z[ia]! + sz * t;
    const ex = px - cx, ey = py - cy, ez = pz - cz, d2 = ex * ex + ey * ey + ez * ez;
    if (d2 < best) {
      best = d2; s = (a + t) * n.passo;
      const R = (f: number[]) => f[ia]! + (f[ib]! - f[ia]!) * t;
      lat = ex * R(n.rx) + ey * R(n.ry) + ez * R(n.rz);
      h = ex * R(n.ux) + ey * R(n.uy) + ez * R(n.uz);
    }
  }
  if (n.chiuso) { s = s - Math.floor(s / n.len) * n.len; }
  return { s, lat, h, d2: best };
}
