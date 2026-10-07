// Prova 3D dipinto (issue #38): texture "a pennellate" generate da codice + materiale dipinto comune + Builder che fonde i pezzi.
// Un solo materiale per tutto il mondo statico = coerenza di stile e poche draw call. Ogni pezzo porta: colore (con variazione
// per faccia e ombra finta alla base), motivo (PAT) mappato in metri del mondo, stessa densità ovunque.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAT = { BRUSH: 0, COBBLE: 1, PLANKS: 2, ROOF: 3, BRICK: 4, PLASTER: 5, GRASS: 6, ROCK: 7 } as const;
/** Metri coperti da una ripetizione del motivo. */
const PAT_SCALE = [2.5, 2.2, 2.4, 1.6, 2.0, 3.0, 2.0, 4.0];
const SIZE = 256, LAYERS = 8;

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- motivi in scala di grigio (media 0,5: il colore lo dà il vertice) ----------
type G = Float32Array;
const at = (x: number, y: number) => (((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE);
function blank(v = 0.5): G { return new Float32Array(SIZE * SIZE).fill(v); }
/** Pennellata ellittica morbida, ripetuta sui bordi (texture senza cuciture). */
function stroke(g: G, cx: number, cy: number, len: number, wid: number, ang: number, val: number, a: number) {
  const c = Math.cos(ang), s = Math.sin(ang), r = Math.ceil(len);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const u = (dx * c + dy * s) / len, v = (-dx * s + dy * c) / wid, d = u * u + v * v;
    if (d >= 1) continue;
    const i = at(Math.round(cx + dx), Math.round(cy + dy)), k = a * (1 - d) * (1 - d);
    g[i] = g[i]! + (val - g[i]!) * k;
  }
}
function brushy(g: G, r: () => number, n: number, len: number, wid: number, ang: number, amp: number, a = 0.35) {
  for (let i = 0; i < n; i++) stroke(g, r() * SIZE, r() * SIZE, len * (0.6 + r() * 0.8), wid * (0.6 + r() * 0.8), ang + (r() - 0.5) * 0.6, 0.5 + (r() - 0.5) * amp, a);
}
/** Celle di Voronoi a ripetizione: [id, d1, d2] per pixel. */
function voronoi(r: () => number, cells: number, jitter: number) {
  const pts: number[] = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push((i + 0.5 + (r() - 0.5) * jitter) * SIZE / cells, (j + 0.5 + (r() - 0.5) * jitter) * SIZE / cells);
  const id = new Int32Array(SIZE * SIZE), d1 = new Float32Array(SIZE * SIZE), d2 = new Float32Array(SIZE * SIZE), cs = SIZE / cells;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let a = 1e9, b = 1e9, ai = 0; const ci = Math.floor(x / cs), cj = Math.floor(y / cs);
    for (let oj = -2; oj <= 2; oj++) for (let oi = -2; oi <= 2; oi++) {
      const ii = (ci + oi + cells) % cells, jj = (cj + oj + cells) % cells, k = jj * cells + ii;
      const px = pts[k * 2]! + (ci + oi - ii) * cs, py = pts[k * 2 + 1]! + (cj + oj - jj) * cs;
      const d = Math.hypot(x - px, y - py);
      if (d < a) { b = a; a = d; ai = k; } else if (d < b) b = d;
    }
    id[y * SIZE + x] = ai; d1[y * SIZE + x] = a; d2[y * SIZE + x] = b;
  }
  return { id, d1, d2 };
}
function blur(g: G, rad: number): G {
  const o = new Float32Array(g.length), t = new Float32Array(g.length), n = rad * 2 + 1;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { let s = 0; for (let k = -rad; k <= rad; k++) s += g[at(x + k, y)]!; t[y * SIZE + x] = s / n; }
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { let s = 0; for (let k = -rad; k <= rad; k++) s += t[at(x, y + k)]!; o[y * SIZE + x] = s / n; }
  return o;
}

function patBrush(r: () => number): G { const g = blank(); brushy(g, r, 900, 22, 6, 0.4, 0.5); return blur(g, 1); }
function patCobble(r: () => number): G {
  const { id, d1, d2 } = voronoi(r, 7, 0.8), g = blank(), tone = Array.from({ length: 49 }, () => 0.42 + r() * 0.2);
  for (let i = 0; i < g.length; i++) {
    const edge = d2[i]! - d1[i]!;
    g[i] = edge < 2.2 ? 0.12 : tone[id[i]!]! + Math.min(0.12, (edge - 2.2) * 0.012) - (d1[i]! > 13 ? 0.03 : 0);
  }
  brushy(g, r, 400, 10, 3, 0.2, 0.25, 0.25);
  return blur(g, 1);
}
function patPlanks(r: () => number): G {
  const g = blank(), rows = 6, h = SIZE / rows;
  for (let j = 0; j < rows; j++) {
    const joint = Math.floor(r() * SIZE), tone = 0.42 + r() * 0.2;
    for (let y = 0; y < h; y++) for (let x = 0; x < SIZE; x++) {
      const yy = Math.floor(j * h + y), grain = Math.sin((x * 0.05 + Math.sin(x * 0.013 + j) * 3 + y * 0.9) * 1.7) * 0.03;
      const gap = y < 3 || Math.abs(((x - joint + SIZE) % SIZE)) < 2;
      g[yy * SIZE + x] = gap ? 0.12 : tone + grain + (y < 7 ? 0.05 : 0) - (y > h - 6 ? 0.06 : 0);
    }
  }
  brushy(g, r, 500, 26, 3, 0, 0.2, 0.25);
  return blur(g, 1);
}
function patRoof(r: () => number): G {
  const g = blank(), rows = 8, cols = 8, h = SIZE / rows, w = SIZE / cols;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const j = Math.floor(y / h), off = (j % 2) * w * 0.5, xx = ((x + off) % w) / w - 0.5, yy = (y % h) / h;
    const bottom = 0.75 + Math.sqrt(Math.max(0, 0.25 - xx * xx)) * 0.5;
    g[y * SIZE + x] = yy > bottom ? 0.18 : 0.62 - yy * 0.22 - Math.abs(xx) * 0.12 + (((j * 7 + Math.floor((x + off) / w)) * 13) % 5) * 0.025;
  }
  brushy(g, r, 300, 12, 3, 0, 0.2, 0.2);
  return blur(g, 1);
}
function patBrick(r: () => number): G {
  const g = blank(), rows = 7, h = SIZE / rows;
  for (let j = 0; j < rows; j++) {
    let x0 = Math.floor(r() * 30);
    while (x0 < SIZE + 60) {
      const bw = 34 + r() * 40, tone = 0.42 + r() * 0.2;
      for (let y = 0; y < h; y++) for (let x = Math.floor(x0); x < x0 + bw; x++) {
        const mortar = y < 4 || x - x0 < 4;
        g[at(x, Math.floor(j * h + y))] = mortar ? 0.2 : tone + (y < 8 ? 0.06 : 0) - (y > h - 7 ? 0.05 : 0);
      }
      x0 += bw;
    }
  }
  brushy(g, r, 300, 12, 4, 0.3, 0.25, 0.25);
  return blur(g, 1);
}
function patPlaster(r: () => number): G { const g = blank(); brushy(g, r, 260, 40, 18, 0.8, 0.28, 0.3); brushy(g, r, 500, 14, 4, 0.5, 0.18, 0.3); return blur(g, 2); }
function patGrass(r: () => number): G { const g = blank(); brushy(g, r, 2200, 9, 2.2, 1.2, 0.6, 0.5); return blur(g, 1); }
function patRock(r: () => number): G {
  const { d1, d2 } = voronoi(r, 5, 0.9), g = blank();
  for (let i = 0; i < g.length; i++) { const e = d2[i]! - d1[i]!; g[i] = e < 3 ? 0.22 : 0.5 + Math.min(0.1, e * 0.004) - d1[i]! * 0.003; }
  brushy(g, r, 700, 30, 4, 0, 0.35, 0.3);
  return blur(g, 1);
}

let cachedTex: THREE.DataArrayTexture | null = null;
export function patternTexture(): THREE.DataArrayTexture {
  if (cachedTex) return cachedTex;
  const r = rng(38);
  const layers = [patBrush, patCobble, patPlanks, patRoof, patBrick, patPlaster, patGrass, patRock].map((f) => f(r));
  const data = new Uint8Array(SIZE * SIZE * LAYERS);
  layers.forEach((g, l) => {
    let m = 0; for (const v of g) m += v; m /= g.length; // media riportata a 0,5: il motivo non scurisce né schiarisce il colore
    for (let i = 0; i < g.length; i++) data[l * SIZE * SIZE + i] = Math.max(0, Math.min(255, Math.round((g[i]! - m + 0.5) * 255)));
  });
  const t = new THREE.DataArrayTexture(data, SIZE, SIZE, LAYERS);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  cachedTex = t;
  return t;
}

/** Uniform condivisi da tutti i materiali dipinti (luce di controluce, intensità del motivo). */
export const PAINT_UNIFORMS = { uRim: { value: new THREE.Color('#ffb27a').multiplyScalar(0.55) }, uPatAmt: { value: 0.85 } };

/** Materiale dipinto: Lambert + motivo a pennellate + controluce caldo sui bordi. */
export function paintedMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms['uPat'] = { value: patternTexture() };
    sh.uniforms['uRim'] = PAINT_UNIFORMS.uRim;
    sh.uniforms['uPatAmt'] = PAINT_UNIFORMS.uPatAmt;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float pat;\nattribute vec2 puv;\nvarying float vPat;\nvarying vec2 vPuv;\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat = pat; vPuv = puv; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray uPat;\nuniform vec3 uRim;\nuniform float uPatAmt;\nvarying float vPat;\nvarying vec2 vPuv;\nvarying vec3 vWp;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat pv = texture(uPat, vec3(vPuv, floor(vPat + 0.5))).r;\ndiffuseColor.rgb *= mix(1.0, pv * 2.0, uPatAmt);\nfloat mac = texture(uPat, vec3(vWp.xz * 0.045 + vWp.y * 0.02, 0.0)).r * 0.6 + texture(uPat, vec3(vWp.zx * 0.011, 5.0)).r * 0.4;\ndiffuseColor.rgb *= mix(vec3(0.82, 0.86, 0.95), vec3(1.14, 1.08, 0.96), smoothstep(0.3, 0.7, mac));')
      .replace('#include <opaque_fragment>', 'float fr = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);\noutgoingLight += uRim * fr * fr * fr * diffuseColor.rgb;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'painted-v2';
  return m;
}

// ---------- Builder: pezzi → una geometria per materiale ----------
export type PartOpts = {
  /** Variazione casuale di luminosità per faccia (0..1). */
  jitter?: number;
  /** Ombra finta alla base del pezzo: 0 = niente, 0,4 = base al 60%. */
  grad?: number;
  /** Normali lisce (fogliame, teste) invece che sfaccettate. */
  smooth?: boolean;
  /** Variazione di tinta per faccia (spostamento verso caldo/freddo). */
  hue?: number;
};
const tmpC = new THREE.Color(), tmpN = new THREE.Vector3();

export class Builder {
  private parts: THREE.BufferGeometry[] = [];
  private r: () => number;
  constructor(seed = 1) { this.r = rng(seed); }
  get count() { return this.parts.length; }
  /** Aggiunge un pezzo: geometria locale, matrice nel mondo, colore (hex o Color), motivo. */
  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.ColorRepresentation, pat: number = PAT.BRUSH, o: PartOpts = {}): this {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv'); if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
    g.applyMatrix4(m);
    if (o.smooth) { g = smoothNormals(g); } else g.computeVertexNormals();
    const pos = g.getAttribute('position') as THREE.BufferAttribute, nor = g.getAttribute('normal') as THREE.BufferAttribute, n = pos.count;
    g.computeBoundingBox();
    const bb = g.boundingBox!, h = Math.max(1e-3, bb.max.y - bb.min.y);
    const col = new Float32Array(n * 3), puv = new Float32Array(n * 2), pa = new Float32Array(n).fill(pat), sc = PAT_SCALE[pat] ?? 2;
    const base = new THREE.Color(color), jit = o.jitter ?? 0.08, grad = o.grad ?? 0.25, hue = o.hue ?? 0.015;
    for (let f = 0; f < n; f += 3) {
      const lj = 1 + (this.r() - 0.5) * 2 * jit, hj = (this.r() - 0.5) * 2 * hue;
      // mappatura a cubo per faccia (asse dominante della normale), in metri: densità del motivo uguale su tutti i pezzi
      tmpN.set(0, 0, 0); for (let k = 0; k < 3; k++) tmpN.add(new THREE.Vector3(nor.getX(f + k), nor.getY(f + k), nor.getZ(f + k)));
      const ax = Math.abs(tmpN.x), ay = Math.abs(tmpN.y), az = Math.abs(tmpN.z);
      for (let k = f; k < f + 3 && k < n; k++) {
        const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
        if (ay >= ax && ay >= az) { puv[k * 2] = x / sc; puv[k * 2 + 1] = z / sc; }
        else if (ax >= az) { puv[k * 2] = z / sc; puv[k * 2 + 1] = -y / sc; }
        else { puv[k * 2] = x / sc; puv[k * 2 + 1] = -y / sc; }
        const t = (y - bb.min.y) / h, shade = 1 - grad * (1 - t) * (1 - t);
        tmpC.copy(base).offsetHSL(hj, 0, 0).multiplyScalar(lj * shade);
        col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('puv', new THREE.BufferAttribute(puv, 2));
    g.setAttribute('pat', new THREE.BufferAttribute(pa, 1));
    this.parts.push(g);
    return this;
  }
  /** Una sola geometria con tutti i pezzi (null se vuoto). */
  geometry(): THREE.BufferGeometry | null {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}

/** Normali lisce su geometria non indicizzata: media per posizione (saldatura per vicinanza). */
function smoothNormals(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeVertexNormals();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal') as THREE.BufferAttribute, acc = new Map<string, THREE.Vector3>();
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  for (let i = 0; i < pos.count; i++) { const k = key(i); const v = acc.get(k) ?? new THREE.Vector3(); v.x += nor.getX(i); v.y += nor.getY(i); v.z += nor.getZ(i); acc.set(k, v); }
  for (let i = 0; i < pos.count; i++) { const v = acc.get(key(i))!.clone().normalize(); nor.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

/** Matrice da posizione, rotazione Y (radianti) e scala. */
export function M(x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}
