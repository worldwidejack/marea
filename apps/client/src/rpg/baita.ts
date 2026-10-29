// Il Tempio della «Doppia Nera» (Isola dell'Adrenalina): segnaposto in codice per lo stile `baita` (pavimento di assi, pareti di baita, frangivento da slalom), per i
// nemici del Culto della Sciolina e per la colonnina termica. Gli effetti dinamici stanno in baita_fx.ts e baita_telegrafi.ts.
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
const FUCHSIA = '#FF4FD8';

type KitBaita = Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'acqua', Part[]>;
let kit: KitBaita | null = null;

/** Frangivento da slalom con materasso giallo anti-urto e pali rosso/blu (le colonne della Baita: proteggono dalle raffiche dei cannoni). */
function frangiventoGeo(): THREE.BufferGeometry {
  return merged([
    painted(box(1.25, 1.35, 0.55), PAL.giallo, M(0, 0.68, 0)), // materasso imbottito giallo
    painted(box(1.28, 0.22, 0.58), PAL.neroCaldo, M(0, 0.25, 0)), painted(box(1.28, 0.22, 0.58), PAL.neroCaldo, M(0, 1.1, 0)), // fasce nere
    painted(box(0.85, 0.35, 0.6), FUCHSIA, M(0, 0.68, 0)), // adesivo sponsor neon
    painted(cil(0.06, 0.06, 1.85, 6), PAL.rosso, M(-0.48, 0.92, -0.28)), // palo slalom rosso
    painted(cil(0.06, 0.06, 1.85, 6), PAL.acqua, M(0.48, 0.92, -0.28)), // palo slalom blu
    painted(box(0.96, 0.32, 0.04), PAL.sabbiaChiara, M(0, 1.62, -0.28)), // telo tra i pali
    painted(ico(0.28), PAL.sabbiaChiara, M(-0.4, 0.14, 0.35)), painted(ico(0.22), PAL.sabbiaChiara, M(0.45, 0.11, 0.32)), // mucchietti di neve
  ]);
}

/** Kit dello stile `baita` (cache): assi del noleggio sci con tracce di neve, pareti di baita con adesivi anni '90 e cumuli di neve fresca. */
export function kitBaita(top: number): KitBaita {
  if (kit) return kit;
  const pav = tex('pav', 'baita', (g) => {
    px(g, PAL.legno, 0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) { px(g, PAL.legnoScuro, 0, y, 32, 1); px(g, PAL.legnoChiaro, 0, y + 1, 32, 1); }
    for (const x of [6, 22]) px(g, PAL.neroCaldo, x, 0, 3, 32); // corsie di gomma antisdrucciolo per gli scarponi
    px(g, PAL.sabbiaChiara, 2, 3, 5, 3); px(g, PAL.sabbiaChiara, 15, 18, 6, 4); px(g, PAL.acquaBassa, 16, 19, 4, 2); // neve pestata
    strata(g, [[PAL.legnoScuro, 4], [PAL.ombraCalda, 32]]);
  });
  const muro = tex('muro', 'baita', (g, r) => {
    px(g, PAL.sabbiaChiara, 0, 0, 32, 32); // tetto innevato
    for (let y = 0; y < 32; y += 8) px(g, PAL.acquaBassa, 0, y, 32, 1);
    px(g, PAL.legno, 0, 32, 32, 32); // pareti in perline d'abete
    for (let y = 34; y < 60; y += 4) { px(g, PAL.legnoScuro, 0, y, 32, 1); px(g, PAL.legnoChiaro, (y * 5) % 32, y + 1, 8, 1); }
    for (const x of [2, 18]) px(g, PAL.legnoScuro, x, 32, 3, 28); // travi verticali
    px(g, FUCHSIA, 7, 40, 8, 4); px(g, PAL.giallo, 8, 41, 6, 2); // locandina neon "DOPPIA NERA"
    px(g, PAL.acquaBassa, 22, 44, 7, 5); px(g, PAL.rosso, 23, 45, 5, 3); // cartello "VIETATO SPAZZANEVE"
    px(g, PAL.sabbiaChiara, 0, 56, 32, 8); // zoccolo di neve e ghiaccio
    for (let i = 0; i < 8; i++) px(g, PAL.acquaBassa, r.int(0, 30), r.int(55, 60), 2, 2);
  });
  const neve = tex('acqua', 'baita', (g) => {
    px(g, PAL.sabbiaChiara, 0, 0, 32, 32);
    for (let y = 4; y < 32; y += 8) px(g, PAL.acquaBassa, (y * 3) % 24, y, 8, 2);
    strata(g, [[PAL.sabbiaChiara, 6], [PAL.acquaBassa, 32]]);
  });
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: frangiventoGeo(), mat: colori('baita_kit') }],
    acqua: [{ geo: block(2, 2, 0.85, 0), mat: texMat(neve) }],
  };
  return kit;
}

type Forma = { corpo: THREE.BufferGeometry; luce?: THREE.BufferGeometry };
const PELLE = PAL.legnoChiaro;
const FORME: Record<string, () => Forma> = {
  // Acrobata del Fuoripista: snowboarder con cappellino di lana fluo, cuffie enormi, giacca larghissima e tavola agli scarponi
  nem_acrobata: () => ({
    corpo: merged([
      painted(box(0.22, 0.7, 0.22), PAL.viola, M(-0.16, 0.35, 0)), painted(box(0.22, 0.7, 0.22), PAL.viola, M(0.16, 0.35, 0)), // pantaloni larghi
      painted(box(0.26, 0.16, 0.38), PAL.neroCaldo, M(-0.16, 0.08, -0.04)), painted(box(0.26, 0.16, 0.38), PAL.neroCaldo, M(0.16, 0.08, -0.04)), // scarponi
      painted(box(0.12, 0.06, 1.8), PAL.acqua, M(0, 0.03, 0)), // tavola da snowboard incollata agli scarponi
      painted(box(0.14, 0.08, 1.84), PAL.pietraChiara, M(0, 0.03, 0)), // lamine
      painted(box(0.68, 0.82, 0.52), PAL.arancio, M(0, 1.05, 0)), // giacca a vento larghissima fluo
      painted(box(0.2, 0.65, 0.2), PAL.arancio, M(-0.46, 1.1, 0)), painted(box(0.2, 0.65, 0.2), PAL.arancio, M(0.46, 1.1, 0)), // maniche larghe
      painted(box(0.26, 0.26, 0.26), PELLE, M(0, 1.58, 0)), // testa
      painted(cil(0.18, 0.16, 0.24, 6), PAL.giallo, M(0, 1.76, 0)), // berretto di lana fluo
      painted(box(0.36, 0.12, 0.12), PAL.neroCaldo, M(0, 1.7, 0)), // cuffie enormi (archetto)
      painted(box(0.12, 0.16, 0.16), PAL.neroCaldo, M(-0.18, 1.58, 0)), painted(box(0.12, 0.16, 0.16), PAL.neroCaldo, M(0.18, 1.58, 0)), // padiglioni cuffie
    ]),
    luce: merged([painted(box(0.24, 0.08, 0.06), PAL.acquaBassa, M(0, 1.6, -0.14))]), // occhialini fluo
  }),

  // Alchimista del Bombardino: barista montanaro, passamontagna, grembiule, caraffe fumanti e fusto di Bombardino giallo sulle spalle (punto debole!)
  nem_alchimista: () => ({
    corpo: merged([
      painted(box(0.24, 0.75, 0.24), PAL.pietraScura, M(-0.16, 0.38, 0)), painted(box(0.24, 0.75, 0.24), PAL.pietraScura, M(0.16, 0.38, 0)),
      painted(box(0.28, 0.18, 0.38), PAL.legnoScuro, M(-0.16, 0.09, -0.05)), painted(box(0.28, 0.18, 0.38), PAL.legnoScuro, M(0.16, 0.09, -0.05)),
      painted(box(0.62, 0.85, 0.48), PAL.legnoChiaro, M(0, 1.08, 0)), // maglione montanaro
      painted(box(0.58, 0.7, 0.04), PAL.sabbiaChiara, M(0, 0.95, -0.26)), // grembiule sporco di zabaione
      painted(box(0.26, 0.28, 0.26), PAL.sabbiaChiara, M(0, 1.62, 0)), // passamontagna bianco sporco
      // Braccia protese con caraffe fumanti
      painted(box(0.16, 0.55, 0.16), PAL.legnoChiaro, M(-0.38, 1.15, -0.25, 0.8, 0, 0)), painted(box(0.16, 0.55, 0.16), PAL.legnoChiaro, M(0.38, 1.15, -0.25, 0.8, 0, 0)),
      painted(cil(0.12, 0.14, 0.28, 6), PAL.pietraChiara, M(-0.38, 1.15, -0.55)), painted(cil(0.12, 0.14, 0.28, 6), PAL.pietraChiara, M(0.38, 1.15, -0.55)), // caraffe
      painted(ico(0.08), PAL.giallo, M(-0.38, 1.32, -0.55)), painted(ico(0.08), PAL.giallo, M(0.38, 1.32, -0.55)), // zabaione fumante
      // Fusto di Bombardino giallo sulle spalle (il punto debole!)
      painted(cil(0.22, 0.22, 0.65, 8), PAL.giallo, M(0, 1.18, 0.38, 0, 0, Math.PI / 2)),
      painted(cil(0.04, 0.04, 0.14, 6), PAL.neroCaldo, M(0.32, 1.18, 0.38, 0, 0, Math.PI / 2)), // rubinetto spillatore
      painted(box(0.5, 0.08, 0.45), PAL.neroCaldo, M(0, 1.35, 0.15)), // cinghie zaino
    ]),
    luce: merged([painted(box(0.24, 0.08, 0.04), PAL.neroCaldo, M(0, 1.64, -0.14))]), // fessura occhi
  }),

  // Sparaneve Automatico «Valanga-2000»: cannone cilindrico arancione su treppiede in acciaio
  nem_sparaneve: () => ({
    corpo: merged([
      // Treppiede in acciaio
      painted(cil(0.05, 0.05, 1.1, 5), PAL.pietraScura, M(-0.4, 0.5, -0.25, 0.3, 0, -0.3)),
      painted(cil(0.05, 0.05, 1.1, 5), PAL.pietraScura, M(0.4, 0.5, -0.25, 0.3, 0, 0.3)),
      painted(cil(0.05, 0.05, 1.1, 5), PAL.pietraScura, M(0, 0.5, 0.45, -0.35, 0, 0)),
      painted(box(0.45, 0.25, 0.45), PAL.pietraScura, M(0, 1.0, 0)), // giunto centrale
      // Cannone cilindrico arancione
      painted(cil(0.4, 0.48, 1.6, 8), PAL.arancio, M(0, 1.25, 0, Math.PI / 2)),
      painted(cil(0.48, 0.52, 0.2, 8), PAL.neroCaldo, M(0, 1.25, -0.75, Math.PI / 2)), // bocchettone di lancio
      painted(cil(0.36, 0.36, 0.1, 8), PAL.pietraScura, M(0, 1.25, 0.8, Math.PI / 2)), // griglia ventola posteriore
      painted(box(0.12, 0.65, 0.06), PAL.giallo, M(0, 1.25, 0.8)), // pala ventola
      painted(box(0.65, 0.12, 0.06), PAL.giallo, M(0, 1.25, 0.8)),
    ]),
    luce: merged([
      painted(box(0.08, 0.08, 0.04), PAL.rosso, M(-0.18, 1.55, -0.65)),
      painted(box(0.08, 0.08, 0.04), PAL.rosso, M(0.18, 1.55, -0.65)), // occhietti a LED rossi
    ]),
  }),

  // Jean-Claude «Valanga»: fanatico del fitness abbronzatissimo, tuta viola fluo aperta sul petto nudo, corona, tavola gigante
  nem_jean_claude: () => ({
    corpo: merged([
      painted(box(0.46, 1.05, 0.48), PAL.viola, M(-0.32, 0.55, 0)), painted(box(0.46, 1.05, 0.48), PAL.viola, M(0.32, 0.55, 0)), // tuta viola
      painted(box(0.52, 0.24, 0.68), PAL.giallo, M(-0.32, 0.12, -0.05)), painted(box(0.52, 0.24, 0.68), PAL.giallo, M(0.32, 0.12, -0.05)), // scarponi fluo
      painted(box(1.35, 1.15, 0.78), PAL.viola, M(0, 1.95, 0.05)), // tuta viola
      painted(box(0.62, 0.95, 0.8), PELLE, M(0, 1.85, 0.05)), // petto nudo scolpito e abbronzatissimo!
      painted(box(0.46, 0.48, 0.46), PELLE, M(0, 2.82, 0.05)), // viso abbronzato
      painted(box(0.32, 0.08, 0.04), PAL.sabbiaChiara, M(0, 2.68, -0.19)), // sorriso smagliante
      // Capelli biondi a punte rigide stile PS1
      painted(box(0.54, 0.32, 0.54), PAL.giallo, M(0, 3.15, 0.05)),
      painted(new THREE.ConeGeometry(0.1, 0.35, 4), PAL.giallo, M(-0.16, 3.38, 0)),
      painted(new THREE.ConeGeometry(0.12, 0.42, 4), PAL.giallo, M(0, 3.42, 0)),
      painted(new THREE.ConeGeometry(0.1, 0.35, 4), PAL.giallo, M(0.16, 3.38, 0)),
      // Corona gialla da Re dello Sciolino
      painted(box(0.52, 0.12, 0.52), PAL.giallo, M(0, 3.12, 0.05)),
      painted(box(0.4, 1.0, 0.4), PAL.viola, M(-0.86, 1.98, 0.05)), // braccio sinistro
      painted(box(0.4, 0.9, 0.4), PAL.viola, M(0.86, 2.08, -0.2, 0.5, 0, 0)), // braccio destro
      // La gigantesca Tavola «Valanga Pro-99» impugnata come arma
      painted(box(0.14, 0.58, 4.2), PAL.viola, M(0.92, 1.65, -1.25, 0.12, 0, 0)), // corpo tavola
      painted(box(0.16, 0.62, 4.24), PAL.pietraChiara, M(0.92, 1.65, -1.25, 0.12, 0, 0)), // lamine affilate
      painted(cil(0.28, 0.28, 0.14, 8), PAL.viola, M(0.92, 1.4, -3.35, 0.12, 0, Math.PI / 2)), // punta
      painted(box(0.22, 0.32, 0.28), PAL.neroCaldo, M(0.92, 1.72, -0.65)), painted(box(0.22, 0.32, 0.28), PAL.neroCaldo, M(0.92, 1.56, -1.95)), // attacchi
    ]),
    luce: merged([
      painted(box(0.48, 0.18, 0.08), PAL.arancio, M(0, 2.86, -0.2)), // mascherina arancione a specchio
      painted(box(0.17, 0.36, 1.4), PAL.arancio, M(0.92, 1.5, -2.5, 0.12, 0, 0)), // adesivo fiamme tribali
    ]),
  }),
};

/** Segnaposto di un nemico della Baita (null se non appartiene a questo stile). */
export function formaBaita(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const { corpo, luce } = f(), g = new THREE.Group(); g.name = model;
  const m = new THREE.Mesh(corpo, colori(model).clone()); m.name = model; g.add(m);
  if (luce) { const b = new THREE.Mesh(luce, colori(model + '_luce', 0.6, PAL.acquaBassa).clone()); b.name = model + '_luce'; g.add(b); }
  return g;
}

/** La colonnina termica: base di pietra, corpo giallo a strisce nere, la bobina che si accende (arancio) e la lampada in cima (rossa da girare, verde girata). */
export function colonninaObj(): { g: THREE.Group; bobina: THREE.MeshLambertMaterial; lampada: THREE.MeshLambertMaterial } {
  const g = new THREE.Group(); g.name = 'dng_baita_colonnina';
  g.add(new THREE.Mesh(merged([
    painted(cil(0.5, 0.58, 0.22, 8), PAL.pietraScura, M(0, 0.11, 0)),
    painted(box(0.62, 1.3, 0.62), PAL.giallo, M(0, 0.87, 0)),
    painted(box(0.66, 0.14, 0.66), PAL.neroCaldo, M(0, 0.5, 0)), painted(box(0.66, 0.14, 0.66), PAL.neroCaldo, M(0, 1.2, 0)), // strisce di pericolo
    painted(box(0.4, 0.3, 0.05), PAL.neroCaldo, M(0, 0.9, -0.33)), painted(box(0.3, 0.06, 0.06), PAL.acquaBassa, M(0, 0.9, -0.36)), // oblò del termostato
  ]), colori('baita_colonnina')));
  const bobina = new THREE.MeshLambertMaterial({ color: PAL.pietraScura, flatShading: true, emissive: PAL.neroCaldo, emissiveIntensity: 0.05 });
  g.add(new THREE.Mesh(merged([0, 1, 2].map((k) => painted(anello(0.4, 0.07, 10), PAL.arancio, M(0, 1.62 + k * 0.2, 0, Math.PI / 2)))), bobina)); // la serpentina riscaldante
  const lampada = new THREE.MeshLambertMaterial({ color: PAL.rosso, flatShading: true, emissive: PAL.rosso, emissiveIntensity: 0.3 });
  const l = new THREE.Mesh(ico(0.13), lampada); l.position.y = 2.35; g.add(l);
  return { g, bobina, lampada };
}
