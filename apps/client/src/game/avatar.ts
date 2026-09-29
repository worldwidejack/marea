// Avatar: modello chr_base dal manifest o segnaposto (corpo + testa) dalla palette. Stub funzionante (WP0); WP2 rifinisce.
import * as THREE from 'three';
import { newAvatar, stepAvatar } from '@marea/sim';
import type { AvatarState, GridMap, InputFrame } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { AVATAR } from '@marea/content';
import type { Loader } from '../render/loader.ts';
import { createAnimator } from '../render/anim.ts';
import type { Animator } from '../render/anim.ts';
export type Avatar = { object: THREE.Object3D; state: AvatarState; prev: AvatarState; step(input: InputFrame, map: GridMap): void; update(alpha: number, dt: number): void; teleport(x: number, z: number): void; visible: boolean };
export async function createAvatar(o: { loader: Loader; look: Look; x: number; z: number }): Promise<Avatar> {
  const object = new THREE.Group();
  let anim: Animator | null = null;
  if (o.loader.has('chr_base')) {
    const { scene, clips } = await o.loader.load('chr_base'); object.add(scene); anim = createAnimator(scene, clips);
  } else {
    const skin = new THREE.Color(AVATAR.pelle[o.look.pelle] ?? '#D9A070'), cloth = new THREE.Color(AVATAR.vestiti[o.look.vestito] ?? '#3FB9C9'), hair = new THREE.Color(AVATAR.coloriCapelli[o.look.coloreCapelli] ?? '#2E1E14');
    const mat = (c: THREE.Color) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), mat(cloth)); body.position.y = 0.75 + 0.375 - 0.4;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.28), mat(new THREE.Color('#5A3A1E'))); legs.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), mat(skin)); head.position.y = 1.44;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), mat(hair)); cap.position.y = 1.64;
    for (const m of [body, legs, head, cap]) { m.castShadow = true; object.add(m); }
  }
  let state = newAvatar(o.x, o.z), prev = state;
  const api: Avatar = {
    object, get state() { return state; }, get prev() { return prev; }, visible: true,
    step(input, map) { prev = state; state = stepAvatar(state, input, map); },
    update(alpha, dt) {
      object.visible = api.visible;
      object.position.set(prev.x + (state.x - prev.x) * alpha, 0.4, prev.z + (state.z - prev.z) * alpha);
      object.rotation.y = state.yaw;
      if (anim) { anim.play(state.anim); anim.update(dt); }
      else if (state.anim !== 'idle') object.position.y += Math.abs(Math.sin(performance.now() / (state.anim === 'run' ? 90 : 140))) * 0.08;
    },
    teleport(x, z) { state = { ...state, x, z, vx: 0, vz: 0 }; prev = state; },
  };
  return api;
}
