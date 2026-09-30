// Stile pixel dell'interfaccia in DOM (ART_BIBLE §2 e §9): solo colori della palette, bordi netti a 2 px, ombre «dure» senza sfocatura,
// niente gradienti, font monospazio come l'HUD. Iniettato una volta sola in <head>. Bersagli touch ≥ 44 px.
export const PAL = {
  sabbiaChiara: '#F4E3C1', sabbia: '#E2B97F', legnoChiaro: '#C98A4B', legno: '#8E5A2B', legnoScuro: '#5A3A1E', ombraCalda: '#2E1E14',
  erbaChiara: '#D9E872', erba: '#8FC35B', erbaScura: '#4E9A46', bosco: '#2C6B3F',
  acquaBassa: '#7FE3E0', acqua: '#3FB9C9', acquaProfonda: '#2478A8', abisso: '#163F73',
  pietraChiara: '#E8E1D6', pietra: '#B9AFA3', pietraScura: '#7F7568', roccia: '#4A4340', neroCaldo: '#23201F',
  rosso: '#E8433F', arancio: '#F2A33A', giallo: '#F5D547', viola: '#A64DFF', rosaNeon: '#FF3DA6',
} as const;

const P = PAL;
const CSS = `
.mz { font-family: ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.mz-bar { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: none; gap: 6px; justify-content: center; z-index: 12; pointer-events: none !important; }
.mz-bar.on { display: flex; }
.mz-chip { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 10px; background: rgba(46,30,20,.92); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-size: 18px; font-weight: bold; }
.mz-chip b { min-width: 3ch; text-align: right; }
.mz-chip.bump { border-color: ${P.giallo}; color: ${P.giallo}; }
.mz-work { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 50px); left: 50%; transform: translateX(-50%); display: none; min-height: 44px; padding: 0 12px; align-items: center; gap: 8px; background: rgba(46,30,20,.92); border: 2px solid ${P.arancio}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-size: 15px; font-weight: bold; z-index: 12; cursor: pointer; white-space: nowrap; }
.mz-work.on { display: flex; }
.mz-banner { position: absolute; left: 12px; right: 12px; top: 40%; padding: 14px; background: rgba(46,30,20,.95); border: 2px solid ${P.rosso}; box-shadow: 0 4px 0 ${P.neroCaldo}; font-size: 16px; text-align: center; z-index: 30; display: none; }
.mz-banner.on { display: block; }
.mz-labels { position: absolute; inset: 0; pointer-events: none !important; z-index: 5; overflow: hidden; }
.mz-lbl { position: absolute; left: 0; top: 0; transform: translate(-9999px, 0); display: flex; align-items: center; gap: 5px; padding: 0 8px; min-height: 30px; background: rgba(46,30,20,.92); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-size: 14px; font-weight: bold; white-space: nowrap; pointer-events: none; }
.mz-lbl.bubble { pointer-events: auto; cursor: pointer; min-height: 40px; min-width: 44px; justify-content: center; border-color: ${P.erba}; }
.mz-lbl.full { border-color: ${P.giallo}; background: ${P.legnoScuro}; color: ${P.giallo}; }
.mz-lbl.timer { border-color: ${P.arancio}; }
.mz-sheet { position: absolute; left: 8px; right: 8px; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); max-height: 62%; overflow-y: auto; padding: 12px 12px 10px; background: rgba(46,30,20,.96); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 4px 0 ${P.neroCaldo}; z-index: 20; display: none; font-size: 15px; line-height: 1.35; touch-action: pan-y; }
.mz-sheet.on { display: block; }
.mz-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.mz-title { font-size: 17px; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; color: ${P.sabbiaChiara}; }
.mz-lvl { color: ${P.giallo}; }
.mz-x { width: 44px; height: 44px; flex: none; display: flex; align-items: center; justify-content: center; background: ${P.legnoScuro}; border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara}; font: bold 20px ui-monospace, Menlo, monospace; cursor: pointer; padding: 0; }
.mz-info { color: ${P.sabbia}; margin: 4px 0 10px; }
.mz-info div + div { margin-top: 2px; }
.mz-btn { display: flex; width: 100%; min-height: 48px; margin-top: 8px; padding: 6px 12px; align-items: center; justify-content: space-between; gap: 10px; background: ${P.arancio}; color: ${P.neroCaldo}; border: 2px solid ${P.neroCaldo}; box-shadow: 0 4px 0 ${P.neroCaldo}; font: bold 16px ui-monospace, Menlo, monospace; text-align: left; cursor: pointer; }
.mz-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-btn.green { background: ${P.erba}; }
.mz-btn.ghost { background: ${P.legnoScuro}; color: ${P.sabbiaChiara}; border-color: ${P.legnoChiaro}; }
.mz-btn:disabled { background: ${P.roccia}; color: ${P.pietra}; border-color: ${P.pietraScura}; box-shadow: 0 4px 0 ${P.neroCaldo}; cursor: default; }
.mz-btn .sub { display: block; font-size: 13px; font-weight: bold; text-align: right; }
.mz-btn .miss { color: ${P.rosso}; }
.mz-btn:disabled .miss { color: ${P.arancio}; }
.mz-cost { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.mz-cost + .mz-cost { margin-left: 6px; }
.mz-row { display: flex; gap: 8px; }
.mz-row .mz-btn { flex: 1; justify-content: center; }
.mz-note { margin-top: 8px; color: ${P.arancio}; font-weight: bold; }
.mz-fly { position: absolute; left: 0; top: 0; z-index: 25; pointer-events: none !important; }
.mz-ico { display: inline-block; flex: none; image-rendering: pixelated; }
/* F2-tavolo: Tavolo delle Sfide. Focus da tastiera ben visibile (giallo pieno, niente alone sfocato). */
.mz-sheet :focus { outline: none; }
.mz-sheet :focus-visible { outline: 3px solid ${P.giallo}; outline-offset: 2px; }
.mz-tv-sec { margin: 14px 0 2px; padding-bottom: 2px; border-bottom: 2px solid ${P.legno}; color: ${P.sabbia}; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: .06em; }
.mz-tv-wait { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 40px; margin-top: 6px; padding: 4px 8px; border: 2px dashed ${P.legno}; color: ${P.sabbia}; font-size: 14px; }
.mz-tv-wait .st { color: ${P.acquaBassa}; font-weight: bold; white-space: nowrap; }
.mz-btn .who { display: block; }
.mz-btn .st { display: block; font-size: 13px; font-weight: bold; }
.mz-step { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 4px 6px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; cursor: default; }
.mz-step .n { flex: 1; display: flex; align-items: center; gap: 6px; font-weight: bold; }
.mz-step .v { min-width: 4ch; text-align: center; font-size: 20px; font-weight: bold; color: ${P.giallo}; }
.mz-step button { width: 44px; height: 44px; flex: none; padding: 0; background: ${P.ombraCalda}; border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; color: ${P.sabbiaChiara}; font: bold 22px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-step button:disabled { color: ${P.pietraScura}; border-color: ${P.pietraScura}; cursor: default; }
.mz-step button:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
.mz-big { margin: 4px 0 8px; font-size: 22px; font-weight: bold; text-transform: uppercase; }
.mz-big.win { color: ${P.giallo}; } .mz-big.lose { color: ${P.rosso}; } .mz-big.even { color: ${P.acquaBassa}; }
.mz-medal { font-weight: bold; text-transform: uppercase; }
.mz-medal.oro { color: ${P.giallo}; } .mz-medal.argento { color: ${P.pietraChiara}; } .mz-medal.bronzo { color: ${P.arancio}; } .mz-medal.none { color: ${P.pietra}; }
.mz-note.ok { color: ${P.erba}; }
.mz-note.bad { color: ${P.rosso}; }
.mz-tot { color: ${P.giallo}; font-weight: bold; }
@media (min-width: 700px) { .mz-sheet.mz-tv { left: 50%; right: auto; width: 520px; transform: translateX(-50%); max-height: 78%; } }
/* WP0 F3: pannello laterale (editor avatar, feed). Sul telefono è un foglio basso che lascia libero il centro; da 700 px sta a destra. */
.mz-sheet.mz-side { max-height: 46%; }
@media (min-width: 700px) { .mz-sheet.mz-side { left: auto; right: 8px; top: 60px; bottom: 8px; width: 340px; max-height: none; } }
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
