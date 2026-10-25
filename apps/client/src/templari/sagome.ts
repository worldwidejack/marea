// Sagome dei Templari (docs/TEMPLARI.md §3): chi sta dietro un muro (eroi e zombie) si vede lo stesso, come una sagoma a tinta piena
// disegnata solo dove il muro lo copre. Niente buchi nei muri: i muri restano sempre interi.
// Come: una copia di ogni mesh del personaggio (stessa geometria, stesso scheletro) con un materiale a tinta piena e la prova di
// profondità rovesciata (passa solo dove c'è già qualcosa davanti). Si disegna dopo i muri e prima dei personaggi (renderOrder 1 e 2):
// dove il personaggio si vede, ci si ridisegna sopra lui; dove è coperto, resta la sagoma.
// Si accende solo se tra il personaggio e la camera c'è un muro alto (sulla griglia della mappa, `alto`): tombe, botti e muretti bassi
// non fanno sagome che sfarfallano. Gli zombie non si copiano parte per parte (troppe draw call): una figura sola per tutti, un InstancedMesh.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

export type SagomaZombie = { id: number; x: number; z: number; yaw: number; scala: number; cav: boolean };
export type Sagome = {
  /** Ogni frame, dopo eroi e zombie: la camera, gli eroi (il primo sono io), gli zombie vivi. */
  update(cam: THREE.Camera, eroi: readonly THREE.Object3D[], zombie: readonly SagomaZombie[]): void;
  stats(): { eroi: number; zombie: number; copie: number; accese: number };
  dispose(): void;
};

const MAX = 64;
/** Altezze (m) a cui si guarda se il personaggio è coperto: gambe, petto, testa (la sagoma esce solo dove è coperto davvero). */
const QUOTE = [0.4, 1.0, 1.6];
/** Di lato (m, di traverso alla camera): il personaggio è largo, non un punto. */
const LATI = [0, 0.3, -0.3];
/** Fotogrammi in cui la sagoma resta accesa dopo l'ultimo «coperto»: al bordo del muro non sfarfalla. */
const TIENI = 12;

function materiale(c: string): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: c, fog: false, depthWrite: false, depthFunc: THREE.GreaterDepth });
  m.name = 'sagoma';
  return m;
}

/** La figura dello zombie: testa, busto, braccia tese avanti, gambe (alta ~1,8 m, guarda verso -z come i manichini di zombi.ts). */
function figura(): THREE.BufferGeometry {
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  return merged([
    painted(box(0.26, 0.28, 0.26), PAL.rosso, M(0, 1.62, 0)),
    painted(box(0.44, 0.62, 0.28), PAL.rosso, M(0, 1.16, 0)),
    painted(box(0.4, 0.3, 0.3), PAL.rosso, M(0, 0.75, 0)),
    painted(box(0.12, 0.12, 0.55), PAL.rosso, M(-0.2, 1.36, -0.3)),
    painted(box(0.12, 0.12, 0.55), PAL.rosso, M(0.2, 1.36, -0.3)),
    painted(box(0.15, 0.62, 0.17), PAL.rosso, M(-0.11, 0.31, 0)),
    painted(box(0.15, 0.62, 0.17), PAL.rosso, M(0.11, 0.31, 0)),
  ]);
}

export function createSagome(scene: THREE.Scene, alto: (x: number, z: number) => number): Sagome {
  const matIo = materiale(PAL.giallo), matAmico = materiale(PAL.sabbiaChiara), matZ = materiale(PAL.rosso);
  const geoZ = figura();
  const zMesh = new THREE.InstancedMesh(geoZ, matZ, MAX); zMesh.name = 'sagome_zombie'; zMesh.count = 0; zMesh.visible = false;
  zMesh.frustumCulled = false; zMesh.renderOrder = 1; scene.add(zMesh);
  /** Le copie di ogni mesh degli eroi (le mesh nuove, armi cambiate o vestiti, si copiano al frame dopo). */
  const copie = new Map<THREE.Mesh, THREE.Mesh>();
  const cam = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), su = new THREE.Vector3(0, 1, 0);
  let nEroi = 0, nZ = 0;
  const tenuta = new Map<THREE.Object3D | number, number>(); // eroe (oggetto) o zombie (id) → fotogrammi accesi che restano
  const acceso = (chi: THREE.Object3D | number, coperto: boolean) => { const n = coperto ? TIENI : Math.max(0, (tenuta.get(chi) ?? 0) - 1); tenuta.set(chi, n); return n > 0; };

  /** Tra (x, z) e la camera c'è un muro più alto della linea di vista (a fianchi o testa, `k` = scala del personaggio)? */
  function coperto(x: number, z: number, k: number): boolean {
    const dx = cam.x - x, dz = cam.z - z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.5) return false;
    const ux = dx / d, uz = dz / d;
    for (const l of LATI) {
      const x0 = x - uz * l * k, z0 = z + ux * l * k;
      for (const q0 of QUOTE) {
        const y0 = q0 * k, sale = (cam.y - y0) / d;
        for (let r = 0.4; r < d; r += 0.25) {
          const y = y0 + sale * r;
          if (y > 4.5) break; // più in alto di ogni muro
          if (alto(x0 + ux * r, z0 + uz * r) > y) return true;
        }
      }
    }
    return false;
  }

  function copia(src: THREE.Mesh, mat: THREE.Material): void {
    let c = copie.get(src);
    if (!c) {
      const sk = src as THREE.SkinnedMesh;
      if (sk.isSkinnedMesh) { const k = new THREE.SkinnedMesh(sk.geometry, mat); k.bindMode = sk.bindMode; k.bind(sk.skeleton, sk.bindMatrix); c = k; }
      else c = new THREE.Mesh(src.geometry, mat);
      c.name = 'sagoma'; c.userData['sagoma'] = true; c.frustumCulled = false; c.renderOrder = 1; c.visible = false;
      src.add(c); copie.set(src, c);
      src.renderOrder = 2;
    }
    c.material = mat;
  }
  /** Le mesh piene di un eroe (non gli effetti trasparenti, non le copie). */
  function piene(o: THREE.Object3D, fai: (m: THREE.Mesh) => void): void {
    o.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh || m.userData['sagoma'] || (m as unknown as THREE.Points).isPoints) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (mats.some((x) => x.transparent || !x.depthWrite || x.blending !== THREE.NormalBlending)) return;
      fai(m);
    });
  }

  return {
    update(camera, eroi, zombie) {
      camera.getWorldPosition(cam);
      nEroi = 0;
      eroi.forEach((o, i) => {
        const on = acceso(o, o.visible && coperto(o.position.x, o.position.z, 1));
        if (on) nEroi++;
        piene(o, (m) => { copia(m, i === 0 ? matIo : matAmico); copie.get(m)!.visible = on; });
      });
      // le copie di mesh tolte dalla scena (arma cambiata): via
      for (const [src, c] of copie) if (!src.parent) { src.remove(c); copie.delete(src); }
      nZ = 0;
      for (const z of zombie) {
        if (nZ >= MAX || !acceso(z.id, coperto(z.x, z.z, z.cav ? 1.5 : z.scala))) continue;
        const k = z.cav ? 1.5 : z.scala;
        zMesh.setMatrixAt(nZ++, m4.compose(p.set(z.x, 0, z.z), q.setFromAxisAngle(su, z.yaw), s.set(z.cav ? 1.6 : k, k, z.cav ? 2.2 : k)));
      }
      // chi non c'è più (eroe uscito, zombie morto) esce dalla tenuta
      if (tenuta.size > 2 * MAX) { const vivi = new Set<THREE.Object3D | number>([...eroi, ...zombie.map((z) => z.id)]); for (const k of tenuta.keys()) if (!vivi.has(k)) tenuta.delete(k); }
      zMesh.count = nZ; zMesh.visible = nZ > 0;
      if (nZ) zMesh.instanceMatrix.needsUpdate = true;
    },
    stats: () => {
      let accese = 0; // le copie che si disegnano davvero (accese, con tutta la catena dei genitori visibile)
      for (const c of copie.values()) { let p: THREE.Object3D | null = c; while (p && p.visible) p = p.parent; if (!p) accese++; }
      return { eroi: nEroi, zombie: nZ, copie: copie.size, accese };
    },
    dispose() {
      for (const [src, c] of copie) src.remove(c);
      copie.clear();
      scene.remove(zMesh); geoZ.dispose(); matIo.dispose(); matAmico.dispose(); matZ.dispose();
    },
  };
}
