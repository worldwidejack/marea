// Controlli del dungeon oltre a joystick/A/B di game/input.ts (R-scena): C = alterna arma e magia in mano, D = pozione (bottoni ≥ 56 px sopra
// B e A, senza coprirli), Q = C e R = D sulla tastiera, clic sinistro tenuto sul canvas = A (con la magia in mano mira, e la lancia al rilascio), «A · Esci col
// bottino» vicino alla scala. Con la magia in mano (v6) sopra i bottoni compare il MENÙ RAPIDO delle magie: un chip per magia conosciuta,
// un tocco (o il tasto 1-9) la cambia al volo. In alto a destra ZAINO (tasto I: la scheda del personaggio sullo zaino della spedizione) e
// PAUSA (Esc): Riprendi · Zaino · Esci dal dungeon (→ «Uscire?»). Sopra una lanterna: SALVA ed ESCI (dungeon v5, scelta di Riccardo).
// Latch: un tocco più breve di un tick arriva comunque alla sim. Con la pausa o la domanda aperta la partita è ferma (nessun tick); con la
// scheda aperta (blocked) i tasti sono suoi. Insieme (#118) la partita non si ferma mai: la Pausa diventa un menu.
import { aimDir, aimIndex } from '@marea/sim/dungeon/mira.ts';
import { screenToWorld } from '../game/input.ts';
import { PAL, el } from '../ui/style.ts';

export type LanternaUi = { salvatoQui: boolean; oggetti: number; monete: number };
/** Una magia del menù rapido: nome, costo in Magicka e una funzione che fa l'icona (un canvas non si clona: ogni chip ne vuole una nuova). */
export type MagiaUi = { id: string; nome: string; costo: number; icona(): Node; /** Raggio continuo: il costo è al secondo. */ alSecondo?: boolean };
export type Controls = {
  /** Un campione per tick: c, d e la A in più (clic tenuto, bottone d'uscita, joystick di mira). `m` = indice di mira del joystick di mira
   *  (mentre è tenuto e nel tick del rilascio, così l'arco parte dove puntavi); 0 = niente mira dal dito. */
  sample(): { a: boolean; c: boolean; d: boolean; e: boolean; m: number };
  /** Telefono, arco o magia in mano: al posto del bottone A compare il joystick di mira (trascini = punti e tiri, lasci = l'arco parte). */
  setMira(on: boolean): void;
  /** Direzione del joystick di mira mentre lo tieni (versore in assi mondo, la stessa che la sim userà), null se non lo tieni. */
  miraDir(): { x: number; z: number } | null;
  /** Pausa o domanda «Uscire?» aperta: niente tick. */
  readonly paused: boolean;
  /** Vicino alla scala: mostra «A · Esci col bottino». */
  setExit(on: boolean): void;
  /** Drenaggio: accanto a una valvola chiusa (A la gira). Fucina: la leva della chiusa (createControls({ valvola }) cambia la scritta). */
  setValvola(on: boolean): void;
  /** Archivio: accanto al timone di una corrente che soffia (A la ferma). */
  setTimone(on: boolean): void;
  /** Hai salvato a una lanterna: uscendo con Esc si tiene il bottino salvato lì. */
  setSalvato(on: boolean): void;
  /** Sopra una lanterna (null = no): SALVA ed ESCI, e cosa c'è da mettere al sicuro. */
  setLanterna(l: LanternaUi | null): void;
  /** Icone di C (magia) e D (pozione); `key` cambia quando cambiano (equipaggiamento). */
  setIcons(c: Node | null, d: Node | null, key?: string): void;
  /** Perk Scarica: il bottone E (visibile solo con l'arco in mano) e la sua ricarica 0..1 (1 = pronta). */
  setScarica(on: boolean, pronta: number): void;
  /** Ricarica della magia 0..1 (1 = pronta) e pozioni rimaste. */
  setState(magia: number, pozioni: number, haMagia: boolean): void;
  /** Menù rapido delle magie: quelle conosciute, quale è in mano (null = in mano c'è l'arma: il menù si nasconde) e la Magicka che c'è. */
  setMagie(elenco: readonly MagiaUi[], inMano: string | null, magicka: number): void;
  hide(): void;
  dispose(): void;
};

const MIRA = 108, KNOB = 44, MIRA_R = 36, MIRA_DEAD = 0.3; // px: anello, pomello, corsa del pomello; zona morta (frazione della corsa) prima di mirare
const SAFE = 'env(safe-area-inset-bottom, 0px)', RIGHT = 'max(16px, env(safe-area-inset-right, 0px))', TOP = 'max(8px, env(safe-area-inset-top))';
const CSS = `
.mz-dng-btn { position: absolute; width: 60px; height: 60px; border-radius: 50%; border: 3px solid rgba(244,227,193,.7); color: ${PAL.sabbiaChiara}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font: bold 13px ui-monospace, Menlo, monospace; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; z-index: 13; overflow: hidden; }
.mz-dng-btn.c { right: calc(${RIGHT} + 96px); bottom: calc(${SAFE} + 116px); background: rgba(22,63,115,.82); }
.mz-dng-btn.d { right: calc(${RIGHT} + 12px); bottom: calc(${SAFE} + 132px); background: rgba(44,107,63,.82); }
.mz-dng-btn.e { right: calc(${RIGHT} + 96px); bottom: calc(${SAFE} + 184px); background: rgba(120,70,22,.84); display: none; }
.mz-dng-btn.e.on-vis { display: flex; }
.mz-dng-aimon .mz-dng-btn.e { bottom: calc(${SAFE} + 216px); }
.mz-dng-aimon #btnA { display: none !important; }
.mz-dng-aimon #btnB { right: calc(max(16px, env(safe-area-inset-right, 0px)) + ${MIRA + 8}px) !important; }
.mz-dng-aimon .mz-dng-btn.c { bottom: calc(${SAFE} + 148px); }
.mz-dng-aimon .mz-dng-btn.d { bottom: calc(${SAFE} + 160px); }
.mz-dng-aimon .mz-dng-sp { bottom: calc(${SAFE} + 236px); }
.mz-dng-aim { position: absolute; right: ${RIGHT}; bottom: calc(${SAFE} + 28px); width: ${MIRA}px; height: ${MIRA}px; box-sizing: border-box; border-radius: 50%; display: none; background: rgba(232,67,63,.22); border: 3px solid rgba(244,227,193,.7); z-index: 13; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.mz-dng-aim.on { display: block; }
.mz-dng-aim::before, .mz-dng-aim::after { content: ''; position: absolute; background: rgba(244,227,193,.35); pointer-events: none; }
.mz-dng-aim::before { left: 50%; top: 14px; bottom: 14px; width: 2px; margin-left: -1px; }
.mz-dng-aim::after { top: 50%; left: 14px; right: 14px; height: 2px; margin-top: -1px; }
.mz-dng-aim i { position: absolute; left: ${(MIRA - 6 - KNOB) / 2}px; top: ${(MIRA - 6 - KNOB) / 2}px; width: ${KNOB}px; height: ${KNOB}px; box-sizing: border-box; border-radius: 50%; background: rgba(232,67,63,.9); border: 3px solid ${PAL.sabbiaChiara}; pointer-events: none; will-change: transform; z-index: 1; }
.mz-dng-aim.tieni i { background: ${PAL.rosso}; }
.mz-dng-btn.on { transform: scale(.92); filter: brightness(1.3); }
.mz-dng-btn.off { opacity: .45; }
.mz-dng-btn.mano { border-color: ${PAL.giallo}; box-shadow: 0 0 0 2px ${PAL.neroCaldo}; }
.mz-dng-sp { position: absolute; right: ${RIGHT}; bottom: calc(${SAFE} + 206px); display: none; gap: 6px; z-index: 13; -webkit-user-select: none; user-select: none; touch-action: none; }
.mz-dng-sp.on { display: flex; }
.mz-dng-sp button { position: relative; width: 46px; height: 46px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(46,30,20,.88); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara}; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.mz-dng-sp button.cur { border-color: ${PAL.giallo}; background: rgba(86,58,28,.96); }
.mz-dng-sp button.no { opacity: .5; }
.mz-dng-sp button:active { transform: translateY(2px); box-shadow: 0 1px 0 ${PAL.neroCaldo}; }
.mz-dng-sp button i { position: absolute; left: 2px; top: 0; font: bold 11px ui-monospace, Menlo, monospace; font-style: normal; color: ${PAL.sabbia}; text-shadow: 1px 1px 0 ${PAL.neroCaldo}; }
.mz-dng-sp button b { position: absolute; right: 2px; bottom: 0; font: bold 10px ui-monospace, Menlo, monospace; color: ${PAL.acquaBassa}; text-shadow: 1px 1px 0 ${PAL.neroCaldo}; }
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
.mz-dng-exit.valv { background: ${PAL.acquaBassa}; }
.mz-dng-exit.tim { background: ${PAL.arancio}; }
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

export function createControls(o: { root: HTMLElement; canvas: HTMLCanvasElement; onAbort(): void; onZaino(): void; onSalva(): void; onEsciLanterna(): void; onMagia(id: string): void; blocked(): boolean; yaw(): number; insieme?: boolean; valvola?: string }): Controls {
  if (!document.getElementById('mz-dng-ctrl-style')) { const st = document.createElement('style'); st.id = 'mz-dng-ctrl-style'; st.textContent = CSS; document.head.appendChild(st); }
  let cLatch = false, dLatch = false, eLatch = false, aLatch = false, mouseA = false, asking = false, pausa = false;
  const cHeld = new Set<number>(), dHeld = new Set<number>(), eHeld = new Set<number>(), keys = new Set<string>();
  const mkBtn = (cls: string, key: string, label: string) => {
    const b = el('div', `mz mz-dng-btn ${cls}`); b.id = cls === 'c' ? 'btnC' : cls === 'e' ? 'btnE' : 'btnD';
    const cd = el('div', 'cd'), ico = el('span', 'ico'), sm = el('small', '', `${label} · ${key}`);
    b.append(cd, ico, sm); return { b, cd, ico };
  };
  const C = mkBtn('c', 'Q', 'C'), D = mkBtn('d', 'R', 'D'), E = mkBtn('e', 'E', 'Scarica');
  C.b.title = 'Alterna arma e magia in mano (Q)'; E.b.title = 'Scarica di frecce (E)';
  E.ico.textContent = '×3'; E.ico.style.font = 'bold 20px ui-monospace, Menlo, monospace'; E.b.querySelector('small')!.textContent = 'E'; // tre frecce: il nome sta nel tooltip e nella guida
  // menù rapido delle magie (solo con la magia in mano): un chip per magia, tocco o tasto 1-9
  const sp = el('div', 'mz mz-dng-sp'); sp.id = 'mzDngMagie';
  let spIds: string[] = [], spSig = '';
  const wire = (b: HTMLElement, held: Set<number>, latch: () => void) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); held.add(e.pointerId); latch(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch { /* sintetico */ } });
    const up = (e: PointerEvent) => { held.delete(e.pointerId); if (!held.size) b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  wire(C.b, cHeld, () => (cLatch = true)); wire(D.b, dHeld, () => (dLatch = true)); wire(E.b, eHeld, () => (eLatch = true));

  // ---- joystick di mira (telefono, arco o magia in mano): trascini = punti e tiri, lasci = l'arco parte dove puntavi ----
  // Il pomello sceglie la direzione come il joystick di movimento (su = verso dove guarda la camera); oltre la zona morta la mira è «agganciata»
  // (A premuta e indice d'angolo nell'input) finché non lasci: tornare al centro non annulla, tiene l'ultima direzione. Un dito solo.
  const aim = el('div', 'mz mz-dng-aim'); aim.id = 'mzDngMira';
  const knob = el('i'); aim.append(knob);
  let aimId: number | null = null, aimOn = false, aimHeld = false, aimRel = false, aimM = 0, touchSeen = false;
  const aimPaint = (x: number, y: number) => { knob.style.transform = `translate(${x * MIRA_R}px, ${y * MIRA_R}px)`; aim.classList.toggle('tieni', aimHeld); };
  const aimMove = (e: PointerEvent) => {
    const r = aim.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.sqrt(dx * dx + dy * dy), k = d > MIRA_R ? MIRA_R / d : 1, jx = (dx * k) / MIRA_R, jy = (dy * k) / MIRA_R, len = d * k / MIRA_R;
    if (len > MIRA_DEAD) aimHeld = true;
    if (aimHeld && len > 0.12) { const w = screenToWorld(jx, jy, o.yaw()); aimM = aimIndex(w.mx, w.my) || aimM; }
    aimPaint(jx, jy);
  };
  const aimEnd = () => { if (aimId === null) return; aimId = null; if (aimHeld) aimRel = true; aimHeld = false; aimPaint(0, 0); };
  const aimCancel = () => { aimEnd(); aimRel = false; }; // pausa, domanda, blur: il dito non conta più
  aim.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (aimId !== null || pausa || asking || o.blocked()) return;
    aimId = e.pointerId; aimM = 0; aimRel = false;
    try { aim.setPointerCapture(e.pointerId); } catch { /* sintetico */ }
    aimMove(e);
  });
  aim.addEventListener('pointermove', (e) => { if (e.pointerId === aimId) { e.preventDefault(); aimMove(e); } });
  const aimUp = (e: PointerEvent) => { if (e.pointerId === aimId) aimEnd(); };
  for (const ev of ['pointerup', 'pointercancel']) { aim.addEventListener(ev, aimUp as EventListener); addEventListener(ev, aimUp as EventListener); }
  aim.addEventListener('contextmenu', (e) => e.preventDefault());
  aim.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  const seen = (e: PointerEvent) => { if (e.pointerType === 'touch') touchSeen = true; };
  addEventListener('pointerdown', seen, true);
  const coarse = () => touchSeen || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const btn = (cls: string, act: string, ...kids: (Node | string)[]) => { const b = el('button', cls); b.type = 'button'; b.dataset['act'] = act; b.append(...kids); return b; };

  // ---- in alto a destra: Zaino e Pausa ----
  const top = el('div', 'mz mz-dng-top'); top.id = 'mzDngTop';
  const zaino = btn('mz-dng-tb', 'zaino', 'ZAINO', el('small', '', 'I')); zaino.id = 'mzDngZaino'; zaino.title = 'Zaino ed equipaggiamento (I)';
  const pz = el('span', 'pz'); pz.append(el('i'), el('i'));
  const pauseBtn = btn('mz-dng-tb', 'pausa', pz); pauseBtn.id = 'mzDngPausaBtn'; pauseBtn.title = 'Pausa (Esc)'; pauseBtn.setAttribute('aria-label', 'Pausa');
  top.append(zaino, pauseBtn);

  // ---- scala e lanterna ----
  const exit = btn('mz mz-dng-exit', 'scala', el('span', '', 'A · Esci col bottino')); exit.id = 'mzDngExit';
  const valv = btn('mz mz-dng-exit valv', 'valvola', el('span', '', o.valvola ?? 'A · Gira la valvola')); valv.id = 'mzDngValvola';
  const tim = btn('mz mz-dng-exit tim', 'timone', el('span', '', 'A · Gira il timone')); tim.id = 'mzDngTimone';
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
  menu.append(el('b', '', o.insieme ? 'Menu' : 'Pausa'), el('div', 'sub', o.insieme ? 'La squadra continua: il dungeon non si ferma' : 'Il dungeon ti aspetta'), resume, mZaino, mEsci);
  const ask = el('div', 'mz mz-dng-ask'); ask.id = 'mzDngAsk';
  const yes = btn('mz-btn', 'esci', 'ESCI'), no = btn('mz-btn ghost', 'resta', 'RESTA');
  const row = el('div', 'mz-row'); row.append(no, yes);
  const askSub = el('div', 'sub', 'Perdi il bottino di questa discesa');
  ask.append(el('b', '', 'Uscire dal dungeon?'), askSub, row);
  const all = [C.b, D.b, E.b, aim, sp, top, exit, valv, tim, lanBox, menu, ask];
  for (const e of all.slice(3)) for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation());
  sp.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-magia]');
    if (b && !pausa && !asking) o.onMagia(b.dataset['magia']!);
  });
  o.root.append(...all);

  const setPausa = (on: boolean) => { pausa = on; menu.classList.toggle('on', on); if (on) aimCancel(); };
  const setAsk = (on: boolean) => { asking = on; ask.classList.toggle('on', on); if (on) { setPausa(false); aimCancel(); } };
  const openZaino = () => { setPausa(false); setAsk(false); o.onZaino(); };
  pauseBtn.addEventListener('click', () => { if (!asking) setPausa(!pausa); });
  zaino.addEventListener('click', openZaino);
  resume.addEventListener('click', () => setPausa(false));
  mZaino.addEventListener('click', openZaino);
  mEsci.addEventListener('click', () => setAsk(true));
  no.addEventListener('click', () => setAsk(false));
  yes.addEventListener('click', () => { setAsk(false); o.onAbort(); });
  exit.addEventListener('click', () => { aLatch = true; });
  valv.addEventListener('click', () => { aLatch = true; });
  tim.addEventListener('click', () => { aLatch = true; });
  salva.addEventListener('click', () => { if (!pausa && !asking) o.onSalva(); });
  esciL.addEventListener('click', () => { if (!pausa && !asking) o.onEsciLanterna(); });

  const kd = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || o.blocked()) return; // scheda aperta: Esc e I sono suoi (la chiudono)
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { if (asking) setAsk(false); else setPausa(!pausa); } return; }
    if (asking && (e.code === 'Enter' || e.code === 'KeyY')) { e.preventDefault(); e.stopImmediatePropagation(); setAsk(false); o.onAbort(); return; }
    if (e.code === 'KeyI') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) openZaino(); return; }
    if (e.code === 'KeyQ' || e.code === 'KeyR' || e.code === 'KeyE') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat || pausa || asking) return;
      keys.add(e.code); if (e.code === 'KeyQ') cLatch = true; else if (e.code === 'KeyE') eLatch = true; else dLatch = true;
      return;
    }
    // 1-9: la magia n-esima del menù rapido (solo mentre il menù c'è)
    const n = /^Digit([1-9])$/.exec(e.code)?.[1];
    if (n && spIds.length && sp.classList.contains('on')) {
      e.preventDefault(); e.stopImmediatePropagation();
      const id = spIds[Number(n) - 1];
      if (id && !e.repeat && !pausa && !asking) o.onMagia(id);
    }
  };
  const ku = (e: KeyboardEvent) => { keys.delete(e.code); };
  const md = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0 && !pausa && !asking && !o.blocked()) { mouseA = true; aLatch = true; } };
  const mu = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) mouseA = false; };
  const blur = () => { keys.clear(); cHeld.clear(); dHeld.clear(); eHeld.clear(); mouseA = false; aimCancel(); };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  o.canvas.addEventListener('pointerdown', md); addEventListener('pointerup', mu); addEventListener('blur', blur);

  let lastIcons = '', lanSig = '';
  return {
    get paused() { return asking || pausa; },
    sample() {
      const out = { a: aLatch || mouseA || aimHeld, c: cLatch || cHeld.size > 0 || keys.has('KeyQ'), d: dLatch || dHeld.size > 0 || keys.has('KeyR'), e: eLatch || eHeld.size > 0 || keys.has('KeyE'), m: aimHeld || aimRel ? aimM : 0 };
      aLatch = cLatch = dLatch = eLatch = aimRel = false;
      return out;
    },
    setMira(on) {
      const v = on && coarse();
      if (v === aimOn) return;
      aimOn = v; aim.classList.toggle('on', v); o.root.classList.toggle('mz-dng-aimon', v);
      if (!v) { aimId = null; aimHeld = aimRel = false; aimPaint(0, 0); }
    },
    miraDir() { const d = aimHeld ? aimDir(aimM) : null; return d ? { x: d[0], z: d[1] } : null; },
    setExit(on) { exit.classList.toggle('on', on); },
    setValvola(on) { valv.classList.toggle('on', on); },
    setTimone(on) { tim.classList.toggle('on', on); },
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
    setScarica(on, pronta) {
      E.b.classList.toggle('on-vis', on);
      E.cd.style.height = `${Math.round((1 - Math.max(0, Math.min(1, pronta))) * 10) * 10}%`;
      E.b.classList.toggle('off', pronta < 1);
    },
    setState(magia, pozioni, haMagia) {
      C.cd.style.height = `${Math.round((1 - Math.max(0, Math.min(1, magia))) * 10) * 10}%`; // a gradini del 10 %
      C.b.classList.toggle('off', !haMagia); D.b.classList.toggle('off', pozioni <= 0);
    },
    setMagie(elenco, inMano, magicka) {
      const on = inMano !== null && elenco.length > 0;
      sp.classList.toggle('on', on); C.b.classList.toggle('mano', inMano !== null);
      const sig = on ? `${inMano}|${elenco.map((m) => `${m.id}${magicka >= m.costo ? '' : '-'}`).join(',')}` : '';
      if (sig === spSig) return;
      spSig = sig; spIds = on ? elenco.map((m) => m.id) : [];
      if (!on) { sp.replaceChildren(); return; }
      sp.replaceChildren(...elenco.map((m, i) => {
        const b = btn(`${m.id === inMano ? 'cur' : ''}${magicka >= m.costo ? '' : ' no'}`.trim(), 'magia', m.icona(), el('i', '', String(i + 1)), el('b', '', `${m.costo}${m.alSecondo ? '/s' : ''}`));
        b.dataset['magia'] = m.id; b.title = `${m.nome} · ${m.costo} Magicka${m.alSecondo ? ' al secondo' : ''} (tasto ${i + 1})`; b.setAttribute('aria-label', m.nome);
        return b;
      }));
    },
    hide() { setAsk(false); setPausa(false); exit.classList.remove('on'); lanBox.classList.remove('on'); sp.classList.remove('on'); aim.classList.remove('on'); E.b.classList.remove('on-vis'); o.root.classList.remove('mz-dng-aimon'); aimOn = false; top.style.display = 'none'; lanSig = ''; },
    dispose() {
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      o.canvas.removeEventListener('pointerdown', md); removeEventListener('pointerup', mu); removeEventListener('blur', blur);
      for (const ev of ['pointerup', 'pointercancel']) removeEventListener(ev, aimUp as EventListener);
      removeEventListener('pointerdown', seen, true); o.root.classList.remove('mz-dng-aimon');
      for (const e of all) e.remove();
    },
  };
}
