// Diario del capitano e traguardi (#87). Puro e deterministico: niente orologio, niente casualità. Il server (Lot DO) registra qui
// quello che verifica (partite rigiocate, spedizioni tornate) e gli avvistamenti che arrivano dal client (solo id dei cataloghi);
// client e server calcolano il progresso dei traguardi con la stessa funzione. RISCUOTI paga una volta sola, il titolo si sceglie
// solo tra i traguardi riscossi. Non esportato da @marea/sim (index.ts): si importa per percorso, come missioni.ts.
import { DIARIO, ISOLE_DIARIO, PESCI_DIARIO, TRAGUARDI } from '@marea/content/diario.ts';
import type { TraguardoDef } from '@marea/content/diario.ts';
import type { Medal } from '../minigames/types.ts';
import { advance } from './advance.ts';
import { EconomyError, ZERO, add } from './types.ts';
import type { DiarioState, LotState, Resources } from './types.ts';

/** Quello che il server non sa da solo: quanti amici hanno un'isola (per «visita le isole di tutti gli amici»). */
export type DiarioCtx = { amici: number };
export type TraguardoStato = TraguardoDef & { fatto: number; n: number; compiuto: boolean; riscosso: boolean };
export type Avvistamenti = { animali: string[]; isole: string[] };

/** Visite alle isole degli amici tenute al massimo (anti-gonfiamento: gli amici veri sono una decina). */
const MAX_AMICI = 64;
const LOTTO = /^lotto:[a-z0-9_-]{1,40}$/;
const RANK: Record<'oro' | 'argento' | 'bronzo', number> = { bronzo: 1, argento: 2, oro: 3 };

const VUOTO: DiarioState = { pesci: {}, perle: {}, medaglie: {}, giocati: {}, animali: [], isole: [], dungeon: 0, riscossi: [], titolo: null };
/** Il diario del lotto (vuoto se non c'è ancora). */
export function diarioOf(lot: LotState): DiarioState {
  const d = lot.diario;
  return d ? { ...VUOTO, ...d } : { ...VUOTO };
}
const somma = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + (b > 0 ? b : 0), 0);

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

/** Quanto manca a un traguardo: `fatto` su `n` (fatto ≤ n). */
export function progresso(lot: LotState, t: TraguardoDef, ctx: DiarioCtx): { fatto: number; n: number } {
  const d = diarioOf(lot), se = t.se;
  const conta = (tot: number, fatto: number) => { const n = se.tutti ? Math.max(1, tot) : se.n ?? 1; return { fatto: Math.min(n, fatto), n }; };
  const mini = DIARIO.minigiochi.map((m) => m.id);
  switch (se.tipo) {
    case 'pesci': return conta(0, somma(d.pesci));
    case 'specie': return conta(PESCI_DIARIO.length, PESCI_DIARIO.filter((p) => (d.pesci[p.id] ?? 0) > 0).length);
    case 'rarita': return conta(0, PESCI_DIARIO.filter((p) => p.rarita === se.rarita).reduce((a, p) => a + (d.pesci[p.id] ?? 0), 0));
    case 'perle': return conta(0, somma(d.perle));
    case 'perla': return conta(0, d.perle[se.perla ?? ''] ?? 0);
    case 'tipiPerle': return conta(DIARIO.perle.length, DIARIO.perle.filter((p) => (d.perle[p.id] ?? 0) > 0).length);
    case 'medaglie': {
      const min = RANK[se.medaglia ?? 'bronzo'];
      return conta(mini.length, mini.filter((id) => { const m = d.medaglie[id]; return !!m && RANK[m] >= min; }).length);
    }
    case 'giocati': return conta(mini.length, mini.filter((id) => (d.giocati[id] ?? 0) > 0).length);
    case 'partite': return conta(0, Math.max(somma(d.giocati), lot.solo?.giocate ?? 0)); // le partite di prima del diario contano lo stesso
    case 'edificio': {
      const n = se.livello ?? 1, lv = Math.max(0, ...lot.buildings.filter((b) => b.building === se.edificio).map((b) => b.level));
      return { fatto: Math.min(n, lv), n };
    }
    case 'edifici': {
      const ids = se.ids ?? [];
      return { fatto: ids.filter((id) => lot.buildings.some((b) => b.building === id && b.level >= 1)).length, n: ids.length };
    }
    case 'animali': return conta(DIARIO.animali.length, DIARIO.animali.filter((a) => d.animali.includes(a.id)).length);
    case 'isole': return conta(ISOLE_DIARIO.length, ISOLE_DIARIO.filter((i) => d.isole.includes(i.id)).length);
    case 'amici': return conta(ctx.amici, d.isole.filter((i) => i.startsWith('lotto:')).length);
    case 'dungeon': return conta(0, d.dungeon);
    default: return { fatto: 0, n: 1 };
  }
}

/** Tutti i traguardi col progresso, nell'ordine di traguardi.json. */
export function traguardiOf(lot: LotState, ctx: DiarioCtx): TraguardoStato[] {
  const d = diarioOf(lot);
  return TRAGUARDI.map((t) => { const p = progresso(lot, t, ctx); return { ...t, ...p, compiuto: p.fatto >= p.n, riscosso: d.riscossi.includes(t.id) }; });
}

/** Id dei traguardi compiuti e non ancora riscossi (il numerino sul bottone del diario). */
export function daRiscuotere(lot: LotState, ctx: DiarioCtx): string[] {
  return traguardiOf(lot, ctx).filter((t) => t.compiuto && !t.riscosso).map((t) => t.id);
}

/** RISCUOTI: traguardo compiuto e non ancora riscosso → Perle nel lotto (e nel libro mastro). Una volta sola. */
export function riscuotiTraguardo(lot0: LotState, id: string, nowMs: number, ctx: DiarioCtx): { lot: LotState; premio: Resources; traguardo: TraguardoStato } {
  const lot = advance(lot0, nowMs); // edifici finiti adesso contano
  const t = traguardiOf(lot, ctx).find((x) => x.id === id);
  if (!t) throw new EconomyError('sconosciuto', 'Traguardo sconosciuto');
  if (t.riscosso) throw new EconomyError('traguardo', 'Premio già riscosso');
  if (!t.compiuto) throw new EconomyError('traguardo', `Non ancora: ${t.fatto} su ${t.n}`);
  const premio: Resources = { ...ZERO, perle: t.perle }, d = diarioOf(lot);
  return {
    premio,
    traguardo: { ...t, riscosso: true },
    lot: {
      ...lot,
      version: lot.version + 1,
      resources: add(lot.resources, premio),
      ledger: { ...lot.ledger, generated: add(lot.ledger.generated, premio) },
      diario: { ...d, riscossi: [...d.riscossi, id] },
    },
  };
}

/** Titolo sotto il nome: l'id di un traguardo riscosso, o null per toglierlo. */
export function scegliTitolo(lot: LotState, id: string | null): LotState {
  const d = diarioOf(lot);
  if (id !== null) {
    if (!TRAGUARDI.some((t) => t.id === id)) throw new EconomyError('sconosciuto', 'Titolo sconosciuto');
    if (!d.riscossi.includes(id)) throw new EconomyError('traguardo', 'Prima riscuoti il traguardo, poi il titolo è tuo');
  }
  if (d.titolo === id) return lot;
  return { ...lot, version: lot.version + 1, diario: { ...d, titolo: id } };
}

/** Il testo del titolo (per la targhetta sopra la testa), null se l'id non esiste. */
export function titoloDi(id: string | null | undefined): string | null {
  return (id && TRAGUARDI.find((t) => t.id === id)?.titolo) || null;
}
