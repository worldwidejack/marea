// Le monete (#414, VISIONE §2): l'unica valuta del gioco, `LotState.monete`. Premi e spese passano da qui, col libro mastro delle monete
// (`ledger.monete`: entrate e uscite, per l'invariante «monete = entrate − uscite»). Le risorse di prima (Legno, Pietra, Perle) restano solo
// nel codice spento; i vecchi salvataggi si convertono in lettura (`cambio.ts`). Pura.
import { BALANCE } from '@marea/content';
import { EconomyError } from './types.ts';
import type { LotState, Resources } from './types.ts';

/** Monete del lotto (un lotto non ancora convertito ne ha 0: la conversione la fa il server in lettura). */
export function moneteOf(lot: LotState): number { return typeof lot.monete === 'number' ? lot.monete : 0; }

const libro = (lot: LotState) => lot.ledger.monete ?? { generated: 0, spent: 0 };

/** `n` monete in più (premio, vendita, rimborso): n intero ≥ 0, 0 = lotto invariato. */
export function guadagna(lot: LotState, n: number): LotState {
  const k = Math.max(0, Math.floor(n));
  if (k === 0) return lot;
  const l = libro(lot);
  return { ...lot, monete: moneteOf(lot) + k, ledger: { ...lot.ledger, monete: { generated: l.generated + k, spent: l.spent } } };
}

/** Spende `n` monete o lancia EconomyError 'risorse' con quante ne mancano (`manca.monete`). */
export function spendi(lot: LotState, n: number): LotState {
  const k = Math.max(0, Math.ceil(n)), ho = moneteOf(lot);
  if (k === 0) return lot;
  if (ho < k) throw new EconomyError('risorse', `Monete insufficienti: ne servono ${k}`, { monete: k - ho });
  const l = libro(lot);
  return { ...lot, monete: ho - k, ledger: { ...lot.ledger, monete: { generated: l.generated, spent: l.spent + k } } };
}

/** Le risorse di prima in monete al cambio fisso (`BALANCE.monete.cambio`, GDD §5), arrotondato giù sul totale. */
export function inMonete(r: Partial<Resources>): number {
  const c = BALANCE.monete.cambio;
  return Math.floor((r.legno ?? 0) * c.legno + (r.pietra ?? 0) * c.pietra + (r.perle ?? 0) * c.perle + 1e-9);
}

/** Quanto costa in monete una quantità di risorse di prima (per le cose che si pagavano in Legno, come la forgia): al cambio fisso,
 *  arrotondato su, almeno 1 se serve qualcosa. */
export function prezzoInMonete(r: Partial<Resources>): number {
  const c = BALANCE.monete.cambio, v = (r.legno ?? 0) * c.legno + (r.pietra ?? 0) * c.pietra + (r.perle ?? 0) * c.perle;
  return v > 0 ? Math.max(1, Math.ceil(v - 1e-9)) : 0;
}

/** Invariante delle monete: per ogni lotto monete = entrate − uscite e mai negative. null = ok. */
export function checkMonete(lots: readonly LotState[]): string | null {
  for (const lot of lots) {
    const l = libro(lot), m = moneteOf(lot);
    if (m < 0) return `${lot.owner}: monete negative (${m})`;
    if (m !== l.generated - l.spent) return `${lot.owner}: monete ${m}, dovrebbero essere ${l.generated - l.spent}`;
  }
  return null;
}
