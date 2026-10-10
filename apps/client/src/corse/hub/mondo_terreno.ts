// L'isola dell'hub delle Corse (#185): la pianta (costa, quartieri, strade, piazza, pontile, trampolini) e il terreno.
// Tutto in metri, Y su, −Z nord. L'isola sta in ±220 m; la griglia del terreno è a 2 m su ±288 m (riquadri da 64 m).
// - `nat(x, z)`: il terreno «naturale» (costa frastagliata a rumore, spiaggia a sud-ovest e nella baia del paese, scogliere
//   altrove, montagna innevata a ovest, altopiano della giungla a nord, capo del fondale a sud-est, isolotti).
// - Le strade sono spezzate morbide (Catmull-Rom) campionate ogni metro; il profilo segue il terreno lisciato con la pendenza
//   limitata, i ponti hanno le quote date. Il terreno vicino alla strada si raccorda (terrapieni, trincee).
// - Le domande della guida (`quota`, `superficie`, `fuori`) leggono le griglie precalcolate e le strade: costano poco.
import { TESSERE, distSeg, h01, lerp, liscio, rumore } from './mondo_base.ts';
import { costaPrincipale } from './mondo_costa.ts';
import type { Tessera, V2 } from './mondo_base.ts';
import type { Superficie } from './mappa.ts';

export const MARE = 0;
export const X0 = -288, Z0 = -288, PASSO = 2, NC = 288; // celle per lato
export const RIQ = 64, NRIQ = 9;
export const BORDO = 280; // oltre: fuori

// ---------- i posti dell'isola ----------
export const ROT = { x: 0, z: 10, r: 24 } as const;                       // rotatoria (raggio della mezzeria)
export const MONTE = { x: -135, z: -110, r: 75, h: 36, cima: 30 } as const; // montagna del Ghiaccio (cima piatta col teschio)
export const MESA = { x: -45, z: -160, rx: 62, rz: 34, h: 11 } as const;   // altopiano della Giungla (il tempio sulla parete sud)
export const NEON = { x: 76, z: -132, r: 56 } as const;
export const LUNA = { x: 160, z: -40, r: 50 } as const;
export const CAPO = { x: 150, z: 102, r: 48, h: 11 } as const;             // capo del Fondale
export const PAESE = { x: 2, z: 120 } as const;
export const STAGNO = { x: -6, z: -119, r: 9, y: 3.2 } as const;           // il laghetto sotto la cascata (parete sud dell'altopiano)
export const CASCATA = { x: -6, z: -131 } as const;
/** Il pontile del molo (x0 x1 z0 z1), a quota PONTILE_Y. La testa a T in fondo. */
export const PONTILE: [number, number, number, number][] = [[-4.5, 4.5, 147, 188], [-15, 15, 180, 188]];
export const PONTILE_Y = 1.45;
/** Spiazzi lastricati (cerchi x z r e rettangoli x0 x1 z0 z1): piazza del paese, banchina, spiazzo del garage. */
export const PIAZZE_C: [number, number, number][] = [[0, 120, 23]];
export const PIAZZE_R: [number, number, number, number][] = [[-11, 11, 120, 152], [9, 30, 130, 150], [-40, 40, 140, 152]];
export const AIUOLA = { x: 0, z: 119, r: 6.5 } as const; // la statua in mezzo alla piazza
export const ISOLOTTI: [number, number, number][] = [[-240, -30, 12], [-70, -224, 13], [196, -162, 10], [240, 96, 8], [80, 228, 9], [-206, -178, 9], [-246, 92, 7], [124, -218, 7], [-150, 222, 8]];

const QUOTE_PIATTE: [number, number, number, number][] = [ // x z raggio quota: spianate dei quartieri
  [ROT.x, ROT.z, 56, 4], [PAESE.x, PAESE.z, 50, 1.6], [NEON.x, NEON.z, NEON.r, 5.5], [LUNA.x, LUNA.z, LUNA.r, 4.5], [CAPO.x, CAPO.z, CAPO.r, CAPO.h],
];

// ---------- il terreno naturale ----------
/** Metri dentro la costa (+ terra, − mare), circa. */
export function distCosta(x: number, z: number): number {
  const rn = Math.sqrt((x / 218) ** 2 + (z / 198) ** 2);
  let d = (1 - rn) * 205 + (rumore(x, z, 52, 1) - 0.5) * 34 + (rumore(x, z, 17, 2) - 0.5) * 10;
  d = Math.min(d, distSeg(x, z, 270, 36, 110, 30) - 21);       // l'insenatura a est (il viadotto la scavalca)
  { const bx = Math.abs(x - 4) - 40, bz = 160 - z; // la baia del molo: un rettangolo arrotondato aperto verso sud
    d = Math.min(d, Math.max(bx, bz) < 0 ? Math.max(bx, bz) - 8 : Math.hypot(Math.max(bx, 0), Math.max(bz, 0)) - 8); }
  d = Math.max(d, 15 - distSeg(x, z, -148, 126, -194, 158));   // il promontorio del faro
  d = Math.max(d, 42 - distSeg(x, z, -150, -95, -140, -150));   // la montagna si allarga sul mare
  d = Math.max(d, 24 - distSeg(x, z, 126, 96, 184, 116));      // il capo del fondale
  for (const [ix, iz, r] of ISOLOTTI) d = Math.max(d, (r - Math.hypot(x - ix, z - iz)) * 1.4);
  return d;
}
/** 0 = spiaggia, 1 = scogliera. */
export function scogliera(x: number, z: number): number {
  const sw = liscio(-10, -70, x) * liscio(20, 80, z);
  const sud = liscio(105, 150, z) * (1 - liscio(55, 100, x)) * (1 - liscio(-90, -130, x));
  return 1 - Math.max(sw, sud);
}
const tMonte = (x: number, z: number) => Math.hypot(x - MONTE.x, z - MONTE.z) / MONTE.r;
const tMesa = (x: number, z: number) => Math.sqrt(((x - MESA.x) / MESA.rx) ** 2 + ((z - MESA.z) / MESA.rz) ** 2);
/** Il terreno dentro l'isola, lontano dalla costa. */
function interno(x: number, z: number): number {
  let h = 3.4 + (rumore(x, z, 70, 3) - 0.5) * 5 + (rumore(x, z, 23, 4) - 0.5) * 1.6;
  const tm = tMonte(x, z);
  if (tm < 1) { const k = 1 - tm; h += MONTE.h * Math.pow(k, 1.15) * (0.86 + 0.28 * rumore(x, z, 21, 5)); h = Math.min(h, MONTE.cima + (tm < 0.16 ? 0 : 3)); }
  const tj = tMesa(x, z);
  h += MESA.h * liscio(1.0, 0.82, tj) + 1.5 * liscio(0.8, 0.2, tj) * rumore(x, z, 17, 7);
  const ds = Math.hypot(x - STAGNO.x, z - STAGNO.z);
  if (ds < STAGNO.r + 8) h = lerp(h, STAGNO.y - 0.7, liscio(STAGNO.r + 8, STAGNO.r - 2, ds));
  for (const [cx, cz, r, q] of QUOTE_PIATTE) { const d = Math.hypot(x - cx, z - cz); if (d < r) h = lerp(h, q, liscio(r, r * 0.55, d)); }
  return h;
}
export function nat(x: number, z: number): number {
  const d = distCosta(x, z), c = scogliera(x, z);
  if (d < 0) return MARE - 0.15 - Math.min(14, -d * (0.2 + 0.55 * c));
  const hi = interno(x, z);
  const spiaggia = MARE + 0.15 + (hi - MARE - 0.15) * liscio(0, 38, d);
  const cima = Math.max(hi, 7 + 4 * rumore(x, z, 30, 9));
  const rupe = d < 6 ? MARE + 0.15 + (cima - MARE - 0.15) * liscio(0, 5, d) : lerp(cima, hi, liscio(8, 40, d));
  return lerp(spiaggia, rupe, c);
}

// ---------- strade ----------
type Punto = [number, number] | [number, number, number];
type DefStrada = { id: string; p: Punto[]; l: number; chiusa?: boolean; ponte?: [number, number]; porta?: string };
/** La strada del monte: dal fondo della strada del ghiaccio sale a spirale (in senso orario visto dall'alto) fino in cima. */
function spirale(): Punto[] {
  const x0 = -102, z0 = -42, a0 = Math.atan2(z0 - MONTE.z, x0 - MONTE.x), out: Punto[] = [[x0, z0]];
  for (let k = 1; k <= 12; k++) { const t = k / 12, a = a0 - t * (400 / 180) * Math.PI, r = 60 - 50 * t; out.push([MONTE.x + Math.cos(a) * r, MONTE.z + Math.sin(a) * r]); }
  return out;
}
const anello: Punto[] = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return [ROT.x + Math.cos(a) * ROT.r, ROT.z + Math.sin(a) * ROT.r] as Punto; });
/** Le strade: l = mezza larghezza (m). `ponte` = indici dei punti tra cui la strada è un ponte (quote date). `porta` = la strada finisce alla porta. */
export const DEF_STRADE: DefStrada[] = [
  { id: 'anello', p: anello, l: 5, chiusa: true },
  { id: 'paese', p: [[0, 30], [-8, 52], [6, 74], [0, 99]], l: 5 },
  { id: 'spiaggia', p: [[-17, 27], [-36, 50], [-62, 58], [-88, 80], [-114, 86], [-134, 96]], l: 5, porta: 'spiaggia' },
  { id: 'ghiaccio', p: [[-23, 3], [-46, -2], [-66, -22], [-86, -28], [-102, -42]], l: 5, porta: 'ghiaccio' },
  { id: 'giungla', p: [[-9, -12], [-24, -36], [-20, -62], [-38, -88], [-45, -110], [-46, -124]], l: 5, porta: 'giungla' },
  { id: 'neon', p: [[9, -12], [24, -34], [22, -58], [40, -80], [56, -102], [64, -118]], l: 5, porta: 'neon' },
  { id: 'lunapark', p: [[23, 3], [48, 4], [72, -18], [100, -16], [126, -27], [140, -31]], l: 5, porta: 'lunapark' },
  { id: 'fondale', p: [[18, 26], [44, 40], [58, 66], [86, 82], [114, 97], [140, 104], [160, 109], [176, 113]], l: 5, porta: 'fondale' },
  { id: 'neon_luna', p: [[23, -60], [52, -62], [78, -42], [92, -17]], l: 4 },
  { id: 'viadotto', p: [[112, -21], [122, -6, 5.6], [126, 12, 6.6], [128, 31, 7.6], [131, 50, 8.6], [135, 68, 9.6], [141, 86], [147, 103]], l: 4.5, ponte: [1, 5] },
  { id: 'costa_est', p: [[23, 120], [48, 116], [70, 102], [88, 88]], l: 4 },
  { id: 'costa_ovest', p: [[-23, 124], [-50, 114], [-74, 96], [-88, 77]], l: 4 },
  { id: 'gelo_giungla', p: [[-70, -20], [-74, -48], [-66, -76], [-52, -96], [-42, -100]], l: 4 },
  { id: 'monte', p: spirale(), l: 3.6 },
];

/** Un campione di strada (ogni metro): posizione, quota, tangente unitaria, mezza larghezza, ponte. */
export type Camp = { x: number; y: number; z: number; tx: number; tz: number; l: number; ponte: boolean; s: number; r: number; i: number };
export type Strada = { def: DefStrada; c: Camp[]; len: number };

function catmull(p: Punto[], chiusa: boolean, passi: number): { x: number; z: number; seg: number }[] {
  const n = p.length, out: { x: number; z: number; seg: number }[] = [];
  const P = (i: number) => (chiusa ? p[((i % n) + n) % n]! : p[Math.min(n - 1, Math.max(0, i))]!);
  const nseg = chiusa ? n : n - 1;
  for (let i = 0; i < nseg; i++) {
    const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2);
    for (let k = 0; k < passi; k++) {
      const t = k / passi, t2 = t * t, t3 = t2 * t;
      const f = (A: number, B: number, Cc: number, D: number) => 0.5 * (2 * B + (-A + Cc) * t + (2 * A - 5 * B + 4 * Cc - D) * t2 + (-A + 3 * B - 3 * Cc + D) * t3);
      out.push({ x: f(a[0], b[0], c[0], d[0]), z: f(a[1], b[1], c[1], d[1]), seg: i });
    }
  }
  if (!chiusa) { const u = p[n - 1]!; out.push({ x: u[0], z: u[1], seg: n - 2 }); } else out.push({ ...out[0]! });
  return out;
}

function costruisciStrada(def: DefStrada, r: number): Strada {
  const fitto = catmull(def.p, !!def.chiusa, 24);
  // ricampiona ogni metro
  const pts: { x: number; z: number; seg: number }[] = [fitto[0]!];
  let acc = 0;
  for (let i = 1; i < fitto.length; i++) {
    const a = fitto[i - 1]!, b = fitto[i]!, L = Math.hypot(b.x - a.x, b.z - a.z);
    let t = 0;
    while (acc + L * (1 - t) >= 1) { t += (1 - acc) / L; acc = 0; pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, seg: a.seg }); }
    acc += L * (1 - t);
  }
  const n = pts.length;
  const ponte = (seg: number) => !!def.ponte && seg >= def.ponte[0] && seg < def.ponte[1];
  // quote: il terreno, o le quote date ai punti dei ponti
  const y = pts.map((q) => {
    const a = def.p[q.seg], b = def.p[Math.min(def.p.length - 1, q.seg + 1)];
    if (a && b && a.length === 3 && b.length === 3) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = Math.min(1, Math.hypot(q.x - a[0], q.z - a[1]) / L);
      return a[2] + (b[2] - a[2]) * t;
    }
    if (a && a.length === 3 && Math.hypot(q.x - a[0], q.z - a[1]) < 1.5) return a[2];
    return Math.max(MARE + 0.9, nat(q.x, q.z));
  });
  const fisso = pts.map((q) => { const a = def.p[q.seg], b = def.p[Math.min(def.p.length - 1, q.seg + 1)]; return !!(a && b && a.length === 3 && b.length === 3); });
  // liscia (media mobile ±14 m) e limita la pendenza (13 %): avanti e indietro
  const ys = y.slice();
  for (let i = 0; i < n; i++) {
    if (fisso[i]) continue;
    let s = 0, k = 0;
    for (let j = i - 14; j <= i + 14; j++) { const jj = def.chiusa ? ((j % n) + n) % n : Math.min(n - 1, Math.max(0, j)); s += y[jj]!; k++; }
    ys[i] = s / k;
  }
  const MAXP = 0.13;
  for (let it = 0; it < 2; it++) {
    for (let i = 1; i < n; i++) if (!fisso[i]) ys[i] = Math.min(ys[i - 1]! + MAXP, Math.max(ys[i - 1]! - MAXP, ys[i]!));
    for (let i = n - 2; i >= 0; i--) if (!fisso[i]) ys[i] = Math.min(ys[i + 1]! + MAXP, Math.max(ys[i + 1]! - MAXP, ys[i]!));
  }
  const c: Camp[] = pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!, L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: q.x, z: q.z, y: ys[i]!, tx: (b.x - a.x) / L, tz: (b.z - a.z) / L, l: def.l, ponte: ponte(q.seg), s: i, r, i };
  });
  return { def, c, len: n - 1 };
}

/** Le strade che partono o arrivano su un'altra strada prendono la sua quota all'attacco (niente gradini all'incrocio). */
function agganciaEstremi(strade: Strada[]): void {
  const MAXP = 0.13;
  strade.forEach((s, si) => {
    if (s.def.chiusa) return;
    for (const fine of [0, s.c.length - 1]) {
      const e = s.c[fine]!;
      let best: Camp | null = null, bd = 7;
      for (const o of strade.slice(0, si)) for (const c of o.c) { const d = Math.hypot(c.x - e.x, c.z - e.z); if (d < bd) { bd = d; best = c; } }
      if (!best || e.ponte) continue;
      const dy = best.y - e.y, n = s.c.length;
      // sposta la quota all'attacco e la raccorda lungo la strada con la pendenza massima
      const passi = Math.min(n - 1, Math.ceil(Math.abs(dy) / (MAXP * 0.55)) + 8);
      for (let k = 0; k <= passi; k++) {
        const i = fine === 0 ? k : n - 1 - k, c = s.c[i]!; if (c.ponte) break;
        const w = 1 - liscio(0, passi, k); c.y += dy * w;
      }
    }
  });
}

// ---------- la griglia dei campioni (per «la strada più vicina») ----------
const CS = 16;
export class Vicini {
  private b = new Map<number, Camp[]>();
  private k(i: number, j: number) { return (i + 512) * 1024 + (j + 512); }
  aggiungi(c: Camp) { const k = this.k(Math.floor(c.x / CS), Math.floor(c.z / CS)); let a = this.b.get(k); if (!a) this.b.set(k, (a = [])); a.push(c); }
  /** Il campione più vicino entro r (in pianta), con la distanza. */
  vicino(x: number, z: number, r: number, filtro?: (c: Camp) => boolean): { c: Camp; d: number } | null {
    const i0 = Math.floor((x - r) / CS), i1 = Math.floor((x + r) / CS), j0 = Math.floor((z - r) / CS), j1 = Math.floor((z + r) / CS);
    let best: Camp | null = null, bd = r * r;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.b.get(this.k(i, j)); if (!a) continue;
      for (const c of a) { if (filtro && !filtro(c)) continue; const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = c; } }
    }
    return best ? { c: best, d: Math.sqrt(bd) } : null;
  }
}

// ---------- trampolini ----------
/** Rampa: inizio (x, z), direzione (yaw del moto: avanti = (sin, cos)), lunghezza, mezza larghezza, altezza in fondo. Finisce in un gradino. */
export type Rampa = { x: number; z: number; yaw: number; lung: number; l: number; h: number };
export const RAMPE: Rampa[] = [
  { x: -50, z: 104, yaw: -2.2, lung: 9, l: 3.2, h: 1.7 },      // sulla sabbia, scorciatoia dal paese alla spiaggia
  { x: 17, z: 44, yaw: 0.25, lung: 8, l: 2.6, h: 1.5 },        // sul prato tra la rotatoria e il paese
];
const RAMPE_FISSE = RAMPE.length;
function altRampa(rp: Rampa, x: number, z: number): number {
  const fx = Math.sin(rp.yaw), fz = Math.cos(rp.yaw), dx = x - rp.x, dz = z - rp.z;
  const u = dx * fx + dz * fz, v = dx * fz - dz * fx;
  if (u < 0 || u > rp.lung || Math.abs(v) > rp.l) return -Infinity;
  return (u / rp.lung) * rp.h;
}

// ---------- il mondo del terreno ----------
export type Terreno = {
  strade: Strada[]; vicini: Vicini;
  /** Quote finali dei vertici della griglia (NC+1)². */
  H: Float32Array;
  /** Tessera di ogni cella (indice in `TESS`). */
  T: Uint8Array;
  /** 1 = cella troppo ripida (non si sale). */
  ripido: Uint8Array;
  quotaTerra(x: number, z: number): number;
  quota(x: number, z: number): number;
  superficie(x: number, z: number): Superficie;
  fuori(x: number, z: number): boolean;
  stradaVicina(x: number, z: number, r: number): { c: Camp; d: number } | null;
  inPiazza(x: number, z: number): boolean;
  neve(x: number, z: number, h: number): boolean;
  /** Porte: dove finisce ogni strada con la porta (centro della porta e direzione). */
  porte: Record<string, { x: number; z: number; fx: number; fz: number; y: number }>;
  costa: V2[];
};
export const TESS: Tessera[] = ['erbaB', 'erbaA', 'erbaAlta', 'muschio', 'sabbia', 'sabbiaBagnata', 'roccia', 'neve', 'metallo', 'terra', 'ghiaia', 'pietraLiscia', 'pietraMuro'];
const TI = Object.fromEntries(TESS.map((t, i) => [t, i])) as Record<Tessera, number>;
const SUP: Record<string, Superficie> = { erbaB: 'erba', erbaA: 'erba', erbaAlta: 'erba', muschio: 'erba', sabbia: 'sabbia', sabbiaBagnata: 'sabbia', roccia: 'roccia', neve: 'neve', metallo: 'strada', terra: 'erba', ghiaia: 'roccia', pietraLiscia: 'strada', pietraMuro: 'roccia' };

export const dentroPontile = (x: number, z: number): boolean => PONTILE.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d);
export const inPiazza = (x: number, z: number): boolean => PIAZZE_C.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r) || PIAZZE_R.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d);
/** I sentieri di terra (scorciatoie sull'erba): spezzate. */
export const SENTIERI: V2[][] = [
  [[-56, 100], [-48, 84], [-34, 70]],                  // dalla spiaggia verso la rotatoria, tra le dune
];

export function creaTerreno(): Terreno {
  const strade = DEF_STRADE.map((d, i) => costruisciStrada(d, i));
  agganciaEstremi(strade);
  // il trampolino sul viale del luna park: in mezzo alla strada, lungo il suo verso (ai lati resta libero)
  RAMPE.length = RAMPE_FISSE;
  { const c = strade.find((s) => s.def.id === 'lunapark')!.c[96]!; RAMPE.push({ x: c.x, z: c.z, yaw: Math.atan2(c.tx, c.tz), lung: 10, l: 2.2, h: 1.9 }); }
  // e quello sulla neve, a metà della strada del monte (stretto: si può girargli intorno)
  { const c = strade.find((s) => s.def.id === 'monte')!.c[150]!; RAMPE.push({ x: c.x, z: c.z, yaw: Math.atan2(c.tx, c.tz), lung: 8, l: 1.5, h: 1.5 }); }
  const vicini = new Vicini();
  for (const s of strade) for (const c of s.c) vicini.aggiungi(c);
  const sulSentiero = (x: number, z: number) => SENTIERI.some((p) => p.some((a, i) => i > 0 && distSeg(x, z, p[i - 1]![0], p[i - 1]![1], a[0], a[1]) < 2.2));

  // quota «finale» del terreno: il naturale raccordato alle strade, alle piazze e al pontile
  const alt = (x: number, z: number): number => {
    const n = nat(x, z);
    if (n > MARE - 0.5 && inPiazza(x, z)) return 1.6;
    const q = vicini.vicino(x, z, 44, (c) => !c.ponte);
    let h = n;
    if (q) {
      const { c, d } = q, base = c.y - 0.06;
      if (d < c.l + 1.4) h = d < c.l ? c.y - 0.16 : base;
      else { const e = d - c.l - 1.4, R = 4 + Math.abs(base - n) * 1.25; h = base + (n - base) * liscio(0, R, e); }
    }
    // la piazza si raccorda dolce al prato intorno
    for (const [cx, cz, r] of PIAZZE_C) { const d = Math.hypot(x - cx, z - cz); if (d >= r && d < r + 10 && n > MARE) h = lerp(1.6, h, liscio(r, r + 10, d)); }
    if (sulSentiero(x, z) && h > MARE + 0.5) h -= 0.12;
    return h;
  };
  const N1 = NC + 1, H = new Float32Array(N1 * N1);
  for (let j = 0; j <= NC; j++) for (let i = 0; i <= NC; i++) H[j * N1 + i] = alt(X0 + i * PASSO, Z0 + j * PASSO);
  const hv = (i: number, j: number) => H[Math.min(NC, Math.max(0, j)) * N1 + Math.min(NC, Math.max(0, i))]!;
  const quotaTerra = (x: number, z: number): number => {
    const fx = (x - X0) / PASSO, fz = (z - Z0) / PASSO, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    // stessa diagonale dei triangoli della mesh (vedi mondo_mesh: alternata a scacchi)
    const a = hv(i, j), b = hv(i + 1, j), c = hv(i, j + 1), d = hv(i + 1, j + 1);
    if ((i + j) & 1) return tx + tz < 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
    return tx > tz ? a + (b - a) * tx + (d - b) * tz : a + (c - a) * tz + (d - c) * tx;
  };

  // neve, tessere e celle ripide
  const neve = (x: number, z: number, h: number) => tMonte(x, z) < 0.95 && h > 8 + 5 * rumore(x, z, 18, 11) - 3 * liscio(0.6, 0.2, tMonte(x, z));
  const T = new Uint8Array(NC * NC), ripido = new Uint8Array(NC * NC);
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
    const a = hv(i, j), b = hv(i + 1, j), c = hv(i, j + 1), d = hv(i + 1, j + 1);
    const pend = (Math.max(a, b, c, d) - Math.min(a, b, c, d)) / PASSO, h = (a + b + c + d) / 4;
    const x = X0 + (i + 0.5) * PASSO, z = Z0 + (j + 0.5) * PASSO;
    ripido[j * NC + i] = pend > 1.15 ? 1 : 0;
    T[j * NC + i] = TI[tessera(x, z, h, pend)];
  }
  function tessera(x: number, z: number, h: number, pend: number): Tessera {
    const dith = h01(Math.floor(x / 2), Math.floor(z / 2), 21);
    if (inPiazza(x, z)) return 'roccia';
    const dn = Math.hypot(x - NEON.x, z - NEON.z);
    if (dn < NEON.r - 8 + dith * 6 && h > MARE + 1) return 'metallo';
    if (pend > 0.95) return dith < 0.7 ? 'roccia' : 'pietraMuro';
    if (h < MARE + 0.35) return 'sabbiaBagnata';
    if (neve(x, z, h)) return pend > 0.7 && dith < 0.4 ? 'roccia' : 'neve';
    const c = scogliera(x, z);
    if (h < MARE + 2.4 && c < 0.6 && pend < 0.6) return 'sabbia';
    if (h < MARE + 1.4 && pend < 0.4) return 'sabbia';
    if (sulSentiero(x, z)) return 'terra';
    if (pend > 0.6) return dith < 0.5 ? 'roccia' : 'ghiaia';
    const tj = tMesa(x, z), dl = Math.hypot(x - LUNA.x, z - LUNA.z);
    if (tj < 1.25) return rumore(x, z, 9, 12) < 0.55 ? 'muschio' : 'erbaAlta';
    if (dl < LUNA.r - 12) return dl < 16 ? 'pietraLiscia' : 'sabbia';
    const r = rumore(x, z, 24, 14);
    return r < 0.36 ? 'erbaA' : r > 0.78 ? 'erbaAlta' : 'erbaB';
  }

  // le porte: dove finiscono le strade con la porta, 12 m prima della fine
  const porte: Terreno['porte'] = {};
  for (const s of strade) if (s.def.porta) { const c = s.c[Math.max(0, s.c.length - 13)]!; porte[s.def.porta] = { x: c.x, z: c.z, fx: c.tx, fz: c.tz, y: c.y }; }

  const stradaVicina = (x: number, z: number, r: number) => vicini.vicino(x, z, r);
  /** La quota sulla strada in (x, z): proiezione sul tratto tra due campioni (niente gradini ogni metro). */
  const quotaStrada = (q: { c: Camp; d: number }, x: number, z: number): number => {
    const st = strade[q.c.r]!.c, i = q.c.i, u = (x - q.c.x) * q.c.tx + (z - q.c.z) * q.c.tz;
    const j = u >= 0 ? Math.min(st.length - 1, i + 1) : Math.max(0, i - 1);
    const o = st[j]!; return q.c.y + (o.y - q.c.y) * Math.min(1, Math.abs(u));
  };
  const quota = (x: number, z: number): number => {
    if (dentroPontile(x, z)) return PONTILE_Y;
    const q = vicini.vicino(x, z, 9);
    let h: number;
    if (q && q.c.ponte && q.d < q.c.l + 0.4) h = quotaStrada(q, x, z) + 0.05;
    else if (q && !q.c.ponte && q.d < q.c.l + 0.3) h = quotaStrada(q, x, z) + 0.04;
    else if (q && !q.c.ponte && q.d < q.c.l + 1.6) h = lerp(quotaStrada(q, x, z) + 0.04, quotaTerra(x, z), liscio(q.c.l + 0.3, q.c.l + 1.6, q.d));
    else h = quotaTerra(x, z);
    for (const rp of RAMPE) { const r = altRampa(rp, x, z); if (r > -Infinity) h += r; }
    return h;
  };
  const cella = (x: number, z: number) => { const i = Math.floor((x - X0) / PASSO), j = Math.floor((z - Z0) / PASSO); return i < 0 || j < 0 || i >= NC || j >= NC ? -1 : j * NC + i; };
  const superficie = (x: number, z: number): Superficie => {
    if (dentroPontile(x, z)) return 'legno';
    const q = vicini.vicino(x, z, 9);
    if (q && q.d < q.c.l + 0.4) return 'strada';
    for (const rp of RAMPE) if (altRampa(rp, x, z) > -Infinity) return 'strada';
    const h = quotaTerra(x, z);
    if (h < MARE - 0.02) return 'acqua';
    if (Math.hypot(x - STAGNO.x, z - STAGNO.z) < STAGNO.r && h < STAGNO.y) return 'acqua';
    if (inPiazza(x, z)) return 'strada';
    const k = cella(x, z); if (k < 0) return 'acqua';
    return SUP[TESS[T[k]!]!] ?? 'erba';
  };
  const fuori = (x: number, z: number): boolean => {
    if (Math.abs(x) > BORDO || Math.abs(z) > BORDO) return true;
    if (dentroPontile(x, z)) return false;
    const q = vicini.vicino(x, z, 9);
    if (q && q.d < q.c.l + 0.4) return false;
    if (quotaTerra(x, z) < MARE - 1.1) return true;
    const k = cella(x, z); return k >= 0 && ripido[k] === 1;
  };

  return { strade, vicini, H, T, ripido, quotaTerra, quota, superficie, fuori, stradaVicina, inPiazza, neve, porte, costa: costaPrincipale(H) };
}

export { TESSERE };
