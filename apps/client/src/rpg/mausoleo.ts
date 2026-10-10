// Mausoleo Cinetico (Epopea della Regata, dungeon 4): segnaposto in codice finché il Claude di Jack non genera i modelli in Blender
// (assets/blender/models_mausoleo.py, stessi nomi). Kit dello stile (pavimento di marmo a scacchi con le righe d'ottone, muri di marmo
// bianco con la fascia d'ottone e il canale dell'acqua, colonne di marmo con l'ingranaggio in cima: anche i perni delle lancette, il
// cancello del Santuario come gabbia di sbarre d'ottone che scende nel pavimento), forme dei nemici (Chierico a Ingranaggi, Sentinella
// dell'Egida, Guardia d'Onore, il Custode dell'Egida), la chiave di carica e il sarcofago della Regina. Gli effetti della scena stanno in
// mausoleo_fx.ts. Solo colori della palette, texture a pixel nearest, facce piatte; quando arriva un modello vero nel manifest vince lui.
import * as THREE from 'three';
import { M, block, merged, painted, px, speckle, strata, tex } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import type { Part } from './dungeon_kit.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const vc = new Map<string, THREE.MeshLambertMaterial>();
/** Materiale a colori per vertice (uno per uso: i nemici lo clonano per lampeggiare); `luce` = acceso da sé (acqua che brilla, cuori). */
export const colori = (k = 'base', luce = 0): THREE.MeshLambertMaterial => {
  let m = vc.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...(luce ? { emissive: PAL.acquaBassa, emissiveIntensity: luce } : {}) });
    m.name = 'mat_mausoleo_' + k; vc.set(k, m);
  }
  return m;
};
const texMat = (t: THREE.Texture): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ map: t, flatShading: true });

// ——— kit dello stile ———
type KitMausoleo = Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'acqua', Part[]>;
let kit: KitMausoleo | null = null;
/** Colonna di marmo con l'ingranaggio d'ottone in cima (anche il perno delle lancette). */
export function colonnaGeo(): THREE.BufferGeometry {
  return merged([
    painted(cil(0.55, 0.6, 0.3, 8), PAL.pietra, M(0, 0.15, 0)), // base
    painted(cil(0.38, 0.38, 1.9, 8), PAL.pietraChiara, M(0, 1.25, 0)), // fusto
    painted(cil(0.42, 0.42, 0.08, 8), PAL.giallo, M(0, 0.6, 0)), painted(cil(0.42, 0.42, 0.08, 8), PAL.giallo, M(0, 1.9, 0)), // anelli d'ottone
    painted(cil(0.55, 0.45, 0.25, 8), PAL.pietra, M(0, 2.3, 0)), // capitello
    painted(cil(0.62, 0.62, 0.12, 12), PAL.arancio, M(0, 2.48, 0)), // l'ingranaggio
    ...[0, 1, 2, 3, 4, 5].map((k) => painted(box(0.2, 0.12, 0.22), PAL.arancio, M(Math.cos((k * Math.PI) / 3) * 0.7, 2.48, Math.sin((k * Math.PI) / 3) * 0.7, 0, -(k * Math.PI) / 3, 0))), // denti
    painted(cil(0.16, 0.16, 0.16, 6), PAL.giallo, M(0, 2.6, 0)), // mozzo
  ]);
}
/** Il cancello del Santuario: gabbia di sbarre d'ottone (uguale da ogni lato, perché le celle del bacino sono girate a caso). */
function cancelloGeo(): THREE.BufferGeometry {
  const parti: THREE.BufferGeometry[] = [];
  for (const s of [-0.85, 0.85]) {
    for (const t of [-0.45, 0.45]) { parti.push(painted(cil(0.06, 0.06, 2.3, 5), PAL.giallo, M(t, 1.15, s)), painted(cil(0.06, 0.06, 2.3, 5), PAL.giallo, M(s, 1.15, t))); }
    parti.push(painted(box(1.9, 0.12, 0.12), PAL.arancio, M(0, 2.3, s)), painted(box(0.12, 0.12, 1.9), PAL.arancio, M(s, 2.3, 0)));
    parti.push(painted(box(1.9, 0.1, 0.1), PAL.arancio, M(0, 0.9, s)), painted(box(0.1, 0.1, 1.9), PAL.arancio, M(s, 0.9, 0)));
  }
  parti.push(painted(cil(0.22, 0.22, 0.06, 8), PAL.acquaBassa, M(0, 2.38, 0))); // il sigillo a onda in cima
  return merged(parti);
}
/** Pezzi del kit `mausoleo` (cache): una geometria e un materiale per pezzo. `acqua` è il cancello (il bacino della chiave di carica). */
export function kitMausoleo(top: number): KitMausoleo {
  if (kit) return kit;
  const pav = tex('pav', 'mausoleo', (g, r) => {
    px(g, PAL.pietraChiara, 0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < 32; x += 16) px(g, PAL.pietra, x, y, 8, 8); // scacchi di marmo
    for (let i = 0; i < 32; i += 16) { px(g, PAL.giallo, i, 0, 1, 32); px(g, PAL.giallo, 0, i, 32, 1); } // righe d'ottone ogni metro
    for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]] as const) px(g, PAL.arancio, x, y, 2, 2); // borchie agli incroci
    speckle(g, r, PAL.sabbiaChiara, 14, 0, 32); speckle(g, r, PAL.pietraScura, 5, 0, 32); // venature
    strata(g, [[PAL.pietra, 3], [PAL.pietraScura, 32]]);
  });
  const muro = tex('muro', 'mausoleo', (g, r) => {
    px(g, PAL.pietra, 0, 0, 32, 32); speckle(g, r, PAL.pietraChiara, 24, 0, 32); // la cima
    // fianco (32 righe = 2 m dall'alto): conci di marmo bianco, fascia d'ottone, canale dell'acqua che corre alla base
    px(g, PAL.pietra, 0, 32, 32, 32);
    for (let y = 33, k = 0; y < 52; y += 6, k++) for (let x = (k % 2) * 8 - 8; x < 32; x += 16) px(g, PAL.pietraChiara, x + 1, y, 15, 5);
    px(g, PAL.arancio, 0, 45, 32, 1); px(g, PAL.giallo, 0, 46, 32, 2); px(g, PAL.arancio, 0, 48, 32, 1); // fascia d'ottone
    for (const x of [4, 20]) px(g, PAL.acquaBassa, x, 46, 3, 2); // gemme d'acqua nella fascia
    px(g, PAL.pietraScura, 0, 56, 32, 8); px(g, PAL.acqua, 0, 58, 32, 3); // il canale
    for (let x = 0; x < 32; x += 5) px(g, PAL.acquaBassa, x + (r.int(0, 2)), 58, 2, 1); // riflessi
  });
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: colonnaGeo(), mat: colori('kit') }],
    acqua: [{ geo: cancelloGeo(), mat: colori('cancello') }],
  };
  return kit;
}

// ——— forme dei nemici (−Z avanti, pivot a terra) ———
type Forma = { corpo: THREE.BufferGeometry; luce?: THREE.BufferGeometry };
const FORME: Record<string, () => Forma> = {
  // Chierico a Ingranaggi: tonaca di marmo bianco, testa a cupola d'ottone, l'ingranaggio come aureola, bastone con la lampada d'olio
  nem_chierico: () => ({
    corpo: merged([
      painted(cil(0.22, 0.5, 1.1, 8), PAL.pietraChiara, M(0, 0.55, 0)), // tonaca
      painted(cil(0.38, 0.38, 0.08, 8), PAL.giallo, M(0, 0.8, 0)), // cintura
      painted(cil(0.27, 0.24, 0.42, 8), PAL.pietra, M(0, 1.3, 0)), // busto
      painted(new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), PAL.giallo, M(0, 1.52, 0)), painted(cil(0.22, 0.22, 0.14, 8), PAL.giallo, M(0, 1.45, 0)), // testa a cupola
      painted(cil(0.44, 0.44, 0.06, 12), PAL.arancio, M(0, 1.62, 0.2, Math.PI / 2)), painted(cil(0.3, 0.3, 0.07, 12), PAL.pietraScura, M(0, 1.62, 0.21, Math.PI / 2)), // aureola a ingranaggio
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => painted(box(0.1, 0.1, 0.06), PAL.arancio, M(Math.cos(k * 0.785) * 0.5, 1.62 + Math.sin(k * 0.785) * 0.5, 0.2, 0, 0, k * 0.785))),
      painted(box(0.16, 0.55, 0.16), PAL.pietraChiara, M(-0.36, 1.15, -0.05, 0.3, 0, 0.2)), painted(box(0.16, 0.55, 0.16), PAL.pietraChiara, M(0.36, 1.15, -0.1, 0.5, 0, -0.2)), // maniche
      painted(cil(0.035, 0.035, 1.8, 5), PAL.legnoScuro, M(0.42, 0.95, -0.3)), painted(cil(0.1, 0.12, 0.08, 6), PAL.giallo, M(0.42, 1.88, -0.3)), // bastone
    ]),
    luce: merged([
      painted(ico(0.11), PAL.acquaBassa, M(0.42, 1.98, -0.3)), // la lampada d'olio
      painted(box(0.24, 0.04, 0.04), PAL.acquaBassa, M(0, 1.5, -0.21)), // l'occhio
    ]),
  }),
  // Sentinella dell'Egida: corazza pesante di marmo e ottone, elmo a celata, lo scudo torre a energia cinetica davanti
  nem_sentinella: () => ({
    corpo: merged([
      painted(box(0.34, 0.85, 0.36), PAL.pietraScura, M(-0.26, 0.45, 0.05)), painted(box(0.34, 0.85, 0.36), PAL.pietraScura, M(0.26, 0.45, 0.05)), // gambe
      painted(box(0.42, 0.18, 0.5), PAL.roccia, M(-0.26, 0.09, 0)), painted(box(0.42, 0.18, 0.5), PAL.roccia, M(0.26, 0.09, 0)), // piedi
      painted(box(1.05, 0.95, 0.7), PAL.pietra, M(0, 1.35, 0.05)), painted(box(1.1, 0.1, 0.75), PAL.giallo, M(0, 1.05, 0.05)), painted(box(1.1, 0.1, 0.75), PAL.giallo, M(0, 1.78, 0.05)), // busto
      painted(box(0.42, 0.42, 0.42), PAL.pietraScura, M(0, 2.05, 0.05)), painted(box(0.46, 0.08, 0.46), PAL.giallo, M(0, 2.3, 0.05)), // elmo
      painted(box(0.3, 0.7, 0.3), PAL.pietra, M(0.66, 1.35, 0.05)), painted(box(0.34, 0.3, 0.34), PAL.roccia, M(0.66, 0.9, 0.05)), // braccio destro
      painted(box(0.3, 0.6, 0.3), PAL.pietra, M(-0.62, 1.4, -0.25, 0.6, 0, 0)), // braccio dello scudo
      painted(box(1.25, 1.85, 0.12), PAL.acquaProfonda, M(-0.1, 1.05, -0.62)), // lo scudo torre
      painted(box(1.35, 0.1, 0.16), PAL.giallo, M(-0.1, 1.98, -0.62)), painted(box(1.35, 0.1, 0.16), PAL.giallo, M(-0.1, 0.12, -0.62)),
      painted(box(0.1, 1.85, 0.16), PAL.giallo, M(-0.75, 1.05, -0.62)), painted(box(0.1, 1.85, 0.16), PAL.giallo, M(0.55, 1.05, -0.62)),
    ]),
    luce: merged([
      painted(box(0.9, 1.3, 0.04), PAL.acquaBassa, M(-0.1, 1.05, -0.69)), // l'energia cinetica nello scudo
      painted(box(0.28, 0.05, 0.04), PAL.acquaBassa, M(0, 2.07, -0.17)), // la celata
    ]),
  }),
  // Guardia d'Onore: élite asimmetrica. A sinistra la spada d'acqua tagliente, a destra il braccio-serbatoio d'ottone che la tiene in
  // pressione; elmo col pennacchio rosso, fascia rossa sulla corazza bianca
  nem_guardia: () => ({
    corpo: merged([
      painted(box(0.22, 0.85, 0.24), PAL.pietraChiara, M(-0.15, 0.45, 0)), painted(box(0.22, 0.85, 0.24), PAL.pietraChiara, M(0.15, 0.45, 0)), // gambe
      painted(box(0.6, 0.7, 0.38), PAL.pietraChiara, M(0, 1.25, 0)), painted(box(0.64, 0.1, 0.42), PAL.giallo, M(0, 0.95, 0)), // corazza
      painted(box(0.66, 0.12, 0.42), PAL.rosso, M(0, 1.35, 0, 0, 0, 0.5)), // fascia
      painted(box(0.3, 0.32, 0.3), PAL.pietraScura, M(0, 1.8, 0)), painted(box(0.08, 0.4, 0.34), PAL.rosso, M(0, 2.12, 0.04)), // elmo e pennacchio
      painted(box(0.14, 0.6, 0.14), PAL.pietraChiara, M(-0.4, 1.25, -0.15, 0.6, 0, 0)), painted(box(0.18, 0.1, 0.1), PAL.giallo, M(-0.42, 1.0, -0.42)), // braccio e elsa
      painted(cil(0.18, 0.2, 0.75, 8), PAL.arancio, M(0.46, 1.25, 0)), painted(cil(0.08, 0.1, 0.25, 6), PAL.pietraScura, M(0.46, 0.8, -0.05)), // braccio-serbatoio
      painted(box(0.12, 0.12, 0.05), PAL.giallo, M(0.46, 1.35, -0.2)), // manometro
      painted(cil(0.04, 0.04, 0.6, 5), PAL.pietraScura, M(0.1, 1.45, 0.25, 0, 0, 1.2)), // il tubo che porta l'acqua alla spada
    ]),
    luce: merged([painted(box(0.07, 0.07, 1.25), PAL.acquaBassa, M(-0.42, 1.0, -1.05)), painted(box(0.14, 0.03, 1.2), PAL.acqua, M(-0.42, 1.0, -1.05))]), // la lama d'acqua
  }),
  // Il Custode dell'Egida: il guardiano della Regina, alto tre metri. Tre cuori nel petto (acqua, vapore, moto), l'Egida (scudo rotondo
  // d'ottone e acqua) a sinistra, il tridente a destra, pistoni sulla schiena
  nem_custode_egida: () => ({
    corpo: merged([
      painted(box(0.5, 1.2, 0.55), PAL.pietra, M(-0.4, 0.62, 0)), painted(box(0.5, 1.2, 0.55), PAL.pietra, M(0.4, 0.62, 0)), // gambe
      painted(box(0.56, 0.3, 0.2), PAL.giallo, M(-0.4, 0.75, -0.3)), painted(box(0.56, 0.3, 0.2), PAL.giallo, M(0.4, 0.75, -0.3)), // ginocchiere
      painted(box(0.6, 0.2, 0.75), PAL.roccia, M(-0.4, 0.1, -0.05)), painted(box(0.6, 0.2, 0.75), PAL.roccia, M(0.4, 0.1, -0.05)), // piedi
      painted(box(1.2, 0.4, 0.8), PAL.pietraScura, M(0, 1.4, 0)), // vita
      painted(box(1.7, 1.25, 1.0), PAL.pietraChiara, M(0, 2.2, 0)), painted(box(1.75, 0.12, 1.05), PAL.giallo, M(0, 1.62, 0)), painted(box(1.75, 0.12, 1.05), PAL.giallo, M(0, 2.8, 0)), // busto
      painted(box(1.0, 0.5, 0.08), PAL.neroCaldo, M(0, 2.25, -0.52)), // la finestra dei cuori
      painted(cil(0.42, 0.5, 0.45, 8), PAL.arancio, M(-1.05, 2.7, 0)), painted(cil(0.42, 0.5, 0.45, 8), PAL.arancio, M(1.05, 2.7, 0)), // spallacci
      painted(box(0.55, 0.6, 0.55), PAL.pietraScura, M(0, 3.15, 0)), painted(box(0.12, 0.45, 0.6), PAL.giallo, M(0, 3.55, 0)), // elmo e cresta
      painted(box(0.4, 1.0, 0.4), PAL.pietra, M(-1.05, 1.95, -0.1)), painted(box(0.4, 1.0, 0.4), PAL.pietra, M(1.05, 1.95, -0.2, 0.4, 0, 0)), // braccia
      painted(cil(0.95, 0.95, 0.16, 12), PAL.giallo, M(-1.25, 1.8, -0.62, Math.PI / 2)), painted(cil(0.78, 0.78, 0.04, 12), PAL.acquaProfonda, M(-1.25, 1.8, -0.71, Math.PI / 2)), // l'Egida, davanti a sinistra
      painted(cil(0.06, 0.06, 3.2, 6), PAL.giallo, M(1.15, 1.7, -0.55)), // il tridente
      ...[-0.22, 0, 0.22].map((x) => painted(box(0.06, 0.5, 0.06), PAL.pietraChiara, M(1.15 + x, 3.45, -0.55))), painted(box(0.5, 0.08, 0.08), PAL.giallo, M(1.15, 3.2, -0.55)),
      painted(cil(0.13, 0.13, 1.1, 6), PAL.pietra, M(-0.4, 2.3, 0.6)), painted(cil(0.13, 0.13, 1.1, 6), PAL.pietra, M(0.4, 2.3, 0.6)), // pistoni
    ]),
    luce: merged([
      painted(ico(0.17), PAL.acqua, M(-0.3, 2.25, -0.56)), painted(ico(0.17), PAL.pietraChiara, M(0, 2.25, -0.56)), painted(ico(0.17), PAL.giallo, M(0.3, 2.25, -0.56)), // tre cuori
      painted(box(0.4, 0.06, 0.05), PAL.acquaBassa, M(0, 3.2, -0.28)), // occhi
      painted(cil(0.45, 0.45, 0.02, 10), PAL.acquaBassa, M(-1.25, 1.8, -0.74, Math.PI / 2)), // l'onda sull'Egida
    ]),
  }),
};
/** Segnaposto di un nemico del Mausoleo (null = non è uno dei loro): corpo a colori per vertice e le parti che brillano da sé. */
export function formaNemico(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const { corpo, luce } = f(), g = new THREE.Group(); g.name = model;
  const m = new THREE.Mesh(corpo, colori(model).clone()); m.name = model; g.add(m);
  if (luce) { const b = new THREE.Mesh(luce, colori(model + '_luce', 0.6).clone()); b.name = model + '_luce'; g.add(b); }
  return g;
}

/** La chiave di carica (segnaposto di dng_mausoleo_leva): cassa d'orologio di marmo con la piastra d'ottone e il quadrante; la chiave a
 *  farfalla sopra la mette il codice (gira quando la carichi). */
export function chiaveObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_mausoleo_leva';
  g.add(new THREE.Mesh(merged([
    painted(box(1.0, 0.9, 0.8), PAL.pietraChiara, M(0, 0.45, 0)), painted(box(1.05, 0.1, 0.85), PAL.giallo, M(0, 0.92, 0)),
    painted(cil(0.32, 0.32, 0.05, 12), PAL.giallo, M(0, 0.5, -0.42, Math.PI / 2)), painted(cil(0.26, 0.26, 0.06, 12), PAL.sabbiaChiara, M(0, 0.5, -0.43, Math.PI / 2)), // quadrante
    painted(box(0.03, 0.2, 0.02), PAL.neroCaldo, M(0, 0.58, -0.47)), painted(box(0.14, 0.03, 0.02), PAL.neroCaldo, M(0.06, 0.5, -0.47)), // lancette
    painted(cil(0.1, 0.1, 0.25, 6), PAL.arancio, M(0, 1.05, 0)), // il perno della chiave
  ]), colori('chiave')));
  return g;
}
/** La chiave a farfalla (sempre in codice, anche sul modello vero: gira a scatti quando la carichi). */
export function farfalla(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'farfalla'; g.position.y = 1.2;
  g.add(new THREE.Mesh(merged([
    painted(cil(0.05, 0.05, 0.4, 5), PAL.giallo, M(0, 0.1, 0)),
    painted(box(0.34, 0.26, 0.06), PAL.giallo, M(-0.2, 0.35, 0)), painted(box(0.34, 0.26, 0.06), PAL.giallo, M(0.2, 0.35, 0)),
    painted(box(0.2, 0.14, 0.07), PAL.arancio, M(-0.2, 0.35, 0)), painted(box(0.2, 0.14, 0.07), PAL.arancio, M(0.2, 0.35, 0)),
  ]), colori('chiave')));
  return g;
}
/** Il sarcofago della Regina (segnaposto di dng_mausoleo_sarcofago): cassa di marmo su due gradini, fregio d'ottone e il sigillo a onda.
 *  Il coperchio è a parte (in codice: scivola via quando il Custode cade). */
export function sarcofagoObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_mausoleo_sarcofago';
  g.add(new THREE.Mesh(merged([
    painted(box(2.0, 0.2, 2.0), PAL.pietra, M(0, 0.1, 0)), painted(box(1.6, 0.2, 1.8), PAL.pietraScura, M(0, 0.3, 0)), // gradini
    painted(box(1.1, 0.7, 1.7), PAL.pietraChiara, M(0, 0.75, 0)), painted(box(1.15, 0.1, 1.75), PAL.giallo, M(0, 0.6, 0)), // la cassa
    painted(box(1.12, 0.06, 1.72), PAL.acqua, M(0, 1.0, 0)), // il bordo d'acqua (si vede quando il coperchio scivola)
  ]), colori('sarcofago')));
  return g;
}
/** Il coperchio del sarcofago, col sigillo a onda (sempre in codice). */
export function coperchio(): THREE.Object3D {
  const m = new THREE.Mesh(merged([
    painted(box(1.2, 0.18, 1.8), PAL.pietraChiara, M(0, 0.09, 0)), painted(box(0.9, 0.12, 1.4), PAL.pietra, M(0, 0.24, 0)),
    painted(cil(0.24, 0.24, 0.06, 10), PAL.giallo, M(0, 0.33, 0)), painted(box(0.3, 0.04, 0.06), PAL.acquaBassa, M(0, 0.37, 0, 0, 0.4, 0)),
  ]), colori('sarcofago'));
  m.name = 'coperchio'; m.position.y = 1.05;
  return m;
}
