// I paesani di Borgo Marea: le chiacchiere (che battuta esce adesso) e i favori (vai a dire a…, portami un pesce o un insetto).
// Puro e deterministico: il tempo arriva da fuori (ms del server), mai un orologio qui.
// - Chiacchiere: la casualità la passa chi chiama (il client, un Rng nuovo a ogni chiacchierata). Si sceglie prima il bacino, a pesi
//   (`paesani.json` `pesi`: brutto tempo, momento della giornata, stagione, sempre, lore prima o dopo il Cancello del Vuoto), poi una
//   battuta che si può dire adesso (condizioni `solo`/`asciutto`) e che non ha detto da poco. Primo incontro e «insistente» vincono su tutto.
// - Favori: ogni `slotMin` minuti ogni paesano decide se ha un favore da chiedere, con createRng(chi gioca, paesano, fascia, favori presi
//   oggi): server e client calcolano lo stesso favore senza parlarsi, e parlargli dieci volte di fila non lo cambia. Il pesce o l'insetto
//   chiesto c'è davvero per tutto il tempo concesso (stagione e fascia oraria controllate ogni `controlloMin`, dall'inizio della fascia
//   alla sua fine più la durata). Le azioni sul lotto (accetta, porta il messaggio, regala, riscuoti) stanno in rpg/paesani.ts.
import { MOBILI } from '@marea/content';
import { INSETTI } from '@marea/content/insetti.ts';
import { PAESANI, PAESANI_CFG } from '@marea/content/paesani.ts';
import type { Battuta, MessaggioTipo, PaesanoMomento } from '@marea/content/paesani.ts';
import { PESCI } from '@marea/content/pesci.ts';
import { hashJson } from '../hash.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import { giornoRoma, oreRoma } from './giorno.ts';
import { disponibile, possiedeRetino, stagioneAt } from './insetti.ts';
import { possiedePala } from './pala.ts';
import { pesceDisponibile, possiedeCanna } from './pesci.ts';
import type { LotState } from './types.ts';

const C = PAESANI_CFG, F = C.favori, MIN = 60_000, HOUR = 3_600_000, DAY = 24 * HOUR;
export const SLOT_MS = F.slotMin * MIN;

// ———————————————————— stato ————————————————————
/** Il premio di un favore: monete o un mobile (va nel magazzino di casa). */
export type Premio = { monete: number } | { mobile: string };
/** «Vai a dire a `a` che…» (`msg`): `detto` quando l'hai detto. */
export type FavoreParla = { tipo: 'parla'; da: string; a: string; msg: MessaggioTipo; scade: number; detto: boolean; premio: Premio };
/** «Portami un pesce / un insetto» (`id` di pesci.json o insetti.json), da regalare a `da` entro `scade`. */
export type FavorePorta = { tipo: 'porta'; da: string; cosa: 'pesce' | 'insetto'; id: string; scade: number; premio: Premio };
export type Favore = FavoreParla | FavorePorta;
/** Un favore che il paesano chiede adesso, non ancora accettato: `slot` lo identifica, `durata` (ms) parte quando lo accetti. */
export type Offerta =
  | { tipo: 'parla'; da: string; a: string; msg: MessaggioTipo; premio: Premio; slot: number; durata: number }
  | { tipo: 'porta'; da: string; cosa: 'pesce' | 'insetto'; id: string; premio: Premio; slot: number; durata: number };
/** LotState.paesani. */
export type PaesaniState = {
  /** Con chi hai già parlato almeno una volta (dopo, niente più «primo incontro»). */
  conosciuti: string[];
  /** Il favore in corso: uno alla volta. Scaduto resta finché non torni da chi te l'ha chiesto (che te lo fa notare). */
  favore: Favore | null;
  /** Giorno di Roma di `accettati`: a mezzanotte si riparte da zero. */
  giorno: number; accettati: number;
  /** Fino a quando (ms) nessuno chiede favori: dopo un NON ORA e dopo un favore finito. */
  pausaFino: number;
};
const VUOTO: PaesaniState = { conosciuti: [], favore: null, giorno: 0, accettati: 0, pausaFino: 0 };
/** Lo stato del lotto coi conti di oggi. */
export function paesaniOf(lot: LotState | null | undefined, ms: number): PaesaniState {
  const s = { ...VUOTO, ...(lot?.paesani ?? {}) }, g = giornoRoma(ms);
  return s.giorno === g ? s : { ...s, giorno: g, accettati: 0 };
}
export const isPaesano = (id: string): boolean => Object.prototype.hasOwnProperty.call(PAESANI, id);
export const scaduto = (f: Favore, ms: number): boolean => ms > f.scade;
/** Il favore in corso e ancora valido (null se non c'è o è scaduto). */
export function favoreAttivo(lot: LotState | null | undefined, ms: number): Favore | null {
  const f = paesaniOf(lot, ms).favore;
  return f && !scaduto(f, ms) ? f : null;
}
/** Hai nello zaino il pesce o l'insetto del favore? */
export const haDaRegalare = (lot: LotState | null | undefined, f: FavorePorta): boolean => (lot?.hero?.inv[f.id] ?? 0) >= 1;

// ———————————————————— quando ————————————————————
const MOMENTI: readonly PaesanoMomento[] = ['mattina', 'tarda', 'pranzo', 'pomeriggio', 'tramonto', 'notte'];
const GIORNO: readonly PaesanoMomento[] = ['mattina', 'tarda', 'pranzo', 'pomeriggio'];
/** Ora di Roma in ore [0, 24). */
export function oraRoma(ms: number): number { return ((((ms + oreRoma(ms) * HOUR) % DAY) + DAY) % DAY) / HOUR; }
/** Il momento della giornata a Roma. */
export function momentoAt(ms: number): PaesanoMomento {
  const h = oraRoma(ms);
  for (const m of MOMENTI) { const [a, b] = C.momenti[m]; if (a < b ? h >= a && h < b : h >= a || h < b) return m; }
  return 'tarda';
}

// ———————————————————— chiacchiere ————————————————————
export type ContestoChiacchiera = {
  ms: number;
  /** Il Cancello del Vuoto è aperto (lore di dopo). */
  cancello: boolean;
  /** Il tempo dove sta il paesano (0..1, sim/meteo.ts): 0 e 0 se il meteo è spento. */
  pioggia: number; vento: number;
  /** Prima chiacchierata in assoluto con lui. */
  primo: boolean;
  /** Chiacchierate di fila con lui (entro `insistente.finestraS`), questa compresa. */
  diFila: number;
  /** Battute dette da poco (chiavi come quelle restituite): non si ripetono finché ce ne sono altre. */
  recenti: readonly string[];
};
export const testoBattuta = (b: Battuta): string => (typeof b === 'string' ? b : b.t);
type Tempo = { m: PaesanoMomento; piove: boolean; tira: boolean };
function siPuoDire(b: Battuta, t: Tempo): boolean {
  if (typeof b === 'string') return true;
  if (b.asciutto && t.piove) return false;
  const solo = b.solo ?? [];
  const quando = solo.filter((s) => s !== 'pioggia' && s !== 'vento'), meteo = solo.filter((s) => s === 'pioggia' || s === 'vento');
  if (quando.length && !quando.some((s) => s === t.m || (s === 'giorno' && GIORNO.includes(t.m)))) return false;
  if (meteo.length && !meteo.some((s) => (s === 'pioggia' ? t.piove : t.tira))) return false;
  return true;
}
type Bacino = { k: string; peso: number; lista: readonly Battuta[] };
/** I bacini da cui può pescare adesso, coi loro pesi. */
function bacini(id: string, c: ContestoChiacchiera, t: Tempo): Bacino[] {
  const p = PAESANI[id]!, P = C.pesi, out: Bacino[] = [];
  if (t.piove || t.tira) out.push({ k: 'brutto', peso: P.brutto, lista: p.brutto });
  const mo = p.momenti[t.m];
  if (mo?.length) out.push({ k: 'momenti.' + t.m, peso: P.momento, lista: mo });
  const st = stagioneAt(c.ms);
  out.push({ k: 'stagioni.' + st, peso: P.stagione, lista: p.stagioni[st] });
  out.push({ k: 'base', peso: P.base, lista: p.base });
  out.push(c.cancello ? { k: 'loreAperto', peso: P.loreAperto, lista: p.loreAperto } : { k: 'lore', peso: P.lore, lista: p.lore });
  return out;
}
/**
 * Cosa dice il paesano `id` in questa chiacchierata: una battuta (a volte due, da bacini diversi) e le loro chiavi (`bacino:indice`)
 * da ricordare per non ripeterle. Primo incontro: una battuta del primo incontro. Dalla `insistente.dalla`-esima di fila: le battute
 * dell'insistente in ordine, poi a caso.
 */
export function chiacchiera(id: string, c: ContestoChiacchiera, rng: Rng): { righe: string[]; chiavi: string[] } {
  const p = PAESANI[id];
  if (!p) return { righe: [], chiavi: [] };
  const t: Tempo = { m: momentoAt(c.ms), piove: c.pioggia >= C.brutto.pioggia, tira: c.vento >= C.brutto.vento };
  const una = (k: string, lista: readonly Battuta[], i: number) => ({ righe: [testoBattuta(lista[i]!)], chiavi: [`${k}:${i}`] });
  if (c.primo && p.primo.length) return una('primo', p.primo, rng.int(0, p.primo.length - 1));
  const n = c.diFila - C.insistente.dalla;
  if (n >= 0 && p.insistente.length) return una('insistente', p.insistente, n < p.insistente.length ? n : rng.int(0, p.insistente.length - 1));
  const recenti = new Set(c.recenti), tutti = bacini(id, c, t);
  const scegli = (esclusi: readonly string[]): { k: string; i: number } | null => {
    for (const nuove of [true, false]) { // prima solo battute non dette da poco; se non ce ne sono, anche quelle
      const ok = tutti.filter((b) => !esclusi.includes(b.k)).map((b) => ({ b, idx: b.lista.map((_, i) => i).filter((i) => siPuoDire(b.lista[i]!, t) && !(nuove && recenti.has(`${b.k}:${i}`))) })).filter((x) => x.idx.length);
      const tot = ok.reduce((s, x) => s + x.b.peso, 0);
      if (tot <= 0) continue;
      let r = rng.next() * tot;
      for (const x of ok) { r -= x.b.peso; if (r < 0 || x === ok[ok.length - 1]) return { k: x.b.k, i: x.idx[rng.int(0, x.idx.length - 1)]! }; }
    }
    return null;
  };
  const a = scegli([]);
  if (!a) return { righe: [], chiavi: [] };
  const testo = (x: { k: string; i: number }) => testoBattuta(tutti.find((b) => b.k === x.k)!.lista[x.i]!);
  const out = { righe: [testo(a)], chiavi: [`${a.k}:${a.i}`] };
  if (rng.next() < C.secondaFrase) {
    const b = scegli([a.k]);
    if (b) { out.righe.push(testo(b)); out.chiavi.push(`${b.k}:${b.i}`); }
  }
  return out;
}

// ———————————————————— favori: chi chiede cosa ————————————————————
export const slotAt = (ms: number): number => Math.floor(ms / SLOT_MS);
/** Il paesano può chiederti un favore adesso? (lo conosci, nessun favore in corso, non hai già fatto i favori di oggi, nessuna pausa) */
export function puoChiedere(lot: LotState | null | undefined, id: string, ms: number): boolean {
  if (!lot || !isPaesano(id)) return false;
  const s = paesaniOf(lot, ms);
  return s.conosciuti.includes(id) && !(s.favore && !scaduto(s.favore, ms)) && s.accettati < F.alGiorno && ms >= s.pausaFino;
}
type Specie = { id: string; peso: number; prezzo: number };
/** Pesci o insetti che si possono chiedere: rarità ammesse, non già nello zaino, presenti in ogni momento tra `da` e `a`. */
export function specieChiedibili(lot: LotState, cosa: 'pesce' | 'insetto', da: number, a: number): Specie[] {
  const passo = F.controlloMin * MIN, istanti: number[] = [];
  for (let t = da; t < a; t += passo) istanti.push(t);
  istanti.push(a);
  const inv = lot.hero?.inv ?? {}, rar = new Set(F.rarita);
  if (cosa === 'pesce') {
    return PESCI.filter((p) => rar.has(p.rarita) && !(inv[p.id] ?? 0) && istanti.every((t) => pesceDisponibile(p, t)))
      .map((p) => ({ id: p.id, peso: p.peso * F.zona[p.zona], prezzo: p.prezzo }));
  }
  const pala = possiedePala(lot);
  return INSETTI.filter((i) => rar.has(i.rarita) && !(inv[i.id] ?? 0) && (i.tipo !== 'sasso' || pala) && istanti.every((t) => disponibile(i, t)))
    .map((i) => ({ id: i.id, peso: i.peso, prezzo: i.prezzo }));
}
const cinque = (x: number) => Math.round(x / 5) * 5;
function premioDi(rng: Rng, tipo: 'parla' | 'porta', prezzo: number): Premio {
  const P = F.premio;
  if (rng.next() < P.mobile) {
    const pool = MOBILI.filter((m) => m.monete <= P.mobileMax[tipo]);
    if (pool.length) return { mobile: rng.pick(pool).id };
  }
  if (tipo === 'parla') return { monete: 5 * rng.int(Math.ceil(P.parla[0] / 5), Math.floor(P.parla[1] / 5)) };
  return { monete: Math.max(P.porta.min, Math.min(P.porta.max, cinque(prezzo * P.porta.per + P.porta.piu))) };
}
/** Il favore che il paesano `id` chiede nella fascia `slot` (null = niente). Non guarda se può chiedere: per quello c'è `offertaDi`. */
export function offertaSlot(lot: LotState, id: string, slot: number, accettati: number): Offerta | null {
  const p = PAESANI[id];
  if (!p) return null;
  const rng = createRng(hashJson(['paesani_favore_v1', lot.owner, id, slot, accettati]));
  if (rng.next() >= F.probabilita) return null;
  const cose: ('pesce' | 'insetto')[] = [];
  if (possiedeCanna(lot)) cose.push('pesce');
  if (possiedeRetino(lot)) cose.push('insetto');
  if (cose.length && rng.next() < F.porta) {
    const cosa = cose.length === 2 ? (rng.next() < p.favori.preferisce.pesce ? 'pesce' : 'insetto') : cose[0]!;
    const durata = (F.durataMin[0] + F.passoMin * rng.int(0, Math.floor((F.durataMin[1] - F.durataMin[0]) / F.passoMin))) * MIN;
    const t0 = slot * SLOT_MS, cand = specieChiedibili(lot, cosa, t0, t0 + SLOT_MS + durata);
    const tot = cand.reduce((s, x) => s + x.peso, 0);
    if (tot > 0) {
      let r = rng.next() * tot, d = cand[cand.length - 1]!;
      for (const x of cand) { r -= x.peso; if (r < 0) { d = x; break; } }
      return { tipo: 'porta', da: id, cosa, id: d.id, premio: premioDi(rng, 'porta', d.prezzo), slot, durata };
    }
  }
  const altri = Object.keys(PAESANI).filter((x) => x !== id);
  if (!altri.length) return null;
  const a = rng.pick(altri), msg = rng.pick(C.messaggi);
  return { tipo: 'parla', da: id, a, msg, premio: premioDi(rng, 'parla', 0), slot, durata: F.parlaMin * MIN };
}
/** Il favore che il paesano `id` ti chiede adesso, se te ne chiede uno. */
export function offertaDi(lot: LotState | null | undefined, id: string, ms: number): Offerta | null {
  if (!lot || !puoChiedere(lot, id, ms)) return null;
  return offertaSlot(lot, id, slotAt(ms), paesaniOf(lot, ms).accettati);
}

// ———————————————————— favori: cosa succede quando ci parli ————————————————————
export type EventoPaesano =
  | { k: 'niente' }
  /** Sei da chi deve ricevere il messaggio: risponde (e il messaggio è detto). */
  | { k: 'messaggio'; favore: FavoreParla }
  /** Torni da chi ha mandato il messaggio, già detto: ringrazia e paga. */
  | { k: 'fatto'; favore: FavoreParla }
  /** Torni prima di averlo detto. */
  | { k: 'attesa'; favore: FavoreParla }
  /** Torni senza il pesce o l'insetto. */
  | { k: 'promemoria'; favore: FavorePorta }
  /** Torni e ce l'hai: puoi regalarlo. */
  | { k: 'dono'; favore: FavorePorta }
  /** Torni a tempo scaduto: se ne fa una ragione, e il favore sparisce. */
  | { k: 'scaduto'; favore: Favore };
/** Cosa succede se adesso parli col paesano `id` (non cambia niente: lo fa rpg/paesani.ts `parlaPaesano`). */
export function cosaSuccede(lot: LotState | null | undefined, id: string, ms: number): EventoPaesano {
  const f = paesaniOf(lot, ms).favore;
  if (!f) return { k: 'niente' };
  if (scaduto(f, ms)) return f.da === id ? { k: 'scaduto', favore: f } : { k: 'niente' };
  if (f.tipo === 'parla') {
    if (f.a === id && !f.detto) return { k: 'messaggio', favore: f };
    if (f.da === id) return f.detto ? { k: 'fatto', favore: f } : { k: 'attesa', favore: f };
    return { k: 'niente' };
  }
  if (f.da !== id) return { k: 'niente' };
  return haDaRegalare(lot, f) ? { k: 'dono', favore: f } : { k: 'promemoria', favore: f };
}
/** Chi ha un segno sopra la testa adesso: da chi devi andare (il destinatario del messaggio, o chi aspetta il messaggio detto o il regalo). */
export function daVedere(lot: LotState | null | undefined, ms: number): string | null {
  const f = favoreAttivo(lot, ms);
  if (!f) return null;
  return f.tipo === 'parla' && !f.detto ? f.a : f.da;
}

// ———————————————————— testi ————————————————————
/** Nome del pesce o dell'insetto in minuscolo (i nomi propri restano: «pesce San Pietro»). */
export function nomeSpecie(cosa: 'pesce' | 'insetto', id: string): string {
  const n = (cosa === 'pesce' ? PESCI : INSETTI).find((x) => x.id === id)?.nome ?? id;
  return n.charAt(0).toLowerCase() + n.slice(1);
}
/** Con l'articolo: «una triglia di scoglio», «un'ape operaia». */
export function cosaSpecie(cosa: 'pesce' | 'insetto', id: string): string {
  const art = C.articoli[id] ?? 'un';
  return (art.endsWith("'") ? art : art + ' ') + nomeSpecie(cosa, id);
}
/** «un'ora», «un'ora e mezza», «due ore»… (a quarti d'ora; sotto l'ora in minuti). */
export function durataTesto(ms: number): string {
  const q = Math.round(ms / (15 * MIN)), h = Math.floor(q / 4), r = q % 4;
  if (h === 0) return r <= 1 ? "un quarto d'ora" : r === 2 ? "mezz'ora" : "tre quarti d'ora";
  const ore = h === 1 ? "un'ora" : h === 2 ? 'due ore' : h === 3 ? 'tre ore' : `${h} ore`;
  return r === 0 ? ore : `${ore} e ${r === 1 ? 'un quarto' : r === 2 ? 'mezza' : 'tre quarti'}`;
}
/** Sostituisce i segnaposto {chiave}; quelli sconosciuti restano come sono. */
export function riempi(t: string, v: Readonly<Record<string, string | number>>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
}
export const chiamato = (id: string): string => PAESANI[id]?.chiamato ?? id;
/** Una riga a caso (rng di chi chiama) di una lista di frasi. */
export const unaDi = (l: readonly string[], rng: Rng): string => (l.length ? l[rng.int(0, l.length - 1)]! : '');
