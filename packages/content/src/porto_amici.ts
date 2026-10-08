// @marea/content/porto_amici.ts: il Porto tra amici (#110 #111). Tabellone dei record in piazza (posto e nomi «alla Regata» per il feed)
// e Faro comune (posto, soglie di Legno e Pietra totali per livello, bonus di produzione a tutti). Entry separata come porto.ts e
// diario.ts. Solo dati: le formule stanno in @marea/sim/economy/faro.ts e record.ts. Coordinate in celle dell'isola `porto`.
import dati from './porto_amici.json' with { type: 'json' };
import buildings from './buildings.json' with { type: 'json' };
import type { PortoPosto } from './porto.ts';

/** Un livello del Faro: soglie TOTALI (Legno e Pietra versati da tutti) e bonus di produzione (0,05 = +5 %) per gli `edifici`. */
export type FaroLivelloDef = { legno: number; pietra: number; bonus: number };
export type FaroDef = PortoPosto & {
  livelli: FaroLivelloDef[];
  /** Edifici (id di buildings.json) la cui produzione cresce del bonus del livello raggiunto. */
  edifici: string[];
  /** Bottoni «versa» (oltre a TUTTO), per risorsa. */
  versa: number[];
  /** Quanti nomi nella classifica di chi ha versato di più. */
  classifica: number;
  /** Id dei versamenti che un lotto ricorda (idempotenza: un versamento ripetuto non si paga due volte). */
  doniTenuti: number;
};
export type PortoAmiciDef = { tabellone: PortoPosto; faro: FaroDef; alGioco: Record<string, string> };

export const PORTO_AMICI = dati as unknown as PortoAmiciDef;
export const FARO = PORTO_AMICI.faro;

/** «alla Pesca», «all'Ingorgo»… per le righe del feed; un minigioco nuovo senza voce: «a <nome>». */
export function alGioco(id: string, nome?: string): string {
  return PORTO_AMICI.alGioco[id] ?? `a ${nome ?? id}`;
}

/** [] se tutto ok, altrimenti errori in italiano (li chiamano i test della sim). */
export function validatePortoAmici(): string[] {
  const errs: string[] = [];
  const f = FARO;
  if (!f.livelli.length) errs.push('faro: nessun livello');
  f.livelli.forEach((l, i) => {
    const prima = f.livelli[i - 1];
    if (!(Number.isInteger(l.legno) && Number.isInteger(l.pietra) && l.legno > 0 && l.pietra > 0)) errs.push(`faro livello ${i + 1}: soglie non valide`);
    if (prima && !(l.legno >= prima.legno && l.pietra >= prima.pietra && (l.legno > prima.legno || l.pietra > prima.pietra))) errs.push(`faro livello ${i + 1}: soglie non crescenti`);
    if (!(l.bonus > 0 && l.bonus <= 0.5) || (prima && l.bonus < prima.bonus)) errs.push(`faro livello ${i + 1}: bonus non valido`);
  });
  if (!f.edifici.length) errs.push('faro: nessun edificio col bonus');
  for (const id of f.edifici) if (!(buildings as { id: string }[]).some((b) => b.id === id)) errs.push(`faro: edificio sconosciuto ${id}`);
  if (!f.versa.every((n) => Number.isInteger(n) && n > 0)) errs.push('faro: bottoni «versa» non validi');
  if (!(f.classifica >= 1 && f.doniTenuti >= 1)) errs.push('faro: classifica o doniTenuti non validi');
  for (const p of [PORTO_AMICI.tabellone, f]) if (!(p.raggio > 0) || p.at.length !== 2 || p.fronte.length !== 2) errs.push(`${p.nome}: posto non valido`);
  return errs;
}
