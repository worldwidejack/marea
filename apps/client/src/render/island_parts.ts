// Pezzi della resa delle isole (render/island.ts): texture procedurali a pixel, blocchi, segnaposto dei prop e degli edifici,
// torri del Distretto Neon, caricamento dei moduli glTF (geometria allineata e condivisa, attributi quantizzati → Float32).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '@marea/sim';
import type { Rng } from '@marea/sim';
import type { Loader } from './loader.ts';

export const ISLAND = { TOP: 0.4, BOTTOM: -1.2, STEP: 0.12, STEP_W: 0.6 } as const;
export const P = {
  sabbiaChiara: '#F4E3C1', sabbia: '#E2B97F', legnoChiaro: '#C98A4B', legno: '#8E5A2B', legnoScuro: '#5A3A1E', ombraCalda: '#2E1E14',
  erbaChiara: '#D9E872', erba: '#8FC35B', erbaScura: '#4E9A46', bosco: '#2C6B3F', boscoOmbra: '#1E4A3A',
  pietraChiara: '#E8E1D6', pietra: '#B9AFA3', pietraScura: '#7F7568', roccia: '#4A4340', neroCaldo: '#23201F',
  rosso: '#E8433F', arancio: '#F2A33A', giallo: '#F5D547',
  rosaNeon: '#FF3DA6', cianoNeon: '#3DF5FF', ambraNeon: '#FFB03D', violaNeon: '#8A5CFF',
} as const;

// ——— texture procedurali a pixel (16 texel/m): 32×64, metà alta = faccia superiore (2×2 m), metà bassa = fianco (2 m) ———
type Painter = (g: CanvasRenderingContext2D, r: Rng) => void;
export function tex(label: string, seed: string, paint: Painter): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const g = c.getContext('2d')!;
  paint(g, createRng(seed + ':' + label));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
const px = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const speckle = (g: CanvasRenderingContext2D, r: Rng, c: string, n: number, y0: number, y1: number, w = 1, h = 1) => { for (let i = 0; i < n; i++) px(g, c, r.int(0, 31), r.int(y0, y1 - h), w, h); };
/** Fianco: lista di [colore, righe] dall'alto; tra una fascia e l'altra una riga a scacchi (dithering tra colori adiacenti). */
function strata(g: CanvasRenderingContext2D, bands: [string, number][]): void {
  let y = 32;
  for (const [c, n] of bands) { px(g, c, 0, y, 32, 64 - y); y += n; }
  y = 32;
  for (let i = 0; i < bands.length - 1; i++) { y += bands[i]![1]; for (let x = (y & 1); x < 32; x += 2) px(g, bands[i]![0], x, y); }
}
export const PAINT: Record<string, Painter> = {
  sabbia: (g, r) => { px(g, P.sabbia, 0, 0, 32, 32); speckle(g, r, P.sabbiaChiara, 46, 0, 32); speckle(g, r, P.legnoChiaro, 10, 0, 32); strata(g, [[P.sabbia, 3], [P.legnoChiaro, 5], [P.legno, 32]]); speckle(g, r, P.sabbiaChiara, 8, 32, 36); },
  erba: (g, r) => {
    px(g, P.erba, 0, 0, 32, 32); speckle(g, r, P.erbaChiara, 26, 0, 32); speckle(g, r, P.erbaScura, 22, 0, 32, 1, 2);
    strata(g, [[P.erbaScura, 3], [P.legno, 7], [P.legnoScuro, 32]]);
    for (let x = 0; x < 32; x++) if (r.next() < 0.45) px(g, P.erbaScura, x, 35, 1, r.int(1, 2)); // frangia d'erba che scende sul fianco
    speckle(g, r, P.legnoChiaro, 10, 38, 48);
  },
  roccia: (g, r) => {
    px(g, P.pietra, 0, 0, 32, 32); speckle(g, r, P.pietraChiara, 30, 0, 32, 2, 1); speckle(g, r, P.pietraScura, 22, 0, 32, 1, 1);
    strata(g, [[P.pietra, 2], [P.pietraScura, 6], [P.roccia, 5], [P.pietraScura, 5], [P.roccia, 32]]);
    speckle(g, r, P.pietra, 14, 36, 60, 2, 1); speckle(g, r, P.roccia, 10, 34, 50, 1, 2);
  },
  molo: (g, r) => {
    for (let y = 0; y < 32; y += 4) { px(g, y % 8 ? P.legnoChiaro : P.legno, 0, y, 32, 3); px(g, P.legnoScuro, 0, y + 3, 32, 1); }
    speckle(g, r, P.legnoScuro, 10, 0, 32); px(g, P.legnoScuro, 3, 0, 1, 32); px(g, P.legnoScuro, 28, 0, 1, 32); // chiodi e travi
    strata(g, [[P.legno, 3], [P.legnoScuro, 32]]);
  },
  riva: (g, r) => { px(g, P.sabbiaChiara, 0, 0, 32, 32); speckle(g, r, P.sabbia, 60, 0, 32); strata(g, [[P.sabbia, 2], [P.legnoChiaro, 32]]); },
  // Porto: lastre di pietra a file sfalsate (giunti scuri), qualche lastra più chiara; il fianco resta di sabbia (sta sull'isola).
  lastricato: (g, r) => {
    px(g, P.pietra, 0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) {
      px(g, P.pietraScura, 0, y, 32, 1);
      const off = (y / 8) % 2 ? 6 : 0;
      for (let x = off; x < 32 + 12; x += 12) px(g, P.pietraScura, x % 32, y, 1, 8);
      if (r.next() < 0.5) px(g, P.pietraChiara, r.int(1, 20), y + 2, r.int(3, 8), 3);
    }
    speckle(g, r, P.pietraChiara, 20, 0, 32); speckle(g, r, P.pietraScura, 12, 0, 32);
    strata(g, [[P.pietra, 3], [P.legnoChiaro, 5], [P.legno, 32]]);
  },
  // Distretto Neon: cemento a piastre da 1 m con giunti, macchie di bagnato; fianco di calcestruzzo scuro (banchina).
  cemento: (g, r) => {
    px(g, P.pietraScura, 0, 0, 32, 32);
    for (let i = 0; i < 32; i += 16) { px(g, P.roccia, i, 0, 1, 32); px(g, P.roccia, 0, i, 32, 1); }
    speckle(g, r, P.pietra, 18, 0, 32); speckle(g, r, P.roccia, 26, 0, 32, 2, 1);
    strata(g, [[P.pietraScura, 2], [P.roccia, 10], [P.neroCaldo, 32]]);
    speckle(g, r, P.pietraScura, 12, 36, 44, 2, 1);
  },
};

/** Blocco con UV per 16 texel/m: faccia sopra nella metà alta della texture, fianchi nella metà bassa (riga 0 = bordo superiore). */
export function block(w: number, d: number, top: number, bottom: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, top - bottom, d); g.translate(0, (top + bottom) / 2, 0);
  const pos = g.attributes.position!, nor = g.attributes.normal!, uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = nor.getX(i), ny = nor.getY(i);
    if (ny > 0.5) uv.setXY(i, (x + w / 2) / 2, 1 - ((z + d / 2) / 2) * 0.5);
    else if (ny < -0.5) uv.setXY(i, 0.5, 0.02);
    else uv.setXY(i, ((Math.abs(nx) > 0.5 ? z : x) + 1) / 2, 0.5 - (top - y) / 4);
  }
  return g;
}

// ——— segnaposto dei prop (colori per vertice dalla palette, un materiale condiviso) ———
export function painted(geo: THREE.BufferGeometry, color: string, m?: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color), n = g.attributes.position!.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export const M = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
export function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return g;
}
export type PropKind = 'palma' | 'cespuglio' | 'sasso' | 'cassa' | 'barile' | 'torii' | 'lanterna' | 'insegna_neon' | 'filo_lanterne' | 'fac_neon' | 'fac_selvaggia';
export function propGeometry(kind: PropKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'palma') {
    // Tronco a 3 segmenti leggermente curvi, ciuffo di 6 foglie cadenti, cocchi.
    parts.push(painted(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 5), P.legnoChiaro, M(0, 0.6, 0)));
    parts.push(painted(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 5), P.legno, M(0.08, 1.75, 0, 0, 0, -0.12)));
    parts.push(painted(new THREE.CylinderGeometry(0.11, 0.14, 1.1, 5), P.legnoChiaro, M(0.25, 2.85, 0, 0, 0, -0.2)));
    // Foglie a due tratti: la base sale appena, la punta ricade (più stretta). 7 foglie a raggiera, due verdi alternati.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.2, c = i % 2 ? P.erbaScura : P.erba;
      const root = M(0.35, 3.4, 0, 0, a, 0);
      const base = new THREE.BoxGeometry(0.34, 0.05, 0.9); base.translate(0, 0, 0.45);
      parts.push(painted(base, c, root.clone().multiply(M(0, 0, 0, -0.25, 0, 0))));
      const tip = new THREE.BoxGeometry(0.22, 0.05, 0.85); tip.translate(0, 0, 0.42);
      parts.push(painted(tip, c, root.clone().multiply(M(0, 0.2, 0.87, 0.75, 0, 0))));
    }
    parts.push(painted(new THREE.IcosahedronGeometry(0.2, 0), P.legnoScuro, M(0.35, 3.2, 0)));
  } else if (kind === 'cespuglio') {
    parts.push(painted(new THREE.IcosahedronGeometry(0.55, 0), P.erbaScura, M(0, 0.35, 0, 0, 0, 0, 1, 0.75, 1)));
    parts.push(painted(new THREE.IcosahedronGeometry(0.38, 0), P.bosco, M(0.45, 0.25, 0.2, 0, 0.6, 0, 1, 0.8, 1)));
    parts.push(painted(new THREE.IcosahedronGeometry(0.3, 0), P.erba, M(-0.3, 0.45, -0.25)));
  } else if (kind === 'sasso') {
    parts.push(painted(new THREE.DodecahedronGeometry(0.5, 0), P.pietra, M(0, 0.22, 0, 0.3, 0, 0.2, 1.1, 0.65, 0.85)));
    parts.push(painted(new THREE.DodecahedronGeometry(0.28, 0), P.pietraScura, M(0.5, 0.12, 0.25, 0.5, 0.4, 0)));
  } else if (kind === 'cassa') {
    parts.push(painted(new THREE.BoxGeometry(0.8, 0.8, 0.8), P.legnoChiaro, M(0, 0.4, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.84, 0.12, 0.84), P.legno, M(0, 0.62, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.84, 0.12, 0.84), P.legno, M(0, 0.18, 0)));
  } else if (kind === 'torii') {
    // Due pali rossi, trave bassa (nuki) e architrave nero ricurvo (kasagi) che sporge.
    for (const s of [-1, 1]) parts.push(painted(new THREE.CylinderGeometry(0.14, 0.16, 2.9, 6), P.rosso, M(s * 1.3, 1.45, 0)));
    parts.push(painted(new THREE.BoxGeometry(3.0, 0.2, 0.2), P.rosso, M(0, 2.35, 0)));
    parts.push(painted(new THREE.BoxGeometry(3.6, 0.22, 0.34), P.neroCaldo, M(0, 2.95, 0)));
    for (const s of [-1, 1]) parts.push(painted(new THREE.BoxGeometry(0.5, 0.2, 0.34), P.neroCaldo, M(s * 1.95, 3.02, 0, 0, 0, s * 0.25)));
  } else if (kind === 'lanterna') {
    // Palo di legno con braccio verso −Z e lanterna di carta rossa (il colore resta pieno: materiale non illuminato a parte non serve).
    parts.push(painted(new THREE.BoxGeometry(0.12, 2.0, 0.12), P.legnoScuro, M(0, 1.0, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.08, 0.08, 0.55), P.legnoScuro, M(0, 1.95, -0.25)));
    parts.push(painted(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 6), P.rosso, M(0, 1.62, -0.45)));
    parts.push(painted(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 6), P.neroCaldo, M(0, 1.84, -0.45)));
  } else if (kind === 'filo_lanterne') {
    for (const s of [-1, 1]) parts.push(painted(new THREE.BoxGeometry(0.12, 2.8, 0.12), P.legnoScuro, M(s * 2, 1.4, 0)));
    parts.push(painted(new THREE.BoxGeometry(4, 0.03, 0.03), P.neroCaldo, M(0, 2.6, 0)));
    for (const x of [-1.2, -0.4, 0.4, 1.2]) parts.push(painted(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 6), P.rosso, M(x, 2.4, 0)));
  } else if (kind === 'insegna_neon') {
    parts.push(painted(new THREE.BoxGeometry(0.1, 2.3, 0.1), P.roccia, M(0, 1.15, 0)));
    parts.push(painted(new THREE.BoxGeometry(1.2, 0.7, 0.12), P.rosaNeon, M(0, 1.9, 0)));
  } else {
    parts.push(painted(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 8), P.legno, M(0, 0.475, 0)));
    parts.push(painted(new THREE.CylinderGeometry(0.37, 0.37, 0.1, 8), P.legnoScuro, M(0, 0.25, 0)));
    parts.push(painted(new THREE.CylinderGeometry(0.37, 0.37, 0.1, 8), P.legnoScuro, M(0, 0.72, 0)));
  }
  return merged(parts);
}
export const PROP_MODEL: Partial<Record<PropKind, string>> = { palma: 'prop_palma', cassa: 'prop_cassa', barile: 'prop_barile', torii: 'prop_torii', lanterna: 'prop_lanterna', insegna_neon: 'prop_insegna_neon', filo_lanterne: 'prop_filo_lanterne', fac_neon: 'fac_neon', fac_selvaggia: 'fac_selvaggia' };
export const PROP_KINDS = new Set<string>(Object.keys(PROP_MODEL).concat(['cespuglio', 'sasso']));
/** Facciate lontane: solo col modello (niente segnaposto). */
export const MODEL_ONLY = new Set<string>(['fac_neon', 'fac_selvaggia']);

/** Segnaposto di un edificio del Porto: casa (corpo di legno, tetto scuro a falde, porta verso −Z) o tavolo. */
export function buildingGeometry(kind: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'tavolo') {
    parts.push(painted(new THREE.BoxGeometry(1.6, 0.12, 1.0), P.legno, M(0, 0.8, 0)));
    for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]] as const) parts.push(painted(new THREE.BoxGeometry(0.1, 0.8, 0.1), P.legnoScuro, M(x, 0.4, z)));
  } else {
    parts.push(painted(new THREE.BoxGeometry(2.2, 1.9, 1.8), P.legnoChiaro, M(0, 0.95, 0)));
    parts.push(painted(new THREE.ConeGeometry(1.9, 1.1, 4), P.roccia, M(0, 2.45, 0, 0, Math.PI / 4, 0, 1, 1, 0.85)));
    parts.push(painted(new THREE.BoxGeometry(0.6, 1.1, 0.06), P.legnoScuro, M(0, 0.55, -0.92)));
  }
  return merged(parts);
}

/** Torri del Distretto Neon: corpo di cemento a piani, finestre scure o accese (materiale non illuminato), bordo neon su alcuni tetti. */
export function towerGeometry(cells: { x: number; z: number; floors: number; tone: number }[], r: Rng): { body: THREE.BufferGeometry | null; lights: THREE.BufferGeometry | null } {
  const body: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [];
  const FLOOR = 3, LIT = [P.ambraNeon, P.ambraNeon, P.cianoNeon, P.cianoNeon, P.rosaNeon, P.violaNeon];
  for (const c of cells) {
    const top = ISLAND.TOP + c.floors * FLOOR;
    body.push(painted(new THREE.BoxGeometry(2, top - ISLAND.BOTTOM, 2), c.tone ? P.roccia : P.pietraScura, M(c.x, (top + ISLAND.BOTTOM) / 2, c.z)));
    body.push(painted(new THREE.BoxGeometry(2.08, 0.22, 2.08), P.neroCaldo, M(c.x, top + 0.05, c.z)));
    for (let f = 0; f < c.floors; f++) {
      const y = ISLAND.TOP + f * FLOOR + 1.6;
      for (const [dx, dz, ry] of [[0, 1.015, 0], [1.015, 0, Math.PI / 2], [0, -1.015, Math.PI], [-1.015, 0, -Math.PI / 2]] as const) {
        const lit = r.next() < 0.42;
        const g = painted(new THREE.PlaneGeometry(1.5, 0.8), lit ? LIT[r.int(0, LIT.length - 1)]! : P.neroCaldo, M(c.x + dx, y, c.z + dz, 0, ry, 0));
        (lit ? lights : body).push(g);
      }
    }
    if (r.next() < 0.3) lights.push(painted(new THREE.BoxGeometry(2.12, 0.14, 2.12), r.next() < 0.5 ? P.rosaNeon : P.cianoNeon, M(c.x, top - 0.35, c.z)));
  }
  return { body: body.length ? merged(body) : null, lights: lights.length ? merged(lights) : null };
}

/** Quota della faccia rivolta in su con più area (il piano calpestabile di un modulo). */
export function floorY(geos: THREE.BufferGeometry[]): number {
  const hist = new Map<number, number>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (const g of geos) {
    const pos = g.attributes.position!, idx = g.index, tri = idx ? idx.count / 3 : pos.count / 3;
    for (let i = 0; i < tri; i++) {
      const i0 = idx ? idx.getX(i * 3) : i * 3, i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1, i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      n.subVectors(c, b).cross(b.clone().sub(a).negate());
      const area = n.length() / 2; if (area < 1e-6) continue;
      if (Math.abs(n.y) / (2 * area) < 0.95) continue;
      const y = Math.round(((a.y + b.y + c.y) / 3) * 100) / 100;
      hist.set(y, (hist.get(y) ?? 0) + area);
    }
  }
  let best: number = ISLAND.TOP, bestA = -1;
  for (const [y, ar] of hist) if (ar > bestA) { bestA = ar; best = y; }
  return best;
}

/**
 * Copia della geometria con posizione e normale in Float32. I glb dell'export sono quantizzati (int16 normalizzati, la scala sta nel
 * nodo): applyMatrix4 su un attributo normalizzato tronca a ±1 e schiaccia il modello (palme, torii, case).
 */
export function floatGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = src.clone();
  for (const name of ['position', 'normal'] as const) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a || (a.array instanceof Float32Array && !a.normalized)) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  return g;
}

// ——— moduli glTF: geometria allineata una volta per nome (condivisa da tutte le isole), poi un InstancedMesh per sotto-mesh e isola ———
export type Fit = 'terrain' | 'prop';
export type Parts = { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[];
const partsCache = new WeakMap<Loader, Map<string, Promise<Parts | null>>>();
export function modelParts(loader: Loader, name: string, fit: Fit): Promise<Parts | null> {
  if (!loader.has(name)) return Promise.resolve(null);
  let cache = partsCache.get(loader);
  if (!cache) { cache = new Map(); partsCache.set(loader, cache); }
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      try {
        const { scene } = await loader.load(name);
        scene.updateMatrixWorld(true);
        const parts: Parts = [];
        scene.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh) parts.push({ geo: floatGeometry(m.geometry).applyMatrix4(m.matrixWorld), mat: m.material }); });
        if (!parts.length) return null;
        const box = new THREE.Box3();
        for (const q of parts) { q.geo.computeBoundingBox(); box.union(q.geo.boundingBox!); }
        const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
        const align = new THREE.Matrix4();
        if (fit === 'terrain') {
          // Moduli WP5: 2×2 m, pivot a terra (base a y = 0 = livello del mare). I moduli calpestabili si allineano per il piano
          // (la faccia in su più grande: 0,4 sabbia, 0,6 erba, 0,5 molo) a ISLAND.TOP, dove sta l'avatar; la scogliera resta com'è.
          const sx = Math.abs(size.x - 2) > 0.3 ? 2 / size.x : 1, sz = Math.abs(size.z - 2) > 0.3 ? 2 / size.z : 1;
          const dy = name === 'mod_scogliera' ? -box.min.y : ISLAND.TOP - floorY(parts.map((q) => q.geo));
          align.makeScale(sx, 1, sz).premultiply(new THREE.Matrix4().makeTranslation(-ctr.x * sx, dy, -ctr.z * sz));
        } else align.makeTranslation(0, -box.min.y, 0); // prop ed edifici: poggiano a terra
        for (const q of parts) { q.geo.applyMatrix4(align); q.geo.computeBoundingSphere(); }
        return parts;
      } catch (e) { console.warn(String((e as Error)?.message ?? e), '→ segnaposto'); return null; }
    })();
    cache.set(name, p);
  }
  return p;
}

export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], mats: THREE.Matrix4[], name: string, cast: boolean): THREE.InstancedMesh | null {
  if (!mats.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  im.castShadow = cast; im.receiveShadow = true; im.name = name;
  return im;
}
