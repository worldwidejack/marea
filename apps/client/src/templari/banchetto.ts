// La sala del banchetto nella Taverna del Teschio (docs/TEMPLARI.md §3), arredata come la sala di un castello dopo una festa finita male:
// la tavolata lunga (le celle 'p' sull'assito, che la sim tiene piene) con la tovaglia e la passatoia rossa, il cinghiale sul vassoio, pane,
// frutta, brocche, piatti pieni e piatti vuoti, calici rovesciati e il vino versato, tre candelabri accesi; le sedie dallo schienale alto,
// qualcuna spinta via o rovesciata, cocci per terra; a capotavola lo scheletro del padrone di casa; il camino acceso sul muro nord con la
// cappa, la mensola e lo scudo crociato; due stendardi sul muro ovest e un tappeto rosso sotto la tavola. Solo resa: tutto fisso in UNA
// mesh, le fiamme in un InstancedMesh che trema, una luce calda sul camino.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C, SUOLO, TIPO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import { merged } from '../render/island_parts.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';

export type Banchetto = { update(t: number): void; dispose(): void };

const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const CY = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Sedia dallo schienale alto, pivot a terra, guarda +Z (lo schienale dietro, a −Z). */
function sedia(): THREE.BufferGeometry {
  return unisci([
    { g: B(0.46, 0.06, 0.44), c: PAL.legno, y: 0.47 },
    ...[-1, 1].flatMap((sx): Pezzo[] => [-1, 1].map((sz) => ({ g: B(0.05, 0.47, 0.05), c: PAL.legnoScuro, x: sx * 0.2, y: 0.235, z: sz * 0.19 }))),
    { g: B(0.05, 0.75, 0.05), c: PAL.legnoScuro, x: -0.2, y: 0.85, z: -0.2 }, { g: B(0.05, 0.75, 0.05), c: PAL.legnoScuro, x: 0.2, y: 0.85, z: -0.2 },
    { g: B(0.4, 0.5, 0.04), c: PAL.rosso, y: 0.88, z: -0.2 }, { g: B(0.46, 0.06, 0.06), c: PAL.legnoScuro, y: 1.22, z: -0.2 },
  ]);
}
/** Lo scheletro del padrone di casa, seduto a capotavola, accasciato in avanti (pivot a terra, guarda +Z). */
function scheletro(): THREE.BufferGeometry {
  const o = PAL.pietraChiara;
  return unisci([
    { g: B(0.2, 0.22, 0.2), c: o, y: 1.14, z: 0.1, rx: 0.4 }, { g: B(0.05, 0.05, 0.03), c: PAL.neroCaldo, x: -0.05, y: 1.16, z: 0.2 }, { g: B(0.05, 0.05, 0.03), c: PAL.neroCaldo, x: 0.05, y: 1.16, z: 0.2 },
    { g: B(0.06, 0.4, 0.06), c: o, y: 0.82, z: -0.02, rx: 0.35 }, ...[0.72, 0.82, 0.92].map((y): Pezzo => ({ g: B(0.3, 0.03, 0.18), c: o, y, z: 0.02, rx: 0.35 })),
    { g: B(0.26, 0.08, 0.18), c: o, y: 0.52 }, // bacino
    ...[-1, 1].map((s): Pezzo => ({ g: B(0.05, 0.05, 0.45), c: o, x: s * 0.1, y: 0.52, z: 0.22 })), ...[-1, 1].map((s): Pezzo => ({ g: B(0.05, 0.45, 0.05), c: o, x: s * 0.1, y: 0.25, z: 0.44 })),
    ...[-1, 1].map((s): Pezzo => ({ g: B(0.04, 0.04, 0.5), c: o, x: s * 0.2, y: 0.86, z: 0.28, rx: -0.3 })), // braccia sulla tavola
    { g: B(0.3, 0.3, 0.06), c: PAL.rosso, y: 0.85, z: -0.12, rx: 0.3 }, // il mantello a brandelli
  ]);
}

export function createBanchetto(scene: THREE.Scene, a: Arena): Banchetto {
  const T = a.tile, W = a.w;
  const tavola = [...Array(W * a.h).keys()].filter((i) => a.tipo[i] === TIPO.stallo && a.suolo[i] === SUOLO.assi);
  if (!tavola.length) return { update() {}, dispose() {} };
  const xs = tavola.map((i) => i % W), zs = tavola.map((i) => Math.floor(i / W));
  const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T, tz = ((Math.min(...zs) + Math.max(...zs) + 1) / 2) * T, L = x1 - x0, tx = (x0 + x1) / 2;
  const at = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= a.h ? C.fuori : a.cell[cz * W + cx]!);
  const disp: { dispose(): void }[] = [];
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), acceso = new THREE.MeshBasicMaterial({ vertexColors: true });
  disp.push(lam, acceso);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  const pezzi: THREE.BufferGeometry[] = [];
  /** Una geometria messa in (x, y, z) girata (rx, ry, rz) e aggiunta alla mesh fissa. */
  const metti = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => pezzi.push(g.clone().applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), s1)));
  const fiamme: { x: number; y: number; z: number; s: number }[] = [];
  const h = (k: number, s: number) => cellHash(k, Math.round(tz), s);

  // ---- la tavolata: tovaglia, passatoia, cavalletti, tappeto sotto ----
  const tav = unisci([
    { g: B(L + 1.4, 0.015, 3.2), c: PAL.rosso, y: 0.008 }, { g: B(L + 1.1, 0.017, 2.9), c: PAL.legnoScuro, y: 0.009 }, { g: B(L + 0.9, 0.019, 2.7), c: PAL.rosso, y: 0.01 }, // tappeto con la bordura
    { g: B(L + 0.1, 0.08, 1.15), c: PAL.legnoScuro, y: 0.76 },
    ...[-0.42, 0, 0.42].map((k): Pezzo => ({ g: B(0.1, 0.72, 0.9), c: PAL.legnoScuro, x: k * L, y: 0.36 })),
    { g: B(L + 0.3, 0.02, 1.3), c: PAL.sabbiaChiara, y: 0.81 }, ...[-1, 1].map((sz): Pezzo => ({ g: B(L + 0.3, 0.24, 0.02), c: PAL.sabbiaChiara, y: 0.7, z: sz * 0.65 })),
    ...[-1, 1].map((sx): Pezzo => ({ g: B(0.02, 0.24, 1.3), c: PAL.sabbiaChiara, x: sx * (L / 2 + 0.15), y: 0.7 })),
    { g: B(L - 0.4, 0.022, 0.36), c: PAL.rosso, y: 0.825 }, { g: B(L - 0.4, 0.024, 0.05), c: PAL.giallo, y: 0.826, z: 0.16 }, { g: B(L - 0.4, 0.024, 0.05), c: PAL.giallo, y: 0.826, z: -0.16 },
  ]);
  metti(tav, tx, 0, tz); tav.dispose();

  // ---- in mezzo: il cinghiale sul vassoio, pane, frutta, brocche, candelabri ----
  const centro = unisci([
    { g: CY(0.42, 0.38, 0.04, 8), c: PAL.pietra, y: 0.86 }, { g: B(0.6, 0.3, 0.32), c: PAL.legnoChiaro, y: 1.0 }, { g: B(0.22, 0.22, 0.22), c: PAL.legno, x: 0.38, y: 1.0 },
    { g: B(0.08, 0.08, 0.08), c: PAL.rosso, x: 0.5, y: 1.0 }, ...[-1, 1].map((s): Pezzo => ({ g: B(0.06, 0.12, 0.06), c: PAL.legnoScuro, x: -0.2, y: 0.9, z: s * 0.12 })), // la mela in bocca, le zampe
    ...[[-0.9, PAL.sabbia], [-1.1, PAL.legnoChiaro], [0.9, PAL.sabbia]].map(([x, c]): Pezzo => ({ g: B(0.26, 0.12, 0.14), c: c as string, x: x as number, y: 0.9, z: 0.12, ry: 0.4 })), // pagnotte
    { g: CY(0.22, 0.14, 0.12, 7), c: PAL.legno, x: 1.4, y: 0.89 }, ...[[0, PAL.rosso], [0.09, PAL.giallo], [-0.08, PAL.arancio], [0.02, PAL.erba]].map(([dx, c], k): Pezzo => ({ g: B(0.1, 0.1, 0.1), c: c as string, x: 1.4 + (dx as number), y: 0.98 + (k > 1 ? 0.06 : 0), z: (k - 1.5) * 0.06 })), // frutta
    { g: CY(0.1, 0.13, 0.32, 6), c: PAL.legnoScuro, x: -1.6, y: 0.99 }, { g: CY(0.09, 0.12, 0.28, 6), c: PAL.pietraScura, x: 1.9, y: 0.97, z: -0.15 }, // brocche
  ]);
  metti(centro, tx, 0, tz); centro.dispose();
  const candelabro = unisci([{ g: CY(0.12, 0.15, 0.04), c: PAL.roccia, y: 0.85 }, { g: CY(0.025, 0.03, 0.42), c: PAL.roccia, y: 1.06 }, { g: B(0.42, 0.04, 0.05), c: PAL.roccia, y: 1.26 }, ...[-0.18, 0, 0.18].map((x): Pezzo => ({ g: CY(0.03, 0.03, 0.14), c: PAL.sabbiaChiara, x, y: 1.35 }))]);
  for (const k of [-0.36, 0, 0.36]) { if (k === 0) continue; metti(candelabro, tx + k * L, 0, tz); for (const dx of [-0.18, 0, 0.18]) fiamme.push({ x: tx + k * L + dx, y: 1.46, z: tz, s: 0.6 }); }
  candelabro.dispose();

  // ---- i posti: piatto (pieno, vuoto, o niente), calice (in piedi o rovesciato col vino versato), qualche teschio e ossa ----
  const piatto = unisci([{ g: CY(0.15, 0.12, 0.03, 8), c: PAL.pietraChiara, y: 0.845 }]);
  const pieno = unisci([{ g: CY(0.15, 0.12, 0.03, 8), c: PAL.pietraChiara, y: 0.845 }, { g: B(0.14, 0.06, 0.1), c: PAL.legnoChiaro, y: 0.88 }, { g: B(0.06, 0.05, 0.06), c: PAL.erba, x: 0.07, y: 0.88, z: 0.04 }]);
  const calice = unisci([{ g: CY(0.06, 0.06, 0.02, 6), c: PAL.giallo, y: 0.84 }, { g: CY(0.015, 0.015, 0.1, 4), c: PAL.giallo, y: 0.9 }, { g: CY(0.06, 0.035, 0.08, 6), c: PAL.giallo, y: 0.99 }]);
  const versato = unisci([{ g: CY(0.06, 0.035, 0.08, 6), c: PAL.giallo, y: 0.88, rz: Math.PI / 2 }, { g: CY(0.04, 0.04, 0.1, 4), c: PAL.giallo, x: -0.08, y: 0.88, rz: Math.PI / 2 }, { g: CY(0.22, 0.22, 0.005, 8), c: PAL.rosso, x: 0.18, y: 0.834, sx: 1.4 }]);
  const teschio = unisci([{ g: CY(0.15, 0.12, 0.03, 8), c: PAL.pietraChiara, y: 0.845 }, { g: B(0.14, 0.13, 0.15), c: PAL.pietraChiara, y: 0.93 }, { g: B(0.04, 0.04, 0.02), c: PAL.neroCaldo, x: -0.035, y: 0.95, z: 0.075 }, { g: B(0.04, 0.04, 0.02), c: PAL.neroCaldo, x: 0.035, y: 0.95, z: 0.075 }]);
  const ossa = unisci([{ g: B(0.3, 0.035, 0.035), c: PAL.pietraChiara, y: 0.845, ry: 0.5 }, { g: B(0.22, 0.035, 0.035), c: PAL.pietraChiara, x: 0.06, y: 0.85, ry: -0.6 }]);
  const sed = sedia();
  let n = 0;
  for (let x = x0 + 0.5 * T; x < x1; x += T) for (const lato of [-1, 1]) {
    const k = n++, r = h(k, 31), z = tz + lato * 0.38, ry = lato < 0 ? 0 : Math.PI;
    // sul tavolo
    if (r < 0.06) metti(teschio, x, 0, z, ry);
    else if (r < 0.4) metti(pieno, x, 0, z, h(k, 32) * 3);
    else if (r < 0.85) metti(piatto, x, 0, z);
    if (h(k, 33) < 0.3) metti(versato, x + 0.22, 0, z - lato * 0.05, h(k, 34) * 6);
    else if (h(k, 33) < 0.85) metti(calice, x + 0.24, 0, z - lato * 0.12);
    if (h(k, 35) < 0.12) metti(ossa, x - 0.1, 0, z + lato * 0.02, h(k, 36) * 3);
    // la sedia: a posto, spinta via storta, o rovesciata all'indietro
    const sz = tz + lato * 0.86, sr = h(k, 37);
    if (sr < 0.55) metti(sed, x + (h(k, 38) - 0.5) * 0.15, 0, sz + lato * 0.08 * h(k, 39), ry + (h(k, 40) - 0.5) * 0.3);
    else if (sr < 0.8) metti(sed, x + (h(k, 38) - 0.5) * 0.4, 0, sz + lato * 0.45, ry + (h(k, 40) < 0.5 ? -1 : 1) * (0.5 + 0.5 * h(k, 41)));
    else metti(sed, x, 0.22, sz + lato * 0.75, ry, lato < 0 ? -1.45 : 1.45);
  }
  // capotavola: a est lo scheletro del padrone di casa sulla sua sedia, a ovest la sedia rovesciata di lato
  const osso = scheletro(); metti(sed, x1 + 0.55, 0, tz, -Math.PI / 2); metti(osso, x1 + 0.55, 0, tz, -Math.PI / 2); osso.dispose();
  metti(sed, x0 - 0.9, 0.22, tz + 0.2, Math.PI / 2 + 0.4, 0, 1.45);
  // per terra: cocci, un calice caduto, il vino
  const cocci = unisci([...[0, 1, 2, 3].map((k): Pezzo => ({ g: B(0.1, 0.02, 0.07), c: PAL.pietraChiara, x: Math.cos(k * 1.7) * 0.25, y: 0.012, z: Math.sin(k * 1.7) * 0.2, ry: k })), { g: CY(0.35, 0.35, 0.004, 8), c: PAL.rosso, x: 0.3, y: 0.022, sx: 1.5 }]);
  metti(cocci, tx - L * 0.2, 0, tz + 1.6); metti(cocci, tx + L * 0.3, 0, tz - 1.5, 2);
  metti(calice, tx + L * 0.3 + 0.4, -0.73, tz - 1.4, 0, 0, Math.PI / 2);
  for (const g of [sed, piatto, pieno, calice, versato, teschio, ossa, cocci]) g.dispose();

  // ---- il camino sul muro nord della sala: la coppia di celle di muro più vicina al centro della tavola, lontana dalle porte ----
  const dentro = new Set<number>();
  { const q0 = [tavola[0]!]; dentro.add(q0[0]!); while (q0.length) { const i = q0.pop()!, cx = i % W, cz = (i - cx) / W; for (const [dx, dz] of N4) { const j = (cz + dz) * W + cx + dx; if (!dentro.has(j) && a.suolo[j] === SUOLO.assi && at(cx + dx, cz + dz) !== C.muro) { dentro.add(j); q0.push(j); } } } }
  const zMin = Math.min(...[...dentro].map((i) => Math.floor(i / W))), riga = zMin - 1;
  let cam = -1, best = Infinity;
  for (let cx = 1; cx < W - 2; cx++) {
    if (![cx - 1, cx, cx + 1, cx + 2].every((x) => at(x, riga) === C.muro) || !dentro.has(zMin * W + cx) || !dentro.has(zMin * W + cx + 1)) continue;
    if ([cx - 2, cx + 3].some((x) => at(x, riga) === C.porta)) continue;
    const d = Math.abs(cx + 1 - tx / T);
    if (d < best) { best = d; cam = cx; }
  }
  let luce: THREE.PointLight | null = null;
  if (cam >= 0) {
    const fx = (cam + 1) * T, fz = zMin * T; // il centro del camino sulla faccia del muro (+Z = nella sala)
    const camino = unisci([
      { g: B(2.5, 0.12, 0.34), c: PAL.pietraScura, y: 0.06, z: 0.17 },
      { g: B(1.5, 1.15, 0.06), c: PAL.neroCaldo, y: 0.62, z: 0.03 },
      ...[-1, 1].map((s): Pezzo => ({ g: B(0.42, 1.3, 0.32), c: PAL.pietra, x: s * 0.95, y: 0.65, z: 0.16 })),
      { g: B(2.7, 0.22, 0.34), c: PAL.pietraChiara, y: 1.4, z: 0.17 },
      { g: B(2.2, 1.2, 0.26), c: PAL.pietra, y: 2.1, z: 0.13 }, { g: B(1.4, 0.9, 0.2), c: PAL.pietraScura, y: 2.9, z: 0.1 },
      ...[[-0.32, 0.17], [0.3, -0.12]].map(([x, r]): Pezzo => ({ g: CY(0.09, 0.09, 0.9, 6), c: PAL.legnoScuro, x: x! * 0.3, y: 0.2, z: 0.18, rz: Math.PI / 2, ry: r! })),
      // sulla mensola: due candele, un teschio, un boccale; sopra, lo scudo crociato
      ...[-1.05, 1.05].map((x): Pezzo => ({ g: CY(0.04, 0.04, 0.18), c: PAL.sabbiaChiara, x, y: 1.6, z: 0.2 })),
      { g: B(0.14, 0.13, 0.15), c: PAL.pietraChiara, x: -0.6, y: 1.58, z: 0.2 }, { g: CY(0.06, 0.07, 0.16), c: PAL.pietra, x: 0.55, y: 1.59, z: 0.2 },
      { g: CY(0.32, 0.05, 0.75, 6), c: PAL.sabbiaChiara, y: 2.15, z: 0.28, rx: Math.PI / 2, sz: 0.15 }, { g: B(0.07, 0.5, 0.03), c: PAL.rosso, y: 2.2, z: 0.31 }, { g: B(0.38, 0.07, 0.03), c: PAL.rosso, y: 2.32, z: 0.31 },
    ]);
    metti(camino, fx, 0, fz); camino.dispose();
    fiamme.push({ x: fx - 0.2, y: 0.25, z: fz + 0.2, s: 2.2 }, { x: fx + 0.15, y: 0.25, z: fz + 0.22, s: 2.6 }, { x: fx + 0.02, y: 0.25, z: fz + 0.12, s: 1.8 }, { x: fx - 1.05, y: 1.72, z: fz + 0.2, s: 0.6 }, { x: fx + 1.05, y: 1.72, z: fz + 0.2, s: 0.6 });
    luce = new THREE.PointLight(PAL.arancio, 14, 11, 1.5); luce.position.set(fx, 1.0, fz + 1.0); scene.add(luce);
  }
  // ---- due stendardi sul muro ovest (bianco e nero con la croce rossa, il Beauceant) ----
  const xOvest = Math.min(...[...dentro].map((i) => i % W)) * T;
  const stendardo = unisci([{ g: B(0.04, 0.7, 0.62), c: PAL.sabbiaChiara, y: 2.0 }, { g: B(0.04, 0.6, 0.62), c: PAL.neroCaldo, y: 1.35 }, { g: B(0.05, 0.9, 0.1), c: PAL.rosso, y: 1.75 }, { g: B(0.05, 0.1, 0.42), c: PAL.rosso, y: 1.9 }, { g: B(0.06, 0.05, 0.75), c: PAL.legnoScuro, y: 2.37 }]);
  for (const z of [tz - 1.5, tz + 5.5]) if (dentro.has(Math.floor(z / T) * W + Math.floor(xOvest / T))) metti(stendardo, xOvest + 0.03, 0, z);
  stendardo.dispose();

  const fissi = merged(pezzi);
  const mesh = new THREE.Mesh(fissi, lam); mesh.name = 'banchetto'; scene.add(mesh); disp.push(fissi);
  const fiaGeo = new THREE.ConeGeometry(0.05, 0.14, 5); fiaGeo.translate(0, 0.07, 0);
  const fiaMat = new THREE.MeshBasicMaterial({ color: PAL.giallo });
  const fia = new THREE.InstancedMesh(fiaGeo, fiaMat, Math.max(1, fiamme.length)); fia.name = 'banchetto_fiamme'; fia.frustumCulled = false; scene.add(fia); disp.push(fiaGeo, fiaMat);
  const c = new THREE.Color();
  fiamme.forEach((f, k) => fia.setColorAt(k, c.set(f.s > 1 ? (k % 2 ? PAL.arancio : PAL.giallo) : PAL.giallo)));
  return {
    update(t) {
      const st = Math.floor(t * 10);
      fiamme.forEach((f, k) => { const j = 0.8 + 0.4 * (((st + k * 3) * 0.618) % 1); fia.setMatrixAt(k, m4.compose(v.set(f.x, f.y, f.z), q.identity(), s1.set(f.s, f.s * j, f.s))); });
      s1.set(1, 1, 1);
      fia.instanceMatrix.needsUpdate = true;
      if (luce) luce.intensity = 12 + 4 * (((st * 0.618) % 1));
    },
    dispose() { scene.remove(mesh, fia); if (luce) scene.remove(luce); for (const d of disp) d.dispose(); },
  };
}
