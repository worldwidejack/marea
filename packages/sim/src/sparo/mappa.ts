// Il piazzale dello sparatutto (#355, docs/SPARO.md): le scatole di quel che c'è sopra la banchina (container, casse, barriere, la gru),
// il mare oltre il bordo. Da qui: collisioni del corpo che guardano i piedi (su una cassa ci si sale saltando, sulla base della gru col
// gradino), il suolo sotto i piedi, la griglia «a terra» per le distanze dei nemici (dungeon/map.ts: bfs, stepDown) e il raggio dei
// colpi in 3D, esatto sulle facce delle scatole (così i fori e le scintille stanno sulla lamiera). Solo + − × ÷ e Math.sqrt.
import { SPARO } from '@marea/content/sparo.ts';
import type { SMappaDef } from '@marea/content/sparo.ts';

/** Scatola: rettangolo (x0, z0)-(x1, z1) da terra fino a `top` m. */
export type Scatola = { x0: number; z0: number; x1: number; z1: number; top: number; tipo: 'container' | 'cassa' | 'barriera' | 'gru' };
export type SMappa = {
  def: SMappaDef;
  scatole: Scatola[];
  /** Griglia per i nemici (stanno a terra): celle da `tile` m, `solid` = non calpestabile (scatola più alta del gradino, allargata del
   *  raggio del corpo, o mare); `opaque` = la stessa cosa (serve a dungeon/map.ts). */
  w: number; h: number; tile: number; solid: Uint8Array; opaque: Uint8Array;
};
/** Il mare sta sotto la banchina. */
export const QUOTA_MARE = -0.6;

const CACHE = new WeakMap<SMappaDef, SMappa>();

export function mappaSparo(def: SMappaDef = SPARO.mappa): SMappa {
  const c = CACHE.get(def);
  if (c) return c;
  const D = SPARO.dimensioni, sc: Scatola[] = [];
  const box = (x: number, z: number, lx: number, lz: number, top: number, tipo: Scatola['tipo']) => sc.push({ x0: x - lx / 2, z0: z - lz / 2, x1: x + lx / 2, z1: z + lz / 2, top, tipo });
  for (const o of def.oggetti) {
    const giro = o.rot === 90;
    if (o.tipo === 'container') {
      const [lx, lz, alto] = D.container as [number, number, number];
      box(o.x, o.z, giro ? lz : lx, giro ? lx : lz, alto * (o.piani ?? 1), 'container');
    } else if (o.tipo === 'cassa' || o.tipo === 'barriera') {
      const [lx, lz, alto] = (o.tipo === 'cassa' ? D.cassa : D.barriera) as [number, number, number];
      box(o.x, o.z, giro ? lz : lx, giro ? lx : lz, alto, o.tipo);
    } else {
      const [bx, bz, bAlto] = D.gruBase as [number, number, number], [gx, gz, gAlto] = D.gruGamba as [number, number, number];
      box(o.x, o.z, bx, bz, bAlto, 'gru');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(o.x + sx * D.gruPasso, o.z + sz * D.gruPasso, gx, gz, gAlto, 'gru');
    }
  }
  const tile = def.cella, w = Math.round(def.larga / tile), h = Math.round((def.lunga + def.acqua) / tile);
  const solid = new Uint8Array(w * h), R = SPARO.giocatore.raggio, G = SPARO.giocatore.gradino;
  for (let cz = 0; cz < h; cz++)
    for (let cx = 0; cx < w; cx++) {
      const x = (cx + 0.5) * tile, z = (cz + 0.5) * tile;
      let pieno = z > def.lunga - R ? 1 : 0;
      for (const s of sc) if (!pieno && s.top > G && x > s.x0 - R && x < s.x1 + R && z > s.z0 - R && z < s.z1 + R) pieno = 1;
      solid[cz * w + cx] = pieno;
    }
  const m: SMappa = { def, scatole: sc, w, h, tile, solid, opaque: solid };
  CACHE.set(def, m);
  return m;
}

/** Scatole che fermano chi ha i piedi a quota `piedi` (quelle sotto il gradino si scavalcano). */
const ferma = (s: Scatola, piedi: number): boolean => s.top > piedi + SPARO.giocatore.gradino;

/** Spinge fuori un cerchio dalle scatole che lo fermano e lo tiene sulla banchina. */
function spingi(m: SMappa, p: { x: number; z: number }, r: number, piedi: number): void {
  for (const s of m.scatole) {
    if (!ferma(s, piedi)) continue;
    const nx = p.x < s.x0 ? s.x0 : p.x > s.x1 ? s.x1 : p.x, nz = p.z < s.z0 ? s.z0 : p.z > s.z1 ? s.z1 : p.z;
    const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; continue; }
    // centro dentro la scatola: esce dal lato più vicino
    const l = p.x - s.x0, rr = s.x1 - p.x, u = p.z - s.z0, dd = s.z1 - p.z, mn = Math.min(l, rr, u, dd);
    if (mn === l) p.x = s.x0 - r; else if (mn === rr) p.x = s.x1 + r; else if (mn === u) p.z = s.z0 - r; else p.z = s.z1 + r;
  }
  const d = m.def;
  if (p.x < r) p.x = r; else if (p.x > d.larga - r) p.x = d.larga - r;
  if (p.z < r) p.z = r; else if (p.z > d.lunga - r) p.z = d.lunga - r;
}

/** Muove un cerchio di (dx, dz) scivolando sulle scatole, a passi ≤ r. */
export function muovi(m: SMappa, p: { x: number; z: number }, dx: number, dz: number, r: number, piedi: number): void {
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len === 0) return;
  const n = Math.max(1, Math.ceil(len / (r * 0.9))), sx = dx / n, sz = dz / n;
  for (let i = 0; i < n; i++) { p.x += sx; spingi(m, p, r, piedi); p.z += sz; spingi(m, p, r, piedi); }
}

/** Quota del suolo sotto un cerchio coi piedi a `piedi`: la cima più alta che si tocca e che non ferma (banchina = 0). */
export function suolo(m: SMappa, x: number, z: number, r: number, piedi: number): number {
  let q = 0;
  for (const s of m.scatole) {
    if (ferma(s, piedi) || s.top <= q) continue;
    const nx = x < s.x0 ? s.x0 : x > s.x1 ? s.x1 : x, nz = z < s.z0 ? s.z0 : z > s.z1 ? s.z1 : z;
    const dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < r * r * 0.25) q = s.top; // ci vuole almeno mezzo piede sopra
  }
  return q;
}

export type Impatto = {
  t: number; x: number; y: number; z: number;
  /** muro = una scatola (`scatola` = indice), terra = la banchina, acqua = il mare, nulla = oltre la portata. */
  cosa: 'muro' | 'terra' | 'acqua' | 'nulla';
  nx: number; ny: number; nz: number; scatola: number;
};

/** Il primo ostacolo lungo il raggio da (ox, oy, oz) in direzione (dx, dy, dz) (versore), fino a `max` m. */
export function raggio(m: SMappa, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): Impatto {
  let best = max, cosa: Impatto['cosa'] = 'nulla', nx = 0, ny = 0, nz = 0, idx = -1;
  for (let i = 0; i < m.scatole.length; i++) {
    const s = m.scatole[i]!;
    // slab: x, y (0..top), z
    let t0 = 0, t1 = best, fx = 0, fy = 0, fz = 0;
    if (dx !== 0) {
      let a = (s.x0 - ox) / dx, b = (s.x1 - ox) / dx, f = -1;
      if (a > b) { const k = a; a = b; b = k; f = 1; }
      if (a > t0) { t0 = a; fx = f; fy = 0; fz = 0; }
      if (b < t1) t1 = b;
    } else if (ox < s.x0 || ox > s.x1) continue;
    if (t0 > t1) continue;
    if (dz !== 0) {
      let a = (s.z0 - oz) / dz, b = (s.z1 - oz) / dz, f = -1;
      if (a > b) { const k = a; a = b; b = k; f = 1; }
      if (a > t0) { t0 = a; fx = 0; fy = 0; fz = f; }
      if (b < t1) t1 = b;
    } else if (oz < s.z0 || oz > s.z1) continue;
    if (t0 > t1) continue;
    if (dy !== 0) {
      let a = (0 - oy) / dy, b = (s.top - oy) / dy, f = -1;
      if (a > b) { const k = a; a = b; b = k; f = 1; }
      if (a > t0) { t0 = a; fx = 0; fy = f; fz = 0; }
      if (b < t1) t1 = b;
    } else if (oy < 0 || oy > s.top) continue;
    if (t0 > t1 || t0 <= 0) continue;
    if (t0 < best) { best = t0; cosa = 'muro'; nx = fx; ny = fy; nz = fz; idx = i; }
  }
  // banchina (y = 0 fino al bordo) e mare (QUOTA_MARE oltre)
  if (dy < 0) {
    const tt = (0 - oy) / dy;
    if (tt > 0 && tt < best) {
      // la banchina continua dietro i muri di container (verso −z e ai lati): il mare comincia oltre il bordo
      const z = oz + dz * tt;
      if (z <= m.def.lunga) { best = tt; cosa = 'terra'; nx = 0; ny = 1; nz = 0; idx = -1; }
      else {
        const tm = (QUOTA_MARE - oy) / dy;
        if (tm < best) { best = tm; cosa = 'acqua'; nx = 0; ny = 1; nz = 0; idx = -1; }
      }
    }
  }
  return { t: best, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best, cosa, nx, ny, nz, scatola: idx };
}

/** Vista libera tra due punti (niente scatole in mezzo). */
export function vede(m: SMappa, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1e-6) return true;
  return raggio(m, ax, ay, az, dx / d, dy / d, dz / d, d).cosa === 'nulla';
}
