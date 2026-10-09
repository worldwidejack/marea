// Fucina a Pressione (Epopea della Regata, dungeon 3): segnaposto in codice finché il Claude di Jack non genera i modelli in Blender
// (assets/blender/models_fucina.py, stessi nomi). Kit dello stile (pavimento di basalto con le braci, muri di mattoni refrattari col tubo
// d'ottone, colonne = presse a vapore, la Colata Maestra come blocco di lava), forme dei nemici (Scintilla-Vapore, Fornace Semovente,
// Golem-Palombaro, il Mastro Forgiatore) e gli effetti della scena: colate che respirano (crosta, crepe che si accendono, lava che scorre),
// cascate di raffreddamento, la leva della chiusa, chiazze di fuoco a terra, palle di magma, la linea della carica, il vapore del Mastro
// spento e il fuoco addosso all'eroe. Solo colori della palette, texture a pixel nearest, facce piatte, tutto a scatti; quando arriva un
// modello vero nel manifest vince lui (pavimento, muri, presse, leva, nemici).
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, block, merged, painted, px, speckle, strata, tex } from '../render/island_parts.ts';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { object } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';
import type { DungeonScene } from './dungeon_scene.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const vc = new Map<string, THREE.MeshLambertMaterial>();
/** Materiale a colori per vertice (uno per uso: i nemici lo clonano per lampeggiare); `brace` = acceso da sé (fornaci, scintille). */
const colori = (k = 'base', brace = 0): THREE.MeshLambertMaterial => {
  let m = vc.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...(brace ? { emissive: PAL.arancio, emissiveIntensity: brace } : {}) });
    m.name = 'mat_fucina_' + k; vc.set(k, m);
  }
  return m;
};
const texMat = (t: THREE.Texture, emissive?: string, i = 0.22): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({ map: t, flatShading: true, ...(emissive ? { emissive, emissiveIntensity: i } : {}) });
const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
/** Texture 16×16 a pixel (piastre degli effetti: lava, crosta, acqua). */
function tex16(label: string, paint: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.name = label;
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ——— kit dello stile ———
type KitFucina = Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'acqua', Part[]>;
let kit: KitFucina | null = null;
/** Pezzi del kit `fucina` (cache): una geometria e un materiale per pezzo. `acqua` è la Colata Maestra (il bacino della chiusa). */
export function kitFucina(top: number): KitFucina {
  if (kit) return kit;
  const pav = tex('pav', 'fucina', (g, r) => {
    px(g, PAL.roccia, 0, 0, 32, 32);
    for (let i = 0; i < 32; i += 16) { px(g, PAL.neroCaldo, i, 0, 1, 32); px(g, PAL.neroCaldo, 0, i, 32, 1); } // lastre di basalto da 1 m
    speckle(g, r, PAL.neroCaldo, 26, 0, 32); speckle(g, r, PAL.pietraScura, 10, 0, 32); // fuliggine e scaglie
    for (let k = 0; k < 3; k++) { const x = r.int(2, 28), y = r.int(2, 28); px(g, PAL.ombraCalda, x, y, 3, 1); px(g, PAL.legno, x + 1, y, 1, 1); } // crepe con la brace
    speckle(g, r, PAL.arancio, 3, 0, 32); // braci cadute
    strata(g, [[PAL.neroCaldo, 3], [PAL.roccia, 32]]);
  });
  const muro = tex('muro', 'fucina', (g, r) => {
    px(g, PAL.neroCaldo, 0, 0, 32, 32); speckle(g, r, PAL.roccia, 20, 0, 32); // la cima: fuliggine
    // fianco (32 righe = 2 m dall'alto): mattoni refrattari sfalsati, tubo d'ottone, fuliggine in alto e alla base
    px(g, PAL.ombraCalda, 0, 32, 32, 32);
    for (let y = 34, k = 0; y < 62; y += 4, k++) for (let x = (k % 2) * 4 - 4; x < 32; x += 8) px(g, r.next() < 0.75 ? PAL.legnoScuro : PAL.legno, x + 1, y, 7, 3);
    px(g, PAL.neroCaldo, 0, 32, 32, 2); speckle(g, r, PAL.neroCaldo, 18, 32, 40);
    px(g, PAL.legnoScuro, 0, 43, 32, 1); px(g, PAL.arancio, 0, 44, 32, 2); px(g, PAL.giallo, 0, 44, 32, 1); px(g, PAL.legno, 0, 46, 32, 1); // tubo d'ottone
    for (const x of [5, 21]) px(g, PAL.pietraScura, x, 43, 2, 4); // fascette
    px(g, PAL.neroCaldo, 0, 61, 32, 3);
  });
  const lava = tex('lava', 'fucina_colata', (g, r) => {
    px(g, PAL.arancio, 0, 0, 32, 32); speckle(g, r, PAL.giallo, 22, 0, 32, 3, 1); speckle(g, r, PAL.rosso, 14, 0, 32, 2, 2);
    speckle(g, r, PAL.ombraCalda, 6, 0, 32, 2, 1); // croste che galleggiano
    strata(g, [[PAL.giallo, 2], [PAL.arancio, 6], [PAL.rosso, 32]]);
  });
  const pressa = merged([
    painted(box(1.5, 0.35, 1.5), PAL.roccia, M(0, 0.175, 0)), // basamento
    painted(box(1.2, 0.55, 1.2), PAL.neroCaldo, M(0, 0.62, 0)), // incudine
    painted(box(1.25, 0.1, 1.25), PAL.pietraScura, M(0, 0.95, 0)),
    painted(cil(0.13, 0.13, 1.4, 6), PAL.pietraScura, M(-0.45, 1.6, -0.45)), painted(cil(0.13, 0.13, 1.4, 6), PAL.pietraScura, M(0.45, 1.6, 0.45)), // colonnine
    painted(cil(0.38, 0.38, 0.7, 8), PAL.arancio, M(0, 1.95, 0)), // cilindro d'ottone della pressa
    painted(cil(0.42, 0.42, 0.08, 8), PAL.giallo, M(0, 1.62, 0)),
    painted(box(1.3, 0.22, 1.3), PAL.roccia, M(0, 2.4, 0)), // traversa
    painted(cil(0.12, 0.12, 0.5, 6), PAL.pietra, M(0, 1.25, 0)), // stantuffo
    painted(box(0.5, 0.06, 0.5), PAL.rosso, M(0, 0.98, 0)), // la lamiera rovente sull'incudine
  ]);
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: pressa, mat: colori('kit') }],
    acqua: [{ geo: block(2, 2, 0.5, 0), mat: texMat(lava, PAL.arancio, 0.55) }],
  };
  return kit;
}

// ——— forme dei nemici (−Z avanti, pivot a terra) ———
type Forma = { corpo: THREE.BufferGeometry; brace?: THREE.BufferGeometry };
const FORME: Record<string, () => Forma> = {
  // Scintilla-Vapore: palla di fuoco che galleggia a mezz'aria, schegge rosse attorno e sbuffi di vapore in cima (tutta accesa)
  nem_scintilla: () => ({
    corpo: merged([painted(new THREE.IcosahedronGeometry(0.16, 0), PAL.pietraChiara, M(0.12, 1.32, 0.05)), painted(new THREE.IcosahedronGeometry(0.12, 0), PAL.sabbiaChiara, M(-0.1, 1.4, -0.02))]),
    brace: merged([
      painted(new THREE.IcosahedronGeometry(0.34, 0), PAL.arancio, M(0, 0.9, 0)),
      painted(new THREE.IcosahedronGeometry(0.22, 0), PAL.giallo, M(0, 0.92, -0.08)),
      ...[0, 1, 2, 3, 4].map((k) => painted(new THREE.TetrahedronGeometry(0.12, 0), PAL.rosso, M(Math.cos(k * 1.257) * 0.42, 0.75 + (k % 2) * 0.3, Math.sin(k * 1.257) * 0.42, k, k * 0.7, 0))),
      painted(box(0.08, 0.06, 0.04), PAL.neroCaldo, M(-0.09, 0.95, -0.33)), painted(box(0.08, 0.06, 0.04), PAL.neroCaldo, M(0.09, 0.95, -0.33)), // occhi
    ]),
  }),
  // Fornace Semovente: forno di ghisa sui cingoli, bocca col fuoco davanti, comignolo che fuma, pala davanti
  nem_fornace: () => ({
    corpo: merged([
      painted(box(0.32, 0.4, 1.5), PAL.neroCaldo, M(-0.48, 0.2, 0)), painted(box(0.32, 0.4, 1.5), PAL.neroCaldo, M(0.48, 0.2, 0)), // cingoli
      ...[-0.5, 0, 0.5].flatMap((z) => [painted(cil(0.15, 0.15, 0.34, 6), PAL.pietraScura, M(-0.48, 0.2, z, 0, 0, Math.PI / 2)), painted(cil(0.15, 0.15, 0.34, 6), PAL.pietraScura, M(0.48, 0.2, z, 0, 0, Math.PI / 2))]),
      painted(box(1.05, 0.95, 1.2), PAL.legnoScuro, M(0, 0.85, 0.05)), // il forno
      painted(box(1.1, 0.1, 1.25), PAL.arancio, M(0, 0.55, 0.05)), painted(box(1.1, 0.1, 1.25), PAL.arancio, M(0, 1.2, 0.05)), // fasce d'ottone
      painted(box(0.6, 0.45, 0.06), PAL.neroCaldo, M(0, 0.85, -0.56)), // sportello
      painted(cil(0.13, 0.16, 0.8, 6), PAL.neroCaldo, M(0.2, 1.65, 0.35)), // comignolo
      painted(box(0.9, 0.08, 0.35), PAL.pietra, M(0, 0.25, -0.9, -0.3, 0, 0)), // pala
    ]),
    brace: merged([
      painted(box(0.46, 0.3, 0.05), PAL.arancio, M(0, 0.85, -0.6)), painted(box(0.3, 0.14, 0.06), PAL.giallo, M(0, 0.8, -0.61)), // bocca col fuoco
      painted(cil(0.1, 0.1, 0.08, 6), PAL.rosso, M(0.2, 2.07, 0.35)), // brace in cima al comignolo
    ]),
  }),
  // Golem-Palombaro: scafandro di tela e ottone, elmo tondo con gli oblò, corazza davanti, due valvole rosse sulla schiena
  nem_palombaro: () => ({
    corpo: merged([
      painted(box(0.28, 0.75, 0.3), PAL.sabbia, M(-0.2, 0.42, 0)), painted(box(0.28, 0.75, 0.3), PAL.sabbia, M(0.2, 0.42, 0)), // gambe di tela
      painted(box(0.36, 0.2, 0.46), PAL.neroCaldo, M(-0.2, 0.1, -0.05)), painted(box(0.36, 0.2, 0.46), PAL.neroCaldo, M(0.2, 0.1, -0.05)), // scarponi di piombo
      painted(box(0.95, 0.85, 0.6), PAL.sabbia, M(0, 1.2, 0)), // busto
      painted(box(1.0, 0.8, 0.12), PAL.pietraScura, M(0, 1.22, -0.33)), // la corazza davanti (lo scafandro)
      painted(box(0.7, 0.08, 0.13), PAL.arancio, M(0, 1.5, -0.4)), painted(box(0.7, 0.08, 0.13), PAL.arancio, M(0, 0.95, -0.4)),
      painted(new THREE.IcosahedronGeometry(0.38, 1), PAL.arancio, M(0, 1.9, -0.02)), // elmo d'ottone
      painted(cil(0.15, 0.15, 0.08, 8), PAL.acquaBassa, M(0, 1.92, -0.36, Math.PI / 2)), // oblò davanti
      painted(cil(0.09, 0.09, 0.07, 8), PAL.acquaBassa, M(-0.33, 1.92, -0.05, 0, 0, Math.PI / 2)), painted(cil(0.09, 0.09, 0.07, 8), PAL.acquaBassa, M(0.33, 1.92, -0.05, 0, 0, Math.PI / 2)),
      painted(box(0.3, 0.75, 0.3), PAL.sabbia, M(-0.62, 1.15, 0)), painted(box(0.3, 0.75, 0.3), PAL.sabbia, M(0.62, 1.15, 0)), // braccia
      painted(box(0.36, 0.3, 0.36), PAL.pietraScura, M(-0.62, 0.68, -0.02)), painted(box(0.36, 0.3, 0.36), PAL.pietraScura, M(0.62, 0.68, -0.02)), // pugni di ferro
      painted(cil(0.16, 0.16, 0.6, 8), PAL.pietra, M(0, 1.25, 0.42)), // bombola dell'aria sulla schiena
      painted(cil(0.05, 0.05, 0.5, 5), PAL.neroCaldo, M(0, 1.75, 0.3, 0.9, 0, 0)), // tubo dell'aria
      // le due valvole rosse sulla schiena: il punto debole
      painted(cil(0.17, 0.17, 0.05, 8), PAL.rosso, M(-0.28, 1.35, 0.34, Math.PI / 2)), painted(cil(0.17, 0.17, 0.05, 8), PAL.rosso, M(0.28, 1.35, 0.34, Math.PI / 2)),
      painted(box(0.3, 0.04, 0.06), PAL.giallo, M(-0.28, 1.35, 0.37)), painted(box(0.3, 0.04, 0.06), PAL.giallo, M(0.28, 1.35, 0.37)),
    ]),
  }),
  // Il Mastro Forgiatore: centauro di ferro e ottone; la fornace accesa nella pancia del busto, martello da forgia e tenaglie, comignoli
  nem_forgiatore: () => ({
    corpo: merged([
      ...[[-0.38, -0.55], [0.38, -0.55], [-0.38, 0.65], [0.38, 0.65]].flatMap(([x, z]) => [
        painted(box(0.24, 0.85, 0.26), PAL.pietraScura, M(x!, 0.55, z!)), painted(box(0.32, 0.18, 0.34), PAL.neroCaldo, M(x!, 0.09, z! - 0.02)), // zampe e zoccoli
      ]),
      painted(box(1.0, 0.7, 1.75), PAL.roccia, M(0, 1.25, 0.05)), // corpo di cavallo
      painted(box(1.05, 0.1, 1.8), PAL.arancio, M(0, 1.0, 0.05)), painted(box(1.05, 0.1, 1.8), PAL.arancio, M(0, 1.52, 0.05)),
      painted(cil(0.12, 0.15, 0.9, 6), PAL.neroCaldo, M(-0.25, 2.0, 0.6)), painted(cil(0.12, 0.15, 0.7, 6), PAL.neroCaldo, M(0.25, 1.9, 0.75)), // comignoli
      painted(box(0.9, 0.95, 0.7), PAL.legnoScuro, M(0, 2.0, -0.55)), // busto
      painted(box(0.96, 0.1, 0.76), PAL.arancio, M(0, 2.45, -0.55)),
      painted(box(0.56, 0.42, 0.06), PAL.neroCaldo, M(0, 1.9, -0.91)), // la grata della fornace
      painted(box(0.44, 0.38, 0.4), PAL.pietraScura, M(0, 2.72, -0.6)), // testa a maschera
      painted(box(0.5, 0.08, 0.46), PAL.giallo, M(0, 2.95, -0.6)), // fronte d'ottone
      painted(box(0.32, 0.6, 0.32), PAL.legnoScuro, M(-0.62, 2.2, -0.55)), painted(box(0.32, 0.6, 0.32), PAL.legnoScuro, M(0.62, 2.1, -0.75, -0.6, 0, 0)), // braccia
      painted(cil(0.07, 0.07, 1.3, 6), PAL.legno, M(0.62, 2.1, -1.25, -1.1, 0, 0)), painted(box(0.5, 0.42, 0.42), PAL.neroCaldo, M(0.62, 2.5, -1.75, -1.1, 0, 0)), // martello
      painted(box(0.06, 0.9, 0.06), PAL.pietra, M(-0.7, 1.8, -0.7, -0.4, 0, 0.1)), painted(box(0.06, 0.9, 0.06), PAL.pietra, M(-0.56, 1.8, -0.7, -0.4, 0, -0.1)), // tenaglie
    ]),
    brace: merged([
      painted(box(0.46, 0.32, 0.05), PAL.arancio, M(0, 1.9, -0.95)), painted(box(0.3, 0.16, 0.06), PAL.giallo, M(0, 1.84, -0.96)), // il fuoco nella pancia
      painted(box(0.3, 0.06, 0.04), PAL.giallo, M(0, 2.76, -0.81)), // occhi a fessura
      painted(box(0.2, 0.08, 0.08), PAL.rosso, M(-0.63, 1.38, -0.7)), // il pezzo rovente nelle tenaglie
    ]),
  }),
};
/** Segnaposto di un nemico della Fucina (null = non è uno dei loro): corpo a colori per vertice e le parti accese (fornace, braci) col
 *  loro materiale che brilla da sé; il Mastro spento le spegne (dungeon_actors.ts). */
export function formaNemico(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const { corpo, brace } = f(), g = new THREE.Group(); g.name = model;
  const m = new THREE.Mesh(corpo, colori(model).clone()); m.name = model; g.add(m);
  if (brace) { const b = new THREE.Mesh(brace, colori(model + '_brace', model === 'nem_scintilla' ? 0.85 : 0.6).clone()); b.name = model + '_brace'; g.add(b); }
  return g;
}

// ——— effetti della scena ———
export type FucinaFx = {
  tick(v: DungeonView): void;
  update(t: number, hero: { x: number; z: number }, v: DungeonView, gioco: boolean): void;
  counts(): { lave: number; getti: number; leve: number; fuochi: number; magma: number; carica: boolean; vapore: boolean };
  dispose(): void;
};

/** Cassa della chiusa (segnaposto di dng_fucina_leva): cassa d'ottone col cartello, il perno e il tubo dell'acqua che sale al soffitto. */
function levaObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_fucina_leva';
  g.add(new THREE.Mesh(merged([
    painted(box(0.9, 0.9, 0.6), PAL.legnoScuro, M(0, 0.45, 0)), painted(box(0.95, 0.08, 0.65), PAL.arancio, M(0, 0.9, 0)),
    painted(box(0.6, 0.3, 0.04), PAL.giallo, M(0, 0.5, -0.32)), // targa
    painted(cil(0.06, 0.06, 2.6, 6), PAL.acquaProfonda, M(0.32, 1.3, 0.22)), // il tubo dell'acqua che sale al soffitto
    painted(cil(0.16, 0.16, 0.2, 8), PAL.pietraScura, M(0, 0.95, -0.05, 0, 0, Math.PI / 2)), // perno
  ]), colori('leva')));
  return g;
}
/** La leva della chiusa sul perno, col pomo rosso: sempre in codice (anche sul modello vero), perché si abbassa a scatti e cambia colore. */
function braccioLeva(): { braccio: THREE.Group; pomo: THREE.MeshLambertMaterial } {
  const braccio = new THREE.Group(); braccio.name = 'braccio'; braccio.position.set(0, 0.95, -0.05);
  const pomo = new THREE.MeshLambertMaterial({ color: PAL.rosso, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.25 });
  braccio.add(new THREE.Mesh(merged([painted(box(0.08, 0.8, 0.08), PAL.pietra, M(0, 0.4, 0))]), colori('leva')));
  const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), pomo); p.position.y = 0.82; p.name = 'pomo'; braccio.add(p);
  return { braccio, pomo };
}

export function createFucinaFx(o: { sc: DungeonScene; loader: Loader; say(text: string, ms: number): void; occupato(): boolean }): FucinaFx {
  const root = new THREE.Group(); root.name = 'fucina_fx'; o.sc.scene.add(root);
  const fy = o.sc.floorY, map = o.sc.map, T = map.tile;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), YA = new THREE.Vector3(0, 1, 0), eu = new THREE.Euler();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const centro = (i: number) => { const cx = i % map.w, cz = (i - cx) / map.w; return { x: (cx + 0.5) * T, z: (cz + 0.5) * T }; };

  // colate che respirano: una piastra per cella, una InstancedMesh per colata; crosta scura con le crepe, lava a due fotogrammi
  const crosta = tex16('crosta', (g) => {
    px(g, PAL.neroCaldo, 0, 0, 16, 16); px(g, PAL.roccia, 2, 3, 5, 3); px(g, PAL.roccia, 9, 9, 5, 4); px(g, PAL.ombraCalda, 11, 2, 3, 3);
    for (const [x, y] of [[0, 7], [1, 7], [2, 8], [3, 8], [4, 8], [5, 9], [6, 9], [7, 8], [8, 7], [9, 7], [10, 6], [11, 6], [12, 6], [13, 7], [14, 7], [15, 7], [7, 9], [7, 10], [6, 11], [6, 12], [6, 13], [5, 14], [5, 15], [12, 5], [12, 4], [13, 3]] as const) px(g, PAL.rosso, x, y);
  });
  const lavaA = tex16('lava_a', (g) => {
    px(g, PAL.arancio, 0, 0, 16, 16);
    for (const [x, y, w] of [[1, 1, 4], [8, 3, 5], [3, 6, 3], [10, 9, 4], [0, 12, 5], [7, 14, 3]] as const) px(g, PAL.giallo, x, y, w, 1);
    for (const [x, y] of [[6, 2], [13, 6], [2, 9], [11, 12], [4, 15]] as const) px(g, PAL.rosso, x, y, 2, 2);
  });
  const lavaB = tex16('lava_b', (g) => {
    px(g, PAL.arancio, 0, 0, 16, 16);
    for (const [x, y, w] of [[3, 0, 4], [10, 2, 5], [5, 5, 3], [12, 8, 4], [2, 11, 5], [9, 13, 3]] as const) px(g, PAL.giallo, x, y, w, 1);
    for (const [x, y] of [[8, 1], [15, 5], [4, 8], [13, 11], [6, 14]] as const) px(g, PAL.rosso, x, y, 2, 2);
  });
  const piastra = new THREE.PlaneGeometry(T, T); piastra.rotateX(-Math.PI / 2);
  const lave = map.lave.map((lv) => {
    const mat = new THREE.MeshLambertMaterial({ map: crosta, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.15 });
    const im = new THREE.InstancedMesh(piastra, mat, lv.celle.length); im.name = 'lava_' + lv.n; im.frustumCulled = false;
    root.add(im);
    return { lv, im, mat, stato: '', visti: '' };
  });
  // cascate di raffreddamento: bocchettone d'ottone in alto, colonna d'acqua a strisce che scorrono, anello di schiuma a terra
  const strisce = tex16('cascata', (g) => {
    px(g, PAL.acqua, 0, 0, 16, 16);
    for (const x of [1, 5, 9, 13]) px(g, PAL.acquaBassa, x, 0, 2, 16);
    for (const [x, y] of [[3, 2], [11, 5], [7, 9], [15, 12], [3, 14]] as const) px(g, PAL.sabbiaChiara, x, y, 1, 2);
  });
  strisce.repeat.set(2, 1);
  const NG = map.getti.length;
  const bocca = new THREE.InstancedMesh(merged([
    painted(cil(0.34, 0.42, 0.3, 8), PAL.arancio, M(0, 3.05, 0)), painted(cil(0.2, 0.2, 0.9, 6), PAL.pietraScura, M(0, 3.6, 0)), painted(cil(0.46, 0.46, 0.06, 8), PAL.giallo, M(0, 2.9, 0)),
  ]), colori('bocca'), Math.max(1, NG));
  const colonnaGeo = cil(0.62, 0.78, 2.9, 8); colonnaGeo.translate(0, 1.45, 0);
  const acquaMat = new THREE.MeshLambertMaterial({ map: strisce, flatShading: true, transparent: true, opacity: 0.62, depthWrite: false, emissive: PAL.acquaProfonda, emissiveIntensity: 0.25 });
  const colonna = new THREE.InstancedMesh(colonnaGeo, acquaMat, Math.max(1, NG));
  const schiumaGeo = new THREE.RingGeometry(0.7, 1.15, 10, 1); schiumaGeo.rotateX(-Math.PI / 2);
  const schiuma = new THREE.InstancedMesh(schiumaGeo, new THREE.MeshBasicMaterial({ color: PAL.acquaBassa, transparent: true, opacity: 0.8, depthWrite: false }), Math.max(1, NG));
  for (const [im, n] of [[bocca, 'getto_bocca'], [colonna, 'getto_acqua'], [schiuma, 'getto_schiuma']] as const) { im.name = n; im.frustumCulled = false; im.count = NG; root.add(im); }
  colonna.renderOrder = 2; schiuma.renderOrder = 1;
  // la leva della chiusa (modello dng_fucina_leva se c'è, se no il segnaposto)
  const leve = map.valvole.map((v) => {
    const holder = new THREE.Group(); holder.position.set(v.x, fy, v.z); root.add(holder);
    const { braccio, pomo } = braccioLeva(); holder.add(braccio);
    void object(o.loader, 'dng_fucina_leva', levaObj).then((g) => holder.add(g));
    return { holder, n: v.n, aperta: false, girata: -1, braccio, pomo };
  });
  // chiazze di fuoco: ciuffi di fiamma a gradini
  const MAXF = 48;
  const fiammaGeo = merged([
    painted(new THREE.ConeGeometry(0.32, 0.7, 5), PAL.arancio, M(0, 0.35, 0)), painted(new THREE.ConeGeometry(0.2, 0.55, 5), PAL.giallo, M(0.25, 0.27, 0.15)),
    painted(new THREE.ConeGeometry(0.22, 0.45, 5), PAL.rosso, M(-0.28, 0.22, -0.1)), painted(new THREE.ConeGeometry(0.16, 0.35, 4), PAL.arancio, M(0.05, 0.17, -0.32)),
    painted(cil(0.62, 0.66, 0.03, 8), PAL.ombraCalda, M(0, 0.015, 0)),
  ]);
  const fiammaMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.6 });
  const fuochi = new THREE.InstancedMesh(fiammaGeo, fiammaMat, MAXF); fuochi.name = 'fuochi'; fuochi.frustumCulled = false; fuochi.count = 0; root.add(fuochi);
  // fuoco addosso all'eroe (tre ciuffi attorno) e vapore sul Mastro spento
  const addosso = new THREE.Mesh(merged([
    painted(new THREE.ConeGeometry(0.22, 0.6, 5), PAL.arancio, M(0.3, 0.5, 0)), painted(new THREE.ConeGeometry(0.18, 0.5, 5), PAL.giallo, M(-0.25, 0.8, 0.15)),
    painted(new THREE.ConeGeometry(0.2, 0.55, 5), PAL.rosso, M(0, 1.1, -0.25)),
  ]), fiammaMat);
  addosso.name = 'eroe_brucia'; addosso.visible = false; root.add(addosso);
  const vaporeGeo = merged([
    painted(cil(0.5, 0.65, 0.6, 7), PAL.pietraChiara, M(0, 0.3, 0)), painted(cil(0.4, 0.55, 0.6, 7), PAL.sabbiaChiara, M(0.1, 0.9, 0.05)), painted(cil(0.3, 0.45, 0.55, 7), PAL.pietraChiara, M(-0.05, 1.45, -0.05)),
  ]);
  const vapore = new THREE.Mesh(vaporeGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.sabbiaChiara, emissiveIntensity: 0.3, transparent: true, opacity: 0.8 }));
  vapore.name = 'vapore_mastro'; vapore.visible = false; root.add(vapore);
  // palle di magma: cerchio d'avviso arancio che si riempie a scatti, la palla che cade, lo schizzo
  const MAXM = 8;
  const ringGeo = new THREE.RingGeometry(0.9, 1, 16, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 16); discGeo.rotateX(-Math.PI / 2);
  const anelli = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: PAL.arancio, transparent: true, opacity: 0.9, depthWrite: false }), MAXM);
  const dischi = new THREE.InstancedMesh(discGeo, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.35, depthWrite: false }), MAXM);
  const palle = new THREE.InstancedMesh(merged([painted(new THREE.IcosahedronGeometry(0.34, 0), PAL.arancio), painted(new THREE.IcosahedronGeometry(0.22, 0), PAL.giallo, M(0.08, 0.08, -0.08))]), fiammaMat, MAXM);
  for (const [im, n] of [[anelli, 'magma_anello'], [dischi, 'magma_disco'], [palle, 'magma_palla']] as const) { im.name = n; im.frustumCulled = false; im.count = 0; im.renderOrder = 1; root.add(im); }
  // la linea della carica: sottile e lampeggiante a terra, dove correrà il Mastro
  const lineaMat = new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.85, depthWrite: false });
  const linea = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), lineaMat); linea.name = 'carica'; linea.visible = false; linea.renderOrder = 1; root.add(linea);
  let nF = 0, nM = 0, bruciature = 0, detto = false;

  return {
    tick(v) {
      if (v.eventi.some((e) => e.t === 'bruciato' && (e.eroe === undefined || e.eroe === v.io))) bruciature++;
      for (const k of leve) {
        const a = v.valvole.find((x) => x.n === k.n)?.aperta ?? false;
        if (a && !k.aperta) k.girata = performance.now() / 1000;
        k.aperta = a;
      }
    },
    update(t, hero, v, gioco) {
      // colate: crosta (crepe fioche), avviso (crepe che lampeggiano sempre più spesso), scorre (lava a due fotogrammi)
      for (const l of lave) {
        const sv = v.lave.find((x) => x.n === l.lv.n), stato = sv?.stato ?? 'crosta';
        const fot = stato === 'scorre' ? Math.floor(t * 5) % 2 : stato === 'avviso' ? Math.floor(t * (6 + 10 * (sv?.t ?? 0))) % 2 : 0;
        const key = `${stato}|${fot}`;
        if (key !== l.stato) {
          l.stato = key;
          l.mat.map = stato === 'scorre' ? (fot ? lavaB : lavaA) : crosta;
          l.mat.emissive.set(stato === 'scorre' ? PAL.arancio : PAL.rosso);
          l.mat.emissiveIntensity = stato === 'scorre' ? 0.7 : stato === 'avviso' && fot ? 0.75 : 0.12;
          l.mat.needsUpdate = true;
        }
        // si vede solo quello che l'eroe ha visto (come il pavimento)
        let visti = '';
        for (const i of l.lv.celle) { const c = centro(i); visti += o.sc.light(c.x, c.z) > 0 ? '1' : '0'; }
        if (visti === l.visti) continue;
        l.visti = visti;
        l.lv.celle.forEach((i, n) => { const c = centro(i); l.im.setMatrixAt(n, visti[n] === '1' ? m4.makeTranslation(c.x, fy + 0.025, c.z) : ZERO); });
        l.im.instanceMatrix.needsUpdate = true;
      }
      // cascate: strisce che scendono a scatti, schiuma che pulsa
      strisce.offset.y = Math.floor(t * 8) / 8;
      map.getti.forEach((g, n) => {
        const on = o.sc.light(g.x, g.z) > 0;
        bocca.setMatrixAt(n, on ? m4.makeTranslation(g.x, fy, g.z) : ZERO);
        colonna.setMatrixAt(n, on ? m4.compose(p3.set(g.x, fy, g.z), q.setFromAxisAngle(YA, Math.floor(t * 6 + n) * 0.4), s3.set(1, 1, 1)) : ZERO);
        schiuma.setMatrixAt(n, on ? m4.compose(p3.set(g.x, fy + 0.04, g.z), q.identity(), s3.setScalar(1 + 0.12 * (Math.floor(t * 5 + n) % 2))) : ZERO);
      });
      for (const im of [bocca, colonna, schiuma]) im.instanceMatrix.needsUpdate = true;
      // leva della chiusa: rossa che pulsa (da tirare); tirata, scende a scatti mentre la Colata si raffredda, poi verde
      for (const k of leve) {
        k.holder.visible = o.sc.light(k.holder.position.x, k.holder.position.z) > 0;
        if (!k.holder.visible) continue;
        const scende = k.aperta && (v.acque.find((a) => a.n === k.n)?.livello ?? 0) > 0;
        k.braccio.rotation.x = k.aperta ? -steps((t - k.girata) / 0.6, 4) * 1.6 : 0;
        const c = k.aperta ? (scende ? PAL.arancio : PAL.erbaChiara) : PAL.rosso;
        if (k.pomo.color.getHexString() !== c.slice(1).toLowerCase()) { k.pomo.color.set(c); k.pomo.emissive.set(c); }
        k.pomo.emissiveIntensity = k.aperta ? 0.2 : 0.15 + 0.25 * (Math.floor(t * 3) % 2);
      }
      // chiazze di fuoco: ciuffi che tremano a scatti e si abbassano quando stanno per spegnersi
      nF = 0;
      for (const f of v.fuochi) {
        if (nF >= MAXF) break;
        if (o.sc.light(f.x, f.z) <= 0) continue;
        const k = f.r * (1 - steps(Math.max(0, f.t - 0.7) / 0.3, 3) * 0.7), h = 0.75 + 0.25 * (Math.floor(t * 8 + f.id) % 2);
        fuochi.setMatrixAt(nF++, m4.compose(p3.set(f.x, fy + 0.02, f.z), q.setFromAxisAngle(YA, Math.floor(t * 6 + f.id) * 0.9), s3.set(k, k * h, k)));
      }
      fuochi.count = nF; fuochi.instanceMatrix.needsUpdate = true;
      // palle di magma in arrivo: cerchio arancio, disco che si riempie, palla che cade a scatti; lo schizzo quando cade
      nM = 0;
      for (const g of v.geyser) {
        if (!g.magma || nM >= MAXM) continue;
        const on = o.sc.light(g.x, g.z) > 0;
        anelli.setMatrixAt(nM, on && !g.getto ? m4.compose(p3.set(g.x, fy + 0.05, g.z), q.identity(), s3.setScalar(g.r)) : ZERO);
        dischi.setMatrixAt(nM, on ? m4.compose(p3.set(g.x, fy + 0.04, g.z), q.identity(), s3.setScalar(g.r * (g.getto ? 1 : Math.max(0.05, steps(g.t, 5))))) : ZERO);
        palle.setMatrixAt(nM, on ? m4.compose(p3.set(g.x, fy + (g.getto ? 0.3 : 0.3 + 6 * (1 - steps(g.t, 8))), g.z), q.setFromEuler(eu.set(g.t * 4, g.t * 3, 0)), s3.setScalar(g.getto ? 1.6 + steps(g.t, 3) : 1)) : ZERO);
        nM++;
      }
      for (const im of [anelli, dischi, palle]) { im.count = nM; im.instanceMatrix.needsUpdate = true; }
      // il Mastro: linea della carica durante l'avviso, vapore quando è spento
      const k = v.nemici.find((n) => n.attacco === 'carica' && n.mira && n.anim === 'prepara');
      linea.visible = !!k && o.sc.light(k.x, k.z) > 0;
      if (k?.mira) {
        const dx = k.mira[0] - k.x, dz = k.mira[1] - k.z, len = Math.sqrt(dx * dx + dz * dz);
        linea.position.set((k.x + k.mira[0]) / 2, fy + 0.06, (k.z + k.mira[1]) / 2);
        linea.rotation.set(0, Math.atan2(-dz, dx), 0);
        linea.scale.set(len, 1, 0.5 + 1.4 * steps(k.t, 4)); // si allarga a scatti: quando è larga parte
        lineaMat.opacity = Math.floor(t * (5 + 12 * k.t)) % 2 ? 0.9 : 0.35;
      }
      const sp = v.nemici.find((n) => n.spento && n.anim !== 'morto');
      vapore.visible = !!sp && o.sc.light(sp.x, sp.z) > 0;
      if (sp) { vapore.position.set(sp.x + 0.06 * ((Math.floor(t * 9) % 3) - 1), fy + 3.1, sp.z); vapore.rotation.y = Math.floor(t * 6) * 0.5; vapore.scale.setScalar(0.55 + 0.08 * (Math.floor(t * 4) % 2)); } // sbuffi sopra la testa, non davanti
      // fuoco addosso all'eroe
      addosso.visible = !!v.hero.brucia;
      if (addosso.visible) { addosso.position.set(hero.x, fy, hero.z); addosso.rotation.y = Math.floor(t * 8) * 1.1; addosso.scale.y = 0.85 + 0.2 * (Math.floor(t * 10) % 2); }
      // la seconda volta che prendi fuoco (la prima ci pensa la scritta del fuoco), come ci si spegne: appena nessuno sta parlando
      if (gioco && bruciature >= 2 && !detto && !o.occupato()) { detto = true; o.say('Bruci: sotto una cascata d’acqua ti spegni subito', 3200); }
    },
    counts: () => ({ lave: lave.reduce((a, l) => a + l.lv.celle.length, 0), getti: NG, leve: leve.length, fuochi: nF, magma: nM, carica: linea.visible, vapore: vapore.visible }),
    dispose() { root.removeFromParent(); piastra.dispose(); colonnaGeo.dispose(); schiumaGeo.dispose(); fiammaGeo.dispose(); vaporeGeo.dispose(); ringGeo.dispose(); discGeo.dispose(); },
  };
}
