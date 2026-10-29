// Ghiaccio Vivo del Tempio della «Doppia Nera» (docs/BAITA.md). La regola, una sola: appena ti muovi su una lastra di ghiaccio parti in linea retta
// (l'asse in cui ti stavi muovendo) a VEL_SCIVOLO m/s e non comandi più i piedi finché non sbatti contro un muro, un ostacolo o un nemico, oppure arrivi
// su un pavimento asciutto (ti fermi al centro della sua cella). Si può attaccare, bere e usare la A anche mentre scivoli. La colonnina termica
// della stanza (una valvola) scioglie il suo ghiaccio per sempre (`DungeonState.sciolti`). Il resto della sim non lo sa: `hero.ts` si limita a
// non muovere un eroe che scivola (`slideDir`).
import { DT } from '../constants.ts';
import type { DungeonState, HeroRt } from './state.ts';
import { ev } from './state.ts';
import { cellOf, moveCircle } from './map.ts';

/** Velocità dello scivolamento (m/s): come una corsa. Riallineamento alla corsia: al massimo `SNAP` m a tick verso il centro della cella. */
export const VEL_SCIVOLO = 6;
const SNAP = 0.25;
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** La cella `i` è una lastra di ghiaccio ancora viva (la colonnina della sua stanza non è stata girata)? */
export function gelo(s: DungeonState, i: number): boolean {
  const n = i >= 0 ? s.map.ghiaccio[i]! : 0;
  return n > 0 && !s.sciolti.includes(n);
}

/** Direzione cardinale (asse prevalente) di un vettore. */
const cardinale = (x: number, z: number): [number, number] => (Math.abs(x) >= Math.abs(z) ? [x >= 0 ? 1 : -1, 0] : [0, z >= 0 ? 1 : -1]);

/** Un passo di Ghiaccio Vivo per l'eroe di turno (dopo `stepHero`: lì un eroe che scivola non cammina). */
export function stepGhiaccio(s: DungeonState, h: HeroRt): void {
  const m = s.map, T = m.tile, prima = h.slideP;
  h.slideP = [h.x, h.z];
  if (s.done) { h.slideDir = null; return; }
  if (!h.slideDir) {
    if (!h.moving || !gelo(s, cellOf(m, h.x, h.z))) return;
    // parte nell'asse in cui si è mosso in questo tick (se non si è mosso, dove guarda)
    const dx = prima ? h.x - prima[0] : 0, dz = prima ? h.z - prima[1] : 0;
    h.slideDir = Math.abs(dx) + Math.abs(dz) > 1e-4 ? cardinale(dx, dz) : cardinale(h.fx, h.fz);
    ev(s, { t: 'scivolata', x: r2(h.x), z: r2(h.z) });
    return;
  }
  const [dx, dz] = h.slideDir, step = VEL_SCIVOLO * DT, x0 = h.x, z0 = h.z;
  const cx = (Math.floor(h.x / T) + 0.5) * T, cz = (Math.floor(h.z / T) + 0.5) * T, snap = (v: number): number => Math.max(-SNAP, Math.min(SNAP, v));
  moveCircle(m, h, dx * step + (dz !== 0 ? snap(cx - h.x) : 0), dz * step + (dx !== 0 ? snap(cz - h.z) : 0), s.runHero.raggio);
  if ((h.x - x0) * dx + (h.z - z0) * dz < step * 0.5) { h.slideDir = null; return; } // muro, ostacolo o nemico
  if (gelo(s, cellOf(m, h.x, h.z))) return;
  // asciutto: si ferma al centro della cella
  const px = (Math.floor(h.x / T) + 0.5) * T, pz = (Math.floor(h.z / T) + 0.5) * T;
  if ((h.x - px) * dx + (h.z - pz) * dz >= 0) { if (dx !== 0) h.x = px; else h.z = pz; h.slideDir = null; }
}
