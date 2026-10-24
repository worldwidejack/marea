// @marea/content/arena.ts: dati dell'Arena PvP (docs/ARENA.md): round del duello, loadout (slot, frecce, pozioni), premio col tetto del
// giorno, rete (attesa di chi perde la linea), gladiatori automatici e le mappe (stesso formato dei dungeon). Entry separata da
// index.ts: la carica solo il chunk dell'Arena e il server. Formule in @marea/sim/arena.
import cfg from './arena/arena.json' with { type: 'json' };
import type { DungeonDef } from './rpg_types.ts';

/** Una mappa dell'Arena: un DungeonDef più i formati che la usano (eroi per squadra: 1 = duello, 2 = 2v2, 3 = 3v3) e le partenze
 *  [cx, cz, fx, fz] di ogni squadra, in ordine: la squadra di k eroi parte dalle prime k. */
export type ArenaMappa = DungeonDef & { formati: number[]; spawn: [number, number, number, number][][] };
export type ArenaGladiatore = { nome: string; look: { pelle: number; capelli: number; coloreCapelli: number; vestito: number; cappello: number } };
export type ArenaCfg = {
  /** Round del duello: `conta` s di conto alla rovescia, `secondi` di gioco, `pausa` s tra un round e l'altro; vince chi arriva a
   *  `vittorie` round; dopo `massimo` round la partita si chiude comunque. A tempo scaduto vince chi ha più Vita (a squadre: la somma):
   *  sotto `pariSotto` punti di differenza il round è pari (non conta). */
  round: { conta: number; secondi: number; pausa: number; vittorie: number; massimo: number; pariSotto: number };
  /** Slot rapidi (armi o magie), frecce per ogni arco (fuori dagli slot), tipo di freccia se non se ne sceglie uno, pozioni rapide. */
  slot: number; frecce: number; frecceBase: string; pozioni: number;
  /** Monete del personaggio a fine partita (vinta, persa) e tetto del giorno UTC. Pareggio, resa e partita lasciata: niente. */
  premio: { vinta: number; persa: number; tetto: number };
  /** Rete: secondi che il duello aspetta chi ha perso la linea (poi è sconfitta), secondi di attesa del caricamento, lettere del codice della
   *  sala, secondi che la coda a squadre aspetta altri giocatori prima di riempire i posti vuoti coi gladiatori automatici. */
  rete: { staccatoSecondi: number; caricoSecondi: number; codice: number; attesaBotSecondi: number };
  /** I gladiatori automatici che riempiono i posti vuoti (nome e look), in ordine. */
  gladiatori: ArenaGladiatore[];
  isola: { island: string; ingresso: [number, number] };
  mappe: ArenaMappa[];
};

export const ARENA = cfg as unknown as ArenaCfg;
/** Eroi per squadra al massimo (3v3). */
export const ARENA_SQUADRA_MAX = 3;

/** La mappa col suo id (il colosseo se non c'è). */
export function arenaMappa(id: string): ArenaMappa { return ARENA.mappe.find((m) => m.id === id) ?? ARENA.mappe[0]!; }
/** La mappa di una partita a squadre di `formato` eroi (1, 2 o 3): una di quelle che lo prevedono, scelta dal seed. */
export function mappaPer(formato: number, seed: number): ArenaMappa {
  const ok = ARENA.mappe.filter((m) => m.formati.includes(formato));
  return ok[(seed >>> 0) % Math.max(1, ok.length)] ?? ARENA.mappe[0]!;
}

/** Controlli dei dati (in italiano): numeri sensati; mappe chiuse, con una scala, simmetriche (ruotate di mezzo giro), con le partenze di
 *  entrambe le squadre sul pavimento (uguali per numero) e tutto il pavimento collegato. */
export function validateArena(): string[] {
  const errs: string[] = [], c = ARENA, r = c.round;
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (![r.conta, r.secondi, r.pausa, r.vittorie, r.massimo].every(pos) || r.massimo < r.vittorie * 2 - 1) errs.push('arena: round non validi');
  if (!pos(c.slot) || c.slot > 9 || !pos(c.frecce) || !pos(c.pozioni) || c.pozioni > 4) errs.push('arena: slot, frecce o pozioni non validi');
  if (!(c.premio.vinta >= 0 && c.premio.persa >= 0 && c.premio.tetto >= c.premio.vinta)) errs.push('arena: premio non valido');
  if (!pos(c.rete.attesaBotSecondi)) errs.push('arena: attesa dei gladiatori non valida');
  if (c.gladiatori.length < ARENA_SQUADRA_MAX * 2 - 1) errs.push('arena: servono almeno 5 gladiatori automatici');
  for (const m of c.mappe) errs.push(...validaMappa(m));
  for (let f = 1; f <= ARENA_SQUADRA_MAX; f++) if (!c.mappe.some((m) => m.formati.includes(f))) errs.push(`arena: nessuna mappa per il formato ${f}`);
  return errs;
}
function validaMappa(m: ArenaMappa): string[] {
  const errs: string[] = [], rows = m.rows, H = rows.length, W = rows[0]?.length ?? 0, qui = `arena ${m.id}`;
  if (!H || rows.some((x) => x.length !== W)) return [`${qui}: righe della mappa di lunghezze diverse`];
  if (!m.formati.length || m.formati.some((f) => !Number.isInteger(f) || f < 1 || f > ARENA_SQUADRA_MAX)) errs.push(`${qui}: formati non validi`);
  if (rows.join('').split('<').length !== 2) errs.push(`${qui}: serve una sola scala '<'`);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const a = rows[z]![x]!, b = rows[H - 1 - z]![W - 1 - x]!;
    if ((z === 0 || x === 0 || z === H - 1 || x === W - 1) && a !== '#') errs.push(`${qui}: bordo aperto in ${x},${z}`);
    if (a !== b && a !== '<' && b !== '<') errs.push(`${qui}: mappa non simmetrica in ${x},${z}`);
    if (a !== '#' && a !== '.' && a !== '<' && !m.legenda[a]) errs.push(`${qui}: lettera '${a}' senza legenda in ${x},${z}`);
  }
  const k = Math.max(...m.formati);
  if (m.spawn.length !== 2 || m.spawn.some((s) => s.length < k)) errs.push(`${qui}: servono ${k} partenze per squadra`);
  for (const lista of m.spawn) for (const [x, z] of lista) if (rows[z]?.[x] !== '.' && rows[z]?.[x] !== 'E') errs.push(`${qui}: partenza ${x},${z} non sul pavimento`);
  // tutto il pavimento si raggiunge dalle partenze (muri, colonne e muretti fermano i passi)
  const libero = (x: number, z: number) => { const ch = rows[z]?.[x]; return ch !== undefined && ch !== '#' && !m.legenda[ch]?.colonna && !m.legenda[ch]?.grata; };
  const p0 = m.spawn[0]?.[0];
  if (p0) {
    const visti = new Set<number>([p0[1] * W + p0[0]]), coda = [p0[1] * W + p0[0]];
    while (coda.length) {
      const i = coda.pop()!, x = i % W, z = (i - x) / W;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, nz = z + dz, j = nz * W + nx; if (libero(nx, nz) && !visti.has(j)) { visti.add(j); coda.push(j); } }
    }
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (libero(x, z) && !visti.has(z * W + x)) errs.push(`${qui}: ${x},${z} non si raggiunge`);
  }
  return errs;
}
