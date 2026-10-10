// Avatar (WP2): modello `chr_base` dal manifest (clip idle walk run sit row, materiali mat_pelle/mat_capelli/mat_vestito/mat_cappello)
// oppure segnaposto procedurale a 6 teste (1,6 m) fatto di pochi box in colori di palette, animato a mano.
// La fisica è nella sim (stepAvatar); qui: resa, animazione, look, posa da seduto/a bordo, ombre di contatto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { newAvatar, stepAvatar } from '@marea/sim';
import type { AvatarState, GridMap, InputFrame } from '@marea/sim';
import type { Indossa, Look } from '@marea/protocol';
import { AVATAR, BALANCE } from '@marea/content';
import type { Loader } from '../render/loader.ts';
import { createAnimator } from '../render/anim.ts';
import type { Animator } from '../render/anim.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type Avatar = {
  object: THREE.Object3D; state: AvatarState; prev: AvatarState;
  step(input: InputFrame, map: GridMap): void; update(alpha: number, dt: number): void; teleport(x: number, z: number): void; visible: boolean;
  // ---- aggiunte WP2 (vedi tests/out/richieste/wp2.md) ----
  /** Applica colori e pezzi del look (pelle, capelli, vestito, cappello). */
  setLook(look: Look): void;
  /** Gesto delle emote (#90): saltello `hop` (m) e giro `spin` (rad) del corpo, sopra la posa del frame. (0, 0) = fermo. */
  gesto(hop: number, spin: number): void;
  /** Siede l'avatar dentro `parent` (es. barca) con il bacino sul punto `seat` (locale a parent). `null` = scende e torna nel genitore di prima. */
  attachTo(parent: THREE.Object3D | null, seat?: { x: number; y: number; z: number }, yaw?: number): void;
  /** Da seduto: rema (clip/posa `row`) con la fase `phase` (rad) invece di stare fermo. */
  setRowing(on: boolean, phase?: number): void;
  /** Avatar remoto: posa dal messaggio di rete, senza sim. `anim` accetta la stringa del protocollo. */
  setPose(p: { x: number; z: number; yaw: number; anim: string }): void;
  /** Quota del terreno (es. `island.groundY`); senza, si deduce dal tipo di cella. */
  setGround(fn: ((x: number, z: number) => number) | null): void;
  readonly attached: boolean;
  readonly usesModel: boolean;
  /** Armatura o veste sul corpo e arma sulla schiena (#190); `undefined` = niente. `schiena` falso = l'arma è in mano (dungeon): resta solo la faretra.
   *  'partenza' = l'equipaggiamento di un personaggio nuovo (il lotto non ha ancora un personaggio salvato). Si vede solo col modello glTF (il segnaposto a box non si veste). L'equipaggiamento si carica a richiesta, senza bloccare. */
  setIndossa(i: Indossa | 'partenza' | undefined, o?: { schiena?: boolean }): void;
  /** Materiali dell'equipaggiamento già caricato (per il lampo quando l'eroe è colpito). */
  indossaMats(): THREE.MeshLambertMaterial[];
  /** Cosa si vede adesso (per i test); null se niente è ancora vestito. */
  indossaStato(): { corpo: string | null; arma: string | null; faretra: boolean; tri: number } | null;
};

const HIP_H = 0.82, SIT_HIP = 0.42, SEAT_DROP = 0.37; // altezza del bacino in piedi / seduto; bacino → seduta
const HEAD_C = 0.655; // centro della testa rispetto al bacino
const CLIP_SPEED = { walk: BALANCE.avatar.camminata, run: BALANCE.avatar.corsa };
const TILE_TOP: Record<string, number> = { '.': 0.38, P: 0.38, g: 0.58, L: 0.58, d: 0.48, r: 1.58 };

// ---------- geometrie a colori di vertice (un materiale, pochi draw call) ----------
export type Box = { s: [number, number, number]; at: [number, number, number]; c: string; rx?: number; pivot?: [number, number, number] };
export function mergeBoxes(boxes: Box[]): THREE.BufferGeometry {
  const gs = boxes.map((b) => {
    const g = new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]); g.deleteAttribute('uv'); g.translate(b.at[0], b.at[1], b.at[2]);
    if (b.rx) { const p = b.pivot ?? b.at; g.translate(-p[0], -p[1], -p[2]); g.rotateX(b.rx); g.translate(p[0], p[1], p[2]); }
    const col = new THREE.Color(b.c), n = g.getAttribute('position').count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const m = mergeGeometries(gs, false); for (const g of gs) g.dispose();
  if (!m) throw new Error('mergeBoxes fallito');
  return m;
}
let sharedMat: THREE.MeshLambertMaterial | null = null;
export const vertexMat = (): THREE.MeshLambertMaterial => (sharedMat ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

const PANTS = '#4A4340', SHOES = '#23201F', BELT = '#5A3A1E', EYE = '#23201F';
// capelli: box [w,h,d, x,y,z] rispetto al centro della testa (testa 0,20 × 0,25 × 0,22)
const HAIR: number[][][] = [
  /* 0 corti     */ [[0.22, 0.08, 0.24, 0, 0.125, 0], [0.22, 0.2, 0.05, 0, 0.03, 0.115], [0.02, 0.12, 0.2, -0.11, 0.06, 0.01], [0.02, 0.12, 0.2, 0.11, 0.06, 0.01]],
  /* 1 spettinati*/ [[0.22, 0.08, 0.24, 0, 0.125, 0], [0.22, 0.2, 0.05, 0, 0.03, 0.115], [0.06, 0.08, 0.06, -0.07, 0.19, -0.04], [0.06, 0.1, 0.06, 0.05, 0.2, 0.02], [0.05, 0.07, 0.05, 0, 0.19, 0.09]],
  /* 2 coda      */ [[0.22, 0.08, 0.24, 0, 0.125, 0], [0.22, 0.2, 0.05, 0, 0.03, 0.115], [0.06, 0.24, 0.06, 0, -0.07, 0.17], [0.07, 0.03, 0.07, 0, 0.05, 0.15]],
  /* 3 caschetto */ [[0.23, 0.08, 0.25, 0, 0.125, 0], [0.24, 0.3, 0.06, 0, -0.02, 0.115], [0.03, 0.22, 0.22, -0.115, -0.01, 0], [0.03, 0.22, 0.22, 0.115, -0.01, 0], [0.22, 0.05, 0.03, 0, 0.09, -0.115]],
  /* 4 rasati    */ [[0.21, 0.04, 0.23, 0, 0.135, 0]],
  /* 5 ricci     */ [[0.29, 0.13, 0.29, 0, 0.14, 0.01], [0.07, 0.1, 0.11, -0.13, 0.06, 0.04], [0.07, 0.1, 0.11, 0.13, 0.06, 0.04], [0.26, 0.14, 0.06, 0, 0.05, 0.13]],
  /* 6 lunghi    */ [[0.23, 0.08, 0.25, 0, 0.125, 0], [0.24, 0.44, 0.06, 0, -0.1, 0.115], [0.03, 0.22, 0.1, -0.115, 0.0, 0.06], [0.03, 0.22, 0.1, 0.115, 0.0, 0.06]],
  /* 7 chignon   */ [[0.22, 0.08, 0.24, 0, 0.125, 0], [0.22, 0.2, 0.05, 0, 0.03, 0.115], [0.09, 0.09, 0.09, 0, 0.2, 0.05]],
];
// cappelli per id (avatar.json): [w,h,d, x,y,z, colore]
const HATS: Record<string, (string | number)[][]> = {
  paglia: [[0.44, 0.02, 0.44, 0, 0.13, 0, '#E2B97F'], [0.23, 0.1, 0.25, 0, 0.19, 0, '#E2B97F'], [0.235, 0.025, 0.255, 0, 0.16, 0, '#E8433F']],
  berretto: [[0.23, 0.09, 0.25, 0, 0.17, 0, '#2478A8'], [0.19, 0.015, 0.11, 0, 0.13, -0.17, '#2478A8']],
  pescatore: [[0.24, 0.1, 0.26, 0, 0.18, 0, '#B9AFA3'], [0.34, 0.015, 0.34, 0, 0.13, 0, '#B9AFA3']],
  lanterna: [[0.05, 0.1, 0.05, 0, 0.18, 0, '#5A3A1E'], [0.13, 0.15, 0.13, 0, 0.3, 0, '#E8433F'], [0.09, 0.09, 0.09, 0, 0.3, 0, '#FFB03D']],
  neon: [[0.23, 0.03, 0.24, 0, 0.11, 0, '#8A5CFF'], [0.22, 0.06, 0.04, 0, 0.07, -0.135, '#FF3DA6']],
  // esclusivi del Mercante (#63): niente nodo in chr_base, li monta loadModel sull'osso della testa (hatOnHead)
  kasa: [[0.5, 0.025, 0.5, 0, 0.13, 0, '#E2B97F'], [0.38, 0.04, 0.38, 0, 0.16, 0, '#E2B97F'], [0.26, 0.045, 0.26, 0, 0.2, 0, '#C98A4B'], [0.14, 0.04, 0.14, 0, 0.24, 0, '#E2B97F'], [0.05, 0.03, 0.05, 0, 0.275, 0, '#8E5A2B']],
  capitano: [[0.25, 0.09, 0.27, 0, 0.17, 0, '#E8E1D6'], [0.29, 0.035, 0.31, 0, 0.225, 0, '#E8E1D6'], [0.255, 0.025, 0.275, 0, 0.14, 0, '#23201F'], [0.2, 0.015, 0.1, 0, 0.13, -0.17, '#23201F'], [0.06, 0.04, 0.012, 0, 0.17, -0.137, '#F5D547']],
  pirata: [[0.25, 0.1, 0.26, 0, 0.17, 0, '#23201F'], [0.42, 0.08, 0.07, 0, 0.2, -0.13, '#23201F'], [0.07, 0.08, 0.34, -0.17, 0.2, 0.03, '#23201F'], [0.07, 0.08, 0.34, 0.17, 0.2, 0.03, '#23201F'], [0.06, 0.06, 0.012, 0, 0.2, -0.168, '#E8E1D6'], [0.43, 0.012, 0.075, 0, 0.245, -0.13, '#F5D547']],
  polpo: [[0.24, 0.17, 0.24, 0, 0.22, 0, '#E8433F'], [0.2, 0.06, 0.2, 0, 0.32, 0, '#E8433F'], [0.04, 0.045, 0.012, -0.055, 0.22, -0.124, '#F4E3C1'], [0.04, 0.045, 0.012, 0.055, 0.22, -0.124, '#F4E3C1'], [0.02, 0.025, 0.012, -0.05, 0.215, -0.131, '#23201F'], [0.02, 0.025, 0.012, 0.06, 0.215, -0.131, '#23201F'],
    [0.045, 0.16, 0.045, -0.13, 0.1, -0.09, '#E8433F'], [0.045, 0.16, 0.045, 0.13, 0.1, -0.09, '#E8433F'], [0.045, 0.18, 0.045, -0.13, 0.09, 0.1, '#E8433F'], [0.045, 0.18, 0.045, 0.13, 0.09, 0.1, '#E8433F'], [0.045, 0.2, 0.045, 0, 0.08, 0.135, '#E8433F']],
  corona: [[0.24, 0.06, 0.02, 0, 0.16, -0.12, '#F5D547'], [0.24, 0.06, 0.02, 0, 0.16, 0.12, '#F5D547'], [0.02, 0.06, 0.24, -0.11, 0.16, 0, '#F5D547'], [0.02, 0.06, 0.24, 0.11, 0.16, 0, '#F5D547'],
    [0.04, 0.06, 0.02, -0.08, 0.215, -0.12, '#F5D547'], [0.04, 0.08, 0.02, 0, 0.225, -0.12, '#F5D547'], [0.04, 0.06, 0.02, 0.08, 0.215, -0.12, '#F5D547'], [0.04, 0.06, 0.02, 0, 0.215, 0.12, '#F5D547'],
    [0.04, 0.04, 0.04, 0, 0.275, -0.12, '#E8E1D6'], [0.035, 0.035, 0.035, -0.08, 0.255, -0.12, '#E8E1D6'], [0.035, 0.035, 0.035, 0.08, 0.255, -0.12, '#E8E1D6']],
  palombaro: [[0.32, 0.34, 0.32, 0, 0.03, 0, '#F2A33A'], [0.2, 0.06, 0.2, 0, 0.225, 0, '#F2A33A'], [0.17, 0.15, 0.012, 0, 0.02, -0.164, '#7FE3E0'], [0.2, 0.025, 0.02, 0, 0.105, -0.165, '#C98A4B'], [0.2, 0.025, 0.02, 0, -0.065, -0.165, '#C98A4B'],
    [0.025, 0.12, 0.12, -0.17, 0.03, 0, '#7FE3E0'], [0.025, 0.12, 0.12, 0.17, 0.03, 0, '#7FE3E0'], [0.36, 0.05, 0.36, 0, -0.16, 0, '#C98A4B']],
  // Isola dell'Adrenalina (docs/ADRENALINA.md §2): casco arancione con la striscia bianca e la visiera scura, si compra a Perle dall'editor
  casco: [[0.25, 0.1, 0.27, 0, 0.17, 0, '#F2A33A'], [0.19, 0.05, 0.21, 0, 0.24, 0, '#F2A33A'], [0.04, 0.15, 0.28, 0, 0.19, 0, '#E8E1D6'], [0.23, 0.04, 0.03, 0, 0.13, -0.14, '#23201F'], [0.26, 0.07, 0.14, 0, 0.1, 0.05, '#F2A33A']],
};
/** Cappelli senza nodo nel modello: si costruiscono a box e si appendono all'osso della testa (centro testa = origine, come headBoxes). */
function hatOnHead(id: string): THREE.Mesh | null {
  const h = HATS[id];
  if (!h) return null;
  const m = new THREE.Mesh(mergeBoxes(h.map((b) => ({ s: [b[0] as number, b[1] as number, b[2] as number], at: [b[3] as number, b[4] as number, b[5] as number], c: b[6] as string }))), vertexMat());
  m.name = 'extra_cappello_' + id; // non «cappello_…»: quelli li accende e spegne setLook per nome
  m.castShadow = true; m.frustumCulled = false; m.visible = false;
  return m;
}

function lookColors(look: Look) {
  const hat = AVATAR.cappelli[look.cappello]?.id ?? 'nessuno';
  return { skin: AVATAR.pelle[look.pelle] ?? '#D9A070', hair: AVATAR.coloriCapelli[look.coloreCapelli] ?? '#5A3A1E', shirt: AVATAR.vestiti[look.vestito] ?? '#3FB9C9', hat, style: Math.max(0, Math.min(HAIR.length - 1, look.capelli | 0)), darkSkin: look.pelle >= 4 };
}
function headBoxes(look: Look): Box[] {
  const k = lookColors(look), hc = HEAD_C, out: Box[] = [];
  out.push({ s: [0.07, 0.07, 0.07], at: [0, 0.515, 0], c: k.skin });
  out.push({ s: [0.2, 0.25, 0.22], at: [0, hc, 0], c: k.skin });
  out.push({ s: [0.04, 0.05, 0.03], at: [0, hc - 0.02, -0.125], c: k.skin });
  for (const sx of [-1, 1]) {
    out.push({ s: [0.03, 0.06, 0.04], at: [sx * 0.115, hc, 0], c: k.skin });
    out.push({ s: [0.036, 0.042, 0.012], at: [sx * 0.05, hc + 0.02, -0.114], c: EYE });
    out.push({ s: [0.056, 0.014, 0.012], at: [sx * 0.05, hc + 0.058, -0.114], c: k.hair });
  }
  out.push({ s: [0.07, 0.014, 0.012], at: [0, hc - 0.07, -0.114], c: k.darkSkin ? '#B8784C' : '#8C5636' });
  for (const h of HAIR[k.style] ?? []) out.push({ s: [h[0]!, h[1]!, h[2]!], at: [h[3]!, hc + h[4]!, h[5]!], c: k.hair });
  for (const h of HATS[k.hat] ?? []) out.push({ s: [h[0] as number, h[1] as number, h[2] as number], at: [h[3] as number, hc + (h[4] as number), h[5] as number], c: h[6] as string });
  return out;
}
function upperGeometry(look: Look): THREE.BufferGeometry {
  const { shirt } = lookColors(look);
  return mergeBoxes([
    { s: [0.3, 0.16, 0.2], at: [0, 0.03, 0], c: PANTS }, { s: [0.31, 0.03, 0.205], at: [0, 0.115, 0], c: BELT },
    { s: [0.34, 0.36, 0.19], at: [0, 0.3, 0], c: shirt }, { s: [0.4, 0.09, 0.2], at: [0, 0.435, 0], c: shirt },
    ...headBoxes(look),
  ]);
}
function armGeometry(look: Look): THREE.BufferGeometry {
  const { shirt, skin } = lookColors(look), elbow: [number, number, number] = [0, -0.28, 0];
  return mergeBoxes([
    { s: [0.095, 0.28, 0.1], at: [0, -0.14, 0], c: shirt },
    { s: [0.08, 0.25, 0.085], at: [0, -0.405, 0], c: skin, rx: 0.3, pivot: elbow },
    { s: [0.075, 0.09, 0.08], at: [0, -0.575, 0], c: skin, rx: 0.3, pivot: elbow },
  ]);
}
const thighGeometry = () => mergeBoxes([{ s: [0.14, 0.4, 0.15], at: [0, -0.2, 0], c: PANTS }]);
const shinGeometry = () => mergeBoxes([{ s: [0.11, 0.36, 0.12], at: [0, -0.18, 0], c: PANTS }, { s: [0.115, 0.06, 0.26], at: [0, -0.39, -0.05], c: SHOES }]);

type Rig = { root: THREE.Group; hips: THREE.Group; upper: THREE.Group; armL: THREE.Group; armR: THREE.Group; thighL: THREE.Group; thighR: THREE.Group; shinL: THREE.Group; shinR: THREE.Group; setLook(look: Look): void; dispose(): void };
function buildRig(look: Look): Rig {
  const mat = vertexMat(), root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = HIP_H; root.add(hips);
  const part = (parent: THREE.Object3D, at: [number, number, number], geo: THREE.BufferGeometry) => {
    const g = new THREE.Group(); g.position.set(...at); parent.add(g);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return { g, m };
  };
  const upperP = part(hips, [0, 0, 0], upperGeometry(look));
  const armLp = part(upperP.g, [-0.245, 0.44, 0], armGeometry(look)), armRp = part(upperP.g, [0.245, 0.44, 0], armGeometry(look));
  const tl = part(hips, [-0.085, 0, 0], thighGeometry()), tr = part(hips, [0.085, 0, 0], thighGeometry());
  const sl = part(tl.g, [0, -0.4, 0], shinGeometry()), sr = part(tr.g, [0, -0.4, 0], shinGeometry());
  return {
    root, hips, upper: upperP.g, armL: armLp.g, armR: armRp.g, thighL: tl.g, thighR: tr.g, shinL: sl.g, shinR: sr.g,
    setLook(l) { upperP.m.geometry.dispose(); upperP.m.geometry = upperGeometry(l); for (const a of [armLp, armRp]) { a.m.geometry.dispose(); a.m.geometry = armGeometry(l); } },
    dispose() { root.traverse((n) => { if ((n as THREE.Mesh).isMesh) (n as THREE.Mesh).geometry.dispose(); }); },
  };
}

// ---------- modello glTF ----------
type ModelRig = { root: THREE.Object3D; anim: Animator; setLook(look: Look): void; rest: Map<string, THREE.Matrix4> };
/** Il loader clona con Object3D.clone: gli SkinnedMesh restano legati alle ossa dell'originale. Le ricolleghiamo per nome (idempotente). */
function rebindSkins(root: THREE.Object3D): void {
  root.traverse((n) => {
    const sm = n as THREE.SkinnedMesh; if (!sm.isSkinnedMesh) return;
    const bones = sm.skeleton.bones.map((b) => root.getObjectByName(b.name) ?? b) as THREE.Bone[];
    sm.bind(new THREE.Skeleton(bones, sm.skeleton.boneInverses), sm.bindMatrix);
  });
}
async function loadModel(loader: Loader): Promise<ModelRig> {
  const { scene, clips } = await loader.load('chr_base');
  rebindSkins(scene);
  // il corpo a riposo (prima che parta una clip): l'equipaggiamento (rpg/vestito.ts) ci misura i pezzi sulle ossa
  scene.updateMatrixWorld(true);
  const rest = new Map<string, THREE.Matrix4>();
  scene.traverse((n) => { if ((n as THREE.Bone).isBone) rest.set(n.name, n.matrixWorld.clone()); });
  const groups: Record<'pelle' | 'capelli' | 'vestito' | 'cappello', THREE.MeshLambertMaterial[]> = { pelle: [], capelli: [], vestito: [], cappello: [] };
  const conv = (old: THREE.Material): THREE.Material => {
    const o = old as THREE.MeshStandardMaterial;
    const m = new THREE.MeshLambertMaterial({ name: o.name, color: o.color ? o.color.clone() : 0xffffff, map: o.map ?? null, vertexColors: o.vertexColors, flatShading: true, transparent: o.transparent, alphaTest: o.alphaTest, side: o.side });
    const key = /^mat_(pelle|capelli|vestito|cappello)/.exec(o.name)?.[1] as keyof typeof groups | undefined;
    if (key) groups[key].push(m);
    return m;
  };
  scene.traverse((n) => {
    const m = n as THREE.Mesh; if (!m.isMesh) return;
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    m.castShadow = true; m.frustumCulled = false;
  });
  // cappelli esclusivi (#63): il modello ha solo i 5 di partenza; gli altri a box sull'osso della testa, misurati sul cappello da pescatore
  // (tesa larga 0,34 m, cima 0,23 m sopra il centro della testa in headBoxes) così stanno alla stessa altezza e scala dei cappelli veri
  const extra = new Map<string, THREE.Mesh>();
  const head = scene.getObjectByName('Head'), ref = scene.getObjectByName('cappello_pescatore') as THREE.Mesh | undefined;
  if (head && ref?.geometry) {
    scene.updateMatrixWorld(true);
    // il glb è quantizzato: le posizioni sono normalizzate e la scala vera sta nelle matrici delle ossa → si passa dallo skinning a riposo
    const pos = ref.geometry.getAttribute('position') as THREE.BufferAttribute, sk = ref as THREE.SkinnedMesh, q = new THREE.Vector3(), bb = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) { q.fromBufferAttribute(pos, i); if (sk.isSkinnedMesh) sk.applyBoneTransform(i, q); bb.expandByPoint(q.applyMatrix4(ref.matrixWorld)); }
    const k = (bb.max.x - bb.min.x) / 0.34, c = bb.getCenter(new THREE.Vector3());
    for (const h of AVATAR.cappelli) {
      if (scene.getObjectByName('cappello_' + h.id)) continue;
      const m = hatOnHead(h.id); if (!m) continue;
      m.position.set(c.x, bb.max.y - 0.23 * k, c.z); m.scale.setScalar(k); m.updateMatrixWorld(true);
      head.attach(m); extra.set(h.id, m);
    }
  }
  const setLook = (look: Look) => {
    const k = lookColors(look);
    for (const [id, m] of extra) m.visible = id === k.hat;
    for (const m of groups.pelle) m.color.set(k.skin);
    for (const m of groups.capelli) m.color.set(k.hair);
    for (const m of groups.vestito) m.color.set(k.shirt);
    for (const m of groups.cappello) m.color.set(({ paglia: '#E2B97F', berretto: '#2478A8', pescatore: '#B9AFA3', lanterna: '#E8433F', neon: '#FF3DA6' } as Record<string, string>)[k.hat] ?? '#E2B97F');
    scene.traverse((n) => {
      if (n.name.startsWith('capelli_')) n.visible = n.name === `capelli_${look.capelli}`;
      if (n.name.startsWith('cappello_')) n.visible = n.name === `cappello_${k.hat}`;
    });
  };
  return { root: scene, anim: createAnimator(scene, clips), setLook, rest };
}

/** Dove guarda davvero l'oggetto in assi mondo [x, z] (per i test). */
export const facing = (o: THREE.Object3D): [number, number] => { const v = new THREE.Vector3(0, 0, -1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); return [v.x, v.z]; };
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
let registered = false;

export async function createAvatar(o: { loader: Loader; look: Look; x: number; z: number }): Promise<Avatar> {
  const object = new THREE.Group(); object.name = 'avatar';
  let look = o.look, model: ModelRig | null = null, rig: Rig | null = null;
  if (o.loader.has('chr_base')) { try { model = await loadModel(o.loader); } catch (e) { console.warn('[marea] chr_base non caricabile, uso il segnaposto', e); } }
  if (model) object.add(model.root); else { rig = buildRig(look); object.add(rig.root); }
  const body = model ? model.root : rig!.root, bodyY = body.position.y, bodyYaw = body.rotation.y; // il gesto muove il corpo, non `object` (lo posa update)

  let state = newAvatar(o.x, o.z), prev = state;
  let home: THREE.Object3D | null = null, attached = false, rowing = false, rowPh = 0;
  let groundFn: ((x: number, z: number) => number) | null = null, lastMap: GridMap | null = null;
  let gy = 0.4, snap = true, viewYaw = 0, shown = 'idle', heldFor = 1;
  let ticks = 0, phase = 0, tAcc = 0, mv = 0, runB = 0, sitB = 0, rowB = 0;
  const seatPos = new THREE.Vector3();
  const ground = (x: number, z: number): number => {
    if (groundFn) return groundFn(x, z);
    if (!lastMap) return 0.38;
    const c = lastMap.worldToCell(x, z);
    return TILE_TOP[lastMap.at(c.cx, c.cz)] ?? 0.38;
  };
  const applyLook = (l: Look) => { look = l; if (model) model.setLook(l); else rig?.setLook(l); };
  applyLook(look);
  // equipaggiamento (#190): il modulo si importa solo quando c'è qualcosa da vestire (porta con sé il catalogo del GDR)
  let vestito: Promise<import('../rpg/vestito.ts').Vestito> | null = null, vestitoOra: import('../rpg/vestito.ts').Vestito | null = null, indossa: Indossa | 'partenza' | undefined;
  const vuoto = (i: Indossa | 'partenza' | undefined) => !i || (i !== 'partenza' && !(i.corpo || i.arma || i.frecce));

  function poseRig(dt: number, speed: number, want: string): void {
    const r = rig!, sit = want === 'sit' || want === 'row';
    const moving = want === 'walk' || want === 'run';
    mv = lerp(mv, moving ? 1 : 0, ease(dt, 12)); runB = lerp(runB, want === 'run' ? 1 : 0, ease(dt, 10));
    sitB = lerp(sitB, sit ? 1 : 0, ease(dt, 9)); rowB = lerp(rowB, want === 'row' ? 1 : 0, ease(dt, 9));
    tAcc += dt; phase += (dt * speed * Math.PI * 2) / lerp(1.9, 2.15, runB);
    const amp = mv * (1 - sitB), A = lerp(0.55, 0.85, runB) * amp, K = lerp(0.6, 1.25, runB) * amp;
    const sL = Math.sin(phase), sR = -sL;
    const cL = Math.max(0, Math.cos(phase)), cR = Math.max(0, -Math.cos(phase));
    const breath = Math.sin(tAcc * 2.4) * (1 - mv) * (1 - sitB);
    // gambe: cosce (positivo = in avanti, verso −Z) e ginocchia (negativo = piega indietro)
    r.thighL.rotation.x = A * sL * (1 - sitB) + 1.5 * sitB; r.thighR.rotation.x = A * sR * (1 - sitB) + 1.5 * sitB;
    r.shinL.rotation.x = -(0.08 * amp + K * cL) * (1 - sitB) - 1.5 * sitB; r.shinR.rotation.x = -(0.08 * amp + K * cR) * (1 - sitB) - 1.5 * sitB;
    r.thighL.rotation.z = -0.03 * sitB; r.thighR.rotation.z = 0.03 * sitB;
    // braccia: opposte alle gambe; da seduto sulle ginocchia, remando avanti-indietro
    const swing = 0.85 * A, rowArm = 0.6 + 0.5 * Math.cos(rowPh);
    r.armL.rotation.x = -sL * swing * (1 - sitB) + 0.03 * breath + sitB * lerp(0.55, rowArm, rowB);
    r.armR.rotation.x = -sR * swing * (1 - sitB) - 0.03 * breath + sitB * lerp(0.55, rowArm, rowB);
    r.armL.rotation.z = -0.07 * (1 - runB * 0.7) - 0.05 * breath; r.armR.rotation.z = 0.07 * (1 - runB * 0.7) + 0.05 * breath;
    // busto: inclinazione in corsa, torsione, respiro, colpo di remo
    r.upper.rotation.x = -(0.04 + 0.13 * runB) * amp - 0.15 * rowB * Math.cos(rowPh);
    r.upper.rotation.y = 0.14 * Math.sin(phase) * amp;
    r.upper.scale.y = 1 + 0.014 * breath;
    // bacino: rimbalzo (due passi per ciclo) e discesa da seduto
    const bob = amp * lerp(0.022, 0.05, runB) * Math.cos(2 * phase);
    r.hips.position.y = lerp(HIP_H, SIT_HIP, sitB) + bob - 0.012 * (1 - mv) * (1 - sitB) * (0.5 - 0.5 * breath);
  }

  const api: Avatar = {
    object, get state() { return state; }, get prev() { return prev; }, visible: true,
    get attached() { return attached; }, get usesModel() { return !!model; },
    step(input, map) { ticks++; lastMap = map; prev = state; state = stepAvatar(state, input, map); },
    update(alpha, dt) {
      object.visible = api.visible;
      const seated = attached;
      if (!seated) {
        const x = prev.x + (state.x - prev.x) * alpha, z = prev.z + (state.z - prev.z) * alpha, gt = ground(x, z);
        if (snap) { gy = gt; viewYaw = state.yaw; snap = false; } else { gy = lerp(gy, gt, ease(dt, 14)); viewYaw += wrapPi(state.yaw - viewYaw) * ease(dt, 16); }
        object.position.set(x, gy, z); object.rotation.y = -viewYaw; // la sim usa avanti = (sin yaw, −cos yaw): three ruota al contrario
      }
      // animazione voluta, con un minimo di permanenza per non sfarfallare tra walk e run intorno alla soglia
      const want = seated ? (rowing ? 'row' : 'sit') : state.anim;
      heldFor += dt;
      if (want !== shown && (heldFor > 0.1 || seated !== (shown === 'sit' || shown === 'row'))) { shown = want; heldFor = 0; }
      const speed = seated ? 0 : Math.hypot(state.vx, state.vz);
      if (model) {
        const a = model.anim;
        if (!a.play(shown, 0.15)) a.play('idle', 0.15);
        a.setSpeed(shown === 'walk' ? speed / CLIP_SPEED.walk : shown === 'run' ? speed / CLIP_SPEED.run : shown === 'row' ? 0.6 + 0.4 * Math.abs(Math.cos(rowPh * 0.5)) : 1);
        a.update(dt);
      } else poseRig(dt, speed, shown);
    },
    teleport(x, z) { state = { ...state, x, z, vx: 0, vz: 0 }; prev = state; snap = true; },
    setLook: applyLook,
    setIndossa(i, opt) {
      if (!model) return;
      indossa = vuoto(i) ? undefined : i;
      if (!indossa && !vestito) return; // niente da togliere
      const schiena = opt?.schiena !== false, fatto = indossa;
      // in superficie si carica a tempo perso (porta con sé i dati del GDR: qualche decina di KB gzip), nel dungeon subito
      vestito ??= new Promise<void>((r) => (!schiena || typeof requestIdleCallback !== 'function' ? setTimeout(r, schiena ? 500 : 0) : requestIdleCallback(() => r(), { timeout: 3000 })))
        .then(() => import('../rpg/vestito.ts')).then((m) => (vestitoOra = m.creaVestito({ loader: o.loader, root: model!.root, rest: model!.rest })));
      void vestito.then((v) => v.set(fatto, schiena)).catch((e) => console.warn('[marea] equipaggiamento non vestito', e));
    },
    indossaMats: () => vestitoOra?.materiali() ?? [],
    indossaStato: () => vestitoOra?.stato() ?? null,
    gesto(hop, spin) { body.position.y = bodyY + hop; body.rotation.y = bodyYaw + spin; },
    setGround(fn) { groundFn = fn; snap = true; },
    attachTo(parent, seat = { x: 0, y: SEAT_DROP, z: 0 }, yaw = 0) {
      if (parent) {
        if (!attached) home = object.parent;
        seatPos.set(seat.x, seat.y - SEAT_DROP, seat.z);
        parent.add(object); object.position.copy(seatPos); object.rotation.set(0, -yaw, 0); attached = true;
      } else if (attached) {
        attached = false; rowing = false; if (home) home.add(object); snap = true;
      }
    },
    setRowing(on, phase = 0) { rowing = on; rowPh = phase; },
    setPose(p) {
      const a = (['idle', 'walk', 'run', 'sit'] as const).find((k) => k === p.anim) ?? 'idle';
      const s = a === 'walk' ? CLIP_SPEED.walk : a === 'run' ? CLIP_SPEED.run : 0;
      prev = state; state = { x: p.x, z: p.z, yaw: p.yaw, vx: Math.sin(p.yaw) * s, vz: -Math.cos(p.yaw) * s, anim: a };
    },
  };
  if (!registered) {
    registered = true;
    registerStateProvider('wp2_avatar', () => ({ ticks, facing: facing(object), model: !!model, shown, clip: model?.anim.current ?? null, attached, y: object.position.y, mv, runB, sitB, rowB, look, indossa: indossa ?? null, vestito: api.indossaStato() }));
  }
  return api;
}
