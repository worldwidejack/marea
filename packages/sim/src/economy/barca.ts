// La tua barca (#107): colori di scafo e vela (avatar.json `barca`, palette ART_BIBLE §2) e nome dipinto sul fianco. Puro: lo usano il
// Worker (valida e salva nel look in D1), la Zone (forma del Peer), il DO del lotto (compra un colore esclusivo, una volta) e il client.
// I colori esclusivi comprati stanno in `LotState.posseduti` come «barca:<id>» (accanto ai cappelli, senza campi nuovi).
import { AVATAR } from '@marea/content';
import type { BarcaColore } from '@marea/content';
import { advance } from './advance.ts';
import { spendi } from './monete.ts';
import { EconomyError } from './types.ts';
import type { LotState } from './types.ts';

/** Scelta della barca (come in `LookSalvato.barca`): id di colore per scafo e vela ('nessuna' = senza vela), nome già ripulito. */
export type BarcaLook = { scafo: string; vela: string; nome: string };

export const BARCA = AVATAR.barca;
/** La barca di chi non ha scelto niente: quella a remi di sempre. */
export const BARCA_DI_SERIE: BarcaLook = { scafo: BARCA.scafo, vela: BARCA.vela, nome: '' };
export const SENZA_VELA = 'nessuna';
/** Chiave in `posseduti` di un colore comprato. */
export const chiaveColore = (id: string): string => 'barca:' + id;

export function coloreBarca(id: string): BarcaColore | null {
  return BARCA.colori.find((k) => k.id === id) ?? null;
}

/** Nome dipinto sulla barca: lettere senza accenti, cifre, spazio e ' . ! ? -; spazi compattati, al massimo `nomeMax` caratteri. */
export function nomeBarca(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, 64).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9 '.!?-]/g, '').replace(/\s+/g, ' ').trim().slice(0, BARCA.nomeMax).trim();
}

/** Il colore è tuo: gratis per tutti, o comprato (dal Mercante o al Cantiere navale). */
export function possiedeColore(lot: LotState | null, id: string): boolean {
  const k = coloreBarca(id);
  return !!k && (k.monete <= 0 || (lot?.posseduti ?? []).includes(chiaveColore(id)));
}

/** La barca di un look salvato qualunque (D1, Peer, /api/lots): forma giusta e colori esistenti, altrimenti di serie. Non guarda chi possiede cosa. */
export function barcaDi(look: unknown): BarcaLook {
  const b = look && typeof look === 'object' ? (look as Record<string, unknown>)['barca'] : null;
  if (!b || typeof b !== 'object') return { ...BARCA_DI_SERIE };
  const o = b as Record<string, unknown>;
  const scafo = typeof o['scafo'] === 'string' && coloreBarca(o['scafo']) ? o['scafo'] : BARCA.scafo;
  const vela = typeof o['vela'] === 'string' && (o['vela'] === SENZA_VELA || coloreBarca(o['vela'])) ? o['vela'] : BARCA.vela;
  return { scafo, vela, nome: nomeBarca(o['nome']) };
}

/** È la barca di serie (niente da salvare nel look). */
export const diSerie = (b: BarcaLook): boolean => b.scafo === BARCA.scafo && b.vela === BARCA.vela && !b.nome;

/** Scelta dal client: colori esistenti e tuoi (`lot` null = non controlla gli acquisti), nome ripulito. Stringa = errore in italiano. */
export function validaBarca(v: unknown, lot: LotState | null): BarcaLook | string {
  if (!v || typeof v !== 'object') return 'Barca non valida';
  const o = v as Record<string, unknown>, scafo = o['scafo'], vela = o['vela'];
  if (typeof scafo !== 'string' || !coloreBarca(scafo)) return 'Colore dello scafo sconosciuto';
  if (typeof vela !== 'string' || (vela !== SENZA_VELA && !coloreBarca(vela))) return 'Colore della vela sconosciuto';
  if (o['nome'] !== undefined && typeof o['nome'] !== 'string') return 'Nome della barca non valido';
  if (lot) for (const id of [scafo, vela]) {
    const k = coloreBarca(id);
    if (k && !possiedeColore(lot, id)) return `${k.nome}: non è tuo, ${dove(k)} (${k.monete} monete)`;
  }
  return { scafo, vela, nome: nomeBarca(o['nome']) };
}

/** Dove si compra un colore a pagamento: le esclusive dal Mercante, le vernici del Cantiere solo il giorno che sono in vetrina (#414). */
export const dove = (k: BarcaColore): string => (k.cantiere ? 'si compra al Cantiere navale del Borgo, il giorno che è in vetrina' : 'compralo dal Mercante del Porto');

/** Compra un colore della barca, una volta sola (come i cappelli): monete spese, «barca:<id>» in `posseduti`. Il server passa da
 *  `compraColoreDelGiorno` (economy/botteghe.ts): le vernici del Cantiere solo il giorno che sono in vetrina (qui niente botteghe: barca.ts
 *  sta nel JS iniziale). */
export function compraColoreBarca(lot0: LotState, id: string, nowMs: number): LotState {
  let lot = advance(lot0, nowMs);
  const k = coloreBarca(id);
  if (!k) throw new EconomyError('sconosciuto', 'Colore sconosciuto');
  if (k.monete <= 0) throw new EconomyError('unico', `${k.nome}: è gratis, non serve comprarlo`);
  if (possiedeColore(lot, id)) throw new EconomyError('unico', `Hai già: ${k.nome}`);
  lot = spendi(lot, k.monete);
  return { ...lot, version: lot.version + 1, posseduti: [...(lot.posseduti ?? []), chiaveColore(id)] };
}
