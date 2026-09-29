// Barca arcade: pura, deterministica. Stub funzionante (WP0); WP3 rifinisce (vento, scia) tenendo la firma.
import { BALANCE } from '@marea/content';
import { DT } from '../constants.ts';
import type { InputFrame, Vec2 } from '../types.ts';
import type { AvatarState } from './avatar.ts';
import type { GridMap } from './grid.ts';

export type BoatState = { x: number; z: number; yaw: number; speed: number; rudder: number; wake: number };

export function newBoat(x: number, z: number): BoatState {
  return { x, z, yaw: 0, speed: 0, rudder: 0, wake: 0 };
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Il joystick indica dove vuoi andare: la barca vira verso quella direzione e accelera con l'intensità; `a` = tutta forza. */
export function stepBoat(s: BoatState, input: InputFrame, map: GridMap, wind: Vec2 = { x: 0, z: 0 }): BoatState {
  const B = BALANCE.barca;
  const mag = Math.min(1, Math.hypot(input.mx, input.my));
  let yaw = s.yaw;
  let rudder = 0;
  if (mag > 0.15) {
    const want = Math.atan2(input.mx, -input.my);
    const diff = wrap(want - yaw);
    const maxTurn = B.virata * DT * (0.35 + 0.65 * Math.min(1, s.speed / B.maxSpeed + 0.5));
    const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
    yaw = wrap(yaw + turn);
    rudder = Math.max(-1, Math.min(1, diff / 1.0));
  }
  const throttle = input.a ? 1 : mag > 0.15 ? mag : 0;
  let speed = s.speed + B.accel * throttle * DT;
  speed -= B.attrito * speed * DT * (input.b ? 3 : 1);
  speed = Math.max(0, Math.min(B.maxSpeed, speed));
  const dx = Math.sin(yaw) * speed + wind.x;
  const dz = -Math.cos(yaw) * speed + wind.z;
  const nx = s.x + dx * DT;
  const nz = s.z + dz * DT;
  let x = s.x;
  let z = s.z;
  if (map.navigable(nx, nz)) {
    x = nx;
    z = nz;
  } else if (map.navigable(nx, s.z)) {
    x = nx;
    speed *= 0.5;
  } else if (map.navigable(s.x, nz)) {
    z = nz;
    speed *= 0.5;
  } else {
    speed = Math.abs(speed) * Math.abs(B.rimbalzo);
  }
  const wake = Math.min(1, speed / B.maxSpeed);
  return { x, z, yaw, speed, rudder, wake };
}

/** L'avatar può salire se è su un molo entro raggioImbarco dalla barca. */
export function canBoard(a: AvatarState, b: BoatState, map: GridMap): boolean {
  return map.isDock(a.x, a.z) && Math.hypot(a.x - b.x, a.z - b.z) <= BALANCE.barca.raggioImbarco;
}

/** Punto di sbarco: la cella di molo più vicina alla barca, o null. */
export function landingSpot(b: BoatState, map: GridMap): { x: number; z: number } | null {
  const c = map.worldToCell(b.x, b.z);
  let best: { x: number; z: number; d: number } | null = null;
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      if (map.at(c.cx + dx, c.cz + dz) !== 'd') continue;
      const p = map.cellToWorld(c.cx + dx, c.cz + dz);
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (!best || d < best.d) best = { ...p, d };
    }
  return best && best.d <= BALANCE.barca.raggioImbarco + 1 ? { x: best.x, z: best.z } : null;
}
