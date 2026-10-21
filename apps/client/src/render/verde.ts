// Vegetazione: alberi (pino marittimo, latifoglia, olivo, mischiati), cespugli coi fiori, siepi a ciuffi e prato coi ciuffi d'erba.
// Le chiome sono ciuffi di icosaedri coi vertici smossi, non palle; ogni faccia prende il tono della sua pendenza (sotto ombra, sopra
// luce), come una stampa. Solo colori della palette, facce piatte. island.ts li usa al posto di `albero_tondo`, `cespuglio`, `siepe`
// e dei moduli glTF del prato.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRng } from '@marea/sim';
import type { Rng } from '@marea/sim';
import { M, merged, painted } from './island_parts.ts'; // (solo dentro le funzioni: island_parts importa questo file)
import { PALETTE as P } from './palette.ts';

type G = THREE.BufferGeometry;
/** Toni dal basso all'alto: [ombra, fianco, sopra, luce]. */
type Toni = readonly [string, string, string, string];
const PINO: Toni = [P.boscoOmbra, P.bosco, P.erbaScura, P.erba];
const FOGLIA: Toni = [P.bosco, P.erbaScura, P.erba, P.erbaChiara];
const CESPO: Toni = [P.bosco, P.erbaScura, P.erba, P.erba];

/** Ciuffo di fogliame: icosaedro coi vertici smossi, ogni faccia col tono della sua pendenza. */
function ciuffo(r: number, m: THREE.Matrix4, toni: Toni, rng: Rng, det = 0, smossa = 0.22): G {
  let g: G = new THREE.IcosahedronGeometry(r, det);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + (rng.next() - 0.5) * 2 * smossa;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  g = g.toNonIndexed(); g.applyMatrix4(m); g.computeVertexNormals();
  const p = g.attributes.position!, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); d.fromBufferAttribute(p, i + 2);
    const ny = b.sub(a).cross(d.sub(a)).normalize().y + (rng.next() - 0.5) * 0.35;
    c.set(ny < -0.25 ? toni[0] : ny < 0.3 ? toni[1] : ny < 0.78 ? toni[2] : toni[3]);
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** Ramo da (x0,y0,z0) a (x1,y1,z1): cilindro aperto a 5 lati che si assottiglia. */
function ramo(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number, c: string): G {
  const v = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), h = v.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  return painted(new THREE.CylinderGeometry(r1, r0, h, 5, 1, true), c, new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, 1)));
}
/** Cuscino di chioma: `n` ciuffi schiacciati attorno a (x,y,z), largo `r`. */
function cuscino(parts: G[], x: number, y: number, z: number, r: number, n: number, toni: Toni, rng: Rng, schiaccia: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.next() * 0.8, d = i === 0 ? 0 : r * (0.45 + rng.next() * 0.35);
    const rr = r * (i === 0 ? 0.62 : 0.38 + rng.next() * 0.18);
    parts.push(ciuffo(rr, M(x + Math.cos(a) * d, y + (i === 0 ? 0.12 : rng.next() * 0.2 - 0.05), z + Math.sin(a) * d, 0, rng.next() * 3, 0, 1, schiaccia, 1), toni, rng));
  }
}

/** I tre alberi: 0 pino marittimo a cuscini piatti, 1 latifoglia a cupola di ciuffi, 2 olivo contorto a nuvolette. */
function costruisciAlbero(tipo: number): G {
  const rng = createRng('albero:' + tipo), parts: G[] = [];
  if (tipo === 0) {
    parts.push(ramo(0, 0, 0, 0.3, 1.8, 0.1, 0.24, 0.17, P.legno), ramo(0.3, 1.8, 0.1, 0.8, 3.4, -0.1, 0.17, 0.12, P.legnoScuro));
    parts.push(ramo(0.35, 2.2, 0.1, -1.0, 2.9, 0.3, 0.09, 0.05, P.legnoScuro), ramo(0.6, 2.9, 0, 1.8, 3.2, 0.5, 0.08, 0.05, P.legnoScuro));
    cuscino(parts, 0.75, 3.75, -0.1, 1.9, 7, PINO, rng, 0.36);
    cuscino(parts, -1.15, 3.05, 0.35, 1.05, 4, PINO, rng, 0.42);
    cuscino(parts, 1.95, 3.35, 0.6, 0.9, 3, PINO, rng, 0.42);
  } else if (tipo === 1) {
    parts.push(ramo(0, 0, 0, 0.05, 1.7, 0, 0.26, 0.2, P.legno));
    for (const [x, y, z] of [[0.8, 2.9, 0.2], [-0.7, 3.0, -0.3], [0.1, 3.4, 0.7]] as const) parts.push(ramo(0.05, 1.6, 0, x, y, z, 0.13, 0.07, P.legnoScuro));
    const ciuffi: [number, number, number, number][] = [[0, 3.3, 0, 1.25], [0.95, 2.95, 0.35, 0.95], [-0.9, 3.0, -0.3, 0.95], [0.2, 2.8, 1.0, 0.85],
      [-0.35, 2.85, -1.0, 0.85], [0.55, 4.05, -0.3, 0.85], [-0.5, 3.95, 0.45, 0.8], [0.15, 4.5, 0.1, 0.6], [1.35, 3.6, -0.5, 0.6], [-1.3, 3.65, 0.6, 0.55]];
    for (const [x, y, z, r] of ciuffi) parts.push(ciuffo(r, M(x, y, z, rng.next(), rng.next() * 3, 0, 1, 0.82, 1), FOGLIA, rng, r > 0.9 ? 1 : 0, 0.16));
  } else {
    parts.push(ramo(0, 0, 0, 0.3, 0.9, 0.1, 0.3, 0.24, P.legnoScuro), ramo(0.3, 0.9, 0.1, -0.1, 1.6, -0.05, 0.24, 0.2, P.legno));
    const punte: [number, number, number][] = [[1.4, 2.6, 0.5], [-1.3, 2.5, -0.4], [0.2, 3.0, -1.2], [-0.2, 3.1, 1.1], [0.5, 3.4, 0]];
    for (const [x, y, z] of punte) parts.push(ramo(-0.05, 1.5, 0, x * 0.85, y - 0.2, z * 0.85, 0.12, 0.05, P.legnoScuro));
    for (const [x, y, z] of punte) cuscino(parts, x, y, z, 0.9, 4, PINO, rng, 0.62);
  }
  return merged(parts);
}
const alberi: G[] = [];
/** L'albero numero `i` di un'isola (prende il posto di `albero_tondo`): i tre tipi a giro. */
export function albero(i: number): G { const t = i % 3; return (alberi[t] ??= costruisciAlbero(t)); }
/** Gli alberi di un'isola in un BatchedMesh (i tre tipi in un draw call), l'istanza `i` è l'albero `i`; gli insetti scuotono quelli del Borgo. */
export function alberiIstanziati(mats: THREE.Matrix4[], mat: THREE.Material, name: string, cast: boolean): THREE.BatchedMesh | null {
  if (!mats.length) return null;
  const tipi = [0, 1, 2].map(albero), bm = new THREE.BatchedMesh(mats.length, tipi.reduce((n, g) => n + g.attributes.position!.count, 0), 0, mat);
  const ids = tipi.map((g) => bm.addGeometry(g));
  mats.forEach((m, i) => bm.setMatrixAt(bm.addInstance(ids[i % 3]!), m));
  bm.castShadow = cast; bm.receiveShadow = true; bm.name = name;
  return bm;
}

/** Cespuglio: un cespo di ciuffi tondi con qualche fiore giallo e bianco. */
export function cespuglio(): G {
  const rng = createRng('cespuglio'), parts: G[] = [];
  cuscino(parts, 0, 0.42, 0, 0.75, 6, CESPO, rng, 0.75);
  for (let i = 0; i < 6; i++) {
    const a = rng.next() * Math.PI * 2, d = 0.3 + rng.next() * 0.45, y = 0.45 + rng.next() * 0.35;
    parts.push(painted(new THREE.OctahedronGeometry(0.09, 0), i % 2 ? P.pietraChiara : P.giallo, M(Math.cos(a) * d, y + (0.75 - d) * 0.4, Math.sin(a) * d)));
  }
  return merged(parts);
}

/** Siepe del Borgo lungo X (1,3 × 0,8 × 0,55 m): una fila di ciuffi con qualche fiore giallo verso la via (−Z). */
export function siepe(): G {
  const rng = createRng('siepe'), parts: G[] = [];
  for (let i = 0; i < 4; i++) parts.push(ciuffo(0.4, M(-0.5 + i * 0.33, 0.42 + rng.next() * 0.08, (rng.next() - 0.5) * 0.12, 0, rng.next() * 3, 0, 1, 1.05, 0.75), CESPO, rng, 0, 0.14));
  for (let i = 0; i < 4; i++) parts.push(painted(new THREE.OctahedronGeometry(0.07, 0), P.giallo, M(-0.5 + i * 0.33 + rng.next() * 0.1, 0.55 + rng.next() * 0.3, -0.27)));
  return merged(parts);
}

/** Ciuffi d'erba e fiorellini sulle celle di prato (`celle`: matrici delle celle, larghe `cella` m), alla quota `y`. I ciuffi sconfinano un
 *  po' oltre la cella, così il bordo del prato non è una riga dritta. Le celle sotto i massi (y < 0) restano nude. */
export function prato(celle: THREE.Matrix4[], cella: number, y: number, seme: string): G | null {
  const rng = createRng('prato:' + seme), parts: G[] = [], cols = [P.erbaScura, P.erba, P.erbaChiara], largo = cella * 1.2;
  for (const m of celle) {
    if (m.elements[13] < -0.01) continue;
    const cx = m.elements[12], cz = m.elements[14];
    for (let k = 0; k < 3; k++) {
      const x = cx + (rng.next() - 0.5) * largo, z = cz + (rng.next() - 0.5) * largo;
      for (let i = 0; i < 3; i++) { // un ciuffo: tre fili (piramidi a 3 lati, 3 triangoli l'una) aperti a ventaglio
        const a = rng.next() * Math.PI * 2, t = 0.25 + rng.next() * 0.35, h = 0.3 * (0.7 + rng.next() * 0.5);
        const g = new THREE.ConeGeometry(0.06, h, 3, 1, true); g.translate(0, h / 2, 0);
        parts.push(painted(g, cols[i]!, M(x + Math.cos(a) * 0.06, y, z + Math.sin(a) * 0.06, Math.sin(a) * t, 0, -Math.cos(a) * t)));
      }
    }
    if (rng.next() < 0.5) for (let i = 0; i < 2 + rng.int(0, 1); i++) { // fiorellini: punte a 4 facce
      const g = new THREE.ConeGeometry(0.07, 0.07, 4, 1, true);
      parts.push(painted(g, i % 2 ? P.pietraChiara : P.giallo, M(cx + (rng.next() - 0.5) * cella, y + 0.14, cz + (rng.next() - 0.5) * cella)));
    }
  }
  return parts.length ? merged(parts) : null;
}
