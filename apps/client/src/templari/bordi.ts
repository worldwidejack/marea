// Bordi dell'arena dei Templari (docs/TEMPLARI.md §3): dove il campo finisce e oltre c'è il fuori, un muretto basso sul confine, così il
// limite si vede e non sembra un muro invisibile. Non sulla sabbia né sull'assito (lì oltre c'è il mare) e non accanto agli alberi del bordo.
// Più l'altezza dei muri pieni per cella, per le sagome (sagome.ts): chi sta dietro un muro alto.
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C, SUOLO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';

type Scatola = { x: number; z: number; sx: number; sy: number; sz: number; c: string };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** I muretti del bordo dei campi (box per le cose basse di scena.ts). */
export function murettiBordo(a: Arena): Scatola[] {
  const W = a.w, T = a.tile, out: Scatola[] = [];
  const alberi = new Set(a.alberi.map((x) => x.cella));
  for (let i = 0; i < a.sopra * W; i++) {
    const k = a.cell[i]!;
    if (k !== C.pavimento && k !== C.terra) continue;
    if (a.suolo[i] === SUOLO.sabbia || a.suolo[i] === SUOLO.assi) continue;
    const cx = i % W, px = (cx + 0.5) * T, pz = (Math.floor(i / W) + 0.5) * T;
    for (const [dx, dz] of N4) {
      const nx = cx + dx, j = i + dz * W + dx;
      if (nx < 0 || nx >= W || j < 0 || j >= a.sopra * W || a.cell[j] !== C.fuori || alberi.has(j)) continue;
      const h = cellHash(nx, Math.floor(j / W), 23);
      out.push({ x: px + dx * 0.5 * T, z: pz + dz * 0.5 * T, sx: dx ? 0.22 : 1.04, sy: 0.42 + 0.12 * h, sz: dz ? 0.22 : 1.04, c: h < 0.5 ? PAL.pietraScura : PAL.roccia });
    }
  }
  return out;
}

/** Altezza dei muri pieni per cella (0 = niente): `alto(x, z)` in metri, `set` per cambiarla (il muro crepato che si rompe). */
export function altezzeMuri(a: Arena, celle: readonly number[], altezze: readonly number[]): { alto(x: number, z: number): number; set(cella: number, h: number): void } {
  const h = new Float32Array(a.cell.length);
  celle.forEach((i, n) => { h[i] = altezze[n]!; });
  return {
    alto(x, z) {
      const cx = Math.floor(x / a.tile), cz = Math.floor(z / a.tile);
      return cx < 0 || cz < 0 || cx >= a.w || cz >= a.h ? 0 : h[cz * a.w + cx]!;
    },
    set(cella, v) { h[cella] = v; },
  };
}
