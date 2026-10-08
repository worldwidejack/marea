// La tua barca (#107), pezzi senza three: colori dalla palette (avatar.json `barca`), nome a pixel (font 3×5, maiuscole) e la barchetta
// di profilo per l'anteprima dell'editor e del Mercante. Il nome sta su una targa del colore dello scafo sui due fianchi (game/boat.ts) a
// 32 texel/m (ART_BIBLE: insegne), con un bordo di legno scuro.
import { AVATAR } from '@marea/content';
import type { BarcaLook } from '@marea/protocol';
import { PAL } from '../ui/style.ts';

export const BARCA_COLORI = AVATAR.barca.colori;
/** Colore di un id di avatar.json `barca` (null = 'nessuna' o sconosciuto). */
export const hexBarca = (id: string): string | null => BARCA_COLORI.find((k) => k.id === id)?.hex ?? null;
/** Luminanza percepita 0..1: sopra 0,55 il nome si dipinge scuro, sotto chiaro. */
export function chiaro(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}
export const coloreNome = (scafo: string): string => (chiaro(hexBarca(scafo) ?? PAL.legno) ? PAL.neroCaldo : PAL.sabbiaChiara);

// 3×5, una stringa di 15 bit per lettera (righe dall'alto); i caratteri sono quelli che il server lascia nel nome (sim/economy/barca.ts)
const F: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  '-': '000000111000000', '.': '000000000000010', '!': '010010010000010', '?': '110001010000010', "'": '010010000000000', ' ': '000000000000000',
};
/** Larghezza in pixel del nome (4 per lettera + 1 di aria). */
export const largoNome = (nome: string): number => nome.length * 4 + 1;

/** Disegna `nome` a pixel in (x, y) con `col`, `k` pixel per pixel del font. */
export function scriviPixel(g: CanvasRenderingContext2D, nome: string, x: number, y: number, col: string, k = 1): void {
  g.fillStyle = col;
  [...nome.toUpperCase()].forEach((ch, i) => {
    const bits = F[ch] ?? F['?']!;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (bits[r * 3 + c] === '1') g.fillRect(x + (i * 4 + c) * k, y + r * k, k, k);
  });
}

/** La targa col nome: canvas (4n+3) × 7 px, fondo del colore dello scafo e bordo di legno scuro. */
export function telaNome(nome: string, scafo: string, tela?: HTMLCanvasElement): HTMLCanvasElement {
  const c = tela ?? document.createElement('canvas');
  c.width = largoNome(nome) + 2; c.height = 7;
  const g = c.getContext('2d')!;
  g.fillStyle = PAL.legnoScuro; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = hexBarca(scafo) ?? PAL.legno; g.fillRect(1, 1, c.width - 2, c.height - 2);
  scriviPixel(g, nome, 2, 1, coloreNome(scafo));
  return c;
}

/**
 * Barchetta di profilo (prua a sinistra) per le anteprime: 80×44 px, colori della palette, scafo e vela scelti, nome sul fianco.
 * Ingrandita con CSS (`image-rendering: pixelated`).
 */
export function disegnaBarca(c: HTMLCanvasElement, b: BarcaLook): void {
  c.width = 80; c.height = 44;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 80, 44);
  const r = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const scafo = hexBarca(b.scafo) ?? PAL.legno, vela = b.vela === 'nessuna' ? null : hexBarca(b.vela);
  // acqua
  r(0, 38, 80, 6, PAL.acqua); r(0, 38, 80, 1, PAL.acquaBassa);
  // vela (triangolo dall'albero verso poppa) e albero
  if (vela) {
    r(25, 4, 2, 24, PAL.legnoScuro);
    for (let y = 0; y < 18; y++) r(27, 6 + y, Math.round(((y + 1) / 18) * 26), 1, vela);
    r(26, 24, 30, 1, PAL.legnoScuro);
  }
  // scafo: falchetta, fasciame alto del colore scelto, fasciame basso scuro; prua (sinistra) alta, poppa dritta
  const top = 27, gw = scafo.toUpperCase() === PAL.rosso ? PAL.sabbiaChiara : PAL.rosso;
  for (let x = 4; x < 76; x++) {
    const prua = x < 14 ? Math.round((14 - x) * 0.45) : 0, giu = x < 12 ? Math.round((12 - x) * 0.7) : x > 70 ? Math.round((x - 70) * 0.6) : 0;
    const y0 = top - prua, y1 = 39 - giu;
    r(x, y0, 1, 1, gw); r(x, y0 + 1, 1, Math.max(0, 34 - y0 - 1), scafo); r(x, 34, 1, Math.max(0, y1 - 34), PAL.legnoScuro);
  }
  // remo
  r(58, 30, 16, 1, PAL.legnoChiaro); r(72, 31, 4, 2, PAL.sabbia);
  if (b.nome) {
    const n = b.nome.slice(0, 14), w = largoNome(n) - 1, x = Math.max(14, Math.round(44 - w / 2));
    scriviPixel(g, n, x, 28, coloreNome(b.scafo));
  }
}
