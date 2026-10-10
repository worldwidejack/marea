// Input log del dungeon (RLE, mx/my a 1/8) e replay deterministico per il server.
import type { HeroState, RunHero, RunResult } from '../rpg/types.ts';
import { EQUIP_SLOTS } from '../rpg/types.ts';
import type { EquipSlot } from '../rpg/types.ts';
import type { DungeonAzione, DungeonAzioni, DungeonInput, PackedDungeon } from './types.ts';
import { NO_DUNGEON_INPUT } from './types.ts';
import { actParty, createPartyRun, dungeon, stepParty } from './dungeon.ts';
import { conEroe, finita } from './state.ts';
import type { EroeDef } from './state.ts';
import { AIM_N } from './mira.ts';

/** In ottavi, senza −0 (così log e roundtrip sono identici anche con deepStrictEqual). */
const q8 = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 8) || 0;
const bits = (f: DungeonInput): number => (f.a ? 1 : 0) | (f.b ? 2 : 0) | (f.c ? 4 : 0) | (f.d ? 8 : 0);
/** Mira valida (1..AIM_N) o 0 = nessuna. */
const mira = (m: number | undefined): number => (m !== undefined && Number.isInteger(m) && m >= 1 && m <= AIM_N ? m : 0);
/** Il frame di una riga del log: [ticks, mx8, my8, bit, mira?] (la mira manca nei log del formato 1). */
export function frameOfRiga(r: readonly (number | undefined)[]): DungeonInput {
  const b = r[3]!, m = mira(r[4]);
  return { mx: r[1]! / 8, my: r[2]! / 8, a: (b & 1) !== 0, b: (b & 2) !== 0, c: (b & 4) !== 0, d: (b & 8) !== 0, ...(m ? { m } : {}) };
}

/** Quantizza come farà il replay: il client DEVE giocare con questo, così l'esito coincide. */
export function quantizeDungeon(f: DungeonInput): DungeonInput {
  const m = mira(f.m);
  return { mx: q8(f.mx) / 8, my: q8(f.my) / 8, a: !!f.a, b: !!f.b, c: !!f.c, d: !!f.d, ...(m ? { m } : {}) };
}

export function packDungeon(frames: readonly DungeonInput[]): PackedDungeon {
  const out: PackedDungeon = [];
  for (const f of frames) {
    const mx = q8(f.mx), my = q8(f.my), b = bits(f), m = mira(f.m);
    const last = out[out.length - 1];
    if (last && last[1] === mx && last[2] === my && last[3] === b && (last[4] ?? 0) === m) last[0]++;
    else out.push(m ? [1, mx, my, b, m] : [1, mx, my, b]);
  }
  return out;
}

export function unpackDungeon(p: PackedDungeon): DungeonInput[] {
  const out: DungeonInput[] = [];
  for (const r of p) {
    const f = frameOfRiga(r);
    for (let i = 0; i < r[0]; i++) out.push(f);
  }
  return out;
}

/** Controllo di forma per un log dalla rete: righe [ticks ≥ 1, mx8, my8 ∈ [−8, 8], bit ∈ 0..15, mira ∈ 0..AIM_N (facoltativa)], al massimo
 *  `maxTicks` tick in tutto. */
export function isPackedDungeon(v: unknown, maxTicks: number): v is PackedDungeon {
  if (!Array.isArray(v) || v.length > maxTicks) return false;
  let ticks = 0;
  for (const r of v) {
    if (!Array.isArray(r) || (r.length !== 4 && r.length !== 5) || !r.every((n) => Number.isInteger(n))) return false;
    const [n, mx, my, b, m] = r as number[];
    if (n! < 1 || Math.abs(mx!) > 8 || Math.abs(my!) > 8 || b! < 0 || b! > 15 || (m !== undefined && (m < 0 || m > AIM_N))) return false;
    ticks += n!;
    if (ticks > maxTicks) return false;
  }
  return true;
}

const MAX_AZIONI = 400;
const okStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;
/** Controllo di forma di un'azione dalla rete (null = non valida); oggetto pulito, niente campi in più. */
export function parseDungeonAzione(v: unknown): DungeonAzione | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  switch (o['t']) {
    case 'equip':
      if (!EQUIP_SLOTS.includes(o['slot'] as EquipSlot) || (o['item'] !== null && !okStr(o['item']))) return null;
      return { t: 'equip', slot: o['slot'] as EquipSlot, item: o['item'] as string | null };
    case 'butta': return okStr(o['item']) && Number.isInteger(o['n']) && (o['n'] as number) >= 1 && (o['n'] as number) <= 999 ? { t: 'butta', item: o['item'], n: o['n'] as number } : null;
    case 'salva': return { t: 'salva' };
    case 'esci': return { t: 'esci' };
    case 'ritira': return { t: 'ritira' };
    default: return null;
  }
}
/** Azioni dalla rete: [[tick, azione], ...] con tick interi non decrescenti in 0..maxTicks, al massimo MAX_AZIONI; null se non valide. */
export function parseDungeonAzioni(v: unknown, maxTicks: number): DungeonAzioni | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_AZIONI) return null;
  const out: DungeonAzioni = [];
  let last = 0;
  for (const r of v) {
    if (!Array.isArray(r) || r.length !== 2 || !Number.isInteger(r[0]) || r[0] < last || r[0] > maxTicks) return null;
    const a = parseDungeonAzione(r[1]);
    if (!a) return null;
    out.push([r[0], a]); last = r[0];
  }
  return out;
}

/** Rigioca una spedizione: stesso seed, stesso eroe, stessi input e azioni → stesso RunResult (e hash) del client. Le azioni si applicano
 *  prima del passo del loro tick (quelle oltre l'ultimo input, a fine log). */
export function replayDungeon(seed: number, dungeonId: string, hero: RunHero, p: PackedDungeon, o: { stato?: HeroState | null; partenza?: number | null; azioni?: DungeonAzioni } = {}): RunResult {
  let ticks = 0;
  for (const r of p) ticks += r[0];
  if (ticks > dungeon.maxTicks) throw new Error('Input log troppo lungo');
  const s = dungeon.create({ seed, dungeon: dungeonId, hero, stato: o.stato ?? null, partenza: o.partenza ?? null });
  const az = o.azioni ?? [];
  let k = 0;
  const due = (): void => { while (k < az.length && az[k]![0] <= s.tick && !s.done) dungeon.act(s, az[k++]![1]); };
  for (const r of p) {
    const f = frameOfRiga(r);
    for (let i = 0; i < r[0] && !s.done; i++) { due(); if (!s.done) dungeon.step(s, f); }
    if (s.done) break;
  }
  due();
  return dungeon.result(s);
}

/** Insieme (#118): il log della squadra, un input log e una lista di azioni per eroe. Il server (DO Spedizioni) registra un input per tutti
 *  a ogni turno, quindi i log hanno la stessa lunghezza; chi se n'è andato ha l'azione `ritira`. */
export type PartyLog = { inputs: PackedDungeon[]; azioni: DungeonAzioni[] };

/** Rigioca una spedizione insieme: un RunResult per eroe (nell'ordine di `eroi`). A ogni tick prima le azioni (eroe per eroe, in ordine),
 *  poi il passo di tutti; le azioni oltre l'ultimo input si applicano a fine log. Con un eroe solo è replayDungeon. */
export function replayParty(seed: number, dungeonId: string, eroi: readonly EroeDef[], log: PartyLog): RunResult[] {
  const n = eroi.length;
  if (n < 1 || log.inputs.length !== n || log.azioni.length !== n) throw new Error('Log della squadra incompleto');
  let T = 0;
  for (const p of log.inputs) {
    let t = 0;
    for (const r of p) t += r[0];
    if (t > dungeon.maxTicks) throw new Error('Input log troppo lungo');
    T = Math.max(T, t);
  }
  const s = createPartyRun({ seed, dungeon: dungeonId, eroi });
  const cur = log.inputs.map(() => ({ r: 0, left: 0, f: NO_DUNGEON_INPUT }));
  const k = log.azioni.map(() => 0);
  const due = (): void => {
    for (let i = 0; i < n; i++) {
      const az = log.azioni[i]!;
      while (k[i]! < az.length && az[k[i]!]![0] <= s.tick) actParty(s, i, az[k[i]!++]![1]);
    }
  };
  const frames: DungeonInput[] = new Array<DungeonInput>(n);
  for (let t = 0; t < T && !finita(s); t++) {
    due();
    if (finita(s)) break;
    for (let i = 0; i < n; i++) {
      const c = cur[i]!;
      if (c.left === 0) { const row = log.inputs[i]![c.r++]; c.f = row ? frameOfRiga(row) : NO_DUNGEON_INPUT; c.left = row ? row[0] : Infinity; }
      c.left--;
      frames[i] = c.f;
    }
    stepParty(s, frames);
  }
  due();
  return s.eroi.map((_, i) => conEroe(s, i, () => dungeon.result(s)));
}

// ---------- formato compatto per la rete: binario in base64 (codec scritto qui: niente btoa/atob, gira in Node, Worker e browser) ----------
// Byte 0 = versione del formato (1, o 2 se qualche riga ha la mira del mouse). Poi per riga 2 byte: bit 0-4 mx8+8, bit 5-9 my8+8, bit 10-13
// bottoni, bit 14-15 = ticks−1 se ticks ≤ 3, altrimenti 3 e segue un varint (7 bit per byte, il bit alto = continua) con ticks−4. Nel formato
// 2 ogni riga ha in più un byte di mira (0 = nessuna, 1..AIM_N) subito dopo i 2 byte, prima del varint. Chi non usa il mouse scrive il formato 1.
const FORMATO = 1, FORMATO_MIRA = 2;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INV = ((): Int16Array => { const t = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i; return t; })();

function toBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < b.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < b.length ? B64[n & 63]! : '=');
  }
  return out;
}
function fromBase64(s: string): Uint8Array | null {
  if (s.length % 4 !== 0) return null;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const c = s.charCodeAt(i + k), last = i + 4 === s.length;
      let v: number;
      if (c === 61 && last && k >= 4 - pad) v = 0; // '=' solo in coda
      else { v = c < 128 ? B64_INV[c]! : -1; if (v < 0) return null; }
      n = (n << 6) | v;
    }
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** Input log → stringa compatta (≈ 2 byte per riga RLE, 3 se c'è la mira). */
export function encodeDungeon(p: PackedDungeon): string {
  const conMira = p.some((r) => (r[4] ?? 0) > 0);
  const bytes: number[] = [conMira ? FORMATO_MIRA : FORMATO];
  for (const [n, mx, my, b, m] of p) {
    const t = n <= 3 ? n - 1 : 3;
    const w = (mx + 8) | ((my + 8) << 5) | ((b & 15) << 10) | (t << 14);
    bytes.push(w & 255, (w >> 8) & 255);
    if (conMira) bytes.push(m ?? 0);
    if (t === 3) { let v = n - 4; while (v >= 128) { bytes.push((v & 127) | 128); v = Math.floor(v / 128); } bytes.push(v); }
  }
  return toBase64(Uint8Array.from(bytes));
}

/** Stringa → input log; null se è rotta, se i valori sono fuori scala o se supera `maxTicks` tick. */
export function decodeDungeon(s: string, maxTicks: number): PackedDungeon | null {
  if (typeof s !== 'string') return null;
  const b = fromBase64(s);
  if (!b || b.length < 1 || (b[0] !== FORMATO && b[0] !== FORMATO_MIRA)) return null;
  const conMira = b[0] === FORMATO_MIRA;
  const out: PackedDungeon = [];
  let i = 1, ticks = 0;
  while (i < b.length) {
    if (i + (conMira ? 2 : 1) >= b.length) return null;
    const w = b[i]! | (b[i + 1]! << 8);
    i += 2;
    const mx = (w & 31) - 8, my = ((w >> 5) & 31) - 8, bt = (w >> 10) & 15, t = (w >> 14) & 3;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) return null;
    const m = conMira ? b[i++]! : 0;
    if (m > AIM_N) return null;
    let n = t + 1;
    if (t === 3) {
      let v = 0, mul = 1, k = 0;
      for (;;) {
        if (i >= b.length || k++ > 4) return null;
        const c = b[i++]!;
        v += (c & 127) * mul; mul *= 128;
        if (c < 128) break;
      }
      n = v + 4;
    }
    ticks += n;
    if (ticks > maxTicks) return null;
    out.push(m ? [n, mx, my, bt, m] : [n, mx, my, bt]);
  }
  return out;
}
