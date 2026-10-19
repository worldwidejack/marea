// Aiuti dei test per le monete (#414): aggiungere o togliere monete tenendo in pari il libro mastro delle monete.
import { guadagna, spendi } from '../src/economy/monete.ts';
import type { LotState } from '../src/economy/types.ts';

/** `n` monete in più (come un premio). */
export const conMonete = (lot: LotState, n: number): LotState => guadagna(lot, n);
/** Il lotto senza monete (spende tutte quelle che ha, anche quelle di partenza). */
export const senzaMonete = (lot: LotState): LotState => spendi(lot, lot.monete);
