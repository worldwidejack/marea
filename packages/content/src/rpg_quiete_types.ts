// Numeri dei nemici che non ti hanno ancora visto (balance.json `dungeon.quiete`, packages/sim/src/dungeon/quiete.ts). Distanze in m, tempi in s.

export type QuieteBalance = {
  /** Cono visivo: davanti (coseno ≥ `fronte`) vede col raggio pieno, di lato (coseno ≥ `lato`) a `vistaLato` del raggio, dietro a `vistaDietro`. */
  cono: { fronte: number; lato: number; vistaLato: number; vistaDietro: number };
  /** Quanto ci mette a notarti (sospetto da 0 a 1) se ti vede: `vicino` addosso, `lontano` al bordo di quello che vede. */
  nota: { vicino: number; lontano: number };
  /** Sospetto da cui va a cercare (il «?»); quanti secondi cerca dopo l'ultima volta che ti ha visto o sentito; da 1 a 0 in `calo` s. */
  cerca: number; indaga: number; calo: number;
  /** Fin dove si sente l'eroe che cammina, corre o colpisce (anche l'arco e le magie), e una lotta (un nemico o un'evocazione che colpisce o è colpito). */
  rumore: { cammina: number; corsa: number; colpo: number; lotta: number };
  /** Udito: sospetto al secondo per un rumore addosso (cala col bordo), mai oltre `tettoUdito` (per attaccare deve vederti); chi dorme
   *  sente a `dorme` della distanza, dietro un muro a `muro`. */
  orecchio: number; tettoUdito: number; dorme: number; muro: number;
  /** Ronda: chi la fa (frazione), fin dove e da quanto lontano stanno i punti, passo (frazione della velocità) in ronda e a cercare, sosta
   *  in ogni punto [min, max] s, ogni quanto [min, max] s cambia direzione chi si guarda intorno, giro (rad/s), fin dove si allontana da casa cercando. */
  ronda: number; raggioRonda: number; minRonda: number; passoRonda: number; passoCerca: number;
  sosta: readonly [number, number]; guarda: readonly [number, number]; gira: number; guinzaglio: number;
};
