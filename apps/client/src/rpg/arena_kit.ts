// Kit in codice delle mappe dell'Arena (docs/ARENA.md), finché non ci sono i modelli dng_<stile>_*: solo box e colori della palette, flat
// shading, la forma sta tutta nei blocchi. Ogni stile ha il suo pavimento, i suoi muri (alti e bassi), le colonne e i muretti (celle `grata`):
// - naufragio (Isola del Naufragio): sabbia con conchiglie, scogli muschiosi, palme, assi del relitto; `M` è l'albero maestro con la vela rotta;
// - stelle (Osservatorio delle Stelle): lastre di pietra blu con stelline accese, muri viola con le borchie d'oro, telescopi, siepi di cristallo;
// - forte (Forte del Faro): prato con i sassi, bastioni merlati, cannoni sull'affusto, palizzate; il faro bianco e rosso sopra la torre in mezzo;
// - porto (Porto dei Contrabbandieri): tavolato di legno, magazzini col tetto rosso, pile di barili, il canale d'acqua (si tira sopra, non si passa).
// Più l'erba alta (celle `erba`: una macchia di terra scura e ciuffi di fili appuntiti, in tre verdi), le casse del tesoro e le casseforti
// (nemici fermi dell'Arena, modelli `arena_cassa` e `arena_cassaforte`).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../ui/style.ts';
import { boxPart, flat } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';

/** Gli stili dell'Arena: tutto in vista (niente nebbia), niente scala d'uscita, luci da giorno. */
export const STILI_ARENA: ReadonlySet<string> = new Set(['naufragio', 'stelle', 'forte', 'porto']);

/** Pezzi che una mappa dell'Arena mette al posto di quelli di tutti; `colonne` per lettera della legenda: colonne diverse dalla solita. */
export type KitArena = { pavimento: Part[]; muro: Part[]; muroBasso: Part[]; colonna: Part[]; grata: Part[]; colonne?: Record<string, Part[]> };

/** Un blocco: [w, h, d, x, y0 (base), z, colore, giro attorno a y (rad)?, inclinazione attorno a x (rad)?, acceso?]. */
type B = [number, number, number, number, number, number, string, number?, number?, boolean?];
/** I blocchi uniti per colore: una parte (un disegno) per colore. */
function kit(list: B[]): Part[] {
  const per = new Map<string, THREE.BufferGeometry[]>();
  for (const [w, h, d, x, y0, z, c, ry, rx, acc] of list) {
    const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    g.translate(x, y0, z);
    const k = c + (acc ? '*' : '');
    (per.get(k) ?? per.set(k, []).get(k)!).push(g);
  }
  return [...per].map(([k, gs]) => {
    const geo = mergeGeometries(gs, false)!;
    for (const g of gs) g.dispose();
    return { geo, mat: flat(k.replace('*', ''), k.endsWith('*')) };
  });
}

/** Un filo d'erba: due blocchi che si assottigliano (base larga, punta stretta), appoggiato a y0. */
function filo(x: number, z: number, y0: number, w: number, h: number): THREE.BufferGeometry[] {
  const a = new THREE.BoxGeometry(w, h * 0.58, w).translate(x, y0 + h * 0.29, z);
  const b = new THREE.BoxGeometry(w * 0.55, h * 0.42, w * 0.55).translate(x, y0 + h * 0.58 + h * 0.21, z);
  return [a, b];
}

/** Un ciuffo di erba alta per cella di lato `T` m: la macchia di terra scura e una dozzina di fili alti fino a ~1,1 m (messi a mano, uguali in
 *  ogni cella: la scena li gira di un quarto di giro a caso). Tre parti, una per verde, più la macchia. */
export function erbaParts(T: number, top: number): Part[] {
  // [x, z, altezza, larghezza] in frazioni della cella (−0,5…0,5)
  const FILI: [number, number, number, number][] = [
    [-0.36, -0.34, 1.0, 0.2], [-0.05, -0.4, 0.8, 0.17], [0.32, -0.3, 1.1, 0.2], [-0.4, 0.02, 0.85, 0.17], [-0.12, -0.07, 1.05, 0.22], [0.2, 0.05, 0.8, 0.18],
    [0.42, 0.1, 0.95, 0.17], [-0.3, 0.36, 1.1, 0.2], [0.02, 0.32, 0.9, 0.18], [0.3, 0.4, 1.0, 0.2], [-0.2, 0.18, 0.75, 0.16], [0.14, -0.2, 0.72, 0.16],
  ];
  const verdi = [PAL.erbaScura, PAL.erba, PAL.erbaChiara], gruppi: THREE.BufferGeometry[][] = [[], [], []];
  FILI.forEach(([fx, fz, h, w], i) => gruppi[i % 3]!.push(...filo(fx * T, fz * T, top + 0.04, w, h)));
  const out: Part[] = [boxPart(T * 0.98, 0.04, T * 0.98, top, PAL.erbaScura)];
  gruppi.forEach((g, i) => {
    const geo = mergeGeometries(g, false)!;
    for (const x of g) x.dispose();
    out.push({ geo, mat: flat(verdi[i]!) });
  });
  return out;
}

const P = PAL;
/** Il kit dello stile (null = non è una mappa dell'Arena). `T` = lato della cella, `top` = quota del pavimento. */
export function kitArena(stile: string, T: number, top: number): KitArena | null {
  const h = T / 2, base = (c: string): B => [T, 0.3, T, 0, top - 0.3, 0, c];
  if (stile === 'naufragio') return {
    pavimento: kit([base(P.sabbia), [0.32, 0.03, 0.22, -0.4, top, 0.3, P.sabbiaChiara], [0.2, 0.03, 0.3, 0.45, top, -0.35, P.sabbiaChiara], [0.16, 0.06, 0.12, 0.1, top, 0.55, P.pietraChiara]]),
    // scogli: un masso grande, uno più piccolo sopra spostato, il muschio in cima
    muro: kit([[T, 1.4, T, 0, 0, 0, P.roccia], [T * 0.7, 0.7, T * 0.62, -0.2, 1.4, 0.15, P.pietraScura], [T * 0.4, 0.22, T * 0.4, -0.25, 2.1, 0.1, P.erbaScura], [0.5, 0.4, 0.6, h - 0.2, 1.4, -h + 0.3, P.roccia]]),
    muroBasso: kit([[T, 0.45, T, 0, 0, 0, P.roccia], [T * 0.55, 0.22, T * 0.5, 0.2, 0.45, -0.1, P.pietraScura]]),
    // palma: il tronco a segmenti che piega, le foglie a croce, le noci di cocco
    colonna: kit([[0.42, 0.7, 0.42, 0, 0, 0, P.legno], [0.38, 0.7, 0.38, 0.08, 0.7, 0, P.legnoScuro], [0.34, 0.7, 0.34, 0.18, 1.4, 0, P.legno], [0.3, 0.6, 0.3, 0.3, 2.1, 0, P.legnoScuro],
      [2.4, 0.12, 0.5, 0.3, 2.7, 0, P.erba], [0.5, 0.12, 2.4, 0.3, 2.72, 0, P.erba], [1.7, 0.1, 0.42, 0.3, 2.62, 0, P.erbaScura, Math.PI / 4], [1.7, 0.1, 0.42, 0.3, 2.62, 0, P.erbaScura, -Math.PI / 4],
      [0.2, 0.2, 0.2, 0.42, 2.48, 0.12, P.legnoScuro], [0.2, 0.2, 0.2, 0.2, 2.5, -0.12, P.legnoScuro]]),
    // assi del relitto: la fiancata bassa di legno scuro, il bordo chiaro, una costola
    grata: kit([[T, 0.75, T * 0.3, 0, 0, 0, P.legnoScuro], [T, 0.1, T * 0.36, 0, 0.75, 0, P.legno], [0.18, 1.0, T * 0.4, -0.5, 0, 0, P.legno]]),
    colonne: { M: kit([[0.5, 0.4, 0.5, 0, 0, 0, P.legnoScuro], [0.3, 5.2, 0.3, 0, 0.4, 0, P.legno], [2.6, 0.18, 0.18, 0, 3.9, 0, P.legnoScuro], [2.2, 1.6, 0.06, 0.1, 2.25, 0.12, P.sabbiaChiara], [0.9, 0.7, 0.06, 0.5, 1.6, 0.12, P.sabbiaChiara], [0.5, 0.35, 0.06, 0, 5.6, 0, P.rosso]]) },
  };
  if (stile === 'stelle') return {
    pavimento: kit([base(P.abisso), [T - 0.12, 0.04, T - 0.12, 0, top - 0.02, 0, P.pietraScura], [0.14, 0.03, 0.14, -0.55, top + 0.02, -0.5, P.giallo, 0, 0, true], [0.08, 0.03, 0.08, 0.4, top + 0.02, 0.6, P.sabbiaChiara, 0, 0, true]]),
    // muro viola con la fascia scura in cima e le borchie d'oro accese
    muro: kit([[T, 2.1, T, 0, 0, 0, P.viola], [T + 0.04, 0.22, T + 0.04, 0, 2.1, 0, P.abisso], [0.16, 0.16, 0.16, -0.5, 2.32, -0.5, P.giallo, 0, 0, true], [0.16, 0.16, 0.16, 0.5, 2.32, 0.5, P.giallo, 0, 0, true], [T * 0.6, 0.1, 0.06, 0, 1.2, h + 0.01, P.abisso]]),
    muroBasso: kit([[T, 0.5, T, 0, 0, 0, P.viola], [T + 0.04, 0.12, T + 0.04, 0, 0.5, 0, P.abisso], [0.14, 0.12, 0.14, 0, 0.62, 0, P.giallo, 0, 0, true]]),
    // telescopio d'ottone sul treppiede di pietra, puntato in alto
    colonna: kit([[1.1, 0.35, 1.1, 0, 0, 0, P.pietra], [0.42, 1.0, 0.42, 0, 0.35, 0, P.pietraChiara], [0.5, 0.5, 1.7, 0, 1.15, -0.3, P.arancio, 0, -0.6], [0.56, 0.56, 0.2, 0, 1.75, -1.0, P.giallo, 0, -0.6], [0.3, 0.3, 0.06, 0, 2.05, -1.25, P.acquaBassa, 0, -0.6, true]]),
    // siepe di cristallo: tre punte chiare su una base scura (si tira sopra)
    grata: kit([[T * 0.9, 0.2, T * 0.5, 0, 0, 0, P.abisso], [0.4, 0.9, 0.4, -0.55, 0.2, 0, P.acquaBassa, 0.3, 0, true], [0.32, 0.7, 0.32, 0.1, 0.2, 0.1, P.viola, -0.4, 0, true], [0.36, 0.8, 0.36, 0.6, 0.2, -0.05, P.acquaBassa, 0.7, 0, true]]),
  };
  if (stile === 'forte') return {
    pavimento: kit([base(P.erba), [0.4, 0.04, 0.3, -0.45, top, 0.35, P.erbaChiara], [0.3, 0.04, 0.4, 0.5, top, -0.4, P.erbaChiara], [0.34, 0.08, 0.28, 0.2, top, 0.55, P.pietra]]),
    // bastione: il muro di pietra, la cornice chiara e due merli
    muro: kit([[T, 1.8, T, 0, 0, 0, P.pietra], [T + 0.06, 0.16, T + 0.06, 0, 1.8, 0, P.pietraChiara], [0.7, 0.5, 0.7, -0.6, 1.96, -0.6, P.pietraChiara], [0.7, 0.5, 0.7, 0.6, 1.96, 0.6, P.pietraChiara], [0.5, 0.3, 0.06, 0.3, 0.6, h + 0.01, P.pietraScura]]),
    muroBasso: kit([[T, 0.5, T, 0, 0, 0, P.pietra], [T + 0.06, 0.12, T + 0.06, 0, 0.5, 0, P.pietraChiara]]),
    // cannone sull'affusto di legno, con le ruote e le palle accanto
    colonna: kit([[0.9, 0.45, 1.3, 0, 0, 0, P.legno], [0.14, 0.62, 0.62, -0.52, 0, 0.3, P.legnoScuro], [0.14, 0.62, 0.62, 0.52, 0, 0.3, P.legnoScuro], [0.14, 0.62, 0.62, -0.52, 0, -0.3, P.legnoScuro], [0.14, 0.62, 0.62, 0.52, 0, -0.3, P.legnoScuro],
      [0.42, 0.42, 1.7, 0, 0.5, 0.25, P.neroCaldo, 0, -0.12], [0.5, 0.5, 0.18, 0, 0.42, -0.55, P.pietraScura], [0.26, 0.26, 0.26, 0.6, 0, -0.75, P.neroCaldo], [0.26, 0.26, 0.26, 0.8, 0, -0.55, P.neroCaldo]]),
    // palizzata: tre pali appuntiti e la traversa
    grata: kit([[0.3, 1.0, 0.3, -0.6, 0, 0, P.legno], [0.3, 1.1, 0.3, 0, 0, 0, P.legno], [0.3, 0.95, 0.3, 0.6, 0, 0, P.legno], [0.18, 0.2, 0.18, -0.6, 1.0, 0, P.legnoChiaro], [0.18, 0.2, 0.18, 0, 1.1, 0, P.legnoChiaro], [0.18, 0.2, 0.18, 0.6, 0.95, 0, P.legnoChiaro], [T, 0.14, 0.16, 0, 0.55, 0.18, P.legnoScuro]]),
  };
  if (stile === 'porto') return {
    // tavolato: tre assi per cella (il verso lo tiene la scena), chiodi scuri
    pavimento: kit([base(P.legnoScuro), [T, 0.06, T / 3 - 0.06, 0, top - 0.04, -T / 3, P.legno], [T, 0.06, T / 3 - 0.06, 0, top - 0.04, 0, P.legnoChiaro], [T, 0.06, T / 3 - 0.06, 0, top - 0.04, T / 3, P.legno], [0.06, 0.02, 0.06, -0.8, top + 0.02, 0, P.neroCaldo], [0.06, 0.02, 0.06, 0.8, top + 0.02, -T / 3, P.neroCaldo]]),
    // magazzino: le assi scure, la trave chiara, il tetto rosso che sporge
    muro: kit([[T, 2.0, T, 0, 0, 0, P.legnoScuro], [T + 0.04, 0.14, T + 0.04, 0, 1.1, 0, P.legno], [T + 0.3, 0.3, T + 0.3, 0, 2.0, 0, P.rosso], [T * 0.5, 0.16, T * 0.5, 0, 2.3, 0, P.rosso]]),
    muroBasso: kit([[T, 0.5, T, 0, 0, 0, P.legnoScuro], [T + 0.04, 0.12, T + 0.04, 0, 0.5, 0, P.legno]]),
    // pila di barili coi cerchi di ferro e una cassa accanto
    colonna: kit([[0.8, 0.95, 0.8, -0.35, 0, 0, P.legno], [0.84, 0.1, 0.84, -0.35, 0.2, 0, P.pietraScura], [0.84, 0.1, 0.84, -0.35, 0.7, 0, P.pietraScura],
      [0.75, 0.9, 0.75, 0.45, 0, 0.3, P.legno], [0.79, 0.1, 0.79, 0.45, 0.6, 0.3, P.pietraScura], [0.75, 0.85, 0.75, 0, 0.95, 0.1, P.legnoChiaro], [0.79, 0.1, 0.79, 0, 1.4, 0.1, P.pietraScura], [0.7, 0.6, 0.7, 0.4, 0, -0.55, P.legnoChiaro]]),
    // il canale: l'acqua sopra il tavolato, con le creste chiare (si tira sopra, non si passa)
    grata: kit([[T, 0.1, T, 0, top - 0.02, 0, P.acqua], [T * 0.5, 0.03, 0.12, -0.3, top + 0.08, -0.4, P.acquaBassa], [T * 0.4, 0.03, 0.12, 0.4, top + 0.08, 0.35, P.acquaBassa]]),
  };
  return null;
}

/** Il faro sopra la torre del Forte (in mezzo alla mappa): anelli bianchi e rossi, la lanterna accesa, il tetto; basso, per non coprire chi gli passa dietro. */
export function faroParts(): Part[] {
  const list: B[] = [];
  for (let k = 0; k < 4; k++) list.push([2.6 - k * 0.25, 0.9, 2.6 - k * 0.25, 0, k * 0.9, 0, k % 2 ? P.rosso : P.pietraChiara]);
  list.push([2.2, 0.18, 2.2, 0, 3.6, 0, P.pietraScura], [1.2, 0.8, 1.2, 0, 3.78, 0, P.giallo, 0, 0, true], [1.6, 0.4, 1.6, 0, 4.58, 0, P.rosso], [0.7, 0.35, 0.7, 0, 4.98, 0, P.rosso]);
  return kit(list);
}

/** Le casse del tesoro (Sopravvivenza) e le casseforti (Rapinatori): nemici fermi, modelli in codice. null = non è uno dei loro. */
export function formaArena(model: string): THREE.Object3D | null {
  const parti = model === 'arena_cassa'
    ? kit([[1.0, 0.7, 0.8, 0, 0, 0, P.legnoChiaro], [1.04, 0.12, 0.84, 0, 0.12, 0, P.legno], [1.04, 0.12, 0.84, 0, 0.5, 0, P.legno], [0.1, 0.72, 0.84, -0.4, 0, 0, P.legno], [0.1, 0.72, 0.84, 0.4, 0, 0, P.legno], [1.04, 0.16, 0.84, 0, 0.7, 0, P.legnoScuro], [0.26, 0.26, 0.06, 0, 0.36, 0.42, P.rosso], [0.12, 0.12, 0.07, 0, 0.42, 0.43, P.giallo, 0, 0, true]])
    : model === 'arena_cassaforte'
      ? kit([[1.5, 1.5, 1.3, 0, 0.12, 0, P.pietraScura], [1.56, 0.14, 1.36, 0, 0.12, 0, P.neroCaldo], [1.56, 0.14, 1.36, 0, 1.48, 0, P.neroCaldo], [1.1, 1.1, 0.08, 0, 0.32, 0.66, P.pietra], [0.46, 0.46, 0.1, 0, 0.66, 0.7, P.giallo, 0, 0, true], [0.14, 0.14, 0.12, 0, 0.82, 0.74, P.neroCaldo],
        [0.2, 0.12, 0.2, -0.6, 0, -0.5, P.neroCaldo], [0.2, 0.12, 0.2, 0.6, 0, -0.5, P.neroCaldo], [0.2, 0.12, 0.2, -0.6, 0, 0.5, P.neroCaldo], [0.2, 0.12, 0.2, 0.6, 0, 0.5, P.neroCaldo], [0.5, 0.3, 0.5, 0, 1.62, 0, P.giallo]])
      : null;
  if (!parti) return null;
  const g = new THREE.Group(); g.name = model;
  for (const p of parti) { const m = new THREE.Mesh(p.geo, p.mat.clone()); m.name = model; g.add(m); }
  return g;
}
