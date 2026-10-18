// I mobili posati in casa (#265, LotState.casa.arredi): una mesh sola per lotto, rifatta solo quando cambiano. La disegna la vista del
// lotto (game/lot.ts, anche per le case degli amici: sola lettura). La mesh sta nella stanza (la stanza nasconde i figli del lotto a nord
// del muro in fondo, game/stanza.ts), le forme vengono da render/mobili.ts (chunk caricato al primo mobile).
import * as THREE from 'three';
import { BORGO, MOBILI } from '@marea/content';
import { casaDi, livelloCasa, stanzaAt } from '@marea/sim';
import type { Rect } from '@marea/sim';
import type { LotState, PlacedMobile } from '@marea/sim';
import type { MobileDef } from '@marea/content';
import type { Part } from '../rpg/dungeon_kit.ts';

const [X0, Z0, X1] = BORGO.stanza.pavimento;
const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Dove sta un mobile (m, coordinate del lotto) e verso dove guarda (rad): a terra al centro del suo ingombro (la cella d'ancora, più la
 *  metà delle celle in più, girata come il mobile), a parete appoggiato al muro. `celle` = ingombro di mobili.json (assente = 1×1). */
export function postoArredo(a: Pick<PlacedMobile, 'cell' | 'muro' | 'rot'>, T: number, celle: MobileDef['celle'] = [1, 1], stanza: Rect = BORGO.stanza.pavimento): { x: number; z: number; ry: number } {
  const [X0, Z0, X1] = stanza; // i muri sono quelli della stanza di quel livello (#386)
  let cx = (a.cell[0] + 0.5) * T, cz = (a.cell[1] + 0.5) * T;
  if (a.muro === 'n') return { x: cx, z: Z0 * T, ry: 0 };
  if (a.muro === 'o') return { x: X0 * T, z: cz, ry: Math.PI / 2 };
  if (a.muro === 'e') return { x: X1 * T, z: cz, ry: -Math.PI / 2 };
  const ow = ((celle[0] - 1) * T) / 2, od = ((celle[1] - 1) * T) / 2, r = a.rot ?? 0; // (x,z) → (z,−x) a ogni quarto di giro, come celleMobile
  const [dx, dz] = r === 1 ? [od, -ow] : r === 2 ? [-ow, -od] : r === 3 ? [-od, ow] : [ow, od];
  cx += dx; cz += dz;
  return { x: cx, z: cz, ry: (r * Math.PI) / 2 };
}

export function createArrediVista(o: { group: THREE.Group; origin: readonly [number, number]; tile: number; groundY(x: number, z: number): number }): { sync(lot: LotState | null): void; dispose(): void } {
  const T = o.tile, ox = o.origin[0] * T, oz = o.origin[1] * T;
  let key = '', livello = 0, mesh: THREE.Mesh | null = null, modelli: THREE.Group | null = null, mod: Promise<[typeof import('../render/mobili.ts'), typeof import('../render/mobili_modelli.ts')]> | null = null, disposed = false;
  const via = () => { if (mesh) { o.group.remove(mesh); mesh.geometry.dispose(); mesh = null; } if (modelli) { o.group.remove(modelli); modelli = null; } }; // le geometrie dei modelli sono in cache: non si distruggono
  const rifai = (m: typeof import('../render/mobili.ts'), mm: typeof import('../render/mobili_modelli.ts'), vivi: Map<string, Part[]>, arredi: readonly PlacedMobile[], k: string) => {
    if (disposed || k !== key) return;
    via();
    if (!arredi.length) return;
    // la mesh sta appena oltre il muro in fondo (la stanza nasconde i figli del lotto più a nord), le forme relative a lì
    const p0 = new THREE.Vector3(ox + X0 * T, o.groundY(ox + (X0 + 1) * T, oz + (Z0 + 1) * T), oz + Z0 * T + 0.01);
    const parti: THREE.BufferGeometry[] = [], gm = new THREE.Group();
    for (const a of arredi) {
      const d = MOBILI.find((x) => x.id === a.mobile); if (!d) continue;
      const p = postoArredo(a, T, d.celle, stanzaAt(livello, a.cell)?.pavimento), ps = vivi.get(d.id);
      if (ps) { // ha il suo modello 3D (manifest_mobili.json): mesh a parte, con la texture dell'atlas
        const g = mm.gruppoModello(ps); g.position.set(ox + p.x - p0.x, 0, oz + p.z - p0.z); g.rotation.y = p.ry; gm.add(g);
        continue;
      }
      const g = m.mobileGeo(d.forma, d.colori, d);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(p.ry).premultiply(new THREE.Matrix4().makeTranslation(ox + p.x - p0.x, 0, oz + p.z - p0.z)));
      parti.push(g);
    }
    if (parti.length) {
      mesh = new THREE.Mesh(m.unisci(parti), vc); mesh.name = 'arredi'; mesh.position.copy(p0); mesh.castShadow = mesh.receiveShadow = true;
      o.group.add(mesh);
    }
    if (gm.children.length) { gm.name = 'arredi_modelli'; gm.position.copy(p0); modelli = gm; o.group.add(gm); }
  };
  return {
    sync(lot) {
      const arredi = casaDi(lot).arredi ?? [], liv = livelloCasa(casaDi(lot)), k = liv + JSON.stringify(arredi);
      if (k === key) return;
      key = k; livello = liv;
      if (!arredi.length) { via(); return; }
      mod ??= Promise.all([import('../render/mobili.ts'), import('../render/mobili_modelli.ts')]);
      void mod.then(async ([m, mm]) => rifai(m, mm, await mm.modelliMobili(arredi.map((a) => a.mobile)), arredi, k)).catch(() => { /* senza mobili si gioca lo stesso */ });
    },
    dispose() { disposed = true; via(); },
  };
}
