// Prova stili (#50): quello che manca alle isole del gioco per somigliare alle reference.
// - scogli sulla riva: massi irregolari mezzi in acqua lungo ogni lato di terra che tocca il mare (rompono il bordo a scalini)
// - fiori e ciuffi d'erba sui prati
// Un InstancedMesh per tipo (3 draw call in tutto); lo stile sceglie quanti se ne vedono (count) e di che colore.
import * as THREE from 'three';
import { createRng } from '@marea/sim';
import type { GridMap } from '@marea/sim';
import type { Style } from './styles.ts';

const WATER = new Set(['~', ',', 'B']);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Masso: icosaedro coi vertici spostati (stesso spostamento per i vertici doppi: niente buchi), base sotto il pelo dell'acqua. */
function rockGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.getAttribute('position')!;
  const h = (x: number, y: number, z: number) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.75 + h(x, y, z) * 0.5;
    p.setXYZ(i, x * k, Math.max(y * k, -0.6), z * k); // fondo schiacciato
  }
  g.computeVertexNormals();
  return g;
}
/** Tre petali a cubetto attorno a un punto, alti 10-16 cm. */
function flowerGeometry(): THREE.BufferGeometry {
  const parts = [[0, 0.12, 0], [0.13, 0.09, 0.06], [-0.07, 0.1, 0.12]].map(([x, y, z]) => new THREE.BoxGeometry(0.11, 0.08, 0.11).translate(x!, y!, z!));
  const pos: number[] = [], nor: number[] = [];
  for (const b of parts) { const nb = b.toNonIndexed(); pos.push(...(nb.getAttribute('position')!.array as Float32Array)); nor.push(...(nb.getAttribute('normal')!.array as Float32Array)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
/** Ciuffo: cinque fili a triangolo, a raggiera, alti 25-40 cm. */
function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4, r = 0.07, hgt = 0.25 + (i % 3) * 0.07, lean = 0.1;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, px = -Math.sin(a) * 0.04, pz = Math.cos(a) * 0.04;
    pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, hgt, cz + Math.sin(a) * lean);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

export type Decor = { group: THREE.Group; setStyle(s: Style): void; counts: { rocks: number; flowers: number; tufts: number } };

export function createDecor(o: { map: GridMap; groundY: (x: number, z: number) => number; avoid: { x: number; z: number }[] }): Decor {
  const { map } = o, T = map.tile, rng = createRng('provapixel:decor');
  const avoid = new Set(o.avoid.map((p) => { const c = map.worldToCell(p.x, p.z); return c.cz * map.w + c.cx; }));
  const near = (cx: number, cz: number) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (avoid.has((cz + dz) * map.w + cx + dx)) return true; return false; };
  const rocks: THREE.Matrix4[] = [], flowers: THREE.Matrix4[] = [], tufts: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const put = (list: THREE.Matrix4[], x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number, tilt = 0) => {
    q.setFromEuler(e.set(tilt * (rng.next() - 0.5), yaw, tilt * (rng.next() - 0.5)));
    list.push(m.compose(v.set(x, y, z), q, s.set(sx, sy, sz)).clone());
  };
  for (let cz = 0; cz < map.h; cz++) for (let cx = 0; cx < map.w; cx++) {
    const t = map.at(cx, cz);
    if (WATER.has(t) || t === 'd') continue;
    const { x, z } = map.cellToWorld(cx, cz);
    // vicino al molo e alla barca niente scogli: la barca deve poter attraccare
    let dockNear = false;
    for (let dz = -2; dz <= 2 && !dockNear; dz++) for (let dx = -2; dx <= 2; dx++) { const u = map.at(cx + dx, cz + dz); if (u === 'd' || u === 'B') { dockNear = true; break; } }
    for (const [dx, dz] of N4) {
      if (!WATER.has(map.at(cx + dx, cz + dz)) || dockNear) continue;
      const n = 1 + (rng.next() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const along = (rng.next() - 0.5) * T, out = T / 2 + 0.2 + rng.next() * 0.6, big = rng.next() < 0.1 ? 1.5 : 1;
        const rx = x + dx * out + (dz !== 0 ? along : 0), rz = z + dz * out + (dx !== 0 ? along : 0);
        const r = (0.28 + rng.next() * 0.35) * big;
        put(rocks, rx, -0.15 + rng.next() * 0.25, rz, rng.next() * 6.28, r * (0.9 + rng.next() * 0.4), r * (0.55 + rng.next() * 0.5), r, 0.4);
      }
    }
    if ((t === 'g' || t === 'L') && !near(cx, cz)) {
      const y = o.groundY(x, z);
      for (let i = 0; i < 2; i++) if (rng.next() < 0.6) put(flowers, x + (rng.next() - 0.5) * T * 0.9, y, z + (rng.next() - 0.5) * T * 0.9, rng.next() * 6.28, 1, 0.8 + rng.next() * 0.5, 1);
      for (let i = 0; i < 4; i++) if (rng.next() < 0.8) put(tufts, x + (rng.next() - 0.5) * T * 0.95, y, z + (rng.next() - 0.5) * T * 0.95, rng.next() * 6.28, 1, 0.7 + rng.next() * 0.8, 1);
    }
  }
  // ordine casuale: con count < totale se ne mostra un sottoinsieme sparso, non le prime righe della mappa
  const shuffle = (a: THREE.Matrix4[]) => { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };
  const group = new THREE.Group(); group.name = 'decor_stile';
  const mk = (geo: THREE.BufferGeometry, mats: THREE.Matrix4[], name: string, cast: boolean, mat: THREE.Material) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
    shuffle(mats).forEach((x, i) => im.setMatrixAt(i, x));
    im.count = mats.length; im.castShadow = cast; im.receiveShadow = true; im.name = name; im.frustumCulled = false;
    for (let i = 0; i < mats.length; i++) im.setColorAt(i, new THREE.Color(1, 1, 1));
    group.add(im);
    return { im, n: mats.length };
  };
  const R = mk(rockGeometry(), rocks, 'scogli', true, new THREE.MeshLambertMaterial({ flatShading: true }));
  const F = mk(flowerGeometry(), flowers, 'fiori', false, new THREE.MeshLambertMaterial({ flatShading: true }));
  const G = mk(tuftGeometry(), tufts, 'erba_alta', false, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true }));
  const c = new THREE.Color();
  const paint = (x: { im: THREE.InstancedMesh; n: number }, frac: number, cols: string[]) => {
    x.im.count = Math.round(x.n * Math.min(1, frac)); x.im.visible = x.im.count > 0 && cols.length > 0;
    for (let i = 0; i < x.n && cols.length; i++) x.im.setColorAt(i, c.set(cols[(i * 7 + (i >> 3)) % cols.length]!));
    if (x.im.instanceColor) x.im.instanceColor.needsUpdate = true;
  };
  return {
    group, counts: { rocks: R.n, flowers: F.n, tufts: G.n },
    setStyle: (st) => {
      paint(R, st.rocks.n, st.rocks.cols);
      paint(F, st.flowers.n, st.flowers.cols);
      const g = new THREE.Color(st.flowers.grass), hsl = { h: 0, s: 0, l: 0 }; g.getHSL(hsl);
      paint(G, st.flowers.tufts, [0, 1, 2].map((k) => '#' + new THREE.Color().setHSL(hsl.h + (k - 1) * 0.02, hsl.s, hsl.l * (0.85 + k * 0.15)).getHexString()));
    },
  };
}
