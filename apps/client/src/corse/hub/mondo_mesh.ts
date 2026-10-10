// La geometria procedurale dell'hub (#185): terreno a riquadri sull'atlas (tessere a pixel, ombre finte nei pendii, variazioni
// per triangolo), il mare a fasce di profondità con la schiuma a pixel, le strade (asfalto, cordoli rossi e bianchi, la riga),
// i ponti, il pontile, la banchina e i trampolini. Tutto finisce in «tele» per riquadro (vedi mondo_base.ts).
import { P } from '../../render/island_parts.ts';
import { TESSERE, Tela, h01, rumore } from './mondo_base.ts';
import type { NomeP, Pennello, Tessera, V2, V3 } from './mondo_base.ts';
import { CASCATA, MARE, NC, NRIQ, PASSO, PONTILE, PONTILE_Y, RAMPE, RIQ, STAGNO, TESS, X0, Z0 } from './mondo_terreno.ts';
import type { Strada, Terreno } from './mondo_terreno.ts';

export const chiave = (x: number, z: number): number => {
  const i = Math.min(NRIQ - 1, Math.max(0, Math.floor((x - X0) / RIQ))), j = Math.min(NRIQ - 1, Math.max(0, Math.floor((z - Z0) / RIQ)));
  return j * NRIQ + i;
};
/**
 * Gli strati di ogni riquadro: `t` terreno a 2 m (da vicino), `tl` terreno a 4 m (da lontano), `s` strade (da vicino), `sl` strade
 * semplici (da lontano: solo asfalto), `p` costruzioni
 * grandi (sempre, fanno ombra), `pv` cose piccole (solo da vicino: fiori, festoni). `e` = emissivo, una tela per tutto l'hub.
 */
export type Strato = 't' | 'tl' | 's' | 'sl' | 'p' | 'pv';
export class Tele {
  readonly m = new Map<string, Tela>();
  readonly e = new Tela();
  at(x: number, z: number, strato: Strato = 'p'): Tela { const k = strato + ':' + chiave(x, z); let t = this.m.get(k); if (!t) this.m.set(k, (t = new Tela())); return t; }
  /** Le tele di un riquadro per strato (vuote se non c'è niente). */
  di(k: number, strato: Strato): Tela | undefined { return this.m.get(strato + ':' + k); }
  riquadri(): number[] { const out = new Set<number>(); for (const k of this.m.keys()) out.add(+k.split(':')[1]!); return [...out]; }
}

const A = 1 / 1024;
/** UV di una tessera con coordinate locali in metri (0..lato). */
function uvT(t: Tessera, lu: number, lv: number): V2 {
  const [u0, v0, lato] = TESSERE[t].t;
  return [(u0 + 0.02 + Math.min(lato - 0.04, Math.max(0, lu * 16))) * A, (v0 + 0.02 + Math.min(lato - 0.04, Math.max(0, lv * 16))) * A];
}
const COL = new Map<string, V3>();
function rgb(hex: string, k = 1): V3 {
  let c = COL.get(hex);
  if (!c) { const n = parseInt(hex.slice(1), 16); const f = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; c = [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]; COL.set(hex, c); }
  return [c[0] * k, c[1] * k, c[2] * k];
}

// ---------- terreno ----------
export function terrenoInTele(t: Terreno, tele: Tele): void {
  const N1 = NC + 1, H = t.H;
  const hv = (i: number, j: number) => H[Math.min(NC, Math.max(0, j)) * N1 + Math.min(NC, Math.max(0, i))]!;
  // ombra finta: quanto il vertice sta più in basso dei vicini (conche, piedi dei pendii) → più scuro
  const ao = new Float32Array(N1 * N1);
  for (let j = 0; j <= NC; j++) for (let i = 0; i <= NC; i++) {
    const h = hv(i, j);
    let s = 0; for (const [di, dj] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) s += hv(i + di, j + dj);
    ao[j * N1 + i] = Math.max(-0.08, Math.min(0.34, (s / 8 - h) * 0.22));
  }
  const aov = (i: number, j: number) => ao[Math.min(NC, j) * N1 + Math.min(NC, i)]!;
  // passo 1 = 2 m (strato t), passo 2 = 4 m (strato tl): stessa tessera della cella in basso a sinistra, una tessera intera per cella
  for (const passo of [1, 2]) {
    const strato = passo === 1 ? 't' : 'tl', lato = 2 * passo;
    for (let j = 0; j < NC; j += passo) for (let i = 0; i < NC; i += passo) {
      const a = hv(i, j), b = hv(i + passo, j), c = hv(i, j + passo), d = hv(i + passo, j + passo);
      if (Math.max(a, b, c, d) < MARE - 0.06) continue; // sott'acqua: lo copre il mare
      const x = X0 + i * PASSO, z = Z0 + j * PASSO;
      const tess = TESS[t.T[j * NC + i]!]!, qx = passo === 1 ? (i & 1) * 2 : 0, qz = passo === 1 ? (j & 1) * 2 : 0;
      const tela = tele.at(x + lato / 2, z + lato / 2, strato);
      const V: V3[] = [[x, a, z], [x + lato, b, z], [x, c, z + lato], [x + lato, d, z + lato]];
      const L: V2[] = [[0, 0], [lato, 0], [0, lato], [lato, lato]];
      const AO = [aov(i, j), aov(i + passo, j), aov(i, j + passo), aov(i + passo, j + passo)];
      const tris = ((i + j) / passo) & 1 ? [[0, 2, 1], [1, 2, 3]] : [[0, 2, 3], [0, 3, 1]];
      tris.forEach(([p, q, r], k) => {
        const A3 = V[p!]!, B3 = V[q!]!, C3 = V[r!]!;
        // ripido: la tessera si proietta di lato (u lungo la parete, v in giù), dentro il suo quarto di tessera
        const ux = B3[0] - A3[0], uy = B3[1] - A3[1], uz = B3[2] - A3[2], vx = C3[0] - A3[0], vy = C3[1] - A3[1], vz = C3[2] - A3[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
        let uv: V2[];
        if (Math.abs(ny / nl) < 0.6) {
          const ytop = Math.max(a, b, c, d), span = Math.max(lato, ytop - Math.min(a, b, c, d)), lungoX = Math.abs(nz) > Math.abs(nx);
          uv = [p!, q!, r!].map((m) => uvT(tess, qx + (lungoX ? L[m]![0] : L[m]![1]), qz + ((ytop - V[m]![1]) / span) * lato));
        } else uv = [p!, q!, r!].map((m) => uvT(tess, qx + L[m]![0], qz + L[m]![1]));
        const o = (AO[p!]! + AO[q!]! + AO[r!]!) / 3, var_ = h01(i * 2 + k, j, 31);
        const tinta = Math.round((1 - Math.max(-0.06, o)) * 12) / 12 - (var_ < 0.2 ? 0.05 : var_ > 0.9 ? -0.03 : 0);
        // la neve un filo più fredda (la luce calda del tramonto la farebbe sembrare sabbia)
        const t3: V3 | number = tess === 'neve' ? [tinta * 0.86, tinta * 0.95, tinta * 1.06] : tinta;
        tela.tri(A3, B3, C3, uv[0]!, uv[1]!, uv[2]!, rgb(TESSERE[tess].c, tinta), t3);
      });
    }
  }
}

// ---------- mare ----------
/** Il mare vicino alla costa a fasce (schiuma, acqua bassa, acqua, profonda), il laghetto, la cascata e il mare aperto 30 cm sotto. */
export function acquaInTela(t: Terreno): Tela {
  const w = new Tela(), N1 = NC + 1, H = t.H, u0: V2 = [0, 0];
  const hv = (i: number, j: number) => H[j * N1 + i]!;
  const piano = (x0: number, z0: number, x1: number, z1: number, y: number, col: V3) => {
    const a: V3 = [x0, y, z0], b: V3 = [x1, y, z0], c: V3 = [x1, y, z1], d: V3 = [x0, y, z1];
    const uv = (p: V3): V2 => [p[0] / 4, p[2] / 4];
    w.tri(a, d, c, uv(a), uv(d), uv(c), col, 1); w.tri(a, c, b, uv(a), uv(c), uv(b), col, 1);
  };
  const colore = (i: number, j: number): NomeP | null => {
    const a = hv(i, j), b = hv(i + 1, j), c = hv(i, j + 1), d = hv(i + 1, j + 1), mn = Math.min(a, b, c, d);
    if (mn >= MARE || mn < MARE - 7.5) return null;
    const prof = MARE - (a + b + c + d) / 4, x = X0 + i * PASSO, z = Z0 + j * PASSO, r = h01(i, j, 41), m = rumore(x, z, 7, 43);
    if (prof < 0.3 || Math.max(a, b, c, d) > MARE) return r < 0.5 ? 'pietraChiara' : 'acquaBassa';   // schiuma sulla riva
    if (prof < 1.5) return r < 0.05 ? 'pietraChiara' : 'acquaBassa';
    if (prof < 3) return m + (prof - 1.5) * 0.35 < 0.55 ? 'acquaBassa' : 'acqua';
    if (prof < 5.4) return 'acqua';
    return m + (prof - 5.4) * 0.3 < 0.6 ? 'acqua' : 'acquaProfonda';
  };
  for (let j = 0; j < NC; j++) {
    let i = 0;
    while (i < NC) {
      const c = colore(i, j); if (!c) { i++; continue; }
      let k = i + 1;
      while (k < NC && k - i < 24 && colore(k, j) === c && c !== 'pietraChiara') k++;
      piano(X0 + i * PASSO, Z0 + j * PASSO, X0 + k * PASSO, Z0 + (j + 1) * PASSO, MARE, rgb(P[c]));
      i = k;
    }
  }
  // il mare aperto: 30 cm sotto (sotto la costa lo copre il terreno, vicino alla costa il mare a fasce)
  const R = 2400;
  piano(-R, -R, R, R, MARE - 0.3, rgb(P.acquaProfonda));
  // il laghetto della giungla e la cascata che ci cade dentro (dall'altopiano)
  const n = 14, ys = STAGNO.y;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, rr = STAGNO.r + 1.2;
    const p0: V3 = [STAGNO.x, ys, STAGNO.z], p1: V3 = [STAGNO.x + Math.cos(a0) * rr, ys, STAGNO.z + Math.sin(a0) * rr], p2: V3 = [STAGNO.x + Math.cos(a1) * rr, ys, STAGNO.z + Math.sin(a1) * rr];
    w.tri(p0, p2, p1, [p0[0] / 4, p0[2] / 4], [p2[0] / 4, p2[2] / 4], [p1[0] / 4, p1[2] / 4], rgb(P[k % 3 ? 'acqua' : 'acquaBassa']), 1);
  }
  const top = t.quotaTerra(CASCATA.x, CASCATA.z - 6) + 0.4, larga = 7;
  for (let k = 0; k < 4; k++) {
    const x0 = CASCATA.x - larga / 2 + (k * larga) / 4, x1 = x0 + larga / 4, zz = CASCATA.z + 0.4 + (k % 2) * 0.3;
    const a: V3 = [x0, ys - 0.2, zz], b: V3 = [x1, ys - 0.2, zz], c: V3 = [x1, top, zz - 2.5], d: V3 = [x0, top, zz - 2.5];
    const uv = (p: V3): V2 => [p[0] / 4, -p[1] / 2.4];
    const col = rgb(P[k % 2 ? 'acquaBassa' : 'pietraChiara']);
    w.tri(a, b, c, uv(a), uv(b), uv(c), col, 1); w.tri(a, c, d, uv(a), uv(c), uv(d), col, 1);
  }
  // schiuma ai piedi della cascata
  piano(CASCATA.x - 5, CASCATA.z + 0.5, CASCATA.x + 5, CASCATA.z + 3.5, ys + 0.03, rgb(P.pietraChiara));
  void u0;
  return w;
}

// ---------- strade ----------
const ASFALTO: Pennello = { t: 'cemento', tinta: 0.42 };
export function stradeInTele(t: Terreno, tele: Tele): void {
  const strade = t.strade;
  /** C'è un'altra strada (prima di questa nell'elenco) che copre il punto? Lì l'asfalto lo disegna lei. */
  const coperto = (x: number, z: number, r: number, margine: number) => {
    const q = t.vicini.vicino(x, z, 8, (c) => c.r < r); return !!q && q.d < q.c.l - margine;
  };
  const incrocio = (x: number, z: number, r: number, m: number) => { const q = t.vicini.vicino(x, z, 9, (c) => c.r !== r); return !!q && q.d < q.c.l + m; };
  strade.forEach((s: Strada, r) => {
    const c = s.c, n = c.length, l = s.def.l, riga = l >= 4.5;
    for (let i = 0; i + 2 < n || (s.def.chiusa && i < n - 1); i += 2) {
      const a = c[i]!, b = c[Math.min(n - 1, i + 2)]!, cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, tela = tele.at(cx, cz, 's'), telaP = tele.at(cx, cz, 'p');
      const pt = (q: typeof a, lat: number, dy = 0.04): V3 => [q.x + q.tz * lat, q.y + dy, q.z - q.tx * lat];
      const v0 = (i % 4), v1 = v0 + 2;
      // asfalto: strisce larghe al massimo 4 m (una tessera)
      if (!coperto(cx, cz, r, 0.4)) {
        const larg = 2 * (l - 0.9), ns = Math.ceil(larg / 4), w = larg / ns;
        for (let k = 0; k < ns; k++) {
          const l0 = -(l - 0.9) + k * w, l1 = l0 + w;
          tela.quad(pt(a, l1), pt(a, l0), pt(b, l0), pt(b, l1), ASFALTO, [[w, v0], [0, v0], [0, v1], [w, v1]]);
        }
        // cordoli rossi e bianchi a ogni lato (non dentro gli incroci)
        for (const lato of [-1, 1]) {
          const k0 = lato * (l - 0.9), k1 = lato * (l + 0.15), mx = cx + a.tz * lato * l, mz = cz - a.tx * lato * l;
          if (incrocio(mx, mz, r, 0.3)) continue;
          const pen: Pennello = { p: (i >> 1) % 2 ? 'rosso' : 'pietraChiara' };
          const hi = Math.max(k0, k1), lo = Math.min(k0, k1), [p0, p1, p2, p3] = [pt(a, hi, 0.07), pt(a, lo, 0.07), pt(b, lo, 0.07), pt(b, hi, 0.07)];
          tela.quad(p0!, p1!, p2!, p3!, pen);
          // il fianco del cordolo (si vede da basso)
          const q0 = lato < 0 ? pt(a, k1, -0.25) : pt(a, k1, -0.25), q1 = lato < 0 ? pt(b, k1, -0.25) : pt(b, k1, -0.25);
          if (lato < 0) tela.quad(q0, q1, pt(b, k1, 0.07), pt(a, k1, 0.07), pen); else tela.quad(q1, q0, pt(a, k1, 0.07), pt(b, k1, 0.07), pen);
        }
        // la riga tratteggiata in mezzo
        if (riga && i % 6 < 3 && !incrocio(cx, cz, r, 3)) tela.quad(pt(a, 0.16, 0.06), pt(a, -0.16, 0.06), pt(b, -0.16, 0.06), pt(b, 0.16, 0.06), { p: 'pietraChiara' });
      }
      // da lontano: solo l'asfalto, una striscia ogni 4 m (in tinta unita)
      if (i % 4 === 0 && !coperto(cx, cz, r, 0.4)) {
        const b4 = c[Math.min(n - 1, i + 4)]!, tl = tele.at(cx, cz, 'sl');
        tl.quad(pt(a, l, 0.08), pt(a, -l, 0.08), pt(b4, -l, 0.08), pt(b4, l, 0.08), { p: 'roccia', tinta: 1.15 });
      }
      // ponte: la soletta sotto, i parapetti e le pile
      if (a.ponte || b.ponte) {
        const sot = 1.1;
        for (const lato of [-1, 1]) {
          const e = lato * (l + 0.15), e2 = lato * (l + 0.6);
          const s0 = pt(a, e, -sot), s1 = pt(b, e, -sot), t0 = pt(a, e, 0.07), t1 = pt(b, e, 0.07);
          if (lato < 0) telaP.quad(s0, s1, t1, t0, { t: 'pietraMuro' }, [[0, 1.1], [2, 1.1], [2, 0], [0, 0]]); else telaP.quad(s1, s0, t0, t1, { t: 'pietraMuro' }, [[0, 1.1], [2, 1.1], [2, 0], [0, 0]]);
          // parapetto: muretto 0,9 m
          const m0 = pt(a, e, 0.07), m1 = pt(b, e, 0.07), m2 = pt(b, e, 0.95), m3 = pt(a, e, 0.95), n0 = pt(a, e2, 0.07), n1 = pt(b, e2, 0.07), n2 = pt(b, e2, 0.95), n3 = pt(a, e2, 0.95);
          const pen: Pennello = { t: 'pietraMuro', tinta: 1.05 };
          if (lato < 0) { telaP.quad(m1, m0, m3, m2, pen); telaP.quad(n0, n1, n2, n3, pen); telaP.quad(m3, n3, n2, m2, { p: 'pietraChiara' }); }
          else { telaP.quad(m0, m1, m2, m3, pen); telaP.quad(n1, n0, n3, n2, pen); telaP.quad(n3, m3, m2, n2, { p: 'pietraChiara' }); }
        }
        telaP.quad(pt(a, -l - 0.6, -sot), pt(a, l + 0.6, -sot), pt(b, l + 0.6, -sot), pt(b, -l - 0.6, -sot), { p: 'pietraScura' });
        if (i % 16 === 0) {
          const fondo = Math.min(MARE - 3, t.quotaTerra(a.x, a.z) - 0.5), alto = a.y - sot - fondo;
          if (alto > 1.5) telaP.box(a.x, fondo, a.z, 2.6, alto, 2.2, Math.atan2(a.tx, a.tz), { t: 'pietraMuro' }, { p: 'pietraScura' });
        }
      }
    }
  });
}

// ---------- pontile, banchina, trampolini ----------
export function costruzioniInTele(t: Terreno, tele: Tele): void {
  // pontile: tavolato, travi, pali
  for (const [x0, x1, z0, z1] of PONTILE) {
    const tela = tele.at((x0 + x1) / 2, (z0 + z1) / 2), y = PONTILE_Y;
    tela.box((x0 + x1) / 2, y - 0.35, (z0 + z1) / 2, x1 - x0, 0.35, z1 - z0, 0, { t: 'legnoScuro' }, { t: 'tavole' });
    for (let x = x0 + 0.4; x <= x1 - 0.3; x += Math.max(2, (x1 - x0 - 0.8) / Math.round((x1 - x0) / 4))) for (let z = z0 + 0.4; z <= z1; z += 4)
      if (x < x0 + 0.5 || x > x1 - 1 || z > z1 - 1 || (x1 - x0 > 20 && z > z0 + 2)) tela.prisma(x, MARE - 3, z, 0.24, 0.24, y - 0.35 - (MARE - 3) + 0.6, 6, { t: 'legnoScuro' }, { p: 'legnoScuro' });
  }
  // la banchina di pietra del paese, sul fronte del molo
  {
    const z = 152, y0 = MARE - 2.5, y1 = 1.66;
    for (let x = -44; x < 52; x += 4) {
      if (x + 4 > -5 && x < 5) continue; // il pontile parte da qui
      tele.at(x + 2, z).box(x + 2, y0, z + 0.2, 4, y1 - y0, 1.6, 0, { t: 'pietraMuro' }, { p: 'pietra' });
    }
    tele.at(-2, z).box(0, y0, z + 0.4, 10, y1 - y0 - 0.2, 1.2, 0, { t: 'pietraMuro' }, { p: 'pietra' });
  }
  // trampolini: cuneo giallo e nero con il fianco di legno, gradino in fondo
  for (const rp of RAMPE) {
    const fx = Math.sin(rp.yaw), fz = Math.cos(rp.yaw), rx = fz, rz = -fx, tela = tele.at(rp.x, rp.z);
    const yb = t.quota(rp.x - fx * 0.5, rp.z - fz * 0.5) - 0.02;
    const p = (u: number, v: number, h: number): V3 => [rp.x + fx * u + rx * v, yb + h, rp.z + fz * u + rz * v];
    const L = rp.lung, W = rp.l, Hh = rp.h, ye = t.quotaTerra(rp.x + fx * L, rp.z + fz * L) - yb;
    // piano inclinato a fasce (una tessera «pericolo» ogni 2 m)
    for (let u = 0; u < L - 0.01; u += 2) {
      const u1 = Math.min(L, u + 2);
      for (let v = -W; v < W - 0.01; v += 2) { const v1 = Math.min(W, v + 2); tela.quad(p(u, v1, (u / L) * Hh), p(u, v, (u / L) * Hh), p(u1, v, (u1 / L) * Hh), p(u1, v1, (u1 / L) * Hh), { t: 'pericolo' }); }
    }
    for (const s of [-1, 1]) {
      const a = p(0, s * W, 0), b = p(L, s * W, Math.min(0, ye)), c = p(L, s * W, Hh), d = p(0, s * W, 0.01);
      if (s < 0) tela.quad(a, b, c, d, { t: 'legnoScuro' }); else tela.quad(b, a, d, c, { t: 'legnoScuro' });
    }
    tela.quad(p(L, -W, Math.min(0, ye)), p(L, W, Math.min(0, ye)), p(L, W, Hh), p(L, -W, Hh), { t: 'legnoScuro' }); // il gradino
    // frecce sul bordo e due coni ai lati dell'imbocco
    tela.quad(p(L - 0.25, W, Hh + 0.02), p(L - 0.25, -W, Hh + 0.02), p(L, -W, Hh + 0.02), p(L, W, Hh + 0.02), { p: 'rosso' });
  }
  void rumore;
}

/** Fiori: crocette colorate (aiuole della rotatoria e della piazza, prati). */
export function fiore(tela: Tela, x: number, y: number, z: number, col: NomeP, s = 1): void {
  const h = 0.45 * s, w = 0.22 * s;
  tela.quad([x - w, y, z], [x + w, y, z], [x + w, y + h, z], [x - w, y + h, z], { p: 'erbaScura' });
  tela.quad([x, y, z - w], [x, y, z + w], [x, y + h, z + w], [x, y + h, z - w], { p: 'erbaScura' });
  tela.box(x, y + h, z, 0.3 * s, 0.22 * s, 0.3 * s, h01(x * 10 | 0, z * 10 | 0, 3) * 3, { p: col });
}
