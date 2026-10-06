// Input log del dungeon (RLE, mx/my a 1/8) e replay deterministico per il server.
import type { RunHero, RunResult } from '../rpg/types.ts';
import type { DungeonInput, PackedDungeon } from './types.ts';
import { dungeon } from './dungeon.ts';

const q8 = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 8);
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
