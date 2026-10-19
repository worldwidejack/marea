// Joystick di mira da telefono (dungeon e Templari): al posto del bottone A quando in mano c'è qualcosa che si mira (arco, magia, armi da
// fuoco). Il pomello sceglie la direzione come il joystick di movimento (su = verso dove guarda la camera); oltre la zona morta la mira è
// «agganciata» (il dito è «tenuto») finché non lasci: tornare al centro non annulla, tiene l'ultima direzione. Un dito solo. Lasciare dopo
// aver mirato è il «rilascio» (l'arco parte, la magia parte, il colpo parte); un tocco veloce che non esce dalla zona morta è un `tap`
// (nei Templari: colpo assistito come prima). L'indice d'angolo `m` è quello della sim (dungeon/mira.ts) sui versori in assi mondo.
import { aimDir, aimIndex } from '@marea/sim/dungeon/mira.ts';
import { screenToWorld } from '../game/input.ts';
import { PAL, el } from '../ui/style.ts';

const MIRA = 108, KNOB = 44, MIRA_R = 36, MIRA_DEAD = 0.3, TAP_MS = 350; // px: anello, pomello, corsa del pomello; zona morta (frazione della corsa); durata massima di un tap
const RIGHT = 'max(16px, env(safe-area-inset-right, 0px))', SAFE = 'env(safe-area-inset-bottom, 0px)';
const CSS = `
.mz-mira { position: absolute; right: ${RIGHT}; bottom: calc(${SAFE} + 28px); width: ${MIRA}px; height: ${MIRA}px; box-sizing: border-box; border-radius: 50%; display: none; background: rgba(232,67,63,.22); border: 3px solid rgba(244,227,193,.7); z-index: 13; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.mz-mira.on { display: block; }
.mz-mira::before, .mz-mira::after { content: ''; position: absolute; background: rgba(244,227,193,.35); pointer-events: none; }
.mz-mira::before { left: 50%; top: 14px; bottom: 14px; width: 2px; margin-left: -1px; }
.mz-mira::after { top: 50%; left: 14px; right: 14px; height: 2px; margin-top: -1px; }
.mz-mira i { position: absolute; left: ${(MIRA - 6 - KNOB) / 2}px; top: ${(MIRA - 6 - KNOB) / 2}px; width: ${KNOB}px; height: ${KNOB}px; box-sizing: border-box; border-radius: 50%; background: rgba(232,67,63,.9); border: 3px solid ${PAL.sabbiaChiara}; pointer-events: none; will-change: transform; z-index: 1; }
.mz-mira.tieni i { background: ${PAL.rosso}; }
`;

export type MiraCampione = {
  /** Il dito è giù oltre la zona morta (si sta mirando). */
  held: boolean;
  /** Lasciato in questo tick dopo aver mirato (vale una volta sola). */
  rel: boolean;
  /** Tocco veloce senza uscire dalla zona morta, lasciato in questo tick (vale una volta sola). */
  tap: boolean;
  /** Indice di mira (1..AIM_N) mentre il dito è giù oltre la zona morta e nel tick del rilascio; 0 = niente mira dal dito. */
  m: number;
};
export type MiraStick = {
  readonly el: HTMLElement;
  /** Un campione per tick (consuma rilascio e tocco). */
  sample(): MiraCampione;
  /** Acceso o spento (si accende solo su un telefono: `pointer: coarse` o un tocco già visto). Dice com'è adesso. */
  setOn(on: boolean): boolean;
  readonly on: boolean;
  /** Direzione del dito mentre mira (versore in assi mondo, la stessa che la sim userà), null se non mira. */
  dir(): { x: number; z: number } | null;
  /** Quanto è spinto il pomello (0 al centro … 1 al bordo), anche nel tick del rilascio: la pesca (#457) ci decide quanto lontano lanciare. */
  forza(): number;
  /** Pausa, domanda, blur: il dito non conta più. */
  cancel(): void;
  dispose(): void;
};

export function createMiraStick(o: { id: string; yaw(): number; blocked(): boolean }): MiraStick {
  if (!document.getElementById('mz-mira-style')) { const st = document.createElement('style'); st.id = 'mz-mira-style'; st.textContent = CSS; document.head.appendChild(st); }
  const aim = el('div', 'mz mz-mira'); aim.id = o.id;
  const knob = el('i'); aim.append(knob);
  let id: number | null = null, on = false, held = false, rel = false, tap = false, m = 0, t0 = 0, touchSeen = false, forza = 0;
  const paint = (x: number, y: number) => { knob.style.transform = `translate(${x * MIRA_R}px, ${y * MIRA_R}px)`; aim.classList.toggle('tieni', held); };
  const move = (e: PointerEvent) => {
    const r = aim.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.sqrt(dx * dx + dy * dy), k = d > MIRA_R ? MIRA_R / d : 1, jx = (dx * k) / MIRA_R, jy = (dy * k) / MIRA_R, len = d * k / MIRA_R;
    if (len > MIRA_DEAD) held = true;
    if (held && len > 0.12) { const w = screenToWorld(jx, jy, o.yaw()); m = aimIndex(w.mx, w.my) || m; forza = len; }
    paint(jx, jy);
  };
  const end = () => {
    if (id === null) return;
    id = null;
    if (held) rel = true; else if (performance.now() - t0 <= TAP_MS) tap = true;
    held = false; paint(0, 0);
  };
  const cancel = () => { end(); rel = false; tap = false; };
  aim.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (id !== null || o.blocked()) return;
    id = e.pointerId; m = 0; rel = false; tap = false; t0 = performance.now(); forza = 0;
    try { aim.setPointerCapture(e.pointerId); } catch { /* sintetico */ }
    move(e);
  });
  aim.addEventListener('pointermove', (e) => { if (e.pointerId === id) { e.preventDefault(); move(e); } });
  const up = (e: PointerEvent) => { if (e.pointerId === id) end(); };
  for (const ev of ['pointerup', 'pointercancel']) { aim.addEventListener(ev, up as EventListener); addEventListener(ev, up as EventListener); }
  aim.addEventListener('contextmenu', (e) => e.preventDefault());
  aim.addEventListener('touchstart', (e) => e.stopPropagation());
  aim.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  const seen = (e: PointerEvent) => { if (e.pointerType === 'touch') touchSeen = true; };
  addEventListener('pointerdown', seen, true);
  const coarse = () => touchSeen || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  return {
    el: aim,
    sample() {
      const out = { held, rel, tap, m: held || rel ? m : 0 };
      rel = false; tap = false;
      return out;
    },
    setOn(want) {
      const v = want && coarse();
      if (v === on) return on;
      on = v; aim.classList.toggle('on', v);
      if (!v) { id = null; held = rel = tap = false; paint(0, 0); }
      return on;
    },
    get on() { return on; },
    dir() { const d = held ? aimDir(m) : null; return d ? { x: d[0], z: d[1] } : null; },
    forza: () => forza,
    cancel,
    dispose() {
      removeEventListener('pointerup', up as EventListener); removeEventListener('pointercancel', up as EventListener); removeEventListener('pointerdown', seen, true);
      aim.remove();
    },
  };
}
