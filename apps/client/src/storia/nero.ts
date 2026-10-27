// Lo schermo nero della storia: cala a fine naufragio, ci si legge una frase, si riapre sul risveglio. A scalini come il velo dei passaggi
// (ui/velo.ts, ART_BIBLE: niente sfumature lisce), ma più lento e con una scritta in mezzo.
import { PALETTE as P } from '../render/palette.ts';

export type Nero = {
  /** Cala il nero (se non c'è già) e ci scrive `testo` ('' = niente). */
  chiudi(testo: string): Promise<void>;
  /** Toglie il nero. */
  apri(): Promise<void>;
};

const CHIUDE_MS = 900, APRE_MS = 1200, SCALINI = 6;
const CSS = `#mzStoriaNero { position: fixed; inset: 0; z-index: 45; display: flex; align-items: center; justify-content: center; padding: 0 16px;
  background: ${P.neroCaldo}; opacity: 0; pointer-events: none; transition: opacity ${CHIUDE_MS}ms steps(${SCALINI}, end); }
#mzStoriaNero.on { opacity: 1; pointer-events: auto; }
#mzStoriaNero.apre { transition: opacity ${APRE_MS}ms steps(${SCALINI}, start); }
#mzStoriaNero p { max-width: 30em; margin: 0; color: ${P.sabbiaChiara}; font: 16px/1.5 ui-monospace, Menlo, monospace; text-align: center; }`;

export function creaNero(root: HTMLElement, veloce: number): Nero {
  if (!document.getElementById('mz-storia-nero')) { const st = document.createElement('style'); st.id = 'mz-storia-nero'; st.textContent = CSS; document.head.appendChild(st); }
  const d = document.createElement('div'); d.id = 'mzStoriaNero'; const p = document.createElement('p'); d.appendChild(p); root.appendChild(d);
  const aspetta = (ms: number) => new Promise<void>((r) => setTimeout(r, ms / veloce));
  return {
    async chiudi(testo) {
      p.textContent = testo;
      if (d.classList.contains('on')) return;
      d.classList.remove('apre'); void d.offsetWidth; d.classList.add('on');
      await aspetta(CHIUDE_MS);
    },
    async apri() {
      d.classList.add('apre'); d.classList.remove('on');
      await aspetta(APRE_MS);
      p.textContent = '';
    },
  };
}
