// @marea/content/sparo.ts: numeri dello sparatutto a missioni (banco provasparo.html, #355; docs/SPARO.md). Entry separata come
// corse_discesa.ts: la caricano solo il chunk dello sparatutto (apps/client/src/sparo/**), la sim (packages/sim/src/sparo/), i test.
// Unità: metri, secondi, gradi per gli angoli scritti a mano (la sim li converte in radianti). Prima ipotesi: si tarano con Jack.
import dati from './sparo.json' with { type: 'json' };

/** Un'arma. `danno` è per colpo (col pompa per pallino), `testa` il moltiplicatore sul colpo alla testa, `cadenza` i secondi tra
 *  due colpi; `auto` = tenendo premuto spara di continuo. `ricaricaUno`: carica un colpo alla volta (`ricarica` secondi a colpo). */
export type SArmaDef = {
  id: string; nome: string;
  danno: number; testa: number; pallini: number; cadenza: number; auto: boolean;
  caricatore: number; riserva: number; ricarica: number; ricaricaUno: boolean;
  /** Dispersione (gradi, mezzo angolo del cono): dal fianco, in mira, in più muovendosi (a piena velocità) e in aria; ogni colpo
   *  ne aggiunge `colpo`, che cala di `cala` gradi al secondo. */
  dispersione: { fianco: number; mira: number; muovi: number; aria: number; colpo: number; cala: number };
  /** Rinculo (gradi a colpo): in su, di lato (a caso nei due sensi); torna giù di `recupero` gradi al secondo. */
  rinculo: { su: number; lato: number; recupero: number };
  /** Danno pieno fino a `piena` m, poi cala fino a `minimo` × a `zero` m (e resta lì). */
  portata: { piena: number; zero: number; minimo: number };
  /** Campo visivo orizzontale in mira (gradi; fuori mira lo decide il client, 90 di serie), moltiplicatore della velocità con l'arma
   *  in mano, secondi per estrarla. */
  zoom: number; velocita: number; estrai: number;
};

export type SGiocatoreCfg = {
  vita: number;
  /** La vita torna dopo `attesa` s senza colpi, `alSecondo` punti al secondo. */
  rigenera: { attesa: number; alSecondo: number };
  /** Velocità (m/s): al passo, di corsa, accucciato; in mira moltiplica per `inMira`. */
  passo: number; corsa: number; accucciato: number; inMira: number;
  /** Accelerazione e frenata a terra (m/s²); in aria si controlla `inAria` di quanto a terra. */
  accelera: number; frena: number; inAria: number;
  /** Spinta del salto (m/s) e gravità (m/s²). */
  salto: number; gravita: number;
  /** Raggio del corpo, occhi in piedi e accucciati, gradino che si sale camminando (m). */
  raggio: number; occhi: number; occhiGiu: number; gradino: number;
  /** Bersagli dei colpi: raggio della testa (sfera sugli occhi) e del corpo (cilindro da terra al collo). */
  testa: number; corpo: number;
};

export type SOggettoDef = {
  tipo: 'container' | 'cassa' | 'barriera' | 'gru';
  x: number; z: number;
  /** 0 = lungo l'asse z, 90 = lungo l'asse x. */
  rot?: 0 | 90;
  /** Container impilati (1 o 2). */
  piani?: number;
  colore?: 'blu' | 'rosso' | 'verde';
};
export type SPunto = { x: number; z: number; yaw: number };
export type SCerchio = { x: number; z: number; r: number };

/** Il piazzale: `larga` × `lunga` m di banchina (x, z), poi `acqua` m di mare verso +z; celle da `cella` m. */
export type SMappaDef = {
  larga: number; lunga: number; acqua: number; cella: number;
  spawn: SPunto;
  oggetti: SOggettoDef[];
  /** Bersagli fermi del poligono (Tappa A). */
  bersagli: SPunto[];
  /** La gru da sabotare (Missione 0) e la barca con la zona d'uscita sulla banchina. */
  gru: SCerchio;
  barca: { x: number; z: number; rot: 0 | 90; uscita: SCerchio };
};

export type SparoCfg = {
  versione: number;
  giocatore: SGiocatoreCfg;
  armi: SArmaDef[];
  /** Bersagli del poligono: vita e secondi prima di rialzarsi. */
  bersagli: { vita: number; rinasce: number };
  mappa: SMappaDef;
  /** Misure dei pezzi (m): container [x, z, alto per piano] con rot 0; cassa e barriera [x, z, alto]; gru: base [x, z, alto], gambe
   *  [x, z, alto] ai quattro angoli a ±`gruPasso` dal centro. */
  dimensioni: { container: number[]; cassa: number[]; barriera: number[]; gruBase: number[]; gruGamba: number[]; gruPasso: number };
};

export const SPARO = dati as SparoCfg;
export const armaSparo = (id: string): SArmaDef => SPARO.armi.find((a) => a.id === id) ?? SPARO.armi[0]!;
