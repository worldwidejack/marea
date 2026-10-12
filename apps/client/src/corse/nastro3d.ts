// La pista del motore v2 in 3D (docs/CORSE.md A11), costruita dal nastro della sim: quello che vedi è quello su cui guidi.
// Ci sono:
// - la strada a fasce colorate per superficie, con la riga di mezzo sull'asfalto, il bordo e i cordoli nelle curve;
// - il muretto di gomme (sulle piste d'acqua le boe), che manca dove la sim non ha il muro;
// - la scogliera sotto i tratti alti, le rampe a strisce, i tappeti del turbo, le creste delle onde, la linea del via;
// - nelle piste miste (il porto) la striscia gialla e nera tra la corsia del molo e quella dell'acqua;
// - gli eventi firma, a parte: si accendono dal loro giro;
// - sulle piste a binari (#228) le rotaie sulle traversine, niente muro; i tratti che crollano (il ponte) stanno a parte e spariscono
//   dal loro giro.
// Grigio da banco di prova: la scenografia vera delle zone arriva con i kit Blender (A9). Facce piatte, colori della palette, doppia
// faccia (i giri della morte si vedono anche da sotto).
import * as THREE from 'three';
import { CORSE } from '@marea/content/corse.ts';
import { campo, dove, punto } from '@marea/sim/corse/nastro.ts';
import type { Nastro } from '@marea/sim/corse/nastro.ts';
import { VUOTO, muroA, nelTratto, rotaieDi, superficieA } from '@marea/sim/corse/pista.ts';
import { rotaiaVicina } from '@marea/sim/corse/binari.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import { P } from '../render/island_parts.ts';
import { creaScena } from './scena.ts';

export const COLORE_SUP: Record<string, string> = {
  asfalto: P.roccia, legno: P.legnoChiaro, erba: P.erba, sabbia: P.sabbia, ghiaccio: P.pietraChiara,
  acqua: P.acqua, acquaBassa: P.acquaBassa, corrente: P.acquaProfonda, container: P.rosso, rotaia: P.ombraCalda,
  terra: P.legno, fango: P.legnoScuro,
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

/** Dove va un pezzo a (s, lat) sulle piste a binari: niente (un buco già dal primo giro), `crollo` (un tratto che crolla con un evento
 *  firma: sta a parte e sparisce dal suo giro) o la tela di sempre. */
function telaDi(t: Tela, crollo: Tela | null, p: Pista, ramo: number, s: number, lat: number): Tela | null {
  if (superficieA(p, ramo, s, lat, 1) === VUOTO) return null;
  return crollo && superficieA(p, ramo, s, lat, 99) === VUOTO ? crollo : t;
}
/** Il tratto a `s` del nastro `ramo` sta sulle rotaie? Piste a binari sempre; ibride (#228) nei tratti agganciati e sui rami a binari. */
const suRotaie = (p: Pista, ramo: number, s: number): boolean =>
  p.def.stile === 'binari' || (ramo >= 0 ? !!p.rami[ramo]!.def.binari : (p.def.agganci ?? []).some((t) => nelTratto(t, s, 0, p.n)));
const SCARTAMENTO = 0.55, TRAVERSA = 0.85;
/** Rotaie e traversine (piste a binari): due rotaie chiare per ogni binario, una traversina di legno ogni 2 m. */
function rotaie(t: Tela, crollo: Tela | null, p: Pista, n: Nastro, ramo: number): void {
  const ultimo = n.chiuso ? n.n : n.n - 1, rot = rotaieDi(p, ramo);
  for (let i = 0; i < ultimo; i++) {
    const s0 = i * n.passo, s1 = s0 + n.passo, sm = s0 + n.passo / 2;
    if (!suRotaie(p, ramo, sm)) continue;
    for (const r of rot) {
      const tl = telaDi(t, crollo, p, ramo, sm, r); if (!tl) continue;
      // le traversine prima di un buco della rotaia sono a strisce gialle e nere: lì si salta
      const salta = [3, 6, 9].some((d) => superficieA(p, ramo, sm + d, r, 1) === VUOTO);
      if (i % 2 === 0) tl.quad(pt(n, s0 + 0.2, r - TRAVERSA, 0.06), pt(n, s0 + 0.2, r + TRAVERSA, 0.06), pt(n, s0 + 0.65, r - TRAVERSA, 0.06), pt(n, s0 + 0.65, r + TRAVERSA, 0.06), salta ? ((i >> 1) % 2 ? P.giallo : P.neroCaldo) : (i >> 1) % 3 ? P.legno : P.legnoChiaro);
      for (const g of [-SCARTAMENTO, SCARTAMENTO]) tl.quad(pt(n, s0, r + g - 0.07, 0.16), pt(n, s0, r + g + 0.07, 0.16), pt(n, s1, r + g - 0.07, 0.16), pt(n, s1, r + g + 0.07, 0.16), P.pietraChiara);
    }
  }
}

/** Strada, bordi, cordoli e muri di un nastro (principale o ramo). Sulle piste a binari: il fondo scuro sotto le traversine, i bordi di
 *  legno, niente cordoli né muro. */
function strada(t: Tela, p: Pista, n: Nastro, ramo: number, bordo: number, crollo: Tela | null = null): void {
  const d = p.def, acqua = d.stile === 'acqua', ultimo = n.chiuso ? n.n : n.n - 1, pietra = muroDiPietra(d.id), giungla = d.zona === 'giungla';
  for (let i = 0; i < ultimo; i++) {
    const s0 = i * n.passo, s1 = s0 + n.passo, sm = s0 + n.passo / 2, binari = suRotaie(p, ramo, sm);
    if (!binari && ramo < 0 && superficieA(p, -1, sm, 0, 1) === VUOTO) continue; // i buchi (sui binari si guarda fascia per fascia)
    const l0 = n.l[i]!, l1 = n.l[n.chiuso ? (i + 1) % n.n : i + 1]!, lm = (l0 + l1) / 2;
    // carreggiata a fasce di ~2 m, colorate con la superficie che c'è (giro 1: gli eventi stanno a parte)
    const nb = Math.max(2, Math.round(lm));
    for (let j = 0; j < nb; j++) {
      const f0 = -1 + (2 * j) / nb, f1 = -1 + (2 * (j + 1)) / nb;
      const sup = superficieA(p, ramo, sm, ((f0 + f1) / 2) * lm, 1);
      // nei giri della morte la strada è arancione a strisce (a testa in giù la luce non la prende: così si legge lo stesso)
      const c = n.ad[i] ? ((i >> 1) % 2 ? P.arancio : P.giallo) : coloreDi(sup);
      const tl = binari ? telaDi(t, crollo, p, ramo, sm, ((f0 + f1) / 2) * lm) : t;
      if (!tl) continue;
      tl.quad(pt(n, s0, f0 * l0, 0), pt(n, s0, f1 * l0, 0), pt(n, s1, f0 * l1, 0), pt(n, s1, f1 * l1, 0), c);
    }
    // riga di mezzo sull'asfalto, a tratti
    if (!acqua && i % 6 < 3 && superficieA(p, ramo, sm, 0, 1) === 'asfalto') t.quad(pt(n, s0, -0.15, 0.02), pt(n, s0, 0.15, 0.02), pt(n, s1, -0.15, 0.02), pt(n, s1, 0.15, 0.02), P.pietraChiara);
    // piste miste: il divisorio a righe gialle e nere tra le corsie (dove finisce l'acqua)
    if (ramo < 0 && d.corsie && i % 2 === 0) {
      const lim = (d.corsie.acqua ?? 0) < (d.corsie.ruote ?? 0) ? -1 : 1, c = (i >> 1) % 2 ? P.giallo : P.neroCaldo;
      t.quad(pt(n, s0, lim - 0.35, 0.1), pt(n, s0, lim + 0.35, 0.1), pt(n, s1, lim - 0.35, 0.1), pt(n, s1, lim + 0.35, 0.1), c);
    }
    // il bordo oltre la carreggiata, e i cordoli dove la pista curva
    const curva = !binari && Math.abs(n.k[i]!) > 0.012;
    for (const lato of [-1, 1]) {
      const supB = superficieA(p, ramo, sm, lato * (lm + bordo / 2), 1);
      const a0 = lato * l0, a1 = lato * l1, b0 = lato * (l0 + bordo), b1 = lato * (l1 + bordo);
      if (bordo > 0) t.quad(pt(n, s0, a0, 0), pt(n, s0, b0, 0), pt(n, s1, a1, 0), pt(n, s1, b1, 0), binari && d.stile !== 'binari' ? P.legnoScuro : coloreDi(supB));
      const cc = pt(n, sm, lato * (lm + CORDOLO / 2), 0);
      if (!acqua && curva && !(p.rami.length && sullAltro(p, ramo, sm, cc[0], cc[1], cc[2]))) t.quad(pt(n, s0, a0, 0.03), pt(n, s0, a0 + lato * CORDOLO, 0.03), pt(n, s1, a1, 0.03), pt(n, s1, a1 + lato * CORDOLO, 0.03), giungla ? ((i >> 1) % 2 ? P.pietra : P.pietraChiara) : (i >> 1) % 2 ? P.rosso : P.pietraChiara);
      // muretto di gomme: faccia verso la pista, cima, faccia di fuori
      const mm = pt(n, sm, lato * (lm + bordo), 0);
      if (!acqua && !binari && muroA(p, ramo, sm, lato) && !(p.rami.length && sullAltro(p, ramo, sm, mm[0], mm[1], mm[2]))) {
        // giungla: una staccionata di tronchi; spiaggia: gomme rosse e bianche (o pietra chiara, prova A/B)
        const c = giungla ? ((i >> 1) % 3 ? P.legno : P.legnoChiaro) : pietra ? ((i >> 1) % 3 ? P.sabbia : P.sabbiaChiara) : (i >> 1) % 2 ? P.rosso : P.pietraChiara, e0 = b0 + lato * SPESSO, e1 = b1 + lato * SPESSO;
        t.quad(pt(n, s0, b0, 0), pt(n, s0, b0, ALTO_MURO), pt(n, s1, b1, 0), pt(n, s1, b1, ALTO_MURO), c);
        t.quad(pt(n, s0, b0, ALTO_MURO), pt(n, s0, e0, ALTO_MURO), pt(n, s1, b1, ALTO_MURO), pt(n, s1, e1, ALTO_MURO), giungla ? P.legnoScuro : pietra ? P.pietraChiara : P.neroCaldo);
        t.quad(pt(n, s0, e0, ALTO_MURO), pt(n, s0, e0, 0), pt(n, s1, e1, ALTO_MURO), pt(n, s1, e1, 0), P.roccia);
      }
    }
  }
}

/** Il punto (x, y, z) sta sulla carreggiata (bordo compreso) di un altro nastro? Ai bivi delle scorciatoie i muri di un nastro non si
 *  disegnano sulla strada dell'altro: sennò si incrociano a X in mezzo alla pista (#258). Per la sim i muri restano dove sono. */
function sullAltro(p: Pista, ramo: number, s: number, x: number, y: number, z: number): boolean {
  const dentro = (n: Nastro, l: number[], bordo: number) => {
    const w = dove(n, x, y, z, -1);
    return (n.chiuso || (w.s > 0.5 && w.s < n.len - 0.5)) && Math.abs(w.lat) < campo(n, l, w.s) + bordo - 0.05 && Math.abs(w.h) < 2;
  };
  if (ramo >= 0) return dentro(p.n, p.n.l, p.def.bordo);
  return p.rami.some((r) => s > r.def.da - 10 && s < r.def.a + 10 && dentro(r.n, r.n.l, r.def.bordo));
}

/** Sotto i binari (#228) niente scogliera: pali di legno ogni 6 m sotto i due bordi, giù fino all'acqua (il ponte tra le cascate). */
function pali(t: Tela, p: Pista): void {
  const n = p.n, ultimo = n.chiuso ? n.n : n.n - 1, L = 0.35;
  for (let i = 0; i < ultimo; i += 6) {
    const s0 = i * n.passo;
    if (n.ad[i] || superficieA(p, -1, s0, 0, 1) === VUOTO || !suRotaie(p, -1, s0)) continue;
    for (const lato of [-1, 1]) {
      const l = lato * (n.l[i]! + p.def.bordo - 0.3), a = pt(n, s0, l - L, 0), b = pt(n, s0, l + L, 0), c = pt(n, s0 + 2 * L, l - L, 0), d = pt(n, s0 + 2 * L, l + L, 0);
      if (a[1] < 0.6) continue;
      for (const [u, v] of [[a, b], [b, d], [d, c], [c, a]] as const) t.quad(u, [u[0], -1.2, u[2]], v, [v[0], -1.2, v[2]], (i / 6) % 2 ? P.legno : P.legnoScuro);
    }
  }
}

/** Scogliera sotto i tratti alti della principale (non nei giri della morte né nei buchi): dal bordo giù fino al mare. */
function scogliera(t: Tela, p: Pista): void {
  pali(t, p);
  if (p.def.stile === 'binari') return;
  const n = p.n, ultimo = n.chiuso ? n.n : n.n - 1, fuori = p.def.bordo + (p.def.stile === 'acqua' ? 0 : SPESSO);
  for (let i = 0; i < ultimo; i++) {
    const j = n.chiuso ? (i + 1) % n.n : i + 1, s0 = i * n.passo, s1 = s0 + n.passo;
    if (n.ad[i] || n.ad[j] || n.uy[i]! < 0.7 || superficieA(p, -1, s0 + n.passo / 2, 0, 1) === VUOTO || suRotaie(p, -1, s0 + n.passo / 2)) continue;
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
  // i tappeti del turbo, anche sui rami (il tunnel della miniera): frecce gialle e arancio
  for (const [nn, lista] of [[n, d.turbo], ...p.rami.map((r) => [r.n, r.def.turbo ?? []] as const)] as const) for (const tp of lista) {
    const [l0, l1] = tp.lat, mid = (l0 + l1) / 2, half = (l1 - l0) / 2;
    for (let k = 0; k + 1 <= tp.lungo; k += 1.5) {
      const s = tp.s + k, c = (k / 1.5) % 2 ? P.giallo : P.arancio;
      t.quad(pt(nn, s, mid - half, 0.2), pt(nn, s, mid - half + 0.6, 0.2), pt(nn, s + 0.9, mid, 0.2), pt(nn, s + 0.9, mid + 0.6, 0.2), c);
      t.quad(pt(nn, s + 0.9, mid - 0.6, 0.2), pt(nn, s + 0.9, mid, 0.2), pt(nn, s, mid + half - 0.6, 0.2), pt(nn, s, mid + half, 0.2), c);
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

/** I segnali della miniera (#228, «avviso prima»): un portale sopra le rotaie ~28 m prima di ogni pericolo, con una luce per rotaia:
 *  freccia verde = libera, X rossa = la rotaia finisce (si cambia rotaia o si salta), freccia gialla = il bivio del tunnel parte da lì.
 *  Sui rami (il tunnel) la luce rossa sta prima del buco da saltare. Le luci degli eventi firma (la rotaia che cede dal 2° giro) sono
 *  a parte e si accendono dal loro giro. Luci = materiale senza ombre, si leggono anche al buio della galleria. */
function segnali(p: Pista): { fissi: Tela; luci: Tela; eventi: { daGiro: number; tipo: string; luci: Tela }[] } {
  const fissi = new Tela(), luci = new Tela(), eventi: { daGiro: number; tipo: string; luci: Tela }[] = [], PRIMA = 28, H = 3.4;
  /** Un pannello quadrato (lato 1,1 m) sopra la rotaia `lat` del nastro `n` a `s`, rivolto verso chi arriva, col simbolo. */
  const pannello = (tl: Tela, n: Nastro, s: number, lat: number, tipo: 'ok' | 'stop' | 'destra' | 'sinistra', dh = 0) => {
    const q = (a: number, b: number, c: number, d: number, col: string, z = 0) => tl.quad(pt(n, s - z, lat + a, H + b + dh), pt(n, s - z, lat + c, H + b + dh), pt(n, s - z, lat + a, H + d + dh), pt(n, s - z, lat + c, H + d + dh), col);
    q(-0.55, -0.55, 0.55, 0.55, P.neroCaldo);
    const col = tipo === 'ok' ? P.verdeNeon : tipo === 'stop' ? P.rossoNeon : P.ambraNeon, z = 0.03;
    if (tipo === 'ok') { q(-0.1, -0.4, 0.1, 0.2, col, z); q(-0.35, 0.05, 0.35, 0.25, col, z); q(-0.18, 0.25, 0.18, 0.42, col, z); }
    else if (tipo === 'stop') for (let k = -3; k <= 3; k++) { const u = k * 0.12; q(u - 0.07, u - 0.07, u + 0.07, u + 0.07, col, z); q(-u - 0.07, u - 0.07, -u + 0.07, u + 0.07, col, z); }
    else { const sx = tipo === 'destra' ? 1 : -1; for (let k = -3; k <= 2; k++) { const u = k * 0.12; q(sx * u - 0.08, u - 0.08, sx * u + 0.08, u + 0.08, col, z); } q(sx * 0.12 - 0.08, 0.3, sx * 0.42, 0.42, col, z); q(sx * 0.3, 0.05, sx * 0.42 + 0.0001, 0.42, col, z); }
  };
  /** Il portale: due pali oltre i bordi e la trave. */
  const portale = (n: Nastro, s: number, bordo: number) => {
    const l = campo(n, n.l, s) + bordo * 0.6;
    for (const lato of [-1, 1]) for (const [a, b] of [[-0.15, 0.15]] as const) {
      const x = lato * l;
      fissi.quad(pt(n, s, x + a, -1.5), pt(n, s, x + b, -1.5), pt(n, s, x + a, H + 0.7), pt(n, s, x + b, H + 0.7), P.legnoScuro);
      fissi.quad(pt(n, s + 0.3, x + a, -1.5), pt(n, s + 0.3, x + a, H + 0.7), pt(n, s, x + a, -1.5), pt(n, s, x + a, H + 0.7), P.legno);
    }
    fissi.quad(pt(n, s + 0.02, -l, H + 0.6), pt(n, s + 0.02, l, H + 0.6), pt(n, s + 0.02, -l, H + 0.85), pt(n, s + 0.02, l, H + 0.85), P.legno);
  };
  const n = p.n, rot = rotaieDi(p, -1), fino = (s: number) => (n.chiuso ? ((s % n.len) + n.len) % n.len : Math.max(0, s));
  // i pericoli della principale, in ordine: rotaie rotte (buchi con `lat`), bivi a binari, rotaie che cedono con un evento
  type Per = { s: number; stop: number[]; bivio?: { r: number; lato: 1 | -1 }; ev?: { daGiro: number; tipo: string; stop: number[] } };
  const per: Per[] = [];
  const toccate = (lat: [number, number] | undefined) => rot.map((r, i) => (!lat || (r >= lat[0] && r <= lat[1]) ? i : -1)).filter((i) => i >= 0);
  for (const v of p.def.vuoti) if (v.lat && suRotaie(p, -1, v.da)) per.push({ s: v.da, stop: toccate(v.lat) });
  p.rami.forEach((r) => { if (r.def.binari) { const i = rotaiaVicina(rot, r.latIngresso); per.push({ s: r.def.da, stop: [], bivio: { r: i, lato: r.latIngresso >= 0 ? 1 : -1 } }); } });
  for (const e of p.def.eventi) if (e.superficie === VUOTO && suRotaie(p, -1, e.da)) per.push({ s: e.da, stop: [], ev: { daGiro: e.daGiro, tipo: e.tipo, stop: toccate(e.lat) } });
  for (const x of per) {
    const s = fino(x.s - PRIMA);
    portale(n, s, p.def.bordo);
    rot.forEach((r, i) => pannello(luci, n, s, r, x.stop.includes(i) ? 'stop' : x.bivio?.r === i ? (x.bivio.lato > 0 ? 'destra' : 'sinistra') : 'ok'));
    if (x.ev) { const tl = new Tela(); for (const i of x.ev.stop) pannello(tl, n, s - 0.06, rot[i]!, 'stop'); eventi.push({ daGiro: x.ev.daGiro, tipo: 'segnale_' + x.ev.tipo, luci: tl }); }
  }
  // i rami a binari: la luce rossa prima di ogni buco della rotaia (si salta)
  // nel tunnel niente portale (la camera ci passerebbe dentro): due luci rosse basse ai lati, 18 m prima del buco
  for (const r of p.rami) for (const t of r.def.superfici ?? []) if (t.tipo === VUOTO) {
    const s = Math.max(1, t.da - 18);
    for (const lato of [-1, 1]) {
      const x = lato * (campo(r.n, r.n.l, s) + 0.5);
      fissi.quad(pt(r.n, s, x - 0.08, 0), pt(r.n, s, x + 0.08, 0), pt(r.n, s, x - 0.08, 1.2), pt(r.n, s, x + 0.08, 1.2), P.neroCaldo);
      pannello(luci, r.n, s, x, 'stop', 1.6 - H);
    }
  }
  return { fissi, luci, eventi };
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
  /** Gli eventi firma: si accendono quando il giro in corso arriva a `daGiro` (quelli che `sparisce`, i crolli, si spengono). */
  eventi: { daGiro: number; tipo: string; mesh: THREE.Mesh; sparisce?: boolean }[];
  bounds: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };
  /** La scenografia della zona (scena.ts), se la pista ce l'ha: si risolve quando i pezzi del kit sono montati. */
  scena: Promise<{ pezzi: number; teste: number; triangoli: number }> | null;
};

export function creaPista3d(p: Pista): Pista3d {
  const group = new THREE.Group(); group.name = 'pista_' + p.def.id;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const t = new Tela(), binari = p.def.stile === 'binari' || !!p.def.agganci?.length;
  // il tratto che crolla con un evento firma (il ponte della miniera): a parte, sparisce dal suo giro
  const ev0 = binari ? p.def.eventi.find((e) => e.superficie === VUOTO) : undefined, crollo = ev0 ? new Tela() : null;
  strada(t, p, p.n, -1, p.def.bordo, crollo);
  p.rami.forEach((r, i) => strada(t, p, r.n, i, r.def.bordo));
  if (binari) { rotaie(t, crollo, p, p.n, -1); p.rami.forEach((r, i) => rotaie(t, null, p, r.n, i)); }
  scogliera(t, p);
  segni(t, p);
  const m = t.mesh(mat, 'corse_nastro'); if (m) group.add(m);
  const sg = binari ? segnali(p) : null;
  const matLuci = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const ms = sg?.fissi.mesh(mat, 'corse_segnali'); if (ms) { ms.castShadow = true; group.add(ms); }
  const ml = sg?.luci.mesh(matLuci, 'corse_segnali_luci'); if (ml) group.add(ml);
  const b = boe(p); if (b) group.add(b);
  // eventi firma: un velo della superficie nuova appena sopra la strada
  const eventi: Pista3d['eventi'] = [];
  const mc = ev0 && crollo?.mesh(mat, 'corse_crollo_' + ev0.tipo);
  if (ev0 && mc) { group.add(mc); eventi.push({ daGiro: ev0.daGiro, tipo: ev0.tipo, mesh: mc, sparisce: true }); }
  for (const x of sg?.eventi ?? []) { const me = x.luci.mesh(matLuci, 'corse_segnale_' + x.tipo); if (me) { me.visible = false; group.add(me); eventi.push({ daGiro: x.daGiro, tipo: x.tipo, mesh: me }); } }
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
