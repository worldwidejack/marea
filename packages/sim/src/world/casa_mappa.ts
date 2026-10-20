// La mappa di chi cammina nelle case (#386). Il template `lotto` ha già il pavimento MASSIMO delle stanze (economy/stanze.ts `PIANTE_MAX`), uguale per
// tutti i lotti; ogni casa sblocca un pezzo alla volta coi suoi ampliamenti. Qui la griglia del mondo viene «chiusa» dove la casa di quel lotto non è
// ancora cresciuta: quelle celle diventano roccia (`r`), così l'eroe urta il muro vero della stanza e non il bordo del pavimento massimo.
// Pura: il livello di ogni lotto lo dà chi chiama (il client lo legge dagli stati dei lotti, anche delle case degli amici).
import { SCALE_CASA, inPianteMax, livelloCasa, stanzaAt } from '../economy/stanze.ts';
import type { GridMap, Tile } from './grid.ts';

/** I lotti per cui valgono le stanze: dove sta il loro angolo (celle del mondo) e quanto sono grandi. */
export type LottoMaschera = { slot: number; origin: readonly [number, number] };
const LARGO = 30, ALTO = 46; // il template `lotto`: la casa sta in queste celle

/** La stessa mappa, ma le celle di pavimento non ancora sbloccate dalla casa del lotto sono roccia. `livelloDi(slot)` = livello di quella casa. */
export function mascheraCase(map: GridMap, lotti: readonly LottoMaschera[], livelloDi: (slot: number) => number): GridMap {
  const chiusa = (cx: number, cz: number): boolean => {
    for (const l of lotti) {
      const x = cx - l.origin[0], z = cz - l.origin[1];
      if (x < 0 || z < 0 || x >= LARGO || z >= ALTO) continue;
      const liv = livelloCasa({ livello: livelloDi(l.slot) });
      if (inPianteMax([x, z]) && !stanzaAt(liv, [x, z])) return true;
      for (const s of SCALE_CASA) if (liv < s.da && s.cell[0] === x && s.cell[1] === z) return true;
    }
    return false;
  };
  return {
    ...map,
    at: (cx, cz): Tile => (chiusa(cx, cz) ? 'r' : map.at(cx, cz)),
    walkable: (x, z) => { const c = map.worldToCell(x, z); return !chiusa(c.cx, c.cz) && map.walkable(x, z); },
  };
}
