// Tipi dei contenuti data-driven (packages/content). Solo dati: niente logica di gioco.
export type Resources = { legno: number; pietra: number; perle: number };
export type ResourceId = keyof Resources;

export type BuildingLevel = {
  cost: Resources;
  seconds: number;
  rate?: number;          // unità/ora prodotte (segheria, cava)
  cap?: number;           // tetto del Magazzino per risorsa
  slots?: number;         // slot cosmetici (Casa)
  wagerMax?: number;      // Tavolo delle Sfide
  freeChallenges?: number;
  boost?: number;         // Faro
  boostHours?: number;
  boatSpeed?: number;     // Molo
};
export type BuildingDef = {
  id: string;
  nome: string;
  size: [number, number];
  model: string;
  produces?: ResourceId;
  requires?: string;
  levels: BuildingLevel[];
};
export type ResourceDef = { id: ResourceId; nome: string; icona: string };
export type IslandDef = {
  id: string; nome: string; tile: number; rows: string[];
  /** Resa e scenografia (render): stile dei materiali e densità della scenografia casuale (1 = normale, 0 = niente). */
  style?: IslandStyle;
  scenery?: number;
  /** Slot edificio con il tipo suggerito (ogni `at` è una cella L dell'isola). Nel Porto sono gli edifici del villaggio. */
  slots?: IslandSlot[];
  /** Decorazioni fisse (render): `at` in celle dall'angolo in alto a sinistra, interi = centro della cella; `rot` = rotazione Y in radianti. */
  props?: IslandProp[];
  /** Rettangoli [x0, z0, x1, z1] (celle, inclusi) di sabbia battuta che la resa lastrica (piazza e viale del Porto). */
  paved?: [number, number, number, number][];
};
export type IslandStyle = 'lotto' | 'porto' | 'laguna' | 'neon' | 'selvaggia';
export type IslandSlot = { at: [number, number]; kind: string; rot?: number };
export type IslandProp = { k: string; at: [number, number]; rot?: number };
export type ArchipelagoRole = 'porto' | 'lotto' | 'facciata' | 'laguna';
export type ArchipelagoIsland = { island: string; at: [number, number]; role: ArchipelagoRole; slot?: number };
/** Il mondo continuo (CONTRACTS §11): isole di islands.json posate su una griglia w×h di celle da `tile` m; il resto è acqua profonda. */
export type ArchipelagoDef = { id: string; nome: string; w: number; h: number; tile: number; islands: ArchipelagoIsland[] };
export type HatDef = { id: string; nome: string; perle: number };
export type DecorDef = { id: string; nome: string; perle: number; model: string };
export type AvatarDef = {
  pelle: string[];
  capelli: string[];
  coloriCapelli: string[];
  vestiti: string[];
  cappelli: HatDef[];
  emote: string[];
};
export type BalanceDef = {
  partenza: Resources;
  capBase: number;
  bufferOre: number;
  perleMedaglia: { oro: number; argento: number; bronzo: number; sconfitta: number };
  wager: { min: number; colpoDiCoda: { sogliaRisorse: number; moltiplicatore: number }; scadenzaOre: number; costoExtraPerle: number };
  avatar: { camminata: number; corsa: number; sogliaCorsa: number; raggio: number };
  barca: { accel: number; maxSpeed: number; virata: number; attrito: number; rimbalzo: number; raggioImbarco: number };
};
export type RegataCfg = {
  id: 'regata';
  nome: string;
  maxSeconds: number;
  buoys: { min: number; max: number; radius: number; spread: number };
  wind: { gustEverySeconds: [number, number]; gustSeconds: number; force: number };
  medals: { oro: number; argento: number; bronzo: number };
  scoreBase: number;
};
