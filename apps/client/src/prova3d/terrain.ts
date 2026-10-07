// Isole su scogliera: cappello d'erba, falesia a strati, profilo a livello del mare (per schiuma e collisioni della barca).
import * as THREE from 'three';
import { Builder, PAT, rng } from './paint.ts';
import { COL } from './kit.ts';

export type Pt = [number, number];
export type Island = { name: string; cx: number; cz: number; top: Pt[]; topY: number; sea: Pt[] };

/** Contorno irregolare: ellisse con armoniche casuali (punti in senso antiorario visto dall'alto). */
export function blob(cx: number, cz: number, rx: number, rz: number, seed: number, n = 56, rough = 0.12): Pt[] {
  const r = rng(seed), h = [1, 2, 3, 5, 7].map((k) => ({ k, a: (r() * rough) / Math.sqrt(k), p: r() * 6.28 }));
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let s = 1; for (const q of h) s += q.a * Math.sin(q.k * a + q.p);
    out.push([cx + Math.cos(a) * rx * s, cz + Math.sin(a) * rz * s]);
  }
  return out;
}

/** Spinge in fuori ogni punto del contorno di d metri (direzione dal centro). */
const offset = (pts: Pt[], cx: number, cz: number, d: (i: number) => number): Pt[] => pts.map(([x, z], i) => { const l = Math.hypot(x - cx, z - cz) || 1; return [x + ((x - cx) / l) * d(i), z + ((z - cz) / l) * d(i)]; });

export function pointInPoly(x: number, z: number, p: Pt[]): boolean {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i]!, [xj, zj] = p[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/** Costruisce l'isola nel Builder: erba sopra, bordo d'erba che sporge, falesia a strati fino a y=-4. */
export function buildIsland(b: Builder, top: Pt[], cx: number, cz: number, topY: number, seed: number): Island & { sea: Pt[] } {
  const r = rng(seed), n = top.length, jag = top.map(() => r());
  // cappello d'erba
  const tri = THREE.ShapeUtils.triangulateShape(top.map(([x, z]) => new THREE.Vector2(x, z)), []);
  const cap: number[] = [];
  for (const [a, bb, c] of tri) {
    const A = top[a!]!, B = top[bb!]!, C = top[c!]!;
    const up = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) < 0; // verso in alto se il giro è orario in (x,z)
    for (const P of up ? [A, B, C] : [A, C, B]) cap.push(P[0], topY, P[1]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3));
  b.add(g, new THREE.Matrix4(), COL.grass, PAT.GRASS, { grad: 0, jitter: 0.05, hue: 0.02 });
  // anelli della falesia: [quota, spinta in fuori, rumore]
  const rings: [number, number, number][] = [[topY, 0, 0], [topY - 0.35, 0.25, 0.05], [topY - 0.6, 0.15, 0.2], [topY * 0.45, 0.55, 0.45], [0.4, 0.9, 0.5], [-1.2, 1.6, 0.6], [-4, 2.4, 0.4]];
  const R = rings.map(([y, d, nz]) => ({ y, pts: offset(top, cx, cz, (i) => d + (jag[i]! - 0.5) * 2 * nz + (jag[(i + 7) % n]! - 0.5) * nz) }));
  for (let k = 0; k + 1 < R.length; k++) {
    const A = R[k]!, B = R[k + 1]!, p: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a0 = A.pts[i]!, a1 = A.pts[j]!, b0 = B.pts[i]!, b1 = B.pts[j]!;
      const quad = [[a0[0], A.y, a0[1]], [b0[0], B.y, b0[1]], [b1[0], B.y, b1[1]], [a0[0], A.y, a0[1]], [b1[0], B.y, b1[1]], [a1[0], A.y, a1[1]]];
      // verso: la normale deve guardare fuori dal centro
      const e1 = new THREE.Vector3(quad[1]![0]! - quad[0]![0]!, quad[1]![1]! - quad[0]![1]!, quad[1]![2]! - quad[0]![2]!), e2 = new THREE.Vector3(quad[2]![0]! - quad[0]![0]!, quad[2]![1]! - quad[0]![1]!, quad[2]![2]! - quad[0]![2]!);
      const nrm = e1.cross(e2), out = nrm.x * (a0[0] - cx) + nrm.z * (a0[1] - cz) > 0;
      const order = out ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4];
      for (const o of order) p.push(...(quad[o] as number[]));
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const grassy = k === 0;
    b.add(rg, new THREE.Matrix4(), grassy ? COL.grassLight : k < 3 ? COL.cliff : COL.cliffDark, grassy ? PAT.GRASS : PAT.ROCK, { grad: grassy ? 0 : 0.35, jitter: grassy ? 0.05 : 0.12, hue: 0.02 });
  }
  // profilo a livello del mare (interpolato tra gli anelli 0,4 e -1,2)
  const lo = R[4]!, hi = R[5]!, t = (0.4 - 0) / (0.4 + 1.2);
  const sea = lo.pts.map(([x, z], i) => [x + (hi.pts[i]![0] - x) * t, z + (hi.pts[i]![1] - z) * t] as Pt);
  return { name: '', cx, cz, top, topY, sea };
}

/**
 * Campo di distanza dalla riva (metri, 0 sulla terra) su una griglia quadrata: lo legge l'acqua (colore per profondità,
 * schiuma) e la barca (non entra nelle isole). Trasformata a smusso a due passate: O(n), pochi ms.
 */
export type DistField = { tex: THREE.DataTexture; region: THREE.Vector4; at(x: number, z: number): number };
export function distanceField(shapes: Pt[][], extra: { x: number; z: number; r: number }[], min: number, size: number, res = 512, maxD = 24): DistField {
  const cell = size / res, d = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = min + (i + 0.5) * cell, z = min + (j + 0.5) * cell;
    let land = shapes.some((p) => pointInPoly(x, z, p));
    if (!land) for (const e of extra) if (Math.hypot(x - e.x, z - e.z) < e.r) { land = true; break; }
    d[j * res + i] = land ? 0 : 1e9;
  }
  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    let v = d[j * res + i]!;
    if (i > 0) v = Math.min(v, d[j * res + i - 1]! + a);
    if (j > 0) { v = Math.min(v, d[(j - 1) * res + i]! + a); if (i > 0) v = Math.min(v, d[(j - 1) * res + i - 1]! + b); if (i < res - 1) v = Math.min(v, d[(j - 1) * res + i + 1]! + b); }
    d[j * res + i] = v;
  }
  for (let j = res - 1; j >= 0; j--) for (let i = res - 1; i >= 0; i--) {
    let v = d[j * res + i]!;
    if (i < res - 1) v = Math.min(v, d[j * res + i + 1]! + a);
    if (j < res - 1) { v = Math.min(v, d[(j + 1) * res + i]! + a); if (i < res - 1) v = Math.min(v, d[(j + 1) * res + i + 1]! + b); if (i > 0) v = Math.min(v, d[(j + 1) * res + i - 1]! + b); }
    d[j * res + i] = v;
  }
  const bytes = new Uint8Array(res * res);
  for (let k = 0; k < d.length; k++) { d[k] = Math.min(maxD, d[k]! * cell); bytes[k] = Math.round((d[k]! / maxD) * 255); }
  const tex = new THREE.DataTexture(bytes, res, res, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return {
    tex, region: new THREE.Vector4(min, min, size, maxD),
    at(x, z) {
      const i = Math.floor((x - min) / cell), j = Math.floor((z - min) / cell);
      if (i < 0 || j < 0 || i >= res || j >= res) return maxD;
      return d[j * res + i]!;
    },
  };
}
