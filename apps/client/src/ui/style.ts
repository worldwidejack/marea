// Stile condiviso dell'interfaccia in DOM: i pannelli (.mz-sheet e i pezzi dentro) sono nel look «libro illustrato» del kit (ui/kit.ts):
// carta, cornice d'oro, scritte serif, bottoni verde acqua; ombre «dure» senza sfocatura, niente gradienti. Iniettato una volta sola in <head>.
import { PALETTE } from '../render/palette.ts';
import { CORNICE_LIBRO, FONT_LIBRO, LIBRO as L, RAMETTO } from './libro_colori.ts';
/** I colori dell'interfaccia: la palette senza i neon (tranne il rosa) e senza bosco ombra. Sottoinsieme fisso: chi scorre PAL
(colore più vicino degli oggetti, tavolozze dei disegni) vede sempre gli stessi colori. */
export const PAL = {
  sabbiaChiara: PALETTE.sabbiaChiara, sabbia: PALETTE.sabbia, legnoChiaro: PALETTE.legnoChiaro, legno: PALETTE.legno, legnoScuro: PALETTE.legnoScuro, ombraCalda: PALETTE.ombraCalda,
  erbaChiara: PALETTE.erbaChiara, erba: PALETTE.erba, erbaScura: PALETTE.erbaScura, bosco: PALETTE.bosco,
  acquaBassa: PALETTE.acquaBassa, acqua: PALETTE.acqua, acquaProfonda: PALETTE.acquaProfonda, abisso: PALETTE.abisso,
  pietraChiara: PALETTE.pietraChiara, pietra: PALETTE.pietra, pietraScura: PALETTE.pietraScura, roccia: PALETTE.roccia, neroCaldo: PALETTE.neroCaldo,
  rosso: PALETTE.rosso, arancio: PALETTE.arancio, giallo: PALETTE.giallo, viola: PALETTE.viola, rosaNeon: PALETTE.rosaNeon,
} as const;

const P = PAL;
const CSS = `
.mz { font-family: ${FONT_LIBRO}; color: ${L.inchiostro}; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.mz-bar { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: none; gap: 6px; justify-content: center; z-index: 12; pointer-events: none !important; }
.mz-bar.on { display: flex; }
.mz-chip { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 10px; background: rgba(46,30,20,.92); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-size: 18px; font-weight: bold; }
.mz-chip b { min-width: 3ch; text-align: right; }
.mz-chip.bump { border-color: ${P.giallo}; color: ${P.giallo}; }
.mz-banner { position: absolute; left: 12px; right: 12px; top: 40%; padding: 14px; background: rgba(46,30,20,.95); border: 2px solid ${P.rosso}; box-shadow: 0 4px 0 ${P.neroCaldo}; font-size: 16px; text-align: center; z-index: 30; display: none; }
.mz-banner.on { display: block; }
.mz-labels { position: absolute; inset: 0; pointer-events: none !important; z-index: 5; overflow: hidden; }
.mz-lbl { position: absolute; left: 0; top: 0; transform: translate(-9999px, 0); display: flex; align-items: center; gap: 5px; padding: 0 8px; min-height: 30px; background: rgba(46,30,20,.92); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-size: 14px; font-weight: bold; white-space: nowrap; pointer-events: none; }
.mz-lbl.bubble { pointer-events: auto; cursor: pointer; min-height: 40px; min-width: 44px; justify-content: center; border-color: ${P.erba}; }
.mz-lbl.full { border-color: ${P.giallo}; background: ${P.legnoScuro}; color: ${P.giallo}; }
.mz-lbl.timer { border-color: ${P.arancio}; }
.mz-lbl.slot { border-color: ${P.arancio}; min-height: 44px; font-size: 13px; }
.mz-lbl.slot.hint { border-color: ${P.giallo}; background: ${P.legnoScuro}; color: ${P.giallo}; font-size: 15px; min-height: 48px; }
.mz-sheet { position: absolute; left: 8px; right: 8px; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); max-height: 62%; overflow-y: auto; padding: 8px 12px 10px; box-sizing: border-box; background: ${L.carta}; color: ${L.inchiostro}; border-radius: 16px; ${CORNICE_LIBRO(3)} z-index: 20; display: none; font: 700 15px/1.35 ${FONT_LIBRO}; touch-action: pan-y; }
.mz-sheet.on { display: block; }
.mz-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; margin-bottom: 4px; }
.mz-title { font: italic 700 24px/1.1 ${FONT_LIBRO}; color: ${L.inchiostro}; }
.mz-title::after { content: ''; display: inline-block; width: 34px; height: 17px; margin-left: 4px; vertical-align: -2px; background: ${RAMETTO} center / contain no-repeat; }
.mz-lvl { color: ${L.acqua}; }
.mz-x { width: 44px; height: 44px; flex: none; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 50%; border: 2px solid ${L.inchiostro}; background: ${L.cartaChiara}; box-shadow: inset 0 0 0 2px ${L.oro}, 0 2px 0 rgba(46,33,24,.35); color: ${L.inchiostro}; font: 700 22px/1 ${FONT_LIBRO}; cursor: pointer; }
.mz-x:active { transform: translateY(2px); box-shadow: inset 0 0 0 2px ${L.oro}; }
.mz-info { color: ${L.inchiostro2}; margin: 4px 0 10px; font-weight: 400; font-style: italic; }
.mz-info div + div { margin-top: 2px; }
.mz-btn { position: relative; display: flex; width: 100%; min-height: 48px; margin-top: 8px; padding: 6px 18px; align-items: center; justify-content: space-between; gap: 10px; background: ${L.acqua}; color: ${L.cartaChiara}; border: 2px solid ${L.oro}; border-radius: 12px; text-shadow: 0 1px 0 ${L.acquaScura}; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.acquaScura}, 0 3px 0 1.5px ${L.inchiostro}; font: 700 16px ${FONT_LIBRO}; text-align: left; cursor: pointer; }
.mz-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.acquaScura}, 0 1px 0 1.5px ${L.inchiostro}; }
.mz-btn.ghost { background: ${L.cartaChiara}; color: ${L.inchiostro}; text-shadow: none; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.cartaScura}, 0 3px 0 1.5px ${L.inchiostro}; }
.mz-btn:disabled { background: ${L.cartaScura}; color: ${L.inchiostro2}; border-color: ${L.filo}; text-shadow: none; box-shadow: 0 0 0 1.5px ${L.inchiostro2}; cursor: default; }
.mz-btn .sub { display: block; font-size: 13px; text-align: right; }
.mz-btn .miss { color: ${L.oroChiaro}; }
.mz-btn:disabled .miss { color: ${L.rosso}; }
.mz-cost { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.mz-cost + .mz-cost { margin-left: 6px; }
.mz-row { display: flex; gap: 8px; }
.mz-row .mz-btn { flex: 1; justify-content: center; }
.mz-note { margin-top: 8px; color: ${L.rossoScuro}; font-weight: 700; }
.mz-fly { position: absolute; left: 0; top: 0; z-index: 25; pointer-events: none !important; }
.mz-ico { display: inline-block; flex: none; image-rendering: pixelated; }
/* Focus da tastiera ben visibile nei pannelli (acqua piena, niente alone sfocato). */
.mz-sheet :focus { outline: none; }
.mz-sheet :focus-visible { outline: 3px solid ${L.acqua}; outline-offset: 2px; }
.mz-btn .who { display: block; }
.mz-note.ok { color: ${L.acquaScura}; }
.mz-note.bad { color: ${L.rosso}; }
/* WP0 F3: pannello laterale (editor avatar, feed). Sul telefono è un foglio basso che lascia libero il centro; da 700 px sta a destra. */
.mz-sheet.mz-side { max-height: 46%; box-sizing: border-box; }
@media (min-width: 700px) { .mz-sheet.mz-side { left: auto; right: 8px; top: 60px; bottom: 8px; width: 340px; max-height: none; } }
/* Foglio grande (Aspetto, Borsa, Personaggio, Diario): quasi tutto lo schermo, centrato, con un velo scuro dietro; si legge bene anche da telefono. */
.mz-sheet.mz-grande.on { left: 8px; right: 8px; top: calc(env(safe-area-inset-top, 0px) + 8px); bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); width: auto; max-width: 1100px; max-height: none; margin: 0 auto;
  box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.carta}, inset 0 0 0 2.5px ${L.oroScuro}, 0 0 0 100vmax rgba(35,32,31,.55); }
/* Editor dell'avatar: campioni quadrati 44 px, Annulla/Salva sempre in vista in fondo. */
.mz-sheet.mz-ed { box-sizing: border-box; }
.mz-ed .mz-head { gap: 10px; }
.mz-ed-perle { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; min-height: 32px; padding: 0 10px; border-radius: 999px; border: 1.5px solid ${L.oro}; background: ${L.cartaChiara}; white-space: nowrap; }
.mz-ed-row { margin-top: 6px; padding: 4px 8px 6px; border-radius: 10px; background: ${L.cartaChiara}; border: 1.5px solid ${L.filo}; box-shadow: inset 0 0 0 1px ${L.cartaChiara}, inset 0 0 0 2px ${L.cartaScura}; cursor: default; }
.mz-ed-row:focus-within { border-color: ${L.acqua}; }
.mz-ed-lbl { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px; margin-bottom: 4px; color: ${L.inchiostro2}; font-size: 13px; }
.mz-ed-lbl .v { color: ${L.acquaScura}; white-space: nowrap; }
.mz-ed-lbl .v.lock { display: inline-flex; align-items: center; gap: 8px; color: ${L.rossoScuro}; }
.mz-ed-sw { display: flex; gap: 5px; }
.mz-ed-c { width: 44px; height: 44px; flex: none; padding: 0; border-radius: 8px; border: 2px solid ${L.inchiostro}; box-shadow: 0 2px 0 rgba(46,33,24,.35); cursor: pointer; }
.mz-ed-c.on { border-color: ${L.acqua}; box-shadow: inset 0 0 0 2px ${L.cartaChiara}, 0 0 0 2px ${L.oro}, 0 2px 0 2px ${L.inchiostro}; }
.mz-ed-c:active { transform: translateY(2px); }
.mz-ed-st { display: flex; align-items: center; gap: 6px; }
.mz-ed-st .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
.mz-ed-st button { width: 44px; height: 44px; flex: none; padding: 0; border-radius: 10px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; box-shadow: 0 0 0 1.5px ${L.inchiostro}, 0 3px 0 1.5px ${L.inchiostro}; color: ${L.inchiostro}; font: 700 22px ${FONT_LIBRO}; cursor: pointer; }
.mz-ed-st button:active { transform: translateY(2px); box-shadow: 0 0 0 1.5px ${L.inchiostro}, 0 1px 0 1.5px ${L.inchiostro}; }
.mz-ed-buy { min-height: 44px; padding: 0 14px; border-radius: 10px; background: ${L.acqua}; color: ${L.cartaChiara}; border: 2px solid ${L.oro}; text-shadow: 0 1px 0 ${L.acquaScura}; box-shadow: 0 0 0 1.5px ${L.inchiostro}, 0 3px 0 1.5px ${L.inchiostro}; font: 700 14px ${FONT_LIBRO}; cursor: pointer; }
.mz-ed-buy:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 0 0 1.5px ${L.inchiostro}, 0 1px 0 1.5px ${L.inchiostro}; }
.mz-ed-buy:disabled { background: ${L.cartaScura}; color: ${L.inchiostro2}; border-color: ${L.filo}; text-shadow: none; box-shadow: 0 0 0 1.5px ${L.inchiostro2}; cursor: default; }
.mz-ed-act { position: sticky; bottom: -10px; margin: 8px -12px -10px; padding: 0 12px 10px; background: ${L.carta}; border-top: 2px solid ${L.oro}; }
.mz-ed-act .mz-note { margin-top: 6px; }
.mz-ed-act .mz-row .mz-btn { margin-top: 8px; }
.mz-ed-link p { margin: 0; color: ${L.inchiostro2}; font-size: 13px; line-height: 1.35; font-weight: 400; font-style: italic; }
.mz-ed-link .mz-row .mz-btn { margin-top: 6px; min-height: 44px; }
.mz-ed-miss { margin-top: 6px; font-size: 13px; line-height: 1.3; }
.mz-ed-miss.bad { color: ${L.rossoScuro}; }
.mz-ed-merc { color: ${L.acquaScura}; font-size: 12px; }
.mz-ed-url, .mz-ed-nome { width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 10px; border-radius: 10px; background: ${L.cartaChiara}; color: ${L.inchiostro}; border: 2px solid ${L.oro}; box-shadow: 0 0 0 1.5px ${L.inchiostro}; -webkit-user-select: text; user-select: text; }
.mz-ed-url { margin-top: 6px; font: 700 13px ${FONT_LIBRO}; }
.mz-ed-nome { font: 700 16px ${FONT_LIBRO}; }
.mz-ed-nome::placeholder { color: ${L.inchiostro2}; }
`;

let injected = false;
export function injectUiStyle(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.id = 'mz-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Crea un elemento con classe e testo (niente innerHTML con dati del server). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
