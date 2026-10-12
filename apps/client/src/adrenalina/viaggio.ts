// Il viaggio in funivia fino alla vetta (passo 3b, birbasan 12 ott 2026): 4-5 s in cabina che sale sopra la pista, con la montagna e la
// valle sotto, fino alla stazione a monte. Solo resa: un cavo, due piloni, la cabina rossa (come quella del mondo, game/adrenalina_funivia.ts)
// e la camera dietro la cabina.
import * as THREE from 'three';
import type { PistaNeve } from '@marea/sim/adrenalina/pista.ts';
import { quotaA } from '@marea/sim/adrenalina/pista.ts';
import { dove, punto } from '@marea/sim/corse/nastro.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';

export type Viaggio = {
  gruppo: THREE.Group;
  /** Il viaggio a `k` (0 = a valle, 1 = in vetta): cabina e camera. */
  vai(k: number, camera: THREE.PerspectiveCamera, t: number): void;
  dispose(): void;
};
export const VIAGGIO_S = 4.6;

export function creaViaggio(p: PistaNeve): Viaggio {
  const P3: [number, number, number] = [0, 0, 0];
  const at = (s: number, lat: number, su: number) => { punto(p.n, s, lat, 0, P3); return new THREE.Vector3(P3[0], quotaA(p, s, lat) + su, P3[2]); };
  // il cavo: sopra la pista, dalla pala (70 m sopra la neve) alla torre della stazione a monte accanto alla partenza (22 m): almeno ~15 m di
  // luce sulla neve lungo tutto il cavo (sopra la cresta convessa della vetta è lì che è più basso)
  const a = at(Math.min(p.n.len * 0.29, 560), 0, 70), b = at(1, -15, 22);
  const dir = b.clone().sub(a), len = dir.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  const parti: THREE.BufferGeometry[] = [];
  for (const s of [-1.2, 1.2]) {
    const mid = a.clone().add(b).multiplyScalar(0.5), side = new THREE.Vector3(1, 0, 0).applyQuaternion(q).multiplyScalar(s);
    parti.push(painted(new THREE.BoxGeometry(0.08, 0.08, len), PAL.neroCaldo, new THREE.Matrix4().compose(mid.add(side), q, new THREE.Vector3(1, 1, 1))));
  }
  // la torre della stazione a monte
  { const g = quotaA(p, 1, -15), h = b.y - g; parti.push(painted(new THREE.BoxGeometry(2.4, h, 2.4), PAL.legnoScuro, M(b.x, g + h / 2, b.z))); parti.push(painted(new THREE.BoxGeometry(4.5, 0.6, 3.5), PAL.rosso, M(b.x, b.y + 0.3, b.z))); }
  for (const t of [0.3, 0.65]) {
    // i piloni poggiano sulla neve sotto il cavo
    const c = a.clone().lerp(b, t), w = dove(p.n, c.x, c.y, c.z, -1), suolo = quotaA(p, w.s, w.lat) - 1;
    const h = c.y - suolo;
    parti.push(painted(new THREE.BoxGeometry(0.6, h, 0.6), PAL.pietraScura, M(c.x, suolo + h / 2, c.z)));
    parti.push(painted(new THREE.BoxGeometry(4, 0.4, 0.6), PAL.pietraScura, M(c.x, c.y + 0.2, c.z)));
  }
  const gruppo = new THREE.Group(); gruppo.name = 'snowboard_funivia';
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  gruppo.add(new THREE.Mesh(merged(parti), mat));
  const cabina = new THREE.Mesh(merged([
    painted(new THREE.BoxGeometry(0.14, 1.2, 0.14), PAL.pietraScura, M(0, -0.6, 0)),
    painted(new THREE.BoxGeometry(2.2, 2.0, 1.8), PAL.rosso, M(0, -2.3, 0)),
    painted(new THREE.BoxGeometry(2.22, 0.7, 1.5), PAL.acquaBassa, M(0, -2.0, 0)),
    painted(new THREE.BoxGeometry(2.3, 0.18, 1.9), PAL.neroCaldo, M(0, -1.3, 0)),
    painted(new THREE.BoxGeometry(2.3, 0.16, 1.9), PAL.neroCaldo, M(0, -3.3, 0)),
  ]), mat);
  cabina.name = 'snowboard_cabina'; cabina.castShadow = true; gruppo.add(cabina);
  const avanti = dir.clone().setY(0).normalize(), lato = new THREE.Vector3(-avanti.z, 0, avanti.x);
  const occhio = new THREE.Vector3(), mira = new THREE.Vector3();
  return {
    gruppo,
    vai(k, camera, t) {
      const e = k * k * (3 - 2 * k), c = a.clone().lerp(b, 0.03 + e * 0.94);
      cabina.position.copy(c); cabina.rotation.set(0, Math.atan2(avanti.x, avanti.z), Math.sin(t * 2.2) * 0.03); // dondola un filo
      // la camera dietro e un po' di lato, guarda la cabina e la montagna davanti: all'inizio più larga, poi stringe sulla stazione
      occhio.copy(c).addScaledVector(avanti, -16).addScaledVector(lato, 7).add(new THREE.Vector3(0, 5 - e * 2, 0));
      mira.copy(c).addScaledVector(avanti, 60).add(new THREE.Vector3(0, -25 + e * 18, 0));
      camera.position.copy(occhio); camera.up.set(0, 1, 0); camera.lookAt(mira);
      if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
    },
    dispose() { gruppo.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); mat.dispose(); },
  };
}
