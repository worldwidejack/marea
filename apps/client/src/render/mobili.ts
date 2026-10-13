// Mobili della casa (#265, mobili.json): forme procedurali in stile Animal Crossing, grosse e leggibili dalla camera alta di casa.
// Solo colori della palette (ART_BIBLE §2: i `colori` della riga, più legno/pietra/nero della palette), facce piatte, pochi triangoli.
// Convenzione: pivot a terra al centro della cella, davanti verso +Z (verso la camera, che in casa guarda da sud). Quelli a parete hanno
// il retro a z = 0 (appoggiato al muro) e sporgono verso +Z. Il baule è il Forziere (edificio): più ricco a ogni livello.
import * as THREE from 'three';
import { M, P, merged, painted } from './island_parts.ts';

type G = THREE.BufferGeometry;
/** Fonde le forme dei mobili di una stanza in una geometria sola (un draw call). */
export const unisci = (g: G[]): G => merged(g);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);

/** Geometria di un mobile per `forma` (mobili.json); forma sconosciuta = una cassa di legno (si vede che manca). */
export function mobileGeo(forma: string, colori: readonly string[]): G {
  const [a = P.legno, b = P.legnoScuro, c = P.giallo] = colori, g: G[] = [];
  switch (forma) {
    case 'comodino_lampada': {
      // comodino a due cassetti con la lampada sopra (paralume giallo)
      g.push(painted(box(1.0, 0.8, 0.75), a, M(0, 0.42, 0)), painted(box(1.06, 0.08, 0.8), b, M(0, 0.84, 0)));
      for (const y of [0.25, 0.56]) g.push(painted(box(0.84, 0.24, 0.04), b, M(0, y, 0.38)), painted(box(0.18, 0.06, 0.06), c, M(0, y, 0.41)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.push(painted(box(0.1, 0.06, 0.1), b, M(sx * 0.42, 0.03, sz * 0.3)));
      g.push(painted(cyl(0.16, 0.2, 0.08, 6), b, M(0.15, 0.92, -0.05)), painted(cyl(0.035, 0.035, 0.42, 5), P.neroCaldo, M(0.15, 1.15, -0.05)));
      g.push(painted(cyl(0.16, 0.3, 0.32, 6), c, M(0.15, 1.42, -0.05)));
      break;
    }
    case 'stereo': {
      // stereo portatile: corpo colorato, due casse tonde, la manopola, il manico e l'antenna
      g.push(painted(box(1.4, 0.78, 0.5), a, M(0, 0.45, 0)), painted(box(1.44, 0.08, 0.54), b, M(0, 0.05, 0)));
      for (const sx of [-1, 1]) {
        g.push(painted(cyl(0.27, 0.27, 0.06, 10), b, M(sx * 0.4, 0.42, 0.26, Math.PI / 2, 0, 0)));
        g.push(painted(cyl(0.1, 0.1, 0.08, 8), c, M(sx * 0.4, 0.42, 0.28, Math.PI / 2, 0, 0)));
      }
      g.push(painted(box(0.36, 0.16, 0.06), c, M(0, 0.7, 0.26)), painted(box(0.24, 0.1, 0.05), b, M(0, 0.7, 0.29)));
      for (const sx of [-1, 1]) g.push(painted(box(0.08, 0.3, 0.08), b, M(sx * 0.45, 0.98, 0)));
      g.push(painted(box(1.0, 0.08, 0.1), b, M(0, 1.12, 0)), painted(box(0.03, 0.6, 0.03), P.pietra, M(0.6, 1.1, -0.15, 0, 0, -0.35)));
      break;
    }
    case 'orologio': {
      // orologio tondo da parete: cornice, quadrante, lancette e il pendolino sotto
      g.push(painted(cyl(0.48, 0.48, 0.12, 12), a, M(0, 2.1, 0.06, Math.PI / 2, 0, 0)));
      g.push(painted(cyl(0.38, 0.38, 0.04, 12), b, M(0, 2.1, 0.13, Math.PI / 2, 0, 0)));
      for (let i = 0; i < 4; i++) { const t = (i * Math.PI) / 2; g.push(painted(box(0.06, 0.06, 0.03), c, M(Math.sin(t) * 0.3, 2.1 + Math.cos(t) * 0.3, 0.16))); }
      g.push(painted(box(0.04, 0.26, 0.03), c, M(0, 2.21, 0.17)), painted(box(0.2, 0.04, 0.03), c, M(0.09, 2.1, 0.18)));
      g.push(painted(box(0.05, 0.4, 0.04), a, M(0, 1.5, 0.05)), painted(cyl(0.11, 0.11, 0.05, 8), c, M(0, 1.28, 0.07, Math.PI / 2, 0, 0)));
      break;
    }
    default: g.push(painted(box(1.0, 0.8, 0.8), P.legno, M(0, 0.4, 0)), painted(box(1.04, 0.1, 0.84), P.legnoScuro, M(0, 0.4, 0)));
  }
  // quelli a terra un po' più grossi della realtà (una cella è 2 m, la camera di casa è alta): si leggono come in Animal Crossing
  return forma === 'orologio' ? merged(g) : merged(g).scale(1.4, 1.4, 1.4);
}

/** Il baule (il Forziere, #265) in casa: legno con le fasce di ferro; dal livello 2 gli angoli di ferro, al 3 le fasce d'oro. */
export function bauleGeo(livello: number): G {
  const fascia = livello >= 3 ? P.giallo : P.pietraScura, g: G[] = [];
  g.push(painted(box(1.4, 0.6, 0.85), P.legno, M(0, 0.32, 0)));
  g.push(painted(box(1.44, 0.26, 0.9), P.legnoChiaro, M(0, 0.75, 0)), painted(box(1.3, 0.12, 0.76), P.legnoChiaro, M(0, 0.93, 0)));
  for (const x of [-0.45, 0.45]) g.push(painted(box(0.12, 1.0, 0.94), fascia, M(x, 0.5, 0)));
  g.push(painted(box(0.24, 0.24, 0.06), P.giallo, M(0, 0.6, 0.45)), painted(box(0.08, 0.1, 0.04), P.neroCaldo, M(0, 0.56, 0.48)));
  if (livello >= 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.push(painted(box(0.14, 0.14, 0.14), P.pietraScura, M(sx * 0.66, 0.08, sz * 0.4)));
  return merged(g).scale(1.25, 1.25, 1.25);
}
