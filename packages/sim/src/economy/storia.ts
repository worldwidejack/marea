// La storia delle prime ore (GDD §9, `@marea/content/storia.ts`): naufragio, Nonna Pina, tutorial guidato fino a Fulvio, la barca da
// comprare da Bepi, poi le missioni «Scopri le isole» (Capitan Remo) e «Dungeon». `LotState.storia` assente = storia non iniziata: il gioco
// va come prima (la barca c'è, il viaggio rapido porta ovunque). La fa partire il client (`iniziaStoria`); da lì vale per tutti, veterani
// compresi, che tengono quello che hanno (un regalo che hanno già non dà niente) ma ricomprano la barca.
// I passi che il server vede dal lotto (posare un mobile, prendere un pesce, guadagnare monete) si segnano con una «base»: il contatore di
// quando il passo è diventato quello da fare; fatto quando il contatore la supera (così chi aveva già pescato deve pescare di nuovo). Lo
// stesso per il gioco dell'isola della missione. `avanzaStoria` la chiama il server a ogni lettura del lotto. Pura.
import { STORIA } from '@marea/content/storia.ts';
import type { StoriaGioco, StoriaIsola, StoriaPasso } from '@marea/content/storia.ts';
import { CANNA } from '@marea/content/pesci.ts';
import { RETINO } from '@marea/content/insetti.ts';
import { addTo } from '../rpg/bag.ts';
import { heroOf } from '../rpg/hero.ts';
import { advance } from './advance.ts';
import { casaDi } from './casa.ts';
import { guadagna, spendi } from './monete.ts';
import { possiedeCanna } from './pesci.ts';
import { possiedeRetino } from './insetti.ts';
import { EconomyError } from './types.ts';
import type { LotState } from './types.ts';

export type Attrezzo = 'canna' | 'retino';
export type StoriaState = {
  /** Passi del tutorial fatti (id di storia.json). */
  fatti: string[];
  /** Il contatore del passo da fare quando lo è diventato (solo per i passi che vede il server). */
  base?: number;
  /** Il regalo di Fulvio. */
  attrezzo?: Attrezzo;
  /** La barca comprata da Bepi. Assente = a piedi. */
  barca?: boolean;
  /** Isole della missione già fatte, in ordine: ci si va col viaggio rapido. */
  isole?: string[];
  /** Il contatore del gioco dell'isola da fare quando la missione è partita. Assente = non ancora partita. */
  isolaBase?: number;
  /** Dungeon già contati dalla missione (premiati, o finiti prima che partisse). Assente = missione non ancora aperta. */
  dungeon?: string[];
  /** Partite della Difesa segnate dal client (la Difesa non passa dal server). */
  difesa?: number;
  /** Partite dell'Arena segnate dal client (l'allenamento coi bot non passa dal server). */
  arena?: number;
};
export type StoriaFase = 'tutorial' | 'barca' | 'isole' | 'libero';

/** I minigiochi che si giocano dalla barca: senza barca il server non li apre. */
export const GIOCHI_IN_BARCA: ReadonlySet<string> = new Set(['regata', 'consegne', 'perle']);

const con = (lot: LotState, s: StoriaState): LotState => ({ ...lot, version: lot.version + 1, storia: s });
const somma = (r: Record<string, number> | undefined): number => Object.values(r ?? {}).reduce((a, b) => a + b, 0);

/** Il passo da fare adesso (null = tutorial finito, o storia non iniziata). */
export function passoCorrente(lot: LotState | null | undefined): StoriaPasso | null {
  const s = lot?.storia;
  return s ? STORIA.passi.find((p) => !s.fatti.includes(p.id)) ?? null : null;
}
/** A che punto sei: null = storia non iniziata. */
export function faseStoria(lot: LotState | null | undefined): StoriaFase | null {
  const s = lot?.storia;
  if (!s) return null;
  if (passoCorrente(lot)) return 'tutorial';
  if (!s.barca) return 'barca';
  return isolaCorrente(lot) ? 'isole' : 'libero';
}
/** Hai la barca: senza storia sì (come prima), con la storia solo dopo averla comprata. */
export const haBarca = (lot: LotState | null | undefined): boolean => !lot?.storia || lot.storia.barca === true;
/** L'isola della missione da fare (null = finite, o niente barca ancora). */
export function isolaCorrente(lot: LotState | null | undefined): StoriaIsola | null {
  const s = lot?.storia;
  return s?.barca ? STORIA.isole[(s.isole ?? []).length] ?? null : null;
}
/** Dove porta il viaggio rapido: null = ovunque (storia non iniziata); il Porto e le isole fatte, solo con la barca. */
export function viaggiDisponibili(lot: LotState | null | undefined): string[] | null {
  const s = lot?.storia;
  if (!s) return null;
  return s.barca ? ['porto', ...(s.isole ?? [])] : [];
}

function contatorePasso(lot: LotState, p: StoriaPasso): number {
  if (p.tipo === 'arreda') return (casaDi(lot).arredi ?? []).length;
  if (p.tipo === 'cattura') return somma(lot.pesci?.visti) + somma(lot.insetti?.visti);
  if (p.tipo === 'guadagna') return lot.ledger.monete?.generated ?? 0;
  return 0;
}
function contatoreGioco(lot: LotState, g: StoriaGioco): number {
  if (g.tipo === 'minigioco') return lot.diario?.giocati[g.id] ?? 0;
  if (g.tipo === 'templari') return lot.templari?.partite ?? 0;
  if (g.tipo === 'arena') { const a = lot.arena, on = a ? a.vinte + a.perse + a.pari : 0; return on + (lot.storia?.arena ?? 0); }
  return lot.storia?.difesa ?? 0;
}

/** Hai provato il gioco dell'isola della missione: si torna da Remo a riscuotere. */
export function isolaProvata(lot: LotState | null | undefined): boolean {
  const i = isolaCorrente(lot), b = lot?.storia?.isolaBase;
  return !!lot && !!i && b !== undefined && contatoreGioco(lot, i.gioco) > b;
}

/**
 * Porta avanti quello che il server vede dal lotto: i passi del tutorial (con la loro base), la partenza della missione dell'isola, la
 * missione dei dungeon (aperta dopo Gigi: quelli già finiti contano senza premio, ogni dungeon finito dopo dà `STORIA.dungeon.premio`).
 * Senza storia, o se non cambia niente, restituisce lo stesso lotto.
 */
export function avanzaStoria(lot0: LotState): LotState {
  let lot = lot0;
  for (;;) {
    const s = lot.storia, p = passoCorrente(lot);
    if (!s || !p || p.tipo === 'client') break;
    if (p.tipo === 'attrezzo') {
      if (!s.attrezzo) break;
      lot = { ...lot, storia: { ...s, fatti: [...s.fatti, p.id] } };
      continue;
    }
    const n = contatorePasso(lot, p);
    if (s.base === undefined) { lot = { ...lot, storia: { ...s, base: n } }; break; }
    if (n <= s.base) break;
    const { base: _via, ...resto } = s;
    lot = { ...lot, storia: { ...resto, fatti: [...s.fatti, p.id] } };
  }
  const s = lot.storia;
  if (s) {
    const i = isolaCorrente(lot);
    if (i && s.isolaBase === undefined) lot = { ...lot, storia: { ...s, isolaBase: contatoreGioco(lot, i.gioco) } };
    const s2 = lot.storia!, completati = heroOf(lot).completati ?? [];
    if (s2.fatti.includes('gigi')) {
      if (!s2.dungeon) lot = { ...lot, storia: { ...s2, dungeon: [...completati] } };
      else {
        const nuovi = completati.filter((d) => !s2.dungeon!.includes(d));
        if (nuovi.length) lot = { ...guadagna(lot, nuovi.length * STORIA.dungeon.premio), storia: { ...s2, dungeon: [...s2.dungeon, ...nuovi] } };
      }
    }
  }
  return lot === lot0 ? lot0 : { ...lot, version: lot0.version + 1 };
}

/** La storia comincia (dal naufragio). Già cominciata: niente. */
export function iniziaStoria(lot: LotState): LotState {
  return lot.storia ? lot : con(lot, { fatti: [] });
}

/** Il client segna un passo che il server non vede (`tipo: client`): solo il passo da fare adesso. Già fatto: niente. Dopo Pina il suo
 *  regalo va nel magazzino di casa. */
export function fattoPasso(lot0: LotState, id: string, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), s = lot.storia;
  if (!s) throw new EconomyError('requisito', 'La storia non è ancora cominciata');
  if (s.fatti.includes(id)) return lot;
  const p = passoCorrente(lot);
  if (!p || p.id !== id || p.tipo !== 'client') throw new EconomyError('requisito', 'Non è ancora il momento');
  let next = con(lot, { ...s, fatti: [...s.fatti, id] });
  if (id === 'pina') {
    const c = casaDi(next), mag = { ...(c.magazzino ?? {}) };
    mag[STORIA.regaloPina] = (mag[STORIA.regaloPina] ?? 0) + 1;
    next = { ...next, casa: { ...c, magazzino: mag } };
  }
  return avanzaStoria(next);
}

/** Il regalo di Fulvio: la canna o il retino, gratis, al passo giusto. Se ce l'hai già non ne arriva un altro. */
export function regaloAttrezzo(lot0: LotState, scelta: Attrezzo, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), s = lot.storia;
  if (!s || passoCorrente(lot)?.tipo !== 'attrezzo') throw new EconomyError('requisito', 'Fulvio non ha regali per te, adesso');
  const ce = scelta === 'canna' ? possiedeCanna(lot) : possiedeRetino(lot), h = heroOf(lot);
  const conAttrezzo = ce ? lot : { ...lot, hero: { ...h, inv: addTo(h.inv, scelta === 'canna' ? CANNA.id : RETINO.id, 1) } };
  return avanzaStoria(con(conAttrezzo, { ...s, attrezzo: scelta }));
}

/** Compra la barca da Bepi (`STORIA.barca.prezzo`), dopo avergli parlato. Colori, nome e livello del Cantiere restano quelli di prima. */
export function compraBarca(lot0: LotState, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), s = lot.storia;
  if (!s || s.barca) throw new EconomyError('unico', 'La barca ce l’hai già');
  if (!s.fatti.includes('bepi')) throw new EconomyError('requisito', 'Prima parla con Bepi');
  return avanzaStoria(con(spendi(lot, STORIA.barca.prezzo), { ...s, barca: true }));
}

/** Da Capitan Remo: l'isola della missione è provata → premio, viaggio rapido su quell'isola, e parte la missione dopo. */
export function riscuotiIsola(lot0: LotState, nowMs: number): { lot: LotState; isola: string; premio: number } {
  const lot = advance(lot0, nowMs), i = isolaCorrente(lot), s = lot.storia;
  if (!s || !i) throw new EconomyError('requisito', 'Nessuna isola da raccontare');
  if (!isolaProvata(lot)) throw new EconomyError('requisito', 'Prima prova il gioco dell’isola');
  const { isolaBase: _via, ...resto } = s;
  const next = con(guadagna(lot, i.premio), { ...resto, isole: [...(s.isole ?? []), i.isola] });
  return { lot: avanzaStoria(next), isola: i.isola, premio: i.premio };
}

/** Una partita alla Difesa (dal client: la Difesa non passa dal server). Senza storia: niente. */
export function segnaDifesa(lot: LotState): LotState {
  const s = lot.storia;
  return s ? avanzaStoria(con(lot, { ...s, difesa: (s.difesa ?? 0) + 1 })) : lot;
}

/** Una partita all'Arena (dal client: l'allenamento coi bot non passa dal server). Senza storia: niente. */
export function segnaArena(lot: LotState): LotState {
  const s = lot.storia;
  return s ? avanzaStoria(con(lot, { ...s, arena: (s.arena ?? 0) + 1 })) : lot;
}
