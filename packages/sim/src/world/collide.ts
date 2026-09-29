// Collisione cerchio contro griglia: spinge fuori dalle celle bloccate lungo la normale, così si scivola lungo i bordi
// e negli angoli non ci si incastra (gli spigoli sono arrotondati dal raggio). Pura, deterministica.
import type { GridMap } from './grid.ts';

export type Blocked = (cx: number, cz: number) => boolean;
export type Push = { x: number; z: number; nx: number; nz: number; hit: boolean };

/** Risolve la posizione (x, z) di un cerchio di raggio r: fino a 4 iterazioni sulle celle vicine. */
export function resolveCircle(map: GridMap, blocked: Blocked, x0: number, z0: number, r: number): Push {
  const t = map.tile;
  let x = x0, z = z0, nx = 0, nz = 0, hit = false;
  for (let it = 0; it < 4; it++) {
    let moved = false;
    const c0x = Math.floor((x - r) / t), c1x = Math.floor((x + r) / t);
    const c0z = Math.floor((z - r) / t), c1z = Math.floor((z + r) / t);
    for (let cz = c0z; cz <= c1z; cz++)
      for (let cx = c0x; cx <= c1x; cx++) {
        if (!blocked(cx, cz)) continue;
        const minX = cx * t, maxX = minX + t, minZ = cz * t, maxZ = minZ + t;
        const px = Math.max(minX, Math.min(x, maxX)), pz = Math.max(minZ, Math.min(z, maxZ));
        let dx = x - px, dz = z - pz;
        let d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d < 1e-9) {
          // centro dentro la cella: esci dal lato più vicino
          const l = x - minX, rr = maxX - x, u = z - minZ, dd = maxZ - z;
          const m = Math.min(l, rr, u, dd);
          if (m === l) { dx = -1; dz = 0; d = l; } else if (m === rr) { dx = 1; dz = 0; d = rr; } else if (m === u) { dx = 0; dz = -1; d = u; } else { dx = 0; dz = 1; d = dd; }
          x += dx * (d + r); z += dz * (d + r);
          nx += dx; nz += dz;
        } else {
          const k = (r - d) / d;
          x += dx * k; z += dz * k;
          nx += dx / d; nz += dz / d;
        }
        hit = true;
        moved = true;
      }
    if (!moved) break;
  }
  const n = Math.hypot(nx, nz) || 1;
  return { x, z, nx: nx / n, nz: nz / n, hit };
}
