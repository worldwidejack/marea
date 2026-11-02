// CSS dei pannelli GDR (R-pannelli): scheda del personaggio e fogli di Banco, Tavolo Alchemico, Forziere, Serra. Stile «libro illustrato»
// del kit (ui/kit.ts): carta, oro, inchiostro, serif. Righe e bottoni ≥ 44 px, testo ≥ 14 px (le etichette piccole 13 px). Iniettato una volta.
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';

const CSS = `
#mzEroe.mz-rpg { padding-top: 0; overscroll-behavior: contain; }
@media (max-width: 699px) { #mzEroe.mz-rpg { max-height: 72%; } }
#mzEroe .mz-rp-top { position: sticky; top: 0; z-index: 3; margin: 0 -12px 6px; padding: 6px 12px 8px; background: ${L.carta}; border-bottom: 2px solid ${L.oro}; }
#mzEroe .mz-rp-top .mz-head { margin-bottom: 6px; }
.mz-rp-coins { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: ${L.acquaScura}; font-weight: 700; white-space: nowrap; }
.mz-rp-coins i { width: 14px; height: 14px; border-radius: 50%; background: ${L.oroChiaro}; box-shadow: inset 0 0 0 2.5px ${L.oro}, 0 0 0 1.5px ${L.inchiostro}; display: inline-block; }
.mz-rp-tabs { display: flex; gap: 6px; }
.mz-rp-tab { flex: 1; min-height: 44px; padding: 0 4px; border-radius: 10px; background: ${L.cartaScura}; border: 2px solid ${L.oro}; color: ${L.inchiostro2}; font: 700 15px ${FONT_LIBRO}; cursor: pointer; position: relative; }
.mz-rp-tab.on { background: ${L.acqua}; color: ${L.cartaChiara}; box-shadow: inset 0 0 0 1.5px ${L.acquaScura}; text-shadow: 0 1px 0 ${L.acquaScura}; }
.mz-rp-tab .mz-badge { display: flex; top: -12px; right: -8px; }
.mz-rp-sec { display: flex; justify-content: space-between; gap: 8px; margin: 12px 0 4px; padding-bottom: 2px; border-bottom: 2px solid ${L.filo}; color: ${L.inchiostro2}; font-size: 15px; font-style: italic; font-weight: 700; }
.mz-rp-sec .r { color: ${L.inchiostro}; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.mz-rp-stat { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 30px; font-size: 15px; color: ${L.inchiostro2}; }
.mz-rp-stat .l { display: inline-flex; align-items: center; gap: 6px; }
.mz-rp-stat b { color: ${L.inchiostro}; text-align: right; }
.mz-rp-stat .sq { width: 10px; height: 10px; border: 1.5px solid ${L.inchiostro}; border-radius: 3px; display: inline-block; }
.mz-rp-bar { height: 10px; border-radius: 5px; overflow: hidden; background: ${L.cartaScura}; border: 1.5px solid ${L.inchiostro}; margin: 2px 0 6px; }
.mz-rp-bar > i { display: block; height: 100%; }
.mz-rp-big { display: flex; align-items: baseline; gap: 10px; font-size: 22px; font-weight: 700; color: ${L.acquaScura}; }
.mz-rp-big small { font-size: 14px; color: ${L.inchiostro2}; }
.mz-rp-row { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; margin-top: 6px; padding: 4px 8px; box-sizing: border-box; background: ${L.cartaChiara}; border: 2px solid ${L.filo}; color: ${L.inchiostro}; font: 15px ${FONT_LIBRO}; text-align: left; cursor: pointer; }
.mz-rp-row.info { cursor: default; }
.mz-rp-row.on { border-color: ${L.acqua}; background: ${L.cartaScura}; }
.mz-rp-row .t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.mz-rp-row .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.mz-rp-row .q { color: ${L.inchiostro2}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
.mz-rp-skill .top .n { flex: 1; }
.mz-rp-skill .top .q { font-size: 14px; }
.mz-rp-row.dim .n { color: ${L.inchiostro2}; }
.mz-rp-row .eq { color: ${L.acquaScura}; font-size: 13px; font-weight: 700; white-space: nowrap; }
.mz-rp-row .lv { min-width: 3ch; text-align: right; color: ${L.acquaScura}; font-weight: 700; }
.mz-rp-skill { display: block; }
.mz-rp-skill.prest { border-color: ${L.acqua}; }
.mz-rp-badge-prest { display: inline-block; padding: 1px 4px; margin-left: 6px; background: ${L.cartaChiara}; border: 1px solid ${L.acqua}; color: ${L.acquaScura}; font-size: 11px; font-weight: 700; vertical-align: middle; }
.mz-rp-row .lv.prest { color: ${L.acquaScura}; font-size: 13px; white-space: nowrap; }
.mz-rp-row .lv.prest small { color: ${L.oroScuro}; font-size: 11px; margin-left: 2px; }
.mz-rp-prest-banner { padding: 6px 8px; margin-bottom: 6px; background: ${L.cartaChiara}; border: 2px solid ${L.acqua}; color: ${L.inchiostro}; font-size: 13px; line-height: 1.3; }
.mz-rp-prest-banner b { color: ${L.acquaScura}; }
.mz-rp-reset-card { margin-top: 8px; margin-bottom: 6px; padding: 8px; background: ${L.cartaChiara}; border: 2px solid ${L.oroScuro}; }
.mz-rp-reset-tit { font-size: 15px; font-weight: 700; color: ${L.acquaScura}; }
.mz-rp-reset-sub { font-size: 13px; color: ${L.inchiostro2}; margin: 3px 0 6px; line-height: 1.35; }
.mz-rp-skill .top { display: flex; align-items: center; gap: 8px; }
.mz-rp-skill .mz-rp-bar { margin: 4px 0 0; }
.mz-rp-det { margin: 0; padding: 6px 8px 8px; background: ${L.cartaScura}; border: 2px solid ${L.acqua}; border-top: 0; font-size: 14px; color: ${L.inchiostro2}; }
.mz-rp-det p { margin: 2px 0 4px; }
.mz-rp-det .mz-btn { margin-top: 6px; min-height: 44px; }
.mz-rp-det .mz-row .mz-btn { font-size: 14px; padding: 4px 6px; }
.mz-rp-perk { margin-top: 6px; padding: 6px 8px; background: ${L.cartaChiara}; border: 2px solid ${L.filo}; border-left-width: 6px; font-size: 14px; color: ${L.inchiostro2}; }
.mz-rp-perk .t { display: flex; justify-content: space-between; gap: 8px; color: ${L.inchiostro}; font-weight: 700; }
.mz-rp-perk.preso { border-left-color: ${L.acqua}; }
.mz-rp-perk.pronto { border-left-color: ${L.acqua}; border-color: ${L.acqua}; }
.mz-rp-perk.chiuso { border-left-color: ${L.filo}; }
.mz-rp-perk.chiuso .t { color: ${L.inchiostro2}; }
.mz-rp-perk .st { font-size: 13px; white-space: nowrap; }
.mz-rp-perk .why { color: ${L.oroScuro}; font-weight: 700; margin-top: 2px; }
.mz-rp-ok { color: ${L.acqua}; } .mz-rp-bad { color: ${L.rosso}; } .mz-rp-warn { color: ${L.oroScuro}; } .mz-rp-lock { color: ${L.inchiostro2}; }
.mz-rp-slots { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mz-rp-slot { display: flex; align-items: center; gap: 6px; min-height: 48px; padding: 2px 6px; box-sizing: border-box; background: ${L.cartaChiara}; border: 2px dashed ${L.filo}; color: ${L.inchiostro2}; font: 14px ${FONT_LIBRO}; text-align: left; cursor: pointer; min-width: 0; }
.mz-rp-slot.full { border-style: solid; border-color: ${L.oro}; color: ${L.inchiostro}; }
.mz-rp-slot.on { border-color: ${L.acqua}; }
.mz-rp-slot span { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mz-rp-slot .k { font-size: 13px; color: ${L.inchiostro2}; }
.mz-rp-slot .v { font-weight: 700; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2; }
.mz-rp-cmp { font-size: 14px; color: ${L.inchiostro2}; }
.mz-rp-cmp .up { color: ${L.acqua}; font-weight: 700; } .mz-rp-cmp .down { color: ${L.rosso}; font-weight: 700; }
.mz-rp-cost { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.mz-rp-cost .have { white-space: nowrap; font-weight: 700; }
.mz-rp-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
.mz-rp-cols .mz-rp-row { min-height: 44px; padding: 2px 4px; gap: 4px; font-size: 14px; }
.mz-rp-cols .mz-rp-row .n { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 14px; line-height: 1.2; }
.mz-rp-colh { position: sticky; top: var(--rp-top, 60px); z-index: 1; padding: 2px 0 4px; background: ${L.carta}; font-size: 13px; color: ${L.inchiostro2}; font-weight: 700; }
.mz-rp-colh b { display: block; color: ${L.inchiostro}; font-size: 14px; }
.mz-rp-empty { margin: 6px 0; color: ${L.inchiostro2}; font-size: 14px; }
.mz-rp-act { position: sticky; bottom: -10px; z-index: 2; margin: 10px -12px -10px; padding: 4px 12px 10px; background: ${L.carta}; border-top: 2px solid ${L.oro}; font-size: 14px; }
.mz-rp-act .mz-row .mz-btn { font-size: 14px; padding: 4px 6px; }
.mz-rp-ico { width: 24px; height: 24px; }
.mz-rp-note { margin: 8px 0; padding: 6px 8px; border: 2px dashed ${L.filo}; color: ${L.inchiostro2}; font-size: 14px; }
.mz-btn.butta { background: ${L.cartaChiara}; color: ${L.inchiostro}; border-color: ${L.rosso}; }
.mz-btn.butta.sicuro { background: ${L.rosso}; color: ${L.inchiostro}; border-color: ${L.inchiostro}; }
.mz-rp-sotto { margin: 0 0 8px; padding: 6px 8px; border: 2px solid ${L.acqua}; background: ${L.cartaScura}; font-size: 13px; font-weight: 700; color: ${L.inchiostro}; }
.mz-btn.vita { background: ${L.rosso}; color: ${L.inchiostro}; } .mz-btn.magicka { background: ${L.acqua}; } .mz-btn.stamina { background: ${L.acqua}; }
#mzHeroBtn canvas { width: 24px; height: 24px; }
body.mz-sotto #mzEroe:not(.sotto) { display: none; }
`;

let injected = false;
export function injectRpgStyle(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style'); s.id = 'mz-rpg-style'; s.textContent = CSS; document.head.appendChild(s);
}
