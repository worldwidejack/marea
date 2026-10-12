// I fondali dipinti delle piste delle Corse (#258): un panorama per zona dietro la pista (cielo, mare, colline, montagne lontane), sulla
// sfera del fondale della discesa (`discesa/fondale.ts`), immagine fissa. Il 3D vicino resta com'è; la passata finale passa il fondale
// dalla palette a mezza risoluzione come tutto il resto. Le zone senza panorama tengono il cielo di prima.
// Spiaggia: scelta di Jack del 12 ott 2026 tra cinque versioni (dipinta, pixel art, dalla concept, e le due più nitide): la dipinta
// nitida, senza HD. Immagine da ChatGPT, 1672×941. Sul banco il tasto F lo accende e lo spegne.
import { creaFondale } from './discesa/fondale.ts';
import type { Fondale } from './discesa/fondale.ts';

type Pannello = { file: string; orizzonte: number; cielo: string; mare: string };
const FONDALI: Record<string, Pannello> = {
  spiaggia: { file: 'fondale_spiaggia.jpg', orizzonte: 0.41, cielo: '#3b79c0', mare: '#15587a' },
};
const fatti = new Map<string, Fondale>();

/** Il fondale della zona (null = la zona non ne ha). Uno per zona, tenuto per le gare dopo. Copre 180° di panorama e dietro si
 *  specchia: con due larghezze esatte sul giro intero non c'è cucitura. */
export function fondalePista(zona: string): Fondale | null {
  const f = FONDALI[zona];
  if (!f) return null;
  let x = fatti.get(zona);
  if (!x) fatti.set(zona, (x = creaFondale({ src: [], poster: `/assets/corse/${f.file}`, centro: 0, ampiezza: Math.PI, orizzonte: f.orizzonte, cielo: f.cielo, mare: f.mare })));
  return x;
}
