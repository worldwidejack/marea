// Passi comuni a chi combatte: macchina degli stati, potenza dei colpi, giro lento (scafandro, scudo) e movimento verso un punto.
// Li usano le IA dei nemici (enemies.ts) e dei nemici che puntano le evocazioni (contro_alleati.ts).
import { DT } from '../constants.ts';
import type { EnemyDef } from '@marea/content/rpg.ts';
import type { DungeonState, Enemy } from './state.ts';
import { moveCircle } from './map.ts';
import { grigliaDi } from './muove.ts';

/** Potenziato da un Chierico (Mausoleo) o da Furia: moltiplicatore del danno dei suoi colpi (1 se no). */
export const potenza = (s: DungeonState, e: Enemy): number => (e.potT !== undefined && e.potT > s.tick ? e.potM ?? 1 : 1);
/** Si gira piano (scafandro del Golem-Palombaro, scudo della Sentinella): rad/s, o null se si gira di colpo. */
export const girata = (d: EnemyDef): number | null => (d.scafandro ?? d.scudo)?.gira ?? null;
export function setState(e: Enemy, st: Enemy['st'], dur: number): void { e.st = st; e.stT = 0; e.stDur = dur; }

/** Gira il muso del nemico verso (ux, uz) di al massimo `a` radianti (seno e coseno in serie di Taylor, poi rinormalizza); ritorna il
 *  coseno tra il muso e la meta dopo il giro. */
export function giraVerso(e: Enemy, ux: number, uz: number, a: number): number {
  const a2 = a * a, c = 1 - a2 / 2 + (a2 * a2) / 24;
  if (e.fx * ux + e.fz * uz >= c) { e.fx = ux; e.fz = uz; return 1; }
  const sn = (a - (a * a2) / 6 + (a * a2 * a2) / 120) * (e.fx * uz - e.fz * ux >= 0 ? 1 : -1);
  const nx = e.fx * c - e.fz * sn, nz = e.fz * c + e.fx * sn, l = Math.sqrt(nx * nx + nz * nz);
  e.fx = nx / l; e.fz = nz / l;
  return e.fx * ux + e.fz * uz;
}

export function moveToward(s: DungeonState, e: Enemy, tx: number, tz: number, speed: number): void {
  const dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  let step = Math.min(d, speed * DT);
  // Golem-Palombaro e Sentinella: si girano piano e avanzano solo dritti (più è storto, più vanno piano)
  const gira = girata(e.def);
  if (gira !== null) step *= Math.max(0, giraVerso(e, dx / d, dz / d, gira * DT));
  else { e.fx = dx / d; e.fz = dz / d; }
  if (step > 0) moveCircle(grigliaDi(s, e), e, e.fx * step, e.fz * step, e.def.raggio);
}
