// Comandi dal telefono dello sparatutto (#355, Tappa C; rifatti come la modalità Avanzata di COD Mobile, #377): in orizzontale, due
// pollici (eccezione alla regola «basta un pollice», ROADMAP §Deviazioni).
// Pollice sinistro: il joystick (fermo in basso a sinistra, si sposta dove appoggi il dito); spinto in fondo in avanti = corri, portato
// oltre fino al lucchetto = la corsa resta anche lasciando (si sblocca toccando di nuovo il joystick). Sopra il joystick lo SPARA
// sinistro: spara e basta, così il pollice destro resta libero per mirare.
// Pollice destro: trascini ovunque sulla metà destra per mirare. Lo SPARA destro è fisso e ci si trascina sopra per mirare mentre spari;
// MIRA si accende e si spegne a tocco (resta); anche MIRA, SALTA e GIÙ si trascinano per mirare. RICARICA, ARMA (la prossima), AZIONE
// (compare alla gru). Lo «spara e mira» (tenere SPARA mette in mira con pistola e mitra), la mira assistita, il rallentamento sul
// nemico e lo sparo automatico li decide main.ts.
// Ogni dito sa a cosa appartiene dal pointerdown, e lo seguono gli ascoltatori della finestra: niente conta se la cattura del puntatore
// riesce o no, né su che bottone passa il dito trascinando.
import { P } from '../render/island_parts.ts';
import type { Comandi, Controlli } from './controlli.ts';

export type Tocco = {
  readonly attivo: boolean;
  /** Comandi del tick (come quelli della tastiera). `arma` = −1 → la prossima. `mira` = il bottone MIRA acceso. */
  leggi(): Comandi;
  /** Il bottone AZIONE (alla gru), con la scritta. */
  azione(on: boolean): void;
  visibile(on: boolean): void;
  /** Un dito sta mirando (per la mira assistita). */
  readonly mirando: boolean;
  /** La corsa è bloccata (il lucchetto del joystick). */
  readonly bloccata: boolean;
  /** Sensibilità del dito (rad per pixel). */
  sens: number;
  /** Il mirino è su un nemico: la mira rallenta (lo dice main.ts a ogni frame). */
  frena: boolean;
};

const CSS = `
.st-zona { position: absolute; top: 0; bottom: 0; touch-action: none; z-index: 4; }
.st-joy { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; background: rgba(35,32,31,.28); box-shadow: inset 0 0 0 3px rgba(255,255,255,.35); pointer-events: none; z-index: 5; opacity: .55; }
.st-joy.on { opacity: 1; }
.st-joy > i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 0 3px rgba(35,32,31,.4); }
.st-lock { position: absolute; left: 50%; top: -58px; width: 40px; height: 40px; margin-left: -20px; border-radius: 50%; background: rgba(35,32,31,.45); box-shadow: inset 0 0 0 3px rgba(255,255,255,.35); display: none; align-items: center; justify-content: center; color: #fff; font: 800 9px system-ui, -apple-system, sans-serif; letter-spacing: .04em; }
.st-joy.on .st-lock, .st-joy.blocco .st-lock { display: flex; }
.st-joy.blocco .st-lock { background: ${P.giallo}; color: #23201F; box-shadow: none; }
.st-b { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(35,32,31,.45); box-shadow: inset 0 0 0 3px rgba(255,255,255,.45); color: #fff; font: 800 11px system-ui, -apple-system, sans-serif; letter-spacing: .06em; text-shadow: 0 1px 0 rgba(0,0,0,.6); touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; z-index: 6; }
.st-b.acceso { background: rgba(245,213,71,.6); }
.st-b.on { background: rgba(255,255,255,.4); }
.st-b.spara { font-size: 13px; background: rgba(232,67,63,.55); }
.st-b.spara.on { background: rgba(232,67,63,.85); }
.st-b.azione { background: ${P.giallo}; color: #23201F; text-shadow: none; display: none; }
.st-b.arma { border-radius: 10px; }
.st-gira { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 10px; background: #23201F; color: #fff; font: 800 20px system-ui, -apple-system, sans-serif; letter-spacing: .1em; z-index: 20; text-align: center; }
.st-gira i { width: 46px; height: 76px; border: 4px solid #fff; border-radius: 9px; transform: rotate(-90deg); }
`;

/** Il pomello in fondo (raggio del joystick, px) e quanto oltre si blocca la corsa (in raggi, verso l'alto). */
const R = 52, BLOCCA = 1.75;
/** Dove riposa il joystick (dal basso a sinistra, px, centro). */
const RIPOSO = { x: 104, y: 112 };

type Dito =
  | { tipo: 'joy' }
  | { tipo: 'guarda'; x: number; y: number }
  | { tipo: 'bottone'; b: HTMLElement; su: () => void; guarda: boolean; x: number; y: number };

export function creaTocco(root: HTMLElement, ctl: Controlli): Tocco {
  const attivo = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;
  let mx = 0, my = 0, fuocoD = false, fuocoS = false, mira = false, ricarica = false, salto = false, giu = false, azione = false, arma = 0;
  let blocco = false;
  const dita = new Map<number, Dito>();
  let bAz: HTMLElement | null = null;
  const api: Tocco = {
    attivo, sens: 0.0058, frena: false,
    get mirando() { for (const d of dita.values()) if (d.tipo === 'guarda' || (d.tipo === 'bottone' && d.guarda)) return true; return false; },
    get bloccata() { return blocco; },
    leggi() {
      const joy = [...dita.values()].some((d) => d.tipo === 'joy');
      const corsa = blocco || (my > 0.92 && Math.abs(mx) < 0.5);
      const out: Comandi = { mx: blocco && !joy ? 0 : mx, my: blocco && !joy ? 1 : my, fuoco: fuocoD || fuocoS, mira, ricarica, salto, giu, corsa, azione, arma };
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

  const tieni = (el: HTMLElement, e: PointerEvent) => { try { el.setPointerCapture(e.pointerId); } catch { /* sintetico: lo seguono comunque gli ascoltatori della finestra */ } e.preventDefault(); };
  /** Trascinare un dito che mira gira la visuale (più piano in mira e sul nemico, come la «slowdown» di COD Mobile). */
  const gira_ = (d: { x: number; y: number }, e: PointerEvent) => {
    const k = api.sens * (ctl.mirando ? 0.6 : 1) * (api.frena ? 0.65 : 1);
    ctl.yaw -= (e.clientX - d.x) * k; ctl.pitch = Math.max(-1.45, Math.min(1.45, ctl.pitch - (e.clientY - d.y) * k));
    d.x = e.clientX; d.y = e.clientY;
  };

  // ---------- pollice sinistro: joystick fermo che si sposta dove tocchi, col lucchetto della corsa ----------
  const sx = document.createElement('div'); sx.className = 'st-zona'; sx.style.left = '0'; sx.style.width = '42%'; root.appendChild(sx);
  const joy = document.createElement('div'); joy.className = 'st-joy'; joy.innerHTML = '<i></i><b class="st-lock">CORSA</b>'; joy.style.pointerEvents = 'none'; root.appendChild(joy); // inline: `#ui > *` della pagina lo renderebbe toccabile
  const pomo = joy.querySelector('i') as HTMLElement;
  let jx = 0, jy = 0;
  const riposa = () => {
    const H = root.clientHeight || innerHeight;
    jx = RIPOSO.x; jy = H - RIPOSO.y;
    joy.style.left = `calc(env(safe-area-inset-left, 0px) + ${jx}px)`; joy.style.top = `calc(${jy}px - env(safe-area-inset-bottom, 0px))`;
    pomo.style.transform = blocco ? `translate(0, ${-R}px)` : '';
  };
  addEventListener('resize', riposa); riposa();
  sx.addEventListener('pointerdown', (e) => {
    if ([...dita.values()].some((d) => d.tipo === 'joy')) return;
    dita.set(e.pointerId, { tipo: 'joy' });
    blocco = false; joy.classList.remove('blocco');
    jx = e.clientX; jy = e.clientY; mx = 0; my = 0;
    joy.style.left = `${jx}px`; joy.style.top = `${jy}px`; joy.classList.add('on'); pomo.style.transform = '';
    tieni(sx, e);
  });
  const muoviJoy = (e: PointerEvent) => {
    let dx = (e.clientX - jx) / R, dy = (e.clientY - jy) / R;
    const oltre = -dy > BLOCCA && Math.abs(dx) < 0.8;
    if (oltre !== blocco) { blocco = oltre; joy.classList.toggle('blocco', blocco); }
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    mx = dx; my = -dy;
    pomo.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
  };
  const lasciaJoy = () => { mx = 0; my = 0; joy.classList.remove('on'); riposa(); };

  // ---------- pollice destro: trascini ovunque per mirare ----------
  const dx = document.createElement('div'); dx.className = 'st-zona'; dx.style.right = '0'; dx.style.width = '58%'; root.appendChild(dx);
  dx.addEventListener('pointerdown', (e) => { dita.set(e.pointerId, { tipo: 'guarda', x: e.clientX, y: e.clientY }); tieni(dx, e); });

  // ---------- i diti li seguono gli ascoltatori della finestra ----------
  addEventListener('pointermove', (e) => {
    const d = dita.get(e.pointerId);
    if (!d) return;
    if (d.tipo === 'joy') muoviJoy(e);
    else if (d.tipo === 'guarda' || d.guarda) gira_(d, e);
  });
  const lascia = (e: PointerEvent) => {
    const d = dita.get(e.pointerId);
    if (!d) return;
    dita.delete(e.pointerId);
    if (d.tipo === 'joy') lasciaJoy();
    else if (d.tipo === 'bottone') { d.su(); d.b.classList.remove('on'); }
  };
  for (const ev of ['pointerup', 'pointercancel'] as const) addEventListener(ev, lascia);
  addEventListener('blur', () => { for (const id of [...dita.keys()]) lascia({ pointerId: id } as PointerEvent); });

  // ---------- bottoni ----------
  type Pos = Partial<Record<'right' | 'left' | 'bottom' | 'top', string>>;
  const bottone = (testo: string, cls: string, pos: Pos, lato: number, giu_: () => void, su = () => { /* niente */ }, guarda = false) => {
    const b = document.createElement('div'); b.className = `st-b ${cls}`; b.textContent = testo;
    b.style.width = b.style.height = `${lato}px`;
    for (const [k, v] of Object.entries(pos)) (b.style as unknown as Record<string, string>)[k] = v;
    b.addEventListener('pointerdown', (e) => {
      if (dita.has(e.pointerId)) return;
      dita.set(e.pointerId, { tipo: 'bottone', b, su, guarda, x: e.clientX, y: e.clientY });
      b.classList.add('on'); giu_(); tieni(b, e);
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    root.appendChild(b); tutti.push(b);
    return b;
  };
  const destra = 'calc(env(safe-area-inset-right, 0px) + ', sinistra = 'calc(env(safe-area-inset-left, 0px) + ', basso = 'calc(env(safe-area-inset-bottom, 0px) + ';
  bottone('SPARA', 'spara', { right: destra + '96px)', bottom: basso + '118px)' }, 86, () => { fuocoD = true; }, () => { fuocoD = false; }, true);
  bottone('SPARA', 'spara', { left: sinistra + '150px)', bottom: basso + '200px)' }, 62, () => { fuocoS = true; }, () => { fuocoS = false; });
  const bMira = bottone('MIRA', '', { right: destra + '200px)', bottom: basso + '150px)' }, 60, () => { mira = !mira; bMira.classList.toggle('acceso', mira); }, undefined, true);
  bottone('RICARICA', '', { right: destra + '40px)', bottom: basso + '226px)' }, 52, () => { ricarica = true; });
  bottone('SALTA', '', { right: destra + '20px)', bottom: basso + '24px)' }, 60, () => { salto = true; }, () => { salto = false; }, true);
  const bGiu = bottone('GIÙ', '', { right: destra + '100px)', bottom: basso + '16px)' }, 54, () => { giu = !giu; bGiu.classList.toggle('acceso', giu); }, undefined, true);
  const bArma = bottone('ARMA', 'arma', { right: destra + '16px)', top: 'calc(env(safe-area-inset-top, 0px) + 58px)' }, 58, () => { arma = -1; });
  bArma.style.height = '38px';
  bAz = bottone('AZIONE', 'azione', { right: destra + '210px)', bottom: basso + '236px)' }, 78, () => { azione = true; }, () => { azione = false; });
  tutti.push(sx, dx, joy);
  return api;
}
