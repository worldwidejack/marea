import { ARENA } from '@marea/content/arena.ts';
import { AIM_N, aimDir } from '@marea/sim/dungeon/mira.ts';

/** Smorza i piccoli scarti di mira sul giro più corto. Al rilascio tiene l'angolo mostrato dall'anteprima. */
export function creaMiraBomba() {
  let angolo: number | null = null;
  const indice = (): number => angolo === null ? 0 : Math.round(angolo) % AIM_N + 1;
  return {
    campiona(m: number, tieni: boolean, attiva: boolean): number {
      if (!attiva) { angolo = null; return m; }
      if (!m || !tieni) return indice() || m;
      const verso = m - 1;
      if (angolo === null) angolo = verso;
      else {
        const delta = (verso - angolo + AIM_N * 1.5) % AIM_N - AIM_N / 2;
        angolo = (angolo + delta * ARENA.build.sensibilitaBomba + AIM_N) % AIM_N;
      }
      return indice();
    },
    dir() {
      const v = aimDir(indice());
      return v ? { x: v[0], z: v[1] } : null;
    },
  };
}
