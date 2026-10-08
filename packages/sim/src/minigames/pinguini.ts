// Pinguini sul ghiaccio (minigioco dell'Isola dei Ghiacci, GDD §6; solo a isola aperta). Lastra di ghiaccio a griglia vista dall'alto:
// trascini un pinguino in una direzione e scivola finché non sbatte contro un iceberg, un altro pinguino o il bordo; se passa sopra una
// buca di pesca ci si tuffa (ed esce dal ghiaccio). Tutti i pinguini nelle buche = livello risolto. Tre livelli in 90 s, sempre più
// difficili, scelti dal seed tra quelli in content (minigames/pinguini.json, generati con tools/pinguini_livelli.mjs e ricontrollati dai
// test con la soluzione più corta): la medaglia la danno i livelli risolti, il punteggio anche le mosse (vicino al minimo = meglio) e il
// tempo avanzato. I livelli non si generano sul server: la ricerca costa troppo per una richiesta.
// Una mossa nell'InputFrame: fronte di salita di `a` con mx = (pinguino + 1) / 32 e my = (direzione + 1) / 32 (esatti dopo la
// quantizzazione); fronte di salita di `b` = ricomincia il livello. Tutto intero: il replay coincide su ogni motore JS.
import { MINIGAMES_CFG } from '@marea/content';
import type { PinguiniFascia, PinguiniLivello } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const CFG = MINIGAMES_CFG.pinguini;
/** Lato della lastra (celle). */
export const PG_LATO = CFG.lato;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const PAUSA = Math.round(CFG.pausaSecondi * TICK_HZ);
const AUTO = Math.max(2, Math.round(CFG.autopilotaSecondi * TICK_HZ));
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
/** Direzioni: 0 su, 1 destra, 2 giù, 3 sinistra. */
export const PG_DIR: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** La lastra: iceberg e buche per cella (y·lato + x). */
export type Lastra = { lato: number; muro: boolean[]; buca: boolean[] };
/** Una mossa: pinguino `p` verso `dir`. */
export type PgMossa = { p: number; dir: number };
/** Dove finisce una scivolata: cella d'arrivo (la buca, se si tuffa), celle percorse, tuffo sì/no. */
export type Scivolata = { a: number; passi: number; tuffo: boolean };

export type PinguiniState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  livelli: PinguiniLivello[];
  idx: number;
  lastra: Lastra;
  /** Cella di ogni pinguino, −1 = si è tuffato. */
  pos: number[];
  mosse: number;
  esiti: { mosse: number; ottimo: number; tick: number }[];
  ripartenze: number;
  pausa: number;
  prevA: boolean;
  prevB: boolean;
  done: boolean;
  timeUp: boolean;
  finishTick: number;
  ultima: { p: number; dir: number; da: number; a: number; passi: number; tuffo: boolean; tick: number } | null;
};
export type PinguiniView = {
  lato: number;
  muro: boolean[];
  buca: boolean[];
  pos: number[];
  idx: number;
  totale: number;
  mosse: number;
  ottimo: number;
  risolti: number;
  ms: number;
  maxMs: number;
  /** 0..1 durante la pausa dopo un livello risolto, −1 fuori pausa. */
  festa: number;
  done: boolean;
  timeUp: boolean;
  tick: number;
  ultima: PinguiniState['ultima'];
  medaglie: { oro: number; argento: number; bronzo: number };
};

/** Il frame di una mossa: pinguino `p` verso `dir` (0 su, 1 destra, 2 giù, 3 sinistra). */
export function pgMossaFrame(p: number, dir: number): InputFrame {
  return { mx: (p + 1) / 32, my: (dir + 1) / 32, a: true, b: false };
}
/** Il frame che ricomincia il livello in corso. */
export const PG_RICOMINCIA: InputFrame = { mx: 0, my: 0, a: false, b: true };
function decodeMossa(f: InputFrame, n: number): PgMossa | null {
  const p = Math.round(f.mx * 32) - 1, dir = Math.round(f.my * 32) - 1;
  return p >= 0 && p < n && dir >= 0 && dir < 4 ? { p, dir } : null;
}

/** Lastra e pinguini da un livello. Lancia se le righe non sono un livello valido. */
export function parsePinguini(righe: readonly string[]): { lastra: Lastra; pos: number[] } {
  const L = righe.length;
  if (L < 3 || righe.some((r) => r.length !== L)) throw new Error('Pinguini: la lastra dev\'essere quadrata');
  const muro: boolean[] = [], buca: boolean[] = [], pg: [string, number][] = [];
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const ch = righe[y]![x]!, c = y * L + x;
    muro.push(ch === '#'); buca.push(ch === 'o');
    if (/^[A-Z]$/.test(ch)) pg.push([ch, c]);
    else if (!'.#o'.includes(ch)) throw new Error(`Pinguini: carattere ${ch}`);
  }
  pg.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!pg.length || pg.some(([ch], i) => ch !== String.fromCharCode(65 + i))) throw new Error('Pinguini: servono i pinguini A, B, C… uno per lettera');
  if (!buca.some(Boolean)) throw new Error('Pinguini: manca la buca');
  return { lastra: { lato: L, muro, buca }, pos: pg.map(([, c]) => c) };
}
/** Le righe di una lastra con i pinguini (quelli tuffati non ci sono). */
export function righePinguini(l: Lastra, pos: readonly number[]): string[] {
  const g: string[] = l.muro.map((m, c) => (m ? '#' : l.buca[c] ? 'o' : '.'));
  pos.forEach((c, i) => { if (c >= 0) g[c] = String.fromCharCode(65 + i); });
  return Array.from({ length: l.lato }, (_, y) => g.slice(y * l.lato, (y + 1) * l.lato).join(''));
}

/** Dove arriva il pinguino `p` spinto verso `dir`; null se non si muove (sbatte subito o si è già tuffato). */
export function scivola(l: Lastra, pos: readonly number[], p: number, dir: number): Scivolata | null {
  const c0 = pos[p];
  const d = PG_DIR[dir];
  if (c0 === undefined || c0 < 0 || !d) return null;
  let x = c0 % l.lato, y = (c0 - x) / l.lato, passi = 0;
  for (;;) {
    const nx = x + d[0], ny = y + d[1];
    if (nx < 0 || ny < 0 || nx >= l.lato || ny >= l.lato) break;
    const nc = ny * l.lato + nx;
    if (l.muro[nc] || pos.includes(nc)) break;
    x = nx; y = ny; passi++;
    if (l.buca[nc]) return { a: nc, passi, tuffo: true };
  }
  return passi ? { a: y * l.lato + x, passi, tuffo: false } : null;
}
const applica = (pos: number[], p: number, s: Scivolata) => { pos[p] = s.tuffo ? -1 : s.a; };
export const pgRisolto = (pos: readonly number[]) => pos.every((c) => c < 0);

/** Soluzione più corta (ricerca in ampiezza), o null se non c'è (o se gli stati superano `max`). */
export function risolviPinguini(l: Lastra, start: readonly number[], max = 60_000): PgMossa[] | null {
  if (pgRisolto(start)) return [];
  const k = (p: readonly number[]) => p.join(',');
  const from = new Map<string, { k: string; m: PgMossa } | null>([[k(start), null]]);
  let coda: number[][] = [start.slice()];
  while (coda.length) {
    const next: number[][] = [];
    for (const pos of coda) for (let p = 0; p < pos.length; p++) for (let dir = 0; dir < 4; dir++) {
      const s = scivola(l, pos, p, dir);
      if (!s) continue;
      const np = pos.slice(); applica(np, p, s);
      const nk = k(np);
      if (from.has(nk)) continue;
      from.set(nk, { k: k(pos), m: { p, dir } });
      if (pgRisolto(np)) {
        const out: PgMossa[] = [];
        for (let e = from.get(nk); e; e = from.get(e.k)) out.push(e.m);
        return out.reverse();
      }
      if (from.size > max) return null;
      next.push(np);
    }
    coda = next;
  }
  return null;
}

/** Un livello a caso nella fascia (iceberg, buche e pinguini sparsi, soluzione più corta dentro `f.mosse`), o null se il caso non ha dato niente. */
export function generaPinguini(rng: Rng, f: PinguiniFascia, lato = PG_LATO): PinguiniLivello | null {
  const n = lato * lato, celle = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = rng.int(0, i); const t = celle[i]!; celle[i] = celle[j]!; celle[j] = t; }
  const nm = rng.int(f.iceberg[0], f.iceberg[1]), nb = rng.int(f.buche[0], f.buche[1]), np = rng.int(f.pinguini[0], f.pinguini[1]);
  const l: Lastra = { lato, muro: Array.from({ length: n }, () => false), buca: Array.from({ length: n }, () => false) };
  let i = 0;
  for (let k = 0; k < nm; k++) l.muro[celle[i++]!] = true;
  for (let k = 0; k < nb; k++) l.buca[celle[i++]!] = true;
  const pos: number[] = [];
  for (let k = 0; k < np; k++) pos.push(celle[i++]!);
  const sol = risolviPinguini(l, pos);
  if (!sol || sol.length < f.mosse[0] || sol.length > f.mosse[1]) return null;
  return { righe: righePinguini(l, pos), mosse: sol.length };
}

/** I livelli della partita: uno per fascia (in ordine), scelto dal seed tra quelli in content, senza doppioni. */
export function livelliPinguini(seed: number, difficulty: Difficulty): PinguiniLivello[] {
  const rng = createRng(seed).fork('pinguini');
  const fasce = CFG.partite[String(difficulty) as '1' | '2' | '3'] ?? CFG.partite['2'];
  const usati = new Map<string, Set<number>>();
  return fasce.map((f) => {
    const l = CFG.livelli[f] ?? [];
    if (!l.length) throw new Error(`Pinguini: nessun livello nella fascia ${f}`);
    const u = usati.get(f) ?? new Set<number>(); usati.set(f, u);
    let i = rng.int(0, l.length - 1);
    for (let k = 0; k < l.length && u.has(i); k++) i = (i + 1) % l.length;
    u.add(i);
    return l[i]!;
  });
}

// ---------- modulo ----------
function carica(s: PinguiniState): void {
  const p = parsePinguini(s.livelli[s.idx]!.righe);
  s.lastra = p.lastra; s.pos = p.pos; s.mosse = 0; s.ultima = null;
}
function medalOf(s: PinguiniState): Medal {
  const m = CFG.medaglie, r = s.esiti.length;
  return r >= m.oro ? 'oro' : r >= m.argento ? 'argento' : r >= m.bronzo ? 'bronzo' : null;
}
/** Piano dell'autopilota per stato (fuori dallo stato: il replay del server non lo vede). */
const PIANI = new WeakMap<PinguiniState, { idx: number; piano: PgMossa[]; attesa: number }>();

export const pinguini: MinigameModule<PinguiniState> = {
  id: 'pinguini',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const s: PinguiniState = {
      seed, difficulty, tick: 0, livelli: livelliPinguini(seed, difficulty), idx: 0, lastra: { lato: PG_LATO, muro: [], buca: [] }, pos: [],
      mosse: 0, esiti: [], ripartenze: 0, pausa: 0, prevA: false, prevB: false, done: false, timeUp: false, finishTick: 0, ultima: null,
    };
    carica(s);
    return s;
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    const pressA = input.a && !s.prevA, pressB = input.b && !s.prevB;
    s.prevA = input.a; s.prevB = input.b;
    if (s.pausa > 0) {
      if (--s.pausa === 0) { s.idx++; carica(s); }
    } else if (pressB) {
      carica(s); s.ripartenze++;
    } else if (pressA) {
      const m = decodeMossa(input, s.pos.length), sc = m && scivola(s.lastra, s.pos, m.p, m.dir);
      if (m && sc) {
        s.ultima = { p: m.p, dir: m.dir, da: s.pos[m.p]!, a: sc.a, passi: sc.passi, tuffo: sc.tuffo, tick: s.tick };
        applica(s.pos, m.p, sc); s.mosse++;
        if (pgRisolto(s.pos)) {
          s.esiti.push({ mosse: s.mosse, ottimo: s.livelli[s.idx]!.mosse, tick: s.tick });
          if (s.idx >= s.livelli.length - 1) { s.done = true; s.finishTick = s.tick; return; }
          s.pausa = PAUSA;
        }
      }
    }
    if (s.tick >= MAX_TICKS) { s.done = true; s.timeUp = true; s.finishTick = s.tick; }
  },
  /** score: 1000 per livello risolto + fino a 100 per quanto ci sei andato vicino alla soluzione più corta + 5 per secondo avanzato. */
  result(s): MinigameResult {
    const risolti = s.esiti.length, tutti = risolti === s.livelli.length;
    const bravura = s.esiti.reduce((a, e) => a + Math.max(0, 100 - 15 * Math.max(0, e.mosse - e.ottimo)), 0);
    const avanzo = tutti ? Math.floor((MAX_TICKS - s.finishTick) / TICK_HZ) * 5 : 0;
    return {
      done: s.done, score: risolti * 1000 + bravura + avanzo, medal: medalOf(s),
      detail: {
        risolti, totale: s.livelli.length, mosse: s.esiti.reduce((a, e) => a + e.mosse, 0), ottimo: s.esiti.reduce((a, e) => a + e.ottimo, 0),
        ms: Math.round(((s.finishTick || s.tick) / TICK_HZ) * 1000), ripartenze: s.ripartenze,
      },
    };
  },
  /** Autopilota di riferimento: la soluzione più corta, una mossa ogni `autopilotaSecondi` (deve fare oro). */
  autopilot(s): InputFrame {
    if (s.done || s.pausa > 0 || s.prevA || s.prevB) return NO;
    let p = PIANI.get(s);
    const prossima = p?.piano[0];
    if (!p || p.idx !== s.idx || !prossima || !scivola(s.lastra, s.pos, prossima.p, prossima.dir)) {
      const piano = risolviPinguini(s.lastra, s.pos);
      if (!piano) { PIANI.delete(s); return PG_RICOMINCIA; } // un pinguino incastrato (mosse di prima): si ricomincia il livello
      p = { idx: s.idx, piano, attesa: p?.idx === s.idx ? 0 : AUTO };
      PIANI.set(s, p);
    }
    if (p.attesa > 0) { p.attesa--; return NO; }
    const m = p.piano.shift();
    p.attesa = AUTO;
    return m ? pgMossaFrame(m.p, m.dir) : NO;
  },
  view(s): PinguiniView {
    return {
      lato: s.lastra.lato, muro: s.lastra.muro.slice(), buca: s.lastra.buca.slice(), pos: s.pos.slice(), idx: s.idx, totale: s.livelli.length,
      mosse: s.mosse, ottimo: s.livelli[s.idx]?.mosse ?? 0, risolti: s.esiti.length, ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: CFG.maxSeconds * 1000,
      festa: s.pausa > 0 ? 1 - s.pausa / PAUSA : -1, done: s.done, timeUp: s.timeUp, tick: s.tick, ultima: s.ultima ? { ...s.ultima } : null, medaglie: { ...CFG.medaglie },
    };
  },
};
