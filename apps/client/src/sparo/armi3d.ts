// Le tre armi del banco (#355) fatte di scatole a colori di palette (come il segnaposto dell'avatar: un materiale, un draw call):
// pistola, mitra, fucile a pompa. Spazio dell'arma: la canna verso −Z, l'impugnatura nell'origine (dove sta la mano destra), +Y in su.
// Per la prima persona c'è la versione «in mano»: la stessa arma coi guanti e le maniche, vista dalla camera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeBoxes, vertexMat } from '../game/avatar.ts';
import type { Box } from '../game/avatar.ts';
import { P } from '../render/island_parts.ts';

export type ArmaModello = {
  id: string;
  /** Dove esce il colpo (lampo e scia), dove sta la mano sinistra, dove esce il bossolo (spazio dell'arma). */
  bocca: THREE.Vector3; sinistra: THREE.Vector3; espulsione: THREE.Vector3;
  /** Altezza della linea di mira sopra l'impugnatura: in mira la camera ci guarda dentro. */
  mirino: number;
  geo: THREE.BufferGeometry;
};

const B = (s: [number, number, number], at: [number, number, number], c: string, rx?: number): Box => ({ s, at, c, ...(rx ? { rx } : {}) });

const MODELLI: Record<string, () => Omit<ArmaModello, 'geo'> & { boxes: Box[] }> = {
  pistola: () => ({
    id: 'pistola', bocca: new THREE.Vector3(0, 0.035, -0.17), sinistra: new THREE.Vector3(-0.02, -0.05, 0.0), espulsione: new THREE.Vector3(0.02, 0.05, -0.03), mirino: 0.062,
    boxes: [
      B([0.034, 0.038, 0.19], [0, 0.035, -0.07], P.roccia),
      B([0.03, 0.03, 0.15], [0, 0.002, -0.05], P.neroCaldo),
      B([0.03, 0.11, 0.046], [0, -0.06, 0.012], P.legnoScuro, 0.22),
      B([0.008, 0.03, 0.045], [0, -0.024, -0.035], P.neroCaldo),
      B([0.006, 0.012, 0.006], [0, 0.06, -0.155], P.pietraChiara),
      B([0.026, 0.012, 0.008], [0, 0.058, 0.012], P.neroCaldo),
    ],
  }),
  mitra: () => ({
    id: 'mitra', bocca: new THREE.Vector3(0, 0.045, -0.43), sinistra: new THREE.Vector3(0, -0.005, -0.25), espulsione: new THREE.Vector3(0.03, 0.05, -0.09), mirino: 0.1,
    boxes: [
      B([0.046, 0.07, 0.3], [0, 0.03, -0.1], P.roccia),
      B([0.05, 0.052, 0.17], [0, 0.034, -0.27], P.pietraScura),
      B([0.022, 0.022, 0.1], [0, 0.045, -0.38], P.neroCaldo),
      B([0.03, 0.13, 0.05], [0, -0.065, -0.12], P.neroCaldo, -0.25),
      B([0.032, 0.1, 0.045], [0, -0.045, 0.025], P.neroCaldo, 0.3),
      B([0.03, 0.06, 0.2], [0, 0.02, 0.15], P.roccia),
      B([0.036, 0.085, 0.022], [0, 0.012, 0.255], P.neroCaldo),
      B([0.028, 0.034, 0.06], [0, 0.083, -0.06], P.neroCaldo),
      B([0.008, 0.008, 0.004], [0, 0.09, -0.031], P.rosso),
      B([0.03, 0.06, 0.035], [0, -0.03, -0.25], P.neroCaldo),
    ],
  }),
  pompa: () => ({
    id: 'pompa', bocca: new THREE.Vector3(0, 0.05, -0.6), sinistra: new THREE.Vector3(0, 0.0, -0.31), espulsione: new THREE.Vector3(0.03, 0.05, -0.06), mirino: 0.075,
    boxes: [
      B([0.046, 0.066, 0.2], [0, 0.03, -0.05], P.neroCaldo),
      B([0.028, 0.028, 0.44], [0, 0.05, -0.37], P.roccia),
      B([0.024, 0.024, 0.36], [0, 0.017, -0.33], P.roccia),
      B([0.044, 0.044, 0.13], [0, 0.017, -0.3], P.legno),
      B([0.036, 0.07, 0.26], [0, 0.0, 0.17], P.legno, 0.12),
      B([0.03, 0.085, 0.05], [0, -0.04, 0.05], P.legno, 0.35),
      B([0.04, 0.09, 0.02], [0, -0.012, 0.3], P.legnoScuro, 0.12),
      B([0.006, 0.009, 0.006], [0, 0.068, -0.58], P.pietraChiara),
    ],
  }),
};

const cache = new Map<string, ArmaModello>();
export function modelloArma(id: string): ArmaModello {
  let m = cache.get(id);
  if (!m) {
    const d = (MODELLI[id] ?? MODELLI.pistola!)();
    m = { id: d.id, bocca: d.bocca, sinistra: d.sinistra, espulsione: d.espulsione, mirino: d.mirino, geo: mergeBoxes(d.boxes) };
    cache.set(id, m);
  }
  return m;
}

/** Una scatola da `a` a `b` (spazio dell'arma) larga `l`: avambracci e maniche. */
function tratto(a: THREE.Vector3, b: THREE.Vector3, l: number, h: number, col: string): THREE.BufferGeometry {
  const len = a.distanceTo(b), g = mergeBoxes([{ s: [l, h, len], at: [0, 0, -len / 2], c: col }]);
  const o = new THREE.Object3D(); o.position.copy(a); o.lookAt(b); o.rotateY(Math.PI); o.updateMatrix();
  g.applyMatrix4(o.matrix);
  return g;
}

const GUANTO = P.neroCaldo, MANICA = P.acquaProfonda, POLSINO = P.pietraScura;
/** L'arma in mano per la prima persona: arma + guanti + avambracci verso il basso dello schermo. Spazio dell'arma (come sopra). */
export function armaInMano(id: string): THREE.Mesh {
  const m = modelloArma(id), parti: THREE.BufferGeometry[] = [m.geo.clone()];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // mano destra sull'impugnatura, avambraccio che scende verso destra e indietro
  const md = v(0.005, -0.055, 0.03), gomD = v(0.17, -0.34, 0.36);
  parti.push(mergeBoxes([{ s: [0.05, 0.06, 0.07], at: [md.x, md.y, md.z], c: GUANTO }]));
  parti.push(tratto(v(md.x + 0.01, md.y - 0.02, md.z + 0.04), gomD, 0.058, 0.064, MANICA), tratto(v(md.x + 0.006, md.y - 0.01, md.z + 0.035), v(0.03, -0.09, 0.09), 0.062, 0.068, POLSINO));
  // mano sinistra sotto l'astina (o a sostegno della pistola), avambraccio verso sinistra
  const ms = m.sinistra.clone().add(v(0, -0.025, 0)), gomS = id === 'pistola' ? v(-0.16, -0.34, 0.34) : v(-0.15, -0.3, 0.16);
  parti.push(mergeBoxes([{ s: [0.055, 0.05, 0.075], at: [ms.x, ms.y, ms.z], c: GUANTO }]));
  parti.push(tratto(v(ms.x - 0.01, ms.y - 0.02, ms.z + 0.03), gomS, 0.058, 0.064, MANICA));
  const g = mergeGeometries(parti.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  const mesh = new THREE.Mesh(g, vertexMat());
  mesh.name = 'arma_' + id; mesh.frustumCulled = false;
  return mesh;
}

/** L'arma da sola (terza persona, nemici). */
export function armaVista(id: string): THREE.Mesh {
  const mesh = new THREE.Mesh(modelloArma(id).geo, vertexMat());
  mesh.name = 'arma3p_' + id;
  return mesh;
}
