// Isola dalle celle della mappa: moduli glTF dal manifest, altrimenti box colorati dalla palette (InstancedMesh per tipo). Stub funzionante (WP0); WP1 rifinisce.
import * as THREE from 'three';
import type { GridMap, Tile } from '@marea/sim';
import type { Loader } from './loader.ts';
const LOOK: Partial<Record<Tile, { color: number; h: number; model: string }>> = {
  '.': { color: 0xe2b97f, h: 0.4, model: 'mod_sabbia' }, 'P': { color: 0xe2b97f, h: 0.4, model: 'mod_sabbia' },
  'g': { color: 0x8fc35b, h: 0.6, model: 'mod_erba' }, 'L': { color: 0x8fc35b, h: 0.6, model: 'mod_erba' },
  'r': { color: 0x7f7568, h: 1.6, model: 'mod_scogliera' }, 'd': { color: 0x8e5a2b, h: 0.5, model: 'mod_molo' }, ',': { color: 0x7fe3e0, h: 0.05, model: '' },
};
export async function createIsland(o: { map: GridMap; loader: Loader }): Promise<{ group: THREE.Group; groundY(x: number, z: number): number }> {
  const group = new THREE.Group();
  const byTile = new Map<Tile, THREE.Matrix4[]>();
  for (let cz = 0; cz < o.map.h; cz++) for (let cx = 0; cx < o.map.w; cx++) {
    const t = o.map.at(cx, cz);
    if (!LOOK[t]) continue;
    const p = o.map.cellToWorld(cx, cz);
    const m = new THREE.Matrix4().makeTranslation(p.x, LOOK[t]!.h / 2 - 0.02, p.z);
    (byTile.get(t) ?? byTile.set(t, []).get(t)!).push(m);
  }
  for (const [t, mats] of byTile) {
    const look = LOOK[t]!;
    const geo = new THREE.BoxGeometry(o.map.tile, look.h, o.map.tile);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: look.color, flatShading: true }), mats.length);
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = look.h > 0.3; mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group, groundY: (x, z) => { const t = o.map.at(o.map.worldToCell(x, z).cx, o.map.worldToCell(x, z).cz); return LOOK[t]?.h ?? 0; } };
}
