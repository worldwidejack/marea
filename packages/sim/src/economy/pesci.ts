// I pesci (#457, Database_Pesci_GameDesign.xlsx di Riccardo): stagione (calendario di Roma) e giorno/notte del gioco come gli insetti
// (economy/insetti.ts), le ombre che escono a turni uguali per tutti (lungo le rive di Borgo Marea e attorno alla barca ferma), dove si
// pesca dalla barca, e la collezione del lotto (visti, posseduti). Puro e deterministico: il tempo arriva da fuori (ms del server).
// Non importa il catalogo GDR (i pesci nello zaino sono oggetti di rpg/items.ts). Le azioni sul lotto stanno in rpg/pesci.ts.
import { ACQUA_RIVA, PESCI, PESCI_CFG } from '@marea/content/pesci.ts';
import type { PesceDef, PesceZona } from '@marea/content/pesci.ts';
import { hashJson } from '../hash.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import * as trig from '../trig.ts';
import type { Archipelago } from '../world/archipelago.ts';
import { notteAt, stagioneAt } from './insetti.ts';
import type { LotState } from './types.ts';

const C = PESCI_CFG;
/** La collezione (LotState.pesci). */
export type PesciState = {
  /** Specie pescate almeno una volta → quante volte (pagina Pesci del Diario: disegno sbloccato). */
  visti: Record<string, number>;
  /** Specie consegnate al mobiliere (descrizione sbloccata, «catturato»). */
  posseduti: string[];
  /** Ombre già pescate (chiavi `r:<turno>:<i>` / `b:<turno>:<i>` dei turni recenti). */
  presi: string[];
};
/** Un'ombra del turno, uguale per tutti: `cell` del template `porto` (solo quelle di riva), `seme` per il suo nuoto. */
export type Ombra = { k: string; id: string; zona: PesceZona; cell: [number, number] | null; seme: number; turno: number };

export function pesceDef(id: string): PesceDef | undefined { return PESCI.find((p) => p.id === id); }
/** Il pesce c'è adesso (stagione e fascia oraria)? */
export function pesceDisponibile(d: PesceDef, ms: number): boolean {
  if (d.stagione !== 'tutto' && d.stagione !== stagioneAt(ms)) return false;
  return d.fascia === 'sempre' || (d.fascia === 'notte') === notteAt(ms);
}
/** Chi può abboccare adesso in quella zona. */
export const pesciAt = (zona: PesceZona, ms: number): PesceDef[] => PESCI.filter((p) => p.zona === zona && pesceDisponibile(p, ms));
function estrai(pool: readonly PesceDef[], rng: Rng): PesceDef | null {
  const tot = pool.reduce((s, p) => s + p.peso, 0);
  if (tot <= 0) return null;
  let r = rng.next() * tot;
  for (const p of pool) { r -= p.peso; if (r < 0) return p; }
  return pool[pool.length - 1] ?? null;
}

// ———— le ombre: un turno ogni `turno.minuti`, uguale per tutti ————
const TURNO_MS = C.turno.minuti * 60_000;
export const turnoPesciAt = (ms: number): number => Math.floor(ms / TURNO_MS);
/** Inizio e fine (ms) di un turno. */
export const turnoPesciMs = (turno: number): [number, number] => [turno * TURNO_MS, (turno + 1) * TURNO_MS];
const cache = new Map<number, Ombra[]>();
/** Le ombre del turno (stagione e fascia di metà turno): prima quelle di riva (su celle d'acqua vicino al Borgo), poi quelle della barca. */
export function ombreDelTurno(turno: number): Ombra[] {
  const hit = cache.get(turno);
  if (hit) return hit;
  const meta = turno * TURNO_MS + TURNO_MS / 2, rng = createRng(hashJson(['pesci_ombre_v1', turno])), out: Ombra[] = [];
  const riva = pesciAt('riva', meta), barca = pesciAt('barca', meta), usate = new Set<number>();
  for (let i = 0; i < C.turno.riva; i++) {
    const d = estrai(riva, rng), seme = rng.next();
    // celle diverse e sparse lungo tutta la riva: si prova qualche volta a non cadere vicino a un'altra ombra
    let ci = rng.int(0, ACQUA_RIVA.length - 1);
    for (let t = 0; t < 6 && [...usate].some((u) => Math.abs(ACQUA_RIVA[u]![0] - ACQUA_RIVA[ci]![0]) + Math.abs(ACQUA_RIVA[u]![1] - ACQUA_RIVA[ci]![1]) < 8); t++) ci = rng.int(0, ACQUA_RIVA.length - 1);
    usate.add(ci);
    const c = ACQUA_RIVA[ci] ?? [0, 0];
    if (d) out.push({ k: `r:${turno}:${i}`, id: d.id, zona: 'riva', cell: [c[0], c[1]], seme, turno });
  }
  for (let i = 0; i < C.turno.barca; i++) {
    const d = estrai(barca, rng), seme = rng.next();
    if (d) out.push({ k: `b:${turno}:${i}`, id: d.id, zona: 'barca', cell: null, seme, turno });
  }
  if (cache.size > 16) cache.clear();
  cache.set(turno, out);
  return out;
}
/** L'ombra con quella chiave, se esiste in un turno ancora valido adesso (questo o quello prima: la rete può arrivare tardi). */
export function ombraValida(k: string, ms: number): Ombra | null {
  const m = /^([rb]):(\d+):(\d+)$/.exec(k);
  if (!m) return null;
  const turno = Number(m[2]), cur = turnoPesciAt(ms);
  if (turno !== cur && turno !== cur - 1) return null;
  return ombreDelTurno(turno).find((o) => o.k === k) ?? null;
}

// ———— dalla barca ————
export type BarcaQui = { ok: boolean; perche: 'terra' | 'riva' | 'veloce' | null };
/** Si pesca dalla barca qui? Su acqua (`~`), quasi ferma, senza terra entro `barca.rivaM` metri (lì si pesca da riva). */
export function barcaQui(arch: Archipelago, x: number, z: number, speed: number): BarcaQui {
  const m = arch.map, tile = arch.tile, cx = Math.floor(x / tile), cz = Math.floor(z / tile);
  if (m.at(cx, cz) !== '~') return { ok: false, perche: 'terra' };
  const r = Math.ceil(C.barca.rivaM / tile);
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      if (m.at(cx + dx, cz + dz) === '~') continue;
      if (trig.hypot((cx + dx + 0.5) * tile - x, (cz + dz + 0.5) * tile - z) <= C.barca.rivaM) return { ok: false, perche: 'riva' };
    }
  if (Math.abs(speed) > C.barca.fermoMs) return { ok: false, perche: 'veloce' };
  return { ok: true, perche: null };
}

const VUOTO: PesciState = { visti: {}, posseduti: [], presi: [] };
/** La collezione del lotto (via le ombre pescate dei turni vecchi). */
export function pesciOf(lot: LotState | null | undefined, ms: number): PesciState {
  const s = { ...VUOTO, ...(lot?.pesci ?? {}) }, cur = turnoPesciAt(ms);
  return { ...s, presi: s.presi.filter((k) => Number(k.split(':')[1]) >= cur - 2) };
}
export function possiedeCanna(lot: LotState | null | undefined): boolean { return (lot?.hero?.inv[C.canna.id] ?? 0) >= 1; }
/** Visto (pescato almeno una volta) e posseduto (consegnato al mobiliere). */
export const vistoPesce = (lot: LotState | null | undefined, id: string): boolean => (lot?.pesci?.visti[id] ?? 0) > 0;
export const possedutoPesce = (lot: LotState | null | undefined, id: string): boolean => !!lot?.pesci?.posseduti.includes(id);
