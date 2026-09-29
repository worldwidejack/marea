// Animazioni glTF con crossfade. Stub funzionante (WP0); WP2 rifinisce.
import * as THREE from 'three';
export type Animator = { play(name: string, fadeS?: number): void; update(dt: number): void; current: string };
export function createAnimator(root: THREE.Object3D, clips: THREE.AnimationClip[]): Animator {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map(clips.map((c) => [c.name, mixer.clipAction(c)]));
  let cur: THREE.AnimationAction | null = null;
  const api: Animator = {
    current: '',
    play(name, fadeS = 0.15) {
      const a = actions.get(name); if (!a || a === cur) return;
      a.reset().setEffectiveWeight(1).fadeIn(fadeS).play(); if (cur) cur.fadeOut(fadeS); cur = a; api.current = name;
    },
    update: (dt) => mixer.update(dt),
  };
  return api;
}
