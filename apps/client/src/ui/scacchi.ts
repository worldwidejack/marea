// Scacco in 3 (Tavolo del Porto): schermata del minigioco. Il Nero sta fermo, tu fai 3 mosse di fila e alla fine dev'essere matto.
// Tocchi un pezzo bianco → puntini sulle caselle dove può andare → tocchi la casella. INDIETRO annulla, DA CAPO rimette il problema.
// Regole e giudizio del matto in @marea/sim (minigames/scacchi.ts), problemi in @marea/content (scacchi.json, verificati dal test).
// Pezzi a pixel (12×12, contorno calcolato) in SVG, solo colori della palette. Niente premio in risorse: è una prova di concetto.
import { SCACCHI } from '@marea/content';
import { applyMove, inCheck, isMate, legalMoves, parseFen } from '@marea/sim';
import type { Board, ChessMove } from '@marea/sim';
import { PAL, el, injectUiStyle } from './style.ts';

export type Scacchi = { open(): void; close(): void; isOpen(): boolean };

const P = PAL;
const CSS = `
.mz-ch { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(22,63,115,.55); z-index: 28; touch-action: none; }
.mz-ch.on { display: flex; }
.mz-ch-box { width: min(420px, calc(100% - 16px)); max-height: calc(100% - 16px); overflow-y: auto; padding: 10px 10px 12px; background: rgba(46,30,20,.97); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-ch .rule { color: ${P.sabbia}; font-size: 13px; line-height: 1.3; margin: 0 0 8px; }
.mz-ch .board { display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); width: 100%; max-width: min(400px, 52vh); margin: 0 auto; aspect-ratio: 1; border: 3px solid ${P.neroCaldo}; }
.mz-ch .sq { position: relative; min-width: 0; min-height: 0; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; cursor: pointer; }
.mz-ch .sq.l { background: ${P.sabbia}; } .mz-ch .sq.d { background: ${P.legno}; }
.mz-ch .sq.last { box-shadow: inset 0 0 0 3px ${P.giallo}; }
.mz-ch .sq.sel { background: ${P.giallo}; }
.mz-ch .sq.chk { background: ${P.rosso}; }
.mz-ch .sq.mate { background: ${P.rosaNeon}; }
.mz-ch .sq svg { width: 86%; height: 86%; display: block; pointer-events: none; }
.mz-ch .sq .dot { position: absolute; width: 26%; height: 26%; background: ${P.erbaScura}; border: 2px solid ${P.neroCaldo}; pointer-events: none; }
.mz-ch .sq .dot.cap { width: 100%; height: 100%; background: transparent; border: 4px solid ${P.erbaScura}; box-sizing: border-box; }
.mz-ch .sq .co { position: absolute; font-size: 9px; font-weight: bold; opacity: .75; pointer-events: none; }
.mz-ch .sq .co.f { right: 2px; bottom: 1px; } .mz-ch .sq .co.r { left: 2px; top: 1px; }
.mz-ch .sq.l .co { color: ${P.legno}; } .mz-ch .sq.d .co { color: ${P.sabbia}; }
.mz-ch .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 0 0; min-height: 30px; font-size: 15px; font-weight: bold; }
.mz-ch .pips { display: flex; gap: 5px; flex: none; }
.mz-ch .pip { width: 18px; height: 18px; border: 2px solid ${P.legnoChiaro}; background: ${P.legnoScuro}; }
.mz-ch .pip.on { background: ${P.arancio}; border-color: ${P.neroCaldo}; }
.mz-ch .msg.win { color: ${P.giallo}; } .mz-ch .msg.lose { color: ${P.rosso}; }
.mz-ch .sol { margin-top: 8px; color: ${P.sabbiaChiara}; font-size: 13px; }
`;

// ---- pezzi a pixel: forma piena 12×12, il contorno si calcola (ogni vuoto accanto a un pieno) ----
const SHAPES: Record<string, string[]> = {
  p: ['............', '............', '............', '.....##.....', '....####....', '....####....', '.....##.....', '....####....', '.....##.....', '....####....', '...######...', '............'],
  r: ['............', '..##.##.##..', '..########..', '...######...', '...######...', '...######...', '...######...', '...######...', '..########..', '..########..', '.##########.', '............'],
  n: ['............', '....#.#.....', '....#####...', '...#######..', '..##.#####..', '.#########..', '.###..####..', '.....#####..', '....######..', '...#######..', '..#########.', '............'],
  b: ['............', '.....##.....', '....####....', '...###.##...', '...##.###...', '...######...', '....####....', '.....##.....', '....####....', '...######...', '..########..', '............'],
  q: ['............', '#..#.##.#..#', '##.######.##', '.##########.', '..########..', '...######...', '...######...', '....####....', '...######...', '..########..', '.##########.', '............'],
  k: ['.....##.....', '....####....', '.....##.....', '..##.##.##..', '.##########.', '.##########.', '..########..', '...######...', '...######...', '..########..', '.##########.', '............'],
};
const svgCache = new Map<string, string>();
function pieceSvg(p: string): string {
  let s = svgCache.get(p);
  if (s) return s;
  const white = p !== p.toLowerCase(), rows = SHAPES[p.toLowerCase()]!;
  const fill = white ? P.sabbiaChiara : P.neroCaldo, line = white ? P.neroCaldo : P.pietraChiara, shade = white ? P.pietra : P.roccia;
  const full = (x: number, y: number) => y >= 0 && y < 12 && x >= 0 && x < 12 && rows[y]![x] === '#';
  let rects = '';
  for (let y = -1; y <= 12; y++) for (let x = -1; x <= 12; x++) {
    const X = x + 1, Y = y + 1;
    if (full(x, y)) rects += `<rect x="${X}" y="${Y}" width="1" height="1" fill="${full(x + 1, y) || x >= 6 ? fill : shade}"/>`;
    else if (full(x + 1, y) || full(x - 1, y) || full(x, y + 1) || full(x, y - 1)) rects += `<rect x="${X}" y="${Y}" width="1" height="1" fill="${line}"/>`;
  }
  s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" shape-rendering="crispEdges">${rects}</svg>`;
  svgCache.set(p, s);
  return s;
}

const SAVE = 'marea.scacchi';
type Saved = { idx: number; solved: number[] };
function load(): Saved {
  try { const s = JSON.parse(localStorage.getItem(SAVE) ?? 'null') as Saved | null; if (s && typeof s.idx === 'number' && Array.isArray(s.solved)) return s; } catch { /* storage assente: si parte dal primo */ }
  return { idx: 0, solved: [] };
}
function save(s: Saved): void { try { localStorage.setItem(SAVE, JSON.stringify(s)); } catch { /* niente */ } }

export function createScacchi(o: { root: HTMLElement; onClose?: () => void }): Scacchi {
  injectUiStyle();
  if (!document.getElementById('mz-scacchi-style')) { const st = document.createElement('style'); st.id = 'mz-scacchi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const N = SCACCHI.mosse, PROBS = SCACCHI.problemi;
  const wrap = el('div', 'mz mz-ch'); wrap.id = 'mzScacchi';
  const box = el('div', 'mz-ch-box'); wrap.appendChild(box);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) wrap.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(wrap);

  const saved = load();
  let idx = Math.min(saved.idx, PROBS.length - 1), history: Board[] = [], last: ChessMove[] = [], sel = -1, fails = 0, open = false;
  const board = () => history[history.length - 1]!;
  const done = () => history.length - 1;
  const won = () => isMate(board());
  const lost = () => !won() && done() >= N;

  function reset(i = idx): void {
    if (i !== idx) fails = 0;
    idx = i; history = [parseFen(PROBS[idx]!.fen)]; last = []; sel = -1; render();
  }
  function undo(): void { if (history.length > 1 && !won()) { history.pop(); last.pop(); sel = -1; render(); } }
  function move(m: ChessMove): void {
    history.push(applyMove(board(), m)); last.push(m); sel = -1;
    if (won() && !saved.solved.includes(idx)) { saved.solved.push(idx); }
    if (won()) { saved.idx = Math.min(idx + 1, PROBS.length - 1); save(saved); }
    if (lost()) fails++;
    render();
  }
  function tap(sq: number): void {
    if (won() || lost()) return;
    const b = board(), p = b[sq]!;
    if (sel >= 0) {
      const m = legalMoves(b, true).find((x) => x.from === sel && x.to === sq);
      if (m) { move(m); return; }
    }
    sel = p !== '.' && p === p.toUpperCase() && sel !== sq ? sq : -1;
    render();
  }

  function render(): void {
    const b = board(), win = won(), lose = lost();
    const targets = sel >= 0 ? legalMoves(b, true).filter((m) => m.from === sel).map((m) => m.to) : [];
    const lm = last[last.length - 1], kb = b.indexOf('k'), chk = inCheck(b, false);
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi'); x.addEventListener('click', () => close());
    const head = el('div', 'mz-head');
    head.append(el('div', 'mz-title', `${SCACCHI.nome} · ${idx + 1}/${PROBS.length}`), x);
    const rule = el('p', 'rule', `Il Nero non si muove. Fai ${N} mosse di fila col Bianco: alla fine il Re nero dev'essere in scacco matto.`);
    const grid = el('div', 'board');
    for (let sq = 0; sq < 64; sq++) {
      const r = Math.floor(sq / 8), f = sq % 8;
      const c = el('button', `sq ${(r + f) % 2 ? 'd' : 'l'}`); c.type = 'button'; c.dataset['sq'] = String(sq);
      if (lm && (lm.from === sq || lm.to === sq)) c.classList.add('last');
      if (sq === sel) c.classList.add('sel');
      if (sq === kb && chk) c.classList.add(win ? 'mate' : 'chk');
      const p = b[sq]!;
      if (p !== '.') c.insertAdjacentHTML('beforeend', pieceSvg(p)); // SVG statico generato qui
      if (targets.includes(sq)) c.appendChild(el('span', p !== '.' ? 'dot cap' : 'dot'));
      if (r === 7) c.appendChild(el('span', 'co f', 'abcdefgh'[f]!));
      if (f === 0) c.appendChild(el('span', 'co r', String(8 - r)));
      c.addEventListener('click', () => tap(sq));
      grid.appendChild(c);
    }
    const status = el('div', 'status');
    const pips = el('div', 'pips');
    for (let i = 0; i < N; i++) pips.appendChild(el('span', i < done() ? 'pip on' : 'pip'));
    const msg = win ? el('span', 'msg win', done() < N ? `MATTO in ${done()}!` : 'SCACCO MATTO!')
      : lose ? el('span', 'msg lose', chk ? 'Scacco, ma il Re si salva' : 'Niente matto')
      : el('span', 'msg', sel >= 0 ? 'Dove lo muovi?' : done() === 0 ? 'Tocca un pezzo bianco' : `Mossa ${done() + 1} di ${N}`);
    status.append(msg, pips);
    const row = el('div', 'mz-row');
    const btn = (txt: string, cls: string, act: string, fn: () => void, disabled = false) => { const e = el('button', 'mz-btn ' + cls, txt); e.type = 'button'; e.dataset['act'] = act; e.disabled = disabled; e.addEventListener('click', fn); return e; };
    if (win) {
      const lastOne = idx >= PROBS.length - 1;
      row.append(btn('DA CAPO', 'ghost', 'dacapo', () => reset()), lastOne ? btn('FINITI! ★', 'green', 'chiudi', () => close()) : btn('PROSSIMO ▶', 'green', 'prossimo', () => reset(idx + 1)));
    } else if (lose) {
      row.append(btn('INDIETRO', 'ghost', 'indietro', undo), btn('RIPROVA', '', 'riprova', () => reset()));
    } else {
      row.append(btn('INDIETRO', 'ghost', 'indietro', undo, done() === 0), btn('DA CAPO', 'ghost', 'dacapo', () => reset(), done() === 0));
    }
    const parts: Node[] = [head, rule, grid, status, row];
    if (fails >= 2 && !win) parts.push(el('div', 'sol', `Soluzione: ${PROBS[idx]!.soluzione}`));
    if (win && idx >= PROBS.length - 1) parts.push(el('div', 'sol', `Problemi risolti: ${saved.solved.length}/${PROBS.length}`));
    box.replaceChildren(...parts);
  }

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(); }
    else if (e.code === 'Backspace' || e.code === 'KeyZ') { e.preventDefault(); undo(); }
    else if (e.code === 'KeyR') { e.preventDefault(); reset(); }
    else if (e.code === 'Enter' && won() && idx < PROBS.length - 1) { e.preventDefault(); reset(idx + 1); }
  };
  function close(): void {
    if (!open) return;
    open = false; wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    o.onClose?.();
  }
  return {
    open() {
      if (open) return;
      open = true; reset(!history.length || won() ? Math.min(saved.idx, PROBS.length - 1) : idx); // si riprende da dove eri
      wrap.classList.add('on'); addEventListener('keydown', onKey, true);
    },
    close,
    isOpen: () => open,
  };
}
