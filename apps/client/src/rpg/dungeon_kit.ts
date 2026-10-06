// Kit del dungeon (R-scena): modelli di manifest_rpg.json come «parti» (geometria Float32 con la matrice del nodo già applicata +
// materiale Lambert flat, mai PBR) da istanziare; segnaposto procedurali in colori di palette se un modello manca; materiali tinti.
import * as THREE from 'three';
import type { Loader } from '../render/loader.ts';
import { floatGeometry } from '../render/island_parts.ts';

export type Part = { geo: THREE.BufferGeometry; mat: THREE.MeshLambertMaterial };
const cache = new WeakMap<Loader, Map<string, Promise<Part[] | null>>>();
const lambertOf = new Map<THREE.Material, THREE.MeshLambertMaterial>();

/** Materiale glTF (Standard) → Lambert flat con la stessa texture, colore ed emissivo (le torce e i cristalli restano accesi). */
export function toLambert(src: THREE.Material): THREE.MeshLambertMaterial {
  let m = lambertOf.get(src);
  if (m) return m;
  const s = src as THREE.MeshStandardMaterial;
  m = new THREE.MeshLambertMaterial({
    name: s.name, color: s.color ? s.color.clone() : new THREE.Color(1, 1, 1), map: s.map ?? null, vertexColors: !!s.vertexColors, flatShading: true,
    emissive: s.emissive ? s.emissive.clone() : new THREE.Color(0, 0, 0), emissiveMap: s.emissiveMap ?? null, emissiveIntensity: s.emissiveIntensity ?? 1,
    transparent: s.transparent, alphaTest: s.alphaTest, side: s.side,
  });
  lambertOf.set(src, m);
  return m;
}

/** Parti di un modello (cache per nome); null se il modello non c'è nel manifest o non si carica. */
export function parts(loader: Loader, name: string): Promise<Part[] | null> {
  let c = cache.get(loader);
  if (!c) { c = new Map(); cache.set(loader, c); }
  let p = c.get(name);
  if (!p) {
    p = (async () => {
      if (!loader.has(name)) return null;
      try {
        const { scene } = await loader.load(name);
        scene.updateMatrixWorld(true);
        const out: Part[] = [];
        scene.traverse((n) => {
          const m = n as THREE.Mesh; if (!m.isMesh) return;
          const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
          out.push({ geo: floatGeometry(m.geometry).applyMatrix4(m.matrixWorld), mat: toLambert(mat) });
        });
        return out.length ? out : null;
      } catch (e) { console.warn(`[marea] ${name} non caricato, uso il segnaposto`, e); return null; }
    })();
    c.set(name, p);
  }
  return p;
}

/** Oggetto singolo (nemici, oggetti in mano): un gruppo con le parti e materiali propri (si possono tingere e far lampeggiare). */
export async function object(loader: Loader, name: string, fallback: () => THREE.Object3D): Promise<THREE.Object3D> {
  const ps = await parts(loader, name);
  if (!ps) return fallback();
  const g = new THREE.Group(); g.name = name;
  for (const p of ps) { const m = new THREE.Mesh(p.geo, p.mat.clone()); m.name = p.mat.name; g.add(m); }
  return g;
}

const solid = new Map<string, THREE.MeshLambertMaterial>();
/** Materiale flat di un colore di palette (condiviso). */
export const flat = (c: string, emissive = false): THREE.MeshLambertMaterial => {
  const k = c + (emissive ? '*' : '');
  let m = solid.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...(emissive ? { emissive: c, emissiveIntensity: 1 } : {}) }); solid.set(k, m); }
  return m;
};
/** Box come parte (segnaposto): w × h × d, appoggiato a y0. */
export function boxPart(w: number, h: number, d: number, y0: number, c: string, emissive = false): Part {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0 + h / 2, 0);
  return { geo: g, mat: flat(c, emissive) };
}
/** Gruppo di box (segnaposto di un oggetto): [w, h, d, x, y, z, colore]. */
export function boxes(list: (number | string)[][], emissive = false): THREE.Group {
  const g = new THREE.Group();
  for (const b of list) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b[0] as number, b[1] as number, b[2] as number), flat(b[6] as string, emissive).clone());
    m.position.set(b[3] as number, b[4] as number, b[5] as number); g.add(m);
  }
  return g;
}

/** Tutti i materiali di un oggetto (per flash, tinte, dissolvenza). */
export function materialsOf(o: THREE.Object3D): THREE.MeshLambertMaterial[] {
  const out: THREE.MeshLambertMaterial[] = [];
  o.traverse((n) => {
    const m = n as THREE.Mesh; if (!m.isMesh) return;
    for (const x of Array.isArray(m.material) ? m.material : [m.material]) if ((x as THREE.MeshLambertMaterial).emissive) out.push(x as THREE.MeshLambertMaterial);
  });
  return out;
}

/** Tinge le facce col materiale `mat_lama` (armi) con un colore di palette. */
export function tintBlade(o: THREE.Object3D, color: string): void {
  for (const m of materialsOf(o)) if (/^mat_lama/.test(m.name)) { m.color.set(color); m.map = null; m.needsUpdate = true; }
}

/** Hash intero deterministico di una cella (varianti di rotazione e decorazioni). */
export const cellHash = (cx: number, cz: number, salt = 0): number => {
  let h = (cx * 374761393 + cz * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
