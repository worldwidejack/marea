import { ARENA, arenaModo } from '@marea/content/arena.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import type { ArClientMsg } from '@marea/protocol/arena.ts';
import { eroiPer } from '@marea/sim/arena/partita.ts';
import { squadreSala } from './arena_squadre.ts';

export type Sala<C> = { m: ArenaModo; f: number; mappa: string; membri: C[]; squadre: Map<C, number>; soli: number[] };

export function inSquadra<C>(sala: Sala<C>, q: number): C[] { return sala.membri.filter((o) => sala.squadre.get(o) === q); }

export const mappaSala = (m: ArenaModo, id: string): string => ARENA.mappe.some((x) => x.id === id && x.modi.includes(m)) ? id : '';

export function configuraSala<C extends { id: string }>(sala: Sala<C>, m: Extract<ArClientMsg, { t: 'formato' | 'squadra' | 'solo' }>): void {
  const n = eroiPer({ modo: sala.m, per: sala.f });
  if (m.t === 'formato') {
    if (!arenaModo(m.m).per.includes(m.f) || eroiPer({ modo: m.m, per: m.f }) < sala.membri.length) return;
    if (m.m !== sala.m || m.f !== sala.f) {
      const q = squadreSala(sala.membri.length, m.f);
      sala.squadre = new Map(sala.membri.map((o, i) => [o, q[i]!]));
      sala.soli = [];
    }
    sala.m = m.m; sala.f = m.f;
    sala.mappa = mappaSala(m.m, m.mappa);
  } else {
    if (m.q >= n / sala.f) return;
    const membri = inSquadra(sala, m.q);
    if (m.t === 'solo') {
      if (sala.m !== 'sopravvivenza' || sala.f !== 2) return;
      if (m.on && !sala.soli.includes(m.q)) {
        if (membri.length !== 1 || sala.membri.length >= n - sala.soli.length) return;
        sala.soli.push(m.q);
      } else if (!m.on) {
        sala.soli = sala.soli.filter((q) => q !== m.q);
        const fuori = inSquadra(sala, -1)[0];
        if (fuori) sala.squadre.set(fuori, m.q);
      }
    } else {
      const o = sala.membri.find((x) => x.id === m.id);
      if (!o || membri.includes(o)) return;
      const da = sala.squadre.get(o) ?? -1;
      if (membri.length === (sala.soli.includes(m.q) ? 1 : sala.f)) sala.squadre.set(membri.at(-1)!, da);
      else if (inSquadra(sala, da).length === 1) sala.soli = sala.soli.filter((q) => q !== da);
      sala.squadre.set(o, m.q);
    }
  }
}
