// Tipi dei dati dell'Isola dell'Adrenalina (docs/ADRENALINA.md, CONTRACTS §42). Solo tipi: li importano content, sim e client.
import type { CPuntoDef } from './corse_types.ts';

/** Barra Adrenalina (ADRENALINA §6): un pezzo comune a snowboard, bici e lancio. Valori in frazioni della barra (1 = piena). */
export type BarraCfg = {
  /** Quanto si riempie per ogni rischio, per id del rischio (il gioco sceglie quali usa). */
  riempi: Record<string, number>;
  /** Secondi senza rischi prima che cali, e quanto cala al secondo dopo. */
  calaDopo: number; cala: number;
  /** Soglie dei gradini: sotto la prima ×1, dalla prima ×2, dalla seconda ×3. */
  soglie: [number, number];
};

export type SnowboardTrickId = 'avanti' | 'indietro' | 'giro_dx' | 'giro_sx';
export type SnowboardCfg = {
  nome: string;
  /** Secondi massimi della discesa (poi finisce dov'è). */
  maxSecondi: number;
  fisica: {
    /** Gravità (m/s²): spinge giù per la pendenza e tira giù in aria. */
    gravita: number;
    /** Resistenza dell'aria (1/m: × v²) e della neve (m/s²) a terra. */
    aria: number; attrito: number;
    vmax: number; vPartenza: number; vRipartenza: number;
    /** Velocità di lato (m/s) col dito tutto da una parte, frazione della velocità e tetto. */
    latFrazione: number; latMax: number;
    /** Quanto in fretta la tavola prende la direzione voluta (1/s). */
    presaCurva: number;
    /** Freno della curva stretta (1/s × sterzo²): una curva larga tiene la velocità, una stretta frena. */
    frenoCurva: number;
    /** Neve fresca fuori dal bordo: la velocità scende verso `vNeve` con questa forza (1/s). */
    vNeve: number; frenoNeve: number;
    /** Nel fuoripista la neve alta tiene la velocità sotto `vFuoripista` (stessa forza della neve fresca). */
    vFuoripista: number;
  };
  salto: {
    /** Secondi per caricare tutto il salto (tenendo premuto). */
    carica: number;
    /** Salto da fermo, lasciando fuori dal trampolino (m/s in su): base + carica piena. */
    ollie: number; ollieCarica: number;
    /** Lasciare entro `finestra` s dal bordo del trampolino; entro `grande` s è il salto grande. Senza lasciare si vola basso (`basso` × salto). */
    finestra: number; grande: number; basso: number;
    /** Un salto con più di `lungo` s in aria riempie la barra. */
    lungo: number;
  };
  trick: Record<SnowboardTrickId, { nome: string; durata: number; punti: number }>;
  /** Presa: punti al secondo, e quanto deve durare prima di valere. */
  presa: { puntiSecondo: number; minima: number };
  /** Ogni trick in più nello stesso salto vale `combo` in più (0,5 = +50 %, poi +100 %…). */
  combo: number;
  /** Un trick (o la presa) chiuso a meno di `ultimoIstante` s dall'atterraggio riempie la barra. */
  ultimoIstante: number;
  punti: { porta: number; portaMancata: number; saltoMetro: number };
  /** Rasente: passare a meno di `rasente` m da un albero, una roccia o un palo (oltre il corpo). */
  rasente: number;
  /** Raggio del corpo (m) per gli urti. */
  corpo: number;
  /** Caduta: secondi persi. */
  caduta: number;
};

/** Ostacolo in pista (abete o roccia): s (m lungo la pista), lat (m, + = destra), raggio (m). */
export type SOstacoloDef = { s: number; lat: number; r: number; tipo: 'abete' | 'roccia' };
/** Porta dello slalom: due pali a `lat ± w/2`; `colore` per la resa. */
export type SPortaDef = { s: number; lat: number; w: number; colore: 'rosso' | 'blu' };
/** Trampolino: il bordo a `s`, lungo `lungo` m prima, alto `alto` m (per la resa), lancia a `salto` m/s; `lat` = fascia. */
export type SRampaDef = { s: number; lungo: number; alto: number; salto: number; lat: [number, number]; grande?: boolean };
/** Tratto della pista con un nome (per la resa e i cartelli): pendio, slalom, gola… */
export type SZonaDef = { id: string; nome: string; da: number; a: number };

export type SPistaDef = {
  id: string; nome: string; gioco: 'snowboard'; colore: 'verde' | 'blu' | 'rossa' | 'nera';
  /** Metri tra due campioni del nastro e mezza carreggiata di serie. */
  passo: number; larghezza: number;
  /** Fascia di neve fresca oltre il bordo (m); nelle gole 0 (oltre il bordo c'è la roccia). */
  neve: number;
  punti: CPuntoDef[];
  /** Dove parte e dove arriva (m). */
  partenza: number; arrivo: number;
  porte: SPortaDef[]; rampe: SRampaDef[]; ostacoli: SOstacoloDef[];
  /** Gole: tratti senza neve fresca (rocce a ridosso del bordo). */
  gole: { da: number; a: number }[];
  /** Fuoripista (birbasan, 12 ott 2026): da `da` ad `a` il nastro gira nel bosco su un sentiero stretto di neve fresca (`neve` = fascia
   *  oltre il bordo prima degli alberi); la pista battuta va dritta (`chiusa`: centro, mezza carreggiata, l'abete caduto a `tronco` m dal
   *  bivio) ed è sbarrata. Solo resa: per la sim andare dritti al bivio è finire contro il tronco. */
  fuoripista?: { da: number; a: number; neve: number; chiusa: { punti: [number, number, number][]; l: number; tronco: number } };
  zone: SZonaDef[];
};
