// Kit in codice per le mappe dell'Arena (docs/ARENA.md): l'erba alta (celle `erba`: una macchia di terra scura e ciuffi di fili appuntiti, in tre
// verdi di palette) e le colonne e i muretti delle mappe nuove, il giardino (basamenti con cespuglio, staccionate) e le rovine (colonne spezzate,
// muri a pezzi). Finché non ci sono i modelli dng_<stile>_*. Solo box e colori della palette, flat shading: la forma sta tutta nei blocchi.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../ui/style.ts';
import { boxPart, flat } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';

/** Gli stili dell'Arena: tutto in vista (niente nebbia), niente scala d'uscita, luci da giorno. */
export const STILI_ARENA: ReadonlySet<string> = new Set(['colosseo', 'giardino', 'rovine']);

/** Pezzi che una mappa nuova sostituisce a quelli di tutti: la colonna e il muretto basso (le celle `grata`). */
export type KitArena = { colonna: Part[]; grata: Part[] };

/** Un filo d'erba: due blocchi che si assottigliano (base larga, punta stretta), appoggiato a y0. */
function filo(x: number, z: number, y0: number, w: number, h: number): THREE.BufferGeometry[] {
  const a = new THREE.BoxGeometry(w, h * 0.58, w).translate(x, y0 + h * 0.29, z);
  const b = new THREE.BoxGeometry(w * 0.55, h * 0.42, w * 0.55).translate(x, y0 + h * 0.58 + h * 0.21, z);
  return [a, b];
}

/** Un ciuffo di erba alta per cella di lato `T` m: la macchia di terra scura e una dozzina di fili alti fino a ~1,1 m (messi a mano, uguali in
 *  ogni cella: la scena li gira di un quarto di giro a caso). Tre parti, una per verde, più la macchia. */
export function erbaParts(T: number, top: number): Part[] {
  // [x, z, altezza, larghezza] in frazioni della cella (−0,5…0,5)
  const FILI: [number, number, number, number][] = [
    [-0.36, -0.34, 1.0, 0.2], [-0.05, -0.4, 0.8, 0.17], [0.32, -0.3, 1.1, 0.2], [-0.4, 0.02, 0.85, 0.17], [-0.12, -0.07, 1.05, 0.22], [0.2, 0.05, 0.8, 0.18],
    [0.42, 0.1, 0.95, 0.17], [-0.3, 0.36, 1.1, 0.2], [0.02, 0.32, 0.9, 0.18], [0.3, 0.4, 1.0, 0.2], [-0.2, 0.18, 0.75, 0.16], [0.14, -0.2, 0.72, 0.16],
  ];
  const verdi = [PAL.erbaScura, PAL.erba, PAL.erbaChiara], gruppi: THREE.BufferGeometry[][] = [[], [], []];
  FILI.forEach(([fx, fz, h, w], i) => gruppi[i % 3]!.push(...filo(fx * T, fz * T, top + 0.04, w, h)));
  const out: Part[] = [boxPart(T * 0.98, 0.04, T * 0.98, top, PAL.erbaScura)];
  gruppi.forEach((g, i) => {
    const geo = mergeGeometries(g, false)!;
    for (const x of g) x.dispose();
    out.push({ geo, mat: flat(verdi[i]!) });
  });
  return out;
}

/** Colonne e muretti dello stile (null = quelli di tutti). */
export function kitArena(stile: string, T: number): KitArena | null {
  if (stile === 'giardino') {
    return {
      // basamento di pietra con un cespuglio tondo sopra
      colonna: [boxPart(1.3, 0.5, 1.3, 0, PAL.pietra), boxPart(1.15, 1.1, 1.15, 0.5, PAL.erbaScura), boxPart(0.75, 0.45, 0.75, 1.6, PAL.erba)],
      // staccionata di legno
      grata: [boxPart(T, 0.12, T * 0.3, 0.55, PAL.legnoChiaro), boxPart(T, 0.12, T * 0.3, 0.25, PAL.legnoChiaro), boxPart(0.18, 0.95, T * 0.4, 0, PAL.legno)],
    };
  }
  if (stile === 'rovine') {
    return {
      // colonna spezzata: base larga, fusto, capitello sbeccato
      colonna: [boxPart(1.25, 0.45, 1.25, 0, PAL.pietraScura), boxPart(0.9, 1.35, 0.9, 0.45, PAL.pietra), boxPart(0.55, 0.3, 0.55, 1.8, PAL.pietraChiara)],
      // muro a pezzi: parte bassa piena e pietre sopra
      grata: [boxPart(T, 0.7, T * 0.7, 0, PAL.pietra), boxPart(T * 0.55, 0.3, T * 0.55, 0.7, PAL.pietraScura), boxPart(T * 0.25, 0.2, T * 0.4, 1.0, PAL.pietraChiara)],
    };
  }
  return null;
}
