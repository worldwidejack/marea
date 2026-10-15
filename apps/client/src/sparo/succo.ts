// Il «succo» dello sparo (#355): quello che fa sentire ogni colpo. Lampo alla bocca (una stella a pixel + una luce che si accende un
// attimo), scie che corrono dalla bocca al bersaglio, scintille sulla lamiera, schegge sul legno, polvere sul cemento, schizzi nel
// mare, fori che restano sulle facce, bossoli che saltano fuori e rimbalzano, sbuffo bianco sul corpo colpito. Tutto a pool fissi:
// tre-quattro draw call in tutto, niente allocazioni durante il gioco. Colori solo della palette.
import * as THREE from 'three';
import { P } from '../render/island_parts.ts';

export type Materia = 'metallo' | 'legno' | 'plastica' | 'cemento' | 'acqua' | 'corpo';
export type Succo = {
  /** Lampo alla bocca `p` lungo `dir`; `k` = grandezza (1 = mitra; la prima persona lo passa più piccolo). */
  lampo(p: THREE.Vector3, dir: THREE.Vector3, k: number): void;
  scia(a: THREE.Vector3, b: THREE.Vector3): void;
  impatto(p: THREE.Vector3, n: THREE.Vector3, m: Materia, foro: boolean): void;
  bossolo(p: THREE.Vector3, destra: THREE.Vector3, su: THREE.Vector3, suolo: number): void;
  aggiorna(dt: number): void;
};

const N_PART = 360, N_SCIE = 32, N_FORI = 96, N_BOSS = 24;

function stella(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d')!;
  const px = (col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(P.arancio, 7, 1, 2, 14); px(P.arancio, 1, 7, 14, 2); px(P.arancio, 3, 3, 2, 2); px(P.arancio, 11, 3, 2, 2); px(P.arancio, 3, 11, 2, 2); px(P.arancio, 11, 11, 2, 2);
  px(P.giallo, 6, 3, 4, 10); px(P.giallo, 3, 6, 10, 4); px(P.giallo, 5, 5, 6, 6);
  px('#ffffff', 6, 6, 4, 4); px('#ffffff', 7, 4, 2, 8); px('#ffffff', 4, 7, 8, 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function creaSucco(scene: THREE.Scene): Succo {
  // ---------- lampo: sprite + luce (sempre nella scena: accenderla non ricompila gli shader) ----------
  const tex = stella();
  const lampoS = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.5 }));
  lampoS.visible = false; scene.add(lampoS);
  const luce = new THREE.PointLight(0xffd36a, 0, 9, 2); scene.add(luce);
  let lampoT = 0;

  // lampetti sugli impatti (la lamiera che sputa scintille si vede anche da lontano)
  const N_LAMPI = 10, lampi: THREE.Sprite[] = [], lampiT = new Float32Array(N_LAMPI);
  for (let i = 0; i < N_LAMPI; i++) { const sp = new THREE.Sprite(lampoS.material); sp.visible = false; scene.add(sp); lampi.push(sp); }
  let lNext = 0;

  // ---------- particelle: punti quadrati (a pixel) con colore per punto ----------
  const pPos = new Float32Array(N_PART * 3), pCol = new Float32Array(N_PART * 3);
  const vel = new Float32Array(N_PART * 3), vita = new Float32Array(N_PART), grav = new Float32Array(N_PART);
  for (let i = 0; i < N_PART; i++) pPos[i * 3 + 1] = -999;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const punti = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, sizeAttenuation: true }));
  punti.frustumCulled = false; scene.add(punti);
  let pNext = 0;
  const col = new THREE.Color();
  const emetti = (p: THREE.Vector3, vx: number, vy: number, vz: number, c: string, t: number, g: number) => {
    const i = pNext; pNext = (pNext + 1) % N_PART;
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; vita[i] = t; grav[i] = g;
    col.set(c); pCol[i * 3] = col.r; pCol[i * 3 + 1] = col.g; pCol[i * 3 + 2] = col.b;
  };

  // ---------- scie: segmenti corti che corrono lungo il colpo ----------
  const sPos = new Float32Array(N_SCIE * 6), sCol = new Float32Array(N_SCIE * 6);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const scie = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
  scie.frustumCulled = false; scene.add(scie);
  const sA = Array.from({ length: N_SCIE }, () => new THREE.Vector3()), sB = Array.from({ length: N_SCIE }, () => new THREE.Vector3());
  const sT = new Float32Array(N_SCIE), sL = new Float32Array(N_SCIE).fill(-1);
  let sNext = 0;
  col.set(P.giallo); const cTesta = [col.r, col.g, col.b]; col.set(P.arancio); const cCoda = [col.r, col.g, col.b];
  for (let i = 0; i < N_SCIE; i++) { sCol.set(cCoda, i * 6); sCol.set(cTesta, i * 6 + 3); }

  // ---------- fori: quadratini scuri sulle facce ----------
  const o3 = new THREE.Object3D(), nz = new THREE.Vector3(0, 0, 1), qn = new THREE.Quaternion();
  const fori = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshBasicMaterial({ color: P.neroCaldo, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N_FORI);
  fori.count = 0; fori.frustumCulled = false; scene.add(fori);
  let fNext = 0;

  // ---------- bossoli ----------
  const boss = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.014, 0.034), new THREE.MeshLambertMaterial({ color: P.giallo }), N_BOSS);
  boss.frustumCulled = false; scene.add(boss);
  const bP = Array.from({ length: N_BOSS }, () => new THREE.Vector3(0, -999, 0)), bV = Array.from({ length: N_BOSS }, () => new THREE.Vector3());
  const bR = new Float32Array(N_BOSS * 3), bW = new Float32Array(N_BOSS * 3), bVita = new Float32Array(N_BOSS), bSuolo = new Float32Array(N_BOSS);
  let bNext = 0;
  for (let i = 0; i < N_BOSS; i++) { o3.position.set(0, -999, 0); o3.updateMatrix(); boss.setMatrixAt(i, o3.matrix); }

  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const tmp = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  const COLORI: Record<Materia, string[]> = {
    metallo: [P.giallo, P.arancio, '#ffffff', P.giallo], legno: [P.legnoChiaro, P.legno, P.sabbia], plastica: ['#ffffff', P.rosso, P.pietraChiara],
    cemento: [P.pietraChiara, P.pietra, P.pietraScura], acqua: ['#ffffff', P.acquaBassa, P.pietraChiara], corpo: ['#ffffff', P.pietraChiara, P.giallo],
  };

  return {
    lampo(p, dir, k) {
      lampoS.position.copy(p).addScaledVector(dir, 0.04 * k);
      lampoS.scale.setScalar((0.32 + Math.random() * 0.12) * k);
      lampoS.material.rotation = Math.random() * Math.PI;
      lampoS.visible = true; lampoT = 0.045;
      luce.position.copy(p).addScaledVector(dir, 0.3); luce.intensity = 7;
      // niente fumo alla bocca: i punti così vicini alla camera diventano quadrati bianchi enormi
    },
    scia(a, b) {
      const i = sNext; sNext = (sNext + 1) % N_SCIE;
      sA[i]!.copy(a); sB[i]!.copy(b); sT[i] = 0; sL[i] = a.distanceTo(b);
    },
    impatto(p, n, m, foro) {
      const cs = COLORI[m];
      const quanti = m === 'metallo' ? 9 : m === 'acqua' ? 12 : m === 'corpo' ? 7 : 7;
      for (let i = 0; i < quanti; i++) {
        tmp.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(0.7).add(n).normalize();
        const v = m === 'metallo' ? rnd(3, 7) : m === 'acqua' ? rnd(1.5, 3.5) : rnd(1, 2.6);
        const vy = m === 'acqua' ? rnd(2.5, 4.5) : tmp.y * v;
        emetti(p, tmp.x * v, vy, tmp.z * v, cs[i % cs.length]!, m === 'metallo' ? rnd(0.12, 0.3) : rnd(0.25, 0.55), m === 'cemento' ? -2 : 9.8);
      }
      if (m === 'metallo' || m === 'corpo' || m === 'acqua') {
        const sp = lampi[lNext]!; lampiT[lNext] = 0.05; lNext = (lNext + 1) % N_LAMPI;
        sp.position.copy(p).addScaledVector(n, 0.06); sp.scale.setScalar(m === 'metallo' ? 0.32 : 0.42); sp.visible = true;
      }
      if (m === 'cemento' || m === 'legno') for (let i = 0; i < 3; i++) emetti(t1.copy(p).addScaledVector(n, 0.05), rnd(-0.3, 0.3) + n.x * 0.5, rnd(0.2, 0.7), rnd(-0.3, 0.3) + n.z * 0.5, P.pietra, rnd(0.4, 0.7), -0.5);
      if (!foro) return;
      o3.position.copy(p).addScaledVector(n, 0.004);
      o3.quaternion.copy(qn.setFromUnitVectors(nz, t2.copy(n).normalize()));
      o3.rotateZ(Math.random() * Math.PI);
      const s = rnd(0.7, 1.2); o3.scale.set(s, s, s);
      o3.updateMatrix();
      fori.setMatrixAt(fNext, o3.matrix); fNext = (fNext + 1) % N_FORI; fori.count = Math.min(N_FORI, fori.count + 1);
      fori.instanceMatrix.needsUpdate = true;
    },
    bossolo(p, destra, su, suolo) {
      const i = bNext; bNext = (bNext + 1) % N_BOSS;
      bP[i]!.copy(p);
      bV[i]!.copy(destra).multiplyScalar(rnd(1.6, 2.6)).addScaledVector(su, rnd(1.2, 2.2));
      for (let k = 0; k < 3; k++) { bR[i * 3 + k] = Math.random() * 6; bW[i * 3 + k] = rnd(-20, 20); }
      bVita[i] = 1.4; bSuolo[i] = suolo;
    },
    aggiorna(dt) {
      // lampo
      lampoT -= dt;
      if (lampoT <= 0) lampoS.visible = false;
      luce.intensity = Math.max(0, luce.intensity - dt * 140);
      for (let i = 0; i < N_LAMPI; i++) if (lampi[i]!.visible) { lampiT[i]! -= dt; if (lampiT[i]! <= 0) lampi[i]!.visible = false; }
      // particelle
      for (let i = 0; i < N_PART; i++) {
        if (vita[i]! <= 0) continue;
        vita[i]! -= dt;
        if (vita[i]! <= 0) { pPos[i * 3 + 1] = -999; continue; }
        vel[i * 3 + 1]! -= grav[i]! * dt;
        const k = Math.max(0, 1 - dt * 2.5);
        vel[i * 3]! *= k; vel[i * 3 + 2]! *= k;
        pPos[i * 3]! += vel[i * 3]! * dt; pPos[i * 3 + 1]! += vel[i * 3 + 1]! * dt; pPos[i * 3 + 2]! += vel[i * 3 + 2]! * dt;
      }
      pGeo.attributes.position!.needsUpdate = true; pGeo.attributes.color!.needsUpdate = true;
      // scie: un segmento di 3 m che corre a 320 m/s
      for (let i = 0; i < N_SCIE; i++) {
        if (sL[i]! < 0) { sPos.fill(0, i * 6, i * 6 + 6); continue; }
        sT[i]! += dt * 320;
        const testa = Math.min(sT[i]!, sL[i]!), coda = Math.max(0, testa - 3);
        if (sT[i]! - 3 >= sL[i]!) { sL[i] = -1; sPos.fill(0, i * 6, i * 6 + 6); continue; }
        t1.copy(sA[i]!).lerp(sB[i]!, coda / Math.max(1e-6, sL[i]!)); t2.copy(sA[i]!).lerp(sB[i]!, testa / Math.max(1e-6, sL[i]!));
        sPos[i * 6] = t1.x; sPos[i * 6 + 1] = t1.y; sPos[i * 6 + 2] = t1.z; sPos[i * 6 + 3] = t2.x; sPos[i * 6 + 4] = t2.y; sPos[i * 6 + 5] = t2.z;
      }
      sGeo.attributes.position!.needsUpdate = true;
      // bossoli: volano, girano, rimbalzano una volta e restano a terra (finché il pool non li riusa)
      for (let i = 0; i < N_BOSS; i++) {
        if (bVita[i]! <= 0) continue;
        bVita[i]! -= dt;
        const p = bP[i]!, v = bV[i]!;
        v.y -= 9.8 * dt; p.addScaledVector(v, dt);
        if (p.y < bSuolo[i]! + 0.01) { p.y = bSuolo[i]! + 0.01; v.y = Math.abs(v.y) * 0.35; v.x *= 0.5; v.z *= 0.5; for (let k = 0; k < 3; k++) bW[i * 3 + k]! *= 0.5; }
        for (let k = 0; k < 3; k++) bR[i * 3 + k]! += bW[i * 3 + k]! * dt;
        o3.position.copy(p); o3.rotation.set(bR[i * 3]!, bR[i * 3 + 1]!, bR[i * 3 + 2]!); o3.scale.setScalar(1); o3.updateMatrix();
        boss.setMatrixAt(i, o3.matrix);
      }
      boss.instanceMatrix.needsUpdate = true;
    },
  };
}
