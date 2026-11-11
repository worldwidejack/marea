// Nemici snodati (issue 723): i `nem_*` del manifest con lo scheletro (assets/blender/nemici_kit.py) diventano una SkinnedMesh clonata
// per nemico, con materiali Lambert propri (flash, tinte, dissolvenza come prima). Le ossa sono rigide e puntano tutte in su; le pose
// si danno negli assi del modello (x destra, y su, −Z davanti) e qui si riportano nel locale di ogni osso. Le pose le calcolano
// nemici_pose.ts (bipedi) e nemici_bestie.ts (il resto) a ogni fotogramma, dallo stato della sim: nessuna clip nel glb.
import * as THREE from 'three';
import type { Loader } from '../render/loader.ts';
import { toLambert } from './dungeon_kit.ts';

type Osso = { b: THREE.Object3D; q0: THREE.Quaternion; p0: THREE.Vector3; w: THREE.Quaternion; wi: THREE.Quaternion; pi: THREE.Quaternion };
export type Rig = {
  obj: THREE.Object3D;
  /** Altezza del modello a riposo (m). */
  h: number;
  ossa: Map<string, Osso>;
  /** Rimette tutte le ossa a riposo (all'inizio di ogni posa). */
  riposo(): void;
  /** Ruota un osso di (x, y, z) radianti negli assi del modello (ordine YXZ), sopra la rotazione del padre. */
  ruota(nome: string, x: number, y?: number, z?: number): void;
  /** Sposta un osso di (x, y, z) metri negli assi del modello. */
  sposta(nome: string, x: number, y: number, z: number): void;
  ha(nome: string): boolean;
};

const qd = new THREE.Quaternion(), eu = new THREE.Euler(), v = new THREE.Vector3();

/** Il nemico snodato, o null se il modello non c'è o non ha lo scheletro (allora resta il segnaposto animato a corpo intero). */
export async function rigNemico(loader: Loader, name: string): Promise<Rig | null> {
  if (!loader.has(name)) return null;
  let scene: THREE.Group;
  try { scene = (await loader.load(name)).scene; } catch { return null; }
  let pelle = false;
  scene.traverse((n) => { if ((n as THREE.SkinnedMesh).isSkinnedMesh) pelle = true; });
  if (!pelle) return null;
  // il loader dà già una copia (Object3D.clone), ma le SkinnedMesh restano legate alle ossa dell'originale: si ricollegano per nome
  const obj: THREE.Object3D = scene;
  obj.name = name;
  const perNome = new Map<string, THREE.Bone>();
  obj.traverse((n) => { if ((n as THREE.Bone).isBone) perNome.set(n.name, n as THREE.Bone); });
  obj.traverse((n) => {
    const m = n as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return;
    const sk = m.skeleton, ossa = sk.bones.map((b) => perNome.get(b.name)!);
    if (ossa.every(Boolean)) m.bind(new THREE.Skeleton(ossa, sk.boneInverses.map((x) => x.clone())), m.bindMatrix);
  });
  obj.traverse((n) => {
    const m = n as THREE.SkinnedMesh; if (!m.isMesh) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const l = toLambert(x).clone(); return l; });
    m.material = Array.isArray(m.material) ? mats : mats[0]!;
    m.name = mats[0]!.name;
    m.frustumCulled = false; // le ossa spostano i vertici fuori dalla scatola calcolata a riposo
  });
  obj.updateMatrixWorld(true);
  const radice = new THREE.Quaternion(); obj.getWorldQuaternion(radice); radice.invert();
  const ossa = new Map<string, Osso>();
  const box = new THREE.Box3().setFromObject(obj);
  obj.traverse((n) => {
    if (!(n as THREE.Bone).isBone) return;
    const w = new THREE.Quaternion(); n.getWorldQuaternion(w); w.premultiply(radice);
    const pi = new THREE.Quaternion(); if (n.parent) { n.parent.getWorldQuaternion(pi); pi.premultiply(radice); } pi.invert();
    ossa.set(n.name, { b: n, q0: n.quaternion.clone(), p0: n.position.clone(), w, wi: w.clone().invert(), pi });
  });
  const rig: Rig = {
    obj, h: Math.max(0.3, box.max.y - box.min.y), ossa,
    riposo() { for (const o of ossa.values()) { o.b.quaternion.copy(o.q0); o.b.position.copy(o.p0); } },
    ruota(nome, x, y = 0, z = 0) {
      const o = ossa.get(nome); if (!o || (x === 0 && y === 0 && z === 0)) return;
      qd.setFromEuler(eu.set(x, y, z, 'YXZ'));
      o.b.quaternion.multiply(qd.premultiply(o.wi).multiply(o.w)); // locale = q · (W⁻¹ R W)
    },
    sposta(nome, x, y, z) {
      const o = ossa.get(nome); if (!o) return;
      o.b.position.add(v.set(x, y, z).applyQuaternion(o.pi));
    },
    ha: (nome) => ossa.has(nome),
  };
  return rig;
}

// ------------------------------------------------------------------ aiuti per le pose
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Uscita morbida (parte svelta, arriva piano) e il contrario; `colpo` è uno scatto: quasi tutto nel primo terzo. */
export const esce = (k: number) => 1 - (1 - clamp01(k)) ** 3;
export const entra = (k: number) => clamp01(k) ** 3;
export const colpo = (k: number) => 1 - (1 - clamp01(k * 2.2)) ** 4;
/** Va e torna (0 → 1 → 0) a campana. */
export const campana = (k: number) => Math.sin(Math.PI * clamp01(k));
/** Rimbalzo d'arrivo (caduta): sale a 1 con un piccolo rimbalzo. */
export const tonfo = (k: number) => { const x = clamp01(k); return x < 0.7 ? entra(x / 0.7) : 1 - 0.12 * Math.sin(Math.PI * (x - 0.7) / 0.3); };
