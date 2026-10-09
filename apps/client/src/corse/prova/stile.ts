// Lo stile del banco di prova delle piste (provapiste.html): HUD, semaforo, messaggi, pannello delle prove, menù opzioni, minimappa,
// linee di velocità. Colori solo della palette.
import { P } from '../../render/island_parts.ts';

export function stileProva(): void {
  const css = document.createElement('style');
  css.textContent = `
.pp-hud { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 6px; pointer-events: none; font: bold 18px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; z-index: 3; }
.pp-hud div { padding: 4px 9px; background: rgba(46,30,20,.88); border: 2px solid ${P.legnoChiaro}; white-space: nowrap; }
.pp-hud div.turbo { border-color: ${P.arancio}; color: ${P.arancio}; }
.pp-hud small { font-size: 11px; color: ${P.sabbia}; }
.pp-big { position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%); padding: 10px 20px; background: rgba(46,30,20,.95); border: 3px solid ${P.legnoChiaro}; font: bold 38px ui-monospace, Menlo, monospace; color: ${P.sabbiaChiara}; text-align: center; pointer-events: none; display: none; white-space: nowrap; }
.pp-big small { display: block; font-size: 14px; color: ${P.sabbia}; margin-top: 4px; }
.pp-toast { position: absolute; left: 50%; top: 21%; transform: translateX(-50%); font: bold 26px ui-monospace, Menlo, monospace; pointer-events: none; text-shadow: 2px 2px 0 ${P.neroCaldo}, -2px 2px 0 ${P.neroCaldo}, 2px -2px 0 ${P.neroCaldo}, -2px -2px 0 ${P.neroCaldo}; display: none; white-space: nowrap; }
.pp-panel { position: absolute; left: max(8px, env(safe-area-inset-left)); top: calc(max(8px, env(safe-area-inset-top)) + 44px); display: flex; flex-direction: column; gap: 4px; font: bold 12px ui-monospace, Menlo, monospace; max-width: 60vw; z-index: 4; }
.pp-panel button, .pp-opz button, .pp-ingr { pointer-events: auto; text-align: left; border: 2px solid ${P.legno}; background: rgba(46,30,20,.78); color: ${P.sabbiaChiara}; padding: 5px 7px; border-radius: 4px; font: bold 12px ui-monospace, Menlo, monospace; cursor: pointer; touch-action: manipulation; }
.pp-panel button.fold, .pp-ingr { border-color: ${P.arancio}; color: ${P.giallo}; }
.pp-panel button.ab { border-color: ${P.acquaProfonda}; }
.pp-panel button.ab.off { color: ${P.pietra}; }
.pp-ingr { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(8px, env(safe-area-inset-top)) + 44px); z-index: 4; }
.pp-opz { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(8px, env(safe-area-inset-top)) + 78px); display: none; flex-direction: column; gap: 4px; padding: 8px; background: rgba(46,30,20,.95); border: 3px solid ${P.legnoChiaro}; z-index: 5; font: bold 12px ui-monospace, Menlo, monospace; color: ${P.sabbia}; }
.pp-opz.on { display: flex; }
.pp-opz .riga { display: flex; gap: 4px; }
.pp-opz button.sel { border-color: ${P.giallo}; color: ${P.giallo}; }
.pp-mappa { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(8px, env(safe-area-inset-top)) + 78px); width: 112px; height: 86px; background: rgba(46,30,20,.7); border: 2px solid ${P.legnoChiaro}; image-rendering: pixelated; pointer-events: none; z-index: 3; }
.pp-linee { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; pointer-events: none !important; z-index: 1; }
`;
  document.head.appendChild(css);
}
