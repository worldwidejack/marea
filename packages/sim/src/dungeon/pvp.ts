// Arena PvP dentro la sim del dungeon (docs/ARENA.md): con `s.pvp` gli eroi stanno in squadre e quelli dell'altra squadra (e le loro
// evocazioni) sono bersagli come i nemici: la mischia, le frecce, le magie (proiettile, raggio, bomba) e le evocazioni li colpiscono con
// hitHeroPvp (danno calibrato, mai un colpo che uccide da solo). Cura e Furia valgono solo sulla propria squadra e sulle proprie evocazioni,
// e senza un compagno davanti curano chi le lancia. Senza `s.pvp` (i dungeon) qui non succede niente: le funzioni rispondono «nessuno».
// Determinismo: solo + − × ÷ e Math.sqrt (regola di dungeon/types.ts).
import { RPG } from '@marea/content/rpg.ts';
import type { DungeonState, Enemy } from './state.ts';
import { hitHeroPvp } from './combat.ts';
import type { HitSrc } from './combat.ts';
import { lineOfSight, moveCircle } from './map.ts';

/** Squadra dell'eroe i (senza pvp tutti nella stessa). */
export const squadraDi = (s: DungeonState, i: number): number => s.pvp?.squadre[i] ?? 0;
/** L'eroe j è un avversario dell'eroe i. */
export const nemicoDi = (s: DungeonState, i: number, j: number): boolean => !!s.pvp && i !== j && squadraDi(s, i) !== squadraDi(s, j);
/** Gli avversari ancora in gioco dell'eroe di turno (senza pvp nessuno). */
export function eroiNemici(s: DungeonState): number[] {
  if (!s.pvp) return [];
  const out: number[] = [];
  for (let j = 0; j < s.eroi.length; j++) if (!s.eroi[j]!.done && nemicoDi(s, s.cur, j)) out.push(j);
  return out;
}
/** Un'evocazione della squadra avversaria dell'eroe di turno (senza pvp mai). */
export const evocazioneNemica = (s: DungeonState, e: Enemy): boolean => !!s.pvp && e.alleato && squadraDi(s, e.padrone ?? 0) !== squadraDi(s, s.cur);
/** Un bersaglio per l'eroe di turno: i nemici del dungeon e, in Arena, le evocazioni avversarie. */
export const ostile = (s: DungeonState, e: Enemy): boolean => e.st !== 'morto' && (!e.alleato || evocazioneNemica(s, e));
/** Un alleato per l'eroe di turno: le evocazioni della sua squadra (senza pvp tutte). */
export const amica = (s: DungeonState, e: Enemy): boolean => e.alleato && e.st !== 'morto' && !evocazioneNemica(s, e);
/** L'eroe j è della squadra dell'eroe di turno (sé compreso). */
export const compagno = (s: DungeonState, j: number): boolean => !s.pvp || squadraDi(s, j) === squadraDi(s, s.cur);

/** Mira assistita sugli avversari: il più vicino entro `range` nel cono davanti (coseno `cosMin`), altrimenti il più vicino entro
 *  `fallback`, in linea di vista se `vista`. Con `d` le distanze dei nemici già trovati, per scegliere il migliore tra tutti. */
export function aimEroi(s: DungeonState, range: number, cosMin: number, fallback: number, vista: boolean): { best: { x: number; z: number; d: number } | null; near: { x: number; z: number; d: number } | null } {
  const h = s.hero;
  let best: { x: number; z: number; d: number } | null = null, near: { x: number; z: number; d: number } | null = null;
  for (const j of eroiNemici(s)) {
    const o = s.eroi[j]!, dx = o.hero.x - h.x, dz = o.hero.z - h.z, d = Math.sqrt(dx * dx + dz * dz), reach = d - o.runHero.raggio;
    if (vista && !lineOfSight(s.map, h.x, h.z, o.hero.x, o.hero.z)) continue;
    const dot = d > 1e-6 ? (dx * h.fx + dz * h.fz) / d : 1;
    if (reach <= range && dot >= cosMin && (!best || d < best.d)) best = { x: o.hero.x, z: o.hero.z, d };
    if (reach <= fallback && (!near || d < near.d)) near = { x: o.hero.x, z: o.hero.z, d };
  }
  return { best, near };
}

/** Gli avversari dentro il cerchio (x, z, r) (il loro raggio compreso): per scoppi ed esplosioni. */
export function eroiNelCerchio(s: DungeonState, x: number, z: number, r: number): number[] {
  return eroiNemici(s).filter((j) => { const o = s.eroi[j]!, dx = o.hero.x - x, dz = o.hero.z - z, rr = r + o.runHero.raggio; return dx * dx + dz * dz <= rr * rr; });
}

/** Il primo avversario toccato da un proiettile in (x, z) entro `margine` (e non già preso): indice e distanza², o null. */
export function eroeToccato(s: DungeonState, x: number, z: number, margine: number, presi: readonly number[]): { j: number; d2: number } | null {
  let out: { j: number; d2: number } | null = null;
  for (const j of eroiNemici(s)) {
    if (presi.includes(-1 - j)) continue;
    const o = s.eroi[j]!, dx = o.hero.x - x, dz = o.hero.z - z, r = o.runHero.raggio + margine, d2 = dx * dx + dz * dz;
    if (d2 <= r * r && (!out || d2 < out.d2)) out = { j, d2 };
  }
  return out;
}

/** Colpo dell'eroe di turno (o della sua evocazione) sull'avversario j. Ritorna il danno. Le evocazioni hanno il danno dei dungeon: sugli
 *  eroi va scalato come le armi della fotografia arena (RPG.arena.dannoMolt). */
export function colpisciEroe(s: DungeonState, j: number, src: HitSrc): number {
  const d = hitHeroPvp(s, j, src.daAlleato ? { ...src, danno: src.danno * (RPG.arena?.dannoMolt ?? 0.45) } : src);
  if (d > 0 && !src.daAlleato) s.danniFatti += d;
  return d;
}

/** Gli eroi sono solidi tra loro in Arena: l'eroe di turno non attraversa gli avversari, né le loro evocazioni (chi vola passa sopra). */
export function separaEroi(s: DungeonState): void {
  if (!s.pvp) return;
  const h = s.hero, rh = s.runHero;
  for (const j of eroiNemici(s)) {
    const o = s.eroi[j]!.hero, dx = h.x - o.x, dz = h.z - o.z, d2 = dx * dx + dz * dz, rr = rh.raggio + s.eroi[j]!.runHero.raggio;
    if (d2 >= rr * rr || d2 < 1e-12) continue;
    const d = Math.sqrt(d2), k = (rr - d) / d;
    moveCircle(s.map, h, dx * k, dz * k, rh.raggio);
  }
}
