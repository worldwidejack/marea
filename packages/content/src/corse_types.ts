// Tipi dei dati dell'Isola delle Corse, motore v2 (docs/CORSE.md A11). Numeri in corse/motore.json, piste in corse/piste/*.json
// (generate da tools/corse_piste.mjs). Le formule stanno in @marea/sim/corse/*.

/** Famiglie di veicoli (A6): ognuna ha una guida sua. Per ora ci sono Ruote e Acqua; Due ruote e Scivoli arrivano con le loro zone. */
export type CFamigliaId = 'ruote' | 'acqua';

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
  veicolo: { raggio: number; frenata: number; folle: number; sterzoPieno: number; retro: number };
  drift: { velocitaMin: number; autoSecondi: number; autoSterzo: number; tieniSterzo: number; carica: [number, number]; spinta: [number, number]; turbo: number; turboAccelerazione: number };
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
  /** Il pilota automatico la prende (è una scorciatoia). */
  scorciatoia?: boolean;
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
  /** Come si disegna il bordo: muretto di gomme (strada) o boe (acqua). */
  stile: 'strada' | 'acqua';
  punti: CPuntoDef[];
  superfici: (CTrattoDef & { tipo: string })[];
  /** Buchi: niente pista per tutta la larghezza (si salta o si cade). */
  vuoti: CTrattoDef[];
  /** Dove manca il muro: lato −1 sinistra, 1 destra, 0 tutti e due (si può cadere di sotto). */
  senzaMuro: (CTrattoDef & { lato: -1 | 0 | 1 })[];
  /** Rampe: a `s` m lanciano in aria con almeno `salto` m/s. */
  rampe: { s: number; salto: number; lat?: [number, number] }[];
  /** Tappeti del turbo: da `s` per `lungo` m. */
  turbo: { s: number; lungo: number; lat: [number, number] }[];
  rami: CRamoDef[];
  /** [metri dal via (negativi = dietro), scarto laterale] dei bot e, ultimo, il tuo. */
  griglia: [number, number][];
  eventi: CEventoDef[];
};
