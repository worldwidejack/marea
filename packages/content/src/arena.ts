// @marea/content/arena.ts: dati dell'Arena PvP (docs/ARENA.md): round del duello, loadout (slot, frecce, pozioni), premio col tetto del
// giorno, rete (attesa di chi perde la linea) e la mappa del colosseo (stesso formato dei dungeon). Entry separata da index.ts: la carica
// solo il chunk dell'Arena e il server. Formule in @marea/sim/arena.
import cfg from './arena/arena.json' with { type: 'json' };
import type { DungeonDef } from './rpg_types.ts';

/** La mappa del colosseo: un DungeonDef (stile `colosseo`) più le due partenze [cx, cz, fx, fz] (una per eroe, una di fronte all'altra). */
export type ArenaMappa = DungeonDef & { spawn: [number, number, number, number][] };
export type ArenaCfg = {
  /** Round del duello: `conta` s di conto alla rovescia, `secondi` di gioco, `pausa` s tra un round e l'altro; vince chi arriva a
   *  `vittorie` round; dopo `massimo` round la partita si chiude comunque. A tempo scaduto vince chi ha più Vita: sotto `pariSotto` punti
   *  di differenza il round è pari (non conta). */
  round: { conta: number; secondi: number; pausa: number; vittorie: number; massimo: number; pariSotto: number };
  /** Slot rapidi (armi o magie), frecce per ogni arco (fuori dagli slot), tipo di freccia se non se ne sceglie uno, pozioni rapide. */
  slot: number; frecce: number; frecceBase: string; pozioni: number;
  /** Monete del personaggio a fine partita (vinta, persa) e tetto del giorno UTC. Pareggio, resa e partita lasciata: niente. */
  premio: { vinta: number; persa: number; tetto: number };
  /** Rete: secondi che il duello aspetta chi ha perso la linea (poi è sconfitta), secondi di attesa del caricamento, lettere del codice della sala. */
  rete: { staccatoSecondi: number; caricoSecondi: number; codice: number };
  isola: { island: string; ingresso: [number, number] };
  mappa: ArenaMappa;
};

export const ARENA = cfg as unknown as ArenaCfg;
export const ARENA_MAPPA: ArenaMappa = ARENA.mappa;

/** Controlli dei dati (in italiano): numeri sensati, mappa chiusa con le due partenze sul pavimento e simmetrica (ruotata di mezzo giro). */
export function validateArena(): string[] {
  const errs: string[] = [], c = ARENA, r = c.round;
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (![r.conta, r.secondi, r.pausa, r.vittorie, r.massimo].every(pos) || r.massimo < r.vittorie * 2 - 1) errs.push('arena: round non validi');
  if (!pos(c.slot) || c.slot > 9 || !pos(c.frecce) || !pos(c.pozioni) || c.pozioni > 4) errs.push('arena: slot, frecce o pozioni non validi');
  if (!(c.premio.vinta >= 0 && c.premio.persa >= 0 && c.premio.tetto >= c.premio.vinta)) errs.push('arena: premio non valido');
  const rows = c.mappa.rows, H = rows.length, W = rows[0]?.length ?? 0;
  if (!H || rows.some((x) => x.length !== W)) errs.push('arena: righe della mappa di lunghezze diverse');
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const a = rows[z]![x]!, b = rows[H - 1 - z]![W - 1 - x]!;
    if ((z === 0 || x === 0 || z === H - 1 || x === W - 1) && a !== '#') errs.push(`arena: bordo aperto in ${x},${z}`);
    if (a !== b && a !== '<' && b !== '<') errs.push(`arena: mappa non simmetrica in ${x},${z}`);
  }
  if (c.mappa.spawn.length !== 2) errs.push('arena: servono due partenze');
  for (const [x, z] of c.mappa.spawn) if (rows[z]?.[x] !== '.') errs.push(`arena: partenza ${x},${z} non sul pavimento`);
  return errs;
}
