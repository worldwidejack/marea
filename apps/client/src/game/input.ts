// Tastiera + joystick touch + bottoni; il vettore esce in assi mondo (ruotato per la yaw della camera). Stub funzionante (WP0); WP2 rifinisce.
import type { InputFrame } from '@marea/sim';
export type Input = { sample(): InputFrame; dispose(): void; inject(f: Partial<InputFrame> | null): void };
export function createInput(o: { canvas: HTMLCanvasElement; root: HTMLElement; cameraYaw: () => number }): Input {
  const keys = new Set<string>();
  const kd = (e: KeyboardEvent) => { keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); };
  const ku = (e: KeyboardEvent) => keys.delete(e.code);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const joy = el('div', 'joystick'), stick = el('div', 'stick'); joy.appendChild(stick);
  const btnA = el('div', 'btnA', 'btn'), btnB = el('div', 'btnB', 'btn'); btnA.textContent = 'A'; btnB.textContent = 'B';
  o.root.append(joy, btnA, btnB);
  let jx = 0, jy = 0, jid: number | null = null, a = false, b = false, injected: Partial<InputFrame> | null = null;
  const R = 40;
  const setStick = () => { stick.style.transform = `translate(${jx * R}px, ${jy * R}px)`; };
  const onStart = (e: PointerEvent) => { jid = e.pointerId; joy.setPointerCapture(e.pointerId); onMove(e); };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== jid) return;
    const r = joy.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); const k = d > R ? R / d : 1; jx = (dx * k) / R; jy = (dy * k) / R; setStick();
  };
  const onEnd = (e: PointerEvent) => { if (e.pointerId !== jid) return; jid = null; jx = jy = 0; setStick(); };
  joy.addEventListener('pointerdown', onStart); joy.addEventListener('pointermove', onMove); joy.addEventListener('pointerup', onEnd); joy.addEventListener('pointercancel', onEnd);
  const hold = (btn: HTMLElement, set: (v: boolean) => void) => { btn.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => set(false)); };
  hold(btnA, (v) => (a = v)); hold(btnB, (v) => (b = v));
  return {
    inject: (f) => (injected = f),
    sample(): InputFrame {
      if (injected) return { mx: 0, my: 0, a: false, b: false, ...injected };
      let sx = 0, sy = 0; // schermo: x destra, y giù
      if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) sy -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) sy += 1;
      const kb = Math.hypot(sx, sy) > 0;
      if (kb) { const d = Math.hypot(sx, sy); const mag = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0.7; sx = (sx / d) * mag; sy = (sy / d) * mag; } else { sx = jx; sy = jy; }
      // ruota nel mondo: "su" sullo schermo = direzione in cui guarda la camera proiettata a terra
      const yaw = o.cameraYaw(); const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const mx = rx * sx + fx * -sy, my = rz * sx + fz * -sy;
      return { mx, my, a: a || keys.has('Space') || keys.has('KeyE'), b: b || keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    dispose() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); joy.remove(); btnA.remove(); btnB.remove(); },
  };
}
function el(tag: string, id: string, cls?: string): HTMLElement { const e = document.createElement(tag); e.id = id; if (cls) e.className = cls; return e; }
