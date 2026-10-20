// Il kit dell'interfaccia di MAREA: colori, caratteri e pezzi comuni (carta, titolo, chiusura ×, schede, righe, bottoni, barre dei
// comandi). Si cambia qui e cambia ovunque: anche l'HUD (ui/stile_allegro.ts) prende colori e caratteri da qui.
// Stile «libro illustrato» (`assets/concept/ui/kit/n6_inchiostro.png`): carta crema, cornice d'oro col filo d'inchiostro, bottoni verde
// acqua, scritte serif da libro di fiabe, tutto piccolo così il mondo resta protagonista. Niente gradienti lisci: colori pieni.
import { el } from './style.ts';

/** I colori del libro: carta, oro, inchiostro, verde acqua (il «sì»), rosso (avvisi e A). */
export const LIBRO = {
  carta: '#FAE8C5', cartaChiara: '#FDF2DA', cartaScura: '#EBD5A8', filo: '#D9C08A',
  oro: '#D9AA45', oroChiaro: '#F2CF72', oroScuro: '#A97A22',
  inchiostro: '#2E2118', inchiostro2: '#6B5236',
  acqua: '#0B7896', acquaScura: '#0A4F63', acquaChiara: '#7FC3C9',
  rosso: '#C8423A', rossoScuro: '#8E2A24', blu: '#2F6FC0', foglia: '#5E9A6E', verdeAvviso: '#E6EDC2',
} as const;
/** Serif da libro di fiabe per titoli, bottoni e numeri; finché il file non c'è, Georgia. */
export const FONT_LIBRO = "'MzAlegreya', 'Alegreya', Georgia, 'Times New Roman', serif";
const L = LIBRO;
const k = (n: number) => `calc(var(--mzk, 1) * ${n}px)`;
const svg = (dentro: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 20'>${dentro}</svg>`)}")`;
/** Il rametto accanto ai titoli. */
const RAMETTO = svg(`<path d='M2 15C12 15 22 12 34 4' fill='none' stroke='${L.acquaScura}' stroke-width='1.6' stroke-linecap='round'/><path d='M14 13.5c-1-4 1-7 5-8-1 4-2 7-5 8zM22 10.5c0-4 3-6 7-6-2 3-3 5-7 6zM12 14c-4 1-7-1-8-4 4 0 6 1 8 4zM21 11c-3 2-7 2-9 0 3-2 6-2 9 0z' fill='${L.foglia}' stroke='${L.acquaScura}' stroke-width='.8'/>`);
/** Cornice del libro: bordo d'oro, filo d'inchiostro fuori, filo d'oro scuro dentro. */
export const CORNICE_LIBRO = (b = 2) => `border: ${b}px solid ${L.oro}; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.carta}, inset 0 0 0 2.5px ${L.oroScuro}, 0 3px 0 1.5px rgba(46,33,24,.35);`;

const CSS = `
.mk-velo, .mk-barra, .mk-pill { --mk-fb: ${FONT_LIBRO}; --mk-ft: ${FONT_LIBRO}; --mk-tw: 700; }
.mk-velo { position: absolute; inset: 0; z-index: 40; display: none; background: rgba(46, 33, 24, .18); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.mk-velo.on { display: block; }
/* la carta: un foglio in basso, largo quanto il telefono, alto quanto serve (al massimo metà schermo) */
.mk-carta { position: absolute; left: 50%; transform: translateX(-50%); width: min(calc(100% - 20px), 440px); bottom: calc(env(safe-area-inset-bottom) + 10px); max-height: 52%;
  display: flex; flex-direction: column; box-sizing: border-box; padding: 6px 10px 8px; background: ${L.carta}; color: ${L.inchiostro}; font: 700 15px var(--mk-fb);
  border-radius: 16px; ${CORNICE_LIBRO(3)} }
@media (min-width: 700px) { .mk-carta { top: 50%; bottom: auto; transform: translate(-50%, -50%); max-height: 70%; } }
.mk-testa { display: flex; align-items: center; gap: 8px; min-height: 44px; margin: 0 0 4px; }
.mk-nomebox { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; }
.mk-testa canvas { width: 26px; height: 26px; image-rendering: pixelated; border-radius: 4px; flex: 0 0 auto; }
.mk-titolo { font: italic var(--mk-tw) 24px var(--mk-ft); white-space: nowrap; line-height: 1.1; color: ${L.inchiostro}; }
.mk-titolo::after { content: ''; display: inline-block; width: 34px; height: 17px; margin-left: 4px; vertical-align: -2px; background: ${RAMETTO} center / contain no-repeat; }
.mk-x { flex: none; width: 44px; height: 44px; padding: 0; border-radius: 50%; border: 2px solid ${L.inchiostro}; background: ${L.cartaChiara}; box-shadow: inset 0 0 0 2px ${L.oro}, 0 2px 0 rgba(46,33,24,.35);
  color: ${L.inchiostro}; font: 700 22px/1 ${FONT_LIBRO}; cursor: pointer; }
.mk-x:active { transform: translateY(2px); box-shadow: inset 0 0 0 2px ${L.oro}; }
.mk-tabs { display: flex; gap: 4px; border-bottom: 2px solid ${L.oro}; margin: 0 -2px; }
.mk-tab { flex: 1; min-height: 44px; padding: 0 4px; border: 2px solid ${L.oro}; border-bottom: 0; border-radius: 10px 10px 0 0; background: ${L.cartaScura}; color: ${L.inchiostro2}; font: var(--mk-tw) 15px var(--mk-ft); cursor: pointer; box-shadow: inset 0 0 0 1px ${L.cartaChiara}; }
.mk-tab.on { background: ${L.acqua}; color: ${L.cartaChiara}; box-shadow: inset 0 0 0 1.5px ${L.acquaScura}; text-shadow: 0 1px 0 ${L.acquaScura}; }
.mk-corpo { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 0 2px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.mk-sez { margin: 8px 4px 4px; font-size: 13px; color: ${L.inchiostro2}; }
.mk-riga { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; padding: 4px 6px; border-radius: 10px; background: ${L.cartaChiara}; border: 1.5px solid ${L.filo}; box-shadow: inset 0 0 0 1px ${L.cartaChiara}, inset 0 0 0 2px ${L.cartaScura}; }
.mk-riga.on { border-color: ${L.acqua}; }
.mk-ico { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 8px; border: 1.5px solid ${L.filo}; background: ${L.cartaScura}; display: grid; place-items: center; box-sizing: border-box; overflow: hidden; }
.mk-ico canvas { width: 32px; height: 32px; image-rendering: pixelated; }
.mk-ico i { width: 28px; height: 28px; border-radius: 6px; border: 1.5px solid ${L.inchiostro}; box-sizing: border-box; }
.mk-dati { flex: 1; min-width: 0; }
.mk-nome { font-size: 15px; line-height: 1.15; }
.mk-sotto { margin-top: 2px; font-size: 12px; line-height: 1.2; color: ${L.inchiostro2}; font-weight: 400; font-style: italic; }
.mk-prezzo { display: flex; align-items: center; gap: 5px; margin-top: 2px; font-size: 16px; }
.mk-moneta { width: 16px; height: 16px; border-radius: 50%; background: ${L.oroChiaro}; box-shadow: inset 0 0 0 2.5px ${L.oro}, 0 0 0 1.5px ${L.inchiostro}; flex: 0 0 auto; }
/* bottoni: verde acqua pieno (il «sì»), carta (secondario); un rombo d'oro a ogni capo */
.mk-btn { position: relative; flex: 0 0 auto; min-width: 76px; min-height: 44px; padding: 0 18px; border-radius: 12px; border: 2px solid ${L.oro}; background: ${L.acqua}; color: ${L.cartaChiara};
  font: var(--mk-tw) 16px var(--mk-ft); text-shadow: 0 1px 0 ${L.acquaScura}; cursor: pointer; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.acquaScura}, 0 3px 0 1.5px ${L.inchiostro}; }
.mk-btn::before, .mk-btn::after { content: ''; position: absolute; top: 50%; width: 5px; height: 5px; margin-top: -2.5px; background: ${L.oroChiaro}; transform: rotate(45deg); }
.mk-btn::before { left: 5px; } .mk-btn::after { right: 5px; }
.mk-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.acquaScura}, 0 1px 0 1.5px ${L.inchiostro}; }
.mk-btn.carta { background: ${L.cartaChiara}; color: ${L.inchiostro}; text-shadow: none; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.cartaScura}, 0 3px 0 1.5px ${L.inchiostro}; }
.mk-btn.carta::before, .mk-btn.carta::after { background: ${L.oro}; }
.mk-btn:disabled { background: ${L.cartaScura}; color: ${L.inchiostro2}; text-shadow: none; border-color: ${L.filo}; box-shadow: 0 0 0 1.5px ${L.inchiostro2}; cursor: default; }
.mk-btn:disabled::before, .mk-btn:disabled::after { display: none; }
.mk-btn small { display: block; font-size: 11px; }
.mk-fila { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 4px 0; }
.mk-fila .mk-btn { flex: 1; }
.mk-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 2px 8px; }
.mk-chip { min-height: 34px; padding: 0 12px; border-radius: 999px; border: 1.5px solid ${L.oro}; background: ${L.cartaScura}; color: ${L.inchiostro}; font: var(--mk-tw) 14px var(--mk-ft); cursor: pointer; }
.mk-chip.on { background: ${L.acqua}; color: ${L.cartaChiara}; }
.mk-chip:disabled { opacity: .5; }
.mk-piede { margin-top: 4px; padding: 5px 10px; border-radius: 999px; background: ${L.cartaScura}; text-align: center; font-size: 13px; }
.mk-nota { margin: 6px 4px; font-size: 13px; line-height: 1.3; color: ${L.inchiostro2}; font-weight: 400; font-style: italic; }
/* barra dei comandi di un modo (POSA, SPOSTA…): cartiglio in alto sotto i bottoni dell'HUD, bottoni sotto */
.mk-barra { position: absolute; left: 10px; right: 10px; top: calc(max(10px, env(safe-area-inset-top)) + ${k(198)}); z-index: 15; display: none; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; font: 700 13px var(--mk-fb); color: ${L.inchiostro}; }
.mk-barra.on { display: flex; }
.mk-barra .mk-cartello { max-width: 100%; box-sizing: border-box; padding: 4px 14px; border-radius: 999px; background: ${L.carta}; ${CORNICE_LIBRO(2)} text-align: center; line-height: 1.25; }
.mk-barra .mk-fila { pointer-events: auto; margin: 0; }
.mk-barra .mk-btn { flex: 0 0 auto; font-size: 15px; }
@media (min-width: 700px) { .mk-barra { top: calc(max(10px, env(safe-area-inset-top)) + 70px); } }
/* bottone di un posto (ARREDA in casa): pillola verde acqua nella colonna di sinistra, sotto l'avatar */
.mk-pill { position: absolute; left: 8px; top: calc(max(8px, env(safe-area-inset-top)) + ${k(152)}); z-index: 14; display: none; min-width: 0; min-height: 44px; padding: 0 18px; }
.mk-pill.on { display: block; }
`;

let fatto = false;
/** Il CSS del kit, una volta sola. */
export function injectKit(): void {
  if (fatto || typeof document === 'undefined') return;
  fatto = true;
  const s = document.createElement('style');
  s.id = 'mz-kit-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** I tocchi su un pezzo del kit non arrivano al canvas né al joystick. */
export function fermaTocchi<T extends HTMLElement>(e: T): T {
  for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  return e;
}

/** Il velo a tutto schermo che ospita una carta (classe `on` = visibile). */
export function veloKit(root: HTMLElement, id: string): HTMLElement {
  injectKit();
  const v = fermaTocchi(el('div', 'mk-velo')); v.id = id;
  root.appendChild(v);
  return v;
}

/** Carta col titolo (e l'icona del luogo) e la × ; il contenuto va in `corpo`. */
export function cartaKit(titolo: string, onChiudi: () => void, icona?: HTMLElement): { carta: HTMLElement; corpo: HTMLElement } {
  const carta = el('div', 'mk-carta'), testa = el('div', 'mk-testa'), nb = el('div', 'mk-nomebox');
  if (icona) nb.appendChild(icona);
  nb.appendChild(el('div', 'mk-titolo', titolo));
  const x = el('button', 'mk-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi'); x.dataset['act'] = 'chiudi'; x.addEventListener('click', onChiudi);
  testa.append(nb, x);
  const corpo = el('div', 'mk-corpo');
  carta.append(testa, corpo);
  return { carta, corpo };
}

/** Schede in fila: quella aperta è verde acqua. */
export function schedeKit<T extends string>(voci: readonly { id: T; nome: string }[], aperta: T, scegli: (id: T) => void): HTMLElement {
  const tabs = el('div', 'mk-tabs');
  for (const t of voci) {
    const b = el('button', 'mk-tab' + (t.id === aperta ? ' on' : ''), t.nome); b.type = 'button'; b.dataset['tab'] = t.id;
    b.addEventListener('click', () => scegli(t.id)); tabs.appendChild(b);
  }
  return tabs;
}

/** Bottone del kit: pieno (il «sì», verde acqua) o di carta (secondario, annulla). */
export function bottoneKit(testo: string, fn: () => void, tipo: 'pieno' | 'carta' = 'pieno'): HTMLButtonElement {
  const b = el('button', tipo === 'pieno' ? 'mk-btn' : 'mk-btn carta', testo); b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}

/** Riga di lista: icona nel riquadro, nome, righe sotto, e a destra l'azione. */
export function rigaKit(o: { icona?: HTMLElement; nome: string; sotto?: (string | Node)[]; azione?: HTMLElement }): HTMLElement {
  const r = el('div', 'mk-riga'), d = el('div', 'mk-dati');
  d.appendChild(el('div', 'mk-nome', o.nome));
  for (const s of o.sotto ?? []) d.appendChild(typeof s === 'string' ? el('div', 'mk-sotto', s) : s);
  if (o.icona) r.appendChild(o.icona);
  r.appendChild(d);
  if (o.azione) r.appendChild(o.azione);
  return r;
}

/** Riquadro dell'icona con un campione di colore (mobili, vernici, pavimenti): uno o due colori, a taglio netto. */
export function campioneKit(colori: readonly string[]): HTMLElement {
  const b = el('div', 'mk-ico'), i = el('i'), [c0 = '#888', c1 = c0] = colori;
  i.style.background = `linear-gradient(135deg, ${c0} 0 50%, ${c1} 50% 100%)`;
  b.appendChild(i);
  return b;
}
