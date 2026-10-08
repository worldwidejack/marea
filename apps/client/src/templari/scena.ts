// Scena dell'arena dei Templari (docs/TEMPLARI.md §3): l'isola di notte vista da vicino. Pavimento dipinto a pixel cella per cella in una
// sola texture (lastre della chiesa, terra del sagrato, acciottolato della piazza, erba del cimitero, sabbia, assito della taverna, buio
// oltre), muri della chiesa e delle case diroccate in un InstancedMesh (quelli tra la camera e l'eroe si abbassano mentre ci passi, come nel
// dungeon), colonne, tende dei pirati, e tutte le cose basse (stalli, muretti, tombe, botti, carretti, cannoni, il pozzo, le leve) in due
// InstancedMesh; finestre con le assi (spariscono quando gli zombie le strappano), porte col prezzo sopra (spariscono quando le compri),
// altare con le candele, le trappole: la brace del rogo sulla passatoia e la campana grande che oscilla. Luce di luna fredda, candele e
// bracieri caldi che tremano a scatti. Solo colori della palette.
import * as THREE from 'three';
import { TEMPLARI } from '@marea/content/templari.ts';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C, SUOLO, TIPO } from '@marea/sim/templari/mappa.ts';
import type { TView } from '@marea/sim/templari/types.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import { P } from '../render/island_parts.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';
import { createArredi } from './arredi.ts';

export type Scena = {
  scene: THREE.Scene;
  /** Ogni frame: muri verso la camera, fiamme, assi delle finestre, trappole. */
  update(hx: number, hz: number, t: number, assi: readonly number[], trappole: TView['trappole']): void;
  /** Porte aperte: la porta e il suo cartello spariscono. */
  setPorte(aperte: Record<string, boolean>): void;
  /** Il calice dei Templari sull'altare (dopo che l'hai posato; nelle prove ⚔ c'è già). */
  setCalice(visibile: boolean): void;
  stats(): { muri: number; bassi: number; assi: number; luci: number; cose: number; croci: number; usci: number; archi: number; cipressi: number };
  dispose(): void;
};

const PX = 8; // texel per metro del pavimento
const H_MURO = [2.6, 3.4, 3.0, 3.8, 2.2, 3.6, 3.1, 2.8]; // altezze dei muri diroccati (per cella, dal hash)
const H_CASA = [2.2, 2.8, 1.8, 3.0, 2.5, 1.4];
const BASSO = 0.7;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Pavimento: una texture a pixel per tutta l'arena, il suolo di ogni cella dalla mappa. */
function pavimento(a: Arena, centro: { x: number; z: number }): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = a.w * PX; cv.height = a.h * PX;
  const g = cv.getContext('2d')!;
  const px = (c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // distanza (celle) dalla terra o dal pavimento più vicini, per il buio a bande oltre le zone
  // e il suolo più vicino: oltre la sabbia c'è il mare, oltre il resto il bosco scuro
  const W = a.w, H = a.h, d = new Int16Array(W * H).fill(999), q: number[] = [], vicino = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (a.cell[i] !== C.fuori) { d[i] = 0; q.push(i); vicino[i] = a.suolo[i]!; }
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, cx = i % W, cz = (i - cx) / W;
    for (const [dx, dz] of N4) {
      const nx = cx + dx, nz = cz + dz, j = nz * W + nx;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H || d[j]! <= d[i]! + 1) continue;
      d[j] = d[i]! + 1; vicino[j] = vicino[i]!; q.push(j);
    }
  }
  // mare: le celle di fuori vicine alla sabbia collegate al bordo della mappa (le sacche chiuse dentro l'isola restano bosco)
  const acqua = new Uint8Array(W * H), qa: number[] = [];
  const puo = (i: number) => a.cell[i] === C.fuori && vicino[i] === SUOLO.sabbia && d[i]! <= 12;
  for (let i = 0; i < W * H; i++) { const cx = i % W, cz = (i - cx) / W; if ((cz === H - 1 || cx === 0 || cx === W - 1) && puo(i)) { acqua[i] = 1; qa.push(i); } }
  for (let k = 0; k < qa.length; k++) {
    const i = qa[k]!, cx = i % W, cz = (i - cx) / W;
    for (const [dx, dz] of N4) { const nx = cx + dx, nz = cz + dz, j = nz * W + nx; if (nx >= 0 && nz >= 0 && nx < W && nz < H && !acqua[j] && puo(j)) { acqua[j] = 1; qa.push(j); } }
  }
  const mare = (i: number) => acqua[i] === 1;
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx, x0 = cx * PX, y0 = cz * PX, hh = (s: number) => cellHash(cx, cz, s);
    const su = a.cell[i] === C.fuori ? SUOLO.niente : a.suolo[i]!;
    switch (su) {
      case SUOLO.niente: {
        const dd = d[i]!;
        if (mare(i)) { // oltre la spiaggia: il mare
          px(PAL.abisso, x0, y0, PX, PX);
          if (hh(3) < 0.5) px(PAL.acquaProfonda, x0 + Math.floor(hh(4) * 5), y0 + Math.floor(hh(5) * PX), 3, 1);
          break;
        }
        px(dd <= 2 ? P.boscoOmbra : dd <= 5 ? PAL.ombraCalda : PAL.neroCaldo, x0, y0, PX, PX);
        if (dd <= 3) for (let s = 0; s < 3; s++) if (hh(s) < 0.5) px(PAL.bosco, x0 + Math.floor(hh(s + 9) * PX), y0 + Math.floor(hh(s + 19) * PX));
        break;
      }
      case SUOLO.terra:
        px(hh(1) < 0.5 ? PAL.bosco : P.boscoOmbra, x0, y0, PX, PX);
        for (let s = 0; s < 7; s++) { const c = hh(s + 2); px(c < 0.3 ? PAL.erbaScura : c < 0.55 ? PAL.legnoScuro : c < 0.62 ? PAL.roccia : P.boscoOmbra, x0 + Math.floor(hh(s + 30) * PX), y0 + Math.floor(hh(s + 40) * PX), 1, 1 + (c < 0.3 ? 1 : 0)); }
        break;
      case SUOLO.ciottoli: // acciottolato: sassi da 3 px con le fughe scure, file sfalsate
        px(PAL.roccia, x0, y0, PX, PX);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
          const sx = (k * 4 + (r % 2 ? 2 : 0) + (cz % 2) * 1) % PX, c = hh(r * 3 + k + 5);
          px(c < 0.5 ? PAL.pietraScura : c < 0.8 ? PAL.pietra : PAL.roccia, x0 + sx, y0 + r * 4, Math.min(3, PX - sx), 3);
          if (c > 0.35 && c < 0.5) px(PAL.pietra, x0 + sx, y0 + r * 4);
        }
        if (hh(60) < 0.1) px(PAL.erbaScura, x0 + 3, y0 + 3, 1, 2);
        break;
      case SUOLO.erba: // erba alta del cimitero, ciuffi scuri e qualche fiore
        px(hh(1) < 0.5 ? P.boscoOmbra : PAL.bosco, x0, y0, PX, PX);
        for (let s = 0; s < 6; s++) { const c = hh(s + 3); px(c < 0.5 ? PAL.erbaScura : c < 0.9 ? PAL.bosco : PAL.erba, x0 + Math.floor(hh(s + 33) * PX), y0 + Math.floor(hh(s + 43) * (PX - 1)), 1, 2); }
        if (hh(70) < 0.06) px(PAL.pietraChiara, x0 + 2 + Math.floor(hh(71) * 4), y0 + 2 + Math.floor(hh(72) * 4));
        break;
      case SUOLO.sabbia:
        px(PAL.sabbia, x0, y0, PX, PX);
        for (let s = 0; s < 4; s++) { const c = hh(s + 4); px(c < 0.5 ? PAL.legnoChiaro : c < 0.85 ? PAL.sabbiaChiara : PAL.pietraScura, x0 + Math.floor(hh(s + 34) * PX), y0 + Math.floor(hh(s + 44) * PX)); }
        if (hh(5) < 0.3) px(PAL.legnoChiaro, x0 + Math.floor(hh(6) * 4), y0 + Math.floor(hh(7) * 7), 4, 1); // increspature del vento
        // la schiuma sulla riva, dal lato del mare
        if (cz + 1 >= H || mare(i + W)) { px(PAL.acquaBassa, x0, y0 + PX - 2, PX, 1); px(PAL.acqua, x0, y0 + PX - 1, PX, 1); for (let s = 0; s < 3; s++) if (hh(s + 90) < 0.6) px(PAL.sabbiaChiara, x0 + Math.floor(hh(s + 93) * PX), y0 + PX - 3); }
        if (cx > 0 && mare(i - 1)) { px(PAL.acquaBassa, x0 + 1, y0, 1, PX); px(PAL.acqua, x0, y0, 1, PX); }
        if (cx + 1 < W && mare(i + 1)) { px(PAL.acquaBassa, x0 + PX - 2, y0, 1, PX); px(PAL.acqua, x0 + PX - 1, y0, 1, PX); }
        break;
      case SUOLO.assi: // assito della taverna: tavole lungo x, fughe scure, giunte sfalsate
        for (let r = 0; r < 4; r++) {
          const c = cellHash(cx >> 1, cz * 4 + r, 9);
          px(c < 0.5 ? PAL.legno : c < 0.8 ? PAL.legnoScuro : PAL.legnoChiaro, x0, y0 + r * 2, PX, 2);
          px(PAL.ombraCalda, x0, y0 + r * 2 + 1, PX, 1);
          if (hh(r + 80) < 0.3) px(PAL.ombraCalda, x0 + Math.floor(hh(r + 84) * PX), y0 + r * 2, 1, 2);
        }
        break;
      default: { // pietra: lastre da 2 m con le fughe scure, crepe, qualche lastra rotta
        const lastra = (Math.floor(cx / 2) + Math.floor(cz / 2)) % 2 === 0;
        px(lastra ? PAL.pietraScura : PAL.roccia, x0, y0, PX, PX);
        if (cx % 2 === 0) px(PAL.neroCaldo, x0, y0, 1, PX);
        if (cz % 2 === 0) px(PAL.neroCaldo, x0, y0, PX, 1);
        for (let s = 0; s < 4; s++) if (hh(s + 50) < 0.45) px(lastra ? PAL.pietra : PAL.pietraScura, x0 + 1 + Math.floor(hh(s + 60) * (PX - 2)), y0 + 1 + Math.floor(hh(s + 70) * (PX - 2)));
        if (hh(80) < 0.08) for (let s = 0; s < PX - 2; s++) px(PAL.neroCaldo, x0 + s, y0 + 2 + Math.floor(hh(81 + s) * 2)); // crepa
        if (hh(90) < 0.05) px(PAL.erbaScura, x0 + 2, y0 + 3, 2, 1); // erba tra le pietre
      }
    }
  }
  // lastre tombali dei cavalieri nel deambulatorio della rotonda (come le effigie della Temple Church): croce patente e spada incise
  for (const deg of [60, 120, 240, 300]) {
    const ang = (deg * Math.PI) / 180, cx = Math.floor(centro.x + Math.cos(ang) * 7.2), cz = Math.floor(centro.z + Math.sin(ang) * 7.2) - (deg > 180 ? 1 : 0);
    const ok = [0, 1].every((k) => a.suolo[(cz + k) * W + cx] === SUOLO.pietra && a.cell[(cz + k) * W + cx] === C.pavimento);
    if (!ok) continue;
    const x0 = cx * PX, y0 = cz * PX;
    px(PAL.roccia, x0, y0, PX, PX * 2); px(PAL.pietra, x0 + 1, y0 + 1, PX - 2, PX * 2 - 2);
    px(PAL.pietraScura, x0 + 3, y0 + 2, 2, 4); px(PAL.pietraScura, x0 + 2, y0 + 3, 4, 2); // croce
    px(PAL.roccia, x0 + 4, y0 + 7, 1, 7); px(PAL.roccia, x0 + 2, y0 + 8, 5, 1); // spada con l'elsa
    if (deg === 120) px(PAL.erbaScura, x0 + 1, y0 + 13, 2, 1);
  }
  // corsia rossa dalla rotonda all'altare (passatoia lacera: è lì che si accende il rogo)
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx;
    if (a.suolo[i] !== SUOLO.pietra || Math.abs(cz + 0.5 - a.altare.z) > 0.9 || cx + 0.5 < a.altare.x - 14 || cx + 0.5 > a.altare.x - 1.5) continue;
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

/** Cartello del prezzo sopra una porta (gesso giallo su legno scuro). */
function cartello(testo: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 24;
  const g = cv.getContext('2d')!;
  g.fillStyle = PAL.legnoScuro; g.fillRect(0, 0, 64, 24);
  g.fillStyle = PAL.ombraCalda; g.fillRect(0, 21, 64, 3);
  g.fillStyle = PAL.legno; for (let x = 2; x < 62; x += 6) g.fillRect(x, 2, 1, 1);
  g.fillStyle = PAL.giallo; g.font = 'bold 16px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(testo, 32, 12);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const lambert = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial({ flatShading: true, ...o });
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Gruppi di celle vicine (4 vicini) con lo stesso tipo. */
function gruppi(a: Arena, tipo: number): number[][] {
  const seen = new Uint8Array(a.w * a.h), out: number[][] = [];
  for (let i = 0; i < a.tipo.length; i++) {
    if (a.tipo[i] !== tipo || seen[i]) continue;
    const g = [i]; seen[i] = 1;
    for (let k = 0; k < g.length; k++) {
      const c = g[k]!, cx = c % a.w, cz = (c - cx) / a.w;
      for (const [dx, dz] of N4) {
        const nx = cx + dx, nz = cz + dz, j = nz * a.w + nx;
        if (nx < 0 || nz < 0 || nx >= a.w || nz >= a.h || seen[j] || a.tipo[j] !== tipo) continue;
        seen[j] = 1; g.push(j);
      }
    }
    out.push(g);
  }
  return out;
}

export function createScena(a: Arena): Scena {
  const scene = new THREE.Scene(); scene.name = 'templari';
  scene.background = new THREE.Color(PAL.neroCaldo);
  const T = a.tile, W = a.w;
  const ctr = (i: number) => ({ x: ((i % W) + 0.5) * T, z: (Math.floor(i / W) + 0.5) * T });
  const tipoA = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= a.h ? TIPO.niente : a.tipo[cz * W + cx]!);
  const disp: { dispose(): void }[] = [];
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), qq = new THREE.Quaternion(), eu = new THREE.Euler();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // centro della rotonda: il braciere con più colonne attorno (nel Santo Sepolcro lì c'è l'edicola)
  const colonneTutte = [...Array(a.cell.length).keys()].filter((i) => a.cell[i] === C.colonna);
  const centro = a.bracieri.reduce((b, x) => {
    const n = (p: { x: number; z: number }) => colonneTutte.filter((i) => { const c = ctr(i); return (c.x - p.x) * (c.x - p.x) + (c.z - p.z) * (c.z - p.z) < 49; }).length;
    return n(x) > n(b) ? x : b;
  }, a.bracieri[0] ?? { x: a.w / 2, z: a.h / 2 });
  // ---- pavimento ----
  const tex = pavimento(a, centro); disp.push(tex);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(a.w * T, a.h * T), lambert({ map: tex }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((a.w * T) / 2, 0, (a.h * T) / 2); floor.name = 'pavimento';
  scene.add(floor); disp.push(floor.geometry, floor.material as THREE.Material);

  // ---- muri della chiesa e delle case: un box per cella; le case senza tetto (dentro solo travi crollate); quelli verso la camera si abbassano ----
  const muri: number[] = [], colonne: number[] = [], bassi: number[] = [];
  for (let i = 0; i < a.cell.length; i++) {
    const k = a.cell[i]!;
    if (k === C.muro && a.tipo[i] !== TIPO.tenda) muri.push(i); else if (k === C.colonna) colonne.push(i); else if (k === C.basso) bassi.push(i);
  }
  const conTex = conci(); disp.push(conTex);
  const muroGeo = new THREE.BoxGeometry(1, 1, 1); muroGeo.translate(0, 0.5, 0);
  const muroMat = lambert({ map: conTex });
  const muro = new THREE.InstancedMesh(muroGeo, muroMat, Math.max(1, muri.length)); muro.name = 'muri'; muro.frustumCulled = false;
  const altezza = muri.map((i) => {
    const cx = i % W, cz = Math.floor(i / W), h = cellHash(cx, cz, 11);
    if (a.tipo[i] !== TIPO.casa) return H_MURO[Math.floor(h * H_MURO.length)]!;
    const bordo = N4.some(([dx, dz]) => tipoA(cx + dx, cz + dz) !== TIPO.casa);
    return bordo ? H_CASA[Math.floor(h * H_CASA.length)]! : 0.35 + 0.3 * cellHash(cx, cz, 12);
  });
  // una tinta per casa, alla cipriota: intonaco chiaro, mattoni crudi, pietra; l'ossario sull'erba del cimitero è di pietra scura
  const tintaCasa = new Map<number, string>();
  gruppi(a, TIPO.casa).forEach((g, k) => {
    const ossario = g.some((i) => N4.some(([dx, dz]) => a.suolo[i + dz * W + dx] === SUOLO.erba));
    const c = ossario ? PAL.pietraScura : [PAL.sabbiaChiara, PAL.legnoChiaro, PAL.sabbia, PAL.pietra][k % 4]!;
    for (const i of g) tintaCasa.set(i, c);
  });
  muri.forEach((i, n) => {
    const p = ctr(i), casa = a.tipo[i] === TIPO.casa, h = cellHash(i, 1, 2);
    muro.setMatrixAt(n, m4.compose(v(p.x, 0, p.z), qq.identity(), v(T, altezza[n]!, T)));
    muro.setColorAt(n, col.set(casa ? (altezza[n]! < 1 ? PAL.legnoScuro : h < 0.15 ? PAL.pietraScura : tintaCasa.get(i) ?? PAL.sabbia) : h < 0.3 ? PAL.pietra : PAL.pietraChiara));
  });
  scene.add(muro); disp.push(muroGeo, muroMat);
  const colGeo = new THREE.CylinderGeometry(0.4, 0.48, 1, 8); colGeo.translate(0, 0.5, 0);
  const colMat = lambert({ color: PAL.pietraChiara });
  const colonna = new THREE.InstancedMesh(colGeo, colMat, Math.max(1, colonne.length)); colonna.name = 'colonne'; colonna.frustumCulled = false;
  const hCol = colonne.map((i) => (cellHash(i, 4, 4) < 0.25 ? 1.6 : 4.2));
  colonne.forEach((i, n) => { const p = ctr(i); colonna.setMatrixAt(n, m4.compose(v(p.x, 0, p.z), qq.identity(), v(1, hCol[n]!, 1))); });
  scene.add(colonna); disp.push(colGeo, colMat);
  const altezzaDi = new Map(muri.map((i, n) => [i, altezza[n]!]));
  const arredi = createArredi(scene, a, { centro, colonne, hCol, altezza: (i) => altezzaDi.get(i) ?? 0 });

  // ---- tende dei pirati: una piramide di tela per tenda (rossa o grezza, a strisce di colore per tenda) ----
  const tende = gruppi(a, TIPO.tenda);
  const tendaGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); tendaGeo.rotateY(Math.PI / 4); tendaGeo.translate(0, 0.5, 0);
  const tendaMat = lambert({ color: 0xffffff });
  const tenda = new THREE.InstancedMesh(tendaGeo, tendaMat, Math.max(1, tende.length)); tenda.name = 'tende'; tenda.frustumCulled = false;
  tende.forEach((g, n) => {
    const xs = g.map((i) => i % W), zs = g.map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
    tenda.setMatrixAt(n, m4.compose(v(((x0 + x1) / 2) * T, 0, ((z0 + z1) / 2) * T), qq.identity(), v((x1 - x0) * T * 1.05, 2.8, (z1 - z0) * T * 1.05)));
    tenda.setColorAt(n, col.set([PAL.rosso, PAL.sabbiaChiara, PAL.legnoChiaro, PAL.pietra][n % 4]!));
  });
  scene.add(tenda); disp.push(tendaGeo, tendaMat);

  // ---- cose basse: tutto in due InstancedMesh (box e cilindri) coi colori per istanza ----
  type Ist = { x: number; y?: number; z: number; sx: number; sy: number; sz: number; c: string; rx?: number; ry?: number; rz?: number };
  const scatole: Ist[] = [], tubi: Ist[] = [];
  const altareCells = new Set(bassi.filter((i) => a.tipo[i] === TIPO.altare));
  const daAltri = new Set([...a.bracieri, ...a.altarini, ...a.casse].map((b) => Math.floor(b.z / T) * W + Math.floor(b.x / T))); // li disegna chi li conosce
  const sassi: number[] = [];
  for (const i of bassi) {
    if (altareCells.has(i) || daAltri.has(i)) continue;
    const p = ctr(i), cx = i % W, cz = Math.floor(i / W), h = cellHash(cx, cz, 21);
    switch (a.tipo[i]) {
      case TIPO.stallo: scatole.push({ x: p.x, z: p.z, sx: 1, sy: 0.9, sz: 0.9, c: PAL.legnoScuro }); break;
      case TIPO.muretto: scatole.push({ x: p.x, z: p.z, sx: 1.02, sy: 0.75 + 0.25 * h, sz: 1.02, c: h < 0.5 ? PAL.pietraScura : h < 0.85 ? PAL.roccia : PAL.pietra }); break;
      case TIPO.tomba: {
        // la tomba sono due celle (testa a nord): il tipo lo decide la testa. Lastra con croce e spada incise (cavalieri), croce di pietra,
        // croce di legno storta (la gente del borgo), lapide
        const testa = tipoA(cx, cz - 1) !== TIPO.tomba, ht = cellHash(cx, testa ? cz : cz - 1, 21);
        if (ht < 0.3) {
          if (!testa) break;
          scatole.push({ x: p.x, z: p.z + 0.5, sx: 0.8, sy: 0.18, sz: 1.75, c: PAL.pietra }, { x: p.x, y: 0.18, z: p.z + 0.35, sx: 0.08, sy: 0.02, sz: 1.0, c: PAL.roccia }, { x: p.x, y: 0.18, z: p.z + 0.1, sx: 0.46, sy: 0.02, sz: 0.08, c: PAL.roccia });
          break;
        }
        if (!testa) { scatole.push({ x: p.x, z: p.z - 0.2, sx: 0.7, sy: 0.22, sz: 1.1, c: PAL.ombraCalda }); break; } // il tumulo
        if (ht < 0.5) scatole.push({ x: p.x, z: p.z + 0.25, sx: 0.14, sy: 1.15, sz: 0.14, c: PAL.pietra }, { x: p.x, y: 0.72, z: p.z + 0.25, sx: 0.6, sy: 0.14, sz: 0.14, c: PAL.pietra });
        else if (ht < 0.72) { const rz = (h - 0.5) * 0.5; scatole.push({ x: p.x, z: p.z + 0.25, sx: 0.09, sy: 1.0, sz: 0.09, c: PAL.legnoScuro, rz }, { x: p.x - 0.33 * rz, y: 0.66, z: p.z + 0.25, sx: 0.46, sy: 0.08, sz: 0.08, c: PAL.legnoScuro, rz }); }
        else scatole.push({ x: p.x, z: p.z + 0.25, sx: 0.62, sy: 0.7 + 0.35 * h, sz: 0.2, c: h < 0.7 ? PAL.pietraScura : PAL.pietra, rz: (h - 0.5) * 0.3 });
        break;
      }
      case TIPO.leva: break; // sotto, con le trappole
      case TIPO.cosa: break; // sotto, a gruppi
      default: sassi.push(i);
    }
  }
  // cose a gruppi: 2×2 = il pozzo, due in fila = carretto (o cannone sulla sabbia), una = botte
  for (const g of gruppi(a, TIPO.cosa)) {
    const xs = g.map((i) => i % W), zs = g.map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1, cx = ((x0 + x1) / 2) * T, cz = ((z0 + z1) / 2) * T;
    const sabbia = a.suolo[g[0]!] === SUOLO.sabbia;
    if (g.length >= 4) { // pozzo: anello di pietra, due pali e il tetto
      tubi.push({ x: cx, z: cz, sx: 1.7, sy: 0.85, sz: 1.7, c: PAL.pietraScura }, { x: cx, y: 0.84, z: cz, sx: 1.3, sy: 0.02, sz: 1.3, c: PAL.neroCaldo });
      scatole.push({ x: cx - 0.8, z: cz, sx: 0.14, sy: 2, sz: 0.14, c: PAL.legnoScuro }, { x: cx + 0.8, z: cz, sx: 0.14, sy: 2, sz: 0.14, c: PAL.legnoScuro }, { x: cx, y: 2, z: cz, sx: 2, sy: 0.16, sz: 0.9, c: PAL.legno, rx: 0.1 });
    } else if (g.length === 2) {
      const lungoX = x1 - x0 === 2;
      if (sabbia) { // cannone puntato al mare (a sud): canna nera sull'affusto
        scatole.push({ x: cx, z: cz, sx: lungoX ? 1.2 : 0.7, sy: 0.45, sz: lungoX ? 0.7 : 1.2, c: PAL.legnoScuro });
        tubi.push({ x: cx, y: 0.65, z: cz + 0.25, sx: 0.26, sy: 1.6, sz: 0.26, c: PAL.neroCaldo, rx: Math.PI / 2 - 0.15 });
      } else { // carretto rotto
        scatole.push({ x: cx, y: 0.35, z: cz, sx: lungoX ? 1.8 : 1, sy: 0.5, sz: lungoX ? 1 : 1.8, c: PAL.legno, rz: 0.12 });
        for (const s of [-1, 1]) tubi.push({ x: cx + (lungoX ? 0 : s * 0.55), y: 0.4, z: cz + (lungoX ? s * 0.55 : 0), sx: 0.4, sy: 0.1, sz: 0.4, c: PAL.legnoScuro, ...(lungoX ? { rx: Math.PI / 2 } : { rz: Math.PI / 2 }) });
      }
    } else for (const i of g) { const p = ctr(i); tubi.push({ x: p.x, z: p.z, sx: 0.4, sy: 0.85, sz: 0.4, c: cellHash(i, 3, 3) < 0.5 ? PAL.legno : PAL.legnoScuro }, { x: p.x, y: 0.55, z: p.z, sx: 0.42, sy: 0.06, sz: 0.42, c: PAL.roccia }); }
  }
  // trappole: la campana grande su un'incastellatura sopra il passaggio; le leve (palo e manico, il manico cambia con lo stato)
  const leve: { i: number; trap: number }[] = [];
  a.trappole.forEach((t, k) => {
    scatole.push({ x: t.leva.x, z: t.leva.z, sx: 0.18, sy: 1.0, sz: 0.18, c: PAL.legnoScuro }, { x: t.leva.x, y: 0.15, z: t.leva.z, sx: 0.5, sy: 0.3, sz: 0.5, c: PAL.roccia });
    leve.push({ i: scatole.length, trap: k });
    scatole.push({ x: t.leva.x, y: 0.95, z: t.leva.z, sx: 0.1, sy: 0.6, sz: 0.1, c: PAL.rosso });
  });
  const campanaT = a.trappole.find((t) => t.id === 'campana');
  const campana = new THREE.Group(); campana.name = 'campana';
  if (campanaT) {
    const xs = campanaT.celle.map((i) => i % W), zs = campanaT.celle.map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs) - 0.4, x1 = Math.max(...xs) + 1.4, zc = ((Math.min(...zs) + Math.max(...zs) + 1) / 2) * T, xc = ((x0 + x1) / 2) * T;
    for (const x of [x0, x1]) scatole.push({ x: x * T, z: zc, sx: 0.4, sy: 5.6, sz: 0.4, c: PAL.legnoScuro }, { x: x * T, z: zc, sx: 1.4, sy: 0.4, sz: 1.4, c: PAL.pietraScura });
    scatole.push({ x: xc, y: 5.4, z: zc, sx: (x1 - x0) * T + 0.6, sy: 0.4, sz: 0.5, c: PAL.legno });
    campana.position.set(xc, 5.3, zc);
    const g = unisci([
      { g: new THREE.BoxGeometry(0.1, 2.4, 0.1), c: PAL.roccia, y: -1.2 },
      { g: new THREE.CylinderGeometry(0.4, 0.95, 1.5, 8), c: PAL.arancio, y: -3.1 },
      { g: new THREE.CylinderGeometry(1.0, 1.0, 0.14, 8), c: PAL.legnoChiaro, y: -3.85 },
      { g: new THREE.BoxGeometry(0.22, 0.4, 0.22), c: PAL.roccia, y: -4.0 },
    ] satisfies Pezzo[]);
    const mesh = new THREE.Mesh(g, lambert({ vertexColors: true })); campana.add(mesh); disp.push(g, mesh.material as THREE.Material);
    scene.add(campana);
  }
  const scatolaGeo = new THREE.BoxGeometry(1, 1, 1); scatolaGeo.translate(0, 0.5, 0);
  const tuboGeo = new THREE.CylinderGeometry(1, 1, 1, 8); tuboGeo.translate(0, 0.5, 0);
  const coseMat = lambert({ color: 0xffffff });
  const posa = (im: THREE.InstancedMesh, list: Ist[]) => list.forEach((s, n) => {
    im.setMatrixAt(n, m4.compose(v(s.x, s.y ?? 0, s.z), qq.setFromEuler(eu.set(s.rx ?? 0, s.ry ?? 0, s.rz ?? 0)), v(s.sx, s.sy, s.sz)));
    im.setColorAt(n, col.set(s.c));
  });
  const scatola = new THREE.InstancedMesh(scatolaGeo, coseMat, Math.max(1, scatole.length)); scatola.name = 'cose'; scatola.frustumCulled = false; posa(scatola, scatole);
  const tubo = new THREE.InstancedMesh(tuboGeo, coseMat, Math.max(1, tubi.length)); tubo.name = 'botti'; tubo.frustumCulled = false; posa(tubo, tubi);
  scene.add(scatola, tubo); disp.push(scatolaGeo, tuboGeo, coseMat);
  // macerie: due sassi per cella
  const sassoGeo = new THREE.DodecahedronGeometry(0.55, 0), sassoMat = lambert({ color: PAL.pietra });
  const sasso = new THREE.InstancedMesh(sassoGeo, sassoMat, Math.max(1, sassi.length * 2)); sasso.name = 'macerie'; sasso.frustumCulled = false;
  sassi.forEach((i, n) => {
    const p = ctr(i), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(cellHash(i, 1, 1) * 3, cellHash(i, 2, 2) * 3, 0));
    sasso.setMatrixAt(n * 2, m4.compose(v(p.x - 0.15, 0.3, p.z), q, v(1.1, 0.8, 1)));
    sasso.setMatrixAt(n * 2 + 1, m4.compose(v(p.x + 0.25, 0.2, p.z + 0.2), q.clone().invert(), v(0.6, 0.5, 0.7)));
    sasso.setColorAt(n * 2, col.set(PAL.pietra)); sasso.setColorAt(n * 2 + 1, col.set(PAL.pietraScura));
  });
  scene.add(sasso); disp.push(sassoGeo, sassoMat);
  // il rogo: brace e fiamme sulle celle della passatoia (accese solo quando la trappola va)
  const rogoT = a.trappole.findIndex((t) => t.id === 'rogo');
  const rogoCelle = rogoT >= 0 ? a.trappole[rogoT]!.celle : [];
  const rogo = new THREE.InstancedMesh(new THREE.ConeGeometry(0.34, 0.9, 5).translate(0, 0.45, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, rogoCelle.length * 2));
  rogo.name = 'rogo'; rogo.frustumCulled = false; rogo.visible = false; scene.add(rogo); disp.push(rogo.geometry, rogo.material as THREE.Material);
  const rc = rogoCelle.reduce((s, i) => { const p = ctr(i); return { x: s.x + p.x / rogoCelle.length, z: s.z + p.z / rogoCelle.length }; }, { x: 0, z: 0 });
  const luceRogo = new THREE.PointLight(PAL.arancio, 0, 12, 1.5); luceRogo.position.set(rc.x, 1.5, rc.z); scene.add(luceRogo);
  const COL_F = [new THREE.Color(PAL.arancio), new THREE.Color(PAL.giallo), new THREE.Color(PAL.rosso)];

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
  // il calice d'oro coi rubini, davanti alla croce (si accende quando lo posi)
  const caliceGeo = unisci([
    { g: new THREE.CylinderGeometry(0.13, 0.15, 0.05, 8), c: PAL.arancio, y: 0.025 },
    { g: new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6), c: PAL.giallo, y: 0.15 },
    { g: new THREE.OctahedronGeometry(0.06, 0), c: PAL.arancio, y: 0.16 },
    { g: new THREE.CylinderGeometry(0.12, 0.05, 0.16, 8), c: PAL.giallo, y: 0.33 },
    ...[0, 2.1, 4.2].map((r): Pezzo => ({ g: new THREE.BoxGeometry(0.035, 0.035, 0.035), c: PAL.rosso, x: Math.cos(r) * 0.1, y: 0.32, z: Math.sin(r) * 0.1 })),
  ]);
  const caliceAlt = new THREE.Mesh(caliceGeo, new THREE.MeshBasicMaterial({ vertexColors: true })); caliceAlt.name = 'calice';
  caliceAlt.scale.setScalar(1.5); caliceAlt.position.set(0, 1.1, 0); caliceAlt.visible = false; altare.add(caliceAlt); disp.push(caliceGeo, caliceAlt.material as THREE.Material);
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
    for (const s of [-1, 1]) stipiti.setMatrixAt(n * 3 + (s > 0 ? 1 : 0), m4.compose(v(f.x + lato.x * s * 0.55, 0, f.z + lato.z * s * 0.55), q, v(1, 1, 1)));
    stipiti.setMatrixAt(n * 3 + 2, m4.compose(v(f.x, 2.2, f.z), q, v(6, 0.15, 1.1))); // architrave
    for (let k = 0; k < 5; k++) {
      const tilt = (cellHash(n, k, 3) - 0.5) * 0.5;
      const qk = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
      assiM.push(new THREE.Matrix4().compose(v(f.x + nx * 0.25, 0.45 + k * 0.33, f.z + nz * 0.25), qk, v(1, 1, 1)));
      assiMesh.setMatrixAt(n * 5 + k, assiM[n * 5 + k]!);
      assiMesh.setColorAt(n * 5 + k, col.set(k % 2 ? PAL.legno : PAL.legnoChiaro));
    }
  });
  scene.add(assiMesh, stipiti); disp.push(assiGeo, assiMat, stipGeo, stipMat);

  // ---- porte: battenti di legno con la croce rossa (il cancello verso la spiaggia: sbarre di ferro), cartello col prezzo; una draw call ciascuna ----
  const porte = new Map<string, THREE.Object3D[]>();
  const portaMat = lambert({ vertexColors: true }); disp.push(portaMat);
  for (const p of a.porte) {
    const cancello = p.id === 'spiaggia_cimitero', pezzi: Pezzo[] = [];
    const cs = p.celle.map(ctr), c0 = cs[0]!, c1 = cs[cs.length - 1]!, cx = (c0.x + c1.x) / 2, cz = (c0.z + c1.z) / 2;
    const lungoX = Math.abs(c1.x - c0.x) > Math.abs(c1.z - c0.z);
    for (const c of cs) {
      if (cancello) {
        for (const k of [-0.33, 0, 0.33]) pezzi.push({ g: new THREE.BoxGeometry(0.08, 2.0, 0.08), c: PAL.roccia, x: c.x + (lungoX ? k : 0), y: 1.0, z: c.z + (lungoX ? 0 : k) });
        pezzi.push({ g: new THREE.BoxGeometry(lungoX ? T : 0.1, 0.1, lungoX ? 0.1 : T), c: PAL.roccia, x: c.x, y: 1.85, z: c.z }, { g: new THREE.BoxGeometry(lungoX ? T : 0.1, 0.1, lungoX ? 0.1 : T), c: PAL.roccia, x: c.x, y: 0.5, z: c.z });
      } else {
        pezzi.push({ g: new THREE.BoxGeometry(T, 2.6, T * 0.9), c: cellHash(c.x, c.z, 1) < 0.5 ? PAL.legnoScuro : PAL.legno, x: c.x, y: 1.3, z: c.z });
        pezzi.push({ g: new THREE.BoxGeometry(T * 1.02, 0.12, T * 0.95), c: PAL.roccia, x: c.x, y: 1.8, z: c.z }, { g: new THREE.BoxGeometry(T * 1.02, 0.12, T * 0.95), c: PAL.roccia, x: c.x, y: 0.6, z: c.z });
      }
    }
    if (!cancello) pezzi.push({ g: new THREE.BoxGeometry(0.2, 1.2, 0.2), c: PAL.rosso, x: cx, y: 1.4, z: cz }, { g: new THREE.BoxGeometry(lungoX ? 0.7 : 0.25, 0.2, lungoX ? 0.25 : 0.7), c: PAL.rosso, x: cx, y: 1.6, z: cz });
    const geo = unisci(pezzi); disp.push(geo);
    const mesh = new THREE.Mesh(geo, portaMat); mesh.name = 'porta_' + p.id;
    const prezzo = TEMPLARI.porte[p.id]?.prezzo ?? 0;
    const ct = cartello(String(prezzo)); disp.push(ct);
    const sm = new THREE.SpriteMaterial({ map: ct }); disp.push(sm);
    const sp = new THREE.Sprite(sm); sp.scale.set(1.6, 0.6, 1); sp.position.set(cx, 3.2, cz); sp.name = 'cartello_' + p.id;
    scene.add(mesh, sp); porte.set(p.id, [mesh, sp]);
  }

  // ---- luci: luna fredda dall'alto, ambiente viola, lanterna sull'eroe, candele e bracieri ----
  const hemi = new THREE.HemisphereLight(PAL.acquaProfonda, PAL.ombraCalda, 0.9);
  const amb = new THREE.AmbientLight(PAL.viola, 0.18);
  const luna = new THREE.DirectionalLight(PAL.pietraChiara, 0.75); luna.position.set(-30, 50, -20);
  const lanterna = new THREE.PointLight(PAL.arancio, 7, 9, 1.5);
  const candele = new THREE.PointLight(PAL.giallo, 7, 9, 1.6); candele.position.set(a.altare.x - 1.6, 3.2, a.altare.z);
  // bracieri: al centro della rotonda e all'arco del presbiterio (celle 'b' della mappa; uno sulla spiaggia, il falò dei pirati)
  const bracieri = a.bracieri;
  const fuochi = bracieri.map((b) => { const l = new THREE.PointLight(PAL.arancio, 16, 11, 1.6); l.position.set(b.x, 1.6, b.z); scene.add(l); return l; });
  const ferroMat = lambert({ color: PAL.roccia });
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
  disp.push(braGeo, piedeGeo, fiaGeo, fiaMat, ferroMat);
  scene.add(hemi, amb, luna, luna.target, lanterna, candele);

  // ---- muri verso la camera: la camera guarda da sud-est, i muri in una fascia a sud-est dell'eroe si abbassano ----
  let lastCell = -1, bassiN = 0;
  const sc = new THREE.Vector3(), pos = new THREE.Vector3(), qi = new THREE.Quaternion();
  const muroBasso = (i: number, hcx: number, hcz: number) => { const dx = (i % W) - hcx, dz = Math.floor(i / W) - hcz; return dx + dz >= 1 && dx + dz <= 11 && Math.abs(dx - dz) <= 7; };
  const colonnaBassa = (i: number, hcx: number, hcz: number) => { const dx = (i % W) - hcx, dz = Math.floor(i / W) - hcz; return dx + dz >= 1 && dx + dz <= 6 && Math.abs(dx - dz) <= 4; };
  function abbassa(hx: number, hz: number): void {
    const hcx = Math.floor(hx / T), hcz = Math.floor(hz / T);
    bassiN = 0;
    arredi.abbassa((i) => muroBasso(i, hcx, hcz), (i) => colonnaBassa(i, hcx, hcz));
    muri.forEach((i, n) => {
      const basso = muroBasso(i, hcx, hcz);
      if (basso) bassiN++;
      const p = ctr(i);
      muro.setMatrixAt(n, m4.compose(pos.set(p.x, 0, p.z), qi, sc.set(T, basso ? Math.min(BASSO, altezza[n]!) : altezza[n]!, T)));
    });
    muro.instanceMatrix.needsUpdate = true;
    colonne.forEach((i, n) => {
      const basso = colonnaBassa(i, hcx, hcz), p = ctr(i);
      colonna.setMatrixAt(n, m4.compose(pos.set(p.x, 0, p.z), qi, sc.set(1, basso ? 0.9 : hCol[n]!, 1)));
    });
    colonna.instanceMatrix.needsUpdate = true;
  }

  let assiOra = '', poolT = -1, leveOra = '';
  return {
    scene,
    update(hx, hz, t, assi, trappole) {
      const hc = Math.floor(hz / T) * W + Math.floor(hx / T);
      if (hc !== lastCell) { lastCell = hc; abbassa(hx, hz); }
      lanterna.position.set(hx, 2.4, hz);
      arredi.update(t);
      luna.target.position.set(hx, 0, hz); luna.position.set(hx - 30, 50, hz - 20);
      const key = assi.join(',');
      if (key !== assiOra) {
        assiOra = key;
        a.finestre.forEach((_, n) => { for (let k = 0; k < 5; k++) assiMesh.setMatrixAt(n * 5 + k, k < (assi[n] ?? 0) ? assiM[n * 5 + k]! : ZERO); });
        assiMesh.instanceMatrix.needsUpdate = true;
      }
      // leve: manico su e rosso = pronta; giù e giallo = accesa; giù e grigio = si ricarica
      const lk = trappole.map((x) => (x.accesa > 0 ? 'a' : x.pronta ? 'p' : 'r')).join('');
      if (lk !== leveOra) {
        leveOra = lk;
        for (const l of leve) {
          const st = lk[l.trap] ?? 'p', s = scatole[l.i]!;
          scatola.setMatrixAt(l.i, m4.compose(v(s.x, s.y ?? 0, s.z), qq.setFromEuler(eu.set(0, 0, st === 'p' ? -0.55 : 0.55)), v(s.sx, s.sy, s.sz)));
          scatola.setColorAt(l.i, col.set(st === 'p' ? PAL.rosso : st === 'a' ? PAL.giallo : PAL.pietraScura));
        }
        scatola.instanceMatrix.needsUpdate = true; if (scatola.instanceColor) scatola.instanceColor.needsUpdate = true;
      }
      // fiamme a scatti (8 al secondo)
      const step = Math.floor(t * 8);
      const rogoAcceso = rogoT >= 0 && (trappole[rogoT]?.accesa ?? 0) > 0;
      if (step !== poolT) {
        poolT = step;
        fuochi.forEach((l, n) => { l.intensity = 14 + 5 * cellHash(step, n, 5); fiamme[n]!.scale.set(1, 0.8 + 0.45 * cellHash(step, n, 6), 1); });
        candele.intensity = 6 + 2 * cellHash(step, 9, 7);
        rogo.visible = rogoAcceso;
        luceRogo.intensity = rogoAcceso ? 16 + 6 * cellHash(step, 3, 8) : 0;
        if (rogoAcceso) {
          rogoCelle.forEach((i, n) => {
            const p = ctr(i);
            for (let k = 0; k < 2; k++) {
              const h = cellHash(i + k * 7, step, 9);
              rogo.setMatrixAt(n * 2 + k, m4.compose(v(p.x + (k ? 0.25 : -0.2), 0.02, p.z + (k ? -0.2 : 0.22)), qi, v(1, 0.6 + 0.9 * h, 1)));
              rogo.setColorAt(n * 2 + k, COL_F[(step + n + k) % 3]!);
            }
          });
          rogo.instanceMatrix.needsUpdate = true; if (rogo.instanceColor) rogo.instanceColor.needsUpdate = true;
        }
      }
      // la campana oscilla quando la trappola è accesa (a scatti, 12 al secondo)
      const ct = a.trappole.findIndex((x) => x.id === 'campana');
      const accesa = ct >= 0 && (trappole[ct]?.accesa ?? 0) > 0;
      const ts = Math.floor(t * 12) / 12;
      campana.rotation.x = accesa ? Math.sin(ts * 2.8) * 1.2 : Math.sin(ts * 0.8) * 0.04;
    },
    setPorte(aperte) { for (const [id, l] of porte) for (const o of l) o.visible = !aperte[id]; },
    setCalice(v) { caliceAlt.visible = v; },
    stats: () => ({ muri: muri.length, bassi: bassiN, assi: assiOra.split(',').reduce((s, x) => s + Number(x || 0), 0), luci: 4 + fuochi.length, cose: scatole.length + tubi.length + tende.length, ...arredi.stats() }),
    dispose() { arredi.dispose(); for (const d of disp) d.dispose(); scene.clear(); },
  };
}
