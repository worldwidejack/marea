// Movimento a piedi: pura, deterministica. Stub funzionante (WP0); WP3 rifinisce tenendo la firma.
import { BALANCE } from '@marea/content';
import { DT } from '../constants.ts';
import type { InputFrame } from '../types.ts';
import type { GridMap } from './grid.ts';

export type AvatarAnim = 'idle' | 'walk' | 'run' | 'sit';
export type AvatarState = { x: number; z: number; yaw: number; vx: number; vz: number; anim: AvatarAnim };

export function newAvatar(x: number, z: number): AvatarState {
  return { x, z, yaw: 0, vx: 0, vz: 0, anim: 'idle' };
}

export function stepAvatar(s: AvatarState, input: InputFrame, map: GridMap): AvatarState {
  const { camminata, corsa, sogliaCorsa, raggio } = BALANCE.avatar;
  const mag = Math.min(1, Math.hypot(input.mx, input.my));
  const run = mag > sogliaCorsa || input.b;
  const speed = mag < 0.1 ? 0 : run ? corsa : camminata;
  const vx = mag < 0.1 ? 0 : (input.mx / mag) * speed;
  const vz = mag < 0.1 ? 0 : (input.my / mag) * speed;
  let x = s.x;
  let z = s.z;
  const nx = x + vx * DT;
  if (canStand(map, nx, z, raggio)) x = nx;
  const nz = z + vz * DT;
  if (canStand(map, x, nz, raggio)) z = nz;
  const yaw = speed > 0 ? Math.atan2(vx, -vz) : s.yaw;
  const anim: AvatarAnim = speed === 0 ? 'idle' : run ? 'run' : 'walk';
  return { x, z, yaw, vx, vz, anim };
}

function canStand(map: GridMap, x: number, z: number, r: number): boolean {
  return map.walkable(x - r, z) && map.walkable(x + r, z) && map.walkable(x, z - r) && map.walkable(x, z + r);
}
