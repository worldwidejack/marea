// Tipi dei dati dell'Isola dei Templari (docs/TEMPLARI.md). Numeri in templari/templari.json, arena in templari/mappa.json
// (generata da tools/templari_mappa.mjs). Le formule stanno in @marea/sim/templari/*.

export type TRisorse = { legno: number; pietra: number; perle: number };

/** Arma della partita. `tipo`: mischia (fendente; tenuto = giro), arco (tieni = tendi), fuoco (pistole e moschetti: colpo e ricarica). */
export type TArmaDef = {
  id: string; nome: string; tipo: 'mischia' | 'arco' | 'fuoco';
  /** Danno di un colpo (arco: a corda tesa; fuoco: per pallino). */
  danno: number;
  /** Mischia: secondi per un fendente. Arco: secondi per tendere al massimo. Fuoco: secondi tra due colpi dello stesso caricatore. */
  tempo: number;
  /** Mischia: portata in m. */
  portata?: number;
  /** Mischia: secondi di carica per il giro e moltiplicatore del danno. */
  carica?: number; caricaMolt?: number;
  /** Mischia: spinta in m a chi colpisci. */
  spinta?: number;
  /** Arco e fuoco: colpi nel caricatore (arco: frecce in faretra) e di riserva alla partenza (massimo). */
  colpi?: number; riserva?: number;
  /** Fuoco: secondi di ricarica. */
  ricarica?: number;
  /** Arco e fuoco: velocità del proiettile (m/s) e gittata (m). */
  velocita?: number; gittata?: number;
  /** Fuoco: pallini per colpo e mezzo angolo del cono (gradi). */
  pallini?: number; cono?: number;
  /** Nemici trapassati da un colpo (oltre al primo). */
  trapassa?: number;
  /** Aspetto nel client: modello del kit GDR da prendere (o null = procedurale) e colore della lama. */
  aspetto: { modello: string | null; colore: string; forma?: string };
};

export type TNemicoDef = {
  id: string; nome: string;
  /** Vita = vita dell'ondata × questo. */
  vitaMolt: number;
  raggio: number;
  /** Velocità (m/s): camminata, corsa e scatto (le ondate decidono chi corre). */
  velocita: { cammina: number; corre: number; scatta: number };
  danno: number;
  /** Portata del colpo (m oltre ai raggi), preparazione (telegrafo) e recupero in secondi. */
  portata: number; preparazione: number; recupero: number;
  /** Ogni quanti secondi strappa un'asse dalla finestra. */
  strappa: number;
  /** Secondi per uscire da terra quando compare. */
  sorge: number;
};

export type TOndateCfg = {
  /** Vita degli zombie all'ondata n: base + perOndata × (n − 1) fino a `finoA`, poi × molt a ondata. */
  vita: { base: number; perOndata: number; finoA: number; molt: number };
  /** Zombie nell'ondata n: base + lin × (n − 1) + quad × (n − 1)², arrotondato, al massimo `max`. */
  quanti: { base: number; lin: number; quad: number; max: number };
  /** Quanti al massimo insieme sulla mappa. */
  insieme: number;
  /** Secondi tra due comparse: base + perOndata × (n − 1), almeno `min`. */
  intervallo: { base: number; perOndata: number; min: number };
  /** Secondi di respiro tra un'ondata e l'altra, e di presentazione della prima. */
  pausa: number; inizio: number;
  /** Chi corre: dall'ondata `da`, frazione + perOndata × (n − da), al massimo `max`. Idem chi scatta. */
  corsa: { da: number; perOndata: number; max: number };
  scatto: { da: number; perOndata: number; max: number };
  /** Comparse attive vicino all'eroe: le N più vicine. */
  comparseVicine: number;
  /** Uno zombie che non si avvicina all'eroe per questi secondi ricompare più vicino. */
  bloccato: number;
};

export type TemplariCfg = {
  version: number;
  maxMinuti: number;
  partenza: { punti: number; arma: string };
  eroe: {
    vita: number; raggio: number;
    /** Secondi senza colpi prima di rigenerare, e vita al secondo. */
    regenDopo: number; regen: number;
    camminata: number; corsa: number;
    /** Secondi di corsa a fiato pieno e secondi per ricaricarlo tutto. */
    fiato: number; fiatoPieno: number;
    /** Mentre attacca o carica cammina a questa frazione. */
    mentreAttacca: number;
  };
  punti: { colpo: number; uccisione: number; mischia: number; asse: number; assiMaxOndata: number };
  /** Finestre: assi per finestra; secondi per rimetterne una (tenendo AZIONE); distanza (m) per ripararla. */
  barricate: { assi: number; ripara: number; raggio: number };
  /** Altare: distanza (m) per POSA LA RELIQUIA. */
  altare: { raggio: number };
  ondate: TOndateCfg;
  armi: TArmaDef[];
  nemici: TNemicoDef[];
  /** Premio per ondata superata (fino a `maxOndate`) e tetto del giorno UTC. */
  premio: { perOndata: TRisorse; maxOndate: number; tetto: TRisorse };
};

/** Legenda della mappa dell'arena oltre ai caratteri fissi (tools/templari_mappa.mjs). */
export type TLegenda = { porta?: string };
export type TMappaDef = { tile: number; legenda: Record<string, TLegenda>; rows: string[] };
