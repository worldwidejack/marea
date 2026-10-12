// Le due camere dello snowboard da scegliere giocando (docs/ADRENALINA.md §10, bozza del 12 ott: `?camera=a` / `?camera=b`):
// - A: alle spalle, bassa e veloce (più adrenalina);
// - B: dall'alto in diagonale come Lonely Mountains (più MAREA, più leggibile sul telefono).
// La direzione che segue è quella della pista (smussata), non quella della tavola: nei trick e nelle cadute la camera non gira.
import * as THREE from 'three';

export type CameraId = 'a' | 'b';
export type Regia = {
  modo: CameraId;
  /** `pos` = tavola, `avanti` = direzione della pista (orizzontale), `destra` della pista; `scatto` = senza smussare (all'inizio). */
  segui(pos: THREE.Vector3, avanti: THREE.Vector3, destra: THREE.Vector3, dt: number, scatto?: boolean): void;
};

const CAM = {
  a: { dietro: 8.5, su: 3.3, lato: 0, guarda: 7, guardaSu: 0.6, fov: 64, lento: 7 },
  b: { dietro: 13, su: 15, lato: 8, guarda: 7, guardaSu: 0, fov: 44, lento: 3.2 },
} as const;

export function creaRegia(camera: THREE.PerspectiveCamera, modo: CameraId): Regia {
  const dir = new THREE.Vector3(0, 0, 1), lat = new THREE.Vector3(1, 0, 0), occhio = new THREE.Vector3(), mira = new THREE.Vector3();
  const vOcchio = new THREE.Vector3(), vMira = new THREE.Vector3();
  let primo = true;
  const r: Regia = {
    modo,
    segui(pos, avanti, destra, dt, scatto) {
      const c = CAM[r.modo], k = scatto || primo ? 1 : 1 - Math.exp(-c.lento * dt);
      dir.lerp(avanti, k).normalize(); lat.lerp(destra, k).normalize();
      vOcchio.copy(pos).addScaledVector(dir, -c.dietro).addScaledVector(lat, c.lato); vOcchio.y += c.su;
      vMira.copy(pos).addScaledVector(dir, c.guarda); vMira.y += c.guardaSu;
      const kp = scatto || primo ? 1 : 1 - Math.exp(-c.lento * 1.6 * dt);
      occhio.lerp(vOcchio, kp); mira.lerp(vMira, kp);
      if (scatto || primo) { occhio.copy(vOcchio); mira.copy(vMira); }
      // mai sotto la tavola (in discesa la camera dietro sta più in alto): almeno `su`·0,6 sopra
      if (occhio.y < pos.y + c.su * 0.6) occhio.y = pos.y + c.su * 0.6;
      primo = false;
      camera.position.copy(occhio); camera.lookAt(mira);
      if (camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    },
  };
  return r;
}
