// La storia delle prime ore (GDD §9, `@marea/content/storia.ts`): naufragio, Nonna Pina, tutorial guidato fino a Fulvio, la barca da
// comprare da Bepi, poi le missioni «Scopri le isole» (Capitan Remo) e «Dungeon». `LotState.storia` assente = storia non iniziata: il gioco
// va come prima (la barca c'è, il viaggio rapido porta ovunque). La fa partire il client (`iniziaStoria`); da lì vale per tutti, veterani
// compresi, che tengono quello che hanno (un regalo che hanno già non dà niente) ma ricomprano la barca.
// «Scopri le isole»: con la barca parte la missione; ogni isola di cui provi il gioco (una partita in più da allora, anche persa) paga il
// suo premio ed entra nel viaggio rapido, nell'ordine in cui le provi. Ne bastano `STORIA.isoleDaProvare`, a scelta: allora si aprono tutte.
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
  /** Isole della missione già provate (e pagate), in ordine: ci si va col viaggio rapido. */
  isole?: string[];
  /** Il contatore del gioco di ogni isola non ancora provata quando la missione è partita. Assente = non ancora partita. */
  isoleBase?: Record<string, number>;
  /** Prima di «3 a scelta» (salvataggi vecchi): il contatore dell'unica isola da fare, letto una volta per non perdere la partita. */
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
  return missioneIsole(lot)?.finita ? 'libero' : 'isole';
}
/** Hai la barca: senza storia sì (come prima), con la storia solo dopo averla comprata. */
export const haBarca = (lot: LotState | null | undefined): boolean => !lot?.storia || lot.storia.barca === true;
/** Quante isole provate chiudono la missione (non più di quante ce ne sono). */
export const ISOLE_DA_PROVARE = Math.min(STORIA.isoleDaProvare, STORIA.isole.length);
/** La missione delle isole a che punto è: null = niente barca ancora (o storia non iniziata). */
export function missioneIsole(lot: LotState | null | undefined): { provate: string[]; servono: number; finita: boolean } | null {
  const s = lot?.storia;
  if (!s?.barca) return null;
  const provate = s.isole ?? [];
  return { provate, servono: ISOLE_DA_PROVARE, finita: provate.length >= ISOLE_DA_PROVARE };
}
/** Le isole della missione ancora da provare (vuoto = finita, o niente barca). */
export function isoleDaProvare(lot: LotState | null | undefined): StoriaIsola[] {
  const m = missioneIsole(lot);
  return m && !m.finita ? STORIA.isole.filter((i) => !m.provate.includes(i.isola)) : [];
}
/** Dove porta il viaggio rapido: null = ovunque (storia non iniziata); il Porto e le isole provate, solo con la barca; tutte a missione finita. */
export function viaggiDisponibili(lot: LotState | null | undefined): string[] | null {
  const s = lot?.storia, m = missioneIsole(lot);
  if (!s) return null;
  if (!m) return [];
  return ['porto', ...m.provate, ...(m.finita ? STORIA.isole.map((i) => i.isola).filter((i) => !m.provate.includes(i)) : [])];
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

/**
 * Porta avanti quello che il server vede dal lotto: i passi del tutorial (con la loro base), la missione delle isole (alla barca i
 * contatori di partenza; poi ogni isola provata paga `premio` ed entra in `isole`, finché non ne bastano `ISOLE_DA_PROVARE`), la
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
    lot = avanzaIsole(lot);
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

/** La missione delle isole: parte con la barca (i contatori di adesso: quello che hai giocato prima non conta), poi paga le isole provate. */
function avanzaIsole(lot0: LotState): LotState {
  const da = isoleDaProvare(lot0), s0 = lot0.storia;
  if (!s0 || !da.length) return lot0;
  if (!s0.isoleBase) {
    // un salvataggio di prima: l'isola che Remo ti aveva dato tiene il contatore di quando te l'aveva data
    const { isolaBase: vecchia, ...resto } = s0, base: Record<string, number> = {};
    const prima = vecchia !== undefined ? STORIA.isole[(s0.isole ?? []).length] : undefined;
    for (const i of da) base[i.isola] = i === prima ? vecchia! : contatoreGioco(lot0, i.gioco);
    return { ...lot0, storia: { ...resto, isoleBase: base } };
  }
  let lot = lot0;
  for (const i of da) {
    const s = lot.storia!;
    if ((s.isole ?? []).length >= ISOLE_DA_PROVARE) break;
    const b = s.isoleBase?.[i.isola];
    if (b === undefined || contatoreGioco(lot, i.gioco) <= b) continue;
    lot = { ...guadagna(lot, i.premio), storia: { ...s, isole: [...(s.isole ?? []), i.isola] } };
  }
  const s = lot.storia!;
  if ((s.isole ?? []).length >= ISOLE_DA_PROVARE) { const { isoleBase: _via, ...resto } = s; lot = { ...lot, storia: resto }; }
  return lot;
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
