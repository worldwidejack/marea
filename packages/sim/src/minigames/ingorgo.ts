// Ingorgo al porto (GDD §6, minigioco universale «ovunque al molo»): stile Rush Hour. Barchette ormeggiate in una griglia 6×6, ognuna
// scorre solo lungo il suo asse; fai uscire la tua (la rossa, terza riga) dal varco a destra. Tre ingorghi di fila in 120 s, sempre più
// intricati; la medaglia la danno gli ingorghi risolti, il punteggio anche le mosse (vicino alla soluzione più corta = meglio).
// Una mossa nell'InputFrame: fronte di salita di `a` con mx = (barca + 1) / 32 e my = delta / 32 (esatti dopo la quantizzazione);
// fronte di salita di `b` = ricomincia l'ingorgo. Livelli in content (minigames/ingorgo.json), generati con tools/ingorgo_livelli.mjs.
// Tutto intero: niente trigonometria, il replay coincide su ogni motore JS.
import { MINIGAMES_CFG } from '@marea/content';
import type { IngorgoLivello } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const CFG = MINIGAMES_CFG.ingorgo;
export const LATO = 6;
/** Riga della tua barca e del varco (0 = in alto). */
export const RIGA_USCITA = 2;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const PAUSA = Math.round(CFG.pausaSecondi * TICK_HZ);
const AUTO = Math.max(2, Math.round(CFG.autopilotaSecondi * TICK_HZ));
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

/** Una barca: cella in alto a sinistra, lunghezza (2 o 3), orizzontale o verticale. La barca 0 è la tua. */
export type Barca = { x: number; y: number; len: number; h: boolean };
export type Mossa = { barca: number; delta: number };

export type IngorgoState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  livelli: IngorgoLivello[];
  /** Ingorgo in corso (indice in `livelli`). */
  idx: number;
  barche: Barca[];
  /** Mosse sull'ingorgo in corso. */
  mosse: number;
  esiti: { mosse: number; ottimo: number; tick: number }[];
  ripartenze: number;
  /** Tick di pausa rimasti dopo un ingorgo risolto (la barca esce). */
  pausa: number;
  prevA: boolean;
  prevB: boolean;
  done: boolean;
  timeUp: boolean;
  finishTick: number;
  ultima: { barca: number; delta: number; tick: number } | null;
};
export type IngorgoView = {
  barche: Barca[];
  idx: number;
  totale: number;
  mosse: number;
  ottimo: number;
  risolti: number;
  ms: number;
  maxMs: number;
  /** 0..1 durante la pausa dopo un ingorgo risolto (0 = appena risolto), −1 fuori pausa. */
  uscita: number;
  done: boolean;
  timeUp: boolean;
  ultima: { barca: number; delta: number; tick: number } | null;
  medaglie: { oro: number; argento: number; bronzo: number };
};

/** Il frame di una mossa: barca `barca` spostata di `delta` celle lungo il suo asse (− = sinistra/su). */
export function mossaFrame(barca: number, delta: number): InputFrame {
  return { mx: (barca + 1) / 32, my: delta / 32, a: true, b: false };
}
/** Il frame che ricomincia l'ingorgo in corso. */
export const RICOMINCIA: InputFrame = { mx: 0, my: 0, a: false, b: true };
function decodeMossa(f: InputFrame, n: number): Mossa | null {
  const barca = Math.round(f.mx * 32) - 1, delta = Math.round(f.my * 32);
  return barca >= 0 && barca < n && delta !== 0 && Math.abs(delta) < LATO ? { barca, delta } : null;
}

/** Barche di un livello: la 'A' per prima, poi le altre in ordine alfabetico. Lancia se le righe non sono un livello valido. */
export function parseLivello(righe: readonly string[]): Barca[] {
  if (righe.length !== LATO || righe.some((r) => r.length !== LATO)) throw new Error('Ingorgo: servono 6 righe da 6');
  const celle = new Map<string, { x: number; y: number }[]>();
  for (let y = 0; y < LATO; y++) for (let x = 0; x < LATO; x++) {
    const ch = righe[y]![x]!;
    if (ch === '.') continue;
    if (!/^[A-Z]$/.test(ch)) throw new Error(`Ingorgo: carattere ${ch}`);
    let l = celle.get(ch);
    if (!l) { l = []; celle.set(ch, l); }
    l.push({ x, y });
  }
  const ids = [...celle.keys()].sort((a, b) => (a === 'A' ? -1 : b === 'A' ? 1 : a < b ? -1 : 1));
  if (ids[0] !== 'A') throw new Error('Ingorgo: manca la barca A');
  return ids.map((id) => {
    const c = celle.get(id)!;
    const h = c.every((p) => p.y === c[0]!.y), v = c.every((p) => p.x === c[0]!.x);
    const x = Math.min(...c.map((p) => p.x)), y = Math.min(...c.map((p) => p.y)), len = c.length;
    const dritta = h ? Math.max(...c.map((p) => p.x)) - x + 1 === len : v && Math.max(...c.map((p) => p.y)) - y + 1 === len;
    if ((!h && !v) || !dritta || len < 2 || len > 3) throw new Error(`Ingorgo: barca ${id} storta`);
    if (id === 'A' && (!h || y !== RIGA_USCITA)) throw new Error('Ingorgo: la barca A deve stare orizzontale sulla terza riga');
    return { x, y, len, h };
  });
}
/** Le righe di un insieme di barche (la 0 = 'A', le altre B, C, …). */
export function righeDi(barche: readonly Barca[]): string[] {
  const g = Array.from({ length: LATO }, () => Array.from({ length: LATO }, () => '.'));
  barche.forEach((b, i) => { for (let k = 0; k < b.len; k++) g[b.h ? b.y : b.y + k]![b.h ? b.x + k : b.x] = String.fromCharCode(65 + i); });
  return g.map((r) => r.join(''));
}

// ---------- regole: la griglia è piccola, si ricalcola l'occupazione a ogni domanda ----------
function occupa(barche: readonly Barca[]): Int8Array {
  const g = new Int8Array(LATO * LATO).fill(-1);
  barche.forEach((b, i) => { for (let k = 0; k < b.len; k++) g[(b.h ? b.y : b.y + k) * LATO + (b.h ? b.x + k : b.x)] = i; });
  return g;
}
/** Quanto può scorrere la barca `i`: [indietro ≤ 0, avanti ≥ 0] in celle. */
export function limiti(barche: readonly Barca[], i: number): [number, number] {
  const b = barche[i];
  if (!b) return [0, 0];
  const g = occupa(barche), cell = (p: number) => (b.h ? b.y * LATO + p : p * LATO + b.x), p0 = b.h ? b.x : b.y;
  let lo = 0, hi = 0;
  while (p0 + lo - 1 >= 0 && g[cell(p0 + lo - 1)] === -1) lo--;
  while (p0 + b.len + hi < LATO && g[cell(p0 + b.len + hi)] === -1) hi++;
  return [lo, hi];
}
export function mossaValida(barche: readonly Barca[], m: Mossa): boolean {
  if (m.delta === 0 || !barche[m.barca]) return false;
  const [lo, hi] = limiti(barche, m.barca);
  return m.delta >= lo && m.delta <= hi;
}
function applica(barche: Barca[], m: Mossa): void {
  const b = barche[m.barca]!;
  barche[m.barca] = b.h ? { ...b, x: b.x + m.delta } : { ...b, y: b.y + m.delta };
}
/** La tua barca tocca il varco a destra. */
export function risolto(barche: readonly Barca[]): boolean {
  const a = barche[0];
  return !!a && a.x + a.len === LATO;
}

// ---------- ricerca (soluzione più corta, generatore di livelli) ----------
type Forma = { len: number[]; h: boolean[]; fisso: number[] };
const formaDi = (barche: readonly Barca[]): Forma => ({ len: barche.map((b) => b.len), h: barche.map((b) => b.h), fisso: barche.map((b) => (b.h ? b.y : b.x)) });
const posDi = (barche: readonly Barca[]): number[] => barche.map((b) => (b.h ? b.x : b.y));
const chiave = (pos: readonly number[]): string => String.fromCharCode(...pos.map((p) => 48 + p));
const daPos = (f: Forma, pos: readonly number[]): Barca[] => pos.map((p, i) => (f.h[i] ? { x: p, y: f.fisso[i]!, len: f.len[i]!, h: true } : { x: f.fisso[i]!, y: p, len: f.len[i]!, h: false }));
function vicini(f: Forma, pos: readonly number[], cb: (barca: number, delta: number) => void): void {
  const g = new Int8Array(LATO * LATO).fill(-1);
  for (let i = 0; i < pos.length; i++) for (let k = 0; k < f.len[i]!; k++) g[f.h[i] ? f.fisso[i]! * LATO + pos[i]! + k : (pos[i]! + k) * LATO + f.fisso[i]!] = i;
  for (let i = 0; i < pos.length; i++) {
    const cell = (p: number) => (f.h[i] ? f.fisso[i]! * LATO + p : p * LATO + f.fisso[i]!);
    for (let d = 1; pos[i]! - d >= 0 && g[cell(pos[i]! - d)] === -1; d++) cb(i, -d);
    for (let d = 1; pos[i]! + f.len[i]! - 1 + d < LATO && g[cell(pos[i]! + f.len[i]! - 1 + d)] === -1; d++) cb(i, d);
  }
}
const goal = (f: Forma, pos: readonly number[]) => pos[0]! + f.len[0]! === LATO;

/** Soluzione più corta (ricerca in ampiezza), o null se non c'è (o se gli stati superano `max`). */
export function risolvi(barche: readonly Barca[], max = 400_000): Mossa[] | null {
  const f = formaDi(barche), start = posDi(barche);
  if (goal(f, start)) return [];
  const from = new Map<string, { k: string; m: Mossa } | null>([[chiave(start), null]]);
  let coda: number[][] = [start];
  while (coda.length) {
    const next: number[][] = [];
    for (const pos of coda) {
      let fine: string | null = null;
      vicini(f, pos, (barca, delta) => {
        if (fine) return;
        const np = pos.slice(); np[barca] = np[barca]! + delta;
        const k = chiave(np);
        if (from.has(k)) return;
        from.set(k, { k: chiave(pos), m: { barca, delta } });
        if (goal(f, np)) fine = k; else next.push(np);
      });
      if (fine) {
        const out: Mossa[] = [];
        for (let e = from.get(fine); e; e = from.get(e.k)) out.push(e.m);
        return out.reverse();
      }
      if (from.size > max) return null;
    }
    coda = next;
  }
  return null;
}

/**
 * Livello nuovo (per tools/ingorgo_livelli.mjs): barche a caso, poi tra tutte le posizioni raggiungibili quella più lontana dalla
 * soluzione (entro `mosse`). null se il caso non ha dato niente di buono (si riprova con un altro rng).
 */
export function generaLivello(rng: Rng, mosse: [number, number], pezzi: [number, number]): IngorgoLivello | null {
  const barche: Barca[] = [{ x: rng.int(0, 2), y: RIGA_USCITA, len: 2, h: true }];
  const n = rng.int(pezzi[0], pezzi[1]);
  for (let t = 0; t < 400 && barche.length < n; t++) {
    const len = rng.next() < 0.3 ? 3 : 2, h = rng.next() < 0.5;
    const b: Barca = h ? { x: rng.int(0, LATO - len), y: rng.int(0, LATO - 1), len, h } : { x: rng.int(0, LATO - 1), y: rng.int(0, LATO - len), len, h };
    if (h && b.y === RIGA_USCITA) continue; // un'orizzontale sulla riga del varco lo chiuderebbe per sempre
    const g = occupa(barche);
    let free = true;
    for (let k = 0; k < len && free; k++) free = g[(h ? b.y : b.y + k) * LATO + (h ? b.x + k : b.x)] === -1;
    if (free) barche.push(b);
  }
  // tutte le posizioni raggiungibili (le mosse si possono sempre disfare: grafo non orientato)
  const f = formaDi(barche);
  const stati: number[][] = [posDi(barche)], idx = new Map<string, number>([[chiave(stati[0]!), 0]]);
  for (let i = 0; i < stati.length; i++) {
    if (stati.length > 200_000) return null;
    vicini(f, stati[i]!, (barca, delta) => {
      const np = stati[i]!.slice(); np[barca] = np[barca]! + delta;
      const k = chiave(np);
      if (!idx.has(k)) { idx.set(k, stati.length); stati.push(np); }
    });
  }
  // distanza dalla soluzione di ogni posizione: ampiezza partendo da tutte le posizioni risolte insieme
  const dist = new Int32Array(stati.length).fill(-1);
  let coda: number[] = [];
  stati.forEach((p, i) => { if (goal(f, p)) { dist[i] = 0; coda.push(i); } });
  if (!coda.length) return null;
  while (coda.length) {
    const next: number[] = [];
    for (const i of coda) vicini(f, stati[i]!, (barca, delta) => {
      const np = stati[i]!.slice(); np[barca] = np[barca]! + delta;
      const j = idx.get(chiave(np))!;
      if (dist[j] === -1) { dist[j] = dist[i]! + 1; next.push(j); }
    });
    coda = next;
  }
  let best = -1;
  for (let i = 0; i < stati.length; i++) if (dist[i]! <= mosse[1] && (best < 0 || dist[i]! > dist[best]!)) best = i;
  if (best < 0 || dist[best]! < mosse[0]) return null;
  // tra le più lontane, una a caso (stesso rng: stesso livello)
  const top: number[] = [];
  for (let i = 0; i < stati.length; i++) if (dist[i] === dist[best]) top.push(i);
  const scelta = top[rng.int(0, top.length - 1)]!;
  return { righe: righeDi(daPos(f, stati[scelta]!)), mosse: dist[scelta]! };
}

// ---------- modulo ----------
function carica(s: IngorgoState): void {
  s.barche = parseLivello(s.livelli[s.idx]!.righe);
  s.mosse = 0;
}
function medalOf(s: IngorgoState): Medal {
  const m = CFG.medaglie, r = s.esiti.length;
  return r >= m.oro ? 'oro' : r >= m.argento ? 'argento' : r >= m.bronzo ? 'bronzo' : null;
}

/** Piano dell'autopilota per stato (fuori dallo stato: il replay del server non lo vede). */
const PIANI = new WeakMap<IngorgoState, { idx: number; piano: Mossa[]; attesa: number }>();

export const ingorgo: MinigameModule<IngorgoState> = {
  id: 'ingorgo',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const rng = createRng(seed).fork('ingorgo');
    const fasce = CFG.partite[String(difficulty) as '1' | '2' | '3'] ?? CFG.partite['2'];
    const usati = new Map<string, Set<number>>();
    const livelli = fasce.map((f) => {
      const l = CFG.livelli[f] ?? [];
      if (!l.length) throw new Error(`Ingorgo: nessun livello nella fascia ${f}`);
      const u = usati.get(f) ?? new Set<number>(); usati.set(f, u);
      let i = rng.int(0, l.length - 1);
      for (let k = 0; k < l.length && u.has(i); k++) i = (i + 1) % l.length; // niente doppioni nella stessa partita
      u.add(i);
      return l[i]!;
    });
    const s: IngorgoState = {
      seed, difficulty, tick: 0, livelli, idx: 0, barche: [], mosse: 0, esiti: [], ripartenze: 0, pausa: 0,
      prevA: false, prevB: false, done: false, timeUp: false, finishTick: 0, ultima: null,
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
      carica(s); s.ripartenze++; s.ultima = null;
    } else if (pressA) {
      const m = decodeMossa(input, s.barche.length);
      if (m && mossaValida(s.barche, m)) {
        applica(s.barche, m); s.mosse++; s.ultima = { ...m, tick: s.tick };
        if (risolto(s.barche)) {
          s.esiti.push({ mosse: s.mosse, ottimo: s.livelli[s.idx]!.mosse, tick: s.tick });
          if (s.idx >= s.livelli.length - 1) { s.done = true; s.finishTick = s.tick; return; }
          s.pausa = PAUSA;
        }
      }
    }
    if (s.tick >= MAX_TICKS) { s.done = true; s.timeUp = true; s.finishTick = s.tick; }
  },
  /** score: 1000 per ingorgo risolto + fino a 100 per quanto ci sei andato vicino alla soluzione più corta + 5 per secondo avanzato. */
  result(s): MinigameResult {
    const risolti = s.esiti.length, tutti = risolti === s.livelli.length;
    const bravura = s.esiti.reduce((a, e) => a + Math.max(0, 100 - 10 * Math.max(0, e.mosse - e.ottimo)), 0);
    const avanzo = tutti ? Math.floor((MAX_TICKS - s.finishTick) / TICK_HZ) * 5 : 0;
    const ms = Math.round(((s.finishTick || s.tick) / TICK_HZ) * 1000);
    return {
      done: s.done, score: risolti * 1000 + bravura + avanzo, medal: medalOf(s),
      detail: {
        risolti, totale: s.livelli.length, mosse: s.esiti.reduce((a, e) => a + e.mosse, 0), ottimo: s.esiti.reduce((a, e) => a + e.ottimo, 0),
        ms, ripartenze: s.ripartenze,
      },
    };
  },
  /** Autopilota di riferimento: la soluzione più corta, una mossa ogni `autopilotaSecondi` (deve fare oro). */
  autopilot(s): InputFrame {
    if (s.done || s.pausa > 0 || s.prevA) return NO;
    let p = PIANI.get(s);
    if (!p || p.idx !== s.idx || !p.piano[0] || !mossaValida(s.barche, p.piano[0])) {
      p = { idx: s.idx, piano: risolvi(s.barche) ?? [], attesa: p?.idx === s.idx ? 0 : AUTO };
      PIANI.set(s, p);
    }
    if (p.attesa > 0) { p.attesa--; return NO; }
    const m = p.piano.shift();
    p.attesa = AUTO;
    return m ? mossaFrame(m.barca, m.delta) : NO;
  },
  view(s): IngorgoView {
    return {
      barche: s.barche.map((b) => ({ ...b })), idx: s.idx, totale: s.livelli.length, mosse: s.mosse, ottimo: s.livelli[s.idx]?.mosse ?? 0,
      risolti: s.esiti.length, ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: CFG.maxSeconds * 1000,
      uscita: s.pausa > 0 ? 1 - s.pausa / PAUSA : -1, done: s.done, timeUp: s.timeUp, ultima: s.ultima, medaglie: { ...CFG.medaglie },
    };
  },
};
