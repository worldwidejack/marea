// Tipi dei dati dell'Isola dei Templari (docs/TEMPLARI.md). Numeri in templari/templari.json, arena in templari/mappa.json
// (generata da tools/templari_mappa.mjs). Le formule stanno in @marea/sim/templari/*.

export type TRisorse = { legno: number; pietra: number; perle: number };

/** Arma della partita. `tipo`: mischia (fendente; tenuto = giro), arco (tieni = tendi), fuoco (pistole e moschetti: colpo e ricarica),
 *  lancio (il fuoco greco: un vaso che esplode dove cade e lascia le fiamme). */
export type TArmaDef = {
  id: string; nome: string; tipo: 'mischia' | 'arco' | 'fuoco' | 'lancio';
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
  /** Lancio: raggio dell'esplosione (m) e fiamme che restano a terra (danno al secondo, secondi, raggio). Mischia: `scia` = fiamme dove passa la lama. */
  area?: number; fuoco?: TFiamma; scia?: TFiamma;
  /** Sul muro (wall buy): prezzo dell'arma e delle munizioni (assente = solo dalla cassa). */
  prezzo?: number; prezzoMunizioni?: number;
  /** Peso nella cassa del tesoro (assente = mai dalla cassa); `miracolosa` = rara, la cassa la annuncia. */
  cassa?: number; miracolosa?: boolean;
  /** Aspetto nel client: modello del kit GDR da prendere (o null = procedurale) e colore della lama. */
  aspetto: { modello: string | null; colore: string; forma?: string };
};
export type TFiamma = { dps: number; durata: number; raggio: number };

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
  /** Scudo davanti (coseno del mezzo angolo coperto): i colpi da lì non fanno niente. Morto, lascia lo scudo a terra. */
  scudo?: number;
  /** Da quale ondata compare e quanta parte dell'ondata è sua (base + perOndata × (n − da), al massimo max). Senza: il fante, che fa il resto. */
  da?: number; quota?: { base: number; perOndata: number; max: number };
  /** Boss (Templare a cavallo, de Molay): esce da solo nelle sue ondate, barra della vita in alto, `punti` in più a chi lo abbatte. */
  boss?: boolean; punti?: number;
  /** Cannoniere: bomba lanciata dove sei (cerchio a terra), da `distanza` m, ogni `ricarica` s; esplode dopo `volo` s. */
  bomba?: { danno: number; raggio: number; gittata: number; distanza: number; ricarica: number; volo: number; preparazione: number };
  /** Cavaliere: carica in linea retta verso dove eri quando l'ha vista (si impenna `preparazione` s prima). */
  carica?: { velocita: number; durata: number; danno: number; spinta: number; vista: number; ricarica: number; preparazione: number };
  /** De Molay: fiamme dove passa (ogni `ogni` s), palle di fuoco che lasciano fiamme, e a questa frazione della vita scappa ridendo. */
  scia?: TFiamma & { ogni: number }; palla?: { danno: number; velocita: number; gittata: number; ricarica: number; fuoco: TFiamma }; fugge?: number;
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
  /** Scudo templare: quanti danni regge, coseno del mezzo angolo che copre, velocità con lo scudo in mano, spallata, secondi a terra. */
  scudo: { vita: number; cono: number; lentezza: number; spallata: { danno: number; spinta: number; tempo: number; portata: number }; aTerra: number };
  /** Cassa del tesoro: prezzo, secondi che gira e che resta l'arma da prendere, aperture prima del teschio (a caso tra min e max), secondi per sparire, distanza per usarla. */
  cassa: { prezzo: number; gira: number; pronta: number; usiMin: number; usiMax: number; vola: number; raggio: number };
  /** Boss: il cavaliere nelle ondate da `da` ogni `ogni` (5, 15, 25…) e in tutte le ondate da `insiemeDa`; de Molay ogni `ogni` da `da`
   *  (10, 20, 30…). Nelle ondate dei boss esce questa quota dei fanti; il boss arriva dopo `attesa` s. */
  boss: { cavaliere: { ogni: number; da: number; insiemeDa: number }; molay: { ogni: number; da: number }; quotaFanti: number; attesa: number };
  /** Armi sul muro: distanza per comprarle. */
  muro: { raggio: number };
  /** Premio per ondata superata (fino a `maxOndate`) e tetto del giorno UTC. */
  premio: { perOndata: TRisorse; maxOndate: number; tetto: TRisorse };
};

/** Legenda della mappa dell'arena oltre ai caratteri fissi (tools/templari_mappa.mjs). */
export type TLegenda = { porta?: string; muro?: string };
export type TMappaDef = { tile: number; legenda: Record<string, TLegenda>; rows: string[] };
