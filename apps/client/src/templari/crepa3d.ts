// Il muro crepato della cripta (docs/TEMPLARI.md §9c) come si vede dall'alto: la crepa grossa sulla faccia verso la chiesa (larga due
// pixel, alta quanto il muro), che continua sulla cima del muro e sul pavimento davanti; schegge chiare, sassi e polvere ai piedi.
// Pixel da 6-8 cm (più piccoli a 640×360 si impastano). Tutto in pezzi per una mesh sola (segreti3d.ts): una draw call.
// Coordinate locali: la faccia del muro sta a z = 0, +z = verso la chiesa, x = lungo il muro, il muro è alto `h`.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import type { Pezzo } from './armi3d.ts';

type Linea = [number, number][];
/** Una linea spezzata di pixel su una griglia (x, y interi), larga `w` pixel. */
function pixel(linee: Linea[], w: number): Set<string> {
  const pix = new Set<string>();
  for (const pts of linee) for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!, n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) { const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n); for (let d = 0; d < w; d++) pix.add(`${x + d},${y}`); }
  }
  return pix;
}
const lista = (s: Set<string>) => [...s].map((k) => k.split(',').map(Number) as [number, number]);

export function pezziCrepa(h: number): Pezzo[] {
  const out: Pezzo[] = [];
  const box = (w: number, hh: number, d: number) => new THREE.BoxGeometry(w, hh, d);
  // faccia: 16 pixel di largo, alta quanto il muro (y = 0 in cima); il tronco sale da terra fin quasi in cima e si ramifica
  const P = 0.98 / 16, N = Math.max(24, Math.round(h / P)), y = (v: number) => Math.round((v / 32) * (N - 1));
  const faccia = pixel([
    [[7, y(32)], [8, y(26)], [6, y(22)], [7, y(17)], [5, y(12)], [7, y(7)], [6, 0]],
    [[8, y(26)], [11, y(23)], [13, y(19)]], [[6, y(22)], [3, y(20)], [1, y(16)]], [[7, y(17)], [10, y(14)], [11, y(10)]], [[5, y(12)], [3, y(9)]],
  ], 2);
  for (const [x, yy] of lista(faccia)) out.push({ g: box(P, P, 0.014), c: PAL.neroCaldo, x: (x - 7.5) * P, y: h - (yy + 0.5) * P, z: 0.007 });
  for (const [x, yy] of [[10, y(25)], [4, y(21)], [9, y(16)], [3, y(13)], [12, y(20)], [8, y(5)]] as const) out.push({ g: box(P, P, 0.016), c: PAL.pietraChiara, x: (x - 7.5) * P, y: h - (yy + 0.5) * P, z: 0.008 });
  // cima: la crepa attraversa il muro dalla faccia al retro, con un ramo; uno spigolo davanti è saltato via (un buco scuro)
  const Q = 0.98 / 12;
  const cima = pixel([[[6, 0], [5, 3], [7, 6], [6, 9], [7, 11]], [[5, 3], [2, 5], [1, 8]], [[7, 6], [10, 7]]], 2);
  for (const [x, z] of lista(cima)) if (x < 12) out.push({ g: box(Q, 0.014, Q), c: PAL.neroCaldo, x: (x - 5.5) * Q, y: h + 0.007, z: -(z + 0.5) * Q });
  out.push({ g: box(0.24, 0.16, 0.2), c: PAL.neroCaldo, x: 0.33, y: h - 0.07, z: -0.09 });
  // pavimento davanti: la crepa scende dal muro e si apre sulle lastre
  const R = 0.08;
  const terra = pixel([[[0, 0], [1, 4], [-1, 8], [0, 12], [-2, 16]], [[1, 4], [4, 6], [5, 10]], [[-1, 8], [-4, 10]]], 2);
  for (const [x, z] of lista(terra)) out.push({ g: box(R, 0.012, R), c: PAL.neroCaldo, x: x * R, y: 0.006, z: (z + 0.5) * R });
  // macerie e polvere ai piedi: sassi di varie misure, un velo di polvere chiara
  const sassi: [number, number, number, string][] = [[0.25, 0.21, 0.12, PAL.pietra], [-0.2, 0.29, 0.08, PAL.pietraScura], [0.05, 0.42, 0.07, PAL.pietraChiara],
    [-0.38, 0.16, 0.1, PAL.pietra], [0.42, 0.5, 0.06, PAL.roccia], [-0.05, 0.12, 0.09, PAL.pietraScura], [0.18, 0.68, 0.05, PAL.pietra]];
  sassi.forEach(([x, z, r, c], k) => out.push({ g: new THREE.DodecahedronGeometry(r, 0), c, x, y: r * 0.6, z, rx: k, ry: k * 1.3 }));
  for (const [x, z, w, d] of [[0, 0.2, 0.7, 0.28], [0.15, 0.45, 0.4, 0.2], [-0.3, 0.35, 0.3, 0.16]] as const) out.push({ g: box(w, 0.01, d), c: PAL.pietraChiara, x, y: 0.004, z });
  return out;
}
