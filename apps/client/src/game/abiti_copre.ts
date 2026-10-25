// Quale pelle del chr_base sta sotto un vestito o un cappello del Mercante (game/abiti.ts): quei triangoli il corpo non li disegna, così niente
// maglietta vecchia che buca il vestito nuovo. Tutto nella posa a riposo (le matrici delle ossa prima delle clip, `rest` di game/avatar.ts).
// Un triangolo è coperto se i raggi dai suoi tre vertici e dal centro, lungo la sua normale, incontrano DAL DI DENTRO (faccia del pezzo girata
// verso il corpo) un pezzo entro 12 cm: le tese e le visiere, viste da sotto, non contano. Come assets/blender/abiti_kit.nascondi_coperti.
import * as THREE from 'three';

const DIST = 0.12, CELLA = 0.06;
export type Tri = Float32Array; // 9 numeri per triangolo: a, b, c

/** I triangoli di una SkinnedMesh nella posa a riposo (posizioni del mondo all'avvio). */
export function triRiposo(sm: THREE.SkinnedMesh, rest: Map<string, THREE.Matrix4>): Tri {
  const g = sm.geometry, pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  const bones = sm.skeleton.bones, inv = sm.skeleton.boneInverses;
  const M = bones.map((b, i) => (rest.get(b.name) ?? b.matrixWorld).clone().multiply(inv[i]!).multiply(sm.bindMatrix));
  const n = pos.count, V = new Float32Array(n * 3), p = new THREE.Vector3(), q = new THREE.Vector3(), acc = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i); acc.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (w > 0) acc.addScaledVector(q.copy(p).applyMatrix4(M[si.getComponent(i, k)]!), w);
    }
    V[i * 3] = acc.x; V[i * 3 + 1] = acc.y; V[i * 3 + 2] = acc.z;
  }
  const idx = g.getIndex(), nt = idx ? idx.count / 3 : n / 3, T = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const v = idx ? idx.getX(t * 3 + k) : t * 3 + k;
    T[t * 9 + k * 3] = V[v * 3]!; T[t * 9 + k * 3 + 1] = V[v * 3 + 1]!; T[t * 9 + k * 3 + 2] = V[v * 3 + 2]!;
  }
  return T;
}

/** Griglia dei triangoli dei pezzi: cella → indici dei triangoli che la toccano. */
function griglia(T: Tri): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (let t = 0; t < T.length / 9; t++) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const x = T[t * 9 + k * 3]!, y = T[t * 9 + k * 3 + 1]!, z = T[t * 9 + k * 3 + 2]!;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
    }
    for (let i = Math.floor(x0 / CELLA); i <= Math.floor(x1 / CELLA); i++) for (let j = Math.floor(y0 / CELLA); j <= Math.floor(y1 / CELLA); j++)
      for (let k = Math.floor(z0 / CELLA); k <= Math.floor(z1 / CELLA); k++) {
        const key = `${i},${j},${k}`, l = m.get(key);
        if (l) l.push(t); else m.set(key, [t]);
      }
  }
  return m;
}

/** Per ogni triangolo del corpo (`corpo`), 1 se è coperto dai pezzi (`pezzi`, triangoli già insieme). */
export function coperti(corpo: Tri, pezzi: Tri): Uint8Array {
  const out = new Uint8Array(corpo.length / 9);
  if (!pezzi.length) return out;
  const G = griglia(pezzi), visto = new Int32Array(pezzi.length / 9).fill(-1);
  let giro = 0;
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), h = new THREE.Vector3(), s = new THREE.Vector3(), qv = new THREE.Vector3(), nt = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3(), n = new THREE.Vector3(), o = new THREE.Vector3();
  /** Il raggio da o lungo n tocca, entro DIST, un triangolo dei pezzi visto dal di dentro? */
  const tocca = (): boolean => {
    giro++;
    for (let d = 0; d <= DIST + 1e-6; d += CELLA / 2) {
      const key = `${Math.floor((o.x + n.x * d) / CELLA)},${Math.floor((o.y + n.y * d) / CELLA)},${Math.floor((o.z + n.z * d) / CELLA)}`;
      for (const t of G.get(key) ?? []) {
        if (visto[t] === giro) continue;
        visto[t] = giro;
        const i = t * 9;
        e1.set(pezzi[i + 3]! - pezzi[i]!, pezzi[i + 4]! - pezzi[i + 1]!, pezzi[i + 5]! - pezzi[i + 2]!);
        e2.set(pezzi[i + 6]! - pezzi[i]!, pezzi[i + 7]! - pezzi[i + 1]!, pezzi[i + 8]! - pezzi[i + 2]!);
        if (nt.crossVectors(e1, e2).dot(n) <= 0) continue; // faccia girata verso fuori: è il davanti del pezzo, non lo copre
        h.crossVectors(n, e2);
        const det = e1.dot(h);
        if (Math.abs(det) < 1e-9) continue;
        s.set(o.x - pezzi[i]!, o.y - pezzi[i + 1]!, o.z - pezzi[i + 2]!);
        const u = s.dot(h) / det;
        if (u < 0 || u > 1) continue;
        qv.crossVectors(s, e1);
        const v = n.dot(qv) / det;
        if (v < 0 || u + v > 1) continue;
        const dist = e2.dot(qv) / det;
        if (dist >= 0 && dist <= DIST) return true;
      }
    }
    return false;
  };
  for (let t = 0; t < out.length; t++) {
    const i = t * 9;
    a.set(corpo[i]!, corpo[i + 1]!, corpo[i + 2]!); b.set(corpo[i + 3]!, corpo[i + 4]!, corpo[i + 5]!); c.set(corpo[i + 6]!, corpo[i + 7]!, corpo[i + 8]!);
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    if (n.lengthSq() < 1e-14) continue;
    n.normalize();
    let ok = true;
    for (const p of [a, b, c, m.copy(a).add(b).add(c).multiplyScalar(1 / 3)]) {
      o.copy(p).addScaledVector(n, 0.002);
      if (!tocca()) { ok = false; break; }
    }
    if (ok) out[t] = 1;
  }
  return out;
}
