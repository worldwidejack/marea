import type { Resources } from '@marea/content';
import type { DungeonLotState, HeroState } from '../rpg/types.ts';
export type { Resources };

import type { CasaState } from './casa.ts';
import type { InsettiState } from './insetti.ts';
import type { PaesaniState } from './paesani.ts';
import type { PesciState } from './pesci.ts';
/** Libro mastro delle monete: entrate e uscite (assente = 0 e 0). */
export type LedgerTotals = { monete?: { generated: number; spent: number } };
/** La conversione di un vecchio salvataggio (#414, `cambio.ts`): quando, quante monete in tutto e da cosa (risorse, edifici spenti, monete del personaggio). */
export type CambioMonete = { ms: number; monete: number; risorse: Resources; edifici: Resources; edificiSpenti: string[]; eroe: number };
/** Minigiochi da solo (senza posta): partita aperta dal server (seed) e conteggio del giorno UTC per il tetto dei premi. */
export type SoloPending = { minigame: string; seed: number; difficulty: 1 | 2 | 3; startMs: number; /** Parametri della partita (es. il mare della pesca), già normalizzati dal modulo. */ opzioni?: Record<string, string> };
export type SoloState = { day: number; premiate: number; giocate: number; pending: SoloPending | null };
/** Missioni del giorno della Bacheca (#64): contatori di oggi (giorno UTC) per tipo e indici delle missioni già riscosse. */
export type MissioniState = { day: number; prog: Record<string, number>; riscosse: number[] };
/** Una firma nel libro degli ospiti di un'isola (#86): chi (id), il nome di allora, una delle emote di avatar.json, ms del server. */
export type Firma = { chi: string; nome: string; emote: string; quando: number };
/**
 * Diario del capitano (#87): quello che conta (pesci, perle, medaglie, partite, spedizioni) lo scrive il server quando verifica una
 * partita; animali e isole arrivano dal client (collezionismo, id validati). I salvataggi di prima possono avere ancora `riscossi` e
 * `titolo` dei traguardi (tolti): non si leggono più.
 */
export type DiarioState = {
  pesci: Record<string, number>;
  perle: Record<string, number>;
  medaglie: Record<string, 'oro' | 'argento' | 'bronzo'>;
  giocati: Record<string, number>;
  animali: string[];
  isole: string[];
  dungeon: number;
};
export type LotState = {
  owner: string;
  version: number;
  nowMs: number;
  /** Le monete (#414): l'unica valuta. I salvataggi di prima (senza) li converte il server in lettura (`economy/cambio.ts`). */
  monete: number;
  /** La conversione del salvataggio vecchio, se c'è stata (per l'avviso al rientro). */
  cambio?: CambioMonete;
  ledger: LedgerTotals;
  /** Il livello della barca al Cantiere navale (1-3: velocità, la Tempesta dal 2). Assente = 1. */
  barca?: number;
  /** Cappelli a pagamento comprati (id di avatar.json `cappelli`). I gratuiti non ci stanno: sono di tutti. Assente = []. */
  posseduti?: string[];
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
  /** Isola dei Templari (docs/TEMPLARI.md): partita a ondate aperta, premio preso oggi (giorno UTC), record. Assente = mai giocato. */
  templari?: TemplariLotto;
  /** Reliquie trovate: aprono le isole a tema con sblocco `reliquia` (la Tempesta nasconde quella dei Templari). Assente = []. */
  reliquie?: string[];
  /** Liberatorie firmate (Isola dell'Adrenalina, docs/ADRENALINA.md §2): con il cappello giusto aprono le isole con sblocco `funivia`. Assente = []. */
  liberatorie?: string[];
  /** La casa arredabile (#265, economy/casa.ts): magazzino dei mobili, mobili posati, pavimenti e carte. Assente = stanza vuota di serie. */
  casa?: CasaState;
  /** Botteghe del Borgo (economy/botteghe.ts): il livello comprato col Fabbro. Assente = 1. */
  botteghe?: { fabbro?: number };
  /** Giorno di Roma (`giornoRoma`) in cui il proprietario ha già scavato il bottino giornaliero di Borgo Marea (#438). Assente = mai. */
  bottinoGiorno?: number;
  /** Gli insetti di Borgo Marea (#445, economy/insetti.ts): visti, posseduti, sassi e alberi di oggi, insetti usciti in attesa. Assente = mai preso niente. */
  insetti?: InsettiState;
  /** I pesci (#457, economy/pesci.ts): visti, posseduti (consegnati al mobiliere), ombre già pescate dei turni recenti. Assente = mai pescato niente. */
  pesci?: PesciState;
  /** I paesani di Borgo Marea (economy/paesani.ts): chi conosci, il favore in corso, i favori presi oggi. Assente = mai parlato con nessuno. */
  paesani?: PaesaniState;
  /** Arena PvP (docs/ARENA.md, arena/premio.ts): duello aperto, monete prese oggi (giorno UTC), partite vinte, perse e pari. Assente = mai giocato. */
  arena?: ArenaLotto;
};
/** Il duello aperto dal DO Arena (`run`, questo giocatore è l'eroe `idx`), monete del premio prese oggi e statistiche. */
export type ArenaLotto = { pending: { run: string; idx: number; startMs: number } | null; giorno: number; preso: number; vinte: number; perse: number; pari: number };
/** Partita a ondate aperta dal server (seed e opzioni da rigiocare), premio del giorno e migliori risultati. `party` = insieme: la partita
 *  `run` del DO TemplariInsieme, dove questo giocatore è l'eroe `idx` (l'esito viene dal log della squadra). */
export type TemplariLotto = {
  /** `classe`: l'eroe scelto nel menù d'ingresso (assente = senza eroe, come prima del menù); insieme gli eroi stanno nel log della squadra. */
  pending: { seed: number; subito: boolean; startMs: number; classe?: string; party?: { run: string; idx: number } } | null;
  /** Monete prese oggi (#414; nei salvataggi di prima un oggetto di risorse: vale 0). */
  giorno: number; preso: number;
  record: number; partite: number;
};

export type EconomyErrorCode = 'risorse' | 'requisito' | 'cella' | 'livello' | 'sconosciuto' | 'unico' | 'tetto' | 'cappello' | 'posizione' | 'partita'
  | 'missione' | 'firma'
  | 'peso' | 'equip' | 'perk' | 'materiale' | 'edificio' | 'livello_skill' | 'oggetto' | 'spedizione';
/** Quanto manca: le monete per quello che si compra. */
export type Mancanza = { monete?: number };
export class EconomyError extends Error {
  code: EconomyErrorCode;
  manca: Mancanza | undefined;
  constructor(code: EconomyErrorCode, msg: string, manca?: Mancanza) {
    super(msg);
    this.name = 'EconomyError';
    this.code = code;
    this.manca = manca;
  }
}
