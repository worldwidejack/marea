// Squadre dell'Arena sul server (docs/ARENA.md): chi gioca in quale squadra e i gladiatori automatici che riempiono i posti vuoti.
// Coda veloce: le persone si spargono tra le squadre (la prima nella 0, la seconda nella 1…), così nessuna squadra ne ha troppe. Sala con
// codice: la squadra di chi l'ha aperta si riempie per prima, poi le altre in ordine. In tutti e due i casi i posti rimasti vuoti sono dei
// gladiatori, che copiano il set di una delle persone (a rotazione): giocano alla pari di chi c'è. Con qualsiasi numero di persone (da una
// sola a partita piena) si gioca ogni modalità.
import { ARENA } from '@marea/content/arena.ts';
import type { ArEroe, SqInput } from '@marea/protocol/arena.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import { packDungeon } from '@marea/sim/dungeon/replay.ts';
import type { DungeonInput } from '@marea/sim/dungeon/types.ts';

/** Un posto della partita: la persona che lo occupa (indice in ordine di arrivo) o null = un gladiatore. */
export type Posto = { squadra: number; persona: number | null };

/** La squadra di ciascuna delle `n` persone della coda, con `nSquadre` squadre: si spargono a giro. */
export const squadreCoda = (n: number, nSquadre: number): number[] => Array.from({ length: n }, (_, i) => i % nSquadre);
/** La squadra di ciascuna persona della sala: prima la squadra di chi l'ha aperta, poi le altre (`per` a squadra). */
export const squadreSala = (n: number, per: number): number[] => Array.from({ length: n }, (_, i) => Math.floor(i / per));

/** I posti della partita in ordine di eroe (squadra per squadra): le persone di ogni squadra in ordine di arrivo, poi i gladiatori. */
export function piazza(squadre: readonly number[], nSquadre: number, per: number): Posto[] {
  const out: Posto[] = [];
  for (let q = 0; q < nSquadre; q++) {
    const mie = squadre.flatMap((s, p) => (s === q ? [p] : []));
    for (let k = 0; k < per; k++) out.push({ squadra: q, persona: mie[k] ?? null });
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
