// Stile dell'HUD del mondo: il «libro illustrato» del kit (ui/kit.ts, `assets/concept/ui/kit/n6_inchiostro.jpg`): cartigli di carta crema
// col bordo d'oro e il filo d'inchiostro, tondi di carta, scritte serif. Piccolo (--mzk .82 sul telefono) così il mondo resta protagonista.
// Il nome del file e ALLEGRO vengono dallo stile di prima (alla Super Mario): ALLEGRO serve ancora al menù dell'avatar finché non passa al kit.
// Ridisegna sopra i moduli di sempre (topbar, barra risorse, minimappa, mete, cartellini, bottoni di posto) senza toccarne la logica:
// selettori `body #id` così vince sullo stile vecchio qualunque sia l'ordine dei <style>. I pannelli (fogli, editor, diario…) restano com'erano.
// Joystick, A e B sono in game/input.ts (stile inline). Colori: palette sua, come l'interfaccia delle Corse (ROADMAP §Deviazioni).
import type { Look } from '@marea/protocol';
import { AVATAR } from '@marea/content';
import { injectUiStyle } from './style.ts';
import { FONT_LIBRO, LIBRO as L, injectKit } from './kit.ts';

export const ALLEGRO = {
  notte: '#1B2340', ardesia: '#2B3445', notteBlu: '#173A70', oro: '#F6C21C', oroChiaro: '#FFE27A', oroScuro: '#D39A00',
  rosso: '#EE3640', rossoScuro: '#B81F2B', blu: '#2F86E8', bluScuro: '#1A5DB8', celeste: '#9FD3FF', crema: '#FFF6E0', bianco: '#FFFFFF',
} as const;
export const FONT_ALLEGRO = "'MzTitan', 'Arial Rounded MT Bold', ui-rounded, system-ui, sans-serif";
const A = ALLEGRO;
/** Contorno pieno delle scritte bianche (niente sfocature): 8 direzioni + l'ombra sotto. */
export const CONTORNO_ALLEGRO = `0 2px 0 ${A.notte}, 2px 0 0 ${A.notte}, -2px 0 0 ${A.notte}, 0 -2px 0 ${A.notte}, 1.5px 1.5px 0 ${A.notte}, -1.5px 1.5px 0 ${A.notte}, 1.5px -1.5px 0 ${A.notte}, -1.5px -1.5px 0 ${A.notte}, 0 3px 0 ${A.notte}`;

/** px CSS che crescono un po' sul PC. */
const k = (n: number) => `calc(var(--mzk) * ${n}px)`;
const T = 'var(--mzT)';
const svg = (dentro: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${dentro}</svg>`)}")`;

/** Ingranaggio bianco: 8 denti squadrati (32 punti, due fuori e due dentro), buco blu notte. */
function ingranaggio(): string {
  const pt: string[] = [];
  for (let i = 0; i < 32; i++) {
    const a = ((i + 0.5) / 32) * Math.PI * 2, r = i % 4 < 2 ? 10.6 : 7.8;
    pt.push(`${(12 + Math.cos(a) * r).toFixed(2)},${(12 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `<polygon points='${pt.join(' ')}' fill='${L.cartaChiara}' stroke='${L.inchiostro}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='12' cy='12' r='3.3' fill='${L.inchiostro}'/>`;
}
/** Vortice bianco del viaggio rapido con due stelline. */
function vortice(): string {
  const pt: string[] = [];
  for (let t = 0; t <= Math.PI * 3.6; t += 0.2) { const r = 1 + t * 0.78; pt.push(`${(12 + Math.cos(t) * r).toFixed(2)},${(12.5 + Math.sin(t) * r).toFixed(2)}`); }
  const stella = (x: number, y: number, s: number) => `<path d='M${x} ${y - s}L${x + s * 0.3} ${y - s * 0.3}L${x + s} ${y}L${x + s * 0.3} ${y + s * 0.3}L${x} ${y + s}L${x - s * 0.3} ${y + s * 0.3}L${x - s} ${y}L${x - s * 0.3} ${y - s * 0.3}Z' fill='#fff'/>`;
  return `<polyline points='${pt.join(' ')}' fill='none' stroke='#fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>${stella(5, 5, 2.4)}${stella(19.5, 6, 1.6)}`;
}
const CAMPANA = `<path d='M12 3.6c-3.3 0-5.6 2.6-5.6 5.9v3.7l-1.9 3v1.3h15v-1.3l-1.9-3V9.5c0-3.3-2.3-5.9-5.6-5.9z' fill='${L.oroChiaro}' stroke='${L.inchiostro}' stroke-width='1.5' stroke-linejoin='round'/><path d='M9.5 18.9a2.5 2.5 0 0 0 5 0z' fill='${L.oroChiaro}' stroke='${L.inchiostro}' stroke-width='1.4' stroke-linejoin='round'/><path d='M8.6 8.4c.4-1.4 1.4-2.3 2.6-2.6' fill='none' stroke='#fff' stroke-width='1.4' stroke-linecap='round'/>`;
const BANDIERA = `<path d='M8 3.5v17' stroke='${L.inchiostro}' stroke-width='2.2' stroke-linecap='round'/><path d='M8.6 4.4h9.6l-2.6 3.8 2.6 3.8H8.6z' fill='${L.rosso}' stroke='${L.inchiostro}' stroke-width='1.3' stroke-linejoin='round'/>`;
const SPILLO = `<path d='M12 21s-6.2-6.4-6.2-11a6.2 6.2 0 0 1 12.4 0c0 4.6-6.2 11-6.2 11z' fill='${L.oro}' stroke='${L.inchiostro}' stroke-width='1.6'/><circle cx='12' cy='10' r='2.3' fill='${L.inchiostro}'/>`;
/** Testa disegnata coi colori del look (pelle, capelli, vestito): niente WebGL, va bene per il fumetto di un amico e intanto che il
 *  ritratto vero si fa. Senza look, colori di serie. */
export function testaSvg(look: Look | null): string {
  const pelle = AVATAR.pelle[look?.pelle ?? 0] ?? '#F6D3A8', capelli = AVATAR.coloriCapelli[look?.coloreCapelli ?? 3] ?? '#F2C94C', vestito = AVATAR.vestiti[look?.vestito ?? 0] ?? '#2BB3A8';
  return svg(`<circle cx='12' cy='10' r='5.2' fill='${pelle}' stroke='${A.notte}' stroke-width='1.2'/><path d='M6.6 9.2c0-3.4 2.4-5.4 5.4-5.4s5.4 2 5.4 5.4c-1.4-1.2-3.4-1.9-5.4-1.9s-4 .7-5.4 1.9z' fill='${capelli}' stroke='${A.notte}' stroke-width='1.1'/><circle cx='10' cy='10.6' r='.7' fill='${A.notte}'/><circle cx='14' cy='10.6' r='.7' fill='${A.notte}'/><path d='M4 23c.6-4.4 3.8-6.6 8-6.6s7.4 2.2 8 6.6z' fill='${vestito}' stroke='${A.notte}' stroke-width='1.2'/>`);
}
/** Testa stilizzata finché il ritratto vero non è pronto (o se WebGL manca). */
export const TESTA_DI_RISERVA = svg(`<circle cx='12' cy='10' r='5.2' fill='#F6D3A8' stroke='${A.notte}' stroke-width='1.2'/><path d='M6.6 9.2c0-3.4 2.4-5.4 5.4-5.4s5.4 2 5.4 5.4c-1.4-1.2-3.4-1.9-5.4-1.9s-4 .7-5.4 1.9z' fill='#F2C94C' stroke='${A.notte}' stroke-width='1.1'/><path d='M4 23c.6-4.4 3.8-6.6 8-6.6s7.4 2.2 8 6.6z' fill='#2BB3A8' stroke='${A.notte}' stroke-width='1.2'/>`);

const BOTTONE = `border-radius: 50%; border: ${k(2.5)} solid ${L.oro}; box-shadow: 0 0 0 ${k(1.5)} ${L.inchiostro}, inset 0 0 0 ${k(1.5)} ${L.cartaChiara}, 0 ${k(3)} 0 ${k(1.5)} rgba(46,33,24,.35); box-sizing: border-box; background-repeat: no-repeat; background-position: center;`;
/** Cornice del libro (bordo d'oro, filo d'inchiostro) per cartigli e fumetti dell'HUD. */
const CORNICE = `border: ${k(2)} solid ${L.oro}; box-shadow: 0 0 0 ${k(1.5)} ${L.inchiostro}, inset 0 0 0 ${k(1.5)} ${L.cartaChiara}, 0 ${k(3)} 0 ${k(1.5)} rgba(46,33,24,.35);`;
const PILLOLA = `border-radius: 999px; background: ${L.carta}; ${CORNICE} color: ${L.inchiostro}; font: 700 ${k(14)} ${FONT_LIBRO};`;
// le colonne: a sinistra monete (T), campanella (T+46), avatar (T+96); a destra ingranaggio (T), minimappa (T+30, 100 px), mete (T+142)
const MINI = 100, MINI_TOP = 30, DESTRA = 18; // DESTRA: la minimappa sta un po' dentro, così + − e bandierina sul bordo restano nello schermo

const CSS = `
@font-face { font-family: 'MzTitan'; src: url('/assets/fonts/titan-one-latin.woff2') format('woff2'); font-display: swap; }
:root { --mzk: .82; --mzT: max(8px, env(safe-area-inset-top)); }
@media (min-width: 700px) { :root { --mzk: 1; } }

/* ——— monete (barra risorse): cartiglio crema col bordo d'oro, in alto a sinistra ——— */
body #mzBar { left: 8px; right: auto; top: ${T}; justify-content: flex-start; align-items: center; gap: ${k(10)}; height: ${k(34)}; padding: 0 ${k(14)} 0 ${k(4)}; box-sizing: border-box;
  background: ${L.carta}; border-radius: 999px; ${CORNICE} }
body #mzBar .mz-chip { min-height: 0; padding: 0; gap: ${k(5)}; background: none; border: 0; box-shadow: none; color: ${L.inchiostro}; font: 700 ${k(19)} ${FONT_LIBRO}; text-shadow: none; transition: transform .15s; }
body #mzBar .mz-chip b { min-width: 0; font-weight: 700; }
body #mzBar .mz-chip canvas { width: ${k(22)} !important; height: ${k(22)} !important; }
body #mzBar .mz-chip.bump { transform: scale(1.15); color: ${L.acqua}; }
body #mzBar .mz-chip[data-res="monete"] :is(canvas, span) { display: none; }
body #mzBar .mz-chip[data-res="monete"]::before { content: ''; flex: none; width: ${k(26)}; height: ${k(26)}; box-sizing: border-box; border-radius: 50%;
  border: ${k(1.5)} solid ${L.inchiostro}; box-shadow: inset 0 0 0 ${k(2.5)} ${L.oro}; background: linear-gradient(${L.oroScuro}, ${L.oroScuro}) center / ${k(4)} ${k(11)} no-repeat, ${L.oroChiaro}; }

/* ——— bottoni in alto: tondi di carta col filo d'oro, ognuno al suo posto ——— */
body #mzTop { position: absolute; inset: 0; display: block; pointer-events: none; z-index: 14; }
body #mzTop .mz-topbtn { position: absolute; pointer-events: auto; padding: 0; ${BOTTONE} background-color: ${L.cartaChiara}; color: ${L.inchiostro}; font: 700 ${k(18)} ${FONT_LIBRO}; text-shadow: none; }
body #mzTop .mz-topbtn:active { transform: translateY(${k(2)}); }
body #mzTop .mz-topbtn.on { box-shadow: 0 0 0 ${k(1.5)} ${L.inchiostro}, 0 0 0 ${k(4)} ${L.acquaChiara}, 0 0 0 ${k(5.5)} ${L.inchiostro}; }
body #mzTop .mz-topbtn.mz-via { display: none !important; }
body #mzTop .mz-topbtn > canvas, body #mzTop .mz-topbtn > svg { display: none; }
body #mzTop .mz-badge { top: ${k(-4)}; right: ${k(-4)}; min-width: ${k(15)}; height: ${k(15)}; padding: 0 ${k(3)}; box-sizing: border-box; border-radius: 999px; background: ${L.rosso}; border: ${k(2)} solid ${L.cartaChiara}; box-shadow: 0 0 0 ${k(1)} ${L.inchiostro}; color: ${L.cartaChiara}; font: 700 ${k(9)} ${FONT_LIBRO}; text-shadow: none; }
body #mzTop #mzFeedBtn { left: 8px; top: calc(${T} + ${k(46)}); width: ${k(42)}; height: ${k(42)}; background-image: ${svg(CAMPANA)}; background-size: 62%; }
body #mzTop #mzAvatarBtn { left: 8px; top: calc(${T} + ${k(96)}); width: ${k(46)}; height: ${k(46)}; overflow: hidden; background: ${L.blu} var(--mz-testa, ${TESTA_DI_RISERVA}) center 70% / 82% no-repeat !important; }
body #mzTop #mzAvatarBtn img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; image-rendering: pixelated; background: ${L.blu}; }
body #mzTop #mzSetBtn { left: auto; right: 6px; top: calc(${T} - ${k(4)}); width: ${k(34)}; height: ${k(34)}; border: 0; box-shadow: none; background: transparent ${svg(ingranaggio())} center / 80% no-repeat !important; }
body #mzTop #mzSetBtn.on { box-shadow: none; filter: drop-shadow(0 0 ${k(3)} ${L.acquaChiara}); }
body #mzTop #mzTeleBtn { left: auto; right: calc(${DESTRA}px + ${k(MINI + 8)}); top: calc(${T} + ${k(MINI_TOP + 2)}); width: ${k(40)}; height: ${k(40)}; background-color: ${L.blu} !important; background-image: ${svg(vortice())}; background-size: 74%; font-size: 0; color: transparent; text-shadow: none; }
/* i bottoni di prova (?templari=1, ?arena=1…): in colonna a sinistra sotto l'avatar */
body #mzTop #mzArenaVai, body #mzTop #mzAdrenalinaVai, body #mzTop #mzDifesaVai, body #mzTop #mzTemplariProva, body #mzTop #mzTemplariVai { left: 8px; width: ${k(42)}; height: ${k(42)}; font: ${k(19)} system-ui, sans-serif; }
body #mzTop #mzArenaVai { top: calc(${T} + ${k(180)}); } body #mzTop #mzAdrenalinaVai { top: calc(${T} + ${k(230)}); } body #mzTop #mzDifesaVai { top: calc(${T} + ${k(280)}); }
body #mzTop #mzTemplariProva { top: calc(${T} + ${k(330)}); } body #mzTop #mzTemplariVai { top: calc(${T} + ${k(380)}); }

/* ——— «Albi è online»: fumetto di carta che esce dalla campanella ——— */
#mzOnline { position: absolute; left: calc(8px + ${k(52)}); top: calc(${T} + ${k(50)}); z-index: 15; display: flex; align-items: center; gap: ${k(6)}; height: ${k(32)}; padding: 0 ${k(12)} 0 ${k(4)}; box-sizing: border-box;
  border-radius: 999px; background: ${L.cartaChiara}; ${CORNICE} color: ${L.inchiostro}; font: 700 ${k(14)} ${FONT_LIBRO}; white-space: nowrap; pointer-events: none;
  opacity: 0; transform: translateX(${k(-12)}); transition: opacity .25s, transform .25s; }
#mzOnline.on { opacity: 1; transform: none; }
#mzOnline i { width: ${k(24)}; height: ${k(24)}; flex: none; border-radius: 50%; background: ${L.cartaScura} ${TESTA_DI_RISERVA} center 80% / 92% no-repeat; }
body.mz-sotto #mzOnline, #ui.mz-racing #mzOnline { visibility: hidden; }

/* ——— minimappa: anello d'oro col filo d'inchiostro, N d'oro in serif; + − e bandierina sul bordo ——— */
body #mzMini { left: auto; right: ${DESTRA}px; bottom: auto; top: calc(${T} + ${k(MINI_TOP)}); width: ${k(MINI)}; height: ${k(MINI)}; }
body #mzMini canvas { border: ${k(3.5)} solid ${L.oro}; box-shadow: 0 0 0 ${k(1.5)} ${L.inchiostro}, inset 0 0 0 ${k(1.5)} ${L.oroScuro}, 0 ${k(3)} 0 ${k(1.5)} rgba(46,33,24,.35); background: #3C86B8; }
body #mzMini .n { top: ${k(-2)}; font: 700 ${k(16)} ${FONT_LIBRO}; color: ${L.oroChiaro}; text-shadow: 0 1px 0 ${L.inchiostro}, 1px 0 0 ${L.inchiostro}, -1px 0 0 ${L.inchiostro}, 0 -1px 0 ${L.inchiostro}; }
body #mzMiniZoom { left: auto; right: calc(${DESTRA}px - ${k(13)}); bottom: auto; top: calc(${T} + ${k(MINI_TOP + 8)}); gap: ${k(4)}; }
body #mzMiniZoom button { width: ${k(28)}; height: ${k(28)}; ${BOTTONE} background: ${L.cartaChiara}; color: ${L.inchiostro}; }
body #mzMiniZoom button > * { display: none; }
body #mzMiniZoom button::before { content: '+'; font: 700 ${k(19)} / 1 ${FONT_LIBRO}; color: ${L.inchiostro}; margin-top: ${k(-2)}; }
body #mzMiniZoom button[data-zoom="-"]::before { content: '\\2212'; }
#mzMiniMete { position: absolute; right: calc(${DESTRA}px - ${k(11)}); top: calc(${T} + ${k(MINI_TOP + 72)}); z-index: 14; width: ${k(30)}; height: ${k(30)}; padding: 0; cursor: pointer; ${BOTTONE}
  background: ${L.cartaChiara} ${svg(BANDIERA)} center / 64% no-repeat; }
#mzMiniMete.on { background-color: ${L.oroChiaro}; }
#mzMiniMete:active { transform: translateY(${k(2)}); }
#ui.mz-racing #mzMiniMete, body.mz-sotto #mzMiniMete, body.mz-casa #mzMiniMete { visibility: hidden; }

/* ——— mete: chiuse sono il cartiglio del navigatore sotto la minimappa (icona, nome, distanza, ›) ——— */
body #compass { right: 8px; top: calc(${T} + ${k(MINI_TOP + MINI + 12)}); bottom: calc(40% + 16px); gap: ${k(5)}; } /* telefono: sopra la guida e i comandi */
@media (min-width: 700px) { body #compass { bottom: calc(env(safe-area-inset-bottom, 0px) + ${k(190)}); } }
body #compass .mz-mete-head button { min-height: ${k(38)}; padding: 0 0 0 ${k(8)}; gap: ${k(6)}; overflow: hidden; ${PILLOLA} }
body #compass .mz-mete-head button.tutte { padding: 0 ${k(10)}; font-size: ${k(12)}; }
body #compass .mz-mete-head button:active { transform: translateY(${k(2)}); }
body #mzMete .mz-mete-lbl { display: inline; }
body #mzMete:has(.mz-mete-txt) > .mz-ico, body #mzMete:has(.mz-mete-txt) .mz-mete-lbl { display: none; }
body #mzMete .mz-mete-sum { gap: ${k(6)}; }
body #mzMete .mz-mete-sum .mz-ico { width: ${k(22)} !important; height: ${k(22)} !important; }
body #mzMete .mz-mete-txt { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.05; }
body #mzMete .mz-mete-n { color: ${L.inchiostro}; font-size: ${k(13)}; max-width: ${k(150)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
body #mzMete .mz-mete-d { display: inline-flex; align-items: center; gap: ${k(2)}; color: ${L.acquaScura}; font-size: ${k(14)}; }
body #mzMete .mz-mete-d::before { content: ''; width: ${k(12)}; height: ${k(12)}; background: ${svg(SPILLO)} center / contain no-repeat; }
body #mzMete .mz-mete-arr { color: ${L.acqua}; width: ${k(14)}; height: ${k(18)}; }
body #mzMete .mz-mete-chev { align-self: stretch; display: flex; align-items: center; padding: 0 ${k(8)}; margin-left: ${k(4)}; background: ${L.acqua}; color: ${L.cartaChiara}; font: 700 ${k(15)} ${FONT_LIBRO}; border-left: ${k(1.5)} solid ${L.oro}; }
body #compass .mz-mete-row { min-height: ${k(34)}; padding: ${k(2)} ${k(10)} ${k(2)} ${k(8)}; gap: ${k(6)}; border-radius: ${k(12)}; background: ${L.carta}; ${CORNICE} color: ${L.inchiostro}; font: 700 ${k(13)} ${FONT_LIBRO}; overflow: hidden; }
body #compass .mz-mete-row.navi { border-color: ${L.acqua}; }
body #compass .mz-mete-row .mz-mete-dist { flex: 1; } /* distanza, freccia e ? a destra: il centro della riga resta la riga */
body #compass .mz-mete-row .mz-mete-box { border-radius: ${k(4)}; border-color: ${L.inchiostro2}; }
body #compass .mz-mete-row:not(.off) .mz-mete-box { background: ${L.acqua}; border-color: ${L.acquaScura}; }
body #compass .mz-mete-row .mz-mete-apri, body #compass .mz-mete-row .mz-mete-x { border-left-color: ${L.filo}; color: ${L.acqua}; }
body #compass .mz-mete-info { width: ${k(20)}; height: ${k(20)}; border-radius: 50%; border: ${k(1.5)} solid ${L.oro}; color: ${L.acquaScura}; font: italic 700 ${k(12)} ${FONT_LIBRO}; background: ${L.cartaChiara}; }
body #compass .mz-mete-info:hover { border-color: ${L.acqua}; }
body #compass .mz-mete-info.on { background: ${L.acqua}; color: ${L.cartaChiara}; border-color: ${L.acquaScura}; }
body #compass .mz-mete-desc { padding: ${k(6)} ${k(10)}; border-radius: ${k(12)}; background: ${L.cartaChiara}; ${CORNICE} color: ${L.inchiostro}; font: ${k(12)} ${FONT_LIBRO}; max-width: ${k(260)}; }
body #compass .mz-mete-desc-tit { color: ${L.acquaScura}; font-size: ${k(13)}; font-weight: 700; }
body #compass .mz-mete-desc-x { color: ${L.inchiostro}; font-size: ${k(16)}; }
body #compass .mz-mete-desc-txt { color: ${L.inchiostro2}; font-size: ${k(12)}; font-weight: normal; font-style: italic; }
body #mzMetePtr .mz-mete-tag { border-radius: 999px; background: ${L.cartaChiara}; border: 1.5px solid ${L.oro}; box-shadow: 0 0 0 1px ${L.inchiostro}; color: ${L.inchiostro}; font: 700 12px ${FONT_LIBRO}; }

/* ——— cartellini nel mondo (nomi, edifici): cartiglio crema col bordo d'oro e la punta ——— */
body .mz-lbl { min-height: 24px; padding: 0 9px; gap: 5px; border-radius: 999px; background: ${L.cartaChiara}; border: 1.5px solid ${L.oro}; box-shadow: 0 0 0 1px ${L.inchiostro}, 0 2px 0 1px rgba(46,33,24,.35); color: ${L.inchiostro}; font: 700 13px ${FONT_LIBRO}; }
body .mz-lbl::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 7px; height: 7px; background: ${L.cartaChiara}; border-right: 1.5px solid ${L.oro}; border-bottom: 1.5px solid ${L.oro}; transform: translateX(-50%) rotate(45deg); }
body .mz-lbl.bubble { border-color: ${L.acqua}; } body .mz-lbl.bubble::after { border-color: ${L.acqua}; }
body .mz-lbl.full { background: ${L.oroChiaro}; } body .mz-lbl.full::after { background: ${L.oroChiaro}; }
body .mz-lbl.timer, body .mz-lbl.slot { border-color: ${L.filo}; } body .mz-lbl.timer::after, body .mz-lbl.slot::after { border-color: ${L.filo}; }
body .mz-lbl.slot.hint { background: ${L.oroChiaro}; border-color: ${L.oro}; } body .mz-lbl.slot.hint::after { background: ${L.oroChiaro}; border-color: ${L.oro}; }

/* ——— bottoni di posto (GIOCA, PESCA, ENTRA…): bottone verde acqua del kit, il tasto in un tondo di carta ——— */
body .mz-play { min-height: ${k(48)}; padding: 0 ${k(14)} 0 ${k(8)}; gap: ${k(8)}; border-radius: ${k(14)}; background: ${L.acqua}; color: ${L.cartaChiara}; border: ${k(2)} solid ${L.oro};
  box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.acquaScura}, 0 ${k(3)} 0 1.5px ${L.inchiostro}; font: 700 ${k(17)} ${FONT_LIBRO}; text-shadow: 0 1px 0 ${L.acquaScura}; }
body .mz-play:active { transform: translateY(${k(2)}); }
body .mz-play small { display: grid; place-items: center; min-width: ${k(24)}; height: ${k(24)}; padding: 0 ${k(5)}; box-sizing: border-box; border-radius: 999px; background: ${L.cartaChiara}; color: ${L.inchiostro}; border: 1.5px solid ${L.oro}; font-size: ${k(12)}; opacity: 1; text-shadow: none; }

/* ——— scheda della storia: pagina di carta; sul telefono resta in basso sopra i comandi, sul PC sotto la colonna di sinistra ——— */
body .mz-guida { border-radius: ${k(14)}; background: ${L.carta}; ${CORNICE} color: ${L.inchiostro}; padding: ${k(8)} ${k(10)} ${k(10)} ${k(12)}; }
body .mz-guida small { color: ${L.acquaScura}; font: italic 700 ${k(12)} ${FONT_LIBRO}; letter-spacing: .02em; }
body .mz-guida b { font: 700 ${k(17)} ${FONT_LIBRO}; color: ${L.inchiostro}; }
body .mz-guida span { color: ${L.inchiostro2}; font: ${k(13)} / 1.3 ${FONT_LIBRO}; }
body .mz-guida i { color: ${L.inchiostro2}; border-top-color: ${L.oro}; font: italic ${k(12)} / 1.3 ${FONT_LIBRO}; }
body .mz-guida.ok { border-color: ${L.foglia}; } body .mz-guida.ok small { color: ${L.foglia}; }
@media (min-width: 700px) { body .mz-guida { left: 10px; top: calc(${T} + ${k(204)}); width: ${k(260)}; } }

/* ——— avvisi ——— */
body #toast { top: max(30%, calc(${T} + ${k(MINI_TOP + MINI + 64)})) !important; max-width: min(${k(340)}, calc(100% - 32px)) !important; box-sizing: border-box; padding: ${k(7)} ${k(16)}; border-radius: ${k(14)}; line-height: 1.25; background: ${L.cartaChiara}; color: ${L.inchiostro}; ${CORNICE} font: 700 ${k(15)} ${FONT_LIBRO}; }
body .mz-banner { border-radius: ${k(16)}; background: ${L.cartaChiara}; color: ${L.inchiostro}; border: ${k(2)} solid ${L.rosso}; box-shadow: 0 0 0 1.5px ${L.inchiostro}; font: 700 ${k(16)} ${FONT_LIBRO}; }
`;

let fatto = false;
/** Lo stile Allegro, una volta sola (dopo quello di base: ne ridisegna i pezzi dell'HUD). */
export function injectAllegro(): void {
  if (fatto || typeof document === 'undefined') return;
  fatto = true;
  injectUiStyle();
  injectKit();
  const s = document.createElement('style');
  s.id = 'mz-allegro-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}
