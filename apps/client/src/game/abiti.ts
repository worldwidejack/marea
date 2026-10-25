// Vestiti e cappelli del Mercante addosso all'avatar (avatar.json `abiti`, cappelli con `modello`): glb `abt_<id>` / `cap_<id>` di
// manifest_abiti.json (assets/blender/models_abiti.py), scaricati solo quando qualcuno li indossa. Ogni pezzo è una SkinnedMesh sullo stesso
// scheletro del chr_base: si lega alle ossa dell'avatar per nome e segue le sue clip. La pelle sotto (game/abiti_copre.ts) il corpo non la
// disegna più: geometria del corpo con l'indice ridotto, in memoria una volta per combinazione di pezzi (tutti gli avatar la condividono).
// Materiali per nome: mat_abito colori nei vertici, mat_luce accesi senza ombre (neon), mat_vetro semitrasparente (non copre la pelle),
// mat_nascondi invisibile (copre e basta: la gamba sotto la gamba di legno).
import * as THREE from 'three';
import type { Loader } from '../render/loader.ts';
import { coperti, triRiposo } from './abiti_copre.ts';
import type { Tri } from './abiti_copre.ts';

/** Il disegno 2D di un cappello o di un vestito (assets/blender/anteprime_abiti.py): menù del Mercante e Borsa. */
export const disegnoCappello = (id: string): string => `/assets/abiti/cap_${id}.png`;
export const disegnoAbito = (id: string): string => `/assets/abiti/abt_${id}.png`;

export type Vesti = {
  /** I pezzi da indossare (nomi di modello, `abt_…`, `cap_…`, o null). L'ultima chiamata vince; si carica senza bloccare. */
  set(abito: string | null, cappello: string | null): void;
  /** Nasconde il vestito (non il cappello): nel dungeon si vede l'armatura del personaggio. */
  visibile(on: boolean): void;
  stato(): { abito: string | null; cappello: string | null; pelleNascosta: number };
};

type Pezzo = { meshes: THREE.SkinnedMesh[]; tri: Tri };
const MAT = new Map<string, THREE.Material>();
function materiale(nome: string): THREE.Material {
  const k = /^mat_(luce|vetro|nascondi)/.exec(nome)?.[1] ?? 'abito';
  let m = MAT.get(k);
  if (!m) {
    m = k === 'luce' ? new THREE.MeshBasicMaterial({ vertexColors: true })
      : k === 'vetro' ? new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    m.name = 'mat_' + k;
    MAT.set(k, m);
  }
  return m;
}

/** Copertura per corpo e pezzi: chiave = uuid della geometria del corpo + nomi dei pezzi. */
const COPRE = new Map<string, THREE.BufferGeometry>();
const TRI_CORPO = new WeakMap<THREE.BufferGeometry, Tri>();
const TRI_PEZZO = new WeakMap<THREE.BufferGeometry, Tri>();

/** `dopo`: chiamata quando i pezzi voluti sono addosso (o non si trovano): avatar.ts spegne lì il cappello di ripiego. */
export function creaVesti(o: { loader: Loader; root: THREE.Object3D; rest: Map<string, THREE.Matrix4>; dopo?(cappello: string | null): void }): Vesti {
  const ossa = new Map<string, THREE.Bone>();
  o.root.traverse((n) => { if ((n as THREE.Bone).isBone) ossa.set(n.name, n as THREE.Bone); });
  // il corpo: le SkinnedMesh del chr_base, non i cappelli di partenza
  const corpo: { sm: THREE.SkinnedMesh; geo: THREE.BufferGeometry }[] = [];
  o.root.traverse((n) => { const sm = n as THREE.SkinnedMesh; if (sm.isSkinnedMesh && !/^(cappello|capelli)_/.test(sm.name) && !/^cappello_/.test(sm.parent?.name ?? '')) corpo.push({ sm, geo: sm.geometry }); });
  const caricati = new Map<string, Promise<Pezzo | null>>();
  let gen = 0, voluto: [string | null, string | null] = [null, null], addosso: Record<'abito' | 'cappello', Pezzo | null> = { abito: null, cappello: null }, nascosti = 0, vis = true;

  async function carica(nome: string): Promise<Pezzo | null> {
    if (!o.loader.has(nome)) await o.loader.extend('manifest_abiti.json').catch(() => undefined);
    if (!o.loader.has(nome)) return null;
    const { scene } = await o.loader.load(nome);
    const meshes: THREE.SkinnedMesh[] = [], tris: Tri[] = [];
    scene.traverse((n) => { const sm = n as THREE.SkinnedMesh; if (sm.isSkinnedMesh) meshes.push(sm); });
    for (const sm of meshes) {
      const nm = (sm.material as THREE.Material).name;
      // le ossa del pezzo diventano quelle dell'avatar (stessi nomi, stessa posa a riposo)
      const bones = sm.skeleton.bones.map((b) => ossa.get(b.name) ?? b);
      sm.bind(new THREE.Skeleton(bones, sm.skeleton.boneInverses), sm.bindMatrix);
      sm.material = materiale(nm);
      sm.frustumCulled = false; sm.castShadow = !/vetro|nascondi/.test(nm); sm.visible = !/nascondi/.test(nm);
      sm.name = 'pezzo_' + nome;
      if (/vetro/.test(nm)) continue;
      let t = TRI_PEZZO.get(sm.geometry);
      if (!t) { t = triRiposo(sm, o.rest); TRI_PEZZO.set(sm.geometry, t); }
      tris.push(t);
    }
    const tri = new Float32Array(tris.reduce((s, t) => s + t.length, 0));
    let off = 0;
    for (const t of tris) { tri.set(t, off); off += t.length; }
    return { meshes, tri };
  }
  const prendi = (nome: string | null): Promise<Pezzo | null> => {
    if (!nome) return Promise.resolve(null);
    let p = caricati.get(nome);
    if (!p) { p = carica(nome).catch((e) => { console.warn(`[marea] ${nome} non caricabile`, e); return null; }); caricati.set(nome, p); }
    return p;
  };

  /** Mette il corpo con la pelle coperta tolta (o quello intero). */
  function pelle(): void {
    const pezzi = [vis ? addosso.abito : null, addosso.cappello].filter((p): p is Pezzo => !!p);
    nascosti = 0;
    for (const c of corpo) {
      if (!pezzi.length) { c.sm.geometry = c.geo; continue; }
      const key = `${c.geo.uuid}|${[vis ? voluto[0] : null, voluto[1]].join('|')}`;
      let g = COPRE.get(key);
      if (!g) {
        let tc = TRI_CORPO.get(c.geo);
        if (!tc) { tc = triRiposo(c.sm, o.rest); TRI_CORPO.set(c.geo, tc); }
        const tutti = new Float32Array(pezzi.reduce((s, p) => s + p.tri.length, 0));
        let off = 0;
        for (const p of pezzi) { tutti.set(p.tri, off); off += p.tri.length; }
        const via = coperti(tc, tutti), idx = c.geo.getIndex(), keep: number[] = [];
        for (let t = 0; t < via.length; t++) if (!via[t]) for (let k = 0; k < 3; k++) keep.push(idx ? idx.getX(t * 3 + k) : t * 3 + k);
        g = new THREE.BufferGeometry();
        for (const [n, a] of Object.entries(c.geo.attributes)) g.setAttribute(n, a);
        g.setIndex(keep);
        g.boundingSphere = c.geo.boundingSphere; g.boundingBox = c.geo.boundingBox;
        g.userData['nascosti'] = via.length - keep.length / 3;
        COPRE.set(key, g);
      }
      nascosti += Number(g.userData['nascosti'] ?? 0);
      c.sm.geometry = g;
    }
  }

  async function aggiorna(): Promise<void> {
    const my = ++gen, [na, nc] = voluto;
    const [pa, pc] = await Promise.all([prendi(na), prendi(nc)]);
    if (my !== gen) return;
    for (const [k, p] of [['abito', pa], ['cappello', pc]] as const) {
      const old = addosso[k];
      if (old !== p) { for (const m of old?.meshes ?? []) m.removeFromParent(); for (const m of p?.meshes ?? []) o.root.add(m); }
      addosso[k] = p;
    }
    for (const m of addosso.abito?.meshes ?? []) m.visible = vis && !/nascondi/.test((m.material as THREE.Material).name);
    pelle();
    o.dopo?.(addosso.cappello ? nc : null);
  }

  return {
    set(abito, cappello) {
      if (voluto[0] === abito && voluto[1] === cappello) return;
      voluto = [abito, cappello];
      void aggiorna();
    },
    visibile(on) { if (on === vis) return; vis = on; void aggiorna(); },
    stato: () => ({ abito: addosso.abito ? voluto[0] : null, cappello: addosso.cappello ? voluto[1] : null, pelleNascosta: nascosti }),
  };
}
