// Forme degli insetti di Borgo Marea (#445), dei sassi da colpire e degli attrezzi in mano (retino, pala): geometria procedurale
// low-poly coi colori della palette, come gli animali (render/animali_forme.ts). Avanti = −Z, zampe a y = 0 (i volanti: corpo al centro).
// Più grandi del vero (una farfalla ~0,5 m d'apertura): dalla camera diorama devono leggersi. game/insetti.ts le copia ogni frame in
// un'unica mesh (render/pennello.ts). Ogni specie ha le sue forme coi suoi tre colori (insetti.json `colori`), fatte alla prima occhiata.
import * as THREE from 'three';
import type { InsettoDef, InsettoForma } from '@marea/content/insetti.ts';
import { PAL } from '../ui/style.ts';
import { arm, box, forma, mat, mirrorX, pz } from './animali_forme.ts';
import type { Forma, Pezzo } from './animali_forme.ts';

/** Le pose di un insetto: `a`/`b` si alternano (ali su e giù, zampe), `c` è la posa speciale (palla, guscio, chele alzate, pancia in su, foglia che dorme). */
export type FormeInsetto = { a: Forma; b: Forma; c: Forma };
type Col = { c: string; p: string; f: string };
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const lato = (s: 1 | -1, w: number, h: number, d: number) => (s > 0 ? arm(w, h, d) : mirrorX(arm(w, h, d)));

/** Sei zampe sottili ai lati del corpo (lunghe `l`, al punto `y`), sfalsate in `fase` per camminare. */
function zampe(k: Col, n: number, l: number, y: number, z0: number, z1: number, fase: number, colore = k.f): Pezzo[] {
  const out: Pezzo[] = [];
  for (let i = 0; i < n; i++) {
    const z = n === 1 ? z0 : z0 + ((z1 - z0) * i) / (n - 1), sw = (i % 2 ? 1 : -1) * fase;
    for (const s of [1, -1] as const) out.push(pz(lato(s, l, 0.018, 0.018), colore, mat(s * 0.03, y, z + sw * 0.03, 0, s * (0.25 - i * 0.25), s * -0.5)));
  }
  return out;
}
/** Un'ala piatta dalla spalla: `alza` = quanto è su (rad). */
const ala = (s: 1 | -1, w: number, d: number, x: number, y: number, z: number, alza: number, c: string, yaw = 0): Pezzo =>
  pz(lato(s, w, 0.012, d), c, mat(s * x, y, z, 0, s * yaw, s * alza));
const occhi = (y: number, z: number, w: number): Pezzo[] => [-1, 1].map((s) => pz(box(0.03, 0.03, 0.03), PAL.neroCaldo, mat(s * w, y, z)));

function farfalla(k: Col, alza: number, falena: boolean): Pezzo[] {
  const ant: Pezzo[] = [-1, 1].map((s) => pz(box(0.012, 0.012, 0.12), PAL.neroCaldo, mat(s * 0.025, 0.05, -0.15, -0.6, s * 0.3)));
  const w1 = falena ? 0.2 : 0.22, w2 = falena ? 0.16 : 0.15;
  return [
    pz(box(0.04, 0.04, 0.2), k.f, mat(0, 0, 0)), ...ant,
    ...[-1, 1].flatMap((s) => [
      ala(s as 1 | -1, w1, falena ? 0.13 : 0.17, 0.02, 0.01, -0.04, alza, k.c, falena ? 0.35 : 0.15),
      ala(s as 1 | -1, w2, falena ? 0.12 : 0.13, 0.02, 0.005, 0.06, alza * 0.9, k.p, falena ? 0.6 : -0.25),
      pz(lato(s as 1 | -1, 0.06, 0.016, 0.05), k.f, mat(s * 0.02, 0.016, -0.04, 0, s * 0.15, s * alza).multiply(mat(s * 0.11, 0, 0))), // la macchia sull'ala
    ]),
  ];
}
function ape(k: Col, alza: number, grassa: number): Pezzo[] {
  const r = 0.07 * grassa;
  return [
    pz(cyl(r, r * 0.9, 0.08, 7), k.c, mat(0, 0, 0.06, Math.PI / 2)), pz(cyl(r * 0.95, r * 0.5, 0.07, 7), k.p, mat(0, 0, 0.13, Math.PI / 2)),
    pz(cyl(r * 0.9, r, 0.05, 7), k.p, mat(0, 0, 0.0, Math.PI / 2)), pz(box(r * 1.4, r * 1.3, 0.06), k.c, mat(0, 0, -0.06)),
    pz(box(0.07, 0.065, 0.05), PAL.neroCaldo, mat(0, 0, -0.11)),
    ...[-1, 1].map((s) => ala(s as 1 | -1, 0.13, 0.07, 0.03, r * 0.9, -0.02, alza, k.f, 0.2)),
  ];
}
function coleottero(k: Col, fase: number, corno: number, largo = 1): Pezzo[] {
  return [
    pz(box(0.17 * largo, 0.08, 0.2), k.c, mat(0, 0.07, 0.02)), pz(box(0.13 * largo, 0.05, 0.16), k.c, mat(0, 0.12, 0.03)),
    pz(box(0.012, 0.13, 0.19), PAL.neroCaldo, mat(0, 0.09, 0.02)), // la riga tra le elitre
    pz(box(0.1, 0.06, 0.07), k.p, mat(0, 0.06, -0.11)), pz(box(0.06, 0.04, 0.04), k.p, mat(0, 0.05, -0.16)),
    ...[[-0.04, 0.0], [0.045, 0.06], [-0.03, 0.09], [0.04, -0.02]].map(([x, z]) => pz(box(0.03, 0.02, 0.03), k.f, mat(x!, 0.15, z!))),
    ...(corno ? [pz(box(0.025, 0.025, corno), k.f, mat(0, 0.12, -0.12 - corno / 2, 0.35)), pz(box(0.02, 0.02, corno * 0.6), k.f, mat(0, 0.08, -0.15, -0.3))] : []),
    ...zampe(k, 3, 0.1, 0.05, -0.08, 0.08, fase, PAL.neroCaldo),
  ];
}
function formica(k: Col, fase: number): Pezzo[] {
  return [
    pz(box(0.07, 0.06, 0.09), k.c, mat(0, 0.05, 0.08)), pz(box(0.04, 0.04, 0.06), k.p, mat(0, 0.05, 0.0)), pz(box(0.06, 0.05, 0.05), k.c, mat(0, 0.06, -0.06)),
    ...[-1, 1].map((s) => pz(box(0.01, 0.01, 0.07), k.c, mat(s * 0.02, 0.09, -0.1, -0.5, s * 0.4))),
    ...zampe(k, 3, 0.07, 0.04, -0.02, 0.04, fase, k.c),
  ];
}
function ragno(k: Col, fase: number, chele: boolean): Pezzo[] {
  return [
    pz(box(0.12, 0.09, 0.13), k.c, mat(0, 0.08, 0.06)), pz(box(0.08, 0.06, 0.08), k.p, mat(0, 0.06, -0.04)),
    pz(box(0.05, 0.02, 0.05), k.f, mat(0, 0.13, 0.06)),
    ...zampe(k, 4, 0.14, 0.06, -0.06, 0.04, fase, k.p),
    ...(chele ? [-1, 1].map((s) => pz(box(0.04, 0.03, 0.08), k.p, mat(s * 0.05, 0.05, -0.12, 0, s * -0.4))) : []),
  ];
}
function scorpione(k: Col, fase: number, alzate: boolean): Pezzo[] {
  const coda: Pezzo[] = [];
  let y = 0.06, z = 0.1, a = 0.3;
  for (let i = 0; i < 5; i++) { coda.push(pz(box(0.05, 0.05, 0.07), k.p, mat(0, y, z, -a))); y += Math.sin(a) * 0.065; z += Math.cos(a) * 0.065; a += 0.42; }
  coda.push(pz(box(0.035, 0.07, 0.035), k.f, mat(0, y + 0.02, z - 0.02, 0.6)));
  const ch = alzate ? 0.55 : 0;
  return [
    pz(box(0.13, 0.06, 0.18), k.c, mat(0, 0.05, 0.0)), ...coda,
    ...[-1, 1].flatMap((s) => [pz(lato(s as 1 | -1, 0.1, 0.03, 0.03), k.c, mat(s * 0.05, 0.05 + ch * 0.08, -0.09, 0, s * 0.9, s * ch)),
      pz(box(0.06, 0.035, 0.08), k.f, mat(s * 0.13, 0.06 + ch * 0.14, -0.17))]),
    ...zampe(k, 4, 0.1, 0.04, -0.05, 0.07, fase, k.c),
  ];
}
function segmenti(k: Col, n: number, w: number, fase: number, peli: boolean, zampette: boolean): Pezzo[] {
  const out: Pezzo[] = [];
  for (let i = 0; i < n; i++) {
    const z = -0.06 * (n / 2) + i * 0.06, y = 0.04 + Math.sin(i * 1.2 + fase * 3) * 0.012, c = i === 0 ? k.p : i % 2 ? k.c : k.p;
    out.push(pz(box(w, w * 0.8, 0.065), c, mat(0, y, z)));
    if (peli) out.push(pz(box(w * 0.5, 0.03, 0.03), k.f, mat(0, y + w * 0.5, z)));
    if (zampette) for (const s of [1, -1] as const) out.push(pz(lato(s, 0.05, 0.012, 0.012), k.f, mat(s * w * 0.4, 0.02, z + (i % 2 ? fase : -fase) * 0.02, 0, 0, s * -0.4)));
  }
  out.push(...occhi(0.06, -0.06 * (n / 2) - 0.03, w * 0.3));
  return out;
}
function porcellino(k: Col, fase: number, palla: boolean): Pezzo[] {
  if (palla) return [pz(new THREE.DodecahedronGeometry(0.09, 0), k.c, mat(0, 0.09, 0)), pz(box(0.19, 0.02, 0.03), k.f, mat(0, 0.12, 0, 0.5)), pz(box(0.19, 0.02, 0.03), k.f, mat(0, 0.12, 0.04, 1.2))];
  const out: Pezzo[] = [];
  for (let i = 0; i < 5; i++) out.push(pz(box(0.15 - Math.abs(i - 2) * 0.02, 0.07 - Math.abs(i - 2) * 0.008, 0.045), i % 2 ? k.p : k.c, mat(0, 0.05, -0.1 + i * 0.045)));
  return [...out, ...zampe(k, 3, 0.06, 0.02, -0.06, 0.06, fase, k.f), ...[-1, 1].map((s) => pz(box(0.01, 0.01, 0.06), k.f, mat(s * 0.03, 0.05, -0.15, 0, s * 0.4)))];
}
function chiocciola(k: Col, fase: number, chiusa: boolean): Pezzo[] {
  const guscio: Pezzo[] = [pz(cyl(0.1, 0.1, 0.07, 9), k.c, mat(0, 0.12, 0.03, 0, 0, Math.PI / 2)), pz(cyl(0.06, 0.06, 0.075, 8), k.f, mat(0, 0.13, 0.03, 0, 0, Math.PI / 2)), pz(cyl(0.025, 0.025, 0.08, 6), k.c, mat(0, 0.14, 0.035, 0, 0, Math.PI / 2))];
  if (chiusa) return guscio.map((g) => ({ ...g, m: mat(0, -0.06, 0).multiply(g.m) }));
  return [...guscio, pz(box(0.07, 0.04, 0.26 + fase * 0.02), k.p, mat(0, 0.02, -0.02)), ...[-1, 1].map((s) => pz(box(0.012, 0.07, 0.012), k.p, mat(s * 0.025, 0.07, -0.14, -0.3)))];
}
function cavalletta(k: Col, fase: number, salto: number): Pezzo[] {
  return [
    pz(box(0.06, 0.06, 0.24), k.c, mat(0, 0.07, 0.02)), pz(box(0.065, 0.075, 0.06), k.p, mat(0, 0.08, -0.12)),
    pz(box(0.07, 0.015, 0.2), k.f, mat(0, 0.105, 0.04)),
    ...[-1, 1].flatMap((s) => [pz(box(0.02, 0.02, 0.18), k.p, mat(s * 0.045, 0.1 - salto * 0.04, 0.08, 0.5 - salto * 0.6)), pz(box(0.012, 0.012, 0.16), k.c, mat(s * 0.05, 0.04, 0.13, -0.4 + salto * 0.5))]),
    ...zampe(k, 2, 0.07, 0.05, -0.1, -0.02, fase, k.p),
    ...[-1, 1].map((s) => pz(box(0.008, 0.008, 0.14), k.c, mat(s * 0.02, 0.12, -0.2, -0.4, s * 0.3))),
  ];
}
function mantide(k: Col, fase: number, guarda: boolean): Pezzo[] {
  return [
    pz(box(0.05, 0.05, 0.22), k.c, mat(0, 0.07, 0.08)), pz(box(0.035, 0.16, 0.04), k.p, mat(0, 0.13, -0.05, guarda ? -0.1 : 0.3)),
    pz(box(0.08, 0.05, 0.04), k.c, mat(0, 0.22, -0.08, 0, guarda ? 0.5 : 0)), ...occhi(0.23, -0.1, 0.035),
    ...[-1, 1].map((s) => pz(box(0.02, 0.1, 0.02), k.f, mat(s * 0.03, 0.15, -0.11, 0.6))),
    ...zampe(k, 2, 0.1, 0.05, 0.02, 0.12, fase, k.p),
  ];
}
function foglia(k: Col, fase: number, sveglia: boolean): Pezzo[] {
  const out: Pezzo[] = [pz(box(0.16, 0.02, 0.26), k.c, mat(0, 0.03, 0)), pz(box(0.1, 0.022, 0.16), k.p, mat(0, 0.032, 0.0)), pz(box(0.012, 0.03, 0.3), k.f, mat(0, 0.04, 0))];
  return sveglia ? [...out, ...zampe(k, 3, 0.09, 0.03, -0.08, 0.08, fase, k.p), ...occhi(0.05, -0.13, 0.02)] : out;
}
function libellula(k: Col, alza: number): Pezzo[] {
  return [
    pz(box(0.04, 0.04, 0.34), k.c, mat(0, 0, 0.12)), pz(box(0.07, 0.06, 0.09), k.p, mat(0, 0, -0.06)), pz(box(0.09, 0.06, 0.05), k.f, mat(0, 0.01, -0.12)),
    ...[-1, 1].flatMap((s) => [ala(s as 1 | -1, 0.3, 0.05, 0.02, 0.03, -0.08, alza, PAL.pietraChiara, -0.1), ala(s as 1 | -1, 0.27, 0.05, 0.02, 0.03, -0.0, -alza * 0.6, PAL.acquaBassa, 0.15)]),
  ];
}
function cicala(k: Col, alza: number, ali: boolean): Pezzo[] {
  return [
    pz(box(0.11, 0.08, 0.2), k.c, mat(0, 0.06, 0.02)), pz(box(0.13, 0.06, 0.06), k.p, mat(0, 0.07, -0.09)), ...occhi(0.08, -0.12, 0.06),
    ...[-1, 1].map((s) => (ali ? ala(s as 1 | -1, 0.22, 0.09, 0.03, 0.1, 0.0, alza, k.f, 0.2) : pz(box(0.06, 0.015, 0.26), k.f, mat(s * 0.035, 0.11, 0.06, 0, s * -0.12)))),
    ...zampe(k, 3, 0.07, 0.04, -0.07, 0.06, 0, k.p),
  ];
}
function forbicina(k: Col, fase: number): Pezzo[] {
  return [
    ...segmenti(k, 4, 0.06, fase, false, false),
    ...[-1, 1].map((s) => pz(box(0.015, 0.015, 0.09), k.f, mat(s * 0.02, 0.05, 0.16, 0, s * 0.35))),
    ...zampe(k, 3, 0.06, 0.03, -0.06, 0.02, fase, k.p),
  ];
}
function astuccio(k: Col): Pezzo[] {
  return [
    pz(cyl(0.05, 0.035, 0.2, 6), k.c, mat(0, 0, 0)), ...[0, 1, 2].map((i) => pz(box(0.012, 0.18, 0.012), k.p, mat(Math.cos(i * 2.1) * 0.045, -0.02, Math.sin(i * 2.1) * 0.045, 0.1, 0, 0.12))),
    pz(box(0.04, 0.05, 0.04), k.f, mat(0, -0.12, 0)),
  ];
}
function grillotalpa(k: Col, fase: number): Pezzo[] {
  return [
    pz(box(0.09, 0.07, 0.2), k.c, mat(0, 0.05, 0.04)), pz(box(0.1, 0.08, 0.08), k.p, mat(0, 0.06, -0.09)),
    ...[-1, 1].map((s) => pz(box(0.05, 0.03, 0.05), k.f, mat(s * 0.07, 0.03, -0.14 + fase * 0.02, 0, s * 0.5))),
    ...zampe(k, 2, 0.07, 0.04, 0.0, 0.1, fase, k.p),
  ];
}

function pezzi(f: InsettoForma, k: Col, posa: 'a' | 'b' | 'c', chele: boolean): Pezzo[] {
  const su = posa === 'a' ? 0.55 : -0.25, fase = posa === 'a' ? 1 : -1, c = posa === 'c';
  switch (f) {
    case 'farfalla': return farfalla(k, c ? 1.2 : su, false);
    case 'falena': return farfalla(k, c ? 1.2 : su * 0.8, true);
    case 'ape': return ape(k, c ? 0.2 : su, 1);
    case 'bombo': return ape(k, c ? 0.2 : su * 0.7, 1.45);
    case 'libellula': return libellula(k, c ? 0 : su * 0.6);
    case 'lucciola': return farfalla({ c: k.p, p: k.p, f: k.c }, c ? 0.2 : su, true).map((x) => ({ ...x, m: mat(0, 0, 0, 0, 0, 0, 0.6).multiply(x.m) }));
    case 'coleottero': return coleottero(k, c ? 0 : fase, 0);
    case 'ercole': return coleottero(k, c ? 0 : fase, 0.22, 1.25).map((x) => ({ ...x, m: mat(0, 0, 0, 0, 0, 0, 1.25).multiply(x.m) }));
    case 'cimice': return coleottero(k, c ? 0 : fase, 0, 1.3);
    case 'cicala': return cicala(k, su, !c && posa === 'a');
    case 'formica': return formica(k, fase);
    case 'ragno': return ragno(k, fase, chele);
    case 'scorpione': return scorpione(k, c ? 0 : fase, c);
    case 'bruco': return segmenti(k, 6, 0.07, fase, true, false);
    case 'centopiedi': return segmenti(k, 9, 0.05, fase, false, true);
    case 'porcellino': return porcellino(k, fase, c);
    case 'chiocciola': return chiocciola(k, fase, c);
    case 'cavalletta': return cavalletta(k, fase, c ? 1 : 0);
    case 'mantide': return mantide(k, fase, c);
    case 'foglia': return foglia(k, fase, !c);
    case 'forbicina': return forbicina(k, fase);
    case 'astuccio': return astuccio(k);
    case 'grillotalpa': return grillotalpa(k, fase);
  }
}
const cache = new Map<string, FormeInsetto>();
/** Le tre pose della specie, coi suoi colori (chiavi di PAL). */
export function formeInsetto(d: InsettoDef): FormeInsetto {
  const hit = cache.get(d.id);
  if (hit) return hit;
  const pal = PAL as Record<string, string>, [c, p, f] = d.colori.map((x) => pal[x] ?? PAL.pietra) as [string, string, string], k = { c, p, f };
  const chele = d.id === 'pseudoscorpione'; // il ragno con le chele da scorpione
  const out = { a: forma(pezzi(d.forma, k, 'a', chele)), b: forma(pezzi(d.forma, k, 'b', chele)), c: forma(pezzi(d.forma, k, 'c', chele)) };
  cache.set(d.id, out);
  return out;
}

/** Ombra tonda sotto chi vola (il retino prende sull'ombra, non sul corpo che oscilla in alto). */
export const OMBRA = forma([pz(cyl(0.16, 0.16, 0.01, 8), PAL.roccia, mat(0, 0, 0))]);
/** Il lume della lucciola: prende il colore del canale 1 (game/insetti.ts lo disegna nella mesh che brilla). */
export const LUME = forma([pz(new THREE.DodecahedronGeometry(0.07, 0), 1, mat(0, 0, 0))]);
/** Il filo del ragno: un metro di seta (si scala in altezza). */
export const FILO = forma([pz(box(0.012, 1, 0.012).translate(0, 0.5, 0), PAL.pietraChiara, mat(0, 0, 0))]);
/** Il nido delle vespe caduto dall'albero. */
export const NIDO = forma([pz(new THREE.DodecahedronGeometry(0.2, 0), PAL.sabbia, mat(0, 0.18, 0, 0, 0, 0, 1)), pz(cyl(0.12, 0.16, 0.06, 7), PAL.legnoChiaro, mat(0, 0.3, 0)), pz(cyl(0.05, 0.05, 0.05, 6), PAL.neroCaldo, mat(0, 0.08, -0.17, Math.PI / 2))]);
/** Una foglia che cade dall'albero scosso. */
export const FOGLIA_CADE = forma([pz(box(0.16, 0.02, 0.1), PAL.erbaScura, mat(0, 0, 0)), pz(box(0.08, 0.025, 0.05), PAL.erba, mat(0.02, 0, 0))]);
/** Un sasso del Borgo (~1 m, basso): due massi accostati, pietra con la cima chiara. */
export const SASSO = forma([
  pz(new THREE.DodecahedronGeometry(0.5, 0), PAL.pietraScura, mat(0, 0.22, 0, 0.3, 0.4, 0).scale(new THREE.Vector3(1.1, 0.62, 0.9))),
  pz(new THREE.DodecahedronGeometry(0.3, 0), PAL.pietra, mat(0.38, 0.16, 0.22, 0.7, 0.1, 0.3).scale(new THREE.Vector3(1, 0.7, 1))),
  pz(new THREE.DodecahedronGeometry(0.22, 0), PAL.pietraChiara, mat(-0.12, 0.43, -0.05, 0.2, 0.9, 0).scale(new THREE.Vector3(1.2, 0.45, 1))),
]);
/** Il retino in mano: asta di legno con impugnatura, ghiera e telaio con sacca in rete chiara (rivolta all'indietro su +Z). */
export const RETINO = forma([
  // pomello e impugnatura in legno scuro
  pz(box(0.048, 0.03, 0.048), PAL.legnoScuro, mat(0, 0.015, 0)),
  pz(box(0.042, 0.24, 0.042), PAL.legnoScuro, mat(0, 0.15, 0)),
  // asta principale in legno chiaro
  pz(box(0.036, 0.76, 0.036), PAL.legnoChiaro, mat(0, 0.65, 0)),
  // ghiera di metallo e supporti del telaio
  pz(box(0.046, 0.05, 0.046), PAL.pietra, mat(0, 1.045, 0)),
  pz(box(0.02, 0.07, 0.02), PAL.pietra, mat(-0.04, 1.08, 0, 0, 0, -0.4)),
  pz(box(0.02, 0.07, 0.02), PAL.pietra, mat(0.04, 1.08, 0, 0, 0, 0.4)),
  // telaio del cerchio (metallo)
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return pz(box(0.165, 0.025, 0.025), PAL.pietra, mat(Math.cos(a) * 0.20, 1.23 + Math.sin(a) * 0.20, 0, 0, 0, a + Math.PI / 2));
  }),
  // bordo in tela del cerchio (sabbia chiara)
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return pz(box(0.168, 0.034, 0.034), PAL.sabbiaChiara, mat(Math.cos(a) * 0.20, 1.23 + Math.sin(a) * 0.20, 0.015, 0, 0, a + Math.PI / 2));
  }),
  // sacca della rete: bocca larga montata sul cerchio a z=0, si estende all'indietro su +Z con piega naturale
  pz(cyl(0.198, 0.188, 0.10, 8), PAL.pietraChiara, mat(0, 1.23, 0.06, -Math.PI / 2)),
  pz(cyl(0.188, 0.115, 0.14, 8), PAL.pietraChiara, mat(0, 1.21, 0.18, -Math.PI / 2)),
  pz(cyl(0.115, 0.04, 0.12, 8), PAL.pietraChiara, mat(0, 1.16, 0.31, -Math.PI / 2)),
  pz(new THREE.DodecahedronGeometry(0.045, 0), PAL.pietraChiara, mat(0, 1.14, 0.37)),
]);
/** La pala in mano (manico all'origine, lama in punta). */
export const PALA = forma([
  pz(box(0.04, 0.95, 0.04).translate(0, 0.47, 0), PAL.legnoChiaro, mat(0, 0, 0)), pz(box(0.14, 0.04, 0.04), PAL.legnoScuro, mat(0, 0.96, 0)),
  pz(box(0.22, 0.26, 0.03), PAL.pietra, mat(0, -0.12, 0)), pz(box(0.18, 0.06, 0.035), PAL.pietraChiara, mat(0, -0.22, 0)),
]);
