// La storia delle prime ore nel DO del lotto (@marea/sim/economy/storia.ts, GDD §9). Dal Worker, POST /api/lot/storia/<azione>:
// /storia_inizia {} (la fa partire il client) · /storia_passo {id} (un passo che il server non vede: parlare, entrare in casa) ·
// /storia_attrezzo {scelta} (il regalo di Fulvio: canna o retino) · /storia_barca {} (la barca da Bepi) · /storia_isola {} (da Remo:
// premio e viaggio rapido sull'isola provata → {lot, isola, premio}) · /storia_difesa {} (una partita alla Difesa). Tutte rispondono col
// lotto. I passi che il server vede (mobile posato, pesce preso, monete) li porta avanti `avanzaStoria` a ogni lettura del lotto.
import { compraBarca, fattoPasso, iniziaStoria, regaloAttrezzo, riscuotiIsola, segnaDifesa } from '@marea/sim/economy/storia.ts';
import type { LotState } from '@marea/sim/economy/types.ts';
import { json } from '../http.ts';

export const STORIA_ACTS = new Set(['storia_inizia', 'storia_passo', 'storia_attrezzo', 'storia_barca', 'storia_isola', 'storia_difesa']);

export function storiaRoute(lot: LotState, act: string, body: Record<string, unknown>, now: number, save: (l: LotState) => void): Response {
  const salva = (next: LotState): Response => { if (next !== lot) save(next); return json(next); };
  switch (act) {
    case 'storia_inizia': return salva(iniziaStoria(lot));
    case 'storia_passo': {
      const id = body['id'];
      return typeof id === 'string' && id.length > 0 && id.length <= 32 ? salva(fattoPasso(lot, id, now)) : json({ error: 'Passo non valido' }, 400);
    }
    case 'storia_attrezzo': {
      const s = body['scelta'];
      return s === 'canna' || s === 'retino' ? salva(regaloAttrezzo(lot, s, now)) : json({ error: 'Canna o retino?' }, 400);
    }
    case 'storia_barca': return salva(compraBarca(lot, now));
    case 'storia_isola': {
      const out = riscuotiIsola(lot, now);
      save(out.lot);
      return json(out);
    }
    default: return salva(segnaDifesa(lot));
  }
}
