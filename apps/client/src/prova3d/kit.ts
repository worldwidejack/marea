// Kit di oggetti del 3D dipinto, costruiti da codice. Ogni funzione aggiunge pezzi a un Ctx (mondo statico, luci, ostacoli).
// Per aggiungere un oggetto coerente: comporre box/cilindri/sfere con i colori di COL e un motivo di PAT, mai colori inventati.
import * as THREE from 'three';
import { Builder, M, PAT } from './paint.ts';
import type { PartOpts } from './paint.ts';

/** Palette del 3D dipinto (sRGB). Unica fonte dei colori del kit. */
export const COL = {
  plaster: '#ecd9b6', ochre: '#dcae72', blush: '#e3bba3', white: '#f0e8d8',
  roofBlue: '#41639c', roofSlate: '#556482', terracotta: '#b9603f',
  woodDark: '#5b3b25', wood: '#8c5c35', plank: '#ad7a45', woodGrey: '#8a7666',
  stone: '#cbb99c', stoneGrey: '#a49a8c', cliff: '#9c8672', cliffDark: '#6e5d55',
  grass: '#5f8d36', grassLight: '#7fa443', leaf: '#47772f', leafLight: '#6f9c3a', leafDark: '#33592a', soil: '#7a5638',
  clothBlue: '#2f63a6', cream: '#f1e3c2', red: '#b84c3c', mustard: '#d4a23c', teal: '#2f8a86',
  skin: '#d9a07a', skin2: '#a8704e', hair: '#3a2a20', hair2: '#8a5a30', shoe: '#3a2a22',
  glow: '#ff9a3c', window: '#ffaa50', water: '#79d4cc',
} as const;

export type Glow = { x: number; y: number; z: number; size: number; color: THREE.Color };
export type Obstacle = { x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number };
export type Ctx = { b: Builder; e: Builder; glows: Glow[]; obst: Obstacle[] };

export const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL: Record<number, THREE.CylinderGeometry> = {};
export const cyl = (seg: number) => (CYL[seg] ??= new THREE.CylinderGeometry(1, 1, 1, seg, 1));
const TAPER: Record<string, THREE.CylinderGeometry> = {};
export const taper = (top: number, seg: number) => (TAPER[`${top}|${seg}`] ??= new THREE.CylinderGeometry(top, 1, 1, seg, 1));
export const BLOB = new THREE.IcosahedronGeometry(1, 1);
export const ROCK = new THREE.DodecahedronGeometry(1, 0);
export const BALL = new THREE.SphereGeometry(1, 6, 4);
/** Testa: sfera più fine (si vede da vicino). */
export const HEAD = new THREE.SphereGeometry(1, 8, 6);
/** Fiori e frutti piccoli: 8 triangoli. */
export const BUD = new THREE.OctahedronGeometry(1, 0);
export const BLOB_LO = new THREE.IcosahedronGeometry(1, 0);

/** Box con la base a quota y (coordinate locali al prop P). */
export function box(b: Builder, P: THREE.Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: THREE.ColorRepresentation, pat: number = PAT.BRUSH, o?: PartOpts, ry = 0, rx = 0, rz = 0) {
  b.add(BOX, P.clone().multiply(M(x, y + sy / 2, z, ry, sx, sy, sz, rx, rz)), c, pat, o);
}
/** Cilindro (raggio r, altezza h) con la base a quota y. */
export function cylinder(b: Builder, P: THREE.Matrix4, x: number, y: number, z: number, r: number, h: number, c: THREE.ColorRepresentation, seg = 8, pat: number = PAT.BRUSH, o?: PartOpts, topRatio = 1) {
  b.add(topRatio === 1 ? cyl(seg) : taper(topRatio, seg), P.clone().multiply(M(x, y + h / 2, z, 0, r, h, r)), c, pat, o);
}
const glowAt = (ctx: Ctx, P: THREE.Matrix4, x: number, y: number, z: number, size: number, c: THREE.ColorRepresentation = COL.glow) => {
  const v = new THREE.Vector3(x, y, z).applyMatrix4(P);
  ctx.glows.push({ x: v.x, y: v.y, z: v.z, size, color: new THREE.Color(c) });
};
const boxObst = (ctx: Ctx, x: number, z: number, hw: number, hd: number, rot: number) => ctx.obst.push({ x, z, hw, hd, rot });

/** Tetto a capanna: colmo lungo X, gronda a y=0 (z=±d/2), colmo a y=h. */
export function gableGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
  const a = w / 2, c = d / 2, t = 0.18;
  const p = [
    -a, 0, c, a, 0, c, a, h, 0, -a, 0, c, a, h, 0, -a, h, 0, // falda sud
    a, 0, -c, -a, 0, -c, -a, h, 0, a, 0, -c, -a, h, 0, a, h, 0, // falda nord
    -a, 0, -c, -a, 0, c, -a, h, 0, a, 0, c, a, 0, -c, a, h, 0, // timpani
    -a, -t, c, a, -t, c, a, 0, c, -a, -t, c, a, 0, c, -a, 0, c, // spessore gronda sud
    a, -t, -c, -a, -t, -c, -a, 0, -c, a, -t, -c, -a, 0, -c, a, 0, -c,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g;
}

/** Lanterna (testa) a quota y: telaio scuro + vetro emissivo + alone. */
export function lanternHead(ctx: Ctx, P: THREE.Matrix4, x: number, y: number, z: number, s = 1) {
  box(ctx.b, P, x, y, z, 0.34 * s, 0.06 * s, 0.34 * s, COL.woodDark);
  box(ctx.e, P, x, y + 0.06 * s, z, 0.24 * s, 0.32 * s, 0.24 * s, new THREE.Color(COL.glow).multiplyScalar(1.35), PAT.BRUSH, { jitter: 0, grad: 0 });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(ctx.b, P, x + dx * 0.13 * s, y + 0.06 * s, z + dz * 0.13 * s, 0.05 * s, 0.32 * s, 0.05 * s, COL.woodDark);
  box(ctx.b, P, x, y + 0.38 * s, z, 0.38 * s, 0.07 * s, 0.38 * s, COL.woodDark);
  glowAt(ctx, P, x, y + 0.22 * s, z, 2.6 * s);
}
export function lanternPost(ctx: Ctx, x: number, y: number, z: number, h = 2.6, ry = 0) {
  const P = M(x, y, z, ry);
  box(ctx.b, P, 0, 0, 0, 0.32, 0.25, 0.32, COL.stoneGrey, PAT.BRICK);
  box(ctx.b, P, 0, 0.25, 0, 0.14, h - 0.25, 0.14, COL.woodDark, PAT.PLANKS);
  box(ctx.b, P, 0.25, h - 0.12, 0, 0.6, 0.1, 0.1, COL.woodDark);
  lanternHead(ctx, P, 0.48, h - 0.62, 0, 1);
  ctx.obst.push({ x, z, r: 0.3 });
}

export type HouseOpts = { w: number; d: number; h: number; wall: string; roof: string; roofH?: number; shutters?: string; floors?: number; flowers?: boolean };
/** Casa: zoccolo in pietra, muri intonacati, travi d'angolo, tetto a capanna, finestre accese con persiane. Facciata verso +Z locale. */
export function house(ctx: Ctx, x: number, y: number, z: number, ry: number, o: HouseOpts) {
  const P = M(x, y, z, ry), b = ctx.b, { w, d, h } = o, floors = o.floors ?? (h > 4.5 ? 2 : 1), rh = o.roofH ?? Math.min(w, d) * 0.45;
  box(b, P, 0, 0, 0, w + 0.2, 0.7, d + 0.2, COL.stoneGrey, PAT.BRICK, { grad: 0.35 });
  box(b, P, 0, 0.7, 0, w, h - 0.7, d, o.wall, PAT.PLASTER, { grad: 0.3, jitter: 0.05 });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(b, P, dx * w / 2, 0.7, dz * d / 2, 0.24, h - 0.7, 0.24, COL.woodDark, PAT.PLANKS);
  for (let f = 1; f < floors; f++) {
    box(b, P, 0, (h / floors) * f, d / 2 + 0.02, w + 0.1, 0.18, 0.12, COL.woodDark, PAT.PLANKS);
    box(b, P, 0, (h / floors) * f, -d / 2 - 0.02, w + 0.1, 0.18, 0.12, COL.woodDark, PAT.PLANKS);
  }
  b.add(gableGeometry(w + 0.7, d + 0.8, rh), P.clone().multiply(M(0, h, 0)), o.roof, PAT.ROOF, { grad: 0.15, jitter: 0.06 });
  box(b, P, w * 0.25, h + rh * 0.3, -d * 0.15, 0.55, rh * 0.9, 0.55, COL.stoneGrey, PAT.BRICK);
  // porta
  box(b, P, -w * 0.22, 0.7, d / 2, 1.2, 2.05, 0.16, COL.woodDark, PAT.PLANKS);
  box(b, P, -w * 0.22, 0.7, d / 2 + 0.05, 0.95, 1.85, 0.08, COL.wood, PAT.PLANKS);
  lanternHead(ctx, P, -w * 0.22 + 0.85, 2.3, d / 2 + 0.25, 0.8);
  // finestre: facciata (per piano) + lati
  const win = (wx: number, wy: number, wz: number, ry2: number) => {
    const Q = P.clone().multiply(M(wx, 0, wz, ry2));
    box(b, Q, 0, wy - 0.08, 0, 0.95, 1.15, 0.12, COL.woodDark, PAT.PLANKS);
    box(ctx.e, Q, 0, wy, 0.04, 0.7, 0.95, 0.06, new THREE.Color(COL.window).multiplyScalar(1.1), PAT.BRUSH, { jitter: 0.12, grad: 0.45 });
    box(b, Q, 0, wy + 0.42, 0.07, 0.7, 0.05, 0.04, COL.woodDark);
    box(b, Q, 0, wy, 0.07, 0.06, 0.95, 0.04, COL.woodDark);
    if (o.shutters) { box(b, Q, -0.62, wy - 0.04, 0.05, 0.36, 1.05, 0.06, o.shutters, PAT.PLANKS); box(b, Q, 0.62, wy - 0.04, 0.05, 0.36, 1.05, 0.06, o.shutters, PAT.PLANKS); }
    if (o.flowers) {
      box(b, Q, 0, wy - 0.3, 0.18, 0.95, 0.22, 0.26, COL.wood, PAT.PLANKS);
      for (let i = 0; i < 4; i++) b.add(BLOB_LO, Q.clone().multiply(M(-0.33 + i * 0.22, wy - 0.02, 0.2, i, 0.15)), i % 2 ? '#d7567a' : '#e88fb0', PAT.BRUSH, { smooth: true, jitter: 0.15 });
    }
  };
  for (let f = 0; f < floors; f++) {
    const wy = f === 0 ? 1.55 : (h / floors) * f + 0.9;
    if (f === 0) win(w * 0.22, wy, d / 2 + 0.02, 0); else { win(-w * 0.22, wy, d / 2 + 0.02, 0); win(w * 0.22, wy, d / 2 + 0.02, 0); }
    if (d > 3.2) { win(w / 2 + 0.02, wy, 0, Math.PI / 2); win(-w / 2 - 0.02, wy, 0, -Math.PI / 2); }
  }
  boxObst(ctx, x, z, w / 2 + 0.35, d / 2 + 0.35, ry);
}

/** Bancarella: 4 pali, banco con merce, tenda a strisce inclinata, lanterna appesa. Fronte verso +Z. */
export function stall(ctx: Ctx, x: number, y: number, z: number, ry: number, cloth: string, goods: string[]) {
  const P = M(x, y, z, ry), b = ctx.b, w = 3, d = 1.8;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(b, P, dx * (w / 2 - 0.1), 0, dz * (d / 2 - 0.1), 0.14, dz < 0 ? 2.7 : 2.2, 0.14, COL.wood, PAT.PLANKS);
  box(b, P, 0, 0, 0.3, w - 0.2, 0.95, 0.8, COL.wood, PAT.PLANKS, { grad: 0.35 });
  box(b, P, 0, 0.95, 0.3, w, 0.08, 0.95, COL.plank, PAT.PLANKS);
  // merce: cassette piene
  for (let i = 0; i < 4; i++) {
    const cx = -1.05 + i * 0.7;
    box(b, P, cx, 1.03, 0.35, 0.6, 0.18, 0.55, COL.plank, PAT.PLANKS);
    for (let k = 0; k < 5; k++) b.add(BUD, P.clone().multiply(M(cx - 0.18 + (k % 3) * 0.18, 1.25, 0.25 + Math.floor(k / 3) * 0.2, k, 0.12)), goods[(i + k) % goods.length]!, PAT.BRUSH, { smooth: true, jitter: 0.12 });
  }
  // tenda a strisce, scende verso il fronte
  const n = 7, sw = (w + 0.5) / n;
  for (let i = 0; i < n; i++) box(b, P, -(w + 0.5) / 2 + sw * (i + 0.5), 2.38, 0.05, sw + 0.01, 0.05, d + 0.9, i % 2 ? COL.cream : cloth, PAT.PLASTER, { jitter: 0.04, grad: 0 }, 0, -0.32);
  for (let i = 0; i < n; i++) box(b, P, -(w + 0.5) / 2 + sw * (i + 0.5), 1.93, 1.32, sw + 0.01, 0.32, 0.04, i % 2 ? cloth : COL.cream, PAT.PLASTER, { jitter: 0.04, grad: 0 });
  lanternHead(ctx, P, w / 2 - 0.35, 1.75, 1.0, 0.75);
  boxObst(ctx, x, z, w / 2 + 0.3, d / 2 + 0.4, ry);
}

export function barrel(ctx: Ctx, x: number, y: number, z: number, s = 1) {
  const P = M(x, y, z, x * 3.1);
  cylinder(ctx.b, P, 0, 0, 0, 0.36 * s, 0.9 * s, COL.wood, 10, PAT.PLANKS, { grad: 0.3 });
  cylinder(ctx.b, P, 0, 0.15 * s, 0, 0.375 * s, 0.07 * s, COL.woodDark, 10);
  cylinder(ctx.b, P, 0, 0.68 * s, 0, 0.375 * s, 0.07 * s, COL.woodDark, 10);
  ctx.obst.push({ x, z, r: 0.45 * s });
}
export function crate(ctx: Ctx, x: number, y: number, z: number, s = 0.8, ry = 0) {
  const P = M(x, y, z, ry);
  box(ctx.b, P, 0, 0, 0, s, s, s, COL.plank, PAT.PLANKS, { grad: 0.3 });
  box(ctx.b, P, 0, 0, s / 2 + 0.01, s + 0.02, 0.1, 0.02, COL.woodDark); box(ctx.b, P, 0, s - 0.1, s / 2 + 0.01, s + 0.02, 0.1, 0.02, COL.woodDark);
  ctx.obst.push({ x, z, r: s * 0.7 });
}
export function planter(ctx: Ctx, x: number, y: number, z: number, flowers: string[]) {
  const P = M(x, y, z, x);
  cylinder(ctx.b, P, 0, 0, 0, 0.45, 0.5, COL.terracotta, 8, PAT.PLASTER, { grad: 0.3 }, 1.15);
  ctx.b.add(BLOB, P.clone().multiply(M(0, 0.6, 0, 0, 0.45, 0.32, 0.45)), COL.leaf, PAT.GRASS, { smooth: true, grad: 0.4 });
  for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.b.add(BUD, P.clone().multiply(M(Math.cos(a) * 0.3, 0.75 + (i % 2) * 0.1, Math.sin(a) * 0.3, 0, 0.1)), flowers[i % flowers.length]!, PAT.BRUSH, { smooth: true }); }
  ctx.obst.push({ x, z, r: 0.55 });
}

/** Fontana a due vasche in pietra (niente di magico: acqua e basta). */
export function fountain(ctx: Ctx, x: number, y: number, z: number) {
  const P = M(x, y, z, Math.PI / 8), b = ctx.b;
  cylinder(b, P, 0, 0, 0, 2.6, 0.25, COL.stoneGrey, 8, PAT.COBBLE);
  cylinder(b, P, 0, 0.25, 0, 2.3, 0.55, COL.stone, 8, PAT.BRICK, { grad: 0.3 });
  cylinder(b, P, 0, 0.8, 0, 2.38, 0.1, COL.stoneGrey, 8, PAT.BRICK);
  cylinder(b, P, 0, 0.62, 0, 2.05, 0.08, COL.water, 16, PAT.BRUSH, { jitter: 0.02, grad: 0 });
  cylinder(b, P, 0, 0.3, 0, 0.4, 1.5, COL.stone, 8, PAT.BRICK, { grad: 0.35 }, 0.75);
  cylinder(b, P, 0, 1.8, 0, 1.05, 0.38, COL.stone, 8, PAT.BRICK, {}, 1);
  b.add(taper(1, 8), P.clone().multiply(M(0, 1.6, 0, 0, 0.45, 0.25, 0.45)), COL.stone, PAT.BRICK);
  cylinder(b, P, 0, 2.12, 0, 0.92, 0.07, COL.water, 16, PAT.BRUSH, { grad: 0 });
  cylinder(b, P, 0, 2.15, 0, 0.18, 0.7, COL.stone, 6, PAT.BRICK);
  b.add(BALL, P.clone().multiply(M(0, 2.95, 0, 0, 0.22)), COL.stone, PAT.BRICK, { smooth: true });
  ctx.obst.push({ x, z, r: 2.9 });
}

/** Stendardo appeso a un palo: tessuto blu con orlo. */
export function banner(ctx: Ctx, x: number, y: number, z: number, ry: number, h = 3.6, c: string = COL.clothBlue) {
  const P = M(x, y, z, ry);
  box(ctx.b, P, 0, 0, 0, 0.16, h, 0.16, COL.woodDark, PAT.PLANKS);
  box(ctx.b, P, 0.45, h - 0.15, 0, 1.0, 0.08, 0.08, COL.woodDark);
  box(ctx.b, P, 0.5, h - 1.75, 0, 0.75, 1.55, 0.04, c, PAT.PLASTER, { grad: 0.3 });
  box(ctx.b, P, 0.5, h - 1.82, 0, 0.75, 0.1, 0.05, COL.mustard);
  box(ctx.b, P, 0.5, h - 1.3, 0.02, 0.3, 0.6, 0.03, COL.cream, PAT.PLASTER);
  ctx.obst.push({ x, z, r: 0.25 });
}

const FLAG = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0, 0.5, 0, 0, -0.5, 0, 0, 0, -1, 0], 3)); return g; })();
/** Festone di bandierine tra due punti (con la corda che cala). */
export function bunting(ctx: Ctx, ax: number, ay: number, az: number, bx: number, by: number, bz: number, colors: string[] = [COL.clothBlue, COL.cream, COL.red, COL.mustard, COL.teal]) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(3, Math.round(len / 0.55)), ang = Math.atan2(bz - az, bx - ax), sag = Math.min(1.2, len * 0.08);
  const pt = (t: number) => [ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(Math.PI * t) * sag, az + (bz - az) * t] as const;
  for (let k = 0; k < n; k++) {
    const [x0, y0, z0] = pt(k / n), [x1, y1, z1] = pt((k + 1) / n), sl = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    ctx.b.add(cyl(3), M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, -ang, 0.02, sl, 0.02, 0, Math.PI / 2 + Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0))), COL.woodDark);
    if (k > 0) ctx.b.add(FLAG, M(x0, y0, z0, -ang, 0.32, 0.4, 1), colors[k % colors.length]!, PAT.PLASTER, { grad: 0, jitter: 0.05 });
  }
}
/** Sacco di juta. */
export function sack(ctx: Ctx, x: number, y: number, z: number, s = 1) {
  ctx.b.add(BLOB, M(x, y + 0.3 * s, z, x, 0.3 * s, 0.34 * s, 0.26 * s), '#b89a6a', PAT.PLASTER, { smooth: true, grad: 0.4 });
}
