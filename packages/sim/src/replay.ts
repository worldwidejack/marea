// Input log compresso (run-length) e replay deterministico: è ciò che il server usa per verificare un punteggio.
import { getMinigame } from './minigames/registry.ts';
import type { Difficulty, MinigameResult } from './minigames/types.ts';
import type { InputFrame } from './types.ts';

/** [[ticks, mx, my, a, b], ...] con mx, my quantizzati a 1/32 e a, b come 0/1. */
export type PackedInputs = [number, number, number, number, number][];

const q = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 32);

export function packInputs(frames: readonly InputFrame[]): PackedInputs {
  const out: PackedInputs = [];
  for (const f of frames) {
    const row: [number, number, number, number, number] = [1, q(f.mx), q(f.my), f.a ? 1 : 0, f.b ? 1 : 0];
    const last = out[out.length - 1];
    if (last && last[1] === row[1] && last[2] === row[2] && last[3] === row[3] && last[4] === row[4]) last[0]++;
    else out.push(row);
  }
  return out;
}

export function unpackInputs(p: PackedInputs): InputFrame[] {
  const out: InputFrame[] = [];
  for (const [n, mx, my, a, b] of p) for (let i = 0; i < n; i++) out.push({ mx: mx / 32, my: my / 32, a: a === 1, b: b === 1 });
  return out;
}

/** Quantizza come farà il replay: il client DEVE usare questo per giocare, così il punteggio coincide. */
export function quantize(f: InputFrame): InputFrame {
  return { mx: q(f.mx) / 32, my: q(f.my) / 32, a: f.a, b: f.b };
}

export function replay(id: string, seed: number, difficulty: Difficulty, packed: PackedInputs): MinigameResult {
  const m = getMinigame(id);
  const s = m.create({ seed, difficulty });
  const frames = unpackInputs(packed);
  if (frames.length > m.maxTicks) throw new Error('Input log troppo lungo');
  for (const f of frames) m.step(s, f);
  return m.result(s);
}
