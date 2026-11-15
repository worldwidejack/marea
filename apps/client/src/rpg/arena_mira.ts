import { ARENA } from '@marea/content/arena.ts';
import { AIM_N, aimDir } from '@marea/sim/dungeon/mira.ts';
import { portataIndex } from '@marea/sim/dungeon/portata.ts';

/** Mira della bomba: direzione e portata (dove atterra) scelte da chi mira. Smorza i piccoli scarti di tutte e due (la direzione sul giro più
 *  corto). Senza una portata voluta (`r` = 0: tocco veloce, tastiera) non c'è punto scelto e vale la mira assistita della sim. Al rilascio
 *  tiene il punto mostrato dall'anteprima. */
export function creaMiraBomba() {
  let angolo: number | null = null, dist: number | null = null, gittata = 9;
  const indice = (): number => angolo === null ? 0 : Math.round(angolo) % AIM_N + 1;
  const portata = (): number => dist === null ? 0 : portataIndex(dist, gittata);
  return {
    /** m = indice di mira voluto, r = distanza voluta (m, 0 = nessuna), `gittata` della magia. Dà l'indice di mira (m) e la portata (p) da mandare. */
    campiona(m: number, tieni: boolean, attiva: boolean, r: number, max: number): { m: number; p: number } {
      if (!attiva) { angolo = dist = null; return { m, p: 0 }; }
      gittata = max;
      if (!m || !tieni) return { m: indice() || m, p: portata() };
      const k = ARENA.build.sensibilitaBomba, verso = m - 1;
      if (angolo === null) angolo = verso;
      else {
        const delta = (verso - angolo + AIM_N * 1.5) % AIM_N - AIM_N / 2;
        angolo = (angolo + delta * k + AIM_N) % AIM_N;
      }
      if (r > 0) dist = dist === null ? r : dist + (r - dist) * k;
      return { m: indice(), p: portata() };
    },
    dir() {
      const v = aimDir(indice());
      return v ? { x: v[0], z: v[1] } : null;
    },
    /** Indice di portata di adesso (0 = nessuna scelta). */
    portata,
  };
}
