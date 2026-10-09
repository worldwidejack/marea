// Isola dei Templari (docs/TEMPLARI.md §3) nell'arcipelago: decorazioni procedurali della chiesa templare in rovina (rotonda come il Santo
// Sepolcro, presbiterio e abside, tetto crollato), delle case diroccate del borgo, delle tombe e croci del cimitero e delle tende dei
// pirati. Sull'Isola della Tempesta, sotto il faro, il relitto della nave templare e lo scheletro col biglietto (lo sblocco, §2; il calice
// lo disegna game/templari.ts finché non lo prendi). Solo colori della palette, facce piatte. Pivot a terra; la chiesa ha il centro della
// rotonda nel pivot e il portale verso −X.
import * as THREE from 'three';
import { M, P, merged, painted } from './island_parts.ts';
import type { TemaProp } from './island_temi.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
/** Raggio della rotonda e distanza del portale dal pivot (il posto ENTRA sta qui davanti, game/templari.ts). */
export const CHIESA = { raggio: 5.5, portale: 6.6 } as const;
/** Altezze dei conci del muro (rovina): fisse, così la chiesa è uguale per tutti. */
const ROVINA = [4.6, 5.2, 3.6, 4.9, 2.8, 4.4, 5.4, 3.9, 4.8, 2.4, 4.1, 5.0, 3.3, 4.7, 5.3, 3.7];

function chiesa(parts: THREE.BufferGeometry[]): void {
  const R = CHIESA.raggio, N = ROVINA.length;
  // basamento e pavimento
  parts.push(painted(new THREE.CylinderGeometry(R + 0.6, R + 0.8, 0.4, 16), P.pietraScura, M(0, 0.2, 0)));
  parts.push(painted(box(9, 0.4, 8.2), P.pietraScura, M(8.4, 0.2, 0)));
  // rotonda: un concio per lato, alti a caso come un muro crollato; il portale a ovest (−X)
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, h = ROVINA[i]!;
    if (Math.abs(a - Math.PI) < 0.25) continue; // portale
    if (a < 0.5 || a > Math.PI * 2 - 0.5) continue; // verso il presbiterio: aperto
    const x = Math.cos(a) * R, z = Math.sin(a) * R, ry = -a - Math.PI / 2;
    parts.push(painted(box(2.25, h, 0.8), i % 3 ? P.pietra : P.pietraChiara, M(x, h / 2 + 0.3, z, 0, ry, 0)));
    parts.push(painted(box(2.3, 0.3, 0.9), P.pietraScura, M(x, 1.0, z, 0, ry, 0))); // zoccolo
    if (h > 4.2) parts.push(painted(box(0.5, 1.1, 0.85), P.neroCaldo, M(x * 0.99, h - 1.4, z * 0.99, 0, ry, 0))); // finestrella
  }
  // portale ad arco: stipiti, architrave e la porta scura
  for (const s of [-1, 1]) parts.push(painted(box(0.9, 4.2, 1.1), P.pietraChiara, M(-R - 0.1, 2.4, s * 1.5)));
  parts.push(painted(box(1.1, 0.9, 3.9), P.pietraChiara, M(-R - 0.1, 4.6, 0)));
  parts.push(painted(box(0.2, 3.2, 2.1), P.neroCaldo, M(-R + 0.2, 1.9, 0)));
  // giro di colonne dentro la rotonda
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, rr = 2.8, hh = i % 3 === 1 ? 2.2 : 4.2;
    parts.push(painted(new THREE.CylinderGeometry(0.32, 0.38, hh, 6), P.pietraChiara, M(Math.cos(a) * rr, hh / 2 + 0.4, Math.sin(a) * rr)));
  }
  // presbiterio: due muri lunghi rotti e l'abside
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const hh = [4.2, 3.4, 4.6, 2.6][(k + (s > 0 ? 1 : 0)) % 4]!;
      parts.push(painted(box(2.1, hh, 0.8), k % 2 ? P.pietra : P.pietraChiara, M(5.2 + k * 2.1, hh / 2 + 0.3, s * 3.8)));
    }
    parts.push(painted(box(0.9, 4.8, 1.0), P.pietraChiara, M(4.3, 2.7, s * 3.8))); // contrafforte
  }
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i + 0.5) * (Math.PI / 6), r = 3.6, hh = [3.8, 4.4, 2.9, 4.6, 3.6, 4.1][i]!;
    parts.push(painted(box(1.95, hh, 0.8), P.pietra, M(13.4 + Math.cos(a) * r, hh / 2 + 0.3, Math.sin(a) * r, 0, -a - Math.PI / 2, 0)));
  }
  // altare maggiore con la tovaglia bianca e la croce rossa
  parts.push(painted(box(1.2, 1.1, 2.4), P.pietraChiara, M(14.2, 0.95, 0)));
  parts.push(painted(box(1.25, 0.12, 2.5), P.sabbiaChiara, M(14.2, 1.55, 0)));
  parts.push(painted(box(0.14, 1.6, 0.14), P.rosso, M(14.6, 2.3, 0)));
  parts.push(painted(box(0.14, 0.14, 0.8), P.rosso, M(14.6, 2.7, 0)));
  // travi del tetto crollato: qualcuna ancora in bilico, le altre a terra
  for (const [x, y, z, rx, ry, rz] of [[1.2, 0.9, -1.8, 0.2, 0.6, 0.3], [-1.6, 0.6, 2.2, 0, -0.9, 0.1], [6.8, 3.1, 0, 0.1, 0, 0.55], [9.6, 1.0, 1.4, 0, 0.4, 0.1]] as const)
    parts.push(painted(box(5.2, 0.35, 0.35), P.legnoScuro, M(x, y, z, rx, ry, rz)));
  for (const [x, z, s] of [[2.5, 2.8, 0.6], [-2.8, -1.4, 0.5], [7.4, -2.2, 0.55], [11.2, 2.4, 0.45]] as const)
    parts.push(painted(new THREE.DodecahedronGeometry(s, 0), P.pietra, M(x, s * 0.6 + 0.4, z, 0.3, x, 0.2)));
  // campanile mozzo a nord-ovest della rotonda, con lo stendardo bianco e nero (il Baussant) strappato
  parts.push(painted(box(2.6, 8.5, 2.6), P.pietra, M(-3.6, 4.25, -5.0)));
  parts.push(painted(box(2.8, 0.4, 2.8), P.pietraScura, M(-3.6, 8.6, -5.0)));
  parts.push(painted(box(0.8, 1.4, 2.7), P.neroCaldo, M(-3.6, 7.4, -5.0)));
  parts.push(painted(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 4), P.legnoScuro, M(-3.6, 10.4, -5.0)));
  parts.push(painted(box(0.05, 0.7, 1.4), P.sabbiaChiara, M(-3.6, 11.5, -4.3)));
  parts.push(painted(box(0.05, 0.7, 1.4), P.neroCaldo, M(-3.6, 10.8, -4.3, 0.15, 0, 0)));
}

function casa(parts: THREE.BufferGeometry[]): void {
  // muri di pietra con l'angolo crollato, tetto di coppi a metà, porta e finestre buie
  parts.push(painted(box(4.2, 2.8, 3.2), P.pietra, M(0, 1.4, 0)));
  parts.push(painted(box(1.6, 1.4, 1.2), P.pietra, M(1.4, 0.7, 1.2))); // pezzo di muro caduto
  parts.push(painted(box(4.4, 0.25, 3.4), P.pietraScura, M(0, 0.12, 0)));
  parts.push(painted(new THREE.CylinderGeometry(0.01, 2.6, 1.5, 4, 1), P.legnoScuro, M(-0.7, 3.5, 0, 0, Math.PI / 4, 0, 0.8, 1, 1.25)));
  parts.push(painted(box(0.9, 1.6, 0.1), P.neroCaldo, M(-0.8, 0.8, -1.62)));
  for (const x of [0.6, 1.5]) parts.push(painted(box(0.5, 0.55, 0.1), P.neroCaldo, M(x, 1.9, -1.62)));
  parts.push(painted(box(2.4, 0.18, 0.18), P.legno, M(1.2, 2.9, 0.4, 0.2, 0.3, 0.5))); // trave che sporge
}

function tomba(parts: THREE.BufferGeometry[]): void {
  parts.push(painted(box(0.95, 0.28, 1.9), P.pietraScura, M(0, 0.14, 0.15)));
  parts.push(painted(box(0.85, 0.12, 1.7), P.bosco, M(0, 0.33, 0.15))); // erba sulla fossa
  parts.push(painted(box(0.75, 1.0, 0.16), P.pietra, M(0, 0.5, -0.85, -0.08, 0, 0.05)));
  parts.push(painted(box(0.1, 0.5, 0.05), P.roccia, M(0, 0.72, -0.94)));
  parts.push(painted(box(0.34, 0.1, 0.05), P.roccia, M(0, 0.82, -0.94)));
}

function croce(parts: THREE.BufferGeometry[]): void {
  parts.push(painted(box(0.8, 0.4, 0.8), P.pietraScura, M(0, 0.2, 0)));
  parts.push(painted(box(0.26, 2.4, 0.26), P.pietra, M(0, 1.6, 0, 0, 0, 0.08)));
  parts.push(painted(box(1.2, 0.26, 0.26), P.pietra, M(0.07, 2.2, 0, 0, 0, 0.08)));
}

function tenda(parts: THREE.BufferGeometry[]): void {
  // tenda dei pirati: tela a strisce su quattro pali, un falò spento davanti
  parts.push(painted(new THREE.CylinderGeometry(0.02, 2.2, 2.4, 4, 1), P.sabbiaChiara, M(0, 1.2, 0, 0, Math.PI / 4, 0)));
  parts.push(painted(new THREE.CylinderGeometry(0.01, 2.25, 0.5, 4, 1, true), P.rosso, M(0, 0.45, 0, 0, Math.PI / 4, 0)));
  parts.push(painted(new THREE.CylinderGeometry(0.05, 0.06, 2.9, 4), P.legnoScuro, M(0, 1.45, 0)));
  parts.push(painted(box(0.8, 1.2, 0.05), P.ombraCalda, M(0, 0.6, -1.4)));
  for (const [x, z] of [[0.9, -2.4], [1.3, -2.1], [0.6, -2.0]] as const) parts.push(painted(box(0.6, 0.12, 0.12), P.legnoScuro, M(x, 0.08, z, 0, x * 2, 0)));
}

function relittoTemplare(parts: THREE.BufferGeometry[]): void {
  // la nave della flotta di La Rochelle spaccata sugli scogli: prua inclinata, poppa col castello, albero spezzato con la vela bianca e la
  // croce rossa, una cassa aperta che luccica (il tesoro che non è mai arrivato)
  for (const [x, z, s] of [[0.6, 0.4, 1.2], [-1.8, 1.4, 0.9], [2.2, -1.6, 0.8], [-0.4, -2.6, 1.0]] as const) parts.push(painted(new THREE.DodecahedronGeometry(s, 0), P.roccia, M(x, s * 0.4, z, 0.4, x, 0.3)));
  parts.push(painted(box(2.0, 1.1, 4.4), P.legnoScuro, M(0.2, 0.8, 1.6, 0.18, 0, 0.32)));
  for (let i = 0; i < 4; i++) parts.push(painted(box(0.14, 1.6, 0.14), P.ombraCalda, M(-0.75, 1.5, 0.2 + i * 0.9, 0, 0, 0.5)));
  parts.push(painted(box(1.8, 1.0, 3.2), P.legnoScuro, M(0.1, 0.9, -2.6, -0.12, 0.2, -0.28)));
  parts.push(painted(box(1.9, 1.2, 1.3), P.legno, M(0.0, 1.9, -3.6, -0.12, 0.2, -0.28))); // castello di poppa
  parts.push(painted(box(2.05, 0.18, 4.5), P.legno, M(0.2, 1.38, 1.6, 0.18, 0, 0.32)));
  parts.push(painted(cyl(0.12, 0.16, 4.2), P.legnoScuro, M(1.4, 2.0, 0.2, 0.2, 0, 0.9)));
  parts.push(painted(box(0.05, 1.8, 2.0), P.pietraChiara, M(2.1, 1.7, 0.6, 0.15, 0.1, 0.9)));
  parts.push(painted(box(0.06, 1.0, 0.24), P.rosso, M(2.08, 1.72, 0.6, 0.15, 0.1, 0.9)));
  parts.push(painted(box(0.06, 0.24, 1.0), P.rosso, M(2.08, 1.75, 0.6, 0.15, 0.1, 0.9)));
  parts.push(painted(box(0.9, 0.5, 0.6), P.legnoScuro, M(-1.6, 0.25, -0.6, 0, 0.5, 0)));
  parts.push(painted(box(0.92, 0.12, 0.62), P.giallo, M(-1.6, 0.52, -0.6, 0, 0.5, 0)));
}

function scheletro(parts: THREE.BufferGeometry[]): void {
  // fra' Guillaume seduto contro lo scoglio: il mantello bianco con la croce rossa ormai stracciato, le ossa, la spada accanto e il
  // biglietto arrotolato nella mano (il calice in grembo lo aggiunge game/templari.ts)
  const osso = P.pietraChiara;
  parts.push(painted(new THREE.DodecahedronGeometry(0.9, 0), P.roccia, M(0, 0.55, 0.75, 0.3, 0.6, 0)));
  parts.push(painted(box(1.1, 0.06, 1.3), P.sabbiaChiara, M(0, 0.04, -0.1, 0, 0.15, 0)));
  parts.push(painted(box(0.12, 0.07, 0.5), P.rosso, M(0.05, 0.08, -0.15, 0, 0.15, 0)));
  parts.push(painted(box(0.4, 0.07, 0.12), P.rosso, M(0.05, 0.08, -0.2, 0, 0.15, 0)));
  parts.push(painted(box(0.36, 0.28, 0.2), osso, M(0, 0.32, 0.12)));            // bacino
  for (let i = 0; i < 4; i++) parts.push(painted(box(0.42 - i * 0.03, 0.05, 0.22), osso, M(0, 0.5 + i * 0.1, 0.18 + i * 0.02, -0.25, 0, 0))); // costole
  parts.push(painted(box(0.06, 0.45, 0.06), osso, M(0, 0.62, 0.24, -0.25, 0, 0))); // spina
  parts.push(painted(box(0.3, 0.3, 0.3), osso, M(0.04, 1.02, 0.34, -0.5, 0.3, 0.25))); // teschio, chino
  parts.push(painted(box(0.07, 0.07, 0.04), P.neroCaldo, M(-0.03, 1.03, 0.18, -0.5, 0.3, 0.25)));
  parts.push(painted(box(0.07, 0.07, 0.04), P.neroCaldo, M(0.1, 1.04, 0.2, -0.5, 0.3, 0.25)));
  for (const s of [-1, 1]) {
    parts.push(painted(box(0.07, 0.07, 0.5), osso, M(s * 0.14, 0.2, -0.25, 0, s * 0.1, 0)));  // femori
    parts.push(painted(box(0.06, 0.06, 0.48), osso, M(s * 0.16, 0.08, -0.7, 0, s * 0.15, 0))); // tibie
    parts.push(painted(box(0.06, 0.06, 0.36), osso, M(s * 0.26, 0.55, 0.05, 0.9, s * 0.2, 0))); // braccia verso il grembo
  }
  parts.push(painted(cyl(0.04, 0.04, 0.22, 5), P.sabbiaChiara, M(0.32, 0.3, -0.2, 0, 0, Math.PI / 2))); // il biglietto arrotolato
  parts.push(painted(box(0.08, 0.04, 1.1), P.pietraScura, M(-0.55, 0.04, -0.3, 0, 0.3, 0)));   // spada
  parts.push(painted(box(0.32, 0.05, 0.06), P.pietraScura, M(-0.62, 0.05, 0.12, 0, 0.3, 0)));
}

export function propTemplari(kind: TemaProp): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'chiesa_templare') chiesa(parts);
  else if (kind === 'relitto_templare') relittoTemplare(parts);
  else if (kind === 'scheletro') scheletro(parts);
  else if (kind === 'casa_rovina') casa(parts);
  else if (kind === 'tomba') tomba(parts);
  else if (kind === 'croce_pietra') croce(parts);
  else tenda(parts);
  return merged(parts);
}

/** Candele sull'altare e un braciere nel portale: si vedono dall'alto (il tetto non c'è più). */
export function propTemplariGlow(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const z of [-0.8, -0.3, 0.3, 0.8]) parts.push(painted(box(0.12, 0.3, 0.12), P.giallo, M(14.0, 1.75, z)));
  parts.push(painted(new THREE.ConeGeometry(0.35, 0.8, 5), P.arancio, M(-4.2, 1.0, 1.6)));
  parts.push(painted(new THREE.ConeGeometry(0.2, 0.55, 4), P.giallo, M(-4.2, 0.95, 1.6)));
  return merged(parts);
}
