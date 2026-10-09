import type { MinigameModule } from './types.ts';
import { regata } from './regata/regata.ts';
import { pesca } from './pesca.ts';
import { consegne } from './consegne/consegne.ts'; // Consegne
import { ingorgo } from './ingorgo.ts'; // Ingorgo
import { perle } from './perle.ts'; // Perle
import { pinguini } from './pinguini.ts'; // Ghiacci
import { koi } from './koi.ts'; // Giardino
import { arrembaggio } from './arrembaggio.ts'; // Tempesta
import { lava } from './lava.ts'; // Vulcano
import { corse } from './corse.ts'; // Isola delle Corse

export const MINIGAMES: Record<string, MinigameModule<unknown>> = {
  regata: regata as unknown as MinigameModule<unknown>,
  pesca: pesca as unknown as MinigameModule<unknown>, // #66, minigioco universale (dalla barca, ovunque in mare aperto)
  consegne: consegne as unknown as MinigameModule<unknown>, // Consegne
  ingorgo: ingorgo as unknown as MinigameModule<unknown>, // Ingorgo
  perle: perle as unknown as MinigameModule<unknown>, // minigioco universale (dalla barca ferma su acqua bassa)
  pinguini: pinguini as unknown as MinigameModule<unknown>, // Ghiacci: solo sull'isola, quando è aperta
  koi: koi as unknown as MinigameModule<unknown>, // Giardino: solo sull'isola, quando è aperta
  arrembaggio: arrembaggio as unknown as MinigameModule<unknown>, // Tempesta: sul promontorio del faro, solo a isola aperta
  lava: lava as unknown as MinigameModule<unknown>, // Vulcano: vicino al cratere, solo a isola aperta
  corse: corse as unknown as MinigameModule<unknown>, // Isola delle Corse: Gran Premio, alla linea di partenza
};
export function getMinigame(id: string): MinigameModule<unknown> {
  const m = MINIGAMES[id];
  if (!m) throw new Error(`Minigioco sconosciuto: ${id}`);
  return m;
}
