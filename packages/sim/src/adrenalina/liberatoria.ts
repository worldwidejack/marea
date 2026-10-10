// Isola dell'Adrenalina (docs/ADRENALINA.md §2): la liberatoria che il guardiano della funivia fa firmare, una volta sola. Resta nel lotto
// (`liberatorie`) e, col casco indosso, apre l'isola (sblocco `funivia`, world/temi.ts). Pura: il DO del lotto la chiama e salva.
import type { LotState } from '../economy/types.ts';

/** Il testo che si firma (lo stesso nel client e qui, per i test). */
export const LIBERATORIA = 'Il parco declina ogni responsabilità per ossa rotte, orgoglio ferito e Perle perse.';

/** Firma la liberatoria `id` (di serie quella dell'Adrenalina): `nuova` = prima firma, altrimenti il lotto non cambia. */
export function firmaLiberatoria(lot: LotState, id = 'adrenalina'): { lot: LotState; nuova: boolean } {
  if ((lot.liberatorie ?? []).includes(id)) return { lot, nuova: false };
  return { lot: { ...lot, version: lot.version + 1, liberatorie: [...(lot.liberatorie ?? []), id] }, nuova: true };
}
