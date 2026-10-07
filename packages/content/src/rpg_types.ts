// Tipi dei contenuti del Mondo Sotterraneo (docs/RPG.md, CONTRACTS §15). Solo dati: le formule stanno in @marea/sim/rpg e @marea/sim/dungeon.
// I JSON stanno in packages/content/src/rpg/; si importano da `@marea/content/rpg.ts` (MAI da index.ts: il client li carica solo nel chunk GDR).

export type SkillId = 'armiLeggere' | 'armiPesanti' | 'arceria' | 'distruzione' | 'evocazione' | 'navigazione' | 'forgiatura' | 'alchimia';
export const SKILLS: readonly SkillId[] = ['armiLeggere', 'armiPesanti', 'arceria', 'distruzione', 'evocazione', 'navigazione', 'forgiatura', 'alchimia'];
export type AttrId = 'vita' | 'magicka' | 'stamina';
export const ATTRS: readonly AttrId[] = ['vita', 'magicka', 'stamina'];
export type MaterialId = 'legno' | 'bronzo' | 'ferro' | 'argento' | 'oro' | 'vetro' | 'ossa' | 'meteorite';
export type WeaponTypeId = 'nunchaku' | 'katana' | 'ascia' | 'lancia' | 'spadone' | 'martello';
export type WeaponClass = 'leggera' | 'pesante';
/** Famiglia dei nemici: l'argento fa bonus su nonmorto e mostro; le frecce d'argento sono quasi inutili su bestia e umano. */
export type EnemyKind = 'umano' | 'bestia' | 'nonmorto' | 'mostro' | 'costrutto' | 'spettro';

/** Tratti speciali (tabella dei materiali di Riccardo). Tutti facoltativi; la sim del dungeon li legge da RunHero. */
export type Traits = {
  bonusVs?: Partial<Record<EnemyKind, number>>; // moltiplicatore di danno contro una famiglia (argento: nonmorto 2, mostro 2; frecce d'argento: bestia 0.3, umano 0.3)
  dropMolt?: number;           // oro: moltiplica monete e bottino dei nemici uccisi
  moneteColpo?: number;        // probabilità (0..1) di monete extra a ogni colpo a segno (arco d'oro)
  dropRaro?: boolean;          // frecce d'oro: chi uccidi lascia sicuramente il drop raro
  fragile?: number;            // vetro: colpi a segno prima di rompersi (0/assente = mai)
  sanguina?: number;           // danno al secondo per 3 s
  penetra?: number;            // frazione dell'armatura nemica ignorata (meteorite 0.5, schegge 0.25)
  sbilancia?: boolean;         // respinge e interrompe l'attacco nemico (ossa, frecce contundenti)
  trapassa?: boolean;          // frecce eteree: non si fermano al primo nemico
  noGravita?: boolean;         // arco del vuoto: le frecce volano dritte
  moltArgento?: number;        // arco benedetto: moltiplica il bonusVs delle frecce
  staminaTeso?: number;        // arco d'ossa: stamina al secondo mentre è teso
};

export type MaterialDef = {
  id: MaterialId; nome: string;
  /** Colore della palette (ART_BIBLE §2) per lama, icona, tinta del modello. */
  colore: string;
  /** Oggetto che si spende per forgiare (es. 'lingotto_ferro'); il legno si paga col Legno del Magazzino: 'risorsa:legno'. */
  costo: string;
  /** Livello del Banco da Lavoro che lo sblocca. */
  banco: 1 | 2 | 3;
  arma: { danno: number; velocita: number; peso: number; quanti: number; traits?: Traits; descr: string };
  armatura: { difesa: number; peso: number; quanti: number; vsMagia?: number; vsTaglio?: number; vsContundente?: number; moneteSuColpito?: number; terrore?: number; descr: string };
  arco: { danno: number; tensione: number; gittata: number; peso: number; quanti: number; traits?: Traits; descr: string };
  frecce: { danno: number; gittata: number; gravita: number; quanti: number; n: number; traits?: Traits; descr: string };
};
export type WeaponTypeDef = { id: WeaponTypeId; nome: string; classe: WeaponClass; danno: number; velocita: number; portata: number; peso: number; carica: number; caricaMolt: number; model: string; descr: string };

export type ItemKind = 'arma' | 'arco' | 'frecce' | 'armatura' | 'veste' | 'anello' | 'pozione' | 'libro' | 'ingrediente' | 'materiale';
/** Oggetti scritti a mano (anelli, vesti, pozioni, libri, ingredienti, materiali, unici). Armi/armature/archi/frecce dei materiali li genera la sim (tipo × materiale). */
export type ItemDefRaw = {
  id: string; nome: string; kind: ItemKind; peso: number; descr: string;
  /** Per arma/arco/frecce/armatura uniche: base da cui partire + ritocchi. */
  base?: string; danno?: number; velocita?: number; difesa?: number; traits?: Traits;
  /** Anelli e vesti: modificatori piatti. */
  mods?: Partial<Record<ModKey, number>>;
  /** Pozioni. */
  cura?: Partial<Record<AttrId, number>>; buff?: { mod: ModKey; valore: number; secondi: number };
  /** Libri: magia che insegnano. */
  insegna?: string;
  unico?: boolean; colore?: string;
};
/** Chiavi dei modificatori (perk, anelli, vesti, buff). Le legge solo la sim (rpg/derived.ts) quando calcola RunHero. */
export type ModKey =
  | 'vita' | 'magicka' | 'stamina' | 'regenVita' | 'regenMagicka' | 'regenStamina'
  | 'dannoLeggere' | 'dannoPesanti' | 'dannoArco' | 'dannoDistruzione' | 'velocitaLeggere' | 'velocitaPesanti' | 'tensioneArco'
  | 'caricaVeloce' | 'costoDistruzione' | 'costoEvocazione' | 'durataEvocazione' | 'difesa' | 'malusArmatura' | 'peso'
  | 'velocitaCorsa' | 'staminaCorsa' | 'dannoConArmaturaLeggera' | 'velocitaBarca' | 'materialiForgia' | 'potenzaPozioni' | 'resistMagia';

export type SpellDef = {
  id: string; nome: string; scuola: 'distruzione' | 'evocazione'; costo: number; ricarica: number; descr: string;
  /** Distruzione: proiettile. */
  danno?: number; velocita?: number; raggio?: number; sanguina?: number;
  /** Evocazione: alleato (id di enemies.json) per `durata` s. */
  evoca?: string; durata?: number;
  /** Livello di abilità richiesto per leggerne il libro. */
  livello: number;
};
export type PerkDef = { id: string; skill: SkillId; nome: string; descr: string; livello: number; richiede?: string; mods: Partial<Record<ModKey, number>> };
export type RecipeDef = { id: string; nome: string; ingredienti: Record<string, number>; risultato: string; n: number; livello: number };

export type EnemyDef = {
  id: string; nome: string; kind: EnemyKind; model: string;
  vita: number; danno: number; armatura: number; resistMagia?: number;
  velocita: number; vista: number; portata: number; preparazione: number; recupero: number; raggio: number;
  comportamento: 'mischia' | 'arciere' | 'mago';
  proiettile?: { danno: number; velocita: number; ricarica: number; gittata: number };
  /** Il colpo è contundente (raddoppia sulle armature di vetro). */
  contundente?: boolean;
  /** Scappa da chi indossa armatura con `terrore` ≥ questo valore (nemici deboli contro le ossa). */
  pauroso?: number;
  loot: string; xp: number; boss?: boolean;
};
export type LootEntry = { item: string; p: number; n: [number, number]; raro?: boolean };
export type LootTable = { id: string; monete: [number, number]; voci: LootEntry[] };

/** Mappa ASCII, una cella = `tile` m: '#' muro, '.' pavimento, '<' scala d'uscita (anche lo spawn, accanto), ' ' vuoto. Ogni altra lettera la spiega `legenda` (sopra c'è pavimento). */
export type DungeonDef = {
  id: string; nome: string; descr: string; stile: 'grotta' | 'cripta' | 'vuoto'; tile: number;
  /** Difficoltà, invisibile al giocatore: la bussola punta solo al dungeon più facile non ancora completato (docs/RPG.md §2). */
  difficolta: number;
  rows: string[];
  /** `altare`: altare di salvataggio (docs/RPG.md §4): passandoci il bottino raccolto fin lì è al sicuro; morendo dopo si riparte da lì.
   *  `capo` (con `nemico`): ucciso lui, il dungeon è completato (`HeroState.completati`); uno per dungeon. Non cambia il nemico. */
  legenda: Record<string, { nemico?: string; capo?: boolean; forziere?: string; libro?: string; luce?: boolean; colonna?: boolean; altare?: boolean }>;
  /** Dove sta l'ingresso nel mondo: cella di un'isola di islands.json (il modello è `prop_ingresso_<stile>`). */
  ingresso: { island: string; at: [number, number] };
};

export type RpgBalance = {
  attributi: { base: Record<AttrId, number>; perLivello: number; regen: Record<AttrId, number> };
  livelli: { skillIniziale: number; skillMax: number; xpSkill: { base: number; perLivello: number }; xpPersonaggio: { base: number; perLivello: number } };
  movimento: { camminata: number; corsa: number; staminaCorsa: number; raggio: number; mentreCarichi: number };
  peso: { base: number; perStamina: number };
  /** R-rpg, facoltativi: leggera = peso massimo per i perk «con armatura leggera» (vesti e nessuna armatura contano sempre); liberi = kg che non rallentano. */
  armatura: { k: number; malusPerPeso: number; malusMax: number; leggera?: number; liberi?: number };
  /** R-rpg, facoltativi: arma quando non ne hai una; quanto ogni livello di abilità sopra skillIniziale alza danno (armi e magie) e potenza delle pozioni. */
  pugni?: { danno: number; velocita: number; portata: number; carica: number; caricaMolt: number };
  abilita?: { dannoPerLivello: number; potenzaPerLivello: number };
  partenza: { inv: Record<string, number>; equip: Record<string, string>; magie: string[]; monete: number };
  /** altare.protezione: secondi senza danni dopo il risveglio all'altare (i nemici non ti uccidono appena riapri gli occhi). */
  dungeon: { maxMinuti: number; morte: { bottino: number; xp: number }; altare: { protezione: number } };
  xp: Record<string, number>;
  forziere: number[];
  bottega: Record<string, number>;
};
