// La pista del motore v2 in 3D (docs/CORSE.md A11), costruita dal nastro della sim: quello che vedi è quello su cui guidi.
// Ci sono:
// - la strada a fasce colorate per superficie, con la riga di mezzo sull'asfalto, il bordo e i cordoli nelle curve;
// - il muretto di gomme (sulle piste d'acqua le boe), che manca dove la sim non ha il muro;
// - la scogliera sotto i tratti alti, le rampe a strisce, i tappeti del turbo, le creste delle onde, la linea del via;
// - nelle piste miste (il porto) la striscia gialla e nera tra la corsia del molo e quella dell'acqua;
// - gli eventi firma, a parte: si accendono dal loro giro.
// Grigio da banco di prova: la scenografia vera delle zone arriva con i kit Blender (A9). Facce piatte, colori della palette, doppia
// faccia (i giri della morte si vedono anche da sotto).
import * as THREE from 'three';
import { CORSE } from '@marea/content/corse.ts';
import { campo, punto } from '@marea/sim/corse/nastro.ts';
import type { Nastro } from '@marea/sim/corse/nastro.ts';
import { VUOTO, muroA, nelTratto, superficieA } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { P } from '../render/island_parts.ts';
import { creaScena } from './scena.ts';

export const COLORE_SUP: Record<string, string> = {
  asfalto: P.roccia, legno: P.legnoChiaro, erba: P.erba, sabbia: P.sabbia, ghiaccio: P.pietraChiara,
  acqua: P.acqua, acquaBassa: P.acquaBassa, corrente: P.acquaProfonda, container: P.rosso,
};
const coloreDi = (sup: string) => COLORE_SUP[sup] ?? P.pietra;
type V3 = [number, number, number];

/** Raccoglie quadrilateri colorati e li fa diventare una geometria (colori per vertice, facce piatte). */
class Tela {
  pos: number[] = []; col: number[] = [];
  private c = new THREE.Color();
  quad(a: V3, b: V3, c: V3, d: V3, colore: string): void {
    this.c.set(colore);
    this.pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    for (let k = 0; k < 6; k++) this.col.push(this.c.r, this.c.g, this.c.b);
  }
  mesh(mat: THREE.Material, nome: string): THREE.Mesh | null {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.name = nome; m.receiveShadow = true;
    return m;
  }
}

const pt = (n: Nastro, s: number, lat: number, h: number): V3 => punto(n, s, lat, h, [0, 0, 0]);
/** Prova A/B di Jack (#176): il muretto delle piste della Spiaggia di pietra chiara come nella concept invece che a gomme rosse e
 *  bianche. Si accende con `?muro=pietra` nell'indirizzo del banco. */
const muroDiPietra = (id: string) => id.startsWith('spiaggia_') && typeof location !== 'undefined' && new URLSearchParams(location.search).get('muro') === 'pietra';
const ALTO_MURO = 0.9, SPESSO = 0.5, CORDOLO = 0.7;

/** Strada, bordi, cordoli e muri di un nastro (principale o ramo). */
function strada(t: Tela, p: Pista, n: Nastro, ramo: number, bordo: number): void {
  const d = p.def, acqua = d.stile === 'acqua', ultimo = n.chiuso ? n.n : n.n - 1, pietra = muroDiPietra(d.id);
  for (let i = 0; i < ultimo; i++) {
    const s0 = i * n.passo, s1 = s0 + n.passo, sm = s0 + n.passo / 2;
    if (ramo < 0 && superficieA(p, -1, sm, 0, 1) === VUOTO) continue; // i buchi
    const l0 = n.l[i]!, l1 = n.l[n.chiuso ? (i + 1) % n.n : i + 1]!, lm = (l0 + l1) / 2;
    // carreggiata a fasce di ~2 m, colorate con la superficie che c'è (giro 1: gli eventi stanno a parte)
    const nb = Math.max(2, Math.round(lm));
    for (let j = 0; j < nb; j++) {
      const f0 = -1 + (2 * j) / nb, f1 = -1 + (2 * (j + 1)) / nb;
      const sup = superficieA(p, ramo, sm, ((f0 + f1) / 2) * lm, 1);
      // nei giri della morte la strada è arancione a strisce (a testa in giù la luce non la prende: così si legge lo stesso)
      const c = n.ad[i] ? ((i >> 1) % 2 ? P.arancio : P.giallo) : coloreDi(sup);
      t.quad(pt(n, s0, f0 * l0, 0), pt(n, s0, f1 * l0, 0), pt(n, s1, f0 * l1, 0), pt(n, s1, f1 * l1, 0), c);
    }
    // riga di mezzo sull'asfalto, a tratti
    if (!acqua && i % 6 < 3 && superficieA(p, ramo, sm, 0, 1) === 'asfalto') t.quad(pt(n, s0, -0.15, 0.02), pt(n, s0, 0.15, 0.02), pt(n, s1, -0.15, 0.02), pt(n, s1, 0.15, 0.02), P.pietraChiara);
    // piste miste: il divisorio a righe gialle e nere tra le corsie (dove finisce l'acqua)
    if (ramo < 0 && d.corsie && i % 2 === 0) {
      const lim = (d.corsie.acqua ?? 0) < (d.corsie.ruote ?? 0) ? -1 : 1, c = (i >> 1) % 2 ? P.giallo : P.neroCaldo;
      t.quad(pt(n, s0, lim - 0.35, 0.1), pt(n, s0, lim + 0.35, 0.1), pt(n, s1, lim - 0.35, 0.1), pt(n, s1, lim + 0.35, 0.1), c);
    }
    // il bordo oltre la carreggiata, e i cordoli dove la pista curva
    const curva = Math.abs(n.k[i]!) > 0.012;
    for (const lato of [-1, 1]) {
      const supB = superficieA(p, ramo, sm, lato * (lm + bordo / 2), 1);
      const a0 = lato * l0, a1 = lato * l1, b0 = lato * (l0 + bordo), b1 = lato * (l1 + bordo);
      if (bordo > 0) t.quad(pt(n, s0, a0, 0), pt(n, s0, b0, 0), pt(n, s1, a1, 0), pt(n, s1, b1, 0), coloreDi(supB));
      if (!acqua && curva) t.quad(pt(n, s0, a0, 0.03), pt(n, s0, a0 + lato * CORDOLO, 0.03), pt(n, s1, a1, 0.03), pt(n, s1, a1 + lato * CORDOLO, 0.03), (i >> 1) % 2 ? P.rosso : P.pietraChiara);
      // muretto di gomme: faccia verso la pista, cima, faccia di fuori
      if (!acqua && muroA(p, ramo, sm, lato)) {
        const c = pietra ? ((i >> 1) % 3 ? P.sabbia : P.sabbiaChiara) : (i >> 1) % 2 ? P.rosso : P.pietraChiara, e0 = b0 + lato * SPESSO, e1 = b1 + lato * SPESSO;
        t.quad(pt(n, s0, b0, 0), pt(n, s0, b0, ALTO_MURO), pt(n, s1, b1, 0), pt(n, s1, b1, ALTO_MURO), c);
        t.quad(pt(n, s0, b0, ALTO_MURO), pt(n, s0, e0, ALTO_MURO), pt(n, s1, b1, ALTO_MURO), pt(n, s1, e1, ALTO_MURO), pietra ? P.pietraChiara : P.neroCaldo);
        t.quad(pt(n, s0, e0, ALTO_MURO), pt(n, s0, e0, 0), pt(n, s1, e1, ALTO_MURO), pt(n, s1, e1, 0), P.roccia);
      }
    }
  }
}

/** Scogliera sotto i tratti alti della principale (non nei giri della morte né nei buchi): dal bordo giù fino al mare. */
function scogliera(t: Tela, p: Pista): void {
  const n = p.n, ultimo = n.chiuso ? n.n : n.n - 1, fuori = p.def.bordo + (p.def.stile === 'acqua' ? 0 : SPESSO);
  for (let i = 0; i < ultimo; i++) {
    const j = n.chiuso ? (i + 1) % n.n : i + 1, s0 = i * n.passo, s1 = s0 + n.passo;
    if (n.ad[i] || n.ad[j] || n.uy[i]! < 0.7 || superficieA(p, -1, s0 + n.passo / 2, 0, 1) === VUOTO) continue;
    for (const lato of [-1, 1]) {
      const a = pt(n, s0, lato * (n.l[i]! + fuori), 0), b = pt(n, s1, lato * (n.l[j]! + fuori), 0);
      if (a[1] < 0.6 && b[1] < 0.6) continue;
      t.quad(a, [a[0], -1.2, a[2]], b, [b[0], -1.2, b[2]], (i >> 2) % 2 ? P.pietraScura : P.roccia);
    }
  }
}

/** Rampe a strisce, tappeti del turbo, creste delle onde, linea del via (e d'arrivo nelle fughe). */
function segni(t: Tela, p: Pista): void {
  const n = p.n, d = p.def;
  for (const r of d.rampe) {
    const lr = campo(n, n.l, r.s);
    for (let k = 0; k < 4; k++) {
      const a = r.s - 4 + k, b = a + 1, ha = (0.8 * k) / 4, hb = (0.8 * (k + 1)) / 4;
      t.quad(pt(n, a, -lr, ha), pt(n, a, lr, ha), pt(n, b, -lr, hb), pt(n, b, lr, hb), k % 2 ? P.neroCaldo : P.giallo);
    }
    t.quad(pt(n, r.s, -lr, 0.8), pt(n, r.s, lr, 0.8), pt(n, r.s, -lr, 0), pt(n, r.s, lr, 0), P.neroCaldo);
  }
  for (const tp of d.turbo) {
    const [l0, l1] = tp.lat, mid = (l0 + l1) / 2, half = (l1 - l0) / 2;
    for (let k = 0; k + 1 <= tp.lungo; k += 1.5) {
      const s = tp.s + k, c = (k / 1.5) % 2 ? P.giallo : P.arancio;
      t.quad(pt(n, s, mid - half, 0.04), pt(n, s, mid - half + 0.6, 0.04), pt(n, s + 0.9, mid, 0.04), pt(n, s + 0.9, mid + 0.6, 0.04), c);
      t.quad(pt(n, s + 0.9, mid - 0.6, 0.04), pt(n, s + 0.9, mid, 0.04), pt(n, s, mid + half - 0.6, 0.04), pt(n, s, mid + half, 0.04), c);
    }
  }
  // creste delle onde: dove la superficie ha le onde, una riga chiara ogni `passo` m
  const ultimo = n.chiuso ? n.n : n.n - 1;
  for (let i = 0; i < ultimo; i++) {
    const s0 = i * n.passo, s1 = s0 + n.passo, l = n.l[i]!;
    for (let j = 0; j < 4; j++) {
      const lat = -l + ((j + 0.5) * 2 * l) / 4, sup = superficieA(p, -1, s0, lat, 1), onde = CORSE.superfici[sup]?.onde;
      if (!onde || Math.floor(s1 / onde.passo) === Math.floor(s0 / onde.passo)) continue;
      t.quad(pt(n, s0, lat - l / 4, 0.02), pt(n, s0, lat + l / 4, 0.02), pt(n, s0 + 0.6, lat - l / 4, 0.02), pt(n, s0 + 0.6, lat + l / 4, 0.02), P.acquaBassa);
    }
  }
  const scacchi = (s: number) => {
    const l = campo(n, n.l, s), k = 8;
    for (let r = 0; r < 2; r++) for (let c = 0; c < k; c++) {
      const a = -l + (c * 2 * l) / k, b = a + (2 * l) / k;
      t.quad(pt(n, s + r * 0.8, a, 0.04), pt(n, s + r * 0.8, b, 0.04), pt(n, s + (r + 1) * 0.8, a, 0.04), pt(n, s + (r + 1) * 0.8, b, 0.04), (r + c) % 2 ? P.neroCaldo : P.pietraChiara);
    }
  };
  scacchi(d.via);
  if (d.tipo === 'fuga') scacchi(d.via + p.arrivo);
}

/** Boe arancioni lungo i bordi delle piste d'acqua (un InstancedMesh). */
function boe(p: Pista): THREE.InstancedMesh | null {
  if (p.def.stile !== 'acqua') return null;
  const n = p.n, ogni = 7, quante = Math.floor(n.len / ogni) * 2;
  const geo = new THREE.CylinderGeometry(0.28, 0.42, 0.9, 6); geo.translate(0, 0.35, 0);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: P.arancio, flatShading: true }), quante);
  const M4 = new THREE.Matrix4(), q = [0, 0, 0] as V3;
  let k = 0;
  for (let s = 0; s + ogni <= n.len && k < quante; s += ogni) for (const lato of [-1, 1]) {
    punto(n, s, lato * (campo(n, n.l, s) + p.def.bordo), 0, q);
    M4.makeTranslation(q[0], q[1], q[2]); m.setMatrixAt(k++, M4);
  }
  m.count = k; m.name = 'corse_boe'; m.castShadow = true;
  return m;
}

export type Pista3d = {
  group: THREE.Group;
  /** Gli eventi firma: si accendono quando il giro in corso arriva a `daGiro`. */
  eventi: { daGiro: number; tipo: string; mesh: THREE.Mesh }[];
  bounds: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };
  /** La scenografia della zona (scena.ts), se la pista ce l'ha: si risolve quando i pezzi del kit sono montati. */
  scena: Promise<{ pezzi: number; teste: number; triangoli: number }> | null;
};

export function creaPista3d(p: Pista): Pista3d {
  const group = new THREE.Group(); group.name = 'pista_' + p.def.id;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const t = new Tela();
  strada(t, p, p.n, -1, p.def.bordo);
  p.rami.forEach((r, i) => strada(t, p, r.n, i, r.def.bordo));
  scogliera(t, p);
  segni(t, p);
  const m = t.mesh(mat, 'corse_nastro'); if (m) group.add(m);
  const b = boe(p); if (b) group.add(b);
  // eventi firma: un velo della superficie nuova appena sopra la strada
  const eventi: Pista3d['eventi'] = [];
  for (const e of p.def.eventi) {
    if (e.superficie === VUOTO) continue;
    const te = new Tela(), n = p.n;
    for (let s = 0; s < n.len; s += n.passo) {
      if (!nelTratto(e, s + n.passo / 2, e.lat ? (e.lat[0] + e.lat[1]) / 2 : 0, n)) continue;
      const l = campo(n, n.l, s), a = e.lat?.[0] ?? -l, z = e.lat?.[1] ?? l;
      te.quad(pt(n, s, a, 0.05), pt(n, s, z, 0.05), pt(n, s + n.passo, a, 0.05), pt(n, s + n.passo, z, 0.05), coloreDi(e.superficie));
    }
    const me = te.mesh(mat, 'corse_evento_' + e.tipo);
    if (me) { me.visible = false; group.add(me); eventi.push({ daGiro: e.daGiro, tipo: e.tipo, mesh: me }); }
  }
  const bb = new THREE.Box3().setFromObject(group); // prima della scenografia: i bordi sono quelli della pista (minimappa, camera)
  const sc = creaScena(p);
  if (sc) group.add(sc.gruppo);
  return { group, eventi, bounds: { x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, y0: bb.min.y, y1: bb.max.y }, scena: sc?.pronta ?? null };
}
