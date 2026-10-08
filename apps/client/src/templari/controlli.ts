// Controlli delle ondate oltre a joystick, A (attacca) e B (corri) di game/input.ts: AZIONE (dice cosa fa e quanto costa: posa la reliquia,
// ripara tenendolo premuto, compra), SCAMBIA (le due armi), PAUSA in alto a destra con RIPRENDI · MIRA AUTO/A MANO · ESCI. Tastiera: F =
// AZIONE (tenuto), Q = scambia, Esc = pausa; clic sinistro tenuto sul canvas = A. Con la pausa (o la domanda «Uscire?») la partita è ferma.
// AUTO (di serie, salvato sul dispositivo): l'eroe attacca da solo quando ha uno zombie a portata; A MANO solo quando premi.
import type { TPrompt } from '@marea/sim/templari/types.ts';
import { PAL, el } from '../ui/style.ts';

const SAFE = 'env(safe-area-inset-bottom, 0px)', RIGHT = 'max(16px, env(safe-area-inset-right, 0px))', TOP = 'max(8px, env(safe-area-inset-top))';
const CSS = `
.mz-tpl-az { position: absolute; right: ${RIGHT}; bottom: calc(${SAFE} + 196px); min-width: 150px; min-height: 54px; padding: 0 14px; display: none; align-items: center; justify-content: center; gap: 8px; background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 16px ui-monospace, Menlo, monospace; z-index: 16; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.mz-tpl-az.on { display: flex; } .mz-tpl-az.giu { transform: translateY(3px); box-shadow: 0 2px 0 ${PAL.neroCaldo}; } .mz-tpl-az.no { background: ${PAL.pietra}; }
.mz-tpl-az small { font-size: 12px; opacity: .75; }
.mz-tpl-sc { position: absolute; right: calc(${RIGHT} + 96px); bottom: calc(${SAFE} + 122px); width: 56px; height: 56px; border-radius: 50%; display: none; align-items: center; justify-content: center; background: rgba(46,30,20,.8); border: 3px solid rgba(244,227,193,.7); color: ${PAL.sabbiaChiara}; font: bold 12px ui-monospace, Menlo, monospace; z-index: 13; touch-action: none; }
.mz-tpl-sc.on { display: flex; }
.mz-tpl-top { position: absolute; right: ${RIGHT}; top: ${TOP}; z-index: 14; display: flex; gap: 8px; }
.mz-tpl-tb { min-height: 44px; min-width: 44px; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 6px; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-tpl-tb .pz { display: flex; gap: 4px; } .mz-tpl-tb .pz i { display: block; width: 5px; height: 16px; background: ${PAL.sabbiaChiara}; box-shadow: 1px 1px 0 ${PAL.neroCaldo}; }
.mz-tpl-menu { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(320px, calc(100% - 32px)); padding: 16px; background: rgba(46,30,20,.97); border: 3px solid ${PAL.rosso}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; text-align: center; display: none; }
.mz-tpl-menu.on { display: block; }
.mz-tpl-menu b { display: block; font-size: 22px; margin-bottom: 6px; color: ${PAL.sabbiaChiara}; }
.mz-tpl-menu .sub { color: ${PAL.sabbia}; font-size: 14px; margin-bottom: 12px; }
.mz-tpl-menu .mz-btn { justify-content: center; margin-top: 8px; }
.mz-tpl-menu .mz-btn.auto { background: ${PAL.giallo}; }
`;

export type Controlli = {
  /** Un campione per tick: A in più (clic tenuto), SCAMBIA (fronte) e AZIONE (tenuto o appena toccato). */
  sample(): { a: boolean; c: boolean; d: boolean };
  readonly paused: boolean;
  readonly auto: boolean;
  /** Il bottone AZIONE dice cosa fa adesso (null = sparisce). */
  setPrompt(p: TPrompt): void;
  /** SCAMBIA c'è solo con due armi. */
  setScambia(on: boolean): void;
  hide(): void;
  dispose(): void;
};

const AUTO_KEY = 'marea:templari:auto';

export function createControlli(o: { root: HTMLElement; canvas: HTMLCanvasElement; onEsci(): void }): Controlli {
  if (!document.getElementById('mz-tpl-ctl-style')) { const st = document.createElement('style'); st.id = 'mz-tpl-ctl-style'; st.textContent = CSS; document.head.appendChild(st); }
  let auto = true;
  try { auto = localStorage.getItem(AUTO_KEY) !== '0'; } catch { /* storage bloccato: AUTO */ }
  const stop = (e: Event) => e.stopPropagation();
  // AZIONE: tenuto (ripara) o tocco breve (latch: anche più corto di un tick arriva alla sim)
  const az = el('div', 'mz mz-tpl-az'); az.id = 'mzTplAzione';
  const azHeld = new Set<number>();
  let dLatch = false, cLatch = false, mouseA = false;
  az.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); azHeld.add(e.pointerId); dLatch = true; az.classList.add('giu'); try { az.setPointerCapture(e.pointerId); } catch { /* sintetico */ } });
  const azUp = (e: PointerEvent) => { azHeld.delete(e.pointerId); if (!azHeld.size) az.classList.remove('giu'); };
  az.addEventListener('pointerup', azUp); az.addEventListener('pointercancel', azUp);
  const sc = el('div', 'mz mz-tpl-sc', 'SCAMBIA'); sc.id = 'mzTplScambia';
  sc.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); cLatch = true; });
  // pausa e menu
  const top = el('div', 'mz mz-tpl-top');
  const pz = el('span', 'pz'); pz.append(el('i'), el('i'));
  const pBtn = el('button', 'mz-tpl-tb'); pBtn.type = 'button'; pBtn.id = 'mzTplPausaBtn'; pBtn.title = 'Pausa (Esc)'; pBtn.setAttribute('aria-label', 'Pausa'); pBtn.append(pz);
  top.append(pBtn);
  const menu = el('div', 'mz mz-tpl-menu'); menu.id = 'mzTplPausa';
  const titolo = el('b', '', 'PAUSA'), sub = el('div', 'sub', 'Le ondate aspettano.');
  const riprendi = el('button', 'mz-btn green', 'RIPRENDI'); riprendi.type = 'button'; riprendi.dataset['act'] = 'riprendi';
  const autoBtn = el('button', 'mz-btn auto'); autoBtn.type = 'button'; autoBtn.dataset['act'] = 'auto';
  const esci = el('button', 'mz-btn ghost', 'ESCI DALLA PARTITA'); esci.type = 'button'; esci.dataset['act'] = 'esci';
  menu.append(titolo, sub, riprendi, autoBtn, esci);
  for (const e of [az, sc, top, menu]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, stop);
  o.root.append(az, sc, top, menu);
  let pausa = false, chiedi = false;
  const disegnaAuto = () => { autoBtn.textContent = auto ? 'MIRA: AUTO (attacca da solo)' : 'MIRA: A MANO (premi A)'; autoBtn.classList.toggle('auto', auto); };
  const setPausa = (on: boolean) => {
    pausa = on; chiedi = false; menu.classList.toggle('on', on);
    titolo.textContent = 'PAUSA'; sub.textContent = 'Le ondate aspettano.'; esci.textContent = 'ESCI DALLA PARTITA'; riprendi.style.display = ''; autoBtn.style.display = '';
    disegnaAuto();
  };
  pBtn.addEventListener('click', () => setPausa(!pausa));
  riprendi.addEventListener('click', () => setPausa(false));
  autoBtn.addEventListener('click', () => { auto = !auto; try { localStorage.setItem(AUTO_KEY, auto ? '1' : '0'); } catch { /* niente */ } disegnaAuto(); });
  esci.addEventListener('click', () => {
    if (!chiedi) { chiedi = true; titolo.textContent = 'USCIRE?'; sub.textContent = 'Contano le ondate superate fin qui.'; esci.textContent = 'SÌ, ESCI'; autoBtn.style.display = 'none'; return; }
    setPausa(false); o.onEsci();
  });
  disegnaAuto();
  const keys = new Set<string>();
  const kd = (e: KeyboardEvent) => {
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) setPausa(!pausa); return; }
    if (e.code === 'KeyF' || e.code === 'KeyQ') {
      e.preventDefault(); e.stopImmediatePropagation(); // F e Q sono del gioco (fuori aprono il feed e niente)
      if (!e.repeat) { keys.add(e.code); if (e.code === 'KeyQ') cLatch = true; else dLatch = true; }
    }
  };
  const ku = (e: KeyboardEvent) => { keys.delete(e.code); };
  const md = (e: PointerEvent) => { if (e.button === 0 && e.pointerType === 'mouse') mouseA = true; };
  const mu = (e: PointerEvent) => { if (e.button === 0) mouseA = false; };
  const blur = () => { keys.clear(); mouseA = false; azHeld.clear(); };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  o.canvas.addEventListener('pointerdown', md); addEventListener('pointerup', mu); addEventListener('blur', blur);
  let promptKey = '';
  return {
    sample() {
      const out = { a: mouseA, c: cLatch, d: dLatch || azHeld.size > 0 || keys.has('KeyF') };
      cLatch = false; dLatch = false;
      return out;
    },
    get paused() { return pausa; },
    get auto() { return auto; },
    setPrompt(p) {
      const k = p ? `${p.cosa}|${p.testo}|${p.prezzo}|${p.puoi}` : '';
      if (k === promptKey) return;
      promptKey = k;
      az.classList.toggle('on', !!p);
      if (!p) return;
      az.classList.toggle('no', !p.puoi);
      az.replaceChildren(el('span', '', p.testo.toUpperCase()), ...(p.prezzo > 0 ? [el('small', '', String(p.prezzo))] : []), el('small', '', 'F'));
    },
    setScambia(on) { sc.classList.toggle('on', on); },
    hide() { az.classList.remove('on'); sc.classList.remove('on'); top.style.display = 'none'; setPausa(false); },
    dispose() {
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      o.canvas.removeEventListener('pointerdown', md); removeEventListener('pointerup', mu); removeEventListener('blur', blur);
      az.remove(); sc.remove(); top.remove(); menu.remove();
    },
  };
}
