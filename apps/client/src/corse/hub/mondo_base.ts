// Attrezzi dell'hub delle Corse (#185): rumore, tessere dell'atlas, e la «tela» dove si costruisce la geometria procedurale
// (terreno, strade, ponti, trampolini, segnaposto) già con le UV sull'atlas. Così terreno, strade e pezzi del kit stanno nello
// stesso materiale e si fondono in UNA mesh per riquadro. Prima che l'atlas arrivi la tela ha anche i colori della palette
// (`pre`): la stessa geometria si vede subito a colori pieni, poi con le texture a pixel.
import * as THREE from 'three';
import { P } from '../../render/island_parts.ts';

export type V2 = [number, number];
export type V3 = [number, number, number];
export type NomeP = keyof typeof P;

// ---------- rumore deterministico ----------
export const h01 = (x: number, y: number, s = 0): number => {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1274126177)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) & 0xffff) / 65536;
};
/** Rumore morbido a valori, 0..1. */
export function rumore(x: number, z: number, k: number, seed: number): number {
  const fx = x / k, fz = z / k, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const a = h01(i, j, seed), b = h01(i + 1, j, seed), c = h01(i, j + 1, seed), d = h01(i + 1, j + 1, seed);
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
export const liscio = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Generatore pseudo-casuale col seme (solo resa: il client può usare Math, ma la scena deve venire uguale a ogni apertura). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return ((s >>> 8) & 0xffff) / 65536; };
}
/** Distanza da un segmento in pianta. */
export function distSeg(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
/** Angolo `ry` che fa guardare il davanti dei modelli (−Z) verso la direzione (dx, dz). */
export const guarda = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

// ---------- l'atlas (assets/blender/atlas.py: le regioni esistenti non si spostano mai) ----------
/** Tessere 64×64 (4 m a 16 texel/m) o 32×32 (2 m): [u0, v0, lato] in texel; `c` = il colore medio (resa prima dell'atlas). */
export const TESSERE = {
  sabbia: { t: [0, 0, 64], c: P.sabbia },
  sabbiaBagnata: { t: [128, 0, 64], c: P.legnoChiaro },
  erbaA: { t: [192, 0, 64], c: P.erba },
  erbaB: { t: [256, 0, 64], c: P.erbaScura },
  roccia: { t: [384, 0, 64], c: P.pietra },
  tavole: { t: [512, 0, 64], c: P.legnoChiaro },
  tegole: { t: [704, 0, 64], c: P.roccia },
  pietraMuro: { t: [832, 0, 64], c: P.pietra },
  intonaco: { t: [896, 0, 64], c: P.sabbiaChiara },
  terra: { t: [960, 0, 64], c: P.legno },
  corteccia: { t: [0, 64, 64], c: P.legnoScuro },
  acquaBassa: { t: [192, 64, 64], c: P.acquaBassa },
  metallo: { t: [256, 64, 64], c: P.roccia },
  cemento: { t: [320, 64, 64], c: P.pietra },
  legnoScuro: { t: [384, 64, 64], c: P.legnoScuro },
  rossoLacca: { t: [512, 64, 64], c: P.rosso },
  pietraLiscia: { t: [640, 64, 64], c: P.pietra },
  ghiaia: { t: [704, 64, 64], c: P.pietraScura },
  erbaAlta: { t: [768, 64, 64], c: P.erbaScura },
  muschio: { t: [832, 64, 64], c: P.erbaScura },
  neve: { t: [896, 64, 64], c: P.pietraChiara }, // «faro_bianco»: bianco con puntini, la neve
  scacchi: { t: [480, 448, 32], c: P.pietra },   // cs_scacchi
  chevron: { t: [448, 448, 32], c: P.rosso },     // cs_chevron
  pericolo: { t: [576, 448, 32], c: P.giallo },   // cs_pericolo (giallo e nero)
  tendaRossa: { t: [192, 448, 32], c: P.rosso },
  tendaBlu: { t: [224, 448, 32], c: P.acquaProfonda },
  gomme: { t: [704, 448, 32], c: P.neroCaldo },
  emLanterna: { t: [0, 896, 32], c: P.ambraNeon },
  emRosa: { t: [32, 896, 32], c: P.rosaNeon },
  emCiano: { t: [64, 896, 32], c: P.cianoNeon },
  emViola: { t: [96, 896, 32], c: P.violaNeon },
  emFinestra: { t: [128, 896, 32], c: P.giallo },
  emVerde: { t: [192, 896, 32], c: P.verdeNeon },
  emAmbra: { t: [224, 896, 32], c: P.ambraNeon },
  emFuoco: { t: [0, 928, 32], c: P.arancio },
  emRosso: { t: [64, 928, 32], c: P.rossoNeon },
} as const;
export type Tessera = keyof typeof TESSERE;
/** Ordine dei colori in atlas.py (`p_<nome>`: campioni piatti 8×8 a y 640). */
const ORDINE_P: NomeP[] = ['sabbiaChiara', 'sabbia', 'legnoChiaro', 'legno', 'legnoScuro', 'ombraCalda', 'erbaChiara', 'erba', 'erbaScura', 'bosco', 'boscoOmbra',
  'acquaBassa', 'acqua', 'acquaProfonda', 'abisso', 'pietraChiara', 'pietra', 'pietraScura', 'roccia', 'neroCaldo', 'rosso', 'arancio', 'giallo', 'viola',
  'rosaNeon', 'cianoNeon', 'verdeNeon', 'ambraNeon', 'violaNeon', 'rossoNeon'];
const A = 1 / 1024;
/** UV del centro del campione piatto di un colore della palette. */
export function uvP(c: NomeP): V2 { const i = ORDINE_P.indexOf(c); return [(i * 8 + 4) * A, (640 + 4) * A]; }
/** Un «pennello»: colore pieno della palette o tessera dell'atlas, con una tinta (grigio, moltiplica: ombre, asfalto scuro). */
export type Pennello = { p: NomeP; tinta?: number } | { t: Tessera; tinta?: number };
const C = new THREE.Color();
function rgb(hex: string, k: number): V3 { C.set(hex); return [C.r * k, C.g * k, C.b * k]; }

// ---------- la tela ----------
/** Geometria non indicizzata con posizione, normale (piatta), uv sull'atlas, colore «pre» (prima dell'atlas) e tinta (dopo). */
export class Tela {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; pre: number[] = []; tin: number[] = [];
  get triangoli(): number { return this.pos.length / 9; }
  /** Un triangolo con UV date (in unità dell'atlas 0..1). */
  tri(a: V3, b: V3, c: V3, ua: V2, ub: V2, uc: V2, pre: V3, tinta: number | V3): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const [tr, tg, tb] = typeof tinta === 'number' ? [tinta, tinta, tinta] : tinta;
    for (let k = 0; k < 3; k++) { this.nor.push(nx, ny, nz); this.pre.push(pre[0], pre[1], pre[2]); this.tin.push(tr, tg, tb); }
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }
  /** Quadrilatero a b c d (in giro) con un pennello: colore pieno, o tessera mappata con le coordinate locali (m) date per ogni vertice. */
  quad(a: V3, b: V3, c: V3, d: V3, pen: Pennello, loc?: [V2, V2, V2, V2]): void {
    const tinta = pen.tinta ?? 1;
    if ('p' in pen) {
      const u = uvP(pen.p), pre = rgb(P[pen.p], tinta);
      this.tri(a, b, c, u, u, u, pre, tinta); this.tri(a, c, d, u, u, u, pre, tinta);
      return;
    }
    const T = TESSERE[pen.t], [u0, v0, lato] = T.t, pre = rgb(T.c, tinta), m = lato / 16; // lato della tessera in metri
    const l = loc ?? [[0, 0], [m, 0], [m, m], [0, m]];
    const uvq = (q: V2): V2 => [(u0 + 0.02 + Math.min(lato - 0.04, Math.max(0, q[0] * 16))) * A, (v0 + 0.02 + Math.min(lato - 0.04, Math.max(0, q[1] * 16))) * A];
    this.tri(a, b, c, uvq(l[0]), uvq(l[1]), uvq(l[2]), pre, tinta); this.tri(a, c, d, uvq(l[0]), uvq(l[2]), uvq(l[3]), pre, tinta);
  }
  /**
   * Faccia piana a b c d con la tessera ripetuta: si divide in pezzi che stanno dentro una tessera (le regioni dell'atlas non si
   * ripetono da sole). `w`, `h` = misure della faccia in metri lungo a→b e a→d.
   */
  faccia(a: V3, b: V3, d: V3, pen: Pennello, w: number, h: number): void {
    if ('p' in pen) { const c: V3 = [b[0] + d[0] - a[0], b[1] + d[1] - a[1], b[2] + d[2] - a[2]]; this.quad(a, b, c, d, pen); return; }
    const m = TESSERE[pen.t].t[2] / 16, nu = Math.max(1, Math.ceil(w / m - 1e-3)), nv = Math.max(1, Math.ceil(h / m - 1e-3));
    const at = (u: number, v: number): V3 => [a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v, a[2] + (b[2] - a[2]) * u + (d[2] - a[2]) * v];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u0 = (i * m) / w, u1 = Math.min(1, ((i + 1) * m) / w), v0 = (j * m) / h, v1 = Math.min(1, ((j + 1) * m) / h);
      const lu = (u1 - u0) * w, lv = (v1 - v0) * h;
      this.quad(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1), pen, [[0, m - lv], [lu, m - lv], [lu, m], [0, m]].map(([x, y]) => [x, y]) as [V2, V2, V2, V2]);
    }
  }
  /** Scatola orientata: centro della base (x, y, z), misure (larghezza x, altezza, profondità z), rotazione ry. Pennelli: lati, sopra. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, ry: number, lati: Pennello, sopra: Pennello = lati, sotto = false): void {
    const c = Math.cos(ry), s = Math.sin(ry);
    const pt = (lx: number, ly: number, lz: number): V3 => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const W = w / 2, D = d / 2;
    const v = [pt(-W, 0, -D), pt(W, 0, -D), pt(W, 0, D), pt(-W, 0, D), pt(-W, h, -D), pt(W, h, -D), pt(W, h, D), pt(-W, h, D)];
    this.faccia(v[3]!, v[2]!, v[7]!, lati, w, h);       // davanti (+z locale)
    this.faccia(v[1]!, v[0]!, v[5]!, lati, w, h);       // dietro
    this.faccia(v[2]!, v[1]!, v[6]!, lati, d, h);       // destra
    this.faccia(v[0]!, v[3]!, v[4]!, lati, d, h);       // sinistra
    this.faccia(v[7]!, v[6]!, v[4]!, sopra, w, d);      // sopra
    if (sotto) this.faccia(v[0]!, v[1]!, v[3]!, lati, w, d);
  }
  /** Prisma a n lati (cilindro low-poly) o tronco di cono: base in (x, y, z), raggi r0 (sotto) e r1 (sopra). */
  prisma(x: number, y: number, z: number, r0: number, r1: number, h: number, n: number, lati: Pennello, sopra: Pennello | null = lati, giro = 0): void {
    for (let i = 0; i < n; i++) {
      const a0 = giro + (i / n) * Math.PI * 2, a1 = giro + ((i + 1) / n) * Math.PI * 2;
      const p0: V3 = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0], p1: V3 = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0];
      const q0: V3 = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1], q1: V3 = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
      const lw = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      if (Math.abs(r1 - r0) < 1e-4) this.faccia(p1, p0, q1, lati, lw, h);
      else if (r1 > 0.001) { const m = Math.min(4, lw), hh = Math.min(4, h); this.quad(p1, p0, q0, q1, lati, [[0, hh], [m, hh], [m, 0], [0, 0]]); } // tronco di cono: trapezi
      else this.quad(p1, p0, q0, q0, lati);
      if (sopra && r1 > 0.001) this.quad([x, y + h, z], q1, q0, q0, sopra);
    }
  }
  /** Unisce un'altra tela. */
  aggiungi(t: Tela): void { for (const k of ['pos', 'nor', 'uv', 'pre', 'tin'] as const) { const a = this[k], b = t[k]; for (let i = 0; i < b.length; i++) a.push(b[i]!); } }
}

/** La geometria della tela: `color` = colori pieni (prima dell'atlas); `userData.tinta` = i colori da mettere quando arriva l'atlas. */
export function geoTela(t: Tela): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(t.pre, 3));
  g.userData['tinta'] = new Float32Array(t.tin);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

/** Nebbia a bande (ART_BIBLE §7: niente gradienti lisci): il fattore della nebbia va a 6 gradini con un dithering 2×2. */
export function nebbiaABande(m: THREE.Material): void {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `
#ifdef USE_FOG
  float fogF = smoothstep( fogNear, fogFar, vFogDepth );
  vec2 fq = mod( floor( gl_FragCoord.xy ), 2.0 );
  float fb = mod( 2.0 * fq.x + 3.0 * fq.y, 4.0 ) / 4.0 + 0.125;
  fogF = clamp( floor( fogF * 6.0 + fb ) / 6.0, 0.0, 1.0 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogF );
#endif`);
  };
  m.customProgramCacheKey = () => 'marea_nebbia_bande';
}
