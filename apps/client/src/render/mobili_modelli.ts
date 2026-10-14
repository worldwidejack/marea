// I modelli 3D dei mobili (Blender): `mob_<id>` di assets/blender/models_mobili.py, nel manifest_mobili.json (scaricato solo da chi
// mostra un mobile: casa, ARREDA, negozio). Un mobile senza modello nel manifest resta col segnaposto (render/mobili.ts): per «collegare»
// un modello non si tocca il codice, basta che `npm run assets mob_<id>` lo metta nel manifest.
// Convenzione dei modelli (come tutti i glb di lib.py): 1 m = 1 unità, pivot a terra al CENTRO dell'ingombro (tutte le celle del mobile),
// davanti −Z. Qui si gira di 180° perché in casa il mobile guarda verso +Z (la camera). Una cella è 2 m: 1 cella = 2×2 m, 2 celle = 4×2 m.
import * as THREE from 'three';
import { createLoader } from './loader.ts';
import type { Loader } from './loader.ts';
import { parts } from '../rpg/dungeon_kit.ts';
import type { Part } from '../rpg/dungeon_kit.ts';

let loaderP: Promise<Loader> | null = null;
const cache = new Map<string, Promise<Part[] | null>>();

/** Le parti del modello di un mobile (geometria con la matrice del nodo già applicata, girata verso +Z); null = non c'è, si usa il segnaposto. */
export function modelloMobile(id: string): Promise<Part[] | null> {
  let p = cache.get(id);
  if (!p) {
    loaderP ??= createLoader({ base: '/assets/' }).then(async (l) => { await l.extend('manifest_mobili.json'); return l; });
    p = loaderP.then((l) => parts(l, 'mob_' + id)).then((ps) => (ps ? ps.map((x) => ({ geo: x.geo.clone().rotateY(Math.PI), mat: x.mat })) : null)).catch(() => null);
    cache.set(id, p);
  }
  return p;
}
/** Quelli che hanno un modello, tra gli id dati. */
export async function modelliMobili(ids: readonly string[]): Promise<Map<string, Part[]>> {
  const out = new Map<string, Part[]>();
  await Promise.all([...new Set(ids)].map(async (id) => { const ps = await modelloMobile(id); if (ps) out.set(id, ps); }));
  return out;
}
/** Un gruppo di mesh con le parti del modello (materiali condivisi del kit, geometrie condivise: non vanno distrutte). */
export function gruppoModello(ps: readonly Part[]): THREE.Group {
  const g = new THREE.Group();
  for (const p of ps) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = m.receiveShadow = true; g.add(m); }
  return g;
}
