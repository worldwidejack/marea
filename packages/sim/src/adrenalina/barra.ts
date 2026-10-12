// Barra Adrenalina (docs/ADRENALINA.md §6): il pezzo comune ai tre giochi dell'isola (snowboard, bici, lancio). Si riempie quando rischi,
// dopo `calaDopo` s senza rischi cala piano, se cadi si azzera. Tre gradini: ×1, ×2 dalla prima soglia, ×3 dalla seconda (piena).
// Numeri in @marea/content/adrenalina/barra.json. Solo + − × ÷ (tools/check_static.mjs).
import type { BarraCfg } from '@marea/content/adrenalina.ts';

export type Barra = { v: number; quieto: number };

export const nuovaBarra = (): Barra => ({ v: 0, quieto: 0 });

/** Un rischio: riempie di `cfg.riempi[id]` (id sconosciuto = niente) e rimette a zero l'attesa prima che cali. Torna quanto ha messo. */
export function riempiBarra(b: Barra, cfg: BarraCfg, id: string): number {
  const q = cfg.riempi[id] ?? 0, prima = b.v;
  b.v = b.v + q > 1 ? 1 : b.v + q;
  b.quieto = 0;
  return b.v - prima;
}

/** Un passo di `dt` s: dopo `calaDopo` s senza rischi cala di `cala` al secondo. */
export function passoBarra(b: Barra, cfg: BarraCfg, dt: number): void {
  b.quieto += dt;
  if (b.quieto > cfg.calaDopo && b.v > 0) b.v = b.v - cfg.cala * dt < 0 ? 0 : b.v - cfg.cala * dt;
}

export function azzeraBarra(b: Barra): void { b.v = 0; b.quieto = 0; }

/** Il gradino: 1, 2 o 3. */
export function moltiplicatore(b: Barra, cfg: BarraCfg): 1 | 2 | 3 {
  return b.v >= cfg.soglie[1] ? 3 : b.v >= cfg.soglie[0] ? 2 : 1;
}
