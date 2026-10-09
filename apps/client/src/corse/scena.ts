// La scenografia delle piste del motore v2 (docs/CORSE.md A9, #176): il terreno intorno al nastro e i pezzi del kit della zona
// (`assets/blender/models_corse_<zona>.py`, manifest_corse.json) piazzati con regole, fusi per riquadri da 160 m.
// - Terreno: una griglia di quote. Lontano dalla pista c'è il «naturale» della pista (mare oltre la costa, colline a terra, l'isola
//   della baia, le banchine del porto); vicino si raccorda alla quota della strada (terrapieni, scogliere sotto i tratti alti, il canale
//   sotto i salti). Colori della palette per triangolo: sabbia, prato, roccia nei pendii, marciapiede accanto alla strada.
// - Pezzi: lampioni, case, ombrelloni, palme, pini, scogli, barche, cartelli nelle curve, tribune e portale al via, gru e container al
//   porto. Le regole guardano solo il nastro e il terreno: una pista nuova della zona si veste da sola, la config dice solo dov'è il mare.
// - Manichini del pubblico: il corpo è fuso coi pezzi, le teste sono un InstancedMesh che si gira verso la camera quando passi, a scatti.
// Il gioco non cambia: è solo resa. La sim non sa niente di tutto questo (i pezzi stanno sempre fuori dal bordo della pista).
import * as THREE from 'three';
import { campo, punto } from '@marea/sim/corse/nastro.ts';
import type { Nastro } from '@marea/sim/corse/nastro.ts';
import { VUOTO, superficieA } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { createLoader } from '../render/loader.ts';
import type { Loader } from '../render/loader.ts';
import { P } from '../render/island_parts.ts';

type V2 = [number, number];
/** Come si veste una pista. `costa`: spezzata con il mare a sinistra di chi la percorre; `mareA`: il mare sta da quel lato della pista
 *  (fughe lungo la scogliera); `isola`: l'interno del circuito è un'isola (la baia); `porto`: banchine dentro e fuori, il mare da un lato. */
type ConfScena = {
  livello: number;
  costa?: V2[];
  mareA?: -1 | 1;
  isola?: boolean;
  porto?: boolean;
  /** Tratti (s in m) dove a terra c'è il paese invece della campagna. */
  paese?: [number, number][];
  /** Il faro: s sulla principale e scarto laterale (dentro il tornante del Lungomare, all'arrivo della fuga). */
  faro?: [number, number];
};
const SCENE: Record<string, ConfScena> = {
  spiaggia_lungomare: {
    livello: -1.2,
    costa: [[-260, -90], [-150, -72], [-80, -58], [-40, -26], [20, -26], [110, -26], [160, -6], [170, 50], [160, 140], [150, 260]],
    paese: [[0, 90], [340, 661]],
    faro: [192, 21],
  },
  spiaggia_baia: { livello: -0.05, isola: true, costa: [[-110, -80], [-75, 20], [-60, 120], [-70, 230], [-120, 330]] },
  spiaggia_porto: { livello: -0.05, porto: true, costa: [[-200, -40], [80, -28], [260, -40]], paese: [[320, 560]] },
  spiaggia_fuga: { livello: -1.2, mareA: -1, paese: [[0, 140], [1230, 1366]], faro: [1350, 26] },
};
export const haScena = (id: string): boolean => id in SCENE;

// ---------- vicinanza alla pista: i campioni di tutti i nastri in una griglia da 16 m ----------
type Camp = { x: number; y: number; z: number; rx: number; rz: number; l: number; fuori: number; vuoto: boolean; s: number; ramo: number };
type Vicino = { c: Camp; d: number; lat: number };
const CELLA = 16;
class Vicini {
  private b = new Map<number, Camp[]>();
  readonly tutti: Camp[] = [];
  aggiungi(c: Camp) {
    const k = this.chiave(Math.floor(c.x / CELLA), Math.floor(c.z / CELLA));
    let a = this.b.get(k); if (!a) this.b.set(k, (a = []));
    a.push(c); this.tutti.push(c);
  }
  private chiave(i: number, j: number) { return (i + 4096) * 8192 + (j + 4096); }
  /** Il campione più vicino entro `r` m (in pianta). */
  vicino(x: number, z: number, r = 48): Vicino | null {
    const i0 = Math.floor((x - r) / CELLA), i1 = Math.floor((x + r) / CELLA), j0 = Math.floor((z - r) / CELLA), j1 = Math.floor((z + r) / CELLA);
    let best: Camp | null = null, bd = r * r;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.b.get(this.chiave(i, j)); if (!a) continue;
      for (const c of a) { const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = c; } }
    }
    if (!best) return null;
    const rl = Math.hypot(best.rx, best.rz) || 1;
    return { c: best, d: Math.sqrt(bd), lat: ((x - best.x) * best.rx + (z - best.z) * best.rz) / rl };
  }
}

function campioni(p: Pista): Vicini {
  const v = new Vicini(), muro = p.def.stile === 'acqua' ? 0.3 : 0.6;
  const metti = (n: Nastro, ramo: number, bordo: number) => {
    const ultimo = n.chiuso ? n.n : n.n;
    for (let i = 0; i < ultimo; i++) {
      const s = i * n.passo;
      v.aggiungi({ x: n.x[i]!, y: n.y[i]!, z: n.z[i]!, rx: n.rx[i]!, rz: n.rz[i]!, l: n.l[i]!, fuori: n.l[i]! + bordo + muro, s, ramo,
        vuoto: ramo < 0 && superficieA(p, -1, s, 0, 1) === VUOTO });
    }
  };
  metti(p.n, -1, p.def.bordo);
  p.rami.forEach((r, i) => metti(r.n, i, r.def.bordo));
  return v;
}

// ---------- quote ----------
const liscio = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const h01 = (x: number, y: number, s = 0) => {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1274126177)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) & 0xffff) / 65536;
};
/** Rumore morbido a valori (per le colline). */
function rumore(x: number, z: number, k: number, seed: number): number {
  const fx = x / k, fz = z / k, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const a = h01(i, j, seed), b = h01(i + 1, j, seed), c = h01(i, j + 1, seed), d = h01(i + 1, j + 1, seed);
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
/** Distanza con segno da una spezzata: + a sinistra (il mare). */
function distCosta(c: V2[], x: number, z: number): number {
  let best = Infinity, segno = 1;
  for (let i = 0; i + 1 < c.length; i++) {
    const [ax, az] = c[i]!, [bx, bz] = c[i + 1]!, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; segno = dx * (z - az) - dz * (x - ax) < 0 ? 1 : -1; }
  }
  return best * segno;
}
function dentro(poli: V2[], x: number, z: number): boolean {
  let ok = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, zi] = poli[i]!, [xj, zj] = poli[j]!;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ok = !ok;
  }
  return ok;
}

type Terreno = {
  alt(x: number, z: number): number;
  /** Il terreno «naturale» senza la pista: < livello = mare. */
  nat(x: number, z: number): number;
  vicini: Vicini; conf: ConfScena; dentroGiro(x: number, z: number): boolean;
  bordo: { x0: number; x1: number; z0: number; z1: number };
};

function terreno(p: Pista, conf: ConfScena): Terreno {
  const vicini = campioni(p), L = conf.livello, acqua = p.def.stile === 'acqua';
  const giro: V2[] = []; for (let i = 0; i < p.n.n; i += 4) giro.push([p.n.x[i]!, p.n.z[i]!]);
  const dentroGiro = (x: number, z: number) => p.n.chiuso && dentro(giro, x, z);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of vicini.tutti) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
  const M = 80; x0 -= M; x1 += M; z0 -= M; z1 += M;
  const collina = (x: number, z: number, d: number) => 0.4 + Math.min(16, d * 0.1) * (0.5 + rumore(x, z, 45, 7)) + 0.6 * rumore(x, z, 13, 8);
  const nat = (x: number, z: number): number => {
    // bordo del mondo: il terreno scende in mare (così da lontano è un'isola)
    const bordo = Math.min(x - x0, x1 - x, z - z0, z1 - z), cala = liscio(0, 30, bordo);
    let h: number;
    if (conf.porto) {
      // banchine piatte a 0,6 m dentro il giro e a sud; il mare a nord della costa
      const sd = conf.costa ? distCosta(conf.costa, x, z) : -50;
      h = sd > 0 ? L - 3 : 0.6;
    } else if (conf.isola) {
      const q = vicini.vicino(x, z, 400);
      const sd = conf.costa ? distCosta(conf.costa, x, z) : 99;
      const isola = dentroGiro(x, z) && q ? q.d - 14 : -1; // l'isola dentro la baia: 14 m di acqua prima della riva
      const terra = Math.max(isola > 0 ? Math.min(9, isola * 0.35) * (0.6 + 0.8 * rumore(x, z, 20, 3)) + 0.3 : -3, sd < 0 ? Math.min(30, -sd * 0.5) + 0.3 : -3);
      h = terra;
    } else if (conf.mareA) {
      // la scogliera: mare da un lato, il monte dall'altro, che oltre LONTANO m dalla strada scende in mare (niente terreno inutile)
      const q = vicini.vicino(x, z, LONTANO);
      if (!q) h = L - 3;
      else {
        const lato = q.lat * conf.mareA > 0 ? 1 : -1, e = q.d - q.c.fuori;
        h = lato > 0 ? L - 2 - e * 0.1 : L - 3 + (q.c.y + collina(x, z, e) - (L - 3)) * liscio(0, 25, LONTANO - 8 - q.d);
      }
    } else {
      const sd = conf.costa ? distCosta(conf.costa, x, z) : -99;
      h = sd > 0 ? L - 0.6 - Math.min(5, sd * 0.25) : L + 0.9 + collina(x, z, -sd) * liscio(0, 40, -sd) + (-sd < 14 ? 0 : 0);
    }
    return L - 3 + (h - (L - 3)) * cala;
  };
  const alt = (x: number, z: number): number => {
    const n = nat(x, z), q = vicini.vicino(x, z);
    if (!q) return n;
    const { c, d } = q;
    if (c.vuoto && d < c.fuori + 3) return L - 1.5;               // il canale sotto il salto
    if (acqua) return d < c.fuori + 2 ? L - 2.5 : n;              // la pista d'acqua resta in acqua
    if (d < c.fuori) return c.y - 0.35;                           // sotto la strada
    if (conf.porto) return d < c.fuori + DARSENA ? L - 1.5 : n;   // il molo corre sull'acqua della darsena, poi la banchina
    const e = d - c.fuori, R = 5 + Math.abs(c.y - 0.1 - n) * (n < L ? 0.7 : 1.3);
    const piano = conf.porto && n > L ? 0 : (n < L ? 1.2 : 2.5);  // un marciapiede piatto prima di raccordarsi
    return c.y - 0.12 + (n - (c.y - 0.12)) * liscio(piano, piano + R, e);
  };
  return { alt, nat, vicini, conf, dentroGiro, bordo: { x0, x1, z0, z1 } };
}

// ---------- la griglia del terreno, a riquadri ----------
const RIQ = 160;
/** Scogliera (fughe): fin dove arriva il terreno, in m dalla strada. */
const LONTANO = 90;
/** Porto: metri d'acqua tra il bordo del molo e la banchina. */
const DARSENA = 7;
type Tela = { pos: number[]; col: number[] };
function coloreTerra(t: Terreno, cx: number, cz: number, h: number, pend: number, i: number, j: number): string | null {
  const L = t.conf.livello, q = t.vicini.vicino(cx, cz, 12), dith = h01(i, j, 5);
  if (q && q.d < q.c.fuori + 2.2 && h > L + 0.3 && !t.conf.porto) return dith < 0.5 ? P.pietraChiara : P.pietra; // marciapiede
  if (pend > 0.9) return dith < 0.6 ? P.pietraScura : P.roccia;
  if (t.conf.porto && h > L + 0.2 && pend < 0.25) return (i + j) % 2 ? P.pietra : P.pietraChiara;              // banchine
  if (h < L + 0.15) return dith < 0.7 ? P.sabbia : P.legnoChiaro;                                              // bagnasciuga
  if (h < L + 1.6 && pend < 0.5) return dith < 0.8 ? P.sabbia : P.sabbiaChiara;                                // spiaggia
  if (pend > 0.55) return dith < 0.5 ? P.pietra : P.pietraScura;
  if (h > L + 14) return dith < 0.7 ? P.erbaScura : P.bosco;
  return dith < 0.85 ? P.erba : P.erbaScura;
}

function griglia(t: Terreno): Map<number, Tela> {
  const { x0, x1, z0, z1 } = t.bordo, L = t.conf.livello;
  const area = (x1 - x0) * (z1 - z0), passo = Math.max(3, Math.sqrt(area / 11000));
  const ni = Math.ceil((x1 - x0) / passo), nj = Math.ceil((z1 - z0) / passo);
  const H = new Float32Array((ni + 1) * (nj + 1));
  for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) H[j * (ni + 1) + i] = t.alt(x0 + i * passo, z0 + j * passo);
  const tele = new Map<number, Tela>(), c = new THREE.Color();
  const tri = (a: number[], b: number[], d: number[], ii: number, jj: number) => {
    if (a[1]! < L - 0.25 && b[1]! < L - 0.25 && d[1]! < L - 0.25) return; // sott'acqua: lo copre il mare
    const cx = (a[0]! + b[0]! + d[0]!) / 3, cz = (a[2]! + b[2]! + d[2]!) / 3, cy = (a[1]! + b[1]! + d[1]!) / 3;
    const q = t.vicini.vicino(cx, cz, 8);
    if (q && q.d < q.c.l + 0.5 && !q.c.vuoto && t.conf.livello < -1) return; // sotto la carreggiata non si vede
    if (t.conf.mareA && !t.vicini.vicino(cx, cz, LONTANO)) return;
    const pend = (Math.max(a[1]!, b[1]!, d[1]!) - Math.min(a[1]!, b[1]!, d[1]!)) / passo;
    const col = coloreTerra(t, cx, cz, cy, pend, ii, jj); if (!col) return;
    const k = Math.floor((cx - x0) / RIQ) * 1000 + Math.floor((cz - z0) / RIQ);
    let tl = tele.get(k); if (!tl) tele.set(k, (tl = { pos: [], col: [] }));
    tl.pos.push(...a, ...b, ...d); c.set(col);
    for (let r = 0; r < 3; r++) tl.col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
    const v = (ii: number, jj: number) => [x0 + ii * passo, H[jj * (ni + 1) + ii]!, z0 + jj * passo];
    const a = v(i, j), b = v(i + 1, j), d = v(i, j + 1), e = v(i + 1, j + 1);
    if ((i + j) % 2) { tri(a, d, b, i * 2, j); tri(b, d, e, i * 2 + 1, j); } else { tri(a, d, e, i * 2, j); tri(a, e, b, i * 2 + 1, j); }
  }
  return tele;
}

// ---------- i pezzi ----------
type Pezzo = { m: string; x: number; y: number; z: number; ry: number; s?: number; sx?: number };
type Testa = { x: number; y: number; z: number; ry: number };
const CASE = ['cs_casa_a', 'cs_casa_b', 'cs_casa_c'], OMBR = ['cs_ombrellone_rosso', 'cs_ombrellone_blu', 'cs_ombrellone_giallo'];
const MANI_PIEDI = ['cs_manichino_rosso', 'cs_manichino_blu'], MANI_SEDUTI = ['cs_manichino_giallo', 'cs_manichino_verde'];
const CONTAINER = ['cs_container', 'cs_container_rosso', 'cs_container_verde'];
/** Angolo `ry` che fa guardare il davanti dei modelli (−Z) verso la direzione (dx, dz). */
const guarda = (dx: number, dz: number) => Math.atan2(-dx, -dz);

function piazza(p: Pista, t: Terreno): { pezzi: Pezzo[]; teste: Testa[] } {
  const pezzi: Pezzo[] = [], teste: Testa[] = [], conf = t.conf, L = conf.livello, n = p.n, acqua = p.def.stile === 'acqua';
  let seme = 1;
  const rnd = () => { seme = (Math.imul(seme, 1103515245) + 12345) >>> 0; return ((seme >>> 8) & 0xffff) / 65536; };
  const occupati: [number, number, number][] = [];
  const libero = (x: number, z: number, r: number, margine = 0.6) => {
    const q = t.vicini.vicino(x, z, r + 20);
    if (q && q.d < q.c.fuori + r + margine) return false;
    for (const [ox, oz, or] of occupati) if ((ox - x) ** 2 + (oz - z) ** 2 < (or + r) ** 2) return false;
    return true;
  };
  const metti = (m: string, x: number, z: number, ry: number, r: number, o: { y?: number; s?: number; sx?: number; margine?: number } = {}): boolean => {
    if (!libero(x, z, r, o.margine)) return false;
    occupati.push([x, z, r]);
    pezzi.push({ m, x, y: o.y ?? t.alt(x, z), z, ry, s: o.s, sx: o.sx });
    return true;
  };
  const inPaese = (s: number) => (conf.paese ?? []).some(([a, b]) => s >= a && s <= b);
  const q3: [number, number, number] = [0, 0, 0];
  const pt = (s: number, lat: number) => { punto(n, s, lat, 0, q3); return [q3[0], q3[1], q3[2]] as const; };
  const fuoriA = (s: number) => campo(n, n.l, s) + p.def.bordo + (acqua ? 0.3 : 0.6);

  // il faro, il portale del via e le tribune
  if (conf.faro) { const [x, , z] = pt(conf.faro[0], conf.faro[1]); metti('cs_faro', x, z, guarda(-(x - pt(conf.faro[0], 0)[0]), -(z - pt(conf.faro[0], 0)[2])), 5, { margine: 0 }); }
  if (!acqua) {
    const sv = p.def.via, l = fuoriA(sv), [x, y, z] = pt(sv + 6, 0), [x2, , z2] = pt(sv + 7, 0);
    pezzi.push({ m: 'cs_arco_via', x, y: y - 0.05, z, ry: guarda(x2 - x, z2 - z), sx: (l + 0.6) / 5 });
    for (const lato of [-1, 1]) for (const ds of [-14, 2]) {
      const s = sv + ds, off = fuoriA(s) + (conf.porto ? DARSENA + 4.6 : 4.2), [tx, , tz] = pt(s, lato * off), [cx, , cz] = pt(s, 0);
      if (t.nat(tx, tz) < L + 0.2) continue;
      const ry = guarda(cx - tx, cz - tz);
      if (!metti('cs_tribuna', tx, tz, ry, 4.6)) continue;
      // tre gradoni di manichini seduti, facce verso la pista
      const fx = -Math.sin(ry), fz = -Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
      const y0 = t.alt(tx, tz);
      for (let k = 0; k < 3; k++) for (let i = 0; i < 7; i++) {
        if (rnd() < 0.15) continue;
        const u = -3.4 + i * 1.13 + (rnd() - 0.5) * 0.2, back = 0.9 * k - 0.05;
        const mx = tx + rx * u - fx * back, mz = tz + rz * u - fz * back, my = y0 + 0.6 * (k + 1);
        pezzi.push({ m: MANI_SEDUTI[(i + k) % 2]!, x: mx, y: my, z: mz, ry });
        teste.push({ x: mx, y: my + 0.58, z: mz, ry });
      }
    }
  }

  // lungo la principale, ogni 2 m, per lato
  for (let s = 0; s < n.len - 2; s += 2) {
    const k = campo(n, n.k, s), fuori = fuoriA(s);
    if (p.def.tipo === 'fuga' && (s < p.def.via - 20 || s > p.def.via + p.arrivo + 10)) continue;
    for (const lato of [-1, 1]) {
      const at = (off: number) => pt(s, lato * (fuori + off));
      const [cx, , cz] = pt(s, 0);
      const versoPista = (x: number, z: number) => guarda(cx - x, cz - z);
      const [nx, , nz] = at(6), [fx, , fz] = at(24), terra = t.nat(nx, nz) > L + 0.3;
      const paese = inPaese(s) && terra && t.nat(fx, fz) > L + 1.6; // il paese sta verso l'interno, non sulla spiaggia
      const passo = Math.round(s);
      // lampioni sul ciglio
      if (!acqua && !conf.porto && passo % 18 === (lato > 0 ? 0 : 10) && (paese || !terra)) { const [x, , z] = at(1.0); metti('cs_lampione', x, z, versoPista(x, z), 0.4, { margine: 0.3 }); }
      if (conf.porto && passo % 16 === (lato > 0 ? 0 : 8)) { const [x, , z] = at(DARSENA + 0.8); metti('cs_lampione', x, z, versoPista(x, z), 0.4, { margine: 0.2 }); }
      // bitte lungo il porto e le rive della baia
      if ((conf.porto || acqua) && passo % 6 === 0 && rnd() < (acqua ? 0.25 : 0.7)) {
        const [x, , z] = at(acqua ? 2.5 + rnd() * 6 : 0.3);
        if (acqua ? t.alt(x, z) > L - 0.2 : true) metti(acqua ? 'cs_scoglio_b' : 'cs_bitta', x, z, rnd() * 6.28, acqua ? 1.5 : 0.3, { margine: 0, s: acqua ? 0.6 + rnd() * 0.6 : undefined, y: acqua ? undefined : -1.0 });
      }
      // cartelli e barriere a frecce sul fuori delle curve (frecce verso l'interno della curva)
      if (!acqua && Math.abs(k) > 1 / 34 && k * lato < 0 && passo % 10 === 0) {
        const [x, , z] = at(conf.porto ? 0.2 : 1.6), [ax, , az] = pt(s - 6, 0);
        metti(conf.porto ? 'cs_barriera' : 'cs_cartello', x, z, guarda(ax - x, az - z), 1.2, { margine: 0.1, sx: k > 0 ? -1 : 1 });
      }
      if (acqua || conf.porto) continue;
      // il paese: case affacciate sulla strada, manichini sul marciapiede
      if (paese && passo % 4 === 0) {
        const off = 7 + rnd() * 2, [x, , z] = at(off);
        metti(CASE[Math.floor(rnd() * 3)]!, x, z, versoPista(x, z), 4.4, { margine: 0.5 });
      }
      if ((paese || !terra) && passo % 6 === (lato > 0 ? 0 : 4) && rnd() < 0.6) {
        const [x, , z] = at(1.6 + rnd() * 0.8);
        if (t.alt(x, z) > L + 0.2) {
          const ry = versoPista(x, z) + (rnd() - 0.5) * 0.6, y = t.alt(x, z);
          if (metti(MANI_PIEDI[Math.floor(rnd() * 2)]!, x, z, ry, 0.45, { margine: 0.2, y })) teste.push({ x, y: y + 1.38, z, ry });
        }
      }
      // spiaggia: ombrelloni, lettini e palme sulla sabbia
      if (passo % 4 === 0) {
        const off = 4 + rnd() * 14, [x, , z] = at(off), h = t.alt(x, z);
        if (h > L + 0.05 && h < L + 1.6) {
          const c = rnd();
          if (c < 0.55) { if (metti(OMBR[Math.floor(rnd() * 3)]!, x, z, rnd() * 6.28, 1.5)) { const a = rnd() * 6.28; metti('cs_sdraio', x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2, a, 0.6, { margine: 0 }); } }
          else if (c < 0.75) metti('prop_palma', x, z, rnd() * 6.28, 1.2, { s: 1.5 + rnd() * 0.5 });
          else if (c < 0.82 && p.def.tipo === 'fuga') metti('cs_cabina', x, z, versoPista(x, z), 1.2);
        }
      }
      // campagna: pini e palme, scogli sui pendii
      if (passo % 2 === 0 && rnd() < (p.def.tipo === 'fuga' ? 0.3 : 0.5)) {
        const off = 4 + rnd() * (p.def.tipo === 'fuga' ? 30 : 42), [x, , z] = at(off), h = t.alt(x, z);
        if (h > L + 1.2) {
          const ripido = Math.abs(t.alt(x + 2, z) - h) + Math.abs(t.alt(x, z + 2) - h) > 1.6;
          if (ripido) { if (rnd() < 0.35) metti(rnd() < 0.5 ? 'cs_scoglio_a' : 'cs_scoglio_b', x, z, rnd() * 6.28, 2.2, { s: 0.6 + rnd() * 0.6 }); }
          else if (!paese || off > 16) metti(rnd() < 0.65 ? 'cs_pino' : 'prop_palma', x, z, rnd() * 6.28, 2.0, { s: rnd() < 0.5 ? 1.0 + rnd() * 0.4 : 1.6 + rnd() * 0.4 });
        }
      }
    }
  }

  // il mare: scogli sulla riva, barche a vela al largo
  const { x0, x1, z0, z1 } = t.bordo;
  for (let i = 0; i < 900; i++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), h = t.nat(x, z), q = t.vicini.vicino(x, z, 30);
    if (q && q.d < q.c.fuori + 6) continue;
    if (h < L - 0.3 && h > L - 1.6 && rnd() < 0.25) metti(rnd() < 0.5 ? 'cs_scoglio_a' : 'cs_scoglio_b', x, z, rnd() * 6.28, 2.5, { y: L - 0.4, s: 0.7 + rnd() * 0.8 });
    else if (h < L - 2.5 && (!q || q.d > q.c.fuori + 20) && rnd() < 0.025) metti('cs_barca_vela', x, z, rnd() * 6.28, 4, { y: L - 0.1 });
  }

  // il porto: container impilati e gru sulle banchine, bancarelle e manichini dove passa il pubblico
  if (conf.porto) {
    for (let i = 0; i < 4000; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), h = t.nat(x, z), q = t.vicini.vicino(x, z, 40);
      if (h < L + 0.3 || !q) continue;
      const e = q.d - q.c.fuori, ry = guarda(q.c.x - x, q.c.z - z), dentroG = t.dentroGiro(x, z);
      if (dentroG && e > DARSENA + 9 && rnd() < 0.3) {
        const alto = 1 + Math.floor(rnd() * 3), y = t.alt(x, z);
        if (metti(CONTAINER[0]!, x, z, ry + Math.PI / 2, 3.4, { y })) for (let k = 1; k < alto; k++) pezzi.push({ m: CONTAINER[(k + i) % 3]!, x, y: y + 2.6 * k, z, ry: ry + Math.PI / 2 });
        else if (pezzi.length) pezzi.pop();
      } else if (dentroG && e > DARSENA + 2.6 && e < DARSENA + 6 && rnd() < 0.05) metti(rnd() < 0.5 ? 'cs_gru_rossa' : 'cs_gru_blu', x, z, ry, 3.2);
      else if (!dentroG && e > DARSENA + 3 && e < DARSENA + 7 && rnd() < 0.15) metti('cs_bancarella', x, z, ry, 2.2);
      else if (e > DARSENA + 0.6 && e < DARSENA + 3 && rnd() < 0.25) {
        const y = t.alt(x, z), r2 = ry + (rnd() - 0.5) * 0.5;
        if (metti(MANI_PIEDI[i % 2]!, x, z, r2, 0.45, { y })) teste.push({ x, y: y + 1.38, z, ry: r2 });
      } else if (!dentroG && e > DARSENA + 10 && e < DARSENA + 40 && rnd() < 0.06) metti(CASE[i % 3]!, x, z, ry, 4.4);
    }
  }

  // la baia: l'isola con la spiaggia, palme e ombrelloni; l'arco di roccia sopra il canale stretto
  if (conf.isola) {
    for (let i = 0; i < 1600; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), h = t.alt(x, z);
      if (h < L + 0.1) continue;
      if (h < L + 1.4) { if (rnd() < 0.3) metti(OMBR[i % 3]!, x, z, rnd() * 6.28, 1.6); else if (rnd() < 0.3) metti('prop_palma', x, z, rnd() * 6.28, 1.2, { s: 1.6 }); }
      else if (rnd() < 0.25) metti(rnd() < 0.5 ? 'cs_pino' : 'prop_palma', x, z, rnd() * 6.28, 2, { s: 1.3 });
      else if (rnd() < 0.06) metti(CASE[i % 3]!, x, z, rnd() * 6.28, 4.4);
    }
    let sMin = 0, lMin = Infinity;
    for (let s = 0; s < n.len; s += 4) { const l = campo(n, n.l, s); if (l < lMin) { lMin = l; sMin = s; } }
    const [x, , z] = pt(sMin, 0), [ax, , az] = pt(sMin + 1, 0);
    pezzi.push({ m: 'cs_arco_roccia', x, y: L - 1, z, ry: guarda(ax - x, az - z), s: Math.max(1, (lMin + p.def.bordo + 1.5) / 3.8) });
  }
  return { pezzi, teste };
}

// ---------- montaggio ----------
let loaderP: Promise<Loader> | null = null;
function loader(): Promise<Loader> {
  if (!loaderP) loaderP = createLoader({ base: '/assets/' }).then(async (l) => { await l.extend('manifest_corse.json'); return l; });
  return loaderP;
}
type Parte = { geo: THREE.BufferGeometry; emissivo: boolean };
async function parti(l: Loader, nome: string): Promise<Parte[]> {
  if (!l.has(nome)) return [];
  const { scene } = await l.load(nome), out: Parte[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const g = float32(m.geometry.clone()); g.applyMatrix4(m.matrixWorld); // prima in float: le glb quantizzate sono Int16 normalizzati
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const nome = (Array.isArray(m.material) ? m.material[0] : m.material)?.name ?? '';
    out.push({ geo: g.index ? g.toNonIndexed() : g, emissivo: nome.startsWith('mat_emissivo') });
  });
  return out;
}

/** Inverte il verso dei triangoli (dopo una scala negativa, se no le facce davanti spariscono). */
function giraFacce(g: THREE.BufferGeometry): void {
  for (const k of ['position', 'normal', 'uv']) {
    const a = g.attributes[k]; if (!a) continue;
    const arr = a.array as Float32Array, w = a.itemSize;
    for (let t = 0; t < a.count; t += 3) for (let c = 0; c < w; c++) { const i1 = (t + 1) * w + c, i2 = (t + 2) * w + c, x = arr[i1]!; arr[i1] = arr[i2]!; arr[i2] = x; }
  }
}

/** Unisce geometrie con position/normal/uv (non indicizzate). */
function unisci(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0; for (const g of gs) n += g.attributes.position!.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of gs) {
    const c = g.attributes.position!.count;
    pos.set(g.attributes.position!.array as Float32Array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array as Float32Array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, o * 2);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
/** Quantizza position/normal/uv in float32 puri (le glb quantizzate arrivano normalizzate in Int16/Uint16). */
function float32(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of ['position', 'normal', 'uv']) {
    const a = g.attributes[k]; if (!a) continue;
    if (a.array instanceof Float32Array && !(a as THREE.BufferAttribute).normalized) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
  }
  return g;
}

export type Scena = { gruppo: THREE.Group; pronta: Promise<{ pezzi: number; teste: number; triangoli: number }> };

/** Veste la pista: il terreno subito, i pezzi quando il kit è scaricato. Tutto dentro `gruppo` (lo aggiunge chi chiama). */
export function creaScena(p: Pista): Scena | null {
  const conf = SCENE[p.def.id]; if (!conf) return null;
  const gruppo = new THREE.Group(); gruppo.name = 'corse_scena';
  const t = terreno(p, conf);
  const matTerra = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  let triangoli = 0;
  for (const [k, tl] of griglia(t)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tl.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(tl.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, matTerra); m.name = 'corse_terra_' + k; m.receiveShadow = true;
    gruppo.add(m); triangoli += tl.pos.length / 9;
  }
  if (conf.livello > -1) { // il mare a filo della pista d'acqua (quello del banco sta 1,2 m sotto)
    // spinto indietro nella profondità: la pista d'acqua e il molo stanno a pochi cm e non devono sfarfallare
    const mare = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: P.acqua, flatShading: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8 }));
    mare.rotation.x = -Math.PI / 2; mare.position.set((t.bordo.x0 + t.bordo.x1) / 2, conf.livello, (t.bordo.z0 + t.bordo.z1) / 2);
    mare.receiveShadow = true; mare.name = 'corse_mare'; gruppo.add(mare);
  }
  const { pezzi, teste } = piazza(p, t);
  const pronta = (async () => {
    const l = await loader();
    const atlas = (await l.texture('atlas.png')).clone(); atlas.flipY = false; atlas.needsUpdate = true; // le UV delle glb hanno l'origine in alto
    const matA = new THREE.MeshLambertMaterial({ map: atlas, flatShading: true }), matE = new THREE.MeshBasicMaterial({ map: atlas });
    const kit = new Map<string, Parte[]>();
    for (const nome of new Set([...pezzi.map((x) => x.m), 'cs_manichino_testa'])) kit.set(nome, await parti(l, nome));
    const riq = new Map<number, { a: THREE.BufferGeometry[]; e: THREE.BufferGeometry[] }>();
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    let fatti = 0;
    for (const pz of pezzi) {
      const pp = kit.get(pz.m); if (!pp?.length) continue;
      const s = pz.s ?? 1, specchio = (pz.sx ?? 1) < 0;
      M4.compose(new THREE.Vector3(pz.x, pz.y, pz.z), Q.setFromAxisAngle(Y, pz.ry), new THREE.Vector3(s * (pz.sx ?? 1), s, s));
      const k = Math.floor((pz.x - t.bordo.x0) / RIQ) * 1000 + Math.floor((pz.z - t.bordo.z0) / RIQ);
      let r = riq.get(k); if (!r) riq.set(k, (r = { a: [], e: [] }));
      for (const x of pp) {
        const g = x.geo.clone(); g.applyMatrix4(M4);
        if (specchio) giraFacce(g);
        (x.emissivo ? r.e : r.a).push(g); triangoli += g.attributes.position!.count / 3;
      }
      fatti++;
    }
    for (const [k, r] of riq) {
      if (r.a.length) { const m = new THREE.Mesh(unisci(r.a), matA); m.name = 'corse_pezzi_' + k; m.castShadow = true; m.receiveShadow = true; gruppo.add(m); }
      if (r.e.length) { const m = new THREE.Mesh(unisci(r.e), matE); m.name = 'corse_luci_' + k; gruppo.add(m); }
      for (const g of [...r.a, ...r.e]) g.dispose();
    }
    const tg = kit.get('cs_manichino_testa')?.[0]?.geo;
    if (tg && teste.length) gruppo.add(testeManichini(tg, matA, teste));
    triangoli += (tg?.attributes.position!.count ?? 0) / 3 * teste.length;
    return { pezzi: fatti, teste: teste.length, triangoli: Math.round(triangoli) };
  })();
  pronta.catch((e: unknown) => console.warn('[corse] scenografia non caricata:', e));
  // aggancio per i test e le foto: cosa c'è e quanto pesa
  (globalThis as { __corseScena?: unknown }).__corseScena = { pista: p.def.id, pronta, gruppo, pezzi: pezzi.length, teste: teste.length };
  return { gruppo, pronta };
}

/** Le teste dei manichini: guardano la pista e si girano verso la camera quando passa vicino, a scatti (4 volte al secondo). */
function testeManichini(geo: THREE.BufferGeometry, mat: THREE.Material, teste: Testa[]): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, teste.length);
  im.name = 'corse_teste'; im.castShadow = false; im.frustumCulled = false;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(1, 1, 1), V = new THREE.Vector3();
  const ry = teste.map((h) => h.ry);
  const scrivi = () => {
    teste.forEach((h, i) => { M4.compose(V.set(h.x, h.y, h.z), Q.setFromAxisAngle(Y, ry[i]!), S); im.setMatrixAt(i, M4); });
    im.instanceMatrix.needsUpdate = true;
  };
  scrivi();
  let ultimo = 0;
  im.onBeforeRender = (_r, _s, cam) => {
    if (!(cam as THREE.PerspectiveCamera).isPerspectiveCamera) return; // l'ombra del sole non conta
    const ora = performance.now(); if (ora - ultimo < 250) return;
    ultimo = ora;
    const cx = cam.position.x, cz = cam.position.z;
    teste.forEach((h, i) => {
      const d2 = (cx - h.x) ** 2 + (cz - h.z) ** 2;
      let a = h.ry;
      if (d2 < 32 * 32) { a = guarda(cx - h.x, cz - h.z); const dd = Math.atan2(Math.sin(a - h.ry), Math.cos(a - h.ry)); a = h.ry + Math.max(-1.6, Math.min(1.6, dd)); }
      ry[i] = a;
    });
    scrivi();
  };
  return im;
}
