// La presa del retino: dove sta la rete nel mondo e se un insetto ci finisce dentro. Un insetto si prende solo se il suo centro entra nel
// volume della rete (dalla bocca, un po' sotto il cerchio, fino a metà sacca) in uno dei punti toccati dal retino da un frame all'altro.
// Niente three: stessi numeri e stessa matrice di render/pennello.ts, così quello che si vede è quello che prende.
import type { RetinoRete } from '@marea/content/insetti.ts';

/** Il retino in mano nel mondo: `x, y, z` è l'origine del modello (fondo del manico), `h` la prua, `pitch` e `roll` come in pennello.put. */
export type RetinoPosa = { x: number; y: number; z: number; h: number; pitch: number; roll: number };
export type Punto = { x: number; y: number; z: number };
/** Il volume della rete: segmento dalla bocca verso la sacca, con raggio `r`. */
export type Capsula = { a: Punto; b: Punto; r: number };

/** Quanto la bocca sporge sotto il cerchio (verso chi entra) e quanto sacca conta come «dentro», in frazione di `rete.sacca`. */
const SOTTO = 0.22, DENTRO = 0.6, RAGGIO_UTILE = 0.9, PASSO_M = 0.12;

/** Il punto (lx, ly, lz) del modello (y lungo l'asta, z verso la sacca) nel mondo: R = Ry(−h) · Rx(pitch) · Rz(roll). */
export function dalModello(p: RetinoPosa, lx: number, ly: number, lz: number, out: Punto = { x: 0, y: 0, z: 0 }): Punto {
  const cy = Math.cos(-p.h), sy = Math.sin(-p.h), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch), cr = Math.cos(p.roll), sr = Math.sin(p.roll);
  const a00 = cr, a01 = -sr, a10 = cp * sr, a11 = cp * cr, a12 = -sp, a20 = sp * sr, a21 = sp * cr, a22 = cp;
  out.x = p.x + (cy * a00 + sy * a20) * lx + (cy * a01 + sy * a21) * ly + sy * a22 * lz;
  out.y = p.y + a10 * lx + a11 * ly + a12 * lz;
  out.z = p.z + (-sy * a00 + cy * a20) * lx + (-sy * a01 + cy * a21) * ly + cy * a22 * lz;
  return out;
}

/** La mano stringe l'asta a 18 cm dal fondo del manico. */
const IMPUGNATURA = 0.18;
/** Il retino nel mondo date la mano, la prua e l'inclinazione (stessa matrice di `dalModello`). */
export function posaDaMano(mano: Punto, h: number, pitch: number, roll: number): RetinoPosa {
  const p: RetinoPosa = { x: 0, y: 0, z: 0, h, pitch, roll }, d = dalModello(p, 0, IMPUGNATURA, 0);
  return { x: mano.x - d.x, y: mano.y - d.y, z: mano.z - d.z, h, pitch, roll };
}
/** Un punto (lx a destra, lz indietro) nel riferimento dell'avatar fermo in (x, z) con prua `yaw`, nel mondo. */
export function daAvatar(x: number, z: number, yaw: number, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(-yaw), s = Math.sin(-yaw);
  return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
}

/** A che altezza sull'asta sta il centro del cerchio. */
export const centroRete = (r: RetinoRete): number => r.asta + r.raggio;

export function capsulaRete(p: RetinoPosa, r: RetinoRete): Capsula {
  const yc = centroRete(r);
  return { a: dalModello(p, 0, yc, -SOTTO * r.sacca), b: dalModello(p, 0, yc, DENTRO * r.sacca), r: r.raggio * RAGGIO_UTILE };
}

export function distPuntoSegmento(c: Punto, a: Punto, b: Punto): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, l2 = abx * abx + aby * aby + abz * abz;
  let k = l2 > 1e-9 ? ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / l2 : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return Math.hypot(c.x - (a.x + abx * k), c.y - (a.y + aby * k), c.z - (a.z + abz * k));
}
const lerpP = (p: Punto, q: Punto, k: number): Punto => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, z: p.z + (q.z - p.z) * k });
const dist = (p: Punto, q: Punto) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

/** L'insetto in `c` (raggio `corpo`) è finito nella rete tra il frame di prima (`prima`, null al primo) e quello di adesso? */
export function presaLungo(prima: Capsula | null, ora: Capsula, c: Punto, corpo: number): boolean {
  const da = prima ?? ora, passi = Math.max(1, Math.ceil(Math.max(dist(da.a, ora.a), dist(da.b, ora.b)) / PASSO_M));
  for (let i = 1; i <= passi; i++) {
    const k = i / passi;
    if (distPuntoSegmento(c, lerpP(da.a, ora.a, k), lerpP(da.b, ora.b, k)) <= ora.r + corpo) return true;
  }
  return false;
}
