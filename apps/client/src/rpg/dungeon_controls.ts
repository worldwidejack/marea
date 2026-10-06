// Controlli del dungeon oltre a joystick/A/B di game/input.ts (R-scena): C = magia, D = pozione (bottoni ≥ 56 px sopra B e A, senza
// coprirli), Q = C e R = D sulla tastiera, clic sinistro tenuto sul canvas = A, Esc = «Uscire dal dungeon?», «A · Esci col bottino» vicino
// alla scala. Latch: un tocco più breve di un tick arriva comunque alla sim. Con la domanda aperta la partita è in pausa (nessun tick).
import { PAL, el } from '../ui/style.ts';

export type Controls = {
  /** Un campione per tick: c, d e la A in più (clic tenuto, bottone d'uscita). */
  sample(): { a: boolean; c: boolean; d: boolean };
  /** La domanda «Uscire?» è aperta: niente tick. */
  readonly paused: boolean;
  /** Vicino alla scala: mostra «A · Esci col bottino». */
  setExit(on: boolean): void;
  setIcons(c: Node | null, d: Node | null): void;
  /** Ricarica della magia 0..1 (1 = pronta) e pozioni rimaste. */
  setState(magia: number, pozioni: number, haMagia: boolean): void;
  hide(): void;
  dispose(): void;
};

const SAFE = 'env(safe-area-inset-bottom, 0px)', RIGHT = 'max(16px, env(safe-area-inset-right, 0px))';
const CSS = `
.mz-dng-btn { position: absolute; width: 60px; height: 60px; border-radius: 50%; border: 3px solid rgba(244,227,193,.7); color: ${PAL.sabbiaChiara}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font: bold 13px ui-monospace, Menlo, monospace; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; z-index: 13; overflow: hidden; }
.mz-dng-btn.c { right: calc(${RIGHT} + 96px); bottom: calc(${SAFE} + 116px); background: rgba(22,63,115,.82); }
.mz-dng-btn.d { right: calc(${RIGHT} + 12px); bottom: calc(${SAFE} + 132px); background: rgba(44,107,63,.82); }
.mz-dng-btn.on { transform: scale(.92); filter: brightness(1.3); }
.mz-dng-btn.off { opacity: .45; }
.mz-dng-btn .cd { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(35,32,31,.7); pointer-events: none; }
.mz-dng-btn small { font-size: 10px; opacity: .85; position: relative; }
.mz-dng-btn .ico { position: relative; display: flex; }
.mz-dng-quit { position: absolute; right: ${RIGHT}; top: max(8px, env(safe-area-inset-top)); min-height: 44px; min-width: 44px; padding: 0 10px; display: flex; align-items: center; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; font: bold 14px ui-monospace, Menlo, monospace; z-index: 14; cursor: pointer; }
.mz-dng-exit { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); display: none; align-items: center; gap: 8px; min-height: 56px; padding: 0 18px; background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 18px ui-monospace, Menlo, monospace; z-index: 16; cursor: pointer; white-space: nowrap; }
.mz-dng-exit.on { display: flex; }
.mz-dng-ask { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(320px, calc(100% - 32px)); padding: 16px; background: rgba(46,30,20,.97); border: 3px solid ${PAL.rosso}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; text-align: center; display: none; font-size: 17px; }
.mz-dng-ask.on { display: block; }
.mz-dng-ask b { display: block; font-size: 22px; margin-bottom: 6px; color: ${PAL.sabbiaChiara}; }
.mz-dng-ask .sub { color: ${PAL.sabbia}; font-size: 14px; margin-bottom: 12px; }
`;

export function createControls(o: { root: HTMLElement; canvas: HTMLCanvasElement; onAbort(): void }): Controls {
  if (!document.getElementById('mz-dng-ctrl-style')) { const st = document.createElement('style'); st.id = 'mz-dng-ctrl-style'; st.textContent = CSS; document.head.appendChild(st); }
  let cLatch = false, dLatch = false, aLatch = false, mouseA = false, asking = false;
  const cHeld = new Set<number>(), dHeld = new Set<number>(), keys = new Set<string>();
  const mkBtn = (cls: string, key: string, label: string) => {
    const b = el('div', `mz mz-dng-btn ${cls}`); b.id = cls === 'c' ? 'btnC' : 'btnD';
    const cd = el('div', 'cd'), ico = el('span', 'ico'), sm = el('small', '', `${label} · ${key}`);
    b.append(cd, ico, sm); return { b, cd, ico };
  };
  const C = mkBtn('c', 'Q', 'C'), D = mkBtn('d', 'R', 'D');
  const wire = (b: HTMLElement, held: Set<number>, latch: () => void) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); held.add(e.pointerId); latch(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch { /* sintetico */ } });
    const up = (e: PointerEvent) => { held.delete(e.pointerId); if (!held.size) b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  wire(C.b, cHeld, () => (cLatch = true)); wire(D.b, dHeld, () => (dLatch = true));
  const quit = el('button', 'mz mz-dng-quit', 'Esc · Esci'); quit.id = 'mzDngQuit'; quit.type = 'button';
  const exit = el('button', 'mz mz-dng-exit'); exit.id = 'mzDngExit'; exit.type = 'button';
  exit.append(el('span', '', 'A · Esci col bottino'));
  const ask = el('div', 'mz mz-dng-ask'); ask.id = 'mzDngAsk';
  const yes = el('button', 'mz-btn', 'ESCI'), no = el('button', 'mz-btn ghost', 'RESTA');
  yes.dataset['act'] = 'esci'; no.dataset['act'] = 'resta';
  const row = el('div', 'mz-row'); row.append(no, yes);
  ask.append(el('b', '', 'Uscire dal dungeon?'), el('div', 'sub', 'Perdi il bottino di questa discesa'), row);
  for (const e of [quit, exit, ask]) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  o.root.append(C.b, D.b, quit, exit, ask);
  const setAsk = (on: boolean) => { asking = on; ask.classList.toggle('on', on); };
  quit.addEventListener('click', () => setAsk(true));
  no.addEventListener('click', () => setAsk(false));
  yes.addEventListener('click', () => { setAsk(false); o.onAbort(); });
  exit.addEventListener('click', () => { aLatch = true; });

  const kd = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) setAsk(!asking); return; }
    if (asking && (e.code === 'Enter' || e.code === 'KeyY')) { e.preventDefault(); e.stopImmediatePropagation(); setAsk(false); o.onAbort(); return; }
    if (e.code === 'KeyQ' || e.code === 'KeyR') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      keys.add(e.code); if (e.code === 'KeyQ') cLatch = true; else dLatch = true;
    }
  };
  const ku = (e: KeyboardEvent) => { keys.delete(e.code); };
  const md = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) { mouseA = true; aLatch = true; } };
  const mu = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) mouseA = false; };
  const blur = () => { keys.clear(); cHeld.clear(); dHeld.clear(); mouseA = false; };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  o.canvas.addEventListener('pointerdown', md); addEventListener('pointerup', mu); addEventListener('blur', blur);

  let lastIcons = '';
  return {
    get paused() { return asking; },
    sample() {
      const out = { a: aLatch || mouseA, c: cLatch || cHeld.size > 0 || keys.has('KeyQ'), d: dLatch || dHeld.size > 0 || keys.has('KeyR') };
      aLatch = cLatch = dLatch = false;
      return out;
    },
    setExit(on) { exit.classList.toggle('on', on); },
    setIcons(c, d) {
      const k = `${c ? 1 : 0}${d ? 1 : 0}`; if (k === lastIcons) return; lastIcons = k;
      C.ico.replaceChildren(...(c ? [c] : [])); D.ico.replaceChildren(...(d ? [d] : []));
    },
    setState(magia, pozioni, haMagia) {
      C.cd.style.height = `${Math.round((1 - Math.max(0, Math.min(1, magia))) * 10) * 10}%`; // a gradini del 10 %
      C.b.classList.toggle('off', !haMagia); D.b.classList.toggle('off', pozioni <= 0);
    },
    hide() { setAsk(false); exit.classList.remove('on'); },
    dispose() {
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      o.canvas.removeEventListener('pointerdown', md); removeEventListener('pointerup', mu); removeEventListener('blur', blur);
      for (const e of [C.b, D.b, quit, exit, ask]) e.remove();
    },
  };
}
