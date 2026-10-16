// Nuvole (#361), i corpi: batuffoli low-poly a facce piatte coi colori della palette (pietre e rocce), illuminati come il resto del
// mondo (giorno, tramonto, notte). Tutte le nuvole in un InstancedMesh solo: una draw call. La forma di ogni nuvola nasce dal suo seme
// (sim/meteo.ts `forma`): stessa nuvola, stessi batuffoli per tutti. Riempiono l'ellisse della sim, così l'ombra (passata finale) e la
// pioggia cadono proprio sotto.
// La camera di MAREA è bassa: una nuvola tra la camera e chi gioca gli starebbe davanti. I batuffoli più vicini alla camera di chi gioca
// (in profondità) si sciolgono a gradini: si vedono le nuvole dietro e attorno, mai sopra la testa; sotto restano ombra e pioggia.
// Il lampo dei temporali: una spezzata gialla dalla pancia della nuvola al mare (LineSegments, una draw call solo mentre c'è).
import * as THREE from 'three';
import type { NuvolaTipo } from '@marea/content';
import type { Lampo, Nuvola } from '@marea/sim/meteo.ts';

/** Come si disegnano le nuvole: le due varianti per la scelta di Jack (#361). Aspetto, non numeri di gioco. */
export type StileNuvole = {
  nome: 'A' | 'B';
  /** Quota della pancia (m sul mare): da qui in giù cadono le gocce. */
  quota: number;
  /** Altezza di un batuffolo al centro della nuvola (m). */
  spessore: number;
  /** Raggio orizzontale dei batuffoli (m, min e max) e quanto sono fitti (passo/raggio). */
  batuffolo: [number, number]; passo: number;
  /** Forma del batuffolo: icosaedro tondo o lastra a 7 lati (piatta, a strati). */
  forma: 'tondo' | 'lastra';
};
export const STILI: Record<'A' | 'B', StileNuvole> = {
  A: { nome: 'A', quota: 6, spessore: 4.5, batuffolo: [6, 11], passo: 1.25, forma: 'tondo' },
  B: { nome: 'B', quota: 8.5, spessore: 2.2, batuffolo: [10, 18], passo: 1.1, forma: 'lastra' },
};
/** Colori per tipo (palette, ART_BIBLE §2): [cima, pancia]. */
const COLORI: Record<NuvolaTipo, [string, string]> = {
  bianca: ['#F4E3C1', '#E8E1D6'],
  grigia: ['#E8E1D6', '#B9AFA3'],
  pioggia: ['#B9AFA3', '#7F7568'],
  temporale: ['#7F7568', '#4A4340'],
};
/** Batuffoli al massimo (tutte le nuvole vicine insieme). */
const MAXB = 420;

type Batuffolo = { u: number; v: number; rh: number; h: number; y: number; cima: boolean };
/** Generatore piccolo e fisso (mulberry32): la stessa forma su ogni dispositivo. */
function rngDi(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** I batuffoli di una nuvola (coordinate in metri lungo il verso u e di traverso v), su una griglia sfalsata dentro l'ellisse. */
function disponi(n: Nuvola, st: StileNuvole): Batuffolo[] {
  const r = rngDi(n.forma), out: Batuffolo[] = [];
  const [b0, b1] = st.batuffolo, rb = Math.max(b0, Math.min(b1, 0.32 * Math.min(n.rx, n.rz))), passo = rb * st.passo;
  for (let row = 0, v = -n.rz; v <= n.rz; row++, v += passo * 0.866) {
    for (let u = -n.rx + (row % 2) * passo * 0.5; u <= n.rx; u += passo) {
      const ju = u + (r() - 0.5) * passo * 0.5, jv = v + (r() - 0.5) * passo * 0.5;
      const q = (ju / n.rx) ** 2 + (jv / n.rz) ** 2;
      if (q > 0.78) continue; // dentro l'ellisse: il bordo dei batuffoli arriva circa al bordo dell'ombra
      const cupola = 1 - 0.45 * q; // più alta al centro
      const h = st.spessore * cupola * (0.75 + 0.35 * r());
      out.push({ u: ju, v: jv, rh: rb * (0.8 + 0.4 * r()), h, y: 0, cima: false });
      if (st.forma === 'tondo' && q < 0.35 && r() < 0.55) out.push({ u: ju + (r() - 0.5) * rb, v: jv + (r() - 0.5) * rb, rh: rb * (0.5 + 0.25 * r()), h: h * 0.7, y: h * 0.75, cima: true });
      if (st.forma === 'lastra' && q < 0.4 && r() < 0.6) out.push({ u: ju + (r() - 0.5) * rb, v: jv + (r() - 0.5) * rb, rh: rb * (0.55 + 0.2 * r()), h: h * 0.8, y: h, cima: true });
    }
  }
  return out;
}

export type Nuvole = {
  group: THREE.Group;
  /** Disegna le nuvole `ns` (già spostate sull'immagine più vicina a chi gioca). `fuoco` = chi gioca; la camera per sciogliere quelle davanti. */
  update(ns: readonly Nuvola[], camera: THREE.Camera, fuoco: { x: number; y: number; z: number }): void;
  /** Il lampo acceso adesso (null = spento). */
  lampo(l: Lampo | null): void;
  /** Batuffoli disegnati e nuvole con almeno un batuffolo (per i test). */
  readonly batuffoli: number; readonly disegnate: number;
  readonly stile: StileNuvole;
};

export function createNuvole(st: StileNuvole): Nuvole {
  const geo = st.forma === 'tondo' ? new THREE.IcosahedronGeometry(1, 1) : new THREE.CylinderGeometry(1, 1, 1, 7, 1);
  if (st.forma === 'tondo') geo.translate(0, 1, 0).scale(1, 0.5, 1); // da 0 a 1 in altezza: la pancia piatta sta sulla quota
  else geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  mat.name = 'nuvole';
  const mesh = new THREE.InstancedMesh(geo, mat, MAXB);
  mesh.name = 'nuvole_corpi'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color('#ffffff'));
  // lampo: 9 segmenti a zig-zag, due fili affiancati perché a metà risoluzione resti visibile
  const lpos = new Float32Array(9 * 2 * 2 * 3);
  const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  const lmat = new THREE.LineBasicMaterial({ color: '#F5D547', fog: false, depthWrite: false }); lmat.name = 'lampo';
  const fulmine = new THREE.LineSegments(lgeo, lmat); fulmine.name = 'lampo'; fulmine.frustumCulled = false; fulmine.visible = false;
  const group = new THREE.Group(); group.name = 'nuvole'; group.add(mesh, fulmine);
  const forme = new Map<string, Batuffolo[]>();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const avanti = new THREE.Vector3(), col = new THREE.Color(), cima = new THREE.Color(), pancia = new THREE.Color();
  let batuffoli = 0, disegnate = 0, lampoSeme = -1;
  return {
    group, stile: st,
    get batuffoli() { return batuffoli; }, get disegnate() { return disegnate; },
    update(ns, camera, f) {
      camera.getWorldDirection(avanti);
      const cp = camera.position, dF = (f.x - cp.x) * avanti.x + (f.y - cp.y) * avanti.y + (f.z - cp.z) * avanti.z;
      const vive = new Set<string>();
      let i = 0; disegnate = 0;
      for (const n of ns) {
        const key = `${n.id}:${st.nome}`;
        vive.add(key);
        let bs = forme.get(key);
        if (!bs) { bs = disponi(n, st); forme.set(key, bs); }
        cima.set(COLORI[n.tipo][0]); pancia.set(COLORI[n.tipo][1]);
        const crescita = 0.35 + 0.65 * n.k; // nasce piccola e si gonfia a gradini (k è già a gradini)
        let qualcuno = false;
        q.setFromAxisAngle(up, -Math.atan2(n.dz, n.dx));
        for (const b of bs) {
          if (i >= MAXB) break;
          const x = n.x + b.u * n.dx - b.v * n.dz, z = n.z + b.u * n.dz + b.v * n.dx;
          // davanti a chi gioca (più vicino alla camera, con tutto il batuffolo): si scioglie in 3 gradini su 6 m
          const d = (x - cp.x) * avanti.x + (st.quota - cp.y) * avanti.y + (z - cp.z) * avanti.z - b.rh;
          const via = Math.floor(Math.max(0, Math.min(1, (d - dF - 1) / 6)) * 3 + 1e-9) / 3;
          if (via <= 0) continue;
          const s = crescita * via;
          p.set(x, st.quota + b.y, z); sc.set(b.rh * s, b.h * s, b.rh * s);
          mesh.setMatrixAt(i, m4.compose(p, q, sc));
          mesh.setColorAt(i, col.copy(b.cima || b.h > st.spessore * 0.7 ? cima : pancia)); // i batuffoli alti col colore della cima
          i++; qualcuno = true;
        }
        if (qualcuno) disegnate++;
      }
      for (const k of forme.keys()) if (!vive.has(k)) forme.delete(k);
      mesh.count = i; batuffoli = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    lampo(l) {
      if (!l) { fulmine.visible = false; return; }
      fulmine.visible = true;
      if (l.seme === lampoSeme) return;
      lampoSeme = l.seme;
      const r = rngDi(l.seme);
      let x = l.x, z = l.z, y = st.quota, k = 0;
      for (let s = 0; s < 9; s++) {
        const y2 = st.quota * (1 - (s + 1) / 9), x2 = l.x + (r() - 0.5) * 3.2, z2 = l.z + (r() - 0.5) * 3.2;
        for (const o of [0, 0.18]) { lpos.set([x + o, y, z, x2 + o, y2, z2], k); k += 6; }
        x = x2; z = z2; y = y2;
      }
      lgeo.attributes.position!.needsUpdate = true;
    },
  };
}
