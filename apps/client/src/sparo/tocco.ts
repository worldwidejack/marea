// Comandi dal telefono dello sparatutto (#355, Tappa C): in orizzontale, due pollici come in COD Mobile (eccezione alla regola «basta
// un pollice», ROADMAP §Deviazioni). Pollice sinistro: il joystick compare dove appoggi il dito (spinto fino in fondo in avanti = corri).
// Pollice destro: trascini sulla metà destra per mirare; SPARA (anche lui trascinabile per mirare mentre spari), MIRA, RICARICA, SALTA,
// GIÙ (accucciato, resta), ARMA (la prossima) e AZIONE (compare alla gru). La mira assistita e lo sparo automatico li fa main.ts.
import { P } from '../render/island_parts.ts';
import type { Comandi, Controlli } from './controlli.ts';

export type Tocco = {
  readonly attivo: boolean;
  /** Comandi del tick (come quelli della tastiera). `arma` = −1 → la prossima. */
  leggi(): Comandi;
  /** Il bottone AZIONE (alla gru), con la scritta. */
  azione(on: boolean): void;
  visibile(on: boolean): void;
  /** Il dito destro sta mirando (per la mira assistita). */
  readonly mirando: boolean;
  /** Sensibilità del dito (rad per pixel). */
  sens: number;
};

const CSS = `
.st-zona { position: absolute; top: 0; bottom: 0; touch-action: none; z-index: 4; }
.st-joy { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; background: rgba(35,32,31,.28); box-shadow: inset 0 0 0 3px rgba(255,255,255,.35); display: none; pointer-events: none; z-index: 5; }
.st-joy i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 0 3px rgba(35,32,31,.4); }
.st-b { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(35,32,31,.45); box-shadow: inset 0 0 0 3px rgba(255,255,255,.45); color: #fff; font: 800 11px system-ui, -apple-system, sans-serif; letter-spacing: .06em; text-shadow: 0 1px 0 rgba(0,0,0,.6); touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; z-index: 6; }
.st-b.giu { background: rgba(245,213,71,.55); }
.st-b.on { background: rgba(255,255,255,.4); }
.st-b.spara { font-size: 13px; background: rgba(232,67,63,.55); }
.st-b.azione { background: ${P.giallo}; color: #23201F; text-shadow: none; display: none; }
.st-b.arma { border-radius: 10px; }
.st-gira { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 10px; background: #23201F; color: #fff; font: 800 20px system-ui, -apple-system, sans-serif; letter-spacing: .1em; z-index: 20; text-align: center; }
.st-gira i { width: 46px; height: 76px; border: 4px solid #fff; border-radius: 9px; transform: rotate(-90deg); }
`;

export function creaTocco(root: HTMLElement, ctl: Controlli): Tocco {
  const attivo = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;
  let mx = 0, my = 0, fuoco = false, mira = false, ricarica = false, salto = false, giu = false, azione = false, arma = 0, mirando = false;
  let bAz: HTMLElement | null = null;
  const api: Tocco = {
    attivo, sens: 0.0058,
    get mirando() { return mirando; },
    leggi() {
      const corsa = my > 0.92 && Math.abs(mx) < 0.5;
      const out: Comandi = { mx, my, fuoco, mira, ricarica, salto, giu, corsa, azione, arma };
      ricarica = false; arma = 0;
      return out;
    },
    azione(on) { if (bAz) bAz.style.display = on ? 'flex' : 'none'; if (!on) azione = false; },
    visibile(on) { for (const e of tutti) e.style.visibility = on ? 'visible' : 'hidden'; },
  };
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  // gira il telefono: lo sparatutto si gioca in orizzontale
  const gira = document.createElement('div'); gira.className = 'st-gira'; gira.innerHTML = '<i></i>GIRA IL TELEFONO'; document.body.appendChild(gira);
  const orientamento = () => { gira.style.display = attivo && innerHeight > innerWidth ? 'flex' : 'none'; };
  addEventListener('resize', orientamento); orientamento();
  const tutti: HTMLElement[] = [];
  if (!attivo) return api;

  // ---------- pollice sinistro: joystick che nasce dove tocchi ----------
  const sx = document.createElement('div'); sx.className = 'st-zona'; sx.style.left = '0'; sx.style.width = '42%'; root.appendChild(sx);
  const joy = document.createElement('div'); joy.className = 'st-joy'; joy.innerHTML = '<i></i>'; root.appendChild(joy);
  const pomo = joy.querySelector('i') as HTMLElement;
  let jId = -1, jx = 0, jy = 0;
  const R = 52;
  sx.addEventListener('pointerdown', (e) => {
    if (jId >= 0) return;
    jId = e.pointerId; jx = e.clientX; jy = e.clientY;
    joy.style.left = `${jx}px`; joy.style.top = `${jy}px`; joy.style.display = 'block';
    try { sx.setPointerCapture(e.pointerId); } catch { /* sintetico */ }
    e.preventDefault();
  });
  sx.addEventListener('pointermove', (e) => {
    if (e.pointerId !== jId) return;
    let dx = (e.clientX - jx) / R, dy = (e.clientY - jy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    mx = dx; my = -dy;
    pomo.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
  });
  const lascia = (e: PointerEvent) => { if (e.pointerId !== jId) return; jId = -1; mx = 0; my = 0; joy.style.display = 'none'; pomo.style.transform = ''; };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) sx.addEventListener(ev, lascia);

  // ---------- pollice destro: trascini per mirare ----------
  const dx = document.createElement('div'); dx.className = 'st-zona'; dx.style.right = '0'; dx.style.width = '58%'; root.appendChild(dx);
  const dita = new Map<number, { x: number; y: number }>();
  const guarda = (e: PointerEvent) => {
    const p = dita.get(e.pointerId);
    if (!p) return;
    const k = api.sens * (ctl.mirando ? 0.6 : 1);
    ctl.yaw -= (e.clientX - p.x) * k; ctl.pitch = Math.max(-1.45, Math.min(1.45, ctl.pitch - (e.clientY - p.y) * k));
    p.x = e.clientX; p.y = e.clientY;
  };
  const prendi = (el: HTMLElement, e: PointerEvent) => { dita.set(e.pointerId, { x: e.clientX, y: e.clientY }); mirando = true; try { el.setPointerCapture(e.pointerId); } catch { /* sintetico */ } e.preventDefault(); };
  const molla = (e: PointerEvent) => { dita.delete(e.pointerId); mirando = dita.size > 0; };
  dx.addEventListener('pointerdown', (e) => prendi(dx, e));
  dx.addEventListener('pointermove', guarda);
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) dx.addEventListener(ev, molla);

  // ---------- bottoni ----------
  const bottone = (testo: string, cls: string, pos: Partial<Record<'right' | 'bottom' | 'top', string>>, lato: number, giu_: (on: boolean) => void, mira_ = false) => {
    const b = document.createElement('div'); b.className = `st-b ${cls}`; b.textContent = testo;
    b.style.width = b.style.height = `${lato}px`;
    for (const [k, v] of Object.entries(pos)) (b.style as unknown as Record<string, string>)[k] = v;
    b.addEventListener('pointerdown', (e) => { giu_(true); b.classList.add('on'); if (mira_) prendi(b, e); else { try { b.setPointerCapture(e.pointerId); } catch { /* sintetico */ } e.preventDefault(); } });
    if (mira_) b.addEventListener('pointermove', guarda);
    const su = (e: PointerEvent) => { giu_(false); b.classList.remove('on'); if (mira_) molla(e); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) b.addEventListener(ev, su);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    root.appendChild(b); tutti.push(b);
    return b;
  };
  const destra = 'calc(env(safe-area-inset-right, 0px) + ', basso = 'calc(env(safe-area-inset-bottom, 0px) + ';
  bottone('SPARA', 'spara', { right: destra + '24px)', bottom: basso + '104px)' }, 86, (on) => { fuoco = on; }, true);
  bottone('MIRA', '', { right: destra + '126px)', bottom: basso + '118px)' }, 58, (on) => { mira = on; });
  bottone('RICARICA', '', { right: destra + '38px)', bottom: basso + '206px)' }, 52, (on) => { if (on) ricarica = true; });
  bottone('SALTA', '', { right: destra + '22px)', bottom: basso + '20px)' }, 62, (on) => { salto = on; });
  const bGiu = bottone('GIÙ', '', { right: destra + '98px)', bottom: basso + '18px)' }, 52, (on) => { if (on) { giu = !giu; bGiu.classList.toggle('giu', giu); } });
  const bArma = bottone('ARMA', 'arma', { right: destra + '16px)', top: 'calc(env(safe-area-inset-top, 0px) + 58px)' }, 58, (on) => { if (on) arma = -1; });
  bArma.style.height = '38px';
  bAz = bottone('AZIONE', 'azione', { right: destra + '120px)', bottom: basso + '206px)' }, 78, (on) => { azione = on; });
  tutti.push(sx, dx);
  return api;
}
