// Personaggi del Borgo (`npc_<id>`, ART_BIBLE §5): ogni modello ha due mesh sulle stesse ossa, quella dettagliata e quella leggera
// (`…_lod`, ~1.800 triangoli). Da lontano (la camera di sempre, ~28 m) a pixel grossi non si distinguono: si disegna la leggera e
// la dettagliata solo da vicino (zoom avanti, chiacchierata). Tiene giù i triangoli a schermo (TECH §5) e i fps sui telefoni deboli.
import * as THREE from 'three';

/** Sotto questa distanza dalla camera (m) si vede il modello dettagliato. Camera di base 28 m × zoom 0,6-2,2. */
const LOD_M = 21;

const cam = new THREE.Vector3(), chi = new THREE.Vector3();
/** Mostra la mesh giusta tra le due di un personaggio; chi non ha la `_lod` (chr_base) resta com'è. */
export function scegliLod(meshes: readonly THREE.Mesh[], camera: THREE.Camera, x: number, y: number, z: number): void {
  if (!meshes.some((m) => m.name.endsWith('_lod'))) return;
  const vicino = camera.getWorldPosition(cam).distanceTo(chi.set(x, y, z)) < LOD_M;
  for (const m of meshes) m.visible = m.name.endsWith('_lod') ? !vicino : vicino;
}
