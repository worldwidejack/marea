// Le catacombe (docs/TEMPLARI.md §12b punto 3) come le vede chi gioca. Sotto: le nicchie coi morti scavate nella roccia (il buco scuro, il
// teschio e le ossa sul ripiano), le torce sui tunnel (fiammelle a scatti, niente luci vere: costano a tutta la scena), ossa e teschi a
// terra, la fucina dei Templari fredda (focolare di pietra con la cappa, la brace spenta, l'incudine, il mantice: si accende al passo 7) e
// le scale che salgono alle grate. Sopra: la bocca delle due grate, il telaio di pietra col buco nero e la cima della scala (la grata di
// ferro è la porta: scena.ts). Il sotto è una mesh e un InstancedMesh, visibili solo per chi è sotto (le draw call dal coro restano quelle).
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C, SUOLO, TIPO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';

export type Catacombe3d = {
  /** L'eroe è sotto: nicchie, torce, ossa, fucina e scale si disegnano solo allora. */
  setSotto(on: boolean): void;
  update(t: number): void;
  stats(): { nicchie: number; torce: number; fucina: boolean; bocche: number; sotto: boolean };
  dispose(): void;
};

const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const CY = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const; // prima sud ed est: le facce che la camera vede

/** Teschio a pixel: la calotta, le orbite e il naso scuri (pivot a terra, guarda verso +Z). */
const teschio = (x: number, y: number, z: number, ry: number, s = 1): Pezzo[] => [
  { g: B(0.22 * s, 0.2 * s, 0.24 * s), c: PAL.sabbiaChiara, x, y: y + 0.1 * s, z, ry },
  { g: B(0.16 * s, 0.07 * s, 0.1 * s), c: PAL.sabbia, x: x + Math.sin(ry) * 0.08 * s, y: y + 0.02 * s, z: z + Math.cos(ry) * 0.08 * s, ry },
  ...[-1, 1].map((k): Pezzo => ({ g: B(0.06 * s, 0.06 * s, 0.02), c: PAL.neroCaldo, x: x + Math.sin(ry) * 0.125 * s + Math.cos(ry) * k * 0.05 * s, y: y + 0.12 * s, z: z + Math.cos(ry) * 0.125 * s - Math.sin(ry) * k * 0.05 * s, ry })),
];
const osso = (x: number, y: number, z: number, ry: number, l = 0.45): Pezzo => ({ g: B(l, 0.06, 0.06), c: PAL.sabbiaChiara, x, y: y + 0.03, z, ry });

/** `piu`: pezzi in più da unire al piano di sotto (gli indizi delle catacombe, indizi3d.ts). */
export function createCatacombe3d(scene: THREE.Scene, a: Arena, piu: Pezzo[] = []): Catacombe3d {
  const T = a.tile, W = a.w, H = a.h;
  const disp: { dispose(): void }[] = [];
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); disp.push(vc);
  const cella = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= H ? C.fuori : a.cell[cz * W + cx]!);
  const libera = (cx: number, cz: number) => { const c = cella(cx, cz); return c === C.pavimento || c === C.terra; };
  const sotto: Pezzo[] = [], sopra: Pezzo[][] = [], torce: THREE.Vector3[] = [];
  let nicchie = 0;

  // ---- le nicchie: sulla faccia della roccia che dà sul tunnel, il buco scuro col ripiano, un teschio e le ossa ----
  for (let i = 0; i < a.tipo.length; i++) {
    if (a.tipo[i] !== TIPO.nicchia) continue;
    const cx = i % W, cz = (i - cx) / W, d = N4.find(([dx, dz]) => libera(cx + dx, cz + dz));
    if (!d) continue;
    nicchie++;
    const ry = Math.atan2(d[0], d[1]), fx = (cx + 0.5 + d[0] * 0.5) * T, fz = (cz + 0.5 + d[1] * 0.5) * T, h = cellHash(cx, cz, 71);
    const lato = (k: number) => ({ x: fx + Math.cos(ry) * k + d[0] * 0.02, z: fz - Math.sin(ry) * k + d[1] * 0.02 });
    for (const y0 of [0.35, 1.15]) {
      const c = lato(0);
      sotto.push({ g: B(0.8, 0.6, 0.06), c: PAL.neroCaldo, x: c.x, y: y0 + 0.3, z: c.z, ry }, { g: B(0.86, 0.08, 0.2), c: PAL.roccia, x: c.x + d[0] * 0.07, y: y0, z: c.z + d[1] * 0.07, ry });
      const s0 = lato(-0.18 + h * 0.2);
      sotto.push(...teschio(s0.x + d[0] * 0.08, y0 + 0.04, s0.z + d[1] * 0.08, ry + (h - 0.5) * 0.8, 0.9));
      const o = lato(0.2);
      sotto.push(osso(o.x + d[0] * 0.1, y0 + 0.04, o.z + d[1] * 0.1, ry + Math.PI / 2 + h, 0.4), osso(o.x + d[0] * 0.12, y0 + 0.1, o.z + d[1] * 0.12, ry + 1.2, 0.36));
    }
  }

  // ---- terra battuta: ossa e teschi sparsi, e le torce sui muri dei tunnel (a nord e a ovest, che la camera vede dritti) ----
  for (let cz = a.sopra; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx;
    if (a.suolo[i] !== SUOLO.catacomba || !libera(cx, cz)) continue;
    const h = (k: number) => cellHash(cx, cz, k), x = (cx + 0.2 + h(1) * 0.6) * T, z = (cz + 0.2 + h(2) * 0.6) * T;
    if (h(3) < 0.07) sotto.push(...teschio(x, 0, z, h(4) * 6, 0.8));
    else if (h(3) < 0.2) sotto.push(osso(x, 0, z, h(4) * 6, 0.3 + h(5) * 0.3));
    const muro = ([[0, -1], [-1, 0]] as const).find(([dx, dz]) => { const t = a.tipo[(cz + dz) * W + cx + dx]; return t === TIPO.roccia; });
    if (muro && h(6) < 0.16 && torce.length < 28 && !torce.some((p) => Math.abs(p.x - (cx + 0.5)) + Math.abs(p.z - (cz + 0.5)) < 4)) {
      const tx = (cx + 0.5 + muro[0] * 0.42) * T, tz = (cz + 0.5 + muro[1] * 0.42) * T;
      sotto.push({ g: B(0.1, 0.35, 0.1), c: PAL.legnoScuro, x: tx, y: 1.6, z: tz }, { g: B(0.16, 0.08, 0.16), c: PAL.roccia, x: tx, y: 1.8, z: tz });
      torce.push(new THREE.Vector3(tx, 1.84, tz));
    }
  }

  // ---- la fucina dei Templari (fredda): focolare di pietra contro il muro, la cappa che sale nella roccia, brace spenta, incudine, mantice ----
  const f = a.fucina;
  if (f) {
    sotto.push(
      { g: B(2.2, 1.0, 1.3), c: PAL.pietraScura, x: f.x, y: 0.5, z: f.z }, { g: B(1.7, 0.08, 0.9), c: PAL.neroCaldo, x: f.x, y: 1.02, z: f.z + 0.05 },
      ...[0, 1, 2, 3, 4].map((k): Pezzo => ({ g: B(0.18, 0.1, 0.16), c: k % 2 ? PAL.roccia : PAL.ombraCalda, x: f.x - 0.6 + k * 0.3, y: 1.08, z: f.z + 0.1 + (k % 3) * 0.12 })), // carbone spento
      { g: B(2.0, 0.9, 1.0), c: PAL.roccia, x: f.x, y: 2.2, z: f.z - 0.15 }, { g: B(1.3, 1.6, 0.7), c: PAL.roccia, x: f.x, y: 3.3, z: f.z - 0.3 }, // la cappa
      { g: B(0.5, 0.55, 0.4), c: PAL.legnoScuro, x: f.x - 1.5, y: 0.55, z: f.z + 0.3 }, { g: B(0.3, 0.3, 0.5), c: PAL.legno, x: f.x - 1.5, y: 0.95, z: f.z + 0.3, rx: 0.3 }, // il mantice
      // l'incudine davanti, su un ceppo
      { g: CY(0.35, 0.4, 0.55, 7), c: PAL.legnoScuro, x: f.x + 0.4, y: 0.275, z: f.z + 2.4 }, { g: B(0.42, 0.22, 0.3), c: PAL.roccia, x: f.x + 0.4, y: 0.66, z: f.z + 2.4 },
      { g: B(0.7, 0.16, 0.34), c: PAL.pietraScura, x: f.x + 0.45, y: 0.85, z: f.z + 2.4 }, { g: B(0.3, 0.1, 0.18), c: PAL.pietraScura, x: f.x + 0.9, y: 0.86, z: f.z + 2.4 },
      { g: B(0.08, 0.08, 0.5), c: PAL.legno, x: f.x + 0.2, y: 0.97, z: f.z + 2.4, ry: 0.4 }, { g: B(0.16, 0.1, 0.12), c: PAL.roccia, x: f.x + 0.1, y: 0.97, z: f.z + 2.2 }, // il martello
    );
  }

  // ---- le grate: sotto la scala che sale nella roccia, sopra il telaio di pietra col buco nero e la cima della scala ----
  let bocche = 0;
  for (const p of a.passaggi) {
    if (!p.porta) continue;
    const b = p.b, dx = b.x - b.davanti.x, dz = b.z - b.davanti.z, ry = Math.atan2(dx, dz);
    for (let k = 0; k < 5; k++) sotto.push({ g: B(0.9, 0.18 + k * 0.22, 0.22), c: k % 2 ? PAL.pietra : PAL.pietraScura, x: b.x - dx * (0.4 - k * 0.2), y: (0.18 + k * 0.22) / 2, z: b.z - dz * (0.4 - k * 0.2), ry });
    const s = p.a;
    // una mesh per bocca: unite, ossario e grotta (lontani) non uscirebbero mai dal frustum
    sopra.push([
      { g: B(0.92, 0.04, 0.92), c: PAL.neroCaldo, x: s.x, y: 0.02, z: s.z },
      ...[-1, 1].flatMap((k): Pezzo[] => [{ g: B(1.1, 0.16, 0.14), c: PAL.pietraScura, x: s.x, y: 0.08, z: s.z + k * 0.5 }, { g: B(0.14, 0.16, 1.1), c: PAL.pietraScura, x: s.x + k * 0.5, y: 0.08, z: s.z }]),
      ...[-1, 1].map((k): Pezzo => ({ g: B(0.06, 0.5, 0.06), c: PAL.legno, x: s.x + k * 0.22, y: 0.2, z: s.z - 0.3 })), { g: B(0.5, 0.05, 0.05), c: PAL.legno, x: s.x, y: 0.3, z: s.z - 0.3 },
    ]);
    bocche++;
  }

  sotto.push(...piu);
  const gSotto = sotto.length ? unisci(sotto) : new THREE.BufferGeometry();
  const mSotto = new THREE.Mesh(gSotto, vc); mSotto.name = 'catacombe'; mSotto.visible = false; scene.add(mSotto);
  const mSopra = sopra.map((ps) => { const g = unisci(ps); disp.push(g); const m = new THREE.Mesh(g, vc); m.name = 'bocche_grate'; scene.add(m); return m; });
  disp.push(gSotto);
  const fiammaG = new THREE.ConeGeometry(0.06, 0.16, 4); fiammaG.translate(0, 0.08, 0);
  const fiammaM = new THREE.MeshBasicMaterial({ color: PAL.arancio });
  const fiamme = new THREE.InstancedMesh(fiammaG, fiammaM, Math.max(1, torce.length)); fiamme.name = 'torce_catacombe'; fiamme.count = torce.length; fiamme.frustumCulled = false; fiamme.visible = false;
  scene.add(fiamme); disp.push(fiammaG, fiammaM);
  const m4 = new THREE.Matrix4(), qi = new THREE.Quaternion(), sc3 = new THREE.Vector3();
  let sottoOra = false, passo = -1;

  return {
    setSotto(on) { if (on === sottoOra) return; sottoOra = on; mSotto.visible = on; fiamme.visible = on; },
    update(t) {
      if (!sottoOra) return;
      const st = Math.floor(t * 8);
      if (st === passo) return;
      passo = st;
      for (let k = 0; k < torce.length; k++) fiamme.setMatrixAt(k, m4.compose(torce[k]!, qi, sc3.set(1.6, 1.3 + 0.8 * (((st + k * 5) * 0.618) % 1), 1.6)));
      fiamme.instanceMatrix.needsUpdate = true;
    },
    stats: () => ({ nicchie, torce: torce.length, fucina: !!f, bocche, sotto: sottoOra }),
    dispose() { scene.remove(mSotto, ...mSopra, fiamme); for (const d of disp) d.dispose(); },
  };
}
