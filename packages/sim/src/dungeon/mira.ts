// Mira col mouse (dungeon v6): la direzione in cui l'eroe tira l'arco o lancia una magia viaggia nell'input come un indice d'angolo,
// AIM_N passi su 360° (1,5° l'uno: a 10 m sbaglia al più 13 cm). 0 o assente = nessuna mira (telefono, mischia): vale la mira assistita.
// La tabella dei versori è fatta con trig.ts (stessi bit su ogni motore); a scegliere l'indice è il client, la sim lo legge e basta.
import { atan2, cos, sin } from '../trig.ts';

export const AIM_N = 240;
const GIRO = 6.283185307179586;
const TAB: readonly (readonly [number, number])[] = Array.from({ length: AIM_N }, (_, i) => [cos((i * GIRO) / AIM_N), sin((i * GIRO) / AIM_N)] as const);

/** Versore (x, z) dell'indice di mira, null se non c'è mira (0, assente, fuori scala o non intero). */
export function aimDir(m: number | undefined): readonly [number, number] | null {
  return m !== undefined && Number.isInteger(m) && m >= 1 && m <= AIM_N ? TAB[m - 1]! : null;
}

/** Indice di mira (1..AIM_N) per la direzione (dx, dz) in assi mondo; 0 se il vettore è nullo. */
export function aimIndex(dx: number, dz: number): number {
  if (!(dx * dx + dz * dz > 1e-12)) return 0;
  const i = Math.round((atan2(dz, dx) / GIRO) * AIM_N);
  return ((i % AIM_N) + AIM_N) % AIM_N + 1;
}
