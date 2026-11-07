// Prima persona nei dungeon: il corpo che si vede guardando in basso è il modello vero del protagonista, con le armature e le skin che ha
// addosso. Testa e braccia si chiudono su se stesse (le mani sono sprite, fp_mani.ts), il corpo gira con lo sguardo e sta un po' indietro:
// così la camera è davanti al petto e non dentro al collo.
import * as THREE from 'three';
import type { Avatar } from '../game/avatar.ts';

const OSSA = ['Head', 'UpperArm.R', 'UpperArm.L'], QUASI_ZERO = 0.001, ARRETRA = 0.18;

export function creaCorpo(avatar: Avatar): { update(yaw: number, morto: boolean): void } {
  const via = OSSA.map((n) => avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? avatar.object.getObjectByName(n) ?? null).filter((b): b is THREE.Object3D => !!b);
  return {
    update(yaw, morto) {
      avatar.visible = !morto; // a terra la camera ci finirebbe dentro
      avatar.object.rotation.y = yaw;
      avatar.object.position.x += Math.sin(yaw) * ARRETRA; avatar.object.position.z += Math.cos(yaw) * ARRETRA;
      for (const b of via) b.scale.setScalar(QUASI_ZERO);
    },
  };
}
