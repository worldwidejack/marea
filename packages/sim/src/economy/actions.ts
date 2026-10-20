// Il lotto nuovo e i cappelli. Le azioni sono pure: prima `advance(nowMs)`, poi controlli, EconomyError in italiano (con `manca` se mancano
// monete). Il resto di quello che si compra sta coi suoi pezzi: casa e mobili (casa.ts), botteghe (botteghe.ts), barca (barca.ts).
import { AVATAR, BALANCE } from '@marea/content';
import { advance } from './advance.ts';
import { conBaule } from './casa.ts';
import { spendi } from './monete.ts';
import { EconomyError } from './types.ts';
import type { LotState } from './types.ts';

/** Lotto nuovo: le monete di partenza (`BALANCE.monete.partenza`, nel libro mastro) e il baule di serie in casa. */
export function newLot(owner: string, nowMs: number): LotState {
  const m = BALANCE.monete.partenza;
  return { ...conBaule({ owner, version: 0, nowMs, monete: m, ledger: { monete: { generated: m, spent: 0 } }, posseduti: [] }), version: 0 };
}

/** Cappelli posseduti: i gratuiti (monete 0) sono di tutti, gli altri solo se comprati. */
export function ownsHat(lot: LotState, hatId: string): boolean {
  const h = AVATAR.cappelli.find((x) => x.id === hatId);
  return !!h && (h.monete <= 0 || (lot.posseduti ?? []).includes(hatId));
}

/** Compra un cappello a pagamento, una volta sola (GDD §4): le monete sono spese, il cappello va in `posseduti`. */
export function buyHat(lot0: LotState, hatId: string, nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  const h = AVATAR.cappelli.find((x) => x.id === hatId);
  if (!h) throw new EconomyError('sconosciuto', 'Cappello sconosciuto');
  if (h.monete <= 0) throw new EconomyError('cappello', `${h.nome}: è gratis, non serve comprarlo`);
  if (ownsHat(lot, hatId)) throw new EconomyError('unico', `Hai già: ${h.nome}`);
  lot = spendi(lot, h.monete);
  return { ...lot, version: lot.version + 1, posseduti: [...(lot.posseduti ?? []), hatId] };
}

