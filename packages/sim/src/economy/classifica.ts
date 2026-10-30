// La classifica dei minigiochi a punti tra amici (Fuga dalla lava, docs/LAVA.md): per ogni minigioco il miglior punteggio di ciascuno, oggi
// (giorno UTC) e di sempre. Il punteggio lo scrive solo il server, dopo aver rigiocato la partita; lo stato sta nel DO `Sfide` (punteggiStore.ts).
// Puro: nessun orologio, nessun database. Più punti prima; a pari punti chi c'era prima. Non esportato da @marea/sim (index.ts): si importa per percorso.

/** I minigiochi che hanno una classifica. */
export const CON_CLASSIFICA: readonly string[] = ['lava'];
/** Quante righe si mostrano (più la tua, se sei più giù). */
export const RIGHE_CLASSIFICA = 8;

export type VocePunteggio = { chi: string; score: number; quando: number; detail: Record<string, number> };

/** Dal migliore al peggiore; a pari punteggio chi è arrivato prima, poi per nome (così l'ordine è sempre lo stesso). */
export const ordina = (v: readonly VocePunteggio[]): VocePunteggio[] => [...v].sort((a, b) => b.score - a.score || a.quando - b.quando || a.chi.localeCompare(b.chi));

/** Il posto di `chi` nella classifica già ordinata (1 = primo), 0 = non c'è. */
export function posto(righe: readonly VocePunteggio[], chi: string): number {
  const i = righe.findIndex((v) => v.chi === chi);
  return i < 0 ? 0 : i + 1;
}

/** Il punteggio entra se è il primo di `chi` o migliora il suo. */
export function migliora(righe: readonly VocePunteggio[], chi: string, score: number): boolean {
  const mio = righe.find((v) => v.chi === chi);
  return !mio || score > mio.score;
}

/** Le righe da mostrare: le prime `RIGHE_CLASSIFICA` e, se `chi` è più giù, anche la sua. */
export function vetrina(righe: readonly VocePunteggio[], chi: string): VocePunteggio[] {
  const top = righe.slice(0, RIGHE_CLASSIFICA), mio = righe.find((v) => v.chi === chi);
  return mio && !top.includes(mio) ? [...top, mio] : top;
}
