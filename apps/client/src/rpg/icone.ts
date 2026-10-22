// Icone a pixel 16×16 delle armi, degli archi, delle frecce e delle magie: ognuna ha il suo disegno, scritto come righe di lettere
// (icone_armi.ts, icone_magie.ts) e trasformato qui in una griglia di colori della palette. Puro: niente DOM, lo disegna items_ui.ts.
// Armi: m/w/s sono il colore del materiale (medio, chiaro, scuro), il resto è fisso. Il contorno nero caldo lo aggiunge questo file.
import { PALETTE as P } from '../render/palette.ts';
import { ARMI } from './icone_armi.ts';
import { MAGIE } from './icone_magie.ts';

export const ICONA = 16;
/** Colori per riga e colonna; null = trasparente. */
export type Sprite = (string | null)[][];

const COLORI: Readonly<Record<string, string>> = {
  b: P.legno, l: P.legnoChiaro, c: P.legnoScuro, a: P.sabbiaChiara, o: P.sabbia,
  e: P.pietraChiara, p: P.pietra, q: P.pietraScura, r: P.roccia, k: P.neroCaldo,
  R: P.rosso, O: P.arancio, Y: P.giallo, V: P.viola, N: P.violaNeon, P: P.rosaNeon,
  G: P.erba, H: P.erbaChiara, I: P.erbaScura, J: P.bosco,
  A: P.acquaBassa, B: P.acqua, C: P.acquaProfonda, D: P.abisso, T: P.cianoNeon,
};
/** Chiaro e scuro di un materiale, dal suo colore base (già riportato alla palette). */
const RAMPE: Readonly<Record<string, readonly [string, string]>> = {
  [P.legnoChiaro]: [P.sabbia, P.legno], [P.arancio]: [P.giallo, P.legnoChiaro], [P.giallo]: [P.sabbiaChiara, P.arancio],
  [P.pietraScura]: [P.pietra, P.roccia], [P.pietraChiara]: [P.sabbiaChiara, P.pietra], [P.acquaBassa]: [P.pietraChiara, P.acqua],
  [P.sabbiaChiara]: [P.sabbiaChiara, P.sabbia], [P.viola]: [P.pietraChiara, P.violaNeon], [P.acqua]: [P.acquaBassa, P.acquaProfonda],
};

/** Righe di lettere → griglia di colori, col contorno nero caldo attorno al pieno. */
function griglia(righe: readonly string[], materiale: string = P.pietraScura): Sprite {
  const [chiaro, scuro] = RAMPE[materiale] ?? [P.sabbiaChiara, P.roccia];
  const col: Record<string, string> = { ...COLORI, m: materiale, w: chiaro, s: scuro };
  const g: Sprite = righe.map((r) => [...r.padEnd(ICONA, '.')].map((ch) => col[ch] ?? null));
  const pieno = (x: number, y: number): boolean => g[y]?.[x] != null;
  const vuoti: [number, number][] = [];
  for (let y = 0; y < ICONA; y++) for (let x = 0; x < ICONA; x++) if (!pieno(x, y) && (pieno(x - 1, y) || pieno(x + 1, y) || pieno(x, y - 1) || pieno(x, y + 1))) vuoti.push([x, y]);
  for (const [x, y] of vuoti) g[y]![x] = P.neroCaldo;
  return g;
}

/** Il disegno di un'arma, di un arco o di frecce (anche gli unici); null se non ne ha uno suo. `materiale` = colore base del materiale. */
export function spriteArma(it: { id: string; kind: string; tipo?: string }, materiale: string): Sprite | null {
  const righe = ARMI[it.id] ?? (it.kind === 'arco' ? ARMI['arco'] : it.kind === 'frecce' ? ARMI['frecce'] : it.tipo ? ARMI[it.tipo] : undefined);
  return righe ? griglia(righe, materiale) : null;
}
/** Il disegno di una magia; null se non ne ha uno suo. */
export function spriteMagia(id: string): Sprite | null {
  const righe = MAGIE[id];
  return righe ? griglia(righe) : null;
}
