// Roll deterministico: il movimento resta nella collisione ordinaria dell'eroe.
import { RPG } from '@marea/content/rpg.ts';
import type { DungeonInput } from './types.ts';
import type { HeroRt } from './state.ts';
import { secToTicks } from './state.ts';

export function stepSchivata(h: HeroRt, inp: DungeonInput): void {
  const c = RPG.schivata, down = !!inp.roll && !h.prevRoll;
  h.prevRoll = !!inp.roll;
  h.rollCd = Math.max(0, (h.rollCd ?? 0) - 1);
  if (h.act === 'schiva' || !down || h.rollCd > 0 || h.stamina < c.stamina || h.slideDir || h.raffica > 0) return;
  if (!['idle', 'press', 'carica', 'tende', 'punta'].includes(h.act)) return;
  const d = Math.sqrt(inp.mx * inp.mx + inp.my * inp.my);
  if (d > 0.1) { h.fx = inp.mx / d; h.fz = inp.my / d; }
  h.act = 'schiva'; h.actT = 0; h.actDur = secToTicks(c.durata);
  h.stamina -= c.stamina; h.rollCd = secToTicks(c.ricarica);
  h.carica = 0; h.canale = 0; h.massimo = false; h.massimaP = 0;
}

export function schivaColpo(h: HeroRt): boolean {
  const c = RPG.schivata;
  return h.act === 'schiva' && h.actT >= secToTicks(c.invDa) && h.actT < secToTicks(c.invA);
}

export function velocitaSchivata(h: HeroRt): number {
  const c = RPG.schivata, t = h.actT / 60;
  if (t < c.muoveDa || t >= c.muoveA) return 0;
  const p = (t - c.muoveDa) / (c.muoveA - c.muoveDa);
  return c.distanza / (c.muoveA - c.muoveDa) * (1.5 - p);
}
