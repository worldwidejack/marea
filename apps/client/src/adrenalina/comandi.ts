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
const CURVA_PX = 70, COLPO_PX = 24, COLPO_MS = 320, FERMO_MS = 140, FERMO_PX = 10;
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
  const dita = new Map<number | string, Dito>();
  let presa = false, mxDrag = 0, invertito = false;
  let impulso: { mx: number; my: number; n: number } | null = null, eraAria = false;
  const ora = () => performance.now();

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

  const giu = (e: PointerEvent) => {
    e.preventDefault();
    const t = ora();
    dita.set(e.pointerId, {
      id: e.pointerId, x0: e.clientX, y0: e.clientY,
      ax: e.clientX, ay: e.clientY, at: t, fermoDa: t, mossoDa: t,
      cx: e.clientX, cy: e.clientY,
    });
    presa = false;
    try { zona.setPointerCapture(e.pointerId); } catch { /* pointer sintetico */ }
  };
  const muovi = (e: PointerEvent) => {
    const d = dita.get(e.pointerId);
    if (!d) return;
    e.preventDefault();
    aggiornaPos(d, e.clientX, e.clientY);
  };
  const su = (e: PointerEvent) => {
    if (dita.delete(e.pointerId) && dita.size === 0) { presa = false; mxDrag = 0; }
  };

  // Supporto touch nativo per mobile (evita la soppressione dei pointer event su WebKit e Chrome)
  const touchGiu = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    const t = ora();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const tc = e.changedTouches[i]!;
      dita.set(`t_${tc.identifier}`, {
        id: `t_${tc.identifier}`, x0: tc.clientX, y0: tc.clientY,
        ax: tc.clientX, ay: tc.clientY, at: t, fermoDa: t, mossoDa: t,
        cx: tc.clientX, cy: tc.clientY,
      });
    }
    presa = false;
  };
  const touchMuovi = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const tc = e.changedTouches[i]!;
      const d = dita.get(`t_${tc.identifier}`);
      if (d) {
        if (e.cancelable) e.preventDefault();
        aggiornaPos(d, tc.clientX, tc.clientY);
      }
    }
  };
  const touchSu = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      dita.delete(`t_${e.changedTouches[i]!.identifier}`);
    }
    if (dita.size === 0) { presa = false; mxDrag = 0; }
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
  const via = () => { tasti.clear(); dita.clear(); presa = false; mxDrag = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', via);

  return {
    get dito() { return dita.size > 0 || !!bottoni?.attivo; },
    get invertito() { return invertito; },
    inverti,
    campione(aria) {
      if (aria && !eraAria) {
        const t = ora();
        for (const d of dita.values()) { d.fermoDa = t; d.mossoDa = t; d.at = t; }
        presa = false;
      }
      eraAria = aria;
      bottoni?.setAria(aria);
      let fx = 0, fy = 0;
      if (impulso) { fx = impulso.mx; fy = impulso.my; if (--impulso.n <= 0) impulso = null; }
      const bImp = bottoni?.consumaImpulso();
      if (bImp) { fx = bImp.mx; fy = bImp.my; }
      const spazio = tasti.has('Space'), toccoGiu = dita.size > 0;
      if (aria) {
        if (toccoGiu && !presa) {
          const t = ora();
          for (const d of dita.values()) {
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
      zona.removeEventListener('pointerdown', giu); zona.removeEventListener('pointermove', muovi);
      removeEventListener('pointerup', su); removeEventListener('pointercancel', su);
      zona.removeEventListener('touchstart', touchGiu); zona.removeEventListener('touchmove', touchMuovi);
      removeEventListener('touchend', touchSu as EventListener); removeEventListener('touchcancel', touchSu as EventListener);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', via);
    },
  };
}
