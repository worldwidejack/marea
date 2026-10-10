// Mausoleo Cinetico (Epopea della Regata, dungeon 4; docs/RPG.md §2f): l'orologio e le onde. Qui solo i conti puri (nessun colpo):
// la direzione di una lancetta a un tick (seno e coseno in serie di Taylor su un angolo ridotto a ±45°: solo + − × ÷, uguale su ogni
// motore) e la nascita di un'onda d'acqua (ondata del Custode, scarica della sua Barriera). Colpi e spinte stanno in mausoleo.ts.
import type { DungeonState } from './state.ts';
import type { DMap } from './map.ts';
import { HZ } from './tuning.ts';

const MEZZO_PI = Math.PI / 2;
/** Versore (cos a, sin a) senza funzioni trascendenti: a ridotto al quarto di giro più vicino (|r| ≤ π/4), serie fino al grado 14. */
export function versore(a: number): [number, number] {
  const q = Math.round(a / MEZZO_PI), r = a - q * MEZZO_PI, r2 = r * r;
  const s = r * (1 - (r2 / 6) * (1 - (r2 / 20) * (1 - (r2 / 42) * (1 - (r2 / 72) * (1 - (r2 / 110) * (1 - r2 / 156))))));
  const c = 1 - (r2 / 2) * (1 - (r2 / 12) * (1 - (r2 / 30) * (1 - (r2 / 56) * (1 - (r2 / 90) * (1 - (r2 / 132) * (1 - r2 / 182))))));
  switch (((q % 4) + 4) % 4) {
    case 0: return [c, s];
    case 1: return [-s, c];
    case 2: return [-c, -s];
    default: return [s, -c];
  }
}

type LancettaDef = DMap['lancette'][number];
/** Direzione della lancetta al tick (dal perno verso la punta). */
export function lancettaDir(l: LancettaDef, tick: number): [number, number] {
  return versore(l.fase + (l.giro * tick) / HZ);
}

/** Un'onda d'acqua che parte da (x, z): `varchi` come versori (nessuno = la prende chiunque sia allo scoperto). */
export function ondaDa(s: DungeonState, x: number, z: number, o: { velocita: number; raggio: number; spessore: number; danno: number; spinta: number; largo: number }, varchi: [number, number][], barriera = false): void {
  s.onde.push({ id: s.nextId++, x, z, r: 0, v: o.velocita, max: o.raggio, spessore: o.spessore, danno: o.danno, spinta: o.spinta, varchi, largo: o.largo, colpiti: [], ...(barriera ? { barriera: true as const } : {}) });
}
