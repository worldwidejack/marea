// Comandi dello snowboard (docs/ADRENALINA.md §5): un pollice basta, da PC la tastiera. Escono come InputFrame della sim (`mx` curva,
// `a` accucciato/presa, in aria un gesto = un impulso di `mx`/`my` per qualche tick).
// - Dito, a terra: tocchi e trascini a destra e a sinistra per curvare (rispetto a dove hai toccato); tenere il dito giù = accucciato che
//   carica, alzarlo = salto (sul trampolino: proprio sul bordo).
// - Dito, in aria: un colpo veloce su, giù, destra o sinistra = trick; tenere il dito fermo = presa (finché non lo alzi).
// - PC: A/D o frecce curvano, Spazio tenuto carica e lasciato salta; in aria frecce/WASD = trick, Spazio tenuto = presa.
import type { InputFrame } from '@marea/sim';

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

export function creaComandi(zona: HTMLElement): Comandi {
  const tasti = new Set<string>();
  let dito: number | null = null, x0 = 0, ax = 0, ay = 0, at = 0, mossoDa = 0, fermoDa = 0, presa = false, mx = 0;
  let impulso: { mx: number; my: number; n: number } | null = null, eraAria = false;
  const ora = () => performance.now();
  const gesto = (dx: number, dy: number) => { impulso = Math.abs(dx) > Math.abs(dy) ? { mx: dx > 0 ? 1 : -1, my: 0, n: IMPULSO } : { mx: 0, my: dy < 0 ? 1 : -1, n: IMPULSO }; };

  const giu = (e: PointerEvent) => {
    if (dito !== null) return;
    e.preventDefault();
    dito = e.pointerId; x0 = ax = e.clientX; ay = e.clientY; at = fermoDa = ora(); presa = false; mx = 0;
    try { zona.setPointerCapture(e.pointerId); } catch { /* pointer sintetico */ }
  };
  const muovi = (e: PointerEvent) => {
    if (e.pointerId !== dito) return;
    e.preventDefault();
    mx = Math.max(-1, Math.min(1, (e.clientX - x0) / CURVA_PX));
    const dx = e.clientX - ax, dy = e.clientY - ay, d = Math.hypot(dx, dy), t = ora();
    if (eraAria && !presa && d > COLPO_PX && t - at < COLPO_MS) { gesto(dx, dy); ax = e.clientX; ay = e.clientY; at = t; }
    else if (d > COLPO_PX) { ax = e.clientX; ay = e.clientY; at = t; }
    if (d > FERMO_PX) { fermoDa = t; mossoDa = t; }
  };
  const su = (e: PointerEvent) => { if (e.pointerId !== dito) return; dito = null; presa = false; mx = 0; };
  zona.addEventListener('pointerdown', giu);
  zona.addEventListener('pointermove', muovi);
  for (const ev of ['pointerup', 'pointercancel']) zona.addEventListener(ev, su as EventListener);
  addEventListener('pointerup', su); addEventListener('pointercancel', su);
  for (const ev of ['touchstart', 'touchmove', 'contextmenu']) zona.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

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
    get dito() { return dito !== null; },
    campione(aria) {
      // appena si stacca da terra il dito «riparte»: la presa vuole un dito fermo da adesso, i colpi contano da qui
      if (aria && !eraAria) { fermoDa = at = ora(); presa = false; }
      eraAria = aria;
      let fx = 0, fy = 0;
      if (impulso) { fx = impulso.mx; fy = impulso.my; if (--impulso.n <= 0) impulso = null; }
      const spazio = tasti.has('Space');
      if (aria) {
        if (dito !== null && !presa && ora() - fermoDa >= FERMO_MS && ora() - mossoDa >= FERMO_MS) presa = true;
        return { mx: fx, my: fy, a: presa || spazio, b: false };
      }
      presa = false;
      let k = 0;
      if (tasti.has('KeyA') || tasti.has('ArrowLeft')) k -= CURVA_TASTI;
      if (tasti.has('KeyD') || tasti.has('ArrowRight')) k += CURVA_TASTI;
      return { mx: k || (dito !== null ? mx : 0), my: 0, a: dito !== null || spazio, b: false };
    },
    dispose() {
      zona.removeEventListener('pointerdown', giu); zona.removeEventListener('pointermove', muovi);
      removeEventListener('pointerup', su); removeEventListener('pointercancel', su);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', via);
    },
  };
}
