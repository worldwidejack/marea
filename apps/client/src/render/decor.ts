// Decorazioni del lotto (decor.json, comprate dal Mercante del Porto #63): modello glTF del manifest se c'è, altrimenti segnaposto
// procedurale a colori di palette (come propGeometry in island_parts.ts). Si scarica con import() solo quando un'isola ha decorazioni.
import * as THREE from 'three';
import { DECOR } from '@marea/content';
import type { Loader } from './loader.ts';
import { M, P as PI, merged, painted, propGeometry } from './island_parts.ts';
import type { PropKind } from './island_parts.ts';

const PROP_DI: Record<string, PropKind> = { lanterna: 'lanterna', barile: 'barile', cassa: 'cassa', palma: 'palma', torii: 'torii', insegna_neon: 'insegna_neon' };
/** Palette dei prop + le due acque (ART_BIBLE §2). */
const P = { ...PI, acqua: '#3FB9C9', acquaBassa: '#7FE3E0' } as const;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);

/** Segnaposto di una decorazione: pivot a terra al centro, davanti verso −Z, dentro una cella da 2 m. */
export function decorGeometry(id: string): THREE.BufferGeometry {
  const k = PROP_DI[id];
  if (k) return propGeometry(k);
  const p: THREE.BufferGeometry[] = [];
  switch (id) {
    case 'panchina':
      p.push(painted(box(1.4, 0.08, 0.45), P.legnoChiaro, M(0, 0.45, 0)), painted(box(1.4, 0.35, 0.06), P.legnoChiaro, M(0, 0.7, 0.22)));
      for (const x of [-0.6, 0.6]) p.push(painted(box(0.08, 0.45, 0.4), P.legnoScuro, M(x, 0.22, 0)));
      break;
    case 'fontana':
      p.push(painted(cyl(0.85, 0.9, 0.35, 8), P.pietra, M(0, 0.175, 0)), painted(cyl(0.7, 0.7, 0.04, 8), P.acqua, M(0, 0.34, 0)));
      p.push(painted(cyl(0.12, 0.16, 0.8, 6), P.pietraChiara, M(0, 0.6, 0)), painted(cyl(0.32, 0.22, 0.12, 8), P.pietra, M(0, 1.0, 0)), painted(cyl(0.05, 0.05, 0.25, 4), P.acquaBassa, M(0, 1.15, 0)));
      break;
    case 'statua':
      p.push(painted(box(0.8, 0.5, 0.8), P.pietraScura, M(0, 0.25, 0)), painted(box(0.36, 0.6, 0.26), P.pietra, M(0, 0.8, 0)), painted(box(0.26, 0.28, 0.26), P.pietra, M(0, 1.25, 0)));
      p.push(painted(box(0.5, 0.04, 0.5), P.pietraChiara, M(0, 1.41, 0)), painted(box(0.06, 0.9, 0.06), P.pietraChiara, M(0.25, 1.0, -0.1, 0, 0, -0.35)), painted(box(0.2, 0.1, 0.06), P.pietraChiara, M(0.42, 0.62, -0.1)));
      break;
    case 'faro_mini':
      p.push(painted(cyl(0.3, 0.4, 1.4, 8), P.pietraChiara, M(0, 0.7, 0)), painted(cyl(0.31, 0.36, 0.25, 8), P.rosso, M(0, 0.55, 0)), painted(cyl(0.3, 0.31, 0.25, 8), P.rosso, M(0, 1.1, 0)));
      p.push(painted(cyl(0.22, 0.22, 0.3, 8), P.giallo, M(0, 1.55, 0)), painted(new THREE.ConeGeometry(0.32, 0.3, 8), P.rosso, M(0, 1.85, 0)));
      break;
    case 'bandiera': case 'bandiera_pirata': {
      const pirata = id === 'bandiera_pirata';
      p.push(painted(box(0.08, 2.6, 0.08), P.legnoScuro, M(0, 1.3, 0)), painted(box(0.9, 0.55, 0.03), pirata ? P.neroCaldo : P.rosso, M(0.49, 2.25, 0)));
      if (pirata) p.push(painted(box(0.2, 0.18, 0.04), P.pietraChiara, M(0.49, 2.3, 0)), painted(box(0.36, 0.05, 0.04), P.pietraChiara, M(0.49, 2.12, 0, 0, 0, 0.6)), painted(box(0.36, 0.05, 0.04), P.pietraChiara, M(0.49, 2.12, 0, 0, 0, -0.6)));
      else p.push(painted(box(0.9, 0.12, 0.04), P.sabbiaChiara, M(0.49, 2.25, 0)));
      break;
    }
    case 'cartello_neon':
      p.push(painted(box(0.1, 1.6, 0.1), P.roccia, M(-0.55, 0.8, 0)), painted(box(0.1, 1.6, 0.1), P.roccia, M(0.55, 0.8, 0)), painted(box(1.4, 0.6, 0.1), P.neroCaldo, M(0, 1.5, 0)));
      p.push(painted(box(1.2, 0.08, 0.12), P.cianoNeon, M(0, 1.72, 0)), painted(box(1.2, 0.08, 0.12), P.cianoNeon, M(0, 1.28, 0)), painted(box(0.7, 0.2, 0.12), P.rosaNeon, M(0, 1.5, 0)));
      break;
    case 'ancora':
      p.push(painted(box(0.14, 1.3, 0.14), P.pietraScura, M(0, 0.85, 0)), painted(box(0.6, 0.1, 0.12), P.pietraScura, M(0, 1.3, 0)), painted(new THREE.TorusGeometry(0.14, 0.04, 4, 8), P.pietraScura, M(0, 1.6, 0)));
      p.push(painted(box(1.0, 0.14, 0.14), P.legnoScuro, M(0, 0.25, 0)), painted(box(0.14, 0.4, 0.14), P.legnoScuro, M(-0.47, 0.42, 0, 0, 0, 0.3)), painted(box(0.14, 0.4, 0.14), P.legnoScuro, M(0.47, 0.42, 0, 0, 0, -0.3)));
      p.push(painted(box(0.6, 0.12, 0.6), P.sabbia, M(0, 0.06, 0)));
      break;
    case 'carpa': // koinobori: palo con le carpe di carta al vento
      p.push(painted(box(0.08, 3.0, 0.08), P.legnoChiaro, M(0, 1.5, 0)), painted(cyl(0.1, 0.1, 0.1, 6), P.giallo, M(0, 3.05, 0)));
      p.push(painted(cyl(0.2, 0.08, 1.1, 6), P.rosso, M(0.62, 2.6, 0, 0, 0, Math.PI / 2 + 0.12)), painted(cyl(0.21, 0.21, 0.05, 6), P.sabbiaChiara, M(0.1, 2.66, 0, 0, 0, Math.PI / 2 + 0.12)));
      p.push(painted(cyl(0.17, 0.07, 0.9, 6), P.acqua, M(0.52, 1.95, 0, 0, 0, Math.PI / 2 + 0.2)), painted(box(0.05, 0.06, 0.06), P.neroCaldo, M(0.15, 2.0, -0.15)));
      break;
    case 'lampione_pietra': // tōrō
      p.push(painted(box(0.7, 0.2, 0.7), P.pietraScura, M(0, 0.1, 0)), painted(box(0.24, 0.7, 0.24), P.pietra, M(0, 0.55, 0)), painted(box(0.6, 0.12, 0.6), P.pietra, M(0, 0.96, 0)));
      p.push(painted(box(0.44, 0.38, 0.44), P.pietraChiara, M(0, 1.21, 0)), painted(box(0.24, 0.2, 0.46), P.giallo, M(0, 1.22, 0)), painted(new THREE.ConeGeometry(0.55, 0.35, 4), P.pietraScura, M(0, 1.58, 0, 0, Math.PI / 4, 0)));
      break;
    case 'gong':
      for (const x of [-0.6, 0.6]) p.push(painted(box(0.12, 1.9, 0.12), P.legnoScuro, M(x, 0.95, 0)));
      p.push(painted(box(1.5, 0.12, 0.14), P.rosso, M(0, 1.9, 0)), painted(cyl(0.45, 0.45, 0.06, 10), P.arancio, M(0, 1.1, 0, Math.PI / 2, 0, 0)), painted(cyl(0.18, 0.18, 0.08, 8), P.giallo, M(0, 1.1, 0, Math.PI / 2, 0, 0)));
      p.push(painted(box(0.03, 0.3, 0.03), P.neroCaldo, M(0, 1.7, 0)));
      break;
    case 'bonsai':
      p.push(painted(box(0.7, 0.25, 0.5), P.rosso, M(0, 0.125, 0)), painted(box(0.12, 0.45, 0.12), P.legno, M(0.05, 0.45, 0, 0, 0, -0.3)), painted(box(0.1, 0.3, 0.1), P.legno, M(-0.08, 0.72, 0, 0, 0, 0.5)));
      p.push(painted(new THREE.IcosahedronGeometry(0.28, 0), P.bosco, M(0.18, 0.85, 0, 0, 0, 0, 1.3, 0.6, 1)), painted(new THREE.IcosahedronGeometry(0.22, 0), P.erbaScura, M(-0.25, 0.95, 0.05, 0, 0, 0, 1.3, 0.6, 1)));
      break;
    case 'papera':
      p.push(painted(box(0.9, 0.6, 1.1), P.giallo, M(0, 0.35, 0.1)), painted(box(0.6, 0.55, 0.55), P.giallo, M(0, 0.95, -0.25)), painted(box(0.36, 0.14, 0.3), P.arancio, M(0, 0.9, -0.62)));
      p.push(painted(box(0.08, 0.1, 0.04), P.neroCaldo, M(-0.2, 1.05, -0.53)), painted(box(0.08, 0.1, 0.04), P.neroCaldo, M(0.2, 1.05, -0.53)), painted(box(0.5, 0.3, 0.2), P.giallo, M(0, 0.55, 0.68)));
      break;
    case 'pagoda':
      p.push(painted(box(1.2, 0.2, 1.2), P.pietra, M(0, 0.1, 0)));
      for (const [i, w] of [[0, 1.0], [1, 0.8], [2, 0.6]] as const) {
        const y = 0.2 + i * 0.55;
        p.push(painted(box(w * 0.7, 0.35, w * 0.7), P.rosso, M(0, y + 0.175, 0)), painted(new THREE.ConeGeometry(w * 0.85, 0.22, 4), P.neroCaldo, M(0, y + 0.46, 0, 0, Math.PI / 4, 0)));
      }
      p.push(painted(box(0.05, 0.4, 0.05), P.giallo, M(0, 2.0, 0)));
      break;
    default: // decorazione nuova senza segnaposto: una cassa, così almeno si vede
      return propGeometry('cassa');
  }
  return merged(p);
}

let mat: THREE.MeshLambertMaterial | null = null;
/** Oggetto pronto da posare: modello del manifest se c'è (e si carica), altrimenti il segnaposto. */
export async function decorObject(id: string, loader: Loader): Promise<{ obj: THREE.Object3D; model: string }> {
  const def = DECOR.find((d) => d.id === id);
  if (def && loader.has(def.model)) { try { return { obj: (await loader.load(def.model)).scene, model: def.model }; } catch { /* file rotto: segnaposto */ } }
  mat ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const m = new THREE.Mesh(decorGeometry(id), mat);
  m.castShadow = true; m.receiveShadow = true; m.name = 'decor_' + id;
  return { obj: m, model: 'segnaposto_' + id };
}
