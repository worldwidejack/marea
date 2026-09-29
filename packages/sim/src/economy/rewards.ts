// Premi dei minigiochi: Perle per medaglia (mai zero) e Faro acceso dopo una vittoria.
import { BALANCE, building } from '@marea/content';
import type { Medal } from '../minigames/types.ts';
import { advance } from './advance.ts';
import { ZERO, add } from './types.ts';
import type { LotState, Resources } from './types.ts';

const HOUR = 3_600_000;
/** `esito` c'è solo nelle sfide: 'sconfitta' → almeno le Perle di consolazione; 'vittoria' accende il Faro anche senza medaglia. Senza esito (partita da solo) vince chi prende una medaglia. */
export type GameOutcome = { medal: Medal; esito?: 'vittoria' | 'sconfitta' | 'parita' };

export function perleFor(o: GameOutcome): number {
  const P = BALANCE.perleMedaglia;
  const m = o.medal ? P[o.medal] : 0;
  return Math.max(m, P.sconfitta);
}

export function applyMinigameResult(lot0: LotState, result: GameOutcome, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const perle = perleFor(result);
  const gained: Resources = { ...ZERO, perle };
  const win = result.esito ? result.esito === 'vittoria' : result.medal !== null;
  let boostUntilMs = lot.boostUntilMs ?? 0;
  const faro = lot.buildings.find((b) => b.building === 'faro' && b.level >= 1);
  if (win && faro) {
    const hours = building('faro').levels[faro.level - 1]?.boostHours ?? 2;
    boostUntilMs = Math.max(boostUntilMs, nowMs + hours * HOUR); // un solo Faro attivo: si rinnova, non si somma
  }
  return {
    ...lot,
    version: lot.version + 1,
    resources: add(lot.resources, gained),
    ledger: { ...lot.ledger, generated: add(lot.ledger.generated, gained) },
    boostUntilMs,
  };
}
