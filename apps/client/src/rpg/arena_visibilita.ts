// Dissolvenza a pixel degli eroi dell'Arena. Le regole di avvistamento restano nella sim.
import type { Scene, MeshLambertMaterial } from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import type { HeroActor } from './dungeon_hero.ts';
import { materialsOf } from './dungeon_kit.ts';

const TRANSIZIONE = 0.2, NASCOSTO = 0.55;

export function creaVisibilitaArena() {
  let opacita = 1;
  const originali = new WeakMap<MeshLambertMaterial, { opacity: number; alphaTest: number; alphaHash: boolean }>();
  return {
    tick(g: Scene, a: HeroActor, posa: DungeonView['hero'] | null) {
      if (!posa) { g.visible = false; opacita = 0; return; }
      if (!g.visible) a.avatar.teleport(posa.x, posa.z, Math.atan2(posa.fx, -posa.fz));
      g.visible = true;
      a.tick(posa);
    },
    update(g: Scene, a: HeroActor, alpha: number, dt: number, nascosto: boolean) {
      if (!g.visible) return;
      a.update(alpha, dt);
      const verso = nascosto ? NASCOSTO : 1;
      if (opacita === 1 && verso === 1) return;
      const passo = dt / TRANSIZIONE;
      opacita = opacita < verso ? Math.min(verso, opacita + passo) : Math.max(verso, opacita - passo);
      for (const m of materialsOf(g)) {
        const base = originali.get(m) ?? { opacity: m.opacity, alphaTest: m.alphaTest, alphaHash: m.alphaHash };
        originali.set(m, base);
        const hash = base.alphaHash || opacita < 1;
        if (m.alphaHash !== hash) { m.alphaHash = hash; m.needsUpdate = true; }
        m.opacity = base.opacity * opacita;
        m.alphaTest = base.alphaTest * opacita;
      }
    },
    get opacita() { return opacita; },
  };
}
