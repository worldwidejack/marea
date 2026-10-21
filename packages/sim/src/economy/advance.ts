// L'orologio del lotto: ogni azione porta prima lo stato all'ora del server (`nowMs`). Il giardino che produceva da solo non c'è più, quindi
// è solo l'ora (e la versione, perché chi legge sappia che è cambiato). Pura.
import type { LotState } from './types.ts';

export function advance(lot: LotState, nowMs: number): LotState {
  return nowMs <= lot.nowMs ? lot : { ...lot, nowMs, version: lot.version + 1 };
}
