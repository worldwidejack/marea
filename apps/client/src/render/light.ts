// Luce (ART_BIBLE §7): sole #FFD9A3 da sud-ovest a ~40° di elevazione, emisferica #9FD3FF / #7A5A3A.
// Le ombre prendono il blu del cielo (emisferica) più un filo di viola: mai grigio neutro. Una shadow map 1024 che segue il bersaglio.
import * as THREE from 'three';
export const SUN = { color: 0xffd9a3, intensity: 2.7, elevation: (40 * Math.PI) / 180, azimuth: (225 * Math.PI) / 180, dist: 60, half: 30 } as const;
// Direzione dal bersaglio verso il sole: sud-ovest = −X, +Z (−Z è nord).
const DIR = new THREE.Vector3(-Math.cos(SUN.elevation) * Math.SQRT1_2, Math.sin(SUN.elevation), Math.cos(SUN.elevation) * Math.SQRT1_2).normalize();

export type Lights = { group: THREE.Group; update(t: number): void; sun: THREE.DirectionalLight; follow?(x: number, z: number): void };

export function createLights(): Lights {
  const group = new THREE.Group();
  group.name = 'lights';
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = -SUN.half; c.right = SUN.half; c.top = SUN.half; c.bottom = -SUN.half; c.near = 5; c.far = SUN.dist + 40;
  c.updateProjectionMatrix();
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
  group.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0x9fd3ff, 0x7a5a3a, 1.9);
  // Un filo di viola della palette (#A64DFF) nell'ambiente: spinge le ombre verso il blu-viola.
  const amb = new THREE.AmbientLight(0xa64dff, 0.18);
  group.add(hemi, amb);

  // Il sole segue il bersaglio con passo pari a un texel della shadow map: le ombre non "strisciano" quando la camera si muove.
  const texel = (SUN.half * 2) / 1024;
  const lightRot = new THREE.Matrix4().lookAt(DIR, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
  const inv = lightRot.clone().invert();
  const tmp = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const place = () => {
    tmp.copy(aim).applyMatrix4(inv);
    tmp.x = Math.round(tmp.x / texel) * texel; tmp.y = Math.round(tmp.y / texel) * texel;
    tmp.applyMatrix4(lightRot);
    sun.target.position.copy(tmp);
    sun.position.copy(tmp).addScaledVector(DIR, SUN.dist);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  };
  const api: Lights = {
    group, sun,
    follow: (x, z) => { aim.set(x, 0, z); place(); },
    update: () => {},
  };
  // Adattatore: world.ts (WP0) scrive sun.position/sun.target a mano; scene.ts chiama questo prima di ogni render
  // e riallinea il sole alla direzione e al passo giusti usando il bersaglio che world ha impostato.
  group.userData.preRender = () => { aim.set(sun.target.position.x, 0, sun.target.position.z); place(); };
  place();
  return api;
}
