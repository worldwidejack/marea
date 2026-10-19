// Gli insetti di Borgo Marea (#445): stagione (calendario di Roma), giorno e notte (il ciclo del gioco, render/ciclo.ts), chi esce in giro,
// sotto i sassi e dagli alberi, e la collezione del lotto (visti, posseduti). Puro e deterministico: il tempo arriva da fuori (ms del
// server). Non importa il catalogo GDR (gli insetti nello zaino sono oggetti di rpg/items.ts): il client lo usa fuori dal chunk GDR.
// Le azioni sul lotto (comprare il retino, catturare, consegnare) stanno in rpg/insetti.ts.
import { ALBERI_BORGO, INSETTI, INSETTI_CFG } from '@marea/content/insetti.ts';
import type { InsettoDef, InsettoStagione, InsettoTipo } from '@marea/content/insetti.ts';
import { hashJson } from '../hash.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import { giornoRoma, oreRoma } from './giorno.ts';
import { celleScavabiliBorgo } from './pala.ts';
import type { LotState } from './types.ts';

const C = INSETTI_CFG, HOUR = 3_600_000;
/** Un insetto uscito da un sasso o caduto da un albero, in attesa di essere preso (chiave `s:<giorno>:<sasso>` o `a:<giorno>:<albero>`). */
export type InsettoUscito = { k: string; id: string; t: number };
/** La collezione e i conti del giorno (LotState.insetti). */
export type InsettiState = {
  /** Specie prese col retino almeno una volta → quante volte (pagina Insetti del Diario: disegno sbloccato). */
  visti: Record<string, number>;
  /** Specie consegnate al mobiliere (descrizione sbloccata, «posseduto»). */
  posseduti: string[];
  /** Giorno di Roma dei conti qui sotto: cambia a mezzanotte e li azzera. */
  giorno: number;
  /** Sassi colpiti e alberi scossi oggi (indici di `INSETTI_CFG.sassi.celle` e `ALBERI_BORGO`): uno al giorno a testa. */
  sassi: number[]; alberi: number[];
  /** Insetti in giro già presi (chiavi `p:<turno>:<i>[:<j>]` dei turni recenti). */
  presi: string[];
  usciti: InsettoUscito[];
};
/** Un insetto in giro (volante o a terra), uguale per tutti nel turno: `cell` del template `porto`, `seme` per il suo volo. */
export type InsettoLibero = { k: string; id: string; cell: [number, number]; seme: number; turno: number };

/** Secondi in più oltre la finestra (rete lenta) prima che un insetto uscito non si possa più prendere. */
export const MARGINE_USCITO_S = 20;
/** Quante formiche escono insieme (comportamento `gruppo`). */
export const GRUPPO = 3;

const MESE: Record<number, Exclude<InsettoStagione, 'tutto'>> = {};
for (const [s, mesi] of Object.entries(C.stagioni)) for (const m of mesi) MESE[m] = s as Exclude<InsettoStagione, 'tutto'>;
/** Mese (1-12) del calendario di Roma. */
export const meseRoma = (ms: number): number => new Date(ms + oreRoma(ms) * HOUR).getUTCMonth() + 1;
/** La stagione di oggi a Roma. */
export const stagioneAt = (ms: number): Exclude<InsettoStagione, 'tutto'> => MESE[meseRoma(ms)] ?? 'autunno';
/** Frazione [0, 1) del giro giorno/notte del gioco (come `fase` di render/ciclo.ts). */
export function faseCiclo(ms: number): number { const p = ms / (C.ciclo.minuti * 60_000); return p - Math.floor(p); }
export function notteAt(ms: number): boolean { const f = faseCiclo(ms); return f >= C.ciclo.notte[0] && f < C.ciclo.notte[1]; }
/** L'insetto c'è adesso (stagione e fascia oraria)? */
export function disponibile(d: InsettoDef, ms: number): boolean {
  if (d.stagione !== 'tutto' && d.stagione !== stagioneAt(ms)) return false;
  return d.fascia === 'sempre' || (d.fascia === 'notte') === notteAt(ms);
}
export function insettoDef(id: string): InsettoDef | undefined { return INSETTI.find((i) => i.id === id); }
/** Chi può uscire adesso da quel posto. */
export const poolAt = (tipo: InsettoTipo, ms: number): InsettoDef[] => INSETTI.filter((i) => i.tipo === tipo && disponibile(i, ms));
function estrai(pool: readonly InsettoDef[], rng: Rng): InsettoDef | null {
  const tot = pool.reduce((s, i) => s + i.peso, 0);
  if (tot <= 0) return null;
  let r = rng.next() * tot;
  for (const i of pool) { r -= i.peso; if (r < 0) return i; }
  return pool[pool.length - 1] ?? null;
}

// ———— in giro: un turno ogni `liberi.minuti`, uguale per tutti ————
const TURNO_MS = C.liberi.minuti * 60_000;
export const turnoAt = (ms: number): number => Math.floor(ms / TURNO_MS);
/** Inizio e fine (ms) di un turno. */
export const turnoMs = (turno: number): [number, number] => [turno * TURNO_MS, (turno + 1) * TURNO_MS];
let _erba: [number, number][] | null = null;
/** Celle d'erba scavabili del Borgo: lì camminano gli insetti a terra (i volanti stanno su tutte le celle scavabili). */
function erba(): [number, number][] {
  if (_erba) return _erba;
  const tutte = celleScavabiliBorgo();
  // la sim non legge il template qui: le celle d'erba sono quelle con almeno un vicino scavabile su ogni lato (prato aperto, non vicoli)
  const set = new Set(tutte.map((c) => `${c[0]},${c[1]}`));
  _erba = tutte.filter(([x, z]) => set.has(`${x + 1},${z}`) && set.has(`${x - 1},${z}`) && set.has(`${x},${z + 1}`) && set.has(`${x},${z - 1}`));
  if (!_erba.length) _erba = [...tutte];
  return _erba;
}
const cache = new Map<number, InsettoLibero[]>();
/** Gli insetti in giro nel turno (la stagione e la fascia sono quelle di metà turno). */
export function liberiDelTurno(turno: number): InsettoLibero[] {
  const hit = cache.get(turno);
  if (hit) return hit;
  const meta = turno * TURNO_MS + TURNO_MS / 2, rng = createRng(hashJson(['insetti_liberi_v1', turno]));
  const pool = [...poolAt('volante', meta), ...poolAt('terra', meta)], tutte = celleScavabiliBorgo(), prato = erba(), out: InsettoLibero[] = [];
  for (let i = 0; i < C.liberi.quanti; i++) {
    const d = estrai(pool, rng), seme = rng.next(), celle = d?.tipo === 'terra' ? prato : tutte;
    const c = celle.length ? celle[rng.int(0, celle.length - 1)]! : [44, 44] as const;
    if (!d) continue;
    if (d.comportamento === 'gruppo') for (let j = 0; j < GRUPPO; j++) out.push({ k: `p:${turno}:${i}:${j}`, id: d.id, cell: [c[0], c[1]], seme: seme + j * 0.137, turno });
    else out.push({ k: `p:${turno}:${i}`, id: d.id, cell: [c[0], c[1]], seme, turno });
  }
  if (cache.size > 16) cache.clear();
  cache.set(turno, out);
  return out;
}
/** Il libero con quella chiave, se esiste in un turno ancora valido adesso (questo o quello prima: la rete può arrivare tardi). */
export function liberoValido(k: string, ms: number): InsettoLibero | null {
  const m = /^p:(\d+):(\d+)(?::(\d+))?$/.exec(k);
  if (!m) return null;
  const turno = Number(m[1]), cur = turnoAt(ms);
  if (turno !== cur && turno !== cur - 1) return null;
  return liberiDelTurno(turno).find((l) => l.k === k) ?? null;
}

// ———— sassi e alberi: uno al giorno a testa, l'estrazione la fa il server ————
export const SASSI_BORGO: readonly [number, number][] = C.sassi.celle;
export { ALBERI_BORGO };
/** Cosa esce colpendo il sasso `idx` (o scuotendo l'albero `idx`) adesso: diverso per ogni giocatore e ogni giorno. null = niente. */
export function esceDa(tipo: 'sasso' | 'albero', idx: number, owner: string, ms: number): InsettoDef | null {
  const rng = createRng(hashJson(['insetti_' + tipo + '_v1', giornoRoma(ms), idx, owner]));
  if (rng.next() >= (tipo === 'sasso' ? C.sassi.probabilita : C.alberi.probabilita)) return null;
  return estrai(poolAt(tipo, ms), rng);
}

const VUOTO: InsettiState = { visti: {}, posseduti: [], giorno: 0, sassi: [], alberi: [], presi: [], usciti: [] };
/** La collezione del lotto coi conti di oggi (a mezzanotte di Roma sassi e alberi tornano buoni; via i liberi e gli usciti scaduti). */
export function insettiOf(lot: LotState | null | undefined, ms: number): InsettiState {
  const s = { ...VUOTO, ...(lot?.insetti ?? {}) }, g = giornoRoma(ms), cur = turnoAt(ms);
  const presi = s.presi.filter((k) => Number(k.split(':')[1]) >= cur - 2);
  const usciti = s.usciti.filter((u) => {
    const d = insettoDef(u.id);
    return d && ms - u.t <= (d.finestra + MARGINE_USCITO_S) * 1000;
  });
  return s.giorno === g ? { ...s, presi, usciti } : { ...s, giorno: g, sassi: [], alberi: [], presi, usciti };
}
export function possiedeRetino(lot: LotState | null | undefined): boolean { return (lot?.hero?.inv[C.retino.id] ?? 0) >= 1; }
/** Visto (preso almeno una volta) e posseduto (consegnato al mobiliere). */
export const vistoInsetto = (lot: LotState | null | undefined, id: string): boolean => (lot?.insetti?.visti[id] ?? 0) > 0;
export const possedutoInsetto = (lot: LotState | null | undefined, id: string): boolean => !!lot?.insetti?.posseduti.includes(id);
