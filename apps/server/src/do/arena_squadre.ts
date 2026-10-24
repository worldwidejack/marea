// Squadre dell'Arena sul server (docs/ARENA.md): chi gioca in quale squadra e i gladiatori automatici che riempiono i posti vuoti.
// Coda veloce: le persone si alternano tra le due squadre (la prima nella 0, la seconda nella 1…), così le squadre sono pari. Sala con codice:
// la squadra di chi l'ha aperta si riempie per prima, poi l'altra. In tutti e due i casi i posti rimasti vuoti sono dei gladiatori, che
// copiano il set di una delle persone (a rotazione): giocano alla pari di chi c'è.
import { ARENA } from '@marea/content/arena.ts';
import type { ArEroe, SqInput } from '@marea/protocol/arena.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import { packDungeon } from '@marea/sim/dungeon/replay.ts';
import type { DungeonInput } from '@marea/sim/dungeon/types.ts';

/** Un posto della partita: la persona che lo occupa (indice in ordine di arrivo) o null = un gladiatore. */
export type Posto = { squadra: 0 | 1; persona: number | null };

/** La squadra di ciascuna persona della coda (`n` persone, `f` per squadra): si alternano. */
export const squadreCoda = (n: number): (0 | 1)[] => Array.from({ length: n }, (_, i) => (i % 2) as 0 | 1);
/** La squadra di ciascuna persona della sala: prima la squadra di chi l'ha aperta, poi l'altra. */
export const squadreSala = (n: number, f: number): (0 | 1)[] => Array.from({ length: n }, (_, i) => (i < f ? 0 : 1));

/** I posti della partita in ordine di eroe (prima tutta la squadra 0, poi la 1): le persone di ogni squadra in ordine di arrivo, poi i gladiatori. */
export function piazza(squadre: readonly (0 | 1)[], f: number): Posto[] {
  const out: Posto[] = [];
  for (const q of [0, 1] as const) {
    const mie = squadre.flatMap((s, p) => (s === q ? [p] : []));
    for (let k = 0; k < f; k++) out.push({ squadra: q, persona: mie[k] ?? null });
  }
  return out;
}

/** Il gladiatore numero `k` della partita col set `eroe` di una delle persone. */
export function gladiatore(k: number, eroe: ArenaEroe): ArEroe {
  const g = ARENA.gladiatori[k % ARENA.gladiatori.length]!;
  return { id: `gladiatore${k}`, nome: g.nome, look: { ...g.look }, eroe, bot: true };
}

/** L'input di un gladiatore come lo manderebbe una persona: [mx×8, my×8, bit, mira?] (vale SQ_TICKS tick). */
export function inputGladiatore(f: DungeonInput): SqInput {
  const r = packDungeon([f])[0]!;
  return r[4] ? [r[1]!, r[2]!, r[3]!, r[4]] : [r[1]!, r[2]!, r[3]!];
}
