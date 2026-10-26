// I biglietti degli scheletri (docs/TEMPLARI.md §12b punto 4): AZIONE davanti a uno scheletro lo apre (evento `biglietto` della sim), come
// il menù del Mercante non ferma la partita e si chiude con Chiudi, con Esc o andando via. Quelli letti restano nella pausa, da rileggere
// (lì la partita è ferma). Il foglio è quello del biglietto di fra' Guillaume (game/templari_relitto.ts).
import { TEMPLARI } from '@marea/content/templari.ts';
import { creaBiglietto, scriviBiglietto } from '../game/templari_relitto.ts';
import type { TestoBiglietto } from '../game/templari_relitto.ts';
import { PAL, el } from '../ui/style.ts';

export type Biglietti = {
  /** Apre il biglietto dello scheletro `id` (e lo segna tra i letti); `daPausa` = aperto dalla lista della pausa. */
  apri(id: string, daPausa?: boolean): void;
  readonly aperto: string | null;
  readonly letti: readonly string[];
  /** Ogni fotogramma: chi l'ha aperto davanti allo scheletro e se n'è andato lo chiude; aperto dalla pausa, si chiude ripartendo. */
  aggiorna(davanti: boolean, pausa: boolean): void;
  /** La lista dei letti, per il menù della pausa (controlli.ts `extra`). */
  readonly lista: HTMLElement;
  dispose(): void;
};

const CSS = `
.mz-tpl-letti { margin-top: 10px; display: none; text-align: left; }
.mz-tpl-letti.on { display: block; }
.mz-tpl-letti small { display: block; font-size: 11px; font-weight: bold; letter-spacing: .1em; color: ${PAL.sabbia}; margin-bottom: 4px; }
.mz-tpl-letti button { display: block; width: 100%; min-height: 36px; margin-top: 4px; padding: 4px 8px; text-align: left; background: ${PAL.sabbiaChiara};
  color: ${PAL.ombraCalda}; border: 2px solid ${PAL.legnoChiaro}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; }
`;
const testo = (id: string): TestoBiglietto => {
  const d = TEMPLARI.indizi.scheletri[id];
  return { titolo: '✠ Il biglietto dello scheletro', righe: d?.righe ?? [], firma: d ? '— ' + d.chi : undefined };
};
const nome = (id: string): string => (TEMPLARI.indizi.scheletri[id]?.chi ?? id).split(',')[0]!;

export function createBiglietti(root: HTMLElement): Biglietti {
  if (!document.getElementById('mz-tpl-letti-style')) { const st = document.createElement('style'); st.id = 'mz-tpl-letti-style'; st.textContent = CSS; document.head.appendChild(st); }
  let aperto: string | null = null, daPausa = false;
  const letti: string[] = [];
  const foglio = creaBiglietto(root, () => { aperto = null; }, testo(Object.keys(TEMPLARI.indizi.scheletri)[0] ?? ''), 'mzTplBiglietto');
  foglio.style.zIndex = '30'; // sopra il menù della pausa
  const lista = el('div', 'mz-tpl-letti'); lista.id = 'mzTplLetti';
  const chiudi = () => { aperto = null; foglio.classList.remove('on'); };
  const esc = (e: KeyboardEvent) => { if (aperto && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); chiudi(); } };
  addEventListener('keydown', esc, true);
  const rifaiLista = () => {
    lista.classList.toggle('on', letti.length > 0);
    lista.replaceChildren(el('small', '', `📜 Biglietti trovati ${letti.length}/${Object.keys(TEMPLARI.indizi.scheletri).length}`), ...letti.map((id) => {
      const b = el('button', '', nome(id)) as HTMLButtonElement; b.type = 'button'; b.dataset['biglietto'] = id;
      b.addEventListener('click', () => api.apri(id, true));
      return b;
    }));
  };
  const api: Biglietti = {
    apri(id, pausa = false) {
      if (!TEMPLARI.indizi.scheletri[id]) return;
      if (!letti.includes(id)) { letti.push(id); rifaiLista(); }
      if (aperto !== id) scriviBiglietto(foglio, testo(id));
      aperto = id; daPausa = pausa; foglio.classList.add('on');
    },
    get aperto() { return aperto; },
    get letti() { return letti; },
    aggiorna(davanti, pausa) { if (aperto && (daPausa ? !pausa : !davanti && !pausa)) chiudi(); },
    lista,
    dispose() { removeEventListener('keydown', esc, true); foglio.remove(); lista.remove(); },
  };
  return api;
}
