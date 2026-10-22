// Animazione procedurale del retino in mano: dopo l'animazione dell'avatar il corpo si piega (busto, ginocchia, bacino) e il braccio
// destro segue la mano con una cinematica inversa (UpperArm.R + LowerArm.R), così il retino resta saldo nella mano in ogni posa di
// game/retino_chiavi.ts. Le ossa toccate le rimette a posto avatar_override.ts prima che l'animatore giri.
import * as THREE from 'three';
import type { GameWorld } from './world.ts';
import type { PosaRetino } from './retino_chiavi.ts';
import { posaDaMano } from './retino_presa.ts';
import type { RetinoPosa } from './retino_presa.ts';

export type RetinoAnim = {
  /** La posa da prendere dopo l'animazione dell'avatar; `null` lascia il corpo com'è. */
  aggiorna(posa: PosaRetino | null): void;
  /** Il retino nel mondo, come disegnato adesso. */
  posa(): RetinoPosa;
  attivo(): boolean;
};

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), ql = new THREE.Quaternion(), qm = new THREE.Quaternion(), qr = new THREE.Quaternion();
const boneDir = new THREE.Vector3();
const S = new THREE.Vector3(), D = new THREE.Vector3(), Pp = new THREE.Vector3();
const E = new THREE.Vector3(), E2 = new THREE.Vector3(), T2 = new THREE.Vector3(), tmp = new THREE.Vector3(), P = new THREE.Vector3();
const localTarget = new THREE.Vector3(), localPole = new THREE.Vector3(0.5, -0.6, 0.2);
const poleW = new THREE.Vector3(), targetW = new THREE.Vector3();
/** Coscia e stinco (m) e quanto lo stinco si piega rispetto alla coscia: i piedi restano dov'erano, il bacino scende. */
const COSCIA = 0.39, STINCO = 0.38, PIEGA_STINCO = 1.8;

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

export function creaRetinoAnim(w: GameWorld): RetinoAnim {
  const bone = (n: string) => w.avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? w.avatar.object.getObjectByName(n) ?? null;
  const ossa: Record<string, THREE.Object3D | null> = {};
  const osso = (n: string) => (ossa[n] ??= bone(n));
  const handPos = new THREE.Vector3();
  let ultimaPosa: RetinoPosa = { x: 0, y: 0, z: 0, h: 0, pitch: -0.32, roll: 0.16 };
  let registrato = false, isAttivo = false, corrente: PosaRetino | null = null;

  /** Ruota l'osso di `ang` attorno a `asse` espresso nel riferimento dell'avatar (x a destra, y in su, avanti = −z). */
  const ruota = (b: THREE.Object3D | null, asse: THREE.Vector3, ang: number) => {
    if (!b?.parent || Math.abs(ang) < 1e-4) return;
    w.avatar.object.getWorldQuaternion(qa);
    b.parent.getWorldQuaternion(qp);
    qr.setFromAxisAngle(asse, ang);
    qm.copy(qp).invert().multiply(qa).multiply(qr).multiply(ql.copy(qa).invert()).multiply(qp);
    b.quaternion.premultiply(qm);
  };
  /** Busto, testa, ginocchia e bacino: il corpo che si piega per il colpo. */
  const corpo = (v: PosaRetino) => {
    ruota(osso('Spine'), X, -v.lean); ruota(osso('Spine'), Y, -v.twist); ruota(osso('Head'), X, v.lean * 0.6);
    const hips = osso('Hips');
    if (v.knee > 1e-3) {
      for (const l of ['L', 'R']) { ruota(osso('UpperLeg.' + l), X, v.knee); ruota(osso('LowerLeg.' + l), X, -PIEGA_STINCO * v.knee); }
      if (hips?.parent) {
        hips.getWorldPosition(P);
        P.y -= COSCIA * (1 - Math.cos(v.knee)) + STINCO * (1 - Math.cos((PIEGA_STINCO - 1) * v.knee));
        hips.position.copy(hips.parent.worldToLocal(P));
      }
    }
    hips?.updateMatrixWorld(true);
  };

  const override = () => {
    const v = corrente, av = w.avatar.object;
    if (!v) return;
    av.updateMatrixWorld(true);
    corpo(v);
    localTarget.set(v.hx, v.hy, v.hz);
    targetW.copy(localTarget).applyMatrix4(av.matrixWorld);
    poleW.copy(localPole).applyQuaternion(av.quaternion).normalize();

    const up = osso('UpperArm.R'), lo = osso('LowerArm.R');
    if (up && lo) {
      ik(up, lo, 0.23, 0.27, targetW, poleW);
      lo.getWorldPosition(handPos);
      const fdir = new THREE.Vector3(0, 1, 0).applyQuaternion(lo.getWorldQuaternion(qp)).normalize();
      handPos.addScaledVector(fdir, 0.27);
    } else {
      const armR = av.getObjectByName('armR');
      if (armR) { // segnaposto a box: il braccio ruota in blocco verso la mano
        armR.rotation.x = -Math.atan2(-v.hz, 1.25 - v.hy);
        armR.rotation.z = 0.1;
        armR.updateMatrixWorld(true);
        armR.localToWorld(handPos.set(0, -0.575, 0));
      } else handPos.copy(targetW);
    }
    ultimaPosa = posaDaMano(handPos, -av.rotation.y - v.giro, v.pitch, v.roll);
  };

  return {
    aggiorna(posa) {
      isAttivo = !!posa && w.mode === 'walk' && w.avatar.visible;
      if (!isAttivo) {
        if (registrato) { w.avatar.setArmOverride(null); registrato = false; }
        return;
      }
      corrente = posa;
      if (!registrato) { w.avatar.setArmOverride(override); registrato = true; }
    },
    posa: () => ultimaPosa,
    attivo: () => isAttivo,
  };
}
