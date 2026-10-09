// Archivio Navigazionale (Epopea della Regata, dungeon 2): segnaposto in codice finché il Claude di Jack non genera i modelli in Blender
// (assets/blender/models_archivio.py, stessi nomi). Kit dello stile (pavimento di tavole con le venature d'ottone, muri di scaffali pieni
// di carte arrotolate, scaffali = colonne, rastrelliere a grata), forme dei nemici (Archivista a Molla, Drone Idro-Ragno, Aerostato-Spia,
// l'Astrolabio Impazzito coi suoi anelli) e gli effetti della scena: frecce del vento a terra nelle correnti (calma, avviso, raffica),
// carte che volano, timone del Condotto Maestro, bombe a pressione, rosa dei venti e raggio dell'Astrolabio. Solo colori della palette,
// texture a pixel nearest, facce piatte; quando arriva un modello vero nel manifest vince lui.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, block, merged, painted, px, speckle, strata, tex } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import type { Part } from './dungeon_kit.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { vento } from '../audio/ponte.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const anello = (r: number, t: number, s = 10) => new THREE.TorusGeometry(r, t, 4, s);
const vc = new Map<string, THREE.MeshLambertMaterial>();
/** Materiale a colori per vertice (uno per uso: i nemici lo clonano per lampeggiare). */
const colori = (k = 'base'): THREE.MeshLambertMaterial => {
  let m = vc.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); m.name = 'mat_archivio_' + k; vc.set(k, m); }
  return m;
};
const texMat = (t: THREE.Texture): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ map: t, flatShading: true });
const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;

// ——— kit dello stile ———
type KitArchivio = Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'grata', Part[]>;
let kit: KitArchivio | null = null;
/** Pezzi del kit `archivio` (cache): una geometria e un materiale per pezzo. */
export function kitArchivio(top: number): KitArchivio {
  if (kit) return kit;
  const pav = tex('pav', 'archivio', (g, r) => {
    px(g, PAL.legno, 0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) px(g, PAL.legnoScuro, 0, y, 32, 1); // tavole da mezzo metro
    for (let y = 0; y < 32; y += 8) px(g, PAL.legnoScuro, (y * 5 + 7) % 32, y + 1, 1, 7); // giunte sfalsate
    for (const [x, y] of [[3, 3], [27, 11], [11, 19], [21, 27]] as const) px(g, PAL.arancio, x, y); // chiodi d'ottone
    speckle(g, r, PAL.legnoChiaro, 10, 0, 32, 2, 1); speckle(g, r, PAL.legnoScuro, 14, 0, 32, 2, 1); speckle(g, r, PAL.ombraCalda, 8, 0, 32);
    speckle(g, r, PAL.sabbiaChiara, 3, 0, 32, 2, 2); // pezzetti di carta
    strata(g, [[PAL.legnoScuro, 4], [PAL.ombraCalda, 32]]);
  });
  const muro = tex('muro', 'archivio', (g, r) => {
    px(g, PAL.legnoScuro, 0, 0, 32, 32); speckle(g, r, PAL.ombraCalda, 24, 0, 32); // la cima, vista dall'alto
    // fianco (32 righe = 2 m dall'alto): cornice d'ottone, tre ripiani di carte arrotolate, zoccolo scuro
    px(g, PAL.ombraCalda, 0, 32, 32, 32);
    px(g, PAL.arancio, 0, 33, 32, 1);
    for (const y of [36, 44, 52]) {
      px(g, PAL.legnoScuro, 0, y + 6, 32, 1); px(g, PAL.legno, 0, y + 7, 32, 1); // ripiano
      for (let x = 1; x < 31; x += 3) { const c = r.next() < 0.7 ? PAL.sabbiaChiara : r.next() < 0.5 ? PAL.sabbia : PAL.pietraChiara; px(g, c, x, y + 3, 2, 2); px(g, PAL.legnoChiaro, x, y + 4, 1, 1); } // rotoli visti di testa
      if (r.next() < 0.6) px(g, PAL.rosso, r.int(2, 28), y + 1, 2, 5); // un libro rilegato
    }
    for (const x of [0, 15, 31]) px(g, PAL.legnoScuro, x, 34, 1, 26); // montanti
    px(g, PAL.legnoScuro, 0, 60, 32, 4);
  });
  const scaffale = merged([
    painted(box(0.1, 2.3, 0.8), PAL.legnoScuro, M(-0.8, 1.15, 0)), painted(box(0.1, 2.3, 0.8), PAL.legnoScuro, M(0.8, 1.15, 0)), // fianchi
    ...[0.08, 0.6, 1.2, 1.8].map((y) => painted(box(1.6, 0.08, 0.8), PAL.legno, M(0, y, 0))), // ripiani
    painted(box(1.45, 0.4, 0.82), PAL.sabbiaChiara, M(0, 0.32, 0)), painted(box(1.25, 0.42, 0.82), PAL.sabbia, M(-0.1, 0.85, 0)), painted(box(1.4, 0.38, 0.82), PAL.pietraChiara, M(0.04, 1.43, 0)),
    painted(box(0.16, 0.44, 0.84), PAL.rosso, M(0.62, 0.86, 0)), painted(box(0.15, 0.4, 0.84), PAL.acquaProfonda, M(-0.62, 1.43, 0)), painted(box(0.14, 0.36, 0.84), PAL.erbaScura, M(0.6, 0.3, 0)),
    painted(box(1.2, 0.36, 0.82), PAL.sabbiaChiara, M(0.1, 2.0, 0)),
    painted(box(1.8, 0.1, 0.9), PAL.arancio, M(0, 2.3, 0)), // cornice d'ottone
  ]);
  const grata = merged([
    ...[-0.8, -0.27, 0.27, 0.8].map((x) => painted(box(0.08, 2.0, 0.08), PAL.roccia, M(x, 1.0, 0))),
    ...[0.15, 0.85, 1.55, 1.98].map((y) => painted(box(1.7, 0.07, 0.08), PAL.pietraScura, M(0, y, 0))),
    painted(cil(0.09, 0.09, 1.2, 6), PAL.sabbiaChiara, M(-0.1, 1.2, -0.12, 0, 0, Math.PI / 2)), // carte infilate nella grata
    painted(cil(0.08, 0.08, 0.9, 6), PAL.sabbia, M(0.25, 0.5, -0.1, 0, 0, Math.PI / 2)),
    painted(box(0.5, 0.35, 0.02), PAL.sabbiaChiara, M(0.45, 1.7, -0.06)),
  ]);
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: scaffale, mat: colori('kit') }],
    grata: [{ geo: grata, mat: colori('grata') }],
  };
  return kit;
}

// ——— forme dei nemici (−Z avanti, pivot a terra; chi vola lo alza dungeon_actors.ts) ———
const FORME: Record<string, () => THREE.BufferGeometry> = {
  // Archivista a Molla: bipede alto e magro, torso a cilindro d'ottone, chiave della carica sulla schiena, monocolo, braccia a lama
  nem_archivista: () => merged([
    painted(box(0.1, 0.8, 0.1), PAL.pietraScura, M(-0.13, 0.4, 0, 0.15, 0, 0)), painted(box(0.1, 0.8, 0.1), PAL.pietraScura, M(0.13, 0.4, 0, -0.15, 0, 0)),
    painted(box(0.18, 0.06, 0.28), PAL.neroCaldo, M(-0.13, 0.03, -0.06)), painted(box(0.18, 0.06, 0.28), PAL.neroCaldo, M(0.13, 0.03, -0.06)),
    painted(cil(0.2, 0.16, 0.6, 7), PAL.arancio, M(0, 1.1, 0)),
    painted(cil(0.21, 0.21, 0.06, 7), PAL.legnoScuro, M(0, 0.95, 0)), painted(cil(0.21, 0.21, 0.06, 7), PAL.legnoScuro, M(0, 1.3, 0)),
    painted(box(0.06, 0.06, 0.25), PAL.giallo, M(0, 1.15, 0.28)), painted(box(0.34, 0.12, 0.04), PAL.giallo, M(0, 1.15, 0.4)), // chiave della carica
    painted(box(0.28, 0.24, 0.26), PAL.legnoScuro, M(0, 1.55, 0)),
    painted(cil(0.07, 0.07, 0.04, 8), PAL.acquaBassa, M(0.07, 1.57, -0.14, Math.PI / 2, 0, 0)), // monocolo
    painted(box(0.3, 0.04, 0.3), PAL.ombraCalda, M(0, 1.69, 0)), painted(cil(0.1, 0.12, 0.14, 6), PAL.ombraCalda, M(0, 1.77, 0)), // cappello
    painted(box(0.06, 0.45, 0.06), PAL.pietraScura, M(-0.27, 1.12, -0.05, 0.3, 0, 0.2)), painted(box(0.06, 0.45, 0.06), PAL.pietraScura, M(0.27, 1.12, -0.05, 0.3, 0, -0.2)),
    painted(box(0.03, 0.08, 0.6), PAL.pietraChiara, M(-0.31, 0.9, -0.42)), painted(box(0.03, 0.08, 0.6), PAL.pietraChiara, M(0.31, 0.9, -0.42)), // lame
  ]),
  // Drone Idro-Ragno: cupola d'ottone, otto zampe sottili piegate, lanciarpioni sulla schiena, occhi rossi
  nem_idroragno: () => merged([
    painted(cil(0.32, 0.38, 0.22, 8), PAL.legnoScuro, M(0, 0.42, 0)),
    painted(cil(0.05, 0.32, 0.22, 8), PAL.arancio, M(0, 0.64, 0)),
    ...[-1, 1].flatMap((sx) => [-0.25, -0.08, 0.08, 0.25].flatMap((z, k) => [
      painted(box(0.4, 0.05, 0.05), PAL.pietraScura, M(sx * 0.45, 0.55, z, 0, 0, sx * -0.6 + (k - 1.5) * 0.04)),
      painted(box(0.05, 0.5, 0.05), PAL.pietraScura, M(sx * 0.7, 0.3, z * 1.4, 0, 0, sx * 0.25)),
    ])),
    painted(cil(0.06, 0.07, 0.7, 6), PAL.roccia, M(0, 0.78, -0.15, Math.PI / 2, 0, 0)), // lanciarpioni
    painted(cil(0.0, 0.07, 0.18, 6), PAL.pietraChiara, M(0, 0.78, -0.58, -Math.PI / 2, 0, 0)),
    painted(box(0.07, 0.06, 0.04), PAL.rosso, M(-0.1, 0.48, -0.36)), painted(box(0.07, 0.06, 0.04), PAL.rosso, M(0.1, 0.48, -0.36)),
  ]),
  // Aerostato-Spia: pallone rattoppato con le fasce d'ottone, gondola con l'occhio-lente, elica e due bombe appese
  nem_aerostato: () => merged([
    painted(cil(0.45, 0.6, 0.5, 8), PAL.sabbia, M(0, 1.05, 0)), painted(cil(0.6, 0.6, 0.5, 8), PAL.sabbiaChiara, M(0, 1.55, 0)), painted(cil(0.6, 0.3, 0.45, 8), PAL.sabbia, M(0, 2.02, 0)),
    painted(cil(0.62, 0.62, 0.06, 8), PAL.arancio, M(0, 1.3, 0)), painted(cil(0.62, 0.62, 0.06, 8), PAL.arancio, M(0, 1.8, 0)),
    painted(box(0.18, 0.18, 0.02), PAL.legnoChiaro, M(0.25, 1.6, -0.6)), // toppa
    ...[[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([x, z]) => painted(box(0.02, 0.5, 0.02), PAL.ombraCalda, M(x!, 0.6, z!))),
    painted(box(0.55, 0.28, 0.55), PAL.legno, M(0, 0.25, 0)),
    painted(cil(0.11, 0.11, 0.06, 8), PAL.acquaBassa, M(0, 0.27, -0.3, Math.PI / 2, 0, 0)), // occhio-lente
    painted(box(0.5, 0.06, 0.06), PAL.pietraScura, M(0, 0.3, 0.33)), painted(box(0.06, 0.4, 0.04), PAL.pietra, M(0, 0.3, 0.36)), // elica
    painted(cil(0.1, 0.1, 0.18, 6), PAL.neroCaldo, M(-0.15, 0.02, 0)), painted(cil(0.1, 0.1, 0.18, 6), PAL.neroCaldo, M(0.15, 0.02, 0)), // bombe
  ]),
  // Anello dell'Astrolabio: un anello d'ottone tacchettato
  nem_anello: () => merged([
    painted(anello(0.42, 0.07, 12), PAL.arancio, M(0, 0.5, 0)),
    ...[0, 1, 2, 3].map((k) => painted(box(0.08, 0.16, 0.08), PAL.giallo, M(Math.cos(k * Math.PI / 2) * 0.42, 0.5 + Math.sin(k * Math.PI / 2) * 0.42, 0))),
  ]),
};
/** Segnaposto di un nemico dell'Archivio (null = non è uno dei loro). Dell'Astrolabio solo il nucleo: gli anelli (giriAstrolabio) li
 *  aggiunge sempre dungeon_actors.ts, anche al modello vero, perché girano a scatti e spariscono quando si staccano. */
export function formaNemico(model: string): THREE.Object3D | null {
  if (model === 'nem_astrolabio') return astrolabio();
  const f = FORME[model];
  if (!f) return null;
  const m = new THREE.Mesh(f(), colori(model).clone()); m.name = model;
  const g = new THREE.Group(); g.name = model; g.add(m);
  return g;
}
/** L'Astrolabio Impazzito, il nucleo: sfera d'ottone sfaccettata con la lente, la punta e una lancetta che pende. */
function astrolabio(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'nem_astrolabio';
  const mat = colori('nem_astrolabio').clone();
  const nucleo = new THREE.Mesh(merged([
    painted(new THREE.IcosahedronGeometry(0.55, 0), PAL.legnoScuro, M(0, 1.1, 0)),
    painted(new THREE.IcosahedronGeometry(0.4, 0), PAL.arancio, M(0, 1.1, 0, 0.4, 0.3, 0)),
    painted(cil(0.2, 0.2, 0.08, 8), PAL.acquaBassa, M(0, 1.1, -0.5, Math.PI / 2, 0, 0)), // la lente
    painted(cil(0.1, 0.1, 0.1, 6), PAL.neroCaldo, M(0, 1.1, -0.55, Math.PI / 2, 0, 0)),
    painted(box(0.05, 0.45, 0.05), PAL.giallo, M(0, 1.6, 0)), painted(cil(0.0, 0.1, 0.2, 4), PAL.giallo, M(0, 1.9, 0)), // la punta
    painted(box(0.04, 0.4, 0.04), PAL.giallo, M(0.12, 0.65, 0, 0, 0, 0.4)), // lancetta che pende
  ]), mat);
  nucleo.name = 'nem_astrolabio';
  g.add(nucleo);
  return g;
}
/** I tre anelli dell'Astrolabio (equatore, meridiano, inclinato) attorno al nucleo a 1,1 m: gruppi `giro_k` inclinati, con dentro `spin`
 *  che li fa girare nel loro piano. */
export function giriAstrolabio(): THREE.Group[] {
  const mat = colori('nem_astrolabio_giri').clone(), out: THREE.Group[] = [];
  const giri: [number, number, number, string][] = [[0.95, 0, 0, PAL.arancio], [0.8, Math.PI / 2, 0, PAL.giallo], [1.1, 0.5, 0.6, PAL.legnoChiaro]];
  giri.forEach(([r, rx, rz, c], k) => {
    // giro_k inclinato come l'anello; dentro, il gruppo spin lo fa girare nel suo piano
    const giro = new THREE.Group(); giro.name = 'giro_' + k; giro.position.y = 1.1; giro.rotation.set(rx, 0, rz);
    const spin = new THREE.Group(); spin.name = 'spin';
    const m = new THREE.Mesh(merged([painted(anello(r, 0.06, 14), c, M(0, 0, 0, Math.PI / 2, 0, 0)), painted(box(0.12, 0.12, 0.12), PAL.giallo, M(r, 0, 0))]), mat);
    m.name = 'nem_astrolabio';
    spin.add(m); giro.add(spin); out.push(giro);
  });
  return out;
}

// ——— effetti della scena ———
/** `update(…, gioco)`: in gioco il vento che spinge l'eroe si sente (al riparo appena) e la prima volta si dice come si passa (`say`). */
export type ArchivioFx = { tick(v: DungeonView): void; update(t: number, hero: { x: number; z: number }, v: DungeonView, gioco: boolean): void; counts(): { timoni: number; frecce: number; carte: number; bombe: number }; dispose(): void };

/** Timone del Condotto Maestro: ruota di nave su un piedistallo d'ottone (rossa = da girare, gira a scatti, poi verde). */
function timoneObj(): { root: THREE.Group; ruota: THREE.Object3D; luce: THREE.MeshLambertMaterial } {
  const root = new THREE.Group(); root.name = 'timone';
  const base = new THREE.Mesh(merged([
    painted(cil(0.35, 0.45, 0.2, 8), PAL.legnoScuro, M(0, 0.1, 0)),
    painted(box(0.24, 1.0, 0.24), PAL.legno, M(0, 0.7, 0)),
    painted(box(0.36, 0.1, 0.36), PAL.arancio, M(0, 1.2, 0)),
    painted(box(0.5, 0.3, 0.05), PAL.giallo, M(0, 0.6, -0.15)), // targa
  ]), colori('timone'));
  const luce = new THREE.MeshLambertMaterial({ color: PAL.rosso, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.25 });
  const ruota = new THREE.Group(); ruota.position.set(0, 1.35, -0.25);
  const raggi: THREE.BufferGeometry[] = [painted(anello(0.42, 0.05, 10), '#ffffff'), painted(cil(0.09, 0.09, 0.14, 6), '#ffffff', M(0, 0, 0, Math.PI / 2, 0, 0))];
  for (let k = 0; k < 4; k++) raggi.push(painted(box(1.1, 0.06, 0.06), '#ffffff', M(0, 0, 0, 0, 0, (k * Math.PI) / 4)));
  ruota.add(new THREE.Mesh(merged(raggi), luce));
  root.add(base, ruota);
  return { root, ruota, luce };
}

export function createArchivioFx(o: { sc: DungeonScene; say(text: string, ms: number): void; occupato(): boolean }): ArchivioFx {
  const root = new THREE.Group(); root.name = 'archivio_fx'; o.sc.scene.add(root);
  const fy = o.sc.floorY, map = o.sc.map, T = map.tile;
  const timoni = map.timoni.map((t) => { const x = timoneObj(); x.root.position.set(t.x, fy, t.z); root.add(x.root); return { ...x, n: t.n, fermo: false, girato: -1 }; });
  // frecce del vento a terra: una InstancedMesh per corrente (un colore per stato), una freccia per cella, girata verso il vento
  const sagoma = new THREE.Shape([[-0.5, -0.07], [0.05, -0.07], [0.05, -0.25], [0.45, 0], [0.05, 0.25], [0.05, 0.07], [-0.5, 0.07]].map(([x, y]) => new THREE.Vector2(x, y)));
  const frecciaGeo = new THREE.ShapeGeometry(sagoma); frecciaGeo.rotateX(-Math.PI / 2); frecciaGeo.translate(0, 0.03, 0); // freccia piatta che punta verso +x
  const frecce = map.venti.map((v) => {
    const mat = new THREE.MeshBasicMaterial({ color: PAL.acquaProfonda, transparent: true, opacity: 0.6, depthWrite: false });
    const im = new THREE.InstancedMesh(frecciaGeo, mat, v.celle.length); im.name = 'vento_' + v.n; im.frustumCulled = false; im.renderOrder = 1;
    root.add(im);
    const yaw = Math.atan2(-v.dz, v.dx); // la freccia punta verso +x: girata verso il vento
    return { v, im, mat, yaw, stato: '', fase: -1 };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), YA = new THREE.Vector3(0, 1, 0), eu = new THREE.Euler();
  // carte che volano (nelle correnti vicine all'eroe e attorno all'Astrolabio che prepara la raffica)
  const MAXC = 40;
  const carte = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.2), new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, side: THREE.DoubleSide }), MAXC);
  carte.name = 'carte'; carte.frustumCulled = false; root.add(carte);
  const semi = Array.from({ length: MAXC }, (_, i) => ({ a: (i * 0.618) % 1, b: (i * 0.377) % 1, c: (i * 0.231) % 1 }));
  // bombe a pressione: cerchio arancio che si riempie a scatti, la bomba che cade, lo scoppio
  const ringGeo = new THREE.RingGeometry(0.9, 1, 16, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 16); discGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: PAL.arancio, transparent: true, opacity: 0.9, depthWrite: false });
  const discMat = new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.3, depthWrite: false });
  const bombaGeo = merged([painted(new THREE.IcosahedronGeometry(0.22, 0), PAL.neroCaldo), painted(cil(0.04, 0.04, 0.16, 5), PAL.arancio, M(0, 0.24, 0))]);
  const scoppioGeo = merged([painted(new THREE.IcosahedronGeometry(1, 0), PAL.sabbiaChiara), painted(new THREE.IcosahedronGeometry(0.7, 0), PAL.arancio, M(0, 0.1, 0))]);
  const scoppioMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });
  const bombe = new Map<number, { g: THREE.Group; ring: THREE.Mesh; disc: THREE.Mesh; bomba: THREE.Mesh; scoppio: THREE.Mesh }>();
  // Astrolabio: raggio (linea d'avviso sottile, poi raggio spesso) e rosa dei venti (otto stecche dove partirà la prima salva)
  const raggioMat = new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.85, depthWrite: false });
  const raggio = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1), raggioMat); raggio.visible = false; raggio.name = 'raggio'; root.add(raggio);
  const rosaGeo = merged(Array.from({ length: 8 }, (_, k) => painted(box(2.4, 0.04, 0.1), '#ffffff', M(Math.cos(k * Math.PI / 4) * 1.9, 0, Math.sin(k * Math.PI / 4) * 1.9, 0, -k * Math.PI / 4, 0))));
  const rosaMat = new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, transparent: true, opacity: 0.7, depthWrite: false });
  const rosa = new THREE.Mesh(rosaGeo, rosaMat); rosa.visible = false; rosa.name = 'rosa'; root.add(rosa);
  let nCarte = 0, spinte = 0, eraVento = false, consiglio = false;

  return {
    tick(v) {
      for (const k of timoni) {
        const f = v.timoni.find((x) => x.n === k.n)?.fermo ?? false;
        if (f && !k.fermo) k.girato = performance.now() / 1000;
        k.fermo = f;
      }
      const seen = new Set<number>();
      for (const gv of v.geyser) {
        if (!gv.bomba) continue;
        seen.add(gv.id);
        let r = bombe.get(gv.id);
        if (!r) {
          const g = new THREE.Group(); g.position.set(gv.x, fy + 0.04, gv.z); root.add(g);
          const ring = new THREE.Mesh(ringGeo, ringMat), disc = new THREE.Mesh(discGeo, discMat), bomba = new THREE.Mesh(bombaGeo, colori('bomba')), scoppio = new THREE.Mesh(scoppioGeo, scoppioMat);
          ring.scale.setScalar(gv.r); disc.scale.setScalar(gv.r);
          g.add(ring, disc, bomba, scoppio); r = { g, ring, disc, bomba, scoppio }; bombe.set(gv.id, r);
        }
        r.ring.visible = r.disc.visible = r.bomba.visible = !gv.getto; r.scoppio.visible = gv.getto;
        r.disc.scale.setScalar(gv.r * Math.max(0.05, steps(gv.t, 5)));
        r.bomba.position.y = 5 * (1 - steps(gv.t, 8)); // cade a scatti
        if (gv.getto) r.scoppio.scale.setScalar(gv.r * (0.5 + 0.5 * steps(gv.t * 2, 3)));
      }
      for (const [id, r] of bombe) if (!seen.has(id)) { r.g.removeFromParent(); bombe.delete(id); }
    },
    update(t, hero, v, gioco) {
      const h = v.hero;
      if (gioco && (h.vento || h.riparo)) vento(h.vento ? 0.8 : 0.3);
      // la seconda volta che una raffica ti spinge (la prima parla l'Archivista Capo), come si passa: appena nessuno sta parlando
      if (gioco && h.vento && !eraVento && ++spinte === 2) consiglio = true;
      eraVento = !!h.vento;
      if (consiglio && gioco && !o.occupato()) { consiglio = false; o.say('Il vento ti spinge indietro: avanza nella calma, nella raffica riparati dietro uno scaffale', 3600); }
      // timoni: rosso che pulsa (da girare), gira a scatti per un secondo, poi verde
      for (const k of timoni) {
        const lit = o.sc.light(k.root.position.x, k.root.position.z);
        k.root.visible = lit > 0;
        if (!k.root.visible) continue;
        const gira = k.fermo && t - k.girato < 1.2;
        if (gira) k.ruota.rotation.z = Math.floor((t - k.girato) * 10) * (Math.PI / 4);
        const c = k.fermo ? (gira ? PAL.arancio : PAL.erbaChiara) : PAL.rosso;
        if (k.luce.color.getHexString() !== c.slice(1).toLowerCase()) { k.luce.color.set(c); k.luce.emissive.set(c); }
        k.luce.emissiveIntensity = k.fermo ? 0.2 : 0.15 + 0.25 * (Math.floor(t * 3) % 2);
      }
      // frecce del vento: spente se ferma, fioche in calma, lampeggiano nell'avviso, accese e in corsa nella raffica
      for (const f of frecce) {
        const sv = v.venti.find((x) => x.n === f.v.n);
        const stato = sv?.stato ?? 'calma';
        const corsa = stato === 'soffia' ? Math.floor(t * 8) % 4 : 0;
        const key = `${stato}|${corsa}|${stato === 'avviso' ? Math.floor(t * 6) % 2 : 0}`;
        if (key === f.stato) continue;
        f.stato = key;
        f.mat.color.set(stato === 'soffia' ? PAL.acquaBassa : stato === 'avviso' ? (Math.floor(t * 6) % 2 ? PAL.sabbiaChiara : PAL.acqua) : PAL.acquaProfonda);
        f.mat.opacity = stato === 'calma' ? 0.35 : 0.85;
        f.v.celle.forEach((i, n) => {
          const cx = i % map.w, cz = (i - cx) / map.w, x = (cx + 0.5) * T + f.v.dx * corsa * 0.25, z = (cz + 0.5) * T + f.v.dz * corsa * 0.25;
          const show = stato !== 'ferma' && o.sc.light(x, z) > 0;
          m4.compose(p3.set(x, fy, z), q.setFromAxisAngle(YA, f.yaw), s3.setScalar(show ? 1 : 0));
          f.im.setMatrixAt(n, m4);
        });
        f.im.instanceMatrix.needsUpdate = true;
      }
      // carte: nelle correnti in avviso o raffica vicino all'eroe, e attorno all'Astrolabio che prepara la raffica
      nCarte = 0;
      const step = Math.floor(t * 12) / 12;
      for (const f of frecce) {
        const sv = v.venti.find((x) => x.n === f.v.n);
        if (!sv || (sv.stato !== 'soffia' && sv.stato !== 'avviso')) continue;
        const vicine = f.v.celle.filter((i) => { const cx = i % map.w, cz = (i - cx) / map.w; return Math.abs((cx + 0.5) * T - hero.x) < 14 && Math.abs((cz + 0.5) * T - hero.z) < 14; });
        if (!vicine.length) continue;
        const quante = sv.stato === 'soffia' ? 24 : 6, vel = sv.stato === 'soffia' ? 9 : 1.5;
        for (let k = 0; k < quante && nCarte < MAXC; k++) {
          const sd = semi[nCarte]!, i = vicine[Math.floor(sd.a * vicine.length)]!, cx = i % map.w, cz = (i - cx) / map.w;
          const along = ((step * vel + sd.b * 8) % 8) - 4;
          const x = (cx + 0.5) * T + f.v.dx * along - f.v.dz * (sd.c - 0.5) * 1.6, z = (cz + 0.5) * T + f.v.dz * along + f.v.dx * (sd.c - 0.5) * 1.6;
          m4.compose(p3.set(x, fy + 0.3 + sd.c * 1.4 + 0.15 * (Math.floor(t * 8 + k) % 2), z), q.setFromEuler(eu.set(sd.a * 6 + step * 3, sd.b * 6, step * 5)), s3.setScalar(1));
          carte.setMatrixAt(nCarte++, m4);
        }
      }
      const capo = v.nemici.find((n) => n.attacco);
      if (capo?.attacco === 'raffica' && capo.anim === 'prepara') {
        for (let k = 0; k < 16 && nCarte < MAXC; k++) {
          const sd = semi[nCarte]!, a = sd.a * Math.PI * 2 + step * (2 + capo.t * 6), r = 1.4 + sd.b * 2.5 * (1 - capo.t * 0.5);
          m4.compose(p3.set(capo.x + Math.cos(a) * r, fy + 0.4 + sd.c * 2, capo.z + Math.sin(a) * r), q.setFromEuler(eu.set(a, sd.c * 6, step * 4)), s3.setScalar(1));
          carte.setMatrixAt(nCarte++, m4);
        }
      }
      carte.count = nCarte; carte.instanceMatrix.needsUpdate = true;
      // raggio: linea sottile che lampeggia durante l'avviso, raggio spesso e chiaro quando colpisce
      const r = v.nemici.find((n) => n.mira);
      raggio.visible = !!r && o.sc.light(r.x, r.z) > 0;
      if (r?.mira) {
        const dx = r.mira[0] - r.x, dz = r.mira[1] - r.z, len = Math.sqrt(dx * dx + dz * dz), colpisce = r.anim === 'colpisce';
        raggio.position.set((r.x + r.mira[0]) / 2, fy + (colpisce ? 1.1 : 0.06), (r.z + r.mira[1]) / 2);
        raggio.rotation.set(0, Math.atan2(-dz, dx), 0);
        raggio.scale.set(len, colpisce ? 6 : 1, colpisce ? 1.2 : 0.12);
        raggioMat.color.set(colpisce ? PAL.acquaBassa : PAL.rosso);
        raggioMat.opacity = colpisce ? 0.9 : Math.floor(t * (6 + 10 * r.t)) % 2 ? 0.9 : 0.3;
      }
      // rosa dei venti: le otto stecche della prima salva mentre la prepara
      const ro = v.nemici.find((n) => n.attacco === 'rosa' && n.anim === 'prepara');
      rosa.visible = !!ro && o.sc.light(ro.x, ro.z) > 0;
      if (ro) { rosa.position.set(ro.x, fy + 0.05, ro.z); rosaMat.opacity = Math.floor(t * (5 + 10 * ro.t)) % 2 ? 0.8 : 0.25; }
    },
    counts: () => ({ timoni: timoni.length, frecce: frecce.reduce((a, f) => a + f.v.celle.length, 0), carte: nCarte, bombe: bombe.size }),
    dispose() { root.removeFromParent(); frecciaGeo.dispose(); ringGeo.dispose(); discGeo.dispose(); bombaGeo.dispose(); scoppioGeo.dispose(); rosaGeo.dispose(); },
  };
}
