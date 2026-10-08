// Sprite a pixel dei pesci (20×12) dalla forma e dai tre colori di pesca.json: li usano la schermata della Pesca (ui/pesca.ts) e il
// Diario del capitano (ui/diario_ui.ts, #87). Solo colori della palette.
import type { PescaPesce } from '@marea/content';
import { PAL } from './style.ts';

const P = PAL;
type Col = keyof typeof PAL;

// ---------- sprite dei pesci (20×12): k contorno, c corpo, p pancia, f pinne/accento, e bianco dell'occhio, o pupilla, Y giallo, W chiaro ----------
export const SW = 20, SH = 12;
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
export function sprite(p: PescaPesce): (string | null)[][] {
  let s = spriteCache.get(p.id);
  if (s) return s;
  const rows = MANUALI[p.forma] ?? pesceForma(p.forma);
  const [c, pp, f] = p.colori.map((n) => P[n as Col] ?? P.pietra) as [string, string, string];
  const map: Record<string, string> = { k: P.neroCaldo, c, p: pp, f, e: P.sabbiaChiara, o: P.neroCaldo, Y: P.giallo, W: P.pietraChiara };
  s = rows.map((r) => [...r].map((ch) => map[ch] ?? null));
  spriteCache.set(p.id, s);
  return s;
}

/** Il pesce in un <canvas> (20×12 pixel, `scala` px CSS per pixel); `ombra` = sagoma scura (pesce non ancora pescato). */
export function pesceCanvas(p: PescaPesce, scala = 2, ombra = false): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH; c.className = 'mz-ico';
  c.style.width = SW * scala + 'px'; c.style.height = SH * scala + 'px'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (g) sprite(p).forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = ombra ? (col === P.neroCaldo ? P.roccia : P.pietraScura) : col; g.fillRect(x, y, 1, 1); } }));
  return c;
}
