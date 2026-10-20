// Il giorno del calendario italiano (cambia a mezzanotte di Roma): lo usano il banco del contrabbandiere (rpg/contrabbando.ts) e la vetrina
// del negozio dei mobili (economy/vetrina.ts). Puro: il tempo arriva sempre da fuori (ms del server), mai un orologio qui.
const HOUR = 3_600_000, DAY = 24 * HOUR;

/** Ore avanti rispetto a UTC a Roma: 2 dall'ultima domenica di marzo all'ultima di ottobre (all'1:00 UTC), se no 1. */
export function oreRoma(ms: number): number {
  const y = new Date(ms).getUTCFullYear();
  const ultimaDomenica = (m: number): number => { const fine = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, fine.getUTCDate() - fine.getUTCDay(), 1); };
  return ms >= ultimaDomenica(2) && ms < ultimaDomenica(9) ? 2 : 1;
}
/** Giorno del calendario italiano (cambia a mezzanotte di Roma). */
export const giornoRoma = (ms: number): number => Math.floor((ms + oreRoma(ms) * HOUR) / DAY);
/** Millisecondi alla prossima mezzanotte di Roma (merce nuova). */
export const finoAMezzanotte = (ms: number): number => (giornoRoma(ms) + 1) * DAY - oreRoma(ms) * HOUR - ms;

/** Frazione del ciclo giorno/notte [0, 1) per l'istante `ms`: sincronizzata all'ora reale di Roma (#487).
 *  0 = ore 06:00 (inizio giorno), 0.25 = ore 12:00 (mezzogiorno), 0.58 = ore 20:00 (tramonto), 0.75 = ore 00:00 (notte), 0.96 = ore 05:00 (alba). */
export function faseRoma(ms: number): number {
  const msRoma = (ms + oreRoma(ms) * HOUR) % DAY;
  const msDalle6 = msRoma - 6 * HOUR;
  return ((msDalle6 % DAY + DAY) % DAY) / DAY;
}
