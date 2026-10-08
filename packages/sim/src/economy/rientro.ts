// «Mentre eri via» e libro degli ospiti (#86, GDD §2). Puro: l'ora la passa il chiamante (il DO del lotto, con l'ora del server).
// - `rientra`: all'ingresso il server confronta l'ultima volta che il proprietario c'era (`visto`) con adesso; oltre RIENTRO.sogliaMinuti
//   risponde con il riepilogo (depositi pieni, cantiere finito, chi ha firmato il libro, missioni nuove) e segna `visto = adesso`.
// - `segnaVisto`: il «ci sono» del client mentre gioca (così l'assenza si misura da quando è uscito).
// - `firmaLibro`: un amico firma il libro dell'isola (nome + emote), una volta al giorno UTC per isola; il libro tiene le ultime N firme.
import { AVATAR, BUILDINGS, RIENTRO } from '@marea/content';
import { advance } from './advance.ts';
import { giornoDi } from './missioni.ts';
import { MISSIONI } from '@marea/content/porto.ts';
import { EconomyError, ZERO } from './types.ts';
import type { CantiereFinito, Firma, LotState, Resources } from './types.ts';

export type { Firma };
/** Riepilogo dell'assenza: tutto dal punto di vista del server, all'ora `nowMs`. */
export type Riepilogo = {
  /** Da quanto mancavi (ms). */
  assenteMs: number;
  /** Quanto c'è nei depositi degli edifici adesso (unità intere): lo prende RACCOGLI TUTTO, fino al tetto del Magazzino. */
  depositi: Resources;
  /** Cantiere finito mentre eri via (null = nessuno). */
  cantiere: CantiereFinito | null;
  /** Firme arrivate mentre eri via, le più recenti prima (al massimo RIENTRO.firme.mostra), e quante in tutto. */
  ospiti: Firma[];
  ospitiTot: number;
  /** Missioni nuove alla Bacheca del Porto (è cambiato il giorno UTC), 0 se sono le stesse di quando sei uscito. */
  missioniNuove: number;
};

const sogliaMs = (): number => RIENTRO.sogliaMinuti * 60_000;
const PRODUCE = new Map(BUILDINGS.map((b) => [b.id, b.produces] as const));

/** Depositi degli edifici produttivi (unità intere), sullo stato già avanzato. */
export function depositi(lot: LotState): Resources {
  const out: Resources = { ...ZERO };
  for (const b of lot.buildings) {
    const res = PRODUCE.get(b.building);
    if (res && b.level >= 1) out[res] += Math.floor(b.buffer);
  }
  return out;
}

/** Riepilogo dell'assenza da `sinceMs` a `nowMs` (il lotto viene avanzato a `nowMs`). */
export function riepilogoAssenza(lot0: LotState, sinceMs: number, nowMs: number): Riepilogo {
  const lot = advance(lot0, nowMs);
  const nuove = (lot.ospiti ?? []).filter((f) => f.quando > sinceMs);
  const fin = lot.finito && lot.finito.endsMs > sinceMs && lot.finito.endsMs <= nowMs ? { ...lot.finito } : null;
  return {
    assenteMs: Math.max(0, nowMs - sinceMs),
    depositi: depositi(lot),
    cantiere: fin,
    ospiti: nuove.slice(-RIENTRO.firme.mostra).reverse(),
    ospitiTot: nuove.length,
    missioniNuove: giornoDi(nowMs) > giornoDi(sinceMs) ? MISSIONI.alGiorno : 0,
  };
}

/** Il proprietario dice «ci sono»: `visto` va avanti (mai indietro). Non tocca l'economia né la versione. */
export function segnaVisto(lot: LotState, nowMs: number): LotState {
  return (lot.visto ?? 0) >= nowMs ? lot : { ...lot, visto: nowMs };
}

/** Ingresso nel gioco: riepilogo se mancavi da almeno RIENTRO.sogliaMinuti (null al primo ingresso o dopo poco), e `visto = nowMs`. */
export function rientra(lot0: LotState, nowMs: number): { lot: LotState; riepilogo: Riepilogo | null } {
  const lot = advance(lot0, nowMs);
  const since = lot0.visto;
  const riepilogo = since !== undefined && nowMs - since >= sogliaMs() ? riepilogoAssenza(lot, since, nowMs) : null;
  return { lot: segnaVisto(lot, nowMs), riepilogo };
}

/** `chi` ha già firmato oggi (giorno UTC di `nowMs`) il libro di questo lotto. */
export function firmatoOggi(lot: LotState, chi: string, nowMs: number): boolean {
  const day = giornoDi(nowMs);
  return (lot.ospiti ?? []).some((f) => f.chi === chi && giornoDi(f.quando) === day);
}

/** Le ultime `n` firme del libro, le più recenti prima (default RIENTRO.firme.mostra). */
export function firmeRecenti(lot: LotState, n = RIENTRO.firme.mostra): Firma[] {
  return (lot.ospiti ?? []).slice(-Math.max(0, n)).reverse();
}

/** Nome pulito per il libro: niente caratteri di controllo né < >, spazi compattati, al massimo RIENTRO.firme.nomeMax caratteri. */
export function nomeFirma(nome: string): string {
  return [...nome.replace(/[\p{C}<>]/gu, '').trim().replace(/\s+/g, ' ')].slice(0, RIENTRO.firme.nomeMax).join('').trim();
}

/** Firma il libro del lotto: emote di avatar.json, mai sul proprio, una volta al giorno per persona; il libro tiene le ultime `tetto`. */
export function firmaLibro(lot: LotState, chi: string, nome: string, emote: string, nowMs: number): LotState {
  if (!chi) throw new EconomyError('firma', 'Chi firma?');
  if (chi === lot.owner) throw new EconomyError('firma', 'È il tuo libro: qui firmano gli amici che passano');
  if (!AVATAR.emote.includes(emote)) throw new EconomyError('firma', 'Saluto sconosciuto');
  const pulito = nomeFirma(nome);
  if (!pulito) throw new EconomyError('firma', 'Manca il nome');
  if (firmatoOggi(lot, chi, nowMs)) throw new EconomyError('firma', 'Hai già firmato oggi: torna domani');
  const ospiti = [...(lot.ospiti ?? []), { chi, nome: pulito, emote, quando: nowMs }].slice(-RIENTRO.firme.tetto);
  return { ...lot, version: lot.version + 1, ospiti };
}
