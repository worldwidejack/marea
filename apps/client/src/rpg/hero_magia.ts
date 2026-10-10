// Sfera di magia tra le mani dell'eroe (magia in mano, dungeon v6): un ottaedro del colore della magia con un nucleo chiaro, che pulsa e gira
// a scatti, si gonfia mentre l'eroe lancia, sparisce al lancio e ricresce subito dopo. Solo palette, niente luci (MeshBasicMaterial).
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';

export type Orbe = {
  /** Ogni frame: dove sta (tra i pugni, in mondo), se è in mano, fase del lancio (0..1; -1 = non sta lanciando), secondi del frame. */
  update(o: { pos: THREE.Vector3; on: boolean; lancio: number; dt: number }): void;
  /** Colore della magia in mano (hex di palette). */
  colora(hex: string): void;
  dispose(): void;
};

export function createOrbe(scene: THREE.Scene): Orbe {
  const g = new THREE.OctahedronGeometry(0.15, 0), gc = new THREE.OctahedronGeometry(0.075, 0);
  const mat = new THREE.MeshBasicMaterial({ color: PAL.arancio }), matc = new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara });
  const grp = new THREE.Group(); grp.name = 'orbe'; grp.visible = false;
  grp.add(new THREE.Mesh(g, mat), new THREE.Mesh(gc, matc));
  scene.add(grp);
  let t = 0, grow = 0, era = false;
  return {
    update({ pos, on, lancio, dt }) {
      t += dt;
      if (!on) { grp.visible = false; grow = 0; era = false; return; }
      if (!era) { era = true; grow = 0; } // appena presa in mano: cresce
      if (lancio >= 0) grow = lancio < 0.4 ? 1 + 0.6 * (lancio / 0.4) : 0; // si gonfia, poi parte
      else grow = Math.min(1, grow + dt / 0.3); // ricresce
      const k = grow * (0.92 + 0.08 * (Math.floor(t * 8) % 2));
      grp.visible = k > 0.02;
      grp.position.copy(pos);
      grp.scale.setScalar(Math.max(0.001, k));
      grp.rotation.y = Math.floor(t * 5) * (Math.PI / 4);
    },
    colora(hex) { mat.color.set(hex); },
    dispose() { grp.removeFromParent(); g.dispose(); gc.dispose(); mat.dispose(); matc.dispose(); },
  };
}
