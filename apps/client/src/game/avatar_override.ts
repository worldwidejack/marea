// Le ossa che un override procedurale (il retino in mano) piega dopo l'animazione. Si salva la posa pulita prima di toccarle e la si
// rimette prima che l'animatore giri: altrimenti il mixer si ricorda la posa piegata come «originale» e la porta fuori dal retino.
import * as THREE from 'three';

const OSSA = ['UpperArm.R', 'LowerArm.R', 'Spine', 'Head', 'Hips', 'UpperLeg.L', 'UpperLeg.R', 'LowerLeg.L', 'LowerLeg.R'];

export type Ripristino = { salva(): void; ripristina(): void };

export function creaRipristino(bone: (nome: string) => THREE.Object3D | null): Ripristino {
  const pulite: { b: THREE.Object3D; q: THREE.Quaternion; p: THREE.Vector3 }[] = [];
  let toccate = false;
  return {
    salva() {
      if (!pulite.length) for (const n of OSSA) { const b = bone(n); if (b) pulite.push({ b, q: new THREE.Quaternion(), p: new THREE.Vector3() }); }
      for (const o of pulite) { o.q.copy(o.b.quaternion); o.p.copy(o.b.position); }
      toccate = true;
    },
    ripristina() {
      if (!toccate) return;
      for (const o of pulite) { o.b.quaternion.copy(o.q); o.b.position.copy(o.p); }
      toccate = false;
    },
  };
}
