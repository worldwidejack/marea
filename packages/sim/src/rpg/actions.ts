// Azioni del personaggio sull'isola (POST /api/rpg → DO Lot). Pure: advance(nowMs) prima, poi controlli, EconomyError in italiano. STUB di WP0: R-rpg.
import type { LotState } from '../economy/types.ts';
import type { RpgAction } from './types.ts';

export function applyRpgAction(lot: LotState, a: RpgAction, nowMs: number): LotState { void lot; void a; void nowMs; throw new Error('TODO R-rpg: applyRpgAction'); }
/** Controllo di forma di un'azione che arriva dalla rete (null = non valida). */
export function parseRpgAction(v: unknown): RpgAction | null { void v; return null; }
