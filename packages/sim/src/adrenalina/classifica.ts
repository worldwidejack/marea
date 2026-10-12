// La classifica a tempo delle discese dell'Isola dell'Adrenalina (birbasan, 12 ott 2026, passo 3b): per ogni pista il miglior tempo finale
// di ciascuno (con abbuoni e penalità, `tempiSnowboard`). Scendi contro il fantasma del primo: se lo batti è oro, secondo argento, terzo
// bronzo, più giù niente. Se non c'è ancora nessuno davanti sei primo: oro. Lo usano il DO `Sfide` (che tiene la classifica e gli input del
// fantasma) e il DO del lotto (che paga la medaglia). Puro, niente tempo né caso.
import type { Medal } from '../minigames/types.ts';

export type VoceDiscesa = { chi: string; ms: number };

/** Che posto fai con `ms` (1 = primo): uno più quanti ALTRI hanno un tempo migliore. Il tuo vecchio tempo non conta. */
export function posizioneDiscesa(classifica: readonly VoceDiscesa[], chi: string, ms: number): number {
  let davanti = 0;
  for (const v of classifica) if (v.chi !== chi && v.ms < ms) davanti++;
  return davanti + 1;
}

export function medagliaDaPosizione(pos: number): Medal {
  return pos === 1 ? 'oro' : pos === 2 ? 'argento' : pos === 3 ? 'bronzo' : null;
}

/** Il tempo entra in classifica se è il tuo primo o migliora il tuo. */
export const migliora = (classifica: readonly VoceDiscesa[], chi: string, ms: number): boolean => {
  const mio = classifica.find((v) => v.chi === chi);
  return !mio || ms < mio.ms;
};
