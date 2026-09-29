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
export type IslandDef = { id: string; nome: string; tile: number; rows: string[] };
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
