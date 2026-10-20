// Disegni a pixel degli insetti di Borgo Marea (#445), 16×16 visti dall'alto, dalla forma e dai tre colori di insetti.json: li usano la
// pagina Insetti del Diario (ui/diario_ui.ts), lo zaino (rpg/items_ui.ts) e il cartello «Hai preso…» (game/insetti.ts). Solo palette.
// Ogni forma è la metà sinistra (8 colonne), specchiata. c corpo, p secondo colore, f accento, o occhio, k nero (zampe, antenne);
// il contorno nero caldo lo aggiunge il disegno attorno al pieno.
import type { InsettoDef, InsettoForma } from '@marea/content/insetti.ts';
import { PAL } from './style.ts';

export const IW = 16, IH = 16;
const MEZZI: Record<InsettoForma, string[]> = {
  farfalla: ['.....k..', '......k.', '.ccc...f', 'ccccc..f', 'cpcccc.f', 'cppcccff', 'cccccccf', '.cccccff', '..cccc.f', '..pccc.f', '.ppppcff', '.pppppcf', '..pppp.f', '...pp..f', '.......k', '........'],
  falena: ['......k.', '.......k', '.......f', '..cc...f', '.cccc.ff', 'ccpccccf', 'cppccccf', 'cccccccf', '.cccccff', '..ppccff', '...pppcf', '....pp.f', '.......f', '........', '........', '........'],
  ape: ['........', '.....k..', '......k.', '......pp', '.....ppp', '.ff..ccc', 'ffff.ccc', 'fffffppp', '.fffpccc', '..ff.ccc', '.....ppp', '.....ccc', '......pp', '.......p', '........', '........'],
  bombo: ['........', '......k.', '.....ppp', '....pppp', '.ff.cccc', 'ffffcccc', 'fffffccc', 'ffffpppp', '.ff.pppp', '....cccc', '....cccc', '.....fff', '......ff', '........', '........', '........'],
  libellula: ['......pp', '......pf', '.......p', 'ffffff.p', '.ffffffp', 'fffff..c', '.fffffcc', '.......c', '.......c', '.......c', '.......c', '.......c', '.......c', '.......c', '.......f', '........'],
  lucciola: ['........', '......k.', '.......k', '......pp', '.....ppp', '....cccc', '....cccc', '....cccc', '....cccc', '.....ccc', '.....fff', '.....fff', '......ff', '........', '........', '........'],
  coleottero: ['........', '.....k..', '......k.', '.....ppp', '....pppp', '.k.cccck', '..cfccck', '.kcccfck', '..ccccck', '.kcfccck', '..cccfck', '...ccccc', '....cccc', '.....ccc', '........', '........'],
  ercole: ['.......p', '.......p', '......pp', '.......p', '.....ppp', '....pppp', '.k.cccck', '..ccccck', '.kcfccck', '..ccccck', '.kcccfck', '..ccccck', '...ccccc', '....cccc', '.....ccc', '........'],
  cimice: ['........', '......k.', '......pp', '.....ppp', '.kcccccc', 'cccccccc', 'kccfcccc', '.ccccccc', '.kcccccc', '..cccccc', '..kccccc', '...ccccp', '....cccp', '.....ccp', '......cp', '........'],
  cicala: ['........', '....pppp', '...oappp', '...ppppp', '..fccccc', '.ffccccc', '.ffccccc', '.ffccccc', '.ffccccc', '.ffccccc', '..ffcccc', '..fffccc', '...fffcc', '....fff.', '........', '........'],
  formica: ['........', '....k...', '.....k..', '......cc', '.....ccc', '..k..ccc', '...k..pp', '..k..ppp', '...k..pp', '..k..ccc', '....cccc', '....cccc', '.....ccc', '......cc', '........', '........'],
  ragno: ['........', '.k......', '..k...k.', '...k.ppp', 'k...kppp', '.k...ppp', '..kkkccc', 'k...cccc', '.kkkcccc', '...kccfc', '..k.cccc', '.k...ccc', '......cc', '........', '........', '........'],
  scorpione: ['.pp.....', 'p..p....', '.pp.k...', '...k.ccc', '....kccc', '..k.cccc', '...kcccc', '..k.cccc', '...kcccc', '.....ccc', '.......p', '.......p', '.......p', '......pf', '......f.', '........'],
  bruco: ['.....ppp', '....fppp', '.....ccc', '....fccc', '.....ppp', '....fppp', '.....ccc', '....fccc', '.....ppp', '....fppp', '.....ccc', '....fccc', '......cc', '.......c', '........', '........'],
  centopiedi: ['....k.pp', '.....kpp', '...k..cc', '....kkcc', '...k..pp', '....kkpp', '...k..cc', '....kkcc', '...k..pp', '....kkpp', '...k..cc', '....kkcc', '...k..pp', '......pp', '.....f..', '....f...'],
  porcellino: ['........', '.....k..', '......k.', '.....ppp', '....cccc', '...ppppp', '..cccccc', '..pppppp', '..cccccc', '..pppppp', '...ccccc', '....pppp', '.....ccc', '........', '........', '........'],
  chiocciola: ['......p.', '.......p', '......pp', '.....ppp', '...ccccc', '..cfffff', '.cfccccc', '.cfcffff', '.cfcfccc', '.cfcffff', '.cfccccc', '..cfffff', '...ccccc', '.....ppp', '......pp', '........'],
  cavalletta: ['......k.', '.....k..', '......pp', '......pp', '.....ccc', '..k..ccc', '...k.ccc', '.....fcc', '....pfcc', '...p.fcc', '..p..fcc', '..p..fcc', '...p.fcc', '......cc', '.......c', '........'],
  mantide: ['........', '.....ppp', '......pp', '...f..cc', '..f..fcc', '...ff.cc', '......cc', '.....ccc', '......cc', '....k.cc', '.....kcc', '......cc', '....k.cc', '.....kcc', '......cc', '.......c'],
  foglia: ['.......f', '......cf', '.....ccf', '....cccf', '...ccccf', '..cpcccf', '..cppccf', '.ccppccf', '.cccpccf', '.ccccccf', '..ccccpf', '..cccppf', '...ccccf', '....cccf', '.....ccf', '.......f'],
  forbicina: ['......k.', '.....k..', '......pp', '......pp', '....k.cc', '.....kcc', '....k.cc', '.....kcc', '......cc', '......cc', '......cc', '......cc', '......f.', '.....f..', '.....f..', '......f.'],
  astuccio: ['.......k', '.......k', '.......k', '.....ccc', '....cpcc', '....ccpc', '....cpcc', '....ccpc', '....cpcc', '....ccpc', '....cccc', '.....ccc', '......ff', '......ff', '........', '........'],
  grillotalpa: ['........', '..ff..pp', '..fff.pp', '...ffppp', '....pppp', '....pppp', '.....ccc', '....cccc', '....cccc', '....cccc', '....cccc', '.....ccc', '......cc', '......k.', '.....k..', '........'],
};
const righe = (f: InsettoForma): string[] => {
  const g = MEZZI[f].map((r) => [...(r + [...r].reverse().join(''))]);
  const src = g.map((r) => [...r]); // il contorno si calcola sul disegno com'era, se no si allarga a macchia d'olio
  const pieno = (x: number, y: number) => { const ch = src[y]?.[x]; return ch !== undefined && ch !== '.' && ch !== 'k'; };
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) if (g[y]![x] === '.' && (pieno(x - 1, y) || pieno(x + 1, y) || pieno(x, y - 1) || pieno(x, y + 1))) g[y]![x] = 'K';
  return g.map((r) => r.join(''));
};
const cache = new Map<string, (string | null)[][]>();
/** Il disegno: una griglia 16×16 di colori (null = trasparente). */
export function spriteInsetto(d: InsettoDef): (string | null)[][] {
  const hit = cache.get(d.id);
  if (hit) return hit;
  const pal = PAL as Record<string, string>, [c, p, f] = d.colori.map((x) => pal[x] ?? PAL.pietra) as [string, string, string];
  const map: Record<string, string> = { c, p, f, k: PAL.neroCaldo, K: PAL.neroCaldo, o: PAL.neroCaldo, a: PAL.sabbiaChiara };
  const s = righe(d.forma).map((r) => [...r].map((ch) => map[ch] ?? null));
  cache.set(d.id, s);
  return s;
}
/** L'insetto in un <canvas> (16×16 pixel, `scala` px CSS per pixel); `ombra` = sagoma scura (non ancora preso). */
export function insettoCanvas(d: InsettoDef, scala = 2, ombra = false): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = IW; cv.height = IH; cv.className = 'mz-ico';
  cv.style.width = IW * scala + 'px'; cv.style.height = IH * scala + 'px'; cv.style.imageRendering = 'pixelated'; cv.setAttribute('aria-hidden', 'true');
  const g = cv.getContext('2d');
  if (g) spriteInsetto(d).forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = ombra ? (col === PAL.neroCaldo ? PAL.roccia : PAL.pietraScura) : col; g.fillRect(x, y, 1, 1); } }));
  return cv;
}
