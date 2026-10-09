// I veicoli del motore v2 in 3D, grigi da banco di prova (docs/CORSE.md A6): kart, auto sportiva, carrello della spesa, moto d'acqua,
// gommone, vasca da bagno, ognuno col pilota sopra. I modelli veri (veicoli buffi e animali piloti con l'AI 3D) arrivano con le zone
// (A9). Muso verso −Z, perno a terra, colori della palette, facce piatte.
import * as THREE from 'three';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { kartGeo } from '../render/island_corse.ts';
import { MODELLO, kitPronto, veicoloKit } from './veicoli_kit.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);
const ruota = (parts: THREE.BufferGeometry[], x: number, z: number, r: number, w = 0.3) => {
  parts.push(painted(cyl(r, r, w, 8), P.neroCaldo, M(x, r, z, 0, 0, Math.PI / 2)));
  parts.push(painted(cyl(r * 0.45, r * 0.45, w + 0.02, 6), P.pietra, M(x, r, z, 0, 0, Math.PI / 2)));
};
/** Dove sono gli occhi del pilota di ogni veicolo, [altezza, avanti] in m (per la camera cofano: appena davanti alla visiera, che sennò copre tutto). */
const OCCHI = new Map<string, [number, number]>();
let occhi: [number, number] = [1.37, 0];
let senzaPilota = false;
export const occhio = (id: string): [number, number] => OCCHI.get(id) ?? [1.37, 0];

/** Il pilota seduto (busto, testa col casco, visiera) all'altezza `y`, `z` avanti/indietro. */
function pilota(parts: THREE.BufferGeometry[], colore: string, casco: string, y: number, z = 0.2): void {
  occhi = [y + 0.78, 0.42 - z];
  if (senzaPilota) return; // guida l'avatar MAREA, attaccato dal chiamante
  parts.push(painted(box(0.55, 0.55, 0.4), colore, M(0, y + 0.28, z)));
  parts.push(painted(box(0.46, 0.44, 0.48), casco, M(0, y + 0.75, z - 0.08)));
  parts.push(painted(box(0.4, 0.14, 0.06), P.neroCaldo, M(0, y + 0.77, z - 0.33)));
}

/** `aspetto` = un modello del kit (cs_v_…) al posto di quello del veicolo; `animale` = il pilota animale (cs_p_…) al posto del segnaposto.
 *  Finché il kit non è caricato (o per i veicoli senza modello) si disegnano i segnaposto grigi di sempre. */
export function veicoloGeo(id: string, colore: string, casco: string, aspetto?: string | null, animale?: string | null, avatar = false): THREE.BufferGeometry {
  senzaPilota = avatar;
  try { return veicoloGeo2(id, colore, casco, aspetto, animale, avatar); } finally { senzaPilota = false; }
}
function veicoloGeo2(id: string, colore: string, casco: string, aspetto: string | null | undefined, animale: string | null | undefined, avatar: boolean): THREE.BufferGeometry {
  const modello = aspetto || MODELLO[id];
  if (modello && kitPronto()) {
    const k = veicoloKit(modello, animale ?? null, avatar, (y, z) => { const p: THREE.BufferGeometry[] = []; pilota(p, colore, casco, y, z); return merged(p); });
    if (k) { if (!animale) OCCHI.set(id, k.occhi); return k.geo; } // la camera cofano guarda dagli occhi del giocatore, non dei bot
  }
  const parts: THREE.BufferGeometry[] = [];
  switch (id) {
    case 'auto': {
      parts.push(painted(box(1.7, 0.45, 3.4), colore, M(0, 0.5, 0)));
      parts.push(painted(box(1.75, 0.12, 0.5), P.neroCaldo, M(0, 0.4, -1.65)));
      parts.push(painted(box(1.3, 0.42, 1.4), P.acquaProfonda, M(0, 0.93, 0.25))); // abitacolo coi vetri
      parts.push(painted(box(1.32, 0.08, 1.2), colore, M(0, 1.17, 0.3)));
      parts.push(painted(box(1.8, 0.1, 0.4), colore, M(0, 1.05, 1.6))); // alettone
      parts.push(painted(box(1.0, 0.06, 0.6), P.pietraChiara, M(0, 0.74, -1.0))); // numero sul cofano
      for (const [x, z] of [[-0.85, -1.1], [0.85, -1.1], [-0.85, 1.1], [0.85, 1.1]] as const) ruota(parts, x, z, 0.36, 0.32);
      pilota(parts, colore, casco, 0.5, 0.35);
      break;
    }
    case 'carrello': {
      // cestello di fil di ferro (sbarre chiare su fondo scuro), maniglia rossa, quattro rotelle; il pilota ci sta dentro
      parts.push(painted(box(1.1, 0.08, 1.7), P.pietra, M(0, 0.32, 0)));
      for (const s of [-1, 1]) {
        parts.push(painted(box(0.06, 0.8, 1.7), P.pietraChiara, M(s * 0.55, 0.72, 0)));
        for (let k = 0; k < 5; k++) parts.push(painted(box(0.08, 0.82, 0.05), P.pietra, M(s * 0.56, 0.72, -0.8 + k * 0.4)));
      }
      parts.push(painted(box(1.1, 0.8, 0.06), P.pietraChiara, M(0, 0.72, -0.85)));
      parts.push(painted(box(1.1, 0.9, 0.06), P.pietraChiara, M(0, 0.77, 0.85)));
      parts.push(painted(box(1.2, 0.1, 0.1), P.rosso, M(0, 1.28, 1.0))); // maniglia
      for (const [x, z] of [[-0.45, -0.7], [0.45, -0.7], [-0.45, 0.7], [0.45, 0.7]] as const) ruota(parts, x, z, 0.14, 0.1);
      pilota(parts, colore, casco, 0.45, 0.15);
      break;
    }
    case 'moto_acqua': {
      parts.push(painted(box(1.0, 0.4, 2.6), colore, M(0, 0.25, 0.1))); // scafo
      parts.push(painted(box(0.7, 0.3, 0.8), colore, M(0, 0.32, -1.35, 0.35, 0, 0))); // prua che sale
      parts.push(painted(box(0.5, 0.25, 1.2), P.neroCaldo, M(0, 0.55, 0.35))); // sella
      parts.push(painted(box(0.9, 0.08, 0.12), P.neroCaldo, M(0, 0.95, -0.45))); // manubrio
      parts.push(painted(box(0.1, 0.4, 0.1), P.roccia, M(0, 0.75, -0.45)));
      parts.push(painted(box(1.02, 0.1, 2.0), P.pietraChiara, M(0, 0.08, 0.2))); // fascia bianca sul fianco
      pilota(parts, colore, casco, 0.55, 0.3);
      break;
    }
    case 'gommone': {
      for (const s of [-1, 1]) parts.push(painted(cyl(0.32, 0.32, 3.0, 8), P.arancio, M(s * 0.75, 0.32, 0, Math.PI / 2, 0, 0)));
      parts.push(painted(cyl(0.32, 0.32, 1.5, 8), P.arancio, M(0, 0.32, -1.45, 0, 0, Math.PI / 2))); // prua
      parts.push(painted(box(1.3, 0.12, 2.8), P.roccia, M(0, 0.12, 0.05)));
      parts.push(painted(box(0.5, 0.7, 0.45), P.neroCaldo, M(0, 0.45, 1.55))); // motore fuoribordo
      parts.push(painted(box(0.6, 0.12, 0.5), colore, M(0, 0.35, 0.5)));
      pilota(parts, colore, casco, 0.3, 0.6);
      break;
    }
    case 'vasca': {
      // vasca da bagno bianca coi piedini dorati a zampa, il rubinetto dietro; il pilota fa il bagno
      parts.push(painted(box(1.2, 0.7, 2.2), P.pietraChiara, M(0, 0.55, 0)));
      parts.push(painted(box(1.0, 0.1, 2.0), P.acquaBassa, M(0, 0.86, 0))); // l'acqua dentro
      parts.push(painted(box(1.3, 0.12, 2.3), P.pietraChiara, M(0, 0.92, 0))); // bordo
      for (const [x, z] of [[-0.45, -0.85], [0.45, -0.85], [-0.45, 0.85], [0.45, 0.85]] as const) parts.push(painted(box(0.18, 0.3, 0.18), P.giallo, M(x, 0.15, z)));
      parts.push(painted(box(0.12, 0.4, 0.12), P.pietra, M(0, 1.15, 1.05)));
      parts.push(painted(box(0.12, 0.1, 0.3), P.pietra, M(0, 1.33, 0.95)));
      pilota(parts, colore, casco, 0.6, 0.2);
      break;
    }
    default: { // kart
      parts.push(kartGeo(colore));
      pilota(parts, colore, casco, 0.57, 0.2);
    }
  }
  OCCHI.set(id, occhi);
  return merged(parts);
}
