// Input (WP2): tastiera WASD/frecce + joystick touch (#joystick) + bottoni A/B (#btnA #btnB). Il vettore esce in ASSI MONDO:
// "su" sullo schermo = direzione in cui guarda la camera proiettata a terra (yaw 45° → nord-ovest, −x −z).
// Un campione per tick (main.ts). Nessun doppio evento: solo pointer events; un tocco più breve di un tick viene comunque visto (latch).
// «Una mano» (#143, Impostazioni, solo touch): niente joystick fisso; nasce dove il dito tocca il canvas e, dopo il rilascio, resta lì
// (più chiaro) per i secondi scelti: un tocco sopra o appena fuori lo riprende col centro di prima, altrove ne nasce uno nuovo.
// I tocchi brevi sul canvas restano dei loro (lotto, gatti): il joystick appare e basta. Un secondo dito sul canvas (pizzico) lo lascia.
// Aspetto «Allegro» (#417, scelto da Jack il 18 ott 2026, `assets/concept/ui/hud2_3_mario.jpg`): A rosso col bordo bianco, sotto la
// scritta di cosa fa adesso (#btnAzione, `setAzione`); B c'è solo dove serve (`setB`: nel mondo a piedi e in barca no).
import type { InputFrame } from '@marea/sim';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { pomello, tieniPremuto } from '../ui/comandi_touch.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/kit.ts';

export type Input = {
  sample(): InputFrame; dispose(): void; inject(f: Partial<InputFrame> | null): void;
  /** Una mano (#143): joystick dove tocchi, che resta `sec` secondi dopo il rilascio. Spento = joystick fisso in basso a sinistra. */
  setUnaMano(on: boolean, sec: number): void;
  /** La scritta sotto A («Parla», «Gioca»…); null la toglie. */
  setAzione(t: string | null): void;
  /** B visibile o no (main lo spegne nel mondo, dove non fa niente). Di serie acceso: le pagine di prova lo usano. */
  setB(on: boolean): void;
};

const DEAD = 0.14; // zona morta del joystick (frazione del raggio); oltre, la magnitudine riparte da 0
const RING = 112, STICK = 50, R = 38; // px: anello, pomello, corsa massima del pomello
const GRAB = RING / 2 + 3 + 28; // una mano: un tocco entro questo raggio dal centro riprende il joystick fermo (anello + bordo + margine del pollice)
const KEY_WALK = 0.7; // tastiera: camminata; con Shift = 1 (corsa)
const BTN_A = 74, BTN_B = 56; // i colori e il carattere sono quelli del kit dell'interfaccia (ui/kit.ts)
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
  const releaseAll = () => { keys.clear(); tA.lascia(); tB.lascia(); aLatch = bLatch = false; endStick(); }; // blur / scheda nascosta: niente tasti incollati (anche in gara)
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', releaseAll);
  const onVis = () => { if (document.hidden) releaseAll(); };
  document.addEventListener('visibilitychange', onVis);

  // ---- DOM: joystick e bottoni (stile inline: index.html è di WP0) ----
  const mk = (id: string, cls?: string): HTMLElement => { const e = document.createElement('div'); e.id = id; if (cls) e.className = cls; return e; };
  const joy = mk('joystick'), stick = mk('stick'); joy.appendChild(stick);
  const btnA = mk('btnA', 'btn'), btnB = mk('btnB', 'btn'), azione = mk('btnAzione'); btnA.textContent = 'A'; btnB.textContent = 'B';
  const nogesture = 'touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;';
  const ringCss = `${nogesture}position:absolute;width:${RING}px;height:${RING}px;border-radius:50%;background:rgba(10,79,99,.42);border:3px solid ${L.oro};box-shadow:0 0 0 1.5px ${L.inchiostro},inset 0 0 0 1.5px rgba(253,242,218,.55);`;
  const fixedCss = `${ringCss}left:max(16px,env(safe-area-inset-left,0px));bottom:calc(${SAFE} + 32px);`;
  joy.style.cssText = fixedCss;
  stick.style.cssText = `position:absolute;left:${(RING - 6 - STICK) / 2}px;top:${(RING - 6 - STICK) / 2}px;width:${STICK}px;height:${STICK}px;border-radius:50%;background:${L.cartaChiara};border:2px solid ${L.inchiostro};box-shadow:inset 0 0 0 3px ${L.oro},inset 0 -6px 0 ${L.cartaScura};box-sizing:border-box;pointer-events:none;will-change:transform;`;
  // bottoni tondi: colore pieno, anello d'oro, filo d'inchiostro e un'ombra piena sotto (niente sfumature)
  const btnCss = (size: number, right: string, bottom: string, bg: string, scuro: string) => `${nogesture}position:absolute;right:${right};bottom:${bottom};width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${bg};border:3px solid ${L.oro};box-shadow:0 0 0 1.5px ${L.inchiostro},inset 0 0 0 2px ${scuro},inset 0 -6px 0 ${scuro},0 4px 0 1.5px ${L.inchiostro};color:${L.cartaChiara};font:700 ${Math.round(size * 0.5)}px ${FONT_LIBRO};text-shadow:0 2px 0 ${scuro};display:flex;align-items:center;justify-content:center;`;
  const aCss = btnCss(BTN_A, 'max(18px,env(safe-area-inset-right,0px))', `calc(${SAFE} + 46px)`, L.rosso, L.rossoScuro);
  const bCss = btnCss(BTN_B, `calc(max(18px,env(safe-area-inset-right,0px)) + ${BTN_A + 12}px)`, `calc(${SAFE} + 40px)`, L.acqua, L.acquaScura);
  // la scritta sotto A: cartiglio di carta col bordo d'oro, centrato sul bottone
  const azCss = `${nogesture}position:absolute;right:calc(max(18px,env(safe-area-inset-right,0px)) + ${BTN_A / 2}px);bottom:calc(${SAFE} + 22px);transform:translateX(50%);min-width:56px;box-sizing:border-box;padding:2px 12px 3px;border-radius:999px;background:${L.cartaChiara};border:2px solid ${L.oro};box-shadow:0 0 0 1.5px ${L.inchiostro};color:${L.inchiostro};font:700 14px ${FONT_LIBRO};text-align:center;white-space:nowrap;pointer-events:none;z-index:1;`;
  let bVia = false, azTesto: string | null = null;
  btnA.style.cssText = aCss; btnB.style.cssText = bCss; azione.style.cssText = azCss + 'display:none;';
  o.root.append(joy, btnA, btnB, azione);
  joy.addEventListener('contextmenu', (ev) => ev.preventDefault()); // i bottoni lo fanno in tieniPremuto
  // niente scroll/zoom della pagina (Safari ignora user-scalable=no)
  const noGesture = (e: Event) => e.preventDefault();
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, noGesture as EventListener, { passive: false });
  const noTouchScroll = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
  for (const e of [joy, btnA, btnB]) e.addEventListener('touchmove', noTouchScroll, { passive: false });

  // ---- joystick ----
  let jx = 0, jy = 0, jid: number | null = null, lastEv: Event | null = null;
  // una mano: centro (px schermo) e stato del joystick volante; via = nascosto, su = dito giù, riposo = fermo dopo il rilascio
  let una = false, restaMs = 2000, cx = 0, cy = 0, pad: 'via' | 'su' | 'riposo' = 'via', restT: ReturnType<typeof setTimeout> | null = null;
  const paintJoy = () => {
    if (!una) { joy.style.cssText = fixedCss; return; }
    // il bordo conta: il centro dell'anello cade sotto il dito. Sopra guida e HUD (z 13-14), sotto schede e uscite; mai bersaglio dei tocchi:
    // li prende il canvas (onCanvasDown), così da fermo non copre i bottoni che ha sotto
    const half = RING / 2 + 3;
    joy.style.cssText = `${ringCss}left:${Math.round(cx - half)}px;top:${Math.round(cy - half)}px;z-index:15;pointer-events:none;display:${pad === 'via' ? 'none' : 'block'};opacity:${pad === 'riposo' ? 0.5 : 1};`;
  };
  const setPad = (st: typeof pad) => {
    if (restT !== null) { clearTimeout(restT); restT = null; }
    pad = st;
    if (st === 'riposo') restT = setTimeout(() => { restT = null; pad = 'via'; paintJoy(); }, restaMs);
    paintJoy();
  };
  const setStick = () => { stick.style.transform = `translate(${jx * R}px, ${jy * R}px)`; stick.style.background = jid === null ? L.cartaChiara : '#FFFFFF'; };
  const moveStick = (e: PointerEvent) => {
    let ox = cx, oy = cy;
    if (!una) { const r = joy.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
    const dx = e.clientX - ox, dy = e.clientY - oy;
    const p = pomello(dx, dy, R); jx = p.x; jy = p.y; setStick();
  };
  function endStick() { const era = jid !== null; jid = null; jx = jy = 0; setStick(); if (una && era) setPad(restaMs > 0 ? 'riposo' : 'via'); }
  const dedupe = (e: Event) => { if (e === lastEv) return true; lastEv = e; return false; };
  joy.addEventListener('pointerdown', (e) => {
    if (dedupe(e) || jid !== null) return; e.preventDefault(); jid = e.pointerId;
    try { joy.setPointerCapture(e.pointerId); } catch { /* pointer sintetico (test): niente cattura, gli eventi arrivano lo stesso */ }
    moveStick(e);
  });
  // una mano: il dito sul canvas fa nascere il joystick lì (o riprende quello fermo se è vicino); il tocco arriva comunque al lotto e ai gatti
  const onCanvasDown = (e: PointerEvent) => {
    if (!una || e.pointerType === 'mouse') return;
    if (jid !== null) { if (e.pointerId !== jid) { endStick(); setPad('via'); } return; } // secondo dito: è un pizzico, il joystick si fa da parte
    if (dedupe(e)) return;
    if (!(pad === 'riposo' && Math.hypot(e.clientX - cx, e.clientY - cy) <= GRAB)) { cx = e.clientX; cy = e.clientY; }
    jid = e.pointerId; setPad('su'); moveStick(e);
  };
  o.canvas.addEventListener('pointerdown', onCanvasDown);
  const onMove = (e: PointerEvent) => { if (e.pointerId !== jid || dedupe(e)) return; e.preventDefault(); moveStick(e); };
  const onEnd = (e: PointerEvent) => { if (e.pointerId !== jid || dedupe(e)) return; endStick(); };
  joy.addEventListener('pointermove', onMove); joy.addEventListener('pointerup', onEnd); joy.addEventListener('pointercancel', onEnd);
  // rete di sicurezza: se la cattura salta (uscita dal browser), lo stick si rilascia comunque; i movimenti del joystick volante arrivano dal canvas
  addEventListener('pointermove', onMove); addEventListener('pointerup', onEnd); addEventListener('pointercancel', onEnd);

  // ---- bottoni: un set di dita per bottone (ui/comandi_touch.ts, più dita insieme); il latch cattura anche i tocchi più brevi di un tick ----
  const paintBtns = () => {
    btnA.style.cssText = aCss + (tA.giu ? 'transform:translateY(3px) scale(.95);filter:brightness(1.12);' : '');
    btnB.style.cssText = bCss + (tB.giu ? 'transform:translateY(3px) scale(.95);filter:brightness(1.15);' : '') + (bVia ? 'display:none;' : '');
  };
  // finestra: rete di sicurezza per il dito rilasciato fuori dal bottone senza cattura
  const tA = tieniPremuto(btnA, { premi: () => (aLatch = true), cambia: paintBtns, finestra: true });
  const tB = tieniPremuto(btnB, { premi: () => (bLatch = true), cambia: paintBtns, finestra: true });

  let injected: Partial<InputFrame> | null = null;
  let last = { sx: 0, sy: 0, mag: 0, src: 'none' };
  const input: Input = {
    inject: (f) => { injected = f; },
    setAzione(t) {
      if (t === azTesto) return;
      azTesto = t;
      azione.textContent = t ?? '';
      azione.style.cssText = azCss + (t ? '' : 'display:none;');
    },
    setB(on) {
      if (on !== bVia) return;
      bVia = !on; if (bVia) { tB.lascia(); bLatch = false; }
      paintBtns();
    },
    setUnaMano(on, sec) {
      restaMs = Math.max(0, sec) * 1000;
      if (on === una) return;
      endStick(); una = on;
      setPad('via');
    },
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
      const a = aLatch || tA.giu || keys.has('Space') || keys.has('KeyE');
      const b = bLatch || tB.giu || shift;
      aLatch = bLatch = false;
      last = { sx, sy, mag: Math.hypot(sx, sy), src };
      return { mx, my, a, b };
    },
    dispose() {
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', releaseAll);
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onEnd); removeEventListener('pointercancel', onEnd); tA.dispose(); tB.dispose();
      o.canvas.removeEventListener('pointerdown', onCanvasDown); if (restT !== null) clearTimeout(restT);
      document.removeEventListener('visibilitychange', onVis);
      for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.removeEventListener(ev, noGesture as EventListener);
      joy.remove(); btnA.remove(); btnB.remove(); azione.remove();
    },
  };
  registerStateProvider('wp2_input', () => ({ ...last, stick: [jx, jy], a: tA.giu, b: tB.giu, injected: !!injected, unaMano: una, pad: una ? pad : 'fisso', padAt: [Math.round(cx), Math.round(cy)], restaMs, azione: azTesto, bVisibile: !bVia }));
  registerTestHook('wp2_inject', (f) => input.inject((f ?? null) as Partial<InputFrame> | null));
  return input;
}
