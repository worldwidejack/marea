// Luce vera di notte (#60): lanterne, fili di lanterne e insegne al neon fanno luce attorno quando il ciclo porta il buio.
// Poche luci puntiformi sempre nello stesso numero (POOL: three non ricompila gli shader quando cambiano solo intensità e posto),
// date ogni ¼ s ai punti luce più vicini a chi gioca; senza ombre. Più una «lampadina» non illuminata (MeshBasic, un'istanza per
// punto) che di notte fa brillare la carta delle lanterne. Si accende solo col ciclo acceso; di giorno tutto a zero e nascosto.
import * as THREE from 'three';
import { P } from './island_parts.ts';

/** Quante luci vere al massimo, tutte attorno a chi gioca. */
export const POOL = 6;
/** Fin dove arriva una luce (m) e quanto è forte a notte piena. Aspetto, non numero di gioco. */
const RAGGIO = 7, FORZA = 9;

type Punto = { x: number; y: number; z: number; col: string };
type Bulbo = { x: number; y: number; z: number; ry: number; kind: 'carta' | 'insegna' };
export type Luci = { group: THREE.Group; set(k: number, x: number, z: number, nowMs: number): void; readonly accese: number; readonly punti: number };

/** Dove stanno le lampade di una decorazione (offset locali come in island_parts.ts, ruotati di `rot` attorno a Y). */
function lampade(k: string): { at: [number, number, number]; col: string; kind: Bulbo['kind'] }[] {
  if (k === 'lanterna') return [{ at: [0, 1.62, -0.45], col: P.arancio, kind: 'carta' }];
  if (k === 'filo_lanterne') return [-1.2, -0.4, 0.4, 1.2].map((x) => ({ at: [x, 2.4, 0] as [number, number, number], col: P.arancio, kind: 'carta' as const }));
  if (k === 'insegna_neon') return [{ at: [0, 1.9, 0], col: P.rosaNeon, kind: 'insegna' }];
  // isole a tema (#68): lanterne di pietra del Giardino, bracieri del Vulcano
  if (k === 'lanterna_pietra') return [{ at: [0, 1.38, 0], col: P.arancio, kind: 'carta' }];
  if (k === 'braciere') return [{ at: [0, 1.6, 0], col: P.arancio, kind: 'carta' }];
  return [];
}

export function createLuci(o: { props: readonly { k: string; x: number; z: number; rot: number }[]; groundY(x: number, z: number): number }): Luci {
  const group = new THREE.Group(); group.name = 'luci';
  const punti: Punto[] = [], bulbi: Bulbo[] = [];
  for (const p of o.props) {
    const ls = lampade(p.k); if (!ls.length) continue;
    const c = Math.cos(p.rot), s = Math.sin(p.rot), y0 = o.groundY(p.x, p.z);
    const pos = ls.map((l) => ({ x: p.x + l.at[0] * c + l.at[2] * s, y: y0 + l.at[1], z: p.z - l.at[0] * s + l.at[2] * c, l }));
    for (const q of pos) bulbi.push({ x: q.x, y: q.y, z: q.z, ry: p.rot, kind: q.l.kind });
    // un filo di 4 lanterne fa una luce sola, al centro
    const m = pos.reduce((a, q) => ({ x: a.x + q.x / pos.length, y: a.y + q.y / pos.length, z: a.z + q.z / pos.length }), { x: 0, y: 0, z: 0 });
    punti.push({ ...m, y: m.y - 0.2, col: ls[0]!.col });
  }
  const pool: THREE.PointLight[] = [];
  for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(P.arancio, 0, RAGGIO, 1.2); l.castShadow = false; pool.push(l); group.add(l); }

  // lampadine: carta delle lanterne (cilindro appena più largo di quello del modello) e pannello delle insegne
  const mk = (geo: THREE.BufferGeometry, col: string, list: Bulbo[]) => {
    if (!list.length) return null;
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length); mesh.name = 'lampadine'; mesh.frustumCulled = false;
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    list.forEach((b, i) => { mm.compose(v.set(b.x, b.y, b.z), q.setFromEuler(e.set(0, b.ry, 0)), one); mesh.setMatrixAt(i, mm); });
    mesh.visible = false; group.add(mesh);
    return { mesh, mat };
  };
  const carta = mk(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 6), P.giallo, bulbi.filter((b) => b.kind === 'carta'));
  const insegna = mk(new THREE.BoxGeometry(1.24, 0.74, 0.16), P.rosaNeon, bulbi.filter((b) => b.kind === 'insegna'));

  let accese = 0, next = 0;
  const d2 = (p: Punto, x: number, z: number) => (p.x - x) ** 2 + (p.z - z) ** 2;
  return {
    group,
    get accese() { return accese; },
    get punti() { return punti.length; },
    set(k, x, z, nowMs) {
      const on = k > 0.02;
      for (const b of [carta, insegna]) if (b) { b.mesh.visible = on; b.mat.opacity = Math.min(1, k * 1.1); }
      if (!on) { if (accese) { for (const l of pool) l.intensity = 0; accese = 0; } return; }
      if (nowMs >= next) { // i più vicini: un ordinamento di qualche decina di punti ogni ¼ s
        next = nowMs + 250;
        const vicini = punti.filter((p) => d2(p, x, z) < 60 * 60).sort((a, b) => d2(a, x, z) - d2(b, x, z)).slice(0, POOL);
        pool.forEach((l, i) => { const p = vicini[i]; if (p) { l.position.set(p.x, p.y, p.z); l.color.set(p.col); l.userData['on'] = 1; } else l.userData['on'] = 0; });
        accese = vicini.length;
      }
      // tremolio leggero e diverso per ogni luce, come una fiamma dietro la carta
      const t = nowMs / 1000;
      pool.forEach((l, i) => { l.intensity = l.userData['on'] ? FORZA * k * (0.92 + 0.08 * Math.sin(t * 7 + i * 1.7) * Math.sin(t * 3.1 + i)) : 0; });
    },
  };
}
