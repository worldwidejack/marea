// Le decorazioni del Mercante (decor.json) stanno in casa, come i mobili a terra (VISIONE §2): comprate vanno nel magazzino di casa
// (`casa.magazzino`, chiave «decor:<id>»), con ARREDA si posano, si spostano, si girano e si rimettono via (economy/casa.ts, una cella).
// Quelle posate nel giardino di prima tornano nel magazzino in lettura (`decorInCasa`, una volta sola: dopo `decor` non c'è più). Pura.
import { DECOR } from '@marea/content';
import type { DecorDef, MobileDef } from '@marea/content';
import { spendi } from './monete.ts';
import { EconomyError } from './types.ts';
import type { LotState } from './types.ts';

const PREFISSO = 'decor:';
/** La chiave di una decorazione nel magazzino e nei mobili posati. */
export const chiaveDecor = (id: string): string => PREFISSO + id;
/** La decorazione di una chiave «decor:<id>» (null = non è una decorazione, o non esiste più). */
export function decorDi(chiave: string): DecorDef | null {
  return chiave.startsWith(PREFISSO) ? DECOR.find((d) => d.id === chiave.slice(PREFISSO.length)) ?? null : null;
}
/** La decorazione vista come un mobile a terra di una cella (forma `decor`: il client la disegna col suo modello). */
export function decorComeMobile(chiave: string): MobileDef | null {
  const d = decorDi(chiave);
  return d ? { id: chiave, nome: d.nome, categoria: 'decorazioni', monete: d.monete, posto: 'terra', forma: 'decor', colori: [], celle: [1, 1] } : null;
}

type ConDecorVecchie = LotState & { decor?: { decor: string }[] };

/** Le decorazioni posate nel giardino di prima vanno nel magazzino di casa; un lotto senza torna identico. */
export function decorInCasa(lot0: LotState): LotState {
  const vecchie = (lot0 as ConDecorVecchie).decor;
  if (!vecchie) return lot0;
  const { decor: _via, ...lot } = lot0 as ConDecorVecchie;
  const mag = { ...(lot.casa?.magazzino ?? {}) };
  for (const d of vecchie) if (DECOR.some((x) => x.id === d.decor)) mag[chiaveDecor(d.decor)] = (mag[chiaveDecor(d.decor)] ?? 0) + 1;
  return { ...lot, version: lot.version + 1, ...(vecchie.length ? { casa: { ...lot.casa, magazzino: mag } } : {}) };
}

/** Compra una decorazione dal Mercante: monete spese, una in più nel magazzino di casa. */
export function compraDecor(lot0: LotState, id: string): LotState {
  const d = DECOR.find((x) => x.id === id);
  if (!d) throw new EconomyError('sconosciuto', 'Decorazione sconosciuta');
  const lot = spendi(lot0, d.monete), mag = { ...(lot.casa?.magazzino ?? {}) }, k = chiaveDecor(id);
  mag[k] = (mag[k] ?? 0) + 1;
  return { ...lot, version: lot.version + 1, casa: { ...lot.casa, magazzino: mag } };
}
