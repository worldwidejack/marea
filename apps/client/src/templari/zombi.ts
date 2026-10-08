// Zombie dei Templari (docs/TEMPLARI.md §8): un manichino low-poly a parti (testa col cappuccio di maglia, busto con la sopravveste bianca e
// la croce rossa, falda della sopravveste, braccia, gambe con le calze di maglia) disegnato con UN InstancedMesh per parte: tutti gli zombie
// costano 8 draw call più le ombre, quanti che siano. Pose a mano dalla vista della sim: barcollano con le braccia tese (corrono chini),
// strappano le assi, si preparano a colpire alzando le braccia (lampeggiano rossi), colpiscono, escono da terra, cadono all'indietro.
// Interpolazione tra due tick per i 60 fps. Solo colori della palette (per vertice), facce piatte.
import * as THREE from 'three';
import type { TView } from '@marea/sim/templari/types.ts';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

type ZV = TView['zombie'][number];
const MAX = 40;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const pri = (r0: number, r1: number, h: number, s = 5) => new THREE.CylinderGeometry(r0, r1, h, s);
/** Pelle da cadavere: grigio verde (pietra con chiazze bosco). */
const PELLE = PAL.pietra, CHIAZZA = PAL.erbaScura, MAGLIA = PAL.pietraScura, TELA = PAL.sabbiaChiara, CROCE = PAL.rosso;

/** Parti del manichino, col pivot sul giunto (le braccia e le gambe pendono verso −Y, la testa sale da 0). Avanti = −Z. */
function parti(): Record<string, THREE.BufferGeometry> {
  const testa = merged([
    painted(pri(0.13, 0.14, 0.27, 6), PELLE, M(0, 0.15, 0)),
    painted(box(0.1, 0.06, 0.04), CHIAZZA, M(0.06, 0.2, -0.12)),
    painted(box(0.06, 0.05, 0.03), PAL.neroCaldo, M(-0.05, 0.17, -0.135)), // orbite vuote
    painted(box(0.06, 0.05, 0.03), PAL.neroCaldo, M(0.05, 0.17, -0.135)),
    painted(box(0.02, 0.02, 0.02), CROCE, M(-0.05, 0.17, -0.15)), // un lume rosso negli occhi
    painted(box(0.02, 0.02, 0.02), CROCE, M(0.05, 0.17, -0.15)),
    painted(box(0.12, 0.04, 0.03), PAL.neroCaldo, M(0, 0.06, -0.135)), // bocca aperta
    painted(pri(0.165, 0.18, 0.2, 6), MAGLIA, M(0, 0.24, 0.02, -0.12, 0, 0)), // cappuccio di maglia
    painted(pri(0.2, 0.16, 0.12, 6), MAGLIA, M(0, 0.02, 0.01)), // collo del cappuccio
  ]);
  const busto = merged([
    painted(pri(0.2, 0.16, 0.58, 4), TELA, M(0, 0.29, 0, 0, Math.PI / 4, 0, 1.25, 1, 0.75)),
    painted(box(0.08, 0.36, 0.03), CROCE, M(0, 0.33, -0.15)), // croce patente sul petto
    painted(box(0.26, 0.08, 0.03), CROCE, M(0, 0.4, -0.15)),
    painted(box(0.08, 0.36, 0.03), CROCE, M(0, 0.33, 0.15)), // e sulla schiena
    painted(box(0.26, 0.08, 0.03), CROCE, M(0, 0.4, 0.15)),
    painted(box(0.12, 0.1, 0.03), PAL.legnoScuro, M(0.1, 0.12, -0.155)), // strappi e sangue secco
    painted(box(0.5, 0.12, 0.28), MAGLIA, M(0, 0.56, 0)), // spalle di maglia
    painted(box(0.44, 0.06, 0.26), PAL.legnoScuro, M(0, 0.02, 0)), // cintura
  ]);
  const falda = merged([painted(pri(0.2, 0.24, 0.42, 4), TELA, M(0, -0.21, 0, 0, Math.PI / 4, 0, 1.15, 1, 0.75)), painted(box(0.06, 0.3, 0.03), CROCE, M(0, -0.18, -0.13))]);
  const braccio = merged([painted(pri(0.06, 0.05, 0.3, 5), MAGLIA, M(0, -0.15, 0))]);
  const avambraccio = merged([painted(pri(0.05, 0.045, 0.27, 5), MAGLIA, M(0, -0.13, 0)), painted(box(0.08, 0.1, 0.06), PELLE, M(0, -0.31, 0))]);
  const coscia = merged([painted(pri(0.08, 0.065, 0.45, 5), MAGLIA, M(0, -0.22, 0))]);
  const stinco = merged([painted(pri(0.065, 0.055, 0.42, 5), MAGLIA, M(0, -0.2, 0)), painted(box(0.11, 0.08, 0.2), PAL.legnoScuro, M(0, -0.43, -0.04))]);
  // templare scudato: elmo a secchio con la fessura e lo scudo a goccia al braccio sinistro (solo per chi ce l'ha)
  const elmo = merged([
    painted(pri(0.17, 0.17, 0.3, 8), MAGLIA, M(0, 0.17, 0)),
    painted(pri(0.18, 0.18, 0.04, 8), PAL.roccia, M(0, 0.32, 0)),
    painted(box(0.24, 0.025, 0.04), PAL.neroCaldo, M(0, 0.2, -0.16)), // fessura degli occhi
    painted(box(0.03, 0.12, 0.04), CROCE, M(0, 0.1, -0.16)),
  ]);
  const scudo = merged([
    painted(pri(0.3, 0.06, 0.72, 6), TELA, M(0, -0.18, -0.12, Math.PI / 2, 0, 0, 1, 1, 0.15)),
    painted(box(0.06, 0.03, 0.5), CROCE, M(0, -0.2, -0.17)),
    painted(box(0.38, 0.03, 0.06), CROCE, M(0, -0.2, -0.05)),
  ]);
  return { testa, busto, falda, braccio, avambraccio, coscia, stinco, elmo, scudo };
}
/** Parti che hanno solo certi tipi (contate a parte). */
const SOLO: Record<string, string> = { elmo: 'scudato', scudo: 'scudato' };
const DOPPIE = new Set(['braccio', 'avambraccio', 'coscia', 'stinco']);

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

type Z = { id: number; rig: Rig; px: number; pz: number; x: number; z: number; v: ZV; fase: number; flash: number; mortoT: number; yaw: number; tinta: THREE.Color };
export type Zombi = {
  tick(v: TView): void;
  update(alpha: number, dt: number, t: number): void;
  colpito(id: number): void;
  /** Posizione (interpolata) sopra la testa, per i numeri del danno. */
  posDi(id: number): THREE.Vector3 | null;
  counts(): { zombie: number; disegnati: number };
  dispose(): void;
};

const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;

export function createZombi(scene: THREE.Scene): Zombi {
  const geo = parti(), mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const meshes: Record<string, THREE.InstancedMesh> = {};
  for (const [k, g] of Object.entries(geo)) {
    const im = new THREE.InstancedMesh(g, mat, MAX * (DOPPIE.has(k) ? 2 : 1)); im.name = 'zombie_' + k; im.count = 0; im.frustumCulled = false;
    meshes[k] = im; scene.add(im);
  }
  const blobGeo = new THREE.CircleGeometry(0.45, 8); blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: PAL.neroCaldo, transparent: true, opacity: 0.45, depthWrite: false }), MAX);
  blobs.frustumCulled = false; blobs.renderOrder = 1; blobs.name = 'zombie_ombre'; scene.add(blobs);
  const zs = new Map<number, Z>();
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  const BIANCO = new THREE.Color(2.2, 2.1, 1.9), ROSSO = new THREE.Color(1.8, 0.5, 0.45);

  function pose(z: Z, t: number, dt: number): void {
    const r = z.rig, v = z.v, k = v.t;
    for (const o of [r.anca, r.busto, r.testa, ...r.spalla, ...r.gomito, ...r.coscia, ...r.ginocchio]) o.rotation.set(0, 0, 0);
    r.anca.position.y = 0.92; r.root.position.y = 0; r.root.rotation.x = 0;
    const corsa = v.anim === 'corre';
    const passo = corsa ? 1.0 : 0.55, sw = Math.sin(z.fase);
    // di serie: braccia tese avanti (lo zombie), testa storta, chino quanto corre
    const tese = (alto: number) => { for (let s = 0; s < 2; s++) { r.spalla[s]!.rotation.x = alto + (s ? 0.12 : -0.12) * Math.sin(t * 2 + z.id); r.gomito[s]!.rotation.x = 0.25; r.spalla[s]!.rotation.z = s ? 0.12 : -0.12; } };
    r.testa.rotation.z = 0.25 * Math.sin(z.id * 1.7); r.testa.rotation.x = 0.15;
    if (z.v.tipo === 'scudato' && v.anim !== 'morto' && v.anim !== 'sorge') { r.spalla[0]!.rotation.x = 0.9; r.gomito[0]!.rotation.x = 0.7; r.spalla[0]!.rotation.z = 0.5; }
    switch (v.anim) {
      case 'cammina': case 'corre': {
        tese(corsa ? 1.15 : 1.4);
        r.busto.rotation.x = corsa ? -0.42 : -0.18;
        for (let s = 0; s < 2; s++) { const ph = s ? sw : -sw; r.coscia[s]!.rotation.x = ph * passo; r.ginocchio[s]!.rotation.x = -Math.max(0, -ph) * passo * 1.2; }
        r.anca.position.y = 0.92 - Math.abs(Math.cos(z.fase)) * 0.05;
        r.busto.rotation.z = 0.08 * Math.sin(z.fase); // barcolla
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
  }

  const api: Zombi = {
    tick(v) {
      const seen = new Set<number>();
      for (const n of v.zombie) {
        seen.add(n.id);
        let z = zs.get(n.id);
        if (!z) {
          const tinta = new THREE.Color(1, 1, 1).multiplyScalar(0.82 + 0.18 * ((n.id * 0.618) % 1));
          z = { id: n.id, rig: rig(), px: n.x, pz: n.z, x: n.x, z: n.z, v: n, fase: n.id, flash: 0, mortoT: 0, yaw: Math.atan2(-n.fx, -n.fz), tinta };
          zs.set(n.id, z);
        }
        z.px = z.x; z.pz = z.z; z.x = n.x; z.z = n.z; z.v = n;
      }
      for (const id of [...zs.keys()]) if (!seen.has(id)) zs.delete(id);
    },
    update(alpha, dt, t) {
      let i = 0, b = 0;
      const extra: Record<string, number> = { elmo: 0, scudo: 0 };
      const put = (k: string, j: number, o: THREE.Object3D, tinta: THREE.Color) => { meshes[k]!.setMatrixAt(j, o.matrixWorld); meshes[k]!.setColorAt(j, tinta); };
      for (const z of zs.values()) {
        if (i >= MAX) break;
        const x = z.px + (z.x - z.px) * alpha, zz = z.pz + (z.z - z.pz) * alpha;
        const sp = Math.sqrt((z.x - z.px) ** 2 + (z.z - z.pz) ** 2) * 60;
        z.fase += sp * dt * 5.2;
        // girarsi verso dove guarda (morbido)
        const want = Math.atan2(-z.v.fx, -z.v.fz);
        let d = want - z.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); z.yaw += d * Math.min(1, dt * 12);
        z.rig.root.position.set(x, 0, zz); z.rig.root.rotation.y = z.yaw;
        pose(z, t, dt);
        z.rig.root.updateMatrixWorld(true);
        z.flash = Math.max(0, z.flash - dt);
        const lampo = z.v.anim === 'prepara' && Math.floor(t * (6 + 10 * z.v.t)) % 2 === 0;
        c.copy(z.tinta); if (z.flash > 0) c.copy(BIANCO); else if (lampo) c.copy(ROSSO);
        put('testa', i, z.rig.testa, c); put('busto', i, z.rig.busto, c); put('falda', i, z.rig.anca, c);
        for (let s = 0; s < 2; s++) { put('braccio', i * 2 + s, z.rig.spalla[s]!, c); put('avambraccio', i * 2 + s, z.rig.gomito[s]!, c); put('coscia', i * 2 + s, z.rig.coscia[s]!, c); put('stinco', i * 2 + s, z.rig.ginocchio[s]!, c); }
        if (z.v.tipo === 'scudato') { put('elmo', extra['elmo']!++, z.rig.testa, c); put('scudo', extra['scudo']!++, z.rig.gomito[0]!, c); }
        if (z.v.anim !== 'morto' && z.v.anim !== 'sorge') { blobs.setMatrixAt(b++, m4.compose(v3.set(x, 0.03, zz), q, s3.set(1, 1, 1))); }
        i++;
      }
      for (const [k, im] of Object.entries(meshes)) { im.count = SOLO[k] ? extra[k] ?? 0 : DOPPIE.has(k) ? i * 2 : i; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
      blobs.count = b; blobs.instanceMatrix.needsUpdate = true;
    },
    colpito(id) { const z = zs.get(id); if (z) z.flash = 0.1; },
    posDi(id) { const z = zs.get(id); return z ? new THREE.Vector3(z.x, 2.1, z.z) : null; },
    counts: () => ({ zombie: zs.size, disegnati: Math.min(MAX, zs.size) }),
    dispose() { for (const im of Object.values(meshes)) { scene.remove(im); im.geometry.dispose(); } mat.dispose(); scene.remove(blobs); blobGeo.dispose(); },
  };
  return api;
}
