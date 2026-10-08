import type { Resources } from '@marea/content';
import type { DungeonLotState, HeroState } from '../rpg/types.ts';
export type { Resources };

export type PlacedBuilding = { id: string; building: string; level: number; cell: [number, number]; buffer: number; lastMs: number };
/** Decorazione posata. `rot` = quarti di giro (0-3) attorno all'asse verticale; assente = 0 (#108). */
export type PlacedDecor = { id: string; decor: string; cell: [number, number]; rot?: number };
export type Construction = { building: string; level: number; endsMs: number; placedId: string };
export type LedgerTotals = { generated: Resources; spent: Resources };
/** Sfide lanciate oggi (giorno UTC = floor(nowMs / 86 400 000)): servono per le sfide gratis del Tavolo. */
export type ChallengeCount = { day: number; used: number };
/** Minigiochi da solo (senza posta): partita aperta dal server (seed) e conteggio del giorno UTC per il tetto dei premi. */
export type SoloPending = { minigame: string; seed: number; difficulty: 1 | 2 | 3; startMs: number; /** Parametri della partita (es. il mare della pesca), già normalizzati dal modulo. */ opzioni?: Record<string, string> };
export type SoloState = { day: number; premiate: number; giocate: number; pending: SoloPending | null };
/** Missioni del giorno della Bacheca (#64): contatori di oggi (giorno UTC) per tipo e indici delle missioni già riscosse. */
export type MissioniState = { day: number; prog: Record<string, number>; riscosse: number[] };
/** Una firma nel libro degli ospiti di un'isola (#86): chi (id), il nome di allora, una delle emote di avatar.json, ms del server. */
export type Firma = { chi: string; nome: string; emote: string; quando: number };
/** Ultimo cantiere finito (lo scrive `advance`): serve a «Mentre eri via» anche se nel frattempo qualcuno ha guardato l'isola. */
export type CantiereFinito = { building: string; level: number; endsMs: number };
/**
 * Faro comune del Porto (#111), visto da un lotto: quando il faro ha raggiunto ogni livello (ms del server, crescenti: li porta il server,
 * `advance` li usa per il bonus di produzione), quanto Legno e Pietra ha versato quest'isola, gli ultimi id dei versamenti (idempotenza).
 */
export type FaroLotto = { livelli: number[]; versato: { legno: number; pietra: number }; doni: string[] };
/**
 * Diario del capitano (#87): quello che conta (pesci, perle, medaglie, partite, spedizioni) lo scrive il server quando verifica una
 * partita; animali e isole arrivano dal client (collezionismo, id validati). `riscossi` = traguardi già pagati, `titolo` = id del
 * traguardo il cui titolo si mostra sotto il nome.
 */
export type DiarioState = {
  pesci: Record<string, number>;
  perle: Record<string, number>;
  medaglie: Record<string, 'oro' | 'argento' | 'bronzo'>;
  giocati: Record<string, number>;
  animali: string[];
  isole: string[];
  dungeon: number;
  riscossi: string[];
  titolo: string | null;
};
export type LotState = {
  owner: string;
  version: number;
  nowMs: number;
  resources: Resources;
  buildings: PlacedBuilding[];
  construction: Construction | null;
  decor: PlacedDecor[];
  escrow: Resources;
  ledger: LedgerTotals;
  boostUntilMs: number;
  /** Assente negli stati vecchi: vale { day: 0, used: 0 }. */
  challenges?: ChallengeCount;
  /** Cappelli a pagamento comprati (id di avatar.json `cappelli`). I gratuiti non ci stanno: sono di tutti. Assente = []. */
  posseduti?: string[];
  /** Poste in escrow per sfida (id sfida → posta): `escrow` è la loro somma. Assente = {}. */
  holds?: Record<string, Resources>;
  /** Ultime sfide già regolate su questo lotto (per rendere idempotente il regolamento). Assente = []. */
  settled?: string[];
  /** Minigiochi da solo. Assente = { day: 0, premiate: 0, giocate: 0, pending: null }. */
  solo?: SoloState;
  /** Missioni della Bacheca del Porto. Assente = nessun progresso oggi. */
  missioni?: MissioniState;
  /** Diario del capitano e traguardi (#87). Assente = album vuoto. */
  diario?: DiarioState;
  /** Personaggio GDR (docs/RPG.md). Assente = newHero() di @marea/sim/rpg/hero.ts. */
  hero?: HeroState;
  /** Forziere dell'isola: id oggetto → quantità. Assente = {}. */
  forziere?: Record<string, number>;
  /** Spedizione nel dungeon aperta dal server. Assente = { pending: null }. */
  dungeon?: DungeonLotState;
  /** Mappe delle isole a tema possedute (#68: la prima medaglia d'oro da solo regala quella del Giardino). Assente = []. */
  mappe?: string[];
  /** Ultima volta (ms del server) che il proprietario era nel gioco (#86): la muovono il rientro e il «ci sono» del client. Assente = mai entrato. */
  visto?: number;
  /** Libro degli ospiti (#86): le firme degli amici, dalla più vecchia, al massimo RIENTRO.firme.tetto. Assente = []. */
  ospiti?: Firma[];
  /** Ultimo cantiere finito (#86). Assente = nessuno. */
  finito?: CantiereFinito;
  /** Faro comune del Porto (#111). Assente = livello 0, niente versato. */
  faro?: FaroLotto;
};

/**
 * Sfida differita (GDD §7, PROTOCOL §4). `from` = sfidante, `to` = chi risponde.
 * Stati: gioca_sfidante (posta di from in escrow, from deve giocare) → aperta (from ha giocato, to può accettare/rifiutare)
 * → accettata (anche la posta di to in escrow) → chiusa. Oppure rifiutata / scaduta (rimborso). Dopo 24 h dalla creazione scade.
 */
export type ChallengeState = 'gioca_sfidante' | 'aperta' | 'accettata' | 'chiusa' | 'rifiutata' | 'scaduta';
export type Challenge = {
  id: string;
  minigame: string;
  difficulty: 1 | 2 | 3;
  seed: number;
  from: string;
  to: string;
  stake: Resources;
  state: ChallengeState;
  createdMs: number;
  expiresMs: number;
  scoreFrom: number | null;
  medalFrom: 'oro' | 'argento' | 'bronzo' | null;
  scoreTo: number | null;
  medalTo: 'oro' | 'argento' | 'bronzo' | null;
  /** Solo a sfida chiusa: chi ha vinto ('pari' = parità, rimborso). */
  winner: 'from' | 'to' | 'pari' | null;
  /** Deciso all'accettazione: se to vince prende 1,5× il piatto. */
  colpoDiCoda: boolean;
  /** Quanto ha preso il vincitore (a sfida chiusa). */
  pot: Resources | null;
  closedMs: number | null;
};

export const ZERO: Resources = { legno: 0, pietra: 0, perle: 0 };
export const RES_KEYS = ['legno', 'pietra', 'perle'] as const;
export const add = (a: Resources, b: Resources): Resources => ({ legno: a.legno + b.legno, pietra: a.pietra + b.pietra, perle: a.perle + b.perle });
export const sub = (a: Resources, b: Resources): Resources => ({ legno: a.legno - b.legno, pietra: a.pietra - b.pietra, perle: a.perle - b.perle });
export const scale = (a: Resources, k: number): Resources => ({ legno: Math.floor(a.legno * k), pietra: Math.floor(a.pietra * k), perle: Math.floor(a.perle * k) });
export const total = (a: Resources): number => a.legno + a.pietra + a.perle;
export const geq = (a: Resources, b: Resources): boolean => a.legno >= b.legno && a.pietra >= b.pietra && a.perle >= b.perle;
/** Quanto manca per coprire `cost` con `have` (componenti ≥ 0). */
export const missing = (have: Resources, cost: Resources): Resources => ({
  legno: Math.max(0, cost.legno - have.legno), pietra: Math.max(0, cost.pietra - have.pietra), perle: Math.max(0, cost.perle - have.perle),
});

export type EconomyErrorCode = 'risorse' | 'cantiere' | 'requisito' | 'cella' | 'livello' | 'sconosciuto' | 'unico' | 'posta' | 'tetto' | 'escrow' | 'cappello' | 'posizione' | 'partita'
  | 'missione' | 'firma' | 'traguardo' | 'faro'
  | 'peso' | 'equip' | 'perk' | 'materiale' | 'edificio' | 'livello_skill' | 'oggetto' | 'spedizione';
export class EconomyError extends Error {
  code: EconomyErrorCode;
  manca: Resources | undefined;
  constructor(code: EconomyErrorCode, msg: string, manca?: Resources) {
    super(msg);
    this.name = 'EconomyError';
    this.code = code;
    this.manca = manca;
  }
}
