// Barra dei bottoni in alto (WP0, CONTRACTS §13): campanella del feed (1), avatar (2), emote (3, solo touch). Da 700 px in su sta in alto a
// destra in riga; sul telefono sotto la barra risorse, a sinistra, in colonna (a destra c'è la bussola). Nascosta in gara (setTopbarHidden).
// Ogni modulo crea il proprio bottone con topButton(); l'ordine lo dà `order`, non chi arriva prima.
import { PAL, el, injectUiStyle } from './style.ts';

export type TopButton = { el: HTMLButtonElement; setBadge(n: number): void; setOn(on: boolean): void };

const P = PAL;
const CSS = `
#mzTop { position: absolute; top: max(8px, env(safe-area-inset-top)); right: 8px; display: flex; gap: 8px; z-index: 14; }
#mzTop.hide { display: none; }
.mz-topbtn { position: relative; width: 44px; height: 44px; flex: none; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(46,30,20,.92); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; color: ${P.sabbiaChiara}; font: bold 15px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-topbtn.on { border-color: ${P.giallo}; color: ${P.giallo}; }
.mz-topbtn:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-topbtn:focus { outline: none; } .mz-topbtn:focus-visible { outline: 3px solid ${P.giallo}; outline-offset: 2px; }
.mz-badge { position: absolute; top: -9px; right: -9px; min-width: 20px; height: 20px; padding: 0 5px; display: none; align-items: center; justify-content: center; background: ${P.rosso}; color: ${P.sabbiaChiara}; border: 2px solid ${P.neroCaldo}; font-size: 12px; font-weight: bold; line-height: 1; }
.mz-badge.on { display: flex; }
@media (max-width: 699px) { #mzTop { top: calc(max(8px, env(safe-area-inset-top)) + 52px); right: auto; left: 8px; flex-direction: column; } }
`;

let styled = false;
function bar(root: HTMLElement): HTMLElement {
  injectUiStyle();
  if (!styled) { styled = true; const s = document.createElement('style'); s.id = 'mz-topbar-style'; s.textContent = CSS; document.head.appendChild(s); }
  let b = root.querySelector<HTMLElement>('#mzTop');
  if (!b) { b = el('div', 'mz'); b.id = 'mzTop'; root.appendChild(b); }
  return b;
}

/** Un bottone 44×44 nella barra: `label` è il testo/icona iniziale (il modulo può appendere la sua icona a pixel in `el`). */
export function topButton(o: { root: HTMLElement; id: string; order: number; label: string; title: string; onClick(): void }): TopButton {
  const b = bar(o.root);
  const btn = el('button', 'mz mz-topbtn', o.label);
  btn.id = o.id; btn.type = 'button'; btn.title = o.title; btn.setAttribute('aria-label', o.title); btn.style.order = String(o.order);
  const badge = el('i', 'mz-badge'); btn.appendChild(badge);
  btn.addEventListener('click', (e) => { e.preventDefault(); btn.blur(); o.onClick(); });
  b.appendChild(btn);
  return {
    el: btn,
    setBadge(n) { const v = Math.max(0, Math.floor(n)); badge.classList.toggle('on', v > 0); badge.textContent = v > 99 ? '99+' : String(v); },
    setOn(on) { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); },
  };
}

/** In gara la barra sparisce (i tasti sono della regata). */
export function setTopbarHidden(h: boolean): void {
  const b = document.getElementById('mzTop');
  if (b) b.classList.toggle('hide', h);
}
