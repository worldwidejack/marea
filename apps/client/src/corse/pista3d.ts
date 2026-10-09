// La pista del Gran Premio in 3D (docs/CORSE.md §3): asfalto con la riga tratteggiata, cordoli bianchi e rossi, prato rasato a strisce,
// muretto di gomme al bordo (dove la sim mette il muro), linea del via a scacchi sotto l'arco, tribune sul rettilineo, gomme nelle curve,
// palme sul prato e il mare tutto intorno. Tutto statico e fuso in poche geometrie a colori per vertice (palette, facce piatte):
// ~6 draw call per tutta la pista. Le misure vengono dalla sim (corsePista: centro campionato, mezza carreggiata, prato).
import * as THREE from 'three';
import { createRng } from '@marea/sim';
import type { Pista } from '@marea/sim';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { propCorse } from '../render/island_corse.ts';

const CORDOLO = 0.9, MURO_H = 0.9, BORDO_ISOLA = 26;
const col = new THREE.Color();

/** Striscia di quadrilateri lungo la pista tra gli scarti laterali `a` e `b` (m, + = destra), alla quota `y`; `colore(i)` per tratto
 *  (null = salta il tratto). */
function nastro(p: Pista, a: number, b: number, y: number, colore: (i: number) => string | null): THREE.BufferGeometry {
  const pos: number[] = [], cs: number[] = [];
  const pt = (i: number, l: number): [number, number, number] => { const k = i % p.n; return [p.x[k]! - p.tz[k]! * l, y, p.z[k]! + p.tx[k]! * l]; };
  for (let i = 0; i < p.n; i++) {
    const c = colore(i); if (!c) continue;
    const a0 = pt(i, a), b0 = pt(i, b), a1 = pt(i + 1, a), b1 = pt(i + 1, b);
    // due triangoli con la faccia in su (a → b è verso destra del verso di marcia)
    pos.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1);
    col.set(c); for (let k = 0; k < 6; k++) cs.push(col.r, col.g, col.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  g.computeVertexNormals();
  return g;
}
/** Muretto (faccia verso la pista, cima, faccia di dietro) allo scarto `l` con lo spessore `s`, a bande di `ogni` tratti. */
function muretto(p: Pista, l: number, s: number): THREE.BufferGeometry {
  const pos: number[] = [], cs: number[] = [];
  const pt = (i: number, d: number, y: number): [number, number, number] => { const k = i % p.n; return [p.x[k]! - p.tz[k]! * d, y, p.z[k]! + p.tx[k]! * d]; };
  const quad = (q: [number, number, number][], c: string) => { pos.push(...q[0]!, ...q[1]!, ...q[2]!, ...q[2]!, ...q[1]!, ...q[3]!); col.set(c); for (let k = 0; k < 6; k++) cs.push(col.r, col.g, col.b); };
  const fuori = l + Math.sign(l) * s, dentro = l;
  for (let i = 0; i < p.n; i++) {
    const c = Math.floor(i / 2) % 2 ? P.rosso : P.pietraChiara;
    const verso = l > 0 ? 1 : -1; // le facce guardano verso la pista
    const A = pt(i, dentro, 0), B = pt(i + 1, dentro, 0), C = pt(i, dentro, MURO_H), D = pt(i + 1, dentro, MURO_H);
    const E = pt(i, fuori, MURO_H), F = pt(i + 1, fuori, MURO_H), G = pt(i, fuori, 0), H = pt(i + 1, fuori, 0);
    if (verso > 0) { quad([A, B, C, D], c); quad([C, D, E, F], P.neroCaldo); quad([E, F, G, H], P.roccia); }
    else { quad([B, A, D, C], c); quad([D, C, F, E], P.neroCaldo); quad([F, E, H, G], P.roccia); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  g.computeVertexNormals();
  return g;
}

export type Pista3d = { group: THREE.Group; dispose(): void; bounds: { x0: number; z0: number; x1: number; z1: number } };

export function creaPista3d(p: Pista): Pista3d {
  const group = new THREE.Group(); group.name = 'gp_pista';
  const disp: { dispose(): void }[] = [];
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }); disp.push(mat); // i muretti si vedono dai due lati
  const add = (g: THREE.BufferGeometry, name: string, ombre = true) => {
    const m = new THREE.Mesh(g, mat); m.name = name; m.receiveShadow = ombre; group.add(m); disp.push(g); return m;
  };
  const lim = p.w + p.erba;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < p.n; i++) { x0 = Math.min(x0, p.x[i]!); x1 = Math.max(x1, p.x[i]!); z0 = Math.min(z0, p.z[i]!); z1 = Math.max(z1, p.z[i]!); }
  x0 -= lim + BORDO_ISOLA; z0 -= lim + BORDO_ISOLA; x1 += lim + BORDO_ISOLA; z1 += lim + BORDO_ISOLA;

  // ---- prato rasato a strisce (quadrati da 8 m), spiaggia attorno, mare ----
  const prato: THREE.BufferGeometry[] = [];
  const Q = 8, nx = Math.ceil((x1 - x0) / Q), nz = Math.ceil((z1 - z0) / Q);
  const pos: number[] = [], cs: number[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const ax = x0 + i * Q, az = z0 + j * Q, bx = ax + Q, bz = az + Q;
    pos.push(ax, 0, az, ax, 0, bz, bx, 0, az, bx, 0, az, ax, 0, bz, bx, 0, bz);
    col.set(i % 2 ? P.erba : P.erbaScura); for (let k = 0; k < 6; k++) cs.push(col.r, col.g, col.b);
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); pg.computeVertexNormals();
  prato.push(pg);
  const W = x1 - x0, H = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (const [w, h, x, z] of [[W + 12, 6, cx, z0 - 3], [W + 12, 6, cx, z1 + 3], [6, H, x0 - 3, cz], [6, H, x1 + 3, cz]] as const) prato.push(painted(new THREE.BoxGeometry(w, 0.6, h), P.sabbia, M(x, -0.3, z)));
  add(merged(prato), 'gp_prato');
  const acqua = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: P.acqua, flatShading: true }));
  acqua.rotation.x = -Math.PI / 2; acqua.position.set(cx, -0.5, cz); acqua.name = 'gp_mare';
  group.add(acqua); disp.push(acqua.geometry, acqua.material as THREE.Material);

  // ---- asfalto, riga, cordoli, linea del via ----
  const strada: THREE.BufferGeometry[] = [];
  strada.push(nastro(p, -p.w, p.w, 0.03, () => P.roccia));
  strada.push(nastro(p, -0.15, 0.15, 0.05, (i) => (i % 3 === 0 ? P.pietraChiara : null)));
  strada.push(nastro(p, p.w, p.w + CORDOLO, 0.06, (i) => (i % 2 ? P.rosso : P.pietraChiara)));
  strada.push(nastro(p, -p.w - CORDOLO, -p.w, 0.06, (i) => (i % 2 ? P.rosso : P.pietraChiara)));
  // via: due file di scacchi da 1 m attraverso la carreggiata
  const fx = p.tx[0]!, fz = p.tz[0]!;
  for (let r = 0; r < 2; r++) for (let k = 0; k < Math.round(p.w * 2); k++) {
    const l = -p.w + k + 0.5, d = r - 0.5;
    const x = p.x[0]! + fx * d - fz * l, z = p.z[0]! + fz * d + fx * l;
    strada.push(painted(new THREE.BoxGeometry(1, 0.04, 1), (k + r) % 2 ? P.neroCaldo : P.pietraChiara, M(x, 0.06, z, 0, Math.atan2(fx, fz), 0)));
  }
  add(merged(strada), 'gp_strada');

  // ---- muretti di gomme dove la sim mette il muro ----
  add(merged([muretto(p, lim, 0.7), muretto(p, -lim, 0.7)]), 'gp_muretti');

  // ---- arco del via, tribune sul rettilineo (fuori, a sinistra), gomme nelle curve, palme sul prato ----
  const deco: THREE.BufferGeometry[] = [];
  const posa = (g: THREE.BufferGeometry, i: number, lat: number, ry: number, sx = 1) => {
    const k = ((i % p.n) + p.n) % p.n;
    g.applyMatrix4(M(p.x[k]! - p.tz[k]! * lat, 0, p.z[k]! + p.tx[k]! * lat, 0, ry, 0, sx, 1, 1)); deco.push(g);
  };
  const giraX = (i: number) => { const k = ((i % p.n) + p.n) % p.n; return Math.atan2(-p.tx[k]!, -p.tz[k]!); }; // X locale = destra della pista
  posa(propCorse('arco_via'), 0, 0, giraX(0), (p.w + 0.8) / 3.2);
  const versoPista = (i: number, lato: number) => { const k = ((i % p.n) + p.n) % p.n; return Math.atan2(p.tz[k]! * lato, -p.tx[k]! * lato); }; // −Z verso la pista
  for (const i of [8, 13, 18]) posa(propCorse('tribuna'), i, -(lim + 6), versoPista(i, 1));
  for (const i of [p.n - 10, p.n - 15]) posa(propCorse('tribuna'), i, -(lim + 6), versoPista(i, 1));
  // gomme: all'esterno delle curve (lato opposto a dove gira la pista)
  for (let i = 0; i < p.n; i += 9) {
    const a = p.tx[i]!, b = p.tz[i]!, j = (i + 6) % p.n, gira = a * p.tz[j]! - b * p.tx[j]!; // + = gira a sinistra (verso −destra)
    if (Math.abs(gira) < 0.12) continue;
    const lato = gira > 0 ? 1 : -1;
    posa(propCorse('gomme'), i, lato * (lim + 1.3), giraX(i));
  }
  // palme: su una griglia con un po' di caso (seme fisso), lontane dalla pista
  const rng = createRng('gp_palme'), lontano = (x: number, z: number) => {
    let d = Infinity; for (let i = 0; i < p.n; i += 2) d = Math.min(d, (p.x[i]! - x) ** 2 + (p.z[i]! - z) ** 2);
    return d > (lim + 7) ** 2;
  };
  for (let x = x0 + 6; x < x1 - 6; x += 17) for (let z = z0 + 6; z < z1 - 6; z += 17) {
    const px = x + (rng.next() - 0.5) * 10, pz = z + (rng.next() - 0.5) * 10;
    if (rng.next() < 0.45 || !lontano(px, pz)) continue;
    const h = 3 + rng.next() * 1.5, curva = (rng.next() - 0.5) * 0.4;
    deco.push(painted(new THREE.CylinderGeometry(0.16, 0.24, h, 5), P.legnoChiaro, M(px, h / 2, pz, 0, 0, curva)));
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * Math.PI * 2 + rng.next();
      deco.push(painted(new THREE.BoxGeometry(0.5, 0.1, 2.0), f % 2 ? P.erbaScura : P.bosco, M(px + Math.sin(curva) * -h + Math.cos(a) * 0.9, h - 0.1, pz + Math.sin(a) * 0.9, 0.35, -a + Math.PI / 2, 0)));
    }
  }
  const decoMesh = add(merged(deco), 'gp_deco');
  decoMesh.castShadow = true;

  return {
    group, bounds: { x0, z0, x1, z1 },
    dispose() { for (const d of disp) d.dispose(); },
  };
}
