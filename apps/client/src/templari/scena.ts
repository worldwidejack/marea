// Scena dell'arena dei Templari (docs/TEMPLARI.md §3): l'isola di notte vista da vicino. Pavimento dipinto a pixel cella per cella in una
// sola texture (lastre della chiesa, terra e erba del sagrato, buio oltre), muri diroccati in un InstancedMesh (quelli tra la camera e l'eroe
// si abbassano mentre ci passi, come nel dungeon), colonne, stalli e macerie, finestre con le assi (spariscono quando gli zombie le strappano),
// porte sbarrate, altare con le candele. Luce di luna fredda, candele e bracieri caldi che tremano a scatti. Solo colori della palette.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import { P } from '../render/island_parts.ts';

export type Scena = {
  scene: THREE.Scene;
  /** Ogni frame: muri verso la camera, fiamme, assi delle finestre. */
  update(hx: number, hz: number, t: number, assi: readonly number[]): void;
  /** Porte aperte (passo 5): la porta sparisce. */
  setPorte(aperte: Record<string, boolean>): void;
  stats(): { muri: number; bassi: number; assi: number; luci: number };
  dispose(): void;
};

const PX = 8; // texel per metro del pavimento
const H_MURO = [2.6, 3.4, 3.0, 3.8, 2.2, 3.6, 3.1, 2.8]; // altezze dei muri diroccati (per cella, dal hash)
const BASSO = 0.7;

/** Pavimento: una texture a pixel per tutta l'arena. */
function pavimento(a: Arena): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = a.w * PX; cv.height = a.h * PX;
  const g = cv.getContext('2d')!;
  const px = (c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // distanza (celle) dalla terra o dal pavimento più vicini, per il buio a bande oltre il sagrato
  const W = a.w, H = a.h, d = new Int16Array(W * H).fill(999), q: number[] = [];
  for (let i = 0; i < W * H; i++) if (a.cell[i] !== C.fuori) { d[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, cx = i % W, cz = (i - cx) / W;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, nz = cz + dz, j = nz * W + nx;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H || d[j]! <= d[i]! + 1) continue;
      d[j] = d[i]! + 1; q.push(j);
    }
  }
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx, k = a.cell[i]!, x0 = cx * PX, y0 = cz * PX, hh = (s: number) => cellHash(cx, cz, s);
    if (k === C.fuori) {
      const dd = d[i]!;
      px(dd <= 2 ? P.boscoOmbra : dd <= 5 ? PAL.ombraCalda : PAL.neroCaldo, x0, y0, PX, PX);
      if (dd <= 3) for (let s = 0; s < 3; s++) if (hh(s) < 0.5) px(PAL.bosco, x0 + Math.floor(hh(s + 9) * PX), y0 + Math.floor(hh(s + 19) * PX));
      continue;
    }
    if (k === C.terra) {
      px(hh(1) < 0.5 ? PAL.bosco : P.boscoOmbra, x0, y0, PX, PX);
      for (let s = 0; s < 7; s++) { const c = hh(s + 2); px(c < 0.3 ? PAL.erbaScura : c < 0.55 ? PAL.legnoScuro : c < 0.62 ? PAL.roccia : P.boscoOmbra, x0 + Math.floor(hh(s + 30) * PX), y0 + Math.floor(hh(s + 40) * PX), 1, 1 + (c < 0.3 ? 1 : 0)); }
      continue;
    }
    // pietra: lastre da 2 m con le fughe scure, crepe, qualche lastra rotta
    const lastra = (Math.floor(cx / 2) + Math.floor(cz / 2)) % 2 === 0;
    px(lastra ? PAL.pietraScura : PAL.roccia, x0, y0, PX, PX);
    if (cx % 2 === 0) px(PAL.neroCaldo, x0, y0, 1, PX);
    if (cz % 2 === 0) px(PAL.neroCaldo, x0, y0, PX, 1);
    for (let s = 0; s < 4; s++) if (hh(s + 50) < 0.45) px(lastra ? PAL.pietra : PAL.pietraScura, x0 + 1 + Math.floor(hh(s + 60) * (PX - 2)), y0 + 1 + Math.floor(hh(s + 70) * (PX - 2)));
    if (hh(80) < 0.08) for (let s = 0; s < PX - 2; s++) px(PAL.neroCaldo, x0 + s, y0 + 2 + Math.floor(hh(81 + s) * 2)); // crepa
    if (hh(90) < 0.05) px(PAL.erbaScura, x0 + 2, y0 + 3, 2, 1); // erba tra le pietre
  }
  // corsia rossa dalla rotonda all'altare (passatoia lacera)
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx;
    if (a.cell[i] !== C.pavimento || Math.abs(cz + 0.5 - a.altare.z) > 0.9 || cx + 0.5 < a.altare.x - 14 || cx + 0.5 > a.altare.x - 1.5) continue;
    for (let y = 1; y < PX - 1; y++) for (let x = 0; x < PX; x++) if (cellHash(cx * PX + x, cz * PX + y, 3) > 0.12) px(cellHash(cx * PX + x, cz * PX + y, 4) < 0.2 ? PAL.ombraCalda : PAL.rosso, cx * PX + x, cz * PX + y);
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Texture dei muri: conci di pietra a pixel (16 × 32 per una cella da 1 × 2 m). */
function conci(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 32;
  const g = cv.getContext('2d')!;
  g.fillStyle = PAL.pietra; g.fillRect(0, 0, 16, 32);
  for (let r = 0; r < 8; r++) {
    const y = r * 4, off = r % 2 ? 4 : 0;
    g.fillStyle = PAL.pietraScura; g.fillRect(0, y, 16, 1);
    for (let x = off; x < 16; x += 8) g.fillRect(x, y, 1, 4);
    for (let k = 0; k < 3; k++) { g.fillStyle = cellHash(r, k, 5) < 0.5 ? PAL.pietraChiara : PAL.pietraScura; g.fillRect(Math.floor(cellHash(r, k, 6) * 15), y + 1 + Math.floor(cellHash(r, k, 7) * 3), 1, 1); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const lambert = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function createScena(a: Arena): Scena {
  const scene = new THREE.Scene(); scene.name = 'templari';
  scene.background = new THREE.Color(PAL.neroCaldo);
  const T = a.tile, W = a.w;
  const ctr = (i: number) => ({ x: ((i % W) + 0.5) * T, z: (Math.floor(i / W) + 0.5) * T });
  const disp: { dispose(): void }[] = [];

  // ---- pavimento ----
  const tex = pavimento(a); disp.push(tex);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(a.w * T, a.h * T), lambert({ map: tex }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((a.w * T) / 2, 0, (a.h * T) / 2); floor.name = 'pavimento';
  scene.add(floor); disp.push(floor.geometry, floor.material as THREE.Material);

  // ---- muri: un box per cella, alto quanto il suo hash; quelli verso la camera si abbassano ----
  const muri: number[] = [], colonne: number[] = [], bassi: number[] = [];
  for (let i = 0; i < a.cell.length; i++) {
    const k = a.cell[i]!;
    if (k === C.muro) muri.push(i); else if (k === C.colonna) colonne.push(i); else if (k === C.basso) bassi.push(i);
  }
  const conTex = conci(); disp.push(conTex);
  const muroGeo = new THREE.BoxGeometry(1, 1, 1); muroGeo.translate(0, 0.5, 0);
  const muroMat = lambert({ map: conTex });
  const muro = new THREE.InstancedMesh(muroGeo, muroMat, Math.max(1, muri.length)); muro.name = 'muri'; muro.frustumCulled = false;
  const altezza = muri.map((i) => H_MURO[Math.floor(cellHash(i % W, Math.floor(i / W), 11) * H_MURO.length)]!);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  muri.forEach((i, n) => { const p = ctr(i); muro.setMatrixAt(n, m4.compose(new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion(), new THREE.Vector3(T, altezza[n]!, T))); muro.setColorAt(n, col.set(cellHash(i, 1, 2) < 0.3 ? PAL.pietra : PAL.pietraChiara)); });
  scene.add(muro); disp.push(muroGeo, muroMat);
  // cime dei muri: una fila di conci scuri sopra (si legge il profilo della rovina)
  const colGeo = new THREE.CylinderGeometry(0.4, 0.48, 1, 8); colGeo.translate(0, 0.5, 0);
  const colMat = lambert({ color: PAL.pietraChiara });
  const colonna = new THREE.InstancedMesh(colGeo, colMat, Math.max(1, colonne.length)); colonna.name = 'colonne'; colonna.frustumCulled = false;
  const hCol = colonne.map((i) => (cellHash(i, 4, 4) < 0.25 ? 1.6 : 4.2));
  colonne.forEach((i, n) => { const p = ctr(i); colonna.setMatrixAt(n, m4.compose(new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion(), new THREE.Vector3(1, hCol[n]!, 1))); });
  scene.add(colonna); disp.push(colGeo, colMat);

  // ---- cose basse: stalli del coro (legno), macerie (pietra), altare ----
  const rows = (i: number) => a.cell[i] === C.basso;
  const altareCells = bassi.filter((i) => { const p = ctr(i); return Math.abs(p.x - a.altare.x) < 1.6 && Math.abs(p.z - a.altare.z) < 2; });
  const braCells = new Set([...a.bracieri, ...a.altarini, ...a.casse].map((b) => Math.floor(b.z / T) * W + Math.floor(b.x / T))); // bracieri, altari laterali e casse li disegna chi li conosce
  const resto = bassi.filter((i) => !altareCells.includes(i) && !braCells.has(i) && rows(i));
  const legnoGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9); legnoGeo.translate(0, 0.45, 0);
  const sassoGeo = new THREE.DodecahedronGeometry(0.55, 0);
  const legnoMat = lambert({ color: PAL.legnoScuro }), sassoMat = lambert({ color: PAL.pietra });
  const stalli = resto.filter((i) => { const cx = i % W, cz = Math.floor(i / W); return a.cell[cz * W + cx - 1] === C.basso || a.cell[cz * W + cx + 1] === C.basso; });
  const macerie = resto.filter((i) => !stalli.includes(i));
  const stallo = new THREE.InstancedMesh(legnoGeo, legnoMat, Math.max(1, stalli.length)); stallo.name = 'stalli'; stallo.frustumCulled = false;
  stalli.forEach((i, n) => { const p = ctr(i); stallo.setMatrixAt(n, m4.compose(new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion(), new THREE.Vector3(1.1, 1, 1))); });
  const sasso = new THREE.InstancedMesh(sassoGeo, sassoMat, Math.max(1, macerie.length * 2)); sasso.name = 'macerie'; sasso.frustumCulled = false;
  macerie.forEach((i, n) => {
    const p = ctr(i), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(cellHash(i, 1, 1) * 3, cellHash(i, 2, 2) * 3, 0));
    sasso.setMatrixAt(n * 2, m4.compose(new THREE.Vector3(p.x - 0.15, 0.3, p.z), q, new THREE.Vector3(1.1, 0.8, 1)));
    sasso.setMatrixAt(n * 2 + 1, m4.compose(new THREE.Vector3(p.x + 0.25, 0.2, p.z + 0.2), q.clone().invert(), new THREE.Vector3(0.6, 0.5, 0.7)));
    sasso.setColorAt(n * 2, col.set(PAL.pietra)); sasso.setColorAt(n * 2 + 1, col.set(PAL.pietraScura));
  });
  scene.add(stallo, sasso); disp.push(legnoGeo, sassoGeo, legnoMat, sassoMat);
  // altare: blocco di pietra con la tovaglia bianca, la croce rossa e le candele (che brillano)
  const altare = new THREE.Group(); altare.name = 'altare'; altare.position.set(a.altare.x, 0, a.altare.z);
  const pietraMat = lambert({ color: PAL.pietraChiara }), tovMat = lambert({ color: PAL.pietra }), rossoMat = lambert({ color: PAL.rosso });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); altare.add(me); disp.push(g); return me; };
  add(new THREE.BoxGeometry(1.6, 1.0, 2.8), pietraMat, 0, 0.5, 0);
  add(new THREE.BoxGeometry(1.7, 0.1, 2.9), tovMat, 0, 1.05, 0);
  add(new THREE.BoxGeometry(0.16, 1.3, 0.16), rossoMat, 0.5, 1.75, 0);
  add(new THREE.BoxGeometry(0.16, 0.16, 0.8), rossoMat, 0.5, 2.05, 0);
  const fiammaMat = new THREE.MeshBasicMaterial({ color: PAL.giallo });
  for (const z of [-1.1, -0.6, 0.6, 1.1]) { add(new THREE.BoxGeometry(0.1, 0.35, 0.1), tovMat, -0.3, 1.27, z); add(new THREE.BoxGeometry(0.08, 0.12, 0.08), fiammaMat, -0.3, 1.52, z); }
  scene.add(altare); disp.push(pietraMat, tovMat, rossoMat, fiammaMat);

  // ---- finestre: stipiti e assi (orizzontali nel piano del muro) ----
  const nAssi = a.finestre.length * 5;
  const assiGeo = new THREE.BoxGeometry(1.15, 0.14, 0.09), assiMat = lambert({ color: PAL.legno });
  const assiMesh = new THREE.InstancedMesh(assiGeo, assiMat, Math.max(1, nAssi)); assiMesh.name = 'assi'; assiMesh.frustumCulled = false;
  const stipGeo = new THREE.BoxGeometry(0.22, 2.2, 0.5); stipGeo.translate(0, 1.1, 0);
  const stipMat = lambert({ color: PAL.pietraScura });
  const stipiti = new THREE.InstancedMesh(stipGeo, stipMat, Math.max(1, a.finestre.length * 2 + a.finestre.length)); stipiti.name = 'stipiti'; stipiti.frustumCulled = false;
  const assiM: THREE.Matrix4[] = [];
  a.finestre.forEach((f, n) => {
    const nx = f.fuori.x - f.dentro.x, nz = f.fuori.z - f.dentro.z, yaw = Math.atan2(nx, nz); // normale del muro
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const lato = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    for (const s of [-1, 1]) stipiti.setMatrixAt(n * 3 + (s > 0 ? 1 : 0), m4.compose(new THREE.Vector3(f.x + lato.x * s * 0.55, 0, f.z + lato.z * s * 0.55), q, new THREE.Vector3(1, 1, 1)));
    stipiti.setMatrixAt(n * 3 + 2, m4.compose(new THREE.Vector3(f.x, 2.2, f.z), q, new THREE.Vector3(6, 0.15, 1.1))); // architrave
    for (let k = 0; k < 5; k++) {
      const tilt = (cellHash(n, k, 3) - 0.5) * 0.5;
      const qq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
      assiM.push(new THREE.Matrix4().compose(new THREE.Vector3(f.x + nx * 0.25, 0.45 + k * 0.33, f.z + nz * 0.25), qq, new THREE.Vector3(1, 1, 1)));
      assiMesh.setMatrixAt(n * 5 + k, assiM[n * 5 + k]!);
      assiMesh.setColorAt(n * 5 + k, col.set(k % 2 ? PAL.legno : PAL.legnoChiaro));
    }
  });
  scene.add(assiMesh, stipiti); disp.push(assiGeo, assiMat, stipGeo, stipMat);

  // ---- porte sbarrate: battenti di legno con la croce rossa ----
  const porte = new Map<string, THREE.Group>();
  const portaMat = lambert({ color: PAL.legnoScuro }), ferroMat = lambert({ color: PAL.roccia });
  for (const p of a.porte) {
    const g = new THREE.Group(); g.name = 'porta_' + p.id;
    for (const i of p.celle) {
      const c = ctr(i);
      const b = new THREE.Mesh(new THREE.BoxGeometry(T, 2.6, T * 0.9), portaMat); b.position.set(c.x, 1.3, c.z); g.add(b); disp.push(b.geometry);
      const f = new THREE.Mesh(new THREE.BoxGeometry(T * 1.02, 0.12, T * 0.95), ferroMat); f.position.set(c.x, 1.8, c.z); g.add(f); disp.push(f.geometry);
    }
    const c0 = ctr(p.celle[0]!), c1 = ctr(p.celle[p.celle.length - 1]!), cx = (c0.x + c1.x) / 2, cz = (c0.z + c1.z) / 2;
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), rossoMat); v.position.set(cx, 1.4, cz); g.add(v); disp.push(v.geometry);
    const o2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.7), rossoMat); o2.position.set(cx, 1.6, cz); g.add(o2); disp.push(o2.geometry);
    scene.add(g); porte.set(p.id, g);
  }
  disp.push(portaMat, ferroMat);

  // ---- luci: luna fredda dall'alto, ambiente viola, lanterna sull'eroe, candele e bracieri ----
  const hemi = new THREE.HemisphereLight(PAL.acquaProfonda, PAL.ombraCalda, 0.9);
  const amb = new THREE.AmbientLight(PAL.viola, 0.18);
  const luna = new THREE.DirectionalLight(PAL.pietraChiara, 0.75); luna.position.set(-30, 50, -20);
  const lanterna = new THREE.PointLight(PAL.arancio, 7, 9, 1.5);
  const candele = new THREE.PointLight(PAL.giallo, 7, 9, 1.6); candele.position.set(a.altare.x - 1.6, 3.2, a.altare.z);
  // bracieri: al centro della rotonda e all'arco del presbiterio (celle 'b' della mappa)
  const bracieri = a.bracieri;
  const fuochi = bracieri.map((b) => { const l = new THREE.PointLight(PAL.arancio, 16, 11, 1.6); l.position.set(b.x, 1.6, b.z); scene.add(l); return l; });
  const braGeo = new THREE.CylinderGeometry(0.42, 0.25, 0.4, 6); braGeo.translate(0, 0.9, 0);
  const piedeGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.9, 5); piedeGeo.translate(0, 0.45, 0);
  const fiaGeo = new THREE.ConeGeometry(0.28, 0.6, 5); fiaGeo.translate(0, 1.35, 0);
  const fiaMat = new THREE.MeshBasicMaterial({ color: PAL.arancio });
  const fiamme: THREE.Mesh[] = [];
  for (const b of bracieri) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
    g.add(new THREE.Mesh(braGeo, ferroMat), new THREE.Mesh(piedeGeo, ferroMat));
    const f = new THREE.Mesh(fiaGeo, fiaMat); g.add(f); fiamme.push(f);
    scene.add(g);
  }
  disp.push(braGeo, piedeGeo, fiaGeo, fiaMat);
  scene.add(hemi, amb, luna, luna.target, lanterna, candele);

  // ---- muri verso la camera: la camera guarda da sud-est, i muri in una fascia a sud-est dell'eroe si abbassano ----
  let lastCell = -1, bassiN = 0;
  const sc = new THREE.Vector3(), pos = new THREE.Vector3(), qi = new THREE.Quaternion();
  function abbassa(hx: number, hz: number): void {
    const hcx = Math.floor(hx / T), hcz = Math.floor(hz / T);
    bassiN = 0;
    muri.forEach((i, n) => {
      const dx = (i % W) - hcx, dz = Math.floor(i / W) - hcz;
      const basso = dx + dz >= 1 && dx + dz <= 11 && Math.abs(dx - dz) <= 7;
      if (basso) bassiN++;
      const p = ctr(i);
      muro.setMatrixAt(n, m4.compose(pos.set(p.x, 0, p.z), qi, sc.set(T, basso ? BASSO : altezza[n]!, T)));
    });
    muro.instanceMatrix.needsUpdate = true;
    colonne.forEach((i, n) => {
      const dx = (i % W) - hcx, dz = Math.floor(i / W) - hcz, basso = dx + dz >= 1 && dx + dz <= 6 && Math.abs(dx - dz) <= 4;
      const p = ctr(i);
      colonna.setMatrixAt(n, m4.compose(pos.set(p.x, 0, p.z), qi, sc.set(1, basso ? 0.9 : hCol[n]!, 1)));
    });
    colonna.instanceMatrix.needsUpdate = true;
  }

  let assiOra = '', poolT = -1;
  return {
    scene,
    update(hx, hz, t, assi) {
      const hc = Math.floor(hz / T) * W + Math.floor(hx / T);
      if (hc !== lastCell) { lastCell = hc; abbassa(hx, hz); }
      lanterna.position.set(hx, 2.4, hz);
      luna.target.position.set(hx, 0, hz); luna.position.set(hx - 30, 50, hz - 20);
      const key = assi.join(',');
      if (key !== assiOra) {
        assiOra = key;
        a.finestre.forEach((_, n) => { for (let k = 0; k < 5; k++) assiMesh.setMatrixAt(n * 5 + k, k < (assi[n] ?? 0) ? assiM[n * 5 + k]! : ZERO); });
        assiMesh.instanceMatrix.needsUpdate = true;
      }
      // fiamme a scatti (8 al secondo)
      const step = Math.floor(t * 8);
      if (step !== poolT) {
        poolT = step;
        fuochi.forEach((l, n) => { l.intensity = 14 + 5 * cellHash(step, n, 5); fiamme[n]!.scale.set(1, 0.8 + 0.45 * cellHash(step, n, 6), 1); });
        candele.intensity = 6 + 2 * cellHash(step, 9, 7);
      }
    },
    setPorte(aperte) { for (const [id, g] of porte) g.visible = !aperte[id]; },
    stats: () => ({ muri: muri.length, bassi: bassiN, assi: assiOra.split(',').reduce((s, x) => s + Number(x || 0), 0), luci: 3 + fuochi.length }),
    dispose() { for (const d of disp) d.dispose(); scene.clear(); },
  };
}
