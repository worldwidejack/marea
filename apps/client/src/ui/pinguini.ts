// Pinguini sul ghiaccio: la schermata del minigioco dell'Isola dei Ghiacci (gioco a schermo, scaricato con import() alla prima partita:
// minigiochi.ts → registraSchermo). Lastra a pixel vista dall'alto sotto l'aurora: trascini un pinguino (o lo tocchi e poi tocchi dove
// vuoi mandarlo) e scivola finché non sbatte; nelle buche di pesca si tuffa. Tastiera: frecce/WASD muovono il pinguino scelto, Tab o
// 1-2-3 lo cambiano, R ricomincia, Esc ritira. Fa girare la sim `pinguini` a 60 Hz (accumulatore suo), registra un InputFrame
// quantizzato per tick e alla fine restituisce packInputs(frames): il punteggio lo decide il server. Solo colori della palette.
import { MINIGAMES_CFG } from '@marea/content';
import { PG_DIR, PG_RICOMINCIA, createRng, getMinigame, packInputs, pgMossaFrame, quantize, risolviPinguini, scivola } from '@marea/sim';
import type { Difficulty, InputFrame, MinigameModule, PackedInputs, PinguiniState, PinguiniView } from '@marea/sim';
import type { SchermoGioco } from '../game/minigiochi.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { RGBA, createTela, dith, hash2, tri } from './tela.ts';
import type { Col } from './tela.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';

const P = PAL;
const CFG = MINIGAMES_CFG.pinguini;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const INTRO = 40, END_HOLD = 100; // tick: un attimo prima di partire; esito a schermo prima di chiudere
/** Tela: cielo con l'aurora in alto, la lastra (C px per cella) che galleggia sul mare scuro. */
const C = 18, L = CFG.lato, BX = 12, BY = 38, W = BX * 2 + C * L, H = BY + C * L + 12;
/** Tick per cella di scivolata e per il tuffo (solo animazione). */
const TPC = 3, TUFFO = 14;
const KEYDIR: Record<string, number> = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

const CSS = `
.mz-pg { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(22,63,115,.6); z-index: 28; touch-action: none; }
.mz-pg.on { display: flex; }
.mz-pg-box { width: min(440px, calc(100% - 12px)); max-height: calc(100% - 12px); overflow-y: auto; padding: 8px 8px 10px; background: rgba(46,30,20,.97); border: 3px solid ${P.acquaBassa}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-pg .mz-head { margin-bottom: 4px; }
.mz-pg .rule { color: ${P.sabbia}; font-size: 13px; line-height: 1.3; margin: 0 0 6px; }
.mz-pg .rule b { color: ${P.acquaBassa}; }
.mz-pg .time { height: 10px; background: ${P.legnoScuro}; border: 2px solid ${P.neroCaldo}; margin-bottom: 6px; }
.mz-pg .time i { display: block; height: 100%; background: ${P.acquaBassa}; }
.mz-pg .time.low i { background: ${P.rosso}; }
.mz-pg .scena { position: relative; border: 3px solid ${P.neroCaldo}; line-height: 0; max-width: min(100%, 52vh); margin: 0 auto; }
.mz-pg canvas { width: 100%; height: auto; aspect-ratio: ${W} / ${H}; image-rendering: pixelated; display: block; touch-action: none; cursor: pointer; }
.mz-pg .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 0; min-height: 30px; font-size: 16px; font-weight: bold; }
.mz-pg .status small { color: ${P.sabbia}; font-size: 12px; }
.mz-pg .pips { display: flex; gap: 4px; }
.mz-pg .pip { width: 14px; height: 14px; border: 2px solid ${P.legnoChiaro}; background: ${P.legnoScuro}; }
.mz-pg .pip.on { background: ${P.acquaBassa}; border-color: ${P.neroCaldo}; }
.mz-pg .msg.go { color: ${P.giallo}; } .mz-pg .msg.bad { color: ${P.rosso}; }
.mz-pg .row2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
.mz-pg .row2 .mz-btn { width: auto; margin: 0; min-height: 44px; padding: 0 14px; }
.mz-pg .goal { color: ${P.sabbia}; font-size: 12px; text-align: right; }
`;

// ---------- sprite ----------
const MAPPA: Record<string, Col> = { n: 'neroCaldo', w: 'pietraChiara', O: 'arancio', Y: 'giallo', q: 'pietra', R: 'rosso', V: 'viola', G: 'erba' };
/** Il pinguino (12×13, di fronte); 's' = la sciarpa, del suo colore. */
const PINGUINO = [
  '....nnnn....', '...nnnnnn...', '..nnwnnwnn..', '..nnnOOnnn..', '..ssssssss..', '.nnwwwwwssn.', 'nnnwwwwwwsnn',
  'nnwwwwwwwwnn', 'nnwwwwwwwwnn', '.nwwwwwwwwn.', '.nnwwwwwwnn.', '..nnnnnnnn..', '..OO....OO..',
];
/** A pancia in giù mentre scivola (14×9), verso destra. */
const SCIVOLA = ['.....nnnnnn...', '...nnnnnnnnsn.', '.nnnnnnnnnsnwn', 'nnwwwwwwwwsnnO', 'Onwwwwwwwwsnn.', 'O.nnwwwwwnn...', '....nn..nn....'];
const SCIARPA: Col[] = ['rosso', 'giallo', 'viola'];
const PESCE = ['.OO.Y', 'OOOOY', '.OO.Y'];

export function createPinguini(o: { root: HTMLElement }): SchermoGioco {
  injectUiStyle();
  if (!document.getElementById('mz-pinguini-style')) { const st = document.createElement('style'); st.id = 'mz-pinguini-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mod = getMinigame('pinguini') as MinigameModule<PinguiniState>;
  const wrap = el('div', 'mz mz-pg'); wrap.id = 'mzPinguini';
  const box = el('div', 'mz-pg-box'); wrap.appendChild(box);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) wrap.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(wrap);

  // ---- scheletro fisso ----
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const head = el('div', 'mz-head'); const title = el('div', 'mz-title', CFG.nome); head.append(title, x);
  const rule = el('p', 'rule');
  rule.append(el('b', '', 'Trascina un pinguino'), ': scivola finché non sbatte. Portali tutti nelle buche di pesca!');
  const time = el('div', 'time'); const bar = document.createElement('i'); time.appendChild(bar);
  const scena = el('div', 'scena');
  const cv = document.createElement('canvas'); scena.appendChild(cv);
  const tela = createTela(cv, W, H);
  const msg = el('span', 'msg'); const pips = el('div', 'pips');
  const status = el('div', 'status'); status.append(msg, pips);
  const again = el('button', 'mz-btn ghost', 'RICOMINCIA'); again.type = 'button'; again.dataset['act'] = 'ricomincia';
  const goal = el('div', 'goal', `Bronzo ${CFG.medaglie.bronzo} · Argento ${CFG.medaglie.argento} · Oro ${CFG.medaglie.oro} livelli`);
  const row2 = el('div', 'row2'); row2.append(again, goal);
  box.append(head, rule, time, scena, status, row2);

  type Game = {
    s: PinguiniState; frames: InputFrame[]; queue: { p: number; dir: number }[]; reset: boolean; prevA: boolean; prevB: boolean;
    intro: number; end: number; sel: number; finish(v: PackedInputs | null): void;
    /** Pinguini tuffati: in che buca (per le teste che spuntano). */
    tuffi: Map<number, number>; idx: number; sbuffi: { x: number; y: number; t: number; acqua: boolean }[]; ultimaVista: number;
    /** Nessuna soluzione da qui (si ricalcola quando cambiano i pinguini): si suggerisce RICOMINCIA. */
    chiave: string; bloccato: boolean;
  };
  let g: Game | null = null, open = false, auto = false, raf = 0, last = 0, acc = 0, tAnim = 0, view: PinguiniView | null = null;
  const autoRng = createRng('pinguini-auto');

  /** Il pinguino si sta ancora muovendo (animazione dell'ultima mossa)? */
  const anim = (v: PinguiniView) => !!v.ultima && v.tick - v.ultima.tick < v.ultima.passi * TPC + (v.ultima.tuffo ? TUFFO : 2);
  const vivi = (v: PinguiniView) => v.pos.map((c, i) => (c >= 0 ? i : -1)).filter((i) => i >= 0);
  /** Pixel della tela dal puntatore. */
  const sul = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  const centro = (c: number) => ({ x: BX + (c % L) * C + C / 2, y: BY + Math.floor(c / L) * C + C / 2 });
  /** Il pinguino vivo più vicino al punto (entro ¾ di cella; lo sprite sporge in su: si guarda un po' più in alto). */
  function pinguinoA(px: number, py: number): number {
    if (!view) return -1;
    let best = -1, bd = C * 0.8;
    for (const i of vivi(view)) { const q = centro(view.pos[i]!), d = Math.hypot(q.x - px, q.y - 3 - py); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  const libero = () => !!g && !!view && !auto && g.end < 0 && g.intro <= 0 && view.festa < 0 && !g.queue.length;
  function manda(p: number, dir: number): void {
    if (!g || !view || !libero()) return;
    g.sel = p;
    if (!scivola({ lato: L, muro: view.muro, buca: view.buca }, view.pos, p, dir)) { suona('vuoto'); return; }
    g.queue.push({ p, dir });
  }
  /** Direzione (0 su, 1 destra, 2 giù, 3 sinistra) dello spostamento, sull'asse più lungo. */
  const dirVerso = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);

  // ---- input: trascina un pinguino; oppure tocca un pinguino (lo scegli) e poi tocca dove mandarlo ----
  let drag: { p: number; x: number; y: number; pid: number; fatto: boolean } | null = null;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!g || !view || !libero()) return;
    const q = sul(e), p = pinguinoA(q.x, q.y);
    if (p >= 0) { drag = { p, x: q.x, y: q.y, pid: e.pointerId, fatto: false }; try { cv.setPointerCapture(e.pointerId); } catch { /* niente */ } return; }
    // tocco sul ghiaccio: il pinguino scelto va da quella parte
    const sel = view.pos[g.sel] !== undefined && view.pos[g.sel]! >= 0 ? g.sel : vivi(view)[0] ?? -1;
    if (sel < 0) return;
    const c = centro(view.pos[sel]!);
    if (Math.hypot(q.x - c.x, q.y - c.y) > C * 0.6) manda(sel, dirVerso(q.x - c.x, q.y - c.y));
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid || drag.fatto) return;
    const q = sul(e), dx = q.x - drag.x, dy = q.y - drag.y;
    if (Math.hypot(dx, dy) > C * 0.4) { drag.fatto = true; manda(drag.p, dirVerso(dx, dy)); }
  });
  const su = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.fatto && g) { g.sel = drag.p; suona('click'); }
    drag = null;
  };
  cv.addEventListener('pointerup', su); cv.addEventListener('pointercancel', su);
  again.addEventListener('click', () => { if (g && !auto && g.end < 0 && view && view.festa < 0) { g.queue.length = 0; g.reset = true; } });
  x.addEventListener('click', () => close(null));
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(null); return; }
    if (e.repeat) return;
    if (e.code === 'KeyR') { e.preventDefault(); again.click(); return; }
    if (!g || !view) return;
    const vv = vivi(view);
    if (e.code === 'Tab' || e.code === 'Space') { e.preventDefault(); const k = vv.indexOf(g.sel); g.sel = vv[(k + 1) % vv.length] ?? 0; suona('click'); return; }
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (n >= 0 && vv.includes(n)) { e.preventDefault(); g.sel = n; suona('click'); return; }
    const d = KEYDIR[e.code];
    if (d !== undefined) { e.preventDefault(); if (!vv.includes(g.sel)) g.sel = vv[0] ?? 0; manda(g.sel, d); }
  };

  function tick(): void {
    if (!g) return;
    if (g.intro > 0) { g.intro--; return; }
    if (g.end >= 0) { if (++g.end >= END_HOLD) close(packInputs(g.frames)); return; }
    let f: InputFrame = NO;
    const v = mod.view(g.s) as PinguiniView;
    if (auto) f = mod.autopilot(g.s, autoRng);
    else if (g.reset && !g.prevB) { f = PG_RICOMINCIA; g.reset = false; g.tuffi.clear(); }
    else if (!g.prevA && !g.prevB && g.queue.length && !anim(v)) { const m = g.queue.shift()!; f = pgMossaFrame(m.p, m.dir); }
    f = quantize(f); g.prevA = f.a; g.prevB = f.b;
    const prima = g.s.esiti.length;
    g.frames.push(f); mod.step(g.s, f);
    const u = g.s.ultima;
    if (u && u.tick === g.s.tick) {
      suona('remata');
      if (u.tuffo) g.tuffi.set(u.p, u.a);
    }
    if (g.s.esiti.length > prima) suona(g.s.done ? 'arrivo' : 'pesce');
    if (mod.result(g.s).done) g.end = 0;
  }

  // ---------- disegno ----------
  function disegna(v: PinguiniView, t: number, alpha: number): void {
    const { px, rect, disco, spr, buf } = tela;
    const festa = v.festa >= 0 || (v.done && !v.timeUp);
    // cielo notturno con l'aurora (tende che ondeggiano), stelle, montagne di ghiaccio lontane
    for (let xx = 0; xx < W; xx++) {
      // tenda dell'aurora: bordo in alto che ondeggia, raggi verticali di lunghezza diversa che sfumano a puntini verso il basso
      const top = 3 + tri(xx / 29 + t * 0.08) * 2.5 + tri(xx / 8 - t * 0.22) * 1.2;
      const raggio = (festa ? 16 : 11) + Math.max(0, tri(xx / 6.5 + t * 0.35)) * 7 - (hash2(xx, 1) % 3 === 0 ? 4 : 0);
      for (let y = 0; y < 30; y++) {
        let c: number = y < 18 ? RGBA.abisso : dith(xx, y, (y - 18) / 12) ? RGBA.acquaProfonda : RGBA.abisso;
        if (y < 16 && hash2(xx, y) % 89 === 0) c = Math.floor(t * 2 + xx) % 5 ? RGBA.pietraChiara : RGBA.acquaBassa; // stelle
        const k = (y - top) / raggio;
        if (k >= 0 && k < 1) {
          if (k < 0.12) c = RGBA.acquaBassa;
          else if (k < 0.5) c = dith(xx, y, 1.05 - k) ? RGBA.erba : RGBA.erbaScura;
          else if (dith(xx, y, (1 - k) * 1.3)) c = k < 0.75 ? RGBA.erbaScura : xx % 2 ? RGBA.viola : RGBA.bosco;
        }
        buf[y * W + xx] = c;
      }
    }
    for (let xx = 0; xx < W; xx++) {
      const h = Math.max(0, Math.round(5 + tri(xx / 17) * 3 + tri(xx / 7 + 0.4) * 1.5));
      for (let k = 0; k < h; k++) px(xx, 30 - k, k === h - 1 ? RGBA.pietraChiara : xx % 17 < 8 ? RGBA.pietra : RGBA.pietraScura);
    }
    // igloo lontano
    for (const [ix, iy] of [[22, 25], [104, 26]] as const) { disco(ix, iy, 4, RGBA.pietraChiara); rect(ix - 5, iy, 11, 4, RGBA.pietraChiara); rect(ix - 1, iy + 1, 2, 3, RGBA.abisso); px(ix - 3, iy - 1, RGBA.pietra); px(ix + 2, iy - 2, RGBA.pietra); }
    // mare scuro con le creste
    for (let y = 31; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const cr = (xx + y * 3 + Math.floor(t * 6)) % 23;
      buf[y * W + xx] = cr === 0 && y % 4 === 0 ? RGBA.acqua : dith(xx, y, 0.5 + 0.3 * tri(xx / 31 + y / 19)) ? RGBA.abisso : RGBA.acquaProfonda;
    }
    // la lastra: bordo di neve irregolare, spessore azzurro sotto
    const x1 = BX + C * L, y1 = BY + C * L;
    for (let xx = BX - 4; xx < x1 + 4; xx++) {
      const n = hash2(xx, 7) % 3;
      rect(xx, BY - 3 - (n === 0 ? 1 : 0), 1, 3 + (n === 0 ? 1 : 0), RGBA.pietraChiara);
      rect(xx, y1, 1, 2, RGBA.pietraChiara); rect(xx, y1 + 2, 1, 3 + (n === 1 ? 1 : 0), RGBA.acqua); px(xx, y1 + 5 + (n === 1 ? 1 : 0), RGBA.acquaProfonda);
    }
    for (let yy = BY - 3; yy < y1 + 2; yy++) { const n = hash2(3, yy) % 3; rect(BX - 3 - (n === 0 ? 1 : 0), yy, 3 + (n === 0 ? 1 : 0), 1, RGBA.pietraChiara); rect(x1, yy, 3 + (n === 2 ? 1 : 0), 1, RGBA.pietraChiara); }
    // ghiaccio: celle chiare con la riga sottile, riflessi in diagonale, qualche crepa
    for (let c = 0; c < L * L; c++) {
      const cx = BX + (c % L) * C, cy = BY + Math.floor(c / L) * C, hh = hash2(c, 11);
      for (let yy = 0; yy < C; yy++) for (let xx = 0; xx < C; xx++) {
        const X = cx + xx, Y = cy + yy;
        let col = RGBA.pietraChiara;
        if ((xx === 0 || yy === 0) && (X + Y) % 2 === 0) col = RGBA.pietra;
        else if (hh % 3 === 0 && (xx + yy === 12 || xx + yy === 14) && xx > 2 && yy > 2) col = RGBA.acquaBassa;
        else if (hh % 5 === 1 && yy === 9 && xx > 4 && xx < 11) col = RGBA.pietra;
        buf[Y * W + X] = col;
      }
    }
    // buche di pesca: acqua scura, il pesce che gira, il bordo di neve smosso
    for (let c = 0; c < L * L; c++) if (v.buca[c]) {
      const q = centro(c);
      disco(q.x, q.y, 7, RGBA.pietra); disco(q.x, q.y, 6, RGBA.acquaProfonda); disco(q.x, q.y + 1, 5, RGBA.abisso);
      const a = t * 1.3 + c, fx = q.x + Math.round(tri(a) * 3), fy = q.y + Math.round(tri(a + 0.5) * 2);
      spr(PESCE, fx - 2, fy - 1, MAPPA, tri(a + 1) < 0);
      if (Math.floor(t * 3 + c) % 7 === 0) px(q.x + 2, q.y - 3, RGBA.acquaBassa);
      for (const [ox, oy] of [[-7, -3], [6, 4], [-4, 6], [5, -6]] as const) px(q.x + ox, q.y + oy, RGBA.pietraChiara);
    }
    // iceberg e pinguini, riga per riga (quello più in basso copre quello sopra)
    const u = v.ultima, k = u ? Math.min(1, (v.tick - u.tick + alpha) / Math.max(1, u.passi * TPC)) : 1;
    const inMoto = u && v.tick - u.tick < u.passi * TPC + (u.tuffo ? TUFFO : 0) ? u.p : -1;
    for (let row = 0; row < L; row++) {
      for (let col = 0; col < L; col++) {
        const c = row * L + col;
        if (!v.muro[c]) continue;
        iceberg(BX + col * C, BY + row * C, hash2(c, 5));
      }
      v.pos.forEach((c0, i) => {
        if (i === inMoto && u) return;
        if (c0 >= 0 && Math.floor(c0 / L) === row) pinguino(i, centro(c0).x, centro(c0).y, false, 1, t);
      });
      if (inMoto >= 0 && u && Math.floor((k < 1 ? u.da : u.a) / L) === row) {
        const a = centro(u.da), b = centro(u.a);
        const xx = a.x + (b.x - a.x) * k, yy = a.y + (b.y - a.y) * k;
        const dentro = u.tuffo && k >= 1 ? Math.min(1, (v.tick - u.tick - u.passi * TPC + alpha) / TUFFO) : 0;
        if (dentro < 1) pinguino(u.p, xx, yy, k < 1, 1 - dentro, t, u.dir);
        if (k < 1) for (let s = 1; s < 4; s++) { const bx = xx - (b.x - a.x) / Math.max(1, u.passi) * 0.35 * s, by = yy - (b.y - a.y) / Math.max(1, u.passi) * 0.35 * s; px(bx, by + 4, RGBA.pietra); px(bx + 1, by + 6, RGBA.acquaBassa); }
      }
    }
    // teste dei pinguini già in acqua (col pesce in bocca), che fanno su e giù
    const perBuca = new Map<number, number[]>();
    for (const [p, c] of g?.tuffi ?? []) if (v.pos[p]! < 0 && !(u && u.p === p && v.tick - u.tick < u.passi * TPC + TUFFO)) { const l = perBuca.get(c) ?? []; l.push(p); perBuca.set(c, l); }
    for (const [c, ps] of perBuca) ps.forEach((p, j) => {
      const q = centro(c), ox = (j - (ps.length - 1) / 2) * 6, bob = Math.floor(t * 3 + p) % 2;
      spr(PINGUINO.slice(0, 4).map((r) => r.slice(2, 10)), q.x + ox - 4, q.y - 3 + bob, MAPPA);
      rect(q.x + ox - 4, q.y + 1 + bob, 8, 1, RGBA[SCIARPA[p] ?? 'rosso']);
      if (festa || Math.floor(t + p) % 3 === 0) spr(PESCE, q.x + ox + 1, q.y - 1 + bob, MAPPA);
    });
    // il pinguino scelto: frecce gialle dove può andare
    if (g && !auto && v.festa < 0 && !v.done && inMoto < 0 && v.pos[g.sel] !== undefined && v.pos[g.sel]! >= 0 && Math.floor(t * 3) % 3 !== 0) {
      const q = centro(v.pos[g.sel]!);
      const l = { lato: L, muro: v.muro, buca: v.buca };
      for (let d = 0; d < 4; d++) {
        if (!scivola(l, v.pos, g.sel, d)) continue;
        const [dx, dy] = PG_DIR[d]!;
        const ax = q.x + dx * 11, ay = q.y - 2 + dy * 12;
        for (let i = 0; i < 3; i++) for (let j = -i; j <= i; j++) px(ax + dx * (2 - i) + (dy ? j : 0), ay + dy * (2 - i) + (dx ? j : 0), RGBA.giallo);
      }
    }
    for (const s of g?.sbuffi ?? []) for (let i = 0; i < 4; i++) px(s.x + (i - 1.5) * (2 + s.t * 0.3), s.y - s.t * 0.2 - (i % 2), s.acqua ? RGBA.acquaBassa : RGBA.pietraChiara);
    // festa: fiocchi di neve che cadono
    if (festa) for (let i = 0; i < 40; i++) { const fx = (hash2(i, 1) % W + Math.floor(tri(t + i) * 3)) % W, fy = (hash2(i, 2) % H + Math.floor(t * 30)) % H; px(fx, fy, i % 3 ? RGBA.pietraChiara : RGBA.giallo); }
    tela.fine();
  }
  /** Un iceberg sulla cella in (cx, cy): cappello di neve frastagliato, faccia in alto azzurra, fianco davanti più scuro, contorno. */
  function iceberg(cx: number, cy: number, hh: number): void {
    const { px, rect } = tela;
    rect(cx + 1, cy + 15, C - 1, 3, RGBA.pietra); // ombra sul ghiaccio
    const picco = (hh % 3) + 2, pk = 4 + (hh % 9);
    for (let xx = 1; xx < C - 1; xx++) {
      const top = -4 + (hh >> xx % 7 & 1) - Math.max(0, picco - Math.abs(xx - pk)), spalla = 5 + (xx < 4 || xx > C - 5 ? 1 : 0);
      for (let yy = top; yy <= 15; yy++) {
        const bordo = yy === top || xx === 1 || xx === C - 2 || yy === 15;
        let c: number;
        if (bordo) c = RGBA.acquaProfonda;
        else if (yy <= top + 2) c = RGBA.pietraChiara; // neve
        else if (yy < spalla) c = xx < 7 ? (dith(cx + xx, cy + yy, 0.3) ? RGBA.acquaBassa : RGBA.pietraChiara) : dith(cx + xx, cy + yy, 0.75) ? RGBA.acquaBassa : RGBA.acqua;
        else if (yy === spalla) c = RGBA.pietraChiara; // spigolo
        else c = xx < 5 ? RGBA.acquaBassa : xx < 12 ? RGBA.acqua : RGBA.acquaProfonda;
        if (!bordo && yy > spalla && (xx === 8 || xx === 13) && yy % 3 !== 0) c = RGBA.acquaProfonda; // crepe
        px(cx + xx, cy + yy, c);
      }
    }
    px(cx + 4, cy - 1, RGBA.pietraChiara); px(cx + 3, cy, RGBA.pietraChiara); // luccichio
  }
  function pinguino(i: number, cx: number, cy: number, scivolando: boolean, quanto: number, t: number, dir = 1): void {
    const { rect, spr } = tela;
    const map = { ...MAPPA, s: SCIARPA[i] ?? 'rosso' } as Record<string, Col>;
    if (scivolando) {
      rect(cx - 6, cy + 3, 13, 2, RGBA.pietra);
      spr(SCIVOLA, cx - 7, cy - 3, map, dir === 3);
      return;
    }
    const sel = g && g.sel === i && !auto;
    rect(cx - 5, cy + 5, 11, 2, sel ? RGBA.giallo : RGBA.pietra); // ombra (gialla sotto quello scelto)
    const righe = Math.round(PINGUINO.length * quanto), salto = view && view.festa >= 0 ? (Math.floor(t * 6 + i) % 2) * -2 : 0;
    spr(PINGUINO.slice(0, righe), cx - 6, cy - 7 + (PINGUINO.length - righe) + salto, map);
    if (quanto < 1) for (let k = 0; k < 5; k++) tela.px(cx - 6 + k * 3, cy + 5 - (k % 2) * 2 - Math.round((1 - quanto) * 3), RGBA.acquaBassa);
  }

  function render(alpha: number): void {
    if (!g) return;
    const v = view = mod.view(g.s) as PinguiniView;
    if (v.idx !== g.idx) { g.idx = v.idx; g.tuffi.clear(); g.sel = 0; }
    if (v.mosse === 0 && !v.ultima) g.tuffi.clear();
    if (v.pos[g.sel] === undefined || v.pos[g.sel]! < 0) g.sel = vivi(v)[0] ?? 0;
    // sbuffi di neve dove un pinguino si ferma, schizzi dove si tuffa
    const u = v.ultima;
    if (u && u.tick !== g.ultimaVista && v.tick - u.tick >= u.passi * TPC) {
      g.ultimaVista = u.tick; const q = centro(u.a);
      g.sbuffi.push({ x: q.x, y: q.y + 5, t: 0, acqua: u.tuffo });
      if (u.tuffo) suona('plop');
    }
    for (const s of g.sbuffi) s.t++;
    g.sbuffi = g.sbuffi.filter((s) => s.t < 18);
    disegna(v, tAnim, alpha);
    title.textContent = `${CFG.nome} · ${Math.min(v.totale, v.idx + 1)}/${v.totale}`;
    bar.style.width = `${Math.max(0, 100 - (v.ms / v.maxMs) * 100)}%`;
    time.classList.toggle('low', v.maxMs - v.ms < 15_000);
    const key = v.pos.join(',') + ':' + v.idx;
    if (key !== g.chiave) { g.chiave = key; g.bloccato = v.festa < 0 && !v.done && !risolviPinguini({ lato: L, muro: v.muro, buca: v.buca }, v.pos); }
    const [txt, cls] = g.intro > 0 ? ['Pronti…', ''] : v.done ? (v.timeUp ? ['Tempo!', 'bad'] : ['Tutti a pescare!', 'go'])
      : v.festa >= 0 ? ['Bravo! Il prossimo…', 'go'] : g.bloccato && !anim(v) ? ['Incastrati! Tocca RICOMINCIA', 'bad'] : [`Mosse ${v.mosse}`, ''];
    again.classList.toggle('green', g.bloccato);
    if (msg.dataset['t'] !== txt) {
      msg.dataset['t'] = txt; msg.className = 'msg ' + cls; msg.textContent = txt;
      if (!v.done && v.festa < 0 && g.intro <= 0) msg.appendChild(el('small', '', ` · minimo ${v.ottimo}`));
    }
    if (pips.childElementCount !== v.totale || pips.dataset['n'] !== String(v.risolti)) {
      pips.dataset['n'] = String(v.risolti);
      pips.replaceChildren(...Array.from({ length: v.totale }, (_, i) => el('span', i < v.risolti ? 'pip on' : 'pip')));
    }
  }
  function loop(now: number): void {
    if (!open) return;
    const dt = Math.min(0.25, (now - last) / 1000); last = now; tAnim += dt;
    if (auto) { for (let i = 0; i < 6 && open; i++) tick(); acc = 0; } // test: veloce ma con le scivolate che si vedono
    else { acc += dt; while (acc >= 1 / 60 && open) { acc -= 1 / 60; tick(); } }
    if (open) { render(auto ? 0 : Math.min(1, acc * 60)); raf = requestAnimationFrame(loop); }
  }
  function close(v: PackedInputs | null): void {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    drag = null;
    const done = g; g = null; done?.finish(v);
  }

  registerStateProvider('pinguini', () => ({
    open, auto, sel: g?.sel ?? -1, frames: g?.frames.length ?? 0, coda: g?.queue.length ?? 0, intro: g?.intro ?? 0,
    view: view && { idx: view.idx, pos: view.pos, mosse: view.mosse, ottimo: view.ottimo, risolti: view.risolti, festa: view.festa, done: view.done, ms: view.ms, tick: view.tick },
    /** Centro di ogni cella in pixel della pagina (per i test che trascinano davvero un pinguino). */
    cella: (() => { const r = cv.getBoundingClientRect(); return { x0: r.left + (BX / W) * r.width, y0: r.top + (BY / H) * r.height, lato: (C / W) * r.width, n: L }; })(),
  }));
  registerTestHook('pinguiniAuto', (on) => { auto = on !== false; return auto; });
  /** Test: gioca col pilota fino al tick dato e ferma lì (per gli screenshot a metà partita). */
  registerTestHook('pinguiniFinoA', (n) => {
    if (!g) return false;
    g.intro = 0;
    const fino = Math.max(1, Math.min(mod.maxTicks - 1, Number(n) || 1));
    while (g.s.tick < fino && !g.s.done) { const f = quantize(mod.autopilot(g.s, autoRng)); g.prevA = f.a; g.frames.push(f); mod.step(g.s, f); if (g.s.ultima?.tuffo && g.s.ultima.tick === g.s.tick) g.tuffi.set(g.s.ultima.p, g.s.ultima.a); }
    acc = 0; render(0);
    return g.s.tick;
  });

  return {
    run({ seed, difficulty }) {
      if (open) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      return new Promise((finish) => {
        g = { s: mod.create({ seed, difficulty: d }), frames: [], queue: [], reset: false, prevA: false, prevB: false, intro: auto ? 0 : INTRO, end: -1, sel: 0, finish, tuffi: new Map(), idx: 0, sbuffi: [], ultimaVista: -1, chiave: '', bloccato: false };
        open = true; acc = 0; last = performance.now(); view = null; tAnim = 0;
        wrap.classList.add('on'); addEventListener('keydown', onKey, true);
        render(0); raf = requestAnimationFrame(loop);
      });
    },
    isOpen: () => open,
    esito: (d) => `${Number(d['risolti'] ?? 0)}/${Number(d['totale'] ?? 3)} livelli · ${Number(d['mosse'] ?? 0)} mosse`,
  };
}
