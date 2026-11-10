// Effetti dell'Arena sopra gli eroi (docs/ARENA.md §7), a colori di palette e senza luci:
// - il bagliore della dote: un guscio trasparente attorno all'eroe e un anello a terra, rosso (Vita), verde (Vigore) o blu (Magicka), che
//   pulsa a scatti; con Furia o Scatto in corso si accende di più (rosso e verde chiaro);
// - Aura di cura: l'anello verde col raggio dell'aura; Velo di nebbia: una nebbia grigia attorno a chi ce l'ha (lo vedono solo lui e i compagni);
// - Raggio della Marea: la sfera d'acqua che cresce davanti alle mani mentre carica, poi il raggio fino al primo muro;
// - Arpione: la punta e la corda dall'eroe a dove sta (o a chi ha preso).
// Si disegna solo chi si vede (`visibili`): gli avversari nascosti nell'erba o nel Velo non hanno né bagliore né effetti.
import * as THREE from 'three';
import { ARENA, arenaUlti } from '@marea/content/arena.ts';
import type { DuelloView } from '@marea/sim/arena/duello.ts';
import { PAL } from '../ui/style.ts';

export type ArenaFx = {
  /** Ogni frame: dove sono gli eroi (null = non si vede o è a terra), la vista del duello, il tempo. */
  update(t: number, pos: readonly (THREE.Vector3 | null)[], v: DuelloView): void;
  dispose(): void;
};

const mat = (color: string, opacity: number, additivo = false) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, ...(additivo ? { blending: THREE.AdditiveBlending } : {}) });
const coloreDote = (dote: string): string => (PAL as Record<string, string>)[ARENA.build.doti.find((d) => d.id === dote)?.colore ?? ''] ?? PAL.sabbiaChiara;

export function createArenaFx(scene: THREE.Scene, floorY: number, doti: readonly string[]): ArenaFx {
  const root = new THREE.Group(); root.name = 'arenaFx'; scene.add(root);
  const gusci = new THREE.CylinderGeometry(0.5, 0.42, 1.9, 8, 1, true), anelli = new THREE.RingGeometry(0.42, 0.62, 12);
  const disco = new THREE.RingGeometry(0.9, 1, 24), palla = new THREE.IcosahedronGeometry(0.3, 0), cubo = new THREE.BoxGeometry(1, 1, 1);
  const geos = [gusci, anelli, disco, palla, cubo];
  const per = doti.map((dote) => {
    const col = coloreDote(dote);
    const guscio = new THREE.Mesh(gusci, mat(col, 0.2)), anello = new THREE.Mesh(anelli, mat(col, 0.55));
    anello.rotation.x = -Math.PI / 2;
    const aura = new THREE.Mesh(disco, mat(PAL.erbaChiara, 0.35)); aura.rotation.x = -Math.PI / 2;
    const nebbia = new THREE.Mesh(gusci, mat(PAL.pietra, 0.4)); nebbia.scale.set(1.5, 1.05, 1.5);
    const sfera = new THREE.Mesh(palla, mat(PAL.acquaBassa, 0.9, true));
    const raggio = new THREE.Mesh(cubo, mat(PAL.acqua, 0.7)), cuore = new THREE.Mesh(cubo, mat(PAL.sabbiaChiara, 0.9));
    const punta = new THREE.Mesh(cubo, new THREE.MeshBasicMaterial({ color: PAL.pietra })), corda = new THREE.Mesh(cubo, new THREE.MeshBasicMaterial({ color: PAL.legnoScuro }));
    punta.scale.set(0.22, 0.22, 0.34);
    const g = new THREE.Group(); g.add(guscio, anello, aura, nebbia, sfera, raggio, cuore, punta, corda); root.add(g);
    return { col, g, guscio, anello, aura, nebbia, sfera, raggio, cuore, punta, corda };
  });
  const off = (o: THREE.Object3D) => { o.visible = false; };

  return {
    update(t, pos, v) {
      const scatto = Math.floor(t * 4) % 2; // pulsa a scatti, 2 volte al secondo
      per.forEach((p, j) => {
        const q = pos[j], u = v.ulti[j];
        p.g.visible = !!q;
        if (!q || !u) return;
        const su = u.fase !== 'no', forte = su && (u.id === 'furia' || u.id === 'scatto');
        const col = forte ? (u.id === 'furia' ? PAL.rosso : PAL.erbaChiara) : p.col;
        for (const m of [p.guscio, p.anello]) (m.material as THREE.MeshBasicMaterial).color.set(col);
        (p.guscio.material as THREE.MeshBasicMaterial).opacity = (forte ? 0.34 : 0.17) + scatto * 0.06;
        p.guscio.position.set(q.x, floorY + 0.95, q.z); p.anello.position.set(q.x, floorY + 0.03, q.z);
        // Aura di cura
        p.aura.visible = su && u.id === 'aura';
        if (p.aura.visible) { const r = arenaUlti('aura').raggio ?? 4; p.aura.scale.set(r, r, 1); p.aura.position.set(q.x, floorY + 0.04, q.z); }
        // Velo: la nebbia (la vedono solo lui e i compagni: gli avversari non lo vedono proprio)
        p.nebbia.visible = su && u.id === 'velo';
        if (p.nebbia.visible) p.nebbia.position.set(q.x, floorY + 1, q.z);
        // Raggio della Marea: la sfera che carica, poi il raggio
        const ang = Math.atan2(u.fx, u.fz);
        p.sfera.visible = u.id === 'marea' && (u.fase === 'carica' || u.fase === 'fuoco');
        if (p.sfera.visible) { const k = u.fase === 'carica' ? 0.8 + scatto * 0.3 : 1.3; p.sfera.scale.setScalar(k); p.sfera.position.set(q.x + u.fx * 0.6, floorY + 1.1, q.z + u.fz * 0.6); }
        p.raggio.visible = p.cuore.visible = u.id === 'marea' && u.fase === 'fuoco' && u.lungo > 0.3;
        if (p.raggio.visible) {
          const w = (arenaUlti('marea').larghezza ?? 0.6) * 2, mx = q.x + (u.fx * u.lungo) / 2, mz = q.z + (u.fz * u.lungo) / 2;
          p.raggio.position.set(mx, floorY + 1.1, mz); p.raggio.rotation.set(0, ang, 0); p.raggio.scale.set(w * (0.9 + scatto * 0.15), 0.7, u.lungo);
          p.cuore.position.copy(p.raggio.position); p.cuore.rotation.copy(p.raggio.rotation); p.cuore.scale.set(w * 0.35, 0.3, u.lungo);
        }
        // Arpione: la punta e la corda fino a lei
        p.punta.visible = p.corda.visible = u.id === 'arpione' && (u.fase === 'volo' || u.fase === 'tiro');
        if (p.punta.visible) {
          const hx = u.fase === 'tiro' ? (pos[u.preso]?.x ?? u.x) : u.x, hz = u.fase === 'tiro' ? (pos[u.preso]?.z ?? u.z) : u.z;
          const dx = hx - q.x, dz = hz - q.z, l = Math.max(0.05, Math.sqrt(dx * dx + dz * dz)), a = Math.atan2(dx, dz);
          p.punta.position.set(hx, floorY + 1.1, hz); p.punta.rotation.set(0, a, 0);
          p.corda.position.set(q.x + dx / 2, floorY + 1.1, q.z + dz / 2); p.corda.rotation.set(0, a, 0); p.corda.scale.set(0.05, 0.05, l);
        }
        if (!su) { off(p.aura); off(p.nebbia); }
      });
    },
    dispose() {
      root.removeFromParent();
      for (const g of geos) g.dispose();
      for (const p of per) for (const m of [p.guscio, p.anello, p.aura, p.nebbia, p.sfera, p.raggio, p.cuore, p.punta, p.corda]) (m.material as THREE.Material).dispose();
    },
  };
}
