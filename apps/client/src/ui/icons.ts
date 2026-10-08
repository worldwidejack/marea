// Icone a pixel (ART_BIBLE §9): risorse (Legno, Pietra, Perle) e luoghi/azioni (casa, Porto, Regata, Scacchi, pesca, martello, ingresso dei dungeon, bussola delle mete). 8×8 celle → SVG nitido a qualsiasi scala.
import type { Resources } from '@marea/sim';
import { PAL } from './style.ts';

export type ResId = keyof Resources;
export const RES_IDS: readonly ResId[] = ['legno', 'pietra', 'perle'];
export const RES_NOME: Record<ResId, string> = { legno: 'Legno', pietra: 'Pietra', perle: 'Perle' };

const COL: Record<string, string> = {
  a: PAL.legnoChiaro, b: PAL.legno, c: PAL.legnoScuro, s: PAL.sabbia,
  p: PAL.pietraChiara, q: PAL.pietra, r: PAL.pietraScura, n: PAL.neroCaldo,
  k: PAL.rosaNeon, w: PAL.sabbiaChiara, R: PAL.rosso, Y: PAL.giallo, A: PAL.acqua, D: PAL.acquaProfonda,
};
const ART: Record<ResId, string[]> = {
  legno: [
    '........',
    '.cccccc.',
    'cssbbbbc',
    'sacbbbbc',
    'sacbbbbc',
    'cssbbbbc',
    '.cccccc.',
    '........',
  ],
  pietra: [
    '........',
    '..rrrr..',
    '.rppqqr.',
    'rpppqqqr',
    'rqpqqqrr',
    'rqqqqrrn',
    '.nrrrrn.',
    '........',
  ],
  perle: [
    '........',
    '..kkkk..',
    '.kwwkkk.',
    'kwwpkkkk',
    'kwpkkkkk',
    'kkkkkkrk',
    '.kkkkrk.',
    '..kkkk..',
  ],
};

/** Icone di luoghi e azioni (bussola, guida, cartelli degli slot). */
export type PixId = 'casa' | 'porto' | 'regata' | 'martello' | 'scacchi' | 'ingresso' | 'lanterna' | 'mete' | 'pesca';
const PIX: Record<PixId, string[]> = {
  casa: ['...RR...', '..RRRR..', '.RRRRRR.', 'RRRRRRRR', '.wwwwww.', '.wwccww.', '.wwccww.', '.wwccww.'],
  porto: ['RRRRRRRR', '.RRRRRR.', '..R..R..', 'RRRRRRRR', '..R..R..', '..R..R..', '..R..R..', '.cc..cc.'],
  regata: ['.c......', '.cRRRR..', '.cRRwRR.', '.cRRRR..', '.c......', '.c......', '.c......', 'ccc.....'],
  scacchi: ['.w.ww.w.', '.wwwwww.', '..wwww..', '..wwww..', '..wwww..', '..wwww..', '.wwwwww.', 'wwwwwwww'],
  ingresso: ['..rrrr..', '.rqqqqr.', 'rqnnnnqr', 'rqnnnnqr', 'rqnnnnqr', 'rqnnYnqr', 'rqnnnnqr', 'rrnnnnrr'], // bocca di un dungeon (Mondo Sotterraneo)
  lanterna: ['...nn...', '.nnnnnn.', 'nRRRRRRn', 'nRYYRRRn', 'nRYYRRRn', 'nRRRRRRn', '.nnnnnn.', '...YY...'], // lanterna di carta del molo del Porto
  mete: ['..YYYY..', '.YnRRnY.', 'YnnRRnnY', 'YnnRRnnY', 'YnnwwnnY', 'YnnwwnnY', '.YnwwnY.', '..YYYY..'], // bussola: ago rosso a nord (menù delle mete)
  pesca: ['........', '..DDD...', '.AAAAA.D', 'AnAAAADD', 'AAAAAADD', '.wwwwA.D', '..DDD...', '........'], // pesce (Pesca dalla barca, #66)
  martello: ['.qqqqqq.', 'rqqqqqqr', '.rrbbrr.', '...ba...', '...ba...', '...ba...', '...ba...', '...cc...'],
};

const cache = new Map<string, string>();
function svg(id: ResId | PixId): string {
  let s = cache.get(id);
  if (s) return s;
  const rows = (ART as Record<string, string[]>)[id] ?? PIX[id as PixId];
  let rects = '';
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = COL[row[x] ?? '.']; if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; } });
  s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">${rects}</svg>`;
  cache.set(id, s);
  return s;
}

function iconSpan(id: ResId | PixId, px: number): HTMLSpanElement {
  const e = document.createElement('span');
  e.className = 'mz-ico';
  e.style.width = e.style.height = px + 'px';
  e.innerHTML = svg(id); // SVG statico generato qui, nessun dato esterno
  const s = e.firstElementChild as SVGElement | null;
  if (s) { s.setAttribute('width', String(px)); s.setAttribute('height', String(px)); s.style.display = 'block'; }
  return e;
}
/** Icona di una risorsa come <span> (px = lato in pixel CSS, multiplo di 8 per restare nitida). */
export function resIcon(id: ResId, px = 16): HTMLSpanElement {
  const e = iconSpan(id, px);
  e.setAttribute('aria-label', RES_NOME[id]);
  return e;
}
/** Icona di luogo/azione come <span> (vedi PixId). */
export function pixIcon(id: PixId, px = 16): HTMLSpanElement {
  const e = iconSpan(id, px);
  e.setAttribute('aria-hidden', 'true');
  return e;
}
/** Disegna un'icona di luogo su una tela 2D (minimappa): 8×8 celle da `s` pixel, angolo in alto a sinistra in (x, y). */
export function drawPix(g: CanvasRenderingContext2D, id: PixId, x: number, y: number, s: number): void {
  PIX[id].forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const c = COL[row[xx] ?? '.']; if (c) { g.fillStyle = c; g.fillRect(x + xx * s, y + yy * s, s, s); } } });
}
