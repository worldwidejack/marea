// Tipi del personaggio GDR (docs/RPG.md, CONTRACTS §15). Interfaccia fissa tra sim/rpg, sim/dungeon, server e client.
import type { AttrId, EnemyKind, ItemKind, MaterialId, SkillId, Traits, WeaponClass, WeaponTypeId } from '@marea/content/rpg.ts';
import type { DungeonAzioni } from '../dungeon/types.ts';

export type EquipSlot = 'arma' | 'frecce' | 'corpo' | 'anello1' | 'anello2' | 'magia' | 'pozione';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['arma', 'frecce', 'corpo', 'anello1', 'anello2', 'magia', 'pozione'];

/** Il personaggio, salvato dentro LotState.hero (una riga JSON nel DO del lotto). Assente = newHero(). */
export type HeroState = {
  v: 1;
  livello: number;
  /** Esperienza del personaggio verso il prossimo livello. */
  xp: number;
  /** Livelli guadagnati e non ancora assegnati a un attributo (+perLivello). */
  scelte: number;
  /** Punti spesi per attributo (ognuno vale RPG.attributi.perLivello). */
  punti: Record<AttrId, number>;
  perkPunti: number;
  perk: string[];
  skill: Record<SkillId, { lv: number; xp: number }>;
  /** Zaino: id oggetto → quantità. Ogni oggetto con lo stesso id è identico (niente istanze). */
  inv: Record<string, number>;
  /** Equipaggiato: id oggetto (o magia per 'magia'). Un oggetto equipaggiato resta anche contato in `inv`. */
  equip: Partial<Record<EquipSlot, string>>;
  magie: string[];
  monete: number;
  /** Armi fragili (vetro): colpi già dati con la copia in uso, per id. */
  usura: Record<string, number>;
  /** Spedizioni fatte / morti (statistiche). */
  discese: number;
  morti: number;
  /** Dungeon completati (capo ucciso almeno una volta), id in ordine di completamento. Assente = nessuno. */
  completati?: string[];
  /** Per dungeon: la lanterna da cui sei uscito l'ultima volta (azione `esci`): alla discesa dopo puoi ripartire da lì. Assente = nessuna. */
  lanterne?: Record<string, number>;
};

/** Voce del catalogo (generata dalla sim: tipo × materiale + oggetti scritti a mano). La UI la usa per nome, peso, descrizione e statistiche. */
export type ItemDef = {
  id: string; nome: string; kind: ItemKind; peso: number; descr: string; colore: string;
  materiale?: MaterialId; tipo?: WeaponTypeId; classe?: WeaponClass;
  danno?: number; velocita?: number; portata?: number; difesa?: number; tensione?: number; gittata?: number;
  traits?: Traits; unico?: boolean;
  /** Modello 3D (arma in mano, oggetto a terra). */
  model?: string;
  /** Costo di forgia (id oggetto o 'risorsa:legno' → quantità) e livello del Banco; assente = non forgiabile. n = pezzi per forgiata (frecce: 10; assente = 1). */
  forgia?: { costo: Record<string, number>; banco: 1 | 2 | 3; n?: number };
  /** Pozioni, anelli, vesti, libri, armature uniche: come in items.json (R-rpg, facoltativi). */
  cura?: Partial<Record<AttrId, number>>; buff?: { mod: string; valore: number; secondi: number }; mods?: Partial<Record<string, number>>; insegna?: string;
  /** Frecce: gravità in m/s² (R-rpg, facoltativo). */
  gravita?: number;
};

/** Numeri derivati per la UI (scheda del personaggio). */
export type HeroDerived = {
  max: Record<AttrId, number>;
  regen: Record<AttrId, number>;
  carico: number; caricoMax: number;
  difesa: number; malus: number;
  danno: number; velocita: number;
  xpProssimo: number;
  skillProssimo: Record<SkillId, number>;
};

// ---------- fotografia del personaggio per una spedizione (tutti i numeri già con perk, anelli, vesti) ----------
export type RunWeapon = {
  id: string | null;
  kind: 'mischia' | 'arco' | 'pugni';
  skill: SkillId; classe: WeaponClass | null;
  danno: number;
  /** Mischia: secondi per un attacco normale. Arco: secondi per tendere al massimo. */
  tempo: number;
  /** Mischia: portata in m (arco 90° davanti). */
  portata: number;
  /** Secondi di carica per l'attacco caricato e moltiplicatore del danno. */
  carica: number; caricaMolt: number;
  /** Arco: velocità di base della freccia (m/s); si somma a quella della freccia. */
  gittata: number;
  traits: Traits;
  /** Armi fragili (R-rpg, facoltativo): colpi già dati con la copia in uso prima della spedizione (HeroState.usura). */
  usura?: number;
};
export type RunArrows = { id: string; n: number; danno: number; gittata: number; gravita: number; traits: Traits };
export type RunArmor = {
  id: string | null;
  difesa: number;
  /** 0..1: rallentamento di movimento e attacchi. */
  malus: number;
  /** Moltiplicatori del danno preso per tipo (1 = normale; vetro: contundente 2). */
  vsMagia: number; vsTaglio: number; vsContundente: number;
  moneteSuColpito: number;
  /** Ossa: i nemici con `pauroso` ≤ terrore scappano. */
  terrore: number;
  /** Meteorite: peso negativo → moltiplicatore di velocità > 1. */
  velocitaMolt: number;
};
export type RunSpell = { id: string; scuola: 'distruzione' | 'evocazione'; costo: number; ricarica: number; danno: number; velocita: number; raggio: number; sanguina: number; evoca: string | null; durata: number };
export type RunPotion = { id: string; n: number; cura: Partial<Record<AttrId, number>>; buff: { mod: string; valore: number; secondi: number } | null };
/** camminata, corsa, arma.tempo e arma.carica sono SENZA il malus dell'armatura e senza velocitaMolt: li applica la sim del dungeon da `armatura` (R-rpg). */
export type RunHero = {
  livello: number;
  max: Record<AttrId, number>;
  regen: Record<AttrId, number>;
  camminata: number; corsa: number; staminaCorsa: number; mentreCarichi: number; raggio: number;
  arma: RunWeapon;
  frecce: RunArrows | null;
  armatura: RunArmor;
  magie: RunSpell[];
  /** Magia preparata (tasto C): indice in `magie` o null. */
  magia: number | null;
  pozioni: RunPotion[];
  /** Pozione rapida (tasto D): indice in `pozioni` o null. */
  pozione: number | null;
  skill: Record<SkillId, number>;
  carico: number; caricoMax: number;
  /** Peso di ogni oggetto che si può raccogliere nel dungeon (id → kg), per il limite dello zaino. */
  pesi: Record<string, number>;
};

/** Esito di una spedizione (lo calcola la sim del dungeon; il server lo ricalcola rigiocando gli input). */
export type RunOutcome = 'uscito' | 'morto' | 'tempo';
export type RunResult = {
  done: boolean;
  outcome: RunOutcome | null;
  ticks: number;
  /** Raccolto nel dungeon (prima delle regole di morte). */
  bottino: Record<string, number>;
  monete: number;
  xp: Partial<Record<SkillId, number>>;
  /** Consumati: pozioni bevute e frecce tirate (id → n). */
  usati: Record<string, number>;
  /** Armi di vetro rotte (id → copie). */
  rotti: Record<string, number>;
  /** Colpi dati con l'arma fragile in uso (per aggiornare l'usura). */
  usura: Record<string, number>;
  uccisi: Record<string, number>;
  danniFatti: number; danniPresi: number;
  /** Bottino e monete al sicuro all'ultimo altare toccato: si tengono anche con morte, tempo scaduto o partita lasciata a metà (dungeon v2). */
  salvato?: { bottino: Record<string, number>; monete: number } | null;
  /** Morti con risveglio all'altare (dungeon v2). */
  cadute?: number;
  /** Il capo del dungeon (legenda `capo`) è morto in questa spedizione: il dungeon è completato, qualunque sia l'esito. */
  capo?: boolean;
  /** Uscito da questa lanterna (azione `esci`, dungeon v5): la discesa dopo può ripartire da lì. */
  lanterna?: number | null;
  /** Equipaggiamento a fine spedizione, se il dungeon sapeva com'era all'entrata (dungeon v5): il server lo rimette sul personaggio. */
  equip?: Partial<Record<EquipSlot, string>>;
  /** Buttati via dallo zaino portato da casa (dungeon v5; quelli raccolti nel dungeon escono già da `bottino`). */
  buttati?: Record<string, number>;
  hash: number;
};

/** Azioni del personaggio sull'isola (POST /api/rpg). */
export type RpgAction =
  | { t: 'attributo'; attr: AttrId }
  | { t: 'perk'; perk: string }
  | { t: 'equip'; slot: EquipSlot; item: string | null }
  | { t: 'leggi'; item: string }
  | { t: 'forgia'; item: string; n?: number }
  | { t: 'alchimia'; ricetta: string; n?: number }
  | { t: 'compra'; item: string; n: number }
  | { t: 'deposita'; item: string; n: number }
  | { t: 'preleva'; item: string; n: number }
  /** Butta via n oggetti dallo zaino: spariscono. */
  | { t: 'butta'; item: string; n: number }
  | { t: 'serra' }
  /** Contrabbandiere del Porto: compra la merce di oggi o gli vendi roba dello zaino (monete). */
  | { t: 'contrabbando'; op: 'compra' | 'vendi'; item: string; n: number };

/** Spedizione aperta dal server (dentro LotState.dungeon). */
/** `salvataggio`: input fino all'ultimo altare (encodeDungeon), verificati dal server con POST /api/dungeon/save. Se la spedizione non
 * si chiude (scheda chiusa), il server la chiude rigiocandoli: si tiene il bottino dell'altare. */
/** `stato`: il personaggio all'entrata (zaino, equipaggiamento, perk) per rifare RunHero quando si cambia equipaggiamento nel dungeon
 * (dungeon v5; assente nelle spedizioni aperte prima). `partenza`: lanterna da cui si riparte (null = ingresso). `salvataggio.azioni`:
 * le azioni dal menu (DungeonAzioni) fino al salvataggio. */
export type DungeonPending = {
  dungeon: string; seed: number; startMs: number; hero: RunHero;
  stato?: HeroState; partenza?: number | null;
  salvataggio?: { inputs: string; ticks: number; azioni?: DungeonAzioni } | null;
  /** Dungeon insieme (#118): spedizione della squadra `run` (DO Spedizioni), questo eroe è il numero `idx`. Si chiude rigiocando il log
   *  della squadra (replayParty), non con gli input del client. */
  party?: { run: string; idx: number } | null;
};
export type DungeonLotState = { pending: DungeonPending | null };

export type { EnemyKind };
