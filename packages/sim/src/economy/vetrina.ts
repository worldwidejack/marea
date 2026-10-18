// La vetrina del negozio dei mobili (#384): ogni giorno (mezzanotte di Roma) il negozio espone una scelta diversa pescata da TUTTO mobili.json,
// uguale per tutti i giocatori; si compra solo quello che è esposto. Puro e deterministico: dipende solo dal giorno e dal catalogo, così il
// client (cosa mettere sulle pedane) e il server (cosa si può comprare) calcolano la stessa cosa.
// Scelta «a peso casuale più alto»: ogni mobile prende un punteggio dal giorno e dal suo id, vincono i migliori. Un mobile nuovo nel catalogo
// entra da solo nel pool e cambia la vetrina di oggi solo se il suo punteggio è tra i migliori; quelli già in vetrina non si spostano.
import { MOBILI, MOBILI_VETRINA } from '@marea/content';
import type { MobileDef } from '@marea/content';
import { createRng } from '../rng.ts';
import { giornoRoma } from './giorno.ts';

/** I mobili in mostra oggi: a terra sulle pedane, a parete sul muro (id, nell'ordine in cui compaiono nel negozio). */
export type Vetrina = { terra: string[]; parete: string[] };

/** I `n` mobili col punteggio più basso del giorno (a parità, l'id: l'ordine non dipende da come è scritto il JSON). */
function scelti(pool: readonly MobileDef[], n: number, giorno: number): string[] {
  return pool
    .map((m) => ({ id: m.id, p: createRng(`vetrina:${giorno}:${m.id}`).next() }))
    .sort((a, b) => a.p - b.p || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, n)
    .map((x) => x.id);
}

/** La vetrina di un giorno di Roma (numero del giorno, `giornoRoma`). */
export function vetrinaDelGiorno(giorno: number): Vetrina {
  return { terra: scelti(MOBILI.filter((m) => m.posto === 'terra'), MOBILI_VETRINA.terra, giorno), parete: scelti(MOBILI.filter((m) => m.posto === 'parete'), MOBILI_VETRINA.parete, giorno) };
}
/** La vetrina all'istante `ms` (ms del server). */
export const vetrinaOra = (ms: number): Vetrina => vetrinaDelGiorno(giornoRoma(ms));
/** Il mobile è in vendita all'istante `ms`? */
export function inVetrina(ms: number, id: string): boolean {
  const v = vetrinaOra(ms);
  return v.terra.includes(id) || v.parete.includes(id);
}
