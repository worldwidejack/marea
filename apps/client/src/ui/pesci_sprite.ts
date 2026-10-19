// Disegni a pixel dei pesci (#457), 20×12 visti di fianco (testa a sinistra), dalla forma e dai tre colori di pesci.json: li usano la
// pagina Pesci del Diario (ui/diario_ui.ts), lo zaino (rpg/items_ui.ts), il mobiliere e il cartello «Hai preso…» (game/pesca.ts).
// Solo colori della palette. c corpo, p pancia (o strisce), f pinne/accento, e bianco dell'occhio, o pupilla, W chiaro, Y giallo;
// il contorno nero caldo lo aggiunge il disegno attorno al pieno.
import type { PesceDef, PesceForma } from '@marea/content/pesci.ts';
import { PAL } from './style.ts';

const P = PAL;
type Col = keyof typeof PAL;
export const SW = 20, SH = 12;

// le forme fatte a mano (sono più facili da leggere che da calcolare); la riga più corta si allunga coi punti
const MANUALI: Partial<Record<PesceForma, string[]>> = {
  cavalluccio: ['.......cc...........', '......cccc..........', '....eocccc..........', '..cccccccc..........', '.......ccff.........', '.......cccff........', '.......ccccf........', '........cccf........', '.........ccc........', '.......c.ccc........', '.......cccc.........', '........cc..........'],
  seppia: ['....................', '....................', '..ffffffffffffff....', '.fcccccccccccccff...', 'pcceocccccccccccf...', 'pppcccccccccccccf...', 'pcpcccccccccccccf...', '.p.ppppppppppppf....', '..fffffffffffff.....', '....................', '....................', '....................'],
  calamaro: ['....................', '..p.p...............', '.p.p.pcccccccccff...', 'p.p.pccccccccccccff.', '.pppeoccccccccccccff', 'pppppccccccccccccccf', '.ppppccccccccccccff.', 'p.p.pcccccccccccff..', '.p.p..cccccccccf....', '..p.................', '....................', '....................'],
  polpo: ['.........ccc........', '.......ccccccc......', '......ccccccccc.....', '......cceocceoc.....', '......ccccccccc.....', '.......ccccccc......', '.....pcpcpcpcpcp....', '....pc.cp.cp.pc.p...', '...pc..p..cp..pc.p..', '...p..pc..p...p..p..', '..p...p...pc..p.....', '....................'],
  clione: ['....................', '........ccc.........', '.......cecoc........', '.......ccccc........', '...ff..ccccc..ff....', '..fffffcpppcfffff...', '...ff..cpppc..ff....', '.......cpppc........', '.......ccccc........', '........ccc.........', '.........c..........', '....................'],
  luna: ['.............f......', '...cccccccccff......', '..ccccccccccc.......', '.ceocccccccccc......', '.ccccccccccccc......', '.ccccccccccccf......', '.cppppppppppppf.....', '.cppppppppppp.......', '..pppppppppp........', '...ppppppppppf......', '.............ff.....', '....................'],
  squalo: ['....................', '..........f.........', '.........ff.........', '........fff.......f.', '..ccccccccccccc..ff.', '.ccoccccccccccccff..', 'cccccccccccccccccf..', '.pppppppppppccccff..', '...ppppp.pppcc...ff.', '.......f..f.......f.', '....................', '....................'],
};

function generata(forma: PesceForma): string[] {
  const g = Array.from({ length: SH }, () => Array.from({ length: SW }, () => '.'));
  const set = (x: number, y: number, ch: string) => { if (x >= 0 && y >= 0 && x < SW && y < SH) g[y]![x] = ch; };
  const at = (x: number, y: number) => g[y]?.[x];
  const lungo = forma === 'anguilla' || forma === 'remo', alto = forma === 'alto' || forma === 'sanpietro' || forma === 'lanterna' || forma === 'pagliaccio';
  const big = forma === 'tonno', palla = forma === 'palla';
  const cx = lungo ? 10 : big ? 9 : forma === 'aguglia' || forma === 'spada' ? 10 : 8, cy = 6;
  const rx = lungo ? 9 : big ? 7 : palla ? 5 : forma === 'aguglia' ? 6 : forma === 'piatto' ? 6.5 : alto ? 5 : 5.5;
  const ry = lungo ? 1.6 : forma === 'aguglia' ? 1.5 : forma === 'piatto' ? 2.1 : palla ? 4.6 : alto ? 4.3 : big ? 3.6 : 3.2;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) set(x, y, y >= cy + (palla ? 1 : 0) ? 'p' : 'c');
  }
  // coda: a ventaglio (quasi tutti), a forbice (tonni), nessuna (anguille: finiscono a punta)
  const x0 = Math.round(cx + rx) - 1;
  if (!lungo) {
    const tl = palla ? 2 : 3;
    for (let i = 0; i <= tl; i++) for (let y = cy - 1 - i; y <= cy + i; y++) {
      if (big && i >= 2 && y > cy - i && y < cy - 1 + i) continue; // la forbice del tonno
      if (at(x0 + i, y) === '.') set(x0 + i, y, 'f');
    }
  }
  // pinne sul dorso (le anguille: una pinna lunga; il pesce remo: la cresta a denti)
  const top = Math.ceil(cy - ry) - 1;
  if (lungo) { for (let x = 3; x < SW - 1; x++) if (forma !== 'remo' || x % 2 === 0) set(x, top + 1, 'f'); }
  else if (!palla && forma !== 'piatto') for (let x = cx - 1; x <= cx + 2; x++) set(x, top + (x === cx - 1 || x === cx + 2 ? 1 : 0), 'f');
  if (forma === 'remo') for (let x = 1; x <= 4; x++) set(x, top - (x % 2), 'f');
  if (big) for (let x = cx - 3; x <= cx + 5; x += 2) set(x, cy, 'f');
  if (forma === 'pesce') for (let x = cx; x <= cx + 3; x++) set(x, cy - 1, 'f');
  if (forma === 'pagliaccio') for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const ch = at(x, y);
    if (ch === 'c' || ch === 'p') set(x, y, x === cx - 2 || x === cx + 2 ? 'p' : 'c'); // bande bianche verticali su corpo pieno
  }
  if (forma === 'sanpietro') { set(cx, cy, 'f'); set(cx + 1, cy, 'f'); set(cx, cy - 1, 'f'); set(cx + 1, cy - 1, 'f'); }
  if (forma === 'piatto') for (const [x, y] of [[cx - 2, cy - 1], [cx + 1, cy], [cx + 3, cy - 1], [cx - 4, cy + 1]] as [number, number][]) set(x, y, 'f');
  if (palla) for (const [x, y] of [[cx - 5, cy - 3], [cx, cy - 6], [cx + 4, cy - 4], [cx - 6, cy + 1], [cx - 3, cy + 5], [cx + 2, cy + 5]] as [number, number][]) set(x, y, 'f');
  // occhio (le sogliole ne hanno due dalla stessa parte)
  const ex = Math.round(cx - rx * (lungo ? 0.82 : 0.55)), ey = cy - (palla || alto ? 2 : 1);
  set(ex, ey, 'o'); set(ex - 1, ey, 'e');
  if (forma === 'piatto') { set(ex + 2, ey - 1, 'o'); set(ex + 1, ey - 1, 'e'); }
  if (forma === 'lanterna') { set(cx - 2, top, 'k'); set(cx - 3, top - 1, 'k'); set(cx - 4, top - 1, 'k'); set(cx - 5, top, 'Y'); set(cx - 6, top, 'Y'); set(cx - 5, top + 1, 'Y'); set(cx - 6, top + 1, 'Y'); }
  const bocca = Math.round(cx - rx);
  if (forma === 'spada') for (let x = bocca - 6; x < bocca; x++) set(x, cy - 1, 'W');
  if (forma === 'aguglia') for (let x = bocca - 4; x < bocca; x++) set(x, cy - 1, 'f');
  return g.map((r) => r.join(''));
}

/** Le righe della forma col contorno (calcolato su una copia: se no si allarga a macchia d'olio). */
function righe(forma: PesceForma): string[] {
  const base = MANUALI[forma] ?? generata(forma);
  const g = base.slice(0, SH).map((r) => [...(r + '.'.repeat(SW)).slice(0, SW)]);
  while (g.length < SH) g.push([...'.'.repeat(SW)]);
  const src = g.map((r) => [...r]);
  const pieno = (x: number, y: number) => { const ch = src[y]?.[x]; return ch !== undefined && ch !== '.' && ch !== 'k'; };
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (g[y]![x] === '.' && (pieno(x - 1, y) || pieno(x + 1, y) || pieno(x, y - 1) || pieno(x, y + 1))) g[y]![x] = 'k';
  return g.map((r) => r.join(''));
}
const cache = new Map<string, (string | null)[][]>();
export function spritePesce(d: PesceDef): (string | null)[][] {
  let s = cache.get(d.id);
  if (s) return s;
  const [c, p, f] = d.colori.map((n) => P[n as Col] ?? P.pietra) as [string, string, string];
  const map: Record<string, string> = { k: P.neroCaldo, c, p, f, e: P.sabbiaChiara, o: P.neroCaldo, Y: P.giallo, W: P.pietraChiara };
  s = righe(d.forma).map((r) => [...r].map((ch) => map[ch] ?? null));
  cache.set(d.id, s);
  return s;
}

/** Il pesce in un <canvas> (20×12 pixel, `scala` px CSS per pixel); `ombra` = sagoma scura (pesce non ancora pescato). */
export function pesceCanvas(d: PesceDef, scala = 2, ombra = false): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH; c.className = 'mz-ico';
  c.style.width = SW * scala + 'px'; c.style.height = SH * scala + 'px'; c.style.imageRendering = 'pixelated'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (g) spritePesce(d).forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = ombra ? (col === P.neroCaldo ? P.roccia : P.pietraScura) : col; g.fillRect(x, y, 1, 1); } }));
  return c;
}
