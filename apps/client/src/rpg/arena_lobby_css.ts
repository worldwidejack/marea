import { PAL as P } from '../ui/style.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';

export const CSS_SALA = `
.mz-col.mz-ar-lobby { position: fixed; display: none; inset: 0; width: auto; transform: none; border: 0; z-index: 32; overflow: hidden;
  color: ${P.sabbiaChiara}; background: ${P.abisso}; padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); box-sizing: border-box;
  grid-template: auto minmax(0, 1fr) auto / minmax(0, 1fr) minmax(300px, min(42vw, 500px)); gap: clamp(8px, 2vw, 28px); isolation: isolate; }
.mz-ar-lobby.on { display: grid; }
.mz-ar-lobby::before, .mz-ar-lobby::after { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.mz-ar-lobby::before { background: ${P.acquaProfonda}; clip-path: polygon(27% 0, 68% 0, 43% 100%, 0 100%); }
.mz-ar-lobby::after { background: ${P.acqua}; opacity: .45; clip-path: polygon(19% 0, 30% 0, 10% 100%, 0 100%, 0 79%); }
.mz-ar-lobby .testa { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0; }
.mz-ar-lobby .arena-identita { display: flex; gap: 10px; align-items: center; }
.mz-ar-lobby h2 { margin: 0; font: italic 900 clamp(36px, 6vw, 76px)/.88 ${FONT_LIBRO}; text-transform: uppercase; letter-spacing: -.035em; text-shadow: 3px 4px ${P.neroCaldo}; }
.mz-ar-lobby .arena-palco { display: grid; position: relative; isolation: isolate; grid-template: minmax(0, 1fr) auto / 100%; min-height: 0; justify-items: center; align-items: end; padding: 0 0 clamp(8px, 3vh, 32px); }
.mz-ar-lobby .arena-palco::before { content: ''; position: absolute; z-index: -1; left: 16%; right: 16%; bottom: 15%; height: 24%; background: ${P.abisso}; border: 2px solid ${P.acqua}; border-radius: 50%; box-shadow: 0 8px 0 ${P.neroCaldo}; }
.mz-ar-lobby .arena-figura { width: 100%; height: 100%; max-height: 480px; object-fit: contain; object-position: center bottom; image-rendering: pixelated; filter: drop-shadow(5px 5px 0 ${P.abisso}); }
.mz-ar-lobby .arena-nome { min-width: 6ch; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: ${P.neroCaldo}; border: 2px solid ${P.giallo}; box-shadow: 3px 4px 0 ${P.abisso}; padding: 3px 16px; text-align: center; font-size: clamp(14px, 2vw, 22px); }
.mz-ar-lobby .arena-lato { display: flex; flex-direction: column; min-height: 0; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 2px solid ${P.neroCaldo}; box-shadow: 4px 5px 0 ${P.neroCaldo}; }
.mz-ar-lobby .arena-nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; background: ${P.neroCaldo}; }
.mz-ar-lobby .arena-nav .arena-btn { background: ${P.abisso}; color: ${P.sabbiaChiara}; border: 0; box-shadow: none; }
.mz-ar-lobby .arena-nav .arena-btn[aria-pressed=true] { background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; }
.mz-ar-lobby .corpo { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 12px 12px; touch-action: pan-y; overscroll-behavior: contain; }
.mz-ar-lobby h3 { margin: 0 0 7px; font-size: clamp(20px, 3vw, 26px); line-height: 1; }
.mz-ar-lobby p { font-size: 14px; line-height: 1.2; margin: 6px 0; }
.mz-ar-lobby .arena-roster { margin: 4px 0 10px; padding: 0; list-style: none; }
.mz-ar-lobby .arena-roster li { padding: 5px 0; border-bottom: 1px solid ${P.legnoChiaro}; overflow-wrap: anywhere; }
.mz-ar-lobby .arena-codice { display: inline-block; padding: 1px 10px; color: ${P.neroCaldo}; background: ${P.giallo}; border: 2px solid ${P.neroCaldo}; font: 900 26px/1.3 ${FONT_LIBRO}; letter-spacing: .22em; user-select: text; }
.mz-ar-lobby .due { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.mz-ar-lobby .arena-btn { display: inline-flex; justify-content: center; align-items: center; gap: 7px; padding: 4px 10px; min-height: 44px; color: ${P.neroCaldo}; background: ${L.cartaChiara}; border: 2px solid ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; font: 800 15px/1.05 ${FONT_LIBRO}; cursor: pointer; }
.mz-ar-lobby .arena-btn:disabled { background: ${P.pietra}; color: ${P.roccia}; cursor: default; box-shadow: none; }
.mz-ar-lobby .arena-btn:not(:disabled):active { transform: translateY(2px); }
.mz-ar-lobby :focus-visible { outline: 3px solid ${P.arancio}; outline-offset: -3px; }
.mz-ar-lobby .codiceIn input, .mz-ar-lobby select { min-width: 0; min-height: 44px; background: ${L.cartaChiara}; color: ${P.neroCaldo}; border: 2px solid ${P.legnoScuro}; font: 700 14px ${FONT_LIBRO}; padding: 4px 6px; }
.mz-ar-lobby .arena-campo, .mz-ar-lobby .arena-squadra { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 7px 0; }
.mz-ar-lobby .arena-squadra b { overflow-wrap: anywhere; flex: 1; }
.mz-ar-lobby .arena-squadra .arena-btn { font-size: 13px; }
.mz-ar-lobby .arena-squadre { margin-top: 4px; }
.mz-ar-lobby .modi .arena-btn.sel, .mz-ar-lobby .formati .arena-btn.sel { border-color: ${P.abisso}; background: ${P.acquaBassa}; color: ${P.neroCaldo}; }
.mz-ar-lobby .modi .arena-btn small { color: inherit; opacity: .85; }
.mz-ar-lobby .gioca { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0; border: 0; }
.mz-ar-lobby .gioca .arena-btn { min-height: 48px; }
.mz-ar-lobby .gioca .err { order: 3; flex-basis: 100%; color: ${P.sabbiaChiara}; margin: 0; background: ${P.neroCaldo}; padding: 3px 8px; }
.mz-ar-lobby .gioca .err:empty { display: none; }
.mz-ar-lobby [data-act=partita-rapida] { background: ${P.acquaBassa}; }
.mz-ar-lobby .gioca [data-act=avvia], .mz-ar-lobby .gioca [data-act=via], .mz-ar-lobby .gioca [data-act=allenamento] { background: ${P.giallo}; color: ${P.neroCaldo}; text-transform: uppercase; font-size: clamp(17px, 2.4vw, 27px); padding-inline: clamp(14px, 3vw, 48px); }
.mz-ar-lobby .gioca [data-act=avvia], .mz-ar-lobby .arena-fill, .mz-ar-lobby .arena-attesa { margin-left: auto; }
.mz-ar-lobby .arena-fill { display: flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 580px) and (orientation: portrait) {
  .mz-col.mz-ar-lobby { grid-template: auto minmax(90px, .85fr) minmax(0, 1fr) auto / 100%; }
  .mz-ar-lobby .arena-palco::before { left: 24%; right: 24%; }
  .mz-ar-lobby .arena-fill { width: 100%; margin-left: 0; }
  .mz-ar-lobby .arena-fill [data-act=players] { flex: 1; }
}
`;
