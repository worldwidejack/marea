// Zombie dei Templari (docs/TEMPLARI.md §8): manichini low-poly a parti (testa, busto, falda, braccia, gambe) disegnati con UN InstancedMesh
// per parte e per «kit»: templari (fanti e scudati: sopravveste bianca con la croce rossa, maglia di ferro), pirati (camicia a righe,
// bandana, tricorno; il cannoniere col cappellaccio e la bomba in mano), de Molay (grande, bruciato, mantello del Gran Maestro e fiamme
// addosso). Le parti in più (elmo e scudo dello scudato, cappelli, bomba, fiamme) hanno il loro InstancedMesh; il Templare a cavallo usa il
// kit dei templari per il cavaliere più il cavallo con la gualdrappa. Le mesh vuote non si disegnano: draw call solo per chi c'è.
// Pose a mano dalla vista della sim: barcollano con le braccia tese (corrono chini), strappano le assi, si preparano (lampeggiano rossi),
// colpiscono, lanciano, escono da terra, cadono all'indietro; il cavallo cammina, si impenna e galoppa; de Molay scappa ridendo.
import * as THREE from 'three';
import type { TView } from '@marea/sim/templari/types.ts';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

type ZV = TView['zombie'][number];
const MAX = 32;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const pri = (r0: number, r1: number, h: number, s = 5) => new THREE.CylinderGeometry(r0, r1, h, s);
const PELLE = PAL.pietra, CHIAZZA = PAL.erbaScura, MAGLIA = PAL.pietraScura, TELA = PAL.sabbiaChiara, CROCE = PAL.rosso;

type Kit = Record<'testa' | 'busto' | 'falda' | 'braccio' | 'avambraccio' | 'coscia' | 'stinco', THREE.BufferGeometry>;
function kitBase(o: { pelle: string; cappuccio: string | null; busto: THREE.BufferGeometry[]; falda: THREE.BufferGeometry[]; manica: string; gamba: string; scarpa: string }): Kit {
  const testa = merged([
    painted(pri(0.13, 0.14, 0.27, 6), o.pelle, M(0, 0.15, 0)),
    painted(box(0.1, 0.06, 0.04), CHIAZZA, M(0.06, 0.2, -0.12)),
    painted(box(0.06, 0.05, 0.03), PAL.neroCaldo, M(-0.05, 0.17, -0.135)), // orbite vuote
    painted(box(0.06, 0.05, 0.03), PAL.neroCaldo, M(0.05, 0.17, -0.135)),
    painted(box(0.02, 0.02, 0.02), CROCE, M(-0.05, 0.17, -0.15)), // un lume rosso negli occhi
    painted(box(0.02, 0.02, 0.02), CROCE, M(0.05, 0.17, -0.15)),
    painted(box(0.12, 0.04, 0.03), PAL.neroCaldo, M(0, 0.06, -0.135)), // bocca aperta
    ...(o.cappuccio ? [painted(pri(0.165, 0.18, 0.2, 6), o.cappuccio, M(0, 0.24, 0.02, -0.12, 0, 0)), painted(pri(0.2, 0.16, 0.12, 6), o.cappuccio, M(0, 0.02, 0.01))] : []),
  ]);
  const braccio = merged([painted(pri(0.06, 0.05, 0.3, 5), o.manica, M(0, -0.15, 0))]);
  const avambraccio = merged([painted(pri(0.05, 0.045, 0.27, 5), o.manica, M(0, -0.13, 0)), painted(box(0.08, 0.1, 0.06), o.pelle, M(0, -0.31, 0))]);
  const coscia = merged([painted(pri(0.08, 0.065, 0.45, 5), o.gamba, M(0, -0.22, 0))]);
  const stinco = merged([painted(pri(0.065, 0.055, 0.42, 5), o.gamba, M(0, -0.2, 0)), painted(box(0.11, 0.08, 0.2), o.scarpa, M(0, -0.43, -0.04))]);
  return { testa, busto: merged(o.busto), falda: merged(o.falda), braccio, avambraccio, coscia, stinco };
}
const sopravveste = (base: string, croce: string, bruciata = false) => [
  painted(pri(0.2, 0.16, 0.58, 4), base, M(0, 0.29, 0, 0, Math.PI / 4, 0, 1.25, 1, 0.75)),
  painted(box(0.08, 0.36, 0.03), croce, M(0, 0.33, -0.15)), painted(box(0.26, 0.08, 0.03), croce, M(0, 0.4, -0.15)), // croce patente sul petto
  painted(box(0.08, 0.36, 0.03), croce, M(0, 0.33, 0.15)), painted(box(0.26, 0.08, 0.03), croce, M(0, 0.4, 0.15)), // e sulla schiena
  painted(box(0.12, 0.1, 0.03), bruciata ? PAL.neroCaldo : PAL.legnoScuro, M(0.1, 0.12, -0.155)), // strappi e sangue secco
  painted(box(0.5, 0.12, 0.28), MAGLIA, M(0, 0.56, 0)), // spalle di maglia
  painted(box(0.44, 0.06, 0.26), PAL.legnoScuro, M(0, 0.02, 0)), // cintura
];
const KIT = {
  templare: () => kitBase({ pelle: PELLE, cappuccio: MAGLIA, busto: sopravveste(TELA, CROCE), falda: [painted(pri(0.2, 0.24, 0.42, 4), TELA, M(0, -0.21, 0, 0, Math.PI / 4, 0, 1.15, 1, 0.75)), painted(box(0.06, 0.3, 0.03), CROCE, M(0, -0.18, -0.13))], manica: MAGLIA, gamba: MAGLIA, scarpa: PAL.legnoScuro }),
  pirata: () => kitBase({
    pelle: PELLE, cappuccio: null,
    busto: [painted(pri(0.19, 0.16, 0.56, 4), TELA, M(0, 0.28, 0, 0, Math.PI / 4, 0, 1.2, 1, 0.72)), ...[0.12, 0.26, 0.4].map((y) => painted(box(0.36, 0.05, 0.27), PAL.acquaProfonda, M(0, y, 0))), painted(box(0.44, 0.07, 0.26), PAL.rosso, M(0, 0.03, 0)), painted(box(0.06, 0.06, 0.03), PAL.giallo, M(0, 0.03, -0.14))],
    falda: [painted(box(0.36, 0.2, 0.24), PAL.legnoScuro, M(0, -0.1, 0))], manica: TELA, gamba: PAL.legnoScuro, scarpa: PAL.neroCaldo,
  }),
  molay: () => kitBase({ pelle: PAL.ombraCalda, cappuccio: null, busto: sopravveste(TELA, CROCE, true), falda: [painted(pri(0.22, 0.3, 0.55, 4), TELA, M(0, -0.27, 0, 0, Math.PI / 4, 0, 1.15, 1, 0.8)), painted(pri(0.31, 0.31, 0.12, 4), PAL.neroCaldo, M(0, -0.52, 0, 0, Math.PI / 4, 0, 1.15, 1, 0.8)), painted(box(0.07, 0.4, 0.03), CROCE, M(0, -0.22, -0.14))], manica: PAL.neroCaldo, gamba: PAL.neroCaldo, scarpa: PAL.neroCaldo }),
};
type KitId = keyof typeof KIT;
const KIT_DI: Record<string, KitId> = { fante: 'templare', scudato: 'templare', cavaliere: 'templare', pirata: 'pirata', cannoniere: 'pirata', molay: 'molay' };
const SCALA: Record<string, number> = { molay: 1.3, cavaliere: 1.1 };
/** Parti in più: geometria, a quale osso, chi le ha. */
type Extra = { geo: () => THREE.BufferGeometry; osso: 'testa' | 'manoS' | 'manoD' | 'busto'; tipi: string[]; acceso?: boolean };
const EXTRA: Record<string, Extra> = {
  elmo: { osso: 'testa', tipi: ['scudato', 'cavaliere'], geo: () => merged([painted(pri(0.17, 0.17, 0.3, 8), MAGLIA, M(0, 0.17, 0)), painted(pri(0.18, 0.18, 0.04, 8), PAL.roccia, M(0, 0.32, 0)), painted(box(0.24, 0.025, 0.04), PAL.neroCaldo, M(0, 0.2, -0.16)), painted(box(0.03, 0.12, 0.04), CROCE, M(0, 0.1, -0.16))]) },
  scudo: { osso: 'manoS', tipi: ['scudato', 'cavaliere'], geo: () => merged([painted(pri(0.3, 0.06, 0.72, 6), TELA, M(0, -0.18, -0.12, Math.PI / 2, 0, 0, 1, 1, 0.15)), painted(box(0.06, 0.03, 0.5), CROCE, M(0, -0.2, -0.17)), painted(box(0.38, 0.03, 0.06), CROCE, M(0, -0.2, -0.05))]) },
  lancia: { osso: 'manoD', tipi: ['cavaliere'], geo: () => merged([painted(pri(0.03, 0.04, 3.0, 5), PAL.legno, M(0, -0.32, -1.1, Math.PI / 2, 0, 0)), painted(new THREE.ConeGeometry(0.06, 0.3, 4), PAL.pietraChiara, M(0, -0.32, -2.7, -Math.PI / 2, 0, 0)), painted(box(0.3, 0.2, 0.02), TELA, M(0, -0.2, -2.3))]) },
  tricorno: { osso: 'testa', tipi: ['pirata'], geo: () => merged([painted(pri(0.26, 0.26, 0.05, 3), PAL.neroCaldo, M(0, 0.3, 0, 0, Math.PI, 0)), painted(pri(0.13, 0.15, 0.13, 6), PAL.neroCaldo, M(0, 0.36, 0)), painted(box(0.05, 0.05, 0.02), PAL.pietraChiara, M(0, 0.36, -0.15)), painted(pri(0.15, 0.15, 0.05, 6), PAL.rosso, M(0, 0.25, 0))]) },
  cappello: { osso: 'testa', tipi: ['cannoniere'], geo: () => merged([painted(pri(0.34, 0.34, 0.04, 8), PAL.neroCaldo, M(0, 0.3, 0)), painted(pri(0.15, 0.17, 0.2, 6), PAL.neroCaldo, M(0, 0.4, 0)), painted(box(0.3, 0.04, 0.05), PAL.rosso, M(0.1, 0.34, 0.1, 0, 0.5, 0))]) },
  bomba: { osso: 'manoD', tipi: ['cannoniere'], geo: () => merged([painted(new THREE.IcosahedronGeometry(0.13, 0), PAL.neroCaldo, M(0, -0.4, 0)), painted(box(0.03, 0.08, 0.03), PAL.legnoChiaro, M(0, -0.25, 0))]) },
  fiamme: { osso: 'busto', tipi: ['molay'], acceso: true, geo: () => merged([...[[-0.24, 0.62, 0, 0.12, 0.42], [0.24, 0.62, 0, 0.12, 0.42], [0, 0.95, 0.05, 0.14, 0.5], [-0.12, 0.4, 0.17, 0.1, 0.32], [0.14, 0.2, -0.17, 0.09, 0.3]].map(([x, y, z, r, h]) => painted(new THREE.ConeGeometry(r!, h!, 4), PAL.arancio, M(x!, y! + h! / 2, z!))), painted(new THREE.ConeGeometry(0.08, 0.3, 4), PAL.giallo, M(0, 1.05, 0.05))]) },
};
const DOPPIE = new Set(['braccio', 'avambraccio', 'coscia', 'stinco']);

// ---- cavallo ----
function cavalloParti(): Record<string, THREE.BufferGeometry> {
  return {
    corpo: merged([
      painted(pri(0.34, 0.32, 1.6, 6), PAL.legnoScuro, M(0, 0, 0, Math.PI / 2, 0, 0, 1, 1, 1.1)),
      painted(box(0.82, 0.62, 1.5), TELA, M(0, -0.12, 0)), // gualdrappa bianca
      painted(box(0.84, 0.36, 0.1), CROCE, M(0, -0.08, -0.2)), painted(box(0.1, 0.5, 0.86), CROCE, M(0, -0.1, -0.2, 0, Math.PI / 2, 0)), // croce sul fianco
      painted(box(0.84, 0.36, 0.1), CROCE, M(0, -0.08, 0.3)),
      painted(box(0.5, 0.12, 0.6), PAL.legno, M(0, 0.36, 0.1)), // sella
      painted(pri(0.05, 0.02, 0.7, 4), PAL.neroCaldo, M(0, 0.05, 0.92, -0.8, 0, 0)), // coda
    ]),
    collo: merged([
      painted(pri(0.16, 0.22, 0.75, 5), PAL.legnoScuro, M(0, 0.3, 0, -0.5, 0, 0)),
      painted(box(0.24, 0.26, 0.55), PAL.legnoScuro, M(0, 0.62, -0.28, 0.35, 0, 0)), // testa
      painted(box(0.26, 0.2, 0.5), TELA, M(0, 0.64, -0.24, 0.35, 0, 0)), // testiera di stoffa
      painted(box(0.08, 0.05, 0.03), PAL.neroCaldo, M(-0.1, 0.72, -0.4)), painted(box(0.08, 0.05, 0.03), PAL.neroCaldo, M(0.1, 0.72, -0.4)),
      painted(box(0.04, 0.04, 0.02), CROCE, M(-0.1, 0.72, -0.42)), painted(box(0.04, 0.04, 0.02), CROCE, M(0.1, 0.72, -0.42)),
      painted(box(0.06, 0.4, 0.2), PAL.neroCaldo, M(0, 0.4, 0.1, -0.5, 0, 0)), // criniera
    ]),
    zampa: merged([painted(pri(0.08, 0.06, 0.75, 5), PAL.legnoScuro, M(0, -0.37, 0)), painted(box(0.13, 0.1, 0.16), PAL.neroCaldo, M(0, -0.78, -0.02))]),
  };
}
type Cav = { root: THREE.Object3D; corpo: THREE.Object3D; collo: THREE.Object3D; zampe: THREE.Object3D[] };
function cavalloRig(): Cav {
  const n = () => new THREE.Object3D(), root = n(), corpo = n(), collo = n(), zampe = [n(), n(), n(), n()];
  root.add(corpo); corpo.position.y = 1.15; corpo.add(collo); collo.position.set(0, 0.2, -0.75);
  [[-0.22, -0.6], [0.22, -0.6], [-0.22, 0.6], [0.22, 0.6]].forEach(([x, z], i) => { corpo.add(zampe[i]!); zampe[i]!.position.set(x!, -0.3, z!); });
  return { root, corpo, collo, zampe };
}

type Rig = { root: THREE.Object3D; anca: THREE.Object3D; busto: THREE.Object3D; testa: THREE.Object3D; spalla: THREE.Object3D[]; gomito: THREE.Object3D[]; coscia: THREE.Object3D[]; ginocchio: THREE.Object3D[] };
function rig(): Rig {
  const n = () => new THREE.Object3D();
  const root = n(), anca = n(), busto = n(), testa = n();
  root.add(anca); anca.position.y = 0.92; anca.add(busto); busto.add(testa); testa.position.y = 0.62;
  const spalla = [n(), n()], gomito = [n(), n()], coscia = [n(), n()], ginocchio = [n(), n()];
  for (let s = 0; s < 2; s++) {
    const x = s ? 0.27 : -0.27;
    busto.add(spalla[s]!); spalla[s]!.position.set(x, 0.55, 0); spalla[s]!.add(gomito[s]!); gomito[s]!.position.y = -0.3;
    anca.add(coscia[s]!); coscia[s]!.position.set(s ? 0.11 : -0.11, -0.02, 0); coscia[s]!.add(ginocchio[s]!); ginocchio[s]!.position.y = -0.45;
  }
  return { root, anca, busto, testa, spalla, gomito, coscia, ginocchio };
}

type Z = { id: number; rig: Rig; cav: Cav | null; px: number; pz: number; x: number; z: number; v: ZV; fase: number; flash: number; mortoT: number; yaw: number; tinta: THREE.Color };
export type Zombi = {
  tick(v: TView): void;
  update(alpha: number, dt: number, t: number): void;
  colpito(id: number): void;
  /** Posizione (interpolata) sopra la testa, per i numeri del danno. */
  posDi(id: number): THREE.Vector3 | null;
  counts(): { zombie: number; disegnati: number; mesh: number };
  dispose(): void;
};

const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;

export function createZombi(scene: THREE.Scene): Zombi {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), acceso = new THREE.MeshBasicMaterial({ vertexColors: true });
  const tutte: THREE.InstancedMesh[] = [];
  const im = (g: THREE.BufferGeometry, n: number, nome: string, m: THREE.Material = mat) => {
    const x = new THREE.InstancedMesh(g, m, n); x.name = nome; x.count = 0; x.visible = false; x.frustumCulled = false; scene.add(x); tutte.push(x); return x;
  };
  // mesh create alla prima comparsa del kit (chi non c'è non costa niente)
  const kits = new Map<KitId, Record<string, THREE.InstancedMesh>>();
  const kitMesh = (k: KitId) => {
    let r = kits.get(k);
    if (!r) { r = {}; for (const [p, g] of Object.entries(KIT[k]())) r[p] = im(g, MAX * (DOPPIE.has(p) ? 2 : 1), `zombie_${k}_${p}`); kits.set(k, r); }
    return r;
  };
  const extra = new Map<string, THREE.InstancedMesh>();
  const extraMesh = (e: string) => { let r = extra.get(e); if (!r) { const d = EXTRA[e]!; r = im(d.geo(), MAX, 'zombie_' + e, d.acceso ? acceso : mat); extra.set(e, r); } return r; };
  let cavM: Record<string, THREE.InstancedMesh> | null = null;
  const cavMesh = () => { if (!cavM) { const p = cavalloParti(); cavM = { corpo: im(p['corpo']!, 4, 'cavallo_corpo'), collo: im(p['collo']!, 4, 'cavallo_collo'), zampa: im(p['zampa']!, 16, 'cavallo_zampa') }; } return cavM; };
  const blobGeo = new THREE.CircleGeometry(0.45, 8); blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: PAL.neroCaldo, transparent: true, opacity: 0.45, depthWrite: false }), MAX);
  blobs.frustumCulled = false; blobs.renderOrder = 1; blobs.name = 'zombie_ombre'; scene.add(blobs);
  const luceMolay = new THREE.PointLight(PAL.arancio, 0, 9, 1.6); scene.add(luceMolay);
  const zs = new Map<number, Z>();
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  const BIANCO = new THREE.Color(2.2, 2.1, 1.9), ROSSO = new THREE.Color(1.8, 0.5, 0.45);

  function pose(z: Z, t: number, dt: number): void {
    const r = z.rig, v = z.v, k = v.t;
    for (const o of [r.anca, r.busto, r.testa, ...r.spalla, ...r.gomito, ...r.coscia, ...r.ginocchio]) o.rotation.set(0, 0, 0);
    r.anca.position.y = 0.92; r.root.position.y = 0; r.root.rotation.x = 0;
    const corsa = v.anim === 'corre' || v.anim === 'fugge';
    const passo = corsa ? 1.0 : 0.55, sw = Math.sin(z.fase);
    // di serie: braccia tese avanti (lo zombie), testa storta, chino quanto corre
    const tese = (alto: number) => { for (let s = 0; s < 2; s++) { r.spalla[s]!.rotation.x = alto + (s ? 0.12 : -0.12) * Math.sin(t * 2 + z.id); r.gomito[s]!.rotation.x = 0.25; r.spalla[s]!.rotation.z = s ? 0.12 : -0.12; } };
    r.testa.rotation.z = 0.25 * Math.sin(z.id * 1.7); r.testa.rotation.x = 0.15;
    if (z.cav) { posaCavaliere(z, t); return; }
    switch (v.anim) {
      case 'cammina': case 'corre': case 'fugge': {
        tese(corsa ? 1.15 : 1.4);
        r.busto.rotation.x = corsa ? -0.42 : -0.18;
        for (let s = 0; s < 2; s++) { const ph = s ? sw : -sw; r.coscia[s]!.rotation.x = ph * passo; r.ginocchio[s]!.rotation.x = -Math.max(0, -ph) * passo * 1.2; }
        r.anca.position.y = 0.92 - Math.abs(Math.cos(z.fase)) * 0.05;
        r.busto.rotation.z = 0.08 * Math.sin(z.fase); // barcolla
        if (v.anim === 'fugge') { r.testa.rotation.x = -0.5 + 0.2 * Math.sin(t * 18); for (let s = 0; s < 2; s++) r.spalla[s]!.rotation.z = (s ? 1 : -1) * 0.9; } // ride a testa indietro, braccia larghe
        break;
      }
      case 'strappa': { // tira le assi: braccia avanti e indietro a strattoni
        const p = Math.sin(t * 9 + z.id);
        for (let s = 0; s < 2; s++) { r.spalla[s]!.rotation.x = 1.3 + (s ? p : -p) * 0.45; r.gomito[s]!.rotation.x = 0.6 + (s ? -p : p) * 0.3; }
        r.busto.rotation.x = -0.25 + 0.1 * p;
        break;
      }
      case 'prepara': { // braccia su sopra la testa, si tira indietro a gradini
        const e = steps(k, 4);
        for (let s = 0; s < 2; s++) { r.spalla[s]!.rotation.x = 1.4 + 1.3 * e; r.gomito[s]!.rotation.x = 0.4 * e; }
        r.busto.rotation.x = 0.25 * e;
        break;
      }
      case 'lancia': { // il braccio destro carica il lancio dietro la testa
        const e = steps(k, 4);
        r.spalla[1]!.rotation.x = 2.6 * e; r.gomito[1]!.rotation.x = 1.0 * e; r.spalla[0]!.rotation.x = 1.0; r.busto.rotation.y = -0.5 * e; r.busto.rotation.x = 0.15 * e;
        break;
      }
      case 'colpisce': for (let s = 0; s < 2; s++) { r.spalla[s]!.rotation.x = 0.9; r.gomito[s]!.rotation.x = 0.1; } r.busto.rotation.x = -0.55; break;
      case 'recupera': tese(1.0 + 0.4 * k); r.busto.rotation.x = -0.4 * (1 - k); break;
      case 'sorge': { // esce da terra: prima le mani, poi tutto, a scatti
        const e = steps(k, 6);
        r.root.position.y = -1.85 * (1 - e);
        for (let s = 0; s < 2; s++) { r.spalla[s]!.rotation.x = 2.9 - 1.2 * e; r.gomito[s]!.rotation.x = 0.2; }
        r.busto.rotation.x = -0.3 * (1 - e) + 0.05 * Math.sin(t * 20 + z.id);
        break;
      }
      case 'morto': { // cade all'indietro (3 gradini), poi sprofonda
        z.mortoT += dt;
        const e = steps(z.mortoT / 0.3, 3);
        r.root.rotation.x = 1.45 * e;
        r.root.position.y = 0.12 * e - Math.max(0, z.mortoT - 0.7) * 0.9;
        tese(0.6);
        break;
      }
    }
    // lo scudato tiene lo scudo davanti al petto (avambraccio sinistro piegato)
    if (z.v.tipo === 'scudato' && v.anim !== 'morto' && v.anim !== 'sorge') { r.spalla[0]!.rotation.x = 0.9; r.gomito[0]!.rotation.x = 0.7; r.spalla[0]!.rotation.z = 0.5; }
  }
  /** Il Templare a cavallo: il cavallo cammina, si impenna (prepara), galoppa (carica); il cavaliere seduto con la lancia in resta. */
  function posaCavaliere(z: Z, t: number): void {
    const r = z.rig, cv = z.cav!, v = z.v, k = v.t;
    cv.corpo.rotation.set(0, 0, 0); cv.collo.rotation.set(0, 0, 0); cv.root.position.y = 0;
    const galoppo = v.anim === 'carica', impenna = v.anim === 'prepara' ? steps(k, 4) : 0;
    const f = z.fase * (galoppo ? 1.6 : 1), amp = galoppo ? 0.7 : 0.35;
    cv.zampe.forEach((g, i) => { g.rotation.set(Math.sin(f + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * amp, 0, 0); });
    cv.corpo.rotation.x = 0.55 * impenna + (galoppo ? 0.06 * Math.sin(f * 2) : 0);
    if (impenna > 0) { cv.zampe[0]!.rotation.x = -1.1 * impenna; cv.zampe[1]!.rotation.x = -0.8 * impenna; cv.corpo.position.y = 1.15 + 0.35 * impenna; } else cv.corpo.position.y = 1.15 + (galoppo ? 0.08 * Math.abs(Math.sin(f)) : 0);
    cv.collo.rotation.x = galoppo ? 0.3 : -0.1 * Math.sin(t * 2);
    if (v.anim === 'morto') { z.mortoT += 1 / 60; const e = steps(z.mortoT / 0.4, 3); cv.root.rotation.z = 1.4 * e; cv.root.position.y = -Math.max(0, z.mortoT - 0.8) * 0.9; }
    else cv.root.rotation.z = 0;
    // cavaliere sulla sella: anca agganciata al corpo del cavallo
    cv.root.updateMatrixWorld(true);
    v3.set(0, 0.42, 0.1).applyMatrix4(cv.corpo.matrixWorld);
    r.root.position.copy(v3); r.root.rotation.set(cv.corpo.rotation.x, z.yaw, cv.root.rotation.z, 'YXZ');
    r.anca.position.y = 0;
    for (let s = 0; s < 2; s++) { r.coscia[s]!.rotation.set(-1.35, 0, (s ? -1 : 1) * 0.35); r.ginocchio[s]!.rotation.x = 1.2; }
    r.spalla[1]!.rotation.x = galoppo ? 1.5 : 1.15; r.gomito[1]!.rotation.x = -0.2; // lancia in resta
    r.spalla[0]!.rotation.x = 0.9; r.gomito[0]!.rotation.x = 0.7; r.spalla[0]!.rotation.z = 0.5; // scudo
    r.busto.rotation.x = galoppo ? -0.3 : 0;
  }

  const api: Zombi = {
    tick(v) {
      const seen = new Set<number>();
      for (const n of v.zombie) {
        seen.add(n.id);
        let z = zs.get(n.id);
        if (!z) {
          const tinta = new THREE.Color(1, 1, 1).multiplyScalar(0.82 + 0.18 * ((n.id * 0.618) % 1));
          z = { id: n.id, rig: rig(), cav: n.tipo === 'cavaliere' ? cavalloRig() : null, px: n.x, pz: n.z, x: n.x, z: n.z, v: n, fase: n.id, flash: 0, mortoT: 0, yaw: Math.atan2(-n.fx, -n.fz), tinta };
          zs.set(n.id, z);
        }
        z.px = z.x; z.pz = z.z; z.x = n.x; z.z = n.z; z.v = n;
      }
      for (const id of [...zs.keys()]) if (!seen.has(id)) zs.delete(id);
    },
    update(alpha, dt, t) {
      const nk = new Map<KitId, number>(), ne = new Map<string, number>();
      let b = 0, nc = 0, molay: THREE.Vector3 | null = null;
      const put = (x: THREE.InstancedMesh, j: number, o: THREE.Object3D, tinta: THREE.Color, scala: number) => {
        x.setMatrixAt(j, scala === 1 ? o.matrixWorld : m4.copy(o.matrixWorld).multiply(new THREE.Matrix4().makeScale(scala, scala, scala)));
        x.setColorAt(j, tinta);
      };
      for (const z of zs.values()) {
        const k = KIT_DI[z.v.tipo] ?? 'templare', i = nk.get(k) ?? 0;
        if (i >= MAX) continue;
        nk.set(k, i + 1);
        const x = z.px + (z.x - z.px) * alpha, zz = z.pz + (z.z - z.pz) * alpha;
        const sp = Math.sqrt((z.x - z.px) ** 2 + (z.z - z.pz) ** 2) * 60;
        z.fase += sp * dt * (z.cav ? 3.2 : 5.2);
        // girarsi verso dove guarda (morbido)
        const want = Math.atan2(-z.v.fx, -z.v.fz);
        let d = want - z.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); z.yaw += d * Math.min(1, dt * (z.cav ? 6 : 12));
        const sc = SCALA[z.v.tipo] ?? 1;
        if (z.cav) { z.cav.root.position.set(x, 0, zz); z.cav.root.rotation.y = z.yaw; z.cav.root.scale.setScalar(sc); }
        else { z.rig.root.position.set(x, 0, zz); z.rig.root.rotation.y = z.yaw; }
        z.rig.root.scale.setScalar(sc);
        pose(z, t, dt);
        z.rig.root.updateMatrixWorld(true);
        z.flash = Math.max(0, z.flash - dt);
        const lampo = (z.v.anim === 'prepara' || z.v.anim === 'lancia') && Math.floor(t * (6 + 10 * z.v.t)) % 2 === 0;
        c.copy(z.tinta); if (z.flash > 0) c.copy(BIANCO); else if (lampo) c.copy(ROSSO);
        const km = kitMesh(k), r = z.rig;
        put(km['testa']!, i, r.testa, c, 1); put(km['busto']!, i, r.busto, c, 1); put(km['falda']!, i, r.anca, c, 1);
        for (let s = 0; s < 2; s++) { put(km['braccio']!, i * 2 + s, r.spalla[s]!, c, 1); put(km['avambraccio']!, i * 2 + s, r.gomito[s]!, c, 1); put(km['coscia']!, i * 2 + s, r.coscia[s]!, c, 1); put(km['stinco']!, i * 2 + s, r.ginocchio[s]!, c, 1); }
        for (const [e, def] of Object.entries(EXTRA)) {
          if (!def.tipi.includes(z.v.tipo)) continue;
          const j = ne.get(e) ?? 0; ne.set(e, j + 1);
          const o = def.osso === 'testa' ? r.testa : def.osso === 'busto' ? r.busto : def.osso === 'manoS' ? r.gomito[0]! : r.gomito[1]!;
          const fiamma = def.acceso ? 0.85 + 0.35 * (((Math.floor(t * 10) + j) * 0.618) % 1) : 1;
          put(extraMesh(e), j, o, def.acceso ? c.set(1, 1, 1) : c, fiamma);
          if (def.acceso) c.copy(z.tinta);
        }
        if (z.cav && nc < 4) {
          const cm = cavMesh(), cv = z.cav;
          cv.root.updateMatrixWorld(true);
          put(cm['corpo']!, nc, cv.corpo, c, 1); put(cm['collo']!, nc, cv.collo, c, 1);
          cv.zampe.forEach((g, j) => put(cm['zampa']!, nc * 4 + j, g, c, 1));
          nc++;
        }
        if (z.v.tipo === 'molay' && z.v.anim !== 'morto') molay = new THREE.Vector3(x, 2, zz);
        if (z.v.anim !== 'morto' && z.v.anim !== 'sorge' && b < MAX) blobs.setMatrixAt(b++, m4.compose(v3.set(x, 0.03, zz), q, s3.set(z.cav ? 2.4 : sc, 1, z.cav ? 2.4 : sc)));
      }
      for (const [k, km] of kits) for (const [p, x] of Object.entries(km)) { const n = nk.get(k) ?? 0; x.count = DOPPIE.has(p) ? n * 2 : n; }
      for (const [e, x] of extra) x.count = ne.get(e) ?? 0;
      if (cavM) { cavM['corpo']!.count = nc; cavM['collo']!.count = nc; cavM['zampa']!.count = nc * 4; }
      for (const x of tutte) { x.visible = x.count > 0; if (x.visible) { x.instanceMatrix.needsUpdate = true; if (x.instanceColor) x.instanceColor.needsUpdate = true; } }
      blobs.count = b; blobs.instanceMatrix.needsUpdate = true;
      // de Molay brucia: una luce rossa che trema a scatti gli sta addosso
      if (molay) { luceMolay.position.copy(molay); luceMolay.intensity = 14 + 6 * (((Math.floor(t * 10)) * 0.618) % 1); } else luceMolay.intensity = 0;
    },
    colpito(id) { const z = zs.get(id); if (z) z.flash = 0.1; },
    posDi(id) { const z = zs.get(id); return z ? new THREE.Vector3(z.x, z.cav ? 3.2 : 2.1, z.z) : null; },
    counts: () => ({ zombie: zs.size, disegnati: zs.size, mesh: tutte.filter((x) => x.visible).length }),
    dispose() { for (const x of tutte) { scene.remove(x); x.geometry.dispose(); } mat.dispose(); acceso.dispose(); scene.remove(blobs, luceMolay); blobGeo.dispose(); },
  };
  return api;
}
