// La vetrina del negozio dei mobili (#384, #393): ogni giorno (mezzanotte di Roma) il negozio espone una scelta diversa pescata da TUTTO mobili.json
// e da tutte le carte da parati e i pavimenti a pagamento di borgo.json, uguale per tutti i giocatori; si compra solo quello che è esposto. Puro e deterministico: dipende solo dal giorno e dal catalogo, così il
// client (cosa mettere sulle pedane) e il server (cosa si può comprare) calcolano la stessa cosa.
// Scelta «a peso casuale più alto»: ogni mobile prende un punteggio dal giorno e dal suo id, vincono i migliori. Un mobile nuovo nel catalogo
// entra da solo nel pool e cambia la vetrina di oggi solo se il suo punteggio è tra i migliori; quelli già in vetrina non si spostano.
import { BORGO, MOBILI, MOBILI_VETRINA } from '@marea/content';
import { createRng } from '../rng.ts';
import { giornoRoma } from './giorno.ts';

/** Quello che è in mostra oggi (id, nell'ordine in cui compare nel negozio): mobili a terra sulle pedane e a parete sul muro, carte da parati
 *  appese (prima dei mobili a parete) e campioni di pavimento per terra. */
export type Vetrina = { terra: string[]; parete: string[]; carte: string[]; pavimenti: string[] };
export type TipoFinitura = 'pavimento' | 'carta';

/** I `n` del pool col punteggio più basso del giorno (a parità, l'id: l'ordine non dipende da come è scritto il JSON). `chiave` tiene separati i
 *  punteggi di mobili, carte e pavimenti (un id uguale in due elenchi non fa uscire le due cose insieme per forza). */
function scelti(pool: readonly { id: string }[], n: number, giorno: number, chiave = ''): string[] {
  return pool
    .map((m) => ({ id: m.id, p: createRng(`vetrina:${giorno}:${chiave}${m.id}`).next() }))
    .sort((a, b) => a.p - b.p || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, n)
    .map((x) => x.id);
}

/** La vetrina di un giorno di Roma (numero del giorno, `giornoRoma`). */
export function vetrinaDelGiorno(giorno: number): Vetrina {
  const aPagamento = (l: readonly { id: string; perle?: number }[]) => l.filter((f) => (f.perle ?? 0) > 0);
  return {
    terra: scelti(MOBILI.filter((m) => m.posto === 'terra'), MOBILI_VETRINA.terra, giorno),
    parete: scelti(MOBILI.filter((m) => m.posto === 'parete'), MOBILI_VETRINA.parete, giorno),
    carte: scelti(aPagamento(BORGO.carte), MOBILI_VETRINA.carte, giorno, 'carta:'),
    pavimenti: scelti(aPagamento(BORGO.pavimenti), MOBILI_VETRINA.pavimenti, giorno, 'pavimento:'),
  };
}
/** La vetrina all'istante `ms` (ms del server). */
export const vetrinaOra = (ms: number): Vetrina => vetrinaDelGiorno(giornoRoma(ms));
/** Il mobile è in vendita all'istante `ms`? */
export function inVetrina(ms: number, id: string): boolean {
  const v = vetrinaOra(ms);
  return v.terra.includes(id) || v.parete.includes(id);
}
/** La carta da parati o il pavimento è in vendita all'istante `ms`? (Quelli di serie, gratis, non si vendono: sono di tutti.) */
export const inVetrinaFinitura = (ms: number, tipo: TipoFinitura, id: string): boolean => (tipo === 'carta' ? vetrinaOra(ms).carte : vetrinaOra(ms).pavimenti).includes(id);
