// Comandi dello snowboard (docs/ADRENALINA.md §5): due mani da telefono o tastiera da PC.
// - Telefono: pulsante ◀ a sinistra e ▶ a destra per sterzare; tenendo premuto fuori si carica il salto, rilasciando si salta;
//   in aria swipe nelle 4 direzioni (su, giù, destra, sinistra) per le acrobazie, tocco fermo per la presa.
// - PC: A/D per sterzare, Spazio per caricare e saltare (in aria = presa), frecce per le acrobazie; tasto P per invertire WASD e frecce.
import type { InputFrame } from '@marea/sim';
import type { TouchBottoni } from './hud.ts';

export type Comandi = {
  /** Un tick: `aria` = la tavola è in volo (cambia cosa vogliono dire il dito e i tasti). */
  campione(aria: boolean): InputFrame;
  /** Stato per i test e per l'HUD: il dito è giù, la presa è partita. */
  readonly dito: boolean;
  /** Se WASD e frecce sono invertiti. */
  readonly invertito: boolean;
  /** Inverte manualmente le funzioni di WASD e frecce. */
  inverti(): boolean;
  dispose(): void;
};

/** px di trascinamento per la curva piena; px di uno swipe per un trick; ms entro cui lo swipe vale; ms fermo per la presa. */
const CURVA_PX = 70, COLPO_PX = 20, COLPO_MS = 380, FERMO_MS = 140, FERMO_PX = 10;
/** Tick per cui dura l'impulso di un gesto (la sim sente il fronte). */
const IMPULSO = 3;
/** Curva dalla tastiera (il tutto a fondo frena troppo: si tiene un filo sotto). */
const CURVA_TASTI = 0.8;

type Dito = {
  id: number | string;
  x0: number; y0: number;
  ax: number; ay: number;
  at: number; fermoDa: number; mossoDa: number;
  cx: number; cy: number;
};

export function creaComandi(zona: HTMLElement, bottoni?: TouchBottoni, onInverti?: (inv: boolean) => void): Comandi {
  const tasti = new Set<string>();
  const touches = new Map<number, Dito>();
  const pointers = new Map<number, Dito>();
  let presa = false, mxDrag = 0, invertito = false;
  let impulso: { mx: number; my: number; n: number } | null = null, eraAria = false;
  let toccoRegistrato = false;
  const ora = () => performance.now();

  const tutteDita = () => [...touches.values(), ...pointers.values()];
  const haDitoGiu = () => touches.size > 0 || pointers.size > 0;

  const gesto = (dx: number, dy: number) => {
    impulso = Math.abs(dx) > Math.abs(dy)
      ? { mx: dx > 0 ? 1 : -1, my: 0, n: IMPULSO }
      : { mx: 0, my: dy < 0 ? 1 : -1, n: IMPULSO };
  };

  const aggiornaPos = (d: Dito, cx: number, cy: number) => {
    d.cx = cx; d.cy = cy;
    const dx = cx - d.ax, dy = cy - d.ay, dist = Math.hypot(dx, dy), t = ora();
    if (eraAria && !presa && dist >= COLPO_PX && t - d.at <= COLPO_MS) {
      gesto(dx, dy);
      d.ax = cx; d.ay = cy; d.at = t;
      d.fermoDa = t; d.mossoDa = t;
    } else if (dist >= COLPO_PX) {
      d.ax = cx; d.ay = cy; d.at = t;
    }
    if (dist >= FERMO_PX) { d.fermoDa = t; d.mossoDa = t; }
    mxDrag = Math.max(-1, Math.min(1, (cx - d.x0) / CURVA_PX));
  };

  const suBottone = (target: EventTarget | null) => {
    return target instanceof Element && !!target.closest('.mz-sb-btn, #mzSbEsci');
  };

  const giu = (e: PointerEvent) => {
    if (suBottone(e.target)) return;
    if (e.pointerType === 'touch' && touches.size > 0) return;
    e.preventDefault();
    const t = ora();
    pointers.set(e.pointerId, {
      id: e.pointerId, x0: e.clientX, y0: e.clientY,
      ax: e.clientX, ay: e.clientY, at: t, fermoDa: t, mossoDa: t,
      cx: e.clientX, cy: e.clientY,
    });
    presa = false; toccoRegistrato = true;
    try { zona.setPointerCapture(e.pointerId); } catch { /* pointer sintetico */ }
  };
  const muovi = (e: PointerEvent) => {
    const d = pointers.get(e.pointerId);
    if (!d) return;
    e.preventDefault();
    aggiornaPos(d, e.clientX, e.clientY);
  };
  const su = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (!haDitoGiu()) { presa = false; mxDrag = 0; }
  };

  // Supporto touch nativo per mobile (evita la duplicazione pointerId/touch e il mancato rilascio del salto)
  const touchGiu = (e: TouchEvent) => {
    for (const [id] of pointers.entries()) pointers.delete(id);
    const t = ora();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const tc = e.changedTouches[i]!;
      if (suBottone(tc.target)) continue;
      touches.set(tc.identifier, {
        id: tc.identifier, x0: tc.clientX, y0: tc.clientY,
        ax: tc.clientX, ay: tc.clientY, at: t, fermoDa: t, mossoDa: t,
        cx: tc.clientX, cy: tc.clientY,
      });
    }
    if (touches.size > 0) {
      if (e.cancelable) e.preventDefault();
      presa = false; toccoRegistrato = true;
    }
  };
  const touchMuovi = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const tc = e.changedTouches[i]!;
      const d = touches.get(tc.identifier);
      if (d) {
        if (e.cancelable) e.preventDefault();
        aggiornaPos(d, tc.clientX, tc.clientY);
      }
    }
  };
  const touchSu = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      touches.delete(e.changedTouches[i]!.identifier);
    }
    if (e.touches.length === 0) {
      touches.clear();
      presa = false; mxDrag = 0;
    } else {
      const vivi = new Set<number>();
      for (let i = 0; i < e.touches.length; i++) vivi.add(e.touches[i]!.identifier);
      for (const id of touches.keys()) {
        if (!vivi.has(id)) touches.delete(id);
      }
      if (touches.size === 0) { presa = false; mxDrag = 0; }
    }
  };

  zona.addEventListener('pointerdown', giu);
  zona.addEventListener('pointermove', muovi);
  for (const ev of ['pointerup', 'pointercancel']) zona.addEventListener(ev, su as EventListener);
  addEventListener('pointerup', su); addEventListener('pointercancel', su);

  zona.addEventListener('touchstart', touchGiu, { passive: false });
  zona.addEventListener('touchmove', touchMuovi, { passive: false });
  for (const ev of ['touchend', 'touchcancel']) zona.addEventListener(ev, touchSu as EventListener);
  addEventListener('touchend', touchSu as EventListener); addEventListener('touchcancel', touchSu as EventListener);
  zona.addEventListener('contextmenu', (e) => e.preventDefault());

  // Rete di sicurezza per mobile: tocco fuori da zona a schermo intero
  const winTouchGiu = (e: TouchEvent) => {
    if (!document.body.classList.contains('mz-sb')) return;
    touchGiu(e);
  };
  const winPointerGiu = (e: PointerEvent) => {
    if (!document.body.classList.contains('mz-sb') || e.target === zona) return;
    giu(e);
  };
  addEventListener('touchstart', winTouchGiu, { passive: false });
  addEventListener('pointerdown', winPointerGiu);

  const inverti = () => {
    invertito = !invertito;
    onInverti?.(invertito);
    return invertito;
  };

  const kd = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    if (e.code === 'KeyP') {
      inverti();
      return;
    }
    tasti.add(e.code);
    if (eraAria) {
      if (!invertito) {
        if (e.code === 'ArrowUp') impulso = { mx: 0, my: 1, n: IMPULSO };
        else if (e.code === 'ArrowDown') impulso = { mx: 0, my: -1, n: IMPULSO };
        else if (e.code === 'ArrowLeft') impulso = { mx: -1, my: 0, n: IMPULSO };
        else if (e.code === 'ArrowRight') impulso = { mx: 1, my: 0, n: IMPULSO };
      } else {
        if (e.code === 'KeyW') impulso = { mx: 0, my: 1, n: IMPULSO };
        else if (e.code === 'KeyS') impulso = { mx: 0, my: -1, n: IMPULSO };
        else if (e.code === 'KeyA') impulso = { mx: -1, my: 0, n: IMPULSO };
        else if (e.code === 'KeyD') impulso = { mx: 1, my: 0, n: IMPULSO };
      }
    }
  };
  const ku = (e: KeyboardEvent) => { tasti.delete(e.code); };
  const via = () => { tasti.clear(); touches.clear(); pointers.clear(); toccoRegistrato = false; presa = false; mxDrag = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', via);

  return {
    get dito() { return haDitoGiu() || !!bottoni?.attivo; },
    get invertito() { return invertito; },
    inverti,
    campione(aria) {
      if (aria && !eraAria) {
        const t = ora();
        for (const d of tutteDita()) { d.fermoDa = t; d.mossoDa = t; d.at = t; d.ax = d.cx; d.ay = d.cy; }
        presa = false;
      }
      eraAria = aria;
      bottoni?.setAria(aria);
      let fx = 0, fy = 0;
      if (impulso) { fx = impulso.mx; fy = impulso.my; if (--impulso.n <= 0) impulso = null; }
      const spazio = tasti.has('Space'), ditoAttivo = haDitoGiu();
      let toccoGiu = ditoAttivo;
      if (!ditoAttivo && toccoRegistrato) {
        toccoGiu = true;
        toccoRegistrato = false;
      } else if (ditoAttivo) {
        toccoRegistrato = false;
      }
      if (aria) {
        if (ditoAttivo && !presa) {
          const t = ora();
          for (const d of tutteDita()) {
            if (t - d.fermoDa >= FERMO_MS && t - d.mossoDa >= FERMO_MS) { presa = true; break; }
          }
        }
        return { mx: fx, my: fy, a: presa || spazio, b: false };
      }
      presa = false;
      let k = 0;
      if (!invertito) {
        if (tasti.has('KeyA')) k -= CURVA_TASTI;
        if (tasti.has('KeyD')) k += CURVA_TASTI;
      } else {
        if (tasti.has('ArrowLeft')) k -= CURVA_TASTI;
        if (tasti.has('ArrowRight')) k += CURVA_TASTI;
      }
      if (bottoni && bottoni.curva !== 0) k += bottoni.curva * CURVA_TASTI;
      const mxOut = k !== 0 ? Math.max(-1, Math.min(1, k)) : (toccoGiu ? mxDrag : 0);
      return { mx: mxOut, my: 0, a: toccoGiu || spazio, b: false };
    },
    dispose() {
      removeEventListener('touchstart', winTouchGiu); removeEventListener('pointerdown', winPointerGiu);
      zona.removeEventListener('pointerdown', giu); zona.removeEventListener('pointermove', muovi);
      removeEventListener('pointerup', su); removeEventListener('pointercancel', su);
      zona.removeEventListener('touchstart', touchGiu); zona.removeEventListener('touchmove', touchMuovi);
      removeEventListener('touchend', touchSu as EventListener); removeEventListener('touchcancel', touchSu as EventListener);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', via);
    },
  };
}
