// Invariante del libro mastro: Σ risorse + escrow = generato − speso. null = ok.
import { add, sub, ZERO } from './types.ts';
import type { LotState, Resources } from './types.ts';

export function checkInvariant(lots: readonly LotState[], escrowGlobal: Resources = ZERO): string | null {
  let have = { ...escrowGlobal };
  let should = { ...ZERO };
  for (const l of lots) {
    have = add(have, add(l.resources, l.escrow));
    should = add(should, sub(l.ledger.generated, l.ledger.spent));
  }
  for (const k of ['legno', 'pietra', 'perle'] as const)
    if (have[k] !== should[k]) return `${k}: in giro ${have[k]}, dovrebbe essere ${should[k]}`;
  return null;
}
