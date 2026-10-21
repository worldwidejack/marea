// Arredo del Borgo Marea (#265): i pezzi che tools/borgo_pianta.py sparge tra le case (lampioncini, festoni di lampadine tra le case dei
// vicoli, vaso di fiori e cassetta della posta a ogni porta, siepi, fontana e panchine negli slarghi). Procedurali come le altre decorazioni
// a tema: solo colori della palette (ART_BIBLE §2), facce piatte, pochi triangoli, pivot a terra al centro, −Z avanti (verso la via).
// Sul Porto island.ts li fonde in una geometria per area (più una per le parti accese), quindi 30 cassette costano come una.
// Il file sta in un chunk a parte (island_temi.ts lo carica all'avvio: `borgoPronta`).
import * as THREE from 'three';
import { M, P, merged, painted } from './island_parts.ts';
import { siepe } from './verde.ts';

type G = THREE.BufferGeometry;
export type BorgoProp = 'lampioncino' | 'filo_borgo' | 'cassetta_posta' | 'vaso_fiori' | 'siepe' | 'fontana' | 'panchina';
/** Pezzi con una parte accesa (lanterna, lampadine): la seconda geometria va col materiale non illuminato. */
export const BORGO_GLOW = new Set<string>(['lampioncino', 'filo_borgo']);

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const otto = (r: number) => new THREE.OctahedronGeometry(r, 0);
const FIORI = [P.rosso, P.giallo, P.viola, P.pietraChiara, P.arancio];

function costruisci(kind: BorgoProp): { b: G[]; l: G[] } {
  const b: G[] = [], l: G[] = [];
  switch (kind) {
    case 'lampioncino': {
      // palo di ferro scuro col braccio ricurvo e la lanterna gialla, alto quanto il primo piano delle case
      b.push(painted(cyl(0.16, 0.2, 0.3, 6), P.neroCaldo, M(0, 0.15, 0)));
      b.push(painted(cyl(0.06, 0.08, 2.9, 5), P.neroCaldo, M(0, 1.6, 0)));
      b.push(painted(box(0.62, 0.06, 0.06), P.neroCaldo, M(0.28, 3.02, 0)));
      b.push(painted(box(0.3, 0.06, 0.3), P.neroCaldo, M(0.55, 2.94, 0)), painted(new THREE.ConeGeometry(0.26, 0.24, 4), P.neroCaldo, M(0.55, 3.06, 0, 0, Math.PI / 4, 0)));
      l.push(painted(box(0.22, 0.3, 0.22), P.giallo, M(0.55, 2.74, 0)));
      break;
    }
    case 'filo_borgo': {
      // filo di lampadine tra due case di fronte (lungo X, ~4 m), appeso a 3 m: pende un po' in mezzo
      const yAt = (x: number) => 3.1 - 0.35 * (1 - (x / 2.1) * (x / 2.1));
      for (let i = 0; i < 6; i++) {
        const x0 = -2.1 + i * 0.7, x1 = x0 + 0.7, y0 = yAt(x0), y1 = yAt(x1);
        b.push(painted(box(0.72, 0.03, 0.03), P.neroCaldo, M((x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, Math.atan2(y1 - y0, x1 - x0))));
      }
      for (let i = 0; i < 7; i++) { const x = -1.8 + i * 0.6; l.push(painted(otto(0.09), [P.giallo, P.arancio, P.pietraChiara][i % 3]!, M(x, yAt(x) - 0.12, 0))); }
      break;
    }
    case 'cassetta_posta': {
      // palo di legno con la cassetta rossa e la bandierina gialla
      b.push(painted(box(0.1, 0.9, 0.1), P.legnoScuro, M(0, 0.45, 0)));
      b.push(painted(box(0.34, 0.26, 0.46), P.rosso, M(0, 1.0, 0)), painted(box(0.36, 0.06, 0.48), P.legnoScuro, M(0, 1.15, 0)));
      b.push(painted(box(0.03, 0.22, 0.03), P.neroCaldo, M(0.19, 1.15, 0.1)), painted(box(0.03, 0.1, 0.14), P.giallo, M(0.19, 1.22, 0.04)));
      break;
    }
    case 'vaso_fiori': {
      // vaso di coccio con un cespo e i fiori
      b.push(painted(cyl(0.22, 0.16, 0.36, 6), P.legnoChiaro, M(0, 0.18, 0)), painted(cyl(0.25, 0.25, 0.06, 6), P.arancio, M(0, 0.38, 0)));
      b.push(painted(otto(0.28), P.erbaScura, M(0, 0.55, 0, 0, 0.4, 0, 1, 0.7, 1)));
      for (let i = 0; i < 4; i++) { const a = i * 1.7; b.push(painted(box(0.1, 0.1, 0.1), FIORI[i % FIORI.length]!, M(Math.cos(a) * 0.17, 0.7 + (i % 2) * 0.05, Math.sin(a) * 0.17, 0, a, 0))); }
      break;
    }
    case 'siepe': b.push(siepe()); break; // un tratto di siepe a ciuffi lungo X (render/verde.ts)
    case 'fontana': {
      // vasca ottagonale di pietra, colonnina e coppa con l'acqua
      b.push(painted(cyl(1.5, 1.6, 0.5, 8), P.pietra, M(0, 0.25, 0)), painted(cyl(1.25, 1.25, 0.06, 8), P.acqua, M(0, 0.45, 0)));
      b.push(painted(cyl(0.2, 0.26, 1.2, 6), P.pietraChiara, M(0, 0.9, 0)), painted(cyl(0.6, 0.3, 0.3, 8), P.pietraChiara, M(0, 1.55, 0)));
      b.push(painted(cyl(0.48, 0.48, 0.04, 8), P.acquaBassa, M(0, 1.69, 0)), painted(cyl(0.08, 0.12, 0.45, 5), P.acquaBassa, M(0, 1.9, 0)));
      break;
    }
    case 'panchina': {
      // panchina di legno con le gambe di ferro, seduta verso −Z
      b.push(painted(box(1.6, 0.08, 0.5), P.legnoChiaro, M(0, 0.48, 0)), painted(box(1.6, 0.36, 0.07), P.legno, M(0, 0.8, 0.24, -0.15, 0, 0)));
      for (const s of [-1, 1]) b.push(painted(box(0.08, 0.48, 0.5), P.neroCaldo, M(s * 0.68, 0.24, 0)));
      break;
    }
  }
  return { b, l };
}

/** Corpo del pezzo (materiale illuminato, colori per vertice). */
export function propBorgo(kind: BorgoProp): G {
  const { b, l } = costruisci(kind);
  for (const g of l) g.dispose();
  return merged(b);
}
/** Parte accesa, null se il pezzo non ne ha. */
export function propBorgoGlow(kind: BorgoProp): G | null {
  const { b, l } = costruisci(kind);
  for (const g of b) g.dispose();
  return l.length ? merged(l) : null;
}
