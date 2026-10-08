// Tipi della partita a ondate dell'Isola dei Templari (docs/TEMPLARI.md, CONTRACTS «Templari»). Interfaccia fissa tra sim, server (replay)
// e client (resa da `view`). Stessa regola di determinismo del dungeon (vedi dungeon/types.ts): in packages/sim/src/templari/** niente
// Math.sin/cos/atan2/hypot/pow/… e niente `**`, solo + − × ÷ e Math.sqrt. Lo controlla tools/check_static.mjs.
import type { DungeonInput, DungeonView } from '../dungeon/types.ts';
import type { Rng } from '../rng.ts';

/** Input di un tick: mx, my in assi mondo; a = attacca (tieni = carica il giro), b = corri, c = scambia arma, d = AZIONE (posa la
 *  reliquia, ripara la finestra tenendo premuto, compra). Stesso formato e stessa compressione del dungeon (quantizeDungeon, packDungeon,
 *  encodeDungeon): il server li rigioca uguali. */
export type TInput = DungeonInput;

/** `altare` = si aspetta la reliquia; `inizio` = presentazione della prima ondata; `combatti`; `pausa` = respiro tra due ondate. */
export type TFase = 'altare' | 'inizio' | 'combatti' | 'pausa';
/** morto = caduto · alba = 60 minuti passati, sopravvissuto · uscito = lasciata dalla pausa (vale come cadere: contano le ondate superate). */
export type TEsito = 'morto' | 'alba' | 'uscito';
/** Opzioni della partita, decise all'apertura (il server le tiene e le rigioca): `subito` = ondate già partite (bottone ⚔ delle prove). */
export type TOpzioni = { subito?: boolean };

/** Azioni dal menu, tra due tick (registrate col tick come nel dungeon). */
export type TAzione = { t: 'esci' };
export type TAzioni = [number, TAzione][];

export type TZombieAnim = 'sorge' | 'cammina' | 'corre' | 'strappa' | 'prepara' | 'lancia' | 'colpisce' | 'recupera' | 'carica' | 'fugge' | 'morto';

export type TEvento =
  /** Colpo dell'eroe su uno zombie. */
  | { t: 'colpo'; id: number; x: number; z: number; danno: number; uccide: boolean; caricato: boolean }
  /** L'eroe è stato colpito. */
  | { t: 'ferito'; danno: number; x: number; z: number }
  | { t: 'morte'; id: number; tipo: string; x: number; z: number }
  /** Punti guadagnati (o spesi, negativi) e perché. */
  | { t: 'punti'; n: number; perche: 'colpo' | 'uccisione' | 'mischia' | 'asse' | 'spesa' }
  | { t: 'ondata'; n: number }
  | { t: 'ondataFinita'; n: number }
  | { t: 'reliquia' }
  /** Un'asse in meno (zombie) o in più (eroe) sulla finestra `finestra`. */
  | { t: 'asse'; finestra: number; assi: number; da: 'zombie' | 'eroe' }
  | { t: 'sorge'; id: number; x: number; z: number }
  /** Uno zombie grida (il client sceglie il verso: «Deus vult!», rantolo, urlo di chi scatta). */
  | { t: 'grido'; id: number; tipo: 'deus' | 'rantolo' | 'urlo' }
  | { t: 'fendente'; caricato: boolean }
  | { t: 'mancato' }
  | { t: 'caduto' }
  | { t: 'alba' }
  | { t: 'scambia'; arma: string }
  /** Colpo di un'arma a distanza (sparo, freccia, vaso lanciato) e caricatore vuoto o ricarica. */
  | { t: 'sparo'; arma: string; x: number; z: number }
  | { t: 'vuoto'; arma: string }
  | { t: 'ricarica'; arma: string }
  | { t: 'esplosione'; x: number; z: number; r: number }
  /** Colpo fermato da uno scudo: quello dello scudato (`zombie`) o il tuo (`eroe`). */
  | { t: 'parato'; chi: 'eroe' | 'zombie'; x: number; z: number }
  | { t: 'scudo'; preso: boolean }
  | { t: 'scudoRotto' }
  | { t: 'compra'; arma: string; munizioni: boolean }
  /** Cassa del tesoro: si apre (gira), esce un'arma, esce il teschio (la cassa ride e se ne va), ricompare altrove. */
  | { t: 'cassa'; fase: 'gira' | 'arma' | 'teschio' | 'vola' | 'qui' | 'presa'; arma?: string }
  /** Arriva un boss (il corno del cavaliere, de Molay in fiamme); il cavaliere si lancia; de Molay ride e scappa, poi sparisce. */
  | { t: 'boss'; tipo: string }
  | { t: 'corno'; id: number }
  | { t: 'risata'; id: number }
  | { t: 'scompare'; id: number; tipo: string }
  | { t: 'bomba'; x: number; z: number; tx: number; tz: number }
  | { t: 'brucia' };

/** Cosa farebbe AZIONE adesso (il bottone lo dice). */
export type TPrompt = { cosa: 'reliquia' | 'ripara' | 'compra' | 'munizioni' | 'cassa' | 'prendi' | 'scudo'; testo: string; prezzo: number; puoi: boolean } | null;

export type TView = {
  tick: number; fase: TFase;
  /** Ondata in corso (0 prima della prima) e secondi che restano alla fase (presentazione, pausa). */
  ondata: number; faseS: number;
  done: boolean; esito: TEsito | null;
  /** L'eroe nella forma della vista del dungeon: l'attore del client (rpg/dungeon_hero.ts) lo anima così. */
  posa: DungeonView['hero'];
  eroe: {
    x: number; z: number; vita: number; max: number; fiato: number; punti: number;
    /** Ferito da poco (0..1, per il bordo rosso dello schermo). */
    ferita: number;
    arma: string; armi: ({ id: string; colpi: number; riserva: number } | null)[]; cur: number;
    /** Ricarica in corso (0..1, 0 = no). */
    ricarica: number;
    /** Scudo templare: vita, massimo, in mano (sennò sulle spalle). */
    scudo: { vita: number; max: number; inMano: boolean } | null;
  };
  zombie: { id: number; tipo: string; x: number; z: number; fx: number; fz: number; anim: TZombieAnim; t: number; vita: number; max: number; vel: number; boss: boolean }[];
  /** Tiri dei nemici in volo: bombe (con dove cadono e il raggio, per il cerchio a terra) e palle di fuoco; `k` = 0..1 del volo. */
  tiri: { id: number; tipo: 'bomba' | 'palla'; x: number; z: number; tx: number; tz: number; r: number; k: number }[];
  /** Il boss in campo (barra in alto): `fugge` = soglia della vita a cui scappa (de Molay), 0 = si combatte fino in fondo. */
  boss: { id: number; tipo: string; nome: string; vita: number; max: number; fugge: number } | null;
  finestre: { x: number; z: number; assi: number; max: number }[];
  proiettili: { id: number; tipo: 'freccia' | 'palla' | 'vaso'; x: number; z: number; vx: number; vz: number }[];
  fiamme: { id: number; x: number; z: number; r: number; resta: number }[];
  /** Cose a terra da prendere (lo scudo dello scudato), con i secondi che restano. */
  drops: { id: number; tipo: 'scudo'; x: number; z: number; resta: number }[];
  /** Cassa del tesoro: dove sta, cosa fa, l'arma uscita (pronta) e quanto manca alla fase dopo (0..1). */
  cassa: { x: number; z: number; fx: number; fz: number; fase: 'chiusa' | 'gira' | 'pronta' | 'teschio' | 'vola'; arma: string | null; t: number };
  /** Porte (id e se sono aperte). */
  porte: { id: string; aperta: boolean }[];
  prompt: TPrompt;
  /** Zombie ancora da far uscire in questa ondata più quelli vivi. */
  restano: number;
  uccisioni: number;
  eventi: TEvento[];
};

export type TRisultato = {
  done: boolean; esito: TEsito | null; ticks: number;
  /** Ondata a cui sei arrivato e ondate superate (quelle che contano per il premio). */
  ondata: number; superate: number;
  uccisioni: number; punti: number; guadagnati: number;
  hash: number;
};

export type TModulo<S> = {
  id: 'templari'; version: number; maxTicks: number;
  create(o: { seed: number; opzioni?: TOpzioni }): S;
  step(s: S, input: TInput): void;
  act(s: S, a: TAzione): TEvento[] | null;
  result(s: S): TRisultato;
  view(s: S): TView;
  /** Pilota automatico per i test: posa la reliquia, ripara, combatte. */
  autopilot(s: S, rng: Rng): TInput;
};
