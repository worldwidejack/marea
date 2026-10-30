// Le risposte HTTP che il Worker compone da sé (non quelle che passa così come arrivano dal DO del lotto): un tipo solo, il server lo
// controlla con `satisfies` quando le scrive (apps/server/src/rotte.ts e vicini), il client lo usa quando le legge (apps/client/src/net/api.ts).
import type { LotState } from '@marea/sim/economy/types.ts';
import type { Riepilogo } from '@marea/sim/economy/rientro.ts';
import type { Medal } from '@marea/sim/minigames/types.ts';
import type { PackedInputs } from '@marea/sim/replay.ts';
import type { Look, LookSalvato } from './messages.ts';

/** GET /api/me: chi sei, col look salvato in D1 (anche la barca, se scelta) e il tuo lotto. */
/** `admin`: chi sviluppa MAREA (vede tutto il viaggio rapido). */
export type Me = { id: string; nome: string; look: LookSalvato; lotto: LotState | null; slot?: number | null; now?: number; admin?: boolean };
/** GET /api/persone (tutti) e /api/lots (solo chi ha un'isola). */
export type PersonaVista = { id: string; nome: string; slot: number | null; look: LookSalvato };
/** POST /api/rientro: riepilogo dell'assenza (null se mancavi da poco o è il primo ingresso), novità non lette del feed. */
export type Rientro = { riepilogo: Riepilogo | null; novita: number; lot: LotState; now?: number };

/** Il migliore di un minigioco (oggi o di sempre) nel tabellone del Porto. */
export type RecordVista = { chi: string; nome: string; score: number; medal: Medal; detail: Record<string, number>; quando: number };
export type RecordRiga = { minigame: string; nome: string; oggi: RecordVista | null; sempre: RecordVista | null };
/** GET /api/record: per minigioco il migliore di oggi e di sempre tra gli amici. */
export type RispostaRecord = { voci: RecordRiga[] };
/** Una riga della classifica a punti di un minigioco (Fuga dalla lava): il miglior punteggio di una persona. */
export type RigaPunteggio = { chi: string; nome: string; score: number; detail: Record<string, number>; quando: number };
/** Le prime righe (più la tua, se sei più giù), il tuo posto (0 = non ancora in classifica) e quanti ci sono. */
export type VistaClassifica = { righe: RigaPunteggio[]; posto: number; totale: number };
/** GET /api/classifica?minigame=: oggi e di sempre. Dopo una partita (POST /api/solo/play, campo `classifica`) c'è anche `migliorato`. */
export type RispostaClassifica = { minigame: string; oggi: VistaClassifica; sempre: VistaClassifica; migliorato?: { oggi: boolean; sempre: boolean } };
/** I collezionisti: pesci e insetti consegnati al mobiliere, chi ne ha di più prima. */
export type CollezioneRiga = { id: string; nome: string; pesci: number; insetti: number };
/** GET /api/collezione. */
export type RispostaCollezione = { righe: CollezioneRiga[] };

/** Il fantasma del record di una pista dell'Adrenalina: input da rigiocare, chi (nome e look), tempo finale. */
export type Fantasma = { chi: string; nome: string; ms: number; seed: number; opzioni: Record<string, string>; inputs: PackedInputs; look: Look | null };
/** GET /api/adrenalina/fantasma?pista. */
export type RispostaFantasma = { pista: string; fantasma: Fantasma | null };
