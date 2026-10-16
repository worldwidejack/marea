// Il piazzale dei container del Porto (#355, banco provasparo.html): la banchina a lastre, il mare oltre il bordo, i container e la
// gru del kit delle Corse (`cs_*`, manifest_corse.json, colori per vertice), casse e barriere, la barca a vela dell'uscita. Le posizioni
// vengono da @marea/content/sparo.ts, le stesse della sim (packages/sim/src/sparo/mappa.ts): quel che si vede è quel che ferma i colpi.
// Tutto il fermo è fuso in poche geometrie a colori per vertice con un materiale solo (pochi draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SPARO } from '@marea/content/sparo.ts';
import type { SOggettoDef } from '@marea/content/sparo.ts';
import { QUOTA_MARE } from '@marea/sim/sparo/mappa.ts';
import { mergeBoxes, vertexMat } from '../game/avatar.ts';
import type { Box } from '../game/avatar.ts';
import { P } from '../render/island_parts.ts';
import { caricaPezzi, pezzo } from '../corse/discesa/kit.ts';

export const PEZZI_SPARO = ['cs_gru_rossa', 'cs_gru_blu', 'cs_barca_vela', 'cs_lampione', 'cs_bitta', 'cs_faro', 'cs_casa_a', 'cs_casa_b', 'cs_casa_c'];

/** Colori dei container: lamiera, nervature, telaio. */
const TINTE: Record<string, [string, string, string]> = {
  blu: [P.acquaProfonda, P.abisso, P.abisso], rosso: [P.rosso, P.rossoNeon, P.legno], verde: [P.erbaScura, P.bosco, P.bosco],
};
/** Il container da 6 m (2,6 × 2,6 × 6, lungo z, come nella sim): lamiera con le nervature sui fianchi, telaio, porte con le sbarre
 *  sul lato +z. Quello del kit delle Corse è una scatola liscia: da vicino, in prima persona, serve la lamiera ondulata. */
function container(colore: string): Box[] {
  const [lam, nerv, tel] = TINTE[colore] ?? TINTE.blu!, b: Box[] = [{ s: [2.5, 2.5, 5.9], at: [0, 1.29, 0], c: lam }];
  for (const x of [-1.24, 1.24]) for (const z of [-2.94, 2.94]) b.push({ s: [0.13, 2.6, 0.13], at: [x, 1.3, z], c: tel });
  for (const x of [-1.24, 1.24]) for (const y of [0.07, 2.53]) b.push({ s: [0.13, 0.14, 5.9], at: [x, y, 0], c: tel });
  for (const z of [-2.94, 2.94]) for (const y of [0.07, 2.53]) b.push({ s: [2.5, 0.14, 0.13], at: [0, y, z], c: tel });
  for (let z = -2.6; z <= 2.61; z += 0.37) for (const x of [-1.27, 1.27]) b.push({ s: [0.06, 2.3, 0.15], at: [x, 1.3, z], c: nerv });
  for (const x of [-0.95, -0.35, 0.35, 0.95]) b.push({ s: [0.045, 2.25, 0.045], at: [x, 1.3, 2.99], c: P.pietra });
  b.push({ s: [0.04, 2.3, 0.02], at: [0, 1.3, 2.965], c: tel });
  for (let x = -0.9; x <= 0.91; x += 0.3) b.push({ s: [0.15, 2.2, 0.04], at: [x, 1.3, -2.97], c: nerv });
  return b;
}

export type Piazzale = { group: THREE.Group; tris: number; pezzi: number };

/** La cassa di legno (1,2 × 0,9 × 1,2 m) con le assi più scure ai bordi. */
function cassa(): Box[] {
  const b: Box[] = [{ s: [1.2, 0.9, 1.2], at: [0, 0.45, 0], c: P.legnoChiaro }];
  for (const [x, z] of [[-0.57, -0.57], [0.57, -0.57], [-0.57, 0.57], [0.57, 0.57]] as const) b.push({ s: [0.1, 0.92, 0.1], at: [x, 0.46, z], c: P.legno });
  for (const y of [0.05, 0.86]) { b.push({ s: [1.24, 0.1, 0.1], at: [0, y, -0.57], c: P.legno }, { s: [1.24, 0.1, 0.1], at: [0, y, 0.57], c: P.legno }, { s: [0.1, 0.1, 1.24], at: [-0.57, y, 0], c: P.legno }, { s: [0.1, 0.1, 1.24], at: [0.57, y, 0], c: P.legno }); }
  b.push({ s: [1.22, 0.08, 0.08], at: [0, 0.45, -0.6], c: P.legno, rx: 0.64 }, { s: [1.22, 0.08, 0.08], at: [0, 0.45, 0.6], c: P.legno, rx: -0.64 });
  return b;
}

/** La barriera di plastica (2 × 1 m, lunga x): base rossa, corpo bianco a bande rosse. Quella del kit ha le frecce come colori per
 *  vertice e da vicino diventano una sfumatura. */
function barriera(): Box[] {
  const b: Box[] = [{ s: [2.0, 0.25, 0.6], at: [0, 0.125, 0], c: P.rosso }, { s: [2.0, 0.75, 0.3], at: [0, 0.625, 0], c: P.pietraChiara }, { s: [2.02, 0.05, 0.32], at: [0, 1.0, 0], c: P.pietra }];
  for (let i = 0; i < 5; i++) for (const z of [-0.155, 0.155]) b.push({ s: [0.2, 0.6, 0.02], at: [-0.8 + i * 0.4, 0.6, z], c: P.rosso });
  return b;
}

/** La gru del kit senza la sua base (strisce di pericolo come colori per vertice: sulla faccia grande diventano una sfumatura). */
function gruSenzaBase(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const u = g.index ? g.toNonIndexed() : g.clone(), pos = u.attributes.position!, tieni: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    let bassa = true;
    for (let k = 0; k < 3; k++) if (pos.getY(t + k) > 0.55 || Math.abs(pos.getX(t + k)) > 2.65 || Math.abs(pos.getZ(t + k)) > 2.65) bassa = false;
    if (!bassa) tieni.push(t);
  }
  const out = new THREE.BufferGeometry();
  for (const k of Object.keys(u.attributes)) {
    const a = u.attributes[k]!, n = a.itemSize, arr = new Float32Array(tieni.length * 3 * n);
    tieni.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let c = 0; c < n; c++) arr[(i * 3 + v) * n + c] = a.getComponent(t + v, c); });
    out.setAttribute(k, new THREE.BufferAttribute(arr, n));
  }
  return out;
}
/** La base della gru: cemento scuro con le strisce gialle e nere a blocchi sui fianchi (niente sfumature). */
function baseGru(): Box[] {
  const b: Box[] = [{ s: [5.2, 0.5, 5.2], at: [0, 0.25, 0], c: P.roccia }, { s: [5.0, 0.02, 5.0], at: [0, 0.505, 0], c: P.pietraScura }];
  for (let i = 0; i < 13; i++) {
    const c = i % 2 ? P.neroCaldo : P.giallo, x = -2.4 + i * 0.4;
    b.push({ s: [0.4, 0.3, 0.02], at: [x, 0.3, -2.61], c }, { s: [0.4, 0.3, 0.02], at: [x, 0.3, 2.61], c }, { s: [0.02, 0.3, 0.4], at: [-2.61, 0.3, x], c }, { s: [0.02, 0.3, 0.4], at: [2.61, 0.3, x], c });
  }
  return b;
}

/** Banchina a lastre da 6 m (due grigi), il bordo verso il mare con la fascia gialla, il muro della banchina giù fino all'acqua. */
function banchina(): THREE.BufferGeometry {
  const M = SPARO.mappa, b: Box[] = [], L = 6;
  for (let x = 0; x < M.larga; x += L)
    for (let z = 0; z < M.lunga; z += L) {
      const lx = Math.min(L, M.larga - x), lz = Math.min(L, M.lunga - z);
      b.push({ s: [lx - 0.06, 0.2, lz - 0.06], at: [x + lx / 2, -0.1, z + lz / 2], c: ((x + z) / L) % 2 ? P.pietra : P.pietraChiara });
    }
  b.push({ s: [M.larga + 40, 0.24, M.lunga + 40], at: [M.larga / 2, -0.13, M.lunga / 2 - 20], c: P.pietraScura }); // le fughe tra le lastre
  b.push({ s: [M.larga, 0.02, 0.35], at: [M.larga / 2, 0.005, M.lunga - 0.6], c: P.giallo });
  b.push({ s: [M.larga + 40, 1.6, 0.4], at: [M.larga / 2, -0.8, M.lunga + 0.2], c: P.roccia });
  return mergeBoxes(b);
}

/** Per fondere pezzi del kit e scatole: senza indici, solo posizione, normale e colore. */
function uniforma(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const u = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(u.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') u.deleteAttribute(k);
  if (!u.attributes.normal) u.computeVertexNormals();
  return u;
}

function posa(g: THREE.BufferGeometry, x: number, y: number, z: number, giro: number): THREE.BufferGeometry {
  const c = g.clone();
  if (giro) c.rotateY(giro);
  c.translate(x, y, z);
  return c;
}

/** Fondale: il faro e qualche casa del Porto oltre il muro di container, il mare tutto attorno. */
function fondale(parti: THREE.BufferGeometry[]): void {
  const M = SPARO.mappa;
  const metti = (nome: string, x: number, y: number, z: number, giro = 0, k = 1) => { const g = pezzo(nome); if (g) { const c = posa(g, 0, 0, 0, giro); c.scale(k, k, k); c.translate(x, y, z); parti.push(c); } };
  metti('cs_faro', M.larga + 34, QUOTA_MARE, M.lunga + 30, 0.6);
  metti('cs_casa_a', -14, 0, -10, 0.3, 1.4); metti('cs_casa_b', 6, 0, -16, 0, 1.6); metti('cs_casa_c', 26, 0, -15, -0.2, 1.5); metti('cs_casa_a', 46, 0, -9, -0.5, 1.4);
  metti('cs_gru_blu', M.larga + 9, 0, 14, Math.PI / 2);
  for (const x of [8, 16, 26, 34]) metti('cs_bitta', x, 0, M.lunga - 0.25);
  metti('cs_lampione', 4.2, 0, M.lunga - 0.5); metti('cs_lampione', M.larga - 4.2, 0, M.lunga - 0.5);
}

export async function creaPiazzale(): Promise<Piazzale> {
  await caricaPezzi(PEZZI_SPARO);
  const M = SPARO.mappa, D = SPARO.dimensioni, group = new THREE.Group(), parti: THREE.BufferGeometry[] = [];
  let pezzi = 0;
  const cassaG = mergeBoxes(cassa()), barrieraG = mergeBoxes(barriera()), contG = new Map<string, THREE.BufferGeometry>();
  const contDi = (c: string) => { let g = contG.get(c); if (!g) { g = mergeBoxes(container(c)); contG.set(c, g); } return g; };
  for (const o of M.oggetti as SOggettoDef[]) {
    const giro = o.rot === 90 ? Math.PI / 2 : 0;
    if (o.tipo === 'container') {
      const colori = ['blu', 'rosso', 'verde'], c0 = colori.indexOf(o.colore ?? 'blu');
      for (let p = 0; p < (o.piani ?? 1); p++) { parti.push(posa(contDi(colori[(c0 + p) % 3]!), o.x, p * D.container[2]!, o.z, giro + (p % 2) * Math.PI)); pezzi++; }
    } else if (o.tipo === 'gru') {
      const g = pezzo(o.colore === 'blu' ? 'cs_gru_blu' : 'cs_gru_rossa');
      if (g) { parti.push(posa(gruSenzaBase(g), o.x, 0, o.z, giro), posa(mergeBoxes(baseGru()), o.x, 0, o.z, 0)); pezzi++; }
    } else if (o.tipo === 'cassa') { parti.push(posa(cassaG, o.x, 0, o.z, 0)); pezzi++; } // dritte come nella sim: niente spigoli invisibili
    else if (o.tipo === 'barriera') { parti.push(posa(barrieraG, o.x, 0, o.z, giro)); pezzi++; }
  }
  const barca = pezzo('cs_barca_vela');
  if (barca) parti.push(posa(barca, M.barca.x, QUOTA_MARE + 0.1, M.barca.z, M.barca.rot === 90 ? Math.PI / 2 : 0));
  fondale(parti);
  const fermo = mergeGeometries(parti.map(uniforma), false);
  let tris = 0;
  if (fermo) {
    const mesh = new THREE.Mesh(fermo, vertexMat()); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'piazzale';
    group.add(mesh); tris += fermo.attributes.position!.count / 3;
  }
  const terra = new THREE.Mesh(banchina(), vertexMat()); terra.receiveShadow = true; terra.name = 'banchina';
  group.add(terra); tris += (terra.geometry.index ? terra.geometry.index.count : terra.geometry.attributes.position!.count) / 3;
  // il mare: un piano grande a tinta unita sotto la banchina
  const mare = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: P.acqua }));
  mare.position.set(M.larga / 2, QUOTA_MARE, M.lunga / 2); mare.receiveShadow = true; mare.name = 'mare';
  group.add(mare); tris += 2;
  for (const g of parti) g.dispose();
  for (const g of contG.values()) g.dispose();
  return { group, tris, pezzi };
}
