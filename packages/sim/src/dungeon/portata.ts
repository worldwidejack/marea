// Portata della bomba in Arena: dove atterra la sceglie chi la lancia, non la sim. Il punto di caduta viaggia nell'input come un indice, insieme
// alla direzione `m` (mira.ts): PORTATA_N passi da PORTATA_MIN m alla gittata della magia (a 9 m, 11 cm l'uno). Sta nel campo `p` dell'alzo
// (alzo.ts), che in Arena non serve (terza persona): stessi limiti, stesso formato di log e di rete. Assente = nessuna portata scelta (tocco
// veloce): vale la mira assistita (distanzaBomba, magie.ts). Solo + − × ÷ e round/min/max.
import type { DungeonState } from './state.ts';
import { ALZO_N, alzoDir } from './alzo.ts';

const PORTATA_N = ALZO_N;
/** La bomba parte 0,4 m davanti all'eroe: più vicino di così non si può lanciare. */
const PORTATA_MIN = 0.4;

/** Portata valida (1..PORTATA_N) o 0 = nessuna. */
const portataValida = (p: number | undefined): number => (p !== undefined && Number.isInteger(p) && p >= 1 && p <= PORTATA_N ? p : 0);

/** Distanza (m) dall'eroe del punto di caduta scelto con l'indice `p`, per una magia che arriva a `max` m. */
export function portataDist(p: number, max: number): number {
  return PORTATA_MIN + ((p - 1) / (PORTATA_N - 1)) * Math.max(0, max - PORTATA_MIN);
}

/** Indice (1..PORTATA_N) per un punto di caduta a `dist` m, tagliato fra PORTATA_MIN e `max`. Lo sceglie il client. */
export function portataIndex(dist: number, max: number): number {
  const f = max > PORTATA_MIN ? (dist - PORTATA_MIN) / (max - PORTATA_MIN) : 0;
  return 1 + Math.round(Math.max(0, Math.min(1, f)) * (PORTATA_N - 1));
}

/** Legge `p` di questo tick per l'eroe di turno: fuori dall'Arena è l'alzo (`alzo`), in Arena la portata scelta (`portata`). Mentre punta, la
 *  portata resta anche nei tick senza mira (la mira di un turno intero può mancare al rilascio); a mano libera o in altre pose si azzera. */
export function leggiP(s: DungeonState, dir: readonly [number, number] | null, p: number | undefined): void {
  const h = s.hero;
  if (!s.pvp) { h.alzo = alzoDir(p) ?? undefined; return; }
  h.alzo = undefined;
  const v = dir ? portataValida(p) : 0;
  h.portata = h.act === 'punta' ? v || h.portata : h.act === 'idle' ? v || undefined : undefined;
}
