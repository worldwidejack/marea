// Cosa sa un personaggio 2.5D (sprite/) di quello che sta facendo con gli attrezzi del Borgo, e cosa dice di sé a chi li disegna.
/** `k`: a che punto è la mossa dell'attrezzo (0..1); null = tenuto e basta. */
export type InMano = { attrezzo: 'retino' | 'canna' | 'pala'; k: number | null };
/** `punta`: la punta della canna disegnata, nel mondo (da lì parte la lenza). */
export type VestitoSprite = { punta: { x: number; y: number; z: number } | null };
