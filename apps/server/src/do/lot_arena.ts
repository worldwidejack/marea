// Arena PvP nel DO del lotto (docs/ARENA.md, CONTRACTS «Arena»): solo dal DO Arena, mai dal Worker. Il set del duello si salva con
// POST /api/rpg {t:'arena'} come le altre azioni del personaggio.
// POST /arena_start {run, idx} → il duello `run` è aperto nel lotto (questo giocatore è l'eroe idx) → {eroe} = la fotografia del set
// (buildArenaEroe del set salvato, ripulito di quello che non hai più: zaino e Forziere) · /arena_fine {run, ruolo} → premio entro il tetto
// del giorno (finishArena) → {premio, pieno, tetto, lot}.
import type { LotState } from '@marea/sim/economy/types.ts';
import { finishArena, startArena } from '@marea/sim/arena/premio.ts';
import type { ArenaRuolo } from '@marea/sim/arena/premio.ts';
import { buildArenaEroe, loadoutDi, pulisciLoadout } from '@marea/sim/rpg/arena.ts';
import { available } from '@marea/sim/rpg/bag.ts';
import { heroOf } from '@marea/sim/rpg/hero.ts';
import { json } from '../http.ts';

export const ARENA_ACTS = new Set(['arena_start', 'arena_fine']);
const RUOLI = new Set<ArenaRuolo>(['vinta', 'persa', 'pari', 'arreso']);

export function arenaRoute(lot: LotState, act: string, body: Record<string, unknown>, now: number, save: (l: LotState) => void): Response {
  const run = body['run'];
  if (typeof run !== 'string' || !run || run.length > 64) return json({ error: 'Duello non valido' }, 400);
  if (act === 'arena_start') {
    const idx = body['idx'];
    if (idx !== 0 && idx !== 1) return json({ error: 'Duello non valido' }, 400);
    const h = heroOf(lot), ha = (id: string) => available(lot, h, id);
    const eroe = buildArenaEroe(h, pulisciLoadout(h, loadoutDi(h), ha));
    const next = startArena(lot, run, idx, now);
    save(next);
    return json({ eroe });
  }
  const ruolo = body['ruolo'] as ArenaRuolo;
  if (!RUOLI.has(ruolo)) return json({ error: 'Esito non valido' }, 400);
  const out = finishArena(lot, run, ruolo, now);
  if (out.lot !== lot) save(out.lot);
  return json({ premio: out.premio, pieno: out.pieno, tetto: out.tetto, lot: out.lot });
}
