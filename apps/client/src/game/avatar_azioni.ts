// Gestore delle animazioni dei gesti e degli attrezzi dell'avatar (scuotere alberi, colpi di pala, scavo buca, chiusura)
import * as THREE from 'three';

export type AvatarAzione = 'scuoti' | 'pala_sasso' | 'pala_scava' | 'pala_chiudi';

export type RigParti = {
  upper: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
};

export type GestoreAzioni = {
  readonly inCorso: AvatarAzione | null;
  readonly progresso: number;
  readonly tempo: number;
  readonly durata: number;
  avvia(tipo: AvatarAzione, durata?: number, bersaglio?: { x: number; z: number }): number;
  interrompi(): void;
  update(dt: number): void;
};

const DURATE_BASE: Record<AvatarAzione, number> = {
  scuoti: 0.85,
  pala_sasso: 0.45,
  pala_scava: 0.85,
  pala_chiudi: 0.75,
};

export function creaGestoreAzioni(o: {
  body: THREE.Object3D;
  bone(name: string): THREE.Object3D | null;
  rig?: RigParti | null;
  getPos(): { x: number; z: number };
  orienta(yaw: number): void;
}): GestoreAzioni {
  let inCorso: AvatarAzione | null = null;
  let tempo = 0, durata = 0;

  const B = {
    get spine() { return o.bone('Spine'); },
    get head() { return o.bone('Head'); },
    get armR() { return o.bone('UpperArm.R'); },
    get foreR() { return o.bone('LowerArm.R'); },
    get armL() { return o.bone('UpperArm.L'); },
    get foreL() { return o.bone('LowerArm.L'); },
  };

  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qr = new THREE.Quaternion(), qi = new THREE.Quaternion(), ql = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

  function rot(b: THREE.Object3D | null, axis: THREE.Vector3, ang: number): void {
    if (!b || !b.parent || Math.abs(ang) < 1e-4) return;
    b.parent.updateWorldMatrix(true, false);
    o.body.getWorldQuaternion(qr);
    b.parent.getWorldQuaternion(qp);
    qi.copy(qr).invert().multiply(qp);
    qa.setFromAxisAngle(axis, ang);
    b.quaternion.premultiply(ql.copy(qi).invert().multiply(qa).multiply(qi));
  }

  return {
    get inCorso() { return inCorso; },
    get progresso() { return durata > 0 ? Math.min(1, tempo / durata) : 0; },
    get tempo() { return tempo; },
    get durata() { return durata; },
    avvia(tipo, d, bersaglio) {
      inCorso = tipo;
      tempo = 0;
      durata = d ?? DURATE_BASE[tipo];
      if (bersaglio) {
        const p = o.getPos();
        const dx = bersaglio.x - p.x, dz = bersaglio.z - p.z;
        if (Math.hypot(dx, dz) > 1e-3) o.orienta(Math.atan2(dx, -dz));
      }
      return durata;
    },
    interrompi() {
      inCorso = null;
      tempo = 0;
      durata = 0;
    },
    update(dt) {
      if (!inCorso) return;
      tempo += dt;
      const u = Math.min(1, tempo / durata);
      if (inCorso === 'scuoti') {
        const env = Math.sin(u * Math.PI);
        const s = env * Math.sin(u * 6 * Math.PI);
        rot(B.spine, X, -0.22 + s * 0.14);
        rot(B.armL, X, -1.15 + s * 0.2);
        rot(B.armL, Y, 0.25);
        rot(B.foreL, X, -0.45 + s * 0.1);
        rot(B.armR, X, -1.15 + s * 0.2);
        rot(B.armR, Y, -0.25);
        rot(B.foreR, X, -0.45 + s * 0.1);
        rot(B.head, X, -0.22);
        if (o.rig) {
          o.rig.upper.rotation.x = -0.22 + s * 0.14;
          o.rig.armL.rotation.x = -1.15 + s * 0.2;
          o.rig.armR.rotation.x = -1.15 + s * 0.2;
        }
      } else if (inCorso === 'pala_sasso') {
        if (u < 0.48) {
          const w = u / 0.48;
          rot(B.spine, X, 0.14 * w);
          rot(B.spine, Y, -0.22 * w);
          rot(B.armR, X, -0.65 * w);
          rot(B.armR, Y, -0.4 * w);
          rot(B.foreR, X, -0.85 * w);
          rot(B.armL, X, -0.4 * w);
          if (o.rig) {
            o.rig.upper.rotation.x = 0.14 * w;
            o.rig.armR.rotation.x = -0.65 * w;
          }
        } else {
          const k = (u - 0.48) / 0.52;
          const vibe = Math.sin(k * 35) * Math.exp(-k * 5) * 0.15;
          const decay = Math.exp(-k * 4);
          rot(B.spine, X, (-0.32 + vibe * 0.5) * decay);
          rot(B.spine, Y, -0.1 * decay);
          rot(B.armR, X, (-1.25 + 0.45 * (1 - decay) + vibe) * Math.max(0, 1 - k));
          rot(B.foreR, X, (-0.3 + vibe) * decay);
          rot(B.armL, X, -0.3 * decay);
          if (o.rig) {
            o.rig.upper.rotation.x = -0.32 * decay;
            o.rig.armR.rotation.x = -1.25 * Math.max(0, 1 - k);
          }
        }
      } else if (inCorso === 'pala_scava') {
        if (u < 0.4) {
          const k = u / 0.4;
          rot(B.spine, X, -0.42 * Math.sin(k * Math.PI * 0.5));
          rot(B.armR, X, -0.85 * k);
          rot(B.foreR, X, -0.5 * k);
          rot(B.armL, X, -0.7 * k);
          rot(B.foreL, X, -0.4 * k);
          if (o.rig) {
            o.rig.upper.rotation.x = -0.42 * k;
            o.rig.armR.rotation.x = -0.85 * k;
            o.rig.armL.rotation.x = -0.7 * k;
          }
        } else if (u < 0.68) {
          const k = (u - 0.4) / 0.28;
          rot(B.spine, X, -0.42 + 0.32 * k);
          rot(B.armR, X, -0.85 - 0.35 * k);
          rot(B.foreR, X, -0.5 - 0.2 * k);
          rot(B.armL, X, -0.7 + 0.2 * k);
          if (o.rig) {
            o.rig.upper.rotation.x = -0.42 + 0.32 * k;
            o.rig.armR.rotation.x = -0.85 - 0.35 * k;
          }
        } else {
          const k = (u - 0.68) / 0.32;
          const flick = Math.sin(k * Math.PI);
          rot(B.spine, X, -0.1 * (1 - k));
          rot(B.spine, Y, 0.18 * flick);
          rot(B.armR, X, (-1.2 + 0.3 * flick) * (1 - k));
          rot(B.armR, Z, 0.25 * flick);
          if (o.rig) {
            o.rig.upper.rotation.x = -0.1 * (1 - k);
            o.rig.armR.rotation.x = -1.2 * (1 - k);
          }
        }
      } else if (inCorso === 'pala_chiudi') {
        if (u < 0.42) {
          const k = u / 0.42;
          const sw = Math.sin(k * Math.PI);
          rot(B.spine, X, -0.35 * sw);
          rot(B.armR, X, -0.5 - 0.5 * sw);
          rot(B.foreR, X, -0.35 * sw);
          if (o.rig) {
            o.rig.upper.rotation.x = -0.35 * sw;
            o.rig.armR.rotation.x = -0.5 - 0.5 * sw;
          }
        } else if (u < 0.85) {
          const k = (u - 0.42) / 0.43;
          const tap = Math.abs(Math.sin(k * 2 * Math.PI));
          rot(B.spine, X, -0.28 - 0.1 * tap);
          rot(B.armR, X, -0.85 - 0.3 * tap);
          rot(B.foreR, X, -0.2 - 0.15 * tap);
          if (o.rig) {
            o.rig.upper.rotation.x = -0.28 - 0.1 * tap;
            o.rig.armR.rotation.x = -0.85 - 0.3 * tap;
          }
        } else {
          const k = (u - 0.85) / 0.15;
          rot(B.spine, X, -0.28 * (1 - k));
          rot(B.armR, X, -0.85 * (1 - k));
          if (o.rig) {
            o.rig.upper.rotation.x = -0.28 * (1 - k);
            o.rig.armR.rotation.x = -0.85 * (1 - k);
          }
        }
      }
      if (u >= 1) inCorso = null;
    },
  };
}
