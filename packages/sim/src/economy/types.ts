import type { Resources } from '@marea/content';
import type { DungeonLotState, HeroState } from '../rpg/types.ts';
export type { Resources };

import type { CasaState } from './casa.ts';
import type { InsettiState } from './insetti.ts';
import type { PaesaniState } from './paesani.ts';
import type { PesciState } from './pesci.ts';
export type PlacedBuilding = { id: string; building: string; level: number; cell: [number, number]; buffer: number; lastMs: number; rot?: number };
/** Edificio riposto nel magazzino dell'isola (#403). */
export type StoredBuilding = { id: string; building: string; level: number; buffer: number; lastMs: number; rot?: number };
/** Decorazione posata. `rot` = quarti di giro (0-3) attorno all'asse verticale; assente = 0 (#108). */
export type PlacedDecor = { id: string; decor: string; cell: [number, number]; rot?: number };
export type Construction = { building: string; level: number; endsMs: number; placedId: string };
/** Libro mastro: `generated`/`spent` = le risorse di prima (codice spento), `monete` = entrate e uscite di monete (#414; assente = 0 e 0). */
export type LedgerTotals = { generated: Resources; spent: Resources; monete?: { generated: number; spent: number } };
/** La conversione di un vecchio salvataggio (#414, `cambio.ts`): quando, quante monete in tutto e da cosa (risorse, edifici spenti, monete del personaggio). */
export type CambioMonete = { ms: number; monete: number; risorse: Resources; edifici: Resources; edificiSpenti: string[]; eroe: number };
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
  /** Le monete (#414): l'unica valuta. I salvataggi di prima (senza) li converte il server in lettura (`economy/cambio.ts`). */
  monete: number;
  /** La conversione del salvataggio vecchio, se c'è stata (per l'avviso al rientro). */
  cambio?: CambioMonete;
  /** Risorse di prima (Legno, Pietra, Perle): solo per il codice spento del giardino, non si vedono e non si spendono più. */
  resources: Resources;
  buildings: PlacedBuilding[];
  /** Edifici riposti nel magazzino dell'isola (#403): assente = []. */
  magazzinoEdifici?: StoredBuilding[];
  construction: Construction | null;
  decor: PlacedDecor[];
  /** Poste delle vecchie sfide (risorse di prima, codice tolto): resta per il libro mastro. */
  escrow: Resources;
  ledger: LedgerTotals;
  boostUntilMs: number;
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
  /** Ultimo cantiere finito (#86). Assente = nessuno. */
  finito?: CantiereFinito;
  /** Isola dei Templari (docs/TEMPLARI.md): partita a ondate aperta, premio preso oggi (giorno UTC), record. Assente = mai giocato. */
  templari?: TemplariLotto;
  /** Reliquie trovate: aprono le isole a tema con sblocco `reliquia` (la Tempesta nasconde quella dei Templari). Assente = []. */
  reliquie?: string[];
  /** Liberatorie firmate (Isola dell'Adrenalina, docs/ADRENALINA.md §2): con il cappello giusto aprono le isole con sblocco `funivia`. Assente = []. */
  liberatorie?: string[];
  /** La casa arredabile (#265, economy/casa.ts): magazzino dei mobili, mobili posati, pavimenti e carte. Assente = stanza vuota di serie. */
  casa?: CasaState;
  /** Botteghe del Borgo (#414, economy/botteghe.ts): il livello comprato col Fabbro (la barca del Cantiere è il livello del Molo). Assente = 1, o quello del Banco da Lavoro di prima. */
  botteghe?: { fabbro?: number };
  /** Giorno di Roma (`giornoRoma`) in cui il proprietario ha già scavato il bottino giornaliero di Borgo Marea (#438). Assente = mai. */
  bottinoGiorno?: number;
  /** Gli insetti di Borgo Marea (#445, economy/insetti.ts): visti, posseduti, sassi e alberi di oggi, insetti usciti in attesa. Assente = mai preso niente. */
  insetti?: InsettiState;
  /** I pesci (#457, economy/pesci.ts): visti, posseduti (consegnati al mobiliere), ombre già pescate dei turni recenti. Assente = mai pescato niente. */
  pesci?: PesciState;
  /** I paesani di Borgo Marea (#493, economy/paesani.ts): chi conosci, il favore in corso, i favori presi oggi. Assente = mai parlato con nessuno. */
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

export const ZERO: Resources = { legno: 0, pietra: 0, perle: 0 };
export const add = (a: Resources, b: Resources): Resources => ({ legno: a.legno + b.legno, pietra: a.pietra + b.pietra, perle: a.perle + b.perle });
export const sub = (a: Resources, b: Resources): Resources => ({ legno: a.legno - b.legno, pietra: a.pietra - b.pietra, perle: a.perle - b.perle });
export const scale = (a: Resources, k: number): Resources => ({ legno: Math.floor(a.legno * k), pietra: Math.floor(a.pietra * k), perle: Math.floor(a.perle * k) });
export const total = (a: Resources): number => a.legno + a.pietra + a.perle;
export const geq = (a: Resources, b: Resources): boolean => a.legno >= b.legno && a.pietra >= b.pietra && a.perle >= b.perle;
/** Quanto manca per coprire `cost` con `have` (componenti ≥ 0). */
export const missing = (have: Resources, cost: Resources): Resources => ({
  legno: Math.max(0, cost.legno - have.legno), pietra: Math.max(0, cost.pietra - have.pietra), perle: Math.max(0, cost.perle - have.perle),
});

export type EconomyErrorCode = 'risorse' | 'cantiere' | 'requisito' | 'cella' | 'livello' | 'sconosciuto' | 'unico' | 'tetto' | 'cappello' | 'posizione' | 'partita'
  | 'missione' | 'firma' | 'traguardo'
  | 'peso' | 'equip' | 'perk' | 'materiale' | 'edificio' | 'livello_skill' | 'oggetto' | 'spedizione';
/** Quanto manca: `monete` per tutto quello che si compra (#414); le risorse di prima solo nel codice spento. */
export type Mancanza = Partial<Resources> & { monete?: number };
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
