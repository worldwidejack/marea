// @marea/content/porto_amici.ts: il Porto tra amici. Tabellone dei record in piazza (posto e nomi «alla Regata» per il feed) e il
// posto del Grande Faro sullo scoglio (solo scenografia: il Faro comune da costruire insieme è stato tolto, tag archivio/spenti-faro).
// Entry separata come porto.ts e diario.ts. Solo dati: le formule stanno in @marea/sim/economy/record.ts. Coordinate in celle dell'isola `porto`.
import dati from './porto_amici.json' with { type: 'json' };
import type { PortoPosto } from './porto.ts';

export type PortoAmiciDef = { tabellone: PortoPosto; faro: PortoPosto; alGioco: Record<string, string> };

export const PORTO_AMICI = dati as unknown as PortoAmiciDef;

/** «alla Pesca», «all'Ingorgo»… per le righe del feed; un minigioco nuovo senza voce: «a <nome>». */
export function alGioco(id: string, nome?: string): string {
  return PORTO_AMICI.alGioco[id] ?? `a ${nome ?? id}`;
}

/** [] se tutto ok, altrimenti errori in italiano (li chiamano i test della sim). */
export function validatePortoAmici(): string[] {
  const errs: string[] = [];
  for (const p of [PORTO_AMICI.tabellone, PORTO_AMICI.faro]) if (!(p.raggio > 0) || p.at.length !== 2 || p.fronte.length !== 2) errs.push(`${p.nome}: posto non valido`);
  return errs;
}
