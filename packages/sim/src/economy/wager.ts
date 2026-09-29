// Sfide con posta: apertura (sfidante), accettazione (chi risponde), annullo/rimborso, regolamento con Colpo di coda.
// Convenzione: in `settle` a = sfidante, b = chi risponde (GDD §7: il Colpo di coda premia solo chi risponde).
import { BALANCE, building } from '@marea/content';
import { advance } from './advance.ts';
import { pay } from './actions.ts';
import { EconomyError, ZERO, add, geq, missing, scale, sub, total } from './types.ts';
import type { LotState, Resources } from './types.ts';

const DAY = 86_400_000;
export const dayOf = (nowMs: number): number => Math.floor(nowMs / DAY);

/** Livello del Tavolo (0 = non costruito), tetto della posta e sfide gratis al giorno. */
export function tableInfo(lot: LotState): { level: number; wagerMax: number; free: number; usedToday: number; nowMs: number } {
  const t = lot.buildings.find((b) => b.building === 'tavolo' && b.level >= 1);
  const lvl = t ? building('tavolo').levels[t.level - 1] : undefined;
  const c = lot.challenges;
  const usedToday = c && c.day === dayOf(lot.nowMs) ? c.used : 0;
  return { level: t?.level ?? 0, wagerMax: lvl?.wagerMax ?? 0, free: lvl?.freeChallenges ?? 0, usedToday, nowMs: lot.nowMs };
}

function checkStake(stake: Resources): void {
  for (const k of ['legno', 'pietra', 'perle'] as const)
    if (!Number.isInteger(stake[k]) || stake[k] < 0) throw new EconomyError('posta', 'Posta non valida');
  if (total(stake) < BALANCE.wager.min) throw new EconomyError('posta', `La posta minima è ${BALANCE.wager.min}`);
}

function toEscrow(lot: LotState, stake: Resources): LotState {
  if (!geq(lot.resources, stake)) throw new EconomyError('risorse', 'Risorse insufficienti per la posta', missing(lot.resources, stake));
  return { ...lot, resources: sub(lot.resources, stake), escrow: add(lot.escrow, stake) };
}

/** Lo sfidante apre una sfida: serve il Tavolo; posta tra il minimo e il tetto; oltre le sfide gratis del giorno costa Perle (spese, non rimborsate). */
export function openWager(lot0: LotState, stake: Resources, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  const t = tableInfo({ ...lot, nowMs });
  if (t.level < 1) throw new EconomyError('requisito', `Serve prima: ${building('tavolo').nome}`);
  checkStake(stake);
  if (total(stake) > t.wagerMax) throw new EconomyError('tetto', `Il tuo Tavolo accetta poste fino a ${t.wagerMax}`);
  const fee = t.usedToday >= t.free ? BALANCE.wager.costoExtraPerle : 0;
  const need = add(stake, { ...ZERO, perle: fee });
  if (!geq(lot.resources, need)) throw new EconomyError('risorse', fee ? 'Risorse insufficienti (oltre le sfide gratis serve 1 Perla)' : 'Risorse insufficienti per la posta', missing(lot.resources, need));
  let out = fee ? pay(lot, { ...ZERO, perle: fee }) : lot;
  out = toEscrow(out, stake);
  return { ...out, version: out.version + 1, challenges: { day: dayOf(nowMs), used: t.usedToday + 1 } };
}

/** Chi risponde mette in escrow la stessa posta (non serve il Tavolo, non conta nelle sfide del giorno). */
export function acceptWager(lot0: LotState, stake: Resources, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  checkStake(stake);
  const out = toEscrow(lot, stake);
  return { ...out, version: out.version + 1 };
}

/** Sfida scaduta, rifiutata o annullata: la posta torna dall'escrow alle risorse. */
export function cancelWager(lot0: LotState, stake: Resources, nowMs: number): LotState {
  const lot = advance(lot0, nowMs);
  if (!geq(lot.escrow, stake)) throw new EconomyError('escrow', 'Posta non trovata in escrow', missing(lot.escrow, stake));
  return { ...lot, resources: add(lot.resources, stake), escrow: sub(lot.escrow, stake), version: lot.version + 1 };
}

/** Il Colpo di coda vale se chi risponde (b) ha meno della soglia delle risorse totali dello sfidante (a), escrow compreso. */
export function isColpoDiCoda(a: LotState, b: LotState): boolean {
  const cdc = BALANCE.wager.colpoDiCoda;
  return total(add(b.resources, b.escrow)) < cdc.sogliaRisorse * total(add(a.resources, a.escrow));
}

/** Piatto del vincitore: 2 × posta, × 1,5 col Colpo di coda (il bonus lo mette il banco). */
export function potFor(stake: Resources, colpoDiCoda: boolean): Resources {
  const base = add(stake, stake);
  return colpoDiCoda ? scale(base, BALANCE.wager.colpoDiCoda.moltiplicatore) : base;
}

/**
 * Regolamento di UN lato (serve al server: i due lotti vivono in due Durable Object diversi). Ogni lato da solo tiene l'invariante del proprio lotto.
 * vince: prende `pot`; nel libro mastro la differenza pot − posta è «generata». perde: la posta esce dall'escrow come «spesa». pari: rimborso.
 */
export function settleSide(lot: LotState, stake: Resources, side: 'vince' | 'perde' | 'pari', pot: Resources = add(stake, stake)): LotState {
  if (!geq(lot.escrow, stake)) throw new EconomyError('escrow', 'Posta non trovata in escrow', missing(lot.escrow, stake));
  const escrow = sub(lot.escrow, stake);
  if (side === 'pari') return { ...lot, resources: add(lot.resources, stake), escrow, version: lot.version + 1 };
  if (side === 'perde') return { ...lot, escrow, ledger: { ...lot.ledger, spent: add(lot.ledger.spent, stake) }, version: lot.version + 1 };
  return { ...lot, resources: add(lot.resources, pot), escrow, ledger: { ...lot.ledger, generated: add(lot.ledger.generated, sub(pot, stake)) }, version: lot.version + 1 };
}

/**
 * Entrambi hanno già `stake` in escrow. winner null = parità → rimborso.
 * Il vincitore prende il piatto (2 × posta; 1,5 × il piatto col Colpo di coda). Nel libro mastro la posta dell'avversario
 * è «generata» per il vincitore e «spesa» per chi perde; il bonus del Colpo di coda è generato dal banco.
 */
export function settle(a: LotState, b: LotState, stake: Resources, winner: 'a' | 'b' | null): { a: LotState; b: LotState; pot: Resources; colpoDiCoda: boolean } {
  if (!geq(a.escrow, stake) || !geq(b.escrow, stake)) throw new EconomyError('escrow', 'Posta non trovata in escrow');
  if (!winner) return { a: settleSide(a, stake, 'pari'), b: settleSide(b, stake, 'pari'), pot: add(stake, stake), colpoDiCoda: false };
  const cdc = winner === 'b' && isColpoDiCoda(a, b);
  const pot = potFor(stake, cdc);
  const an = settleSide(a, stake, winner === 'a' ? 'vince' : 'perde', pot);
  const bn = settleSide(b, stake, winner === 'b' ? 'vince' : 'perde', pot);
  return { a: an, b: bn, pot, colpoDiCoda: cdc };
}
