// I segreti dell'isola (docs/TEMPLARI.md §9c) come li vede chi gioca.
// - Il muro crepato: sulla faccia di dentro del muro nord-ovest della rotonda, crepe scure a pixel e due sassi ai piedi (si nota, ma non
//   troppo); colpito piano fa uno sbuffo di polvere. Rotto: l'arco scuro con gli stipiti, i gradini che scendono nel nero e le macerie.
// - La cripta: l'altare della Lancia (pietra scura, la Lancia di Longino che galleggia in verticale, legata da quattro catene finché è
//   sigillato), cinque candele davanti che si accendono una per anima, una luce viola che diventa d'oro quando è libera; in fondo la scala
//   che sale verso un filo di luce; torce sui muri. Le anime volano a scatti dallo zombie morto all'altare.
// - Le campanelle: un palo con la traversa, la campanella di bronzo e il cartello col suo simbolo a pixel (croce, teschio, ancora, luna); suonata
//   oscilla. L'indizio: l'ordine scritto in rosso sul muro della taverna, numeri romani e simboli (cambia con la partita).
// - I teschi: piccoli, pallidi, in angoli bui, con due braci rosse in fondo alle orbite.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import type { TEventoDi, TView } from '@marea/sim/templari/types.ts';
import { PAL } from '../ui/style.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';

export type Segreti3d = {
  tick(v: TView): void;
  update(t: number, dt: number): void;
  evento(e: TEventoDi): void;
  stats(): { crepa: boolean; rotto: boolean; candele: number; libera: boolean; campanelle: number; indizio: string; teschi: number; anime: number };
  dispose(): void;
};

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const steps = (v: number, n: number) => Math.floor(v * n) / n;

function tex(w: number, h: number, draw: (px: (c: string, x: number, y: number, w?: number, h?: number) => void, g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  draw((c, x, y, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); }, g);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** I simboli delle campanelle (8 × 8 pixel), uguali sul cartello e sul muro dell'indizio. */
const SIMBOLI: Record<string, string[]> = {
  croce: ['.XX..XX.', 'XXX..XXX', '.XXXXXX.', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXX..XXX', '.XX..XX.'],
  teschio: ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XX.XX.XX', 'XXXXXXXX', '.XXX.XX.', '..XXXX..', '..X.X.X.'],
  ancora: ['...XX...', '..X..X..', '...XX...', 'XXXXXXXX', '...XX...', 'X..XX..X', 'XX.XX.XX', '.XXXXXX.'],
  luna: ['...XXX..', '..XX....', '.XX.....', '.XX.....', '.XX.....', '.XX.....', '..XX....', '...XXX..'],
};
function simbolo(px: (c: string, x: number, y: number, w?: number, h?: number) => void, id: string, x0: number, y0: number, c: string, k = 1): void {
  (SIMBOLI[id] ?? []).forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') px(c, x0 + x * k, y0 + y * k, k, k); }));
}
/** Numeri romani a pixel (I e V bastano fino a IV): larghezza disegnata. */
function romano(px: (c: string, x: number, y: number, w?: number, h?: number) => void, n: number, x0: number, y0: number, c: string): number {
  const s = ['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1] ?? String(n);
  let x = x0;
  for (const ch of s) {
    if (ch === 'I') { px(c, x, y0, 1, 7); x += 2; }
    else { for (let y = 0; y < 7; y++) { px(c, x + Math.floor(y / 3), y0 + y); px(c, x + 4 - Math.floor(y / 3), y0 + y); } x += 6; }
  }
  return x - x0;
}

export function createSegreti3d(scene: THREE.Scene, a: Arena): Segreti3d {
  const root = new THREE.Group(); root.name = 'segreti'; scene.add(root);
  const disp: { dispose(): void }[] = [];
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); disp.push(vc);
  const geo = (p: Pezzo[]) => { const g = unisci(p); disp.push(g); return g; };
  const basic = (c: string, o: Partial<THREE.MeshBasicMaterialParameters> = {}) => { const m = new THREE.MeshBasicMaterial({ color: c, ...o }); disp.push(m); return m; };
  const cr = a.cripta;

  // ---------------- il muro crepato e la scala ----------------
  let crepa: THREE.Mesh | null = null, rotto: THREE.Group | null = null;
  const polveri: { m: THREE.Mesh; t: number }[] = [];
  const polvereG = box(0.14, 0.14, 0.14), polvereM = basic(PAL.pietra, { transparent: true, opacity: 0.8, depthWrite: false }); disp.push(polvereG);
  if (cr) {
    const nx = cr.su.x - cr.muro.x, nz = cr.su.z - cr.muro.z, ry = Math.atan2(nx, nz); // la faccia del muro verso la chiesa
    // crepe che partono dal basso e si ramificano (16 × 32 pixel sulla faccia del muro, 6 cm l'uno), scure con qualche scheggia chiara, e
    // due sassi caduti ai piedi: tutto in una mesh sola (una draw call)
    const pix = new Map<string, string>(), P = 0.98 / 16;
    const linea = (pts: [number, number][]) => { for (let i = 0; i + 1 < pts.length; i++) { const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) pix.set(`${Math.round(x0 + ((x1 - x0) * k) / n)},${Math.round(y0 + ((y1 - y0) * k) / n)}`, PAL.neroCaldo); } };
    linea([[7, 31], [8, 26], [6, 22], [7, 17], [5, 12], [6, 8]]); linea([[8, 26], [11, 23], [12, 19]]); linea([[6, 22], [3, 20], [2, 16]]); linea([[7, 17], [10, 14], [10, 10]]);
    for (const [x, y] of [[9, 25], [5, 21], [8, 16], [4, 13], [11, 20]] as const) pix.set(`${x},${y}`, PAL.pietraChiara);
    const pezzi: Pezzo[] = [...pix].map(([k, c]) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { g: box(P, P, 0.012), c, x: (x - 7.5) * P, y: (31.5 - y) * P, z: 0.006 }; });
    pezzi.push({ g: new THREE.DodecahedronGeometry(0.12, 0), c: PAL.pietra, x: 0.25, y: 0.08, z: 0.21 }, { g: new THREE.DodecahedronGeometry(0.08, 0), c: PAL.pietraScura, x: -0.2, y: 0.05, z: 0.29 });
    crepa = new THREE.Mesh(geo(pezzi), vc);
    crepa.name = 'crepa'; crepa.position.set(cr.muro.x + nx * 0.5, 0, cr.muro.z + nz * 0.5); crepa.rotation.y = ry;
    root.add(crepa);
    // rotto: dove c'era il muro un buco nel pavimento, i gradini che scendono verso il muro e spariscono nel nero (più scuri a ogni
    // gradino), i monconi bassi del muro ai lati e le macerie sparse davanti (locale: +z = verso la chiesa, x = lungo il muro)
    rotto = new THREE.Group(); rotto.name = 'muro_rotto'; rotto.visible = false;
    rotto.position.set(cr.muro.x, 0, cr.muro.z); rotto.rotation.y = ry; root.add(rotto);
    const gradini: Pezzo[] = [{ g: box(1.0, 0.02, 1.0), c: PAL.neroCaldo, y: 0.01 }];
    [PAL.pietra, PAL.pietraScura, PAL.roccia, PAL.ombraCalda].forEach((c, k) => gradini.push({ g: box(0.78, 0.03, 0.2), c, y: 0.025, z: 0.38 - k * 0.22 }, { g: box(0.78, 0.035, 0.03), c: PAL.neroCaldo, y: 0.03, z: 0.27 - k * 0.22 }));
    gradini.push(
      { g: box(0.24, 0.85, 0.9), c: PAL.pietraScura, x: -0.4, y: 0.42 }, { g: box(0.2, 0.5, 0.6), c: PAL.pietra, x: 0.42, y: 0.25, z: -0.15 }, // i monconi
      { g: box(0.3, 0.3, 0.28), c: PAL.pietra, x: -0.38, y: 0.95, z: 0.1, ry: 0.4 },
    );
    rotto.add(new THREE.Mesh(geo(gradini), vc));
    const mac: Pezzo[] = [];
    for (let k = 0; k < 9; k++) mac.push({ g: new THREE.DodecahedronGeometry(0.08 + 0.09 * ((k * 0.618) % 1), 0), c: k % 2 ? PAL.pietra : PAL.pietraScura, x: -0.7 + ((k * 0.37) % 1) * 1.4, y: 0.07, z: 0.6 + ((k * 0.53) % 1) * 0.9, rx: k, ry: k * 2 });
    rotto.add(new THREE.Mesh(geo(mac), vc));
  }

  // ---------------- la cripta: altare, Lancia, candele, scala, torce ----------------
  let altLuce: THREE.PointLight | null = null, lancia: THREE.Group | null = null, catene: THREE.Mesh | null = null, raggio: THREE.Mesh | null = null;
  // fiammelle in due InstancedMesh (candele dell'altare, torce): poche draw call nella cripta
  const fiammaG = new THREE.ConeGeometry(0.06, 0.16, 4); fiammaG.translate(0, 0.08, 0); disp.push(fiammaG);
  const candele = new THREE.InstancedMesh(fiammaG, basic(PAL.giallo), 5), torce = new THREE.InstancedMesh(fiammaG, basic(PAL.arancio), 12);
  candele.name = 'candele_cripta'; torce.name = 'torce_cripta'; candele.count = 0; torce.count = 0; candele.frustumCulled = false; torce.frustumCulled = false;
  const posCandele: THREE.Vector3[] = [], posTorce: THREE.Vector3[] = [], m4 = new THREE.Matrix4(), qi = new THREE.Quaternion(), sc3 = new THREE.Vector3();
  if (cr) {
    const alt = new THREE.Group(); alt.name = 'altare_cripta'; alt.position.set(cr.altare.x, 0, cr.altare.z); root.add(alt);
    alt.add(new THREE.Mesh(geo([
      { g: box(1.0, 0.95, 2.9), c: PAL.roccia, y: 0.475 }, { g: box(1.12, 0.12, 3.0), c: PAL.pietraScura, y: 1.0 },
      { g: box(0.08, 0.5, 0.5), c: PAL.rosso, x: 0.52, y: 0.55 }, { g: box(0.08, 0.16, 1.0), c: PAL.rosso, x: 0.52, y: 0.62 }, // la croce sul fianco
      ...[-1, 1].map((s): Pezzo => ({ g: box(0.3, 0.12, 0.3), c: PAL.roccia, y: 1.12, z: s * 1.25 })),
    ]), vc));
    // la Lancia: distesa sopra l'altare (lungo l'altare), asta di frassino chiara, punta di ferro a foglia con la fascia d'oro (il chiodo
    // della Croce); galleggia e brilla appena nel buio
    lancia = new THREE.Group(); lancia.name = 'lancia'; lancia.position.set(0, 1.5, 0); lancia.rotation.x = Math.PI / 2; alt.add(lancia);
    const lm = new THREE.Mesh(geo([
      { g: cil(0.06, 0.06, 2.3), c: PAL.legnoChiaro, y: 1.15 }, { g: cil(0.08, 0.08, 0.16), c: PAL.giallo, y: 2.3 }, { g: cil(0.07, 0.07, 0.1), c: PAL.giallo, y: 0.05 },
      { g: new THREE.OctahedronGeometry(0.22, 0), c: PAL.pietraChiara, y: 2.68, sy: 2.4, sz: 0.4 }, { g: box(0.08, 0.08, 0.08), c: PAL.giallo, y: 2.55 },
    ]), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: '#5a4520' }));
    lm.position.y = -1.35; lancia.add(lm); disp.push(lm.material as THREE.Material);
    // le catene: dagli angoli dell'altare all'asta
    const cat: Pezzo[] = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x0 = sx * 0.5, z0 = sz * 1.35, y0 = 1.06, x1 = 0, z1 = sz * 0.8, y1 = 1.5;
      for (let k = 0; k < 5; k++) { const f = (k + 0.5) / 5; cat.push({ g: box(0.09, 0.09, 0.09), c: k % 2 ? PAL.roccia : PAL.pietraScura, x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, z: z0 + (z1 - z0) * f, ry: k * 0.7 }); }
    }
    catene = new THREE.Mesh(geo(cat), vc); alt.add(catene);
    // il fascio d'oro quando è libera
    const rG = box(0.5, 9, 0.5); rG.translate(0, 4.5, 0); disp.push(rG);
    raggio = new THREE.Mesh(rG, basic(PAL.giallo, { transparent: true, opacity: 0.22, depthWrite: false })); raggio.visible = false; raggio.renderOrder = 2; alt.add(raggio);
    // cinque candele davanti all'altare, verso la sala (una mesh sola; le fiammelle si accendono una per anima)
    const fx = cr.giu.x > cr.altare.x ? 1 : -1;
    for (let k = 0; k < 5; k++) posCandele.push(new THREE.Vector3(cr.altare.x + fx * 0.85, 0.52, cr.altare.z + (k - 2) * 0.55));
    alt.add(new THREE.Mesh(geo(posCandele.flatMap((p): Pezzo[] => [{ g: cil(0.07, 0.08, 0.5), c: PAL.sabbiaChiara, x: fx * 0.85, y: 0.25, z: p.z - cr.altare.z }, { g: cil(0.14, 0.14, 0.05), c: PAL.roccia, x: fx * 0.85, y: 0.02, z: p.z - cr.altare.z }])), vc));
    root.add(candele);
    altLuce = new THREE.PointLight(PAL.viola, 9, 10, 1.4); altLuce.position.set(fx * 1.2, 2.2, 0); alt.add(altLuce);
    // la scala in fondo: gradini che salgono verso il filo di luce
    const sc = new THREE.Group(); sc.name = 'scala_cripta'; sc.position.set(cr.scala.x, 0, cr.scala.z); sc.rotation.y = Math.atan2(cr.scala.x - cr.giu.x, cr.scala.z - cr.giu.z); root.add(sc);
    sc.add(new THREE.Mesh(geo([0, 1, 2, 3, 4].map((k): Pezzo => ({ g: box(0.9, 0.18 + k * 0.2, 0.2), c: k % 2 ? PAL.pietra : PAL.pietraScura, y: (0.18 + k * 0.2) / 2, z: -0.4 + k * 0.2 }))), vc));
    const luceG = new THREE.PlaneGeometry(0.8, 2.6); luceG.translate(0, 1.3, 0); disp.push(luceG);
    const luce = new THREE.Mesh(luceG, basic(PAL.sabbiaChiara, { transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })); luce.position.set(0, 0, 0.45); luce.renderOrder = 2; sc.add(luce);
    // torce sui muri lunghi (niente luci vere: costano a tutta la scena), fiamme che tremano a scatti
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < cr.dentro.length; i++) if (cr.dentro[i]) { const x = i % a.w, z = Math.floor(i / a.w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (const z of [z0 - 0.45, z1 + 1.45]) for (let x = x0 + 3; x < x1 - 1 && posTorce.length < 12; x += 6) posTorce.push(new THREE.Vector3(x + 0.5, 1.84, z));
    root.add(new THREE.Mesh(geo(posTorce.flatMap((p): Pezzo[] => [{ g: box(0.1, 0.35, 0.1), c: PAL.legnoScuro, x: p.x, y: 1.6, z: p.z }, { g: box(0.16, 0.08, 0.16), c: PAL.roccia, x: p.x, y: 1.8, z: p.z }])), vc));
    torce.count = posTorce.length; root.add(torce);
  }

  // ---------------- le anime che volano all'altare ----------------
  const animaG = new THREE.OctahedronGeometry(0.16, 0); disp.push(animaG);
  const animaM = basic(PAL.acquaBassa, { transparent: true, opacity: 0.9, depthWrite: false });
  const anime: { m: THREE.Mesh; scia: THREE.Mesh[]; da: THREE.Vector3; t: number }[] = [];

  // ---------------- le campanelle ----------------
  // ognuna: il palo con la traversa e il cartello col simbolo (a pixel, nella stessa mesh) e la campanella che oscilla: due draw call
  const camp = new Map<string, { g: THREE.Group; bronzo: THREE.Object3D; t: number; amp: number }>();
  const bronzoG = geo([{ g: box(0.03, 0.12, 0.03), c: PAL.roccia, y: -0.06 }, { g: cil(0.1, 0.24, 0.32, 8), c: PAL.arancio, y: -0.28 }, { g: cil(0.25, 0.25, 0.04, 8), c: PAL.legnoChiaro, y: -0.44 }, { g: box(0.06, 0.08, 0.06), c: PAL.roccia, y: -0.48 }]);
  for (const c of a.campanelle) {
    const g = new THREE.Group(); g.name = 'campanella_' + c.id; g.position.set(c.x, 0, c.z); root.add(g);
    const S = 0.045, segno: Pezzo[] = [];
    (SIMBOLI[c.id] ?? []).forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') for (const [lx, lz, ry] of [[0, 0.225, 0], [0.225, 0, Math.PI / 2]] as const) segno.push({ g: box(S, S, 0.01), c: c.id === 'croce' ? PAL.rosso : PAL.sabbiaChiara, x: lx + (ry ? 0 : (x - 3.5) * S), y: 1.15 + (3.5 - y) * S, z: lz + (ry ? -(x - 3.5) * S : 0), ry }); }));
    g.add(new THREE.Mesh(geo([
      { g: box(0.16, 2.0, 0.16), c: PAL.legnoScuro, y: 1.0 }, { g: box(0.7, 0.12, 0.12), c: PAL.legno, x: 0.27, y: 1.95 },
      { g: box(0.4, 0.3, 0.4), c: PAL.roccia, y: 0.15 }, { g: box(0.44, 0.44, 0.44), c: PAL.legnoScuro, y: 1.15 }, // il cartello (le facce verso la camera)
      ...segno,
    ]), vc));
    const bronzo = new THREE.Group(); bronzo.position.set(0.48, 1.9, 0); g.add(bronzo);
    bronzo.add(new THREE.Mesh(bronzoG, vc));
    camp.set(c.id, { g, bronzo, t: 99, amp: 0 });
  }
  // l'indizio: l'ordine sul muro della taverna (si disegna quando la partita lo dice)
  let indizio: THREE.Mesh | null = null, indizioOra = '';
  if (a.indizio) {
    const ig = new THREE.PlaneGeometry(1.7, 1.5); disp.push(ig);
    indizio = new THREE.Mesh(ig, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5 })); disp.push(indizio.material as THREE.Material);
    indizio.name = 'indizio'; indizio.position.set(a.indizio.wx + a.indizio.nx * 0.52, 1.35, a.indizio.wz + a.indizio.nz * 0.52); indizio.rotation.y = Math.atan2(a.indizio.nx, a.indizio.nz);
    indizio.visible = false; root.add(indizio);
  }
  const scriviIndizio = (ordine: string[]) => {
    if (!indizio) return;
    const t = tex(36, 32, (px) => {
      // vernice rossa colata: numero romano e simbolo, una riga per campanella
      ordine.forEach((id, k) => { const y = 1 + k * 8, w = romano(px, k + 1, 7, y, PAL.rosso); simbolo(px, id, Math.max(19, 9 + w + 3), y, PAL.rosso); if ((k * 7) % 3 === 0) px(PAL.rosso, 8, y + 7, 1, 1); });
    });
    const m = indizio.material as THREE.MeshBasicMaterial; // vernice che si legge anche al buio
    m.map?.dispose(); m.map = t; m.needsUpdate = true; indizio.visible = true;
  };

  // ---------------- i teschi ----------------
  // una mesh ciascuno: le orbite scure con una brace rossa in fondo (si vede solo da vicino)
  const tes = new Map<string, { g: THREE.Group }>();
  const teschioG = geo([
    { g: box(0.22, 0.18, 0.24), c: PAL.pietraChiara, y: 0.14 }, { g: box(0.16, 0.07, 0.14), c: PAL.pietra, y: 0.035, z: -0.04 },
    { g: box(0.06, 0.05, 0.02), c: PAL.neroCaldo, x: -0.05, y: 0.15, z: -0.121 }, { g: box(0.06, 0.05, 0.02), c: PAL.neroCaldo, x: 0.05, y: 0.15, z: -0.121 },
    { g: box(0.022, 0.022, 0.01), c: PAL.rosso, x: -0.05, y: 0.15, z: -0.128 }, { g: box(0.022, 0.022, 0.01), c: PAL.rosso, x: 0.05, y: 0.15, z: -0.128 },
    { g: box(0.03, 0.04, 0.02), c: PAL.neroCaldo, y: 0.09, z: -0.121 },
  ]);
  a.teschi.forEach((t, k) => {
    const g = new THREE.Group(); g.name = 'teschio_' + t.id; g.position.set(t.x + 0.2, 0, t.z - 0.15); g.rotation.y = k * 1.7 + 0.4; root.add(g);
    g.add(new THREE.Mesh(teschioG, vc));
    tes.set(t.id, { g });
  });

  let rottoOra = false, libera = false, nCandele = 0, haLancia = false;
  const altare = cr ? new THREE.Vector3(cr.altare.x, 1.6, cr.altare.z) : new THREE.Vector3();
  return {
    tick(v) {
      const g = v.segreti;
      if (g.muro !== rottoOra) { rottoOra = g.muro; if (crepa) crepa.visible = !g.muro; if (rotto) rotto.visible = g.muro; }
      const lib = g.anime >= g.tutte, mia = v.eroe.armi.some((x) => x?.id === 'lancia');
      if (lib !== libera || mia !== haLancia) {
        libera = lib; haLancia = mia;
        if (catene) catene.visible = !lib;
        if (raggio) raggio.visible = lib && !mia;
        if (lancia) lancia.visible = !mia; // la tua è in mano: sull'altare resta per gli altri, tu non la vedi più
        if (altLuce) { altLuce.color.set(lib ? PAL.giallo : PAL.viola); altLuce.intensity = lib ? 14 : 6; }
      }
      nCandele = Math.min(posCandele.length, g.anime);
      candele.count = nCandele;
      // candele e torce (sempre disegnate: InstancedMesh) e la luce dell'altare solo per chi è nella cripta
      candele.visible = torce.visible = g.dentro;
      if (altLuce) altLuce.visible = g.dentro;
      const k = g.ordine.join();
      if (k !== indizioOra && g.ordine.length) { indizioOra = k; scriviIndizio(g.ordine); }
      for (const t of g.teschi) { const x = tes.get(t.id); if (x) x.g.visible = !t.preso; }
    },
    update(t, dt) {
      const st = Math.floor(t * 10);
      if (lancia?.visible) lancia.position.y = (libera ? 1.7 : 1.5) + 0.08 * steps((Math.sin(t * 1.6) + 1) / 2, 4);
      if (raggio?.visible) (raggio.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.08 * steps((Math.sin(t * 2) + 1) / 2, 4);
      if (altLuce) altLuce.intensity = (libera ? 14 : 8) + 2 * (((st * 0.618) % 1));
      for (let k = 0; k < nCandele; k++) candele.setMatrixAt(k, m4.compose(posCandele[k]!, qi, sc3.set(1, 0.8 + 0.5 * (((st + k * 3) * 0.618) % 1), 1)));
      for (let k = 0; k < posTorce.length; k++) torce.setMatrixAt(k, m4.compose(posTorce[k]!, qi, sc3.set(1.6, 1.3 + 0.8 * (((st + k * 5) * 0.618) % 1), 1.6)));
      candele.instanceMatrix.needsUpdate = true; torce.instanceMatrix.needsUpdate = true;
      // le campanelle che oscillano (a scatti), che si smorzano
      for (const c of camp.values()) {
        if (c.amp <= 0) continue;
        c.t += dt; c.amp = Math.max(0, c.amp - dt * 0.5);
        c.bronzo.rotation.z = steps((Math.sin(c.t * 9) * c.amp + 1) / 2, 12) * 2 - 1;
        if (c.amp <= 0) c.bronzo.rotation.z = 0;
      }
      // anime: in volo verso l'altare (1 s), un arco che sale, a scatti; poi spariscono
      for (let i = anime.length - 1; i >= 0; i--) {
        const s = anime[i]!;
        s.t += dt;
        const k = Math.min(1, steps(s.t / 1.1, 14));
        s.m.position.lerpVectors(s.da, altare, k); s.m.position.y += Math.sin(k * Math.PI) * 2;
        s.m.rotation.y = t * 4;
        s.scia.forEach((q, j) => { const kk = Math.max(0, k - (j + 1) * 0.06); q.position.lerpVectors(s.da, altare, kk); q.position.y += Math.sin(kk * Math.PI) * 2; });
        if (s.t >= 1.15) { for (const q of [s.m, ...s.scia]) q.removeFromParent(); anime.splice(i, 1); }
      }
      // polvere del muro: sbuffi che cadono e si allargano
      for (let i = polveri.length - 1; i >= 0; i--) {
        const p = polveri[i]!; p.t += dt;
        p.m.position.y -= dt * 0.6; p.m.scale.setScalar(1 + p.t * 2);
        if (p.t > 0.9) { p.m.removeFromParent(); polveri.splice(i, 1); }
      }
    },
    evento(e) {
      if (e.t === 'cripta' && e.fase === 'polvere' && cr) {
        const nx = cr.su.x - cr.muro.x, nz = cr.su.z - cr.muro.z;
        for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(polvereG, polvereM); m.position.set(cr.muro.x + nx * 0.6 + (k - 2.5) * 0.12 * nz, 1.2 + (k % 3) * 0.35, cr.muro.z + nz * 0.6 + (k - 2.5) * 0.12 * nx); root.add(m); polveri.push({ m, t: k * 0.05 }); }
      }
      if (e.t === 'anima') {
        const da = new THREE.Vector3(e.x, 1, e.z), m = new THREE.Mesh(animaG, animaM);
        const scia = [0, 1, 2].map((j) => { const q = new THREE.Mesh(animaG, animaM); q.scale.setScalar(0.6 - j * 0.15); root.add(q); return q; });
        m.position.copy(da); root.add(m); anime.push({ m, scia, da, t: 0 });
      }
      if (e.t === 'campanella') { const c = camp.get(e.id); if (c) { c.t = 0; c.amp = e.giusta ? 1 : 0.5; } }
    },
    stats: () => ({ crepa: !!crepa?.visible, rotto: rottoOra, candele: nCandele, libera, campanelle: camp.size, indizio: indizioOra, teschi: [...tes.values()].filter((x) => x.g.visible).length, anime: anime.length }),
    dispose() { root.removeFromParent(); for (const d of disp) d.dispose(); },
  };
}
