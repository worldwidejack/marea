// Palette di MAREA (docs/ART_BIBLE.md §2): 24 colori + 6 neon + 6 toni di pelle, presa dal gioco (apps/client/src/render/palette.ts).
import { PALETTE, PELLE } from '../../apps/client/src/render/palette.ts';
/** Tutti gli hex ammessi (30 + 6). */
export const ALL_HEX = [...Object.values(PALETTE), ...PELLE];
export const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** [[r,g,b], ...] pronto da passare al browser. */
export const ALL_RGB = ALL_HEX.map(hexToRgb);
/** Distanza euclidea RGB dal colore di palette più vicino. */
export function paletteDistance(r, g, b) {
  let best = Infinity;
  for (const [pr, pg, pb] of ALL_RGB) { const d = Math.hypot(r - pr, g - pg, b - pb); if (d < best) best = d; }
  return best;
}
/** Esadecimale della palette più vicino a un colore (per i messaggi di errore). */
export function nearestHex(r, g, b) {
  let best = Infinity, hex = ''; ALL_RGB.forEach(([pr, pg, pb], i) => { const d = Math.hypot(r - pr, g - pg, b - pb); if (d < best) { best = d; hex = ALL_HEX[i]; } });
  return hex;
}
