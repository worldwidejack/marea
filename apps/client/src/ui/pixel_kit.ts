// Attrezzi per disegnare a pixel in un ImageData (giochi a schermo delle isole a tema: Arrembaggio, Fuga dalla lava). Solo colori della
// palette (ART_BIBLE §2): ogni colore è un nome di PAL; sfumature solo a puntini (Bayer) tra colori vicini della stessa famiglia.
import { PAL } from './style.ts';

export type Col = keyof typeof PAL;
/** Colori a 32 bit per l'ImageData (little endian: ABGR). */
export const RGBA = {} as Record<Col, number>;
for (const k of Object.keys(PAL) as Col[]) {
  const h = PAL[k], r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  RGBA[k] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Puntino acceso per una sfumatura al livello t (0..1) nel punto (x, y). */
export const dith = (x: number, y: number, t: number): boolean => BAYER[(y & 3) * 4 + (x & 3)]! / 16 < t;
/** Onda triangolare in [−1, 1]. */
export const tri = (u: number): number => Math.abs(((u % 2) + 2) % 2 - 1) * 2 - 1;
/** Numero pseudo-casuale fisso per (a, b): granelli, stelle, crepe. */
export const hash = (a: number, b: number): number => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

// cifre e segni 3×5 per i punti che volano
const FONT: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'], 'x': ['000', '101', '010', '101', '000'],
};

export type Tela = {
  readonly W: number; readonly H: number; readonly buf: Uint32Array;
  px(x: number, y: number, c: number): void;
  rect(x: number, y: number, w: number, h: number, c: number): void;
  /** Sprite: righe di caratteri, `mappa` carattere → colore ('.' = trasparente); flip = specchiato. */
  spr(rows: readonly string[], x: number, y: number, mappa: Record<string, Col>, flip?: boolean): void;
  /** Testo 3×5 centrato in x, con ombra. */
  testo(s: string, x: number, y: number, c: number): void;
  flush(): void;
};

export function createTela(cv: HTMLCanvasElement, W: number, H: number): Tela {
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
  const px = (x: number, y: number, c: number) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
  return {
    W, H, buf, px,
    rect(x0, y0, w, h, c) { x0 = Math.round(x0); y0 = Math.round(y0); for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) buf[y * W + x] = c; },
    spr(rows, x0, y0, mappa, flip = false) {
      x0 = Math.round(x0); y0 = Math.round(y0);
      for (let y = 0; y < rows.length; y++) { const r = rows[y]!; for (let x = 0; x < r.length; x++) { const c = mappa[r[flip ? r.length - 1 - x : x]!]; if (c) px(x0 + x, y0 + y, RGBA[c]); } }
    },
    testo(s, x0, y0, c) {
      x0 = Math.round(x0 - (s.length * 4 - 1) / 2); y0 = Math.round(y0);
      for (const pass of [0, 1]) for (let i = 0; i < s.length; i++) {
        const gl = FONT[s[i]!]; if (!gl) continue;
        for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (gl[y]![x] === '1') {
          if (pass === 0) { px(x0 + i * 4 + x + 1, y0 + y + 1, RGBA.neroCaldo); px(x0 + i * 4 + x, y0 + y + 1, RGBA.neroCaldo); }
          else px(x0 + i * 4 + x, y0 + y, c);
        }
      }
    },
    flush() { g.putImageData(img, 0, 0); },
  };
}
