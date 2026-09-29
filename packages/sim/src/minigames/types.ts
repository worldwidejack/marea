import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';

export type Medal = 'oro' | 'argento' | 'bronzo' | null;
export type MinigameResult = { done: boolean; score: number; medal: Medal; detail: Record<string, number> };
export type Difficulty = 1 | 2 | 3;
export type MinigameModule<S> = {
  id: string;
  version: number;
  maxTicks: number;
  create(o: { seed: number; difficulty: Difficulty }): S;
  step(s: S, input: InputFrame): void;
  result(s: S): MinigameResult;
  autopilot(s: S, rng: Rng): InputFrame;
  view(s: S): unknown;
};
