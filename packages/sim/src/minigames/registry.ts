import type { MinigameModule } from './types.ts';
import { regata } from './regata/regata.ts';
import { pesca } from './pesca.ts';
import { consegne } from './consegne/consegne.ts'; // Consegne
import { ingorgo } from './ingorgo.ts'; // Ingorgo

export const MINIGAMES: Record<string, MinigameModule<unknown>> = {
  regata: regata as unknown as MinigameModule<unknown>,
  pesca: pesca as unknown as MinigameModule<unknown>, // #66, minigioco universale (dalla barca, ovunque in mare aperto)
  consegne: consegne as unknown as MinigameModule<unknown>, // Consegne
  ingorgo: ingorgo as unknown as MinigameModule<unknown>, // Ingorgo
};
export function getMinigame(id: string): MinigameModule<unknown> {
  const m = MINIGAMES[id];
  if (!m) throw new Error(`Minigioco sconosciuto: ${id}`);
  return m;
}
