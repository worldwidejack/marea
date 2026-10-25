// Gli indizi sull'isola (docs/TEMPLARI.md §12b punto 4): gli scheletri seduti col biglietto in mano e le scritte col sangue, a pixel
// (un font 3 × 5, qualche goccia che cola). Solo pezzi da unire (armi3d.ts `unisci`), niente mesh nuove nel coro, dove le draw call sono
// al limite: quelli della chiesa vanno nella mesh delle aste degli stendardi (arredi.ts), quelli di sotto nella mesh delle catacombe
// (catacombe3d.ts), gli altri in una mesh per zona (scena.ts). Tutte fuori dalle ombre cotte (ombre.ts `FUORI`): non fanno ombra.
import * as THREE from 'three';
import { TEMPLARI } from '@marea/content/templari.ts';
import type { Arena, Scheletro, Scritta } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import type { Pezzo } from './armi3d.ts';

/** Il font delle scritte: 5 righe da 3 pixel (bit 2 = a sinistra). */
const FONT: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  ' ': [0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4], '!': [2, 2, 2, 0, 2], '?': [6, 1, 2, 0, 2], "'": [2, 2, 0, 0, 0], '·': [0, 0, 2, 0, 0],
};
/** Pixel accesi di una scritta (x a destra, y in giù), più le gocce che colano sotto l'ultima riga e qualche schizzo. */
function pixel(righe: string[], salt: number): { px: [number, number][]; w: number; h: number } {
  const out: [number, number][] = [], w = Math.max(...righe.map((r) => r.length)) * 4 - 1, h = righe.length * 7 - 2;
  righe.forEach((r, ry) => {
    const x0 = Math.floor((w - (r.length * 4 - 1)) / 2);
    [...r].forEach((ch, k) => (FONT[ch] ?? FONT[' ']!).forEach((bits, y) => { for (let b = 0; b < 3; b++) if (bits & (4 >> b)) out.push([x0 + k * 4 + b, ry * 7 + y]); }));
  });
  // gocce: dai pixel in fondo all'ultima riga ne cola qualcuna, lunga 1-3; schizzi: pochi pixel sparsi attorno
  for (const [x, y] of [...out]) {
    if (y === h - 1 && cellHash(x, y, salt) < 0.3) for (let d = 1; d <= 1 + Math.floor(cellHash(x, y, salt + 1) * 3); d++) out.push([x, y + d]);
    if (cellHash(x, y, salt + 2) < 0.025) out.push([x + (cellHash(x, y, salt + 3) < 0.5 ? -2 : 2), y + (cellHash(x, y, salt + 4) < 0.5 ? -2 : 2)]);
  }
  return { px: out, w, h };
}
/** La scritta come triangoli: sul muro nel piano XY (guarda +z), sul pavimento nel piano XZ (guarda in su, l'alto della scritta a −z). */
function testoGeo(righe: string[], lato: number, piano: 'muro' | 'pavimento', salt: number): THREE.BufferGeometry {
  const { px, w, h } = pixel(righe, salt), pos: number[] = [], nor: number[] = [];
  for (const [gx, gy] of px) {
    const x0 = (gx - w / 2) * lato, x1 = x0 + lato, y1 = (h / 2 - gy) * lato, y0 = y1 - lato;
    const v = piano === 'muro'
      ? [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y0, 0], [x1, y1, 0], [x0, y1, 0]]
      : [[x0, 0, -y0], [x1, 0, -y0], [x1, 0, -y1], [x0, 0, -y0], [x1, 0, -y1], [x0, 0, -y1]];
    for (const p of v) { pos.push(...p); nor.push(...(piano === 'muro' ? [0, 0, 1] : [0, 1, 0])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** Lo scheletro seduto con la schiena al muro e le gambe in avanti, il teschio piegato su una spalla, il biglietto sulle ginocchia (sigillo
 *  rosso). Pezzi già messi al loro posto nel mondo: lo scheletro guarda (fx, fz). */
function scheletro(k: Scheletro): Pezzo[] {
  const s = cellHash(Math.floor(k.x), Math.floor(k.z), 51), lato = s < 0.5 ? 1 : -1;
  const osso = PAL.pietraChiara, ombra = PAL.pietra;
  // in locale: la schiena verso −z (il muro a −0.5), le gambe verso +z
  const loc: Pezzo[] = [
    { g: B(0.28, 0.07, 0.16), c: ombra, y: 0.06, z: -0.26 },                                         // il bacino
    { g: B(0.06, 0.42, 0.06), c: osso, y: 0.3, z: -0.36, rx: -0.12 },                                // la spina
    ...[0, 1, 2].map((i): Pezzo => ({ g: B(0.3 - i * 0.04, 0.035, 0.18), c: osso, y: 0.26 + i * 0.09, z: -0.32 })), // le costole
    { g: B(0.32, 0.05, 0.08), c: ombra, y: 0.5, z: -0.38 },                                          // le spalle
    { g: B(0.2, 0.19, 0.21), c: osso, x: lato * 0.06, y: 0.62, z: -0.3, rz: lato * 0.35, rx: 0.25 },  // il teschio, piegato
    { g: B(0.05, 0.05, 0.02), c: PAL.neroCaldo, x: lato * 0.06 - 0.045, y: 0.63, z: -0.19, rz: lato * 0.35 }, // le orbite
    { g: B(0.05, 0.05, 0.02), c: PAL.neroCaldo, x: lato * 0.06 + 0.045, y: 0.63, z: -0.19, rz: lato * 0.35 },
    ...[-1, 1].flatMap((sx): Pezzo[] => [
      { g: B(0.06, 0.06, 0.36), c: osso, x: sx * 0.09, y: 0.07, z: -0.04 },                          // i femori
      { g: B(0.05, 0.05, 0.34), c: osso, x: sx * 0.09, y: 0.05, z: 0.3 },                            // le tibie
      { g: B(0.08, 0.04, 0.12), c: ombra, x: sx * 0.09, y: 0.03, z: 0.5 },                           // i piedi
    ]),
    { g: B(0.05, 0.26, 0.05), c: osso, x: -lato * 0.19, y: 0.28, z: -0.32, rz: -lato * 0.15 },       // un braccio giù lungo il fianco
    { g: B(0.05, 0.05, 0.24), c: osso, x: lato * 0.12, y: 0.24, z: -0.16 },                          // l'altro sulle ginocchia
    { g: B(0.2, 0.012, 0.15), c: PAL.sabbiaChiara, x: lato * 0.05, y: 0.15, z: -0.02, ry: 0.3 },      // il biglietto
    { g: B(0.04, 0.016, 0.04), c: PAL.rosso, x: lato * 0.05 + 0.04, y: 0.16, z: 0.01 },              // il sigillo
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  // un po' più grande del vero (×1,25): dalla camera alta deve leggersi come uno scheletro
  const m = new THREE.Matrix4().compose(new THREE.Vector3(k.x, 0, k.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(k.fx, k.fz), 0)), new THREE.Vector3(1.25, 1.25, 1.25));
  return loc.map((x) => {
    const g = x.g.index ? x.g.toNonIndexed() : x.g;
    if (g !== x.g) x.g.dispose();
    g.applyMatrix4(m4.compose(p.set(x.x ?? 0, x.y ?? 0, x.z ?? 0), q.setFromEuler(e.set(x.rx ?? 0, x.ry ?? 0, x.rz ?? 0)), one)).applyMatrix4(m);
    return { g, c: x.c };
  });
}
/** La scritta al suo posto: sul muro a metà altezza (la faccia guarda (nx, nz)), sul pavimento girata verso la camera (sud-est). Pixel
 *  da 6,5 cm (sui muri, visti di sbieco, 9): il gioco ne mostra ~28 per metro (a metà risoluzione), più piccoli le lettere si impastano. */
function scritta(w: Scritta, righe: string[]): Pezzo {
  const muro = !!(w.nx || w.nz), lato = muro ? 0.09 : 0.065;
  return muro
    ? { g: testoGeo(righe, lato, 'muro', w.id.length), c: PAL.rosso, x: w.x + w.nx * 0.02, y: 1.8, z: w.z + w.nz * 0.02, ry: Math.atan2(w.nx, w.nz) }
    : { g: testoGeo(righe, lato, 'pavimento', w.id.length), c: PAL.rosso, x: w.x, y: 0.015, z: w.z, ry: Math.PI / 4 };
}

export type PezziIndizi = { chiesa: Pezzo[]; sotto: Pezzo[]; zone: Pezzo[][] };
/** I pezzi degli indizi divisi per mesh: in chiesa (con le aste), sotto (con le catacombe), fuori una mesh per zona (vicini entro 10 m). */
export function pezziIndizi(a: Arena): PezziIndizi {
  const chiesa = new Set(a.dentro), out: PezziIndizi = { chiesa: [], sotto: [], zone: [] }, centri: { x: number; z: number; i: number }[] = [];
  const cose: { x: number; z: number; p: Pezzo[] }[] = [
    ...a.scheletri.map((k) => ({ x: k.x, z: k.z, p: scheletro(k) })),
    ...a.sangue.flatMap((w) => { const r = TEMPLARI.indizi.sangue[w.id]; return r ? [{ x: w.x, z: w.z, p: [scritta(w, r)] }] : []; }),
  ];
  for (const c of cose) {
    const i = Math.floor(c.z / a.tile) * a.w + Math.floor(c.x / a.tile);
    if (c.z >= a.sopra * a.tile) { out.sotto.push(...c.p); continue; }
    if (chiesa.has(i) || chiesa.has(i - a.w) || chiesa.has(i + a.w)) { out.chiesa.push(...c.p); continue; }
    const z = centri.find((q) => (q.x - c.x) * (q.x - c.x) + (q.z - c.z) * (q.z - c.z) < 100);
    if (z) out.zone[z.i]!.push(...c.p);
    else { centri.push({ x: c.x, z: c.z, i: out.zone.length }); out.zone.push([...c.p]); }
  }
  return out;
}
