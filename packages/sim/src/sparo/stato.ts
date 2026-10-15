// Stato della partita dello sparatutto (#355): il giocatore, i nemici (o i bersagli del poligono), gli eventi del tick per la resa e
// i suoni. Tutto serializzabile (anche il caso: un intero, mulberry32), così l'hash dello stato dice se due partite sono uguali.
import { SPARO } from '@marea/content/sparo.ts';
import type { SPunto } from '@marea/content/sparo.ts';
import { TICK_HZ } from '../constants.ts';

/** Comandi di un tick. `mx` = di lato (+ destra), `my` = avanti (+); `yaw` (0 = −Z, verso sinistra positivo) e `pitch` (+ in su) in
 *  radianti, già quantizzati con `quantizzaMira` (il replay li rilegge uguali); `arma` 1..3 = cambia arma, 0 = tieni quella. */
export type SInput = {
  mx: number; my: number; yaw: number; pitch: number;
  fuoco: boolean; mira: boolean; ricarica: boolean; salto: boolean; giu: boolean; corsa: boolean; azione: boolean; arma: number;
};
export const NESSUN_INPUT: SInput = { mx: 0, my: 0, yaw: 0, pitch: 0, fuoco: false, mira: false, ricarica: false, salto: false, giu: false, corsa: false, azione: false, arma: 0 };

/** Un giro diviso in 8192 passi (0,044°): la mira viaggia come intero. */
export const GIRO = 6.283185307179586, PASSI_GIRO = 8192;
export const quantizzaMira = (a: number): number => Math.round((a * PASSI_GIRO) / GIRO) * (GIRO / PASSI_GIRO);
export const GRADI = GIRO / 360;

export type SAttore = {
  x: number; z: number; y: number; vx: number; vz: number; vy: number;
  yaw: number; pitch: number; aTerra: boolean; giu: boolean;
  vita: number;
  /** Tick della caduta (0 = in piedi). */
  morto: number;
  /** Ultimo tick in cui ha preso un colpo (per la vita che torna e per il barcollare). */
  colpitoT: number;
};
export type SArmaStato = { colpi: number; riserva: number };
export type SGiocatore = SAttore & {
  arma: number; armi: SArmaStato[];
  /** Tick (anche frazionario) da cui l'arma può sparare di nuovo. */
  pronto: number;
  /** Tick in cui finisce la ricarica in corso (0 = nessuna) e il cambio d'arma (0 = nessuno). */
  ricarica: number; estrae: number;
  mira: boolean; corre: boolean;
  /** Rinculo accumulato (rad) e dispersione in più dei colpi di fila (rad). */
  rinculoSu: number; rinculoLato: number; dispersione: number;
  /** Il fuoco (e il salto) erano premuti al tick prima: le semiautomatiche sparano una volta a pressione, il salto anche. */
  grilletto: boolean; saltoPrima: boolean;
  /** Tick dell'ultimo colpo sparato (il rinculo torna giù solo quando smetti). */
  ultimoSparo: number;
  /** Per la medaglia e i test. */
  sparati: number; aSegno: number; teste: number; uccisi: number; dannoPreso: number;
};
export type SBot = SAttore & {
  id: number;
  /** bersaglio = fermo, si rialza dopo `SPARO.bersagli.rinasce` s (poligono). */
  tipo: 'bersaglio';
  casa: SPunto;
};
/** Dove si è fermato un colpo (un pallino): `scatola` = indice in SMappa.scatole se ha preso una scatola (−1 altrimenti), `chi` = chi ha preso
 *  (−2 = nessuno). */
export type SColpo = { x: number; y: number; z: number; cosa: 'muro' | 'terra' | 'acqua' | 'nulla' | 'attore'; nx: number; ny: number; nz: number; chi: number; testa: boolean; scatola: number };
/** `chi`: −1 = il giocatore, ≥ 0 = indice del nemico. */
export type SEvento =
  | { t: 'sparo'; chi: number; arma: string; ox: number; oy: number; oz: number; colpi: SColpo[] }
  | { t: 'colpito'; chi: number; da: number; danno: number; testa: boolean; x: number; y: number; z: number }
  | { t: 'ucciso'; chi: number; da: number; testa: boolean }
  | { t: 'rialza'; chi: number }
  | { t: 'ricarica'; arma: number } | { t: 'carico'; arma: number } | { t: 'vuoto' } | { t: 'cambio'; arma: number }
  | { t: 'salto' } | { t: 'atterra'; forte: number };

export type SModo = 'poligono';
export type SOpzioni = { modo?: SModo; immortale?: boolean };
export type SState = { tick: number; caso: number; modo: SModo; immortale: boolean; g: SGiocatore; bot: SBot[]; ev: SEvento[] };

/** Numero a caso in [0, 1) dallo stato (mulberry32: solo interi a 32 bit, uguale su ogni motore). */
export function caso(s: { caso: number }): number {
  s.caso = (s.caso + 0x6d2b79f5) >>> 0;
  let t = s.caso;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const secTick = (sec: number): number => sec * TICK_HZ;

function attore(p: SPunto, vita: number): SAttore {
  return { x: p.x, z: p.z, y: 0, vx: 0, vz: 0, vy: 0, yaw: p.yaw, pitch: 0, aTerra: true, giu: false, vita, morto: 0, colpitoT: -9999 };
}

export function nuovaPartita(seme: number, opz: SOpzioni = {}): SState {
  const M = SPARO.mappa;
  const g: SGiocatore = {
    ...attore(M.spawn, SPARO.giocatore.vita),
    arma: 1, armi: SPARO.armi.map((a) => ({ colpi: a.caricatore, riserva: a.riserva })),
    pronto: 0, ricarica: 0, estrae: 0, mira: false, corre: false, rinculoSu: 0, rinculoLato: 0, dispersione: 0, grilletto: false, saltoPrima: false, ultimoSparo: -9999,
    sparati: 0, aSegno: 0, teste: 0, uccisi: 0, dannoPreso: 0,
  };
  const bot: SBot[] = M.bersagli.map((p, id) => ({ ...attore(p, SPARO.bersagli.vita), id, tipo: 'bersaglio' as const, casa: p }));
  return { tick: 0, caso: (seme >>> 0) || 1, modo: opz.modo ?? 'poligono', immortale: !!opz.immortale, g, bot, ev: [] };
}

/** Altezza degli occhi e del collo (dove finisce il cilindro del corpo) di un attore. */
export const occhi = (a: SAttore): number => a.y + (a.giu ? SPARO.giocatore.occhiGiu : SPARO.giocatore.occhi);
export const collo = (a: SAttore): number => occhi(a) - SPARO.giocatore.testa;
