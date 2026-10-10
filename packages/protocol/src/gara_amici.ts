// Corse tra amici (PROTOCOL.md §8, 10 ott 2026): messaggi del WebSocket `/ws/gara` verso il DO GaraAmici. Una sala sola: chi apre la
// gara con gli amici alla porta della Spiaggia entra in sala; chiunque preme VIA (con almeno un altro in sala) e il server manda a tutti
// pista, seed e posto in griglia. Ognuno corre la SUA gara (sim locale senza bot, rigiocata dal server come una partita da solo) e manda
// la sua posizione ~12 volte al secondo; il server la gira agli altri, che disegnano gli amici come «fantasmi» (niente urti tra amici).
// Solo tipi e controlli di forma: questo file non importa la sim.
import type { Look } from './messages.ts';

/** Al massimo 6 in sala (e in gara). */
export const GA_MAX = 6;
/** Ogni quanto il client manda la sua posizione (ms). */
export const GA_POS_MS = 80;
export type GaMembro = { id: string; nome: string; look: Look; veicolo: string };
/** Posizione in gara: [prog, ramo, s, lat, h, hf, hl, v, drift, giro, caduto] (numeri della sim, `Veicolo` di sim/corse/veicolo.ts). */
export type GaPos = [number, number, number, number, number, number, number, number, number, number, number];

export type GaClientMsg =
  /** Entro in sala (o cambio veicolo). */
  | { t: 'ciao'; veicolo: string }
  /** Si parte su `pista` (chiunque in sala, con almeno 2 persone). */
  | { t: 'via'; pista: string }
  /** La mia posizione in gara. */
  | { t: 'p'; q: GaPos }
  /** Sono arrivato (ms di gara), o mi sono ritirato (ms = −1). */
  | { t: 'fine'; ms: number }
  /** Esco dalla sala. */
  | { t: 'esco' };

export type GaServerMsg =
  /** La sala (a ogni cambio): chi c'è; `gara` = in corso (chi ci corre non può ripartire finché non finisce). */
  | { t: 'sala'; membri: GaMembro[]; max: number; gara: { pista: string; membri: string[] } | null }
  /** Si parte: tutti i corridori in ordine di griglia, io = il mio posto (indice in `membri`). */
  | { t: 'parte'; gara: string; pista: string; seed: number; io: number; membri: GaMembro[] }
  /** La posizione del corridore `i` (indice in `membri` di `parte`). */
  | { t: 'p'; i: number; q: GaPos }
  /** Il corridore `i` è arrivato (ms) o si è ritirato (−1). */
  | { t: 'fine'; i: number; ms: number }
  | { t: 'errore'; msg: string };

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7;
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v);
export const isGaPos = (v: unknown): v is GaPos => Array.isArray(v) && v.length === 11 && v.every(fin);

/** Forma dei messaggi del client (pista e veicolo li controlla il server con i dati delle Corse). null = scarta. */
export function parseGaClient(text: string): GaClientMsg | null {
  if (typeof text !== 'string' || text.length > 512) return null;
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'ciao': return isId(m['veicolo']) ? { t: 'ciao', veicolo: m['veicolo'] } : null;
    case 'via': return isId(m['pista']) ? { t: 'via', pista: m['pista'] } : null;
    case 'p': return isGaPos(m['q']) ? { t: 'p', q: m['q'] } : null;
    case 'fine': return isInt(m['ms'], -1, 1e7) ? { t: 'fine', ms: m['ms'] } : null;
    case 'esco': return { t: 'esco' };
    default: return null;
  }
}

/** Messaggi del server (lato client): controllo leggero, il server è fidato. */
export function parseGaServer(text: string): GaServerMsg | null {
  let m: Record<string, unknown>;
  try { const v: unknown = JSON.parse(text); if (!v || typeof v !== 'object' || Array.isArray(v)) return null; m = v as Record<string, unknown>; } catch { return null; }
  switch (m['t']) {
    case 'p': return isInt(m['i'], 0, GA_MAX - 1) && isGaPos(m['q']) ? (m as GaServerMsg) : null;
    case 'sala': return Array.isArray(m['membri']) ? (m as GaServerMsg) : null;
    case 'parte': return typeof m['gara'] === 'string' && typeof m['pista'] === 'string' && isInt(m['seed'], 0, 2 ** 32) && isInt(m['io'], 0, GA_MAX - 1) && Array.isArray(m['membri']) ? (m as GaServerMsg) : null;
    case 'fine': return isInt(m['i'], 0, GA_MAX - 1) && isInt(m['ms'], -1, 1e7) ? (m as GaServerMsg) : null;
    case 'errore': return typeof m['msg'] === 'string' ? { t: 'errore', msg: m['msg'] } : null;
    default: return null;
  }
}
