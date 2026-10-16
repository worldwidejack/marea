// I colpi (#355): un raggio dagli occhi lungo la mira, sparpagliato a caso nel cono della dispersione (un raggio per pallino), che si
// ferma sul primo ostacolo tra scatole, banchina, mare e corpi: cilindro da terra al collo più la sfera della testa sugli occhi. Il
// danno cala con la portata; alla testa vale di più. Ogni colpo lascia un evento per la resa (scie, scintille, X del colpo a segno).
import { SPARO } from '@marea/content/sparo.ts';
import type { SArmaDef } from '@marea/content/sparo.ts';
import { cos, sin } from '../trig.ts';
import type { SMappa } from './mappa.ts';
import { raggio } from './mappa.ts';
import type { SAttore, SColpo, SState } from './stato.ts';
import { caso, collo, occhi } from './stato.ts';

/** Oltre questa distanza un colpo non tocca più niente (m). */
export const PORTATA_MAX = 140;

/** Versore della mira: yaw 0 = −Z (verso sinistra positivo), pitch + in su. */
export function direzione(yaw: number, pitch: number): [number, number, number] {
  const cp = cos(pitch);
  return [-sin(yaw) * cp, sin(pitch), -cos(yaw) * cp];
}

/** Dove il raggio entra nel corpo `a` (entro `max` m), e se è la testa; null = lo manca. */
export function toccaCorpo(a: SAttore, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): { t: number; testa: boolean } | null {
  const C = SPARO.giocatore;
  let best = max, testa = false, preso = false;
  // testa: sfera sugli occhi
  const hy = occhi(a), qx = ox - a.x, qy = oy - hy, qz = oz - a.z;
  const b = qx * dx + qy * dy + qz * dz, c = qx * qx + qy * qy + qz * qz - C.testa * C.testa, dh = b * b - c;
  if (dh >= 0) { const t = -b - Math.sqrt(dh); if (t > 0 && t < best) { best = t; testa = true; preso = true; } }
  // corpo: cilindro verticale da terra (piedi) al collo
  const yb = a.y, yt = collo(a), A = dx * dx + dz * dz;
  if (A > 1e-9) {
    const B = qx * dx + qz * dz, Cc = qx * qx + qz * qz - C.corpo * C.corpo, dc = B * B - A * Cc;
    if (dc >= 0) {
      const sq = Math.sqrt(dc), t1 = (-B - sq) / A, t2 = (-B + sq) / A;
      let tb = -1;
      if (t1 > 0) { const y = oy + dy * t1; if (y >= yb && y <= yt) tb = t1; }
      // dall'alto: entra dal tappo del collo
      if (tb < 0 && dy < 0 && oy > yt) { const tc = (yt - oy) / dy; if (tc >= t1 && tc <= t2 && tc > 0) tb = tc; }
      if (tb > 0 && tb < best) { best = tb; testa = false; preso = true; }
    }
  }
  return preso ? { t: best, testa } : null;
}

/** Danno a distanza `d`: pieno fino a `piena`, poi cala fino a `minimo` × a `zero` m. */
export function caloPortata(a: SArmaDef, d: number): number {
  const P = a.portata;
  if (d <= P.piena) return 1;
  if (d >= P.zero) return P.minimo;
  return 1 - ((1 - P.minimo) * (d - P.piena)) / (P.zero - P.piena);
}

/** Attore numero `chi` (−1 = il giocatore). */
export const attoreDi = (s: SState, chi: number): SAttore => (chi < 0 ? s.g : s.bot[chi]!);

/** Toglie vita a `chi` (colpito da `da`): evento, statistiche, caduta. Col giocatore immortale (prove) la vita non scende sotto 1. */
export function ferisci(s: SState, chi: number, da: number, danno: number, testa: boolean, x: number, y: number, z: number): void {
  const a = attoreDi(s, chi);
  if (a.morto) return;
  const giu = Math.round(danno * 10) / 10;
  a.vita = chi < 0 && s.immortale ? Math.max(1, a.vita - giu) : a.vita - giu;
  a.colpitoT = s.tick;
  if (chi < 0) s.g.dannoPreso += giu;
  s.ev.push({ t: 'colpito', chi, da, danno: giu, testa, x, y, z });
  if (a.vita <= 0) {
    a.vita = 0; a.morto = s.tick || 1; // 0 vuol dire in piedi
    s.ev.push({ t: 'ucciso', chi, da, testa });
    if (da < 0) s.g.uccisi++;
  }
}

/** Un colpo dell'arma `arma` da (ox, oy, oz) verso (yaw, pitch), dispersione `cono` (rad, mezzo angolo). Ritorna se ha preso qualcuno. */
export function spara(s: SState, m: SMappa, chi: number, arma: SArmaDef, ox: number, oy: number, oz: number, yaw: number, pitch: number, cono: number): boolean {
  const colpi: SColpo[] = [];
  let preso = false, testaPresa = false;
  for (let p = 0; p < arma.pallini; p++) {
    let u = 0, v = 0;
    if (cono > 0) { do { u = caso(s) * 2 - 1; v = caso(s) * 2 - 1; } while (u * u + v * v > 1); }
    const [dx, dy, dz] = direzione(yaw + u * cono, pitch + v * cono);
    const imp = raggio(m, ox, oy, oz, dx, dy, dz, PORTATA_MAX);
    let best = imp.t, quale = -2, testa = false;
    const prova = (k: number) => {
      const a = attoreDi(s, k);
      if (k === chi || a.morto) return;
      const h = toccaCorpo(a, ox, oy, oz, dx, dy, dz, best);
      if (h) { best = h.t; quale = k; testa = h.testa; }
    };
    // i nemici non si colpiscono tra loro (niente fuoco amico): un loro colpo cerca solo te
    if (chi >= 0) prova(-1); else for (let k = 0; k < s.bot.length; k++) prova(k);
    if (quale !== -2) {
      const x = ox + dx * best, y = oy + dy * best, z = oz + dz * best;
      ferisci(s, quale, chi, arma.danno * (testa ? arma.testa : 1) * caloPortata(arma, best), testa, x, y, z);
      colpi.push({ x, y, z, cosa: 'attore', nx: -dx, ny: -dy, nz: -dz, chi: quale, testa, scatola: -1 });
      preso = true; if (testa) testaPresa = true;
    } else colpi.push({ x: imp.x, y: imp.y, z: imp.z, cosa: imp.cosa, nx: imp.nx, ny: imp.ny, nz: imp.nz, chi: -2, testa: false, scatola: imp.scatola });
  }
  s.ev.push({ t: 'sparo', chi, arma: arma.id, ox, oy, oz, colpi });
  if (chi < 0) { s.g.sparati++; if (preso) s.g.aSegno++; if (testaPresa) s.g.teste++; }
  return preso;
}
