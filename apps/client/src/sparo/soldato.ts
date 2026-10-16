// L'avatar MAREA con l'arma in mano (#355): il giocatore in terza persona e i nemici. Sopra le clip di sempre (idle, walk, run) il
// busto si piega verso dove mira, l'arma sta davanti al petto lungo la mira e le mani la tengono con l'IK a due ossa (come il ciclista
// della discesa, corse/discesa/ciclista.ts). Accucciato: il bacino scende e le gambe si piegano coi piedi a terra. Colpito: un lampo
// bianco e un mezzo passo indietro. Caduto: va giù all'indietro; si rialza.
import * as THREE from 'three';
import type { Look } from '@marea/protocol';
import { createAvatar } from '../game/avatar.ts';
import type { Avatar } from '../game/avatar.ts';
import { loaderCorse } from '../corse/veicoli_kit.ts';
import { armaVista, modelloArma } from './armi3d.ts';

export type Soldato = {
  avatar: Avatar; group: THREE.Group;
  /** Dove si trova adesso la bocca dell'arma (mondo), per lampo e scie. */
  bocca(out: THREE.Vector3): THREE.Vector3;
  arma(id: string): void;
  aggiorna(dt: number, o: { x: number; y: number; z: number; yaw: number; pitch: number; vel: number; giu: boolean; morto: boolean }): void;
  colpito(forte: number): void;
  visibile(on: boolean): void;
};

const ABBASSA = 0.42;

export async function creaSoldato(scene: THREE.Object3D, look: Look, o: { cappello?: string | null; arma: string }): Promise<Soldato | null> {
  const loader = await loaderCorse();
  const avatar = await createAvatar({ loader, look, x: 0, z: 0 });
  if (!avatar.usesModel) return null;
  if (o.cappello) avatar.setCappello(o.cappello);
  const group = new THREE.Group(); scene.add(group);
  group.add(avatar.object);
  let suolo = 0;
  avatar.setGround(() => suolo);
  // materiali propri (il lampo bianco non deve accendere gli altri soldati)
  const mats: THREE.MeshLambertMaterial[] = [];
  // l'ombra la fa solo il pezzo più grande (il corpo): ogni pezzo che fa ombra costa un draw call in più
  let corpo: THREE.Mesh | null = null;
  avatar.object.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh && (!corpo || m.geometry.attributes.position!.count > corpo.geometry.attributes.position!.count)) corpo = m; });
  avatar.object.traverse((x) => {
    const m = x as THREE.Mesh; if (!m.isMesh) return;
    m.castShadow = m === corpo;
    m.material = Array.isArray(m.material) ? m.material.map((k) => k.clone()) : (m.material as THREE.Material).clone();
    for (const k of Array.isArray(m.material) ? m.material : [m.material]) if ((k as THREE.MeshLambertMaterial).emissive) mats.push(k as THREE.MeshLambertMaterial);
  });
  const bone = (n: string) => avatar.object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) ?? avatar.object.getObjectByName(n) ?? null;
  const Bn = {
    spine: bone('Spine'), head: bone('Head'),
    armR: bone('UpperArm.R'), foreR: bone('LowerArm.R'), armL: bone('UpperArm.L'), foreL: bone('LowerArm.L'),
    thighR: bone('UpperLeg.R'), shinR: bone('LowerLeg.R'), thighL: bone('UpperLeg.L'), shinL: bone('LowerLeg.L'),
  };
  const v3 = () => new THREE.Vector3();
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), ql = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const asse = v3(), boneDir = v3();
  function rot(b: THREE.Object3D | null, ax: THREE.Vector3, ang: number): void {
    if (!b || !b.parent) return;
    avatar.object.getWorldQuaternion(qb);
    asse.copy(ax).applyQuaternion(qb);
    b.parent.getWorldQuaternion(qp);
    qa.setFromAxisAngle(asse, ang);
    b.quaternion.premultiply(ql.copy(qp).invert().multiply(qa).multiply(qp));
    b.updateMatrixWorld(true);
  }
  function punta(b: THREE.Object3D, dirW: THREE.Vector3): void {
    b.getWorldQuaternion(qa);
    boneDir.set(0, 1, 0).applyQuaternion(qa);
    const dq = new THREE.Quaternion().setFromUnitVectors(boneDir, dirW);
    b.parent!.getWorldQuaternion(qp);
    b.quaternion.premultiply(ql.copy(qp).invert().multiply(dq).multiply(qp));
    b.updateMatrixWorld(true);
  }
  avatar.object.updateMatrixWorld(true);
  const lung = (a: THREE.Object3D | null, b: THREE.Object3D | null) => (a && b ? a.getWorldPosition(v3()).distanceTo(b.getWorldPosition(v3())) : 0.3);
  const lungo = (b: THREE.Object3D | null) => { const c = b?.children.find((x) => (x as THREE.Bone).isBone); return c ? lung(b, c) : 0.27; };
  const L = { braccio: lung(Bn.armR, Bn.foreR), avambraccio: lungo(Bn.foreR), coscia: lung(Bn.thighR, Bn.shinR), stinco: lungo(Bn.shinR) };
  const S = v3(), D = v3(), Pp = v3(), E = v3(), E2 = v3(), T2 = v3(), tmp = v3();
  function ik(up: THREE.Object3D | null, lo: THREE.Object3D | null, a: number, b: number, target: THREE.Vector3, pole: THREE.Vector3): void {
    if (!up || !lo || !up.parent) return;
    up.getWorldPosition(S);
    D.subVectors(target, S); let d = D.length(); if (d < 1e-4) return; D.divideScalar(d);
    d = Math.min(Math.max(d, 0.08), a + b - 1e-3);
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    Pp.copy(pole).addScaledVector(D, -pole.dot(D)).normalize();
    E.copy(S).addScaledVector(D, x).addScaledVector(Pp, h);
    punta(up, tmp.subVectors(E, S).normalize());
    lo.getWorldPosition(E2);
    T2.copy(S).addScaledVector(D, d);
    punta(lo, tmp.subVectors(T2, E2).normalize());
  }

  // l'arma: figlia del gruppo (non delle ossa), girata lungo la mira
  const perno = new THREE.Group(); group.add(perno);
  let armaId = '', armaMesh: THREE.Mesh | null = null;
  const setArma = (id: string) => {
    if (id === armaId) return;
    armaId = id;
    if (armaMesh) perno.remove(armaMesh);
    armaMesh = armaVista(id); perno.add(armaMesh);
  };
  setArma(o.arma);

  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), pw = v3(), pl = v3(), qy = new THREE.Quaternion();
  let lampo = 0, spinta = 0, caduta = 0, giuK = 0;
  return {
    avatar, group,
    bocca(out) { return out.copy(modelloArma(armaId).bocca).applyMatrix4(armaMesh!.matrixWorld); },
    arma: setArma,
    colpito(forte) { lampo = 1; spinta = Math.min(1, spinta + 0.35 * forte); },
    visibile(on) { group.visible = on; },
    aggiorna(dt, s) {
      giuK += ((s.giu ? 1 : 0) - giuK) * Math.min(1, dt * 12);
      caduta = s.morto ? Math.min(1, caduta + dt * 3.2) : Math.max(0, caduta - dt * 2.5);
      suolo = s.y;
      // la clip: ferma, cammina, corre (accucciato si cammina piano); avatar.yaw = −yaw della sim (convenzioni opposte)
      avatar.setPose({ x: s.x, z: s.z, yaw: -s.yaw, anim: s.morto ? 'idle' : s.vel > 4.9 ? 'run' : s.vel > 0.4 ? 'walk' : 'idle' });
      avatar.update(1, dt);
      avatar.object.position.y -= ABBASSA * giuK;
      // caduta all'indietro, col perno ai piedi
      group.position.set(0, 0, 0); group.rotation.set(0, 0, 0);
      if (caduta > 0) {
        const k = caduta * caduta * (3 - 2 * caduta);
        qy.setFromAxisAngle(Y, s.yaw);
        const indietro = v3().set(0, 0, 1).applyQuaternion(qy);
        group.position.set(s.x, s.y, s.z); group.quaternion.setFromAxisAngle(v3().crossVectors(Y, indietro).normalize(), (Math.PI / 2) * 0.92 * k);
        group.position.sub(v3().set(s.x, s.y, s.z).applyQuaternion(group.quaternion));
      }
      // mezzo passo indietro quando un colpo arriva
      spinta = Math.max(0, spinta - dt * 4);
      if (spinta > 0) { qy.setFromAxisAngle(Y, s.yaw); avatar.object.position.addScaledVector(v3().set(0, 0, 1).applyQuaternion(qy), spinta * 0.12); }
      avatar.object.updateMatrixWorld(true);
      // busto che segue la mira (metà del pitch; il resto lo fanno le braccia), testa dritta
      const p = Math.max(-1.1, Math.min(1.1, s.pitch));
      if (!s.morto) { rot(Bn.spine, X, p * 0.45 + 0.08 * giuK); rot(Bn.head, X, p * 0.35); }
      // l'arma: davanti alla spalla destra, lungo la mira
      pw.copy(avatar.object.position); // spazio del gruppo (che si inclina solo cadendo)
      perno.quaternion.setFromEuler(new THREE.Euler(p, s.yaw, 0, 'YXZ'));
      const spalla = v3().set(0.13, 1.28 - (1 - Math.cos(p)) * 0.05, -0.05).applyQuaternion(qy.setFromAxisAngle(Y, s.yaw)).add(pw);
      perno.position.copy(spalla).add(v3().set(0, -0.04, -0.3).applyQuaternion(perno.quaternion));
      if (s.morto) perno.visible = caduta < 0.3; else perno.visible = true;
      perno.updateMatrixWorld(true);
      // le mani sull'arma: destra sull'impugnatura, sinistra sull'astina; gomiti in giù e in fuori
      if (!s.morto) {
        const m = modelloArma(armaId);
        perno.localToWorld(pl.set(0, -0.03, 0.02));
        const fuori = v3().set(1, -1.2, 0.2).applyQuaternion(qy).normalize();
        ik(Bn.armR, Bn.foreR, L.braccio, L.avambraccio, pl.clone(), fuori);
        perno.localToWorld(pl.copy(m.sinistra));
        const fuoriS = v3().set(-1, -1.2, 0.1).applyQuaternion(qy).normalize();
        ik(Bn.armL, Bn.foreL, L.braccio, L.avambraccio, pl.clone(), fuoriS);
      }
      // accucciato: piedi a terra davanti alle anche, ginocchia avanti
      if (giuK > 0.02 && !s.morto) {
        const avanti = v3().set(0, 0, -1).applyQuaternion(qy), lato = v3().set(1, 0, 0).applyQuaternion(qy);
        for (const [th, sh, sx] of [[Bn.thighR, Bn.shinR, 1], [Bn.thighL, Bn.shinL, -1]] as const) {
          const piede = v3().set(s.x, s.y + 0.08, s.z).addScaledVector(lato, 0.11 * sx).addScaledVector(avanti, 0.12 + 0.1 * sx);
          ik(th, sh, L.coscia, L.stinco, piede, avanti.clone().addScaledVector(lato, 0.2 * sx));
        }
      }
      // lampo del colpo
      lampo = Math.max(0, lampo - dt * 9);
      for (const k of mats) k.emissive.setScalar(lampo * 0.9);
    },
  };
}
