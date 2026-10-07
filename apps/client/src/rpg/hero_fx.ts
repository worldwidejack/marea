// Effetti del combattimento dell'eroe (R-scena), tutti piatti, in colori di palette, a gradini (niente sfumature lisce):
// - carica: anello a terra grande quanto la portata (= dove colpirà il giro) fatto di 16 tacche che si accendono nel verso del giro,
//   scintille che salgono a spirale verso l'eroe (più fitte con la carica); al pieno l'anello lampeggia, un'onda esplode fino alla
//   portata e una stella a pixel compare sopra la testa;
// - colpo: scia sul piano della lama esattamente sull'arco che la sim sta spazzando (swing.ts), dal pugno alla portata; la coda si
//   spegne a gradini. Il giro e gli affondi caricati sono gialli, i colpi normali bianco pietra.
// Spazio della scia e dell'anello: quello della faccia della sim (−Z avanti, +X destra), come gli angoli di swing.ts.
import * as THREE from 'three';
import { COLPI } from '@marea/sim/dungeon/tuning.ts';
import type { SwingStyle } from '@marea/sim/dungeon/swing.ts';
import { swept } from '@marea/sim/dungeon/swing.ts';
import { PAL } from '../ui/style.ts';

export type HeroFx = {
  /** Ogni frame. `carica` 0..1 mentre si carica (null se no); `colpo` = colpo in corso con la sua fase; `y` = pavimento. */
  update(o: { x: number; y: number; z: number; fx: number; fz: number; dt: number; carica: number | null; colpo: { stile: SwingStyle; t: number; h: number } | null }): void;
  /** Il colpo caricato è pieno: lampo, onda e stella. */
  pieno(): void;
  dispose(): void;
};

const TACCHE = 16, SPARKS = 12, SEG = 48;
const col = (hex: string) => new THREE.Color(hex);
const C = { spenta: col(PAL.pietraScura), accesa: col(PAL.arancio), piena: col(PAL.giallo), bianca: col(PAL.pietraChiara) };
const stepT = (t: number, fps: number) => Math.floor(t * fps) / fps; // tempo a scatti (animazioni a pixel)

/** Settore di corona circolare nel piano XZ (spazio della faccia), da `a0` verso `a0 − span`, in `n` quad; colori RGBA per vertice. */
function arcGeometry(rin: number, rout: number, a0: number, span: number, n: number, gap = 0): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = a0 - (span * i) / n, e = a0 - (span * (i + 1 - gap)) / n, b = pos.length / 3;
    for (const a of [s, e]) for (const r of [rin, rout]) pos.push(r * Math.sin(a), 0, -r * Math.cos(a));
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 4), 4));
  g.setIndex(idx);
  return g;
}
/** Colora il quad `i` (4 vertici) di un arcGeometry. */
function paint(g: THREE.BufferGeometry, i: number, c: THREE.Color, a: number): void {
  const at = g.getAttribute('color') as THREE.BufferAttribute;
  for (let v = i * 4; v < i * 4 + 4; v++) at.setXYZW(v, c.r, c.g, c.b, a);
  at.needsUpdate = true;
}
const fxMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });

export function createHeroFx(scene: THREE.Scene, o: { portata: number; rin: number }): HeroFx {
  const root = new THREE.Group(); root.name = 'eroe_fx'; scene.add(root);
  const yawOf = (fx: number, fz: number) => Math.atan2(-fx, -fz); // rotazione Y che porta −Z sulla faccia (fx, fz)

  // anello di carica: tacche nel verso del giro, a partire da dove parte la lama
  const ringGeo = arcGeometry(Math.max(0.3, o.portata - 0.14), o.portata, COLPI.giro.inizio, Math.PI * 2, TACCHE, 0.18);
  const ring = new THREE.Mesh(ringGeo, fxMat()); ring.renderOrder = 2; ring.visible = false; root.add(ring);
  // onda del pieno
  const waveGeo = new THREE.RingGeometry(0.9, 1, 24, 1); waveGeo.rotateX(-Math.PI / 2);
  const wave = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: PAL.pietraChiara, transparent: true, depthWrite: false })); wave.visible = false; root.add(wave);
  // stella a pixel sopra la testa (due barrette incrociate)
  const star = new THREE.Group(); star.visible = false; root.add(star);
  const starMat = new THREE.MeshBasicMaterial({ color: PAL.giallo });
  for (const [w, h] of [[0.5, 0.09], [0.09, 0.5]] as const) star.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), starMat));
  // scintille
  const sparkMat = new THREE.MeshBasicMaterial({ color: PAL.giallo });
  const sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), sparkMat, SPARKS); sparks.visible = false; sparks.frustumCulled = false; root.add(sparks);
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // scia del colpo (una geometria per stile, fatta al primo uso)
  const trails = new Map<SwingStyle, THREE.Mesh>();
  const trailOf = (st: SwingStyle): THREE.Mesh => {
    let m = trails.get(st);
    if (!m) {
      const c = COLPI[st];
      m = new THREE.Mesh(arcGeometry(o.rin, o.portata, c.inizio, c.arco, st === 'giro' ? SEG : Math.max(6, Math.round((SEG * c.arco) / (Math.PI * 2)) * 2)), fxMat());
      m.renderOrder = 3; m.visible = false; root.add(m); trails.set(st, m);
    }
    return m;
  };

  let litWas = -1, fullT = 0, burstT = 0, trailFade = 0, last: { stile: SwingStyle; k: number; h: number } | null = null, t = 0;

  function drawTrail(m: THREE.Mesh, st: SwingStyle, k: number, fade: number): void {
    const g = m.geometry, n = (g.getAttribute('position').count / 4) | 0, giallo = st === 'giro';
    const head = k * n, tail = giallo ? n * 0.4 : n * 0.75; // quanta scia resta dietro la lama
    for (let i = 0; i < n; i++) {
      const age = head - (i + 1); // 0 = appena spazzato
      let a = 0;
      if (i < head && age < tail) a = age < tail / 3 ? 0.85 : age < (2 * tail) / 3 ? 0.55 : 0.3;
      a *= fade;
      paint(g, i, giallo ? C.piena : C.bianca, a);
    }
  }

  return {
    update({ x, y, z, fx, fz, dt, carica, colpo }) {
      t += dt;
      root.position.set(x, y, z);
      const yaw = yawOf(fx, fz);
      // ---- carica ----
      ring.visible = carica !== null;
      if (carica !== null) {
        ring.rotation.y = yaw; ring.position.y = 0.04;
        const lit = Math.floor(carica * TACCHE + 1e-6), full = carica >= 1;
        const blink = full && Math.floor(t * 8) % 2 === 0;
        if (lit !== litWas || full) {
          for (let i = 0; i < TACCHE; i++) paint(ringGeo, i, full ? (blink ? C.bianca : C.piena) : i < lit ? C.accesa : C.spenta, full ? 0.95 : i < lit ? 0.9 : 0.6);
          litWas = full ? -1 : lit;
        }
        // scintille: salgono a spirale dall'anello verso le mani, a scatti di 1/15 s
        sparks.visible = true;
        const on = Math.ceil(carica * SPARKS), ts = stepT(t, 15), r0 = o.portata;
        for (let i = 0; i < SPARKS; i++) {
          if (i >= on) { sparks.setMatrixAt(i, zero); continue; }
          const ph = (ts * (full ? 2.2 : 1.4) + i / SPARKS) % 1, a = (i * 2.399) + ph * 2.5, r = r0 * (1 - ph) + 0.25 * ph;
          m4.makeTranslation(r * Math.sin(a), 0.1 + 1.1 * ph, -r * Math.cos(a));
          sparks.setMatrixAt(i, m4);
        }
        sparks.instanceMatrix.needsUpdate = true;
        sparkMat.color.set(full && Math.floor(t * 8) % 2 === 0 ? PAL.pietraChiara : PAL.giallo);
      } else { sparks.visible = false; litWas = -1; }
      // ---- pieno: onda e stella ----
      if (burstT > 0) {
        burstT = Math.max(0, burstT - dt);
        const k = Math.min(3, Math.floor((1 - burstT / 0.24) * 4)); // 4 gradini
        wave.visible = true; wave.position.y = 0.06;
        wave.scale.setScalar(o.portata * (0.45 + 0.25 * k));
        (wave.material as THREE.MeshBasicMaterial).opacity = [0.95, 0.75, 0.5, 0.25][k]!;
      } else wave.visible = false;
      if (fullT > 0) {
        fullT = Math.max(0, fullT - dt);
        star.visible = true; star.position.set(0, 2.25, 0);
        const k = Math.floor((1 - fullT / 0.45) * 6);
        star.rotation.set(0, 0, (k % 2) * (Math.PI / 4));
        star.scale.setScalar(k < 2 ? 0.6 + 0.4 * k : k > 4 ? 0.6 : 1.3);
        star.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)); // verso la camera (da sud-est)
      } else star.visible = false;
      // ---- scia ----
      for (const m of trails.values()) m.visible = false;
      if (colpo) {
        const k = swept(colpo.stile, colpo.t), m = trailOf(colpo.stile);
        m.visible = k > 0; m.rotation.y = yaw; m.position.y = colpo.h;
        if (k > 0) drawTrail(m, colpo.stile, k, k >= 1 ? Math.max(0, 1 - Math.floor((colpo.t - COLPI[colpo.stile].a) / 0.06) * 0.34) : 1);
        last = { stile: colpo.stile, k, h: colpo.h }; trailFade = k > 0 ? 0.15 : 0;
      } else if (last && trailFade > 0) {
        trailFade = Math.max(0, trailFade - dt);
        const m = trailOf(last.stile);
        m.visible = trailFade > 0;
        drawTrail(m, last.stile, last.k, Math.floor((trailFade / 0.15) * 3) / 3);
        if (trailFade <= 0) last = null;
      }
    },
    pieno() { burstT = 0.24; fullT = 0.45; },
    dispose() {
      root.removeFromParent();
      root.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    },
  };
}
