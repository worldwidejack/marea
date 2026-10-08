// Come si muovono gli animali (#67): macchine a stati semplici col tempo `t` (secondi), niente fisica. Solo aspetto: niente rete,
// niente server; la casualità viene da createRng (stesso arcipelago → stessi gatti e granchi negli stessi posti per tutti).
// Direzione: `h` = prua come nella sim (avanti = (sin h, −cos h)); il disegno lo fa game/animali.ts con le forme di render/animali_forme.ts.
import * as THREE from 'three';
import type { GridMap, Rng } from '@marea/sim';
import type { Forma, Forme } from '../render/animali_forme.ts';

export type XZ = { x: number; z: number };
export type XYZ = { x: number; y: number; z: number };
/** Chi gioca, visto dagli animali. */
export type Chi = { x: number; z: number; walk: boolean; moving: boolean; yaw: number; speed: number };
export type Disegna = (f: Forma, x: number, y: number, z: number, h: number, pitch?: number, roll?: number, s?: number, c1?: THREE.Color, c2?: THREE.Color) => void;
export type Mondo = { map: GridMap; groundY(x: number, z: number): number; rng: Rng };

export const prua = (dx: number, dz: number) => Math.atan2(dx, -dz);
const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const tile = (m: Mondo, x: number, z: number) => { const c = m.map.worldToCell(x, z); return m.map.at(c.cx, c.cz); };
export const acqua = (m: Mondo, x: number, z: number) => { const t = tile(m, x, z); return t === '~' || t === ','; };
const span = (r: Rng, a: number, b: number) => a + (b - a) * r.next();

// ———————————————————— gabbiani ————————————————————
export type Posatoio = XYZ & { preso: Gabbiano | null };
export type Stormo = { c: XZ; r: number; h: number; dir: 1 | -1; posatoi: Posatoio[] };
export type Gabbiano = {
  s: Stormo; fase: number; r: number; h: number;
  stato: 'vola' | 'scende' | 'posato' | 'sale'; t0: number; dur: number; da: XYZ; a: XYZ; su: XYZ; posa: Posatoio | null; prossimo: number; hPosato: number; giraAl: number;
  /** ultima posizione disegnata (per stato e test) */
  p: XYZ;
};
const V_GABBIANO = 4.2;
function cerchio(g: Gabbiano, t: number): XYZ & { h: number } {
  const w = (g.s.dir * V_GABBIANO) / g.r, a = g.fase + t * w;
  const x = g.s.c.x + g.r * Math.cos(a), z = g.s.c.z + g.r * Math.sin(a);
  return { x, z, y: g.h + 0.5 * Math.sin(t * 0.8 + g.fase * 3), h: prua(-Math.sin(a) * w, Math.cos(a) * w) };
}
const bez = (a: number, b: number, c: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;

export function nuoviGabbiani(stormi: Stormo[], r: Rng, t: number): Gabbiano[] {
  const out: Gabbiano[] = [];
  for (const s of stormi) {
    const n = 3 + (r.next() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const g: Gabbiano = {
        s, fase: (i / n) * Math.PI * 2 + span(r, -0.4, 0.4), r: s.r + span(r, -1.5, 1.5), h: s.h + span(r, -1.5, 1.5),
        stato: 'vola', t0: 0, dur: 1, da: { x: 0, y: 0, z: 0 }, a: { x: 0, y: 0, z: 0 }, su: { x: 0, y: 0, z: 0 }, posa: null,
        prossimo: t + span(r, 4, 25), hPosato: span(r, -3, 3), giraAl: 0, p: { x: s.c.x, y: s.h, z: s.c.z },
      };
      // all'avvio metà circa sono già posati (così al Porto se ne vede qualcuno sul molo)
      const libero = s.posatoi.filter((q) => !q.preso);
      if (r.next() < 0.5 && libero.length) { const q = libero[Math.floor(r.next() * libero.length)]!; q.preso = g; g.posa = q; g.stato = 'posato'; g.prossimo = t + span(r, 6, 30); }
      out.push(g);
    }
  }
  return out;
}

export function aggiornaGabbiano(g: Gabbiano, t: number, chi: Chi, r: Rng, F: Forme['gabbiano'], draw: Disegna | null): void {
  const vicino = (q: XZ, d: number) => Math.hypot(q.x - chi.x, q.z - chi.z) < d;
  if (g.stato === 'vola' && t >= g.prossimo) {
    const liberi = g.s.posatoi.filter((q) => !q.preso && !vicino(q, 6));
    if (liberi.length) {
      const q = liberi[Math.floor(r.next() * liberi.length)]!; q.preso = g; g.posa = q;
      const c = cerchio(g, t); g.da = c; g.a = { x: q.x, y: q.y, z: q.z };
      g.su = { x: (c.x + q.x) / 2, y: Math.max(c.y, q.y + 3), z: (c.z + q.z) / 2 };
      g.dur = Math.max(2.2, Math.min(5, dist(c, q) / 5)); g.t0 = t; g.stato = 'scende';
    } else g.prossimo = t + 5;
  } else if (g.stato === 'posato' && g.posa && (vicino(g.posa, 3.5) || t >= g.prossimo)) {
    const q = g.posa; g.t0 = t; g.dur = 2.2; g.da = { x: q.x, y: q.y, z: q.z };
    const c = cerchio(g, t + g.dur); g.a = c; g.su = { x: q.x + (c.x - q.x) * 0.3, y: q.y + 2.5, z: q.z + (c.z - q.z) * 0.3 };
    g.stato = 'sale'; q.preso = null; g.posa = null;
  }
  if ((g.stato === 'scende' || g.stato === 'sale') && t >= g.t0 + g.dur) {
    if (g.stato === 'scende') { g.stato = 'posato'; g.prossimo = t + span(r, 12, 30); g.hPosato = prua(g.a.x - g.da.x, g.a.z - g.da.z); }
    else { g.stato = 'vola'; g.prossimo = t + span(r, 15, 40); }
  }
  // ---- posa e disegno ----
  const flap = (hz: number) => [F.su, F.mezzo, F.giu, F.mezzo][Math.floor(t * hz + g.fase * 5) & 3]!;
  if (g.stato === 'posato' && g.posa) {
    if (t >= g.giraAl) { g.giraAl = t + span(r, 2.5, 6); g.hPosato += span(r, -0.9, 0.9); } // si guarda attorno a scatti
    g.p = { x: g.posa.x, y: g.posa.y, z: g.posa.z };
    draw?.(F.posato, g.p.x, g.p.y, g.p.z, g.hPosato);
    return;
  }
  if (g.stato === 'vola') {
    const c = cerchio(g, t), ciclo = (t + g.fase * 7) % 6;
    g.p = c;
    draw?.(ciclo < 2.2 ? flap(7) : F.mezzo, c.x, c.y, c.z, c.h, 0, -g.s.dir * 0.35);
    return;
  }
  const u = Math.min(1, (t - g.t0) / g.dur), e = g.stato === 'scende' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
  const x = bez(g.da.x, g.su.x, g.a.x, e), y = bez(g.da.y, g.su.y, g.a.y, e), z = bez(g.da.z, g.su.z, g.a.z, e);
  const u2 = Math.min(1, e + 0.05), hx = bez(g.da.x, g.su.x, g.a.x, u2) - x, hz = bez(g.da.z, g.su.z, g.a.z, u2) - z;
  const h = Math.hypot(hx, hz) > 1e-3 ? prua(hx, hz) : prua(g.a.x - g.da.x, g.a.z - g.da.z);
  g.p = { x, y, z };
  // in discesa plana e all'ultimo frena con le ali alte; in salita sbatte forte
  const f = g.stato === 'sale' ? flap(11) : u > 0.75 ? F.su : F.mezzo;
  // il gabbiano in volo ha il corpo al centro, quello posato ha i piedi a terra: negli ultimi metri lo alzo di quel tanto
  draw?.(f, x, y + (g.stato === 'scende' ? 0.24 * u : 0.24 * (1 - u)), z, h, g.stato === 'sale' ? 0.3 : -0.1);
}

// ———————————————————— gatti ————————————————————
export type StatoGatto = 'dorme' | 'stira' | 'siede' | 'cammina' | 'segue' | 'torna' | 'fusa';
export type Gatto = {
  x: number; z: number; h: number; casa: XZ; area: XZ[]; mantello: [THREE.Color, THREE.Color];
  stato: StatoGatto; fino: number; meta: XZ | null; passo: number; seguito: number; calma: number;
};
const V_CAMMINA = 0.6;
function vaiVerso(m: Mondo, k: Gatto, meta: XZ, v: number, dt: number): boolean {
  const dx = meta.x - k.x, dz = meta.z - k.z, d = Math.hypot(dx, dz);
  if (d < 0.08) return true;
  const s = Math.min(d, v * dt), nx = k.x + (dx / d) * s, nz = k.z + (dz / d) * s;
  k.h = prua(dx, dz);
  if (!m.map.walkable(nx, nz)) return true; // non si butta in acqua
  k.x = nx; k.z = nz; k.passo += s;
  return d - s < 0.08;
}
export function aggiornaGatto(k: Gatto, m: Mondo, t: number, dt: number, chi: Chi, F: Forme['gatto'], draw: Disegna | null): void {
  if (!Number.isFinite(k.x + k.z + k.passo + k.h)) { k.x = k.casa.x; k.z = k.casa.z; k.passo = 0; k.h = 0; k.stato = 'siede'; } // mai NaN nel buffer
  const dChi = Math.hypot(chi.x - k.x, chi.z - k.z), r = m.rng;
  const svegliabile = k.stato === 'siede' || k.stato === 'cammina' || k.stato === 'stira' || (k.stato === 'dorme' && dChi < 1.4);
  if (chi.walk && chi.moving && dChi < 2.6 && svegliabile && t >= k.calma) { k.stato = 'segue'; k.seguito = t; }
  let fermo = true;
  switch (k.stato) {
    case 'segue': {
      // ti viene dietro per qualche metro, poi torna al suo molo
      const meta = { x: chi.x - Math.sin(chi.yaw) * 0.9, z: chi.z + Math.cos(chi.yaw) * 0.9 };
      const d = dist(k, meta);
      if (d > 0.3) { vaiVerso(m, k, meta, Math.min(2.6, 0.6 + d * 1.3), dt); fermo = false; } else k.h = prua(chi.x - k.x, chi.z - k.z);
      if (!chi.walk || dist(k, k.casa) > 8 || t - k.seguito > 8) { k.stato = 'torna'; k.calma = t + 12; }
      break;
    }
    case 'torna': if (vaiVerso(m, k, k.casa, 0.9, dt)) { k.stato = 'siede'; k.fino = t + span(r, 3, 6); } else fermo = false; break;
    case 'cammina': if (!k.meta || vaiVerso(m, k, k.meta, V_CAMMINA, dt) || t >= k.fino) { k.stato = 'siede'; k.fino = t + span(r, 2, 5); } else fermo = false; break;
    case 'fusa': k.h = prua(chi.x - k.x, chi.z - k.z); if (t >= k.fino) { k.stato = 'siede'; k.fino = t + span(r, 4, 8); } break;
    case 'dorme': if (t >= k.fino) { k.stato = 'stira'; k.fino = t + 1.8; } break;
    case 'stira': if (t >= k.fino) { k.stato = 'siede'; k.fino = t + span(r, 3, 7); } break;
    case 'siede':
      if (t >= k.fino) {
        if (r.next() < 0.45) { k.stato = 'dorme'; k.fino = t + span(r, 12, 30); }
        else { k.stato = 'cammina'; k.meta = k.area[Math.floor(r.next() * k.area.length)] ?? k.casa; k.fino = t + 9; }
      }
      break;
  }
  if (!draw) return;
  const y = m.groundY(k.x, k.z), [c1, c2] = k.mantello;
  if (!fermo) { draw(F.cammina[Math.floor(k.passo / 0.17) & 1]!, k.x, y, k.z, k.h, 0, 0, 1, c1, c2); return; }
  const f = k.stato === 'dorme' ? F.dorme : k.stato === 'stira' ? F.stira : k.stato === 'fusa' ? F.fusa : F.seduto;
  const respiro = k.stato === 'dorme' ? 1 + 0.025 * Math.sin(t * 2.4) : k.stato === 'fusa' ? 1 + 0.02 * Math.sin(t * 18) : 1; // le fusa: un tremolio
  draw(f, k.x, y, k.z, k.h, 0, 0, respiro, c1, c2);
}

// ———————————————————— granchi ————————————————————
export type Granchio = { casa: XZ; b: XZ; x: number; z: number; h: number; stato: 'fermo' | 'scappa' | 'sotto' | 'torna'; fino: number; meta: XZ; fase: number; lontano: number };
export function aggiornaGranchio(g: Granchio, m: Mondo, t: number, dt: number, chi: Chi, F: Forme['granchio'], draw: Disegna | null): void {
  const dChi = Math.hypot(chi.x - g.x, chi.z - g.z);
  const destra = { x: Math.cos(g.h), z: Math.sin(g.h) }; // il granchio cammina di lato: lungo il suo asse X
  let corre = 0;
  if ((g.stato === 'fermo' || g.stato === 'torna') && chi.walk && dChi < 2.8) {
    let dx = g.x - chi.x, dz = g.z - chi.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    g.h = Math.atan2(dz, dx); g.meta = { x: g.x + dx * 2.6, z: g.z + dz * 2.6 }; g.stato = 'scappa';
  }
  const muovi = (v: number) => {
    const dx = g.meta.x - g.x, dz = g.meta.z - g.z, d = Math.hypot(dx, dz), s = Math.min(d, v * dt);
    if (d > 0.01) { g.x += (dx / d) * s; g.z += (dz / d) * s; }
    return d - s < 0.02;
  };
  if (g.stato === 'scappa') {
    corre = 14;
    if (muovi(3)) {
      if (acqua(m, g.x, g.z)) { g.stato = 'sotto'; g.fino = t + 6; } else { g.stato = 'fermo'; g.b = { x: g.x, z: g.z }; g.lontano = t + 8; }
    }
  } else if (g.stato === 'sotto') {
    if (t >= g.fino && Math.hypot(chi.x - g.casa.x, chi.z - g.casa.z) > 5) { g.stato = 'fermo'; g.x = g.b.x = g.casa.x; g.z = g.b.z = g.casa.z; }
  } else if (g.stato === 'torna') {
    corre = 5; g.meta = g.casa;
    if (muovi(0.6)) { g.stato = 'fermo'; g.b = { ...g.casa }; }
  } else {
    // fermo: due passetti di lato avanti e indietro
    const o = 0.22 * Math.sin(t * 0.9 + g.fase);
    g.x = g.b.x + destra.x * o; g.z = g.b.z + destra.z * o;
    if (Math.abs(Math.cos(t * 0.9 + g.fase)) > 0.35) corre = 5;
    if (dist(g.b, g.casa) > 0.5 && dChi > 6 && t >= g.lontano) { g.stato = 'torna'; }
  }
  if (!draw || g.stato === 'sotto') return;
  const y = acqua(m, g.x, g.z) ? -0.05 : m.groundY(g.x, g.z);
  draw(F[corre ? Math.floor(t * corre) & 1 : 0]!, g.x, y, g.z, g.h, 0, 0, 1.3);
}

// ———————————————————— pesci ————————————————————
export type Salto = { x: number; z: number; dx: number; dz: number; t0: number; dur: number; len: number; alto: number; c1: THREE.Color; c2: THREE.Color };
/** Il pesce in volo e i due spruzzi (partenza e tuffo). false quando è finito. */
export function disegnaSalto(s: Salto, t: number, F: Forme, draw: Disegna): boolean {
  const u = (t - s.t0) / s.dur;
  if (u > 1.5) return false;
  const spr = (x: number, z: number, k: number) => { if (k >= 0 && k < 0.45) draw(F.spruzzo[Math.min(2, Math.floor(k / 0.15))]!, x, 0.02, z, 0); };
  spr(s.x, s.z, t - s.t0);
  spr(s.x + s.dx * s.len, s.z + s.dz * s.len, t - s.t0 - s.dur);
  if (u >= 0 && u <= 1) {
    const y = -0.15 + 4 * s.alto * u * (1 - u), pitch = Math.atan2(4 * s.alto * (1 - 2 * u), s.len);
    draw(F.pesce, s.x + s.dx * s.len * u, y, s.z + s.dz * s.len * u, prua(s.dx, s.dz), pitch, 0, 1.4, s.c1, s.c2);
  }
  return true;
}
