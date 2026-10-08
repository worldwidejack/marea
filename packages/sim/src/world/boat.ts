// Barca arcade: pura, deterministica. Vento che spinge di lato, collisione a cerchio con rimbalzo morbido, imbarco/sbarco robusti.
import { BALANCE } from '@marea/content';
import { BORDO, DT } from '../constants.ts';
import type { InputFrame, Vec2 } from '../types.ts';
import type { AvatarState } from './avatar.ts';
import { resolveCircle } from './collide.ts';
import type { GridMap } from './grid.ts';

export type BoatState = { x: number; z: number; yaw: number; speed: number; rudder: number; wake: number };

export function newBoat(x: number, z: number): BoatState {
  return { x, z, yaw: 0, speed: 0, rudder: 0, wake: 0 };
}

const NAV_TILES = new Set(['~', ',', 'B']);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Parametri della barca con i default per i campi che BalanceDef non ha ancora (raggio). */
export function boatParams(): typeof BALANCE.barca & { raggio: number } {
  const B = BALANCE.barca as typeof BALANCE.barca & { raggio?: number };
  return { ...B, raggio: B.raggio ?? 0.8 };
}

/**
 * Il joystick indica dove vuoi andare: la barca vira verso quella direzione (più svelta quando va) e accelera con l'intensità;
 * `a` = tutta forza, `b` = freno. `wind` (m/s, assi mondo) sposta la barca senza cambiarne la prua.
 * Contro la costa: la barca viene spinta fuori e perde velocità in proporzione a quanto l'urto è frontale (di striscio scivola).
 */
export function stepBoat(s: BoatState, input: InputFrame, map: GridMap, wind: Vec2 = { x: 0, z: 0 }): BoatState {
  const B = boatParams();
  const mag = Math.min(1, Math.hypot(input.mx, input.my));
  let yaw = s.yaw;
  let rudder = s.rudder * 0.8;
  if (mag > 0.15) {
    const want = Math.atan2(input.mx, -input.my);
    const diff = wrap(want - yaw);
    const maxTurn = B.virata * DT * (0.35 + 0.65 * Math.min(1, s.speed / B.maxSpeed + 0.5));
    const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
    yaw = wrap(yaw + turn);
    rudder = Math.max(-1, Math.min(1, diff));
  }
  const throttle = input.a ? 1 : mag > 0.15 ? mag : 0;
  let speed = s.speed + B.accel * throttle * DT;
  speed -= B.attrito * speed * DT * (input.b ? 3 : 1);
  speed = Math.max(0, Math.min(B.maxSpeed, speed));
  const hx = Math.sin(yaw), hz = -Math.cos(yaw);
  const tx = s.x + (hx * speed + wind.x) * DT;
  const tz = s.z + (hz * speed + wind.z) * DT;
  const blocked = (cx: number, cz: number): boolean => !NAV_TILES.has(map.at(cx, cz));
  const p = resolveCircle(map, blocked, tx, tz, B.raggio);
  let x = p.x, z = p.z;
  if (!map.navigable(x, z)) { x = s.x; z = s.z; speed *= Math.abs(B.rimbalzo); }
  else if (p.hit) {
    const head = Math.max(0, -(hx * p.nx + hz * p.nz)); // 1 = frontale, 0 = di striscio
    speed *= 1 - head * (1 - Math.abs(B.rimbalzo));
    // rimbalzo morbido: un filo di spinta via dalla costa
    x += p.nx * head * 0.02;
    z += p.nz * head * 0.02;
    if (!map.navigable(x, z)) { x = p.x; z = p.z; }
  }
  const wake = Math.min(1, speed / B.maxSpeed);
  return { x, z, yaw, speed, rudder, wake };
}

/**
 * Corrente al bordo del mondo (#5): nella fascia di BORDO.fascia m dentro il bordo della mappa una corrente morbida spinge la barca
 * verso il centro (più forte verso il bordo) e frena chi punta fuori; oltre il bordo non si va. Dentro la mappa, lontano dal bordo,
 * restituisce lo stesso stato (`attiva` false): la sim della barca e le partite registrate non cambiano.
 */
export function correnteBordo(s: BoatState, map: GridMap): { s: BoatState; attiva: boolean } {
  const W = map.w * map.tile, H = map.h * map.tile, F = BORDO.fascia;
  const kx = s.x < F ? (F - s.x) / F : s.x > W - F ? -(s.x - (W - F)) / F : 0;
  const kz = s.z < F ? (F - s.z) / F : s.z > H - F ? -(s.z - (H - F)) / F : 0;
  if (kx === 0 && kz === 0) return { s, attiva: false };
  const k = Math.min(1.5, Math.sqrt(kx * kx + kz * kz));
  const hx = Math.sin(s.yaw), hz = -Math.cos(s.yaw);
  const fuori = -(hx * kx + hz * kz) / Math.max(1e-6, Math.sqrt(kx * kx + kz * kz)); // > 0 = la prua guarda verso il bordo
  const speed = fuori > 0 ? s.speed * Math.max(0, 1 - BORDO.freno * k * fuori * DT) : s.speed;
  const x = Math.min(W - 1, Math.max(1, s.x + Math.min(1.5, kx) * BORDO.corrente * DT));
  const z = Math.min(H - 1, Math.max(1, s.z + Math.min(1.5, kz) * BORDO.corrente * DT));
  if (!map.navigable(x, z)) return { s, attiva: true };
  return { s: { ...s, x, z, speed }, attiva: k > 0.05 };
}

/** Distanza dal centro della cella di molo più vicina (entro `cells` celle), o Infinity. */
function nearestDock(map: GridMap, x: number, z: number, cells: number): { x: number; z: number; d: number } | null {
  const c = map.worldToCell(x, z);
  let best: { x: number; z: number; d: number } | null = null;
  for (let dz = -cells; dz <= cells; dz++)
    for (let dx = -cells; dx <= cells; dx++) {
      if (map.at(c.cx + dx, c.cz + dz) !== 'd') continue;
      const p = map.cellToWorld(c.cx + dx, c.cz + dz);
      const d = Math.hypot(p.x - x, p.z - z);
      if (!best || d < best.d || (d === best.d && (p.z < best.z || (p.z === best.z && p.x < best.x)))) best = { ...p, d };
    }
  return best;
}

/** L'avatar può salire se è sul molo (o a un passo dal molo) ed entro raggioImbarco dalla barca, e la barca è in acqua. */
export function canBoard(a: AvatarState, b: BoatState, map: GridMap): boolean {
  const B = boatParams();
  if (!map.navigable(b.x, b.z)) return false;
  if (Math.hypot(a.x - b.x, a.z - b.z) > B.raggioImbarco) return false;
  if (map.isDock(a.x, a.z)) return true;
  const d = nearestDock(map, a.x, a.z, 1);
  return !!d && d.d <= map.tile * 0.75;
}

/** Punto di sbarco: il centro della cella di molo più vicina alla barca entro raggioImbarco + 1 m, o null. */
export function landingSpot(b: BoatState, map: GridMap): { x: number; z: number } | null {
  const reach = boatParams().raggioImbarco + 1;
  const best = nearestDock(map, b.x, b.z, Math.ceil(reach / map.tile) + 1);
  return best && best.d <= reach && map.walkable(best.x, best.z) ? { x: best.x, z: best.z } : null;
}

// ---------- ormeggi (#6): le barche ferme non si disegnano una sopra l'altra ----------
/** Mezza lunghezza e mezza larghezza dello scafo (m), con un filo d'aria. */
export const SCAFO = { mezzaL: 2.3, mezzaW: 0.8 } as const;
export type Posa = { x: number; z: number; yaw: number };

/** Due scafi (rettangoli orientati 4,6 × 1,6 m) si toccano: separazione degli assi. */
export function barcheSovrapposte(a: Posa, b: Posa): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const axes = [a.yaw, b.yaw].flatMap((y) => [[Math.sin(y), -Math.cos(y)], [Math.cos(y), Math.sin(y)]] as const);
  const half = (p: Posa, ax: number, az: number) =>
    SCAFO.mezzaL * Math.abs(Math.sin(p.yaw) * ax - Math.cos(p.yaw) * az) + SCAFO.mezzaW * Math.abs(Math.cos(p.yaw) * ax + Math.sin(p.yaw) * az);
  for (const [ax, az] of axes) if (Math.abs(dx * ax + dz * az) >= half(a, ax, az) + half(b, ax, az)) return false;
  return true;
}

/** Prua di una barca ormeggiata in (x, z): verso il largo, via dal molo più vicino (0 se non c'è un molo). */
export function yawOrmeggio(x: number, z: number, map: GridMap): number {
  const dock = landingSpot(newBoat(x, z), map);
  return dock ? Math.atan2(x - dock.x, -(z - dock.z)) : 0;
}

/**
 * Posto libero per ormeggiare vicino a (x, z): acqua navigabile per tutto il cerchio della barca, un molo a portata (si scende e si
 * risale) e nessuno scafo in `occupati` toccato con la prua verso il largo. Il più vicino a (x, z) entro `raggio` m (passo 0,5 m), o null.
 */
export function ormeggioLibero(map: GridMap, x: number, z: number, occupati: readonly Posa[], raggio = 12): Posa | null {
  const R = boatParams().raggio, ring = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos((i * Math.PI) / 4) * R, Math.sin((i * Math.PI) / 4) * R] as const);
  const cand: { x: number; z: number; d: number }[] = [];
  for (let dz = -raggio; dz <= raggio; dz += 0.5)
    for (let dx = -raggio; dx <= raggio; dx += 0.5) {
      const d = Math.hypot(dx, dz);
      if (d <= raggio) cand.push({ x: x + dx, z: z + dz, d });
    }
  cand.sort((a, b) => a.d - b.d || a.z - b.z || a.x - b.x);
  for (const c of cand) {
    if (!map.navigable(c.x, c.z) || ring.some(([rx, rz]) => !map.navigable(c.x + rx, c.z + rz))) continue;
    if (!landingSpot(newBoat(c.x, c.z), map)) continue;
    const p = { x: c.x, z: c.z, yaw: yawOrmeggio(c.x, c.z, map) };
    if (!scafoInAcqua(p, map) || occupati.some((o) => barcheSovrapposte(p, o))) continue;
    return p;
  }
  return null;
}
/** Dal centro alla prua lo scafo sta in acqua, fianchi compresi (la poppa può infilarsi sotto il molo, come all'ormeggio di sempre). */
export function scafoInAcqua(p: Posa, map: GridMap): boolean {
  const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
  for (const l of [0, 1.1, 2.1]) for (const w of [-0.7, 0, 0.7]) if (!map.navigable(p.x + fx * l + rx * w, p.z + fz * l + rz * w)) return false;
  return true;
}
