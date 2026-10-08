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
