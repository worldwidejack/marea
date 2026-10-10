// Dettagli dell'arena dei Templari (docs/TEMPLARI.md §3): quello che fa sembrare vero il posto, guardando Le crociate (Kingdom of Heaven,
// 2005) e le città di Assassin's Creed (Acri, Gerusalemme). Chiesa: i sarcofagi dei cavalieri con la statua distesa (gambe incrociate,
// scudo, spada, il leone ai piedi, come alla Temple Church), gli armadi e il tavolo coi calici della sacrestia, il crocifisso sopra il
// tramezzo, le panche rovesciate, i candelabri accesi, le vetrate colorate sopra le finestre sbarrate, gli arazzi rossi del coro, i raggi
// di luna dal tetto crollato. Fuori: le tende da mercato sopra gli usci con casse e ceste di frutta, i balconi di legno a grata, le palme,
// i lampioni con l'alone caldo, i tavoli della taverna, la nebbia bassa del cimitero. Tutto instanziato o unito (poche draw call).
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C, SUOLO, TIPO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import { P } from '../render/island_parts.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';

export type Dettagli = {
  update(t: number): void;
  stats(): { sarcofagi: number; candele: number; palme: number; lampioni: number; vetrate: number };
  dispose(): void;
};

const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const CY = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
type Posto = { x: number; y?: number; z: number; ry?: number; s?: number };

function tex(w: number, h: number, draw: (px: (c: string, x: number, y: number, w?: number, h?: number) => void) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  draw((c, x, y, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); });
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- oggetti (geometrie unite coi colori per vertice, pivot a terra, davanti = +Z) ----
/** Sarcofago di un cavaliere lungo 2 m (lungo Z) con la statua distesa: cotta di maglia, sopravveste bianca con la croce, gambe incrociate,
 *  scudo, spada, cuscino sotto la testa, leone ai piedi; le arcate scolpite sui fianchi. */
function sarcofago(): THREE.BufferGeometry {
  const p: Pezzo[] = [
    { g: B(0.92, 0.55, 1.9), c: PAL.pietra, y: 0.275 }, { g: B(1.0, 0.1, 2.0), c: PAL.pietraChiara, y: 0.6 },
    ...[-0.6, 0, 0.6].flatMap((z): Pezzo[] => [-1, 1].map((s) => ({ g: B(0.02, 0.3, 0.42), c: PAL.pietraScura, x: s * 0.465, y: 0.3, z }))),
    { g: B(0.36, 0.08, 0.28), c: PAL.rosso, y: 0.69, z: -0.66 },
    { g: B(0.22, 0.19, 0.26), c: PAL.pietraScura, y: 0.75, z: -0.62 }, { g: B(0.13, 0.04, 0.15), c: PAL.sabbia, y: 0.86, z: -0.64 },
    { g: B(0.44, 0.17, 0.95), c: PAL.pietraChiara, y: 0.73, z: 0.02 },
    { g: B(0.08, 0.02, 0.34), c: PAL.rosso, y: 0.82, z: -0.16 }, { g: B(0.26, 0.02, 0.08), c: PAL.rosso, y: 0.82, z: -0.22 },
    { g: B(0.12, 0.12, 0.62), c: PAL.pietraScura, x: -0.05, y: 0.72, z: 0.72, ry: 0.2 }, { g: B(0.12, 0.12, 0.62), c: PAL.pietraScura, x: 0.05, y: 0.73, z: 0.72, ry: -0.2 },
    { g: B(0.38, 0.24, 0.26), c: PAL.sabbia, y: 0.76, z: 1.04 }, { g: B(0.16, 0.14, 0.12), c: PAL.sabbia, y: 0.86, z: 0.86 },
    { g: B(0.28, 0.04, 0.4), c: PAL.pietraChiara, x: -0.22, y: 0.84, z: -0.08, rz: 0.25 }, { g: B(0.06, 0.02, 0.3), c: PAL.rosso, x: -0.22, y: 0.865, z: -0.08, rz: 0.25 },
    { g: B(0.05, 0.03, 0.9), c: PAL.pietra, x: 0.2, y: 0.83, z: 0.25 }, { g: B(0.22, 0.03, 0.04), c: PAL.roccia, x: 0.2, y: 0.84, z: -0.2 },
  ];
  return unisci(p);
}
function armadio(aperto: boolean): THREE.BufferGeometry {
  const p: Pezzo[] = [
    { g: B(0.92, 2.1, 0.55), c: PAL.legnoScuro, y: 1.05 }, { g: B(1.02, 0.12, 0.64), c: PAL.legno, y: 2.16 }, { g: B(1.0, 0.1, 0.6), c: PAL.legno, y: 0.05 },
    ...[0.5, 1.6].flatMap((y): Pezzo[] => [-1, 1].map((s) => ({ g: B(0.05, 0.08, 0.03), c: PAL.roccia, x: s * 0.44, y, z: 0.29 }))),
  ];
  if (aperto) p.push(
    { g: B(0.4, 1.8, 0.03), c: PAL.legno, x: 0.62, y: 1.05, z: 0.47, ry: -1.2 }, { g: B(0.4, 1.8, 0.03), c: PAL.legno, x: -0.21, y: 1.05, z: 0.29 },
    { g: B(0.3, 1.1, 0.06), c: PAL.rosso, x: 0.2, y: 1.2, z: 0.2 }, { g: B(0.24, 0.9, 0.06), c: PAL.pietraChiara, x: 0.02, y: 1.3, z: 0.18 },
    { g: CY(0.06, 0.03, 0.14), c: PAL.giallo, x: 0.25, y: 1.95, z: 0.15 },
  );
  else p.push({ g: B(0.4, 1.8, 0.03), c: PAL.legno, x: -0.21, y: 1.05, z: 0.29 }, { g: B(0.4, 1.8, 0.03), c: PAL.legno, x: 0.21, y: 1.05, z: 0.29 });
  return unisci(p);
}
/** Tavolo lungo 1,8 m (lungo X): `sacro` = calici, libro e candela (sacrestia), sennò boccali, bottiglia e sgabelli (taverna). */
function tavolo(sacro: boolean): THREE.BufferGeometry {
  const p: Pezzo[] = [{ g: B(1.8, 0.08, 0.86), c: PAL.legno, y: 0.78 }, ...[-1, 1].flatMap((sx): Pezzo[] => [-1, 1].map((sz) => ({ g: B(0.08, 0.76, 0.08), c: PAL.legnoScuro, x: sx * 0.8, y: 0.38, z: sz * 0.34 })))];
  if (sacro) p.push(
    ...[-0.5, -0.2].map((x): Pezzo => ({ g: CY(0.06, 0.03, 0.16), c: PAL.giallo, x, y: 0.9, z: 0.1 })), { g: B(0.32, 0.06, 0.24), c: PAL.rosso, x: 0.35, y: 0.85, z: -0.05, ry: 0.3 },
    { g: B(0.3, 0.02, 0.22), c: PAL.sabbiaChiara, x: 0.35, y: 0.885, z: -0.05, ry: 0.3 }, { g: CY(0.03, 0.03, 0.2), c: PAL.sabbiaChiara, x: 0.7, y: 0.92, z: 0.2 },
  );
  else p.push(
    ...[-0.6, -0.1, 0.45].map((x, k): Pezzo => ({ g: CY(0.06, 0.06, 0.14), c: k % 2 ? PAL.legnoChiaro : PAL.pietra, x, y: 0.89, z: (k - 1) * 0.12 })),
    { g: CY(0.06, 0.07, 0.3), c: PAL.bosco, x: 0.15, y: 0.97, z: 0.15 },
    ...[-1, 1].map((s): Pezzo => ({ g: CY(0.2, 0.18, 0.45, 6), c: PAL.legnoScuro, x: s * 0.5, y: 0.225, z: s * 0.75 })),
  );
  return unisci(p);
}
function panca(): THREE.BufferGeometry {
  return unisci([
    { g: B(2.2, 0.08, 0.42), c: PAL.legno, y: 0.45 }, { g: B(2.2, 0.5, 0.06), c: PAL.legnoScuro, y: 0.78, z: -0.19 },
    ...[-1, 1].map((s): Pezzo => ({ g: B(0.08, 0.45, 0.38), c: PAL.legnoScuro, x: s * 1.0, y: 0.225 })),
  ]);
}
function candelabro(): THREE.BufferGeometry {
  return unisci([
    { g: CY(0.22, 0.26, 0.06), c: PAL.roccia, y: 0.03 }, { g: CY(0.03, 0.04, 1.4), c: PAL.roccia, y: 0.72 }, { g: CY(0.2, 0.1, 0.05), c: PAL.arancio, y: 1.43 },
    ...[-0.12, 0, 0.12].map((x): Pezzo => ({ g: CY(0.025, 0.025, 0.16), c: PAL.sabbiaChiara, x, y: 1.53 })),
  ]);
}
const CANDELE = [-0.12, 0, 0.12];
/** Palma: tronco a segmenti che si piega, sette foglie che ricadono, qualche dattero. */
function palma(): THREE.BufferGeometry {
  const p: Pezzo[] = [];
  let x = 0;
  for (let i = 0; i < 6; i++) { p.push({ g: CY(0.13 - i * 0.01, 0.16 - i * 0.01, 1.05), c: i % 2 ? PAL.legno : PAL.legnoScuro, x, y: 0.5 + i * 1.0, rz: -0.06 }); x += 0.07; }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    p.push({ g: B(0.28, 0.04, 1.9), c: k % 2 ? PAL.bosco : PAL.erbaScura, x: x + Math.sin(a) * 0.8, y: 6.0, z: Math.cos(a) * 0.8, ry: a, rx: 0.45 });
  }
  for (let k = 0; k < 3; k++) p.push({ g: B(0.12, 0.12, 0.12), c: PAL.arancio, x: x + Math.cos(k * 2) * 0.15, y: 5.8, z: Math.sin(k * 2) * 0.15 });
  return unisci(p);
}
function lampione(): THREE.BufferGeometry {
  return unisci([
    { g: B(0.12, 2.6, 0.12), c: PAL.legnoScuro, y: 1.3 }, { g: B(0.7, 0.07, 0.07), c: PAL.legnoScuro, x: 0.3, y: 2.55 },
    { g: B(0.22, 0.3, 0.22), c: PAL.roccia, x: 0.6, y: 2.3 }, { g: B(0.16, 0.2, 0.16), c: PAL.giallo, x: 0.6, y: 2.3 },
  ]);
}
/** Tenda da mercato sopra un uscio: telo a strisce in pendenza, due pali, sotto casse e una cesta di frutta contro il muro. */
function bottega(): { telo: THREE.BufferGeometry; resto: THREE.BufferGeometry } {
  const telo = new THREE.PlaneGeometry(1.8, 1.2); telo.rotateX(-Math.PI / 2 + 0.45); telo.translate(0, 2.15, 0.55);
  const resto = unisci([
    ...[-0.85, 0.85].map((x): Pezzo => ({ g: B(0.06, 1.9, 0.06), c: PAL.legnoScuro, x, y: 0.95, z: 1.05 })),
    { g: B(0.45, 0.4, 0.4), c: PAL.legno, x: -0.6, y: 0.2, z: 0.25 }, { g: B(0.4, 0.35, 0.36), c: PAL.legnoChiaro, x: -0.55, y: 0.57, z: 0.25, ry: 0.3 },
    { g: CY(0.24, 0.2, 0.28, 7), c: PAL.legnoChiaro, x: 0.55, y: 0.14, z: 0.28 },
    ...[[0.5, PAL.arancio], [0.6, PAL.rosso], [0.45, PAL.giallo], [0.62, PAL.arancio]].map(([x, c], k): Pezzo => ({ g: B(0.1, 0.1, 0.1), c: c as string, x: x as number, y: 0.32, z: 0.2 + k * 0.06 })),
    { g: CY(0.12, 0.16, 0.5, 6), c: PAL.legnoChiaro, x: 0.05, y: 0.25, z: 0.22 }, { g: CY(0.05, 0.08, 0.12, 6), c: PAL.legnoChiaro, x: 0.05, y: 0.56, z: 0.22 },
  ]);
  return { telo, resto };
}
function balcone(): THREE.BufferGeometry {
  return unisci([
    { g: B(1.5, 0.1, 0.6), c: PAL.legnoScuro, y: 1.8, z: 0.3 }, { g: B(1.5, 0.08, 0.6), c: PAL.legnoScuro, y: 2.75, z: 0.3 },
    ...[-0.7, -0.35, 0, 0.35, 0.7].map((x): Pezzo => ({ g: B(0.05, 0.9, 0.05), c: PAL.legno, x, y: 2.28, z: 0.58 })),
    ...[2.0, 2.3, 2.55].map((y): Pezzo => ({ g: B(1.5, 0.04, 0.04), c: PAL.legno, y, z: 0.58 })),
    ...[-0.7, 0.7].map((x): Pezzo => ({ g: B(0.06, 0.4, 0.06), c: PAL.legnoScuro, x, y: 1.6, z: 0.5, rx: -0.6 })),
  ]);
}
/** Crocifisso sopra il passaggio del tramezzo: trave lunga `l` (lungo Z), croce dipinta coi bordi d'oro, due candele. */
function croceTramezzo(l: number): THREE.BufferGeometry {
  return unisci([
    { g: B(0.32, 0.3, l), c: PAL.legnoScuro, y: 3.0 }, { g: B(0.34, 0.06, l + 0.02), c: PAL.arancio, y: 3.17 },
    { g: B(0.12, 1.3, 0.12), c: PAL.legno, y: 3.8 }, { g: B(0.12, 0.12, 0.8), c: PAL.legno, y: 4.05 },
    { g: B(0.14, 0.18, 0.18), c: PAL.giallo, y: 4.05 }, { g: B(0.13, 0.08, 0.13), c: PAL.giallo, y: 4.48 },
    ...[-0.6, 0.6].map((z): Pezzo => ({ g: CY(0.04, 0.04, 0.22), c: PAL.sabbiaChiara, y: 3.27, z })),
  ]);
}

// ---- texture ----
const vetrataTex = () => tex(8, 12, (px) => {
  const col = [PAL.rosso, PAL.acquaProfonda, PAL.giallo, PAL.viola, PAL.acqua, PAL.arancio];
  px(PAL.neroCaldo, 0, 0, 8, 12);
  for (let y = 1; y < 12; y += 3) for (let x = 1; x < 8; x += 3) px(col[(x + y * 2) % col.length]!, x, y, 2, 2);
  px(PAL.giallo, 3, 0, 2, 1);
});
const arazzoTex = () => tex(12, 24, (px) => {
  px(PAL.rosso, 0, 0, 12, 22); px(PAL.legnoScuro, 0, 0, 12, 1); px(PAL.arancio, 1, 1, 10, 1); px(PAL.arancio, 1, 20, 10, 1);
  for (const y of [2, 19]) for (let x = 1; x < 11; x += 2) px(PAL.giallo, x, y);
  px(PAL.giallo, 5, 6, 2, 9); px(PAL.giallo, 2, 9, 8, 2); px(PAL.giallo, 4, 6, 4, 1); px(PAL.giallo, 4, 14, 4, 1); px(PAL.giallo, 2, 8, 1, 4); px(PAL.giallo, 9, 8, 1, 4);
  for (let x = 0; x < 12; x += 2) px(PAL.arancio, x, 22, 1, 2);
});
const strisceTex = (a: string, b: string) => tex(8, 4, (px) => { for (let x = 0; x < 8; x++) px(x % 4 < 2 ? a : b, x, 0, 1, 4); px(PAL.ombraCalda, 0, 3, 8, 1); });
const aloneTex = () => tex(16, 16, (px) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.sqrt((x - 7.5) * (x - 7.5) + (y - 7.5) * (y - 7.5)) / 8;
    if (d < 1 && cellHash(x, y, 7) < (1 - d) * (1 - d) * 1.2) px('#ffffff', x, y);
  }
});

export function createDettagli(scene: THREE.Scene, a: Arena, o: { centro: { x: number; z: number }; altezza: (i: number) => number }): Dettagli {
  const T = a.tile, W = a.w, H = a.h;
  const ctr = (i: number) => ({ x: ((i % W) + 0.5) * T, z: (Math.floor(i / W) + 0.5) * T });
  const at = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= H ? -1 : cz * W + cx);
  const cellA = (cx: number, cz: number) => { const i = at(cx, cz); return i < 0 ? C.fuori : a.cell[i]!; };
  const tipoA = (cx: number, cz: number) => { const i = at(cx, cz); return i < 0 ? TIPO.niente : a.tipo[i]!; };
  const suoloA = (cx: number, cz: number) => { const i = at(cx, cz); return i < 0 ? SUOLO.niente : a.suolo[i]!; };
  const disp: { dispose(): void }[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); disp.push(lam);
  const mat = (p: Posto) => new THREE.Matrix4().compose(v.set(p.x, p.y ?? 0, p.z), q.setFromEuler(e.set(0, p.ry ?? 0, 0)), sc.setScalar(p.s ?? 1));
  /** Un tipo di oggetto in tutti i suoi posti: una draw call. */
  const istanze = (geo: THREE.BufferGeometry, posti: Posto[], nome: string, m: THREE.Material = lam) => {
    const im = new THREE.InstancedMesh(geo, m, Math.max(1, posti.length)); im.name = nome; im.count = posti.length; im.frustumCulled = false; im.visible = posti.length > 0;
    posti.forEach((p, n) => im.setMatrixAt(n, mat(p)));
    scene.add(im); disp.push(geo); if (m !== lam) disp.push(m);
    return im;
  };
  const fiammelle: THREE.Vector3[] = [], aloni: { p: THREE.Vector3; c: string; s: number }[] = [];
  /** Oggetti che non si spengono mai coi muri: tutti in una mesh sola (una draw call per tutti i tipi). */
  const fissi: THREE.BufferGeometry[] = [];
  const statico = (geo: THREE.BufferGeometry, posti: Posto[]) => { for (const p of posti) fissi.push(geo.clone().applyMatrix4(mat(p))); geo.dispose(); };

  // ---- sarcofagi (2 celle lungo z) ----
  const sarc: Posto[] = [];
  for (let i = 0; i < a.tipo.length; i++) if (a.tipo[i] === TIPO.sarcofago && a.tipo[i - W] !== TIPO.sarcofago) { const p = ctr(i); sarc.push({ x: p.x, z: p.z + 0.5 * T }); }
  statico(sarcofago(), sarc);
  // ---- armadi: guardano via dal muro ----
  const arm: Posto[][] = [[], []];
  for (let i = 0; i < a.tipo.length; i++) {
    if (a.tipo[i] !== TIPO.armadio) continue;
    const cx = i % W, cz = Math.floor(i / W), p = ctr(i);
    const d = N4.find(([dx, dz]) => cellA(cx + dx, cz + dz) === C.muro) ?? [0, -1];
    arm[cellHash(cx, cz, 61) < 0.4 ? 1 : 0]!.push({ x: p.x, z: p.z, ry: Math.atan2(-d[0], -d[1]) });
  }
  statico(armadio(false), arm[0]!); statico(armadio(true), arm[1]!);
  // ---- tavoli: le coppie di «cose» sull'assito (sacrestia vicino agli armadi, sennò taverna) ----
  const tav: Posto[][] = [[], []];
  for (let i = 0; i < a.tipo.length; i++) {
    const cx = i % W, cz = Math.floor(i / W);
    if (a.tipo[i] !== TIPO.cosa || a.suolo[i] !== SUOLO.assi || tipoA(cx - 1, cz) === TIPO.cosa || tipoA(cx + 1, cz) !== TIPO.cosa) continue;
    let sacro = false;
    for (let dz = -6; dz <= 6 && !sacro; dz++) for (let dx = -8; dx <= 8; dx++) if (tipoA(cx + dx, cz + dz) === TIPO.armadio) { sacro = true; break; }
    const p = ctr(i);
    tav[sacro ? 0 : 1]!.push({ x: p.x + 0.5 * T, z: p.z });
    if (sacro) fiammelle.push(new THREE.Vector3(p.x + 0.5 * T + 0.7, 1.08, p.z + 0.2));
  }
  statico(tavolo(true), tav[0]!); statico(tavolo(false), tav[1]!);
  // ---- panche rovesciate nel deambulatorio della rotonda ----
  const pan: Posto[] = [];
  for (const deg of [25, 160, 200, 335, 95]) {
    const ang = (deg * Math.PI) / 180, x = o.centro.x + Math.cos(ang) * 7.9, z = o.centro.z + Math.sin(ang) * 7.9;
    if (cellA(Math.floor(x / T), Math.floor(z / T)) !== C.pavimento) continue;
    pan.push({ x, z, ry: -ang + Math.PI / 2 });
  }
  const pancaGeo = panca(); const giu = pancaGeo.clone(); giu.rotateX(-Math.PI / 2 + 0.15); giu.translate(0, 0.22, 0.35);
  statico(giu, pan); pancaGeo.dispose();
  // ---- candelabri: ai lati dell'altare, all'arco del tramezzo, alla testa dei sarcofagi ----
  const cand: Posto[] = [];
  cand.push({ x: a.altare.x - 1.7, z: a.altare.z - 1.9 }, { x: a.altare.x - 1.7, z: a.altare.z + 1.9 });
  for (const s of sarc) { const d = s.z < o.centro.z ? -1.4 : 1.4; const c = at(Math.floor(s.x / T), Math.floor((s.z + d) / T)); if (c >= 0 && a.cell[c] === C.pavimento) cand.push({ x: s.x + 0.6, z: s.z + d * 0.8 }); }
  statico(candelabro(), cand);
  for (const c of cand) for (const dx of CANDELE) fiammelle.push(new THREE.Vector3(c.x + dx, 1.66, c.z));
  // ---- crocifisso sopra il passaggio del tramezzo ----
  const tram = [...Array(W * H).keys()].filter((i) => a.tipo[i] === TIPO.tramezzo);
  let croce: THREE.Mesh | null = null;
  if (tram.length) {
    const xs = tram.map((i) => i % W), zs = tram.map((i) => Math.floor(i / W)).sort((x, y) => x - y);
    let gz0 = zs[0]!, gz1 = zs[0]!;
    for (let k = 1; k < zs.length; k++) if (zs[k]! - zs[k - 1]! > 1) { gz0 = zs[k - 1]!; gz1 = zs[k]!; }
    const l = (gz1 - gz0 + 1) * T, g = croceTramezzo(l);
    croce = new THREE.Mesh(g, lam); croce.name = 'crocifisso'; croce.position.set((xs[0]! + 0.5) * T, 0, ((gz0 + gz1 + 1) / 2) * T); croce.rotation.y = 0;
    scene.add(croce); disp.push(g);
    fiammelle.push(new THREE.Vector3(croce.position.x, 3.42, croce.position.z - 0.6), new THREE.Vector3(croce.position.x, 3.42, croce.position.z + 0.6));
  }
  // ---- vetrate sopra le finestre sbarrate (sulla faccia di dentro), il vetro colorato non prende luce: brilla ----
  const vet: Posto[] = [];
  a.finestre.forEach((f) => {
    const nx = f.dentro.x - f.x, nz = f.dentro.z - f.z, d = Math.sqrt(nx * nx + nz * nz) || 1;
    const lat = N4.filter(([dx, dz]) => Math.abs(dx) !== Math.abs(nx / d) || Math.abs(dz) !== Math.abs(nz / d)).map(([dx, dz]) => at(f.cx + dx, f.cz + dz)).filter((i) => i >= 0 && a.cell[i] === C.muro);
    const hMin = Math.min(...lat.map((i) => o.altezza(i)), 9);
    if (hMin < 3.0) return;
    vet.push({ x: f.x + (nx / d) * 0.05, y: 2.35, z: f.z + (nz / d) * 0.05, ry: Math.atan2(nx / d, nz / d) });
  });
  const vetT = vetrataTex(); disp.push(vetT);
  const vetGeo = new THREE.PlaneGeometry(0.9, 1.2); vetGeo.translate(0, 0.6, 0);
  istanze(vetGeo, vet, 'vetrate', new THREE.MeshBasicMaterial({ map: vetT, side: THREE.DoubleSide }));
  // ---- arazzi rossi del coro sui muri lunghi del presbiterio (faccia di dentro) ----
  const araz: Posto[] = [];
  for (let i = 0; i < a.tipo.length; i++) {
    if (a.cell[i] !== C.muro || a.tipo[i] !== TIPO.chiesa) continue;
    const cx = i % W, cz = Math.floor(i / W);
    if (cellHash(cx, cz, 71) > 0.18 || o.altezza(i) < 3.0) continue;
    for (const [dx, dz] of N4) {
      const j = at(cx + dx, cz + dz);
      if (j < 0 || a.cell[j] !== C.pavimento || a.suolo[j] !== SUOLO.pietra) continue;
      if (Math.abs(ctr(j).z - a.altare.z) > 7 || ctr(j).x < o.centro.x + 9) continue; // solo nel coro
      araz.push({ x: (cx + 0.5 + dx * 0.52) * T, y: 0.9, z: (cz + 0.5 + dz * 0.52) * T, ry: Math.atan2(dx, dz) });
      break;
    }
  }
  const arT = arazzoTex(); disp.push(arT);
  const arGeo = new THREE.PlaneGeometry(0.85, 1.9); arGeo.translate(0, 0.95, 0);
  istanze(arGeo, araz, 'arazzi', new THREE.MeshLambertMaterial({ map: arT, side: THREE.DoubleSide }));
  // ---- raggi di luna dal tetto crollato della rotonda ----
  const raggiGeo = unisci([0, 2.1, 4.2].map((k): Pezzo => ({ g: B(0.9, 10, 0.05), c: PAL.acquaBassa, x: o.centro.x + Math.cos(k) * 3.2, y: 5, z: o.centro.z + Math.sin(k) * 3.2, rz: 0.32, ry: k })));
  const raggi = new THREE.Mesh(raggiGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }));
  raggi.name = 'raggi_luna'; raggi.renderOrder = 3; scene.add(raggi); disp.push(raggiGeo, raggi.material as THREE.Material);

  // ---- fuori: botteghe sopra gli usci delle case, balconi a grata ----
  const bott: Posto[] = [], bal: Posto[] = [];
  const caseViste = new Set<number>();
  for (let i = 0; i < a.tipo.length; i++) {
    if (a.tipo[i] !== TIPO.casa) continue;
    const cx = i % W, cz = Math.floor(i / W);
    // bordo sud o est verso un suolo di borgo, alto abbastanza
    for (const [dx, dz] of [[0, 1], [1, 0]] as const) {
      if (tipoA(cx + dx, cz + dz) === TIPO.casa || cellA(cx + dx, cz + dz) === C.fuori || suoloA(cx + dx, cz + dz) === SUOLO.erba) continue;
      if (o.altezza(i) < 2.2) continue;
      const h = cellHash(cx, cz, 81), p = ctr(i), ry = Math.atan2(dx, dz);
      const zona = Math.floor(cx / 6) * 1000 + Math.floor(cz / 6);
      if (h < 0.22 && !caseViste.has(zona)) { caseViste.add(zona); bott.push({ x: p.x + dx * 0.5, z: p.z + dz * 0.5, ry }); }
      else if (h > 0.86 && o.altezza(i) >= 2.6) bal.push({ x: p.x + dx * 0.5, z: p.z + dz * 0.5, ry });
    }
  }
  const bt = bottega();
  const telaA = strisceTex(PAL.rosso, PAL.sabbiaChiara), telaB = strisceTex(PAL.acquaProfonda, PAL.sabbiaChiara); disp.push(telaA, telaB);
  istanze(bt.telo, bott.filter((_, k) => k % 2 === 0), 'tende_mercato_a', new THREE.MeshLambertMaterial({ map: telaA, side: THREE.DoubleSide }));
  istanze(bt.telo.clone(), bott.filter((_, k) => k % 2 === 1), 'tende_mercato_b', new THREE.MeshLambertMaterial({ map: telaB, side: THREE.DoubleSide }));
  istanze(bt.resto, bott, 'botteghe');
  istanze(balcone(), bal, 'balconi');
  // ---- palme e lampioni sulle celle di fuori a nord e a ovest delle zone (la camera guarda da sud-est: lì non coprono) ----
  const pal: Posto[] = [], lam2: Posto[] = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (cellA(cx, cz) !== C.fuori) continue;
    let vicino: number = SUOLO.niente;
    for (let k = 1; k <= 2 && !vicino; k++) for (const [x, z] of [[cx, cz + k], [cx + k, cz]] as const) { const s = suoloA(x, z); if (cellA(x, z) !== C.fuori && (s === SUOLO.ciottoli || s === SUOLO.sabbia || s === SUOLO.terra)) { vicino = s; break; } }
    if (!vicino) continue;
    const h = cellHash(cx, cz, 91);
    if (h < 0.09) pal.push({ x: (cx + 0.5) * T, z: (cz + 0.5) * T, ry: h * 60, s: 0.8 + h * 3 });
    else if (h > 0.95 && vicino !== SUOLO.terra) lam2.push({ x: (cx + 0.5) * T, z: (cz + 0.5) * T, ry: Math.PI });
  }
  statico(palma(), pal); statico(lampione(), lam2);
  for (const l of lam2) aloni.push({ p: new THREE.Vector3(l.x - 0.6, 2.3, l.z), c: PAL.arancio, s: 3.2 });
  // la mesh unica degli oggetti fissi
  if (fissi.length) {
    const pos: number[] = [], nor: number[] = [], col: number[] = [];
    for (const g of fissi) {
      const P0 = g.getAttribute('position'), N0 = g.getAttribute('normal'), C0 = g.getAttribute('color');
      for (let k = 0; k < P0.count; k++) { pos.push(P0.getX(k), P0.getY(k), P0.getZ(k)); nor.push(N0.getX(k), N0.getY(k), N0.getZ(k)); col.push(C0.getX(k), C0.getY(k), C0.getZ(k)); }
      g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const me = new THREE.Mesh(g, lam); me.name = 'arredi_fissi'; me.frustumCulled = false; scene.add(me); disp.push(g);
  }
  // ---- nebbia bassa del cimitero ----
  const erba = [...Array(W * H).keys()].filter((i) => a.suolo[i] === SUOLO.erba);
  let nebbia: THREE.Mesh | null = null;
  if (erba.length) {
    const xs = erba.map((i) => i % W), zs = erba.map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const pezzi: Pezzo[] = [];
    for (let k = 0; k < 9; k++) pezzi.push({ g: new THREE.PlaneGeometry(7, 5).rotateX(-Math.PI / 2), c: PAL.pietraChiara, x: x0 + (x1 - x0) * cellHash(k, 1, 3), y: 0.25 + 0.1 * (k % 3), z: z0 + (z1 - z0) * cellHash(k, 2, 3) });
    const g = unisci(pezzi);
    nebbia = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.09, depthWrite: false }));
    nebbia.name = 'nebbia'; nebbia.renderOrder = 2; scene.add(nebbia); disp.push(g, nebbia.material as THREE.Material);
  }
  // ---- fiammelle delle candele (a scatti) e aloni caldi (candele, bracieri, lampioni) ----
  const fiamma = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.11, 4).translate(0, 0.055, 0), new THREE.MeshBasicMaterial({ color: PAL.giallo }), Math.max(1, fiammelle.length));
  fiamma.name = 'fiammelle'; fiamma.frustumCulled = false; fiamma.count = fiammelle.length; scene.add(fiamma); disp.push(fiamma.geometry, fiamma.material as THREE.Material);
  for (const b of a.bracieri) aloni.push({ p: new THREE.Vector3(b.x, 1.5, b.z), c: PAL.arancio, s: 4 });
  for (const f of fiammelle) if (cellHash(Math.floor(f.x * 3), Math.floor(f.z * 3), 5) < 0.5) aloni.push({ p: f.clone().setY(f.y + 0.1), c: PAL.giallo, s: 1.4 });
  const alT = aloneTex(); disp.push(alT);
  const alGeo = new THREE.BufferGeometry();
  alGeo.setAttribute('position', new THREE.Float32BufferAttribute(aloni.flatMap((x) => [x.p.x, x.p.y, x.p.z]), 3));
  const colA = new THREE.Color();
  alGeo.setAttribute('color', new THREE.Float32BufferAttribute(aloni.flatMap((x) => { colA.set(x.c); return [colA.r, colA.g, colA.b]; }), 3));
  const alMat = new THREE.PointsMaterial({ map: alT, size: 2.6, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  const alo = new THREE.Points(alGeo, alMat); alo.name = 'aloni'; alo.frustumCulled = false; alo.renderOrder = 4; scene.add(alo); disp.push(alGeo, alMat);

  let passo = -1;
  return {
    update(t) {
      const st = Math.floor(t * 8);
      if (st === passo) return;
      passo = st;
      fiammelle.forEach((f, n) => fiamma.setMatrixAt(n, m4.compose(f, q.identity(), sc.set(1, 0.7 + 0.6 * cellHash(n, st, 3), 1))));
      fiamma.instanceMatrix.needsUpdate = true;
      alMat.opacity = 0.28 + 0.06 * cellHash(st, 1, 9);
      if (nebbia) { nebbia.position.x = Math.sin(st * 0.05) * 1.5; nebbia.position.z = Math.cos(st * 0.04) * 1.0; }
    },
    stats: () => ({ sarcofagi: sarc.length, candele: fiammelle.length, palme: pal.length, lampioni: lam2.length, vetrate: vet.length }),
    dispose() { for (const d of disp) d.dispose(); },
  };
}
