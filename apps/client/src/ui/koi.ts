// Carpe koi: la schermata del minigioco dell'Isola Giardino (gioco a schermo, scaricato con import() alla prima partita: minigiochi.ts →
// registraSchermo). Lo stagno visto dall'alto dal ponticello rosso, col ciliegio che fiorisce man mano che fai punti: tocchi un petalo e
// la carpa più vicina ci corre a mangiarlo; la carpa nera ruba il cibo (la combo si azzera) finché non la tocchi e scappa. Un pollice:
// si tocca e basta (col mouse si clicca). Esc o × = ritirati. Fa girare la sim `koi` a 60 Hz (accumulatore suo), registra un InputFrame
// quantizzato per tick e alla fine restituisce packInputs(frames): il punteggio lo decide il server. Solo colori della palette.
import { MINIGAMES_CFG } from '@marea/content';
import { KOI_COLORATE, createRng, getMinigame, koiTocco, packInputs, quantize } from '@marea/sim';
import type { Difficulty, InputFrame, KoiState, KoiView, MinigameModule, PackedInputs } from '@marea/sim';
import type { SchermoGioco } from '../game/minigiochi.ts';
import { PAL, el, injectUiStyle } from './style.ts';
import { RGBA, createTela, dith, hash2, tri } from './tela.ts';
import type { Col } from './tela.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { suona } from '../audio/ponte.ts';

const P = PAL;
const CFG = MINIGAMES_CFG.koi;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const END_HOLD = 90;
/** Tela: riva col ciliegio in alto, lo stagno (SX, SY), il parapetto del ponticello in basso. */
const SX = 8, SY = 26, PW = CFG.stagno.w, PH = CFG.stagno.h, W = SX * 2 + PW, H = SY + PH + 16;
/** Segmenti del corpo di una carpa (dalla testa alla coda) e distanza tra due punti della scia. */
const SEG = 10, PASSO = 1.9;
/** Raggio del corpo per segmento: testa tonda, pancia larga, coda sottile. */
const RAGGI = [2.7, 3.4, 3.7, 3.6, 3.2, 2.7, 2.2, 1.7, 1.3, 1];

const CSS = `
.mz-koi { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(22,63,115,.55); z-index: 28; touch-action: none; }
.mz-koi.on { display: flex; }
.mz-koi-box { width: min(560px, calc(100% - 12px)); max-height: calc(100% - 12px); overflow-y: auto; padding: 8px 8px 10px; background: rgba(46,30,20,.97); border: 3px solid ${P.rosaNeon}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-koi .mz-head { margin-bottom: 4px; }
.mz-koi .rule { color: ${P.sabbia}; font-size: 13px; line-height: 1.3; margin: 0 0 6px; }
.mz-koi .rule b { color: ${P.rosaNeon}; } .mz-koi .rule i { font-style: normal; font-weight: bold; color: ${P.pietraChiara}; text-decoration: underline ${P.neroCaldo} 3px; }
.mz-koi .time { height: 10px; background: ${P.legnoScuro}; border: 2px solid ${P.neroCaldo}; margin-bottom: 6px; }
.mz-koi .time i { display: block; height: 100%; background: ${P.erba}; }
.mz-koi .time.low i { background: ${P.rosso}; }
.mz-koi .scena { position: relative; border: 3px solid ${P.neroCaldo}; line-height: 0; }
.mz-koi canvas { width: 100%; height: auto; aspect-ratio: ${W} / ${H}; image-rendering: pixelated; display: block; touch-action: none; cursor: pointer; }
.mz-koi .intro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(35,32,31,.62); line-height: 1.25; }
.mz-koi .intro div { width: min(90%, 360px); padding: 4px 8px; background: ${P.ombraCalda}; border: 2px solid ${P.legnoChiaro}; font-size: 13px; font-weight: bold; }
.mz-koi .intro b { color: ${P.rosaNeon}; } .mz-koi .intro .oro { color: ${P.giallo}; } .mz-koi .intro .nera { color: ${P.pietraChiara}; text-decoration: underline ${P.rosso} 2px; }
.mz-koi .intro .go { width: auto; border-color: ${P.rosaNeon}; color: ${P.rosaNeon}; }
.mz-koi .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 0; min-height: 40px; }
.mz-koi .msg { font-size: 16px; font-weight: bold; line-height: 1.2; }
.mz-koi .msg small { display: block; font-size: 12px; font-weight: normal; color: ${P.sabbia}; }
.mz-koi .msg.go { color: ${P.giallo}; } .mz-koi .msg.bad { color: ${P.rosso}; } .mz-koi .msg.ok { color: ${P.rosaNeon}; }
.mz-koi .pts { flex: none; text-align: right; font-size: 22px; font-weight: bold; color: ${P.giallo}; line-height: 1; }
.mz-koi .pts small { display: block; font-size: 11px; color: ${P.sabbia}; }
.mz-koi .pts .x { color: ${P.rosaNeon}; font-size: 16px; margin-left: 6px; }
.mz-koi .goal { margin-top: 4px; color: ${P.sabbia}; font-size: 12px; }
.mz-koi .goal b.on { color: ${P.giallo}; }
`;

/** Colori delle carpe: [corpo, macchie, pinne]. 0 kohaku (bianca e rossa), 1 yamabuki (gialla), 2 kin (arancio), 3 la nera. */
const KOI_COL: [Col, Col, Col][] = [['pietraChiara', 'rosso', 'pietraChiara'], ['giallo', 'arancio', 'sabbiaChiara'], ['arancio', 'pietraChiara', 'sabbia'], ['neroCaldo', 'roccia', 'roccia']];
/** Quali segmenti hanno le macchie (per carpa). */
const MACCHIE = [[1, 2, 5, 6], [3, 7], [1, 4, 5], [2, 6]];
const MAPPA: Record<string, Col> = { k: 'rosaNeon', w: 'pietraChiara', Y: 'giallo', O: 'arancio', s: 'sabbiaChiara', n: 'neroCaldo' };
/** Petalo di ciliegio (con la tacca), mentre cade gira; briciola d'oro. */
const PETALO = ['.k.k.', 'kkwkk', 'kwwwk', '.kwk.', '..k..'];
const PETALO2 = ['..kk.', '.kwwk', 'kwwk.', '.kk..'];
const BRICIOLA = ['.YY.', 'YsYO', 'YYOO', '.OO.'];

export function createKoi(o: { root: HTMLElement }): SchermoGioco {
  injectUiStyle();
  if (!document.getElementById('mz-koi-style')) { const st = document.createElement('style'); st.id = 'mz-koi-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mod = getMinigame('koi') as MinigameModule<KoiState>;
  const wrap = el('div', 'mz mz-koi'); wrap.id = 'mzKoi';
  const box = el('div', 'mz-koi-box'); wrap.appendChild(box);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) wrap.addEventListener(ev, (x) => x.stopPropagation());
  o.root.appendChild(wrap);

  // ---- scheletro fisso ----
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const head = el('div', 'mz-head'); head.append(el('div', 'mz-title', `${CFG.nome} · lo stagno`), x);
  const rule = el('p', 'rule');
  rule.append(el('b', '', 'Tocca i petali'), ': la carpa più vicina corre a mangiarli. ', el('i', '', 'Tocca la carpa nera'), ' per scacciarla!');
  const time = el('div', 'time'); const bar = document.createElement('i'); time.appendChild(bar);
  const scena = el('div', 'scena');
  const cv = document.createElement('canvas'); scena.appendChild(cv);
  const tela = createTela(cv, W, H);
  const intro = el('div', 'intro');
  intro.innerHTML = `<div><b>TOCCA UN PETALO</b>: la carpa più vicina ci va</div><div><span class="oro">Briciole d'oro</span> ${CFG.punti.oro} punti · petali ${CFG.punti.petalo} · in fila valgono di più</div>`
    + '<div><span class="nera">La carpa nera ruba</span>: toccala e scappa</div><div class="go">TOCCA PER INIZIARE</div>'; // testo statico (solo numeri di content)
  scena.appendChild(intro);
  const msg = el('div', 'msg'); const pts = el('div', 'pts');
  const status = el('div', 'status'); status.append(msg, pts);
  const goal = el('div', 'goal');
  box.append(head, rule, time, scena, status, goal);

  type Fx = { x: number; y: number; t: number; testo: string; col: Col };
  type Game = {
    s: KoiState; frames: InputFrame[]; taps: { x: number; y: number }[]; prevA: boolean; intro: boolean; end: number; finish(v: PackedInputs | null): void;
    scie: { x: number; y: number }[][]; fx: Fx[]; stati: Map<number, number>; fiori: { x: number; y: number; vx: number; vy: number; t: number }[]; comboPrima: number; spaventi: number;
  };
  let g: Game | null = null, open = false, auto = false, raf = 0, last = 0, acc = 0, tAnim = 0, view: KoiView | null = null;
  const autoRng = createRng('koi-auto');

  // ---- input: un tocco sullo stagno (o un clic) ----
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!g || !open || auto) return;
    if (g.intro) { inizia(); return; }
    if (g.end >= 0) return;
    const r = cv.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W - SX, py = ((e.clientY - r.top) / r.height) * H - SY;
    if (px < -6 || py < -6 || px > PW + 6 || py > PH + 6) return;
    if (g.taps.length < 3) g.taps.push({ x: Math.max(0, Math.min(PW, px)), y: Math.max(0, Math.min(PH, py)) });
  });
  intro.addEventListener('pointerdown', (e) => { e.preventDefault(); inizia(); });
  function inizia(): void { if (g?.intro) { g.intro = false; intro.style.display = 'none'; suona('plop'); } }
  x.addEventListener('click', () => close(null));
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(null); }
    else if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); inizia(); }
  };

  function tick(): void {
    if (!g || g.intro) return;
    if (g.end >= 0) { if (++g.end >= END_HOLD) close(packInputs(g.frames)); return; }
    let f: InputFrame = NO;
    if (auto) f = mod.autopilot(g.s, autoRng);
    else if (!g.prevA && g.taps.length) { const t = g.taps.shift()!; f = koiTocco(t.x, t.y); }
    f = quantize(f); g.prevA = f.a;
    const s = g.s, prima = { punti: s.punti, rubati: s.rubati, spaventi: s.spaventi, tocchi: s.tocchi };
    g.frames.push(f); mod.step(s, f);
    effetti(g, prima);
    if (s.done) g.end = 0;
  }
  /** Suoni e numeri che volano dagli eventi del tick (cibo mangiato o rubato, nera scacciata), fiori che sbocciano a ogni combo da 5. */
  function effetti(gm: Game, prima: { punti: number; rubati: number; spaventi: number; tocchi: number }): void {
    const s = gm.s;
    for (const c of s.cibo) {
      if (c.stato < 2 || gm.stati.get(c.id) === c.stato) continue;
      gm.stati.set(c.id, c.stato);
      if (c.stato === 2) gm.fx.push({ x: c.x, y: c.y - 6, t: 0, testo: `+${c.punti}`, col: c.oro ? 'giallo' : 'pietraChiara' });
      else if (c.stato === 3) gm.fx.push({ x: c.x, y: c.y - 6, t: 0, testo: '!', col: 'rosso' });
    }
    if (s.punti > prima.punti) suona(s.punti - prima.punti >= CFG.punti.oro ? 'moneta' : 'raccolto');
    if (s.rubati > prima.rubati) suona('colpo_preso');
    if (s.spaventi > prima.spaventi) suona('goccia');
    else if (s.tocchi > prima.tocchi && s.tocco?.cosa === 'acqua') suona('plop');
    if (s.combo > 0 && s.combo % CFG.punti.combo === 0 && s.combo !== gm.comboPrima) {
      suona('pesce');
      for (let i = 0; i < 18; i++) gm.fiori.push({ x: 24 + (i % 6) * 22, y: 4 + (i % 3) * 5, vx: ((i * 7) % 5 - 2) * 0.15, vy: 0.25 + (i % 4) * 0.08, t: 0 });
    }
    gm.comboPrima = s.combo;
    scie(gm);
  }
  /** Scie delle carpe (un punto ogni PASSO px), numeri e petali che volano: una volta per tick. */
  function scie(gm: Game): void {
    gm.s.carpe.forEach((k, i) => {
      const sc = (gm.scie[i] ??= []);
      const h = sc[0], p1 = sc[1];
      if (!h || !p1) { sc.length = 0; for (let j = 0; j < SEG; j++) sc.push({ x: k.x - k.hx * j * PASSO, y: k.y - k.hy * j * PASSO }); return; }
      // la testa segue la carpa; quando si è allontanata di PASSO dal punto dietro, lì resta un punto fisso del corpo
      const d = Math.hypot(k.x - p1.x, k.y - p1.y);
      if (d >= PASSO * 2) { h.x = p1.x + ((k.x - p1.x) / d) * PASSO; h.y = p1.y + ((k.y - p1.y) / d) * PASSO; sc.unshift({ x: k.x, y: k.y }); sc.length = Math.min(sc.length, SEG); }
      else { h.x = k.x; h.y = k.y; }
    });
    for (const e of gm.fx) e.t++;
    gm.fx = gm.fx.filter((e) => e.t < 50);
    for (const f of gm.fiori) { f.x += f.vx + tri(f.t / 20) * 0.2; f.y += f.vy; f.t++; }
    gm.fiori = gm.fiori.filter((f) => f.y < H - 14);
  }

  // ---------- disegno ----------
  function disegna(v: KoiView, t: number): void {
    const { px, rect, disco, spr, buf } = tela;
    const fiore = Math.min(1, v.punti / Math.max(1, v.medals.oro));
    // riva di muschio tutt'intorno con i sassi
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const hh = hash2(xx, y);
      buf[y * W + xx] = hh % 7 === 0 ? RGBA.bosco : hh % 11 === 0 ? RGBA.erba : dith(xx, y, 0.35) ? RGBA.erbaScura : RGBA.bosco;
    }
    // acqua dello stagno: fasce a puntini e luccichii che si muovono
    for (let y = 0; y < PH; y++) for (let xx = 0; xx < PW; xx++) {
      const bordo = Math.min(xx, y, PW - 1 - xx, PH - 1 - y);
      const luce = ((xx + Math.floor(y * 0.6) + Math.floor(t * 4)) % 37 === 0 && (y + Math.floor(t * 2)) % 5 < 2);
      buf[(SY + y) * W + SX + xx] = bordo < 3 ? (dith(xx, y, 0.6) ? RGBA.acquaProfonda : RGBA.abisso)
        : luce ? RGBA.acquaBassa : dith(xx, y, Math.max(0, tri(xx / 47 + y / 31 + t * 0.04) + tri(xx / 19 - y / 23) * 0.3 - 0.35) * 0.8) ? RGBA.acquaProfonda : RGBA.acqua;
    }
    // sassi sul bordo
    for (let i = 0; i < 46; i++) {
      const per = 2 * (PW + PH), d = (i * per) / 46 + (hash2(i, 9) % 5);
      let sx: number, sy: number;
      if (d < PW) { sx = SX + d; sy = SY - 1; } else if (d < PW + PH) { sx = SX + PW; sy = SY + d - PW; } else if (d < 2 * PW + PH) { sx = SX + PW - (d - PW - PH); sy = SY + PH; } else { sx = SX - 1; sy = SY + PH - (d - 2 * PW - PH); }
      const r = 2 + (hash2(i, 3) % 3);
      disco(sx, sy, r, RGBA.pietraScura); disco(sx - 0.5, sy - 0.5, r - 1, hash2(i, 4) % 3 ? RGBA.pietra : RGBA.pietraChiara);
    }
    // ninfee (posti fissi): sotto le carpe e il cibo
    for (const [lx, ly, r] of [[22, 88, 6], [138, 20, 5], [128, 94, 7], [70, 12, 4]] as const) {
      disco(SX + lx, SY + ly, r, RGBA.erbaScura); disco(SX + lx - 0.6, SY + ly - 0.6, r - 1, RGBA.erba);
      for (let k = 0; k < r; k++) px(SX + lx + k, SY + ly - Math.floor(k / 2), RGBA.acqua); // la tacca
      if (r > 5) { px(SX + lx - 2, SY + ly - 1, RGBA.rosaNeon); px(SX + lx - 3, SY + ly - 1, RGBA.pietraChiara); px(SX + lx - 2, SY + ly - 2, RGBA.pietraChiara); }
    }
    // ombre del cibo che cade, poi il cibo a galla (lampeggia quando sta per affondare)
    for (const c of v.cibo) {
      const cx = SX + c.x, cy = SY + c.y;
      if (c.stato === 0) {
        const k = (c.t0 - v.tick) / CFG.cibo.caduta;
        disco(cx, cy, 1 + (1 - k) * 1.5, RGBA.acquaProfonda);
        const fx = cx + Math.round(tri(k * 3 + c.id) * 4), fy = cy - Math.round(k * 26);
        spr(c.oro ? BRICIOLA : Math.floor(t * 6 + c.id) % 2 ? PETALO : PETALO2, fx - 2, fy - 2, MAPPA);
        continue;
      }
      const resta = c.t0 + CFG.cibo.galla - v.tick;
      if (resta < 60 && Math.floor(t * 8) % 2) continue;
      const anello = (v.tick - c.t0) % 50;
      if (anello < 24) for (let a = 0; a < 16; a++) { const r = 3 + anello / 4; const ox = Math.round(tri(a / 8) * r), oy = Math.round(tri(a / 8 + 0.5) * r * 0.7); if (a % 2 === 0) px(cx + ox, cy + oy, RGBA.acquaBassa); }
      const bob = Math.floor(t * 2 + c.id) % 2;
      spr(c.oro ? BRICIOLA : PETALO, cx - 2, cy - 2 + bob, MAPPA);
      if (c.oro && Math.floor(t * 4) % 3 === 0) { px(cx + 2, cy - 3, RGBA.pietraChiara); px(cx - 3, cy + 2, RGBA.giallo); }
      // chi ci sta andando: segno sotto (bianco = la tua carpa, rosso = la nera)
      const nera = v.carpe[KOI_COLORATE]!;
      if (v.carpe.some((k, i) => i < KOI_COLORATE && k.modo === 'corsa' && k.meta === c.id)) for (const [ox, oy] of [[-5, 0], [5, 0], [0, -5], [0, 5]] as const) px(cx + ox, cy + oy, RGBA.pietraChiara);
      if (nera.modo === 'caccia' && nera.meta === c.id && Math.floor(t * 6) % 2) for (const [ox, oy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]] as const) px(cx + ox, cy + oy, RGBA.rosso);
    }
    // le carpe, dalla scia: corpo a dischi che si stringono, pinne, coda che sventola; la nera per ultima (sopra)
    v.carpe.forEach((k, i) => carpa(i, k, t));
    // increspatura del tocco
    const tc = v.tocco;
    if (tc && v.tick - tc.tick < 24) {
      const r = 2 + (v.tick - tc.tick) / 3, col = tc.cosa === 'nera' ? RGBA.rosso : tc.cosa === 'cibo' ? RGBA.pietraChiara : RGBA.acquaBassa;
      for (let a = 0; a < 20; a++) if (a % 2 === 0) px(SX + tc.x + Math.round(tri(a / 10) * r), SY + tc.y + Math.round(tri(a / 10 + 0.5) * r), col);
    }
    // i ciliegi (chiome viste dall'alto, sporgono sullo stagno): fioriscono coi punti, verso l'oro
    for (const [tx, ty, R, seme] of [[20, 4, 25, 1], [W - 16, 0, 19, 2]] as const) ciliegio(tx, ty, R, seme, fiore);
    // lanterna di pietra sulla riva
    rect(W - 40, 4, 7, 3, RGBA.pietraScura); rect(W - 39, 7, 5, 4, RGBA.pietra); rect(W - 38, 8, 3, 2, Math.floor(t * 2) % 5 ? RGBA.giallo : RGBA.arancio); rect(W - 41, 11, 9, 2, RGBA.pietraScura); rect(W - 38, 13, 3, 5, RGBA.pietra);
    // petali che volano dopo una combo
    for (const f of g?.fiori ?? []) { px(f.x, f.y, f.t % 8 < 4 ? RGBA.rosaNeon : RGBA.pietraChiara); px(f.x + 1, f.y, RGBA.rosaNeon); }
    // numeri che volano
    for (const e of g?.fx ?? []) tela.testo(e.testo, SX + e.x, SY + e.y - e.t * 0.35, RGBA[e.col]);
    // il parapetto del ponticello rosso, in primo piano
    const by = SY + PH + 4;
    rect(0, by, W, 12, RGBA.legno); rect(0, by, W, 2, RGBA.legnoChiaro);
    for (let xx = 0; xx < W; xx += 3) px(xx, by + 5 + (xx % 6 ? 0 : 3), RGBA.legnoScuro);
    rect(0, by - 2, W, 3, RGBA.rosso); rect(0, by - 2, W, 1, RGBA.arancio); rect(0, by + 1, W, 1, RGBA.neroCaldo);
    for (let xx = 6; xx < W; xx += 30) { rect(xx, by - 4, 4, 14, RGBA.rosso); rect(xx, by - 4, 4, 1, RGBA.arancio); rect(xx + 3, by - 3, 1, 13, RGBA.neroCaldo); }
    tela.fine();
  }
  /** Chioma a grappoli (cinque cerchi) col bordo in ombra, rami dal tronco; i fiori (rosa a puntini) crescono con `fiore` (0..1). */
  function ciliegio(tx: number, ty: number, R: number, seme: number, fiore: number): void {
    const { buf } = tela;
    const blob: [number, number, number][] = [[0, 0, R * 0.62], [R * 0.45, R * 0.3, R * 0.5], [-R * 0.42, R * 0.35, R * 0.48], [R * 0.1, R * 0.62, R * 0.42], [R * 0.6, -R * 0.15, R * 0.4]];
    for (let y = Math.max(0, Math.floor(ty - R)); y < Math.min(H, ty + R * 1.1); y++) for (let xx = Math.max(0, Math.floor(tx - R * 1.1)); xx < Math.min(W, tx + R * 1.1); xx++) {
      let dentro = -1;
      for (const [bx, by, br] of blob) { const d = Math.hypot(xx - tx - bx, y - ty - by) / br; if (d < 1) dentro = Math.max(dentro, 1 - d); }
      if (dentro < 0) continue;
      const hh = hash2(xx * 3 + seme, y * 5), dx = xx - tx, dy = y - ty;
      const ramo = (Math.abs(dy - dx * 0.55) < 1 || Math.abs(dy + dx * 0.9) < 1 || Math.abs(dx) < 1) && dentro > 0.25 && dy > -R * 0.4;
      const rosa = (hh % 1000) / 1000 < 0.06 + fiore * 0.9;
      let c: number;
      if (dentro < 0.12) c = rosa ? (hh % 2 ? RGBA.rosso : RGBA.rosaNeon) : RGBA.bosco; // bordo in ombra
      else if (rosa) c = hh % 5 === 0 ? RGBA.pietraChiara : (xx + y) % 2 ? RGBA.rosaNeon : hh % 3 ? RGBA.pietraChiara : RGBA.rosaNeon;
      else if (ramo) c = RGBA.legnoScuro;
      else c = hh % 4 === 0 ? RGBA.erbaScura : dentro > 0.6 && hh % 3 === 0 ? RGBA.erbaChiara : RGBA.erba;
      buf[y * W + xx] = c;
    }
  }
  function carpa(i: number, k: KoiView['carpe'][number], t: number): void {
    const sc = g?.scie[i];
    if (!sc || !sc.length) return;
    const [corpo, macchia, pinna] = KOI_COL[i]!;
    const ondeggia = (k.v > 0.6 ? 2 : 1) * tri(t * (k.v > 0.6 ? 3 : 1.4) + i);
    // coda (oltre l'ultimo segmento), sventola
    const a = sc[Math.min(sc.length - 1, SEG - 1)]!, b = sc[Math.max(0, Math.min(sc.length - 1, SEG - 2))]!;
    let dx = a.x - b.x, dy = a.y - b.y; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    for (let j = 1; j <= 4; j++) for (const s of [-1, 1]) tela.px(SX + a.x + dx * j - dy * s * (j * 0.6 + ondeggia * 0.5), SY + a.y + dy * j + dx * s * (j * 0.6 + ondeggia * 0.5), RGBA[pinna]);
    for (let j = Math.min(sc.length, SEG) - 1; j >= 0; j--) {
      const p = sc[j]!, r = RAGGI[j] ?? 1;
      tela.disco(SX + p.x, SY + p.y, r, RGBA[MACCHIE[i]!.includes(j) ? macchia : corpo]);
    }
    // pinne pettorali e occhi (dalla direzione della testa)
    const h0 = sc[0]!, h1 = sc[Math.min(2, sc.length - 1)]!;
    let hx = h0.x - h1.x, hy = h0.y - h1.y; const m = Math.hypot(hx, hy) || 1; hx /= m; hy /= m;
    for (const s of [-1, 1]) {
      const fx = SX + h0.x - hx * 3, fy = SY + h0.y - hy * 3;
      tela.px(fx - hy * s * 4, fy + hx * s * 4, RGBA[pinna]); tela.px(fx - hy * s * 3 - hx, fy + hx * s * 3 - hy, RGBA[pinna]);
      tela.px(SX + h0.x + hx * 1.5 - hy * s * 1.5, SY + h0.y + hy * 1.5 + hx * s * 1.5, i === KOI_COLORATE ? (k.modo === 'caccia' ? RGBA.rosso : RGBA.pietraChiara) : RGBA.neroCaldo);
    }
    if (i === KOI_COLORATE && k.modo === 'caccia' && Math.floor(t * 4) % 2) tela.testo('!', SX + h0.x, SY + h0.y - 11, RGBA.rosso);
    if (k.modo === 'mangia' && Math.floor(t * 6) % 2) tela.px(SX + h0.x + hx * 4, SY + h0.y + hy * 4, RGBA.pietraChiara);
  }

  function render(): void {
    if (!g) return;
    const v = view = mod.view(g.s) as KoiView;
    disegna(v, tAnim);
    bar.style.width = `${Math.max(0, 100 - (v.ms / v.maxMs) * 100)}%`;
    time.classList.toggle('low', v.maxMs - v.ms < 10_000);
    const nera = v.carpe[KOI_COLORATE]!;
    const rubato = g.s.cibo.some((c) => c.stato === 3 && v.tick - c.fine < 90);
    const [a, b, cls] = g.intro ? ['Pronti?', 'il tempo parte al primo tocco', 'ok']
      : v.done ? ['Tempo!', `${v.mangiati} bocconi, ${v.rubati} rubati`, 'go']
      : rubato ? ['La nera ha rubato!', 'combo persa: toccala per scacciarla', 'bad']
      : nera.modo === 'caccia' ? ['La nera punta il cibo!', 'toccala per scacciarla', 'bad']
      : nera.modo === 'spavento' ? ['Scappa!', 'la nera ci riproverà', 'ok']
      : v.combo >= CFG.punti.combo ? [`Combo ${v.combo}`, 'il ciliegio fiorisce', 'ok']
      : ['Tocca i petali', 'la carpa più vicina ci va', ''];
    const key = `${a}|${b}`;
    if (msg.dataset['h'] !== key) { msg.dataset['h'] = key; msg.replaceChildren(document.createTextNode(a), el('small', '', b)); msg.className = 'msg ' + cls; }
    const ptxt = `${v.punti}|${v.molt}`;
    if (pts.dataset['p'] !== ptxt) {
      pts.dataset['p'] = ptxt;
      pts.replaceChildren(document.createTextNode(String(v.punti)), ...(v.molt > 1 ? [el('span', 'x', `×${v.molt}`)] : []), el('small', '', 'PUNTI'));
    }
    const m = v.medals, gtxt = `${v.punti >= m.bronzo}${v.punti >= m.argento}${v.punti >= m.oro}${m.oro}`;
    if (goal.dataset['g'] !== gtxt) {
      goal.dataset['g'] = gtxt;
      const b1 = (nome: string, p: number) => el('b', v.punti >= p ? 'on' : '', `${nome} ${p}`);
      goal.replaceChildren(b1('Bronzo', m.bronzo), document.createTextNode(' · '), b1('Argento', m.argento), document.createTextNode(' · '), b1('Oro', m.oro), document.createTextNode(' punti'));
    }
  }
  function loop(now: number): void {
    if (!open) return;
    const dt = Math.min(0.25, (now - last) / 1000); last = now; tAnim += dt;
    if (auto) { for (let i = 0; i < 8 && open; i++) tick(); acc = 0; } // test: veloce
    else { acc += dt; while (acc >= 1 / 60 && open) { acc -= 1 / 60; tick(); } }
    if (open) { render(); raf = requestAnimationFrame(loop); }
  }
  function close(v: PackedInputs | null): void {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    const done = g; g = null; done?.finish(v);
  }

  registerStateProvider('koi', () => ({
    open, auto, intro: g?.intro ?? false, frames: g?.frames.length ?? 0,
    view: view && { punti: view.punti, totale: view.totale, combo: view.combo, molt: view.molt, mangiati: view.mangiati, rubati: view.rubati, tick: view.tick, done: view.done, medals: view.medals, cibo: view.cibo.map((c) => ({ id: c.id, x: c.x, y: c.y, stato: c.stato })), nera: { x: view.carpe[KOI_COLORATE]!.x, y: view.carpe[KOI_COLORATE]!.y, modo: view.carpe[KOI_COLORATE]!.modo }, tocco: view.tocco?.cosa ?? null, corse: view.carpe.filter((k) => k.modo === 'corsa').length },
    /** Stagno in pixel della pagina (per i test che toccano davvero). */
    stagno: (() => { const r = cv.getBoundingClientRect(); return { x0: r.left + (SX / W) * r.width, y0: r.top + (SY / H) * r.height, k: r.width / W }; })(),
  }));
  registerTestHook('koiAuto', (on) => { auto = on !== false; if (auto) inizia(); return auto; });
  /** Test: gioca col pilota fino al tick dato e ferma lì (per gli screenshot a metà partita). */
  registerTestHook('koiFinoA', (n) => {
    if (!g) return false;
    inizia();
    const fino = Math.max(1, Math.min(mod.maxTicks - 1, Number(n) || 1));
    while (g.s.tick < fino && !g.s.done) {
      const f = quantize(mod.autopilot(g.s, autoRng)), s = g.s, prima = { punti: s.punti, rubati: s.rubati, spaventi: s.spaventi, tocchi: s.tocchi };
      g.prevA = f.a; g.frames.push(f); mod.step(s, f); effetti(g, prima);
    }
    acc = 0; render();
    return g.s.tick;
  });

  return {
    run({ seed, difficulty }) {
      if (open) return Promise.resolve(null);
      const d = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      return new Promise((finish) => {
        g = { s: mod.create({ seed, difficulty: d }), frames: [], taps: [], prevA: false, intro: !auto, end: -1, finish, scie: [], fx: [], stati: new Map(), fiori: [], comboPrima: 0, spaventi: 0 };
        scie(g);
        open = true; acc = 0; last = performance.now(); view = null; tAnim = 0;
        intro.style.display = auto ? 'none' : '';
        wrap.classList.add('on'); addEventListener('keydown', onKey, true);
        render(); raf = requestAnimationFrame(loop);
      });
    },
    isOpen: () => open,
    esito(detail) {
      const n = (k: string) => (typeof detail[k] === 'number' ? (detail[k] as number) : 0);
      return `${n('mangiati')} bocconi · ${n('punti')} punti${n('rubati') ? ` · ${n('rubati')} rubati` : ''}`;
    },
  };
}
