// La Fuga dalla lava (corsa senza fine, docs/LAVA.md) entra nel registro solo dove si importa questo file (il server e i test): il registro
// `minigames/registry.ts` finisce nel client iniziale, mentre la sim della lava viaggia con la sua schermata (ui/lava.ts, chunk scaricato alla prima partita).
import { MINIGAMES } from './registry.ts';
import type { MinigameModule } from './types.ts';
import { lava } from './lava.ts';

MINIGAMES['lava'] = lava as unknown as MinigameModule<unknown>;
