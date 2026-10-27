// La mappa di chi cammina nelle case (#386). Il template `lotto` ha già il pavimento MASSIMO delle stanze (economy/stanze.ts `PIANTE_MAX`), uguale per
// tutti i lotti; ogni casa sblocca un pezzo alla volta coi suoi ampliamenti. Qui la griglia del mondo viene «chiusa» dove la casa di quel lotto non è
// ancora cresciuta o dove ci sono mobili a terra e il baule: quelle celle diventano roccia (`r`), così l'eroe urta il muro vero della stanza e i mobili
// invece di attraversarli (mobili a parete e tappeti non bloccano il passo).
// Pura: livello e stato della casa li dà chi chiama (il client li legge dagli stati dei lotti, anche delle case degli amici).
import { celleMobile, mobile } from '../economy/casa.ts';
import type { CasaState } from '../economy/casa.ts';
import { SCALE_CASA, inStanza, livelloCasa, stanzaAt } from '../economy/stanze.ts';
import type { GridMap, Tile } from './grid.ts';

/** I lotti per cui valgono le stanze: dove sta il loro angolo (celle del mondo) e quanto sono grandi. */
export type LottoMaschera = { slot: number; origin: readonly [number, number] };
const LARGO = 30, ALTO = 46; // il template `lotto`: la casa sta in queste celle

/** La stessa mappa, ma le celle di pavimento non ancora sbloccate dalla casa del lotto e quelle occupate da mobili a terra o dal baule sono roccia.
 *  `livelloDi(slot)` = livello di quella casa; `casaDi(slot)` = stato della casa (arredi posati e baule). */
export function mascheraCase(
  map: GridMap,
  lotti: readonly LottoMaschera[],
  livelloDi: (slot: number) => number,
  casaDi?: (slot: number) => CasaState | null | undefined,
): GridMap {
  const chiusa = (cx: number, cz: number): boolean => {
    for (const l of lotti) {
      const x = cx - l.origin[0], z = cz - l.origin[1];
      if (x < 0 || z < 0 || x >= LARGO || z >= ALTO) continue;
      const liv = livelloCasa({ livello: livelloDi(l.slot) });
      if (inStanza([x, z]) && !stanzaAt(liv, [x, z])) return true;
      for (const s of SCALE_CASA) if (liv < s.da && s.cell[0] === x && s.cell[1] === z) return true;
      if (inStanza([x, z]) && casaDi) {
        const c = casaDi(l.slot);
        if (c) {
          if (c.baule && c.baule.cell[0] === x && c.baule.cell[1] === z) return true;
          if (c.arredi) {
            for (const a of c.arredi) {
              if (a.muro) continue;
              const m = mobile(a.mobile);
              if (m?.altezza !== undefined && m.altezza < 0.15) continue;
              const celle = celleMobile(m ?? { posto: 'terra', celle: [1, 1] }, a.cell, a.rot ?? 0);
              for (const q of celle) if (q[0] === x && q[1] === z) return true;
            }
          }
        }
      }
    }
    return false;
  };
  return {
    ...map,
    at: (cx, cz): Tile => (chiusa(cx, cz) ? 'r' : map.at(cx, cz)),
    walkable: (x, z) => { const c = map.worldToCell(x, z); return !chiusa(c.cx, c.cz) && map.walkable(x, z); },
  };
}
