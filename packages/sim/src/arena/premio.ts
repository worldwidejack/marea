// Il duello dell'Arena nel lotto (docs/ARENA.md §6): il DO Arena apre il duello nel lotto di ciascuno (startArena) e a fine partita, con
// l'esito che ha calcolato lui rigiocando il log, lo chiude (finishArena): monete del personaggio per la partita vinta o persa, entro il
// tetto del giorno UTC; pareggio e resa niente. Il bilanciamento dei dungeon non cambia: si toccano solo le monete del lotto (#414) e LotState.arena.
import { ARENA } from '@marea/content/arena.ts';
import { advance } from '../economy/advance.ts';
import { guadagna } from '../economy/monete.ts';
import type { ArenaLotto, LotState } from '../economy/types.ts';

const DAY = 86_400_000;
const NESSUNO: ArenaLotto = { pending: null, giorno: 0, preso: 0, vinte: 0, perse: 0, pari: 0 };

/** Lo stato dell'Arena del lotto, col premio del giorno azzerato se è cambiato il giorno UTC. */
export function arenaOf(lot: LotState, nowMs: number): ArenaLotto {
  const a = lot.arena ?? NESSUNO, g = Math.floor(nowMs / DAY);
  return a.giorno === g ? a : { ...a, giorno: g, preso: 0 };
}

/** Il DO Arena apre il duello `run` (questo giocatore è l'eroe `idx`): uno solo aperto, il nuovo sostituisce il vecchio (che non paga). */
export function startArena(lot: LotState, run: string, idx: number, nowMs: number): LotState {
  return { ...lot, version: lot.version + 1, arena: { ...arenaOf(lot, nowMs), pending: { run, idx, startMs: nowMs } } };
}

/** Come è andata per questo giocatore: vinta, persa, pari, o arreso (anche chi ha perso la linea ed è stato dato per arreso). */
export type ArenaRuolo = 'vinta' | 'persa' | 'pari' | 'arreso';
export type ArenaFine = { lot: LotState; premio: number; pieno: number; tetto: boolean };

/** Chiude il duello `run` col ruolo deciso dal DO Arena: premio entro il tetto di oggi, statistiche. Un duello che non è quello aperto
 *  (vecchio, o già chiuso) non paga niente e non cambia il lotto. `senzaPremio`: tra gli avversari c'erano gladiatori automatici (squadre
 *  incomplete): si contano vinte e perse ma non si pagano monete, così non si fa il pieno di monete contro i bot. */
export function finishArena(lot0: LotState, run: string, ruolo: ArenaRuolo, nowMs: number, senzaPremio = false): ArenaFine {
  const a = arenaOf(lot0, nowMs);
  if (!a.pending || a.pending.run !== run) return { lot: lot0, premio: 0, pieno: 0, tetto: false };
  const P = ARENA.premio, pieno = senzaPremio ? 0 : ruolo === 'vinta' ? P.vinta : ruolo === 'persa' ? P.persa : 0;
  const premio = Math.max(0, Math.min(pieno, P.tetto - a.preso));
  const lot = advance(lot0, nowMs);
  return {
    premio, pieno, tetto: premio < pieno,
    lot: guadagna({
      ...lot, version: lot.version + 1,
      arena: { pending: null, giorno: a.giorno, preso: a.preso + premio, vinte: a.vinte + (ruolo === 'vinta' ? 1 : 0), perse: a.perse + (ruolo === 'persa' || ruolo === 'arreso' ? 1 : 0), pari: a.pari + (ruolo === 'pari' ? 1 : 0) },
    }, premio),
  };
}
