// Stile «Allegro» dell'HUD del mondo (#417): scelto da Jack e dal gruppo il 18 ott 2026 fra 6 proposte, è la 3
// (`assets/concept/ui/hud2_3_mario.jpg`, linguaggio alla Super Mario: forme tonde, rosso, giallo e azzurro, scritte tonde col contorno).
// Copia fedele: misure prese dall'immagine (941 px = 390 px CSS di telefono), da 700 px in su tutto un po' più grande (--mzk).
// Ridisegna sopra i moduli di sempre (topbar, barra risorse, minimappa, mete, cartellini, bottoni di posto) senza toccarne la logica:
// selettori `body #id` così vince sullo stile vecchio qualunque sia l'ordine dei <style>. I pannelli (fogli, editor, diario…) restano com'erano.
// Joystick, A e B sono in game/input.ts (stile inline). Colori: palette sua, come l'interfaccia delle Corse (ROADMAP §Deviazioni).
import type { Look } from '@marea/protocol';
import { AVATAR } from '@marea/content';
import { injectUiStyle } from './style.ts';

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
  return `<polygon points='${pt.join(' ')}' fill='#fff' stroke='${A.notte}' stroke-width='1.6' stroke-linejoin='round'/><circle cx='12' cy='12' r='3.3' fill='${A.notte}'/>`;
}
/** Vortice bianco del viaggio rapido con due stelline. */
function vortice(): string {
  const pt: string[] = [];
  for (let t = 0; t <= Math.PI * 3.6; t += 0.2) { const r = 1 + t * 0.78; pt.push(`${(12 + Math.cos(t) * r).toFixed(2)},${(12.5 + Math.sin(t) * r).toFixed(2)}`); }
  const stella = (x: number, y: number, s: number) => `<path d='M${x} ${y - s}L${x + s * 0.3} ${y - s * 0.3}L${x + s} ${y}L${x + s * 0.3} ${y + s * 0.3}L${x} ${y + s}L${x - s * 0.3} ${y + s * 0.3}L${x - s} ${y}L${x - s * 0.3} ${y - s * 0.3}Z' fill='#fff'/>`;
  return `<polyline points='${pt.join(' ')}' fill='none' stroke='#fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>${stella(5, 5, 2.4)}${stella(19.5, 6, 1.6)}`;
}
const CAMPANA = `<path d='M12 3.6c-3.3 0-5.6 2.6-5.6 5.9v3.7l-1.9 3v1.3h15v-1.3l-1.9-3V9.5c0-3.3-2.3-5.9-5.6-5.9z' fill='#FFD43B' stroke='${A.notte}' stroke-width='1.5' stroke-linejoin='round'/><path d='M9.5 18.9a2.5 2.5 0 0 0 5 0z' fill='#FFD43B' stroke='${A.notte}' stroke-width='1.4' stroke-linejoin='round'/><path d='M8.6 8.4c.4-1.4 1.4-2.3 2.6-2.6' fill='none' stroke='#fff' stroke-width='1.4' stroke-linecap='round'/>`;
const BANDIERA = `<path d='M8 3.5v17' stroke='${A.notte}' stroke-width='2.2' stroke-linecap='round'/><path d='M8.6 4.4h9.6l-2.6 3.8 2.6 3.8H8.6z' fill='${A.rosso}' stroke='${A.notte}' stroke-width='1.3' stroke-linejoin='round'/>`;
const SPILLO = `<path d='M12 21s-6.2-6.4-6.2-11a6.2 6.2 0 0 1 12.4 0c0 4.6-6.2 11-6.2 11z' fill='${A.oro}' stroke='${A.notte}' stroke-width='1.6'/><circle cx='12' cy='10' r='2.3' fill='${A.notte}'/>`;
/** Testa disegnata coi colori del look (pelle, capelli, vestito): niente WebGL, va bene per il fumetto di un amico e intanto che il
 *  ritratto vero si fa. Senza look, colori di serie. */
export function testaSvg(look: Look | null): string {
  const pelle = AVATAR.pelle[look?.pelle ?? 0] ?? '#F6D3A8', capelli = AVATAR.coloriCapelli[look?.coloreCapelli ?? 3] ?? '#F2C94C', vestito = AVATAR.vestiti[look?.vestito ?? 0] ?? '#2BB3A8';
  return svg(`<circle cx='12' cy='10' r='5.2' fill='${pelle}' stroke='${A.notte}' stroke-width='1.2'/><path d='M6.6 9.2c0-3.4 2.4-5.4 5.4-5.4s5.4 2 5.4 5.4c-1.4-1.2-3.4-1.9-5.4-1.9s-4 .7-5.4 1.9z' fill='${capelli}' stroke='${A.notte}' stroke-width='1.1'/><circle cx='10' cy='10.6' r='.7' fill='${A.notte}'/><circle cx='14' cy='10.6' r='.7' fill='${A.notte}'/><path d='M4 23c.6-4.4 3.8-6.6 8-6.6s7.4 2.2 8 6.6z' fill='${vestito}' stroke='${A.notte}' stroke-width='1.2'/>`);
}
/** Testa stilizzata finché il ritratto vero non è pronto (o se WebGL manca). */
export const TESTA_DI_RISERVA = svg(`<circle cx='12' cy='10' r='5.2' fill='#F6D3A8' stroke='${A.notte}' stroke-width='1.2'/><path d='M6.6 9.2c0-3.4 2.4-5.4 5.4-5.4s5.4 2 5.4 5.4c-1.4-1.2-3.4-1.9-5.4-1.9s-4 .7-5.4 1.9z' fill='#F2C94C' stroke='${A.notte}' stroke-width='1.1'/><path d='M4 23c.6-4.4 3.8-6.6 8-6.6s7.4 2.2 8 6.6z' fill='#2BB3A8' stroke='${A.notte}' stroke-width='1.2'/>`);

const BOTTONE = `border-radius: 50%; border: ${k(3)} solid ${A.bianco}; box-shadow: 0 0 0 ${k(2.5)} ${A.notte}, 0 ${k(4)} 0 ${k(2.5)} ${A.notte}; box-sizing: border-box; background-repeat: no-repeat; background-position: center;`;
const PILLOLA_SCURA = `border-radius: 999px; background: ${A.notteBlu}; border: ${k(2.5)} solid ${A.celeste}; box-shadow: 0 0 0 ${k(2)} ${A.notte}, 0 ${k(4)} 0 ${k(2)} ${A.notte}; color: ${A.bianco}; font: ${k(14)} ${FONT_ALLEGRO};`;
// le colonne: a sinistra monete (T), campanella (T+50), avatar (T+106); a destra ingranaggio (T), minimappa (T+34, 104 px), mete (T+152)
const MINI = 104, MINI_TOP = 34, DESTRA = 22; // DESTRA: la minimappa sta un po' dentro, così + − e bandierina sul bordo restano nello schermo

// Ritocchi del 19 ott (Jack: «un po' diverse dal mockup»), qui e non dentro il CSS perché i commenti del CSS finiscono nel JS scaricato:
// - cartellini nel mondo piccoli come «Nonna Pina» nel mockup: pillola ardesia col bordo bianco e la punta, scritta normale, tutti dello
//   stesso colore (`.mz-labels` nel selettore vince sulle misure grandi dei moduli: .spot, .dng…); le persone solo col nome; il ::before
//   allarga la zona da toccare; sul telefono la fascia dell'HUD in alto resta senza cartellini (ui/sheet.ts, setTaglioEtichette);
// - sul telefono il bottone di posto che A fa già (main.ts lo segna con .mz-in-a e gli dà il verbo in data-verbo) non sta più in mezzo
//   allo schermo: diventa lui la scritta sotto A («Parla», «Gioca»), come nel mockup, e toccarlo fa la stessa cosa di A (la scritta
//   #btnAzione intanto si nasconde). Sul PC resta in mezzo, perché dice il tasto (E); quelli che A non fa (INSIEME, PESCA…) restano dove sono;
// - la pillola delle mete dice nome e spillo coi metri, senza freccia (ui/compass.ts sceglie la meta).
const CSS = `
@font-face { font-family: 'MzTitan'; src: url('/assets/fonts/titan-one-latin.woff2') format('woff2'); font-display: swap; }
:root { --mzk: 1; --mzT: max(10px, env(safe-area-inset-top)); }
@media (min-width: 700px) { :root { --mzk: 1.18; } }

${/* ——— monete (barra risorse): pillola ardesia col bordo d'oro, in alto a sinistra ——— */ ''}
body #mzBar { left: 10px; right: auto; top: ${T}; justify-content: flex-start; align-items: center; gap: ${k(12)}; height: ${k(38)}; padding: 0 ${k(14)} 0 ${k(6)}; box-sizing: border-box;
  background: ${A.ardesia}; border: ${k(3)} solid ${A.oro}; border-radius: 999px; box-shadow: 0 0 0 ${k(2.5)} ${A.notte}, 0 ${k(4)} 0 ${k(2.5)} ${A.notte}; }
body #mzBar .mz-chip { min-height: 0; padding: 0; gap: ${k(5)}; background: none; border: 0; box-shadow: none; color: ${A.bianco}; font: ${k(20)} ${FONT_ALLEGRO}; text-shadow: ${CONTORNO_ALLEGRO}; transition: transform .15s; }
body #mzBar .mz-chip b { min-width: 0; font-weight: 400; }
body #mzBar .mz-chip canvas { width: ${k(24)} !important; height: ${k(24)} !important; }
body #mzBar .mz-chip.bump { transform: scale(1.15); color: ${A.oroChiaro}; }
body #mzBar .mz-chip[data-res="monete"] :is(canvas, span) { display: none; }
body #mzBar .mz-chip[data-res="monete"]::before { content: ''; flex: none; width: ${k(34)}; height: ${k(34)}; margin-left: ${k(-12)}; box-sizing: border-box; border-radius: 50%;
  border: ${k(2.5)} solid ${A.notte}; box-shadow: inset 0 0 0 ${k(3)} ${A.oroChiaro}, inset 0 ${k(-4)} 0 ${k(4)} ${A.oroScuro};
  background: linear-gradient(${A.bianco}, ${A.bianco}) center / ${k(5)} ${k(14)} no-repeat, ${A.oro}; }
${/* cantiere: pillola blu accanto alla campanella (sparisce con l'economia a monete) */ ''}
body #mzWork { top: calc(${T} + ${k(54)}); left: calc(10px + ${k(58)}); right: auto; transform: none; min-height: ${k(32)}; padding: 0 ${k(12)}; max-width: calc(100% - 10px - ${k(58)} - ${DESTRA}px - ${k(MINI + 10 + 48 + 10)}); box-sizing: border-box; ${PILLOLA_SCURA} }
body #mzWork.on { line-height: ${k(27)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

${/* ——— bottoni in alto: ognuno al suo posto (la barra non è più una fila) ——— */ ''}
body #mzTop { position: absolute; inset: 0; display: block; pointer-events: none; z-index: 14; }
body #mzTop .mz-topbtn { position: absolute; pointer-events: auto; padding: 0; ${BOTTONE} background-color: ${A.blu}; color: ${A.bianco}; font: ${k(18)} ${FONT_ALLEGRO}; text-shadow: ${CONTORNO_ALLEGRO}; }
body #mzTop .mz-topbtn:active { transform: translateY(${k(3)}); box-shadow: 0 0 0 ${k(2.5)} ${A.notte}, 0 ${k(1)} 0 ${k(2.5)} ${A.notte}; }
body #mzTop .mz-topbtn.on { box-shadow: 0 0 0 ${k(2.5)} ${A.notte}, 0 0 0 ${k(6)} ${A.oro}, 0 ${k(4)} 0 ${k(6)} ${A.notte}; }
body #mzTop .mz-topbtn.mz-via { display: none !important; }
body #mzTop .mz-topbtn > canvas, body #mzTop .mz-topbtn > svg { display: none; }
body #mzTop .mz-badge { top: ${k(-5)}; right: ${k(-5)}; min-width: ${k(17)}; height: ${k(17)}; padding: 0 ${k(3)}; box-sizing: border-box; border-radius: 999px; background: ${A.rosso}; border: ${k(2.5)} solid ${A.bianco}; box-shadow: 0 0 0 ${k(1.5)} ${A.notte}; color: ${A.bianco}; font: ${k(10)} ${FONT_ALLEGRO}; text-shadow: none; }
body #mzTop #mzFeedBtn { left: 10px; top: calc(${T} + ${k(50)}); width: ${k(46)}; height: ${k(46)}; background-color: ${A.rosso} !important; background-image: ${svg(CAMPANA)}; background-size: 64%; }
body #mzTop #mzAvatarBtn { left: 8px; top: calc(${T} + ${k(106)}); width: ${k(60)}; height: ${k(60)}; overflow: hidden; background: ${A.blu} var(--mz-testa, ${TESTA_DI_RISERVA}) center 70% / 82% no-repeat !important; }
body #mzTop #mzAvatarBtn img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; image-rendering: pixelated; background: ${A.blu}; }
body #mzTop #mzSetBtn { left: auto; right: 6px; top: calc(${T} - ${k(6)}); width: ${k(40)}; height: ${k(40)}; border: 0; box-shadow: none; background: transparent ${svg(ingranaggio())} center / 74% no-repeat !important; filter: drop-shadow(0 ${k(2)} 0 ${A.notte}); }
body #mzTop #mzSetBtn.on { box-shadow: none; filter: drop-shadow(0 0 ${k(3)} ${A.oro}) drop-shadow(0 ${k(2)} 0 ${A.notte}); }
body #mzTop #mzTeleBtn { left: auto; right: calc(${DESTRA}px + ${k(MINI + 10)}); top: calc(${T} + ${k(MINI_TOP + 56)}); width: ${k(48)}; height: ${k(48)}; border-color: ${A.oro}; background-color: ${A.blu} !important; background-image: ${svg(vortice())}; background-size: 74%; font-size: 0; color: transparent; text-shadow: none; }
${/* i bottoni di prova (?templari=1, ?arena=1…): in colonna a sinistra sotto l'avatar */ ''}
body #mzTop #mzArenaVai, body #mzTop #mzAdrenalinaVai, body #mzTop #mzDifesaVai, body #mzTop #mzTemplariProva, body #mzTop #mzTemplariVai { left: 10px; width: ${k(44)}; height: ${k(44)}; font: ${k(20)} system-ui, sans-serif; text-shadow: none; }
body #mzTop #mzArenaVai { top: calc(${T} + ${k(180)}); } body #mzTop #mzAdrenalinaVai { top: calc(${T} + ${k(232)}); } body #mzTop #mzDifesaVai { top: calc(${T} + ${k(284)}); }
body #mzTop #mzTemplariProva { top: calc(${T} + ${k(336)}); } body #mzTop #mzTemplariVai { top: calc(${T} + ${k(388)}); }

${/* ——— «Albi è online»: fumetto bianco che esce dalla campanella ——— */ ''}
#mzOnline { position: absolute; left: calc(10px + ${k(58)}); top: calc(${T} + ${k(56)}); z-index: 15; display: flex; align-items: center; gap: ${k(6)}; height: ${k(36)}; padding: 0 ${k(14)} 0 ${k(5)}; box-sizing: border-box;
  border-radius: 999px; background: ${A.bianco}; border: ${k(2.5)} solid ${A.notte}; box-shadow: 0 ${k(3)} 0 ${A.notte}; color: ${A.notte}; font: ${k(14)} ${FONT_ALLEGRO}; white-space: nowrap; pointer-events: none;
  opacity: 0; transform: translateX(${k(-12)}); transition: opacity .25s, transform .25s; }
#mzOnline.on { opacity: 1; transform: none; }
#mzOnline::before { content: ''; position: absolute; left: ${k(-9)}; top: 50%; width: ${k(10)}; height: ${k(10)}; background: ${A.bianco}; border-left: ${k(2.5)} solid ${A.notte}; border-bottom: ${k(2.5)} solid ${A.notte}; transform: translateY(-50%) rotate(45deg); }
#mzOnline::after { content: ''; position: absolute; right: ${k(-14)}; top: ${k(-12)}; width: ${k(16)}; height: ${k(16)}; background: ${svg(`<path d='M4 18 9 9M11 20l9-6' stroke='${A.oro}' stroke-width='3.4' stroke-linecap='round'/><path d='M4 18 9 9M11 20l9-6' stroke='${A.notte}' stroke-width='1' stroke-linecap='round' opacity='.35'/>`)} center / contain no-repeat; }
#mzOnline i { width: ${k(26)}; height: ${k(26)}; flex: none; border-radius: 50%; background: ${A.crema} ${TESTA_DI_RISERVA} center 80% / 92% no-repeat; }
body.mz-sotto #mzOnline, #ui.mz-racing #mzOnline { visibility: hidden; }

${/* ——— minimappa: anello d'oro, bianco e blu notte; N gialla; + − e bandierina sul bordo ——— */ ''}
body #mzMini { left: auto; right: ${DESTRA}px; bottom: auto; top: calc(${T} + ${k(MINI_TOP)}); width: ${k(MINI)}; height: ${k(MINI)}; }
body #mzMini canvas { border: ${k(5)} solid ${A.oro}; box-shadow: 0 0 0 ${k(3)} ${A.bianco}, 0 0 0 ${k(5.5)} ${A.notte}, 0 ${k(5)} 0 ${k(5.5)} ${A.notte}; background: #1E6FD0; }
body #mzMini .n { top: ${k(1)}; font: ${k(17)} ${FONT_ALLEGRO}; color: ${A.oro}; text-shadow: ${CONTORNO_ALLEGRO}; }
body #mzMiniZoom { left: auto; right: calc(${DESTRA}px - ${k(15)}); bottom: auto; top: calc(${T} + ${k(MINI_TOP + 10)}); gap: ${k(5)}; }
body #mzMiniZoom button { width: ${k(30)}; height: ${k(30)}; ${BOTTONE} border-width: ${k(2.5)}; box-shadow: 0 0 0 ${k(2)} ${A.notte}, 0 ${k(3)} 0 ${k(2)} ${A.notte}; background: ${A.blu}; color: ${A.bianco}; }
body #mzMiniZoom button > * { display: none; }
body #mzMiniZoom button::before { content: '+'; font: ${k(20)} / 1 ${FONT_ALLEGRO}; color: ${A.bianco}; text-shadow: 0 ${k(1.5)} 0 ${A.notte}; margin-top: ${k(-2)}; }
body #mzMiniZoom button[data-zoom="-"]::before { content: '\\2212'; }
#mzMiniMete { position: absolute; right: calc(${DESTRA}px - ${k(13)}); top: calc(${T} + ${k(MINI_TOP + 76)}); z-index: 13; width: ${k(34)}; height: ${k(34)}; padding: 0; cursor: pointer; ${BOTTONE} border-width: ${k(2.5)};
  background: ${A.crema} ${svg(BANDIERA)} center / 66% no-repeat; }
#mzMiniMete.on { background-color: ${A.oroChiaro}; }
#mzMiniMete:active { transform: translateY(${k(2)}); }
#ui.mz-racing #mzMiniMete, body.mz-sotto #mzMiniMete, body.mz-casa #mzMiniMete { visibility: hidden; }

${/* ——— mete: chiuse sono la pillola del navigatore sotto la minimappa (icona, nome, distanza, ›) ——— */ ''}
body #compass { right: 10px; top: calc(${T} + ${k(MINI_TOP + MINI + 16)}); bottom: calc(40% + 16px); gap: ${k(5)}; } ${/* telefono: sopra la guida e i comandi */ ''}
@media (min-width: 700px) { body #compass { bottom: calc(env(safe-area-inset-bottom, 0px) + ${k(190)}); } }
body #compass .mz-mete-head button { min-height: ${k(42)}; padding: 0 0 0 ${k(8)}; gap: ${k(6)}; overflow: hidden; ${PILLOLA_SCURA} }
body #compass .mz-mete-head button.tutte { padding: 0 ${k(10)}; font-size: ${k(12)}; }
body #compass .mz-mete-head button:active { transform: translateY(${k(2)}); }
body #mzMete .mz-mete-lbl { display: inline; }
body #mzMete:has(.mz-mete-txt) > .mz-ico, body #mzMete:has(.mz-mete-txt) .mz-mete-lbl { display: none; }
body #mzMete .mz-mete-sum { gap: ${k(6)}; }
body #mzMete .mz-mete-sum .mz-ico { width: ${k(26)} !important; height: ${k(26)} !important; }
body #mzMete .mz-mete-txt { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.05; }
body #mzMete .mz-mete-n { color: ${A.bianco}; font-size: ${k(13)}; max-width: ${k(150)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
body #mzMete .mz-mete-d { display: inline-flex; align-items: center; gap: ${k(2)}; color: ${A.oro}; font-size: ${k(16)}; text-shadow: 0 ${k(1.5)} 0 ${A.notte}; }
body #mzMete .mz-mete-d::before { content: ''; width: ${k(14)}; height: ${k(14)}; background: ${svg(SPILLO)} center / contain no-repeat; }
body #mzMete .mz-mete-arr { display: none; }
body #mzMete .mz-mete-chev { align-self: stretch; display: flex; align-items: center; padding: 0 ${k(9)}; margin-left: ${k(4)}; background: ${A.blu}; color: ${A.bianco}; font: ${k(16)} ${FONT_ALLEGRO}; border-left: ${k(2)} solid ${A.celeste}; }
body #compass .mz-mete-row { min-height: ${k(36)}; padding: ${k(2)} ${k(10)} ${k(2)} ${k(8)}; gap: ${k(6)}; border-radius: ${k(14)}; background: ${A.notteBlu}; border: ${k(2)} solid ${A.celeste}; box-shadow: 0 0 0 ${k(1.5)} ${A.notte}, 0 ${k(3)} 0 ${k(1.5)} ${A.notte}; color: ${A.bianco}; font: ${k(13)} ${FONT_ALLEGRO}; overflow: hidden; }
body #compass .mz-mete-row.navi { border-color: ${A.rosso}; }
body #compass .mz-mete-row .mz-mete-box { border-radius: ${k(4)}; border-color: ${A.bianco}; }
body #compass .mz-mete-row:not(.off) .mz-mete-box { background: ${A.oro}; border-color: ${A.oro}; }
body #compass .mz-mete-row .mz-mete-apri, body #compass .mz-mete-row .mz-mete-x { border-left-color: ${A.celeste}; color: ${A.oro}; }
body #compass .mz-mete-info { width: ${k(20)}; height: ${k(20)}; border-radius: 50%; border: ${k(1.5)} solid ${A.celeste}; color: ${A.oro}; font: bold ${k(12)} ${FONT_ALLEGRO}; background: rgba(255,255,255,0.08); }
body #compass .mz-mete-info:hover { border-color: ${A.oro}; }
body #compass .mz-mete-info.on { background: ${A.oro}; color: ${A.notte}; border-color: ${A.oro}; }
body #compass .mz-mete-desc { padding: ${k(6)} ${k(10)}; border-radius: ${k(12)}; background: ${A.notteBlu}; border: ${k(2)} solid ${A.celeste}; box-shadow: 0 0 0 ${k(1.5)} ${A.notte}, 0 ${k(3)} 0 ${k(1.5)} ${A.notte}; color: ${A.bianco}; font: ${k(12)} ${FONT_ALLEGRO}; max-width: ${k(260)}; }
body #compass .mz-mete-desc-tit { color: ${A.oro}; font-size: ${k(13)}; }
body #compass .mz-mete-desc-x { color: ${A.bianco}; font-size: ${k(16)}; }
body #compass .mz-mete-desc-txt { color: ${A.bianco}; font-size: ${k(12)}; font-weight: normal; }
body #mzMetePtr .mz-mete-tag { border-radius: 999px; background: ${A.notteBlu}; border: 2px solid ${A.celeste}; box-shadow: 0 2px 0 ${A.notte}; color: ${A.bianco}; font: 12px ${FONT_ALLEGRO}; }

${/* cartellini nel mondo */ ''}
body .mz-labels .mz-lbl { min-height: 24px; min-width: 0; padding: 0 9px 1px; gap: 4px; box-sizing: border-box; border-radius: 999px; background: ${A.ardesia}; border: 2px solid ${A.bianco}; box-shadow: 0 0 0 1.5px ${A.notte}, 0 3px 0 1.5px ${A.notte}; color: ${A.bianco}; font: 13px ${FONT_ALLEGRO}; font-weight: 400; }
body .mz-labels .mz-lbl::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 7px; height: 7px; background: ${A.ardesia}; border-right: 2px solid ${A.bianco}; border-bottom: 2px solid ${A.bianco}; transform: translateX(-50%) rotate(45deg); }
body .mz-labels .mz-lbl.persona .mz-ico { display: none; }
body .mz-labels .mz-lbl.bubble::before { content: ''; position: absolute; inset: -10px -4px; }
body .mz-labels .mz-lbl.full, body .mz-labels .mz-lbl.slot.hint { min-height: 26px; background: ${A.oro}; color: ${A.notte}; font-size: 14px; }
body .mz-labels .mz-lbl.full::after, body .mz-labels .mz-lbl.slot.hint::after { background: ${A.oro}; }

${/* ——— bottoni di posto (GIOCA, PESCA, ENTRA…): pillola bianca col contorno e il tasto in un tondo blu notte ——— */ ''}
body .mz-play { min-height: ${k(52)}; padding: 0 ${k(10)} 0 ${k(10)}; gap: ${k(8)}; border-radius: 999px; background: ${A.bianco}; color: ${A.notte}; border: ${k(3)} solid ${A.notte}; box-shadow: 0 ${k(5)} 0 ${A.notte}; font: ${k(16)} ${FONT_ALLEGRO}; }
body .mz-play:active { box-shadow: 0 ${k(2)} 0 ${A.notte}; }
body .mz-play small { display: grid; place-items: center; min-width: ${k(26)}; height: ${k(26)}; padding: 0 ${k(5)}; box-sizing: border-box; border-radius: 999px; background: ${A.rosso}; color: ${A.bianco}; font-size: ${k(13)}; opacity: 1; text-shadow: 0 1px 0 ${A.notte}; }
@media (hover: none) and (pointer: coarse) {
  body .mz-play.on.mz-in-a { left: auto !important; top: auto !important; right: calc(max(18px, env(safe-area-inset-right, 0px)) + 43px) !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 14px) !important; transform: translateX(50%) !important;
    min-height: 0; min-width: 56px; justify-content: center; gap: 0; padding: 3px 12px 4px; border-radius: 999px; background: ${A.notte} !important; border: 2px solid ${A.celeste}; box-shadow: none; color: ${A.bianco}; font: 15px ${FONT_ALLEGRO}; }
  body .mz-play.on.mz-in-a::before { content: attr(data-verbo); }
  body .mz-play.on.mz-in-a > * { font-size: 0 !important; width: 0 !important; height: 0 !important; min-width: 0 !important; margin: 0; padding: 0 !important; border: 0; overflow: hidden; }
  body .mz-play.on.mz-in-a .mz-ico { display: none !important; }
  body .mz-play.on.mz-in-a:active { transform: translateX(50%) translateY(2px) !important; box-shadow: none; }
  body:has(.mz-play.on.mz-in-a) #btnAzione { display: none !important; }
}

${/* ——— guida «Primi passi»: scheda bianca; sul telefono resta in basso sopra i comandi, sul PC sotto la colonna di sinistra ——— */ ''}
body .mz-guida { border-radius: ${k(18)}; background: ${A.bianco}; border: ${k(3)} solid ${A.notte}; box-shadow: 0 ${k(5)} 0 ${A.notte}; color: ${A.notte}; padding: ${k(8)} ${k(10)} ${k(10)} ${k(12)}; }
body .mz-guida small { color: ${A.bluScuro}; font: ${k(12)} ${FONT_ALLEGRO}; letter-spacing: .04em; }
body .mz-guida b { font: ${k(18)} ${FONT_ALLEGRO}; font-weight: 400; color: ${A.notte}; }
body .mz-guida span { color: #44506E; font: ${k(13)} / 1.3 system-ui, sans-serif; }
body .mz-guida button { border-radius: 999px; background: ${A.notteBlu}; border: 2px solid ${A.celeste}; color: ${A.bianco}; font: ${k(11)} ${FONT_ALLEGRO}; }
body .mz-guida.ok { border-color: #2BA84A; } body .mz-guida.ok small { color: #1E8A3A; }
@media (min-width: 700px) { body .mz-guida { left: 10px; top: calc(${T} + ${k(184)}); width: ${k(260)}; } }

${/* ——— avvisi ——— */ ''}
body #toast { top: max(30%, calc(${T} + ${k(MINI_TOP + MINI + 64)})) !important; max-width: min(${k(340)}, calc(100% - 32px)) !important; box-sizing: border-box; padding: ${k(8)} ${k(16)}; border-radius: ${k(18)}; line-height: 1.25; background: ${A.bianco}; color: ${A.notte}; border: ${k(2.5)} solid ${A.notte}; box-shadow: 0 ${k(4)} 0 ${A.notte}; font: ${k(15)} ${FONT_ALLEGRO}; }
body .mz-banner { border-radius: ${k(20)}; background: ${A.bianco}; color: ${A.notte}; border: ${k(3)} solid ${A.rosso}; box-shadow: 0 ${k(5)} 0 ${A.notte}; font: ${k(16)} ${FONT_ALLEGRO}; }
`;

let fatto = false;
/** Lo stile Allegro, una volta sola (dopo quello di base: ne ridisegna i pezzi dell'HUD). */
export function injectAllegro(): void {
  if (fatto || typeof document === 'undefined') return;
  fatto = true;
  injectUiStyle();
  const s = document.createElement('style');
  s.id = 'mz-allegro-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}
