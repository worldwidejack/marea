// Il kit per disegnare pavimenti e pareti interi (finiture_*.ts): non più un blocco 32×32 ripetuto, ma un disegno solo grande quanto la
// superficie, che si rifà quando la casa cresce. Pixel a griglia (16 texel/m il pavimento, 32 la parete), solo colori della palette,
// forme grandi e niente puntini di rumore (ART_BIBLE §3). Il caso è un seme fisso per finitura e misura: la stessa stanza è sempre uguale.
import { createRng, type Rng } from '@marea/sim';
import { P } from '../render/island_parts.ts';

export { P };
/** Texel per metro: pavimento (come il mondo) e pareti (come le insegne, devono leggersi). */
export const TEX_PAV = 16, TEX_MURO = 32;

export type Tela = { g: CanvasRenderingContext2D; w: number; h: number; m: number; r: Rng };
/** I tre colori della finitura (borgo.json `colori`): fondo, secondo, accento. */
export type Col = { a: string; b: string; k: string };
/** Il pavimento: larghezza e profondità in celle (2 m l'una, 32 texel). */
export type Pav = { cx: number; cz: number };
/** Una parete vista da dentro, da sinistra a destra. Le tre pareti si leggono come un giro solo (sinistra dal davanti al fondo, fondo,
 *  destra dal fondo al davanti): `u0` è il metro del giro dove comincia questa, `giro` la lunghezza totale. `x0`..`x1` i texel visibili
 *  (la parete di fondo passa dietro ai fianchi per lo spessore del muro). */
export type Muro = { lato: 'sx' | 'fondo' | 'dx'; lung: number; alt: number; u0: number; giro: number; x0: number; x1: number };
/** Chi disegna un pavimento intero (la tela è già della tinta di fondo `a`). */
export type DisegnoPav = (t: Tela, c: Col, s: Pav) => void;
/** Chi disegna una parete intera (la tela è già della tinta di fondo `a`; in basso 8 texel li copre il battiscopa). */
export type DisegnoMuro = (t: Tela, c: Col, s: Muro) => void;

export function tela(c: HTMLCanvasElement, w: number, h: number, m: number, seme: string): Tela {
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return { g: c.getContext('2d')!, w: c.width, h: c.height, m, r: createRng(seme) };
}

/** Rettangolo pieno (coordinate arrotondate al texel). */
export function R(t: Tela, col: string, x: number, y: number, w: number, h: number): void {
  const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
  if (x1 <= x0 || y1 <= y0) return;
  t.g.fillStyle = col; t.g.fillRect(x0, y0, x1 - x0, y1 - y0);
}
export const tutto = (t: Tela, col: string): void => R(t, col, 0, 0, t.w, t.h);
/** Cornice di spessore s dentro il rettangolo. */
export function cornice(t: Tela, col: string, x: number, y: number, w: number, h: number, s = 1): void {
  R(t, col, x, y, w, s); R(t, col, x, y + h - s, w, s); R(t, col, x, y, s, h); R(t, col, x + w - s, y, s, h);
}
/** Riquadro «in rilievo»: luce in alto a sinistra, ombra in basso a destra. */
export function rilievo(t: Tela, luce: string, ombra: string, x: number, y: number, w: number, h: number, s = 1): void {
  R(t, luce, x, y, w, s); R(t, luce, x, y, s, h); R(t, ombra, x, y + h - s, w, s); R(t, ombra, x + w - s, y, s, h);
}
/** Ellisse piena, a righe di texel. */
export function ovale(t: Tela, col: string, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.ceil(-ry); y <= Math.floor(ry); y++) {
    const q = 1 - (y * y) / (ry * ry); if (q < 0) continue;
    const dx = rx * Math.sqrt(q); R(t, col, cx - dx, cy + y, 2 * dx, 1);
  }
}
/** Anello: ellisse vuota spessa s. */
export function anello(t: Tela, col: string, cx: number, cy: number, rx: number, ry: number, s = 1): void {
  for (let y = Math.ceil(-ry); y <= Math.floor(ry); y++) {
    const q = 1 - (y * y) / (ry * ry); if (q < 0) continue;
    const dx = rx * Math.sqrt(q), qi = 1 - (y * y) / ((ry - s) * (ry - s)), di = ry - s > 0 && qi > 0 ? (rx - s) * Math.sqrt(qi) : -1;
    if (di < 0) { R(t, col, cx - dx, cy + y, 2 * dx, 1); continue; }
    R(t, col, cx - dx, cy + y, dx - di, 1); R(t, col, cx + di, cy + y, dx - di, 1);
  }
}
/** Rombo pieno (raggi rx, ry). */
export function rombo(t: Tela, col: string, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.ceil(-ry); y <= Math.floor(ry); y++) { const dx = rx * (1 - Math.abs(y) / ry); R(t, col, cx - dx, cy + y, 2 * dx, 1); }
}
/** Triangolo pieno coi vertici dati (riempimento a righe). */
export function triangolo(t: Tela, col: string, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
  const y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy)), lati = [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]] as const;
  for (let y = y0; y < y1; y++) {
    const yc = y + 0.5, xs: number[] = [];
    for (const [x0, y0_, x1, y1_] of lati) if ((yc >= y0_ && yc < y1_) || (yc >= y1_ && yc < y0_)) xs.push(x0 + ((yc - y0_) / (y1_ - y0_)) * (x1 - x0));
    if (xs.length >= 2) { const a = Math.min(...xs), b = Math.max(...xs); R(t, col, a, y, b - a, 1); }
  }
}
/** Segmento spesso s (passi di texel). */
export function linea(t: Tela, col: string, x0: number, y0: number, x1: number, y1: number, s = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) R(t, col, x0 + ((x1 - x0) * i) / n - s / 2 + 0.5, y0 + ((y1 - y0) * i) / n - s / 2 + 0.5, s, s);
}
/** Curva appesa tra due punti (catenaria approssimata con una parabola), per fili e ghirlande. */
export function filo(t: Tela, col: string, x0: number, y0: number, x1: number, y1: number, pancia: number, s = 1): void {
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / 2));
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) { const f = i / n, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f + pancia * 4 * f * (1 - f); linea(t, col, px, py, x, y, s); px = x; py = y; }
}
/** Retino a scacchiera (metà dei texel) in un rettangolo: il passaggio tra due fasce. Solo dentro le texture, mai a schermo. */
export function retino(t: Tela, col: string, x: number, y: number, w: number, h: number, fase = 0): void {
  t.g.fillStyle = col;
  for (let j = Math.round(y); j < Math.round(y + h); j++) for (let i = Math.round(x) + ((j + fase) & 1); i < Math.round(x + w); i += 2) t.g.fillRect(i, j, 1, 1);
}
/** Fasce orizzontali da y0 a y1 con i colori dati, separate da una riga di retino (cieli, tramonti, sfumature a bande nette). */
export function bande(t: Tela, cols: readonly string[], x: number, y0: number, w: number, y1: number): void {
  const n = cols.length, hh = (y1 - y0) / n;
  cols.forEach((c, i) => R(t, c, x, y0 + i * hh, w, hh + 1));
  for (let i = 1; i < n; i++) retino(t, cols[i]!, x, y0 + i * hh - 1, w, 1, i);
}
/** Disegna con x e y scambiati (per esempio assi lungo y): `fa` riceve la tela «girata». */
export function trasposta(t: Tela, fa: (t: Tela) => void): void {
  t.g.setTransform(0, 1, 1, 0, 0, 0); fa({ ...t, w: t.h, h: t.w }); t.g.setTransform(1, 0, 0, 1, 0, 0);
}
/** Esagono pieno a punta in su: semilarghezza a, semialtezza b (le punte prendono metà dell'altezza). */
export function esagono(t: Tela, col: string, cx: number, cy: number, a: number, b: number): void {
  for (let y = -b; y < b; y++) { const yy = Math.abs(y + 0.5), hw = yy <= b / 2 ? a : (a * (b - yy)) / (b / 2); R(t, col, cx - hw, cy + y, 2 * hw, 1); }
}
/** Stella a n punte (raggi esterno e interno), piena: spicchi di triangoli. */
export function stella(t: Tela, col: string, cx: number, cy: number, re: number, ri: number, n: number, giro = -Math.PI / 2): void {
  for (let i = 0; i < n; i++) {
    const a0 = giro + (i * 2 * Math.PI) / n, a1 = a0 + Math.PI / n, a2 = a0 - Math.PI / n;
    triangolo(t, col, cx, cy, cx + re * Math.cos(a0), cy + re * Math.sin(a0), cx + ri * Math.cos(a1), cy + ri * Math.sin(a1));
    triangolo(t, col, cx, cy, cx + re * Math.cos(a0), cy + re * Math.sin(a0), cx + ri * Math.cos(a2), cy + ri * Math.sin(a2));
  }
}
/** Greca (meandro a chiave) lungo x da (x, y), moduli di lato s ≥ 7: una fascia alta s. */
export function greca(t: Tela, col: string, x: number, y: number, w: number, s: number): void {
  const n = Math.floor(w / s), x0 = x + (w - n * s) / 2;
  R(t, col, x, y + s - 1, w, 1);
  for (let i = 0; i < n; i++) {
    const q = x0 + i * s;
    R(t, col, q, y, 1, s); R(t, col, q, y, s - 1, 1); R(t, col, q + s - 2, y, 1, s - 2); R(t, col, q + 2, y + s - 3, s - 3, 1);
    R(t, col, q + 2, y + 2, 1, s - 4); R(t, col, q + 2, y + 2, s - 6, 1);
  }
}
/** Il texel del giro delle tre pareti dove comincia questa: i motivi a passo fisso partono da qui, così girano l'angolo senza salti. */
export const giroX = (s: Muro): number => Math.round(s.u0 * TEX_MURO);
/** Il primo x (≤ 0) di un motivo di passo p allineato al giro. */
export const inizio = (s: Muro, p: number): number => -(((giroX(s) % p) + p) % p);
/** I centri (texel) di cose distribuite pari sulla parte visibile della parete, una ogni ~passo metri. */
export const posti = (s: Muro, passo: number): number[] => centri(s.x0, s.x1, quante((s.x1 - s.x0) / TEX_MURO, passo));
/** Riquadri in rilievo (boiserie) tra y0 e y1, distribuiti pari sulla parte visibile, uno ogni ~passo metri. */
export function pannelli(t: Tela, s: Muro, y0: number, y1: number, passo: number, luce: string, ombra: string, dentro?: string): void {
  const n = quante((s.x1 - s.x0) / TEX_MURO, passo), w = (s.x1 - s.x0) / n;
  for (let i = 0; i < n; i++) {
    const x = s.x0 + i * w + 4; if (dentro) R(t, dentro, x, y0, w - 8, y1 - y0);
    rilievo(t, luce, ombra, x, y0, w - 8, y1 - y0); rilievo(t, ombra, luce, x + 2, y0 + 2, w - 12, y1 - y0 - 4);
  }
}
/** Quante volte sta un passo ideale in una lunghezza (almeno 1): così le cose si distribuiscono pari quando la stanza cresce. */
export const quante = (lung: number, passo: number): number => Math.max(1, Math.round(lung / passo));
/** Centri di n cose distribuite pari tra a e b. */
export const centri = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, i) => a + ((i + 0.5) * (b - a)) / n);
/** Un elemento a caso (dal seme della tela). */
export const pesca = <T>(t: Tela, arr: readonly T[]): T => arr[Math.floor(t.r.next() * arr.length)]!;

/** Assi di legno lungo x (righe alte `larg`), giunte sfalsate a caso, fessura scura e venatura chiara. `toni` cambia il colore per asse. */
export function assi(t: Tela, o: { x: number; y: number; w: number; h: number; larg: number; min: number; max: number; toni: readonly string[]; fuga: string; vena?: string; chiodo?: string }): void {
  for (let y = o.y; y < o.y + o.h; y += o.larg) {
    let x = o.x - Math.floor(t.r.next() * o.max);
    while (x < o.x + o.w) {
      const l = o.min + Math.floor(t.r.next() * (o.max - o.min + 1)), a = Math.max(x, o.x), b = Math.min(x + l, o.x + o.w), hh = Math.min(o.larg, o.y + o.h - y);
      R(t, pesca(t, o.toni), a, y, b - a, hh);
      if (o.vena && l > 10) R(t, o.vena, Math.max(a, x + 3 + Math.floor(t.r.next() * (l / 3))), y + 1 + Math.floor(t.r.next() * Math.max(1, hh - 2)), Math.min(l / 2, b - a - 2), 1);
      if (o.chiodo && hh >= 4) { R(t, o.chiodo, x + 1, y + 1, 1, 1); R(t, o.chiodo, x + 1, y + hh - 2, 1, 1); }
      R(t, o.fuga, b - 1, y, 1, hh);
      x += l;
    }
    R(t, o.fuga, o.x, y + o.larg - 1, o.w, 1);
  }
}
/** Lastre irregolari: il rettangolo si spezza a caso in pezzi tra min e max texel; `fa` dipinge ogni pezzo. */
export function lastre(t: Tela, x: number, y: number, w: number, h: number, min: number, max: number, fa: (x: number, y: number, w: number, h: number) => void): void {
  if (w <= max && h <= max && (w < 2 * min || h < 2 * min || t.r.next() < 0.45)) { fa(x, y, w, h); return; }
  const lungo = w >= h ? w : h;
  if (lungo < 2 * min) { fa(x, y, w, h); return; }
  const taglio = min + Math.floor(t.r.next() * (lungo - 2 * min + 1));
  if (w >= h) { lastre(t, x, y, taglio, h, min, max, fa); lastre(t, x + taglio, y, w - taglio, h, min, max, fa); }
  else { lastre(t, x, y, w, taglio, min, max, fa); lastre(t, x, y + taglio, w, h - taglio, min, max, fa); }
}
/** Tappeto: fondo, bordo doppio e frange sui lati corti (lungo y). */
export function tappeto(t: Tela, x: number, y: number, w: number, h: number, fondo: string, bordo: string, filetto: string, frange: string | null): void {
  R(t, fondo, x, y, w, h); cornice(t, bordo, x, y, w, h, Math.max(2, Math.round(Math.min(w, h) / 14))); const s = Math.max(2, Math.round(Math.min(w, h) / 14));
  cornice(t, filetto, x + s + 1, y + s + 1, w - 2 * s - 2, h - 2 * s - 2, 1);
  if (frange) for (let i = x + 1; i < x + w - 1; i += 2) { R(t, frange, i, y - 2, 1, 2); R(t, frange, i, y + h, 1, 2); }
}
