import type { MinigameModule } from './types.ts';
import { regata } from './regata/regata.ts';

export const MINIGAMES: Record<string, MinigameModule<unknown>> = { regata: regata as unknown as MinigameModule<unknown> };
export function getMinigame(id: string): MinigameModule<unknown> {
  const m = MINIGAMES[id];
  if (!m) throw new Error(`Minigioco sconosciuto: ${id}`);
  return m;
}
