// I fantasmi (docs/TEMPLARI.md §12b punto 5): templari morti, una persona normale (testa, sopravveste con la croce, braccia, gambe) ma
// trasparente e azzurra (rossa quando ti punta), che galleggia un palmo sopra terra (birbasan, 19 ott: niente mantello, niente coda: è
// solo trasparente). Gli zombie hanno sette mesh per tipo
// (zombi.ts); i fantasmi UNA sola, un InstancedMesh con la figura intera, che si muove tutta insieme: galleggia, ondeggia, si piega
// quando colpisce, compare dal nulla e sale in cielo quando muore. Costa una draw call, e solo quando uno è vicino alla camera (nel coro
// coi boss si è già al limite).
import * as THREE from 'three';
import type { TView } from '@marea/sim/templari/types.ts';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

type ZV = TView['zombie'][number];
const MAX = 8;
/** Oltre questa distanza dall'eroe non si disegnano (la camera non li vede). */
const VISTA = 26;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** La figura: un templare in piedi, a blocchi come gli altri (davanti verso −z come gli zombie, piedi a y = 0). */
function figura(): THREE.BufferGeometry {
  return merged([
    ...[-1, 1].flatMap((s) => [
      painted(box(0.14, 0.78, 0.15), PAL.pietraChiara, M(s * 0.1, 0.43, 0, s * 0.04)),   // le gambe, che penzolano un po'
      painted(box(0.15, 0.07, 0.24), PAL.pietra, M(s * 0.1, 0.03, -0.04, 0.15)),        // i piedi
      painted(box(0.11, 0.56, 0.12), PAL.pietraChiara, M(s * 0.28, 1.18, -0.06, 0.35, 0, s * 0.08)), // le braccia, un po' avanti
      painted(box(0.1, 0.1, 0.1), PAL.pietra, M(s * 0.29, 0.92, -0.17)),                  // le mani
    ]),
    painted(box(0.44, 0.3, 0.26), PAL.pietraChiara, M(0, 0.78, 0)),        // la falda della sopravveste
    painted(box(0.42, 0.62, 0.24), PAL.pietraChiara, M(0, 1.2, 0)),        // il busto
    painted(box(0.44, 0.06, 0.26), PAL.pietra, M(0, 0.95, 0)),             // la cintura
    painted(box(0.06, 0.32, 0.02), PAL.acqua, M(0, 1.22, -0.13)),          // la croce sul petto
    painted(box(0.24, 0.06, 0.02), PAL.acqua, M(0, 1.28, -0.13)),
    painted(box(0.12, 0.08, 0.12), PAL.pietra, M(0, 1.55, 0)),             // il collo
    painted(box(0.25, 0.28, 0.25), PAL.pietraChiara, M(0, 1.72, 0)),       // la testa
    painted(box(0.06, 0.05, 0.02), PAL.abisso, M(-0.06, 1.74, -0.13)),     // le orbite
    painted(box(0.06, 0.05, 0.02), PAL.abisso, M(0.06, 1.74, -0.13)),
    painted(box(0.1, 0.03, 0.02), PAL.abisso, M(0, 1.64, -0.13)),          // la bocca
  ]);
}

export type Fantasmi3d = {
  tick(v: TView): void;
  /** `hx, hz`: l'eroe (oltre VISTA m non si disegnano). */
  update(alpha: number, dt: number, t: number, hx: number, hz: number): void;
  colpito(id: number): void;
  /** Distanza dal fantasma più vicino (Infinity = nessuno): per il lamento. */
  vicino(x: number, z: number): number;
  stats(): { fantasmi: number; rabbia: number; disegnati: number };
  dispose(): void;
};
type F = { id: number; px: number; pz: number; x: number; z: number; v: ZV; yaw: number; flash: number; mortoT: number };

export function createFantasmi3d(scene: THREE.Scene): Fantasmi3d {
  const geo = figura(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX); mesh.name = 'fantasmi'; mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3;
  scene.add(mesh);
  const fs = new Map<number, F>();
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), s3 = new THREE.Vector3(), c = new THREE.Color();
  // la figura è chiara: la tinta per istanza la fa azzurra (calmo) o rossa (arrabbiato)
  const CALMO = new THREE.Color(0.55, 0.95, 1.15), RABBIA = new THREE.Color(1.8, 0.26, 0.22), LAMPO = new THREE.Color(2, 2, 2);
  let disegnati = 0;
  return {
    tick(v) {
      const seen = new Set<number>();
      for (const n of v.zombie) {
        if (n.tipo !== 'fantasma') continue;
        seen.add(n.id);
        let f = fs.get(n.id);
        if (!f) { f = { id: n.id, px: n.x, pz: n.z, x: n.x, z: n.z, v: n, yaw: Math.atan2(-n.fx, -n.fz), flash: 0, mortoT: 0 }; fs.set(n.id, f); }
        f.px = f.x; f.pz = f.z; f.x = n.x; f.z = n.z; f.v = n;
      }
      for (const id of [...fs.keys()]) if (!seen.has(id)) fs.delete(id);
    },
    update(alpha, dt, t, hx, hz) {
      let i = 0;
      for (const f of fs.values()) {
        if (i >= MAX) break;
        const x = f.px + (f.x - f.px) * alpha, z = f.pz + (f.z - f.pz) * alpha;
        if ((x - hx) * (x - hx) + (z - hz) * (z - hz) > VISTA * VISTA) continue;
        const v = f.v, k = v.t;
        let d = Math.atan2(-v.fx, -v.fz) - f.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); f.yaw += d * Math.min(1, dt * 6);
        // galleggia e ondeggia (a scatti, come tutto: niente moto liscio)
        const ph = Math.floor(t * 8) / 8 + f.id;
        let y = 0.25 + 0.08 * Math.sin(ph * 2.1), lean = 0, sway = 0.07 * Math.sin(ph * 1.3), sc = 1, avanti = 0;
        switch (v.anim) {
          case 'sorge': sc = Math.floor(k * 5) / 5; y -= 0.6 * (1 - k); break;                     // compare dal nulla
          case 'prepara': lean = -0.3 * Math.floor(k * 4) / 4; break;                                 // si tira indietro
          case 'colpisce': lean = 0.45; avanti = 0.35; break;                                         // si getta avanti
          case 'morto': f.mortoT += dt; sc = Math.max(0, 1 - f.mortoT / 0.8); y += f.mortoT * 2.2; break; // sale in cielo e sparisce
          default:
        }
        if (sc <= 0) continue;
        f.flash = Math.max(0, f.flash - dt);
        c.copy(f.flash > 0 ? LAMPO : v.rabbia ? RABBIA : CALMO);
        if (!v.rabbia && f.flash <= 0) c.multiplyScalar(0.85 + 0.15 * (((Math.floor(t * 6) + f.id) * 0.618) % 1)); // tremola
        e.set(lean, f.yaw, sway);
        q.setFromEuler(e);
        p.set(x - Math.sin(f.yaw) * avanti, y, z - Math.cos(f.yaw) * avanti);
        mesh.setMatrixAt(i, m4.compose(p, q, s3.setScalar(sc)));
        mesh.setColorAt(i, c);
        i++;
      }
      disegnati = i;
      mesh.count = i; mesh.visible = i > 0;
      if (i > 0) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    },
    colpito(id) { const f = fs.get(id); if (f) f.flash = 0.1; },
    vicino(x, z) {
      let best = Infinity;
      for (const f of fs.values()) if (f.v.anim !== 'morto') best = Math.min(best, Math.sqrt((f.x - x) * (f.x - x) + (f.z - z) * (f.z - z)));
      return best;
    },
    stats: () => ({ fantasmi: [...fs.values()].filter((f) => f.v.anim !== 'morto').length, rabbia: [...fs.values()].filter((f) => f.v.rabbia).length, disegnati }),
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}
