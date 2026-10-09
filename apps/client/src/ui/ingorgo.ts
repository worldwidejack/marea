// Ingorgo al porto: schermata del minigioco (gioco a schermo, scaricato con import() alla prima partita: minigiochi.ts → registraSchermo).
// Griglia 6×6 vista dall'alto, barchette a pixel ormeggiate; trascini una barca lungo il suo verso (o la tocchi dalla parte dove vuoi che
// vada: un passo). La rossa esce dal varco a destra. Fa girare la sim `ingorgo` a 60 Hz (accumulatore suo), registra un InputFrame
// quantizzato per tick e alla fine restituisce packInputs(frames): il punteggio lo decide il server. Esc = ritirati, R = ricomincia.
// Solo colori della palette; barche disegnate a pixel in SVG.
import { MINIGAMES_CFG } from '@marea/content';
import { LATO, RICOMINCIA, RIGA_USCITA, createRng, getMinigame, limiti, mossaFrame, packInputs, quantize } from '@marea/sim';
import type { Difficulty, IngorgoView, InputFrame, MinigameModule, Mossa, PackedInputs } from '@marea/sim';
import type { SchermoGioco } from '../game/minigiochi.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const P = PAL;
const CFG = MINIGAMES_CFG.ingorgo;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const INTRO = 50, END_HOLD = 96; // tick: un attimo prima di partire; esito a schermo prima di chiudere
/** Margine della cornice di legno, in % del lato della griglia (la griglia d'acqua sta dentro). */
const BORDO = 6;
const IN = 100 - 2 * BORDO;

// acqua a pixel: una piastrella per cella, con la riga della griglia in alto e a sinistra e due increspature
const ACQUA = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="${P.acqua}"/><rect width="16" height="1" fill="${P.acquaProfonda}"/><rect width="1" height="16" fill="${P.acquaProfonda}"/><rect x="4" y="5" width="3" height="1" fill="${P.acquaBassa}"/><rect x="10" y="11" width="3" height="1" fill="${P.acquaBassa}"/></svg>`)}")`;

const CSS = `
.mz-ig { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(22,63,115,.6); z-index: 28; touch-action: none; }
.mz-ig.on { display: flex; }
.mz-ig-box { width: min(440px, calc(100% - 16px)); max-height: calc(100% - 16px); overflow-y: auto; padding: 10px 10px 12px; background: rgba(46,30,20,.97); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-ig .rule { color: ${P.sabbia}; font-size: 13px; line-height: 1.3; margin: 0 0 8px; }
.mz-ig .rule b { color: ${P.rosso}; }
.mz-ig .time { height: 10px; background: ${P.legnoScuro}; border: 2px solid ${P.neroCaldo}; margin-bottom: 10px; }
.mz-ig .time i { display: block; height: 100%; background: ${P.arancio}; }
.mz-ig .time.low i { background: ${P.rosso}; }
.mz-ig-board { position: relative; width: 100%; max-width: min(420px, 58vh); margin: 0 auto; aspect-ratio: 1; background: ${P.legno}; border: 3px solid ${P.neroCaldo}; box-shadow: 0 4px 0 ${P.neroCaldo}; overflow: hidden; touch-action: none; }
.mz-ig-board .plank { position: absolute; background: ${P.legnoScuro}; }
.mz-ig-water { position: absolute; left: ${BORDO}%; top: ${BORDO}%; width: ${IN}%; height: ${IN}%; background-color: ${P.acqua}; background-image: ${ACQUA}; background-size: calc(100% / ${LATO}) calc(100% / ${LATO}); image-rendering: pixelated; box-shadow: inset 0 0 0 2px ${P.neroCaldo}; }
.mz-ig-exit { position: absolute; right: 0; width: ${BORDO + 1}%; top: ${BORDO + (IN * RIGA_USCITA) / LATO}%; height: ${IN / LATO}%; background: ${P.acqua}; display: flex; align-items: center; justify-content: center; }
.mz-ig-exit svg { width: 70%; height: 60%; display: block; }
.mz-ig-b { position: absolute; padding: 0; margin: 0; border: 0; background: none; cursor: grab; touch-action: none; }
.mz-ig-b svg { position: absolute; display: block; pointer-events: none; image-rendering: pixelated; }
.mz-ig-b.h svg { left: 3%; top: 8%; width: 94%; height: 84%; }
.mz-ig-b.v svg { left: 8%; top: 3%; width: 84%; height: 94%; }
.mz-ig-b.drag { cursor: grabbing; z-index: 2; filter: drop-shadow(0 3px 0 ${P.neroCaldo}); }
.mz-ig-b.can::after { content: ''; position: absolute; inset: 2px; border: 2px dashed ${P.sabbiaChiara}; opacity: 0; pointer-events: none; }
.mz-ig-b.can:hover::after { opacity: .55; }
.mz-ig .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 0 0; min-height: 30px; font-size: 16px; font-weight: bold; }
.mz-ig .status small { color: ${P.sabbia}; font-size: 12px; }
.mz-ig .pips { display: flex; gap: 4px; }
.mz-ig .pip { width: 14px; height: 14px; border: 2px solid ${P.legnoChiaro}; background: ${P.legnoScuro}; }
.mz-ig .pip.on { background: ${P.giallo}; border-color: ${P.neroCaldo}; }
.mz-ig .msg.go { color: ${P.giallo}; } .mz-ig .msg.bad { color: ${P.rosso}; }
.mz-ig .row2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
.mz-ig .row2 .mz-btn { width: auto; margin: 0; min-height: 44px; padding: 0 14px; }
.mz-ig .goal { color: ${P.sabbia}; font-size: 12px; text-align: right; }
`;

// ---------- barche a pixel: scafo con prua a punta, contorno nero caldo, cabina; colori dalla palette ----------
/** [scafo, riga chiara] per le barche degli altri (la tua è rossa). */
const COLORI: [string, string][] = [
  [P.acquaProfonda, P.acquaBassa], [P.erbaScura, P.erba], [P.abisso, P.acquaProfonda], [P.viola, P.rosaNeon], [P.legno, P.legnoChiaro],
  [P.pietraScura, P.pietra], [P.bosco, P.erbaScura], [P.legnoChiaro, P.sabbia], [P.roccia, P.pietraScura],
];
const svgCache = new Map<string, string>();
function boatSvg(len: number, h: boolean, scafo: string, chiaro: string, mia: boolean): string {
  const key = `${len}${h}${scafo}${mia}`;
  const hit = svgCache.get(key);
  if (hit) return hit;
  const W = 8 * len, H = 8;
  const inside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    if (x === 0) return y >= 1 && y <= 6; // poppa arrotondata
    if (x === W - 3) return y >= 1 && y <= 6;
    if (x === W - 2) return y >= 2 && y <= 5; // prua a punta
    if (x === W - 1) return y >= 3 && y <= 4;
    return true;
  };
  const art: (string | null)[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => null));
  const cab0 = Math.floor(W / 2) - (len === 3 ? 5 : 3), cab1 = cab0 + (len === 3 ? 8 : 5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    let c = edge ? P.neroCaldo : y === 1 ? chiaro : scafo;
    if (!edge && x >= cab0 && x <= cab1 && y >= 2 && y <= 5) c = x === cab1 || y === 5 ? P.legnoScuro : P.sabbiaChiara; // cabina con l'ombra
    if (!edge && x === cab0 + 1 && y === 3) c = P.acquaProfonda; // oblò
    if (mia && !edge && x === 2 && (y === 2 || y === 3)) c = P.giallo; // bandierina sulla tua
    art[y]![x] = c;
  }
  // verticale = trasposta, con la prua in alto
  const px = h ? art : Array.from({ length: W }, (_, yv) => Array.from({ length: H }, (_, xv) => art[xv]![W - 1 - yv] ?? null));
  const w = h ? W : H, hh = h ? H : W;
  let rects = '';
  px.forEach((row, y) => row.forEach((c, x) => { if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
  svgCache.set(key, svg);
  return svg;
}
const ARROW = `<svg viewBox="0 0 8 7" shape-rendering="crispEdges"><path d="M0 2h4V0l4 3.5L4 7V5H0z" fill="${P.giallo}" stroke="${P.neroCaldo}" stroke-width=".6"/></svg>`;

export function createIngorgo(o: { root: HTMLElement }): SchermoGioco {
  injectUiStyle();
  if (!document.getElementById('mz-ingorgo-style')) { const st = document.createElement('style'); st.id = 'mz-ingorgo-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mod = getMinigame('ingorgo') as MinigameModule<unknown>;
  const wrap = el('div', 'mz mz-ig'); wrap.id = 'mzIngorgo';
  const box = el('div', 'mz-ig-box'); wrap.appendChild(box);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) wrap.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(wrap);

  // ---- scheletro fisso: si aggiornano solo posizioni e testi ----
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const head = el('div', 'mz-head'); const title = el('div', 'mz-title', CFG.nome); head.append(title, x);
  const rule = el('p', 'rule');
  rule.append('Trascina le barche avanti e indietro: libera la ', el('b', '', 'barca rossa'), ' e falla uscire dal varco a destra.');
  const time = el('div', 'time'); const bar = document.createElement('i'); time.appendChild(bar);
  const board = el('div', 'mz-ig-board');
  for (const [l, t, w, h] of [[0, 33, 100, 1.2], [0, 66, 100, 1.2], [33, 0, 1.2, 100], [66, 0, 1.2, 100]] as const) {
    const p = el('i', 'plank'); Object.assign(p.style, { left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }); board.appendChild(p); // assi della cornice
  }
  const water = el('div', 'mz-ig-water'); board.appendChild(water);
  const exit = el('div', 'mz-ig-exit'); exit.insertAdjacentHTML('beforeend', ARROW); board.appendChild(exit);
  const msg = el('span', 'msg'); const pips = el('div', 'pips');
  const status = el('div', 'status'); status.append(msg, pips);
  const again = el('button', 'mz-btn ghost', 'RICOMINCIA'); again.type = 'button'; again.dataset['act'] = 'ricomincia';
  const goal = el('div', 'goal', `Bronzo ${CFG.medaglie.bronzo} · Argento ${CFG.medaglie.argento} · Oro ${CFG.medaglie.oro} ingorghi`);
  const row2 = el('div', 'row2'); row2.append(again, goal);
  box.append(head, rule, time, board, status, row2);

  type Game = { s: unknown; frames: InputFrame[]; queue: Mossa[]; reset: boolean; prevA: boolean; prevB: boolean; intro: number; end: number; finish(v: PackedInputs | null): void };
  let g: Game | null = null, open = false, auto = false, raf = 0, last = 0, acc = 0, view: IngorgoView | null = null, idxDrawn = -1;
  let els: HTMLButtonElement[] = [];
  let drag: { i: number; h: boolean; start: number; cell: number; lo: number; hi: number; off: number; along: number; len: number; pid: number } | null = null;
  const autoRng = createRng('ingorgo-auto');

  /** Barche (ri)costruite a ogni ingorgo nuovo: un bottone per barca, SVG a pixel dentro. */
  function build(v: IngorgoView): void {
    for (const e of els) e.remove();
    els = v.barche.map((b, i) => {
      const e = el('button', `mz-ig-b ${b.h ? 'h' : 'v'}`) as HTMLButtonElement; e.type = 'button'; e.dataset['barca'] = String(i);
      e.setAttribute('aria-label', i === 0 ? 'La tua barca' : `Barca ${i}`);
      const [scafo, chiaro] = i === 0 ? [P.rosso, P.arancio] : COLORI[(i - 1) % COLORI.length]!;
      e.insertAdjacentHTML('beforeend', boatSvg(b.len, b.h, scafo, chiaro, i === 0)); // SVG generato qui, nessun dato esterno
      e.addEventListener('pointerdown', (ev) => grab(ev, i));
      water.appendChild(e);
      return e;
    });
    idxDrawn = v.idx;
  }
  const pending = (i: number) => g?.queue.reduce((a, m) => a + (m.barca === i ? m.delta : 0), 0) ?? 0;
  function grab(ev: PointerEvent, i: number): void {
    ev.preventDefault();
    if (!g || !view || auto || g.end >= 0 || g.intro > 0 || view.uscita >= 0 || g.queue.length) return;
    const b = view.barche[i]!, [lo, hi] = limiti(view.barche, i);
    const r = water.getBoundingClientRect(), cell = (b.h ? r.width : r.height) / LATO;
    const p0 = b.h ? r.left + b.x * cell : r.top + b.y * cell;
    drag = { i, h: b.h, start: b.h ? ev.clientX : ev.clientY, cell, lo, hi, off: 0, along: (b.h ? ev.clientX : ev.clientY) - p0, len: b.len, pid: ev.pointerId };
    try { (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* niente */ }
    els[i]?.classList.add('drag');
  }
  const onMove = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.pid) return;
    const d = ((drag.h ? ev.clientX : ev.clientY) - drag.start) / drag.cell;
    drag.off = Math.max(drag.lo, Math.min(drag.hi, d));
  };
  const onUp = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.pid) return;
    const d = drag, moved = Math.abs(((d.h ? ev.clientX : ev.clientY) - d.start) / d.cell);
    let delta = Math.round(d.off);
    if (moved < 0.2) { const dir = d.along > (d.len * d.cell) / 2 ? 1 : -1; delta = dir > 0 ? Math.min(1, d.hi) : Math.max(-1, d.lo); } // tocco: un passo da quella parte
    els[d.i]?.classList.remove('drag');
    drag = null;
    if (delta !== 0 && g) g.queue.push({ barca: d.i, delta });
  };
  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);
  again.addEventListener('click', () => { if (g && !auto && g.end < 0) { g.queue.length = 0; g.reset = true; } });
  x.addEventListener('click', () => close(null));
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(null); }
    else if (e.code === 'KeyR' && !e.repeat) { e.preventDefault(); again.click(); }
  };

  function tick(): void {
    if (!g) return;
    if (g.intro > 0) { g.intro--; return; }
    if (g.end >= 0) { if (++g.end >= END_HOLD) close(packInputs(g.frames)); return; }
    let f: InputFrame = NO;
    if (auto) f = mod.autopilot(g.s, autoRng);
    else if (g.reset && !g.prevB) { f = RICOMINCIA; g.reset = false; }
    else if (!g.prevA && !g.prevB && g.queue.length) { const m = g.queue.shift()!; f = mossaFrame(m.barca, m.delta); }
    f = quantize(f); g.prevA = f.a; g.prevB = f.b;
    g.frames.push(f); mod.step(g.s, f);
    if (mod.result(g.s).done) g.end = 0;
  }
  function render(): void {
    if (!g) return;
    const v = view = mod.view(g.s) as IngorgoView;
    if (v.idx !== idxDrawn) build(v);
    title.textContent = `${CFG.nome} · ${Math.min(v.totale, v.idx + 1)}/${v.totale}`;
    bar.style.width = `${Math.max(0, 100 - (v.ms / v.maxMs) * 100)}%`;
    time.classList.toggle('low', v.maxMs - v.ms < 15_000);
    const fuori = v.uscita >= 0 ? v.uscita : v.done && !v.timeUp ? Math.min(1, (g.end + 1) / 40) : -1; // la rossa scivola fuori dal varco
    v.barche.forEach((b, i) => {
      const e = els[i]; if (!e) return;
      let px = b.x, py = b.y;
      const extra = drag?.i === i ? drag.off : pending(i);
      if (b.h) px += extra; else py += extra;
      if (i === 0 && fuori >= 0) px += fuori * 3;
      e.style.left = `${(px / LATO) * 100}%`; e.style.top = `${(py / LATO) * 100}%`;
      e.style.width = `${((b.h ? b.len : 1) / LATO) * 100}%`; e.style.height = `${((b.h ? 1 : b.len) / LATO) * 100}%`;
      const [lo, hi] = limiti(v.barche, i);
      e.classList.toggle('can', lo < 0 || hi > 0);
    });
    const [txt, cls] = g.intro > 0 ? ['Pronti…', ''] : v.done ? (v.timeUp ? ['Tempo!', 'bad'] : ['Tutti liberi!', 'go'])
      : v.uscita >= 0 ? ['Libera! Il prossimo…', 'go'] : [`Mosse ${v.mosse}`, ''];
    if (msg.dataset['t'] !== txt) {
      msg.dataset['t'] = txt; msg.className = 'msg ' + cls; msg.textContent = txt;
      if (!v.done && v.uscita < 0 && g.intro <= 0) msg.appendChild(el('small', '', ` · minimo ${v.ottimo}`));
    }
    if (pips.childElementCount !== v.totale || pips.dataset['n'] !== String(v.risolti)) {
      pips.dataset['n'] = String(v.risolti);
      pips.replaceChildren(...Array.from({ length: v.totale }, (_, i) => el('span', i < v.risolti ? 'pip on' : 'pip')));
    }
  }
  function loop(now: number): void {
    if (!open) return;
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); last = now; // il primo rAF può avere un orario prima di run()
    if (auto) for (let i = 0; i < 120 && open; i++) tick(); // test: una partita intera in pochi secondi
    else { acc += dt; while (acc >= 1 / 60 && open) { acc -= 1 / 60; tick(); } }
    if (open) { render(); raf = requestAnimationFrame(loop); }
  }
  function close(v: PackedInputs | null): void {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    if (drag) { els[drag.i]?.classList.remove('drag'); drag = null; }
    const done = g; g = null; done?.finish(v);
  }

  registerStateProvider('ingorgo', () => ({
    open, auto, view,
    /** Mosse possibili adesso (per i test che trascinano davvero una barca). */
    possibili: view && g ? view.barche.flatMap((_, i) => { const [lo, hi] = limiti(view!.barche, i); return [...(lo < 0 ? [{ barca: i, delta: lo }] : []), ...(hi > 0 ? [{ barca: i, delta: hi }] : [])]; }) : [],
    frames: g?.frames.length ?? 0,
  }));
  registerTestHook('ingorgoAuto', (on) => { auto = on !== false; return auto; });

  return {
    run({ seed, difficulty }) {
      if (open) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      return new Promise((finish) => {
        g = { s: mod.create({ seed, difficulty: d }), frames: [], queue: [], reset: false, prevA: false, prevB: false, intro: auto ? 0 : INTRO, end: -1, finish };
        open = true; acc = 0; last = performance.now(); view = null; idxDrawn = -1;
        wrap.classList.add('on'); addEventListener('keydown', onKey, true);
        render(); raf = requestAnimationFrame(loop);
      });
    },
    isOpen: () => open,
    esito: (d) => `${Number(d['risolti'] ?? 0)}/${Number(d['totale'] ?? 3)} ingorghi · ${Number(d['mosse'] ?? 0)} mosse`,
  };
}

