// Input log del dungeon (RLE, mx/my a 1/8) e replay deterministico per il server.
import type { RunHero, RunResult } from '../rpg/types.ts';
import type { DungeonInput, PackedDungeon } from './types.ts';
import { dungeon } from './dungeon.ts';

/** In ottavi, senza −0 (così log e roundtrip sono identici anche con deepStrictEqual). */
const q8 = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 8) || 0;
const bits = (f: DungeonInput): number => (f.a ? 1 : 0) | (f.b ? 2 : 0) | (f.c ? 4 : 0) | (f.d ? 8 : 0);

/** Quantizza come farà il replay: il client DEVE giocare con questo, così l'esito coincide. */
export function quantizeDungeon(f: DungeonInput): DungeonInput {
  return { mx: q8(f.mx) / 8, my: q8(f.my) / 8, a: !!f.a, b: !!f.b, c: !!f.c, d: !!f.d };
}

export function packDungeon(frames: readonly DungeonInput[]): PackedDungeon {
  const out: PackedDungeon = [];
  for (const f of frames) {
    const row: [number, number, number, number] = [1, q8(f.mx), q8(f.my), bits(f)];
    const last = out[out.length - 1];
    if (last && last[1] === row[1] && last[2] === row[2] && last[3] === row[3]) last[0]++;
    else out.push(row);
  }
  return out;
}

export function unpackDungeon(p: PackedDungeon): DungeonInput[] {
  const out: DungeonInput[] = [];
  for (const [n, mx, my, b] of p) {
    const f: DungeonInput = { mx: mx / 8, my: my / 8, a: (b & 1) !== 0, b: (b & 2) !== 0, c: (b & 4) !== 0, d: (b & 8) !== 0 };
    for (let i = 0; i < n; i++) out.push(f);
  }
  return out;
}

/** Controllo di forma per un log dalla rete: righe [ticks ≥ 1, mx8, my8 ∈ [−8, 8], bit ∈ 0..15], al massimo `maxTicks` tick in tutto. */
export function isPackedDungeon(v: unknown, maxTicks: number): v is PackedDungeon {
  if (!Array.isArray(v) || v.length > maxTicks) return false;
  let ticks = 0;
  for (const r of v) {
    if (!Array.isArray(r) || r.length !== 4 || !r.every((n) => Number.isInteger(n))) return false;
    const [n, mx, my, b] = r as number[];
    if (n! < 1 || Math.abs(mx!) > 8 || Math.abs(my!) > 8 || b! < 0 || b! > 15) return false;
    ticks += n!;
    if (ticks > maxTicks) return false;
  }
  return true;
}

/** Rigioca una spedizione: stesso seed, stesso eroe, stessi input → stesso RunResult (e hash) del client. */
export function replayDungeon(seed: number, dungeonId: string, hero: RunHero, p: PackedDungeon): RunResult {
  let ticks = 0;
  for (const r of p) ticks += r[0];
  if (ticks > dungeon.maxTicks) throw new Error('Input log troppo lungo');
  const s = dungeon.create({ seed, dungeon: dungeonId, hero });
  for (const [n, mx, my, b] of p) {
    const f: DungeonInput = { mx: mx / 8, my: my / 8, a: (b & 1) !== 0, b: (b & 2) !== 0, c: (b & 4) !== 0, d: (b & 8) !== 0 };
    for (let i = 0; i < n && !s.done; i++) dungeon.step(s, f);
    if (s.done) break;
  }
  return dungeon.result(s);
}

// ---------- formato compatto per la rete: binario in base64 (codec scritto qui: niente btoa/atob, gira in Node, Worker e browser) ----------
// Byte 0 = versione del formato (1). Poi per riga 2 byte: bit 0-4 mx8+8, bit 5-9 my8+8, bit 10-13 bottoni, bit 14-15 = ticks−1 se ticks ≤ 3,
// altrimenti 3 e segue un varint (7 bit per byte, il bit alto = continua) con ticks−4.
const FORMATO = 1;
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

/** Input log → stringa compatta (≈ 2 byte per riga RLE). */
export function encodeDungeon(p: PackedDungeon): string {
  const bytes: number[] = [FORMATO];
  for (const [n, mx, my, b] of p) {
    const t = n <= 3 ? n - 1 : 3;
    const w = (mx + 8) | ((my + 8) << 5) | ((b & 15) << 10) | (t << 14);
    bytes.push(w & 255, (w >> 8) & 255);
    if (t === 3) { let v = n - 4; while (v >= 128) { bytes.push((v & 127) | 128); v = Math.floor(v / 128); } bytes.push(v); }
  }
  return toBase64(Uint8Array.from(bytes));
}

/** Stringa → input log; null se è rotta, se i valori sono fuori scala o se supera `maxTicks` tick. */
export function decodeDungeon(s: string, maxTicks: number): PackedDungeon | null {
  if (typeof s !== 'string') return null;
  const b = fromBase64(s);
  if (!b || b.length < 1 || b[0] !== FORMATO) return null;
  const out: PackedDungeon = [];
  let i = 1, ticks = 0;
  while (i < b.length) {
    if (i + 1 >= b.length) return null;
    const w = b[i]! | (b[i + 1]! << 8);
    i += 2;
    const mx = (w & 31) - 8, my = ((w >> 5) & 31) - 8, bt = (w >> 10) & 15, t = (w >> 14) & 3;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) return null;
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
    out.push([n, mx, my, bt]);
  }
  return out;
}
