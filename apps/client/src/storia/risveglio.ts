// Il risveglio (GDD §9): a schermo nero ti si porta sulla spiaggia del Borgo, vicino al molo; la prima riga dei dialoghi (quella senza
// «Nome:») si legge sul nero, poi si riapre e Nonna Pina ti si mette accanto e racconta la leggenda del Navigante (game/porto.ts
// `racconta`). Chi ha la casa sente dov'è; chi non ce l'ha (oltre il 30°) sente che l'hanno affittata.
import type { GameWorld } from '../game/world.ts';
import type { Porto } from '../game/porto.ts';
import { righe } from './dialoghi.ts';
import type { Nero } from './nero.ts';

type XZ = { x: number; z: number };
const ACQUA = new Set(['~', ',']);
const N8: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** La sabbia in riva più vicina al molo del Borgo, libera da solidi, con un posto libero accanto per Pina. */
function rivaDelBorgo(world: GameWorld): { te: XZ; pina: XZ; yaw: number } | null {
  const arch = world.archipelago, map = world.map, borgo = arch.places.find((p) => p.role === 'porto');
  if (!borgo) return null;
  const libero = (x: number, z: number) => map.walkable(x, z) && world.solidi.vicini(x, z, 0.6).length === 0;
  let best: { te: XZ; pina: XZ; yaw: number } | null = null, bd = Infinity;
  for (let cz = borgo.origin[1]; cz < borgo.origin[1] + borgo.h; cz++) for (let cx = borgo.origin[0]; cx < borgo.origin[0] + borgo.w; cx++) {
    if (map.at(cx, cz) !== '.') continue;
    const mare = N8.find(([dx, dz]) => ACQUA.has(map.at(cx + dx, cz + dz)));
    if (!mare) continue;
    const te = map.cellToWorld(cx, cz), d = Math.hypot(te.x - borgo.boat.x, te.z - borgo.boat.z);
    if (d >= bd || !libero(te.x, te.z)) continue;
    // Pina arriva dalla parte della terra: la cella opposta al mare
    const pina = { x: te.x - mare[0] * 1.6, z: te.z - mare[1] * 1.6 };
    if (!libero(pina.x, pina.z)) continue;
    bd = d; best = { te, pina, yaw: Math.atan2(pina.x - te.x, -(pina.z - te.z)) };
  }
  return best;
}

/** A schermo nero (già calato): sulla riva, la riga sul nero, si riapre, parla Pina. Finisce quando chiudi la sua scheda. */
export async function risveglio(o: { world: GameWorld; porto: Porto; nero: Nero; nome: string; aspetta(ms: number): Promise<void> }): Promise<void> {
  const r = rivaDelBorgo(o.world), conCasa = o.world.slot !== null;
  if (r) o.world.aPiedi(r.te.x, r.te.z, r.yaw);
  const v = { nome: o.nome || 'Navigante' }, sveglia = righe('risveglio', v), dopo = righe(conCasa ? 'casa' : 'senzaCasa', v);
  for (const n of sveglia.narra) { await o.nero.chiudi(n); await o.aspetta(3200); }
  await o.nero.apri();
  const f = o.world.avatar.state;
  await o.porto.racconta('pina', [...sveglia.dice, ...dopo.dice], r?.pina ?? { x: f.x + 1.6, z: f.z });
}
