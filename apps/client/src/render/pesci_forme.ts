// Forme della pesca (#457): la canna in mano, il galleggiante, gli anelli sull'acqua, il mirino del lancio e l'ombra del pesce (un ovale
// piatto con la coda, scalato sulla taglia). Geometria procedurale low-poly coi colori della palette, come gli insetti
// (render/insetti_forme.ts); game/pesca.ts le copia ogni frame in due mesh (render/pennello.ts): una piena, una per le ombre trasparenti.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { box, forma, mat, pz } from './animali_forme.ts';

const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);

/** Lunghezza della canna (m): il manico è all'origine, la punta su +Y (come il retino). */
export const CANNA_L = 1.7;
export const CANNA = forma([
  pz(cyl(0.03, 0.035, 0.45, 6).translate(0, 0.22, 0), PAL.legnoScuro, mat(0, 0, 0)),
  pz(cyl(0.012, 0.025, CANNA_L - 0.45, 5).translate(0, 0.45 + (CANNA_L - 0.45) / 2, 0), PAL.legnoChiaro, mat(0, 0, 0)),
  pz(cyl(0.06, 0.06, 0.05, 8), PAL.pietra, mat(0, 0.32, 0.05, Math.PI / 2)), // il mulinello
  pz(box(0.02, 0.02, 0.02), PAL.rosso, mat(0, CANNA_L, 0)),
]);
/** Il galleggiante: mezzo rosso sopra, mezzo bianco sotto, con l'antenna. A pelo d'acqua all'origine. */
export const GALLEGGIANTE = forma([
  pz(new THREE.SphereGeometry(0.1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), PAL.rosso, mat(0, 0, 0)),
  pz(new THREE.SphereGeometry(0.1, 6, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), PAL.pietraChiara, mat(0, 0, 0)),
  pz(box(0.02, 0.12, 0.02), PAL.neroCaldo, mat(0, 0.15, 0)),
]);
/** Un anello d'acqua (raggio 1, si scala): otto trattini chiari. */
export const ANELLO = forma(Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return pz(box(0.6, 0.02, 0.07), PAL.pietraChiara, mat(Math.cos(a), 0, Math.sin(a), 0, -a + Math.PI / 2));
}));
/** Il mirino del lancio (raggio 0,5): dodici trattini col colore 1 (giallo se si può, rosso se lì non c'è acqua). */
export const MIRINO = forma(Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return pz(box(0.16, 0.03, 0.06), 1, mat(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, 0, -a + Math.PI / 2));
}));
/** Uno spruzzo: tre goccioline chiare. */
export const SPRUZZO = forma([
  pz(box(0.07, 0.07, 0.07), PAL.pietraChiara, mat(0.12, 0, 0)), pz(box(0.06, 0.06, 0.06), PAL.acquaBassa, mat(-0.1, 0.05, 0.08)), pz(box(0.05, 0.05, 0.05), PAL.pietraChiara, mat(0, 0.1, -0.1)),
]);
/** L'ombra del pesce lunga 1 m (davanti = −Z): ovale piatto a 10 lati, coda a ventaglio dietro. Colore 1 (la mesh delle ombre è trasparente). */
export const OMBRA_PESCE = forma([
  pz(cyl(0.5, 0.5, 0.01, 10), 1, mat(0, 0, -0.08).scale(new THREE.Vector3(0.42, 1, 0.84))),
  pz(box(0.26, 0.01, 0.18), 1, mat(0, 0, 0.42, 0, 0, 0)),
  pz(box(0.34, 0.01, 0.08), 1, mat(0, 0, 0.52)),
]);
