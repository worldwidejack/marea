// Input (WP2): tastiera WASD/frecce + joystick touch (#joystick) + bottoni A/B (#btnA #btnB). Il vettore esce in ASSI MONDO:
// "su" sullo schermo = direzione in cui guarda la camera proiettata a terra (yaw 45° → nord-ovest, −x −z).
// Un campione per tick (main.ts). Nessun doppio evento: solo pointer events; un tocco più breve di un tick viene comunque visto (latch).
import type { InputFrame } from '@marea/sim';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Input = { sample(): InputFrame; dispose(): void; inject(f: Partial<InputFrame> | null): void };

const DEAD = 0.14; // zona morta del joystick (frazione del raggio); oltre, la magnitudine riparte da 0
const RING = 132, STICK = 52, R = 44; // px: anello, pomello, corsa massima del pomello
const KEY_WALK = 0.7; // tastiera: camminata; con Shift = 1 (corsa)
const BTN_A = 84, BTN_B = 68;
const SAFE = 'env(safe-area-inset-bottom, 0px)';

/** schermo (x destra, y giù) → assi mondo con la yaw della camera. Con yaw=π/4: (0,−1) "su" → (−0,707, −0,707). */
export function screenToWorld(sx: number, sy: number, yaw: number): { mx: number; my: number } {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return { mx: rx * sx + fx * -sy, my: rz * sx + fz * -sy };
}

export function createInput(o: { canvas: HTMLCanvasElement; root: HTMLElement; cameraYaw: () => number }): Input {
  const keys = new Set<string>();
  let aLatch = false, bLatch = false;
  const CTRL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const kd = (e: KeyboardEvent) => {
    if (CTRL_KEYS.has(e.code) && !e.metaKey && !e.ctrlKey) e.preventDefault();
    if (e.repeat) return; // niente doppio evento dal tasto tenuto premuto
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyE') aLatch = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') bLatch = true;
  };
  const ku = (e: KeyboardEvent) => { keys.delete(e.code); };
  const releaseAll = () => { keys.clear(); aHeld.clear(); bHeld.clear(); aLatch = bLatch = false; endStick(); paintBtns(); }; // blur / scheda nascosta: niente tasti incollati (anche in gara)
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', releaseAll);
  const onVis = () => { if (document.hidden) releaseAll(); };
  document.addEventListener('visibilitychange', onVis);

  // ---- DOM: joystick e bottoni (stile inline: index.html è di WP0) ----
  const mk = (id: string, cls?: string): HTMLElement => { const e = document.createElement('div'); e.id = id; if (cls) e.className = cls; return e; };
  const joy = mk('joystick'), stick = mk('stick'); joy.appendChild(stick);
  const btnA = mk('btnA', 'btn'), btnB = mk('btnB', 'btn'); btnA.textContent = 'A'; btnB.textContent = 'B';
  const nogesture = 'touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;';
  joy.style.cssText = `${nogesture}position:absolute;left:max(16px,env(safe-area-inset-left,0px));bottom:calc(${SAFE} + 32px);width:${RING}px;height:${RING}px;border-radius:50%;background:rgba(46,30,20,.5);border:3px solid rgba(244,227,193,.55);`;
  stick.style.cssText = `position:absolute;left:${(RING - 6 - STICK) / 2}px;top:${(RING - 6 - STICK) / 2}px;width:${STICK}px;height:${STICK}px;border-radius:50%;background:rgba(244,227,193,.88);border:3px solid #8E5A2B;pointer-events:none;will-change:transform;`;
  const btnCss = (size: number, right: string, bottom: string, bg: string) => `${nogesture}position:absolute;right:${right};bottom:${bottom};width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid rgba(244,227,193,.7);color:#F4E3C1;font:bold ${Math.round(size * 0.34)}px ui-monospace,Menlo,monospace;display:flex;align-items:center;justify-content:center;`;
  const aCss = btnCss(BTN_A, 'max(16px,env(safe-area-inset-right,0px))', `calc(${SAFE} + 36px)`, 'rgba(232,67,63,.78)');
  const bCss = btnCss(BTN_B, `calc(max(16px,env(safe-area-inset-right,0px)) + ${BTN_A + 8}px)`, `calc(${SAFE} + 36px)`, 'rgba(46,30,20,.6)');
  btnA.style.cssText = aCss; btnB.style.cssText = bCss;
  o.root.append(joy, btnA, btnB);
  for (const e of [joy, btnA, btnB]) e.addEventListener('contextmenu', (ev) => ev.preventDefault());
  // niente scroll/zoom della pagina (Safari ignora user-scalable=no)
  const noGesture = (e: Event) => e.preventDefault();
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, noGesture as EventListener, { passive: false });
  const noTouchScroll = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
  for (const e of [joy, btnA, btnB]) e.addEventListener('touchmove', noTouchScroll, { passive: false });

  // ---- joystick ----
  let jx = 0, jy = 0, jid: number | null = null, lastEv: Event | null = null;
  const setStick = () => { stick.style.transform = `translate(${jx * R}px, ${jy * R}px)`; stick.style.background = jid === null ? 'rgba(244,227,193,.88)' : '#F4E3C1'; };
  const moveStick = (e: PointerEvent) => {
    const r = joy.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); const k = d > R ? R / d : 1; jx = (dx * k) / R; jy = (dy * k) / R; setStick();
  };
  function endStick() { jid = null; jx = jy = 0; setStick(); }
  const dedupe = (e: Event) => { if (e === lastEv) return true; lastEv = e; return false; };
  joy.addEventListener('pointerdown', (e) => {
    if (dedupe(e) || jid !== null) return; e.preventDefault(); jid = e.pointerId;
    try { joy.setPointerCapture(e.pointerId); } catch { /* pointer sintetico (test): niente cattura, gli eventi arrivano lo stesso */ }
    moveStick(e);
  });
  const onMove = (e: PointerEvent) => { if (e.pointerId !== jid || dedupe(e)) return; e.preventDefault(); moveStick(e); };
  const onEnd = (e: PointerEvent) => { if (e.pointerId !== jid || dedupe(e)) return; endStick(); };
  joy.addEventListener('pointermove', onMove); joy.addEventListener('pointerup', onEnd); joy.addEventListener('pointercancel', onEnd);
  // rete di sicurezza: se la cattura salta (uscita dal browser), lo stick si rilascia comunque
  addEventListener('pointerup', onEnd); addEventListener('pointercancel', onEnd);

  // ---- bottoni: un set di pointerId per bottone (multi-touch); il latch cattura anche i tocchi più brevi di un tick ----
  const aHeld = new Set<number>(), bHeld = new Set<number>();
  const paintBtns = () => {
    btnA.style.cssText = aCss + (aHeld.size ? 'transform:scale(.92);filter:brightness(1.25);' : '');
    btnB.style.cssText = bCss + (bHeld.size ? 'transform:scale(.92);filter:brightness(1.4);' : '');
  };
  const wire = (btn: HTMLElement, held: Set<number>, latch: () => void) => {
    btn.addEventListener('pointerdown', (e) => { if (dedupe(e)) return; e.preventDefault(); held.add(e.pointerId); latch(); try { btn.setPointerCapture(e.pointerId); } catch { /* sintetico */ } paintBtns(); });
    const up = (e: PointerEvent) => { if (dedupe(e)) return; held.delete(e.pointerId); paintBtns(); };
    for (const ev of ['pointerup', 'pointercancel']) btn.addEventListener(ev, up as EventListener);
  };
  wire(btnA, aHeld, () => (aLatch = true)); wire(btnB, bHeld, () => (bLatch = true));
  // rete di sicurezza: dito rilasciato fuori dal bottone senza cattura
  const upAny = (e: PointerEvent) => { if (aHeld.delete(e.pointerId) || bHeld.delete(e.pointerId)) paintBtns(); };
  addEventListener('pointerup', upAny); addEventListener('pointercancel', upAny);

  let injected: Partial<InputFrame> | null = null;
  let last = { sx: 0, sy: 0, mag: 0, src: 'none' };
  const input: Input = {
    inject: (f) => { injected = f; },
    sample(): InputFrame {
      if (injected) return { mx: 0, my: 0, a: false, b: false, ...injected };
      let sx = 0, sy = 0, src = 'none'; // schermo: x destra, y giù
      if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) sy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) sy += 1;
      const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (sx || sy) {
        const d = Math.hypot(sx, sy), mag = shift ? 1 : KEY_WALK; sx = (sx / d) * mag; sy = (sy / d) * mag; src = 'key';
      } else {
        const d = Math.hypot(jx, jy); // 0..1 (il pomello è già limitato a R)
        if (d > DEAD) { const mag = (d - DEAD) / (1 - DEAD); sx = (jx / d) * mag; sy = (jy / d) * mag; src = 'stick'; }
      }
      const { mx, my } = screenToWorld(sx, sy, o.cameraYaw());
      const a = aLatch || aHeld.size > 0 || keys.has('Space') || keys.has('KeyE');
      const b = bLatch || bHeld.size > 0 || shift;
      aLatch = bLatch = false;
      last = { sx, sy, mag: Math.hypot(sx, sy), src };
      return { mx, my, a, b };
    },
    dispose() {
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', releaseAll);
      removeEventListener('pointerup', onEnd); removeEventListener('pointercancel', onEnd); removeEventListener('pointerup', upAny); removeEventListener('pointercancel', upAny);
      document.removeEventListener('visibilitychange', onVis);
      for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.removeEventListener(ev, noGesture as EventListener);
      joy.remove(); btnA.remove(); btnB.remove();
    },
  };
  registerStateProvider('wp2_input', () => ({ ...last, stick: [jx, jy], a: aHeld.size > 0, b: bHeld.size > 0, injected: !!injected }));
  registerTestHook('wp2_inject', (f) => input.inject((f ?? null) as Partial<InputFrame> | null));
  return input;
}
