// I fondali dipinti delle piste delle Corse (#258): un panorama per zona dietro la pista (cielo, mare, colline, montagne lontane), sulla
// sfera del fondale della discesa (`discesa/fondale.ts`), immagine fissa. Il 3D vicino resta com'è; la passata finale passa il fondale
// dalla palette a mezza risoluzione come tutto il resto. Le zone senza panorama tengono il cielo di prima.
// Spiaggia: scelta di Jack del 12 ott 2026 tra cinque versioni (dipinta, pixel art, dalla concept, e le due più nitide): la dipinta
// nitida, senza HD. Immagine da ChatGPT, 1672×941. Sul banco il tasto F lo accende e lo spegne.
// Uno per pista (Jack, 13 ott 2026, #272: «ogni pista deve averne uno diverso»): prima si cerca la pista, poi la zona come riserva.
// Giungla: la Miniera ha i pilastri coi ponti e le cascate (la 2 delle tre); il tempio col volto di pietra è tenuto per il Tempio che
// crolla (`assets/concept/corse/corse_23_fondale_giungla_tempio.jpg`).
import { creaFondale } from './discesa/fondale.ts';
import type { Fondale } from './discesa/fondale.ts';

type Pannello = { file: string; orizzonte: number; cielo: string; mare: string };
const FONDALI: Record<string, Pannello> = {
  spiaggia: { file: 'fondale_spiaggia.jpg', orizzonte: 0.41, cielo: '#3b79c0', mare: '#15587a' },
  giungla_miniera: { file: 'fondale_giungla_miniera.jpg', orizzonte: 0.42, cielo: '#339de8', mare: '#234721' },
};
const fatti = new Map<string, Fondale>();

/** Il fondale della pista, o della sua zona (null = nessuno dei due ne ha). Uno per immagine, tenuto per le gare dopo. Copre 180° di
 *  panorama e dietro si specchia: con due larghezze esatte sul giro intero non c'è cucitura. */
export function fondalePista(pista: string, zona: string): Fondale | null {
  const chiave = FONDALI[pista] ? pista : zona, f = FONDALI[chiave];
  if (!f) return null;
  let x = fatti.get(chiave);
  if (!x) fatti.set(chiave, (x = creaFondale({ src: [], poster: `/assets/corse/${f.file}`, centro: 0, ampiezza: Math.PI, orizzonte: f.orizzonte, cielo: f.cielo, mare: f.mare })));
  return x;
}
