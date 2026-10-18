// Il tavolo della Difesa (#358): da caselle e corsie della sim ai pixel dello schermo e ritorno. Il campo è un quadrilatero sul fondale
// (anche un po' in prospettiva: più stretto in alto), mappato con un'interpolazione bilineare; l'inquadratura mette tutto il campo nello
// schermo con spazio sopra per la barra delle carte, a sinistra per la base e i tosaerba, a destra per i nemici che entrano.
import type { Pelle, Punto } from './skin.ts';

export type Inquadratura = { scala: number; ox: number; oy: number; W: number; H: number };

/** Il punto del fondale (px dell'immagine) per la colonna `x` (0-9) e la corsia `y` (0-5, 0 = bordo alto del campo). */
export function suFondale(p: Pelle, x: number, y: number): Punto {
  const { tl, tr, bl, br } = p.campo, u = x / 9, v = y / 5;
  const ax = tl[0] + (tr[0] - tl[0]) * u, ay = tl[1] + (tr[1] - tl[1]) * u;
  const bx = bl[0] + (br[0] - bl[0]) * u, by = bl[1] + (br[1] - bl[1]) * u;
  return [ax + (bx - ax) * v, ay + (by - ay) * v];
}
/** Larghezza e altezza di una casella (px del fondale) alla corsia `y`. */
export function casella(p: Pelle, y: number): [number, number] {
  const a = suFondale(p, 0, y), b = suFondale(p, 9, y), c = suFondale(p, 4.5, Math.max(0, y - 0.5)), d = suFondale(p, 4.5, Math.min(5, y + 0.5));
  return [(b[0] - a[0]) / 9, (d[1] - c[1])];
}
/** Dal punto del fondale a colonna e corsia (inversa approssimata, buona per i tocchi). */
export function daFondale(p: Pelle, fx: number, fy: number): [number, number] {
  let x = 4.5, y = 2.5;
  for (let k = 0; k < 12; k++) {
    const [px, py] = suFondale(p, x, y), [w, h] = casella(p, y);
    x += (fx - px) / w; y += (fy - py) / h;
  }
  return [x, y];
}

/** Inquadratura: il campo intero, con `sopra` px di schermo per la barra in alto e `sotto` per la barra delle ondate. */
export function inquadra(p: Pelle, W: number, H: number, sopra: number, sotto: number): Inquadratura {
  const [cw] = casella(p, 2.5);
  const x0 = Math.min(p.campo.tl[0], p.campo.bl[0]) - cw * 1.25, x1 = Math.max(p.campo.tr[0], p.campo.br[0]) + cw * 0.9;
  const y0 = Math.min(p.campo.tl[1], p.campo.tr[1]) - cw * 0.55, y1 = Math.max(p.campo.bl[1], p.campo.br[1]) + cw * 0.12;
  const scala = Math.min(W / (x1 - x0), (H - sopra - sotto) / (y1 - y0));
  const ox = (W - (x1 - x0) * scala) / 2 - x0 * scala;
  const oy = sopra + (H - sopra - sotto - (y1 - y0) * scala) / 2 - y0 * scala;
  return { scala, ox, oy, W, H };
}
export const aSchermo = (q: Inquadratura, f: Punto): Punto => [q.ox + f[0] * q.scala, q.oy + f[1] * q.scala];
export const daSchermo = (q: Inquadratura, sx: number, sy: number): Punto => [(sx - q.ox) / q.scala, (sy - q.oy) / q.scala];
