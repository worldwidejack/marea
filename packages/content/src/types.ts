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
  /** Serra (docs/RPG.md §6): produce ingredienti (id di rpg/items.json) invece di una risorsa; `rate` = ingredienti/ora, a rotazione. */
  producesItems?: string[];
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
  /** Minigiochi da solo (senza posta): premio per medaglia ('nessuna' = arrivato senza medaglia) e quante partite al giorno sono premiate. */
  solo: { premi: { oro: Resources; argento: Resources; bronzo: Resources; nessuna: Resources }; premiateAlGiorno: number };
  wager: { min: number; colpoDiCoda: { sogliaRisorse: number; moltiplicatore: number }; scadenzaOre: number; costoExtraPerle: number };
  avatar: { camminata: number; corsa: number; sogliaCorsa: number; raggio: number };
  barca: { accel: number; maxSpeed: number; virata: number; attrito: number; rimbalzo: number; raggioImbarco: number };
};
/** Scacco in 3 (Tavolo del Porto): posizioni FEN (solo pezzi), il Bianco fa `mosse` mosse di fila e il Nero sta fermo. */
export type ScacchiCfg = { nome: string; mosse: number; problemi: { fen: string; soluzione: string }[] };

/** Pesca dalla barca (#66), minigioco universale: numeri e pesci in minigames/pesca.json. */
export type PescaRarita = 'comune' | 'noncomune' | 'raro' | 'leggendario';
export type PescaPesce = { id: string; nome: string; rarita: PescaRarita; forma: string; colori: [string, string, string]; battuta: string };
export type PescaCfg = {
  id: 'pesca';
  nome: string;
  maxSeconds: number;
  /** Dove si può pescare: barca quasi ferma (m/s) e nessuna cella non profonda entro rivaM metri. */
  posto: { fermoMs: number; rivaM: number };
  lancioSecondi: number;
  /** Attesa prima che abbocchi [min, max] s, abboccate finte [min, max] e quanto dura una finta. */
  attesa: { secondi: [number, number]; finte: [number, number]; fintaSecondi: number };
  /** Finestra per tirare quando abbocca, per difficoltà 1/2/3. */
  abboccaSecondi: [number, number, number];
  prestoSecondi: number;
  scappatoSecondi: number;
  presoSecondi: number;
  recupero: { maxSecondi: number; strappi: number };
  /** zona = larghezza della zona verde su 1000, velocita = passate della barra al secondo, colpi = tocchi giusti. */
  rarita: Record<PescaRarita, { nome: string; peso: number; punti: number; colpi: number; zona: number; velocita: number }>;
  /** Punti per la medaglia. */
  medaglie: { oro: number; argento: number; bronzo: number };
  autopilotaReazioneSecondi: number;
  pesci: PescaPesce[];
  /** Mari: isole (id di islands.json) che ci stanno vicino e pesci che ci vivono (almeno uno per rarità). */
  mari: Record<string, { nome: string; isole: string[]; pesci: string[] }>;
  mareDiSerie: string;
  mareVicinoM: number;
};
export type RegataCfg = {
  id: 'regata';
  nome: string;
  maxSeconds: number;
  /** Percorso fisso: boe [x, z] in metri locali all'isola, partenza = B del molo. */
  course: { island: string; buoys: [number, number][] };
  buoys: { radius: number };
  wind: { gustEverySeconds: [number, number]; gustSeconds: number; force: number; difficulty: number[] };
  /** Soglie delle medaglie = moltiplicatore × tempo del pilota di riferimento con le raffiche del seed. */
  medalsPar: { oro: number; argento: number; bronzo: number };
  lazyGas: number;
  scoreBase: number;
};

/** Consegne in barca (minigioco universale, GDD §6): il corriere di un molo ti dà un pacco per un altro molo, scelto dal seed.
 *  Ogni pacco ha il suo tempo (base + perMetro × lunghezza della rotta); quello avanzato passa al pacco dopo, le cassette ne aggiungono. */
export type ConsegneCfg = {
  id: 'consegne';
  nome: string;
  maxSeconds: number;
  /** Pacchi della partita: consegnarli tutti = fine (e oro). */
  pacchi: number;
  /** Ruoli delle isole (archipelago.json) i cui moli (la B) fanno da partenza e destinazione. */
  moli: string[];
  /** Distanza in linea d'aria (m) tra un molo e il prossimo. */
  distanza: [number, number];
  /** Consegnato quando la barca passa entro questo raggio (m) dalla B del molo. */
  raggio: number;
  /** Secondi per pacco = base + perMetro[difficoltà − 1] × metri della rotta (+ partenza sul primo, per orientarsi). */
  tempo: { base: number; partenza: number; perMetro: [number, number, number] };
  /** Cassette che galleggiano lungo ogni tratto: `secondi` in più a testa; `scarto` = quanto stanno di lato alla rotta (m). */
  cassette: { perTratto: number; secondi: number; raggio: number; scarto: [number, number] };
  /** Pacchi consegnati per la medaglia. */
  medaglie: { oro: number; argento: number; bronzo: number };
  /** Dove sta il corriere: cella locale [x, z] dell'isola (per id del template), sul molo, lontano dalla barca. */
  posti: Record<string, [number, number]>;
};

/** Ingorgo al porto (minigioco universale, GDD §6): griglia 6×6 di barche ormeggiate, fai uscire la tua dal varco a destra. */
export type IngorgoLivello = {
  /** 6 righe da 6: '.' acqua libera, 'A' la tua barca (orizzontale, terza riga), altre lettere = una barca ciascuna. */
  righe: string[];
  /** Mosse della soluzione più corta (una mossa = una barca spostata di quante celle vuoi). */
  mosse: number;
};
export type IngorgoCfg = {
  id: 'ingorgo';
  nome: string;
  maxSeconds: number;
  /** Fasce dei livelli per difficoltà (1, 2, 3): una lettera per ingorgo della partita, nell'ordine. */
  partite: { '1': string[]; '2': string[]; '3': string[] };
  /** Pausa dopo un ingorgo risolto (la barca esce), prima del prossimo. */
  pausaSecondi: number;
  /** Ritmo dell'autopilota di riferimento: una mossa ogni N secondi. */
  autopilotaSecondi: number;
  /** Ingorghi risolti per la medaglia. */
  medaglie: { oro: number; argento: number; bronzo: number };
  /** Dove si gioca: cella locale [x, z] dell'isola (per id del template), sul molo, lontano dalla barca. */
  posti: Record<string, [number, number]>;
  /** Livelli per fascia, generati con `node tools/ingorgo_livelli.mjs` (la soluzione minima la verificano i test). */
  livelli: Record<string, IngorgoLivello[]>;
};
