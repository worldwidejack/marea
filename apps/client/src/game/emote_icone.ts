// Icone a pixel delle emote (16×16, colori della palette; il contorno nero caldo lo aggiunge outline()): fumetto, riga del telefono, ruota.
// Spezzato da game/emote.ts (#90) per stare sotto le 400 righe.
import type { EmoteId } from '@marea/protocol';
import { PAL } from '../ui/style.ts';

// ---- icone 16×16 a pixel: riempimenti in colori PAL; il contorno (nero caldo) lo aggiunge outline() attorno a ciò che è pieno ----
const COL: Record<string, string> = {
  y: PAL.giallo, r: PAL.rosso, h: PAL.sabbia, m: PAL.ombraCalda, o: PAL.neroCaldo, w: PAL.acquaBassa, p: PAL.sabbiaChiara, a: PAL.arancio, c: PAL.acqua,
};
type Px = (string | null)[][];
const grid = (): Px => Array.from({ length: 16 }, () => Array<string | null>(16).fill(null));
const fromRows = (rows: string[]): Px => rows.map((r) => [...r.padEnd(16, '.')].slice(0, 16).map((c) => (c === '.' ? null : c)));
function outline(g: Px): Px {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (g[y]![x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = g[y + dy]?.[x + dx];
      if (c && c !== 'w' && c !== 'o') { out[y]![x] = 'o'; break; }
    }
  }
  return out;
}
const ICONS: Record<EmoteId, () => Px> = {
  saluto: () => { // mano aperta che saluta, con due segni di movimento
    const g = grid(), fill = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y]![x] = 'h'; };
    fill(5, 8, 11, 12); fill(6, 13, 10, 14);
    fill(5, 4, 5, 7); fill(7, 2, 7, 7); fill(9, 2, 9, 7); fill(11, 4, 11, 7); fill(3, 9, 4, 10);
    for (const [x, y] of [[13, 3], [14, 2], [13, 6], [14, 6], [14, 9]] as const) g[y]![x] = 'w';
    return g;
  },
  esulta: () => fromRows([ // stella
    '................', '.......y........', '......yyy.......', '......yyy.......', '.....yyyyy......', '.yyyyyyyyyyyyy..',
    '..yyyyyyyyyyy...', '...yyyyyyyyy....', '....yyyyyyy.....', '....yyyyyyy.....', '...yyyy.yyyy....', '...yyy...yyy....',
    '..yyy.....yyy...', '..y.........y...', '................', '................',
  ]),
  ride: () => fromRows([ // faccina che ride a occhi chiusi
    '................', '.....oooooo.....', '...ooyyyyyyoo...', '..oyyyyyyyyyyo..', '.oyyyyyyyyyyyyo.', '.oyyyoyyyyoyyyo.',
    'oyyyoyoyyoyoyyyo', 'oyyyyyyyyyyyyyyo', 'oyyooooooooooyyo', '.oyyommmmmmoyyo.', '.oyyyomrrmoyyyo.', '..oyyyooooyyyo..',
    '...ooyyyyyyoo...', '.....oooooo.....', '................', '................',
  ]),
  no: () => { // croce rossa
    const g = grid();
    for (let i = 3; i <= 12; i++) for (const d of [0, 1]) { g[i]![Math.min(12, i + d)] = 'r'; g[i]![Math.max(3, 15 - i - d)] = 'r'; }
    return g;
  },
  applauso: () => fromRows([ // due mani aperte che battono, coi lampi del colpo in mezzo
    '................', '...w...ww...w...', '....w......w....', '.....hh..hh.....', '....hhh..hhh....', '...hhhh..hhhh...',
    '...hhhh..hhhh...', '..hhhhh..hhhhh..', '..hhhh....hhhh..', '..hhhh....hhhh..', '.hhhh......hhhh.', '.hhh........hhh.',
    '.ccc........ccc.', '.ccc........ccc.', '................', '................',
  ]),
  cuore: () => fromRows([ // cuore rosso col riflesso
    '................', '................', '...rrr....rrr...', '..rrrrr..rrrrr..', '.rrpprrrrrrrrrr.', '.rrprrrrrrrrrrr.',
    '.rrrrrrrrrrrrrr.', '.rrrrrrrrrrrrrr.', '..rrrrrrrrrrrr..', '...rrrrrrrrrr...', '....rrrrrrrr....', '.....rrrrrr.....',
    '......rrrr......', '.......rr.......', '................', '................',
  ]),
  sorpresa: () => fromRows([ // punto esclamativo
    '................', '......yyya......', '......yyya......', '......yyya......', '......yyya......', '......yyya......',
    '.......ya.......', '.......ya.......', '.......ya.......', '................', '................', '......yyya......',
    '......yyya......', '......yyya......', '................', '................',
  ]),
  balla: () => fromRows([ // due crome legate
    '................', '......cccccccc..', '..w...cccccccc..', '.w....c......c..', '......c......c..', '......c......c..',
    '......c......c..', '......c......c..', '...cccc...cccc..', '..ccccc..ccccc..', '..cccc...cccc...', '...cc.....cc....',
    '................', '................', '................', '................',
  ]),
};
/** Icona del bottone «altre» della riga: otto quadretti in cerchio, come la ruota. */
const ICON_RUOTA = (): Px => {
  const g = grid();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4, x = Math.round(7 + 5 * Math.cos(a)), y = Math.round(7 + 5 * Math.sin(a));
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) g[y + dy]![x + dx] = i === 0 ? 'y' : 'h';
  }
  return g;
};
const iconCache = new Map<EmoteId | 'ruota', Px>();
/** Icona 16×16 in un <canvas> (niente immagini): `size` px CSS, pixel netti. */
export function emoteIcon(id: EmoteId | 'ruota', size = 32): HTMLCanvasElement {
  let px = iconCache.get(id);
  if (!px) { px = outline(id === 'ruota' ? ICON_RUOTA() : ICONS[id]()); iconCache.set(id, px); }
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.className = 'mz-ico';
  c.style.width = c.style.height = size + 'px'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  if (g) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = px[y]![x]; if (k) { g.fillStyle = COL[k] ?? PAL.neroCaldo; g.fillRect(x, y, 1, 1); } }
  return c;
}
