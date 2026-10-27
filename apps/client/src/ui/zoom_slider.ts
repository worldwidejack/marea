// Barra sottile per regolare lo zoom della camera su mobile (#616).
// Discreta, semitrasparente a riposo (opacity .35), reattiva al tocco (opacity 1).
import { CAM } from '../render/camera.ts';
import type { DioramaCamera } from '../render/camera.ts';
import { FONT_LIBRO, LIBRO as L } from './kit.ts';
import { el, injectUiStyle } from './style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type ZoomSlider = {
  el: HTMLElement;
  update(): void;
  dispose(): void;
};

const TRACK_H = 96; // altezza della corsa in pixel
const STEP_RATIO = 1.22; // fattore di zoom per i tasti + e −

const CSS = `
#mzZoomBar {
  position: absolute;
  left: max(8px, env(safe-area-inset-left, 0px));
  top: 50%;
  transform: translateY(-50%);
  z-index: 13;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 140px;
  box-sizing: border-box;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  pointer-events: auto;
  opacity: 0.35;
  transition: opacity 0.25s ease-out;
}
#mzZoomBar.attivo, #mzZoomBar:hover {
  opacity: 1;
}
#mzZoomBar.mz-via {
  display: none !important;
}
@media (pointer: coarse), (max-width: 699px) {
  #mzZoomBar:not(.mz-via) {
    display: flex;
  }
}
@media (min-width: 700px) and (pointer: fine) {
  #mzZoomBar {
    display: none !important;
  }
}
#ui.mz-racing #mzZoomBar, body.mz-gp #mzZoomBar, body.mz-sotto #mzZoomBar, body.mz-casa #mzZoomBar, body.mz-foto #mzZoomBar {
  display: none !important;
}

.mz-zoom-step {
  width: 24px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 700 14px / 1 ${FONT_LIBRO};
  color: ${L.inchiostro};
  text-shadow: 0 1px 0 rgba(253,242,218,.8);
  cursor: pointer;
  border-radius: 4px;
  user-select: none;
}
.mz-zoom-step:active {
  transform: scale(1.2);
}

.mz-zoom-track {
  position: relative;
  width: 4px;
  height: ${TRACK_H}px;
  border-radius: 999px;
  background: rgba(46, 33, 24, 0.35);
  border: 1px solid rgba(217, 170, 69, 0.45);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.25);
  margin: 2px 0;
  cursor: pointer;
}

.mz-zoom-thumb {
  position: absolute;
  left: 50%;
  top: 0;
  width: 14px;
  height: 14px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: ${L.cartaChiara};
  border: 1.5px solid ${L.inchiostro};
  box-shadow: inset 0 0 0 1.5px ${L.oro}, 0 1.5px 3px rgba(46,33,24,.4);
  pointer-events: none;
  transition: transform 0.05s ease-out, filter 0.15s;
}

#mzZoomBar.attivo .mz-zoom-thumb {
  filter: brightness(1.12);
  transform: translate(-50%, -50%) scale(1.18);
}
`;

let styled = false;
function injectStyle(): void {
  injectUiStyle();
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.id = 'mz-zoom-slider-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** t ∈ [0, 1]: 0 = fondo (CAM.ZMAX 2.2, panoramica), 1 = cima (CAM.ZMIN 0.6, ravvicinato). Scala logaritmica. */
function tFromZoom(z: number): number {
  const clampZ = Math.min(CAM.ZMAX, Math.max(CAM.ZMIN, z));
  return 1 - Math.log(clampZ / CAM.ZMIN) / Math.log(CAM.ZMAX / CAM.ZMIN);
}

function zoomFromT(t: number): number {
  const clampT = Math.min(1, Math.max(0, t));
  return CAM.ZMIN * Math.pow(CAM.ZMAX / CAM.ZMIN, 1 - clampT);
}

export function createZoomSlider(o: { root: HTMLElement; diorama: DioramaCamera }): ZoomSlider {
  injectStyle();

  const bar = el('div', 'mz mz-zoom-bar');
  bar.id = 'mzZoomBar';

  const btnPiu = el('div', 'mz-zoom-step mz-zoom-piu', '+');
  btnPiu.title = 'Avvicina visuale';
  btnPiu.setAttribute('aria-label', 'Avvicina visuale');

  const track = el('div', 'mz-zoom-track');
  const thumb = el('div', 'mz-zoom-thumb');
  track.appendChild(thumb);

  const btnMeno = el('div', 'mz-zoom-step mz-zoom-meno', '−');
  btnMeno.title = 'Allontana visuale';
  btnMeno.setAttribute('aria-label', 'Allontana visuale');

  bar.append(btnPiu, track, btnMeno);
  o.root.appendChild(bar);

  let dragging = false, fadeTimer: ReturnType<typeof setTimeout> | null = null;

  const attiva = () => {
    bar.classList.add('attivo');
    if (fadeTimer !== null) { clearTimeout(fadeTimer); fadeTimer = null; }
  };

  const disattivaTraPoco = () => {
    if (fadeTimer !== null) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      bar.classList.remove('attivo');
      fadeTimer = null;
    }, 600);
  };

  const posizionaThumb = (t: number) => {
    const clampT = Math.min(1, Math.max(0, t));
    const topPx = (1 - clampT) * TRACK_H;
    thumb.style.top = `${topPx.toFixed(1)}px`;
  };

  const impostaZoomDaY = (clientY: number) => {
    const r = track.getBoundingClientRect();
    const y = clientY - r.top;
    const t = 1 - Math.min(1, Math.max(0, y / r.height));
    const z = zoomFromT(t);
    o.diorama.setZoom(z);
    posizionaThumb(t);
  };

  const step = (dir: -1 | 1) => {
    attiva();
    const cur = o.diorama.zoom;
    const next = dir < 0 ? cur / STEP_RATIO : cur * STEP_RATIO;
    o.diorama.setZoom(next);
    posizionaThumb(tFromZoom(o.diorama.zoom));
    disattivaTraPoco();
  };

  btnPiu.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  btnPiu.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); step(-1); });

  btnMeno.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  btnMeno.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); step(1); });

  const onPointerDown = (e: PointerEvent) => {
    if (e.target === btnPiu || e.target === btnMeno) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    attiva();
    try { bar.setPointerCapture(e.pointerId); } catch { /* pointer sintetico */ }
    impostaZoomDaY(e.clientY);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    impostaZoomDaY(e.clientY);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try { bar.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    disattivaTraPoco();
  };

  bar.addEventListener('pointerdown', onPointerDown);
  bar.addEventListener('pointermove', onPointerMove);
  bar.addEventListener('pointerup', onPointerUp);
  bar.addEventListener('pointercancel', onPointerUp);

  for (const ev of ['touchstart', 'touchmove', 'touchend']) {
    bar.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  // Posizione iniziale
  posizionaThumb(tFromZoom(o.diorama.zoom));

  registerStateProvider('zoomSlider', () => ({
    visible: !bar.classList.contains('mz-via'),
    zoom: o.diorama.zoom,
    t: tFromZoom(o.diorama.zoom),
    dragging,
  }));
  registerTestHook('setZoomSliderT', (t: unknown) => {
    const z = zoomFromT(Number(t));
    o.diorama.setZoom(z);
    posizionaThumb(tFromZoom(z));
    return z;
  });
  registerTestHook('stepZoomSlider', (dir: unknown) => {
    step(Number(dir) < 0 ? -1 : 1);
    return o.diorama.zoom;
  });

  return {
    el: bar,
    update() {
      const bloccata = !!o.diorama.isLocked || document.body.classList.contains('mz-casa');
      bar.classList.toggle('mz-via', bloccata);
      if (!dragging && !bloccata) {
        posizionaThumb(tFromZoom(o.diorama.zoom));
      }
    },
    dispose() {
      if (fadeTimer !== null) clearTimeout(fadeTimer);
      bar.removeEventListener('pointerdown', onPointerDown);
      bar.removeEventListener('pointermove', onPointerMove);
      bar.removeEventListener('pointerup', onPointerUp);
      bar.removeEventListener('pointercancel', onPointerUp);
      bar.remove();
    },
  };
}
