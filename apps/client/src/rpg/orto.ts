// La Tana del Maggiolone (isola della Difesa, docs/rpg/2h-orto.md): segnaposto in codice per lo stile `orto` (gallerie di terra sotto
// l'orto, radici, sassi e cocci di vaso; le colonne sono carote giganti che scendono dal soffitto con gli occhi cattivi) e per gli insetti
// del gioco della Difesa, coi colori del foglio dell'orto: lumache viola, scarabeo blu col vasetto in testa, cavalletta verde, vespa a
// strisce, bruco arancio con la foglia, la lumaca capobanda con la bandierina e il Maggiolone con la corona. Solo colori della palette.
import * as THREE from 'three';
import { M, block, merged, painted, px, strata, tex } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import type { Part } from './dungeon_kit.ts';
import { colori } from './diga.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const cono = (r: number, h: number, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
const texMat = (t: THREE.Texture): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ map: t, flatShading: true });
type G = THREE.BufferGeometry;

type KitOrto = Record<'pavimento' | 'muro' | 'muro_basso' | 'colonna' | 'acqua', Part[]>;
let kit: KitOrto | null = null;

/** Carota gigante a testa in giù: la radice arancio scende dal soffitto quasi fino a terra, con le righe e due occhi arrabbiati. */
function carotaGeo(): G {
  const p: G[] = [
    painted(cono(0.5, 2.1, 7), PAL.arancio, M(0, 1.35, 0, Math.PI, 0, 0)), // la radice, punta in basso
    painted(cil(0.5, 0.5, 0.15, 7), PAL.legnoChiaro, M(0, 2.33, 0)), // dove entra nel soffitto
  ];
  for (const [y, r] of [[1.9, 0.42], [1.45, 0.31], [1.0, 0.2]] as const) p.push(painted(cil(r, r, 0.05, 7), PAL.legnoChiaro, M(0, y, 0)));
  for (const s of [-1, 1]) {
    p.push(painted(box(0.16, 0.14, 0.06), PAL.sabbiaChiara, M(s * 0.14, 1.95, -0.4)));
    p.push(painted(box(0.07, 0.08, 0.04), PAL.neroCaldo, M(s * 0.12, 1.94, -0.44)));
    p.push(painted(box(0.2, 0.05, 0.05), PAL.neroCaldo, M(s * 0.14, 2.05, -0.42, 0, 0, s * 0.35))); // sopracciglia arrabbiate
  }
  for (const a of [0.4, 2.5, 4.4]) p.push(painted(box(0.03, 0.4, 0.03), PAL.legnoChiaro, M(Math.cos(a) * 0.1, 0.18, Math.sin(a) * 0.1, 0.3, a, 0))); // radichette
  return merged(p);
}

/** Kit dello stile `orto` (cache): terra battuta con sassolini e semi, pareti di terra a strati con radici, sassi e un coccio di vaso. */
export function kitOrto(top: number): KitOrto {
  if (kit) return kit;
  const pav = tex('pav', 'orto', (g, r) => {
    px(g, PAL.legno, 0, 0, 32, 32);
    for (let i = 0; i < 26; i++) px(g, PAL.legnoScuro, r.int(0, 30), r.int(0, 30), r.int(1, 3), 1); // zolle
    for (let i = 0; i < 6; i++) px(g, PAL.pietra, r.int(1, 29), r.int(1, 29), 2, 2); // sassolini
    for (let i = 0; i < 3; i++) px(g, PAL.giallo, r.int(2, 28), r.int(2, 28), 1, 1); // semi caduti
    px(g, PAL.legnoChiaro, r.int(2, 18), r.int(4, 26), 9, 1); // una radichetta
    strata(g, [[PAL.legno, 4], [PAL.legnoScuro, 32]]);
  });
  const muro = tex('muro', 'orto', (g, r) => {
    px(g, PAL.erbaScura, 0, 0, 32, 32); // sopra: il prato dell'orto
    for (let i = 0; i < 12; i++) px(g, PAL.erba, r.int(0, 30), r.int(0, 30), 2, 1);
    px(g, PAL.legnoScuro, 0, 32, 32, 32); // la terra
    for (const y of [40, 49, 57]) for (let x = 0; x < 32; x += 2) px(g, PAL.ombraCalda, x, y + ((x >> 2) & 1), 2, 1); // strati
    for (let i = 0; i < 3; i++) { let x = r.int(0, 31), y = 33; for (let k = 0; k < 12; k++) { px(g, PAL.legnoChiaro, x, y, 1, 1); x = (x + r.int(-1, 1) + 32) % 32; y += 1; } } // radici che scendono
    for (let i = 0; i < 4; i++) px(g, PAL.pietra, r.int(0, 28), r.int(36, 60), 3, 2); // sassi
    px(g, PAL.arancio, 20, 52, 5, 3); px(g, PAL.legnoChiaro, 20, 52, 5, 1); // un coccio di vaso
    px(g, PAL.erbaScura, 0, 32, 32, 2); // l'erba che pende dal bordo
  });
  kit = {
    pavimento: [{ geo: block(2, 2, top, top - 0.3), mat: texMat(pav) }],
    muro: [{ geo: block(2, 2, 2.4, 0), mat: texMat(muro) }],
    muro_basso: [{ geo: block(2, 2, 0.6, 0), mat: texMat(muro) }],
    colonna: [{ geo: carotaGeo(), mat: colori('orto_kit') }],
    // acqua d'irrigazione (se un giorno la Tana avrà un bacino): pozzanghera fangosa
    acqua: [{ geo: block(2, 2, 0.85, 0), mat: texMat(tex('acqua', 'orto', (g) => { px(g, PAL.acqua, 0, 0, 32, 32); for (let y = 4; y < 32; y += 8) px(g, PAL.acquaBassa, (y * 3) % 24, y, 8, 2); strata(g, [[PAL.acqua, 6], [PAL.legnoScuro, 32]]); })) }],
  };
  return kit;
}

// ——— gli insetti: guardano verso −Z, piedi a terra ———
/** Due occhi tondi e bianchi con la pupilla e il sopracciglio arrabbiato, a quota y, distanti 2·dx, sulla faccia a z. */
function occhi(p: G[], y: number, z: number, dx: number, r = 0.09, alto = false): void {
  for (const s of [-1, 1]) {
    p.push(painted(ico(r, 1), PAL.sabbiaChiara, M(s * dx, y, z)));
    p.push(painted(box(r * 0.8, r * 0.9, r * 0.5), PAL.neroCaldo, M(s * dx * 0.92, y - r * 0.1, z - r * 0.7)));
    p.push(painted(box(r * 2.2, r * 0.45, r * 0.5), PAL.neroCaldo, M(s * dx, y + r * (alto ? 1.4 : 1.05), z - r * 0.5, 0, 0, s * 0.4)));
  }
}
/** Lumaca: piede chiaro lungo e basso, guscio viola a spirale sulla schiena, due cornini con gli occhi. */
function lumaca(p: G[], s = 1): void {
  p.push(painted(box(0.5 * s, 0.24 * s, 1.25 * s), PAL.pietraChiara, M(0, 0.12 * s, 0)));
  p.push(painted(box(0.4 * s, 0.42 * s, 0.34 * s), PAL.pietraChiara, M(0, 0.3 * s, -0.48 * s))); // la testa alzata
  p.push(painted(ico(0.42 * s, 1), PAL.viola, M(0, 0.58 * s, 0.18 * s, 0, 0, 0, 0.8, 1, 1)));
  p.push(painted(cil(0.2 * s, 0.2 * s, 0.7 * s, 8), PAL.pietraChiara, M(0, 0.58 * s, 0.18 * s, 0, 0, Math.PI / 2))); // la spirale
  p.push(painted(cil(0.09 * s, 0.09 * s, 0.72 * s, 6), PAL.viola, M(0, 0.58 * s, 0.18 * s, 0, 0, Math.PI / 2)));
  for (const k of [-1, 1]) p.push(painted(cil(0.03 * s, 0.035 * s, 0.4 * s, 5), PAL.pietraChiara, M(k * 0.1 * s, 0.68 * s, -0.55 * s, -0.35, 0, k * 0.25)));
  occhi(p, 0.88 * s, -0.63 * s, 0.17 * s, 0.075 * s);
}

const FORME: Record<string, () => G> = {
  nem_lumaca: () => { const p: G[] = []; lumaca(p); return merged(p); },
  // la ghianda come elmetto: cupola marrone a scacchi e il guscio della ghianda sopra la testa
  nem_lumaca_ghianda: () => {
    const p: G[] = []; lumaca(p);
    p.push(painted(ico(0.24, 1), PAL.legnoChiaro, M(0, 0.7, -0.48, 0, 0, 0, 1, 0.8, 1)));
    p.push(painted(cil(0.27, 0.25, 0.14, 8), PAL.legnoScuro, M(0, 0.86, -0.48)));
    p.push(painted(cil(0.03, 0.03, 0.12, 5), PAL.legnoScuro, M(0, 0.98, -0.48)));
    return merged(p);
  },
  // scarabeo blu tondo con sei zampe, e il vasetto di marmellata rovesciato in testa (tappo rosso)
  nem_scarabeo: () => {
    const p: G[] = [
      painted(ico(0.55, 1), PAL.acquaProfonda, M(0, 0.62, 0.1, 0, 0, 0, 1, 0.85, 1.15)),
      painted(box(0.04, 0.5, 1.0), PAL.abisso, M(0, 0.95, 0.15)), // la riga tra le ali
      painted(ico(0.3, 1), PAL.acqua, M(0, 0.62, -0.5)), // la testa
      painted(cil(0.26, 0.26, 0.36, 8), PAL.acquaBassa, M(0, 0.98, -0.5)), // il vasetto di vetro
      painted(cil(0.29, 0.29, 0.1, 8), PAL.rosso, M(0, 0.8, -0.5)), // il tappo, ora in basso
      painted(box(0.3, 0.12, 0.02), PAL.sabbiaChiara, M(0, 1.0, -0.77)), // l'etichetta
    ];
    for (const [z, a] of [[-0.25, -0.4], [0.1, 0], [0.45, 0.4]] as const) for (const s of [-1, 1]) p.push(painted(box(0.5, 0.07, 0.07), PAL.abisso, M(s * 0.55, 0.25, z, 0, a * s, s * -0.6)));
    for (const s of [-1, 1]) p.push(painted(cil(0.025, 0.025, 0.35, 4), PAL.abisso, M(s * 0.12, 0.85, -0.72, -0.6, 0, s * 0.3)));
    occhi(p, 0.66, -0.74, 0.12, 0.08);
    return merged(p);
  },
  // cavalletta verde: corpo lungo, zampone dietro piegate, antenne lunghe
  nem_cavalletta: () => {
    const p: G[] = [
      painted(box(0.34, 0.34, 1.1), PAL.erba, M(0, 0.62, 0.05, 0.12, 0, 0)),
      painted(box(0.36, 0.1, 0.9), PAL.erbaChiara, M(0, 0.8, 0.15, 0.12, 0, 0)), // le ali chiuse
      painted(box(0.34, 0.4, 0.34), PAL.erbaChiara, M(0, 0.82, -0.58)), // la testa
    ];
    for (const s of [-1, 1]) {
      p.push(painted(box(0.1, 0.62, 0.12), PAL.erba, M(s * 0.24, 0.68, 0.35, -0.9, 0, 0))); // coscia
      p.push(painted(box(0.06, 0.62, 0.08), PAL.erbaScura, M(s * 0.26, 0.32, 0.62, 0.55, 0, 0))); // stinco
      p.push(painted(box(0.05, 0.55, 0.05), PAL.erbaScura, M(s * 0.2, 0.28, -0.3, 0.3, 0, s * 0.2))); // zampe davanti
      p.push(painted(cil(0.015, 0.015, 0.7, 4), PAL.erbaScura, M(s * 0.1, 1.25, -0.75, -0.6, 0, s * 0.25)));
    }
    occhi(p, 0.92, -0.76, 0.11, 0.08);
    return merged(p);
  },
  // vespa a strisce gialle e nere, ali chiare, pungiglione (vola: la quota la mette dungeon_actors)
  nem_vespa: () => {
    const p: G[] = [painted(ico(0.2, 1), PAL.giallo, M(0, 0.35, -0.38))]; // la testa
    for (const [z, c] of [[-0.08, PAL.giallo], [0.08, PAL.neroCaldo], [0.24, PAL.giallo], [0.4, PAL.neroCaldo]] as const) p.push(painted(cil(0.2 - z * 0.15, 0.2 - z * 0.15, 0.16, 8), c, M(0, 0.33, z, Math.PI / 2, 0, 0)));
    p.push(painted(cono(0.08, 0.3, 5), PAL.pietraChiara, M(0, 0.33, 0.62, Math.PI / 2, 0, 0))); // il pungiglione
    for (const s of [-1, 1]) {
      p.push(painted(box(0.6, 0.02, 0.28), PAL.acquaBassa, M(s * 0.36, 0.6, -0.02, 0, 0, s * 0.35))); // ali
      p.push(painted(cil(0.015, 0.015, 0.3, 4), PAL.neroCaldo, M(s * 0.08, 0.6, -0.48, -0.5, 0, s * 0.3)));
      p.push(painted(box(0.03, 0.3, 0.03), PAL.neroCaldo, M(s * 0.12, 0.15, -0.05, 0.3, 0, 0)));
    }
    occhi(p, 0.4, -0.55, 0.09, 0.065);
    return merged(p);
  },
  // bruco arancio a palline con le macchie gialle e la foglia grande davanti come scudo
  nem_bruco: () => {
    const p: G[] = [];
    for (let k = 0; k < 5; k++) {
      p.push(painted(ico(0.27 - k * 0.015, 1), PAL.arancio, M(0, 0.3 + (k === 0 ? 0.25 : 0), -0.3 + k * 0.32)));
      p.push(painted(box(0.1, 0.1, 0.1), PAL.giallo, M(0.18, 0.42, -0.3 + k * 0.32)));
    }
    for (const s of [-1, 1]) { p.push(painted(cil(0.02, 0.02, 0.3, 4), PAL.arancio, M(s * 0.1, 0.95, -0.32, -0.2, 0, s * 0.3))); p.push(painted(ico(0.05), PAL.giallo, M(s * 0.15, 1.1, -0.36))); }
    p.push(painted(box(0.85, 0.95, 0.06), PAL.erba, M(-0.08, 0.55, -0.68, 0.1, 0.25, 0.2))); // la foglia-scudo
    p.push(painted(box(0.05, 0.85, 0.08), PAL.erbaScura, M(-0.08, 0.55, -0.69, 0.1, 0.25, 0.2))); // la nervatura
    occhi(p, 0.62, -0.55, 0.11, 0.07);
    return merged(p);
  },
  // lumaca capobanda: più grande, berretto rosso e la bandierina sul guscio
  nem_capobanda: () => {
    const p: G[] = []; lumaca(p, 1.15);
    p.push(painted(cil(0.17, 0.2, 0.12, 8), PAL.rosso, M(0, 1.14, -0.72))); p.push(painted(box(0.24, 0.03, 0.14), PAL.rosso, M(0, 1.09, -0.86)));
    p.push(painted(cil(0.025, 0.025, 1.0, 5), PAL.legnoChiaro, M(0, 1.15, 0.25)));
    p.push(painted(box(0.03, 0.34, 0.5), PAL.rosso, M(0, 1.47, 0.52))); p.push(painted(box(0.035, 0.12, 0.2), PAL.giallo, M(0, 1.5, 0.5))); // bandierina
    return merged(p);
  },
  // Sua Maestà il Maggiolone: cervo volante enorme, elitre rosso scuro, corna-mandibole gialle, sei zampe e la corona
  nem_maggiolone: () => {
    const p: G[] = [
      painted(ico(1.0, 1), PAL.legnoScuro, M(0, 1.05, 0.35, 0, 0, 0, 1, 0.75, 1.3)),
      painted(ico(0.98, 1), PAL.rosso, M(0, 1.15, 0.45, 0, 0, 0, 0.95, 0.68, 1.22)), // le elitre
      painted(box(0.06, 0.5, 2.0), PAL.legnoScuro, M(0, 1.6, 0.45)), // la riga tra le elitre
      painted(box(1.0, 0.7, 0.75), PAL.legnoScuro, M(0, 1.05, -0.95)), // la testa
      painted(cil(0.32, 0.36, 0.22, 6), PAL.giallo, M(0, 1.52, -0.95)), // la corona
    ];
    for (const x of [-0.26, 0, 0.26]) p.push(painted(cono(0.07, 0.2, 4), PAL.giallo, M(x, 1.72, -0.95)));
    for (const s of [-1, 1]) {
      p.push(painted(box(0.16, 0.16, 0.8), PAL.giallo, M(s * 0.38, 1.0, -1.65, 0, s * 0.35, 0))); // le corna
      p.push(painted(box(0.14, 0.32, 0.14), PAL.giallo, M(s * 0.55, 1.15, -1.98))); // il dente in punta
      for (const [z, a] of [[-0.5, -0.4], [0.3, 0], [1.0, 0.4]] as const) {
        p.push(painted(box(0.9, 0.16, 0.16), PAL.ombraCalda, M(s * 1.05, 0.55, z, 0, a * s, s * -0.55)));
        p.push(painted(box(0.14, 0.6, 0.14), PAL.ombraCalda, M(s * 1.45, 0.28, z - a * 0.3)));
      }
    }
    occhi(p, 1.2, -1.33, 0.3, 0.14, true);
    return merged(p);
  },
};

/** Segnaposto di un insetto della Tana del Maggiolone (null se non è di questo stile). */
export function formaOrto(model: string): THREE.Object3D | null {
  const f = FORME[model];
  if (!f) return null;
  const g = new THREE.Group(); g.name = model;
  const m = new THREE.Mesh(f(), colori(model).clone()); m.name = model; g.add(m);
  return g;
}
