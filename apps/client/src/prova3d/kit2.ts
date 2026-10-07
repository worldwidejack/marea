// Kit (seconda parte): natura, moli, barche, persone, mulino, faro, orto.
import * as THREE from 'three';
import { Builder, M, PAT, rng } from './paint.ts';
import { BALL, BLOB, BLOB_LO, BOX, BUD, COL, HEAD, ROCK, box, cyl, cylinder, lanternHead, taper } from './kit.ts';
import type { Ctx } from './kit.ts';

export function tree(ctx: Ctx, x: number, y: number, z: number, s = 1, seed = 1, lo = false) {
  const r = rng(seed), P = M(x, y, z, r() * 6), b = ctx.b;
  cylinder(b, P, 0, 0, 0, 0.26 * s, 2.4 * s, COL.woodDark, 6, PAT.PLANKS, { grad: 0.2 }, 0.6);
  box(b, P, 0.3 * s, 1.5 * s, 0, 0.12 * s, 0.9 * s, 0.12 * s, COL.woodDark, PAT.PLANKS, {}, 0, 0, -0.7);
  const tones = [COL.leafDark, COL.leaf, COL.leaf, COL.leafLight];
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r(), rr = i === 0 ? 0 : 0.9 * s, sz = (i === 0 ? 1.45 : 0.95 + r() * 0.35) * s;
    b.add(lo ? BLOB_LO : BLOB, P.clone().multiply(M(Math.cos(a) * rr, (i === 0 ? 3.3 : 2.6 + r() * 1.1) * s, Math.sin(a) * rr, r() * 3, sz, sz * 0.85, sz)), tones[(i + Math.floor(r() * 4)) % 4]!, PAT.GRASS, { smooth: true, grad: 0.45, jitter: 0.06, hue: 0.02 });
  }
  ctx.obst.push({ x, z, r: 0.5 * s });
}
export function bush(ctx: Ctx, x: number, y: number, z: number, s = 1, flowers?: string) {
  const P = M(x, y, z, x * 2.3);
  ctx.b.add(BLOB, P.clone().multiply(M(0, 0.35 * s, 0, 0, 0.75 * s, 0.55 * s, 0.75 * s)), COL.leaf, PAT.GRASS, { smooth: true, grad: 0.5 });
  ctx.b.add(BLOB, P.clone().multiply(M(0.5 * s, 0.25 * s, 0.2 * s, 0, 0.5 * s, 0.4 * s, 0.5 * s)), COL.leafLight, PAT.GRASS, { smooth: true, grad: 0.5 });
  if (flowers) for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.b.add(BUD, P.clone().multiply(M(Math.cos(a) * 0.5 * s, 0.55 * s + (i % 3) * 0.08, Math.sin(a) * 0.45 * s, 0, 0.09)), flowers, PAT.BRUSH, { smooth: true }); }
}
export function rock(ctx: Ctx, x: number, y: number, z: number, s = 1, seed = 1, c: string = COL.cliff) {
  const r = rng(seed);
  ctx.b.add(ROCK, M(x, y + s * 0.3, z, r() * 6, s * (1 + r() * 0.4), s * (0.6 + r() * 0.3), s * (0.9 + r() * 0.3), r() * 0.4), c, PAT.ROCK, { grad: 0.4, jitter: 0.1 });
}

/** Molo rettangolare: assi, travi, pali che escono dall'acqua, corrimano di corda, lanterne. Asse lungo = X se along='x'. */
export function dock(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, along: 'x' | 'z', rails: { n?: boolean; s?: boolean; e?: boolean; w?: boolean } = {}, seed = 3) {
  const r = rng(seed), b = ctx.b, I = new THREE.Matrix4(), L = along === 'x' ? x1 - x0 : z1 - z0, W = along === 'x' ? z1 - z0 : x1 - x0;
  const pw = 0.42, n = Math.floor(L / pw);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * (L / n), c = new THREE.Color(COL.plank).multiplyScalar(0.85 + r() * 0.3);
    if (along === 'x') box(b, I, x0 + t, y - 0.12 + r() * 0.02, (z0 + z1) / 2, L / n - 0.05, 0.12, W, c, PAT.PLANKS, { grad: 0, jitter: 0.04 });
    else box(b, I, (x0 + x1) / 2, y - 0.12 + r() * 0.02, z0 + t, W, 0.12, L / n - 0.05, c, PAT.PLANKS, { grad: 0, jitter: 0.04 });
  }
  // travi sotto
  for (const k of [0.15, 0.85]) {
    if (along === 'x') box(b, I, (x0 + x1) / 2, y - 0.45, z0 + W * k, L, 0.3, 0.25, COL.woodDark, PAT.PLANKS);
    else box(b, I, x0 + W * k, y - 0.45, (z0 + z1) / 2, 0.25, 0.3, L, COL.woodDark, PAT.PLANKS);
  }
  // pali sui bordi ogni ~2,6 m
  const posts: [number, number][] = [];
  const np = Math.max(1, Math.round(L / 2.6));
  for (let i = 0; i <= np; i++) {
    const t = (i / np) * L;
    if (along === 'x') posts.push([x0 + t, z0], [x0 + t, z1]); else posts.push([x0, z0 + t], [x1, z0 + t]);
  }
  const railOn = (px: number, pz: number) => (pz === z0 && rails.n) || (pz === z1 && rails.s) || (px === x0 && rails.w) || (px === x1 && rails.e);
  posts.forEach(([px, pz], i) => {
    const up = railOn(px, pz) ? 1.15 : 0.35;
    cylinder(b, I, px, -1.5, pz, 0.17, y + 1.5 + up, COL.woodDark, 6, PAT.PLANKS, { grad: 0.5 });
    if (railOn(px, pz) && i % 4 === 0) lanternHead(ctx, I, px, y + up, pz, 0.8);
  });
  // corda tra i pali con ringhiera
  for (let i = 0; i + 2 < posts.length; i++) {
    const [ax, az] = posts[i]!, [bx, bz] = posts[i + 2]!;
    if (!railOn(ax, az) || !railOn(bx, bz)) continue;
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    b.add(cyl(4), M((ax + bx) / 2, y + 0.95, (az + bz) / 2, -ang, 0.035, len, 0.035, 0, Math.PI / 2), '#c9a36b', PAT.BRUSH, { grad: 0 });
    b.add(cyl(4), M((ax + bx) / 2, y + 0.5, (az + bz) / 2, -ang, 0.03, len, 0.03, 0, Math.PI / 2), '#c9a36b', PAT.BRUSH, { grad: 0 });
  }
}

/** Scafo di una barca a remi/vela: sezioni a V, prua a punta verso +X. Restituisce esterno e interno (più scuro). */
export function hullGeometry(L: number, W: number, D: number, inner: boolean): THREE.BufferGeometry {
  const st = 9, sec: THREE.Vector3[][] = [];
  for (let i = 0; i <= st; i++) {
    const t = i / st, x = -L / 2 + t * L, w = (W / 2) * (t < 0.6 ? 1 - Math.pow((0.6 - t) / 0.6, 3) * 0.35 : Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.6) / 0.4, 2)))) * (inner ? 0.88 : 1);
    const sheer = D + Math.pow(t, 3) * D * 0.5, k = inner ? D * 0.15 : 0;
    sec.push([new THREE.Vector3(x, sheer, -w), new THREE.Vector3(x, D * 0.35 + k, -w * 0.8), new THREE.Vector3(x, k, 0), new THREE.Vector3(x, D * 0.35 + k, w * 0.8), new THREE.Vector3(x, sheer, w)]);
  }
  const p: number[] = [], push = (v: THREE.Vector3) => p.push(v.x, v.y, v.z);
  for (let i = 0; i < st; i++) for (let j = 0; j < 4; j++) {
    const a = sec[i]![j]!, bb = sec[i + 1]![j]!, c = sec[i + 1]![j + 1]!, d = sec[i]![j + 1]!;
    if (inner) { push(a); push(c); push(bb); push(a); push(d); push(c); } else { push(a); push(bb); push(c); push(a); push(c); push(d); }
  }
  // specchio di poppa
  const s0 = sec[0]!;
  for (let j = 1; j < 4; j++) { if (inner) { push(s0[0]!); push(s0[j + 1]!); push(s0[j]!); } else { push(s0[0]!); push(s0[j]!); push(s0[j + 1]!); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g;
}

/** Barca (a vela se sail): pezzi aggiunti a b con la matrice P (prua verso +X locale). */
export function boat(b: Builder, P: THREE.Matrix4, o: { L?: number; sail?: boolean; hull?: string; sailC?: string } = {}) {
  const L = o.L ?? 4.2, W = L * 0.36, D = L * 0.17;
  b.add(hullGeometry(L, W, D, false), P, o.hull ?? COL.wood, PAT.PLANKS, { grad: 0.45 });
  b.add(hullGeometry(L, W, D, true), P, COL.woodDark, PAT.PLANKS, { grad: 0.3 });
  b.add(BOX, P.clone().multiply(M(0, D * 1.02, 0, 0, L * 0.92, 0.06, 0.06)), COL.woodDark, PAT.PLANKS); // chiglia alta (falchetta centrale)
  for (const t of [-0.25, 0.12]) box(b, P, L * t, D * 0.55, 0, 0.35, 0.07, W * 0.8, COL.plank, PAT.PLANKS);
  if (o.sail) {
    cylinder(b, P, L * 0.1, 0, 0, 0.06, L * 1.25, COL.woodDark, 6, PAT.PLANKS);
    box(b, P, L * -0.15, D * 1.4, 0, L * 0.55, 0.08, 0.08, COL.woodDark);
    const sg = new THREE.BufferGeometry(), h = L * 1.15, x0 = L * 0.08, x1 = -L * 0.42, y0 = D * 1.5;
    sg.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, 0.02, x1, y0, 0.02, x0, h, 0.02, x0, y0, -0.02, x0, h, -0.02, x1, y0, -0.02], 3));
    b.add(sg, P, o.sailC ?? COL.cream, PAT.PLASTER, { grad: -0.15, jitter: 0.02 });
  } else {
    for (const s of [-1, 1]) box(b, P, -L * 0.05, D * 0.9, s * W * 0.55, L * 0.7, 0.05, 0.06, COL.plank, PAT.PLANKS, {}, s * 0.15, 0, -0.2);
  }
}

export type Look = { shirt: string; pants: string; skin: string; hair: string; hat?: string; vest?: string; skirt?: boolean; pack?: boolean };
export type Limb = 'legL' | 'legR' | 'armL' | 'armR' | 'body';
/** Persona a proporzioni normali (1,78 m, testa 1/7,5). Pezzi per arto con il loro perno: il giocatore li anima, i passanti si fondono. */
export function personParts(o: Look): { limb: Limb; pivot: THREE.Vector3; parts: { g: THREE.BufferGeometry; m: THREE.Matrix4; c: string; smooth?: boolean }[] }[] {
  const leg = (s: number) => ({ limb: (s < 0 ? 'legL' : 'legR') as Limb, pivot: new THREE.Vector3(s * 0.1, 0.92, 0), parts: [
    { g: cyl(6), m: M(0, -0.42, 0, 0, 0.085, 0.84, 0.095), c: o.pants },
    { g: BOX, m: M(0, -0.87, 0.04, 0, 0.13, 0.1, 0.27), c: COL.shoe },
  ] });
  const arm = (s: number) => ({ limb: (s < 0 ? 'armL' : 'armR') as Limb, pivot: new THREE.Vector3(s * 0.23, 1.43, 0), parts: [
    { g: cyl(6), m: M(0, -0.28, 0, 0, 0.06, 0.56, 0.06), c: o.vest ? o.shirt : o.shirt },
    { g: BALL, m: M(0, -0.6, 0.01, 0, 0.055, 0.065, 0.05), c: o.skin, smooth: true },
  ] });
  const body: { g: THREE.BufferGeometry; m: THREE.Matrix4; c: string; smooth?: boolean }[] = [
    { g: taper(1.15, 8), m: M(0, 1.2, 0, 0, 0.17, 0.58, 0.12), c: o.shirt },
    { g: cyl(8), m: M(0, 0.95, 0, 0, 0.165, 0.1, 0.115), c: COL.woodDark },
    { g: cyl(6), m: M(0, 1.53, 0, 0, 0.05, 0.08, 0.05), c: o.skin },
    { g: HEAD, m: M(0, 1.66, 0.005, 0, 0.105, 0.125, 0.11), c: o.skin, smooth: true },
    { g: BALL, m: M(0, 1.7, -0.02, 0, 0.11, 0.11, 0.11), c: o.hair, smooth: true },
    { g: BOX, m: M(0, 1.655, 0.1, 0, 0.03, 0.04, 0.03), c: o.skin },
  ];
  if (o.vest) body.push({ g: taper(1.12, 8), m: M(0, 1.22, 0, 0, 0.18, 0.46, 0.13), c: o.vest });
  if (o.skirt) body.push({ g: taper(0.6, 8), m: M(0, 0.68, 0, 0, 0.28, 0.6, 0.24), c: o.pants });
  if (o.hat) body.push({ g: cyl(10), m: M(0, 1.77, 0, 0, 0.2, 0.025, 0.2), c: o.hat }, { g: taper(0.9, 8), m: M(0, 1.83, 0, 0, 0.11, 0.11, 0.11), c: o.hat });
  if (o.pack) body.push({ g: BOX, m: M(0, 1.2, -0.17, 0, 0.3, 0.4, 0.16), c: '#7a5a3a' }, { g: BOX, m: M(0, 1.42, -0.17, 0, 0.32, 0.06, 0.18), c: COL.woodDark });
  return [{ limb: 'body', pivot: new THREE.Vector3(), parts: body }, leg(-1), leg(1), arm(-1), arm(1)];
}
/** Passante fermo, fuso nel mondo statico. pose: braccia (rad) per variare le sagome. */
export function person(ctx: Ctx, x: number, y: number, z: number, ry: number, o: Look, armL = 0.1, armR = -0.1) {
  const P = M(x, y, z, ry);
  for (const l of personParts(o)) {
    const rot = l.limb === 'armL' ? armL : l.limb === 'armR' ? armR : 0;
    const L = P.clone().multiply(M(l.pivot.x, l.pivot.y, l.pivot.z, 0, 1, 1, 1, rot));
    for (const p of l.parts) ctx.b.add(p.g, L.clone().multiply(p.m), p.c, PAT.PLASTER, { smooth: p.smooth, grad: 0.1, jitter: 0.03 });
  }
  ctx.obst.push({ x, z, r: 0.35 });
}

export function fence(ctx: Ctx, pts: [number, number][], y: number) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!, len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax), n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) box(ctx.b, new THREE.Matrix4(), ax + ((bx - ax) * k) / n, y, az + ((bz - az) * k) / n, 0.14, 1.0, 0.14, COL.woodGrey, PAT.PLANKS);
    for (const h of [0.45, 0.85]) box(ctx.b, M((ax + bx) / 2, y + h, (az + bz) / 2, -ang), 0, 0, 0, len, 0.09, 0.06, COL.woodGrey, PAT.PLANKS);
  }
}
export function garden(ctx: Ctx, x: number, y: number, z: number, ry: number, rows = 4) {
  const P = M(x, y, z, ry), r = rng(Math.round(x * 7));
  box(ctx.b, P, 0, 0, 0, 5, 0.18, rows * 1.0 + 0.3, COL.soil, PAT.BRUSH, { grad: 0 });
  for (let j = 0; j < rows; j++) for (let i = 0; i < 7; i++) {
    const kind = j % 3, px = -2.1 + i * 0.7, pz = -rows / 2 + 0.6 + j;
    if (kind === 2 && i % 2 === 0) ctx.b.add(BALL, P.clone().multiply(M(px, 0.32, pz, 0, 0.24, 0.18, 0.24)), '#d9822b', PAT.BRUSH, { smooth: true });
    else ctx.b.add(BLOB, P.clone().multiply(M(px, 0.3, pz, r() * 3, 0.24, 0.2 + r() * 0.1, 0.24)), kind ? COL.leafLight : COL.grassLight, PAT.GRASS, { smooth: true, grad: 0.4 });
  }
}

/** Mulino: torre in muratura chiara, tetto conico. Le pale (dinamiche) le aggiunge chi chiama con windmillBlades. */
export function windmill(ctx: Ctx, x: number, y: number, z: number, ry: number) {
  const P = M(x, y, z, ry);
  cylinder(ctx.b, P, 0, 0, 0, 1.9, 6.2, COL.white, 8, PAT.PLASTER, { grad: 0.3 }, 0.72);
  cylinder(ctx.b, P, 0, 0, 0, 2.0, 0.8, COL.stoneGrey, 8, PAT.BRICK, {}, 0.97);
  ctx.b.add(taper(0.02, 8), P.clone().multiply(M(0, 7.2, 0, 0, 1.75, 2.0, 1.75)), COL.roofBlue, PAT.ROOF, { grad: 0.2 });
  box(ctx.b, P, 0, 0.8, 1.45, 1.0, 1.9, 0.3, COL.woodDark, PAT.PLANKS);
  box(ctx.e, P, 0, 3.8, 1.25, 0.6, 0.8, 0.3, new THREE.Color(COL.window).multiplyScalar(1.1), PAT.BRUSH, { grad: 0.3 });
  box(ctx.b, P, 0, 5.6, 1.15, 0.45, 0.45, 0.6, COL.woodDark);
  ctx.obst.push({ x, z, r: 2.2 });
}
export function windmillBlades(b: Builder) {
  const I = new THREE.Matrix4();
  b.add(cyl(6), M(0, 0, 0, 0, 0.18, 0.5, 0.18, Math.PI / 2), COL.woodDark, PAT.PLANKS);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, R = new THREE.Matrix4().makeRotationZ(a);
    box(b, I.clone().multiply(R), 0, 0.2, 0.25, 0.14, 4.4, 0.08, COL.woodDark, PAT.PLANKS);
    box(b, I.clone().multiply(R), 0.42, 1.0, 0.28, 0.7, 3.4, 0.04, COL.cream, PAT.PLASTER, { grad: -0.1 });
  }
}

/** Faro a fasce bianche e rosse con lanterna accesa. */
export function lighthouse(ctx: Ctx, x: number, y: number, z: number) {
  const P = M(x, y, z), h = 9, n = 5;
  cylinder(ctx.b, P, 0, 0, 0, 2.2, 0.9, COL.stoneGrey, 10, PAT.BRICK, { grad: 0.3 }, 0.95);
  for (let i = 0; i < n; i++) { const r0 = 1.7 - (i / n) * 0.55; cylinder(ctx.b, P, 0, 0.9 + (i * h) / n, 0, r0, h / n, i % 2 ? COL.red : COL.white, 10, PAT.PLASTER, { grad: 0.15 }, (r0 - 0.55 / n) / r0); }
  cylinder(ctx.b, P, 0, h + 0.9, 0, 1.6, 0.25, COL.woodDark, 10);
  cylinder(ctx.e, P, 0, h + 1.15, 0, 0.8, 1.2, new THREE.Color('#ffc86a').multiplyScalar(1.5), 8, PAT.BRUSH, { grad: 0, jitter: 0 });
  ctx.b.add(taper(0.05, 10), P.clone().multiply(M(0, h + 2.75, 0, 0, 1.2, 0.95, 1.2)), COL.red, PAT.ROOF);
  ctx.glows.push({ x, y: y + h + 1.75, z, size: 14, color: new THREE.Color('#ffcc77') });
  ctx.obst.push({ x, z, r: 2.4 });
}

/** Portale del traghetto all'inizio del molo: due pali alti, trave, insegna, lanterne appese. */
export function ferryGate(ctx: Ctx, x: number, y: number, z: number, ry: number, span = 4.4) {
  const P = M(x, y, z, ry);
  for (const s of [-1, 1]) { box(ctx.b, P, 0, 0, s * span / 2, 0.32, 4.6, 0.32, COL.woodDark, PAT.PLANKS, { grad: 0.3 }); lanternHead(ctx, P, 0.35, 3.3, s * span / 2, 0.8); }
  box(ctx.b, P, 0, 4.3, 0, 0.36, 0.34, span + 1.2, COL.woodDark, PAT.PLANKS);
  box(ctx.b, P, 0, 3.55, 0, 0.12, 0.7, 2.2, COL.wood, PAT.PLANKS);
  box(ctx.b, P, 0.07, 3.68, 0, 0.04, 0.42, 1.7, COL.cream, PAT.PLASTER);
  box(ctx.b, P, 0.1, 3.75, 0, 0.03, 0.3, 0.3, COL.clothBlue);
}
