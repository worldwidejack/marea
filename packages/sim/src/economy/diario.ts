// Diario del capitano. Puro e deterministico: niente orologio, niente casualità. Il server (Lot DO) registra qui quello che
// verifica (partite rigiocate, spedizioni tornate) e gli avvistamenti che arrivano dal client (solo id dei cataloghi). I traguardi coi
// titoli sono stati tolti (tag archivio/spenti-traguardi). Non esportato da @marea/sim (index.ts): si importa per percorso, come missioni.ts.
import { DIARIO, ISOLE_DIARIO, PESCI_DIARIO } from '@marea/content/diario.ts';
import type { Medal } from '../minigames/types.ts';
import type { DiarioState, LotState } from './types.ts';

export type Avvistamenti = { animali: string[]; isole: string[] };

/** Visite alle isole degli amici tenute al massimo (anti-gonfiamento: gli amici veri sono una decina). */
const MAX_AMICI = 64;
const LOTTO = /^lotto:[a-z0-9_-]{1,40}$/;
const RANK: Record<'oro' | 'argento' | 'bronzo', number> = { bronzo: 1, argento: 2, oro: 3 };

const VUOTO: DiarioState = { pesci: {}, perle: {}, medaglie: {}, giocati: {}, animali: [], isole: [], dungeon: 0 };
/** Il diario del lotto (vuoto se non c'è ancora). */
export function diarioOf(lot: LotState): DiarioState {
  const d = lot.diario;
  return d ? { ...VUOTO, ...d } : { ...VUOTO };
}

/**
 * Partita verificata dal server: +1 partita a quel minigioco, la medaglia migliore, e quello che ha raccolto nella sua pagina
 * (`raccolta` del json: pesci o perle; id fuori catalogo ignorati). Non tocca versione né risorse: va con l'azione che la chiude.
 */
export function registraPartita(lot: LotState, minigame: string, medal: Medal, raccolta: Record<string, number> = {}): LotState {
  const d = diarioOf(lot), def = DIARIO.minigiochi.find((m) => m.id === minigame);
  const giocati = { ...d.giocati, [minigame]: (d.giocati[minigame] ?? 0) + 1 };
  const medaglie = { ...d.medaglie };
  const prima = medaglie[minigame];
  if (medal && (!prima || RANK[medal] > RANK[prima])) medaglie[minigame] = medal;
  let pesci = d.pesci, perle = d.perle;
  if (def?.raccolta) {
    const valido = def.raccolta === 'pesci' ? (id: string) => PESCI_DIARIO.some((p) => p.id === id) : (id: string) => DIARIO.perle.some((p) => p.id === id);
    const pagina = { ...(def.raccolta === 'pesci' ? pesci : perle) };
    for (const [id, v] of Object.entries(raccolta)) {
      const n = Math.floor(v);
      if (n > 0 && valido(id)) pagina[id] = (pagina[id] ?? 0) + n;
    }
    if (def.raccolta === 'pesci') pesci = pagina; else perle = pagina;
  }
  return { ...lot, diario: { ...d, giocati, medaglie, pesci, perle } };
}

/** Spedizione nel Mondo Sotterraneo tornata (il server la chiude): +1. Come registraPartita, non tocca la versione. */
export function registraDiscesa(lot: LotState): LotState {
  const d = diarioOf(lot);
  return { ...lot, diario: { ...d, dungeon: d.dungeon + 1 } };
}

/** Id di isola validi per il diario di `owner`: isole dell'arcipelago che non sono lotti, o `lotto:<persona>` di un altro. */
export function isolaValida(id: string, owner: string): boolean {
  if (ISOLE_DIARIO.some((i) => i.id === id)) return true;
  return LOTTO.test(id) && id !== `lotto:${owner}`;
}

/**
 * Avvistamenti dal client (animali passati vicino, isole visitate): solo id dei cataloghi, deduplicati. I lotti degli amici li controlla
 * prima il Worker (persona esistente con un'isola); qui solo la forma. Versione +1 solo se c'è qualcosa di nuovo.
 */
export function registraVisti(lot: LotState, v: { animali?: readonly string[]; isole?: readonly string[] }): { lot: LotState; nuovi: Avvistamenti } {
  const d = diarioOf(lot);
  const animali = [...d.animali], isole = [...d.isole], nuovi: Avvistamenti = { animali: [], isole: [] };
  for (const a of v.animali ?? []) if (DIARIO.animali.some((x) => x.id === a) && !animali.includes(a)) { animali.push(a); nuovi.animali.push(a); }
  for (const i of v.isole ?? []) {
    if (!isolaValida(i, lot.owner) || isole.includes(i)) continue;
    if (i.startsWith('lotto:') && isole.filter((x) => x.startsWith('lotto:')).length >= MAX_AMICI) continue;
    isole.push(i); nuovi.isole.push(i);
  }
  if (!nuovi.animali.length && !nuovi.isole.length) return { lot, nuovi };
  return { lot: { ...lot, version: lot.version + 1, diario: { ...d, animali, isole } }, nuovi };
}
