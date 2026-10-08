// Spedizione rimasta aperta con un salvataggio all'altare (scheda chiusa a metà, connessione persa): il server la chiude rigiocando gli
// input fino all'altare, così il bottino salvato lì arriva nello zaino o nel Forziere (docs/RPG.md §4). E spedizioni insieme (#118): si
// chiudono col log della squadra (risultatoGruppo, chiudiGruppo). Pura.
import { RPG } from '@marea/content/rpg.ts';
import type { LotState } from '../economy/types.ts';
import type { HeroState, RunHero, RunResult } from '../rpg/types.ts';
import { finishDungeon } from '../rpg/run.ts';
import type { DungeonOutcome } from '../rpg/run.ts';
import { dungeon } from './dungeon.ts';
import type { DungeonAzioni, PackedDungeon } from './types.ts';
import { decodeDungeon, parseDungeonAzioni, replayDungeon, replayParty } from './replay.ts';

/** Chiude la spedizione aperta col suo salvataggio (null se non c'è niente da chiudere). */
export function chiudiSalvata(lot: LotState, nowMs: number): DungeonOutcome | null {
  const p = lot.dungeon?.pending, sv = p?.salvataggio;
  if (!p || !sv) return null;
  const inputs = decodeDungeon(sv.inputs, dungeon.maxTicks);
  if (!inputs) return null;
  const azioni = parseDungeonAzioni(sv.azioni ?? [], dungeon.maxTicks) ?? [];
  return finishDungeon(lot, replayDungeon(p.seed, p.dungeon, p.hero, inputs, { stato: p.stato ?? null, partenza: p.partenza ?? null, azioni }), nowMs);
}

/** Dungeon insieme (#118): il log della squadra come lo manda il DO Spedizioni (input compressi con encodeDungeon, uno per eroe). */
export type LogGruppo = { dungeon: string; seed: number; eroi: { hero: RunHero; stato: HeroState | null }[]; inputs: string[]; azioni: unknown[] };

/** Esito dell'eroe di questo lotto nella spedizione insieme, rigiocando il log della squadra; null se il log manca, è rotto o non è
 *  quello della spedizione aperta. L'eroe di questo lotto è la fotografia fatta qui (è la stessa che hanno avuto gli altri). */
export function risultatoGruppo(lot: LotState, log: unknown): RunResult | null {
  const p = lot.dungeon?.pending, g = p?.party;
  if (!p || !g || !log || typeof log !== 'object') return null;
  const l = log as LogGruppo, n = Array.isArray(l.eroi) ? l.eroi.length : 0;
  if (l.seed !== p.seed || l.dungeon !== p.dungeon || n < 1 || n > 8 || g.idx >= n || !Array.isArray(l.inputs) || !Array.isArray(l.azioni) || l.inputs.length !== n || l.azioni.length !== n) return null;
  const inputs = l.inputs.map((s) => decodeDungeon(s, dungeon.maxTicks)), azioni = l.azioni.map((a) => parseDungeonAzioni(a, dungeon.maxTicks));
  if (inputs.some((x) => !x) || azioni.some((x) => !x)) return null;
  const eroi = l.eroi.map((e, i) => (i === g.idx ? { hero: p.hero, stato: p.stato ?? null } : { hero: e.hero, stato: e.stato ?? null }));
  try {
    return replayParty(p.seed, p.dungeon, eroi, { inputs: inputs as PackedDungeon[], azioni: azioni as DungeonAzioni[] })[g.idx] ?? null;
  } catch { return null; }
}

/** Chiude la spedizione insieme aperta col log della squadra; se il log non c'è più la spedizione si chiude senza niente (come uscire
 *  senza aver salvato). null se la spedizione aperta non è insieme. */
export function chiudiGruppo(lot: LotState, log: unknown, nowMs: number): DungeonOutcome | null {
  if (!lot.dungeon?.pending?.party) return null;
  const r = risultatoGruppo(lot, log);
  if (r) return finishDungeon(lot, r, nowMs);
  return { lot: { ...lot, version: lot.version + 1, dungeon: { pending: null } }, tenuto: {}, monete: 0, livelliSu: 0 };
}

/** Come chiudiSalvata, ma solo se la spedizione è scaduta da un pezzo (durata massima + 5 minuti): nessuno la sta più giocando. */
export function chiudiScaduta(lot: LotState, nowMs: number): DungeonOutcome | null {
  const p = lot.dungeon?.pending;
  if (!p?.salvataggio || nowMs - p.startMs < (RPG.dungeon.maxMinuti + 5) * 60_000) return null;
  return chiudiSalvata(lot, nowMs);
}
