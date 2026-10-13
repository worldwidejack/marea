// Tipi dei dati dell'Isola delle Corse, motore v2 (docs/CORSE.md A11). Numeri in corse/motore.json, piste in corse/piste/*.json
// (generate da tools/corse_piste.mjs). Le formule stanno in @marea/sim/corse/*.

/** Famiglie di veicoli (A6): ognuna ha una guida sua. Ci sono Ruote, Acqua e Binari (i carrelli da miniera della Giungla, #228);
 *  Due ruote arriva con la sua pista. */
export type CFamigliaId = 'ruote' | 'acqua' | 'binari';

/** La guida sui binari (#228): il carrello sta sempre su una rotaia, la pendenza spinge forte, il GAS è la leva che spinge in piano.
 *  Nelle curve conta la spinta di lato (v² × curvatura): sopra `presa` m/s² il carrello va su due ruote e frena da solo (`frenaBilico`
 *  m/s² per ogni volta il limite in più); in curva non si cade mai, si cade solo dove manca la rotaia. Piegarsi verso l'interno (lo sterzo) alza il limite di `piega` (×); piegati al limite (sopra `carica` × il limite) si carica
 *  il turbo a 3 livelli come il drift, e si scarica uscendo dalla curva. DRIFT = salto: in aria lo sterzo sceglie la rotaia accanto
 *  (`cambio` m/s di lato) e ci si atterra sempre: si cade solo dove manca la rotaia. */
export type CBinariDef = {
  presa: number; piega: number; frenaBilico: number; carica: number; scarica: number;
  salto: number; cambio: number; attrito: number;
  /** Piste ibride: quanto in fretta si piegano (1/s) i veicoli delle altre famiglie agganciati alle rotaie (i carrelli usano il loro `sterzo`). */
  piegaAgganciati: number;
};

export type CFamigliaDef = {
  id: CFamigliaId; nome: string;
  /** Quanto la pendenza toglie o dà velocità in salita e in discesa (× gravità). */
  pendenza: number;
  /** Superficie su cui la famiglia sta «di casa» (asfalto per le ruote, acqua per le barche): dà il colore delle scintille e i suoni. */
  casa: string;
  /** Salto sulle onde (solo acqua): ogni cresta lancia in aria con `salto` × velocità (m/s per m/s), al massimo `max`. */
  onde?: { salto: number; max: number };
  /** Atterraggio dritto (solo acqua): turbo in secondi se il muso è allineato al moto entro `allineato` (seno dell'angolo). */
  atterraggioTurbo?: { secondi: number; allineato: number };
  /** Sterzo tolto a tutta velocità per questa famiglia (al posto di `sterzo.alto`): le barche scivolano già, ne perdono meno (#170). */
  sterzoAlto?: number;
  /** Solo binari: la guida sulle rotaie. */
  binari?: CBinariDef;
};

/** Un veicolo: famiglia e numeri di guida (come le guide morbida / media / nervosa del Gran Premio). */
export type CVeicoloDef = {
  id: string; nome: string; famiglia: CFamigliaId;
  /** m/s in pianura sulla superficie di casa. */
  velocita: number;
  /** m/s². */
  accelerazione: number;
  /** rad/s a sterzo pieno. */
  sterzo: number;
  /** 1/s: quanto in fretta il moto raggiunge il muso (bassa = scivola); in drift `presaDrift`. */
  presa: number; presaDrift: number;
  /** Sterzo in più in drift (×). */
  drift: number;
  /** Peso negli urti tra veicoli: chi pesa di più sposta di più. */
  peso: number;
  /** Il difetto o pregio comico dei veicoli buffi (A6), mostrato nella scelta. */
  buffo?: string;
  /** Buffi: sterzo che tira da solo da una parte (−1..1, + = destra), come la ruota storta del carrello. */
  tira?: number;
  /** Buffi: superfici dove va diverso dalla sua famiglia (es. la vasca da bagno sulla sabbia). */
  effetti?: Record<string, CEffetto>;
  /** Binari: quanto tiene in curva (× `binari.presa` della famiglia). */
  presaCurva?: number;
};

/** Che cosa fa un oggetto (il codice sta in @marea/sim/corse/oggetti.ts): turbo, trappola lasciata dietro, colpo dritto, colpo che
 *  insegue chi sta davanti, scudo. Gli oggetti di zona e quelli da sbloccare riusano questi effetti con numeri e look loro. */
export type COggettoEffetto = 'turbo' | 'trappola' | 'dritto' | 'ricerca' | 'scudo';
/** Un oggetto del catalogo. `livello`: base (in tutte le zone), zona (solo sulle piste di `zona`), sblocco (si guadagna battendo
 *  l'isola `sblocco`: per ora non esce). `pesi` = [primi, metà, ultimi] della classifica. I numeri che non servono all'effetto mancano. */
export type COggettoDef = {
  id: string; nome: string;
  livello: 'base' | 'zona' | 'sblocco';
  zona?: string; sblocco?: string;
  effetto: COggettoEffetto;
  cariche: number;
  pesi: [number, number, number];
  /** turbo e scudo: s. */
  secondi?: number;
  /** trappola: m dietro chi la lascia, m davanti dove atterra se lanciata avanti (USA col freno), durata a terra (s). */
  dietro?: number; lancio?: number; durata?: number;
  /** colpi: m/s, vita (s), quanto in fretta inseguono di lato (m/s). Trappole e colpi: raggio di presa (m). */
  velocita?: number; vita?: number; sterza?: number; raggio?: number;
  /** colpo dritto: di serie va indietro (il masso del tempio; con «dall'altra parte» va avanti). */
  indietro?: boolean;
  /** colpo dritto: m/s di lato, rimbalza da un bordo all'altro della pista (la noce di cocco). */
  rimbalzo?: number;
  /** turbo: per tutti i `secondi` scavalchi trappole e colpi (la liana). */
  scavalca?: boolean;
};
export type COggettiCfg = {
  scatole: { righe: number[]; lat: number[]; raggio: number; ricompare: number; roulette: number };
  colpito: { secondi: number; velocita: number };
  /** Trappole a terra al massimo (le più vecchie spariscono). */
  massimiATerra: number;
  catalogo: COggettoDef[];
};

/** Effetto di una superficie su una famiglia: moltiplicatori di velocità massima, presa e accelerazione. */
export type CEffetto = { velocita: number; presa: number; accelerazione: number };

export type CSuperficieDef = {
  id: string; nome: string;
  per: Record<CFamigliaId, CEffetto>;
  /** Acqua: le barche ci galleggiano e ci sono le onde (salti). */
  acqua?: boolean;
  /** Onde: una cresta ogni `passo` m. */
  onde?: { passo: number };
  /** Spinta della corrente (m/s²) lungo la pista e di lato (+ = destra). */
  spinta?: [number, number];
};

export type CorseMotoreCfg = {
  /** m/s². */
  gravita: number;
  /** Velocità minima per restare attaccati nei giri della morte (m/s): sotto si cade. */
  giroVelocitaMin: number;
  /** Caduta: sotto `quota` m dalla pista si è caduti; dopo `secondi` si riparte da dove si era a terra, con `ripartenza` × velocità massima. */
  caduta: { quota: number; secondi: number; ripartenza: number };
  /** Atterraggio: sopra `duro` m/s di velocità verticale si perde `perdita` (× velocità). */
  atterraggio: { duro: number; perdita: number };
  /** Rampe: velocità verticale minima e quota della velocità che va in salto. */
  rampa: { quota: number };
  /** Turbo dei tappeti di spinta (s). */
  tappetoTurbo: number;
  /** `retro` = velocità massima in retromarcia (m/s), `retroAccelerazione` (m/s²), `retroSterzoPieno` = sopra questi m/s lo sterzo in retro è pieno. */
  veicolo: { raggio: number; frenata: number; folle: number; sterzoPieno: number; retro: number; retroAccelerazione: number; retroSterzoPieno: number };
  /** Urti tra veicoli (#255): quanto rimbalzano (0 = si attaccano, 1 = elastico), spinta di lato minima e massima (m/s) quando ci si
   *  tocca di fianco, quanto in fretta la spinta si smorza (1/s). */
  urti: { rimbalzo: number; spintaMin: number; spintaMax: number; smorza: number };
  /** Sterzo del giocatore (#170): curva del joystick, rampa da tastiera, meno sterzo ad alta velocità. */
  sterzo: { normale: number; lineare: number; rampa: number; ritorno: number; alto: number; da: number };
  /** Drift a 3 livelli: `carica` = secondi per livello, `spinta` = secondi di turbo per livello. */
  drift: {
    velocitaMin: number; autoSecondi: number; autoSterzo: number; tieniSterzo: number; pronto: number;
    carica: [number, number, number]; stringi: number; giro: number; tieni: [number, number]; spinta: [number, number, number]; turbo: number; turboAccelerazione: number;
  };
  /** Tetto dei turbo sommati (s). */
  turbo: { max: number };
  /** Conto alla rovescia (s) e turbo alla partenza: finestra e razzo in s prima del VIA, turbo [buona, razzo] s, ingolfato s fermo. */
  partenza: { secondi: number; finestra: number; razzo: number; turbo: [number, number]; ingolfato: number };
  /** Acrobazia in aria: turbo all'atterraggio (s). */
  acrobazia: { turbo: number };
  /** Scia: distanza [min, max] m dietro, scarto laterale massimo m, velocità minima m/s, secondi per caricarla, turbo s. */
  scia: { metri: [number, number]; lato: number; velocitaMin: number; secondi: number; turbo: number };
  /** Oggetti alla Mario Kart (#250): scatole, colpi, catalogo. Solo nelle gare CON OGGETTI. */
  oggetti: COggettiCfg;
  bot: {
    bravura: number[];
    corsia: number;
    sguardo: [number, number];
    sterzo: number;
    /** Frenano prima delle curve strette: sopra `curva` rad di svolta nei prossimi `sguardo` m tolgono gas (fino a `freno`). */
    prudenza: { metri: number; curva: number; freno: number };
    elastico: { davanti: number; davantiMax: number; dietro: number; dietroMax: number };
    /** Veicoli dei bot per famiglia (id), a giro. */
    veicoli: Record<CFamigliaId, string[]>;
    /** Quanto spingono i bot di una famiglia (× bravura): chi non fa drift né salti sulle onde ne ha bisogno (in acqua erano troppo deboli). */
    bravuraFamiglia: Record<CFamigliaId, number>;
  };
  maxSeconds: number;
  scoreBase: number;
  famiglie: Record<CFamigliaId, CFamigliaDef>;
  veicoli: CVeicoloDef[];
  superfici: Record<string, CSuperficieDef>;
};

/** Punto di controllo del centro pista: posizione (m), mezza carreggiata, «sopra» suggerito (versore; di serie il cielo),
 *  `aderente` = tratto dove si resta attaccati alla pista anche a testa in giù (giri della morte, pareti). */
export type CPuntoDef = { p: [number, number, number]; l?: number; su?: [number, number, number]; aderente?: boolean };
/** Tratto lungo la pista, in metri dal punto 0 (su una pista chiusa `da` > `a` vuol dire che passa dal via); `lat` = fascia laterale
 *  (m, + = destra), di serie tutta la larghezza. */
export type CTrattoDef = { da: number; a: number; lat?: [number, number] };

export type CRamoDef = {
  id: string;
  /** Dove lascia la pista principale e dove la ritrova (m sulla principale). */
  da: number; a: number;
  punti: CPuntoDef[];
  larghezza: number; bordo: number;
  superficie: string; bordoTipo: string;
  superfici?: (CTrattoDef & { tipo: string })[];
  /** Tappeti del turbo sul ramo (`s` in metri del ramo): una scorciatoia con un tappeto all'imbocco conviene davvero. */
  turbo?: { s: number; lungo: number; lat: [number, number] }[];
  /** Il pilota automatico la prende (è una scorciatoia). */
  scorciatoia?: boolean;
  /** Piste miste: le famiglie che la prendono (anche i bot). Senza, la prende solo il pilota automatico, di qualsiasi famiglia. */
  famiglie?: CFamigliaId[];
  /** Piste a binari: le rotaie del ramo (di serie una sola al centro, [0]): un ramo a binari è un bivio. */
  binari?: number[];
};

/** L'inseguitore deterministico delle fughe (l'onda gigante): un fronte che avanza lungo la pista e travolge chi prende.
 *  Velocità = `v0` che sale di `accel` m/s² fino a `vmax`, più `recupero` × i metri oltre `distMax` di vantaggio su di te (non scappi troppo). */
export type CInseguitoreDef = {
  tipo: string;
  /** Dove parte il fronte (m dal via, negativo = dietro). */
  parte: number;
  v0: number; accel: number; vmax: number;
  distMax: number; recupero: number;
  /** Spessore del corpo (m davanti al fronte... dietro il fronte, verso chi scappa) e come ti prende. */
  spessore: number;
  /** Al contatto la velocità si moltiplica per `colpo`; finché si è dentro il corpo il massimo è × `rallenta`. */
  colpo: number; rallenta: number;
};

export type CEventoDef = CTrattoDef & {
  /** Che cosa succede (lo disegna il client): onda, pozzanghera, crollo… */
  tipo: string;
  /** Da quale giro (1 = dal primo). */
  daGiro: number;
  /** La superficie che prende il tratto, oppure `vuoto` (crolla: si cade). */
  superficie: string;
};

export type CPistaDef = {
  id: string; nome: string;
  /** Zona dell'isola (A4): spiaggia, ghiaccio… `prova` = piste del banco di prova. */
  zona: string;
  famiglia: CFamigliaId;
  /** Piste miste (il porto): tutte le famiglie che ci corrono insieme (la prima è `famiglia`). Senza, solo `famiglia`. */
  famiglie?: CFamigliaId[];
  /** Piste miste: scarto laterale (m, + = destra) della corsia di ogni famiglia, dove puntano pilota automatico e bot e dove partono. */
  corsie?: Partial<Record<CFamigliaId, number>>;
  /** Fughe: l'inseguitore (l'onda). */
  inseguitore?: CInseguitoreDef;
  /** circuito = a giri; fuga = da A a B. */
  tipo: 'circuito' | 'fuga';
  giri: number;
  chiusa: boolean;
  /** Metri tra un campione e l'altro del nastro. */
  passo: number;
  /** Linea del via (m dal punto 0). */
  via: number;
  /** Mezza carreggiata di serie (m), bordo oltre la carreggiata prima del muro (m), rimbalzo sul muro (× velocità). */
  larghezza: number; bordo: number; muro: number;
  superficie: string; bordoTipo: string;
  /** Come si disegna il bordo: muretto di gomme (strada), boe (acqua) o rotaie sulle traversine, senza muro (binari). */
  stile: 'strada' | 'acqua' | 'binari';
  punti: CPuntoDef[];
  superfici: (CTrattoDef & { tipo: string })[];
  /** Buchi: niente pista per tutta la larghezza (si salta o si cade); con `lat` solo in quella fascia (una rotaia rotta). */
  vuoti: CTrattoDef[];
  /** Dove manca il muro: lato −1 sinistra, 1 destra, 0 tutti e due (si può cadere di sotto). */
  senzaMuro: (CTrattoDef & { lato: -1 | 0 | 1 })[];
  /** Rampe: a `s` m lanciano in aria con almeno `salto` m/s (e al massimo `max` m/s: il salto non si allunga oltre col turbo, #270). */
  rampe: { s: number; salto: number; max?: number; lat?: [number, number] }[];
  /** Tappeti del turbo: da `s` per `lungo` m. */
  turbo: { s: number; lungo: number; lat: [number, number] }[];
  rami: CRamoDef[];
  /** Piste a binari: scarti laterali (m, + = destra) delle rotaie della principale. I rami hanno le loro (di serie una al centro). */
  binari?: number[];
  /** Piste ibride (#228): i tratti della principale dove ogni veicolo si aggancia alle rotaie `binari` (la miniera) e guida come un
   *  carrello; fuori si sgancia e torna alla sua guida. Anche i rami con `binari` sono agganciati. */
  agganci?: CTrattoDef[];
  /** [metri dal via (negativi = dietro), scarto laterale] dei bot e, ultimo, il tuo. */
  griglia: [number, number][];
  eventi: CEventoDef[];
};
