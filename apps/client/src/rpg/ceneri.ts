// Il Santuario del Capo Ardente (Isola Vulcano): segnaposto in codice per lo stile `ceneri` (il kit di pavimento, muri e canali di lava), i nemici (Lanciatore di
// Lava, Guerriero Colossale, Sciamano del Fumo, fuoco fatuo, Mite di lava e Korok) e gli oggetti di scena (il braciere, le scorie incandescenti).
// Gli effetti dinamici stanno in ceneri_fx.ts.
import * as THREE from 'three';
import { M, block, merged, painted, px, strata, tex } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import type { Part } from './dungeon_kit.ts';
import { colori } from './diga.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const anello = (r: number, t: number, s = 10) => new THREE.TorusGeometry(r, t, 4, s);
const texMat = (t: THREE.Texture): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ map: t, flatShading: true });

type KitCeneri = Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'acqua', Part[]>;
let kit: KitCeneri | null = null;

/** Pilastro di basalto cerchiato di bronzo con braciere sommitale (le colonne del Santuario: riparano dai soffioni di vapore). */
function pilastroGeo(): THREE.BufferGeometry {
  return merged([
    painted(box(1.15, 0.25, 1.15), PAL.neroCaldo, M(0, 0.12, 0)),
    painted(cil(0.45, 0.52, 1.65, 6), PAL.roccia, M(0, 0.95, 0)),
    painted(anello(0.49, 0.06, 6), PAL.arancio, M(0, 0.55, 0, Math.PI / 2)),
    painted(anello(0.47, 0.06, 6), PAL.arancio, M(0, 1.35, 0, Math.PI / 2)),
    painted(cil(0.56, 0.42, 0.28, 6), PAL.neroCaldo, M(0, 1.88, 0)),
    painted(ico(0.28), PAL.arancio, M(0, 2.08, 0)),
    painted(ico(0.18), PAL.giallo, M(0, 2.22, 0)),
  ]);
}

/** Kit dello stile `ceneri` (cache): lastre di basalto con canaline di bronzo, pareti del cratere con fregi d'ottone e canali di magma vivo. */
export function kitCeneri(top: number): KitCeneri {
  if (kit) return kit;
  const pav = tex('pav', 'ceneri', (g) => {
    px(g, PAL.neroCaldo, 0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) { px(g, PAL.roccia, 0, y, 32, 7); px(g, PAL.ombraCalda, 0, y + 7, 32, 1); }
    for (const x of [7, 23]) { px(g, PAL.legnoScuro, x, 0, 2, 32); px(g, PAL.arancio, x + 1, 0, 1, 32); } // canaline d'olio ardente
    px(g, PAL.arancio, 4, 5, 3, 2); px(g, PAL.arancio, 18, 21, 4, 2); // venature di brace
    strata(g, [[PAL.roccia, 4], [PAL.neroCaldo, 32]]);
  });
  const muro = tex('muro', 'ceneri', (g, r) => {
    px(g, PAL.neroCaldo, 0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) px(g, PAL.roccia, 0, y, 32, 2);
    px(g, PAL.roccia, 0, 32, 32, 32);
    for (let y = 34; y < 60; y += 6) { px(g, PAL.neroCaldo, 0, y, 32, 1); px(g, PAL.pietraScura, (y * 5) % 24, y + 1, 8, 2); }
    px(g, PAL.arancio, 0, 38, 32, 2); px(g, PAL.giallo, 0, 39, 32, 1); // fregio liturgico in ottone
    for (const x of [4, 20]) px(g, PAL.neroCaldo, x, 32, 3, 28); // costoloni di basalto
    px(g, PAL.neroCaldo, 0, 56, 32, 8);
    for (let i = 0; i < 8; i++) px(g, PAL.arancio, r.int(0, 30), r.int(56, 61), 2, 1); // riverbero di magma alla base
  });
  const magma = tex('acqua', 'ceneri', (g) => {
    px(g, PAL.rosso, 0, 0, 32, 32);
    for (let y = 2; y < 32; y += 6) { px(g, PAL.arancio, (y * 3) % 20, y, 12, 3); px(g, PAL.giallo, (y * 5) % 24, y + 1, 6, 1); }
    for (let y = 0; y < 32; y += 8) px(g, PAL.neroCaldo, (y * 7) % 26, y + 4, 5, 2); // croste di scoria
    strata(g, [[PAL.arancio, 6], [PAL.rosso, 32]]);
  });
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: pilastroGeo(), mat: colori('ceneri_kit') }],
    acqua: [{ geo: block(2, 2, 0.85, 0), mat: texMat(magma) }],
  };
  return kit;
}

type Forma = { corpo: THREE.BufferGeometry; luce?: THREE.BufferGeometry };
const FORME: Record<string, () => Forma> = {
  // Lanciatore di Lava: indio snello di basalto nero con le crepe arancioni, un lanternino che gli brilla sul capo e un globo di lava tra le mani
  nem_lanciatore_lava: () => ({
    corpo: merged([
      painted(box(0.3, 0.85, 0.3), PAL.pietraScura, M(-0.2, 0.43, 0)), painted(box(0.3, 0.85, 0.3), PAL.pietraScura, M(0.2, 0.43, 0)), // gambe
      painted(box(0.62, 0.78, 0.38), PAL.pietraScura, M(0, 1.22, 0)), painted(box(0.66, 0.1, 0.4), PAL.arancio, M(0, 1.0, 0)), painted(box(0.66, 0.1, 0.4), PAL.arancio, M(0, 1.42, 0)), // busto e fasce di brace
      painted(box(0.22, 0.6, 0.22), PAL.pietraScura, M(-0.34, 1.35, -0.2, 0.9, 0, 0)), painted(box(0.22, 0.6, 0.22), PAL.pietraScura, M(0.34, 1.35, -0.2, 0.9, 0, 0)), // braccia in avanti
      painted(box(0.34, 0.34, 0.34), PAL.pietraScura, M(0, 1.8, 0)), // testa
      painted(cil(0.04, 0.04, 0.3, 5), PAL.legnoScuro, M(0, 2.1, 0)),
    ]),
    luce: merged([
      painted(box(0.2, 0.26, 0.2), PAL.giallo, M(0, 2.32, 0)), // il lanternino che brilla quando carica
      painted(ico(0.24), PAL.arancio, M(0, 1.3, -0.62)), // il globo di lava
    ]),
  }),
  // Guerriero Colossale: torso nudo pieno di cicatrici incandescenti, spalle enormi e una clava di roccia fusa
  nem_colosso: () => ({
    corpo: merged([
      painted(box(0.5, 1.0, 0.5), PAL.pietraScura, M(-0.36, 0.5, 0)), painted(box(0.5, 1.0, 0.5), PAL.pietraScura, M(0.36, 0.5, 0)),
      painted(box(1.5, 1.2, 0.8), PAL.pietra, M(0, 1.65, 0)), // torso massiccio
      painted(box(0.5, 0.5, 0.5), PAL.pietraScura, M(-0.98, 2.1, 0)), painted(box(0.5, 0.5, 0.5), PAL.pietraScura, M(0.98, 2.1, 0)), // spalle
      painted(box(0.4, 1.1, 0.4), PAL.pietraScura, M(-1.0, 1.45, -0.2, 0.3, 0, 0)), painted(box(0.4, 1.1, 0.4), PAL.pietraScura, M(1.0, 1.45, -0.3, 0.9, 0, 0)),
      painted(box(0.5, 0.5, 0.5), PAL.pietraScura, M(0, 2.5, -0.05)), // testa
      painted(cil(0.2, 0.34, 1.9, 6), PAL.neroCaldo, M(1.0, 1.5, -1.0, 1.0, 0, 0)), // la clava
    ]),
    luce: merged([
      painted(box(1.0, 0.1, 0.1), PAL.arancio, M(0, 1.9, -0.41)), painted(box(0.1, 0.8, 0.1), PAL.arancio, M(0.2, 1.55, -0.41)), // cicatrici
      painted(ico(0.26), PAL.arancio, M(1.0, 1.1, -1.6)), // la punta fusa della clava
    ]),
  }),
  // Sciamano del Fumo: una figura di fumo e braci che fluttua senza gambe, con la lanterna al posto della testa
  nem_sciamano: () => ({
    corpo: merged([
      painted(new THREE.ConeGeometry(0.55, 1.5, 6), PAL.neroCaldo, M(0, 0.75, 0, Math.PI, 0, 0)),
      painted(new THREE.ConeGeometry(0.4, 1.0, 6), PAL.pietra, M(0, 1.15, 0)),
      painted(box(0.2, 0.7, 0.2), PAL.neroCaldo, M(-0.42, 1.2, -0.15, 0.7, 0, 0.3)), painted(box(0.2, 0.7, 0.2), PAL.neroCaldo, M(0.42, 1.2, -0.15, 0.7, 0, -0.3)),
    ]),
    luce: merged([
      painted(box(0.34, 0.4, 0.34), PAL.giallo, M(0, 1.82, 0)), // la lanterna solida: il punto debole
      painted(ico(0.1), PAL.arancio, M(0, 1.55, -0.3)),
    ]),
  }),
  // Fuoco fatuo: una fiamma che galleggia
  nem_fatuo: () => ({
    corpo: merged([painted(new THREE.ConeGeometry(0.22, 0.6, 5), PAL.arancio, M(0, 0.7, 0))]),
    luce: merged([painted(new THREE.ConeGeometry(0.12, 0.38, 5), PAL.giallo, M(0, 0.66, 0))]),
  }),
  // Mite di lava: un elementale piccolo e tozzo, scuro, con le crepe di brace
  nem_mite: () => ({
    corpo: merged([painted(ico(0.4), PAL.pietraScura, M(0, 0.4, 0)), painted(box(0.14, 0.3, 0.14), PAL.pietraScura, M(-0.3, 0.2, 0)), painted(box(0.14, 0.3, 0.14), PAL.pietraScura, M(0.3, 0.2, 0))]),
    luce: merged([painted(box(0.34, 0.06, 0.06), PAL.arancio, M(0, 0.5, -0.38)), painted(ico(0.12), PAL.giallo, M(0, 0.36, -0.1))]),
  }),
  // Korok, il Cuore di Lava: gigante di roccia fusa alto tre celle, il petto è una fessura incandescente col nucleo e una corona di fiamme gialle sul capo
  nem_korok: () => ({
    corpo: merged([
      painted(box(0.9, 1.9, 0.9), PAL.pietraScura, M(-0.6, 0.95, 0)), painted(box(0.9, 1.9, 0.9), PAL.pietraScura, M(0.6, 0.95, 0)), // gambe di basalto
      painted(box(2.3, 1.9, 1.3), PAL.pietra, M(0, 2.85, 0)), // il tronco
      painted(box(0.8, 0.8, 0.8), PAL.pietraScura, M(-1.5, 3.5, 0)), painted(box(0.8, 0.8, 0.8), PAL.pietraScura, M(1.5, 3.5, 0)), // spalle
      painted(box(0.7, 2.0, 0.7), PAL.pietraScura, M(-1.55, 2.2, -0.3, 0.5, 0, 0)), painted(box(0.7, 2.0, 0.7), PAL.pietraScura, M(1.55, 2.2, -0.3, 0.5, 0, 0)), // braccia
      painted(box(0.9, 0.9, 0.9), PAL.pietraScura, M(0, 4.25, 0)), // testa
      ...[-0.7, 0.7].map((x) => painted(new THREE.ConeGeometry(0.2, 0.7, 4), PAL.neroCaldo, M(x, 3.95, 0.5, 0.5, 0, x * 0.4))), // creste di roccia
    ]),
    luce: merged([
      painted(box(0.34, 1.2, 0.12), PAL.arancio, M(0, 2.85, -0.68)), painted(ico(0.34), PAL.giallo, M(0, 2.85, -0.66)), // la fessura e il nucleo
      ...[-0.4, -0.2, 0, 0.2, 0.4].map((x, k) => painted(new THREE.ConeGeometry(0.09, 0.5 + (k === 2 ? 0.3 : 0), 4), PAL.giallo, M(x, 5.0, 0, 0, 0, -x * 0.6))), // corona di fiamme
      painted(box(0.5, 0.1, 0.1), PAL.arancio, M(0, 4.25, -0.46)), // la bocca
    ]),
  }),
};

/** Segnaposto di un nemico del Santuario del Capo Ardente (null se non appartiene a questo stile). */
export function formaCeneri(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const { corpo, luce } = f(), g = new THREE.Group(); g.name = model;
  const m = new THREE.Mesh(corpo, colori(model).clone()); m.name = model; g.add(m);
  if (luce) { const b = new THREE.Mesh(luce, colori(model + '_luce', 0.75, PAL.arancio).clone()); b.name = model + '_luce'; g.add(b); }
  return g;
}

/** Il braciere del Giuramento: cesto di pietra su un piede, con la brace spenta (la fiamma da accesa è un'altra mesh, `fiammaGeo`). */
export function bracialeObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_ceneri_braciere';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.62, 0.7, 0.2, 8), PAL.neroCaldo, M(0, 0.1, 0)),
    painted(cil(0.2, 0.28, 0.6, 6), PAL.roccia, M(0, 0.5, 0)),
    painted(cil(0.62, 0.34, 0.36, 8), PAL.pietraScura, M(0, 0.98, 0)), // il cesto
    painted(anello(0.5, 0.06, 8), PAL.arancio, M(0, 1.14, 0, Math.PI / 2)),
    painted(ico(0.3), PAL.neroCaldo, M(0, 1.12, 0)), // brace spenta
  ]), colori('ceneri_braciere')));
  return g;
}
/** La fiamma del braciere acceso (si accende sopra il cesto). */
export function fiammaGeo(): THREE.BufferGeometry {
  return merged([
    painted(new THREE.ConeGeometry(0.4, 1.0, 5), PAL.arancio, M(0, 1.6, 0)),
    painted(new THREE.ConeGeometry(0.24, 0.8, 5), PAL.giallo, M(0.05, 1.55, 0.05)),
    painted(ico(0.2), PAL.giallo, M(0, 1.2, 0)),
  ]);
}
/** Scorie vulcaniche incandescenti e croste di brace ardente sul pavimento (i `rottami` del Santuario). */
export function scorieGeo(): THREE.BufferGeometry {
  return merged([
    painted(cil(0.68, 0.78, 0.08, 7), PAL.neroCaldo, M(0, 0.04, 0)),
    ...[[-0.42, -0.35], [0.38, -0.25], [-0.15, 0.42], [0.45, 0.38], [0, -0.05]].map(([x, z], k) =>
      painted(ico(0.16 + (k % 2) * 0.05), PAL.arancio, M(x!, 0.1, z!))),
    ...[[-0.2, -0.15], [0.22, 0.12]].map(([x, z]) => painted(ico(0.11), PAL.giallo, M(x!, 0.14, z!))),
  ]);
}
