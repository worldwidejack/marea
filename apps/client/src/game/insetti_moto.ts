// I passi comuni degli insetti di Borgo Marea: andare avanti, girarsi verso un punto, scappare, saltare. Li usano le
// macchine a stati di game/insetti_vita.ts e i comportamenti della seconda infornata (game/insetti_specie.ts). Solo client, niente three.
import { INSETTI_CFG } from '@marea/content/insetti.ts';
import type { Attore, Chi, Mondo } from './insetti_vita.ts';

export const PASSI = INSETTI_CFG.passi;
export const d2 = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
export const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
/** Prua (rad) per andare verso (dx, dz): come prua() degli animali, avanti = −Z. */
export const prua = (dx: number, dz: number) => Math.atan2(dx, -dz);
/** Un passo avanti sulla prua: chi scappa e mette il piede in acqua ci cade (true); `solo` = solo dove si cammina (i volanti no). */
export const avanti = (a: Attore, v: number, dt: number, m: Mondo, solo = true): boolean => {
  const nx = a.x + Math.sin(a.h) * v * dt, nz = a.z - Math.cos(a.h) * v * dt;
  if (a.stato === 'scappa' && m.acqua?.(nx, nz)) {
    a.x = nx; a.z = nz; a.stato = 'acqua'; a.t = 0; return true;
  }
  if (!solo || m.terra(nx, nz)) {
    if (!solo && m.acqua?.(nx, nz)) { a.h = wrap(a.h + Math.PI * 0.8); return false; }
    a.x = nx; a.z = nz;
  } else a.h = wrap(a.h + Math.PI * (0.6 + 0.4 * Math.sin(a.seme * 9 + a.vita)));
  return false;
};
export const verso = (a: Attore, tx: number, tz: number, k: number, dt: number) => { a.h = wrap(a.h + wrap(prua(tx - a.x, tz - a.z) - a.h) * Math.min(1, k * dt)); };
/** Gira la prua lontano da chi gioca (più `scarto` rad). */
export const lontanoDa = (a: Attore, chi: Chi, k: number, dt: number, scarto = 0) => { const l = prua(a.x - chi.x, a.z - chi.z) + scarto; verso(a, a.x + Math.sin(l), a.z - Math.cos(l), k, dt); };
export const via = (a: Attore) => { if (a.stato !== 'via' && a.stato !== 'preso') { a.stato = 'via'; a.t = 0; } };

export function salta(a: Attore, chi: Chi, lungo: number): void {
  const h = prua(a.x - chi.x, a.z - chi.z) + Math.sin(a.seme * 17 + a.vita) * 0.5;
  saltaVerso(a, h, lungo);
}
/** Un balzo di `lungo` metri sulla prua `h`. */
export function saltaVerso(a: Attore, h: number, lungo: number): void {
  a.stato = 'salta'; a.t = 0; a.sx = a.x; a.sz = a.z; a.ex = a.x + Math.sin(h) * lungo; a.ez = a.z - Math.cos(h) * lungo; a.h = h;
}
/** Il balzo in corso (`dur` secondi, alto `alto` metri): true se è finito in acqua. Alla fine torna in giro (grillo: scappa). */
export function balzo(a: Attore, m: Mondo, dur = 0.6, alto = 0.9): boolean {
  const k = Math.min(1, a.t / dur);
  const nx = a.sx + (a.ex - a.sx) * k, nz = a.sz + (a.ez - a.sz) * k;
  if (m.acqua?.(nx, nz)) { a.x = nx; a.z = nz; a.stato = 'acqua'; a.t = 0; return true; }
  if (m.terra(nx, nz)) { a.x = nx; a.z = nz; } else { a.ex = a.x; a.ez = a.z; }
  a.y = Math.sin(k * Math.PI) * alto;
  if (k >= 1) { a.y = 0; a.stato = a.def.comportamento === 'trillo' || a.def.comportamento === 'schiva' ? 'scappa' : 'giro'; a.t = 0; }
  return false;
}
