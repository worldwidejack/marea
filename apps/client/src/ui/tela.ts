// Tela a pixel per i giochi a schermo delle isole a tema (Pinguini dei Ghiacci, Carpe koi del Giardino): un ImageData scalato «nearest»
// con primitive a pixel (punto, rettangolo, cerchio, sprite a caratteri, testo 3×5) e solo i colori della palette (ART_BIBLE §2).
// Niente gradienti: i passaggi tra due colori vicini sono a puntini (Bayer 4×4). Finisce nel chunk dei giochi che la usano.
import { PAL } from './style.ts';

export type Col = keyof typeof PAL;
/** Colori a 32 bit per l'ImageData (little endian: ABGR). */
export const RGBA = {} as Record<Col, number>;
for (const k of Object.keys(PAL) as Col[]) {
  const h = PAL[k], r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  RGBA[k] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Vero in una frazione `t` dei pixel, a scacchiera ordinata: per sfumare a puntini tra due colori. */
export const dith = (x: number, y: number, t: number) => BAYER[(y & 3) * 4 + (x & 3)]! / 16 < t;
/** Hash intero di due coordinate (granelli, scintille fisse). */
export const hash2 = (a: number, b: number) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
/** Onda triangolare in [−1, 1] (al posto del seno: più «pixel»). */
export const tri = (u: number) => Math.abs(((u % 2) + 2) % 2 - 1) * 2 - 1;

// cifre e qualche lettera 3×5 per i punti che volano
const FONT: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '×': '000101010101000',
  '!': '010010010000010', 'x': '000101010101000',
};

export type Tela = {
  W: number; H: number; buf: Uint32Array;
  px(x: number, y: number, c: number): void;
  rect(x: number, y: number, w: number, h: number, c: number): void;
  /** Cerchio pieno di raggio r (centro in pixel). */
  disco(cx: number, cy: number, r: number, c: number): void;
  /** Sprite a righe di caratteri: `map` dal carattere al colore ('.' o assente = trasparente). */
  spr(rows: readonly string[], x: number, y: number, map: Readonly<Record<string, Col>>, flip?: boolean): void;
  /** Testo 3×5 centrato in x, con l'ombra. */
  testo(s: string, x: number, y: number, c: number): void;
  fine(): void;
};

export function createTela(cv: HTMLCanvasElement, W: number, H: number): Tela {
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
  const px = (x: number, y: number, c: number) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
  return {
    W, H, buf, px,
    rect(x0, y0, w, h, c) { x0 = Math.round(x0); y0 = Math.round(y0); for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) buf[y * W + x] = c; },
    disco(cx, cy, r, c) {
      const r2 = r * r + r * 0.6;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) px(x, y, c);
    },
    spr(rows, x0, y0, map, flip = false) {
      x0 = Math.round(x0); y0 = Math.round(y0);
      for (let y = 0; y < rows.length; y++) { const r = rows[y]!; for (let x = 0; x < r.length; x++) { const c = map[r[flip ? r.length - 1 - x : x]!]; if (c) px(x0 + x, y0 + y, RGBA[c]); } }
    },
    testo(s, x0, y0, c) {
      x0 = Math.round(x0 - (s.length * 4 - 1) / 2); y0 = Math.round(y0);
      for (const pass of [0, 1]) for (let i = 0; i < s.length; i++) {
        const gl = FONT[s[i]!]; if (!gl) continue;
        for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (gl[y * 3 + x] === '1') {
          if (pass === 0) { px(x0 + i * 4 + x + 1, y0 + y + 1, RGBA.neroCaldo); px(x0 + i * 4 + x, y0 + y + 1, RGBA.neroCaldo); }
          else px(x0 + i * 4 + x, y0 + y, c);
        }
      }
    },
    fine() { g.putImageData(img, 0, 0); },
  };
}
