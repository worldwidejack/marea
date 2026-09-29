// Barca: modello boat_barca o segnaposto di legno. Stub funzionante (WP0); WP2 rifinisce (scia, beccheggio, remata).
import * as THREE from 'three';
import { newBoat, stepBoat } from '@marea/sim';
import type { AvatarState, BoatState, GridMap, InputFrame } from '@marea/sim';
import type { Loader } from '../render/loader.ts';
export type Boat = { object: THREE.Object3D; state: BoatState; prev: BoatState; step(input: InputFrame, map: GridMap): void; update(alpha: number, dt: number, t: number): void; setDriver(a: AvatarState | null): void; setYaw(yaw: number): void; driving: boolean };
export async function createBoat(o: { loader: Loader; x: number; z: number }): Promise<Boat> {
  const object = new THREE.Group();
  if (o.loader.has('boat_barca')) object.add((await o.loader.load('boat_barca')).scene);
  else {
    const wood = new THREE.MeshLambertMaterial({ color: 0x8e5a2b, flatShading: true });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 4.2), wood); hull.position.y = 0.25;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 4), wood); bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.25, -2.6);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), new THREE.MeshLambertMaterial({ color: 0xc98a4b })); seat.position.set(0, 0.55, 0.6);
    for (const m of [hull, bow, seat]) { m.castShadow = true; object.add(m); }
  }
  let state = newBoat(o.x, o.z), prev = state;
  const api: Boat = {
    object, get state() { return state; }, get prev() { return prev; }, driving: false,
    step(input, map) { prev = state; state = stepBoat(state, input, map); },
    update(alpha, _dt, t) {
      object.position.set(prev.x + (state.x - prev.x) * alpha, 0.05 + Math.sin(t * 2.1) * 0.03, prev.z + (state.z - prev.z) * alpha);
      object.rotation.set(Math.sin(t * 1.7) * 0.02, state.yaw, -state.rudder * 0.08);
    },
    setDriver(a) { api.driving = !!a; },
    setYaw(yaw) { state = { ...state, yaw }; prev = state; object.rotation.y = yaw; },
  };
  return api;
}
