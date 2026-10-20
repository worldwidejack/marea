// Dissolvenza dei passaggi: città → stanza e ritorno, le scale di casa. Un velo nero su tutto lo schermo che si chiude a scalini (niente
// sfumatura liscia, ART_BIBLE: a scatti come i pixel), a velo chiuso si fa il passaggio, poi si riapre. Durante il passaggio il mondo
// è fermo (`world.frozen`), così l'input non ti porta altrove mentre è buio.
import { registerStateProvider } from '../test/testapi.ts';

export type Velo = {
  /** Chiude il velo, chiama `fai` a schermo nero, lo riapre. Se un passaggio è già in corso non fa niente (false). */
  passa(fai: () => void): Promise<boolean>;
  readonly attivo: boolean;
};

const CHIUDE_MS = 180, APRE_MS = 240, SCALINI = 4;
const CSS = `#mzVelo { position: fixed; inset: 0; background: #23201F; opacity: 0; pointer-events: none; z-index: 40; }
#mzVelo.chiuso { opacity: 1; pointer-events: auto; transition: opacity ${CHIUDE_MS}ms steps(${SCALINI}, end); }
#mzVelo.apre { opacity: 0; transition: opacity ${APRE_MS}ms steps(${SCALINI}, start); }`;

export function createVelo(o: { root: HTMLElement; mondo: { frozen: boolean } }): Velo {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'mzVelo'; o.root.appendChild(d);
  let attivo = false, passaggi = 0;
  const aspetta = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  registerStateProvider('velo', () => ({ attivo, passaggi }));
  return {
    get attivo() { return attivo; },
    async passa(fai) {
      if (attivo) return false;
      attivo = true; const fermo = o.mondo.frozen; o.mondo.frozen = true;
      d.classList.remove('apre'); void d.offsetWidth; d.classList.add('chiuso');
      await aspetta(CHIUDE_MS);
      try { fai(); } finally {
        await frame(); // il mondo si ridisegna già di là prima di riaprire
        d.classList.remove('chiuso'); d.classList.add('apre');
        passaggi++;
        o.mondo.frozen = fermo;
        await aspetta(APRE_MS);
        d.classList.remove('apre'); attivo = false;
      }
      return true;
    },
  };
}
