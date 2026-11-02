// Movimento a piedi: pura, deterministica. Collisione a cerchio (raggio da BALANCE) che scivola lungo i bordi delle celle e, se ci sono,
// dei solidi (world/ostacoli.ts: alberi, case, banchi, gente del Borgo).
import { BALANCE } from '@marea/content';
import { DT } from '../constants.ts';
import type { InputFrame } from '../types.ts';
import { resolveCircle } from './collide.ts';
import type { GridMap } from './grid.ts';
import { penetra, spingiFuori } from './ostacoli.ts';
import type { Ostacoli } from './ostacoli.ts';
import * as trig from '../trig.ts';

export type AvatarAnim = 'idle' | 'walk' | 'run' | 'roll' | 'sit';
export type AvatarState = { x: number; z: number; yaw: number; vx: number; vz: number; anim: AvatarAnim; rollT?: number; rollCd?: number; prevRoll?: boolean; rollX?: number; rollZ?: number };

export function newAvatar(x: number, z: number): AvatarState {
  return { x, z, yaw: 0, vx: 0, vz: 0, anim: 'idle' };
}

const WALK_TILES = new Set(['.', 'g', 'd', 'P', 'L']);
const wrap = (a: number): number => trig.atan2(trig.sin(a), trig.cos(a));

/** `ost`: i solidi da non attraversare (assenti = solo le celle). `passo`: frazione della velocità (1 = normale; chi tiene carico il retino va più piano). */
export function stepAvatar(s: AvatarState, input: InputFrame, map: GridMap, ost?: Pick<Ostacoli, 'vicini'>, passo = 1): AvatarState {
  const { camminata, corsa, sogliaCorsa, raggio } = BALANCE.avatar;
  const cfg = BALANCE.avatar.schivata;
  let rollT = Math.max(0, (s.rollT ?? 0) - 1), rollCd = Math.max(0, (s.rollCd ?? 0) - 1);
  let rollX = s.rollX ?? 0, rollZ = s.rollZ ?? -1;
  if (input.roll && !s.prevRoll && rollCd === 0 && passo === 1) {
    rollT = Math.round(cfg.durata / DT); rollCd = Math.round(cfg.ricarica / DT);
    const d = trig.hypot(input.mx, input.my);
    rollX = d > 0.1 ? input.mx / d : trig.sin(s.yaw); rollZ = d > 0.1 ? input.my / d : -trig.cos(s.yaw);
  }
  const rolling = rollT > 0;
  const mag = Math.min(1, trig.hypot(input.mx, input.my));
  const moving = mag >= 0.1;
  const run = moving && (mag > sogliaCorsa || input.b);
  let speed = (!moving ? 0 : run ? corsa : camminata) * passo;
  let ux = moving ? input.mx / trig.hypot(input.mx, input.my) : 0;
  let uz = moving ? input.my / trig.hypot(input.mx, input.my) : 0;
  if (rolling) { const t = cfg.durata - rollT * DT; ux = rollX; uz = rollZ; speed = t >= cfg.muoveDa && t < cfg.muoveA ? cfg.velocita * (1.5 - (t - cfg.muoveDa) / (cfg.muoveA - cfg.muoveDa)) : 0; }
  const blocked = (cx: number, cz: number): boolean => !WALK_TILES.has(map.at(cx, cz));
  const tx = s.x + ux * speed * DT, tz = s.z + uz * speed * DT;
  let p = resolveCircle(map, blocked, tx, tz, raggio);
  let solido = false;
  if (ost) {
    // un solido in cui ero già dentro (teletrasporto, casa appena posata) non spinge: così se ne esce camminando
    const gia = ost.vicini(s.x, s.z, raggio).filter((o) => penetra(o, s.x, s.z, raggio).d > 0.02);
    const contro = () => ost.vicini(p.x, p.z, raggio).filter((o) => !gia.includes(o));
    for (let it = 0; it < 3; it++) {
      const q = spingiFuori(contro(), p.x, p.z, raggio);
      if (!q.hit) break;
      p = resolveCircle(map, blocked, q.x, q.z, raggio);
    }
    solido = contro().some((o) => penetra(o, p.x, p.z, raggio).d > 0.02); // stretto tra un solido e un muro: fermo
  }
  // se partivo già incastrato (teletrasporto) e la spinta non basta, resto dove sono
  const ok = map.walkable(p.x, p.z) && !solido;
  const x = ok ? p.x : s.x, z = ok ? p.z : s.z;
  const vx = (x - s.x) / DT, vz = (z - s.z) / DT;
  const real = trig.hypot(vx, vz);
  // la faccia segue il joystick (rotazione morbida), anche se si sta scivolando lungo un muro
  const yaw = rolling ? trig.atan2(rollX, -rollZ) : moving ? wrap(s.yaw + Math.max(-0.35, Math.min(0.35, wrap(trig.atan2(ux, -uz) - s.yaw)))) : s.yaw;
  const anim: AvatarAnim = rolling ? 'roll' : real < 0.2 ? 'idle' : run && real > camminata + 0.1 ? 'run' : 'walk';
  return { x, z, yaw, vx, vz, anim, ...(input.roll || s.prevRoll !== undefined ? { rollT, rollCd, rollX, rollZ, prevRoll: !!input.roll } : {}) };
}
