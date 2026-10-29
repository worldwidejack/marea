// Comandi dello snowboard (docs/ADRENALINA.md §5): un pollice basta, da PC la tastiera. Escono come InputFrame della sim (`mx` curva,
// `a` accucciato/presa, in aria un gesto = un impulso di `mx`/`my` per qualche tick).
// - Telefono: pulsanti a schermo (sterzo ◀ ▶ a sinistra, trick ▲ ▼ in aria, SALTO / PRESA a destra) oppure tocco e trascinamento sulla neve.
// - PC: A/D o frecce curvano, Spazio tenuto carica e lasciato salta; in aria frecce/WASD = trick, Spazio tenuto = presa.
import type { InputFrame } from '@marea/sim';
import type { TouchBottoni } from './hud.ts';

export type Comandi = {
  /** Un tick: `aria` = la tavola è in volo (cambia cosa vogliono dire il dito e i tasti). */
  campione(aria: boolean): InputFrame;
  /** Stato per i test e per l'HUD: il dito è giù, la presa è partita. */
  readonly dito: boolean;
  dispose(): void;
};

/** px di trascinamento per la curva piena; px di un colpo che fa un trick; ms entro cui il colpo vale; ms fermo per la presa. */
const CURVA_PX = 70, COLPO_PX = 26, COLPO_MS = 260, FERMO_MS = 140, FERMO_PX = 12;
/** Tick per cui dura l'impulso di un gesto (la sim sente il fronte). */
const IMPULSO = 3;
/** Curva dalla tastiera (il tutto a fondo frena troppo: si tiene un filo sotto). */
const CURVA_TASTI = 0.8;

export function creaComandi(zona: HTMLElement, bottoni?: TouchBottoni): Comandi {
  const tasti = new Set<string>();
  let dito: number | null = null, x0 = 0, ax = 0, ay = 0, at = 0, mossoDa = 0, fermoDa = 0, presa = false, mx = 0;
  let impulso: { mx: number; my: number; n: number } | null = null, eraAria = false;
  const ora = () => performance.now();
  const gesto = (dx: number, dy: number) => { impulso = Math.abs(dx) > Math.abs(dy) ? { mx: dx > 0 ? 1 : -1, my: 0, n: IMPULSO } : { mx: 0, my: dy < 0 ? 1 : -1, n: IMPULSO }; };

  const aggiornaPos = (cx: number, cy: number) => {
    mx = Math.max(-1, Math.min(1, (cx - x0) / CURVA_PX));
    const dx = cx - ax, dy = cy - ay, d = Math.hypot(dx, dy), t = ora();
    if (eraAria && !presa && d > COLPO_PX && t - at < COLPO_MS) { gesto(dx, dy); ax = cx; ay = cy; at = t; }
    else if (d > COLPO_PX) { ax = cx; ay = cy; at = t; }
    if (d > FERMO_PX) { fermoDa = t; mossoDa = t; }
  };

  const giu = (e: PointerEvent) => {
    if (dito !== null) return;
    e.preventDefault();
    dito = e.pointerId; x0 = ax = e.clientX; ay = e.clientY; at = fermoDa = ora(); presa = false; mx = 0;
    try { zona.setPointerCapture(e.pointerId); } catch { /* pointer sintetico */ }
  };
  const muovi = (e: PointerEvent) => {
    if (e.pointerId !== dito) return;
    e.preventDefault();
    aggiornaPos(e.clientX, e.clientY);
  };
  const su = (e: PointerEvent) => { if (e.pointerId !== dito) return; dito = null; presa = false; mx = 0; };

  // Supporto touch nativo per mobile (evita la soppressione dei pointer event su WebKit e Chrome)
  const touchGiu = (e: TouchEvent) => {
    if (dito !== null || e.touches.length === 0) return;
    const t0 = e.changedTouches[0];
    if (!t0) return;
    if (e.cancelable) e.preventDefault();
    dito = t0.identifier; x0 = ax = t0.clientX; ay = t0.clientY; at = fermoDa = ora(); presa = false; mx = 0;
  };
  const touchMuovi = (e: TouchEvent) => {
    if (dito === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      if (t.identifier === dito) {
        if (e.cancelable) e.preventDefault();
        aggiornaPos(t.clientX, t.clientY);
        break;
      }
    }
  };
  const touchSu = (e: TouchEvent) => {
    if (dito === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i]!.identifier === dito) {
        dito = null; presa = false; mx = 0;
        break;
      }
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

  const ARIA_TASTI: Record<string, [number, number]> = { ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  const kd = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    tasti.add(e.code);
    const g = ARIA_TASTI[e.code];
    if (g && eraAria) impulso = { mx: g[0], my: g[1], n: IMPULSO };
  };
  const ku = (e: KeyboardEvent) => { tasti.delete(e.code); };
  const via = () => { tasti.clear(); dito = null; presa = false; mx = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', via);

  return {
    get dito() { return dito !== null || !!bottoni?.attivo; },
    campione(aria) {
      // appena si stacca da terra il dito «riparte»: la presa vuole un dito fermo da adesso, i colpi contano da qui
      if (aria && !eraAria) { fermoDa = at = ora(); presa = false; }
      eraAria = aria;
      bottoni?.setAria(aria);
      let fx = 0, fy = 0;
      if (impulso) { fx = impulso.mx; fy = impulso.my; if (--impulso.n <= 0) impulso = null; }
      const bImp = bottoni?.consumaImpulso();
      if (bImp) { fx = bImp.mx; fy = bImp.my; }
      const spazio = tasti.has('Space'), saltoGiu = !!bottoni?.salto;
      if (aria) {
        if (dito !== null && !presa && ora() - fermoDa >= FERMO_MS && ora() - mossoDa >= FERMO_MS) presa = true;
        return { mx: fx, my: fy, a: presa || spazio || saltoGiu, b: false };
      }
      presa = false;
      let k = 0;
      if (tasti.has('KeyA') || tasti.has('ArrowLeft')) k -= CURVA_TASTI;
      if (tasti.has('KeyD') || tasti.has('ArrowRight')) k += CURVA_TASTI;
      if (bottoni && bottoni.curva !== 0) k += bottoni.curva * CURVA_TASTI;
      const mxOut = k !== 0 ? Math.max(-1, Math.min(1, k)) : (dito !== null ? mx : 0);
      return { mx: mxOut, my: 0, a: dito !== null || spazio || saltoGiu, b: false };
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
