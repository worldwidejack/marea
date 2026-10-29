// Il Santuario del Capo Ardente (Isola Vulcano): segnaposto in codice per lo stile `ceneri`, i nemici dell'Ordine dei Laternari
// e gli oggetti di scena (Ruota di Chiusa Termale, Sfiato Termale in basalto intero e infranto, scorie incandescenti, Ponte d'Ossidiana).
// Gli effetti dinamici condividono diga_fx.ts.
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

type Forma = { corpo: THREE.BufferGeometry; luce?: THREE.BufferGeometry; portello?: THREE.BufferGeometry };
const FORME: Record<string, () => Forma> = {
  // Sentinella del Braciere: corazza di basalto e bronzo con gabbia-braciere sul torace, elmo cornuto, alabarda d'ossidiana e scudo di lastra lavica
  nem_sentinella_braciere: () => ({
    corpo: merged([
      painted(box(0.44, 0.85, 0.44), PAL.neroCaldo, M(-0.3, 0.45, 0.05)), painted(box(0.44, 0.85, 0.44), PAL.neroCaldo, M(0.3, 0.45, 0.05)),
      painted(box(0.5, 0.24, 0.64), PAL.arancio, M(-0.3, 0.12, -0.02)), painted(box(0.5, 0.24, 0.64), PAL.arancio, M(0.3, 0.12, -0.02)), // schinieri di bronzo
      painted(box(1.22, 0.96, 0.78), PAL.roccia, M(0, 1.42, 0.05)), // gabbia-braciere toracica
      painted(box(1.26, 0.18, 0.82), PAL.arancio, M(0, 1.12, 0.05)), painted(box(1.26, 0.18, 0.82), PAL.arancio, M(0, 1.72, 0.05)),
      painted(box(0.4, 0.85, 0.4), PAL.neroCaldo, M(0.82, 1.38, 0)), painted(box(0.4, 0.7, 0.4), PAL.neroCaldo, M(-0.75, 1.45, -0.25, 0.7, 0, 0)),
      painted(cil(0.36, 0.42, 0.48, 6), PAL.neroCaldo, M(0, 2.15, 0.05)), // elmo di ferro battuto
      painted(new THREE.ConeGeometry(0.1, 0.38, 4), PAL.arancio, M(-0.28, 2.45, 0.05, 0, 0, 0.35)),
      painted(new THREE.ConeGeometry(0.1, 0.38, 4), PAL.arancio, M(0.28, 2.45, 0.05, 0, 0, -0.35)),
      painted(cil(0.06, 0.06, 2.1, 6), PAL.legnoScuro, M(0.86, 1.05, -0.25, 0.22, 0, 0)), // asta dell'alabarda d'ossidiana
      painted(box(0.22, 0.68, 0.46), PAL.neroCaldo, M(0.86, 0.32, -0.48)),
    ]),
    luce: merged([
      painted(box(0.65, 0.55, 0.45), PAL.arancio, M(0, 1.42, 0.02)), // cuore di brace nel torace
      painted(box(0.42, 0.12, 0.12), PAL.giallo, M(0, 2.15, -0.3)), // fessura dell'elmo
      painted(box(0.24, 0.7, 0.12), PAL.arancio, M(0.86, 0.32, -0.68)), // filo incandescente dell'alabarda
    ]),
    portello: merged([
      painted(box(1.36, 1.88, 0.18), PAL.neroCaldo, M(-0.25, 1.05, -0.7)), // lastra di basalto e bronzo
      painted(box(1.42, 0.24, 0.22), PAL.arancio, M(-0.25, 1.8, -0.72)),
      painted(box(1.42, 0.24, 0.22), PAL.arancio, M(-0.25, 0.35, -0.72)),
      painted(cil(0.28, 0.28, 0.1, 6), PAL.arancio, M(-0.25, 1.08, -0.8, Math.PI / 2)), // umbone del Sole Antico
    ]),
  }),
  // Cantore della Fuliggine: tunica color cenere, cappuccio con maschera d'ottone e lunga asta-lanterna cerimoniale che spara dardi di fuoco
  nem_cantore: () => ({
    corpo: merged([
      painted(cil(0.28, 0.44, 1.35, 7), PAL.pietraScura, M(0, 0.68, 0)), // veste liturgica di cenere
      painted(box(0.56, 0.18, 0.42), PAL.arancio, M(0, 1.15, 0)), // stola di bronzo
      painted(box(0.16, 0.6, 0.16), PAL.pietraScura, M(-0.32, 1.2, -0.2, 0.9, 0, 0.2)),
      painted(box(0.16, 0.6, 0.16), PAL.pietraScura, M(0.32, 1.25, -0.15, 0.8, 0, -0.2)),
      painted(new THREE.ConeGeometry(0.3, 0.58, 6), PAL.neroCaldo, M(0, 1.72, 0)), // cappuccio a punta dei Laternari
      painted(cil(0.035, 0.04, 1.75, 6), PAL.arancio, M(0.06, 1.34, -0.95, Math.PI / 2)), // asta-lanterna puntata
      painted(anello(0.16, 0.035, 8), PAL.giallo, M(0.06, 1.34, -1.78)), // ghiera d'ottone della lanterna
    ]),
    luce: merged([
      painted(box(0.22, 0.1, 0.06), PAL.giallo, M(0, 1.64, -0.22)), // maschera d'ottone ardente
      painted(ico(0.14), PAL.arancio, M(0.06, 1.34, -1.78)), // dardo di fuoco nella lanterna
    ]),
  }),
  // Totem del Censo: idolo galleggiante di basalto scolpito e anelli d'oro, con ugello di bronzo sotto la pancia che sgancia bombe di magma
  nem_totem_censo: () => ({
    corpo: merged([
      painted(cil(0.38, 0.3, 0.88, 6), PAL.neroCaldo, M(0, 0.62, 0)), // monolite di basalto
      painted(anello(0.46, 0.05, 8), PAL.giallo, M(0, 0.82, 0, Math.PI / 2)),
      painted(anello(0.42, 0.05, 8), PAL.arancio, M(0, 0.42, 0, Math.PI / 2)),
      painted(box(1.35, 0.12, 0.32), PAL.arancio, M(0, 0.68, 0)), // alette stabilizzatrici in bronzo
      painted(cil(0.24, 0.16, 0.36, 8), PAL.arancio, M(0, 0.16, 0)), // ugello mortaio inferiore
    ]),
    luce: merged([
      painted(box(0.32, 0.16, 0.1), PAL.giallo, M(0, 0.68, -0.36)), // volto inciso incandescente
      painted(ico(0.18), PAL.arancio, M(0, 0.04, 0)), // goccia di magma pronta a cadere
    ]),
  }),
  // Arconte Solan: cappa d'amianto dorato e piastre di basalto, corona solare in bronzo, serbatoio d'olio sulla schiena e la lanterna gigante «Il Primo Lucignolo»
  nem_solan: () => ({
    corpo: merged([
      painted(box(0.48, 1.05, 0.48), PAL.neroCaldo, M(-0.32, 0.55, 0)), painted(box(0.48, 1.05, 0.48), PAL.neroCaldo, M(0.32, 0.55, 0)),
      painted(box(0.54, 0.26, 0.68), PAL.arancio, M(-0.32, 0.12, -0.05)), painted(box(0.54, 0.26, 0.68), PAL.arancio, M(0.32, 0.12, -0.05)),
      painted(box(1.46, 1.2, 0.84), PAL.neroCaldo, M(0, 1.95, 0.05)), // corazza di basalto levigato
      painted(box(1.52, 0.32, 0.88), PAL.giallo, M(0, 2.28, 0.05)), // manto d'amianto dorato sulle spalle
      ...[[-0.55, 2.52], [0.55, 2.52]].map(([x, y]) => painted(box(0.5, 0.22, 0.58), PAL.arancio, M(x!, y!, 0.05))),
      painted(cil(0.32, 0.32, 0.78, 8), PAL.arancio, M(0, 1.95, 0.58)), // serbatoio d'Olio di Roccia sulla schiena
      painted(box(0.46, 0.5, 0.46), PAL.neroCaldo, M(0, 2.82, 0.05)), // elmo-maschera dell'Arconte
      ...[-0.28, -0.14, 0, 0.14, 0.28].map((x, k) => painted(new THREE.ConeGeometry(0.06, 0.32 + (k === 2 ? 0.16 : 0), 4), PAL.giallo, M(x, 3.22, 0.05, 0, 0, -x * 0.8))), // raggiera solare
      painted(box(0.42, 1.0, 0.42), PAL.neroCaldo, M(-0.88, 1.98, 0.05)),
      painted(box(0.42, 0.9, 0.42), PAL.neroCaldo, M(0.88, 2.08, -0.2, 0.5, 0, 0)),
      // Asta e incensiere-lanterna gigante «Il Primo Lucignolo»
      painted(cil(0.09, 0.11, 4.2, 6), PAL.arancio, M(0.92, 1.65, -1.25, 1.45, 0, 0)),
      painted(box(0.58, 0.72, 0.58), PAL.neroCaldo, M(0.92, 1.38, -3.25)), // gabbia del Primo Lucignolo
      painted(box(0.66, 0.14, 0.66), PAL.giallo, M(0.92, 1.74, -3.25)),
      painted(box(0.66, 0.14, 0.66), PAL.giallo, M(0.92, 1.02, -3.25)),
    ]),
    luce: merged([
      painted(box(0.38, 0.14, 0.08), PAL.giallo, M(0, 2.84, -0.2)), // visiera ardente
      painted(cil(0.24, 0.24, 0.55, 8), PAL.giallo, M(0, 1.95, 0.64)), // vetro del serbatoio d'olio sulla schiena
      painted(ico(0.28), PAL.arancio, M(0.92, 1.38, -3.25)), // la Fiamma Madre nel Primo Lucignolo
    ]),
  }),
};

/** Segnaposto di un nemico del Santuario del Capo Ardente (null se non appartiene a questo stile). */
export function formaCeneri(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const { corpo, luce, portello } = f(), g = new THREE.Group(); g.name = model;
  const m = new THREE.Mesh(corpo, colori(model).clone()); m.name = model; g.add(m);
  if (luce) { const b = new THREE.Mesh(luce, colori(model + '_luce', 0.75, PAL.arancio).clone()); b.name = model + '_luce'; g.add(b); }
  if (portello) { const p = new THREE.Mesh(portello, colori(model + '_portello').clone()); p.name = 'portello'; g.add(p); }
  return g;
}

/** Colonnina della Ruota di Chiusa Termale in bronzo e basalto. */
export function chiusaBaseObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_ceneri_ruota';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.48, 0.56, 0.24, 8), PAL.neroCaldo, M(0, 0.12, 0)),
    painted(cil(0.22, 0.26, 1.1, 8), PAL.roccia, M(0, 0.72, 0)),
    painted(anello(0.26, 0.05, 8), PAL.arancio, M(0, 0.5, 0, Math.PI / 2)),
    painted(anello(0.26, 0.05, 8), PAL.arancio, M(0, 0.95, 0, Math.PI / 2)),
    painted(cil(0.18, 0.18, 0.55, 6), PAL.arancio, M(0.28, 0.38, 0, 0, 0, Math.PI / 2)), // condotto d'acqua marina
  ]), colori('ceneri_chiusa')));
  return g;
}
/** Volantino in bronzo della Chiusa Termale che gira a scatti quando lo azioni. */
export function chiusaObj(): { ruota: THREE.Group; gemma: THREE.MeshLambertMaterial } {
  const ruota = new THREE.Group(); ruota.name = 'ruota'; ruota.position.set(0, 1.45, -0.25);
  const parti: THREE.BufferGeometry[] = [painted(anello(0.48, 0.06, 12), PAL.arancio), painted(cil(0.12, 0.12, 0.12, 6), PAL.neroCaldo, M(0, 0, 0, Math.PI / 2))];
  for (let k = 0; k < 4; k++) parti.push(painted(box(0.94, 0.08, 0.06), PAL.giallo, M(0, 0, 0, 0, 0, (k * Math.PI) / 4)));
  ruota.add(new THREE.Mesh(merged(parti), colori('ceneri_chiusa')));
  const gemma = new THREE.MeshLambertMaterial({ color: PAL.rosso, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.4 });
  const gm = new THREE.Mesh(ico(0.11), gemma); gm.position.z = -0.08; ruota.add(gm);
  return { ruota, gemma };
}
/** Sfiato Termale dell'arena del Cratere (al posto dei piloni): colonna di basalto cerchiata d'ottone con griglia incandescente. */
export function sfiatoObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_ceneri_pilone';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.62, 0.72, 0.35, 8), PAL.neroCaldo, M(0, 0.18, 0)),
    painted(cil(0.48, 0.54, 2.1, 8), PAL.roccia, M(0, 1.35, 0)),
    painted(anello(0.52, 0.07, 8), PAL.arancio, M(0, 0.75, 0, Math.PI / 2)),
    painted(anello(0.5, 0.07, 8), PAL.arancio, M(0, 1.65, 0, Math.PI / 2)),
    painted(cil(0.58, 0.48, 0.32, 8), PAL.neroCaldo, M(0, 2.45, 0)),
    painted(ico(0.32), PAL.arancio, M(0, 2.65, 0)),
  ]), colori('ceneri_sfiato')));
  return g;
}
/** Sfiato Termale infranto dalla carica dell'Arconte Solan: moncone di basalto spaccato con braci sparse a terra. */
export function sfiatoRottoObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'moncone';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.62, 0.72, 0.42, 8), PAL.neroCaldo, M(0, 0.21, 0)),
    painted(ico(0.34), PAL.arancio, M(0, 0.38, 0)),
    painted(box(0.55, 0.24, 0.38), PAL.roccia, M(0.45, 0.12, 0.3, 0.2, 0.5, 0.3)),
    painted(box(0.48, 0.22, 0.34), PAL.roccia, M(-0.42, 0.11, -0.35, -0.2, -0.4, -0.2)),
    painted(anello(0.46, 0.06, 8), PAL.arancio, M(0.25, 0.08, -0.3, 1.3, 0.2, 0)),
  ]), colori('ceneri_sfiato')));
  return g;
}
/** Scorie vulcaniche incandescenti e croste di brace ardente sul pavimento (i `rottami` del Santuario). */
export function scorieGeo(): THREE.BufferGeometry {
  return merged([
    painted(cil(0.68, 0.78, 0.08, 7), PAL.neroCaldo, M(0, 0.04, 0)),
    ...[[-0.42, -0.35], [0.38, -0.25], [-0.15, 0.42], [0.45, 0.38], [0, -0.05]].map(([x, z], k) =>
      painted(ico(0.16 + (k % 2) * 0.05), k % 2 ? PAL.arancio : PAL.arancio, M(x!, 0.1, z!))),
    ...[[-0.2, -0.15], [0.22, 0.12]].map(([x, z]) => painted(ico(0.11), PAL.giallo, M(x!, 0.14, z!))),
  ]);
}
/** Ponte d'Ossidiana bordato di bronzo che si abbassa sopra il canale di magma (il `ponte` del Santuario). */
export function ponteOssidianaObj(lungo: number, largo: number): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_ceneri_ponte';
  const parti: THREE.BufferGeometry[] = [];
  for (let k = 0; k * 0.5 < largo - 0.1; k++) parti.push(painted(box(lungo, 0.14, 0.44), k % 2 ? PAL.neroCaldo : PAL.roccia, M(-lungo / 2, 0.07, -largo / 2 + 0.25 + k * 0.5)));
  for (const x of [0.4, lungo / 2, lungo - 0.4]) parti.push(painted(box(0.2, 0.12, largo), PAL.arancio, M(-x, 0.16, 0)));
  parti.push(painted(cil(0.09, 0.09, largo, 6), PAL.giallo, M(-0.05, 0.1, 0, Math.PI / 2)));
  g.add(new THREE.Mesh(merged(parti), colori('ceneri_ponte')));
  return g;
}
/** Getti di vapore bollente e scintille di brace spinti dai soffioni termali lungo +X. */
export function vaporeVentoGeo(): THREE.BufferGeometry {
  return merged([
    painted(box(1.55, 0.05, 0.14), PAL.sabbiaChiara, M(-0.1, 0.05, -0.55)),
    painted(box(1.2, 0.05, 0.12), PAL.arancio, M(0.2, 0.08, 0)),
    painted(box(1.35, 0.05, 0.14), PAL.arancio, M(0, 0.05, 0.55)),
    ...[[-0.75, -0.5], [0.7, 0.05], [0.55, 0.5], [-0.2, 0.2]].map(([x, z], k) => painted(ico(0.11), k % 2 ? PAL.giallo : PAL.arancio, M(x!, 0.18, z!))),
  ]);
}
