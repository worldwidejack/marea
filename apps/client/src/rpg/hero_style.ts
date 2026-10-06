// CSS dei pannelli GDR (R-pannelli): scheda del personaggio e fogli di Banco, Tavolo Alchemico, Forziere, Serra. Solo colori di PAL,
// bordi netti a 2 px, niente gradienti. Righe e bottoni ≥ 44 px, testo ≥ 14 px (le etichette piccole 13 px). Iniettato una volta.
import { PAL } from '../ui/style.ts';

const P = PAL;
const CSS = `
#mzEroe.mz-rpg { padding-top: 0; overscroll-behavior: contain; }
@media (max-width: 699px) { #mzEroe.mz-rpg { max-height: 72%; } }
#mzEroe .mz-rp-top { position: sticky; top: 0; z-index: 3; margin: 0 -12px 6px; padding: 10px 12px 8px; background: ${P.ombraCalda}; border-bottom: 2px solid ${P.legno}; }
#mzEroe .mz-rp-top .mz-head { margin-bottom: 6px; }
.mz-rp-coins { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: ${P.giallo}; font-weight: bold; white-space: nowrap; }
.mz-rp-coins i { width: 12px; height: 12px; background: ${P.giallo}; border: 2px solid ${P.arancio}; box-sizing: border-box; display: inline-block; }
.mz-rp-tabs { display: flex; gap: 6px; }
.mz-rp-tab { flex: 1; min-height: 44px; padding: 0 4px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbia}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; position: relative; }
.mz-rp-tab.on { background: ${P.arancio}; color: ${P.neroCaldo}; border-color: ${P.neroCaldo}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
.mz-rp-tab .mz-badge { display: flex; top: -12px; right: -8px; }
.mz-rp-sec { display: flex; justify-content: space-between; gap: 8px; margin: 12px 0 4px; padding-bottom: 2px; border-bottom: 2px solid ${P.legno}; color: ${P.sabbia}; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: .06em; }
.mz-rp-sec .r { color: ${P.sabbiaChiara}; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.mz-rp-stat { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 30px; font-size: 15px; color: ${P.sabbia}; }
.mz-rp-stat .l { display: inline-flex; align-items: center; gap: 6px; }
.mz-rp-stat b { color: ${P.sabbiaChiara}; text-align: right; }
.mz-rp-stat .sq { width: 10px; height: 10px; border: 2px solid ${P.neroCaldo}; display: inline-block; }
.mz-rp-bar { height: 8px; background: ${P.neroCaldo}; border: 2px solid ${P.legno}; margin: 2px 0 6px; }
.mz-rp-bar > i { display: block; height: 100%; }
.mz-rp-big { display: flex; align-items: baseline; gap: 10px; font-size: 22px; font-weight: bold; color: ${P.giallo}; }
.mz-rp-big small { font-size: 14px; color: ${P.sabbia}; }
.mz-rp-row { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; margin-top: 6px; padding: 4px 8px; box-sizing: border-box; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; font: 15px ui-monospace, Menlo, monospace; text-align: left; cursor: pointer; }
.mz-rp-row.info { cursor: default; }
.mz-rp-row.on { border-color: ${P.giallo}; background: ${P.ombraCalda}; }
.mz-rp-row .t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.mz-rp-row .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: bold; }
.mz-rp-row .q { color: ${P.sabbia}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
.mz-rp-skill .top .n { flex: 1; }
.mz-rp-skill .top .q { font-size: 14px; }
.mz-rp-row.dim .n { color: ${P.pietra}; }
.mz-rp-row .eq { color: ${P.giallo}; font-size: 13px; font-weight: bold; white-space: nowrap; }
.mz-rp-row .lv { min-width: 3ch; text-align: right; color: ${P.giallo}; font-weight: bold; }
.mz-rp-skill { display: block; }
.mz-rp-skill .top { display: flex; align-items: center; gap: 8px; }
.mz-rp-skill .mz-rp-bar { margin: 4px 0 0; }
.mz-rp-det { margin: 0; padding: 6px 8px 8px; background: ${P.ombraCalda}; border: 2px solid ${P.giallo}; border-top: 0; font-size: 14px; color: ${P.sabbia}; }
.mz-rp-det p { margin: 2px 0 4px; }
.mz-rp-det .mz-btn { margin-top: 6px; min-height: 44px; }
.mz-rp-det .mz-row .mz-btn { font-size: 14px; padding: 4px 6px; }
.mz-rp-perk { margin-top: 6px; padding: 6px 8px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; border-left-width: 6px; font-size: 14px; color: ${P.sabbia}; }
.mz-rp-perk .t { display: flex; justify-content: space-between; gap: 8px; color: ${P.sabbiaChiara}; font-weight: bold; }
.mz-rp-perk.preso { border-left-color: ${P.erba}; }
.mz-rp-perk.pronto { border-left-color: ${P.giallo}; border-color: ${P.giallo}; }
.mz-rp-perk.chiuso { border-left-color: ${P.pietraScura}; }
.mz-rp-perk.chiuso .t { color: ${P.pietra}; }
.mz-rp-perk .st { font-size: 13px; white-space: nowrap; }
.mz-rp-perk .why { color: ${P.arancio}; font-weight: bold; margin-top: 2px; }
.mz-rp-ok { color: ${P.erba}; } .mz-rp-bad { color: ${P.rosso}; } .mz-rp-warn { color: ${P.arancio}; } .mz-rp-lock { color: ${P.pietra}; }
.mz-rp-slots { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mz-rp-slot { display: flex; align-items: center; gap: 6px; min-height: 48px; padding: 2px 6px; box-sizing: border-box; background: ${P.legnoScuro}; border: 2px dashed ${P.legno}; color: ${P.pietra}; font: 14px ui-monospace, Menlo, monospace; text-align: left; cursor: pointer; min-width: 0; }
.mz-rp-slot.full { border-style: solid; border-color: ${P.legnoChiaro}; color: ${P.sabbiaChiara}; }
.mz-rp-slot.on { border-color: ${P.giallo}; }
.mz-rp-slot span { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mz-rp-slot .k { font-size: 13px; color: ${P.sabbia}; }
.mz-rp-slot .v { font-weight: bold; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2; }
.mz-rp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.mz-rp-chip { display: inline-flex; align-items: center; gap: 6px; flex: none; min-height: 44px; min-width: 44px; padding: 0 10px; background: ${P.legnoScuro}; border: 2px solid ${P.legno}; color: ${P.sabbiaChiara}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-rp-chip.on { border-color: ${P.giallo}; color: ${P.giallo}; background: ${P.ombraCalda}; }
.mz-rp-chip.lock { color: ${P.pietra}; border-style: dashed; }
.mz-rp-chip .dot { width: 12px; height: 12px; border: 2px solid ${P.neroCaldo}; display: inline-block; }
.mz-rp-cmp { font-size: 14px; color: ${P.sabbia}; }
.mz-rp-cmp .up { color: ${P.erba}; font-weight: bold; } .mz-rp-cmp .down { color: ${P.rosso}; font-weight: bold; }
.mz-rp-cost { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.mz-rp-cost .have { white-space: nowrap; font-weight: bold; }
.mz-rp-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
.mz-rp-cols .mz-rp-row { min-height: 44px; padding: 2px 4px; gap: 4px; font-size: 14px; }
.mz-rp-cols .mz-rp-row .n { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 14px; line-height: 1.2; }
.mz-rp-colh { position: sticky; top: var(--rp-top, 60px); z-index: 1; padding: 2px 0 4px; background: ${P.ombraCalda}; font-size: 13px; color: ${P.sabbia}; font-weight: bold; }
.mz-rp-colh b { display: block; color: ${P.sabbiaChiara}; font-size: 14px; }
.mz-rp-empty { margin: 6px 0; color: ${P.pietra}; font-size: 14px; }
.mz-rp-act { position: sticky; bottom: -10px; z-index: 2; margin: 10px -12px -10px; padding: 4px 12px 10px; background: ${P.ombraCalda}; border-top: 2px solid ${P.legno}; font-size: 14px; }
.mz-rp-act .mz-row .mz-btn { font-size: 14px; padding: 4px 6px; }
.mz-rp-ico { width: 24px; height: 24px; }
.mz-rp-note { margin: 8px 0; padding: 6px 8px; border: 2px dashed ${P.legno}; color: ${P.sabbia}; font-size: 14px; }
.mz-btn.vita { background: ${P.rosso}; color: ${P.sabbiaChiara}; } .mz-btn.magicka { background: ${P.acqua}; } .mz-btn.stamina { background: ${P.erba}; }
#mzHeroBtn canvas { width: 24px; height: 24px; }
body.mz-sotto #mzEroe { display: none; }
`;

let injected = false;
export function injectRpgStyle(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style'); s.id = 'mz-rpg-style'; s.textContent = CSS; document.head.appendChild(s);
}
