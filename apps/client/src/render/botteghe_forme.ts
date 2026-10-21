// Le tre botteghe del Borgo (#414) viste da fuori: casette a blocchi a colori della palette, copiate dal concept scelto da Jack
// (`assets/concept/botteghe/esterni_A_casette.png`, 19 ott 2026): muri, tetto scuro a due falde, tenda a strisce del colore della bottega,
// banco davanti, insegna appesa con l'icona, e la roba di ognuna. Fabbro: muri di pietra, forno acceso, camino, incudine, rastrelliera
// d'armi. Alchimista: muri bianchi a graticcio viola, scaffali di boccette, calderone che bolle, erbe appese. Cantiere navale: muri bianchi
// a graticcio blu e, a destra, la tettoia con la barca a vela sui cavalletti, secchi di vernice, assi e corde.
// Modelli col davanti verso +Z e la destra verso +X (la camera arriva da sud-est: si vedono il davanti e il fianco destro); origine al
// centro della pianta, a terra. Tre geometrie: `corpo` (Lambert, colori per vertice), `luce` (non illuminata: fuoco, pozione, boccette
// neon), `insegna` (piano con la texture a pixel). Nessun hex fuori palette (ART_BIBLE §2).
import * as THREE from 'three';
import type { BottegaId } from '@marea/content/botteghe.ts';
import { M, P, merged, painted } from './island_parts.ts';

export type FormeBottega = { corpo: THREE.BufferGeometry; luce: THREE.BufferGeometry; insegna: { x: number; y: number; z: number; ry: number };
  /** Dove sta il bottegaio (dietro al banco, guarda +Z), dove escono i fumi (camino, calderone). */
  bottegaio: { x: number; z: number }; fumi: { x: number; y: number; z: number; colore: string }[] };

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** Il banco sta `BZ` m davanti al muro, il bottegaio `DZ` m: tra il muro e il banco, sotto la tenda (da dietro al muro non si vedeva). */
const BZ = 1.0, DZ = 0.32;
const cil = (r: number, h: number, n = 8) => new THREE.CylinderGeometry(r, r, h, n);
/** Prisma triangolare con la punta in su: base larga `w` a y = 0, alto `h`, profondo `d` lungo Z (i timpani del tetto, la vela). */
function prisma(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3);
  g.rotateX(-Math.PI / 2);
  g.scale(w / Math.sqrt(3), h / 1.5, d);
  g.translate(0, h / 3, 0);
  return g;
}

type Parti = { corpo: THREE.BufferGeometry[]; luce: THREE.BufferGeometry[] };
const pz = (p: Parti, g: THREE.BufferGeometry, c: string, m: THREE.Matrix4) => { p.corpo.push(painted(g, c, m)); };
const lz = (p: Parti, g: THREE.BufferGeometry, c: string, m: THREE.Matrix4) => { p.luce.push(painted(g, c, m)); };

/** La casetta: zoccolo, muri, pali agli spigoli, apertura scura sul davanti, tetto a due falde (colmo lungo Z) coi timpani, tenda a strisce. */
function casetta(p: Parti, o: { w: number; d: number; muro: string; trave: string; tenda: [string, string]; timpano?: string }): void {
  const { w, d } = o, h = 2.7, y0 = 0.22, top = y0 + h, fz = d / 2;
  pz(p, box(w + 0.3, y0, d + 0.3), P.pietra, M(0, y0 / 2, 0));
  pz(p, box(w, h, d), o.muro, M(0, y0 + h / 2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pz(p, box(0.24, h, 0.24), o.trave, M(sx * (w / 2), y0 + h / 2, sz * fz));
  pz(p, box(w + 0.2, 0.24, 0.26), o.trave, M(0, top, fz)); // trave in cima al davanti
  pz(p, box(0.26, 0.24, d + 0.2), o.trave, M(w / 2, top, 0)); // e sul fianco che si vede
  pz(p, box(w - 1.0, 1.75, 0.06), P.ombraCalda, M(0, y0 + 1.3, fz + 0.03)); // l'apertura della bottega
  pz(p, box(w - 0.85, 0.12, 0.12), o.trave, M(0, y0 + 2.22, fz + 0.06));
  // tetto: due falde scure col colmo lungo Z, timpani del colore del muro
  const fal = Math.hypot(w / 2 + 0.35, 1.15);
  const ang = Math.atan2(1.15, w / 2 + 0.35);
  for (const s of [-1, 1]) {
    pz(p, box(fal, 0.2, d + 0.6), P.roccia, M(s * (w / 4 + 0.08), top + 0.62, 0, 0, 0, -s * ang));
    // file di tegole: listelli scuri lungo la falda
    for (let k = 1; k < 4; k++) { const u = (k / 4 - 0.5) * fal; pz(p, box(0.1, 0.06, d + 0.62), P.neroCaldo, M(s * (w / 4 + 0.08) + Math.cos(ang) * u, top + 0.73 - s * Math.sin(ang) * u, 0, 0, 0, -s * ang)); }
  }
  pz(p, box(0.32, 0.26, d + 0.64), P.neroCaldo, M(0, top + 1.24, 0));
  for (const s of [-1, 1]) pz(p, prisma(w, 1.12, 0.08), o.timpano ?? o.muro, M(0, top + 0.06, s * (fz - 0.02)));
  pz(p, box(0.55, 0.45, 0.06), P.legnoScuro, M(0, top + 0.5, fz + 0.03)); // finestrella nel timpano
  pz(p, box(0.38, 0.3, 0.07), P.acquaBassa, M(0, top + 0.5, fz + 0.04));
  // tenda a strisce sopra il banco, in pendenza verso la strada, col bordo a smerlo
  const n = 7, sw = (w + 0.2) / n;
  for (let i = 0; i < n; i++) pz(p, box(sw, 0.07, 1.35), o.tenda[i % 2]!, M(-(w + 0.2) / 2 + sw * (i + 0.5), y0 + 2.66, fz + 0.64, 0.26, 0, 0));
  for (let i = 0; i < n; i++) pz(p, box(sw * 0.9, 0.16, 0.05), o.tenda[i % 2]!, M(-(w + 0.2) / 2 + sw * (i + 0.5), y0 + 2.4, fz + 1.3));
}
/** Il banco davanti all'apertura (legno, piano chiaro). */
function banco(p: Parti, x: number, z: number, w: number): void {
  pz(p, box(w, 0.95, 0.65), P.legno, M(x, 0.22 + 0.475, z));
  pz(p, box(w + 0.1, 0.08, 0.75), P.legnoChiaro, M(x, 0.22 + 0.99, z));
  for (const s of [-1, 1]) pz(p, box(0.08, 0.8, 0.06), P.legnoScuro, M(x + s * (w / 2 - 0.25), 0.22 + 0.45, z + 0.33));
}
/** Il braccio e la tavola dell'insegna, sullo spigolo davanti a sinistra; la faccia con l'icona è a parte (texture). */
function braccioInsegna(p: Parti, x: number, y: number, z: number): { x: number; y: number; z: number; ry: number } {
  pz(p, box(1.0, 0.1, 0.1), P.legnoScuro, M(x - 0.45, y + 0.5, z));
  pz(p, box(0.08, 0.3, 0.08), P.legnoScuro, M(x - 0.05, y + 0.32, z));
  for (const s of [-1, 1]) pz(p, box(0.03, 0.18, 0.03), P.neroCaldo, M(x - 0.7 + s * 0.28, y + 0.38, z));
  pz(p, box(0.86, 0.86, 0.08), P.legnoScuro, M(x - 0.7, y - 0.15, z));
  return { x: x - 0.7, y: y - 0.15, z: z + 0.05, ry: 0 };
}

function fabbro(): FormeBottega {
  const p: Parti = { corpo: [], luce: [] }, w = 4.2, d = 3.4, fz = d / 2;
  casetta(p, { w, d, muro: P.pietra, trave: P.legnoScuro, tenda: [P.rosso, P.sabbiaChiara] });
  for (const [x, y] of [[-1.6, 0.6], [1.7, 1.3], [-1.75, 2.2], [1.55, 2.5], [-1.2, 1.7]] as const) pz(p, box(0.5, 0.3, 0.06), P.pietraScura, M(x, y, fz + 0.01)); // pietre
  // il forno: blocco di pietra a destra del banco con la bocca accesa e la cappa
  pz(p, box(1.2, 1.35, 0.8), P.pietraScura, M(1.25, 0.22 + 0.68, fz + 0.3));
  pz(p, box(1.35, 0.25, 0.95), P.roccia, M(1.25, 0.22 + 1.45, fz + 0.3));
  pz(p, box(0.75, 0.55, 0.05), P.neroCaldo, M(1.25, 0.22 + 0.6, fz + 0.71));
  lz(p, box(0.6, 0.42, 0.05), P.arancio, M(1.25, 0.22 + 0.56, fz + 0.73));
  lz(p, box(0.36, 0.22, 0.05), P.giallo, M(1.25, 0.22 + 0.5, fz + 0.75));
  // il camino dietro, sulla falda destra
  pz(p, box(0.75, 2.2, 0.75), P.pietraScura, M(1.3, 3.75, -0.75));
  pz(p, box(0.92, 0.16, 0.92), P.roccia, M(1.3, 4.9, -0.75));
  banco(p, -0.55, fz + BZ, 2.3);
  for (const [x, c] of [[-1.25, P.neroCaldo], [-0.8, P.pietraScura], [-0.35, P.neroCaldo], [0.1, P.pietraScura]] as const) pz(p, box(0.32, 0.1, 0.2), c, M(x, 1.36, fz + BZ - 0.03)); // lingotti sul banco
  // incudine sul ceppo, fuori a sinistra
  pz(p, cil(0.3, 0.55), P.legnoScuro, M(-2.75, 0.28, fz + 0.65));
  pz(p, box(0.42, 0.18, 0.3), P.roccia, M(-2.75, 0.64, fz + 0.65));
  pz(p, box(0.8, 0.2, 0.34), P.neroCaldo, M(-2.75, 0.82, fz + 0.65));
  pz(p, box(0.25, 0.12, 0.2), P.neroCaldo, M(-3.25, 0.84, fz + 0.65));
  // rastrelliera con le armi, fuori a destra: spada, ascia, martello, arco
  const rx = 2.95, rz = fz + 0.55;
  for (const s of [-1, 1]) pz(p, box(0.1, 1.3, 0.1), P.legno, M(rx + s * 0.62, 0.65, rz));
  for (const y of [0.35, 1.15]) pz(p, box(1.35, 0.08, 0.1), P.legno, M(rx, y, rz));
  pz(p, box(0.07, 1.05, 0.03), P.pietraChiara, M(rx - 0.42, 0.85, rz + 0.08)); pz(p, box(0.26, 0.06, 0.06), P.giallo, M(rx - 0.42, 0.42, rz + 0.08));
  pz(p, box(0.06, 1.0, 0.05), P.legnoChiaro, M(rx - 0.12, 0.75, rz + 0.08)); pz(p, box(0.3, 0.26, 0.04), P.pietra, M(rx - 0.04, 1.12, rz + 0.08));
  pz(p, box(0.06, 0.95, 0.05), P.legnoChiaro, M(rx + 0.18, 0.72, rz + 0.08)); pz(p, box(0.26, 0.2, 0.18), P.pietraScura, M(rx + 0.18, 1.18, rz + 0.08));
  for (const [y, a] of [[0.5, 0.35], [0.85, 0], [1.2, -0.35]] as const) pz(p, box(0.05, 0.4, 0.05), P.legnoChiaro, M(rx + 0.48 + Math.abs(a) * -0.12, y, rz + 0.08, 0, 0, a));
  const insegna = braccioInsegna(p, -w / 2 - 0.05, 2.45, fz + 0.15);
  return { corpo: merged(p.corpo), luce: merged(p.luce), insegna, bottegaio: { x: -0.55, z: fz + DZ }, fumi: [{ x: 1.3, y: 5.1, z: -0.75, colore: P.pietraChiara }] };
}

function alchimista(): FormeBottega {
  const p: Parti = { corpo: [], luce: [] }, w = 4.0, d = 3.4, fz = d / 2;
  casetta(p, { w, d, muro: P.pietraChiara, trave: P.legnoScuro, tenda: [P.viola, P.sabbiaChiara] });
  // graticcio: travi orizzontali e diagonali sul davanti e sul fianco, cornice viola attorno all'apertura
  pz(p, box(w, 0.14, 0.05), P.legnoScuro, M(0, 2.55, fz + 0.03));
  for (const s of [-1, 1]) pz(p, box(0.12, 1.2, 0.05), P.legnoScuro, M(s * 1.75, 1.15, fz + 0.03, 0, 0, s * 0.45));
  pz(p, box(0.05, 0.14, d), P.legnoScuro, M(w / 2 + 0.03, 1.6, 0));
  for (const s of [-1, 1]) pz(p, box(0.05, 1.3, 0.12), P.legnoScuro, M(w / 2 + 0.03, 1.0, s * 0.8, s * 0.6, 0, 0));
  pz(p, box(w - 0.9, 0.1, 0.06), P.viola, M(0, 0.22 + 2.2, fz + 0.05));
  for (const s of [-1, 1]) pz(p, box(0.1, 1.75, 0.06), P.viola, M(s * (w / 2 - 0.47), 0.22 + 1.3, fz + 0.05));
  // scaffali con le boccette nell'apertura
  const col = [P.rosso, P.acqua, P.erbaScura, P.giallo, P.viola, P.acquaProfonda];
  for (const [y, k] of [[1.35, 0], [1.95, 2]] as const) {
    pz(p, box(w - 1.2, 0.07, 0.25), P.legno, M(0, y, fz - 0.05));
    for (let i = 0; i < 6; i++) pz(p, box(0.16, 0.26, 0.14), col[(i + k) % col.length]!, M(-1.15 + i * 0.46, y + 0.17, fz - 0.03));
  }
  for (const [x, c] of [[-0.9, P.verdeNeon], [0.45, P.violaNeon], [1.05, P.cianoNeon]] as const) lz(p, box(0.12, 0.12, 0.1), c, M(x, 1.98, fz + 0.03));
  banco(p, 0, fz + BZ, 2.4);
  pz(p, box(0.42, 0.12, 0.32), P.rosso, M(0.6, 1.36, fz + BZ)); pz(p, box(0.4, 0.04, 0.3), P.sabbiaChiara, M(0.6, 1.43, fz + BZ)); // il libro delle ricette
  for (const [x, c] of [[-0.75, P.erbaScura], [-0.45, P.acqua], [-0.15, P.viola]] as const) pz(p, box(0.15, 0.24, 0.15), c, M(x, 1.42, fz + BZ - 0.05));
  // erbe appese sotto la tenda
  for (const [x, c] of [[-1.7, P.erbaScura], [-1.0, P.erba], [-0.3, P.bosco], [0.35, P.erbaScura]] as const) {
    pz(p, box(0.03, 0.3, 0.03), P.legnoScuro, M(x, 2.28, fz + 1.0));
    pz(p, box(0.2, 0.34, 0.16), c, M(x, 1.98, fz + 1.0));
  }
  // il calderone sul fuoco, fuori a sinistra, con la pozione che brilla
  const cx = -2.7, cz = fz + 1.0;
  for (const a of [0, 2.1, 4.2]) pz(p, box(0.08, 0.35, 0.08), P.neroCaldo, M(cx + Math.sin(a) * 0.32, 0.18, cz + Math.cos(a) * 0.32));
  pz(p, new THREE.CylinderGeometry(0.5, 0.38, 0.6, 8), P.neroCaldo, M(cx, 0.62, cz));
  pz(p, new THREE.TorusGeometry(0.48, 0.06, 4, 8), P.roccia, M(cx, 0.92, cz, Math.PI / 2, 0, 0));
  lz(p, cil(0.43, 0.06), P.violaNeon, M(cx, 0.9, cz));
  lz(p, box(0.3, 0.12, 0.3), P.arancio, M(cx, 0.08, cz));
  // botte coi fiori, fuori a destra
  pz(p, cil(0.38, 0.75), P.legno, M(2.55, 0.38, fz + 0.6)); pz(p, cil(0.4, 0.06), P.legnoScuro, M(2.55, 0.55, fz + 0.6));
  for (const [x, z, c] of [[-0.12, 0, P.viola], [0.14, 0.1, P.erba], [0.05, -0.15, P.violaNeon], [-0.15, 0.17, P.erbaScura]] as const) pz(p, box(0.2, 0.25, 0.2), c, M(2.55 + x, 0.88, fz + 0.6 + z));
  const insegna = braccioInsegna(p, -w / 2 - 0.05, 2.45, fz + 0.15);
  return { corpo: merged(p.corpo), luce: merged(p.luce), insegna, bottegaio: { x: 1.0, z: fz + DZ + 0.16 }, fumi: [{ x: cx, y: 1.0, z: cz, colore: P.viola }] }; // Sibilla col cappellone: un passo avanti, sennò la tenda la copre
}

function cantiere(): FormeBottega {
  const p: Parti = { corpo: [], luce: [] }, w = 3.8, d = 3.2, fz = d / 2;
  casetta(p, { w, d, muro: P.pietraChiara, trave: P.acquaProfonda, tenda: [P.acquaProfonda, P.sabbiaChiara] });
  pz(p, box(w, 0.14, 0.05), P.acquaProfonda, M(0, 2.55, fz + 0.03));
  banco(p, -0.2, fz + BZ, 2.3);
  for (const [x, l] of [[-0.85, 0.9], [-0.3, 0.7], [0.3, 0.8]] as const) pz(p, box(l, 0.06, 0.22), P.legnoChiaro, M(x, 1.33, fz + BZ, 0, 0.2, 0)); // assi e la pialla sul banco
  pz(p, box(0.3, 0.12, 0.12), P.legnoScuro, M(0.55, 1.38, fz + BZ - 0.05));
  // la tettoia a destra, aperta, col tetto di legno in pendenza verso il mare
  const tx = w / 2 + 1.9, tw = 3.6, td = 3.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pz(p, box(0.18, 2.9, 0.18), P.legnoScuro, M(tx + sx * (tw / 2 - 0.1), 1.45, sz * (td / 2 - 0.1)));
  pz(p, box(tw + 0.5, 0.14, td + 0.4), P.legno, M(tx, 3.0, 0, 0, 0, -0.12));
  for (let i = 0; i < 5; i++) pz(p, box(0.06, 0.06, td + 0.42), P.legnoScuro, M(tx - tw / 2 + 0.2 + i * (tw - 0.4) / 4, 3.08 - (i - 2) * 0.09, 0));
  // i cavalletti e la barca a vela (scafo bianco con le fasce blu e rossa, albero, vela)
  for (const sz of [-0.8, 0.8]) for (const sx of [-1, 1]) pz(p, box(0.09, 0.75, 0.09), P.legno, M(tx + sx * 0.45, 0.38, sz, 0, 0, sx * 0.25));
  for (const sz of [-0.8, 0.8]) pz(p, box(1.0, 0.1, 0.12), P.legno, M(tx, 0.72, sz));
  pz(p, box(1.05, 0.55, 2.6), P.pietraChiara, M(tx, 1.05, 0));
  pz(p, prisma(1.05, 0.7, 0.55).rotateX(Math.PI / 2), P.pietraChiara, M(tx, 1.05, 1.3)); // la prua
  pz(p, box(1.08, 0.1, 2.62), P.acquaProfonda, M(tx, 0.95, 0)); pz(p, box(1.08, 0.08, 2.62), P.rosso, M(tx, 0.82, 0));
  pz(p, box(0.95, 0.06, 2.45), P.legno, M(tx, 1.33, 0));
  pz(p, box(0.08, 1.7, 0.08), P.legnoScuro, M(tx, 2.15, 0.2));
  pz(p, prisma(1.5, 1.45, 0.05).rotateY(Math.PI / 2), P.sabbiaChiara, M(tx, 1.45, -0.45));
  // secchi di vernice, assi appoggiate e la corda arrotolata, davanti alla tettoia
  for (const [x, c] of [[tx - 1.3, P.rosso], [tx - 0.75, P.giallo], [tx - 0.2, P.acquaProfonda]] as const) {
    pz(p, cil(0.2, 0.34), c, M(x, 0.17, td / 2 + 0.55)); pz(p, cil(0.21, 0.04), P.pietra, M(x, 0.35, td / 2 + 0.55));
  }
  for (const [x, a] of [[tx + 1.55, 0.25], [tx + 1.75, 0.3], [tx + 1.95, 0.22]] as const) pz(p, box(0.25, 2.0, 0.06), P.legnoChiaro, M(x, 1.0, -td / 2 + 0.4, a, 0, 0));
  pz(p, new THREE.TorusGeometry(0.3, 0.1, 4, 8), P.legnoChiaro, M(-w / 2 - 0.55, 0.12, fz + 0.6, Math.PI / 2, 0, 0));
  pz(p, new THREE.TorusGeometry(0.22, 0.09, 4, 8), P.legnoChiaro, M(-w / 2 - 0.55, 0.3, fz + 0.6, Math.PI / 2, 0, 0));
  const insegna = braccioInsegna(p, -w / 2 - 0.05, 2.45, fz + 0.15);
  return { corpo: merged(p.corpo), luce: p.luce.length ? merged(p.luce) : new THREE.BufferGeometry(), insegna, bottegaio: { x: -0.2, z: fz + DZ }, fumi: [] };
}

export const FORME: Record<BottegaId, () => FormeBottega> = { fabbro, alchimista, cantiere };

// ——— le insegne: icone 8×8 su una tavola chiara col bordo scuro, tutte e tre in una texture 36×12 (una draw call) ———
const ICONE: Record<BottegaId, string[]> = {
  fabbro: ['........', '.kkkkkk.', 'kkkkkkkk', '..kkkk..', '...kk...', '..kkkk..', '.kkkkkk.', '........'],
  alchimista: ['...ww...', '...ww...', '..wvvw..', '.wvvvvw.', 'wvvvvvvw', 'wvvvvvvw', '.wwwwww.', '........'],
  cantiere: ['...aa...', '..a..a..', '...aa...', '.aaaaaa.', '...aa...', 'a..aa..a', 'aa.aa.aa', '.aaaaaa.'],
};
const INK: Record<string, string> = { k: P.neroCaldo, w: P.pietraChiara, v: P.viola, a: P.abisso };
export const ORDINE_INSEGNE: readonly BottegaId[] = ['fabbro', 'alchimista', 'cantiere'];
/** Disegna l'icona di una bottega (8×8) su un canvas, a `s` pixel per pixel: per l'insegna e per il bottone. */
export function disegnaIcona(g: CanvasRenderingContext2D, id: BottegaId, x0: number, y0: number, s = 1): void {
  ICONE[id].forEach((r, y) => { for (let x = 0; x < 8; x++) { const c = INK[r[x]!]; if (c) { g.fillStyle = c; g.fillRect(x0 + x * s, y0 + y * s, s, s); } } });
}
/** L'insegna di una bottega da sola, 12×12 (tavoletta chiara col bordo scuro e l'icona): per il bottone, il cartellino e il pannello. */
export function canvasInsegna(id: BottegaId): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 12;
  const g = c.getContext('2d')!;
  g.fillStyle = P.legnoScuro; g.fillRect(0, 0, 12, 12); g.fillStyle = P.sabbia; g.fillRect(1, 1, 10, 10);
  disegnaIcona(g, id, 2, 2);
  return c;
}
export function texInsegne(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 36; c.height = 12;
  const g = c.getContext('2d')!;
  ORDINE_INSEGNE.forEach((id, i) => {
    g.fillStyle = P.legnoScuro; g.fillRect(i * 12, 0, 12, 12);
    g.fillStyle = P.sabbia; g.fillRect(i * 12 + 1, 1, 10, 10);
    disegnaIcona(g, id, i * 12 + 2, 2);
  });
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** La faccia dell'insegna (0,74 m, doppia: si legge da tutti e due i lati), con le UV della sua icona nella texture comune. */
export function facciaInsegna(id: BottegaId): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.74, 0.74), i = ORDINE_INSEGNE.indexOf(id), uv = g.attributes.uv!;
  for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 3);
  const dietro = g.clone().rotateY(Math.PI).translate(0, 0, -0.1);
  return merged([g, dietro]);
}
