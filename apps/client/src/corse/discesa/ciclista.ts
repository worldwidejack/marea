// Il ciclista della discesa (#229) per la camera da dietro: l'avatar MAREA col casco, in piedi sui pedali come chi scende in downhill
// (ginocchia piegate, busto in avanti, gomiti larghi), mani sulle manopole e piedi sui pedali con l'IK a due ossa (come l'eroe del
// dungeon, rpg/dungeon_hero.ts). Sopra la clip «idle», che dà il respiro. In prima persona non si vede: lì ci sono le braccia del kit.
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import { createAvatar } from '../../game/avatar.ts';
import type { Avatar } from '../../game/avatar.ts';
import { loaderCorse } from '../veicoli_kit.ts';

/** `giu` = quanto si schiaccia sulla bici (m): il bacino scende, mani e piedi restano su manopole e pedali (l'IK piega di più). */
export type Ciclista = { avatar: Avatar; aggiorna(dt: number, prese: THREE.Object3D[], pedali: THREE.Object3D[], piega: number, giu?: number): void };

/** I piedi stanno 0,34 m da terra (i pedali); il bacino si abbassa di `ACCOVACCIA` m rispetto a in piedi e va un po' indietro. */
const ACCOVACCIA = 0.2, INDIETRO = 0.16, BUSTO = 0.55;

export async function creaCiclista(genitore: THREE.Object3D, look: Look): Promise<Ciclista | null> {
  const loader = await loaderCorse();
  const avatar = await createAvatar({ loader, look, x: 0, z: INDIETRO });
  if (!avatar.usesModel) return null; // il segnaposto a scatole non ha le ossa
  genitore.add(avatar.object);
  avatar.setGround(() => 0.34 - ACCOVACCIA);
  const bone = (n: string) => avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? avatar.object.getObjectByName(n) ?? null;
  const B = {
    spine: bone('Spine'), head: bone('Head'),
    armR: bone('UpperArm.R'), foreR: bone('LowerArm.R'), armL: bone('UpperArm.L'), foreL: bone('LowerArm.L'),
    thighR: bone('UpperLeg.R'), shinR: bone('LowerLeg.R'), thighL: bone('UpperLeg.L'), shinL: bone('LowerLeg.L'),
  };
  const v3 = () => new THREE.Vector3();
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), ql = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const asse = v3(), boneDir = v3();
  /** Ruota l'osso di `ang` attorno all'asse `ax` dello spazio della bici (il genitore). */
  function rot(b: THREE.Object3D | null, ax: THREE.Vector3, ang: number): void {
    if (!b || !b.parent) return;
    genitore.getWorldQuaternion(qb);
    asse.copy(ax).applyQuaternion(qb);
    b.parent.getWorldQuaternion(qp);
    qa.setFromAxisAngle(asse, ang);
    b.quaternion.premultiply(ql.copy(qp).invert().multiply(qa).multiply(qp));
    b.updateMatrixWorld(true);
  }
  /** Gira l'osso (che guarda lungo il suo +Y) verso `dirW` (mondo). */
  function aim(b: THREE.Object3D, dirW: THREE.Vector3): void {
    b.getWorldQuaternion(qa);
    boneDir.set(0, 1, 0).applyQuaternion(qa);
    const dq = new THREE.Quaternion().setFromUnitVectors(boneDir, dirW);
    b.parent!.getWorldQuaternion(qp);
    b.quaternion.premultiply(ql.copy(qp).invert().multiply(dq).multiply(qp));
    b.updateMatrixWorld(true);
  }
  // lunghezze delle ossa dalla posa di riposo
  avatar.object.updateMatrixWorld(true);
  const lung = (a: THREE.Object3D | null, b: THREE.Object3D | null) => (a && b ? a.getWorldPosition(v3()).distanceTo(b.getWorldPosition(v3())) : 0.3);
  const lungo = (b: THREE.Object3D | null) => { const c = b?.children.find((x) => (x as THREE.Bone).isBone); return c ? lung(b, c) : 0.27; };
  const L = { braccio: lung(B.armR, B.foreR), avambraccio: lungo(B.foreR), coscia: lung(B.thighR, B.shinR), stinco: lungo(B.shinR) };
  const S = v3(), D = v3(), P = v3(), E = v3(), E2 = v3(), T2 = v3(), tmp = v3();
  /** IK a due ossa: estremità su `target` (mondo), gomito o ginocchio verso `pole` (mondo). */
  function ik(up: THREE.Object3D | null, lo: THREE.Object3D | null, a: number, b: number, target: THREE.Vector3, pole: THREE.Vector3): void {
    if (!up || !lo || !up.parent) return;
    up.getWorldPosition(S);
    D.subVectors(target, S); let d = D.length(); if (d < 1e-4) return; D.divideScalar(d);
    d = Math.min(Math.max(d, 0.08), a + b - 1e-3);
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    P.copy(pole).addScaledVector(D, -pole.dot(D)).normalize();
    E.copy(S).addScaledVector(D, x).addScaledVector(P, h);
    aim(up, tmp.subVectors(E, S).normalize());
    lo.getWorldPosition(E2);
    T2.copy(S).addScaledVector(D, d);
    aim(lo, tmp.subVectors(T2, E2).normalize());
  }
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), polo = v3(), pw = v3(), qg = new THREE.Quaternion();
  return {
    avatar,
    aggiorna(dt, prese, pedali, piega, giu = 0) {
      avatar.update(1, dt);
      avatar.object.position.y -= giu;
      avatar.object.updateMatrixWorld(true);
      // busto in avanti, testa su a guardare il sentiero, il corpo che si piega un filo più della bici in curva
      rot(B.spine, X, -BUSTO); rot(B.head, X, BUSTO * 0.8); rot(B.spine, Z, -piega * 0.25);
      genitore.getWorldQuaternion(qg);
      const verso = (x: number, y: number, z: number) => polo.set(x, y, z).applyQuaternion(qg);
      // mani sulle manopole (gomiti in fuori e un po' indietro), piedi sui pedali (ginocchia avanti e in fuori)
      ik(B.armR, B.foreR, L.braccio, L.avambraccio, prese[1]!.getWorldPosition(pw), verso(1, -0.2, 0.6).clone());
      ik(B.armL, B.foreL, L.braccio, L.avambraccio, prese[0]!.getWorldPosition(pw), verso(-1, -0.2, 0.6).clone());
      ik(B.thighR, B.shinR, L.coscia, L.stinco, pedali[1]!.getWorldPosition(pw).add(verso(0, 0.06, 0)), verso(0.25, 0, -1).clone());
      ik(B.thighL, B.shinL, L.coscia, L.stinco, pedali[0]!.getWorldPosition(pw).add(verso(0, 0.06, 0)), verso(-0.25, 0, -1).clone());
    },
  };
}
