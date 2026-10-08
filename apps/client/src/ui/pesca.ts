// Pesca (#66): la schermata del minigioco, sopra il mondo (chunk scaricato alla prima partita). Una scenetta a pixel 160×96 vista dalla
// prua della barca: lanci, il galleggiante aspetta (a volte trema per finta), va sotto → TOCCA, poi la barra del recupero: tocchi quando è
// nel verde. Fa girare la sim `pesca` a 60 Hz (accumulatore suo), registra un InputFrame quantizzato per tick e alla fine restituisce
// packInputs(frames): punteggio e medaglia li decide il server. Il tempo parte dal primo tocco (prima c'è il cartello delle regole).
// Un pollice: si tocca ovunque (o Spazio / Invio / E / P). Esc o × = ritirati. Solo colori della palette (ART_BIBLE §2).
import { MINIGAMES_CFG } from '@marea/content';
import type { PescaPesce, PescaRarita } from '@marea/content';
import { MARI, PESCI, createRng, getMinigame, packInputs, quantize } from '@marea/sim';
import type { Difficulty, InputFrame, MinigameModule, PackedInputs, PescaView } from '@marea/sim';
import { PAL, el, injectUiStyle } from './style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { pescaFase } from '../audio/ponte.ts';

export type Pesca = {
  run(o: { seed: number; difficulty: number; opzioni?: Record<string, string> }): Promise<PackedInputs | null>;
  isOpen(): boolean;
  esito(detail: Record<string, unknown>): string;
};

const P = PAL;
type Col = keyof typeof PAL;
const CFG = MINIGAMES_CFG.pesca;
/** Scena 160×96: orizzonte a SEA, galleggiante in (FX, FY) (più vicino di qualche metro, così si vede bene sul telefono). */
const W = 160, H = 96, SEA = 34, FX = 112, FY = 54, TIP = { x: 64, y: 12 };
const END_HOLD = 96; // tick: «Tempo!» a schermo prima di chiudere
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const TAP: InputFrame = { mx: 0, my: 0, a: true, b: false };
const KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE', 'KeyP']);
const RAR_COL: Record<PescaRarita, string> = { comune: P.pietraChiara, noncomune: P.erba, raro: P.acquaBassa, leggendario: P.giallo };

const CSS = `
.mz-pe { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(22,63,115,.55); z-index: 28; touch-action: none; }
.mz-pe.on { display: flex; }
.mz-pe-box { width: min(440px, calc(100% - 12px)); max-height: calc(100% - 12px); overflow-y: auto; padding: 8px 8px 10px; background: rgba(46,30,20,.97); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; }
.mz-pe .mz-head { margin-bottom: 6px; }
.mz-pe .mz-title { font-size: 15px; }
.mz-pe .time { height: 10px; background: ${P.legnoScuro}; border: 2px solid ${P.neroCaldo}; margin-bottom: 6px; }
.mz-pe .time i { display: block; height: 100%; background: ${P.acqua}; }
.mz-pe .time.low i { background: ${P.rosso}; }
.mz-pe .scena { position: relative; border: 3px solid ${P.neroCaldo}; line-height: 0; }
.mz-pe canvas.sc { width: 100%; height: auto; aspect-ratio: ${W} / ${H}; image-rendering: pixelated; display: block; }
.mz-pe .rules { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(35,32,31,.72); line-height: 1.2; text-align: left; }
.mz-pe .rules div { width: min(88%, 300px); padding: 3px 8px; background: ${P.ombraCalda}; border: 2px solid ${P.legnoChiaro}; font-size: 13px; font-weight: bold; }
.mz-pe .rules b { color: ${P.giallo}; }
.mz-pe .rules .go { width: auto; border-color: ${P.giallo}; color: ${P.giallo}; margin-top: 2px; }
.mz-pe .rules .qui { display: flex; align-items: center; justify-content: center; gap: 3px; flex-wrap: wrap; padding: 2px 6px; font-size: 11px; color: ${P.sabbia}; }
.mz-pe .rules .qui canvas { width: 30px; height: 18px; image-rendering: pixelated; border-bottom: 2px solid var(--r); }
.mz-pe .status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 0; min-height: 40px; }
.mz-pe .msg { font-size: 16px; font-weight: bold; line-height: 1.2; }
.mz-pe .msg small { display: block; font-size: 12px; font-weight: normal; color: ${P.sabbia}; }
.mz-pe .msg.go { color: ${P.giallo}; } .mz-pe .msg.bad { color: ${P.rosso}; } .mz-pe .msg.ok { color: ${P.erbaChiara}; }
.mz-pe .pts { flex: none; text-align: right; font-size: 22px; font-weight: bold; color: ${P.giallo}; line-height: 1; }
.mz-pe .pts small { display: block; font-size: 11px; color: ${P.sabbia}; }
.mz-pe .secchio { display: flex; flex-wrap: wrap; gap: 2px; min-height: 26px; margin-top: 6px; padding: 2px; border: 2px dashed ${P.legno}; }
.mz-pe .secchio canvas { width: 40px; height: 24px; image-rendering: pixelated; }
.mz-pe .goal { margin-top: 4px; color: ${P.sabbia}; font-size: 12px; }
.mz-pe .act { width: 100%; min-height: 60px; margin-top: 8px; background: ${P.arancio}; color: ${P.neroCaldo}; border: 3px solid ${P.neroCaldo}; box-shadow: 0 5px 0 ${P.neroCaldo}; font: bold 22px ui-monospace, Menlo, monospace; letter-spacing: .08em; cursor: pointer; }
.mz-pe .act.wait { background: ${P.legnoScuro}; color: ${P.sabbia}; border-color: ${P.legnoChiaro}; }
.mz-pe .act.hot { background: ${P.giallo}; }
.mz-pe .act.reel { background: ${P.erba}; }
.mz-pe .act:active { transform: translateY(3px); box-shadow: 0 2px 0 ${P.neroCaldo}; }
`;

// ---------- sprite dei pesci (20×12): k contorno, c corpo, p pancia, f pinne/accento, e bianco dell'occhio, o pupilla, Y giallo, W chiaro ----------
const SW = 20, SH = 12;
const mirror = (half: string[]) => half.map((r) => r + [...r].reverse().join(''));
const MANUALI: Record<string, string[]> = {
  ciabatta: [
    '....................', '....................', '......kkkkkkk.......', '.....kcccccccckk....', '....kcfcfcfcfcccck..', '...kccccccccccccccck',
    '..kkkkkkkkkkkkkkkkkk', '..kppppppppppppppppk', '...kkkkkkkkkkkkkkkk.', '....................', '....................', '....................',
  ],
  granchio: mirror(['..kk......', '.kcck.....', '.kcfk.....', '..kck..ek.', '...kk..ok.', '....kkkkkk', '...kcccccc', '..kccpcccc', '..kccccccc', '...kkkkkkk', '...k.k.k..', '..k.k.k...']),
  polpo: mirror(['.......kkk', '.....kkccc', '....kccpcc', '....kccccc', '....kceocc', '....kccccc', '....kccccc', '...kcckccc', '..kcck.kcc', '..kck..kck', '..kk...kk.', '..........']),
};
function pesceForma(forma: string): string[] {
  const g = Array.from({ length: SH }, () => Array.from({ length: SW }, () => '.'));
  const big = forma === 'tonno', palla = forma === 'palla';
  const cx = palla ? 9 : big ? 9 : 8, cy = 6, rx = palla ? 5 : big ? 7 : 5.5, ry = palla ? 4.6 : big ? 3.6 : 3.2;
  const set = (x: number, y: number, ch: string) => { if (x >= 0 && y >= 0 && x < SW && y < SH) g[y]![x] = ch; };
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) set(x, y, y >= cy + (palla ? 1 : 0) ? 'p' : 'c');
  }
  // coda a ventaglio
  const x0 = Math.round(cx + rx) - 1, tl = palla ? 2 : big ? 3 : 3;
  for (let i = 0; i <= tl; i++) for (let y = cy - 1 - i; y <= cy + i; y++) if (g[y]?.[x0 + i] === '.') set(x0 + i, y, 'f');
  // pinna sul dorso e strisce
  const top = Math.ceil(cy - ry) - 1;
  for (let x = cx - 1; x <= cx + 2; x++) set(x, top + (x === cx - 1 || x === cx + 2 ? 1 : 0), 'f');
  if (big) for (let x = cx - 3; x <= cx + 5; x += 2) set(x, cy, 'f');
  if (forma === 'pesce') for (let x = cx; x <= cx + 3; x++) set(x, cy - 1, 'f');
  if (palla) for (const [x, y] of [[cx - 5, cy - 3], [cx, cy - 6], [cx + 4, cy - 4], [cx - 6, cy + 1], [cx - 3, cy + 5], [cx + 2, cy + 5]] as [number, number][]) set(x, y, 'f');
  // occhio
  const ex = Math.round(cx - rx * 0.55), ey = cy - (palla ? 2 : 1);
  set(ex, ey, 'o'); set(ex - 1, ey, 'e');
  if (forma === 'lanterna') { set(cx - 2, top, 'k'); set(cx - 3, top - 1, 'k'); set(cx - 4, top - 1, 'k'); set(cx - 5, top, 'Y'); set(cx - 6, top, 'Y'); set(cx - 5, top + 1, 'Y'); set(cx - 6, top + 1, 'Y'); }
  if (forma === 'spada') for (let x = Math.round(cx - rx) - 6; x < Math.round(cx - rx); x++) set(x, cy - 1, x % 2 === 0 && x < Math.round(cx - rx) - 4 ? '.' : 'W');
  // contorno
  const filled = (x: number, y: number) => { const ch = g[y]?.[x]; return ch !== undefined && ch !== '.' && ch !== 'k'; };
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (g[y]![x] === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g[y]![x] = 'k';
  return g.map((r) => r.join(''));
}
const spriteCache = new Map<string, (string | null)[][]>();
function sprite(p: PescaPesce): (string | null)[][] {
  let s = spriteCache.get(p.id);
  if (s) return s;
  const rows = MANUALI[p.forma] ?? pesceForma(p.forma);
  const [c, pp, f] = p.colori.map((n) => P[n as Col] ?? P.pietra) as [string, string, string];
  const map: Record<string, string> = { k: P.neroCaldo, c, p: pp, f, e: P.sabbiaChiara, o: P.neroCaldo, Y: P.giallo, W: P.pietraChiara };
  s = rows.map((r) => [...r].map((ch) => map[ch] ?? null));
  spriteCache.set(p.id, s);
  return s;
}
const pesceDi = (id: string | null) => PESCI.find((p) => p.id === id) ?? null;

// ---------- disegno ----------
function painter(g: CanvasRenderingContext2D) {
  const rect = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const px = (x: number, y: number, c: string) => rect(Math.round(x), Math.round(y), 1, 1, c);
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  };
  const spr = (s: (string | null)[][], x: number, y: number, k = 1) => { s.forEach((row, yy) => row.forEach((c, xx) => { if (c) rect(Math.round(x) + xx * k, Math.round(y) + yy * k, k, k, c); })); };
  return { rect, px, line, spr };
}
type Draw = ReturnType<typeof painter>;

function cielo(d: Draw, t: number, mare: string): void {
  d.rect(0, 0, W, SEA, P.acquaBassa);
  // sole a pixel e nuvole che scorrono piano
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 26) d.px(138 + x, 9 + y, x * x + y * y >= 17 ? P.arancio : P.giallo);
  for (const [cx0, cy, w] of [[20, 6, 14], [92, 4, 10], [60, 13, 8]] as [number, number, number][]) {
    const cx = ((cx0 + t * 3) % (W + 30)) - 15;
    d.rect(cx, cy, w, 2, P.pietraChiara); d.rect(cx + 2, cy - 1, w - 5, 1, P.pietraChiara); d.rect(cx + 1, cy + 2, w - 2, 1, P.sabbiaChiara);
  }
  // all'orizzonte: cosa si vede dal mare dove sei
  if (mare === 'porto') {
    d.rect(84, 22, 15, 2, P.rosso); d.rect(86, 26, 11, 1, P.rosso); d.rect(87, 24, 2, 10, P.rosso); d.rect(94, 24, 2, 10, P.rosso); // torii
    d.rect(104, 27, 18, 7, P.legnoScuro); d.rect(102, 25, 22, 2, P.rosso); d.rect(106, 23, 14, 2, P.rosso); d.rect(110, 21, 6, 2, P.rosso); // pagoda
    d.rect(124, 29, 10, 5, P.legno); d.rect(123, 28, 12, 1, P.legnoScuro); d.px(119, 29, P.giallo); d.px(108, 29, P.giallo);
    d.rect(76, 32, 64, 2, P.pietraScura);
  } else if (mare === 'laguna') {
    d.rect(70, 31, 66, 3, P.sabbia); d.rect(76, 30, 52, 1, P.erba);
    for (const [x, h] of [[84, 9], [97, 12], [118, 8]] as [number, number][]) {
      d.line(x, 30, x + 1, 30 - h, P.legno);
      const tx = x + 1, ty = 30 - h;
      d.rect(tx - 4, ty, 9, 1, P.erbaScura); d.rect(tx - 5, ty + 1, 3, 1, P.bosco); d.rect(tx + 3, ty + 1, 3, 1, P.bosco); d.rect(tx - 2, ty - 1, 5, 1, P.erba);
    }
  } else {
    d.rect(86, 31, 6, 1, P.legnoScuro); d.line(89, 24, 89, 30, P.legnoScuro);
    for (let i = 0; i < 6; i++) d.rect(90, 24 + i, Math.max(1, i), 1, P.pietraChiara);
  }
}
function mare(d: Draw, t: number): void {
  d.rect(0, SEA, W, 14, P.acqua);
  d.rect(0, SEA + 14, W, 24, P.acquaProfonda);
  d.rect(0, SEA + 38, W, H - SEA - 38, P.abisso);
  d.rect(0, SEA, W, 1, P.acquaBassa);
  // creste che scorrono: più veloci vicino a chi guarda
  const rows: [number, number, number, string][] = [[SEA + 3, 22, 4, P.acquaBassa], [SEA + 7, 27, 7, P.acquaBassa], [SEA + 11, 31, 10, P.acquaBassa], [SEA + 17, 37, 14, P.acqua], [SEA + 25, 43, 18, P.acqua], [SEA + 33, 47, 20, P.acqua], [SEA + 45, 50, 22, P.acquaProfonda], [SEA + 55, 56, 26, P.acquaProfonda]];
  for (const [y, gap, sp, c] of rows) {
    const off = Math.floor(t * sp) % gap;
    for (let x = -gap + off; x < W; x += gap) d.rect(x, y, Math.max(3, Math.floor(gap / 5)), 1, c);
  }
}
function barca(d: Draw): void {
  // prua in primo piano (in basso a sinistra), fasciame a righe
  for (let y = 46; y < H; y++) {
    const xr = 40 - Math.floor((y - 46) / 2.4);
    d.rect(0, y, xr, 1, (y - 46) % 7 === 0 ? P.legnoScuro : y < 50 ? P.legnoChiaro : P.legno);
    d.px(xr, y, P.ombraCalda);
  }
  d.rect(0, 45, 41, 1, P.ombraCalda);
  // canna: manico, mulinello, canna fino alla punta
  d.line(26, 52, 33, 40, P.neroCaldo); d.line(27, 52, 34, 40, P.neroCaldo);
  d.rect(29, 44, 3, 3, P.pietraScura); d.px(30, 45, P.pietraChiara);
  d.line(34, 40, TIP.x, TIP.y, P.legnoScuro);
}
function filo(d: Draw, x: number, y: number, sag: number): void {
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const u = i / n, mx = (TIP.x + x) / 2, my = (TIP.y + y) / 2 + sag;
    const qx = (1 - u) * (1 - u) * TIP.x + 2 * (1 - u) * u * mx + u * u * x, qy = (1 - u) * (1 - u) * TIP.y + 2 * (1 - u) * u * my + u * u * y;
    d.px(qx, qy, P.pietraChiara);
  }
}
/** Galleggiante 5×9 (punta, rosso, bianco), base in (x, y); `sotto` = pixel tirati sott'acqua. */
const FLOAT = ['..k..', '.kRk.', 'kRRRk', 'kRRRk', 'kRRRk', 'kWWWk', 'kWWWk', '.kWk.', '..k..'];
function galleggiante(d: Draw, x: number, y: number, sotto = 0): void {
  const n = FLOAT.length;
  FLOAT.forEach((row, yy) => { if (yy + sotto >= n) return; [...row].forEach((ch, xx) => { if (ch !== '.') d.px(x - 2 + xx, y - n + 1 + yy + sotto, ch === 'k' ? P.neroCaldo : ch === 'R' ? P.rosso : P.sabbiaChiara); }); });
}
function onde(d: Draw, x: number, r: number, c: string): void {
  d.rect(x - r, FY + 1, 3, 1, c); d.rect(x + r - 2, FY + 1, 3, 1, c);
  if (r > 3) { d.rect(x - r + 2, FY + 2, 3, 1, c); d.rect(x + r - 4, FY + 2, 3, 1, c); }
}
function ombra(d: Draw, x: number, y: number, w: number): void {
  d.rect(x - w, y, w * 2, 2, P.abisso); d.rect(x - w + 1, y - 1, w * 2 - 3, 1, P.abisso); d.rect(x + w, y - 1, 2, 4, P.abisso);
}
function bang(d: Draw, x: number, y: number): void {
  d.rect(x - 2, y - 1, 5, 10, P.neroCaldo); d.rect(x - 1, y, 3, 5, P.giallo); d.rect(x - 1, y + 6, 3, 2, P.giallo);
}
function barra(d: Draw, v: PescaView): void {
  const x0 = 8, y0 = 74, w = 144, inner = 136;
  const flash = v.ultimoTocco && v.ultimoTocco.fa < 12 ? (v.ultimoTocco.ok ? P.giallo : P.rosso) : P.legnoChiaro;
  d.rect(x0, y0, w, 18, P.ombraCalda); d.rect(x0, y0, w, 1, flash); d.rect(x0, y0 + 17, w, 1, flash); d.rect(x0, y0, 1, 18, flash); d.rect(x0 + w - 1, y0, 1, 18, flash);
  d.rect(x0 + 4, y0 + 6, inner, 7, P.legnoScuro);
  if (v.zona) {
    const a = x0 + 4 + Math.round(((v.zona.c - v.zona.w / 2) / 1000) * inner), b = x0 + 4 + Math.round(((v.zona.c + v.zona.w / 2) / 1000) * inner);
    d.rect(a, y0 + 6, b - a, 7, P.erba); d.rect(a, y0 + 6, b - a, 1, P.erbaChiara); d.rect(a, y0 + 12, b - a, 1, P.erbaScura);
  }
  const cx = x0 + 4 + Math.round((v.cursore / 1000) * (inner - 1));
  d.rect(cx - 2, y0 + 3, 5, 13, P.neroCaldo); d.rect(cx - 1, y0 + 4, 3, 11, P.sabbiaChiara);
  // colpi (quadrati) a destra, filo (tacche) a sinistra
  for (let i = 0; i < v.colpiServono; i++) { const x = x0 + w - 8 - i * 7; d.rect(x, y0 - 7, 6, 6, P.neroCaldo); d.rect(x + 1, y0 - 6, 4, 4, i < v.colpi ? P.giallo : P.legnoScuro); }
  for (let i = 0; i <= v.strappiMax; i++) { const x = x0 + 1 + i * 7; d.rect(x, y0 - 5, 6, 3, P.neroCaldo); d.rect(x + 1, y0 - 4, 4, 1, i < v.strappiMax + 1 - v.strappi ? P.pietraChiara : P.rosso); }
}
function cartellino(d: Draw, v: PescaView, t: number): void {
  const p = pesceDi(v.pesce);
  if (!p) return;
  const col = RAR_COL[p.rarita], x0 = 44, y0 = 10, w = 72, h = 50;
  if (p.rarita === 'leggendario' || p.rarita === 'raro') for (let i = 0; i < 12; i++) { // raggi
    const a = (i / 12) * Math.PI * 2 + t * 0.8;
    d.line(80 + Math.cos(a) * 30, 35 + Math.sin(a) * 26, 80 + Math.cos(a) * 44, 35 + Math.sin(a) * 34, col);
  }
  d.rect(x0 - 1, y0 - 1, w + 2, h + 2, P.neroCaldo); d.rect(x0, y0, w, h, col); d.rect(x0 + 2, y0 + 2, w - 4, h - 4, P.ombraCalda);
  const bob = Math.floor(t * 4) % 2;
  d.spr(sprite(p), 80 - SW * 1.5, 35 - SH * 1.5 + bob, 3);
}

export function createPesca(o: { root: HTMLElement }): Pesca {
  injectUiStyle();
  if (!document.getElementById('mz-pesca-style')) { const st = document.createElement('style'); st.id = 'mz-pesca-style'; st.textContent = CSS; document.head.appendChild(st); }
  const mod = getMinigame('pesca') as MinigameModule<unknown>;
  const wrap = el('div', 'mz mz-pe'); wrap.id = 'mzPescaGioco';
  const box = el('div', 'mz-pe-box'); wrap.appendChild(box);
  o.root.appendChild(wrap);

  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Ritirati');
  const head = el('div', 'mz-head'); const title = el('div', 'mz-title', CFG.nome); head.append(title, x);
  const time = el('div', 'time'); const bar = document.createElement('i'); time.appendChild(bar);
  const scena = el('div', 'scena');
  const cv = document.createElement('canvas'); cv.className = 'sc'; cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false;
  const d = painter(g);
  const rules = el('div', 'rules');
  const qui = el('div', 'qui');
  rules.append(el('div', '', ''), el('div', '', ''), el('div', '', ''), qui, el('div', 'go', 'TOCCA PER INIZIARE'));
  (rules.children[0] as HTMLElement).innerHTML = '1 · <b>TOCCA</b>: lanci la lenza';
  (rules.children[1] as HTMLElement).innerHTML = '2 · Va sotto? <b>TOCCA SUBITO</b>';
  (rules.children[2] as HTMLElement).innerHTML = '3 · <b>TOCCA</b> quando la barra è nel verde';
  scena.append(cv, rules);
  const msg = el('div', 'msg'); const pts = el('div', 'pts');
  const status = el('div', 'status'); status.append(msg, pts);
  const secchio = el('div', 'secchio');
  const goal = el('div', 'goal', `${CFG.maxSeconds} s · Bronzo ${CFG.medaglie.bronzo} · Argento ${CFG.medaglie.argento} · Oro ${CFG.medaglie.oro} punti`);
  const act = el('button', 'act', 'LANCIA'); act.type = 'button'; act.id = 'mzPescaTocca';
  box.append(head, time, scena, status, secchio, goal, act);

  type Game = { s: unknown; frames: InputFrame[]; queue: number; prevA: boolean; intro: boolean; end: number; mare: string; finish(v: PackedInputs | null): void };
  let gm: Game | null = null, open = false, auto = false, raf = 0, last = 0, acc = 0, view: PescaView | null = null, nSecchio = 0, tAnim = 0;
  const autoRng = createRng('pesca-auto');

  function tap(): void {
    if (!gm || auto || gm.end >= 0) return;
    if (gm.intro) { gm.intro = false; rules.style.display = 'none'; }
    if (gm.queue < 2) gm.queue++;
  }
  // un pollice: si tocca ovunque sopra il mondo (tranne la ×)
  wrap.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === x) return; e.preventDefault(); tap(); });
  for (const ev of ['touchstart', 'wheel']) wrap.addEventListener(ev, (e) => e.stopPropagation());
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(null); return; }
    if (KEYS.has(e.code)) { e.preventDefault(); if (!e.repeat) tap(); }
  };
  x.addEventListener('click', () => close(null));

  function tick(): void {
    if (!gm || gm.intro) return;
    if (gm.end >= 0) { if (++gm.end >= END_HOLD) close(packInputs(gm.frames)); return; }
    let f: InputFrame = NO;
    if (auto) f = mod.autopilot(gm.s, autoRng);
    else if (!gm.prevA && gm.queue > 0) { gm.queue--; f = TAP; }
    f = quantize(f); gm.prevA = f.a;
    gm.frames.push(f); mod.step(gm.s, f);
    if (mod.result(gm.s).done) gm.end = 0;
  }
  function frase(v: PescaView): [string, string, string] {
    if (v.done) return ['Tempo!', `${v.presi.length} pesci nel secchio`, 'go'];
    const p = pesceDi(v.pesce);
    switch (v.fase) {
      case 'pronto': return ['Tocca per lanciare', '', 'go'];
      case 'lancio': return ['Lancio…', '', ''];
      case 'attesa': return v.finta ? ['Trema… non ancora!', 'aspetta che vada sotto', ''] : ['Aspetta…', 'quando va sotto, tocca', ''];
      case 'abbocca': return ['ABBOCCA! TOCCA!', '', 'go'];
      case 'recupero': return [`${v.rarita ? CFG.rarita[v.rarita].nome.toUpperCase() : ''}! Tocca sul verde`, `${v.colpi}/${v.colpiServono} · non strappare il filo`, 'go'];
      case 'preso': return p ? [`${p.nome}! +${CFG.rarita[p.rarita].punti}`, p.battuta, 'ok'] : ['Preso!', '', 'ok'];
      case 'presto': return ['Troppo presto!', 'l\'hai spaventato', 'bad'];
      case 'scappato': return [v.perche === 'lento' ? 'Troppo lento!' : v.perche === 'strappi' ? 'Filo strappato!' : 'Si è stancato prima lui', 'è scappato', 'bad'];
    }
  }
  function disegna(v: PescaView | null): void {
    const t = tAnim, mareId = v?.mare ?? gm?.mare ?? CFG.mareDiSerie;
    cielo(d, t, mareId); mare(d, t);
    const fase = v?.fase ?? 'pronto', ft = v?.faseT ?? 0;
    // ombra del pesce che gira sotto il galleggiante mentre aspetti
    if (fase === 'attesa' || fase === 'abbocca') ombra(d, FX + Math.round(Math.sin(t * 1.3) * 14) + (fase === 'abbocca' ? 0 : 6), FY + 12 + Math.round(Math.sin(t * 0.7) * 3), 6);
    if (fase === 'scappato' || fase === 'presto') ombra(d, FX + 10 + ft, FY + 10 + Math.floor(ft / 4), 5);
    barca(d);
    let fx = TIP.x, fy = TIP.y + 12, sag = 0, sotto = 0;
    if (fase === 'lancio') {
      const u = Math.min(1, ft / Math.max(1, Math.round(CFG.lancioSecondi * 60)));
      fx = TIP.x + (FX - TIP.x) * u; fy = TIP.y + 12 + (FY - TIP.y - 12) * u - 60 * u * (1 - u); sag = 2;
    } else if (fase === 'attesa' || fase === 'abbocca' || fase === 'recupero') {
      fx = FX; fy = FY + (Math.floor(t * 2) % 2); sag = fase === 'recupero' ? 0 : 8;
      if (fase === 'attesa') onde(d, FX, 4, P.acqua);
      if (v?.finta) { fx += Math.floor(t * 20) % 2 ? 1 : -1; onde(d, FX, 4 + (Math.floor(t * 12) % 4), P.acquaBassa); }
      if (fase === 'abbocca') { sotto = 5; fy = FY + 1; onde(d, FX, 5 + (ft % 9), P.sabbiaChiara); onde(d, FX, 3 + ((ft + 4) % 9), P.acquaBassa); }
    } else if (fase === 'scappato' || fase === 'presto') { fx = FX - 8 - Math.min(30, ft); fy = FY + 1; sag = 4; }
    if (fase === 'recupero' && v) {
      // il pesce si dibatte: spruzzi e coda fuori dall'acqua
      const k = Math.floor(t * 10) % 2, col = v.rarita ? RAR_COL[v.rarita] : P.sabbiaChiara;
      onde(d, FX, 6 + k * 2, P.sabbiaChiara); onde(d, FX, 3 + k, P.acquaBassa);
      d.rect(FX - 6 + k * 11, FY - 5, 2, 2, P.sabbiaChiara); d.rect(FX + 5 - k * 10, FY - 8, 2, 2, P.sabbiaChiara); d.px(FX - 1 + k * 3, FY - 10, P.sabbiaChiara);
      // coda che sbatte fuori dall'acqua, del colore della rarità
      d.rect(FX - 3 + k * 2, FY - 2, 5, 3, P.neroCaldo); d.rect(FX - 2 + k * 2, FY - 1, 3, 2, col); d.rect(FX - 4 + k * 5, FY - 5, 3, 3, P.neroCaldo); d.px(FX - 3 + k * 5, FY - 4, col);
      filo(d, FX, FY - 2, 0);
      barra(d, v);
    } else {
      filo(d, fx, fy - 4 + sotto, sag);
      if (fase !== 'preso') galleggiante(d, fx, fy, sotto);
    }
    if (fase === 'abbocca') bang(d, FX, FY - 22 - (Math.floor(t * 8) % 2));
    if (fase === 'preso' && v) cartellino(d, v, t);
  }
  function render(): void {
    if (!gm) return;
    const v = view = gm.intro ? null : (mod.view(gm.s) as PescaView);
    disegna(v); pescaFase(v?.fase ?? null);
    const ms = v?.ms ?? 0, maxMs = v?.maxMs ?? CFG.maxSeconds * 1000;
    bar.style.width = `${Math.max(0, 100 - (ms / maxMs) * 100)}%`;
    time.classList.toggle('low', maxMs - ms < 10_000);
    const [a, b, cls] = v ? frase(v) : ['Pronti?', 'il tempo parte al primo tocco', 'go'];
    const html = `${a}${b ? `<small>${b}</small>` : ''}`;
    if (msg.dataset['h'] !== html) { msg.dataset['h'] = html; msg.replaceChildren(document.createTextNode(a)); if (b) msg.appendChild(el('small', '', b)); msg.className = 'msg ' + cls; }
    const ptxt = String(v?.punti ?? 0);
    if (pts.dataset['p'] !== ptxt) { pts.dataset['p'] = ptxt; pts.replaceChildren(document.createTextNode(ptxt), el('small', '', 'PUNTI')); }
    const presi = v?.presi ?? [];
    while (nSecchio < presi.length) { const p = pesceDi(presi[nSecchio]!); nSecchio++; if (!p) continue; const c = document.createElement('canvas'); c.width = SW; c.height = SH; c.title = p.nome; painter(c.getContext('2d')!).spr(sprite(p), 0, 0); secchio.appendChild(c); }
    const fase = v?.fase ?? 'pronto';
    const [lab, kind] = !v ? ['VIA!', ''] : v.done ? ['FINE', 'wait'] : fase === 'pronto' ? ['LANCIA', ''] : fase === 'abbocca' ? ['TIRA!', 'hot'] : fase === 'recupero' ? ['RECUPERA', 'reel'] : fase === 'lancio' || fase === 'attesa' ? ['ASPETTA…', 'wait'] : ['…', 'wait'];
    if (act.textContent !== lab) act.textContent = lab;
    act.className = 'act' + (kind ? ' ' + kind : '');
  }
  function loop(now: number): void {
    if (!open) return;
    const dt = Math.min(0.25, (now - last) / 1000); last = now; tAnim += dt;
    if (auto) for (let i = 0; i < 120 && open; i++) tick(); // test: una partita intera in pochi secondi
    else { acc += dt; while (acc >= 1 / 60 && open) { acc -= 1 / 60; tick(); } }
    if (open) { render(); raf = requestAnimationFrame(loop); }
  }
  function close(v: PackedInputs | null): void {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); wrap.classList.remove('on'); removeEventListener('keydown', onKey, true);
    const done = gm; gm = null; done?.finish(v);
  }

  registerStateProvider('pesca', () => ({ open, auto, intro: gm?.intro ?? false, mare: gm?.mare ?? null, view: view && { fase: view.fase, punti: view.punti, presi: view.presi, done: view.done, ms: view.ms } }));
  registerTestHook('pescaAuto', (on) => { auto = on !== false; if (auto && gm?.intro) { gm.intro = false; rules.style.display = 'none'; } return auto; });
  /** Test: ferma la scena in una fase per lo screenshot (gioca col pilota finché non ci arriva). */
  registerTestHook('pescaFinoA', (f) => {
    if (!gm) return false;
    if (gm.intro) { gm.intro = false; rules.style.display = 'none'; }
    for (let i = 0; i < 4000 && gm.end < 0; i++) { if ((mod.view(gm.s) as PescaView).fase === f) { render(); return true; } const fr = quantize(mod.autopilot(gm.s, autoRng)); gm.prevA = fr.a; gm.frames.push(fr); mod.step(gm.s, fr); }
    return false;
  });

  return {
    run({ seed, difficulty, opzioni }) {
      if (open) return Promise.resolve(null);
      const dd = (Math.round(difficulty) >= 1 && Math.round(difficulty) <= 3 ? Math.round(difficulty) : 2) as Difficulty;
      const mareId = typeof opzioni?.['mare'] === 'string' && MARI.includes(opzioni['mare']) ? opzioni['mare'] : CFG.mareDiSerie;
      return new Promise((finish) => {
        gm = { s: mod.create({ seed, difficulty: dd, opzioni: { mare: mareId } }), frames: [], queue: 0, prevA: false, intro: !auto, end: -1, mare: mareId, finish };
        open = true; acc = 0; last = performance.now(); view = null; nSecchio = 0; secchio.replaceChildren();
        title.textContent = `${CFG.nome} · ${CFG.mari[mareId]?.nome ?? ''}`;
        rules.style.display = auto ? 'none' : '';
        // i pesci di questo mare, col colore della rarità sotto (dal più comune al leggendario)
        qui.replaceChildren(document.createTextNode('Qui:'));
        for (const id of CFG.mari[mareId]?.pesci ?? []) { const p = pesceDi(id); if (!p) continue; const c = document.createElement('canvas'); c.width = SW; c.height = SH; c.title = p.nome; c.style.setProperty('--r', RAR_COL[p.rarita]); painter(c.getContext('2d')!).spr(sprite(p), 0, 0); qui.appendChild(c); }
        wrap.classList.add('on'); addEventListener('keydown', onKey, true);
        render(); raf = requestAnimationFrame(loop);
      });
    },
    isOpen: () => open,
    esito(detail) {
      const mareNome = CFG.mari[MARI[Number(detail['mare'] ?? 0)] ?? CFG.mareDiSerie]?.nome ?? '';
      return `${Number(detail['pesci'] ?? 0)} pesci · ${Number(detail['punti'] ?? 0)} punti · ${mareNome}`;
    },
  };
}
