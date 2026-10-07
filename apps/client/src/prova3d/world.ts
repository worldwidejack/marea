// Il mondo della prova: il Porto, l'isola di Maru (casa, orto, mulino), l'isola di Solara (faro), isole lontane nella foschia.
import * as THREE from 'three';
import { Builder, M, PAT, paintedMaterial, rng } from './paint.ts';
import { BLOB, BLOB_LO, BUD, COL, ROCK, banner, barrel, box, bunting, crate, fountain, house, lanternPost, planter, sack, stall } from './kit.ts';
import type { Ctx, Glow, Obstacle, Placement } from './kit.ts';
import { boat, bush, dock, fence, ferryGate, garden, lighthouse, person, rock, tree, windmill, windmillBlades } from './kit2.ts';
import type { Look } from './kit2.ts';
import { blob, buildIsland, distanceField, pointInPoly } from './terrain.ts';
import type { DistField, Pt } from './terrain.ts';

export type Walk = { x0: number; z0: number; x1: number; z1: number; y0: number; y1: number; axis: 'x' | 'z' };
export type Mooring = { name: string; x: number; z: number; ry: number; landX: number; landZ: number };
export type World = {
  group: THREE.Group; glows: Glow[]; placements: Placement[]; obst: Obstacle[]; df: DistField; moorings: Mooring[];
  /** Quota calpestabile in (x,z), null se lì non si cammina (mare, fuori dal bordo). */
  groundAt(x: number, z: number): number | null;
  blocked(x: number, z: number, r: number): boolean;
  update(t: number): void;
};

const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
const LOOKS: Look[] = [
  { shirt: COL.cream, pants: '#4a5a78', skin: COL.skin, hair: COL.hair, vest: '#7a4a2e' },
  { shirt: '#b8574a', pants: '#e8dcc0', skin: COL.skin2, hair: COL.hair, skirt: true, hat: '#d9b56a' },
  { shirt: '#3f6f96', pants: '#5a4636', skin: COL.skin, hair: COL.hair2 },
  { shirt: COL.white, pants: '#2f4a6a', skin: COL.skin2, hair: COL.hair, hat: '#d9b56a' },
  { shirt: '#6f8a4a', pants: '#e9dcc4', skin: COL.skin, hair: '#c9a060', skirt: true },
  { shirt: '#d4a23c', pants: '#4a3a2e', skin: COL.skin, hair: COL.hair2, vest: '#3f4f6a' },
];

/** opts.ai: posto per l'isola generata con l'AI (prova di coerenza), entra nel campo di distanza del mare. */
export const AI_ISLAND = { x: -50, z: -52, r: 16 };
export function buildWorld(opts: { ai?: boolean } = {}): World {
  const placements: Placement[] = [];
  const group = new THREE.Group(), glows: Glow[] = [], obst: Obstacle[] = [], walks: Walk[] = [], tops: { poly: Pt[]; y: number }[] = [], seaShapes: Pt[][] = [], rocks: { x: number; z: number; r: number }[] = [];
  const mat = paintedMaterial(), emis = new THREE.MeshBasicMaterial({ vertexColors: true });
  const chunk = (name: string, fill: (c: Ctx) => void, shadows = true) => {
    const c: Ctx = { b: new Builder(name.length * 97), e: new Builder(7), glows, obst, ...(opts.ai ? { ai: placements } : {}) };
    const n0 = placements.length;
    fill(c);
    for (let i = n0; i < placements.length; i++) placements[i]!.chunk = name;
    const g = c.b.geometry(), ge = c.e.geometry();
    if (g) { const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = shadows; m.receiveShadow = true; group.add(m); }
    if (ge) { const m = new THREE.Mesh(ge, emis); m.name = name + '-luci'; group.add(m); }
  };
  const island = (c: Ctx, cx: number, cz: number, rx: number, rz: number, topY: number, seed: number) => {
    const top = blob(cx, cz, rx, rz, seed);
    const isl = buildIsland(c.b, top, cx, cz, topY, seed);
    tops.push({ poly: top.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz); return [x - ((x - cx) / l) * 0.7, z - ((z - cz) / l) * 0.7] as Pt; }), y: topY });
    seaShapes.push(isl.sea);
    return isl;
  };
  /** Cespi d'erba e fiori sparsi sull'isola (lontano da piazza, edifici e bordo): rompono l'erba piatta, ~20 triangoli l'uno. */
  const tufts = (c: Ctx, top: Pt[], cx: number, cz: number, y: number, n: number, seed: number, avoid: (x: number, z: number) => boolean = () => false) => {
    const r = rng(seed), inner = top.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz); return [x - ((x - cx) / l) * 1.2, z - ((z - cz) / l) * 1.2] as Pt; });
    const xs = top.map((p) => p[0]), zs = top.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const flowers = ['#e8709a', '#f2d36a', '#b080d8', '#f4efe0', '#e06a4a'];
    for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (!pointInPoly(x, z, inner) || avoid(x, z) || obst.some((o) => ('r' in o ? Math.hypot(x - o.x, z - o.z) < o.r + 0.3 : Math.hypot(x - o.x, z - o.z) < Math.max(o.hw, o.hd) + 0.5))) continue;
      k++;
      const s = 0.25 + r() * 0.35, tone = [COL.leafDark, COL.leaf, COL.grassLight, COL.leafLight][Math.floor(r() * 4)]!;
      c.b.add(BLOB_LO, M(x, y + s * 0.25, z, r() * 6, s * 1.3, s * 0.7, s), tone, PAT.GRASS, { smooth: true, grad: 0.5, jitter: 0.1 });
      if (r() < 0.45) for (let f = 0; f < 3; f++) c.b.add(BUD, M(x + (r() - 0.5) * s * 1.6, y + s * 0.6 + r() * 0.1, z + (r() - 0.5) * s * 1.4, r() * 6, 0.07), flowers[Math.floor(r() * flowers.length)]!, PAT.BRUSH, { grad: 0 });
    }
  };
  const seaRock = (c: Ctx, x: number, z: number, s: number, seed: number) => { rock(c, x, -0.6, z, s, seed, COL.cliffDark); rocks.push({ x, z, r: s * 0.9 }); };
  /**
   * Pontile da un'isola verso il mare in direzione dir (+1/-1 sull'asse): trova il bordo vero dell'isola, scala di legno giù
   * dalla scogliera fino a quota 1,5, poi il molo lungo L e largo W. Restituisce la coordinata della testa del molo.
   */
  const pier = (c: Ctx, top: Pt[], cx: number, cz: number, axis: 'x' | 'z', dir: 1 | -1, perp: number, L: number, W: number, topY: number, seed: number, rails = true) => {
    let e = 0; const P = (t: number): [number, number] => (axis === 'x' ? [cx + dir * t, perp] : [perp, cz + dir * t]);
    while (e < 80 && pointInPoly(...P(e), top)) e += 0.1;
    const base = (axis === 'x' ? cx : cz) + dir * e, s0 = base - dir * 1.2, s1 = base + dir * 2.4, end = s1 + dir * L, n = 6;
    for (let i = 0; i < n; i++) {
      const a = s0 + ((s1 - s0) * (i + 0.5)) / n, top_ = topY - ((topY - 1.5) * (i + 0.5)) / n, d = Math.abs(s1 - s0) / n;
      if (axis === 'x') box(c.b, new THREE.Matrix4(), a, 0.3, perp, d + 0.02, top_ - 0.3, W, COL.plank, PAT.PLANKS, { grad: 0.3 });
      else box(c.b, new THREE.Matrix4(), perp, 0.3, a, W, top_ - 0.3, d + 0.02, COL.plank, PAT.PLANKS, { grad: 0.3 });
    }
    const lo = Math.min(s1, end), hi = Math.max(s1, end), h = W / 2;
    if (axis === 'x') dock(c, lo, perp - h, hi, perp + h, 1.5, 'x', { n: rails, s: rails }, seed);
    else dock(c, perp - h, lo, perp + h, hi, 1.5, 'z', { e: rails, w: rails }, seed);
    const r0 = Math.min(s0 - dir * 0.6, s1), r1 = Math.max(s0 - dir * 0.6, s1), sx = axis === 'x';
    walks.push({ x0: sx ? r0 : perp - h + 0.2, x1: sx ? r1 : perp + h - 0.2, z0: sx ? perp - h + 0.2 : r0, z1: sx ? perp + h - 0.2 : r1, y0: dir > 0 ? topY : 1.5, y1: dir > 0 ? 1.5 : topY, axis });
    walks.push({ x0: sx ? lo : perp - h + 0.2, x1: sx ? hi : perp + h - 0.2, z0: sx ? perp - h + 0.2 : lo, z1: sx ? perp + h - 0.2 : hi, y0: 1.5, y1: 1.5, axis });
    return { start: s1, end };
  };

  let T0 = 30, MARU_END = 43, SOL_END = -58;
  // ---------------- PORTO ----------------
  chunk('porto', (c) => {
    const Y = 2.2;
    const isl = island(c, -6, 1, 22, 21, Y, 11);
    // piazza in pietra e strada verso il molo
    c.b.add(new THREE.CylinderGeometry(10, 10, 0.12, 40), M(-6, Y + 0.02, 0), COL.stone, PAT.COBBLE, { grad: 0, jitter: 0.03 });
    c.b.add(new THREE.CylinderGeometry(10.6, 10.6, 0.08, 40), M(-6, Y, 0), COL.stoneGrey, PAT.BRICK, { grad: 0 });
    box(c.b, new THREE.Matrix4(), 9, Y - 0.04, 3, 15, 0.14, 4.4, COL.stone, PAT.COBBLE, { grad: 0, jitter: 0.03 });
    fountain(c, -6, Y + 0.08, 0);
    house(c, -16, Y, -13, 0.3, { w: 5.2, d: 4.2, h: 6.2, wall: COL.plaster, roof: COL.roofBlue, shutters: COL.teal, flowers: true });
    house(c, -6.5, Y, -15.5, 0, { w: 6.4, d: 4.6, h: 5.2, wall: COL.ochre, roof: COL.terracotta, shutters: COL.clothBlue, flowers: true });
    house(c, 3.5, Y, -13.5, -0.35, { w: 4.6, d: 4.2, h: 4.4, wall: COL.blush, roof: COL.roofBlue, shutters: COL.cream });
    house(c, -22, Y, -2, Math.PI / 2 - 0.1, { w: 5.4, d: 4.4, h: 5.6, wall: COL.white, roof: COL.roofSlate, shutters: COL.clothBlue, flowers: true });
    house(c, -20, Y, 9.5, Math.PI / 2 + 0.35, { w: 4.6, d: 4, h: 4.2, wall: COL.ochre, roof: COL.terracotta, shutters: COL.teal });
    stall(c, 4, Y + 0.08, -6.5, face(4, -6.5, -6, 0), COL.clothBlue, ['#e0443a', '#f0a030', '#86b33c']);
    stall(c, 9, Y + 0.08, -2, face(9, -2, -6, 0), COL.red, ['#d9cf6a', '#a8d05a', '#f08a3a']);
    stall(c, -16, Y + 0.08, 3.5, face(-16, 3.5, -6, 0), COL.teal, ['#c94a5a', '#e8c070', '#7aa84a']);
    stall(c, -12.5, Y + 0.08, -8, face(-12.5, -8, -6, 0), COL.mustard, ['#f2e6c0', '#d9a050', '#b0603a']);
    for (let i = 0; i < 9; i++) { const a = -0.5 + i * 0.72; if (Math.abs(a - 0.3) < 0.3) continue; lanternPost(c, -6 + Math.cos(a) * 10.8, Y, Math.sin(a) * 10.8, 2.8, -a); }
    for (const [x, z] of [[-9, 4], [-2.5, -3.5], [-3, 4.2]] as const) planter(c, x, Y + 0.08, z, ['#e8709a', '#f2d36a', '#b080d8']);
    tree(c, -25, Y, -12, 1.1, 1); tree(c, 11.5, Y, -11, 1.0, 2); tree(c, -17, Y, 16, 1.2, 3); tree(c, 7, Y, 12, 1.05, 5); tree(c, -27, Y, 4, 0.95, 6);
    bush(c, -12, Y, 13, 1, '#e8709a'); bush(c, 2, Y, 13.5, 0.9, '#f2d36a'); bush(c, -24, Y, -7, 1, '#b080d8'); bush(c, 12.5, Y, -6, 0.9, '#e8709a'); bush(c, 13, Y, 8, 1);
    // muretto in pietra sul bordo della scogliera (lato mare, a sud e a est), con varchi per la scala del molo
    const tp = isl.top;
    for (let i = 0; i < tp.length; i++) {
      const [ax, az] = tp[i]!, [bx, bz] = tp[(i + 1) % tp.length]!, mx = (ax + bx) / 2, mz = (az + bz) / 2, a = Math.atan2(mz - 1, mx + 6);
      if (a < -0.5 || a > 2.6 || (Math.abs(mz - 3) < 3.2 && mx > 5)) continue;
      const ix = mx - ((mx + 6) / Math.hypot(mx + 6, mz - 1)) * 0.45, iz = mz - ((mz - 1) / Math.hypot(mx + 6, mz - 1)) * 0.45;
      box(c.b, M(ix, Y, iz, -Math.atan2(bz - az, bx - ax)), 0, 0, 0, Math.hypot(bx - ax, bz - az) + 0.25, 0.75, 0.55, COL.stoneGrey, PAT.BRICK, { grad: 0.35 });
      box(c.b, M(ix, Y, iz, -Math.atan2(bz - az, bx - ax)), 0, 0.75, 0, Math.hypot(bx - ax, bz - az) + 0.3, 0.12, 0.65, COL.stone, PAT.BRICK);
      if (i % 5 === 0) lanternPost(c, ix, Y + 0.87, iz, 1.6, a + Math.PI);
    }
    // festoni tra i lampioni della piazza e sopra le bancarelle
    bunting(c, -6 + Math.cos(-0.5) * 10.8, Y + 2.7, Math.sin(-0.5) * 10.8, -6 + Math.cos(-1.94) * 10.8, Y + 2.7, Math.sin(-1.94) * 10.8);
    bunting(c, -6 + Math.cos(-1.94) * 10.8, Y + 2.7, Math.sin(-1.94) * 10.8, -6 + Math.cos(-2.66) * 10.8, Y + 2.7, Math.sin(-2.66) * 10.8);
    bunting(c, -6 + Math.cos(1.66) * 10.8, Y + 2.7, Math.sin(1.66) * 10.8, -6 + Math.cos(2.38) * 10.8, Y + 2.7, Math.sin(2.38) * 10.8);
    bunting(c, -6 + Math.cos(0.94) * 10.8, Y + 2.7, Math.sin(0.94) * 10.8, -6 + Math.cos(1.66) * 10.8, Y + 2.7, Math.sin(1.66) * 10.8);
    // merci e fiori sparsi
    for (const [x, z] of [[6.2, -8.6], [11.2, -3.8], [-17.8, 6], [-14.4, -10.2]] as const) { crate(c, x, Y + 0.08, z, 0.7, x); sack(c, x + 0.8, Y + 0.08, z + 0.3); barrel(c, x - 0.6, Y + 0.08, z + 0.9, 0.8); }
    for (const [x, z, f] of [[-12.5, -11, '#e8709a'], [-3, -12.6, '#f2d36a'], [1.5, -11, '#b080d8'], [-19.5, -5, '#e8709a'], [-18.5, 6.8, '#f2d36a'], [-13, -15.5, '#b080d8']] as const) bush(c, x, Y, z, 0.7, f);
    // primo piano (sud): siepi fiorite lungo la piazza, alberelli, panchine
    for (let i = 0; i < 7; i++) { const a = 1.05 + i * 0.2; bush(c, -6 + Math.cos(a) * 12.2, Y, Math.sin(a) * 12.2, 0.75, ['#e8709a', '#f2d36a', '#b080d8'][i % 3]); }
    tree(c, -12, Y, 17.5, 0.85, 17); tree(c, 3.5, Y, 16, 0.8, 18);
    for (const [x, z, ry] of [[-1.5, 11.6, 0.3], [-10.5, 11.2, -0.4]] as const) { box(c.b, M(x, Y, z, ry), 0, 0.4, 0, 1.8, 0.1, 0.5, COL.plank, PAT.PLANKS); box(c.b, M(x, Y, z, ry), -0.75, 0, 0, 0.12, 0.4, 0.45, COL.woodDark); box(c.b, M(x, Y, z, ry), 0.75, 0, 0, 0.12, 0.4, 0.45, COL.woodDark); }
    house(c, 0.8, Y, -18.2, -0.15, { w: 3.6, d: 3.4, h: 8.6, wall: COL.stone, roof: COL.roofSlate, shutters: COL.clothBlue, floors: 3 });
    tree(c, -11, Y, -19, 1.25, 15); tree(c, 8, Y, -16, 1.1, 16);
    // molo: scala dalla scogliera, portale, molo lungo, testata a T
    const pp = pier(c, isl.top, -6, 1, 'x', 1, 3, 12, 4, Y, 3);
    T0 = pp.end;
    ferryGate(c, pp.start + 0.4, 1.5, 3, 0);
    barrel(c, pp.start - 4.5, Y, 0.2); barrel(c, pp.start - 3.8, Y, -0.6, 0.9); crate(c, pp.start - 4.4, Y, 6.2, 0.8, 0.3); crate(c, pp.start - 3.6, Y, 5.6, 0.7, -0.2);
    banner(c, pp.start - 6, Y, 0.6, 0); banner(c, pp.start - 6, Y, 5.4, 0);
    dock(c, T0, -5, T0 + 6, 11, 1.5, 'z', { n: true, s: true, e: true, w: true }, 4);
    walks.push({ x0: T0 - 0.3, z0: -4.8, x1: T0 + 5.8, z1: 10.8, y0: 1.5, y1: 1.5, axis: 'z' }); // si sovrappone al molo lungo: niente fessure
    barrel(c, T0 + 1, 1.5, -3.8); barrel(c, T0 + 1.8, 1.5, -4.1, 0.85); crate(c, T0 + 4.8, 1.5, 9.8, 0.8, 0.4); crate(c, T0 + 4.6, 1.5, -3.9, 0.7);
    banner(c, T0 + 0.3, 1.5, -4.7, Math.PI / 2, 4); banner(c, T0 + 0.3, 1.5, 10.7, Math.PI / 2, 4);
    boat(c.b, M(T0 - 6, -0.15, -0.9, 0.05), { L: 4 }); boat(c.b, M(T0 - 3, -0.15, 7, Math.PI + 0.1), { L: 3.6, hull: '#7a8a9a' }); boat(c.b, M(T0 - 1.5, -0.15, -6.5, 0.4), { L: 3.8, hull: '#9a5a3a' });
    seaRock(c, 22, 10, 1.6, 21); seaRock(c, 24.5, 11.5, 1.0, 22); seaRock(c, 40, -8, 1.8, 23); seaRock(c, 15, 16, 1.4, 24); seaRock(c, 20, -9, 1.2, 25);
    // gente del porto
    person(c, -1.5, Y + 0.08, -5.5, face(-1.5, -5.5, 4, -6.5), LOOKS[0]!, 0.3, -0.2);
    person(c, 1.8, Y + 0.08, -3.2, face(1.8, -3.2, 4, -6.5), LOOKS[1]!, -0.1, 0.4);
    person(c, 7.2, Y + 0.08, 1.2, face(7.2, 1.2, 9, -2), LOOKS[2]!, 0.1, -0.5);
    person(c, -10.2, Y + 0.08, 2.5, face(-10.2, 2.5, -16, 3.5), LOOKS[3]!);
    person(c, -9.6, Y + 0.08, -6.2, 2.2, LOOKS[4]!, 0.2, -0.3);
    person(c, -8.8, Y + 0.08, -7.4, -1.0, LOOKS[5]!, -0.4, 0.2);
    person(c, -2.5, Y + 0.08, 6.8, 2.6, LOOKS[2]!);
    person(c, -13.8, Y + 0.08, 0.6, 1.2, LOOKS[0]!, 0.3, 0.3); person(c, -0.8, Y + 0.08, 2.8, -2.2, LOOKS[4]!, -0.2, 0.1);
    person(c, 2.6, Y + 0.08, -9.6, 0.4, LOOKS[5]!); person(c, -7.5, Y + 0.08, 5.6, 0.3, LOOKS[1]!, 0.2, -0.6); person(c, -6.6, Y + 0.08, 5.4, -2.6, LOOKS[3]!, -0.5, 0.2);
    person(c, 7.5, Y + 0.08, 4.2, -1.6, LOOKS[0]!); person(c, -11.6, Y + 0.08, -4.2, 1.9, LOOKS[2]!, 0.1, 0.5);
    person(c, T0 + 2.5, 1.5, 6.5, -1.4, LOOKS[3]!, -0.6, 0.1);
    person(c, T0 - 8, 1.5, 4.1, 3.0, LOOKS[5]!, 0.15, -0.15);
  });

  // ---------------- ISOLA DI MARU: casa, orto, mulino ----------------
  let blades: THREE.Mesh | null = null;
  chunk('maru', (c) => {
    const Y = 3.0;
    const isl = island(c, 68, -40, 17, 14, Y, 31);
    house(c, 72, Y, -46, -0.5, { w: 6, d: 4.6, h: 4.6, wall: COL.plaster, roof: COL.roofBlue, shutters: COL.clothBlue, flowers: true });
    windmill(c, 59.5, Y, -47, 0.35);
    garden(c, 72, Y + 0.02, -35, -0.2, 4);
    fence(c, [[68.5, -32], [68.5, -38.5], [75.5, -39.5], [75.5, -32.5]], Y);
    tree(c, 80, Y, -40, 1.1, 7); tree(c, 64, Y, -31, 0.9, 8); tree(c, 77, Y, -48, 1.0, 9); bush(c, 62, Y, -38, 1, '#f2d36a'); bush(c, 79, Y, -33, 0.8, '#e8709a');
    lanternPost(c, 56.5, Y, -36.5, 2.6, 0); lanternPost(c, 66, Y, -42, 2.6, 0.6);
    person(c, 70, Y, -40.5, 2.6, LOOKS[1]!, 0.5, -0.3);
    tufts(c, isl.top, 68, -40, Y, 110, 34, (x, z) => x > 67.5 && x < 76.5 && z > -40 && z < -31.5);
    const pm = pier(c, isl.top, 68, -40, 'x', -1, -34.7, 8, 3.4, Y, 5);
    MARU_END = pm.end;
    boat(c.b, M(MARU_END + 3, -0.15, -37.6, 0.1), { L: 3.6, hull: '#7a8a9a' });
    seaRock(c, 84, -30, 2.0, 32); seaRock(c, 52, -52, 1.5, 33);
    const bb = new Builder(5); windmillBlades(bb);
    blades = new THREE.Mesh(bb.geometry()!, mat); blades.castShadow = true;
    blades.position.copy(new THREE.Vector3(0, 5.6, 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35).add(new THREE.Vector3(59.5, Y, -47)));
    blades.rotation.y = 0.35;
    group.add(blades);
  });

  // ---------------- ISOLA DI SOLARA: faro ----------------
  chunk('solara', (c) => {
    const Y = 3.4;
    const isl = island(c, 18, -80, 13, 11, Y, 41);
    lighthouse(c, 22, Y, -84);
    house(c, 12.5, Y, -80, 0.5, { w: 4.4, d: 4, h: 3.8, wall: COL.white, roof: COL.terracotta, shutters: COL.teal });
    tree(c, 9, Y, -86, 1, 11); tree(c, 26, Y, -76, 0.85, 12); bush(c, 15, Y, -74, 1, '#b080d8'); rock(c, 25, Y, -89, 1.2, 13);
    lanternPost(c, 15, Y, -73.5, 2.6, 0);
    tufts(c, isl.top, 18, -80, Y, 60, 44);
    const ps = pier(c, isl.top, 18, -80, 'z', 1, 17.7, 8, 3.4, Y, 6);
    SOL_END = ps.end;
    seaRock(c, 32, -70, 1.8, 42); seaRock(c, 4, -73, 1.3, 43); seaRock(c, 6, -90, 2.2, 44);
  });

  // ---------------- isole lontane (foschia) ----------------
  chunk('lontane', (c) => {
    const far: [number, number, number, number, number][] = [[-120, -190, 30, 16, 26], [-30, -240, 40, 22, 38], [95, -215, 34, 18, 22], [175, -140, 26, 14, 30], [215, -30, 30, 18, 18], [-200, -80, 34, 18, 24], [-150, 60, 28, 16, 16], [160, 90, 30, 16, 14]];
    far.forEach(([x, z, rx, rz, h], i) => {
      const top = blob(x, z, rx, rz, 70 + i, 24, 0.18), r = rng(90 + i);
      buildIsland(c.b, top, x, z, 3, 70 + i);
      // picchi di roccia con la cima verde: sagome da faraglioni nella foschia
      const n = 2 + (i % 3);
      for (let k = 0; k < n; k++) {
        const px = x + (r() - 0.5) * rx * 0.9, pz = z + (r() - 0.5) * rz * 0.7, ph = h * (0.6 + r() * 0.7), pr = Math.min(rx, rz) * (0.35 + r() * 0.25);
        c.b.add(ROCK, M(px, ph * 0.45, pz, r() * 6, pr, ph * 0.55, pr * 0.9), COL.cliff, PAT.ROCK, { grad: 0.5, jitter: 0.1 });
        c.b.add(BLOB, M(px, ph * 0.92, pz, r() * 6, pr * 0.8, pr * 0.32, pr * 0.75), COL.leaf, PAT.GRASS, { smooth: true, grad: 0.3 });
      }
      for (let k = 0; k < 3; k++) tree(c, x + (k - 1) * rx * 0.4, 3, z + rz * 0.35, 1.8, 80 + i * 4 + k, true);
    });
    lighthouse(c, -42, 3, -222);
  }, false);

  // campo di distanza dalla riva (mare: profondità, schiuma; barca: collisioni)
  const df = distanceField(seaShapes, opts.ai ? [...rocks, AI_ISLAND] : rocks, -130, 260);

  const moorings: Mooring[] = [
    { name: 'Porto', x: T0 + 8.4, z: 3, ry: Math.PI / 2, landX: T0 + 5.2, landZ: 3 },
    { name: 'Maru', x: MARU_END - 2.4, z: -34.7, ry: Math.PI, landX: MARU_END + 0.6, landZ: -34.7 },
    { name: 'Solara', x: 17.7, z: SOL_END + 2.4, ry: Math.PI / 2, landX: 17.7, landZ: SOL_END - 0.8 },
  ];

  const inRect = (w: Walk, x: number, z: number) => x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1;
  return {
    group, glows, placements, obst, df, moorings,
    groundAt(x, z) {
      for (const w of walks) if (inRect(w, x, z)) { const t = w.axis === 'x' ? (x - w.x0) / (w.x1 - w.x0) : (z - w.z0) / (w.z1 - w.z0); return w.y0 + (w.y1 - w.y0) * t; }
      for (const t of tops) if (pointInPoly(x, z, t.poly)) return t.y;
      return null;
    },
    blocked(x, z, r) {
      for (const o of obst) {
        if ('r' in o) { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true; continue; }
        const c = Math.cos(-o.rot), s = Math.sin(-o.rot), dx = x - o.x, dz = z - o.z, lx = dx * c + dz * s, lz = -dx * s + dz * c;
        if (Math.abs(lx) < o.hw + r && Math.abs(lz) < o.hd + r) return true;
      }
      return false;
    },
    update(t) { if (blades) blades.rotation.z = t * 0.6; },
  };
}
