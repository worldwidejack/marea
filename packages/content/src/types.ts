// Tipi dei contenuti data-driven (packages/content). Solo dati: niente logica di gioco.
/** Le risorse di prima (Legno, Pietra, Perle): dal 18 ott 2026 (#414) la valuta è una sola, le **monete** (`LotState.monete`). Restano solo per
 *  il codice spento (edifici del giardino, Faro comune, sfide con posta) e per convertire i vecchi salvataggi (`BALANCE.monete.cambio`). */
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
export type IslandStyle = 'lotto' | 'porto' | 'laguna' | 'neon' | 'selvaggia' | TemaStyle;
/** Isole a tema (#68, GDD §3): stile della resa = id del tema. */
export type TemaStyle = 'tempesta' | 'ghiacci' | 'vulcano' | 'giardino' | 'templari' | 'corse' | 'adrenalina' | 'arena' | 'difesa';
export type IslandSlot = { at: [number, number]; kind: string; rot?: number };
export type IslandProp = { k: string; at: [number, number]; rot?: number };
export type ArchipelagoRole = 'porto' | 'lotto' | 'facciata' | 'laguna' | 'tema' | 'negozio'; // negozio: il dentro del negozio dei mobili (#265), oltre il mare
/**
 * Come si sblocca un'isola a tema (#68): Molo della propria isola al livello N, personaggio GDR al livello N, un cappello indosso,
 * una mappa posseduta (`come: 'oro'` = la prima medaglia d'oro in un minigioco da solo la regala), una reliquia trovata (`LotState.reliquie`:
 * quella dei Templari sta nel relitto sotto il faro della Tempesta), oppure la funivia dell'Adrenalina: si sbarca sempre, ma per salire
 * servono la liberatoria firmata (`LotState.liberatorie`) e il cappello indosso.
 */
export type TemaSblocco =
  | { tipo: 'molo'; livello: number }
  | { tipo: 'livello'; livello: number }
  | { tipo: 'cappello'; cappello: string }
  | { tipo: 'mappa'; mappa: string; come: 'oro' }
  | { tipo: 'reliquia'; reliquia: string }
  | { tipo: 'libera' } // aperta a tutti (Isola delle Corse)
  | { tipo: 'funivia'; cappello: string; liberatoria: string }; // Isola dell'Adrenalina (docs/ADRENALINA.md §2): niente cacciata a terra, il cancello della funivia
/** Isola a tema: `barriera` = metri di mare attorno al rettangolo dell'isola che la barca non passa finché è chiusa (0 = nessuna: ci si arriva, ma a terra ti cacciano). */
export type TemaDef = { sblocco: TemaSblocco; barriera: number };
export type ArchipelagoIsland = { island: string; at: [number, number]; role: ArchipelagoRole; slot?: number; tema?: TemaDef };
/** Il mondo continuo (CONTRACTS §11): isole di islands.json posate su una griglia w×h di celle da `tile` m; il resto è acqua profonda. */
/** `mare` = [w, h] in celle della parte navigabile (dall'angolo in alto a sinistra): oltre stanno i giardini delle case (#237), la barca non ci va. */
export type ArchipelagoDef = { id: string; nome: string; w: number; h: number; tile: number; mare?: [number, number]; islands: ArchipelagoIsland[] };
/** Una scala della casa (#386): sta sulla cella `cell` della stanza `stanza` (da quando la casa è al livello `da`), si prende camminandoci sopra e porta nella stanza `a`, alla cella `arrivo`. */
export type CasaScala = { stanza: 'terra' | 'cantina' | 'piano'; verso: 'giu' | 'su'; cell: [number, number]; a: 'terra' | 'cantina' | 'piano'; arrivo: [number, number]; da: number };
export type CasaLivello = { id: string; nome: string; desc: string; stanza: 'terra' | 'cantina' | 'piano'; pavimento: [number, number, number, number]; monete: number };
/** Borgo Marea (#237): la casa `n` = lo slot `n` (= il lotto/giardino `n`). `at` = cella dell'edificio, `porta` = cella della via davanti, entrambe nel template `borgo`. */
export type BorgoDef = {
  nome: string; case: { at: [number, number]; porta: [number, number] }[];
  /** La stanza della casa nel template `lotto` (#240): pavimento [x0, z0, x1, z1) in celle, altezza dei muri in m, porta in fondo (`retro`),
   *  passaggio del giardino (`giardino`) e corridoio d'ingresso sotto il pavimento (#265: colonna x, righe [z0, z1); in fondo si esce in città). */
  stanza: { pavimento: [number, number, number, number]; altezza: number; retro: [number, number]; giardino: [number, number]; corridoio: [number, number, number] };
  /** Gli ampliamenti della casa (#386), uno alla volta e in ordine (livello 1 = il primo): `stanza` = quale stanza cambia ('terra' = quella di sempre,
   *  poi 'cantina' e 'piano'), `pavimento` = il suo nuovo rettangolo [x0, z0, x1, z1) (contiene quello di prima), `monete` = il prezzo.
   *  Il rettangolo sta tutto dentro la pianta del template `lotto`. */
  casa: { livelli: CasaLivello[]; scale: CasaScala[] };
  /** Il negozio dei mobili (#265): in città (celle del template porto) e dentro (template `negozio`). */
  negozio: { at: [number, number]; porta: [number, number]; rot: number };
  negozioDentro: { pavimento: [number, number, number, number]; corridoio: [number, number, number]; altezza: number; finitura: { pavimento: string; carta: string } };
  /** La pala (#438): si compra al negozio dei mobili (`monete`) e scava buche a Borgo Marea; ogni giorno nasconde un bottino da `bottino` [min, max] monete. */
  pala: { id: string; nome: string; monete: number; bottino: [number, number] };
  /** Pavimenti e carte da parati: il primo è quello di serie. `motivo` = come si dipinge (render/stanza), `colori` dalla palette. */
  pavimenti: StanzaFinitura[]; carte: StanzaFinitura[];
};
/** `monete`: prezzo al negozio dei mobili (#265); assente o 0 = di serie, di tutti. */
export type StanzaFinitura = { id: string; nome: string; motivo?: string; colori: string[]; monete?: number };
/** Un mobile della casa (#265, mobili.json): `posto` terra (celle del pavimento) o parete (una cella di muro), `forma` = render/mobili.ts (assente: scatola di ripiego).
 * `categoria` = una di MOBILI_CATEGORIE (catalogo del negozio); `celle` = ingombro a terra [larghezza, profondità] in celle (default [1,1], a parete sempre 1);
 * `altezza` (m) serve solo alla scatola di ripiego. Ogni mobile può finire nella vetrina del giorno (economy/vetrina.ts). Il modello 3D è `mob_<id>` in manifest_mobili.json.
 * Nome e descrizione del gioco: `nome` qui, descrizione in mobili_testi.json (caricata solo da negozio e ARREDA, non pesa sull'avvio). */
export type MobileDef = { id: string; nome: string; categoria: string; monete: number; posto: 'terra' | 'parete'; forma?: string; colori: string[]; celle?: [number, number]; altezza?: number };
/** `monete`: prezzo (0 = gratis, di tutti). `mercante`: esclusivo del Mercante del Porto (#63): nell'editor si vede ma si compra solo da lui. */
export type HatDef = { id: string; nome: string; monete: number; mercante?: boolean };
export type DecorDef = { id: string; nome: string; monete: number; model: string; mercante?: boolean };
/** Colore della barca (#107): per lo scafo e per la vela; `monete` > 0 = esclusivo del Mercante del Porto (si compra una volta, vale per tutti e due). */
/** `mercante`: esclusiva del Mercante del Porto (sempre in vendita); `cantiere`: vernice del Cantiere navale del Borgo (solo il giorno che è in vetrina, #414). */
export type BarcaColore = { id: string; nome: string; hex: string; monete: number; mercante?: boolean; cantiere?: boolean };
/** La tua barca (#107): colori (id stabili, si aggiunge in fondo), scafo e vela di serie (`vela` 'nessuna' = la barca a remi di prima), nome lungo al massimo `nomeMax`. */
export type BarcaDef = { nomeMax: number; scafo: string; vela: string; colori: BarcaColore[] };
export type AvatarDef = {
  /** Personalizzazione della barca (#107). */
  barca: BarcaDef;
  pelle: string[];
  capelli: string[];
  coloriCapelli: string[];
  /** Nomi da capelli dei colori (#3: «castano», non il nome della palette), stesso ordine di `coloriCapelli`. */
  nomiColoriCapelli?: string[];
  vestiti: string[];
  cappelli: HatDef[];
  emote: string[];
};
export type BalanceDef = {
  /** La valuta (#414): monete di chi comincia, e il cambio fisso dei vecchi salvataggi (monete per 1 Perla, 1 Legno, 1 Pietra; il totale si arrotonda giù). */
  monete: { partenza: number; cambio: Resources };
  /** Risorse vecchie di un lotto nuovo: servono solo al codice spento (edifici del giardino), non si vedono più. */
  partenza: Resources;
  capBase: number;
  bufferOre: number;
  /** Sfide con posta (spente, GDD §7): Perle per medaglia (risorse vecchie). */
  perleMedaglia: { oro: number; argento: number; bronzo: number; sconfitta: number };
  /** Minigiochi da solo (senza posta): monete per medaglia ('nessuna' = arrivato senza medaglia) e quante partite al giorno sono premiate. */
  solo: { premi: { oro: number; argento: number; bronzo: number; nessuna: number }; premiateAlGiorno: number };
  /** Decorazioni (#108): quota del prezzo che torna rivendendole (per difetto). */
  decor: { rimborso: number };
  wager: { min: number; colpoDiCoda: { sogliaRisorse: number; moltiplicatore: number }; scadenzaOre: number; costoExtraPerle: number };
  avatar: { camminata: number; corsa: number; sogliaCorsa: number; raggio: number };
  barca: { accel: number; maxSpeed: number; virata: number; attrito: number; rimbalzo: number; raggioImbarco: number };
};
/** «Mentre eri via» e libro degli ospiti (#86, GDD §2). */
export type RientroCfg = {
  /** Assenza minima (min) perché al rientro compaia la scheda «Mentre eri via». */
  sogliaMinuti: number;
  /** Ogni quanti secondi il client dice al server «ci sono» (così l'assenza si misura da quando sei uscito, non da quando eri entrato). */
  presenzaSecondi: number;
  /** Firme: quante ne tiene il libro di un'isola (le più vecchie escono), quante ne mostra, lunghezza massima del nome. Una al giorno (UTC) per persona e isola. */
  firme: { tetto: number; mostra: number; nomeMax: number };
  /** Il leggio col libro: cella locale [x, z] per id del template dell'isola, da quanti m compare FIRMA, da quanti m si vede il cartello. */
  libro: { lotto: [number, number]; raggio: number; vista: number };
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
// Perle (minigioco universale)
/** Monete in più di un minigioco rispetto a `balance.solo`, per medaglia (si sommano al premio della medaglia). */
export type PremioExtra = Partial<Record<'oro' | 'argento' | 'bronzo', number>>;
/** Snowboard dell'Isola dell'Adrenalina, la parte che serve al giro dei premi (il resto in @marea/content/adrenalina.ts, fuori dal JS iniziale). */
export type SnowboardMgCfg = { id: 'snowboard'; nome: string; premioExtra?: PremioExtra };
/** Caccia alle perle (dalla barca ferma su acqua bassa): vista di profilo del fondale, unità = pixel della schermata. */
export type PerleCfg = {
  id: 'perle';
  nome: string;
  maxSeconds: number;
  /** Dove ci si tuffa: barca quasi ferma (m/s) su acqua bassa ',', nessun molo entro moloM metri (lì A fa scendere a terra). */
  posto: { fermoMs: number; moloM: number };
  /** La corrente porta il sub verso destra: px per tick. */
  velocita: number;
  /** Tieni premuto = `giu` (px/tick²), lascia = `su`; velocità massime e attrito per tick. */
  fisica: { giu: number; su: number; maxGiu: number; maxSu: number; attrito: number };
  /** Profondità del fondale (px sotto il pelo dell'acqua) e distanza tra due punti del profilo. */
  fondale: { min: number; max: number; passo: number };
  /** Aria: durata sott'acqua, ricarica a galla, quanto ridà una bolla e quanto toglie un colpo (frazioni della barra). */
  aria: { secondi: number; ricaricaSecondi: number; bolla: number; colpo: number };
  colpo: { invulnerabileSecondi: number; spinta: number };
  punti: { bianca: number; conchiglia: number; rosa: number; nera: number };
  /** L'ostrica della perla rosa si apre e si chiude: la perla si prende solo aperta. */
  ostrica: { periodoSecondi: number; apertaSecondi: number };
  /** Moltiplicatore delle meduse per difficoltà 1/2/3. */
  pericoli: [number, number, number];
  /** Soglie delle medaglie come frazione dei punti di tutto il fondale. */
  medaglie: { oro: number; argento: number; bronzo: number };
  premioExtra?: PremioExtra;
  autopilota: { orizzonte: number };
};
// fine Perle

// Tempesta: Arrembaggio
export type ArrembaggioNave = 'galeone' | 'brigantino' | 'sloop' | 'tesoro';
/** Arrembaggio (Isola della Tempesta): dal faro spari palle di cannone alle navi pirata. Unità = pixel della schermata (192×136), per tick. */
export type ArrembaggioCfg = {
  id: 'arrembaggio';
  nome: string;
  maxSeconds: number;
  /** Isola a tema dove si gioca (solo a isola aperta) e cella locale [x, z] del posto. */
  isola: string;
  posto: [number, number];
  /** Bocca del cannone [x, y], pelo del mare (y), x oltre cui una palla o una nave è uscita dallo schermo. */
  scena: { cannone: [number, number]; mare: number; uscita: number };
  /** dir = verso della canna (vettore unitario, niente trigonometria); velocità della palla tra vMin e vMax secondo la potenza;
   *  la potenza sale e scende in `caricaSecondi` (su) + `caricaSecondi` (giù) finché tieni premuto; `palle` = munizioni della partita. */
  tiro: { dir: [number, number]; vMin: number; vMax: number; gravita: number; caricaSecondi: number; ricaricaSecondi: number; palle: number };
  /** Vento = spinta orizzontale (px/tick²) tra −max e +max; cambia a raffiche ogni `rafficaSecondi` e ci mette `cambioSecondi`. */
  vento: { max: number; rafficaSecondi: [number, number]; cambioSecondi: number };
  /** peso = quante nel mazzo da cui escono le navi; lungo/alto = sagoma (px); velocità px/tick. */
  navi: Record<ArrembaggioNave, { nome: string; punti: number; lungo: number; alto: number; velocita: number; peso: number }>;
  arrivi: { primoSecondi: number; intervalloSecondi: [number, number] };
  /** Moltiplicatori per difficoltà 1/2/3. */
  difficolta: { velocita: [number, number, number]; vento: [number, number, number] };
  lampiSecondi: [number, number];
  /** Soglie delle medaglie come frazione dei punti di tutte le navi della partita. */
  medaglie: { oro: number; argento: number; bronzo: number };
  premioExtra?: PremioExtra;
};
// fine Tempesta
// Isola delle Corse: Gran Premio (docs/CORSE.md)
/** Un tipo di guida (le 3 da provare): velocità m/s, accelerazione m/s², sterzo rad/s a sterzo pieno, presa e presaDrift 1/s (quanto in
 *  fretta il moto segue il muso), drift = moltiplicatore dello sterzo in derapata. */
export type CorseGuida = { id: string; nome: string; velocita: number; accelerazione: number; sterzo: number; presa: number; presaDrift: number; drift: number };
/** Gran Premio (Isola delle Corse): kart arcade su una pista chiusa, 3 giri contro 4 bot. Metri e secondi. */
export type CorseCfg = {
  id: 'corse';
  nome: string;
  maxSeconds: number;
  /** Isola a tema dove si gioca e cella locale [x, z] del posto (la linea di partenza sull'isola). */
  isola: string;
  posto: [number, number];
  giri: number;
  /** Centro della pista (anello chiuso, metri), campionato ogni `passo` m; larghezza = mezza carreggiata; poi `erba` m di prato e il muro. */
  pista: { nome: string; punti: [number, number][]; passo: number; larghezza: number; erba: number; muro: number };
  kart: { raggio: number; frenata: number; folle: number; sterzoPieno: number; erbaVelocita: number; retro: number };
  guide: CorseGuida[];
  guidaDiSerie: number;
  drift: { velocitaMin: number; autoSecondi: number; autoSterzo: number; tieniSterzo: number; carica: [number, number]; spinta: [number, number]; turbo: number; turboAccelerazione: number };
  bot: {
    nomi: string[]; bravura: number[]; corsia: number; sguardo: [number, number]; sterzo: number;
    elastico: { davanti: number; davantiMax: number; dietro: number; dietroMax: number };
  };
  /** [metri prima del via, lato] dei kart: prima i bot, ultimo tu. */
  griglia: [number, number][];
  scoreBase: number;
  premioExtra?: PremioExtra;
};
// fine Isola delle Corse
// Vulcano: Fuga dalla lava
export type LavaCosa = 'ossidiana' | 'scintilla' | 'rubino';
/** Fuga dalla lava (Isola Vulcano): corsa a scorrimento sulle colonne di basalto. Unità = pixel della schermata (192×136), per tick. */
export type LavaCfg = {
  id: 'lava';
  nome: string;
  maxSeconds: number;
  /** Isola a tema dove si gioca (solo a isola aperta) e cella locale [x, z] del posto. */
  isola: string;
  posto: [number, number];
  /** px per tick verso destra (costante). */
  velocita: number;
  /** y del pelo della lava; altezze delle cime delle colonne (alto = più su). */
  scena: { lava: number; alto: number; basso: number };
  /** salto = spinta verso l'alto; finché tieni premuto (max `tenutoMax` tick) la gravità è `gravitaTenuto`; coyote e anticipo in tick;
   *  gradino = quanto può salire di colpo senza saltare (px). */
  fisica: { gravita: number; gravitaTenuto: number; salto: number; tenutoMax: number; cadutaMax: number; coyote: number; anticipo: number; gradino: number };
  /** Toccare la lava o un geyser: −punti (mai sotto zero), rimbalzo in su, invulnerabile per un po'. */
  scottatura: { punti: number; rimbalzo: number; invulnerabileSecondi: number };
  /** Le rocce che affondano: dopo `ritardoSecondi` dal primo passo scendono di `velocita` px/tick. */
  affonda: { ritardoSecondi: number; velocita: number };
  geyser: { periodoSecondi: [number, number]; attivoSecondi: number; avvisoSecondi: number; alto: number };
  punti: Record<LavaCosa, number>;
  /** Moltiplicatori per difficoltà 1/2/3: probabilità dei geyser, larghezza dei buchi. */
  difficolta: { geyser: [number, number, number]; buchi: [number, number, number] };
  medaglie: { oro: number; argento: number; bronzo: number };
  premioExtra?: PremioExtra;
  autopilota: { orizzonte: number };
};
// fine Vulcano

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

// Ghiacci
/** Pinguini sul ghiaccio (minigioco dell'Isola dei Ghiacci, solo a isola aperta): livelli generati con tools/pinguini_livelli.mjs, scelti dal seed. */
export type PinguiniFascia = { mosse: [number, number]; pinguini: [number, number]; buche: [number, number]; iceberg: [number, number] };
/** Un livello: righe di `lato` caratteri ('.' ghiaccio, '#' iceberg, 'o' buca, 'A' 'B' 'C' i pinguini) e mosse della soluzione più corta. */
export type PinguiniLivello = { righe: string[]; mosse: number };
export type PinguiniCfg = {
  id: 'pinguini';
  nome: string;
  /** Isola a tema dove si gioca (id del template): il posto c'è solo quando è aperta. */
  isola: string;
  /** Cella locale [x, z] dell'isola dove sta il posto. */
  posto: [number, number];
  maxSeconds: number;
  /** Lato della lastra di ghiaccio, in celle. */
  lato: number;
  /** Fasce dei livelli per difficoltà (1, 2, 3): una lettera per livello della partita, nell'ordine. */
  partite: { '1': string[]; '2': string[]; '3': string[] };
  fasce: Record<string, PinguiniFascia>;
  pausaSecondi: number;
  autopilotaSecondi: number;
  /** Livelli risolti per la medaglia. */
  medaglie: { oro: number; argento: number; bronzo: number };
  premioExtra?: PremioExtra;
  /** Livelli per fascia, generati con `node tools/pinguini_livelli.mjs` (la soluzione minima la verificano i test). */
  livelli: Record<string, PinguiniLivello[]>;
};
// fine Ghiacci

// Giardino
/** Carpe koi (minigioco dell'Isola Giardino, solo a isola aperta): stagno visto dall'alto, unità = pixel. */
export type KoiCfg = {
  id: 'koi';
  nome: string;
  isola: string;
  posto: [number, number];
  maxSeconds: number;
  stagno: { w: number; h: number; bordo: number };
  cibo: { ritmo: [number, number]; doppio: number; oro: number; galla: number; caduta: number; chiamata: number };
  carpe: { giro: number; corsa: number; virata: number; mangia: number; bocca: number };
  nera: { velocita: [number, number, number]; vista: number; sazia: number; spavento: number; fuga: number; tocco: number };
  punti: { petalo: number; oro: number; combo: number; comboMax: number };
  /** Frazione dei punti di tutto il cibo (con la combo piena) per la medaglia. */
  medaglie: { oro: number; argento: number; bronzo: number };
  premioExtra?: PremioExtra;
};
// fine Giardino
/** Meteo (#361, rifatto il 16 ott 2026 sulla decisione di Jack del 14 ott): nuvole che si muovono sopra l'arcipelago e decidono il
 *  meteo del posto dove sono. Bianca = solo ombra, grigia = coperto, pioggia, temporale = pioggia e lampi. */
export type NuvolaTipo = 'bianca' | 'grigia' | 'pioggia' | 'temporale';
/** Il tempo che fa in un punto: 'sereno' o il tipo della nuvola che ci sta sopra. */
export type MeteoStato = 'sereno' | NuvolaTipo;
/** Nuvole a corsie (sim/meteo.ts): `corsie` nuvole al massimo; ogni corsia ogni `cicloMin` minuti fa nascere una nuvola con probabilità
 *  `nasce` (entro `nasceEntroMin` dall'inizio del giro), che vive `vitaMin` minuti, cresce e si scioglie in `gradini` passi durante
 *  `transizioneS` secondi. Raggio per tipo, ellisse allungata nel verso in cui va; `bordo` = la fascia (frazione del raggio) dove il
 *  meteo del posto sale a gradini; la pioggia cade entro `pioggiaR` del raggio. Si muovono col vento: `nuvolaMs` m/s più `ventoMs` m/s
 *  col vento pieno; il vento ha un livello ogni `periodoMin` minuti e un verso (attorno a `verso`, ± `sbandamentoGradi`) ogni
 *  `direzioneMin`. Escono dal `campo` da un lato e rientrano dall'altro, sciogliendosi entro `bordoCampoM` dal bordo. */
export type MeteoCfg = {
  seed: string; gradini: number;
  campo: [number, number, number, number]; bordoCampoM: number;
  nuvole: { corsie: number; cicloMin: number; nasce: number; nasceEntroMin: number; vitaMin: [number, number]; transizioneS: number; allungamento: [number, number]; bordo: number; pioggiaR: number };
  tipi: Record<NuvolaTipo, { peso: number; raggio: [number, number] }>;
  vento: { verso: [number, number]; sbandamentoGradi: number; direzioneMin: number; periodoMin: number; livelli: number[]; pesi: number[]; transizioneS: number; nuvolaMs: number; ventoMs: number };
  /** Ogni nuvola di temporale, ogni `ogniS` secondi, fa un lampo con probabilità `prob`, lungo `durataMs`. */
  lampi: { ogniS: number; prob: number; durataMs: number };
  /** Variante B per la scelta di Jack (#361, `?nuvole=b`): numeri che sostituiscono quelli di `nuvole`. Si toglie quando sceglie. */
  provaB?: Partial<MeteoCfg['nuvole']>;
};
