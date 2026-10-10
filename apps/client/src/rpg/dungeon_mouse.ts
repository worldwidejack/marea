// Mira col mouse nel dungeon (v6): segue il cursore e lo porta nel mondo (raggio della camera contro il piano all'altezza dei tiri), poi
// dice in che direzione dall'eroe sta il cursore, come versore e come indice di mira della sim (mira.ts). Solo col mouse vero
// (pointerType 'mouse'): un tocco o una penna lo spengono, così da telefono resta la mira assistita.
import * as THREE from 'three';
import { aimIndex } from '@marea/sim/dungeon/mira.ts';
import { MAGIA_Y } from '@marea/sim/dungeon/tuning.ts';

export type Mouse = {
  /** C'è un mouse che ha mosso il cursore e nessun tocco dopo. */
  readonly attivo: boolean;
  /** Da (x, z) verso il cursore: versore e indice di mira della sim. null se il cursore non si conosce o sta quasi sull'eroe. */
  verso(x: number, z: number): { x: number; z: number; m: number } | null;
  dispose(): void;
};

export function createMouse(o: { canvas: HTMLCanvasElement; camera: THREE.Camera; floorY: number }): Mouse {
  let px = 0, py = 0, attivo = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const piano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(o.floorY + MAGIA_Y));
  const mv = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') { px = e.clientX; py = e.clientY; attivo = true; } else attivo = false;
  };
  addEventListener('pointermove', mv); addEventListener('pointerdown', mv);
  return {
    get attivo() { return attivo; },
    verso(x, z) {
      if (!attivo) return null;
      const r = o.canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      ndc.set(((px - r.left) / r.width) * 2 - 1, -(((py - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, o.camera);
      if (!ray.ray.intersectPlane(piano, hit)) return null;
      const dx = hit.x - x, dz = hit.z - z, d = Math.sqrt(dx * dx + dz * dz);
      return d < 0.25 ? null : { x: dx / d, z: dz / d, m: aimIndex(dx, dz) };
    },
    dispose() { removeEventListener('pointermove', mv); removeEventListener('pointerdown', mv); },
  };
}
