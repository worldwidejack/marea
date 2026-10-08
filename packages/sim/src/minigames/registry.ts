import type { MinigameModule } from './types.ts';
import { regata } from './regata/regata.ts';
import { pesca } from './pesca.ts';

export const MINIGAMES: Record<string, MinigameModule<unknown>> = {
  regata: regata as unknown as MinigameModule<unknown>,
  pesca: pesca as unknown as MinigameModule<unknown>, // #66, minigioco universale (dalla barca, ovunque in mare aperto)
};
export function getMinigame(id: string): MinigameModule<unknown> {
  const m = MINIGAMES[id];
  if (!m) throw new Error(`Minigioco sconosciuto: ${id}`);
  return m;
}
