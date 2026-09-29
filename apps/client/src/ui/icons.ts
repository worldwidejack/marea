// Icone delle risorse a pixel (ART_BIBLE §9): Legno (tronco), Pietra (ciottolo), Perle (perla rosa). 8×8 celle → SVG nitido a qualsiasi scala.
import type { Resources } from '@marea/sim';
import { PAL } from './style.ts';

export type ResId = keyof Resources;
export const RES_IDS: readonly ResId[] = ['legno', 'pietra', 'perle'];
export const RES_NOME: Record<ResId, string> = { legno: 'Legno', pietra: 'Pietra', perle: 'Perle' };

const COL: Record<string, string> = {
  a: PAL.legnoChiaro, b: PAL.legno, c: PAL.legnoScuro, s: PAL.sabbia,
  p: PAL.pietraChiara, q: PAL.pietra, r: PAL.pietraScura, n: PAL.neroCaldo,
  k: PAL.rosaNeon, w: PAL.sabbiaChiara,
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

const cache = new Map<ResId, string>();
function svg(id: ResId): string {
  let s = cache.get(id);
  if (s) return s;
  const rows = ART[id];
  let rects = '';
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = COL[row[x] ?? '.']; if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; } });
  s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">${rects}</svg>`;
  cache.set(id, s);
  return s;
}

/** Icona come elemento <span> (px = lato in pixel CSS, multiplo di 8 per restare nitida). */
export function resIcon(id: ResId, px = 16): HTMLSpanElement {
  const e = document.createElement('span');
  e.className = 'mz-ico';
  e.style.width = e.style.height = px + 'px';
  e.innerHTML = svg(id); // SVG statico generato qui, nessun dato esterno
  const s = e.firstElementChild as SVGElement | null;
  if (s) { s.setAttribute('width', String(px)); s.setAttribute('height', String(px)); s.style.display = 'block'; }
  e.setAttribute('aria-label', RES_NOME[id]);
  return e;
}
