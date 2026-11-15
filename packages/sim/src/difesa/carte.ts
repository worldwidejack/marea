// Le carte che si portano in una partita della Difesa: con più carte sbloccate di `carte.max` se ne scelgono al massimo `max` prima del
// livello. Qui la scelta di partenza (le carte già portate l'ultima volta, la carta nuova del livello sempre dentro, poi si riempie
// nell'ordine di `carte.priorita`): la usano la schermata di scelta, il pilota automatico e le prove, e la partita se nessuno sceglie.
import type { DTipoUnita } from '@marea/content/difesa.ts';
import { DIFESA } from '@marea/content/difesa.ts';

/** Le carte di partenza per un livello (o la Sopravvivenza) con `carte` sbloccate e `nuova` come carta nuova: `salvate` sono quelle
 *  portate l'ultima volta. Ritorna al massimo `carte.max` carte, nell'ordine del livello. Con poche carte le porta tutte. */
export function sceltaPredefinita(def: { carte: DTipoUnita[]; nuova?: DTipoUnita | null }, salvate: readonly DTipoUnita[] = []): DTipoUnita[] {
  const { max, priorita } = DIFESA.carte, ok = def.carte;
  if (ok.length <= max) return [...ok];
  let scelte = salvate.filter((t, i) => ok.includes(t) && salvate.indexOf(t) === i);
  // la carta nuova del livello sta in testa: se la scelta è piena è l'ultima salvata a restare fuori
  if (def.nuova && !scelte.includes(def.nuova)) scelte.unshift(def.nuova);
  for (const t of priorita) if (scelte.length < max && ok.includes(t) && !scelte.includes(t)) scelte.push(t);
  scelte = scelte.slice(0, max);
  return ok.filter((t) => scelte.includes(t));
}
