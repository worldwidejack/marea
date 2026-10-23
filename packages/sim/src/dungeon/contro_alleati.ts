// I nemici si accorgono delle evocazioni: uno in caccia punta quella più vicina (se sta più vicina dell'eroe), la insegue e la colpisce come
// colpirebbe l'eroe: in mischia, coi tiri e col colpo ad area. L'evocazione para con l'armatura e la resistenza magica del suo tipo.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { ev } from './state.ts';
import { kill } from './combat.ts';
import { lineOfSight } from './map.ts';
import { giraVerso, girata, moveToward, potenza } from './passi.ts';
import { COLPITO_TICKS, COS_CONO_NEMICO, COS_SCAFANDRO, DANNO_MIN, PUNTA_RESTA, PUNTA_SEGUE, TOLLERANZA_NEMICO } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => { const dx = b.x - a.x, dz = b.z - a.z; return Math.sqrt(dx * dx + dz * dz); };

/** L'evocazione che il nemico ha puntato (anche se è già caduta), o null: `bersaglio` di un nemico è un'evocazione solo qui. */
export function puntato(s: DungeonState, e: Enemy): Enemy | null {
  if (e.bersaglio < 0) return null;
  const a = s.enemies.find((o) => o.id === e.bersaglio);
  return a && a.alleato ? a : null;
}

/** Chi punta il nemico in caccia: l'evocazione più vicina che vede, se sta più vicina dell'eroe (a metri `dEroe`); se no l'eroe (null).
 *  Quella già puntata pesa meno e si lascia da più lontano, così non cambia bersaglio a ogni passo. */
export function scegliAlleato(s: DungeonState, e: Enemy, dEroe: number): Enemy | null {
  const prima = puntato(s, e);
  let best: Enemy | null = null, bd = Infinity;
  for (const o of s.enemies) {
    if (!o.alleato || o.st === 'morto') continue;
    const d = dist(e, o), era = o === prima;
    if (d > e.def.vista * (era ? PUNTA_RESTA : 1) || !lineOfSight(s.map, e.x, e.z, o.x, o.z)) continue;
    const peso = era ? d * PUNTA_SEGUE : d;
    if (peso < bd) { bd = peso; best = o; }
  }
  if (best && bd >= dEroe) best = null;
  e.bersaglio = best ? best.id : -1;
  return best;
}

/** Un passo del nemico contro l'evocazione `a`: la insegue, o dice cosa fare (`colpo` in mischia, `tiro` a distanza) quando è il momento. */
export function passoContro(s: DungeonState, e: Enemy, a: Enemy): 'colpo' | 'tiro' | null {
  const def = e.def, p = def.proiettile, dx = a.x - e.x, dz = a.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d <= def.portata + def.raggio + a.def.raggio) {
    // scafandro e scudo attaccano solo chi hanno davanti: se no si girano (piano)
    const gira = girata(def);
    if (gira !== null && d > 1e-6 && giraVerso(e, dx / d, dz / d, gira * DT) < COS_SCAFANDRO) return null;
    return 'colpo';
  }
  if (def.comportamento !== 'mischia' && p && d <= p.gittata) { // arcieri e maghi tirano da fermi
    e.fx = dx / d; e.fz = dz / d;
    return e.cdTiro <= 0 ? 'tiro' : null;
  }
  moveToward(s, e, a.x, a.z, def.velocita);
  return null;
}

/** Danno su un'evocazione: armatura (o resistenza magica), mai meno del minimo; a zero cade. */
function feriscAlleato(s: DungeonState, a: Enemy, danno: number, magico: boolean): void {
  if (a.st === 'morto') return;
  const d = Math.max(DANNO_MIN, magico ? danno * (1 - (a.def.resistMagia ?? 0)) : danno - a.def.armatura);
  a.vita -= d; a.hurt = COLPITO_TICKS;
  ev(s, { t: 'colpo', x: r2(a.x), z: r2(a.z), danno: Math.round(d), su: 'nemico', id: a.id });
  if (a.vita <= 0) kill(s, a);
}

/** Fine della preparazione contro l'evocazione `a`: il colpo in mischia arriva se è ancora in portata e davanti. */
export function colpoSuAlleato(s: DungeonState, e: Enemy, a: Enemy): void {
  const dx = a.x - e.x, dz = a.z - e.z, d = Math.sqrt(dx * dx + dz * dz), dot = d > 1e-6 ? (dx * e.fx + dz * e.fz) / d : 1;
  if (d <= e.def.portata + e.def.raggio + a.def.raggio + TOLLERANZA_NEMICO && dot >= COS_CONO_NEMICO) feriscAlleato(s, a, e.def.danno * potenza(s, e), false);
  else ev(s, { t: 'schivato', x: r2(a.x), z: r2(a.z) });
}

/** Il colpo ad area del nemico prende anche le evocazioni dentro il cerchio. */
export function areaSuAlleati(s: DungeonState, e: Enemy, raggio: number, danno: number): void {
  for (const o of s.enemies) if (o.alleato && o.st !== 'morto' && dist(e, o) <= raggio + o.def.raggio) feriscAlleato(s, o, danno, false);
}

/** Un tiro nemico che tocca un'evocazione la ferisce e finisce (true). */
export function tiroSuAlleato(s: DungeonState, p: Proj, margine: number): boolean {
  for (const o of s.enemies) {
    if (!o.alleato || o.st === 'morto' || dist(p, o) > o.def.raggio + margine) continue;
    feriscAlleato(s, o, p.danno, p.magico);
    return true;
  }
  return false;
}
