// Prova stili (#50): ogni stile cambia acqua, scogli e fiori sulle rive, luce, cielo, foschia, contorni e la palette finale.
// Le palette sono in sRGB: la passata finale (post.ts) porta ogni pixel al colore più vicino, con dithering ordinato tra i due più vicini.
// «gioco» = com'è il gioco oggi (niente palette, acqua e luce del gioco): serve da confronto.

export type StyleId = 'gioco' | 'stampa' | 'tramonto' | 'giorno';
export type Style = {
  id: StyleId; nome: string;
  /** null = nessuna rimappatura (colori del gioco). */
  palette: string[] | null; dither: number;
  /** prima della palette: esposizione, saturazione, contrasto, tinta moltiplicata */
  grade: { exp: number; sat: number; con: number; tint: string };
  paper: number;
  /** contorni: colore dell'inchiostro, quanto lo sostituisce (0 = scurisce il colore), spigoli: >0 schiariti, <0 a inchiostro */
  ink: { col: string; mix: number; crease: number };
  light: { sun: string; sunI: number; elev: number; azim: number; sky: string; ground: string; hemiI: number; amb: string; ambI: number };
  sky: { top: string; mid: string; hor: string; sun: string; glow: string; sunDir: [number, number, number]; sunSize: number; cloud: string; cloudDark: string };
  fog: { col: string; near: number; far: number; max: number };
  /** acqua: 0 = quella del gioco, 1 = stampa, 2 = giorno, 3 = tramonto; colori da riva verso il largo + schiuma + linee */
  water: { mode: number; c: [string, string, string, string]; foam: string; line: string };
  rocks: { n: number; cols: string[] };
  flowers: { n: number; cols: string[]; grass: string; tufts: number };
};

// Endesga 32 (palette pixel art molto usata, colori caldi e saturi): per il giorno
const ENDESGA = ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633', '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e', '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'];
// Stampa giapponese: indaco e blu di Prussia, carta crema, ocra, verde muschio, vermiglio, inchiostro
const UKIYO = ['#1b1d2b', '#1f3b6e', '#2f5f9e', '#5f8fbf', '#9cc0d8', '#f2ead6', '#e3d5b4', '#d9b07a', '#a8774a', '#6b4a33', '#3d5a3a', '#6f8f4e', '#a3b46a', '#c8402e', '#8a8478', '#bdb4a2', '#e9a23b'];
// Tramonto: viole, rosa, aranci, teal, verdi caldi, legni
const SUNSET = ['#1a1424', '#2b1d3a', '#4a2c5a', '#7a3b6b', '#b3546b', '#e07a5f', '#f2a65a', '#f7d08a', '#fff1c1', '#1f4e5f', '#2a7f8c', '#4fb3b3', '#9ee6d8', '#3d5a3a', '#6a8f3f', '#a5b84f', '#5c3b2e', '#8a5a3c', '#c08552', '#6b5f6e', '#a3949a', '#e3b47a', '#c23b3b', '#fff6e0', '#3a5c8c'];

export const STYLES: Style[] = [
  {
    id: 'gioco', nome: 'gioco', palette: null, dither: 0, grade: { exp: 1, sat: 1, con: 1, tint: '#ffffff' }, paper: 0,
    ink: { col: '#000000', mix: 0, crease: 1 },
    light: { sun: '#FFD9A3', sunI: 2.7, elev: 40, azim: 225, sky: '#9FD3FF', ground: '#7A5A3A', hemiI: 1.9, amb: '#A64DFF', ambI: 0.18 },
    sky: { top: '#3FB9C9', mid: '#7FE3E0', hor: '#E8E1D6', sun: '#F5D547', glow: '#F4E3C1', sunDir: [0, -1, 0], sunSize: 0, cloud: '#F4E3C1', cloudDark: '#E8E1D6' },
    fog: { col: '#E8E1D6', near: 35, far: 200, max: 0.8 },
    water: { mode: 0, c: ['#7FE3E0', '#3FB9C9', '#2478A8', '#163F73'], foam: '#E8E1D6', line: '#7FE3E0' },
    rocks: { n: 0, cols: [] }, flowers: { n: 0, cols: [], grass: '#4E9A46', tufts: 0 },
  },
  {
    id: 'stampa', nome: 'stampa giapponese', palette: UKIYO, dither: 0.08, grade: { exp: 1.05, sat: 0.8, con: 1.1, tint: '#fff2dc' }, paper: 1,
    ink: { col: '#1b1d2b', mix: 1, crease: -0.55 },
    light: { sun: '#fff4e0', sunI: 1.6, elev: 55, azim: 225, sky: '#f2ead6', ground: '#a8774a', hemiI: 2.6, amb: '#f2ead6', ambI: 0.25 },
    sky: { top: '#e3d5b4', mid: '#f2ead6', hor: '#f2ead6', sun: '#c8402e', glow: '#e9a23b', sunDir: [-0.62, 0.32, -0.72], sunSize: 4.5, cloud: '#f2ead6', cloudDark: '#9cc0d8' },
    fog: { col: '#e3d5b4', near: 45, far: 220, max: 0.85 },
    water: { mode: 1, c: ['#9cc0d8', '#5f8fbf', '#2f5f9e', '#1f3b6e'], foam: '#f2ead6', line: '#9cc0d8' },
    rocks: { n: 1, cols: ['#3a3a44', '#55534f', '#6b6a66'] }, flowers: { n: 0.15, cols: ['#c8402e', '#f2ead6'], grass: '#3d5a3a', tufts: 0.6 },
  },
  {
    id: 'tramonto', nome: 'tramonto', palette: SUNSET, dither: 0.3, grade: { exp: 1.12, sat: 1.08, con: 1.05, tint: '#fff2e4' }, paper: 0,
    ink: { col: '#2b1d3a', mix: 0.55, crease: 0.5 },
    light: { sun: '#ffd0a0', sunI: 2.7, elev: 26, azim: 255, sky: '#c9a0e0', ground: '#8a6a50', hemiI: 1.7, amb: '#7a3b6b', ambI: 0.22 },
    sky: { top: '#4a2c5a', mid: '#b3546b', hor: '#f2a65a', sun: '#fff1c1', glow: '#f7d08a', sunDir: [-0.62, 0.1, -0.78], sunSize: 3.2, cloud: '#e07a5f', cloudDark: '#7a3b6b' },
    fog: { col: '#e8956a', near: 40, far: 230, max: 0.75 },
    water: { mode: 3, c: ['#9ee6d8', '#4fb3b3', '#2a7f8c', '#1f4e5f'], foam: '#fff1c1', line: '#f2a65a' },
    rocks: { n: 1.2, cols: ['#4a2c5a', '#6b5f6e', '#8a5a3c'] }, flowers: { n: 0.7, cols: ['#e07a5f', '#f7d08a', '#fff1c1', '#b3546b'], grass: '#6a8f3f', tufts: 0.8 },
  },
  {
    id: 'giorno', nome: 'giorno', palette: ENDESGA, dither: 0.22, grade: { exp: 1.14, sat: 1.05, con: 1.05, tint: '#fffaf2' }, paper: 0,
    ink: { col: '#262b44', mix: 0.5, crease: 0.6 },
    light: { sun: '#fff1d0', sunI: 2.9, elev: 48, azim: 210, sky: '#a8dcff', ground: '#8a6a4a', hemiI: 1.8, amb: '#5a6988', ambI: 0.2 },
    sky: { top: '#0099db', mid: '#2ce8f5', hor: '#c0cbdc', sun: '#fee761', glow: '#ffffff', sunDir: [-0.55, 0.25, -0.8], sunSize: 0, cloud: '#ffffff', cloudDark: '#c0cbdc' },
    fog: { col: '#c0cbdc', near: 50, far: 260, max: 0.7 },
    water: { mode: 2, c: ['#2ce8f5', '#0099db', '#0099db', '#124e89'], foam: '#ffffff', line: '#2ce8f5' },
    rocks: { n: 1, cols: ['#8b9bb4', '#c0cbdc', '#5a6988', '#b86f50'] }, flowers: { n: 1, cols: ['#e43b44', '#fee761', '#ffffff', '#f6757a', '#b55088'], grass: '#3e8948', tufts: 1 },
  },
];
