// Arco nel dungeon (eroe e nemici arcieri). La corda del modello `arm_arco` è un tubo dritto: qui sparisce e la disegna una linea
// (1 draw call), dritta a riposo e a V fino alla cocca quando si tende, con la freccia incoccata. Frecce in volo più grandi del modello
// (che a misura vera è un bastoncino di 1 cm) e con una scia piatta non illuminata dietro, così si vedono anche al buio.
import * as THREE from 'three';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { boxes, object, tintBlade } from './dungeon_kit.ts';

/** Nel modello dell'arco: punte dei flettenti a ±TIP su Y, corda sul lato +Z (verso chi tira). */
const TIP = 0.65, CORDA_Z = 0.17;
/** Freccia (incoccata e in volo): più spessa che lunga, sennò dall'alto è una riga di un pixel. */
export const FRECCIA_S = new THREE.Vector3(2.4, 1.4, 2.4);
const Y = new THREE.Vector3(0, 1, 0);

/** Freccia dal modello (rossa sulla punta se nemica), alla scala di gioco: coda all'origine, punta lungo +Y. */
function freccia(loader: Loader, nemica: boolean): Promise<THREE.Object3D> {
  return object(loader, 'arm_freccia', () => boxes([[0.016, 0.7, 0.016, 0, 0.35, 0, PAL.legnoChiaro]])).then((a) => {
    if (nemica) tintBlade(a, PAL.rosso);
    a.scale.copy(FRECCIA_S);
    return a;
  });
}

// scia: due nastri incrociati dietro la coda (si vede da ogni lato), colore pieno mezzo trasparente
const sciaGeo = (() => {
  const a = new THREE.PlaneGeometry(0.1, 1.1); a.translate(0, -0.5, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a.getAttribute('position').array, ...b.getAttribute('position').array], 3));
  const ia = [...a.getIndex()!.array];
  g.setIndex([...ia, ...ia.map((i) => i + 4)]);
  return g;
})();
const sciaMat: Record<'eroe' | 'nemico', THREE.MeshBasicMaterial> = {
  eroe: new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
  nemico: new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
};

/** Freccia in volo: modello ingrandito più scia. Punta lungo +Y del gruppo (chi la usa lo orienta con la velocità). */
export async function frecciaInVolo(loader: Loader, nemica: boolean): Promise<THREE.Object3D> {
  const g = new THREE.Group();
  g.add(await freccia(loader, nemica), new THREE.Mesh(sciaGeo, sciaMat[nemica ? 'nemico' : 'eroe']));
  return g;
}

export type Arco = {
  /** Corda: null = dritta (a riposo); un punto nello spazio dell'arco = tirata fino lì, con la freccia incoccata se `incocca`. */
  tendi(cocca: THREE.Vector3 | null, incocca: boolean): void;
};

/** Asse dei flettenti nel modello (models_rpg.py, arm_arco): z della curva a |y| crescente. */
const CURVA: readonly (readonly [number, number])[] = [[0, 0], [0.24, 0.01], [0.48, 0.07], [0.66, 0.17]];
const curvaZ = (y: number): number => {
  const a = Math.min(Math.abs(y), 0.66);
  for (let i = 1; i < CURVA.length; i++) {
    const [y0, z0] = CURVA[i - 1]!, [y1, z1] = CURVA[i]!;
    if (a <= y1) return z0 + ((z1 - z0) * (a - y0)) / (y1 - y0);
  }
  return CURVA[CURVA.length - 1]![1];
};

/** Toglie la corda dal modello e ingrossa i flettenti di `spesso` volte attorno al loro asse (2-4 cm veri sono un pixel da lontano);
 *  geometrie clonate, la cache resta com'è. Poi corda disegnata e freccia incoccata come figli. */
export function armaArco(bow: THREE.Object3D, loader: Loader, nemico: boolean, spesso = 1): Arco {
  bow.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone(), p = g.getAttribute('position');
    if (/^mat_lama/.test(m.name)) { // flettenti
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), zc = curvaZ(y); p.setXYZ(i, p.getX(i) * spesso, y, zc + (p.getZ(i) - zc) * spesso); }
    } else for (let i = 0; i < p.count; i++) if (p.getZ(i) > CORDA_Z * 0.7) p.setXYZ(i, 0, 0, 0); // impugnatura sì, corda no
    m.geometry = g;
  });
  const pos = new Float32Array(12), attr = new THREE.BufferAttribute(pos, 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', attr);
  const linea = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: nemico ? PAL.pietraChiara : PAL.sabbiaChiara }));
  linea.frustumCulled = false; linea.name = 'corda'; bow.add(linea);
  const holder = new THREE.Group(); holder.visible = false; bow.add(holder);
  void freccia(loader, nemico).then((a) => holder.add(a));
  const dir = new THREE.Vector3();
  const set = (i: number, x: number, y: number, z: number) => { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; };
  const api: Arco = {
    tendi(c, incocca) {
      const cx = c ? c.x : 0, cy = c ? c.y : 0, cz = c ? c.z : CORDA_Z;
      set(0, 0, TIP, CORDA_Z); set(1, cx, cy, cz); set(2, cx, cy, cz); set(3, 0, -TIP, CORDA_Z);
      attr.needsUpdate = true;
      holder.visible = !!c && incocca;
      if (!holder.visible) return;
      // coda sulla cocca, punta che passa accanto all'impugnatura (la freccia appoggia di fianco all'arco)
      holder.position.set(cx, cy, cz);
      dir.set(-0.035 - cx, -cy, -cz);
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
      holder.quaternion.setFromUnitVectors(Y, dir.normalize());
    },
  };
  api.tendi(null, false);
  return api;
}
