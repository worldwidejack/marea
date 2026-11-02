// Stile del pannello del colosseo (arena_menu.ts): solo colori di palette, bordi netti.
import { PAL } from '../ui/style.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';

const P = PAL;
export const CSS_COLOSSEO = `
.mz-col { position: absolute; left: 50%; top: max(10px, env(safe-area-inset-top)); bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(420px, calc(100% - 16px)); display: none; flex-direction: column; background: ${L.carta}; border: 3px solid ${L.acqua}; box-shadow: 0 5px 0 ${L.inchiostro}; z-index: 24; }
.mz-col.on { display: flex; }
.mz-col .testa { display: flex; align-items: center; gap: 8px; padding: 10px 10px 6px; }
.mz-col .testa b { flex: 1; font-size: 18px; color: ${L.acquaScura}; letter-spacing: .04em; }
.mz-col .corpo { flex: 1; overflow-y: auto; padding: 0 12px 12px; touch-action: pan-y; }
.mz-col .stat { color: ${L.inchiostro2}; font-size: 13px; margin-bottom: 6px; }
.mz-col h4 { margin: 10px 0 4px; font-size: 14px; color: ${L.inchiostro}; letter-spacing: .05em; }
.mz-col .riga { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.mz-col .riga.q { grid-template-columns: repeat(4, 1fr); }
.mz-col .riga.d { grid-template-columns: repeat(2, 1fr); }
.mz-col .cella { position: relative; min-height: 64px; padding: 4px 2px 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; box-shadow: 0 3px 0 ${L.inchiostro}; color: ${L.inchiostro}; font: 700 11px ${FONT_LIBRO}; cursor: pointer; text-align: center; line-height: 1.15; }
.mz-col .cella.vuota { opacity: .6; border-style: dashed; }
.mz-col .cella.sel { border-color: ${L.acqua}; }
.mz-col .cella i { position: absolute; left: 3px; top: 1px; font-style: normal; color: ${L.inchiostro2}; }
.mz-col .cella small { font-size: 10px; color: ${P.acquaBassa}; }
.mz-col .lista { margin-top: 6px; padding: 6px; background: ${L.carta}; border: 2px solid ${L.acqua}; display: none; }
.mz-col .lista.on { display: block; }
.mz-col .lista button { display: flex; width: 100%; align-items: center; gap: 8px; min-height: 44px; margin: 0 0 4px; padding: 4px 8px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; color: ${L.inchiostro}; font: 700 13px ${FONT_LIBRO}; text-align: left; cursor: pointer; }
.mz-col .lista button.cur { border-color: ${L.acqua}; }
.mz-col .lista button small { margin-left: auto; color: ${L.inchiostro2}; font-size: 11px; }
.mz-col .err { color: ${L.rosso}; font-weight: 700; font-size: 13px; min-height: 18px; margin-top: 6px; }
.mz-col .gioca { padding: 8px 12px 12px; border-top: 2px solid ${L.oro}; }
.mz-col .gioca .mz-btn { justify-content: center; margin-top: 6px; min-height: 50px; }
.mz-col .gioca .mz-btn.coda:not(:disabled) { background: ${L.acqua}; }
.mz-col .gioca .due { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mz-col .attesa { text-align: center; font-weight: 700; font-size: 15px; color: ${L.acquaScura}; min-height: 20px; }
.mz-col .attesa .codice { display: block; font-size: 34px; letter-spacing: .25em; color: ${L.inchiostro}; margin: 4px 0; }
.mz-col .codiceIn { display: flex; gap: 6px; margin-top: 6px; }
.mz-col .codiceIn input { flex: 1; min-width: 0; min-height: 48px; padding: 0 10px; background: ${L.inchiostro}; color: ${L.inchiostro}; border: 2px solid ${L.oro}; font: 700 22px ${FONT_LIBRO}; letter-spacing: .2em; text-transform: uppercase; }
.mz-col .codiceIn .mz-btn { width: auto; margin-top: 0; }
.mz-col .formati { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 4px; }
.mz-col .formati button { min-height: 44px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; box-shadow: 0 3px 0 ${L.inchiostro}; color: ${L.inchiostro}; font: 700 14px ${FONT_LIBRO}; cursor: pointer; }
.mz-col .formati button.sel { border-color: ${L.acqua}; color: ${L.acquaScura}; }
.mz-col .attesa .quanti { display: block; font-size: 13px; font-weight: normal; color: ${L.inchiostro2}; margin: 2px 0 6px; }
.mz-col .formati.m { grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); }
.mz-col .formati.m button { min-height: 36px; font-size: 12px; }
.mz-col .mappe { color: ${L.inchiostro2}; font-size: 11px; letter-spacing: .05em; margin: 6px 0 4px; }
`;
