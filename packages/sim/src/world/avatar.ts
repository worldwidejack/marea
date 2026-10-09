// Movimento a piedi: pura, deterministica. Collisione a cerchio (raggio da BALANCE) che scivola lungo i bordi.
import { BALANCE } from '@marea/content';
import { DT } from '../constants.ts';
import type { InputFrame } from '../types.ts';
import { resolveCircle } from './collide.ts';
import type { GridMap } from './grid.ts';
import * as trig from '../trig.ts';

export type AvatarAnim = 'idle' | 'walk' | 'run' | 'sit';
export type AvatarState = { x: number; z: number; yaw: number; vx: number; vz: number; anim: AvatarAnim };

export function newAvatar(x: number, z: number): AvatarState {
  return { x, z, yaw: 0, vx: 0, vz: 0, anim: 'idle' };
}

const WALK_TILES = new Set(['.', 'g', 'd', 'P', 'L']);
const wrap = (a: number): number => trig.atan2(trig.sin(a), trig.cos(a));

export function stepAvatar(s: AvatarState, input: InputFrame, map: GridMap): AvatarState {
  const { camminata, corsa, sogliaCorsa, raggio } = BALANCE.avatar;
  const mag = Math.min(1, trig.hypot(input.mx, input.my));
  const moving = mag >= 0.1;
  const run = moving && (mag > sogliaCorsa || input.b);
  const speed = !moving ? 0 : run ? corsa : camminata;
  const ux = moving ? input.mx / trig.hypot(input.mx, input.my) : 0;
  const uz = moving ? input.my / trig.hypot(input.mx, input.my) : 0;
  const blocked = (cx: number, cz: number): boolean => !WALK_TILES.has(map.at(cx, cz));
  const tx = s.x + ux * speed * DT, tz = s.z + uz * speed * DT;
  const p = resolveCircle(map, blocked, tx, tz, raggio);
  // se partivo già incastrato (teletrasporto) e la spinta non basta, resto dove sono
  const ok = map.walkable(p.x, p.z);
  const x = ok ? p.x : s.x, z = ok ? p.z : s.z;
  const vx = (x - s.x) / DT, vz = (z - s.z) / DT;
  const real = trig.hypot(vx, vz);
  // la faccia segue il joystick (rotazione morbida), anche se si sta scivolando lungo un muro
  const yaw = moving ? wrap(s.yaw + Math.max(-0.35, Math.min(0.35, wrap(trig.atan2(ux, -uz) - s.yaw)))) : s.yaw;
  const anim: AvatarAnim = real < 0.2 ? 'idle' : run && real > camminata + 0.1 ? 'run' : 'walk';
  return { x, z, yaw, vx, vz, anim };
}
