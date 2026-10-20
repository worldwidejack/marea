// La Diga dei Disertori (docs/RPG.md §2g): segnaposto in codice finché il Claude di Jack non genera i modelli in Blender
// (assets/blender/models_diga.py, stessi nomi). Kit dello stile (tavolato della «Stella del Mattino» col catrame nelle commessure, murate di
// fasciame con le ordinate, i rivetti e i cirripedi sulla linea dell'acqua, cannoni sugli affusti al posto delle colonne, acqua di mare
// scura nei bacini), forme dei nemici (la Guardia della Paratia col portello e lo scafandro, il Fuciliere d'Acquafonda, l'Albatros di Pece
// col barile, il Capitano Vaelen con l'albero maestro come lancia) e gli oggetti di scena (la Ruota di Sentina, il pilone di legno intero e
// fracassato, i rottami acuminati, il ponte mobile). Gli effetti stanno in diga_fx.ts. Solo colori della palette, texture a pixel nearest,
// facce piatte; quando arriva un modello vero nel manifest vince lui.
import * as THREE from 'three';
import { M, block, merged, painted, px, strata, tex } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import type { Part } from './dungeon_kit.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const anello = (r: number, t: number, s = 10) => new THREE.TorusGeometry(r, t, 4, s);
const vc = new Map<string, THREE.MeshLambertMaterial>();
/** Materiale a colori per vertice (uno per uso: i nemici lo clonano per lampeggiare); `luce` = acceso da sé (occhi, fuoco fatuo). */
export const colori = (k = 'base', luce = 0, c: string = PAL.acquaBassa): THREE.MeshLambertMaterial => {
  let m = vc.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...(luce ? { emissive: c, emissiveIntensity: luce } : {}) });
    m.name = 'mat_diga_' + k; vc.set(k, m);
  }
  return m;
};
const texMat = (t: THREE.Texture): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ map: t, flatShading: true });

// ——— kit dello stile ———
type KitDiga = Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'acqua', Part[]>;
let kit: KitDiga | null = null;
/** Cannone di ferro sull'affusto di legno, la bocca verso −Z (le colonne della Diga: i cannoni della Batteria, il pezzo di coperta). */
export function cannoneGeo(): THREE.BufferGeometry {
  return merged([
    painted(box(1.1, 0.35, 1.5), PAL.legnoScuro, M(0, 0.4, 0.1)), painted(box(1.15, 0.12, 1.55), PAL.legno, M(0, 0.62, 0.1)), // affusto
    ...[-0.62, 0.62].flatMap((x) => [-0.4, 0.55].map((z) => painted(cil(0.24, 0.24, 0.14, 8), PAL.legno, M(x, 0.24, z, 0, 0, Math.PI / 2)))), // ruote
    painted(cil(0.24, 0.32, 1.8, 8), PAL.roccia, M(0, 0.95, -0.25, Math.PI / 2)), // la canna
    painted(cil(0.3, 0.3, 0.12, 8), PAL.neroCaldo, M(0, 0.95, -1.12, Math.PI / 2)), painted(cil(0.16, 0.16, 0.14, 8), PAL.neroCaldo, M(0, 0.95, -1.16, Math.PI / 2)), // la bocca
    painted(cil(0.27, 0.27, 0.1, 8), PAL.pietraScura, M(0, 0.95, 0.15, Math.PI / 2)), painted(ico(0.16), PAL.roccia, M(0, 0.95, 0.72)), // anello e pomolo
    painted(cil(0.04, 0.04, 1.3, 4), PAL.sabbia, M(0.4, 0.75, 0.6, 0, 0, Math.PI / 2)), // la braca
    painted(ico(0.14), PAL.neroCaldo, M(-0.35, 0.14, 0.75)), painted(ico(0.14), PAL.neroCaldo, M(-0.15, 0.14, 0.82)), // palle da cannone
  ]);
}
/** Pezzi del kit `diga` (cache): una geometria e un materiale per pezzo. `acqua` è il mare nei bacini (sentina, infermeria, canali, la
 *  falla sotto il ponte mobile). */
export function kitDiga(top: number): KitDiga {
  if (kit) return kit;
  const pav = tex('pav', 'diga', (g) => {
    px(g, PAL.legno, 0, 0, 32, 32);
    for (let y = 0; y < 32; y += 6) { px(g, PAL.neroCaldo, 0, y, 32, 1); px(g, PAL.legnoChiaro, 0, y + 1, 32, 1); } // tavole col catrame nelle commessure
    for (let y = 0; y < 32; y += 6) px(g, PAL.ombraCalda, (y * 7 + 5) % 32, y + 1, 1, 5); // teste delle tavole
    for (let y = 3; y < 32; y += 6) for (const x of [(y * 3) % 32, (y * 11 + 9) % 32]) px(g, PAL.roccia, x, y); // chiodi
    strata(g, [[PAL.legnoScuro, 4], [PAL.ombraCalda, 32]]);
  });
  const muro = tex('muro', 'diga', (g, r) => {
    px(g, PAL.legnoScuro, 0, 0, 32, 32); // la cima: il bordo della murata
    for (let y = 0; y < 32; y += 8) px(g, PAL.neroCaldo, 0, y, 32, 1);
    // fianco (32 righe = 2 m dall'alto): fasciame col catrame, due ordinate, rivetti, la linea dell'acqua coi cirripedi
    px(g, PAL.legno, 0, 32, 32, 32);
    for (let y = 34; y < 60; y += 4) { px(g, PAL.neroCaldo, 0, y, 32, 1); px(g, PAL.legnoChiaro, (y * 5) % 32, y + 1, 6, 1); }
    for (const x of [3, 19]) { px(g, PAL.legnoScuro, x, 32, 4, 28); px(g, PAL.ombraCalda, x + 3, 32, 1, 28); } // ordinate
    for (let y = 35; y < 58; y += 6) for (const x of [4, 5, 20, 21]) px(g, PAL.roccia, x, y); // rivetti di ferro
    px(g, PAL.acquaProfonda, 0, 55, 32, 1); // la linea dell'acqua
    px(g, PAL.ombraCalda, 0, 56, 32, 8);
    for (let i = 0; i < 9; i++) { const x = r.int(0, 31); px(g, i % 3 ? PAL.pietraChiara : PAL.pietra, x, r.int(53, 58), 2, 1); } // cirripedi
  });
  const acqua = tex('acqua', 'diga', (g) => {
    px(g, PAL.acquaProfonda, 0, 0, 32, 32);
    strata(g, [[PAL.acqua, 2], [PAL.abisso, 32]]);
  });
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: cannoneGeo(), mat: colori('kit') }],
    acqua: [{ geo: block(2, 2, 0.45, 0), mat: texMat(acqua) }],
  };
  return kit;
}

// ——— forme dei nemici (−Z avanti, pivot a terra; l'Albatros lo alza dungeon_actors.ts) ———
/** `corpo` a colori per vertice; `luce` le parti che brillano da sé (occhi, fuoco fatuo); `portello` lo scudo che si stacca (la Guardia
 *  della Paratia lo perde: dungeon_actors.ts lo nasconde). */
type Forma = { corpo: THREE.BufferGeometry; luce?: THREE.BufferGeometry; portello?: THREE.BufferGeometry };
const PELLE = PAL.legnoChiaro;
const FORME: Record<string, () => Forma> = {
  // La Guardia della Paratia: colosso a torso nudo coi tatuaggi, lo scafandro di rame come elmo, l'ancora spezzata nella destra e il
  // portello di quercia ferrata come scudo torre nella sinistra (davanti); sopra il portello l'icona dello scudo incrinato
  nem_guardiano: () => ({
    corpo: merged([
      painted(box(0.42, 0.9, 0.42), PAL.legnoScuro, M(-0.3, 0.45, 0.05)), painted(box(0.42, 0.9, 0.42), PAL.legnoScuro, M(0.3, 0.45, 0.05)), // calzoni
      painted(box(0.5, 0.16, 0.6), PAL.neroCaldo, M(-0.3, 0.08, -0.02)), painted(box(0.5, 0.16, 0.6), PAL.neroCaldo, M(0.3, 0.08, -0.02)), // stivali
      painted(box(0.95, 0.14, 0.62), PAL.ombraCalda, M(0, 0.95, 0.05)), // cintura
      painted(box(1.15, 0.85, 0.7), PELLE, M(0, 1.45, 0.05)), // il torace
      painted(box(0.5, 0.06, 0.02), PAL.acquaProfonda, M(-0.2, 1.55, -0.31, 0, 0, 0.4)), painted(box(0.4, 0.06, 0.02), PAL.acquaProfonda, M(0.25, 1.35, -0.31, 0, 0, -0.5)), // tatuaggi
      painted(box(0.36, 0.9, 0.36), PELLE, M(0.78, 1.35, 0.0)), painted(box(0.38, 0.12, 0.38), PAL.acquaProfonda, M(0.78, 1.45, 0)), // braccio destro (tatuato)
      painted(box(0.36, 0.7, 0.36), PELLE, M(-0.72, 1.45, -0.25, 0.7, 0, 0)), // braccio del portello
      painted(cil(0.38, 0.4, 0.62, 8), PAL.arancio, M(0, 2.15, 0.05)), painted(cil(0.42, 0.42, 0.1, 8), PAL.legno, M(0, 1.86, 0.05)), // lo scafandro di rame
      painted(cil(0.15, 0.15, 0.06, 8), PAL.neroCaldo, M(0, 2.17, -0.34, Math.PI / 2)), // l'oblò
      painted(cil(0.06, 0.06, 1.7, 5), PAL.roccia, M(0.85, 0.95, -0.25, 0.25, 0, 0)), // l'ancora spezzata: il fuso
      painted(box(0.85, 0.12, 0.12), PAL.roccia, M(0.85, 0.25, -0.45, 0, 0, 0)), painted(new THREE.ConeGeometry(0.12, 0.25, 4), PAL.pietraScura, M(1.28, 0.33, -0.45)), // la marra (una sola punta: è spezzata)
      painted(anello(0.12, 0.04, 6), PAL.roccia, M(0.85, 1.75, -0.03)), // la cicala
    ]),
    luce: merged([painted(cil(0.11, 0.11, 0.04, 8), PAL.acquaBassa, M(0, 2.17, -0.37, Math.PI / 2))]), // il vetro dell'oblò
    portello: merged([
      painted(box(1.35, 1.9, 0.16), PAL.legnoScuro, M(-0.25, 1.05, -0.7)), // il portello di quercia
      ...[-0.65, 0.15].map((y) => painted(box(1.4, 0.12, 0.2), PAL.roccia, M(-0.25, 1.05 + y + 0.25, -0.72))), // le bande di ferro
      painted(box(0.12, 1.95, 0.2), PAL.roccia, M(-0.85, 1.05, -0.72)), painted(box(0.12, 1.95, 0.2), PAL.roccia, M(0.35, 1.05, -0.72)),
      painted(cil(0.13, 0.13, 0.08, 6), PAL.pietraScura, M(-0.25, 1.05, -0.8, Math.PI / 2)), // la maniglia
      painted(box(0.34, 0.38, 0.06), PAL.giallo, M(-0.25, 2.2, -0.72)), painted(box(0.05, 0.3, 0.07), PAL.neroCaldo, M(-0.22, 2.2, -0.73, 0, 0, 0.3)), // l'icona dello scudo incrinato
    ]),
  }),
  // Il Fuciliere d'Acquafonda: smilzo, cerata gialla unta di catrame, bandana rossa, tricorno di cuoio sugli occhi (niente faccia),
  // il moschetto lungo con la baionetta arrugginita
  nem_fuciliere: () => ({
    corpo: merged([
      painted(box(0.18, 0.8, 0.2), PAL.ombraCalda, M(-0.13, 0.4, 0)), painted(box(0.18, 0.8, 0.2), PAL.ombraCalda, M(0.13, 0.4, 0)), // gambe
      painted(box(0.2, 0.12, 0.3), PAL.neroCaldo, M(-0.13, 0.06, -0.05)), painted(box(0.2, 0.12, 0.3), PAL.neroCaldo, M(0.13, 0.06, -0.05)),
      painted(cil(0.2, 0.3, 0.9, 6), PAL.giallo, M(0, 1.05, 0)), // la cerata
      painted(box(0.44, 0.06, 0.34), PAL.neroCaldo, M(0, 0.9, 0)), // macchie di catrame
      painted(box(0.14, 0.6, 0.14), PAL.giallo, M(-0.3, 1.2, -0.2, 0.9, 0, 0.2)), painted(box(0.14, 0.6, 0.14), PAL.giallo, M(0.3, 1.25, -0.15, 0.8, 0, -0.2)), // braccia sul fucile
      painted(box(0.26, 0.26, 0.26), PAL.neroCaldo, M(0, 1.65, 0)), // la faccia in ombra
      painted(box(0.3, 0.1, 0.3), PAL.rosso, M(0, 1.76, 0.02)), painted(box(0.08, 0.2, 0.06), PAL.rosso, M(0, 1.66, 0.17)), // bandana
      painted(cil(0.32, 0.32, 0.08, 3), PAL.legnoScuro, M(0, 1.83, 0)), painted(cil(0.16, 0.2, 0.14, 6), PAL.legnoScuro, M(0, 1.92, 0)), // tricorno
      painted(box(0.08, 0.12, 0.7), PAL.legnoScuro, M(0.05, 1.3, -0.1)), // il calcio
      painted(cil(0.035, 0.035, 1.4, 5), PAL.roccia, M(0.05, 1.35, -1.05, Math.PI / 2)), // la canna lunga
      painted(box(0.03, 0.03, 0.4), PAL.legno, M(0.05, 1.31, -1.9)), // la baionetta arrugginita
    ]),
  }),
  // L'Albatros di Pece: grosso uccello marino scheletrico coperto di catrame lucido, ali larghe, il becco d'osso e il barilotto rosso di
  // polvere da sparo tra gli artigli
  nem_albatros: () => ({
    corpo: merged([
      painted(box(0.45, 0.4, 1.0), PAL.roccia, M(0, 0.55, 0)), painted(box(0.47, 0.1, 0.9), PAL.neroCaldo, M(0, 0.78, 0.02)), // il corpo, la pece che cola sulla schiena
      painted(box(0.3, 0.3, 0.32), PAL.roccia, M(0, 0.7, -0.6)), painted(box(0.1, 0.1, 0.5), PAL.pietraChiara, M(0, 0.66, -0.98)), // testa e becco d'osso
      painted(box(1.6, 0.06, 0.45), PAL.roccia, M(-0.95, 0.66, 0, 0, 0, 0.18)), painted(box(1.6, 0.06, 0.45), PAL.roccia, M(0.95, 0.66, 0, 0, 0, -0.18)), // ali
      painted(box(1.5, 0.07, 0.12), PAL.neroCaldo, M(-0.95, 0.67, 0.2, 0, 0, 0.18)), painted(box(1.5, 0.07, 0.12), PAL.neroCaldo, M(0.95, 0.67, 0.2, 0, 0, -0.18)), // le penne impeciate
      ...[-1, 1].flatMap((s) => [0.6, 1.1, 1.55].map((x) => painted(box(0.06, 0.08, 0.5), PAL.pietraChiara, M(s * x, 0.7 + (s > 0 ? -0.11 : 0.11) * (x - 0.6), 0.08)))), // le ossa delle ali
      painted(box(0.36, 0.05, 0.4), PAL.roccia, M(0, 0.6, 0.62, -0.3, 0, 0)), // la coda
      painted(cil(0.2, 0.2, 0.36, 8), PAL.rosso, M(0, 0.2, 0.05, 0, 0, Math.PI / 2)), // il barilotto rosso
      painted(cil(0.21, 0.21, 0.04, 8), PAL.legnoScuro, M(-0.12, 0.2, 0.05, 0, 0, Math.PI / 2)), painted(cil(0.21, 0.21, 0.04, 8), PAL.legnoScuro, M(0.12, 0.2, 0.05, 0, 0, Math.PI / 2)),
      painted(box(0.04, 0.24, 0.04), PAL.pietraChiara, M(-0.1, 0.38, 0.05)), painted(box(0.04, 0.24, 0.04), PAL.pietraChiara, M(0.1, 0.38, 0.05)), // gli artigli
    ]),
    luce: merged([painted(box(0.06, 0.06, 0.04), PAL.arancio, M(-0.1, 0.76, -0.77)), painted(box(0.06, 0.06, 0.04), PAL.arancio, M(0.1, 0.76, -0.77))]), // occhi
  }),
  // Il Capitano Vaelen: gigante malinconico, cappotto da ammiraglio blu scuro lacero e incrostato di sale e cirripedi, tricorno spezzato,
  // il braccio sinistro avvolto nelle catene dell'ancora; nella destra il tronco spezzato dell'albero maestro come lancia, col brandello
  // di vela bianca sotto la punta d'acciaio
  nem_vaelen: () => ({
    corpo: merged([
      painted(box(0.45, 1.05, 0.5), PAL.ombraCalda, M(-0.32, 0.55, 0)), painted(box(0.45, 1.05, 0.5), PAL.ombraCalda, M(0.32, 0.55, 0)), // gambe
      painted(box(0.5, 0.18, 0.66), PAL.neroCaldo, M(-0.32, 0.09, -0.05)), painted(box(0.5, 0.18, 0.66), PAL.neroCaldo, M(0.32, 0.09, -0.05)),
      painted(cil(0.62, 0.85, 1.5, 6), PAL.abisso, M(0, 1.35, 0.05)), // il cappotto lungo
      painted(box(1.4, 0.95, 0.85), PAL.abisso, M(0, 2.15, 0.05)), painted(box(0.5, 0.95, 0.06), PAL.acquaProfonda, M(0, 2.1, -0.4)), // il busto e il bavero
      ...[[-0.45, 2.45], [0.45, 2.45]].map(([x, y]) => painted(box(0.45, 0.14, 0.5), PAL.giallo, M(x!, y!, 0.05))), // le spalline d'ammiraglio
      ...[[-0.3, 1.2, -0.62], [0.35, 0.9, -0.66], [0.15, 2.0, -0.44], [-0.55, 1.7, -0.55], [0.5, 1.5, -0.6]].map(([x, y, z]) => painted(ico(0.07), PAL.pietraChiara, M(x!, y!, z!))), // sale e cirripedi
      painted(box(0.45, 0.48, 0.45), PAL.pietra, M(0, 2.85, 0.05)), // la testa grigia, smagrita
      painted(cil(0.55, 0.55, 0.12, 3), PAL.neroCaldo, M(0, 3.15, 0.05)), painted(cil(0.24, 0.3, 0.2, 6), PAL.neroCaldo, M(0.06, 3.28, 0.05, 0, 0, 0.35)), // tricorno spezzato
      painted(box(0.4, 1.05, 0.4), PAL.abisso, M(-0.85, 2.0, 0.05)), // il braccio sinistro
      ...[1.65, 1.85, 2.05, 2.25].map((y, k) => painted(anello(0.26, 0.05, 8), PAL.roccia, M(-0.85, y, 0.05, Math.PI / 2, 0, k * 0.3))), // le catene dell'ancora
      painted(box(0.06, 0.06, 0.9), PAL.roccia, M(-0.85, 1.45, 0.4, 0.6, 0, 0)), // la catena che pende
      painted(box(0.4, 0.9, 0.4), PAL.abisso, M(0.85, 2.1, -0.2, 0.5, 0, 0)), // il braccio destro, avanti
      painted(cil(0.13, 0.17, 4.6, 6), PAL.legno, M(0.9, 1.75, -1.2, Math.PI / 2 - 0.12, 0, 0)), // l'albero maestro spezzato
      painted(new THREE.ConeGeometry(0.16, 0.6, 4), PAL.pietra, M(0.9, 1.47, -3.75, -Math.PI / 2 - 0.12, 0, 0)), // la punta d'acciaio
      painted(cil(0.2, 0.2, 0.12, 6), PAL.roccia, M(0.9, 1.53, -3.3, Math.PI / 2 - 0.12, 0, 0)), // la ghiera
    ]),
    luce: merged([
      painted(box(0.32, 0.05, 0.04), PAL.acquaBassa, M(0, 2.9, -0.23)), // occhi da spettro
      painted(box(0.06, 0.55, 0.62), PAL.sabbiaChiara, M(0.9, 1.25, -3.05, 0.12, 0, 0)), // il brandello di vela bianca (s'illumina nell'Ultima Marea)
    ]),
  }),
};
/** Segnaposto di un nemico della Diga (null = non è uno dei loro): corpo a colori per vertice, le parti che brillano da sé e il portello
 *  della Guardia (nome `portello`). */
export function formaNemico(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const { corpo, luce, portello } = f(), g = new THREE.Group(); g.name = model;
  const m = new THREE.Mesh(corpo, colori(model).clone()); m.name = model; g.add(m);
  if (luce) { const b = new THREE.Mesh(luce, colori(model + '_luce', 0.6).clone()); b.name = model + '_luce'; g.add(b); }
  if (portello) { const p = new THREE.Mesh(portello, colori(model + '_portello').clone()); p.name = 'portello'; g.add(p); }
  return g;
}

// ——— oggetti di scena ———
/** La Ruota di Sentina (segnaposto di dng_diga_ruota): il piedistallo di legno col boccaporto d'ottone; la ruota la mette il codice (gira). */
export function ruotaBaseObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_diga_ruota';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.45, 0.55, 0.2, 8), PAL.legnoScuro, M(0, 0.1, 0)),
    painted(box(0.3, 1.05, 0.3), PAL.legno, M(0, 0.7, 0)), painted(box(0.42, 0.1, 0.42), PAL.arancio, M(0, 1.22, 0)),
    painted(cil(0.2, 0.2, 0.5, 6), PAL.arancio, M(0.28, 0.25, 0, 0, 0, Math.PI / 2)), // il tubo della paratia che scende nel tavolato
    painted(box(0.42, 0.26, 0.05), PAL.giallo, M(0, 0.62, -0.17)), // la targa
  ]), colori('ruota')));
  return g;
}
/** La ruota d'ottone a otto razze (sempre in codice: gira a scatti quando la giri); `luce` = la gemma al mozzo (rossa, poi verde). */
export function ruotaObj(): { ruota: THREE.Group; gemma: THREE.MeshLambertMaterial } {
  const ruota = new THREE.Group(); ruota.name = 'ruota'; ruota.position.set(0, 1.45, -0.25);
  const parti: THREE.BufferGeometry[] = [painted(anello(0.48, 0.05, 12), PAL.giallo), painted(cil(0.1, 0.1, 0.12, 6), PAL.arancio, M(0, 0, 0, Math.PI / 2))];
  for (let k = 0; k < 4; k++) parti.push(painted(box(1.25, 0.06, 0.06), PAL.giallo, M(0, 0, 0, 0, 0, (k * Math.PI) / 4)));
  for (let k = 0; k < 8; k++) parti.push(painted(box(0.06, 0.16, 0.06), PAL.arancio, M(Math.cos((k * Math.PI) / 4) * 0.66, Math.sin((k * Math.PI) / 4) * 0.66, 0, 0, 0, (k * Math.PI) / 4 + Math.PI / 2))); // le caviglie
  ruota.add(new THREE.Mesh(merged(parti), colori('ruota')));
  const gemma = new THREE.MeshLambertMaterial({ color: PAL.rosso, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.3 });
  const gm = new THREE.Mesh(ico(0.09), gemma); gm.position.z = -0.08; ruota.add(gm);
  return { ruota, gemma };
}
/** Il pilone dell'arena (segnaposto di dng_diga_pilone): bitta di legno grossa con le bande di ferro e la gomena avvolta. */
export function piloneObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_diga_pilone';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.62, 0.7, 2.1, 8), PAL.legnoScuro, M(0, 1.05, 0)),
    painted(cil(0.66, 0.66, 0.12, 8), PAL.roccia, M(0, 0.35, 0)), painted(cil(0.66, 0.66, 0.12, 8), PAL.roccia, M(0, 1.75, 0)),
    painted(cil(0.7, 0.62, 0.3, 8), PAL.legno, M(0, 2.2, 0)), // la testa della bitta
    ...[1.0, 1.15, 1.3].map((y) => painted(anello(0.68, 0.06, 10), PAL.sabbia, M(0, y, 0, Math.PI / 2))), // la gomena
    painted(box(0.12, 0.7, 0.12), PAL.sabbia, M(0.66, 0.6, 0.2, 0, 0, 0.3)), // il capo della gomena
  ]), colori('pilone')));
  return g;
}
/** Il pilone fracassato: il moncone scheggiato e le tavole sparse (sempre in codice). */
export function monconeObj(): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'moncone';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.62, 0.7, 0.55, 8), PAL.legnoScuro, M(0, 0.27, 0)),
    ...[0, 1, 2, 3, 4].map((k) => painted(new THREE.ConeGeometry(0.14, 0.5, 4), PAL.legno, M(Math.cos(k * 1.26) * 0.4, 0.7, Math.sin(k * 1.26) * 0.4))), // le schegge
    painted(box(1.3, 0.1, 0.22), PAL.legno, M(0.6, 0.05, 0.9, 0, 0.6, 0)), painted(box(1.0, 0.1, 0.2), PAL.legnoScuro, M(-0.9, 0.05, -0.4, 0, -0.4, 0)), // tavole sparse
    painted(box(0.8, 0.08, 0.18), PAL.legno, M(-0.2, 0.05, -1.0, 0, 1.2, 0)), painted(anello(0.5, 0.06, 8), PAL.sabbia, M(0.9, 0.07, -0.5, Math.PI / 2)), // e la gomena a terra
  ]), colori('pilone')));
  return g;
}
/** I rottami acuminati di una cella: tavole spezzate, chiodi, lamiere storte (uguali in ogni cella, girati dal codice). */
export function rottamiGeo(): THREE.BufferGeometry {
  return merged([
    painted(box(1.5, 0.1, 0.25), PAL.legnoScuro, M(0, 0.12, -0.3, 0, 0.4, 0.15)), painted(box(1.2, 0.1, 0.22), PAL.legno, M(0.2, 0.1, 0.45, 0, -0.7, -0.1)),
    ...[[-0.5, -0.5], [0.45, -0.2], [-0.1, 0.55], [0.6, 0.6], [-0.65, 0.2]].map(([x, z], k) => painted(new THREE.ConeGeometry(0.07, 0.55, 4), k % 2 ? PAL.pietra : PAL.roccia, M(x!, 0.27, z!, 0.25 * (k - 2), 0, 0.2 * (2 - k)))), // punte
    painted(box(0.6, 0.04, 0.5), PAL.pietraScura, M(-0.35, 0.22, 0.15, 0.5, 0.3, 0.2)), // lamiera storta
    painted(box(0.05, 0.3, 0.05), PAL.rosso, M(0.1, 0.18, -0.05, 0.3, 0, 0.4)), // ruggine rossa
  ]);
}
/** Il ponte mobile (segnaposto di dng_diga_ponte): tavolato lungo con le traverse e le catene, cerniera sul lato a +X (dove sta la ruota):
 *  `lungo` m lungo X, `largo` m lungo Z. Alzato sta in verticale, giù copre la falla. */
export function ponteObj(lungo: number, largo: number): THREE.Object3D {
  const g = new THREE.Group(); g.name = 'dng_diga_ponte';
  const parti: THREE.BufferGeometry[] = [];
  for (let k = 0; k * 0.5 < largo - 0.1; k++) parti.push(painted(box(lungo, 0.12, 0.44), k % 2 ? PAL.legno : PAL.legnoChiaro, M(-lungo / 2, 0.06, -largo / 2 + 0.25 + k * 0.5)));
  for (const x of [0.4, lungo / 2, lungo - 0.4]) parti.push(painted(box(0.18, 0.1, largo), PAL.legnoScuro, M(-x, 0.15, 0))); // traverse
  parti.push(painted(cil(0.08, 0.08, largo, 6), PAL.roccia, M(-0.05, 0.1, 0, Math.PI / 2))); // la cerniera
  g.add(new THREE.Mesh(merged(parti), colori('ponte')));
  return g;
}
