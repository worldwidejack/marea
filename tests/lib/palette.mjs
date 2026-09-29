// Palette di MAREA (docs/ART_BIBLE.md §2): 24 colori + 6 neon + 6 toni di pelle. Copia fedele: se cambia l'art bible, cambia qui.
export const PALETTE = {
  sabbiaChiara: '#F4E3C1', sabbia: '#E2B97F', legnoChiaro: '#C98A4B', legno: '#8E5A2B', legnoScuro: '#5A3A1E', ombraCalda: '#2E1E14',
  erbaChiara: '#D9E872', erba: '#8FC35B', erbaScura: '#4E9A46', bosco: '#2C6B3F', boscoOmbra: '#1E4A3A',
  acquaBassa: '#7FE3E0', acqua: '#3FB9C9', acquaProfonda: '#2478A8', abisso: '#163F73',
  pietraChiara: '#E8E1D6', pietra: '#B9AFA3', pietraScura: '#7F7568', roccia: '#4A4340', neroCaldo: '#23201F',
  rossoLanterna: '#E8433F', arancio: '#F2A33A', giallo: '#F5D547', viola: '#A64DFF',
  rosaNeon: '#FF3DA6', cianoNeon: '#3DF5FF', verdeNeon: '#B6FF3D', ambraNeon: '#FFB03D', violaNeon: '#8A5CFF', rossoNeon: '#FF5C3D',
};
export const SKIN = ['#FBE2C8', '#EFC29B', '#D9A070', '#B8784C', '#8C5636', '#5A3A28'];
/** Tutti gli hex ammessi (30 + 6). */
export const ALL_HEX = [...Object.values(PALETTE), ...SKIN];
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
