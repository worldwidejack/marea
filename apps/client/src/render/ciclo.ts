// Ciclo giorno → tramonto → notte → alba (#53, impostazioni). Solo aspetto: niente sim, niente server. L'ora viene dall'orologio
// (Date.now), quindi chi ha il ciclo acceso vede la stessa ora degli altri. «giorno» = esattamente i colori di oggi del gioco.
// Un giro dura CICLO_MIN minuti; i passaggi sono interpolazioni lineari tra momenti fissi (colori in RGB, gradi del sole).
import * as THREE from 'three';
import { SKY_BANDS } from './sky.ts';
import { WATER_COLORS } from './water.ts';

import { CICLO_MIN } from './viste.ts';

type W = { abisso: string; profonda: string; acqua: string; bassa: string; schiuma: string };
export type Momento = {
  nome: string;
  sun: { elev: number; azim: number; color: string; intensity: number; sky: string; ground: string; hemiI: number; amb: string; ambI: number };
  bands: [string, string, string, string]; water: W; tint: string;
  /** per la passata finale (camera bassa): cielo vicino all'orizzonte, foschia, nuvole */
  sky3: [string, string, string]; fog: string; clouds: [string, string];
};

export const GIORNO: Momento = {
  nome: 'giorno',
  sun: { elev: 40, azim: 225, color: '#FFD9A3', intensity: 2.7, sky: '#9FD3FF', ground: '#7A5A3A', hemiI: 1.9, amb: '#A64DFF', ambI: 0.18 },
  bands: [...SKY_BANDS], water: { ...WATER_COLORS }, tint: '#FFFFFF',
  sky3: ['#3FB9C9', '#7FE3E0', '#E8E1D6'], fog: '#E8E1D6', clouds: ['#F4E3C1', '#E8E1D6'],
};
const TRAMONTO: Momento = {
  nome: 'tramonto',
  sun: { elev: 14, azim: 255, color: '#FFB070', intensity: 2.5, sky: '#C9A0E0', ground: '#7A4A3A', hemiI: 1.4, amb: '#7A3B6B', ambI: 0.3 },
  bands: ['#4A2C5A', '#B3546B', '#E07A5F', '#F2A65A'],
  water: { abisso: '#1A2F55', profonda: '#24577A', acqua: '#2F7F95', bassa: '#5FAFB5', schiuma: '#FFE0B0' }, tint: '#FFD8C0',
  sky3: ['#4A2C5A', '#B3546B', '#F2A65A'], fog: '#E8956A', clouds: ['#E07A5F', '#7A3B6B'],
};
const NOTTE: Momento = {
  nome: 'notte',
  // la «luna»: luce fredda e debole da sud-est, ombre ancora leggibili
  sun: { elev: 50, azim: 140, color: '#9FB8FF', intensity: 0.85, sky: '#2B3A6B', ground: '#1A1424', hemiI: 0.9, amb: '#3A2C6B', ambI: 0.35 },
  bands: ['#0B1030', '#141E48', '#1E2A5A', '#2A3768'],
  water: { abisso: '#0B1430', profonda: '#12224A', acqua: '#1C3A66', bassa: '#2E5A85', schiuma: '#8FA8C8' }, tint: '#4A5888',
  sky3: ['#0B1030', '#141E48', '#1E2A5A'], fog: '#1E2A5A', clouds: ['#2A3768', '#1E2A5A'],
};
const ALBA: Momento = {
  nome: 'alba',
  sun: { elev: 12, azim: 110, color: '#FFC8A0', intensity: 2.1, sky: '#F0B8C8', ground: '#7A5A4A', hemiI: 1.4, amb: '#A64DFF', ambI: 0.22 },
  bands: ['#5F8FBF', '#E8B8C0', '#F5D0A0', '#F2A33A'],
  water: { abisso: '#1F3B6E', profonda: '#3A6FA0', acqua: '#6FA8C8', bassa: '#B8E0E0', schiuma: '#FFE8D8' }, tint: '#FFE4D8',
  sky3: ['#5F8FBF', '#E8B8C0', '#F5D0A0'], fog: '#E8C0B8', clouds: ['#F7D0C0', '#E8B8C0'],
};
// [frazione del giro, momento]: tra due punti si mescola
const KEYS: [number, Momento][] = [[0, GIORNO], [0.52, GIORNO], [0.58, TRAMONTO], [0.64, TRAMONTO], [0.7, NOTTE], [0.86, NOTTE], [0.91, ALBA], [0.96, ALBA], [1, GIORNO]];

/** Frazione del giro [0, 1) per l'istante `ms` (Date.now). */
export function fase(ms: number): number { const p = ms / (CICLO_MIN * 60_000); return p - Math.floor(p); }

const ca = new THREE.Color(), cb = new THREE.Color();
const mixHex = (a: string, b: string, k: number) => '#' + ca.set(a).lerp(cb.set(b), k).getHexString();
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
function mixW(a: W, b: W, k: number): W {
  return { abisso: mixHex(a.abisso, b.abisso, k), profonda: mixHex(a.profonda, b.profonda, k), acqua: mixHex(a.acqua, b.acqua, k), bassa: mixHex(a.bassa, b.bassa, k), schiuma: mixHex(a.schiuma, b.schiuma, k) };
}
function mixM(a: Momento, b: Momento, k: number): Momento {
  if (k <= 0) return a; if (k >= 1) return b;
  const s = a.sun, t = b.sun;
  return {
    nome: k < 0.5 ? a.nome : b.nome,
    sun: { elev: mix(s.elev, t.elev, k), azim: mix(s.azim, t.azim, k), color: mixHex(s.color, t.color, k), intensity: mix(s.intensity, t.intensity, k), sky: mixHex(s.sky, t.sky, k), ground: mixHex(s.ground, t.ground, k), hemiI: mix(s.hemiI, t.hemiI, k), amb: mixHex(s.amb, t.amb, k), ambI: mix(s.ambI, t.ambI, k) },
    bands: a.bands.map((c, i) => mixHex(c, b.bands[i]!, k)) as Momento['bands'], water: mixW(a.water, b.water, k), tint: mixHex(a.tint, b.tint, k),
    sky3: a.sky3.map((c, i) => mixHex(c, b.sky3[i]!, k)) as Momento['sky3'], fog: mixHex(a.fog, b.fog, k), clouds: [mixHex(a.clouds[0], b.clouds[0], k), mixHex(a.clouds[1], b.clouds[1], k)],
  };
}
/** Il momento della giornata alla frazione `f`. */
export function momento(f: number): Momento {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [f0, a] = KEYS[i]!, [f1, b] = KEYS[i + 1]!;
    if (f >= f0 && f <= f1) return a === b ? a : mixM(a, b, (f - f0) / (f1 - f0));
  }
  return GIORNO;
}
