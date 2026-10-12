// @marea/content/corse_discesa.ts: dati della discesa in mountain bike (banco provadiscesa3d.html, #229; ADRENALINA.md §7 e CORSE.md A6,
// famiglia «Due ruote»). Entry separata come corse.ts: la caricano solo il chunk delle corse (apps/client/src/corse/**), i test e gli
// strumenti. I sentieri sono generati da tools/discesa_sentieri.mjs (non si scrivono a mano). Formule in @marea/sim/corse/bici.ts.
import bici from './corse/discesa/bici.json' with { type: 'json' };
import cresta from './corse/discesa/sentieri/cresta_bosco.json' with { type: 'json' };
import type { CPuntoDef } from './corse_types.ts';

/** Numeri della bici (m, s, m/s). */
export type DBiciCfg = {
  gravita: number;
  /** Interasse (m): con l'angolo di sterzo dà quanto gira a bassa velocità. */
  interasse: number;
  /** Angolo massimo dello sterzo (rad) e quanto in fretta ci arriva (1/s). */
  sterzoMax: number; rampaSterzo: number;
  /** Accelerazione laterale massima (m/s²): a velocità alta lo sterzo è limitato dalla presa (curve più larghe). */
  presa: number;
  /** Resistenze: rotolamento sul sentiero e sull'erba (× g), aria (× v²). */
  rotolamento: number; rotolamentoErba: number; aria: number;
  /** Pedalata (m/s² a gas pieno, solo sotto `pedaleFinoA` m/s), freno (m/s²), velocità massima. */
  pedale: number; pedaleFinoA: number; freno: number; vMax: number;
  /** Lo scatto (ADRENALINA §7: «un colpo di pedale, poi qualche istante per ricaricare»). */
  scatto: { spinta: number; ricarica: number; finoA: number };
  /** Radici e sassi piccoli sul sentiero: frenano e scuotono; l'erba ai lati scuote un po'. */
  radici: { frena: number; scossa: number };
  erba: { scossa: number };
  /** Cadute: secondi persi; urto (m/s) contro un sasso o un albero oltre il quale si cade; atterraggio troppo duro (m/s in giù);
   *  atterraggio storto (rad tra la bici e il sentiero); velocità alla ripartenza. */
  caduta: { secondi: number; urto: number; urtoLato: number; atterraggio: number; storto: number; ripartenza: number };
  /** Tronco da saltare: mezza lunghezza della gobba che fa la ruota (m), quanta spinta in su resta al decollo (la sospensione assorbe
   *  il resto), quanto frena il colpo (frazione della velocità). */
  tronco: { mezzo: number; molla: number; frena: number };
  /** Sassi e ceppi: raggio della base del modello rispetto a `r` e mezzo copertone (m), per l'urto con le ruote. */
  sasso: { base: number; copertone: number };
};

/** Ostacolo sul sentiero o accanto: si urta (sasso, masso, ceppo) se si passa più bassi di `alto`. */
export type DOstacolo = { s: number; lat: number; r: number; alto: number; tipo: 'sasso' | 'masso' | 'ceppo' };
/** Un tratto lungo il sentiero (m dal via). */
export type DTratto = { da: number; a: number };
/** Rampa (di tavole e terra, il labbro a `s`, lunga 3 × `alto`) o tronco da saltare (centrato a `s`), alti `alto` m: la bici ci sale
 *  sopra e stacca (@marea/sim/corse/bici.ts `rilievo`). */
export type DRampa = { s: number; alto: number; tipo: 'rampa' | 'tronco' };
/** Cosa c'è oltre il bordo, per lato (−1 sinistra, +1 destra): dirupo (il pendio sul mare), bosco (alberi fitti), prato. */
export type DLato = DTratto & { lato: -1 | 1; tipo: 'dirupo' | 'bosco' | 'prato' };

export type DSentieroDef = {
  id: string; nome: string;
  /** Passo dei campioni (m), mezza larghezza del sentiero, erba percorribile oltre il bordo (m) prima del muro (alberi o pendio). */
  passo: number; larghezza: number; bordo: number;
  punti: CPuntoDef[];
  /** Le zone del paesaggio: la cresta (erba, sassi, pini piegati, il mare sotto) e il bosco (abeti fitti). */
  zone: (DTratto & { tipo: 'cresta' | 'bosco' })[];
  lati: DLato[];
  ostacoli: DOstacolo[];
  radici: DTratto[];
  rampe: DRampa[];
  /** Dove si arriva (m dal via). */
  arrivo: number;
};

export const BICI = bici as DBiciCfg;
export const SENTIERI: Record<string, DSentieroDef> = Object.fromEntries(([cresta] as unknown as DSentieroDef[]).map((s) => [s.id, s]));
