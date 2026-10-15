// La bici della discesa (#229) montata dai pezzi del kit: telaio, sterzo (forcella + manubrio, gira attorno al suo asse), due ruote che
// girano con la velocità, le braccia in prima persona sulle manopole. Si piega in curva, beccheggia sui salti, sobbalza sulle radici.
import * as THREE from 'three';
import type { Bici } from '@marea/sim/corse/bici.ts';
import { pezzo } from './kit.ts';

/** Dove si montano i pezzi rispetto al perno del telaio (m: x destra, y su, −z avanti), dal kit (commento in testa a models_discesa.py).
 *  Lo sterzo sta sul mozzo davanti, inclinato di 27° (angolo di sterzo 63°): sterzare = ruotarlo attorno alla sua y. */
export const MONTA = {
  sterzo: [0, 0.35, -0.625] as const, sterzoInclina: (27 * Math.PI) / 180,
  ruotaDietro: [0, 0.35, 0.625] as const,
  /** Le braccia nel locale dello sterzo (le mani sulle manopole), raddrizzate. */
  braccia: [0, 0.7576, -0.0549] as const,
  raggio: 0.35,
};

export type Bici3d = {
  group: THREE.Group;
  /** Il telaio (si piega e beccheggia): il ciclista ci sta dentro. Manopole (sinistra, destra) e pedali (sinistro dietro, destro avanti). */
  corpo: THREE.Group; prese: THREE.Object3D[]; pedali: THREE.Object3D[];
  /** Le braccia in prima persona (si spengono quando si vede il ciclista intero). */
  braccia(on: boolean): void;
  /** Quanto si è schiacciato sulla bici chi pedala (m, il SALTO che carica). */
  readonly giu: number;
  /** `becc` = beccheggio voluto (rad, + = muso su). */
  monta(): void; posa(pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3, piega: number, becc: number, b: Bici, dt: number): void };

/** Impennata (rad) e quanto ci si schiaccia col salto carico (m). */
const IMPENNA = 0.38, SCHIACCIA = 0.16;

export function creaBici3d(): Bici3d {
  const group = new THREE.Group(); group.name = 'bici';
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const corpo = new THREE.Group(), sterzo = new THREE.Group();
  group.add(corpo); corpo.add(sterzo);
  let ruotaD: THREE.Mesh | null = null, ruotaA: THREE.Mesh | null = null, braccia: THREE.Mesh | null = null;
  // manopole: nel locale dello sterzo, dove stanno le braccia del kit, ± 0,3225 m dal centro del manubrio
  const manubrio = new THREE.Object3D(); manubrio.position.set(...MONTA.braccia); manubrio.rotation.x = -MONTA.sterzoInclina; sterzo.add(manubrio);
  const prese = [-1, 1].map((s) => { const o = new THREE.Object3D(); o.position.set(s * 0.3225, 0.015, 0.021); manubrio.add(o); return o; });
  // pedali in piano (models_discesa.py): il destro avanti, il sinistro dietro
  const pedali = [[-0.14, 0.34, 0.35], [0.14, 0.34, 0.01]].map(([x, y, z]) => { const o = new THREE.Object3D(); o.position.set(x!, y!, z!); corpo.add(o); return o; });
  const m4 = new THREE.Matrix4(), dx = new THREE.Vector3(), indietro = new THREE.Vector3();
  let giro = 0, sterzoVis = 0, beccheggio = 0, impenna = 0, giu = 0;
  return {
    group, corpo, prese, pedali,
    get giu() { return giu; },
    braccia(on) { if (braccia) braccia.visible = on; },
    monta() {
      const telaio = pezzo('cs_d_bici_telaio'), st = pezzo('cs_d_bici_sterzo'), ruota = pezzo('cs_d_bici_ruota'), br = pezzo('cs_d_braccia');
      const mesh = (geo: THREE.BufferGeometry) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
      if (telaio) corpo.add(mesh(telaio));
      sterzo.position.set(...MONTA.sterzo); sterzo.rotation.x = MONTA.sterzoInclina;
      if (st) sterzo.add(mesh(st));
      if (br) { braccia = mesh(br); manubrio.add(braccia); }
      if (ruota) {
        ruotaD = mesh(ruota); sterzo.add(ruotaD);
        ruotaA = mesh(ruota); ruotaA.position.set(...MONTA.ruotaDietro); corpo.add(ruotaA);
      }
    },
    posa(pos, fwd, up, piega, becc, b, dt) {
      // terna: x = destra, y = su, z = indietro (i modelli guardano −Z); poi la piega attorno al davanti
      dx.crossVectors(fwd, up).normalize(); indietro.copy(fwd).negate();
      m4.makeBasis(dx, up, indietro);
      group.position.copy(pos);
      group.quaternion.setFromRotationMatrix(m4);
      // il beccheggio: a terra quello del rilievo sotto le ruote (rampe, tronchi), in aria segue il volo; agli atterraggi e sulle radici
      // la bici sobbalza
      beccheggio += (becc - beccheggio) * Math.min(1, dt * (b.aria ? 5 : 20));
      // l'impennata (SALTO tenuto a lungo in piano): la bici ruota attorno alla ruota dietro (z = +0,625), la ruota davanti si alza
      impenna += ((b.impennata && !b.aria ? IMPENNA : 0) - impenna) * Math.min(1, dt * 8);
      corpo.rotation.set(beccheggio + impenna, 0, -piega);
      const sobbalzo = b.scossa > 0.05 && !b.aria ? Math.abs(Math.sin(performance.now() * 0.045)) * b.scossa * 0.05 : 0;
      corpo.position.y = sobbalzo + Math.sin(impenna) * MONTA.ruotaDietro[2];
      corpo.position.z = MONTA.ruotaDietro[2] * (1 - Math.cos(impenna));
      // il SALTO che carica: chi pedala si schiaccia sulla bici (lo legge il ciclista)
      giu += (b.carica * SCHIACCIA - giu) * Math.min(1, dt * 15);
      group.visible = b.caduto <= 0;
      // sterzo che si vede: piano gira tanto, forte poco (come la fisica)
      const voluto2 = b.st * 0.32 / (1 + b.v * 0.25);
      sterzoVis += (voluto2 - sterzoVis) * Math.min(1, dt * 14);
      sterzo.rotation.y = -sterzoVis;
      giro -= (b.v * dt) / MONTA.raggio;
      if (ruotaD) ruotaD.rotation.x = giro;
      if (ruotaA) ruotaA.rotation.x = giro;
    },
  };
}
