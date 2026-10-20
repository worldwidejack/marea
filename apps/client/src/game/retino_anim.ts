// Animazione procedurale del braccio destro e del retino (#461):
// posa di guardia e colpo (wind-up, sweep in avanti verso il terreno a portata, follow-through e recupero)
// con IK sul braccio (UpperArm.R + LowerArm.R) e retino saldamente impugnato nella mano.
import * as THREE from 'three';
import type { GameWorld } from './world.ts';

export type RetinoPosa = {
  x: number; y: number; z: number;
  h: number; pitch: number; roll: number;
};

export type RetinoAnim = {
  aggiorna(dt: number, colpo: number, colpoS: number, attivo: boolean): void;
  posa(): RetinoPosa;
  attivo(): boolean;
};

const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), ql = new THREE.Quaternion();
const boneDir = new THREE.Vector3();
const S = new THREE.Vector3(), D = new THREE.Vector3(), Pp = new THREE.Vector3();
const E = new THREE.Vector3(), E2 = new THREE.Vector3(), T2 = new THREE.Vector3(), tmp = new THREE.Vector3();
const localTarget = new THREE.Vector3(), localPole = new THREE.Vector3(0.5, -0.6, 0.2);
const poleW = new THREE.Vector3(), targetW = new THREE.Vector3();
const GRIP_Y = 0.18; // impugnatura a 18 cm dal fondo del manico

function punta(b: THREE.Object3D, dirW: THREE.Vector3): void {
  b.getWorldQuaternion(qa);
  boneDir.set(0, 1, 0).applyQuaternion(qa);
  const dq = new THREE.Quaternion().setFromUnitVectors(boneDir, dirW);
  b.parent!.getWorldQuaternion(qp);
  b.quaternion.premultiply(ql.copy(qp).invert().multiply(dq).multiply(qp));
  b.updateMatrixWorld(true);
}

function ik(up: THREE.Object3D, lo: THREE.Object3D, a: number, b: number, target: THREE.Vector3, pole: THREE.Vector3): void {
  up.getWorldPosition(S);
  D.subVectors(target, S);
  let d = D.length();
  if (d < 1e-4) return;
  D.divideScalar(d);
  d = Math.min(Math.max(d, 0.08), a + b - 1e-3);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  Pp.copy(pole).addScaledVector(D, -pole.dot(D)).normalize();
  E.copy(S).addScaledVector(D, x).addScaledVector(Pp, h);
  punta(up, tmp.subVectors(E, S).normalize());
  lo.getWorldPosition(E2);
  T2.copy(S).addScaledVector(D, d);
  punta(lo, tmp.subVectors(T2, E2).normalize());
}

export function valutaPosaRetino(t: number): { hx: number; hy: number; hz: number; pitch: number; roll: number; rigX: number; rigZ: number } {
  if (t <= 0 || t >= 1) {
    return { hx: 0.22, hy: 0.95, hz: -0.22, pitch: -0.32, roll: 0.16, rigX: -0.7, rigZ: 0.18 };
  }
  // Fase 1: caricamento indietro/alto sopra la spalla (0 <= t < 0.18)
  if (t < 0.18) {
    const p = t / 0.18;
    return {
      hx: 0.22 + 0.03 * p,
      hy: 0.95 + 0.23 * p,
      hz: -0.22 + 0.17 * p,
      pitch: -0.32 + 0.77 * p,
      roll: 0.16 + 0.09 * p,
      rigX: -0.7 + 0.5 * p,
      rigZ: 0.18 + 0.07 * p,
    };
  }
  // Fase 2: fendente in avanti e verso il basso (0.18 <= t < 0.48)
  if (t < 0.48) {
    const p = (t - 0.18) / 0.30;
    const s = p * p * (3 - 2 * p);
    return {
      hx: 0.25 - 0.11 * s,
      hy: 1.18 - 0.60 * s,
      hz: -0.05 - 0.41 * s,
      pitch: 0.45 - 1.95 * s,
      roll: 0.25 - 0.25 * s,
      rigX: -0.2 - 1.4 * s,
      rigZ: 0.25 - 0.25 * s,
    };
  }
  // Fase 3: raccolta radente a terra / punto d'impatto (0.48 <= t < 0.70)
  if (t < 0.70) {
    const p = (t - 0.48) / 0.22;
    return {
      hx: 0.14 - 0.01 * p,
      hy: 0.58 + 0.04 * p,
      hz: -0.46 + 0.04 * p,
      pitch: -1.50 + 0.15 * p,
      roll: 0.0,
      rigX: -1.6 + 0.15 * p,
      rigZ: 0.0,
    };
  }
  // Fase 4: ritorno fluido in guardia (0.70 <= t <= 1)
  const p = (t - 0.70) / 0.30;
  const s = p * (2 - p);
  return {
    hx: 0.13 + 0.09 * s,
    hy: 0.62 + 0.33 * s,
    hz: -0.42 + 0.20 * s,
    pitch: -1.35 + 1.03 * s,
    roll: 0.16 * s,
    rigX: -1.45 + 0.75 * s,
    rigZ: 0.18 * s,
  };
}

export function calcolaPosaRetino(handPos: THREE.Vector3, yaw: number, pitch: number, roll: number): RetinoPosa {
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const a01 = -sr, a11 = cp * cr, a21 = sp * cr;
  const m01 = cy * a01 + sy * a21, m11 = a11, m21 = -sy * a01 + cy * a21;
  return {
    x: handPos.x - m01 * GRIP_Y,
    y: handPos.y - m11 * GRIP_Y,
    z: handPos.z - m21 * GRIP_Y,
    h: yaw,
    pitch,
    roll,
  };
}

export function creaRetinoAnim(w: GameWorld): RetinoAnim {
  const bone = (n: string) => w.avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? w.avatar.object.getObjectByName(n) ?? null;
  const handPos = new THREE.Vector3();
  let ultimaPosa: RetinoPosa = { x: 0, y: 0, z: 0, h: 0, pitch: -0.32, roll: 0.16 };
  let registrato = false;
  let isAttivo = false;
  let curT = 0;

  const override = () => {
    const f = w.avatar.state, h = f.yaw;
    const v = valutaPosaRetino(curT);
    localTarget.set(v.hx, v.hy, v.hz);
    targetW.copy(localTarget).applyMatrix4(w.avatar.object.matrixWorld);
    poleW.copy(localPole).applyQuaternion(w.avatar.object.quaternion).normalize();

    const up = bone('UpperArm.R'), lo = bone('LowerArm.R');
    if (up && lo) {
      ik(up, lo, 0.23, 0.27, targetW, poleW);
      lo.getWorldPosition(handPos);
      const fdir = new THREE.Vector3(0, 1, 0).applyQuaternion(lo.getWorldQuaternion(qp)).normalize();
      handPos.addScaledVector(fdir, 0.27);
    } else {
      const armR = w.avatar.object.getObjectByName('armR');
      if (armR) {
        armR.rotation.x = v.rigX;
        armR.rotation.z = v.rigZ;
        armR.updateMatrixWorld(true);
        armR.localToWorld(handPos.set(0, -0.575, 0));
      } else {
        handPos.copy(targetW);
      }
    }
    ultimaPosa = calcolaPosaRetino(handPos, h, v.pitch, v.roll);
  };

  return {
    aggiorna(_dt, colpo, colpoS, attivo) {
      isAttivo = attivo && w.mode === 'walk' && w.avatar.visible;
      if (!isAttivo) {
        if (registrato) {
          w.avatar.setArmOverride(null);
          registrato = false;
        }
        return;
      }
      curT = colpo > 0 ? 1 - colpo / colpoS : 0;
      if (!registrato) {
        w.avatar.setArmOverride(override);
        registrato = true;
      }
    },
    posa: () => ultimaPosa,
    attivo: () => isAttivo,
  };
}
