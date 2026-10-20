// Il kit dei pannelli di MAREA: un posto solo per carta, titolo, chiusura ×, schede, righe, bottoni, barre dei comandi. Si cambia qui e
// cambia ovunque. Nasce dal pannello delle botteghe (`assets/concept/botteghe/pannello3_V1_tondo.png`: carta blu notte, bordo d'oro,
// angoli tondi, bottone d'oro, × rossa), fratello dell'HUD «Allegro» (ui/stile_allegro.ts, stessi colori).
// Testi in Alegreya Sans; il titolo può avere il carattere del luogo (--mk-ft, --mk-tw: Cinzel al Fabbro…). Tinta in variabili --mk-*.
import { ALLEGRO } from './stile_allegro.ts';
import { el } from './style.ts';

const A = ALLEGRO;
const ORO_OMBRA = '#9C6F00';
/** La tinta «notte»: fondo, righe, schede, testo, contorno del testo, nuvoletta, piede. */
const NOTTE = { bg: '#1A3A73', riga: '#15305F', rigaB: '#26508F', tab: '#1E4F9E', tabT: '#FFFFFF', t: '#FFFFFF', t2: '#BFD8FF', ct: '#0E1E40', bolla: '#15305F', piede: '#15305F' };
const TESTO_KIT = "'MzAlegreyaSans', 'Alegreya Sans', 'Trebuchet MS', sans-serif";
const k = (n: number) => `calc(var(--mzk, 1) * ${n}px)`;
const CT = 'var(--mk-ct)';
const CONTORNO_KIT = `0 2px 0 ${CT}, 2px 0 0 ${CT}, -2px 0 0 ${CT}, 0 -2px 0 ${CT}, 1.5px 1.5px 0 ${CT}, -1.5px 1.5px 0 ${CT}, 1.5px -1.5px 0 ${CT}, -1.5px -1.5px 0 ${CT}`;
const tinta = (t: Record<string, string>) => Object.entries(t).map(([n, v]) => `--mk-${n}: ${v};`).join(' ');

const CSS = `
@font-face { font-family: 'MzAlegreyaSans'; src: url('/assets/fonts/alegreya-sans-800-latin.woff2') format('woff2'); font-weight: 800; font-display: swap; }
.mk-velo, .mk-barra, .mk-pill { ${tinta(NOTTE)} --mk-fb: ${TESTO_KIT}; --mk-ft: ${TESTO_KIT}; --mk-tw: 800; }
.mk-velo { position: absolute; inset: 0; z-index: 40; display: none; background: rgba(14, 22, 48, .28); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.mk-velo.on { display: block; }
.mk-carta { position: absolute; left: 50%; transform: translateX(-50%); width: min(calc(100% - 28px), 460px); top: max(calc(env(safe-area-inset-top) + 96px), 16%); bottom: max(calc(env(safe-area-inset-bottom) + 70px), 8%);
  display: flex; flex-direction: column; box-sizing: border-box; padding: 10px 12px 10px; background: var(--mk-bg); color: var(--mk-t); font-family: var(--mk-fb); font-weight: 800;
  border: 5px solid ${A.oro}; border-radius: 26px; box-shadow: 0 0 0 3px ${A.notte}, 0 8px 0 3px ${A.notte}; }
@media (min-width: 700px) { .mk-carta { top: 12%; bottom: 8%; } }
.mk-carta.corta { bottom: auto; max-height: calc(100% - max(calc(env(safe-area-inset-top) + 96px), 16%) - max(calc(env(safe-area-inset-bottom) + 70px), 8%)); }
@media (min-width: 700px) { .mk-carta.corta { max-height: 80%; } }
.mk-testa { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; gap: 6px; min-height: 50px; margin: 0 0 6px; }
.mk-nomebox { grid-column: 2; display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 0; overflow: hidden; }
.mk-testa canvas { width: 32px; height: 32px; image-rendering: pixelated; border-radius: 4px; flex: 0 0 auto; }
.mk-titolo { font: var(--mk-tw) 34px var(--mk-ft); white-space: nowrap; line-height: 1.15; color: ${A.crema}; text-shadow: 0 2px 0 ${A.notte}, 2px 0 0 ${A.notte}, -2px 0 0 ${A.notte}, 0 -2px 0 ${A.notte}, 2px 2px 0 ${A.notte}, -2px 2px 0 ${A.notte}, 2px -2px 0 ${A.notte}, -2px -2px 0 ${A.notte}, 0 4px 0 ${A.notte}; letter-spacing: .5px; }
.mk-x { grid-column: 3; width: 44px; height: 44px; border-radius: 12px; border: 3px solid ${A.notte}; background: ${A.rosso}; box-shadow: 0 4px 0 ${A.rossoScuro}, 0 4px 0 3px ${A.notte}; color: #fff; font: 900 24px ui-rounded, system-ui, sans-serif; line-height: 1; cursor: pointer; padding: 0; text-shadow: 0 2px 0 ${A.notte}; }
.mk-x:active { transform: translateY(3px); box-shadow: 0 1px 0 ${A.rossoScuro}, 0 1px 0 3px ${A.notte}; }
.mk-tabs { display: flex; gap: 4px; border-bottom: 4px solid ${A.oro}; margin: 0 -2px; }
.mk-tab { flex: 1; min-height: 44px; border: 3px solid ${A.notte}; border-bottom: 0; border-radius: 14px 14px 0 0; background: var(--mk-tab); color: var(--mk-tabT); font: var(--mk-tw) 18px var(--mk-ft); cursor: pointer; text-shadow: 0 2px 0 ${A.notte}; padding: 0 4px; }
.mk-tab.on { background: ${A.oro}; color: ${A.notte}; text-shadow: none; }
.mk-corpo { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 0 4px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.mk-sez { margin: 10px 4px 4px; font-size: 14px; color: var(--mk-t2); }
.mk-riga { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; padding: 8px; border-radius: 16px; background: var(--mk-riga); border: 2px solid var(--mk-rigaB); }
.mk-riga.on { border-color: ${A.oro}; }
.mk-ico { flex: 0 0 auto; width: 58px; height: 58px; border-radius: 12px; border: 3px solid #C9CED8; background: ${A.notte}; display: grid; place-items: center; box-sizing: border-box; overflow: hidden; }
.mk-ico canvas { width: 40px; height: 40px; image-rendering: pixelated; }
.mk-ico i { width: 36px; height: 36px; border-radius: 8px; border: 3px solid ${A.notte}; box-sizing: border-box; }
.mk-dati { flex: 1; min-width: 0; }
.mk-nome { font-size: 17px; line-height: 1.1; text-shadow: ${CONTORNO_KIT}; }
.mk-sotto { margin-top: 3px; font-size: 13px; line-height: 1.15; color: var(--mk-t2); }
.mk-prezzo { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 19px; text-shadow: ${CONTORNO_KIT}; }
.mk-moneta { width: 20px; height: 20px; border-radius: 50%; background: ${A.oro}; box-shadow: inset 0 0 0 3px ${A.oroScuro}, 0 0 0 2px ${A.notte}; flex: 0 0 auto; }
.mk-btn { flex: 0 0 auto; min-width: 104px; min-height: 48px; padding: 0 10px; border-radius: 14px; border: 3px solid ${A.notte}; background: ${A.oro}; color: ${A.notte}; font: var(--mk-tw) 19px var(--mk-ft); cursor: pointer; box-shadow: 0 5px 0 ${ORO_OMBRA}, 0 5px 0 3px ${A.notte}; margin-bottom: 5px; }
.mk-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 1px 0 ${ORO_OMBRA}, 0 1px 0 3px ${A.notte}; }
.mk-btn.blu { background: ${A.blu}; color: #fff; text-shadow: 0 2px 0 ${A.notte}; box-shadow: 0 5px 0 ${A.bluScuro}, 0 5px 0 3px ${A.notte}; }
.mk-btn.blu:active:not(:disabled) { box-shadow: 0 1px 0 ${A.bluScuro}, 0 1px 0 3px ${A.notte}; }
.mk-btn.rosso { background: ${A.rosso}; color: #fff; text-shadow: 0 2px 0 ${A.notte}; box-shadow: 0 5px 0 ${A.rossoScuro}, 0 5px 0 3px ${A.notte}; }
.mk-btn.rosso:active:not(:disabled) { box-shadow: 0 1px 0 ${A.rossoScuro}, 0 1px 0 3px ${A.notte}; }
.mk-btn:disabled { background: #8C93A3; color: ${A.notte}; text-shadow: none; box-shadow: 0 5px 0 #5E6576, 0 5px 0 3px ${A.notte}; cursor: default; font-size: 15px; }
.mk-btn small { display: block; font-size: 11px; font-family: var(--mk-fb); font-weight: 800; }
.mk-fila { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin: 4px 0; }
.mk-fila .mk-btn { flex: 1; }
.mk-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 2px 8px; }
.mk-chip { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 3px solid ${A.notte}; background: var(--mk-tab); color: var(--mk-tabT); font: var(--mk-tw) 15px var(--mk-ft); cursor: pointer; text-shadow: 0 1px 0 ${A.notte}; }
.mk-chip.on { background: ${A.oro}; color: ${A.notte}; text-shadow: none; }
.mk-chip:disabled { opacity: .5; }
.mk-piede { margin-top: 6px; padding: 7px 10px; border-radius: 999px; background: var(--mk-piede); text-align: center; font-size: 15px; text-shadow: ${CONTORNO_KIT}; }
.mk-nota { margin: 6px 4px; font-size: 14px; line-height: 1.25; color: var(--mk-t2); }
/* barra dei comandi di un modo (POSA, SPOSTA…): cartello in alto sotto i bottoni dell'HUD, bottoni sotto */
.mk-barra { position: absolute; left: 10px; right: 10px; top: calc(max(10px, env(safe-area-inset-top)) + ${k(212)}); z-index: 15; display: none; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; font: 800 15px var(--mk-fb); color: var(--mk-t); }
.mk-barra.on { display: flex; }
.mk-barra .mk-cartello { max-width: 100%; box-sizing: border-box; padding: 6px 14px; border-radius: 999px; background: var(--mk-bg); border: 3px solid ${A.oro}; box-shadow: 0 0 0 2px ${A.notte}, 0 4px 0 2px ${A.notte}; text-align: center; text-shadow: ${CONTORNO_KIT}; line-height: 1.2; }
.mk-barra .mk-fila { pointer-events: auto; margin: 0; }
.mk-barra .mk-btn { min-width: 88px; }
@media (min-width: 700px) { .mk-barra { top: calc(max(10px, env(safe-area-inset-top)) + 70px); } }
/* bottone di un posto (ARREDA in casa): pillola d'oro nella colonna di sinistra, sotto l'avatar */
.mk-pill { position: absolute; left: 10px; top: calc(max(10px, env(safe-area-inset-top)) + ${k(178)}); z-index: 14; display: none; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 3px solid ${A.notte}; background: ${A.oro}; color: ${A.notte}; font: 800 17px var(--mk-fb); box-shadow: 0 5px 0 ${ORO_OMBRA}, 0 5px 0 3px ${A.notte}; cursor: pointer; }
.mk-pill.on { display: block; }
.mk-pill:active { transform: translateY(4px); box-shadow: 0 1px 0 ${ORO_OMBRA}, 0 1px 0 3px ${A.notte}; }
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

/** Carta col titolo (e l'icona del luogo) e la × rossa; il contenuto va in `corpo`. */
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

/** Schede in fila: quella aperta è d'oro. */
export function schedeKit<T extends string>(voci: readonly { id: T; nome: string }[], aperta: T, scegli: (id: T) => void): HTMLElement {
  const tabs = el('div', 'mk-tabs');
  for (const t of voci) {
    const b = el('button', 'mk-tab' + (t.id === aperta ? ' on' : ''), t.nome); b.type = 'button'; b.dataset['tab'] = t.id;
    b.addEventListener('click', () => scegli(t.id)); tabs.appendChild(b);
  }
  return tabs;
}

/** Bottone del kit: d'oro (il «sì»), blu (secondario) o rosso (annulla, butta). */
export function bottoneKit(testo: string, fn: () => void, colore: 'oro' | 'blu' | 'rosso' = 'oro'): HTMLButtonElement {
  const b = el('button', colore === 'oro' ? 'mk-btn' : 'mk-btn ' + colore, testo); b.type = 'button';
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
