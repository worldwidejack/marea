// Menù del Mercante e della Strega (docs/TEMPLARI.md §7b): si apre con AZIONE vicino a loro, la partita intanto va avanti (come in COD,
// gli zombie non aspettano). Le voci le dà la sim (offerteMercante, offerteStrega): nome, cosa fa (o perché non si può), prezzo; un tocco
// compra (index.ts manda l'azione alla sim e la registra per il server). Si chiude con ✕, con Esc o allontanandosi. Bottoni alti 52 px:
// un pollice basta.
import type { TAzione, TOfferta } from '@marea/sim/templari/types.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';

export type BottegaUi = {
  readonly aperta: 'mercante' | 'strega' | null;
  apri(chi: 'mercante' | 'strega'): void;
  chiudi(): void;
  /** Le voci di adesso e i punti: ridisegna solo se è cambiato qualcosa. */
  aggiorna(voci: TOfferta[], punti: number): void;
  dispose(): void;
};

const TESTI = {
  mercante: { titolo: 'Il Mercante', sotto: 'Merci da Venezia. Si paga coi punti delle ondate.', colore: PAL.giallo },
  strega: { titolo: 'La Strega', sotto: 'Zuppe e pozioni. Al massimo quattro, cuore mio.', colore: PAL.viola },
} as const;

const CSS = `
#mzBottega { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 35; width: min(440px, calc(100% - 24px)); max-height: calc(100% - 140px);
  overflow: auto; display: none; background: rgba(35,32,31,.95); border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 4px 0 ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara};
  font: bold 14px/1.25 ui-monospace, Menlo, monospace; pointer-events: auto; }
#mzBottega.on { display: block; }
#mzBottega header { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-bottom: 3px solid currentColor; }
#mzBottega header div { flex: 1; }
#mzBottega header b { display: block; font: bold 16px/1.2 'Press Start 2P', ui-monospace, monospace; }
#mzBottega header small { display: block; margin-top: 4px; color: ${PAL.sabbia}; font-size: 12px; }
#mzBottega header i { font-style: normal; color: ${PAL.giallo}; font-size: 18px; }
#mzBottega ul { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; gap: 6px; }
#mzBottega button.voce { width: 100%; min-height: 52px; display: flex; align-items: center; gap: 10px; padding: 6px 10px; text-align: left; cursor: pointer;
  background: ${PAL.ombraCalda}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoScuro}; font: inherit; }
#mzBottega button.voce:hover:not(:disabled) { border-color: ${PAL.giallo}; }
#mzBottega button.voce:disabled { opacity: .5; cursor: default; }
#mzBottega button.voce.presa { opacity: .8; border-color: ${PAL.erba}; }
#mzBottega button.voce span { flex: 1; }
#mzBottega button.voce small { display: block; font-weight: normal; color: ${PAL.sabbia}; font-size: 12px; margin-top: 2px; }
#mzBottega button.voce em { font-style: normal; color: ${PAL.giallo}; white-space: nowrap; }
#mzBottega button.voce.caro em { color: ${PAL.rosso}; }
`;

export function createBottegaUi(root: HTMLElement, compra: (a: TAzione) => void): BottegaUi {
  injectUiStyle();
  if (!document.getElementById('mzBottegaCss')) { const st = el('style'); st.id = 'mzBottegaCss'; st.textContent = CSS; document.head.append(st); }
  const box = el('div', 'mz'); box.id = 'mzBottega';
  // i tocchi sul menù non arrivano al gioco (niente attacchi, niente joystick)
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'click', 'wheel']) box.addEventListener(ev, (e) => e.stopPropagation());
  const head = el('header'), tit = el('div'), titB = el('b'), titS = el('small'), pti = el('i'), x = el('button', 'mz-x', '✕');
  x.type = 'button'; x.title = 'Chiudi';
  tit.append(titB, titS); head.append(tit, pti, x);
  const lista = el('ul');
  box.append(head, lista);
  root.append(box);
  let aperta: 'mercante' | 'strega' | null = null, chiave = '';
  const chiudi = () => { aperta = null; chiave = ''; box.classList.remove('on'); };
  x.addEventListener('click', chiudi);
  const esc = (e: KeyboardEvent) => { if (aperta && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); chiudi(); } };
  addEventListener('keydown', esc, true);

  return {
    get aperta() { return aperta; },
    apri(chi) {
      aperta = chi; chiave = '';
      const t = TESTI[chi];
      titB.textContent = t.titolo; titS.textContent = t.sotto; head.style.color = t.colore;
      box.classList.add('on');
    },
    chiudi,
    aggiorna(voci, punti) {
      if (!aperta) return;
      const k = punti + '|' + voci.map((v) => `${v.cosa}${'slot' in v ? v.slot : ''}${v.puoi}${v.descr}${v.prezzo}`).join('|');
      if (k === chiave) return;
      chiave = k;
      pti.textContent = `${punti} pt`;
      lista.replaceChildren(...voci.map((v) => {
        const b = el('button', 'voce'); b.type = 'button'; b.disabled = !v.puoi;
        if ('presa' in v && v.presa) b.classList.add('presa');
        if (!v.puoi && punti < v.prezzo && !('presa' in v && v.presa)) b.classList.add('caro');
        const nome = el('span', '', ('presa' in v && v.presa ? '✓ ' : '') + v.nome); nome.append(el('small', '', v.descr));
        b.append(nome, el('em', '', `${v.prezzo}`));
        const a: TAzione = v.da === 'mercante' ? { t: 'compra', da: 'mercante', cosa: v.cosa, slot: v.slot } : { t: 'compra', da: 'strega', cosa: v.cosa };
        b.addEventListener('click', () => { if (v.puoi) compra(a); });
        const li = el('li'); li.append(b); return li;
      }));
    },
    dispose() { removeEventListener('keydown', esc, true); box.remove(); },
  };
}
