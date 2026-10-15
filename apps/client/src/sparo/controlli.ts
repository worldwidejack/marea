// Comandi da PC dello sparatutto (#355): mouse catturato (pointer lock) per guardarsi intorno, WASD, clic sinistro spara, destro mira,
// R ricarica, Spazio salta, C accucciato (resta), Ctrl accucciato (finché tieni), Shift corsa, E azione, 1-2-3 o rotella = armi.
// La mira della camera (yaw, pitch) vive qui, a ogni movimento del mouse; la sim la riceve quantizzata a ogni tick.
// Dal telefono i comandi arrivano con la Tappa C.

export type Comandi = {
  mx: number; my: number; fuoco: boolean; mira: boolean; ricarica: boolean; salto: boolean; giu: boolean; corsa: boolean; azione: boolean;
  /** 1..3 = cambia arma adesso (una volta), 0 = niente. */
  arma: number;
};
export type Controlli = {
  /** Mira della camera (rad): yaw 0 = −Z, + verso sinistra; pitch + in su. */
  yaw: number; pitch: number;
  /** Quanto si è girato il mouse dall'ultima lettura (per l'arma che ondeggia). */
  scarto(): { dy: number; dp: number };
  sens: number; inMira: number;
  leggi(): Comandi;
  catturato(): boolean;
  cattura(): void;
  /** Tasti delle prove (V, H, T, M, P, invio...): `cb(code)`. */
  suTasto(cb: (code: string) => void): void;
  /** In mira il mouse rallenta. */
  mirando: boolean;
};

export function creaControlli(canvas: HTMLCanvasElement, yaw0: number): Controlli {
  const giu = new Set<string>();
  let fuoco = false, mira = false, accucciato = false, arma = 0, ruota = 0, dy = 0, dp = 0;
  /** Pressioni rapide (giù e su tra due tick): restano finché il tick non le legge. */
  const appena = new Set<string>();
  const tasti: ((code: string) => void)[] = [];
  const c: Controlli = {
    yaw: yaw0, pitch: 0, sens: 0.0021, inMira: 0.7, mirando: false,
    scarto() { const r = { dy, dp }; dy = 0; dp = 0; return r; },
    catturato: () => document.pointerLockElement === canvas,
    cattura() { if (document.pointerLockElement !== canvas) void canvas.requestPointerLock?.()?.catch?.(() => { /* rifiutato: si riprova al prossimo clic */ }); },
    suTasto(cb) { tasti.push(cb); },
    leggi() {
      const k = (code: string) => giu.has(code) || appena.has(code);
      const mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
      const my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
      const out: Comandi = {
        mx, my, fuoco, mira, ricarica: k('KeyR'), salto: k('Space'), giu: accucciato || k('ControlLeft') || k('ControlRight'),
        corsa: k('ShiftLeft') || k('ShiftRight'), azione: k('KeyE') || k('KeyF'), arma,
      };
      arma = 0; appena.clear();
      return out;
    },
  };
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    giu.add(e.code); appena.add(e.code);
    if (e.code === 'KeyC') accucciato = !accucciato;
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') arma = Number(e.code.slice(5));
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    for (const cb of tasti) cb(e.code);
  });
  addEventListener('keyup', (e) => { giu.delete(e.code); });
  addEventListener('blur', () => { giu.clear(); fuoco = false; mira = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (!c.catturato()) { c.cattura(); return; }
    if (e.button === 0) fuoco = true;
    if (e.button === 2) mira = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) fuoco = false; if (e.button === 2) mira = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (!c.catturato()) return;
    const s = c.sens * (c.mirando ? c.inMira : 1);
    const a = -e.movementX * s, b = -e.movementY * s;
    c.yaw += a; c.pitch = Math.max(-1.45, Math.min(1.45, c.pitch + b));
    dy += a; dp += b;
  });
  canvas.addEventListener('wheel', (e) => {
    ruota += e.deltaY;
    if (Math.abs(ruota) > 40) { arma = ruota > 0 ? -1 : -2; ruota = 0; } // −1 = prossima, −2 = precedente (le risolve main)
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('pointerlockchange', () => { if (!c.catturato()) { fuoco = false; mira = false; } });
  return c;
}
