import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';

export type Medal = 'oro' | 'argento' | 'bronzo' | null;
export type MinigameResult = { done: boolean; score: number; medal: Medal; detail: Record<string, number> };
export type Difficulty = 1 | 2 | 3;
/** Parametri della partita oltre al seed (es. il mare della pesca): stringhe, scelti dal client, normalizzati dal modulo sul server. */
export type MinigameOpzioni = Record<string, string>;
export type MinigameModule<S> = {
  id: string;
  version: number;
  maxTicks: number;
  create(o: { seed: number; difficulty: Difficulty; opzioni?: MinigameOpzioni }): S;
  /** Facoltativo: normalizza le opzioni che arrivano dalla rete (valori sconosciuti → quelli di serie). Senza, le opzioni si ignorano. */
  opzioni?(v: unknown): MinigameOpzioni;
  step(s: S, input: InputFrame): void;
  result(s: S): MinigameResult;
  autopilot(s: S, rng: Rng): InputFrame;
  view(s: S): unknown;
};
