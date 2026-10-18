// La Difesa a corsie alla Plants vs Zombies (banco provadifesa.html, #358; docs/DIFESA.md): stato della partita, comandi, eventi.
// Tutto serializzabile (anche il caso: un intero, mulberry32), così l'hash dello stato dice se due partite sono uguali e un giorno il
// server potrà rigiocarle. Unità: caselle per x (0 = bordo sinistro del campo, la casella c va da c a c+1, 9 = bordo destro) e corsie
// (0 in alto); i tempi in tick (TICK_HZ al secondo). Solo + − × ÷ (check_static).
import type { DLivelloDef, DProfilo, DProfiloId, DSopravvivenzaDef, DTipoNemico, DTipoUnita } from '@marea/content/difesa.ts';
import { DIFESA, profiloDifesa } from '@marea/content/difesa.ts';
import { TICK_HZ } from '../constants.ts';

/** Un difensore in campo. `t` = tick della prossima azione (colpo, moneta, scoppio, mina armata). */
export type DUnita = { id: number; tipo: DTipoUnita; corsia: number; col: number; vita: number; vitaMax: number; t: number; armata: boolean; nata: number; morsa: number };
/** Un nemico. `passo`/`corsa` in caselle al tick; `salto`: 0 = deve ancora saltare (o non salta), 1 = in volo, 2 = fatto.
 *  Senza `testa` non morde più e sparisce a `muore`. */
export type DNemico = {
  id: number; tipo: DTipoNemico; corsia: number; x: number; vita: number; vitaMax: number; armatura: number; armaturaMax: number;
  passo: number; corsa: number; salto: 0 | 1 | 2; saltoDa: number; saltoA: number; saltoT0: number; saltoT1: number;
  gelo: number; mangia: number; testa: boolean; muore: number; ondata: number; nato: number; colpito: number;
};
export type DColpo = { id: number; corsia: number; x: number; danno: number; gelo: boolean; vel: number };
/** Una moneta della valuta: cade dal cielo da `y0` a `yFine` (corsie) o salta fuori da un produttore; tocca terra a `atterra`. */
export type DMoneta = { id: number; x: number; y0: number; yFine: number; valore: number; cielo: boolean; nata: number; atterra: number; sparisce: number };
export type DCarta = { tipo: DTipoUnita; pronta: number };
/** Il tosaerba di una corsia: 0 = fermo, 1 = parte, 2 = usato. */
export type DTosaerba = { stato: 0 | 1 | 2; x: number };
export type DEvento =
  | { e: 'pianta'; id: number; tipo: DTipoUnita; corsia: number; col: number }
  | { e: 'pala'; tipo: DTipoUnita; corsia: number; col: number }
  | { e: 'spara'; id: number; corsia: number; x: number; gelo: boolean }
  | { e: 'colpito'; id: number; corsia: number; x: number; gelo: boolean; armatura: boolean }
  | { e: 'armatura'; id: number; tipo: DTipoNemico }
  | { e: 'testa'; id: number }
  | { e: 'morto'; id: number; tipo: DTipoNemico; corsia: number; x: number }
  | { e: 'morso'; id: number; unita: number }
  | { e: 'mangiato'; id: number; tipo: DTipoUnita; corsia: number; col: number }
  | { e: 'moneta'; id: number; cielo: boolean }
  | { e: 'raccolta'; id: number; valore: number }
  | { e: 'sparita'; id: number }
  | { e: 'esplode'; tipo: 'bomba' | 'mina'; corsia: number; col: number }
  | { e: 'armata'; id: number }
  | { e: 'salta'; id: number }
  | { e: 'tosaerba'; corsia: number }
  | { e: 'arriva'; n: number }
  | { e: 'enorme'; n: number }
  | { e: 'ondata'; n: number; finale: boolean; quanti: number }
  | { e: 'vinta' }
  | { e: 'persa' }
  | { e: 'rifiuto'; motivo: 'valuta' | 'ricarica' | 'occupata' | 'fuori' | 'carta' };
export type DComando =
  | { t: 'pianta'; tipo: DTipoUnita; corsia: number; col: number }
  | { t: 'raccogli'; id: number }
  | { t: 'pala'; corsia: number; col: number };
export type DOpzioni = { profilo?: DProfiloId; raccoltaAuto?: boolean; immortale?: boolean };

export type DState = {
  tick: number; caso: number;
  /** Indice in DIFESA.livelli; -1 = Sopravvivenza. */
  livello: number; profilo: DProfiloId;
  corsie: number[]; valuta: number; carte: DCarta[];
  unita: DUnita[]; nemici: DNemico[]; colpi: DColpo[]; monete: DMoneta[]; tosa: DTosaerba[];
  /** Le ondate già composte (la Sopravvivenza le compone man mano); `ondata` = la prossima da lanciare. */
  ondate: DTipoNemico[][]; ondata: number;
  /** Tick alla prossima ondata, da quanto era partito il conto, vita dell'ondata in corso quando è entrata e soglia per anticipare
   *  la prossima (-1 = nessuna); `enorme` = tick di avviso dell'ondata bandiera che restano. */
  conto: number; contoInizio: number; vitaInizio: number; vitaProssima: number; enorme: number;
  /** Scelta «liscia» delle corsie: scelte passate dall'ultima e dalla penultima volta; ondata in cui il tosaerba è partito. */
  scelte: { ultimo: number; penultimo: number }[]; tosaOndata: number[];
  cielo: { conto: number; caduti: number };
  /** Tutorial: cielo e ondate aspettano la prima pianta. */
  attesa: boolean;
  esito: '' | 'vinta' | 'persa'; fine: number;
  stats: { piantate: number; uccisi: number; raccolte: number; spesa: number; tosaerba: number; mangiate: number };
  nid: number; ev: DEvento[];
  raccoltaAuto: boolean; immortale: boolean;
};

export const tick = (sec: number): number => Math.round(sec * TICK_HZ);
/** Numero a caso in [0, 1) dallo stato (mulberry32: solo interi a 32 bit, uguale su ogni motore). */
export function caso(s: { caso: number }): number {
  s.caso = (s.caso + 0x6d2b79f5) >>> 0;
  let t = s.caso;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** A caso tra i due numeri di una coppia [min, max]. */
export const tra = (s: { caso: number }, ab: number[]): number => ab[0]! + (ab[1]! - ab[0]!) * caso(s);
export const prof = (s: DState): DProfilo => profiloDifesa(s.profilo);
export const livelloDef = (s: DState): DLivelloDef | null => (s.livello >= 0 ? DIFESA.livelli[s.livello]! : null);
export const defPartita = (s: DState): DLivelloDef | DSopravvivenzaDef => livelloDef(s) ?? DIFESA.sopravvivenza;
/** Quante ondate ha la partita (la Sopravvivenza non finisce: -1). */
export const totOndate = (s: DState): number => (s.livello >= 0 ? DIFESA.livelli[s.livello]!.ondate : -1);
export const unitaIn = (s: DState, corsia: number, col: number): DUnita | undefined => s.unita.find((u) => u.corsia === corsia && u.col === col);
/** Un nemico «vivo» si può colpire e conta per l'ondata: ha la testa e non è già sparito. */
export const vivo = (n: DNemico): boolean => n.testa && n.vita > 0;

export function nuovaPartita(seme: number, livello: number, opz: DOpzioni = {}): DState {
  const profilo = opz.profilo ?? 'marea', P = profiloDifesa(profilo);
  const def = livello >= 0 ? DIFESA.livelli[livello]! : null, sop = DIFESA.sopravvivenza;
  const s: DState = {
    tick: 0, caso: (seme >>> 0) || 1, livello: def ? livello : -1, profilo,
    corsie: [...(def ?? sop).corsie],
    valuta: def ? (def.tutorial ? P.economia.inizialeTutorial : P.economia.iniziale) : sop.iniziale,
    carte: (def ?? sop).carte.map((tipo) => ({ tipo, pronta: tick(P.unita[tipo].ricaricaInizio ?? 0) })),
    unita: [], nemici: [], colpi: [], monete: [],
    tosa: Array.from({ length: DIFESA.campo.corsie }, () => ({ stato: 0 as const, x: DIFESA.campo.tosaerba })),
    ondate: [], ondata: 0,
    conto: tick((def ?? sop).primaOndata), contoInizio: 0, vitaInizio: 0, vitaProssima: -1, enorme: 0,
    scelte: Array.from({ length: DIFESA.campo.corsie }, () => ({ ultimo: 0, penultimo: 0 })),
    tosaOndata: Array.from({ length: DIFESA.campo.corsie }, () => -100),
    cielo: { conto: 0, caduti: 0 },
    attesa: !!def?.tutorial,
    esito: '', fine: 0,
    stats: { piantate: 0, uccisi: 0, raccolte: 0, spesa: 0, tosaerba: 0, mangiate: 0 },
    nid: 1, ev: [],
    raccoltaAuto: !!opz.raccoltaAuto, immortale: !!opz.immortale,
  };
  s.contoInizio = s.conto;
  s.cielo.conto = tick(tra(s, P.economia.cielo.primo));
  return s;
}
