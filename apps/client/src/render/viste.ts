// Dati leggeri delle impostazioni (#53): li usa il pannello (ui/impostazioni.ts) senza tirarsi dietro la resa.
// Il resto (render/aspetto.ts: passata finale, acqua stampa, ciclo) si scarica solo quando qualcuno accende un'impostazione.
import type { View } from './scene.ts';

export type Impostazioni = { cam: number; ciclo: boolean; stampa: boolean; contorni: boolean };
/** Di serie (#59, Jack 7 ott): ciclo giorno/notte, camera 22°, contorni. La stampa giapponese resta da accendere. */
export const DI_SERIE: Impostazioni = { cam: 3, ciclo: true, stampa: false, contorni: true };
/** Tutto spento: la resa di sempre (45°, luce fissa, niente passata finale). È la partenza dei test automatici. */
export const SPENTO: Impostazioni = { cam: 0, ciclo: false, stampa: false, contorni: false };
export const tuttoSpento = (s: Impostazioni): boolean => s.cam === 0 && !s.ciclo && !s.stampa && !s.contorni;
/** Viste della camera: la prima è quella di sempre (ART_BIBLE §7). far: fin dove si disegna (con la camera bassa si vede l'orizzonte). */
export const VISTE: (View & { nome: string })[] = [
  { nome: '45°', pitch: 45, fov: 30, dist: 28, far: 300 },
  { nome: '35°', pitch: 35, fov: 32, dist: 26, far: 600 },
  { nome: '30°', pitch: 30, fov: 34, dist: 24, far: 700 },
  { nome: '22°', pitch: 22, fov: 38, dist: 22, far: 900 },
  { nome: '15°', pitch: 15, fov: 42, dist: 19, far: 900 },
];
/** Minuti di un giro completo del ciclo giorno/notte (giorno ~13, tramonto ~2, notte ~5, alba ~2 più i passaggi). Aspetto, non numero di gioco. */
export const CICLO_MIN = 24;
