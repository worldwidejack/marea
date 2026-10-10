// Isole a tema (#68): terreni dipinti, montagne a colonne e decorazioni procedurali per Tempesta, Ghiacci, Vulcano, Giardino e Templari.
// Solo colori della palette (ART_BIBLE §2), facce piatte, colori per triangolo (niente sfumature). Le parti che brillano (lava, fuochi,
// finestre delle lanterne di pietra) stanno in una geometria a parte disegnata con un materiale non illuminato.
import * as THREE from 'three';
import type { Rng } from '@marea/sim';
import type { TemaStyle } from '@marea/content';
import { ISLAND, M, P, merged, painted, px, speckle, strata } from './island_parts.ts';
import type { Painter } from './island_parts.ts';
import { propTemplari, propTemplariGlow } from './island_templari.ts';
// Isola delle Corse: le sue decorazioni (island_corse.ts, ~8 KB gzip) stanno in un chunk a parte, fuori dal JS iniziale (TECH §5): si
// scarica appena parte il gioco e `createIsland` aspetta `corsePronta` prima di costruire le isole.
type CorseMod = typeof import('./island_corse.ts');
let corse: CorseMod | null = null;
export const corsePronta: Promise<void> = import('./island_corse.ts').then((m) => { corse = m; }, () => {});
/** Le decorazioni delle Corse con una parte che brilla (deve stare qui: serve prima che il chunk arrivi). */
const CORSE_GLOW = new Set<string>(['arco_via', 'torre_corse', 'garage_corse', 'lampione', 'palo_molo', 'porta_neve', 'porta_giungla', 'porta_neon', 'porta_luna', 'porta_spiaggia',
  'ruota_panoramica', 'tendone', 'tendone_piccolo', 'tempio_giungla', 'palazzo_neon', 'palazzo_neon_basso', 'faro']);

export const TEMI: readonly TemaStyle[] = ['tempesta', 'ghiacci', 'vulcano', 'giardino', 'templari', 'corse'];
export const isTema = (s: string | null | undefined): s is TemaStyle => !!s && (TEMI as readonly string[]).includes(s);

// ——— terreni: sabbia (spiaggia), erba (interno), riva (scalino verso l'acqua) ———
export const PAINT_TEMI: Record<string, Painter> = {
  tempesta_sabbia: (g, r) => { px(g, P.roccia, 0, 0, 32, 32); speckle(g, r, P.neroCaldo, 50, 0, 32); speckle(g, r, P.pietraScura, 22, 0, 32); strata(g, [[P.roccia, 3], [P.neroCaldo, 32]]); speckle(g, r, P.roccia, 10, 36, 50); },
  tempesta_erba: (g, r) => { px(g, P.boscoOmbra, 0, 0, 32, 32); speckle(g, r, P.bosco, 34, 0, 32, 1, 2); speckle(g, r, P.roccia, 26, 0, 32); speckle(g, r, P.erbaScura, 8, 0, 32); strata(g, [[P.boscoOmbra, 3], [P.roccia, 6], [P.neroCaldo, 32]]); },
  tempesta_riva: (g, r) => { px(g, P.pietraScura, 0, 0, 32, 32); speckle(g, r, P.roccia, 50, 0, 32); strata(g, [[P.roccia, 2], [P.neroCaldo, 32]]); },
  ghiacci_sabbia: (g, r) => { px(g, P.pietraChiara, 0, 0, 32, 32); speckle(g, r, P.sabbiaChiara, 40, 0, 32, 2, 1); speckle(g, r, P.acquaBassa, 10, 0, 32); strata(g, [[P.pietraChiara, 3], [P.acquaBassa, 6], [P.acqua, 32]]); speckle(g, r, P.pietraChiara, 10, 40, 60); },
  ghiacci_erba: (g, r) => {
    px(g, P.sabbiaChiara, 0, 0, 32, 32); speckle(g, r, P.pietraChiara, 60, 0, 32, 2, 1); speckle(g, r, P.acquaBassa, 8, 0, 32, 2, 1);
    strata(g, [[P.sabbiaChiara, 4], [P.pietraChiara, 3], [P.acquaBassa, 8], [P.acqua, 32]]);
    for (let x = 0; x < 32; x++) if (r.next() < 0.5) px(g, P.pietraChiara, x, 39, 1, r.int(1, 3)); // neve che cola sul fianco di ghiaccio
  },
  ghiacci_riva: (g, r) => { px(g, P.acquaBassa, 0, 0, 32, 32); speckle(g, r, P.pietraChiara, 40, 0, 32, 2, 1); strata(g, [[P.acquaBassa, 3], [P.acqua, 32]]); },
  vulcano_sabbia: (g, r) => { px(g, P.neroCaldo, 0, 0, 32, 32); speckle(g, r, P.roccia, 40, 0, 32); speckle(g, r, P.viola, 5, 0, 32); speckle(g, r, P.pietraScura, 8, 0, 32); strata(g, [[P.neroCaldo, 32]]); speckle(g, r, P.roccia, 14, 34, 60); },
  vulcano_erba: (g, r) => { px(g, P.roccia, 0, 0, 32, 32); speckle(g, r, P.pietraScura, 40, 0, 32); speckle(g, r, P.neroCaldo, 30, 0, 32, 2, 1); speckle(g, r, P.arancio, 4, 0, 32); speckle(g, r, P.rosso, 3, 0, 32); strata(g, [[P.roccia, 3], [P.neroCaldo, 32]]); },
  vulcano_riva: (g, r) => { px(g, P.neroCaldo, 0, 0, 32, 32); speckle(g, r, P.roccia, 30, 0, 32); strata(g, [[P.neroCaldo, 32]]); },
  giardino_sabbia: (g, r) => { // ghiaia rastrellata
    px(g, P.pietraChiara, 0, 0, 32, 32);
    for (let y = 1; y < 32; y += 4) for (let x = 0; x < 32; x++) px(g, P.pietra, x, y + ((x >> 3) & 1));
    speckle(g, r, P.pietra, 14, 0, 32); strata(g, [[P.pietra, 3], [P.pietraScura, 32]]);
  },
  giardino_erba: (g, r) => {
    px(g, P.erba, 0, 0, 32, 32); speckle(g, r, P.erbaChiara, 30, 0, 32); speckle(g, r, P.erbaScura, 24, 0, 32, 1, 2); speckle(g, r, P.rosaNeon, 5, 0, 32); speckle(g, r, P.sabbiaChiara, 4, 0, 32);
    strata(g, [[P.erbaScura, 3], [P.legno, 7], [P.legnoScuro, 32]]);
  },
  giardino_riva: (g, r) => { px(g, P.pietra, 0, 0, 32, 32); speckle(g, r, P.pietraChiara, 30, 0, 32, 2, 1); speckle(g, r, P.pietraScura, 20, 0, 32); strata(g, [[P.pietraScura, 32]]); },
  // Templari: sabbia grigia di cenere, erba scura e secca, riva di sassi
  templari_sabbia: (g, r) => { px(g, P.sabbia, 0, 0, 32, 32); speckle(g, r, P.pietra, 30, 0, 32); speckle(g, r, P.legnoChiaro, 16, 0, 32); speckle(g, r, P.pietraScura, 8, 0, 32); strata(g, [[P.legnoChiaro, 3], [P.legno, 32]]); speckle(g, r, P.legnoScuro, 10, 36, 60); },
  templari_erba: (g, r) => { px(g, P.bosco, 0, 0, 32, 32); speckle(g, r, P.erbaScura, 30, 0, 32, 1, 2); speckle(g, r, P.boscoOmbra, 30, 0, 32); speckle(g, r, P.legno, 10, 0, 32); speckle(g, r, P.rosso, 2, 0, 32); strata(g, [[P.boscoOmbra, 3], [P.legnoScuro, 7], [P.ombraCalda, 32]]); },
  templari_riva: (g, r) => { px(g, P.pietraScura, 0, 0, 32, 32); speckle(g, r, P.pietra, 30, 0, 32, 2, 1); speckle(g, r, P.roccia, 30, 0, 32); strata(g, [[P.roccia, 32]]); },
  // Isola delle Corse (l'hub vista dal mare, #185): spiaggia chiara, prato pieno di fiori come nella concept, riva di sabbia
  corse_sabbia: (g, r) => { px(g, P.sabbia, 0, 0, 32, 32); speckle(g, r, P.sabbiaChiara, 50, 0, 32); speckle(g, r, P.legnoChiaro, 12, 0, 32); strata(g, [[P.sabbia, 3], [P.legnoChiaro, 5], [P.legno, 32]]); speckle(g, r, P.sabbiaChiara, 8, 32, 36); },
  corse_erba: (g, r) => {
    px(g, P.erba, 0, 0, 32, 32); speckle(g, r, P.erbaChiara, 30, 0, 32); speckle(g, r, P.erbaScura, 26, 0, 32, 1, 2);
    speckle(g, r, P.giallo, 4, 0, 32); speckle(g, r, P.rosaNeon, 3, 0, 32); speckle(g, r, P.pietraChiara, 3, 0, 32);
    strata(g, [[P.erbaScura, 3], [P.legno, 7], [P.legnoScuro, 32]]);
    for (let x = 0; x < 32; x++) if (r.next() < 0.45) px(g, P.erbaScura, x, 35, 1, r.int(1, 2));
  },
  corse_riva: (g, r) => { px(g, P.sabbiaChiara, 0, 0, 32, 32); speckle(g, r, P.sabbia, 60, 0, 32); strata(g, [[P.sabbia, 2], [P.legnoChiaro, 32]]); },
};

// ——— montagne: colonne di roccia a gradoni, più alte lontano dalla riva (cono del vulcano col cratere di lava) ———
type Col = { c: string; glow?: boolean };
/** Colore di un triangolo della roccia: `top` = faccia in su, `y` = quota del baricentro, `h` = cima della colonna, `k` = banda (0, 1, 2…). */
const ROCCIA: Record<TemaStyle, (top: boolean, y: number, h: number, r: Rng) => Col> = {
  tempesta: (top, y, h, r) => (top ? { c: r.next() < 0.5 ? P.pietraScura : P.roccia } : { c: y < 0.3 ? P.neroCaldo : h - y < 0.6 ? P.pietraScura : Math.floor(y / 1.3) % 2 ? P.roccia : P.neroCaldo }),
  ghiacci: (top, y, h) => (top ? { c: P.sabbiaChiara } : { c: h - y < 0.7 ? P.pietraChiara : y < 0.3 ? P.acqua : Math.floor(y / 1.1) % 2 ? P.acquaBassa : P.pietraChiara }),
  vulcano: (top, y, h, r) => (top ? { c: r.next() < 0.4 ? P.neroCaldo : P.roccia } : { c: y < 0.3 ? P.neroCaldo : Math.floor(y / 1.6) % 2 ? P.roccia : P.neroCaldo }),
  giardino: (top, y, h, r) => (top ? { c: r.next() < 0.5 ? P.erbaScura : P.bosco } : { c: h - y < 0.4 ? P.erbaScura : Math.floor(y / 1.2) % 2 ? P.pietra : P.pietraScura }),
  templari: (top, y, h, r) => (top ? { c: r.next() < 0.5 ? P.pietraScura : P.roccia } : { c: y < 0.3 ? P.neroCaldo : Math.floor(y / 1.1) % 2 ? P.pietraScura : P.roccia }),
  corse: (top, y, h, r) => (top ? { c: r.next() < 0.75 ? P.pietraChiara : P.sabbiaChiara } : { c: y < 0.6 ? P.pietraScura : h - y < 1.2 || (y > 2.6 && r.next() < 0.72) ? P.pietraChiara : Math.floor(y / 1.3) % 2 ? P.pietra : P.pietraScura }), // montagna innevata del quartiere Neve
};
/** Quota della cima per distanza dalla riva della montagna `d` (1 = colonna sul bordo). */
const ALTEZZA: Record<TemaStyle, (d: number, r: Rng) => number> = {
  tempesta: (d, r) => 1.3 + d * 1.25 + r.next() * 0.9,
  ghiacci: (d, r) => 1.0 + d * 1.05 + r.next() * 0.5,
  vulcano: (d, r) => 0.9 + d * 1.3 + r.next() * 0.35,
  giardino: (d, r) => 0.7 + d * 0.75 + r.next() * 0.3,
  templari: (d, r) => 0.8 + d * 0.8 + r.next() * 0.5,
  corse: (d, r) => 0.9 + d * 1.55 + r.next() * 0.6,
};

/**
 * Montagne di un'isola a tema: una colonna per cella di roccia, rastremata e con la cima storta (le facce piatte prendono luce
 * diversa), colori a bande per triangolo. `d` = distanza (celle, 4 vicini) dalla cella non-roccia più vicina. Restituisce anche le
 * quote delle cime (per groundY) e, sul Vulcano, il lago di lava del cratere e qualche colata (geometria che brilla).
 */
export function rocceTema(style: TemaStyle, cells: { x: number; z: number; d: number; key: number }[], rng: Rng): { body: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null; tops: Map<number, number> } {
  const body: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [], tops = new Map<number, number>();
  const maxD = cells.reduce((m, c) => Math.max(m, c.d), 0);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const c of cells) {
    let h = ISLAND.TOP + ALTEZZA[style](c.d, rng);
    // cratere: le celle più interne del cono scendono e si riempiono di lava
    const crater = style === 'vulcano' && maxD >= 5 && c.d >= maxD - 1;
    if (crater) h = ISLAND.TOP + ALTEZZA.vulcano(maxD - 2, rng) - 1.6;
    tops.set(c.key, h);
    const H = h - ISLAND.BOTTOM, segs = Math.max(1, Math.round(H / 2.6)); // bande da ~2,6 m: metà dei triangoli, le montagne restano a strati
    const w = 2.25 + rng.next() * 0.2, taper = style === 'giardino' ? 0.1 : 0.14 + rng.next() * 0.12;
    const g0 = new THREE.BoxGeometry(w, H, w, 1, segs, 1).toNonIndexed();
    const pos = g0.attributes.position!;
    const jit = new Map<string, number>(); // stesso vertice = stesso sobbalzo (la cima resta chiusa)
    const rot = (rng.next() - 0.5) * 0.3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = (v.y + H / 2) / H; // 0 base, 1 cima
      const k = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
      let j = jit.get(k);
      if (j === undefined) { j = (rng.next() - 0.5) * (t > 0.99 ? 0.7 : 0.25); jit.set(k, j); }
      const s = 1 - taper * t * t;
      v.set(v.x * s + (t > 0.2 ? j * 0.5 : 0), v.y + H / 2 + ISLAND.BOTTOM + (t > 0.99 ? j : 0), v.z * s - (t > 0.2 ? j * 0.4 : 0));
      v.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      pos.setXYZ(i, v.x + c.x, v.y, v.z + c.z);
    }
    g0.deleteAttribute('uv'); g0.deleteAttribute('normal');
    // colore per triangolo; sul Vulcano alcune facce dei fianchi sono colate di lava (vanno nella geometria che brilla)
    const lit: number[] = [], hot: number[] = [], litC: number[] = [], hotC: number[] = [];
    const col = new THREE.Color();
    const colata = style === 'vulcano' && !crater && c.d >= 2 && rng.next() < 0.22;
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i); a.fromBufferAttribute(pos, i + 1); b.fromBufferAttribute(pos, i + 2);
      n.subVectors(a, v).cross(b.clone().sub(v)).normalize();
      const cy = (v.y + a.y + b.y) / 3, top = n.y > 0.6;
      let cc = ROCCIA[style](top, cy, h, rng);
      if (crater && top) cc = { c: rng.next() < 0.3 ? P.giallo : rng.next() < 0.5 ? P.arancio : P.rosso, glow: true };
      else if (colata && !top && n.z + n.x > 0.3 && cy > 0.4) cc = { c: cy % 1.2 < 0.6 ? P.arancio : P.rosso, glow: true }; // verso la camera
      col.set(cc.c);
      const dst = cc.glow ? hot : lit, dc = cc.glow ? hotC : litC;
      for (const q of [v, a, b]) { dst.push(q.x, q.y, q.z); dc.push(col.r, col.g, col.b); }
    }
    g0.dispose();
    const mk = (p: number[], cs: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); g.computeVertexNormals(); return g; };
    if (lit.length) body.push(mk(lit, litC));
    if (hot.length) glow.push(mk(hot, hotC));
  }
  return { body: body.length ? merged(body) : null, glow: glow.length ? merged(glow) : null, tops };
}

// ——— decorazioni ———
export type TemaProp = 'faro_rovina' | 'relitto' | 'bandiera_pirata' | 'cannone' | 'albero_secco' | 'iceberg' | 'pinguino' | 'igloo' | 'pino_neve'
  | 'roccia_lavica' | 'capanna' | 'braciere' | 'statua' | 'cartello' | 'abitante' | 'ciliegio' | 'tempio' | 'torii_pietra' | 'lanterna_pietra' | 'ponticello'
  | 'chiesa_templare' | 'casa_rovina' | 'tomba' | 'croce_pietra' | 'tenda' | 'relitto_templare' | 'scheletro'
  | 'arco_via' | 'tribuna' | 'gomme' | 'kart_fermo' | 'bandierina' // Isola delle Corse
  | 'strada' | 'rotatoria' | 'trofeo' | 'statua_trofeo' | 'torre_corse' | 'garage_corse' | 'bancarella' | 'festone' | 'lampione' | 'palo_molo'
  | 'porta_neve' | 'porta_giungla' | 'porta_neon' | 'porta_luna' | 'porta_spiaggia' | 'ruota_panoramica' | 'tendone' | 'tendone_piccolo' | 'tempio_giungla'
  | 'palazzo_neon' | 'palazzo_neon_basso' | 'faro' | 'ombrellone' | 'albero_tondo' | 'albero_giungla' | 'chiazza_neve';
export const TEMA_PROPS = new Set<string>(['faro_rovina', 'relitto', 'bandiera_pirata', 'cannone', 'albero_secco', 'iceberg', 'pinguino', 'igloo', 'pino_neve',
  'roccia_lavica', 'capanna', 'braciere', 'statua', 'cartello', 'abitante', 'ciliegio', 'tempio', 'torii_pietra', 'lanterna_pietra', 'ponticello',
  'chiesa_templare', 'casa_rovina', 'tomba', 'croce_pietra', 'tenda', 'relitto_templare', 'scheletro',
  'arco_via', 'tribuna', 'gomme', 'kart_fermo', 'bandierina', // Isola delle Corse
  'strada', 'rotatoria', 'trofeo', 'statua_trofeo', 'torre_corse', 'garage_corse', 'bancarella', 'festone', 'lampione', 'palo_molo',
  'porta_neve', 'porta_giungla', 'porta_neon', 'porta_luna', 'porta_spiaggia', 'ruota_panoramica', 'tendone', 'tendone_piccolo', 'tempio_giungla',
  'palazzo_neon', 'palazzo_neon_basso', 'faro', 'ombrellone', 'albero_tondo', 'albero_giungla', 'chiazza_neve']);
/** Decorazioni con una parte che brilla (fuoco, lava, finestre): la seconda geometria va col materiale non illuminato. */
export const TEMA_GLOW = new Set<string>(['faro_rovina', 'roccia_lavica', 'braciere', 'statua', 'lanterna_pietra', 'abitante', 'chiesa_templare', ...CORSE_GLOW]);

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, s = 6) => new THREE.CylinderGeometry(r0, r1, h, s);
/** Colore per triangolo in base alla normale e alla quota (facce piatte, niente sfumature). */
function byFace(geo: THREE.BufferGeometry, m: THREE.Matrix4, f: (ny: number, y: number) => string): THREE.BufferGeometry {
  const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
  g.deleteAttribute('uv');
  const pos = g.attributes.position!, a = new Float32Array(pos.count * 3), c = new THREE.Color();
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    p0.fromBufferAttribute(pos, i); p1.fromBufferAttribute(pos, i + 1); p2.fromBufferAttribute(pos, i + 2);
    nn.subVectors(p1, p0).cross(p2.clone().sub(p0)).normalize();
    c.set(f(nn.y, (p0.y + p1.y + p2.y) / 3));
    for (let k = 0; k < 3; k++) { a[(i + k) * 3] = c.r; a[(i + k) * 3 + 1] = c.g; a[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function torii(parts: THREE.BufferGeometry[], col: string, top: string): void {
  for (const s of [-1, 1]) parts.push(painted(cyl(0.18, 0.22, 3.0), col, M(s * 1.3, 1.5, 0)));
  parts.push(painted(box(3.0, 0.24, 0.24), col, M(0, 2.4, 0)));
  parts.push(painted(box(3.7, 0.26, 0.38), top, M(0, 3.05, 0)));
  for (const s of [-1, 1]) parts.push(painted(box(0.55, 0.22, 0.38), top, M(s * 2.0, 3.12, 0, 0, 0, s * 0.25)));
  parts.push(painted(box(0.2, 0.55, 0.12), top, M(0, 2.75, -0.05)));
}

/** Corpo della decorazione (materiale illuminato, colori per vertice). Pivot a terra al centro, −Z avanti. */
export function propTema(kind: TemaProp): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  switch (kind) {
    case 'faro_rovina': {
      // torre a fasce bianche e rosse, spezzata in cima, con la balconata storta e i blocchi caduti
      for (let i = 0; i < 6; i++) parts.push(painted(cyl(1.25 - i * 0.07, 1.32 - i * 0.07, 1.2, 8), i % 2 ? P.rosso : P.pietraChiara, M(0, 0.6 + i * 1.2, 0)));
      parts.push(painted(cyl(1.0, 1.0, 0.4, 8), P.pietra, M(0.15, 7.3, 0, 0.12, 0, 0.08)));
      for (const [a, hh] of [[0, 1.4], [1.3, 0.8], [2.4, 1.1], [3.9, 0.5], [5.1, 1.0]] as const) parts.push(painted(box(0.45, hh, 0.35), a % 2 > 1 ? P.pietra : P.pietraChiara, M(Math.cos(a) * 0.85, 7.5 + hh / 2, Math.sin(a) * 0.85, 0, -a, 0)));
      parts.push(painted(box(0.7, 1.4, 0.1), P.neroCaldo, M(0, 0.7, -1.29)));
      parts.push(painted(box(0.5, 0.7, 0.1), P.neroCaldo, M(0.6, 4.4, -1.0, 0, 0.5, 0)));
      for (const [x, z, s] of [[1.8, 0.6, 0.5], [2.4, -0.4, 0.35], [-1.9, 1.0, 0.45]] as const) parts.push(painted(new THREE.DodecahedronGeometry(s, 0), P.pietra, M(x, s * 0.6, z, 0.4, x, 0.2)));
      break;
    }
    case 'relitto': {
      // scafo inclinato e spezzato, costole scoperte, albero rotto con la vela strappata
      parts.push(painted(box(1.6, 0.5, 6.6), P.legnoScuro, M(0, 0.25, 0)));
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) parts.push(painted(box(0.18, 0.42, 6.2 - i * 0.9 - (s > 0 ? 1.4 : 0)), i % 2 ? P.legno : P.legnoScuro, M(s * (0.9 + i * 0.12), 0.65 + i * 0.4, s > 0 ? 0.7 : 0, 0, 0, s * 0.18)));
      for (let i = 0; i < 4; i++) parts.push(painted(box(0.14, 1.3, 0.14), P.ombraCalda, M(0.95, 1.2, 1.4 - i * 0.8, 0, 0, 0.35)));
      parts.push(painted(box(2.2, 0.16, 1.2), P.legno, M(-0.2, 1.65, -2.4, 0, 0.1, 0.12)));
      parts.push(painted(cyl(0.12, 0.15, 3.6), P.legnoScuro, M(-0.3, 2.4, -0.4, 0.3, 0, -0.35)));
      parts.push(painted(box(1.6, 1.1, 0.04), P.pietraChiara, M(0.2, 3.1, -0.85, 0.3, 0.2, -0.35)));
      parts.push(painted(box(0.7, 0.5, 0.05), P.pietra, M(-0.6, 2.2, -0.75, 0.25, -0.3, 0.2)));
      break;
    }
    case 'bandiera_pirata': {
      parts.push(painted(cyl(0.07, 0.09, 3.6), P.legnoScuro, M(0, 1.8, 0)));
      parts.push(painted(box(1.5, 0.95, 0.05), P.neroCaldo, M(0.8, 3.0, 0, 0, 0, -0.05)));
      parts.push(painted(box(0.36, 0.3, 0.07), P.pietraChiara, M(0.8, 3.12, 0))); // teschio
      parts.push(painted(box(0.22, 0.1, 0.07), P.pietraChiara, M(0.8, 2.92, 0)));
      for (const s of [-1, 1]) parts.push(painted(box(0.85, 0.07, 0.07), P.pietraChiara, M(0.8, 2.78, 0, 0, 0, s * 0.55))); // tibie
      for (const s of [-1, 1]) parts.push(painted(box(0.07, 0.07, 0.08), P.neroCaldo, M(0.8 + s * 0.08, 3.14, 0)));
      break;
    }
    case 'cannone': {
      parts.push(painted(cyl(0.22, 0.3, 2.0, 8), P.neroCaldo, M(0, 0.75, -0.2, Math.PI / 2 - 0.12, 0, 0)));
      parts.push(painted(cyl(0.3, 0.3, 0.12, 8), P.roccia, M(0, 0.86, 0.75, Math.PI / 2, 0, 0)));
      parts.push(painted(box(1.0, 0.35, 1.5), P.legno, M(0, 0.4, 0.15)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(painted(cyl(0.26, 0.26, 0.12, 8), P.legnoScuro, M(sx * 0.56, 0.26, 0.15 + sz * 0.5, 0, 0, Math.PI / 2)));
      parts.push(painted(new THREE.IcosahedronGeometry(0.16, 0), P.neroCaldo, M(0.6, 0.16, -0.9)));
      parts.push(painted(new THREE.IcosahedronGeometry(0.16, 0), P.neroCaldo, M(0.85, 0.16, -0.7)));
      break;
    }
    case 'albero_secco': {
      parts.push(painted(cyl(0.12, 0.2, 2.2, 5), P.legnoScuro, M(0, 1.1, 0, 0, 0, 0.08)));
      for (const [a, l, y] of [[0.6, 1.2, 1.7], [2.6, 1.0, 1.4], [4.4, 0.9, 2.0], [1.6, 0.7, 2.25]] as const) {
        const m = M(Math.cos(a) * 0.15, y, Math.sin(a) * 0.15, 0, -a, 0).multiply(M(0, 0, 0, 0, 0, -0.9)).multiply(M(0, l / 2, 0));
        parts.push(painted(cyl(0.04, 0.08, l, 4), P.ombraCalda, m));
      }
      break;
    }
    case 'iceberg': {
      const ice = (ny: number, y: number) => (y < 0.15 ? P.acqua : ny > 0.55 ? P.sabbiaChiara : ny > 0 ? P.pietraChiara : P.acquaBassa);
      parts.push(byFace(new THREE.DodecahedronGeometry(2.2, 0), M(0, 1.2, 0, 0.3, 0.2, 0.1, 1.2, 1.25, 1), ice));
      parts.push(byFace(new THREE.DodecahedronGeometry(1.4, 0), M(1.9, 0.6, 0.8, 0.6, 0.9, 0.2, 1, 1.1, 1), ice));
      parts.push(byFace(new THREE.IcosahedronGeometry(1.1, 0), M(-1.5, 2.6, -0.4, 0.2, 0.5, 0.3, 0.8, 1.6, 0.8), ice));
      break;
    }
    case 'pinguino': {
      parts.push(painted(new THREE.IcosahedronGeometry(0.28, 1), P.neroCaldo, M(0, 0.42, 0, 0, 0, 0, 1, 1.45, 0.9)));
      parts.push(painted(new THREE.IcosahedronGeometry(0.22, 1), P.pietraChiara, M(0, 0.38, -0.1, 0, 0, 0, 1, 1.4, 0.8)));
      parts.push(painted(new THREE.IcosahedronGeometry(0.17, 0), P.neroCaldo, M(0, 0.86, 0)));
      parts.push(painted(new THREE.ConeGeometry(0.05, 0.16, 4), P.arancio, M(0, 0.84, -0.2, -Math.PI / 2, 0, 0)));
      for (const s of [-1, 1]) {
        parts.push(painted(box(0.06, 0.32, 0.14), P.neroCaldo, M(s * 0.28, 0.5, 0, 0, 0, s * 0.35)));
        parts.push(painted(box(0.12, 0.04, 0.16), P.arancio, M(s * 0.09, 0.02, -0.06)));
        parts.push(painted(box(0.05, 0.05, 0.02), P.pietraChiara, M(s * 0.07, 0.9, -0.15)));
      }
      return merged(parts).scale(1.5, 1.5, 1.5); // si devono vedere dal diorama
    }
    case 'igloo': {
      parts.push(byFace(new THREE.SphereGeometry(1.7, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), M(0, 0, 0), (ny, y) => (Math.floor(y / 0.42) % 2 ? P.pietraChiara : P.sabbiaChiara)));
      parts.push(byFace(new THREE.CylinderGeometry(0.62, 0.62, 1.1, 8, 1, false, 0, Math.PI), M(0, 0, -1.7, Math.PI / 2, 0, 0), () => P.pietraChiara));
      parts.push(painted(box(0.62, 0.62, 0.05), P.abisso, M(0, 0.3, -2.25)));
      break;
    }
    case 'pino_neve': {
      parts.push(painted(cyl(0.12, 0.16, 0.9, 5), P.legnoScuro, M(0, 0.45, 0)));
      for (const [y, r, hh] of [[1.0, 1.15, 1.2], [1.75, 0.9, 1.05], [2.4, 0.6, 0.9]] as const) {
        parts.push(painted(new THREE.ConeGeometry(r, hh, 6), P.boscoOmbra, M(0, y + hh / 2, 0)));
        parts.push(painted(new THREE.ConeGeometry(r * 0.75, hh * 0.45, 6), P.pietraChiara, M(0, y + hh * 0.72, 0, 0, 0.5, 0)));
      }
      break;
    }
    case 'roccia_lavica': {
      parts.push(byFace(new THREE.DodecahedronGeometry(0.75, 0), M(0, 0.45, 0, 0.4, 0.2, 0.1, 1.2, 0.8, 1), (ny) => (ny > 0.5 ? P.roccia : P.neroCaldo)));
      parts.push(byFace(new THREE.DodecahedronGeometry(0.45, 0), M(0.8, 0.25, 0.4, 0.2, 0.9, 0), (ny) => (ny > 0.5 ? P.roccia : P.neroCaldo)));
      break;
    }
    case 'capanna': {
      parts.push(painted(cyl(1.4, 1.5, 1.7, 8), P.legno, M(0, 0.85, 0)));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; parts.push(painted(box(0.12, 1.75, 0.12), P.legnoScuro, M(Math.cos(a) * 1.47, 0.87, Math.sin(a) * 1.47))); }
      parts.push(painted(new THREE.ConeGeometry(2.1, 1.6, 8), P.sabbia, M(0, 2.45, 0, 0, 0.2, 0)));
      parts.push(painted(new THREE.ConeGeometry(1.35, 0.9, 8), P.legnoChiaro, M(0, 3.05, 0, 0, 0.6, 0)));
      parts.push(painted(box(0.7, 1.1, 0.08), P.neroCaldo, M(0, 0.55, -1.47)));
      parts.push(painted(box(0.18, 0.5, 0.18), P.rosso, M(0, 3.6, 0)));
      break;
    }
    case 'braciere': {
      parts.push(painted(cyl(0.22, 0.3, 0.9, 6), P.pietraScura, M(0, 0.45, 0)));
      parts.push(painted(cyl(0.55, 0.3, 0.35, 8), P.roccia, M(0, 1.05, 0)));
      break;
    }
    case 'statua': {
      // testa di pietra col cappello di brace: i guardiani del Vulcano
      parts.push(byFace(box(1.1, 2.6, 0.9), M(0, 1.3, 0), (ny) => (ny > 0.5 ? P.pietraScura : P.roccia)));
      parts.push(painted(box(1.2, 0.3, 0.3), P.neroCaldo, M(0, 2.05, -0.5)));
      parts.push(painted(box(0.28, 0.75, 0.32), P.roccia, M(0, 1.6, -0.55)));
      parts.push(painted(box(0.7, 0.14, 0.12), P.neroCaldo, M(0, 1.05, -0.48)));
      parts.push(painted(box(1.3, 0.4, 1.0), P.roccia, M(0, 2.8, 0)));
      break;
    }
    case 'cartello': {
      for (const s of [-1, 1]) parts.push(painted(box(0.12, 1.6, 0.12), P.legnoScuro, M(s * 0.65, 0.8, 0)));
      parts.push(painted(box(1.6, 0.85, 0.08), P.legnoChiaro, M(0, 1.3, 0)));
      for (const y of [1.5, 1.32, 1.14]) parts.push(painted(box(1.1 - (y === 1.14 ? 0.4 : 0), 0.06, 0.1), P.legnoScuro, M(0, y, -0.01)));
      for (const s of [-1, 1]) parts.push(painted(box(0.5, 0.08, 0.1), P.rosso, M(0.55, 1.05, -0.02, 0, 0, s * 0.7)));
      break;
    }
    case 'abitante': {
      // guardiano del Vulcano: tunica rossa, braccia conserte, la Lanterna in testa (la parte che brilla è in propTemaGlow)
      const pelle = '#8C5636'; // tono pelle dell'atlas avatar (ART_BIBLE §2)
      for (const s of [-1, 1]) parts.push(painted(box(0.2, 0.8, 0.22), P.legnoScuro, M(s * 0.13, 0.4, 0)));
      parts.push(painted(box(0.58, 0.75, 0.34), P.rosso, M(0, 1.15, 0)));
      parts.push(painted(box(0.62, 0.12, 0.38), P.giallo, M(0, 0.85, 0)));
      parts.push(painted(box(0.7, 0.18, 0.3), P.rosso, M(0, 1.3, -0.16)));
      for (const s of [-1, 1]) parts.push(painted(box(0.14, 0.16, 0.14), pelle, M(s * 0.3, 1.3, -0.3)));
      parts.push(painted(box(0.34, 0.36, 0.32), pelle, M(0, 1.72, 0)));
      parts.push(painted(box(0.36, 0.1, 0.34), P.neroCaldo, M(0, 1.92, 0)));
      for (const s of [-1, 1]) parts.push(painted(box(0.06, 0.06, 0.02), P.neroCaldo, M(s * 0.08, 1.75, -0.17)));
      parts.push(painted(box(0.03, 0.42, 0.03), P.legnoScuro, M(0, 2.15, 0)));
      parts.push(painted(box(0.3, 0.05, 0.3), P.neroCaldo, M(0, 2.62, 0)));
      break;
    }
    case 'ciliegio': {
      parts.push(painted(cyl(0.13, 0.2, 1.4, 5), P.legno, M(0, 0.7, 0, 0, 0, 0.12)));
      parts.push(painted(cyl(0.09, 0.13, 1.0, 5), P.legnoScuro, M(0.22, 1.7, 0.05, 0, 0, -0.3)));
      parts.push(painted(cyl(0.07, 0.1, 0.9, 5), P.legnoScuro, M(-0.25, 1.75, -0.1, 0.2, 0, 0.5)));
      const puffs: [number, number, number, number, string][] = [[0.3, 2.35, 0, 0.85, P.rosaNeon], [-0.5, 2.25, -0.2, 0.7, P.sabbiaChiara], [0.1, 2.75, -0.35, 0.65, P.rosaNeon],
        [-0.15, 2.6, 0.45, 0.6, P.pietraChiara], [0.75, 2.0, 0.35, 0.5, P.sabbiaChiara], [-0.75, 1.95, 0.3, 0.45, P.rosaNeon]];
      for (const [x, y, z, r, c] of puffs) parts.push(painted(new THREE.IcosahedronGeometry(r, 0), c, M(x, y, z, x, z, 0, 1, 0.8, 1)));
      break;
    }
    case 'tempio': {
      // pagoda a due tetti su un basamento di pietra, porta verso −Z
      parts.push(byFace(box(5.2, 0.6, 5.2), M(0, 0.3, 0), (ny) => (ny > 0.5 ? P.pietraChiara : P.pietra)));
      parts.push(painted(box(1.6, 0.3, 0.8), P.pietra, M(0, 0.15, -3.0)));
      parts.push(painted(box(3.6, 2.2, 3.6), P.rosso, M(0, 1.7, 0)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(painted(box(0.3, 2.3, 0.3), P.legnoScuro, M(sx * 1.85, 1.75, sz * 1.85)));
      parts.push(painted(box(1.0, 1.5, 0.1), P.neroCaldo, M(0, 1.35, -1.81)));
      parts.push(painted(new THREE.ConeGeometry(3.9, 1.2, 4), P.neroCaldo, M(0, 3.4, 0, 0, Math.PI / 4, 0, 1, 1, 1)));
      parts.push(painted(box(2.4, 1.4, 2.4), P.rosso, M(0, 4.5, 0)));
      parts.push(painted(new THREE.ConeGeometry(2.8, 1.1, 4), P.neroCaldo, M(0, 5.7, 0, 0, Math.PI / 4, 0)));
      parts.push(painted(cyl(0.08, 0.12, 1.4, 5), P.giallo, M(0, 6.6, 0)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(painted(box(0.35, 0.2, 0.35), P.neroCaldo, M(sx * 2.6, 3.05, sz * 2.6, 0, 0, 0)));
      break;
    }
    case 'torii_pietra': torii(parts, P.pietra, P.pietraScura); break;
    case 'chiesa_templare': case 'casa_rovina': case 'tomba': case 'croce_pietra': case 'tenda': case 'relitto_templare': case 'scheletro': return propTemplari(kind);
    case 'arco_via': case 'tribuna': case 'gomme': case 'kart_fermo': case 'bandierina': // Isola delle Corse
    case 'strada': case 'rotatoria': case 'trofeo': case 'statua_trofeo': case 'torre_corse': case 'garage_corse': case 'bancarella': case 'festone': case 'lampione': case 'palo_molo':
    case 'porta_neve': case 'porta_giungla': case 'porta_neon': case 'porta_luna': case 'porta_spiaggia': case 'ruota_panoramica': case 'tendone': case 'tendone_piccolo': case 'tempio_giungla':
    case 'palazzo_neon': case 'palazzo_neon_basso': case 'faro': case 'ombrellone': case 'albero_tondo': case 'albero_giungla': case 'chiazza_neve':
      return corse ? corse.propCorse(kind) : painted(box(0.01, 0.01, 0.01), P.pietra); // (chunk non ancora arrivato: createIsland aspetta corsePronta)
    case 'lanterna_pietra': {
      parts.push(painted(box(0.8, 0.25, 0.8), P.pietraScura, M(0, 0.12, 0)));
      parts.push(painted(cyl(0.16, 0.2, 0.8, 6), P.pietra, M(0, 0.65, 0)));
      parts.push(painted(box(0.7, 0.14, 0.7), P.pietra, M(0, 1.1, 0)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(painted(box(0.12, 0.42, 0.12), P.pietra, M(sx * 0.24, 1.38, sz * 0.24)));
      parts.push(painted(new THREE.ConeGeometry(0.62, 0.4, 4), P.pietraScura, M(0, 1.8, 0, 0, Math.PI / 4, 0)));
      parts.push(painted(new THREE.IcosahedronGeometry(0.1, 0), P.pietra, M(0, 2.05, 0)));
      break;
    }
    case 'ponticello': {
      // ringhiere rosse lungo il ponte di legno dello stagno (15 m su Z), pomelli gialli
      for (const sx of [-1, 1]) {
        for (let i = 0; i <= 7; i++) {
          parts.push(painted(box(0.18, 1.0, 0.18), P.rosso, M(sx * 1.9, 0.9, -7 + i * 2)));
          parts.push(painted(new THREE.IcosahedronGeometry(0.13, 0), P.giallo, M(sx * 1.9, 1.48, -7 + i * 2)));
        }
        parts.push(painted(box(0.14, 0.14, 14.2), P.rosso, M(sx * 1.9, 1.25, 0)));
        parts.push(painted(box(0.1, 0.1, 14.2), P.rosso, M(sx * 1.9, 0.75, 0)));
      }
      break;
    }
  }
  return merged(parts);
}

/** Parte che brilla (null se la decorazione non ne ha). */
export function propTemaGlow(kind: TemaProp): THREE.BufferGeometry | null {
  if (CORSE_GLOW.has(kind)) return corse ? corse.propCorseGlow(kind) : null; // Isola delle Corse
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'faro_rovina') parts.push(painted(box(0.5, 0.5, 0.5), P.giallo, M(0.1, 7.75, 0)));
  else if (kind === 'braciere') {
    parts.push(painted(new THREE.ConeGeometry(0.36, 0.8, 5), P.arancio, M(0, 1.6, 0)));
    parts.push(painted(new THREE.ConeGeometry(0.2, 0.6, 5), P.giallo, M(0.1, 1.55, -0.1)));
    parts.push(painted(new THREE.ConeGeometry(0.16, 0.5, 4), P.rosso, M(-0.2, 1.45, 0.12)));
  } else if (kind === 'roccia_lavica') {
    for (const [x, y, z, ry] of [[0.2, 0.55, -0.62, 0.3], [-0.45, 0.4, -0.45, -0.7], [0.75, 0.3, 0.05, 1.2]] as const) parts.push(painted(box(0.5, 0.06, 0.06), P.arancio, M(x, y, z, 0, ry, 0.5)));
  } else if (kind === 'statua') {
    for (const s of [-1, 1]) parts.push(painted(box(0.24, 0.16, 0.06), P.arancio, M(s * 0.3, 1.82, -0.46)));
    parts.push(painted(new THREE.ConeGeometry(0.3, 0.6, 5), P.arancio, M(0, 3.3, 0)));
    parts.push(painted(new THREE.ConeGeometry(0.16, 0.4, 4), P.giallo, M(0, 3.25, 0)));
  } else if (kind === 'abitante') {
    parts.push(painted(cyl(0.13, 0.13, 0.26, 6), P.rosso, M(0, 2.44, 0)));
    parts.push(painted(box(0.12, 0.1, 0.12), P.giallo, M(0, 2.44, -0.09)));
  } else if (kind === 'lanterna_pietra') {
    parts.push(painted(box(0.36, 0.3, 0.36), P.giallo, M(0, 1.38, 0)));
  } else if (kind === 'chiesa_templare') return propTemplariGlow();
  return parts.length ? merged(parts) : null;
}

/** Scenografia casuale per stile: cosa nasce sulla sabbia (`.`) e sull'erba (`g`), con la soglia del tiro (moltiplicata per la densità). */
export const SCENA_TEMI: Record<TemaStyle, { sabbia: [string, number][]; erba: [string, number][] }> = {
  tempesta: { sabbia: [['sasso', 0.07], ['barile', 0.015]], erba: [['albero_secco', 0.07], ['sasso', 0.14]] },
  ghiacci: { sabbia: [['pinguino', 0.025], ['sasso', 0.02]], erba: [['pino_neve', 0.12], ['sasso', 0.03]] },
  vulcano: { sabbia: [['roccia_lavica', 0.06]], erba: [['roccia_lavica', 0.07], ['albero_secco', 0.12]] },
  giardino: { sabbia: [], erba: [['ciliegio', 0.07], ['cespuglio', 0.16], ['sasso', 0.18]] },
  templari: { sabbia: [['sasso', 0.05]], erba: [['albero_secco', 0.035], ['sasso', 0.08], ['cespuglio', 0.05]] },
  corse: { sabbia: [['sasso', 0.03]], erba: [['albero_tondo', 0.05], ['cespuglio', 0.06]] }, // l'isola nel json ha scenery 0: alberi e cespugli sono decorazioni fisse
};
