// Oggetti delle armi dei Templari che il kit del GDR non ha (docs/TEMPLARI.md §6-7): pistola a pietra focaia, pistola doppia, moschetto,
// trombone, vaso del fuoco greco, scudo templare (bianco con la croce patente rossa), cassa del tesoro col lucchetto. Low-poly, colori della
// palette per faccia. Le armi hanno l'impugnatura all'origine, la canna lungo +Y e il sopra verso +Z (come vuole rpg/dungeon_hero.ts).
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';

type B = [w: number, h: number, d: number, x: number, y: number, z: number, c: string];
const mat = new Map<string, THREE.MeshLambertMaterial>();
const m = (c: string, emissive = false) => { const k = c + (emissive ? '*' : ''); let x = mat.get(k); if (!x) { x = new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...(emissive ? { emissive: c, emissiveIntensity: 0.9 } : {}) }); mat.set(k, x); } return x; };
function gruppo(list: B[], cil: [r0: number, r1: number, h: number, x: number, y: number, z: number, c: string][] = []): THREE.Group {
  const g = new THREE.Group();
  for (const [w, h, d, x, y, z, c] of list) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c).clone()); me.position.set(x, y, z); g.add(me); }
  for (const [r0, r1, h, x, y, z, c] of cil) { const me = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 6), m(c).clone()); me.position.set(x, y, z); g.add(me); }
  return g;
}
const FERRO = PAL.roccia, LEGNO = PAL.legnoScuro, OTTONE = PAL.arancio;

export function oggettoArma(forma: string): THREE.Group {
  switch (forma) {
    case 'pistola': return gruppo([[0.06, 0.16, 0.12, 0, -0.06, -0.04, LEGNO], [0.07, 0.22, 0.07, 0, 0.12, 0, LEGNO], [0.03, 0.06, 0.05, 0, 0.02, 0.06, OTTONE]], [[0.024, 0.028, 0.34, 0, 0.3, 0.02, FERRO]]);
    case 'pistola_doppia': return gruppo([[0.08, 0.16, 0.12, 0, -0.06, -0.04, LEGNO], [0.1, 0.22, 0.07, 0, 0.12, 0, LEGNO], [0.04, 0.06, 0.05, 0, 0.02, 0.06, OTTONE]],
      [[0.022, 0.026, 0.36, -0.03, 0.31, 0.02, FERRO], [0.022, 0.026, 0.36, 0.03, 0.31, 0.02, FERRO]]);
    case 'moschetto': return gruppo([[0.07, 0.36, 0.1, 0, -0.14, -0.02, LEGNO], [0.06, 0.6, 0.06, 0, 0.3, 0, LEGNO], [0.03, 0.06, 0.06, 0, 0.05, 0.06, OTTONE]], [[0.022, 0.026, 0.95, 0, 0.62, 0.04, FERRO]]);
    case 'trombone': return gruppo([[0.07, 0.3, 0.1, 0, -0.11, -0.02, LEGNO], [0.07, 0.36, 0.07, 0, 0.18, 0, LEGNO]], [[0.03, 0.035, 0.5, 0, 0.5, 0.03, OTTONE], [0.08, 0.035, 0.14, 0, 0.8, 0.03, OTTONE]]);
    case 'vaso': { // anfora di terracotta col tappo di stracci e la miccia accesa
      const g = gruppo([[0.08, 0.06, 0.08, 0, 0.27, 0, PAL.sabbiaChiara]], [[0.07, 0.11, 0.18, 0, 0.12, 0, OTTONE], [0.11, 0.08, 0.1, 0, 0, 0, PAL.legnoChiaro]]);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), m(PAL.giallo, true)); f.position.y = 0.36; g.add(f);
      return g;
    }
    default: return gruppo([[0.06, 0.4, 0.06, 0, 0.2, 0, FERRO]]);
  }
}

/** Pezzo di un oggetto unito (`unisci`): geometria, colore, posizione e rotazione. */
export type Pezzo = { g: THREE.BufferGeometry; c: string; x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number };
/** Pezzi uniti in una geometria sola coi colori per vertice (materiale con `vertexColors`): una draw call per oggetto. */
export function unisci(pezzi: Pezzo[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const k of pezzi) {
    const g = k.g.index ? k.g.toNonIndexed() : k.g.clone();
    g.applyMatrix4(m4.compose(p.set(k.x ?? 0, k.y ?? 0, k.z ?? 0), q.setFromEuler(e.set(k.rx ?? 0, k.ry ?? 0, k.rz ?? 0)), s.set(k.sx ?? 1, k.sy ?? 1, k.sz ?? 1)));
    c.set(k.c);
    const P = g.getAttribute('position'), N = g.getAttribute('normal');
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
    g.dispose(); k.g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);

/** Power-up a terra (docs/TEMPLARI.md §9), alto ~1 m sopra un anello: faretra piena di frecce, croce patente rossa (Ira di Dio), campana
 *  d'oro (Campane a martello), pila di monete (Decima), martello e asse (Muratori). Una geometria sola coi colori per vertice. */
export function potere(tipo: string): THREE.BufferGeometry {
  const anello: Pezzo[] = [{ g: new THREE.RingGeometry(0.55, 0.7, 12).rotateX(-Math.PI / 2), c: PAL.giallo, y: 0.04 }];
  switch (tipo) {
    case 'faretra': return unisci([...anello, { g: cil(0.16, 0.13, 0.6), c: PAL.legno, y: 0.95, rz: 0.25 }, { g: box(0.34, 0.06, 0.34), c: PAL.legnoChiaro, y: 0.7, rz: 0.25 },
      ...[-0.06, 0, 0.06].map((x): Pezzo => ({ g: box(0.025, 0.4, 0.025), c: PAL.legnoChiaro, x: x + 0.1, y: 1.3, rz: 0.25 })),
      ...[-0.06, 0, 0.06].map((x): Pezzo => ({ g: box(0.06, 0.1, 0.02), c: PAL.rosso, x: x + 0.15, y: 1.45, rz: 0.25 }))]);
    case 'ira': return unisci([...anello, { g: box(0.16, 0.7, 0.12), c: PAL.rosso, y: 1 }, { g: box(0.56, 0.16, 0.12), c: PAL.rosso, y: 1.12 },
      ...([[0, 1.37], [0, 0.63], [-0.28, 1.12], [0.28, 1.12]] as const).map(([x, y]): Pezzo => ({ g: box(0.24, 0.24, 0.1), c: PAL.rosso, x, y, rz: Math.PI / 4 })),
      { g: box(0.1, 0.1, 0.14), c: PAL.giallo, y: 1.12 }]);
    case 'campane': return unisci([...anello, { g: cil(0.14, 0.34, 0.45, 8), c: PAL.giallo, y: 1 }, { g: cil(0.36, 0.36, 0.06, 8), c: PAL.arancio, y: 0.77 },
      { g: box(0.08, 0.14, 0.08), c: PAL.arancio, y: 1.29 }, { g: box(0.08, 0.08, 0.08), c: PAL.roccia, y: 0.7 }]);
    case 'decima': return unisci([...anello, ...[0, 1, 2, 3].map((i): Pezzo => ({ g: cil(0.2, 0.2, 0.07, 8), c: i % 2 ? PAL.arancio : PAL.giallo, x: i === 3 ? 0.05 : 0, y: 0.75 + i * 0.08 })),
      { g: cil(0.2, 0.2, 0.07, 8), c: PAL.giallo, x: 0.12, y: 1.15, rx: Math.PI / 2 }]);
    default: return unisci([...anello, { g: box(0.06, 0.62, 0.06), c: PAL.legnoChiaro, y: 1, rz: -0.5 }, { g: box(0.36, 0.14, 0.14), c: PAL.roccia, x: 0.16, y: 1.27, rz: -0.5 },
      { g: box(0.7, 0.08, 0.2), c: PAL.legno, y: 0.72, ry: 0.4 }]);
  }
}

/** Scudo templare a goccia: bianco col bordo di ferro e la croce rossa; davanti verso −Z, alto 0,9 m dal basso (pivot al centro). */
export function scudo(): THREE.Group {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.06, 0.82, 6, 1), m(PAL.sabbiaChiara).clone());
  corpo.scale.set(1, 1, 0.16); g.add(corpo);
  const bordo = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.08, 0.86, 6, 1), m(PAL.pietraScura).clone());
  bordo.scale.set(1, 1, 0.1); bordo.position.z = 0.02; g.add(bordo);
  for (const [w, h, y] of [[0.08, 0.6, 0.02], [0.44, 0.08, 0.16]] as const) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), m(PAL.rosso).clone()); c.position.set(0, y, -0.06); g.add(c); }
  return g;
}

/** Cassa del tesoro templare: legno scuro, fasce di ferro, croce rossa sul coperchio (che si alza); pivot a terra, davanti −Z. */
export function cassa(): { obj: THREE.Group; coperchio: THREE.Group } {
  const obj = gruppo([[1.3, 0.62, 0.78, 0, 0.31, 0, LEGNO], [1.34, 0.08, 0.82, 0, 0.15, 0, FERRO], [1.34, 0.08, 0.82, 0, 0.5, 0, FERRO], [0.16, 0.18, 0.06, 0, 0.42, -0.42, OTTONE]]);
  const coperchio = gruppo([[1.32, 0.18, 0.8, 0, 0.09, 0.4, PAL.legno], [0.12, 0.02, 0.5, 0, 0.19, 0.4, PAL.rosso], [0.5, 0.02, 0.12, 0, 0.19, 0.4, PAL.rosso]]);
  coperchio.position.set(0, 0.62, -0.4); // cerniera dietro
  obj.add(coperchio);
  return { obj, coperchio };
}

/** Disegno a gesso dell'arma sul muro (16 × 16 texel su 1 m): sagome semplici; per l'arco anche le frecce. */
export function gesso(arma: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const g = cv.getContext('2d')!;
  g.fillStyle = PAL.roccia; g.fillRect(0, 0, 16, 16);
  g.fillStyle = PAL.pietraChiara;
  const px = (x: number, y: number, w = 1, h = 1) => g.fillRect(x, y, w, h);
  // cornice tratteggiata
  for (let i = 0; i < 16; i += 2) { px(i, 0); px(i, 15); px(0, i); px(15, i); }
  switch (arma) {
    case 'arco': for (let y = 3; y < 13; y++) px(5 + Math.round(Math.abs(y - 8) * 0.5), y); px(4, 3, 1, 10); for (let x = 6; x < 13; x++) px(x, 8); px(12, 7, 1, 3); break;
    case 'mazza': px(7, 6, 2, 8); px(5, 2, 6, 4); px(4, 3); px(11, 3); px(7, 1, 2, 1); break;
    case 'ascia': px(7, 3, 2, 11); px(9, 2, 3, 6); px(12, 3, 1, 4); break;
    case 'pistola': px(3, 6, 9, 2); px(4, 8, 3, 4); px(11, 5); break;
    case 'moschetto': px(1, 7, 14, 2); px(1, 9, 4, 3); px(14, 6); break;
    case 'trombone': px(2, 7, 10, 2); px(12, 6, 2, 4); px(2, 9, 3, 3); break;
    default: px(7, 2, 2, 12);
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
