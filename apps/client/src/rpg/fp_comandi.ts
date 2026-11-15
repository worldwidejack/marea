// Prima persona nei dungeon: dove si guarda. Da PC il mouse catturato (pointer lock): il primo clic lo prende, Esc lo lascia e apre la pausa,
// zaino e pannelli lo liberano e alla chiusura torna da solo. Dal telefono, in orizzontale e a due pollici: il joystick resta a sinistra e il
// pollice destro trascinato sulla parte destra gira la visuale, anche partendo dal bottone A (si colpisce e si mira insieme).
// Col controller (comandi/pad.ts) lo stick destro gira la visuale: più lo spingi, più va veloce.
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';
import { padInUso, padMira } from '../comandi/pad.ts';
import { alTuttiSu } from '../ui/tocchi_su.ts';

export type Sguardo = {
  /** Rad: yaw 0 = guarda verso −Z, + verso sinistra; pitch + in su. `scala`: quanto gira per un movimento (lo zoom dell'arco la abbassa). */
  yaw: number; pitch: number; scala: number;
  readonly tocco: boolean;
  readonly catturato: boolean;
  /** Telefono tenuto in verticale: si aspetta che lo giri. */
  readonly verticale: boolean;
  /** Quanto si è girato dall'ultima lettura (le mani restano un po' indietro). */
  scarto(): { dy: number; dp: number };
  /** Il clic sul canvas attacca? No se serviva a riprendere il mouse. */
  clic(): boolean;
  /** Da chiamare a ogni frame: libera il mouse quando il gioco è fermo e lo riprende quando riparte; mostra l'invito a cliccare. */
  frame(attivo: boolean): void;
  riprendi(): void;
  dispose(): void;
};

const SENS_MOUSE = 0.0021, SENS_DITO = 0.0058, SALTO_MAX = 240, VEL_PAD = { yaw: 2.8, pitch: 1.8 }; // rad/s a stick tutto spinto
const PITCH_SU = (70 * Math.PI) / 180, PITCH_GIU = (-85 * Math.PI) / 180;
const CSS = `
.mz.mz-dng-titolo b, .mz.mz-dng-titolo small { color: ${L.cartaChiara}; }
.mz-fp-pc #joystick, .mz-fp-pc #btnA, .mz-fp-pc #btnB, .mz-fp-pc #btnSchiva { display: none !important; }
.mz-fp-clic { position: absolute; left: 50%; top: 42%; transform: translateX(-50%); padding: 8px 16px; background: ${L.cartaChiara}; color: ${L.inchiostro}; border: 3px solid ${L.oro}; box-shadow: 0 4px 0 ${L.inchiostro}; font: 700 16px ${FONT_LIBRO}; z-index: 15; pointer-events: none; display: none; white-space: nowrap; }
.mz-fp-gira { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 12px; background: ${L.inchiostro}; color: ${L.cartaChiara}; font: 700 20px ${FONT_LIBRO}; z-index: 40; text-align: center; }
.mz-fp-gira i { width: 46px; height: 76px; border: 4px solid ${L.cartaChiara}; border-radius: 9px; transform: rotate(-90deg); }
`;

export function creaSguardo(o: { canvas: HTMLCanvasElement; root: HTMLElement; yaw: number; onPerso(): void }): Sguardo {
  if (!document.getElementById('mz-fp-style')) { const st = document.createElement('style'); st.id = 'mz-fp-style'; st.textContent = CSS; document.head.appendChild(st); }
  const tocco = matchMedia('(pointer: coarse)').matches;
  let dy = 0, dp = 0, daNoi = false, attivoOra = false, tPad = performance.now();
  const dita = new Map<number, { x: number; y: number }>();
  const clamp = (p: number) => Math.max(PITCH_GIU, Math.min(PITCH_SU, p));
  const gira = (a0: number, b0: number) => { const a = a0 * api.scala, b = b0 * api.scala; api.yaw += a; const p = clamp(api.pitch + b); dp += p - api.pitch; api.pitch = p; dy += a; };
  const cattura = () => { if (tocco || document.pointerLockElement === o.canvas) return; try { void o.canvas.requestPointerLock?.()?.catch?.(() => { /* rifiutato: si riprova col prossimo clic */ }); } catch { /* idem */ } };
  const invito = document.createElement('div'); invito.className = 'mz-fp-clic'; invito.textContent = 'Clicca per guardarti attorno'; o.root.appendChild(invito);
  const avviso = document.createElement('div'); avviso.className = 'mz-fp-gira'; avviso.innerHTML = '<i></i>GIRA IL TELEFONO'; document.body.appendChild(avviso);

  const onMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== o.canvas || !attivoOra) return;
    const mx = Math.max(-SALTO_MAX, Math.min(SALTO_MAX, e.movementX)), my = Math.max(-SALTO_MAX, Math.min(SALTO_MAX, e.movementY)); // Chrome ogni tanto manda salti enormi
    gira(-mx * SENS_MOUSE, -my * SENS_MOUSE);
  };
  const onLock = () => {
    if (document.pointerLockElement === o.canvas) { daNoi = false; return; }
    if (!daNoi && attivoOra) o.onPerso();
  };
  // ---- dita: chi nasce sulla parte destra del canvas, o sul bottone A, gira la visuale ----
  const prendi = (e: PointerEvent) => { if (e.pointerType !== 'mouse') dita.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const suCanvas = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || e.clientX < o.canvas.getBoundingClientRect().width * 0.42) return;
    prendi(e); e.stopImmediatePropagation(); // il joystick «una mano» (game/input.ts) nasce solo a sinistra
  };
  const onDito = (e: PointerEvent) => {
    const d = dita.get(e.pointerId);
    if (!d) return;
    if (attivoOra) gira(-(e.clientX - d.x) * SENS_DITO, -(e.clientY - d.y) * SENS_DITO);
    d.x = e.clientX; d.y = e.clientY;
  };
  const lascia = (e: PointerEvent) => { dita.delete(e.pointerId); };
  const togliSu = alTuttiSu(() => dita.clear()); // nessun dito sullo schermo: quelli rimasti sono pointerup persi
  const bottoneA = document.getElementById('btnA');
  addEventListener('mousemove', onMove); document.addEventListener('pointerlockchange', onLock);
  o.canvas.addEventListener('pointerdown', suCanvas, { capture: true }); bottoneA?.addEventListener('pointerdown', prendi);
  addEventListener('pointermove', onDito); addEventListener('pointerup', lascia); addEventListener('pointercancel', lascia);
  if (!tocco) o.root.classList.add('mz-fp-pc');

  const api: Sguardo = {
    yaw: o.yaw, pitch: 0, scala: 1, tocco,
    get catturato() { return document.pointerLockElement === o.canvas; },
    get verticale() { return tocco && innerHeight > innerWidth; },
    scarto() { const r = { dy, dp }; dy = 0; dp = 0; return r; },
    clic() {
      if (tocco || document.pointerLockElement === o.canvas) return true;
      cattura();
      return false;
    },
    frame(attivo) {
      attivoOra = attivo;
      const ora = performance.now(), dt = Math.min(0.1, (ora - tPad) / 1000); tPad = ora;
      const sp = padMira();
      if (attivo && (sp.x || sp.y)) gira(-sp.x * (0.45 + 0.55 * Math.abs(sp.x)) * VEL_PAD.yaw * dt, -sp.y * (0.45 + 0.55 * Math.abs(sp.y)) * VEL_PAD.pitch * dt); // curva morbida: piano per i ritocchi, forte per girarsi
      avviso.style.display = api.verticale ? 'flex' : 'none';
      if (tocco) return;
      const preso = document.pointerLockElement === o.canvas;
      if (!attivo && preso) { daNoi = true; document.exitPointerLock(); }
      else if (attivo && !preso && daNoi) { daNoi = false; cattura(); }
      invito.style.display = attivo && !preso && !padInUso() ? 'block' : 'none';
    },
    riprendi: cattura,
    dispose() {
      removeEventListener('mousemove', onMove); document.removeEventListener('pointerlockchange', onLock);
      o.canvas.removeEventListener('pointerdown', suCanvas, { capture: true }); bottoneA?.removeEventListener('pointerdown', prendi);
      removeEventListener('pointermove', onDito); removeEventListener('pointerup', lascia); removeEventListener('pointercancel', lascia); togliSu();
      daNoi = true; if (document.pointerLockElement === o.canvas) document.exitPointerLock();
      o.root.classList.remove('mz-fp-pc'); invito.remove(); avviso.remove();
    },
  };
  cattura();
  return api;
}
