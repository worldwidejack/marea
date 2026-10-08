// Disegni a pixel del Diario del capitano (#87): perle, animali, medaglie, icone delle linguette (righe di caratteri → <canvas>) e la
// forma vera delle isole (un pixel per cella della mappa). Solo colori della palette; `ombra` = sagoma grigia di quello che manca.
import type { Tile } from '@marea/sim';
import type { DiarioCtx } from '../game/diario.ts';
import { PAL } from './style.ts';

const P = PAL;
export const MED_COL = { oro: P.giallo, argento: P.pietraChiara, bronzo: P.arancio } as const;

// ---------- pixel art piccola (righe di caratteri → <canvas>): perle, animali, medaglie, icone delle linguette ----------
export type Art = string[];
const C: Record<string, string> = {
  n: P.neroCaldo, w: P.sabbiaChiara, p: P.pietraChiara, q: P.pietra, r: P.pietraScura, R: P.rosso, O: P.arancio, Y: P.giallo,
  k: P.rosaNeon, v: P.viola, A: P.acqua, D: P.acquaProfonda, L: P.erbaChiara, g: P.erba, s: P.sabbia, c: P.legnoScuro, b: P.legno, a: P.legnoChiaro, x: P.roccia,
};
export const PERLE_ART: Record<string, Art> = {
  bianca: ['..nnnn..', '.nwwppn.', 'nwwwppqn', 'nwwppqqn', 'nppqqqqn', 'nqqqqqrn', '.nqqrrn.', '..nnnn..'],
  conchiglia: ['...nn...', '..nOOn..', '.nOsOsn.', 'nOsOsOsn', 'nsOsOsOn', 'nOsOsOsn', '.nnssnn.', '...nn...'],
  rosa: ['..nnnn..', '.nwkkkn.', 'nwwkkkRn', 'nwkkkkRn', 'nkkkkRRn', 'nkkkRRRn', '.nkRRRn.', '..nnnn..'],
  nera: ['..nnnn..', '.nvxxxn.', 'nvvxxxnn', 'nvxxxxnn', 'nxxxxnnn', 'nxxxnnnn', '.nxnnnn.', '..nnnn..'],
};
export const ANIMALI_ART: Record<string, Art> = {
  gabbiano: ['............', '.......nnn..', '......nwwnn.', '......wwnwOO', '..nqqnwwww..', '.nqqqqwwwwn.', 'nqqqqwwwwwn.', '..nnwwwwwn..', '....nnnnn...', '.....O.O....'],
  gatto: ['............', '.n.n........', 'nOnOn.......', 'nOOOn....nn.', 'nYOYn...nOn.', '.nOn....nOn.', '.nOOnnnnOn..', 'nObOObOOn...', 'nOOOOOOOn...', '.nn.nn.nn...'],
  granchio: ['.nn......nn.', 'nRRn....nRRn', 'nRn......nRn', '.nRn.nn.nRn.', '..nnwnnwnn..', '.nRRRRRRRRn.', 'nRRRRRRRRRRn', 'nROOOOOOOORn', '.nnRnnnnRnn.', '.n.n....n.n.'],
  pesce: ['............', '.....nnnn...', '...nnAAAAn.n', '..nAnAAAAAnA', '.nAAAAAAAAAn', '..nppppppAnA', '...nnppppn.n', '.....nnnn...', '..A.....A...', 'A...A..A..A.'],
  delfino: ['.......nn...', '......nDn...', '...nnnDDnnn.', '.nnDDDDDDDDn', 'nDnDDDDDDDDn', 'nDDppppDDnDn', '.nppppppn.nn', '..nnnnnn....', '..A..A..A...', 'A..A...A..A.'],
  lucciola: ['............', '.....LL.....', '...L....L...', '.....YY.....', '..L.YYYY.L..', '...YYwwYY...', '..L.YYYY.L..', '.....YY.....', '...L....L...', '.....LL.....'],
};
export const MEDAGLIA: Art = ['.RR..RR.', '..RRRR..', '...RR...', '..nnnn..', '.nmmmmn.', '.nmwmmn.', '.nmmmmn.', '..nnnn..'];
export const STELLA: Art = ['...nn...', '..nYYn..', 'nnnYYnnn', 'nYYYYYYn', '.nYYYYn.', '.nYnnYn.', 'nYn..nYn', 'nn....nn'];
export const ISOLA: Art = ['........', '...gg...', '..gggg..', '.sggggs.', 'AsssssA.', 'AAAAAAAA', '.AAAAAA.', '........'];
export const ZAMPA: Art = ['.n.n.n..', 'nwnwnwn.', '.n.n.n..', '..nnn...', '.nwwwn..', 'nwwwwwn.', '.nnnnn..', '........'];

export function artCanvas(rows: Art, scala: number, opz: { ombra?: boolean; col?: Record<string, string> } = {}): HTMLCanvasElement {
  const w = rows[0]?.length ?? 8, h = rows.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'mz-ico';
  c.style.width = w * scala + 'px'; c.style.height = h * scala + 'px'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (g) rows.forEach((r, y) => [...r].forEach((k, x) => {
    const col = opz.col?.[k] ?? C[k];
    if (!col) return;
    g.fillStyle = opz.ombra ? (k === 'n' ? P.roccia : P.pietraScura) : col; g.fillRect(x, y, 1, 1);
  }));
  return c;
}
export const medagliaCanvas = (m: 'oro' | 'argento' | 'bronzo' | null, scala = 3) => artCanvas(MEDAGLIA, scala, m ? { col: { m: MED_COL[m] } } : { ombra: true });

// ---------- isole: la forma vera, un pixel per cella della mappa ----------
const TILE_COL: Record<Tile, string> = { '~': P.acquaProfonda, ',': P.acqua, B: P.acqua, '.': P.sabbia, P: P.sabbia, L: P.sabbia, g: P.erba, r: P.roccia, d: P.legno };
export function isolaCanvas(ctx: DiarioCtx, id: string, vista: boolean): HTMLCanvasElement {
  const arch = ctx.world.archipelago, map = ctx.world.map;
  const lotto = id.startsWith('lotto:') ? ctx.owners.find((w) => `lotto:${w.id}` === id) : null;
  const p = lotto ? arch.places.find((q) => q.role === 'lotto' && q.slot === lotto.slot) : arch.places.find((q) => q.island === id && q.role !== 'lotto');
  const c = document.createElement('canvas'); c.className = 'mz-ico'; c.setAttribute('aria-hidden', 'true');
  if (!p) { c.width = c.height = 1; return c; }
  c.width = p.w; c.height = p.h;
  const k = Math.max(1, Math.floor(Math.min(64 / p.w, 44 / p.h)));
  c.style.width = p.w * k + 'px'; c.style.height = p.h * k + 'px';
  const g = c.getContext('2d');
  if (g) for (let z = 0; z < p.h; z++) for (let x = 0; x < p.w; x++) {
    const t = map.at(p.origin[0] + x, p.origin[1] + z);
    if (t === '~') continue; // il mare attorno resta trasparente: si vede la forma
    g.fillStyle = vista ? TILE_COL[t] ?? P.acqua : t === ',' || t === 'B' ? P.pietra : P.pietraScura;
    g.fillRect(x, z, 1, 1);
  }
  return c;
}
