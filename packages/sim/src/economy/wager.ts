// Regolamento di una scommessa tra due lotti. Stub (WP0) con la regola del Colpo di coda; WP3 completa (escrow, scadenze).
import { BALANCE } from '@marea/content';
import { add, scale, sub, total } from './types.ts';
import type { LotState, Resources } from './types.ts';

/** Entrambi hanno già messo `stake` in escrow. winner null = parità → rimborso. */
export function settle(a: LotState, b: LotState, stake: Resources, winner: 'a' | 'b' | null): { a: LotState; b: LotState } {
  const refund = (l: LotState): LotState => ({ ...l, resources: add(l.resources, stake), escrow: sub(l.escrow, stake), version: l.version + 1 });
  if (!winner) return { a: refund(a), b: refund(b) };
  const [w, l] = winner === 'a' ? [a, b] : [b, a];
  const cdc = BALANCE.wager.colpoDiCoda;
  const underdog = total(add(w.resources, w.escrow)) < cdc.sogliaRisorse * total(add(l.resources, l.escrow));
  const pot = underdog ? scale(stake, 2 * cdc.moltiplicatore) : scale(stake, 2);
  const extra = sub(pot, scale(stake, 2)); // il bonus del colpo di coda viene generato dal banco
  const wn: LotState = { ...w, resources: add(w.resources, pot), escrow: sub(w.escrow, stake), ledger: { ...w.ledger, generated: add(w.ledger.generated, extra) }, version: w.version + 1 };
  const ln: LotState = { ...l, escrow: sub(l.escrow, stake), ledger: { ...l.ledger, spent: add(l.ledger.spent, stake) }, version: l.version + 1 };
  const wnFixed: LotState = { ...wn, ledger: { ...wn.ledger, generated: add(wn.ledger.generated, stake) } }; // la posta dell'avversario entra nel suo generato
  return winner === 'a' ? { a: wnFixed, b: ln } : { a: ln, b: wnFixed };
}
