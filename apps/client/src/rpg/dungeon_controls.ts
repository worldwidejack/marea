// Controlli del dungeon oltre a joystick/A/B di game/input.ts (R-scena): C = magia, D = pozione (bottoni ≥ 56 px sopra B e A, senza
// coprirli), Q = C e R = D sulla tastiera, clic sinistro tenuto sul canvas = A, «A · Esci col bottino» vicino alla scala. In alto a destra
// ZAINO (tasto I: la scheda del personaggio sullo zaino della spedizione) e PAUSA (Esc): Riprendi · Zaino · Esci dal dungeon (→ «Uscire?»).
// Sopra una lanterna: SALVA ed ESCI (dungeon v5, scelta di Riccardo). Latch: un tocco più breve di un tick arriva comunque alla sim.
// Con la pausa o la domanda aperta la partita è ferma (nessun tick); con la scheda aperta (blocked) i tasti sono suoi.
import { PAL, el } from '../ui/style.ts';

export type LanternaUi = { salvatoQui: boolean; oggetti: number; monete: number };
export type Controls = {
  /** Un campione per tick: c, d e la A in più (clic tenuto, bottone d'uscita). */
  sample(): { a: boolean; c: boolean; d: boolean };
  /** Pausa o domanda «Uscire?» aperta: niente tick. */
  readonly paused: boolean;
  /** Vicino alla scala: mostra «A · Esci col bottino». */
  setExit(on: boolean): void;
  /** Hai salvato a una lanterna: uscendo con Esc si tiene il bottino salvato lì. */
  setSalvato(on: boolean): void;
  /** Sopra una lanterna (null = no): SALVA ed ESCI, e cosa c'è da mettere al sicuro. */
  setLanterna(l: LanternaUi | null): void;
  /** Icone di C (magia) e D (pozione); `key` cambia quando cambiano (equipaggiamento). */
  setIcons(c: Node | null, d: Node | null, key?: string): void;
  /** Ricarica della magia 0..1 (1 = pronta) e pozioni rimaste. */
  setState(magia: number, pozioni: number, haMagia: boolean): void;
  hide(): void;
  dispose(): void;
};

const SAFE = 'env(safe-area-inset-bottom, 0px)', RIGHT = 'max(16px, env(safe-area-inset-right, 0px))', TOP = 'max(8px, env(safe-area-inset-top))';
const CSS = `
.mz-dng-btn { position: absolute; width: 60px; height: 60px; border-radius: 50%; border: 3px solid rgba(244,227,193,.7); color: ${PAL.sabbiaChiara}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font: bold 13px ui-monospace, Menlo, monospace; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; z-index: 13; overflow: hidden; }
.mz-dng-btn.c { right: calc(${RIGHT} + 96px); bottom: calc(${SAFE} + 116px); background: rgba(22,63,115,.82); }
.mz-dng-btn.d { right: calc(${RIGHT} + 12px); bottom: calc(${SAFE} + 132px); background: rgba(44,107,63,.82); }
.mz-dng-btn.on { transform: scale(.92); filter: brightness(1.3); }
.mz-dng-btn.off { opacity: .45; }
.mz-dng-btn .cd { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(35,32,31,.7); pointer-events: none; }
.mz-dng-btn small { font-size: 10px; opacity: .85; position: relative; }
.mz-dng-btn .ico { position: relative; display: flex; }
.mz-dng-top { position: absolute; right: ${RIGHT}; top: ${TOP}; display: flex; gap: 8px; z-index: 14; }
.mz-dng-tb { min-height: 44px; min-width: 44px; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 6px; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; font: bold 14px ui-monospace, Menlo, monospace; cursor: pointer; }
.mz-dng-tb:active { transform: translateY(2px); box-shadow: 0 1px 0 ${PAL.neroCaldo}; }
.mz-dng-tb small { font-size: 11px; color: ${PAL.sabbia}; }
.mz-dng-tb .pz { display: flex; gap: 4px; } .mz-dng-tb .pz i { display: block; width: 5px; height: 16px; background: ${PAL.sabbiaChiara}; box-shadow: 1px 1px 0 ${PAL.neroCaldo}; }
.mz-dng-exit { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); display: none; align-items: center; gap: 8px; min-height: 56px; padding: 0 18px; background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 18px ui-monospace, Menlo, monospace; z-index: 16; cursor: pointer; white-space: nowrap; }
.mz-dng-exit.on { display: flex; }
.mz-dng-lan { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); width: min(300px, calc(100% - 32px)); padding: 8px 10px 10px; display: none; background: rgba(46,30,20,.95); border: 3px solid ${PAL.giallo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 16; text-align: center; }
.mz-dng-lan.on { display: block; }
.mz-dng-lan b { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 16px; color: ${PAL.giallo}; letter-spacing: .06em; }
.mz-dng-lan b i { display: block; width: 8px; height: 12px; background: ${PAL.giallo}; box-shadow: 0 0 0 2px ${PAL.arancio}, 0 0 10px ${PAL.giallo}; }
.mz-dng-lan .sub { font-size: 13px; color: ${PAL.sabbia}; margin: 3px 0 0; min-height: 17px; }
.mz-dng-lan .mz-btn { margin-top: 8px; min-height: 52px; font-size: 17px; }
.mz-dng-lan .mz-btn.salva { background: ${PAL.giallo}; }
.mz-dng-lan .mz-btn.salva.fatto { background: ${PAL.erbaScura}; color: ${PAL.sabbiaChiara}; }
.mz-dng-ask { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(320px, calc(100% - 32px)); padding: 16px; background: rgba(46,30,20,.97); border: 3px solid ${PAL.rosso}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; text-align: center; display: none; font-size: 17px; }
.mz-dng-ask.on { display: block; }
.mz-dng-ask.pausa { border-color: ${PAL.legnoChiaro}; }
.mz-dng-ask b { display: block; font-size: 22px; margin-bottom: 6px; color: ${PAL.sabbiaChiara}; }
.mz-dng-ask .sub { color: ${PAL.sabbia}; font-size: 14px; margin-bottom: 12px; }
.mz-dng-ask .mz-btn small { font-size: 12px; color: inherit; opacity: .8; }
`;

export function createControls(o: { root: HTMLElement; canvas: HTMLCanvasElement; onAbort(): void; onZaino(): void; onSalva(): void; onEsciLanterna(): void; blocked(): boolean }): Controls {
  if (!document.getElementById('mz-dng-ctrl-style')) { const st = document.createElement('style'); st.id = 'mz-dng-ctrl-style'; st.textContent = CSS; document.head.appendChild(st); }
  let cLatch = false, dLatch = false, aLatch = false, mouseA = false, asking = false, pausa = false;
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
  const btn = (cls: string, act: string, ...kids: (Node | string)[]) => { const b = el('button', cls); b.type = 'button'; b.dataset['act'] = act; b.append(...kids); return b; };

  // ---- in alto a destra: Zaino e Pausa ----
  const top = el('div', 'mz mz-dng-top'); top.id = 'mzDngTop';
  const zaino = btn('mz-dng-tb', 'zaino', 'ZAINO', el('small', '', 'I')); zaino.id = 'mzDngZaino'; zaino.title = 'Zaino ed equipaggiamento (I)';
  const pz = el('span', 'pz'); pz.append(el('i'), el('i'));
  const pauseBtn = btn('mz-dng-tb', 'pausa', pz); pauseBtn.id = 'mzDngPausaBtn'; pauseBtn.title = 'Pausa (Esc)'; pauseBtn.setAttribute('aria-label', 'Pausa');
  top.append(zaino, pauseBtn);

  // ---- scala e lanterna ----
  const exit = btn('mz mz-dng-exit', 'scala', el('span', '', 'A · Esci col bottino')); exit.id = 'mzDngExit';
  const lanBox = el('div', 'mz mz-dng-lan'); lanBox.id = 'mzDngLanterna';
  const lanTitle = el('b'); lanTitle.append(el('i'), 'LANTERNA');
  const lanSub = el('div', 'sub');
  const salva = btn('mz-btn salva', 'salva', 'SALVA'), esciL = btn('mz-btn ghost', 'esci-lanterna', 'ESCI');
  const lanRow = el('div', 'mz-row'); lanRow.append(salva, esciL);
  lanBox.append(lanTitle, lanSub, lanRow);

  // ---- pausa e «Uscire?» ----
  const menu = el('div', 'mz mz-dng-ask pausa'); menu.id = 'mzDngPausa';
  const resume = btn('mz-btn green', 'riprendi', 'RIPRENDI', el('small', '', 'Esc'));
  const mZaino = btn('mz-btn ghost', 'zaino', 'ZAINO', el('small', '', 'I'));
  const mEsci = btn('mz-btn ghost', 'esci-menu', 'ESCI DAL DUNGEON');
  menu.append(el('b', '', 'Pausa'), el('div', 'sub', 'Il dungeon ti aspetta'), resume, mZaino, mEsci);
  const ask = el('div', 'mz mz-dng-ask'); ask.id = 'mzDngAsk';
  const yes = btn('mz-btn', 'esci', 'ESCI'), no = btn('mz-btn ghost', 'resta', 'RESTA');
  const row = el('div', 'mz-row'); row.append(no, yes);
  const askSub = el('div', 'sub', 'Perdi il bottino di questa discesa');
  ask.append(el('b', '', 'Uscire dal dungeon?'), askSub, row);
  const all = [C.b, D.b, top, exit, lanBox, menu, ask];
  for (const e of all.slice(2)) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  o.root.append(...all);

  const setPausa = (on: boolean) => { pausa = on; menu.classList.toggle('on', on); };
  const setAsk = (on: boolean) => { asking = on; ask.classList.toggle('on', on); if (on) setPausa(false); };
  const openZaino = () => { setPausa(false); setAsk(false); o.onZaino(); };
  pauseBtn.addEventListener('click', () => { if (!asking) setPausa(!pausa); });
  zaino.addEventListener('click', openZaino);
  resume.addEventListener('click', () => setPausa(false));
  mZaino.addEventListener('click', openZaino);
  mEsci.addEventListener('click', () => setAsk(true));
  no.addEventListener('click', () => setAsk(false));
  yes.addEventListener('click', () => { setAsk(false); o.onAbort(); });
  exit.addEventListener('click', () => { aLatch = true; });
  salva.addEventListener('click', () => { if (!pausa && !asking) o.onSalva(); });
  esciL.addEventListener('click', () => { if (!pausa && !asking) o.onEsciLanterna(); });

  const kd = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || o.blocked()) return; // scheda aperta: Esc e I sono suoi (la chiudono)
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { if (asking) setAsk(false); else setPausa(!pausa); } return; }
    if (asking && (e.code === 'Enter' || e.code === 'KeyY')) { e.preventDefault(); e.stopImmediatePropagation(); setAsk(false); o.onAbort(); return; }
    if (e.code === 'KeyI') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) openZaino(); return; }
    if (e.code === 'KeyQ' || e.code === 'KeyR') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat || pausa || asking) return;
      keys.add(e.code); if (e.code === 'KeyQ') cLatch = true; else dLatch = true;
    }
  };
  const ku = (e: KeyboardEvent) => { keys.delete(e.code); };
  const md = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0 && !pausa && !asking && !o.blocked()) { mouseA = true; aLatch = true; } };
  const mu = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) mouseA = false; };
  const blur = () => { keys.clear(); cHeld.clear(); dHeld.clear(); mouseA = false; };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  o.canvas.addEventListener('pointerdown', md); addEventListener('pointerup', mu); addEventListener('blur', blur);

  let lastIcons = '', lanSig = '';
  return {
    get paused() { return asking || pausa; },
    sample() {
      const out = { a: aLatch || mouseA, c: cLatch || cHeld.size > 0 || keys.has('KeyQ'), d: dLatch || dHeld.size > 0 || keys.has('KeyR') };
      aLatch = cLatch = dLatch = false;
      return out;
    },
    setExit(on) { exit.classList.toggle('on', on); },
    setSalvato(on) { askSub.textContent = on ? 'Tieni il bottino salvato alla lanterna, il resto lo perdi' : 'Perdi il bottino di questa discesa'; },
    setLanterna(l) {
      const sig = l ? `${l.salvatoQui ? 1 : 0}|${l.oggetti}|${l.monete}` : '';
      if (sig === lanSig) return;
      lanSig = sig;
      lanBox.classList.toggle('on', !!l);
      if (!l) return;
      const cosa = [l.oggetti ? `${l.oggetti} ${l.oggetti === 1 ? 'oggetto' : 'oggetti'}` : '', l.monete ? `${l.monete} monete` : ''].filter(Boolean).join(' e ');
      lanSub.textContent = l.salvatoQui ? 'Bottino al sicuro. Se cadi, ti risvegli qui' : cosa ? `Metti al sicuro ${cosa}` : 'Salva: se cadi, ti risvegli qui';
      salva.textContent = l.salvatoQui ? 'SALVATO ✓' : 'SALVA';
      salva.classList.toggle('fatto', l.salvatoQui);
      esciL.title = 'Esci col bottino: la prossima volta puoi ripartire da qui';
    },
    setIcons(c, d, key = '') {
      const k = `${c ? 1 : 0}${d ? 1 : 0}|${key}`; if (k === lastIcons) return; lastIcons = k;
      C.ico.replaceChildren(...(c ? [c] : [])); D.ico.replaceChildren(...(d ? [d] : []));
    },
    setState(magia, pozioni, haMagia) {
      C.cd.style.height = `${Math.round((1 - Math.max(0, Math.min(1, magia))) * 10) * 10}%`; // a gradini del 10 %
      C.b.classList.toggle('off', !haMagia); D.b.classList.toggle('off', pozioni <= 0);
    },
    hide() { setAsk(false); setPausa(false); exit.classList.remove('on'); lanBox.classList.remove('on'); top.style.display = 'none'; lanSig = ''; },
    dispose() {
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      o.canvas.removeEventListener('pointerdown', md); removeEventListener('pointerup', mu); removeEventListener('blur', blur);
      for (const e of all) e.remove();
    },
  };
}
