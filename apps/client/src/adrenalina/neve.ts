// La neve che si muove (come nei video di freeride): la scia che la tavola lascia nella neve e la polvere che si alza dietro la coda, più
// forte nelle curve e nella neve fresca, a nuvola quando atterri. Solo resa (la sim non sa niente): 2 draw call, cubetti a colori della
// palette che si rimpiccioliscono, niente trasparenze.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';

export type Neve = {
  gruppo: THREE.Group;
  /** Un frame: dov'è la coda della tavola, dove va (avanti e destra in orizzontale), quanto spruzza (0-1, curva e velocità), se è a terra. */
  aggiorna(o: { coda: THREE.Vector3; avanti: THREE.Vector3; destra: THREE.Vector3; v: number; spruzzo: number; aTerra: boolean }, dt: number): void;
  /** Una nuvola (atterraggio, caduta): `forza` 0-1. */
  nuvola(dove: THREE.Vector3, forza: number): void;
  /** Via la scia (ricomincia). */
  pulisci(): void;
  dispose(): void;
};

const GRANI = 160, SCIA = 140, LARGA = 0.07, PASSO_SCIA = 0.6;

export function creaNeve(): Neve {
  const gruppo = new THREE.Group(); gruppo.name = 'snowboard_neve';
  // ---- polvere: cubetti in un InstancedMesh ----
  const mat = new THREE.MeshLambertMaterial({ color: PAL.pietraChiara, flatShading: true });
  const grani = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat, GRANI);
  grani.name = 'snowboard_polvere'; grani.frustumCulled = false; gruppo.add(grani);
  const pos = new Float32Array(GRANI * 3), vel = new Float32Array(GRANI * 3), vita = new Float32Array(GRANI), dura = new Float32Array(GRANI);
  let prossimo = 0, accumulo = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  const lancia = (x: number, y: number, z: number, vx: number, vy: number, vz: number, t: number) => {
    const i = prossimo; prossimo = (prossimo + 1) % GRANI;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; vita[i] = t; dura[i] = t;
  };
  // ---- scia: un nastro sottile di quad dietro la tavola, un punto ogni PASSO_SCIA m ----
  const sciaPos = new Float32Array(SCIA * 6 * 3);
  const sciaGeo = new THREE.BufferGeometry(); sciaGeo.setAttribute('position', new THREE.BufferAttribute(sciaPos, 3));
  sciaGeo.setDrawRange(0, 0);
  const scia = new THREE.Mesh(sciaGeo, new THREE.MeshLambertMaterial({ color: PAL.pietra, flatShading: true, polygonOffset: true, polygonOffsetFactor: -3 }));
  scia.name = 'snowboard_scia'; scia.frustumCulled = false; scia.receiveShadow = true; gruppo.add(scia);
  const punti: { l: THREE.Vector3; r: THREE.Vector3 }[] = [];
  const ultimo = new THREE.Vector3(Infinity, 0, 0);
  const rifaiScia = () => {
    let k = 0;
    for (let i = 0; i + 1 < punti.length; i++) {
      const a = punti[i]!, b = punti[i + 1]!;
      if (a.l.distanceTo(b.l) > PASSO_SCIA * 4) continue; // un salto: la scia si interrompe
      for (const v of [a.l, b.r, b.l, a.l, a.r, b.r]) { sciaPos[k++] = v.x; sciaPos[k++] = v.y; sciaPos[k++] = v.z; }
    }
    sciaGeo.attributes.position!.needsUpdate = true; sciaGeo.setDrawRange(0, k / 3); sciaGeo.computeVertexNormals();
  };

  return {
    gruppo,
    aggiorna(o, dt) {
      // la polvere: più ne alzi più vai forte e più curvi
      if (o.aTerra && o.v > 3) {
        accumulo += dt * (6 + 70 * o.spruzzo) * Math.min(1, o.v / 18);
        while (accumulo >= 1) {
          accumulo -= 1;
          const lato = (Math.random() - 0.5) * 2, su = 1.2 + Math.random() * 2.5 * (0.4 + o.spruzzo), dietro = -(1 + Math.random() * 2);
          lancia(o.coda.x + o.destra.x * lato * 0.2, o.coda.y + 0.1, o.coda.z + o.destra.z * lato * 0.2,
            o.avanti.x * (o.v * 0.8 + dietro) + o.destra.x * lato * (1.5 + 4 * o.spruzzo), su, o.avanti.z * (o.v * 0.8 + dietro) + o.destra.z * lato * (1.5 + 4 * o.spruzzo), 0.35 + Math.random() * 0.4);
        }
        // la scia: due bordi della tavola
        if (o.coda.distanceTo(ultimo) > PASSO_SCIA) {
          ultimo.copy(o.coda);
          punti.push({ l: o.coda.clone().addScaledVector(o.destra, -LARGA).setY(o.coda.y + 0.04), r: o.coda.clone().addScaledVector(o.destra, LARGA).setY(o.coda.y + 0.04) });
          if (punti.length > SCIA) punti.shift();
          rifaiScia();
        }
      } else if (!o.aTerra) ultimo.set(Infinity, 0, 0);
      // muovi i grani: gravità, aria che li frena, si rimpiccioliscono finché spariscono
      for (let i = 0; i < GRANI; i++) {
        if (vita[i]! > 0) {
          vita[i] = vita[i]! - dt;
          vel[i * 3 + 1] = vel[i * 3 + 1]! - 6 * dt;
          const fr = Math.exp(-2.5 * dt);
          for (let c = 0; c < 3; c++) { vel[i * 3 + c] = vel[i * 3 + c]! * fr; pos[i * 3 + c] = pos[i * 3 + c]! + vel[i * 3 + c]! * dt; }
        }
        const s = vita[i]! > 0 ? 0.4 + 1.4 * (vita[i]! / dura[i]!) * (1 - vita[i]! / dura[i]!) * 2 : 0;
        m4.compose(pv.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!), q, sc.setScalar(s));
        grani.setMatrixAt(i, m4);
      }
      grani.instanceMatrix.needsUpdate = true;
    },
    nuvola(dove, forza) {
      const n = Math.round(10 + 30 * forza);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5 * forza;
        lancia(dove.x, dove.y + 0.2, dove.z, Math.cos(a) * r, 1.5 + Math.random() * 3 * forza, Math.sin(a) * r, 0.6 + Math.random() * 0.7);
      }
    },
    pulisci() { punti.length = 0; ultimo.set(Infinity, 0, 0); sciaGeo.setDrawRange(0, 0); vita.fill(0); },
    dispose() { grani.geometry.dispose(); mat.dispose(); sciaGeo.dispose(); (scia.material as THREE.Material).dispose(); },
  };
}
