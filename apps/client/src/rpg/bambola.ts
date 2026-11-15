// La sagoma a pixel del personaggio nello zaino: una figura stilizzata 26×34 (testa grande, tunica, gambe) che cambia con quello che hai
// addosso: il colore dell'armatura sul busto, la spalla di metallo, l'arma in mano, l'alone della magia e un puntino d'oro per ogni anello.
// Solo colori di PAL; si disegna una volta per ridisegno della scheda (pochi rettangoli).
import type { ItemDef } from '@marea/sim/rpg/types.ts';
import { PAL } from '../ui/style.ts';

const BAMBOLA_L = 26;
const BAMBOLA_A = 34;
const OX = 2; // la figura sta al centro: a sinistra l'alone della magia, a destra la lama

export type Addosso = {
  arma: ItemDef | null; corpo: ItemDef | null;
  /** Colore dell'alone se hai una magia in mano. */
  magia: string | null; anelli: number;
  /** Colore dell'arma e del corpo già riportati alla palette. */
  colArma: string; colCorpo: string;
};

type R = readonly [string, number, number, number, number];

export function bambola(a: Addosso): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = BAMBOLA_L; c.height = BAMBOLA_A; c.className = 'zn-bambola'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (!g) return c;
  const nero = PAL.neroCaldo, pelle = PAL.sabbiaChiara, capelli = PAL.legnoScuro;
  const veste = a.corpo ? a.colCorpo : PAL.acquaBassa;
  const metallo = a.corpo?.kind === 'armatura';
  const rects: R[] = [
    // contorni
    [nero, 4, 0, 12, 11], [nero, 4, 11, 12, 12], [nero, 1, 12, 4, 11], [nero, 15, 12, 4, 11], [nero, 5, 22, 5, 12], [nero, 10, 22, 5, 12],
    // testa e capelli
    [capelli, 5, 1, 10, 4], [capelli, 5, 4, 1, 2], [capelli, 14, 4, 1, 2], [pelle, 5, 5, 10, 5], [PAL.sabbia, 5, 9, 10, 1],
    [nero, 7, 6, 1, 2], [nero, 12, 6, 1, 2], [PAL.rosso, 9, 8, 2, 1],
    // busto e cintura
    [veste, 5, 12, 10, 10], [metallo ? PAL.pietraChiara : PAL.sabbiaChiara, 6, 13, 2, 5], [PAL.legnoScuro, 5, 19, 10, 1],
    // braccia e mani
    [veste, 2, 13, 2, 8], [veste, 16, 13, 2, 8], [pelle, 2, 21, 2, 2], [pelle, 16, 21, 2, 2],
    // gambe e stivali
    [PAL.pietraScura, 6, 23, 3, 8], [PAL.pietraScura, 11, 23, 3, 8], [PAL.legnoScuro, 6, 31, 3, 2], [PAL.legnoScuro, 11, 31, 3, 2],
  ];
  if (metallo) rects.push([PAL.pietra, 4, 11, 3, 2], [PAL.pietra, 13, 11, 3, 2]); // spalline
  if (a.arma) {
    const arco = a.arma.kind === 'arco';
    if (arco) rects.push([a.colArma, 20, 9, 1, 14], [PAL.legno, 19, 11, 1, 10], [a.colArma, 19, 9, 1, 1], [a.colArma, 19, 22, 1, 1]);
    else rects.push([nero, 19, 6, 3, 15], [a.colArma, 20, 7, 1, 12], [PAL.sabbiaChiara, 20, 7, 1, 3], [PAL.legno, 18, 19, 5, 1], [PAL.legnoScuro, 20, 20, 1, 2]);
  }
  if (a.magia) rects.push([nero, -2, 17, 4, 4], [a.magia, -1, 18, 2, 2], [PAL.sabbiaChiara, -1, 18, 1, 1]);
  if (a.anelli > 0) rects.push([PAL.giallo, 2, 22, 1, 1]);
  if (a.anelli > 1) rects.push([PAL.giallo, 17, 22, 1, 1]);
  for (const [col, x, y, w, h] of rects) { g.fillStyle = col; g.fillRect(x + OX, y, w, h); }
  return c;
}
