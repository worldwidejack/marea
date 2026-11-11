// Stile del pannello del colosseo (arena_menu.ts): solo colori di palette, bordi netti.
import { PAL } from '../ui/style.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';

const P = PAL;
export const CSS_COLOSSEO = `
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
.mz-col .codiceIn { display: flex; gap: 6px; margin-top: 6px; }
.mz-col .codiceIn input { flex: 1; letter-spacing: .15em; text-transform: uppercase; }
.mz-col .codiceIn .mz-btn { width: auto; margin-top: 0; }
.mz-col .formati { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 4px; }
.mz-col .formati button { min-height: 44px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; box-shadow: 0 3px 0 ${L.inchiostro}; color: ${L.inchiostro}; font: 700 14px ${FONT_LIBRO}; cursor: pointer; }
.mz-col .formati button.sel { border-color: ${L.acqua}; color: ${L.acquaScura}; }
.mz-col .formati.schede { grid-template-columns: repeat(4, 1fr); }
.mz-col .formati.schede button.piu { border-style: dashed; color: ${L.inchiostro2}; }
.mz-col .cella.dote small { color: ${L.inchiostro2}; }
.mz-col .cella.spenta { opacity: .55; }
.mz-col .riga.u { grid-template-columns: 1fr; }
.mz-col .riga.u .cella { min-height: 52px; }
.mz-col .lista .uico { width: 26px; text-align: center; color: ${L.oroScuro}; font-size: 18px; }
.mz-col .lista button small { max-width: 58%; text-align: right; }
.mz-col .mappe { color: ${L.inchiostro2}; font-size: 11px; letter-spacing: .05em; margin: 6px 0 4px; }
.mz-col .modi { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
.mz-col .modi button { min-height: 52px; padding: 4px 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; box-shadow: 0 3px 0 ${L.inchiostro}; color: ${L.inchiostro}; font: 700 14px ${FONT_LIBRO}; cursor: pointer; line-height: 1.1; }
.mz-col .modi button small { font-size: 10px; font-weight: normal; color: ${L.inchiostro2}; }
.mz-col .modi button.sel { border-color: ${L.acqua}; background: ${L.carta}; color: ${L.acquaScura}; }
.mz-col .descr { font-size: 12px; color: ${L.inchiostro2}; margin: 2px 0 6px; min-height: 30px; }
.mz-col .formati.p { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
`;
