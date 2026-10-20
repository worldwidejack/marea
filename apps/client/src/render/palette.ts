// La palette di MAREA (docs/ART_BIBLE.md §2): 24 colori + 6 neon, più i 6 toni di pelle degli avatar. L'unica copia: la usano il mondo
// (render/island_parts.ts), l'interfaccia (ui/style.ts) e il controllo dei pixel dei test (tests/lib/palette.mjs). Se cambia l'art bible, cambia qui.
export const PALETTE = {
  sabbiaChiara: '#F4E3C1', sabbia: '#E2B97F', legnoChiaro: '#C98A4B', legno: '#8E5A2B', legnoScuro: '#5A3A1E', ombraCalda: '#2E1E14',
  erbaChiara: '#D9E872', erba: '#8FC35B', erbaScura: '#4E9A46', bosco: '#2C6B3F', boscoOmbra: '#1E4A3A',
  pietraChiara: '#E8E1D6', pietra: '#B9AFA3', pietraScura: '#7F7568', roccia: '#4A4340', neroCaldo: '#23201F',
  rosso: '#E8433F', arancio: '#F2A33A', giallo: '#F5D547',
  rosaNeon: '#FF3DA6', cianoNeon: '#3DF5FF', ambraNeon: '#FFB03D', violaNeon: '#8A5CFF',
  acquaBassa: '#7FE3E0', acqua: '#3FB9C9', acquaProfonda: '#2478A8', abisso: '#163F73', viola: '#A64DFF', verdeNeon: '#B6FF3D', rossoNeon: '#FF5C3D',
} as const;
export const PELLE = ['#FBE2C8', '#EFC29B', '#D9A070', '#B8784C', '#8C5636', '#5A3A28'] as const;
