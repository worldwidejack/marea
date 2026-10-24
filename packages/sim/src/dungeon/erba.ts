// Erba alta dell'Arena (docs/ARENA.md): come i cespugli di Brawl Stars. Chi sta su una cella `erba` della mappa non lo vedono gli avversari
// (i compagni sì): né sullo schermo (viewDuello) né per la mira assistita. Lo scoprono: un avversario entro RPG.arena.erba.raggio m, e per
// RPG.arena.erba.rivela s chi attacca o prende un colpo (`s.pvp.rivela[i]` = fino a che tick). Si può essere colpiti anche senza essere visti:
// proiettili, scoppi e mischia valgono come sempre. Fuori da un duello (senza `s.pvp`) tutti si vedono.
// Determinismo: solo + − × ÷ (regola di dungeon/types.ts).
import { RPG } from '@marea/content/rpg.ts';
import { cellOf } from './map.ts';
import { secToTicks } from './state.ts';
import type { DungeonState } from './state.ts';

/** L'eroe j sta nell'erba alta. */
export function nellErba(s: DungeonState, j: number): boolean {
  const o = s.eroi[j];
  if (!o) return false;
  const c = cellOf(s.map, o.hero.x, o.hero.z);
  return c >= 0 && s.map.erba[c] === 1;
}

/** L'eroe j si è scoperto (ha attaccato o è stato colpito da poco). */
export const scoperto = (s: DungeonState, j: number): boolean => (s.pvp?.rivela[j] ?? 0) > s.tick;

/** L'eroe j è scoperto per i prossimi RPG.arena.erba.rivela secondi. */
export function scopri(s: DungeonState, j: number): void {
  if (s.pvp) s.pvp.rivela[j] = s.tick + secToTicks(RPG.arena.erba.rivela);
}

/** La squadra `squadra` vede l'eroe j: un compagno sì, e chi non sta nell'erba, e chi è scoperto, e chi ha un avversario vicino. */
export function visibileDa(s: DungeonState, j: number, squadra: number): boolean {
  const p = s.pvp, o = s.eroi[j];
  if (!p || !o || p.squadre[j] === squadra || o.done || !nellErba(s, j) || scoperto(s, j)) return true;
  const R = RPG.arena.erba.raggio;
  for (let i = 0; i < s.eroi.length; i++) {
    const a = s.eroi[i]!;
    if (a.done || p.squadre[i] !== squadra) continue;
    const dx = a.hero.x - o.hero.x, dz = a.hero.z - o.hero.z;
    if (dx * dx + dz * dz <= R * R) return true;
  }
  return false;
}

/** Dopo il passo degli eroi: chi sta attaccando (qualsiasi azione tranne bere) o tiene un raggio acceso si scopre. */
export function scopriChiAttacca(s: DungeonState): void {
  if (!s.pvp) return;
  for (let i = 0; i < s.eroi.length; i++) {
    const r = s.eroi[i]!;
    if (!r.done && ((r.hero.act !== 'idle' && r.hero.act !== 'beve') || r.hero.canale > 0)) scopri(s, i);
  }
}
