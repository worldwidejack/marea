// Pavimenti e carte da parati disegnati interi: un disegno per finitura (borgo.json, per id o `motivo`), fatto su misura della
// superficie con il kit di finiture_kit.ts. Si rifà quando la casa cresce, così bordi, tappeti, rosoni e murali stanno sempre al posto
// giusto. Il modulo si carica a parte (interno.ts `caricaDisegni`): l'avvio non lo paga.
import type { StanzaFinitura } from '@marea/content';
import { P, TEX_MURO, TEX_PAV, tela, tutto, type Col, type DisegnoMuro, type DisegnoPav, type Muro, type Pav } from './finiture_kit.ts';
import { PAVIMENTI } from './finiture_pavimenti.ts';
import { PAVIMENTI_TEMA } from './finiture_pavimenti_tema.ts';
import { CARTE } from './finiture_carte.ts';
import { CARTE_TEMA } from './finiture_carte_tema.ts';

const PAV: Record<string, DisegnoPav> = { ...PAVIMENTI, ...PAVIMENTI_TEMA };
const MURI: Record<string, DisegnoMuro> = { ...CARTE, ...CARTE_TEMA };
const colori = (f: StanzaFinitura): Col => ({ a: f.colori[0] ?? P.pietraChiara, b: f.colori[1] ?? P.pietra, k: f.colori[2] ?? P.pietraScura });

/** Il pavimento intero di cx×cz celle. */
export function disegnaPavimento(c: HTMLCanvasElement, f: StanzaFinitura, s: Pav): void {
  const t = tela(c, s.cx * 2 * TEX_PAV, s.cz * 2 * TEX_PAV, TEX_PAV, `${f.id}:${s.cx}x${s.cz}`), col = colori(f);
  tutto(t, col.a);
  (PAV[f.id] ?? PAV[f.motivo ?? ''])?.(t, col, s);
}
/** Una parete intera (un pezzo del giro delle tre). */
export function disegnaParete(c: HTMLCanvasElement, f: StanzaFinitura, s: Muro): void {
  const t = tela(c, s.lung * TEX_MURO, s.alt * TEX_MURO, TEX_MURO, `${f.id}:${s.lato}:${s.lung}x${s.alt}`), col = colori(f);
  tutto(t, col.a);
  (MURI[f.id] ?? MURI[f.motivo ?? ''])?.(t, col, s);
}
