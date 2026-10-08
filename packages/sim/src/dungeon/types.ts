// Tipi della sim del dungeon (CONTRACTS §15). Interfaccia fissa tra sim/dungeon, server (replay) e client (resa da `view`).
// REGOLA DI DETERMINISMO (più severa del resto della sim): il client gira anche su Safari (JavaScriptCore) e il server su V8; le funzioni
// trascendenti non sono garantite identiche bit a bit tra motori. In packages/sim/src/dungeon/** sono VIETATI Math.sin/cos/tan/asin/acos/
// atan/atan2/hypot/pow/exp/log/cbrt e l'operatore **: solo + − × ÷, Math.sqrt (arrotondata correttamente ovunque), floor/round/min/max/abs.
// Le direzioni sono versori (fx, fz), non angoli. Lo controlla tools/check_static.mjs.
import type { AttrId } from '@marea/content/rpg.ts';
import type { EquipSlot, HeroState, RunHero, RunOutcome, RunResult } from '../rpg/types.ts';
import type { Rng } from '../rng.ts';
import type { SwingStyle } from './swing.ts';

/** Input di un tick nel dungeon. mx, my in assi mondo (come InputFrame); a = attacca (tieni = carica/tendi), b = corri, c = magia, d = pozione.
 * Il client registra un frame per tick e lo quantizza con quantizeDungeon (mx, my a 1/8). A sulla scala d'uscita = esci. */
export type DungeonInput = { mx: number; my: number; a: boolean; b: boolean; c: boolean; d: boolean };
export const NO_DUNGEON_INPUT: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
/** RLE: [[ticks, mx×8, my×8, bit a|b<<1|c<<2|d<<3], ...]. */
export type PackedDungeon = [number, number, number, number][];

/** Azione dal menu (non dai tasti), dungeon v5: si applica tra due tick, prima del passo del tick in cui è registrata. Il server la rigioca
 *  con gli input; se non si può fare (oggetto che non hai, lanterna lontana) la sim la ignora. */
export type DungeonAzione =
  | { t: 'equip'; slot: EquipSlot; item: string | null }
  | { t: 'butta'; item: string; n: number }
  /** Sulla lanterna: bottino e monete al sicuro (fino al v4 si salvava da soli passandoci sopra). */
  | { t: 'salva' }
  /** Sulla lanterna: esci col bottino (come dalla scala); alla discesa dopo si può ripartire da lì. */
  | { t: 'esci' }
  /** Insieme (#118): il giocatore se n'è andato (Esci, connessione persa). La registra il server, mai il client: per lui la spedizione
   *  finisce lì senza esito (come chiudere la scheda), gli altri continuano. */
  | { t: 'ritira' };
/** [tick, azione] con tick non decrescenti: tick = passi già fatti quando l'azione è avvenuta. */
export type DungeonAzioni = [number, DungeonAzione][];

export type HeroAnim = 'fermo' | 'cammina' | 'corre' | 'carica' | 'attacca' | 'tende' | 'tira' | 'lancia' | 'beve' | 'colpito' | 'morto';
export type EnemyAnim = 'dorme' | 'veglia' | 'insegue' | 'prepara' | 'colpisce' | 'recupera' | 'scappa' | 'colpito' | 'morto';
/** Insieme (#118) ogni evento porta `eroe`: l'indice dell'eroe a cui è successo (o che l'ha causato). Da solo non c'è. */
export type DungeonEvent = (
  | { t: 'colpo'; x: number; z: number; danno: number; su: 'eroe' | 'nemico'; id?: number; caricato?: boolean; critico?: boolean }
  | { t: 'schivato'; x: number; z: number }
  | { t: 'morte'; id: number; tipo: string }
  | { t: 'raccolto'; item: string; n: number }
  | { t: 'monete'; n: number }
  | { t: 'pieno'; item: string }
  | { t: 'pozione'; id: string }
  | { t: 'magia'; id: string }
  | { t: 'senzaMagicka' }
  | { t: 'senzaFrecce' }
  | { t: 'rotto'; item: string }
  | { t: 'libro'; item: string }
  | { t: 'aggro'; id: number }
  | { t: 'evocato'; id: number; tipo: string }
  /** Toccato l'altare n: bottino al sicuro (il client manda gli input al server, POST /api/dungeon/save). */
  | { t: 'altare'; n: number }
  /** Morto dopo un altare: risvegliato sull'altare n. */
  | { t: 'risveglio'; n: number }
  /** Azione `equip` riuscita: RunHero rifatto (arma in mano, barre, frecce, pozioni). */
  | { t: 'equip'; slot: EquipSlot; item: string | null }
  | { t: 'buttato'; item: string; n: number }
  /** Uscito dalla scala, o dalla lanterna n. */
  | { t: 'uscita'; lanterna?: number }
  /** Insieme: un compagno se n'è andato (azione `ritira`). */
  | { t: 'ritirato' }
  /** Drenaggio: girata la valvola del bacino n (comincia a svuotarsi) · bacino n asciutto (si passa) · geyser che erutta · rallentato. */
  | { t: 'valvola'; n: number }
  | { t: 'asciutto'; n: number }
  | { t: 'geyser'; x: number; z: number }
  | { t: 'rallentato' }
) & { eroe?: number };

export type DungeonView = {
  dungeon: string; tick: number; done: boolean; outcome: RunOutcome | null;
  hero: {
    x: number; z: number; fx: number; fz: number; anim: HeroAnim;
    /** 0..1: fase dell'animazione corrente (swing, tensione, bevuta). */
    t: number;
    /** 0..1 durante la carica / tensione (1 = carico pieno). */
    carica: number;
    /** Solo durante `attacca`: stile del colpo (swing.ts), per animare l'arco che la sim usa davvero. */
    stile?: SwingStyle;
    vita: number; magicka: number; stamina: number; max: Record<AttrId, number>;
    /** Secondi di ricarica della magia rimasti (0 = pronta). */
    ricaricaMagia: number;
    frecce: number; pozioni: number;
    /** Appena risvegliato all'altare: niente danni per qualche secondo. */
    protetto: boolean;
    /** Arma in mano (id, null = pugni): cambia con `equip` o quando si rompe. */
    arma: string | null;
    /** Rallentato dal Tubo-strisciante (Drenaggio). */
    rallentato?: boolean;
  };
  nemici: { id: number; tipo: string; model: string; x: number; z: number; fx: number; fz: number; anim: EnemyAnim; t: number; vita: number; max: number; alleato: boolean; sanguina: boolean; boss: boolean;
    /** Capo del dungeon (ucciso lui, il dungeon è completato): il client gli mette la corona sopra. */
    capo?: boolean;
    /** Raggio in m del colpo ad area dei boss, solo mentre lo prepara (il client disegna il cerchio a terra). */
    area?: number;
    /** Sta preparando un tiro (freccia o magia), non un colpo in mischia: il client mostra l'arco che si tende. */
    tiro?: boolean }[];
  proiettili: { id: number; tipo: 'freccia' | 'magia' | 'freccia_nemica' | 'magia_nemica' | 'acqua_nemica'; x: number; y: number; z: number; vx: number; vz: number }[];
  bottini: { id: number; x: number; z: number; tipo: 'cadavere' | 'forziere' | 'libro'; vuoto: boolean }[];
  uscita: { x: number; z: number };
  vicinoUscita: boolean;
  /** Altari di salvataggio; `attivo` = l'ultimo toccato (lì ti risvegli). */
  altari: { x: number; z: number; attivo: boolean }[];
  /** Lanterna (altare) sotto l'eroe, -1 = nessuna: lì compaiono SALVA ed ESCI. `salvatoQui` = qui non c'è niente di nuovo da salvare. */
  lanterna: number;
  salvatoQui: boolean;
  /** Drenaggio (negli altri dungeon liste vuote): livello di ogni bacino (1 pieno, 0 asciutto), valvole (girate o no), A qui gira una
   *  valvola, geyser in corso (`getto` = erutta, se no è l'avviso; `t` 0..1 nella fase). */
  acque: { n: number; livello: number }[];
  valvole: { x: number; z: number; n: number; aperta: boolean }[];
  vicinoValvola: boolean;
  geyser: { id: number; x: number; z: number; r: number; getto: boolean; t: number }[];
  /** Bottino e monete al sicuro all'ultimo altare (null = nessun altare toccato). */
  salvato: { bottino: Record<string, number>; monete: number } | null;
  zaino: { peso: number; max: number; monete: number; bottino: Record<string, number> };
  /** Solo gli eventi di questo tick (suoni, numeri di danno, toast). */
  eventi: DungeonEvent[];
  /** Insieme (#118): indice del mio eroe (da solo 0), gli altri eroi (da solo []) e se la spedizione è finita per tutti. `done`/`outcome`
   *  qui sopra sono quelli del mio eroe. */
  io: number;
  compagni: CompagnoView[];
  finita: boolean;
};
/** Un compagno visto da me: posa per l'avatar, vita per la barra, finito (uscito, caduto, andato via) = non si disegna più. */
export type CompagnoView = {
  i: number; x: number; z: number; fx: number; fz: number; anim: HeroAnim; t: number; carica: number; stile?: SwingStyle;
  vita: number; max: number; arma: string | null; protetto: boolean; done: boolean; outcome: RunOutcome | null;
};

/** Il modulo della spedizione da solo. Insieme (#118): createParty / stepParty / actParty di dungeon.ts; act, result, view e autopilot
 *  lavorano sull'eroe di turno `s.cur` (il client lo mette sul suo eroe). */
export type DungeonModule<S> = {
  id: 'dungeon';
  version: number;
  /** RPG.dungeon.maxMinuti × 60 × 60. */
  maxTicks: number;
  /** `stato`: il personaggio all'entrata (senza: niente cambi d'equipaggiamento né butta via di quello portato da casa). `partenza`:
   *  lanterna da cui si parte (null = ingresso). */
  create(o: { seed: number; dungeon: string; hero: RunHero; stato?: HeroState | null; partenza?: number | null }): S;
  step(s: S, input: DungeonInput): void;
  /** Azione dal menu adesso (tra due tick): eventi dell'azione, o null se non si può fare (allora non si registra). */
  act(s: S, a: DungeonAzione): DungeonEvent[] | null;
  result(s: S): RunResult;
  view(s: S): DungeonView;
  /** Pilota automatico per i test: esplora, combatte, raccoglie, torna all'uscita. */
  autopilot(s: S, rng: Rng): DungeonInput;
};
