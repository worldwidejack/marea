// Sole ambra + cielo emisferico (ART_BIBLE §7). Stub funzionante (WP0); WP1 rifinisce ombre e tinte.
import * as THREE from 'three';
export function createLights(): { group: THREE.Group; update(t: number): void; sun: THREE.DirectionalLight } {
  const group = new THREE.Group();
  const sun = new THREE.DirectionalLight(0xffd9a3, 3.0);
  sun.position.set(-30, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 150; sun.shadow.bias = -0.0015;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0x9fd3ff, 0x7a5a3a, 1.1));
  return { group, sun, update: () => {} };
}
