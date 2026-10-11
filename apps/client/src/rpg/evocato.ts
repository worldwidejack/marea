// Patto di sangue (perk di Evocazione): la creatura evocata che ti segue anche fuori dai dungeon. Solo resa e solo per chi gioca (non va in
// rete: gli altri non la vedono). Segue l'avatar di lato e un passo indietro, si ferma se non c'è altro da fare, non entra in acqua, si
// nasconde in barca e dentro un dungeon. Chunk a parte: main.ts lo carica con import() la prima volta che il personaggio ha una creatura.
import * as THREE from 'three';
import { ENEMIES } from '@marea/content/rpg.ts';
import type { GameWorld } from '../game/world.ts';
import { boxes, materialsOf, object } from './dungeon_kit.ts';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';

export type Evocato = {
  /** `tipo` = id del nemico evocato (HeroState.evocato) o null; `attivo` = a piedi sull'isola (non in barca, non nel dungeon). */
  update(dt: number, t: number, tipo: string | null, attivo: boolean): void;
  dispose(): void;
};

const FORME: Record<string, (number | string)[][]> = {
  nem_lupo: [[0.4, 0.45, 1.1, 0, 0.6, 0, PAL.pietraScura], [0.3, 0.3, 0.35, 0, 0.8, -0.6, PAL.pietraScura]],
  nem_scheletro: [[0.4, 0.7, 0.2, 0, 1.0, 0, PAL.pietraChiara], [0.25, 0.6, 0.2, 0, 0.35, 0, PAL.pietraChiara], [0.25, 0.25, 0.25, 0, 1.5, 0, PAL.pietraChiara]],
  nem_golem: [[1.3, 1.3, 0.8, 0, 1.3, 0, PAL.acqua], [0.6, 0.5, 0.5, 0, 2.2, 0, PAL.acqua]],
};
const NEON = new THREE.Color('#8A5CFF');
const VELOCITA = 5.2, LONTANO = 14, FERMO = 0.7;

export function createEvocato(o: { world: GameWorld; loader: Loader }): Evocato {
  const w = o.world;
  const root = new THREE.Group(); root.name = 'evocato'; root.visible = false; w.scene.add(root);
  let tipo: string | null = null, pronto = false, x = 0, z = 0, yaw = 0, comparso = false;
  const acqua = (px: number, pz: number): boolean => { const c = w.map.worldToCell(px, pz), k = w.map.at(c.cx, c.cz); return k === '~' || k === ','; };

  function carica(t: string): void {
    tipo = t; pronto = false; root.clear();
    const model = ENEMIES.find((e) => e.id === t)?.model ?? 'nem_lupo';
    void object(o.loader, model, () => boxes(FORME[model] ?? FORME['nem_lupo']!)).then((m) => {
      if (tipo !== t) return;
      for (const mt of materialsOf(m)) { mt.color.lerp(NEON, 0.6); mt.transparent = true; mt.opacity = 0.85; } // come gli alleati nel dungeon
      root.add(m); pronto = true;
    });
  }

  return {
    update(dt, t, nuovo, attivo) {
      if (nuovo !== tipo) { if (nuovo) carica(nuovo); else { tipo = null; root.clear(); pronto = false; } comparso = false; }
      root.visible = !!tipo && pronto && attivo;
      if (!tipo || !attivo) return;
      const a = w.avatar.object.position, h = Number.isFinite(w.avatar.state.yaw) ? w.avatar.state.yaw : 0;
      // il punto dove sta: un po' di lato e dietro (prua = atan2(dx, −dz) → avanti è (sin h, −cos h), destra è (cos h, sin h))
      const tx = a.x - Math.sin(h) * 1.7 + Math.cos(h) * 1.1, tz = a.z + Math.cos(h) * 1.7 + Math.sin(h) * 1.1;
      let dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
      if (!comparso || d > LONTANO) { x = tx; z = tz; comparso = true; dx = dz = d = 0; } // appare accanto a te (o ti raggiunge se hai corso lontano)
      if (d > FERMO) {
        const passo = Math.min(d - FERMO * 0.5, VELOCITA * (d > 4 ? 1.8 : 1) * dt);
        const nx = x + (dx / d) * passo, nz = z + (dz / d) * passo;
        if (!acqua(nx, nz)) { x = nx; z = nz; } else if (!acqua(x + (dx / d) * passo, z)) x += (dx / d) * passo; else if (!acqua(x, z + (dz / d) * passo)) z += (dz / d) * passo;
        yaw = Math.atan2(-dx, -dz);
      }
      const muove = d > FERMO;
      root.position.set(x, w.groundY(x, z) + (muove ? Math.abs(Math.sin(t * 9)) * 0.08 : 0), z);
      root.rotation.y = yaw;
    },
    dispose() { root.removeFromParent(); root.clear(); },
  };
}
