// Faro comune del Porto (#111, GDD §5 «Porto tra amici»): un progetto di tutti. Ognuno versa Legno e Pietra dal suo Magazzino; i totali
// fanno salire il faro di livello (soglie in @marea/content/porto_amici.ts) e ogni livello dà a tutti un bonus di produzione (advance.ts).
// Due metà, entrambe pure:
//  - lo stato condiviso `FaroStato` (lo tiene il DO coordinatore `Sfide`): totali, momenti delle salite, chi ha versato quanto;
//  - il lato lotto (`LotState.faro`): il versamento esce dal lotto come una spesa (libro mastro in pari) ed è idempotente per id,
//    perché tra i due DO non c'è transazione e il coordinatore può doverlo ripetere dopo un crash.
// Non esportato da @marea/sim (index.ts): si importa per percorso, come missioni.ts e diario.ts.
import { FARO } from '@marea/content/porto_amici.ts';
import type { FaroLivelloDef } from '@marea/content/porto_amici.ts';
import { advance } from './advance.ts';
import { pay } from './actions.ts';
import { EconomyError } from './types.ts';
import type { FaroLotto, LotState } from './types.ts';

export type FaroDono = { legno: number; pietra: number };
/** Stato del Faro comune: totali versati, quando ha raggiunto ogni livello (ms, crescenti), quanto ha versato ognuno (id persona). */
export type FaroStato = { legno: number; pietra: number; livelli: number[]; versati: Record<string, FaroDono> };
export type FaroClassifica = { chi: string; legno: number; pietra: number }[];

export const faroNuovo = (): FaroStato => ({ legno: 0, pietra: 0, livelli: [], versati: {} });
export const FARO_MAX = FARO.livelli.length;

/** Quanti livelli raggiungono questi totali (in ordine: il 2 solo dopo l'1). */
export function livelloDa(tot: FaroDono): number {
  let lv = 0;
  for (const l of FARO.livelli) { if (tot.legno >= l.legno && tot.pietra >= l.pietra) lv++; else break; }
  return lv;
}
export const faroLivello = (f: FaroStato): number => Math.min(f.livelli.length, FARO_MAX);
/** Il prossimo livello da raggiungere (null = faro completo). */
export function faroProssimo(f: FaroStato): (FaroLivelloDef & { livello: number }) | null {
  const lv = faroLivello(f), d = FARO.livelli[lv];
  return d ? { ...d, livello: lv + 1 } : null;
}
/** Quanto manca al faro completo (ultimo livello), per risorsa. */
export function faroManca(f: FaroStato): FaroDono {
  const fine = FARO.livelli[FARO_MAX - 1];
  return { legno: Math.max(0, (fine?.legno ?? 0) - f.legno), pietra: Math.max(0, (fine?.pietra ?? 0) - f.pietra) };
}
const intero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
/** Il versamento che si fa davvero: interi ≥ 0, mai oltre quello che manca al faro completo. */
export function dosaDono(f: FaroStato, chiesto: { legno?: unknown; pietra?: unknown }): FaroDono {
  const m = faroManca(f);
  return { legno: Math.min(intero(chiesto.legno), m.legno), pietra: Math.min(intero(chiesto.pietra), m.pietra) };
}

/** Versa nel faro (il lotto ha già pagato): totali, quota di `chi`, e i livelli raggiunti adesso (`saliti`, es. [1] o [1, 2]). */
export function versaNelFaro(f: FaroStato, chi: string, dono: FaroDono, nowMs: number): { faro: FaroStato; saliti: number[] } {
  const prima = f.versati[chi] ?? { legno: 0, pietra: 0 };
  const tot = { legno: f.legno + dono.legno, pietra: f.pietra + dono.pietra };
  const livelli = [...f.livelli], saliti: number[] = [];
  for (let lv = livelli.length + 1; lv <= livelloDa(tot); lv++) { livelli.push(nowMs); saliti.push(lv); }
  return { faro: { ...tot, livelli, versati: { ...f.versati, [chi]: { legno: prima.legno + dono.legno, pietra: prima.pietra + dono.pietra } } }, saliti };
}

/** Chi ha versato di più (Legno + Pietra), i primi `n`; a pari merito l'ordine dell'id. */
export function classificaFaro(f: FaroStato, n = FARO.classifica): FaroClassifica {
  return Object.entries(f.versati).map(([chi, d]) => ({ chi, legno: d.legno, pietra: d.pietra }))
    .filter((x) => x.legno + x.pietra > 0)
    .sort((a, b) => b.legno + b.pietra - (a.legno + a.pietra) || (a.chi < b.chi ? -1 : a.chi > b.chi ? 1 : 0))
    .slice(0, n);
}

// ---------- lato lotto ----------
export function faroDi(lot: LotState): FaroLotto {
  return lot.faro ?? { livelli: [], versato: { legno: 0, pietra: 0 }, doni: [] };
}

/**
 * Versamento dal lotto al faro: le risorse escono come una spesa (`ledger.spent`, così Σ risorse + escrow = generato − speso resta vero)
 * e si contano in `faro.versato`. Idempotente per `id`: un versamento già fatto restituisce il lotto com'è (il coordinatore può ripeterlo).
 * EconomyError `risorse` (con `manca`) se il Magazzino non basta, `faro` se il versamento è vuoto.
 */
export function donaAlFaro(lot0: LotState, id: string, dono: FaroDono, nowMs: number): LotState {
  const f0 = faroDi(lot0);
  if (f0.doni.includes(id)) return lot0;
  const d = { legno: intero(dono.legno), pietra: intero(dono.pietra) };
  if (d.legno + d.pietra <= 0) throw new EconomyError('faro', 'Niente da versare');
  let lot = advance(lot0, nowMs);
  lot = pay(lot, { legno: d.legno, pietra: d.pietra, perle: 0 });
  const f = faroDi(lot);
  return {
    ...lot, version: lot.version + 1,
    faro: { ...f, versato: { legno: f.versato.legno + d.legno, pietra: f.versato.pietra + d.pietra }, doni: [...f.doni, id].slice(-FARO.doniTenuti) },
  };
}

/** Il lotto impara i momenti delle salite del faro (mai indietro: si tengono quelli che sa già, si aggiungono i nuovi). Non tocca la versione. */
export function segnaFaro(lot: LotState, livelli: readonly unknown[]): LotState {
  const f = faroDi(lot);
  const nuovi = livelli.filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0).slice(0, FARO_MAX);
  if (nuovi.length <= f.livelli.length) return lot;
  const merged = [...f.livelli, ...nuovi.slice(f.livelli.length)];
  for (let i = 1; i < merged.length; i++) merged[i] = Math.max(merged[i]!, merged[i - 1]!); // crescenti
  return { ...lot, faro: { ...f, livelli: merged } };
}

/** Libro mastro del faro: Σ versato dai lotti = Σ versati nel faro = totali del faro. null = in pari. */
export function controllaFaro(lots: readonly LotState[], f: FaroStato): string | null {
  for (const k of ['legno', 'pietra'] as const) {
    const daiLotti = lots.reduce((s, l) => s + faroDi(l).versato[k], 0);
    const perPersona = Object.values(f.versati).reduce((s, d) => s + d[k], 0);
    if (daiLotti !== f[k] || perPersona !== f[k]) return `${k}: dai lotti ${daiLotti}, per persona ${perPersona}, nel faro ${f[k]}`;
  }
  return null;
}
