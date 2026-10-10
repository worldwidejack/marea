// Arredi dell'arena dei Templari (docs/TEMPLARI.md §3, «Riferimenti storici»): quello che non ferma nessuno ma racconta il posto.
// Chiesa: il tamburo di archi sopra il giro di colonne (la charola di Tomar), le dodici croci rosse di consacrazione sui muri della rotonda,
// i due stendardi Beauceant (bianco e nero con la croce rossa, come nell'affresco di San Bevignate) ai lati del coro. Borgo: usci scuri e
// tegole rimaste sulle case diroccate. Cimitero: i cipressi lungo i muri, l'ossario coi teschi. Spiaggia: il mare di notte, la nave dei
// pirati tirata in secca su un fianco (carenaggio), la bandiera nera sulla tenda grande, la griglia del boucan sul falò, l'insegna col
// teschio sopra la taverna. Tutto instanziato o unito: poche draw call.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C, SUOLO, TIPO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import { P } from '../render/island_parts.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';

export type Arredi = {
  update(t: number): void;
  stats(): { croci: number; usci: number; archi: number; cipressi: number };
  dispose(): void;
};

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function canvasTex(w: number, h: number, draw: (px: (c: string, x: number, y: number, w?: number, h?: number) => void) => void, ripeti = false): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  draw((c, x, y, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); });
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  if (ripeti) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** Croce patente in un cerchio (16 × 16): la croce di consacrazione dipinta di rosso sull'intonaco. */
const croceTex = () => canvasTex(16, 16, (px) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dz = y - 7.5, d = Math.sqrt(dx * dx + dz * dz);
    if (d > 6.2 && d < 7.6) px(cellHash(x, y, 1) < 0.85 ? PAL.rosso : PAL.ombraCalda, x, y);
    const ax = Math.abs(dx), az = Math.abs(dz);
    // bracci che si allargano verso l'esterno
    if ((ax <= 0.8 + az * 0.45 && az < 5.6) || (az <= 0.8 + ax * 0.45 && ax < 5.6)) px(cellHash(x, y, 2) < 0.9 ? PAL.rosso : PAL.ombraCalda, x, y);
  }
});
/** Beauceant (16 × 32): metà bianca in alto con la croce rossa, metà nera sotto, fondo sfilacciato. */
const stendardoTex = () => canvasTex(16, 32, (px) => {
  px(PAL.pietraChiara, 0, 0, 16, 15); px(PAL.neroCaldo, 0, 15, 16, 14);
  px(PAL.rosso, 7, 3, 2, 10); px(PAL.rosso, 3, 7, 10, 2); px(PAL.rosso, 6, 3, 4, 1); px(PAL.rosso, 6, 12, 4, 1); px(PAL.rosso, 3, 6, 1, 4); px(PAL.rosso, 12, 6, 1, 4);
  for (let x = 0; x < 16; x++) { const n = 29 + Math.floor(cellHash(x, 3, 3) * 3); px(PAL.neroCaldo, x, 29, 1, n - 29); }
  for (let k = 0; k < 6; k++) px(PAL.ombraCalda, Math.floor(cellHash(k, 5, 5) * 16), 16 + Math.floor(cellHash(k, 6, 6) * 12));
});
/** Bandiera nera dei pirati (24 × 16): teschio e ossa incrociate; serve anche per l'insegna della taverna. */
const teschioTex = () => canvasTex(24, 16, (px) => {
  px(PAL.neroCaldo, 0, 0, 24, 16);
  px(PAL.pietraChiara, 9, 3, 6, 5); px(PAL.pietraChiara, 10, 8, 4, 1); px(PAL.neroCaldo, 10, 5, 1, 1); px(PAL.neroCaldo, 13, 5, 1, 1);
  for (let k = 0; k < 7; k++) { px(PAL.pietraChiara, 7 + k, 9 + Math.floor(k / 2), 1, 1); px(PAL.pietraChiara, 16 - k, 9 + Math.floor(k / 2), 1, 1); }
  for (let x = 0; x < 24; x += 5) px(PAL.ombraCalda, x, 15 - (x % 2), 2, 1);
});
/** Mare di notte (32 × 16, ripetuto): blu profondo con le creste che la luna accende. */
const mareTex = () => canvasTex(32, 16, (px) => {
  px(PAL.abisso, 0, 0, 32, 16);
  for (let k = 0; k < 14; k++) { const x = Math.floor(cellHash(k, 1, 7) * 30), y = Math.floor(cellHash(k, 2, 7) * 16); px(k % 4 ? PAL.acquaProfonda : PAL.acqua, x, y, 2 + (k % 3), 1); }
}, true);

export function createArredi(scene: THREE.Scene, a: Arena, o: { centro: { x: number; z: number }; colonne: number[]; hCol: number[]; altezza: (i: number) => number }): Arredi {
  const T = a.tile, W = a.w, H = a.h;
  const ctr = (i: number) => ({ x: ((i % W) + 0.5) * T, z: (Math.floor(i / W) + 0.5) * T });
  const cellA = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= H ? C.fuori : a.cell[cz * W + cx]!);
  const disp: { dispose(): void }[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const mat = (x: number, y: number, z: number, ry: number, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz));
  const istanze = (geo: THREE.BufferGeometry, m: THREE.Material, n: number, nome: string) => {
    const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.name = nome; im.frustumCulled = false; im.count = n; scene.add(im); disp.push(geo, m); return im;
  };

  // ---- croci di consacrazione: dodici attorno alla rotonda, sulla faccia interna del muro (il raggio dal centro trova il muro) ----
  type Deco = { m: THREE.Matrix4 };
  const croci: Deco[] = [];
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2 + Math.PI / 12, dx = Math.cos(ang), dz = Math.sin(ang);
    let pcx = Math.floor(o.centro.x / T), pcz = Math.floor(o.centro.z / T);
    for (let r = 4; r < 14; r += 0.05) {
      const x = o.centro.x + dx * r, z = o.centro.z + dz * r, cx = Math.floor(x / T), cz = Math.floor(z / T);
      if (cx === pcx && cz === pcz) continue;
      const k2 = cellA(cx, cz);
      if (k2 === C.muro && a.tipo[cz * W + cx] === TIPO.chiesa) {
        const nx = cx !== pcx ? pcx - cx : 0, nz = nx === 0 ? pcz - cz : 0;
        const fx = nx ? (nx > 0 ? cx + 1 : cx) * T + nx * 0.03 : x, fz = nz ? (nz > 0 ? cz + 1 : cz) * T + nz * 0.03 : z;
        if (o.altezza(cz * W + cx) >= 2.2) croci.push({ m: mat(fx, 1.75, fz, Math.atan2(nx, nz), 0.62, 0.62, 1) });
        break;
      }
      if (k2 !== C.pavimento && k2 !== C.colonna && k2 !== C.basso) break; // finestra, porta, fuori: niente croce qui
      pcx = cx; pcz = cz;
    }
  }
  const croceT = croceTex(); disp.push(croceT);
  const croce = istanze(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: croceT, transparent: true, alphaTest: 0.5 }), croci.length, 'croci_consacrazione');
  croci.forEach((c, n) => croce.setMatrixAt(n, c.m));

  // ---- case del borgo: un uscio scuro sul lato verso la camera (sud o est) e qualche fila di tegole rimasta in cima ----
  const usci: Deco[] = [], tegole: Deco[] = [];
  const caseG: number[][] = [];
  { const seen = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (a.tipo[i] !== TIPO.casa || seen[i]) continue;
      const g = [i]; seen[i] = 1;
      for (let j = 0; j < g.length; j++) { const c = g[j]!, cx = c % W, cz = (c - cx) / W; for (const [ddx, ddz] of N4) { const n = (cz + ddz) * W + cx + ddx; if (cx + ddx >= 0 && cx + ddx < W && cz + ddz >= 0 && cz + ddz < H && !seen[n] && a.tipo[n] === TIPO.casa) { seen[n] = 1; g.push(n); } } }
      caseG.push(g);
    } }
  let ossario: number[] | null = null;
  for (const g of caseG) {
    const erba = g.some((i) => N4.some(([dx, dz]) => a.suolo[i + dz * W + dx] === SUOLO.erba));
    if (erba) ossario = g;
    // usci: le celle di bordo con fuori a sud (o a est), alte abbastanza, al centro del lato
    const bordo = (i: number, dx: number, dz: number) => a.tipo[i] === TIPO.casa && a.tipo[i + dz * W + dx] !== TIPO.casa && a.cell[i + dz * W + dx] !== C.fuori && o.altezza(i) >= 1.8;
    for (const [dx, dz] of [[0, 1], [1, 0]] as const) {
      const lato = g.filter((i) => bordo(i, dx, dz));
      if (lato.length < 3) continue;
      const i = lato[Math.floor(lato.length / 2)]!, p = ctr(i);
      usci.push({ m: mat(p.x + dx * 0.53, 0.75, p.z + dz * 0.53, Math.atan2(dx, dz), 0.8, 1.5, 1) });
      break;
    }
    for (const i of g) {
      const h = o.altezza(i), cx = i % W, cz = Math.floor(i / W);
      if (h < 2.4 || cellHash(cx, cz, 31) > 0.3 || erba) continue;
      const p = ctr(i), lungoX = a.tipo[i - 1] === TIPO.casa && a.tipo[i + 1] === TIPO.casa;
      tegole.push({ m: mat(p.x, h + 0.06, p.z, lungoX ? 0 : Math.PI / 2, 1.15, 1, 1, 0.28) });
    }
  }
  // l'ossario (la casa sull'erba del cimitero): usci scuri sul lato sud e i teschi ammucchiati davanti
  const ossa: THREE.Matrix4[] = [];
  if (ossario) {
    const lato = ossario.filter((i) => a.tipo[i + W] !== TIPO.casa && a.cell[i + W] !== C.fuori);
    lato.forEach((i, k) => {
      const p = ctr(i);
      if (k % 2 === 0) usci.push({ m: mat(p.x, 0.75, p.z + 0.53, 0, 0.8, 1.5, 1) });
      for (let j = 0; j < 3; j++) if (cellHash(i, j, 44) < 0.5) ossa.push(mat(p.x - 0.3 + j * 0.3, 0.11 + (j === 1 ? 0.18 : 0), p.z + 0.68, cellHash(i, j, 45) * 2, 0.24, 0.22, 0.24));
    });
  }
  const teschi = istanze(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: PAL.pietraChiara, flatShading: true }), ossa.length, 'teschi');
  ossa.forEach((m, n) => teschi.setMatrixAt(n, m));
  const uscio = istanze(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: PAL.neroCaldo }), usci.length, 'usci');
  usci.forEach((u, n) => uscio.setMatrixAt(n, u.m));
  const tegolaGeo = unisci([
    { g: new THREE.BoxGeometry(1, 0.1, 0.8), c: PAL.legnoChiaro },
    ...[-0.36, -0.12, 0.12, 0.36].map((x) => ({ g: new THREE.CylinderGeometry(0.1, 0.1, 0.8, 4), c: PAL.arancio, x, y: 0.07, rx: Math.PI / 2 })),
  ]);
  const tegola = istanze(tegolaGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), tegole.length, 'tegole');
  tegole.forEach((t, n) => tegola.setMatrixAt(n, t.m));

  // ---- tamburo: archi di pietra tra le colonne alte del giro attorno al centro della rotonda ----
  const giro = o.colonne.map((i, n) => ({ i, n, p: ctr(i) }))
    .filter((c) => { const dx = c.p.x - o.centro.x, dz = c.p.z - o.centro.z, d = Math.sqrt(dx * dx + dz * dz); return d > 3.5 && d < 7.5; })
    .sort((x, y) => Math.atan2(x.p.z - o.centro.z, x.p.x - o.centro.x) - Math.atan2(y.p.z - o.centro.z, y.p.x - o.centro.x));
  const archi: { m: THREE.Matrix4 }[] = [];
  giro.forEach((c, k) => {
    const d = giro[(k + 1) % giro.length]!;
    if (giro.length < 3 || (o.hCol[c.n] ?? 0) < 3 || (o.hCol[d.n] ?? 0) < 3) return;
    const dx = d.p.x - c.p.x, dz = d.p.z - c.p.z, len = Math.sqrt(dx * dx + dz * dz);
    archi.push({ m: mat((c.p.x + d.p.x) / 2, 4.05, (c.p.z + d.p.z) / 2, -Math.atan2(dz, dx), len + 0.3, 1, 0.34) });
  });
  const arcoGeo = unisci([
    { g: new THREE.BoxGeometry(1, 0.22, 1), c: PAL.pietraChiara, y: 0.11 },
    { g: new THREE.BoxGeometry(1.02, 0.07, 1.1), c: PAL.pietra, y: 0.25 },
  ]);
  const arco = istanze(arcoGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), archi.length, 'tamburo');
  archi.forEach((x, n) => arco.setMatrixAt(n, x.m));

  // ---- stendardi Beauceant sugli stalli del coro (aste di legno, il drappo ondeggia a scatti) ----
  const stalli = [...Array(W * H).keys()].filter((i) => a.tipo[i] === TIPO.stallo);
  const nord = stalli.filter((i) => a.tipo[i + W] !== TIPO.stallo && a.cell[i + W] === C.pavimento && a.tipo[i - W] === TIPO.chiesa);
  const sud = stalli.filter((i) => a.tipo[i - W] !== TIPO.stallo && a.cell[i - W] === C.pavimento && a.tipo[i + W] === TIPO.chiesa);
  const aste = [nord.at(-1), sud.at(-1)].filter((x): x is number => x !== undefined).map(ctr);
  const stendT = stendardoTex(); disp.push(stendT);
  const stend = istanze(new THREE.PlaneGeometry(1, 2).translate(0, -1, 0), new THREE.MeshLambertMaterial({ map: stendT, side: THREE.DoubleSide, alphaTest: 0.5 }), aste.length, 'stendardi');
  const asteGeo = unisci(aste.flatMap((p) => [
    { g: new THREE.BoxGeometry(0.1, 3.6, 0.1), c: PAL.legnoScuro, x: p.x, y: 1.8, z: p.z },
    { g: new THREE.BoxGeometry(1.2, 0.08, 0.08), c: PAL.legnoScuro, x: p.x + 0.55, y: 3.45, z: p.z },
    { g: new THREE.BoxGeometry(0.16, 0.16, 0.16), c: PAL.giallo, x: p.x, y: 3.68, z: p.z },
  ]));
  const asteM = new THREE.Mesh(asteGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); asteM.name = 'aste'; scene.add(asteM); disp.push(asteGeo, asteM.material as THREE.Material);

  // ---- cimitero: cipressi fuori dai muri (nord, ovest, est) e i teschi davanti all'ossario ----
  const cip: THREE.Matrix4[] = [], cipCol: string[] = [];
  // solo a nord e a ovest dell'erba: la camera guarda da sud-est, a sud e a est coprirebbero il cimitero
  const erbaVicina = (cx: number, cz: number) => { for (let k = 1; k <= 2; k++) for (const [x, z] of [[cx, cz + k], [cx + k, cz]] as const) if (x < W && z < H && a.suolo[z * W + x] === SUOLO.erba) return true; return false; };
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (cellA(cx, cz) !== C.fuori || !erbaVicina(cx, cz) || (cx + cz * 2) % 3 !== 0) continue;
    const h = 4.5 + 2.5 * cellHash(cx, cz, 41);
    cip.push(mat((cx + 0.5) * T, 0, (cz + 0.5) * T, 0, 0.75 + 0.2 * cellHash(cx, cz, 42), h, 0.75 + 0.2 * cellHash(cx, cz, 42)));
    cipCol.push(cellHash(cx, cz, 43) < 0.5 ? PAL.bosco : P.boscoOmbra);
  }
  const cipGeo = new THREE.ConeGeometry(1, 1, 6); cipGeo.translate(0, 0.5, 0);
  const cipresso = istanze(cipGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), cip.length, 'cipressi');
  cip.forEach((m, n) => { cipresso.setMatrixAt(n, m); cipresso.setColorAt(n, col.set(cipCol[n]!)); });
  // ---- spiaggia: il mare a sud, la nave in secca a est, bandiera nera, griglia del boucan, insegna della taverna ----
  const sabbia = [...Array(W * H).keys()].filter((i) => a.suolo[i] === SUOLO.sabbia);
  const mareT = mareTex(); disp.push(mareT);
  let mare: THREE.Mesh | null = null, nave: THREE.Mesh | null = null, bandiera: THREE.Mesh | null = null;
  const teschioT = teschioTex(); disp.push(teschioT);
  const teschioMat = new THREE.MeshLambertMaterial({ map: teschioT, side: THREE.DoubleSide }); disp.push(teschioMat);
  if (sabbia.length) {
    const zMax = Math.max(...sabbia.map((i) => Math.floor(i / W))) + 1, xMin = Math.min(...sabbia.map((i) => i % W));
    mareT.repeat.set(W * T / 8, 5);
    mare = new THREE.Mesh(new THREE.PlaneGeometry(W * T + 60, 40), new THREE.MeshLambertMaterial({ map: mareT }));
    mare.rotation.x = -Math.PI / 2; mare.position.set((W * T) / 2, -0.02, H * T + 20); mare.name = 'mare';
    scene.add(mare); disp.push(mare.geometry, mare.material as THREE.Material);
    // la nave in secca nell'acqua bassa a ovest della spiaggia (a ovest non copre la vista: la camera guarda da sud-est): scafo su un
    // fianco, chiglia, albero spezzato, una vela strappata
    const nx = xMin * T - 4.5, nz = (zMax - 5) * T;
    const naveGeo = unisci([
      { g: new THREE.BoxGeometry(3.2, 2.4, 11), c: PAL.legnoScuro, rz: 0.62 },
      { g: new THREE.BoxGeometry(3.25, 0.3, 11.05), c: PAL.legno, y: 0.6, rz: 0.62 },
      { g: new THREE.BoxGeometry(3.25, 0.25, 11.05), c: PAL.neroCaldo, y: -0.4, rz: 0.62 },
      { g: new THREE.BoxGeometry(0.4, 0.5, 11.6), c: PAL.roccia, x: 0.9, y: -1.3, rz: 0.62 },
      { g: new THREE.BoxGeometry(2.6, 2.2, 0.4), c: PAL.legno, z: 5.6, rz: 0.62 },
      { g: new THREE.CylinderGeometry(0.16, 0.2, 9, 5), c: PAL.legno, x: -4.2, y: 0.3, z: -1, rz: Math.PI / 2 + 0.2, ry: 0.4 },
      { g: new THREE.BoxGeometry(2.4, 0.06, 3.2), c: PAL.sabbiaChiara, x: -4, y: 0.25, z: 1.4, ry: 0.5, rx: 0.1 },
    ]);
    nave = new THREE.Mesh(naveGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    nave.position.set(nx, 1.1, nz); nave.name = 'nave'; scene.add(nave); disp.push(naveGeo, nave.material as THREE.Material);
  }
  // bandiera nera sulla tenda più grande della spiaggia
  const tende = [...Array(W * H).keys()].filter((i) => a.tipo[i] === TIPO.tenda);
  const pali: Pezzo[] = [];
  if (tende.length) {
    const xs = tende.map((i) => i % W), zs = tende.map((i) => Math.floor(i / W));
    const cx = (xs.reduce((x, y) => x + y, 0) / xs.length + 0.5) * T, cz = (zs.reduce((x, y) => x + y, 0) / zs.length + 0.5) * T;
    const t0 = tende.reduce((b, i) => { const p = ctr(i), d = (p.x - cx) * (p.x - cx) + (p.z - cz) * (p.z - cz), pb = ctr(b); return d < (pb.x - cx) * (pb.x - cx) + (pb.z - cz) * (pb.z - cz) ? i : b; });
    const p = ctr(t0);
    pali.push({ g: new THREE.BoxGeometry(0.12, 5.4, 0.12), c: PAL.legnoScuro, x: p.x, y: 2.7, z: p.z });
    bandiera = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1).translate(0.75, 0, 0), teschioMat);
    bandiera.position.set(p.x + 0.06, 4.9, p.z); bandiera.name = 'bandiera_nera'; scene.add(bandiera); disp.push(bandiera.geometry);
  }
  // boucan: la griglia di legno con la carne sopra il falò della spiaggia
  for (const b of a.bracieri) {
    const i = Math.floor(b.z / T) * W + Math.floor(b.x / T);
    if (a.suolo[i] !== SUOLO.sabbia) continue;
    pali.push(
      ...[-0.75, 0.75].map((dx): Pezzo => ({ g: new THREE.BoxGeometry(0.1, 1.5, 0.1), c: PAL.legnoScuro, x: b.x + dx, y: 0.75, z: b.z })),
      { g: new THREE.BoxGeometry(1.7, 0.08, 0.08), c: PAL.legnoScuro, x: b.x, y: 1.5, z: b.z },
      ...[-0.4, 0, 0.4].map((dx, k): Pezzo => ({ g: new THREE.BoxGeometry(0.1, 0.38, 0.14), c: k === 1 ? PAL.legnoScuro : PAL.rosso, x: b.x + dx, y: 1.28, z: b.z })),
    );
  }
  // insegna della taverna: sopra la porta che dà sulla piazza
  const pt = a.porte.find((p) => p.id === 'taverna');
  let insegna: THREE.Mesh | null = null;
  if (pt) {
    const cs = pt.celle.map(ctr), x = cs.reduce((t, c) => t + c.x, 0) / cs.length, z = Math.min(...cs.map((c) => c.z)) - 0.6;
    pali.push({ g: new THREE.BoxGeometry(0.08, 0.08, 1.0), c: PAL.roccia, x: x + 0.8, y: 3.0, z: z + 0.1 }, { g: new THREE.BoxGeometry(0.08, 1.1, 0.08), c: PAL.roccia, x: x + 0.8, y: 2.5, z: z + 0.55 });
    insegna = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), teschioMat);
    insegna.position.set(x + 0.8, 2.55, z - 0.3); insegna.rotation.y = Math.PI / 2; insegna.name = 'insegna_taverna'; scene.add(insegna); disp.push(insegna.geometry);
  }
  if (pali.length) {
    const g = unisci(pali);
    const me = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); me.name = 'pali'; scene.add(me); disp.push(g, me.material as THREE.Material);
  }

  let passo = -1;
  return {
    update(t) {
      const st = Math.floor(t * 6);
      if (st === passo) return;
      passo = st;
      aste.forEach((p, n) => stend.setMatrixAt(n, mat(p.x + 0.55, 3.4, p.z, 0.15 * Math.sin(st * 0.9 + n * 2), 0.95, 1, 1, 0.05 * Math.sin(st * 0.7 + n))));
      stend.instanceMatrix.needsUpdate = true;
      if (bandiera) bandiera.rotation.y = 0.35 * Math.sin(st * 0.8);
      if (mare) mareT.offset.x = (st % 32) / 64;
    },
    stats: () => ({ croci: croci.length, usci: usci.length, archi: archi.length, cipressi: cip.length }),
    dispose() { for (const d of disp) d.dispose(); },
  };
}
