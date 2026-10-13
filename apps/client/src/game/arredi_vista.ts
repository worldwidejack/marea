// I mobili posati in casa (#265, LotState.casa.arredi): una mesh sola per lotto, rifatta solo quando cambiano. La disegna la vista del
// lotto (game/lot.ts, anche per le case degli amici: sola lettura). La mesh sta nella stanza (la stanza nasconde i figli del lotto a nord
// del muro in fondo, game/stanza.ts), le forme vengono da render/mobili.ts (chunk caricato al primo mobile).
import * as THREE from 'three';
import { BORGO, MOBILI } from '@marea/content';
import { casaDi } from '@marea/sim';
import type { LotState, PlacedMobile } from '@marea/sim';

const [X0, Z0, X1] = BORGO.stanza.pavimento;
const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Dove sta un mobile (m, coordinate del lotto) e verso dove guarda (rad): a terra al centro della cella, a parete appoggiato al muro. */
export function postoArredo(a: Pick<PlacedMobile, 'cell' | 'muro' | 'rot'>, T: number): { x: number; z: number; ry: number } {
  const cx = (a.cell[0] + 0.5) * T, cz = (a.cell[1] + 0.5) * T;
  if (a.muro === 'n') return { x: cx, z: Z0 * T, ry: 0 };
  if (a.muro === 'o') return { x: X0 * T, z: cz, ry: Math.PI / 2 };
  if (a.muro === 'e') return { x: X1 * T, z: cz, ry: -Math.PI / 2 };
  return { x: cx, z: cz, ry: ((a.rot ?? 0) * Math.PI) / 2 };
}

export function createArrediVista(o: { group: THREE.Group; origin: readonly [number, number]; tile: number; groundY(x: number, z: number): number }): { sync(lot: LotState | null): void; dispose(): void } {
  const T = o.tile, ox = o.origin[0] * T, oz = o.origin[1] * T;
  let key = '', mesh: THREE.Mesh | null = null, mod: Promise<typeof import('../render/mobili.ts')> | null = null, disposed = false;
  const rifai = (m: typeof import('../render/mobili.ts'), arredi: readonly PlacedMobile[], k: string) => {
    if (disposed || k !== key) return;
    if (mesh) { o.group.remove(mesh); mesh.geometry.dispose(); mesh = null; }
    if (!arredi.length) return;
    // la mesh sta appena oltre il muro in fondo (la stanza nasconde i figli del lotto più a nord), le forme relative a lì
    const p0 = new THREE.Vector3(ox + X0 * T, o.groundY(ox + (X0 + 1) * T, oz + (Z0 + 1) * T), oz + Z0 * T + 0.01);
    const parti: THREE.BufferGeometry[] = [];
    for (const a of arredi) {
      const d = MOBILI.find((x) => x.id === a.mobile); if (!d) continue;
      const p = postoArredo(a, T), g = m.mobileGeo(d.forma, d.colori);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(p.ry).premultiply(new THREE.Matrix4().makeTranslation(ox + p.x - p0.x, 0, oz + p.z - p0.z)));
      parti.push(g);
    }
    if (!parti.length) return;
    const geo = m.unisci(parti);
    mesh = new THREE.Mesh(geo, vc); mesh.name = 'arredi'; mesh.position.copy(p0); mesh.castShadow = mesh.receiveShadow = true;
    o.group.add(mesh);
  };
  return {
    sync(lot) {
      const arredi = casaDi(lot).arredi ?? [], k = JSON.stringify(arredi);
      if (k === key) return;
      key = k;
      if (!arredi.length) { if (mesh) { o.group.remove(mesh); mesh.geometry.dispose(); mesh = null; } return; }
      mod ??= import('../render/mobili.ts');
      void mod.then((m) => rifai(m, arredi, k)).catch(() => { /* senza mobili si gioca lo stesso */ });
    },
    dispose() { disposed = true; if (mesh) { o.group.remove(mesh); mesh.geometry.dispose(); } },
  };
}
