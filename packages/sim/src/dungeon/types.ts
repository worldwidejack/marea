// Tipi della sim del dungeon (CONTRACTS §15). Interfaccia fissa tra sim/dungeon, server (replay) e client (resa da `view`).
// REGOLA DI DETERMINISMO (più severa del resto della sim): il client gira anche su Safari (JavaScriptCore) e il server su V8; le funzioni
// trascendenti non sono garantite identiche bit a bit tra motori. In packages/sim/src/dungeon/** sono VIETATI Math.sin/cos/tan/asin/acos/
// atan/atan2/hypot/pow/exp/log/cbrt e l'operatore **: solo + − × ÷, Math.sqrt (arrotondata correttamente ovunque), floor/round/min/max/abs.
// Le direzioni sono versori (fx, fz), non angoli. Lo controlla tools/check_static.mjs.
import type { AttrId } from '@marea/content/rpg.ts';
import type { RunHero, RunOutcome, RunResult } from '../rpg/types.ts';
import type { Rng } from '../rng.ts';
import type { SwingStyle } from './swing.ts';

/** Input di un tick nel dungeon. mx, my in assi mondo (come InputFrame); a = attacca (tieni = carica/tendi), b = corri, c = magia, d = pozione.
 * Il client registra un frame per tick e lo quantizza con quantizeDungeon (mx, my a 1/8). A sulla scala d'uscita = esci. */
export type DungeonInput = { mx: number; my: number; a: boolean; b: boolean; c: boolean; d: boolean };
export const NO_DUNGEON_INPUT: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
/** RLE: [[ticks, mx×8, my×8, bit a|b<<1|c<<2|d<<3], ...]. */
export type PackedDungeon = [number, number, number, number][];

export type HeroAnim = 'fermo' | 'cammina' | 'corre' | 'carica' | 'attacca' | 'tende' | 'tira' | 'lancia' | 'beve' | 'colpito' | 'morto';
export type EnemyAnim = 'dorme' | 'veglia' | 'insegue' | 'prepara' | 'colpisce' | 'recupera' | 'scappa' | 'colpito' | 'morto';
export type DungeonEvent =
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
  | { t: 'uscita' };

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
  };
  nemici: { id: number; tipo: string; model: string; x: number; z: number; fx: number; fz: number; anim: EnemyAnim; t: number; vita: number; max: number; alleato: boolean; sanguina: boolean; boss: boolean;
    /** Raggio in m del colpo ad area dei boss, solo mentre lo prepara (il client disegna il cerchio a terra). */
    area?: number }[];
  proiettili: { id: number; tipo: 'freccia' | 'magia' | 'freccia_nemica' | 'magia_nemica'; x: number; y: number; z: number; vx: number; vz: number }[];
  bottini: { id: number; x: number; z: number; tipo: 'cadavere' | 'forziere' | 'libro'; vuoto: boolean }[];
  uscita: { x: number; z: number };
  vicinoUscita: boolean;
  /** Altari di salvataggio; `attivo` = l'ultimo toccato (lì ti risvegli). */
  altari: { x: number; z: number; attivo: boolean }[];
  /** Bottino e monete al sicuro all'ultimo altare (null = nessun altare toccato). */
  salvato: { bottino: Record<string, number>; monete: number } | null;
  zaino: { peso: number; max: number; monete: number; bottino: Record<string, number> };
  /** Solo gli eventi di questo tick (suoni, numeri di danno, toast). */
  eventi: DungeonEvent[];
};

export type DungeonModule<S> = {
  id: 'dungeon';
  version: number;
  /** RPG.dungeon.maxMinuti × 60 × 60. */
  maxTicks: number;
  create(o: { seed: number; dungeon: string; hero: RunHero }): S;
  step(s: S, input: DungeonInput): void;
  result(s: S): RunResult;
  view(s: S): DungeonView;
  /** Pilota automatico per i test: esplora, combatte, raccoglie, torna all'uscita. */
  autopilot(s: S, rng: Rng): DungeonInput;
};
