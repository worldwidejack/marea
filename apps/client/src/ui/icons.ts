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
  C: PAL.acquaBassa, O: PAL.arancio, E: PAL.erbaScura,
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
export type PixId = 'casa' | 'porto' | 'regata' | 'martello' | 'scacchi' | 'ingresso' | 'lanterna' | 'mete' | 'pesca'
  | 'mercante' | 'bacheca' | 'parla' | 'contrabbando' // Porto (#63-#65), Contrabbandiere
  | 'tempesta' | 'ghiacci' | 'vulcano' | 'giardino' | 'lucchetto' // Isole a tema (#68)
  | 'consegne' // Consegne
  | 'ingorgo' // Ingorgo
  | 'perle' // Perle
  | 'pinguini' // Ghiacci
  | 'koi' // Giardino
  | 'arrembaggio' // Tempesta: nave pirata dell'Arrembaggio
  | 'lava' // Vulcano: fiamma sul basalto della Fuga dalla lava
  | 'isole' // sezione «Isole» della bussola
  | 'libro' // libro degli ospiti (#86)
  | 'record' | 'faro'; // Porto tra amici (#110 #111): coppa del tabellone, Faro comune
const PIX: Record<PixId, string[]> = {
  casa: ['...RR...', '..RRRR..', '.RRRRRR.', 'RRRRRRRR', '.wwwwww.', '.wwccww.', '.wwccww.', '.wwccww.'],
  porto: ['RRRRRRRR', '.RRRRRR.', '..R..R..', 'RRRRRRRR', '..R..R..', '..R..R..', '..R..R..', '.cc..cc.'],
  regata: ['.c......', '.cRRRR..', '.cRRwRR.', '.cRRRR..', '.c......', '.c......', '.c......', 'ccc.....'],
  scacchi: ['.w.ww.w.', '.wwwwww.', '..wwww..', '..wwww..', '..wwww..', '..wwww..', '.wwwwww.', 'wwwwwwww'],
  ingresso: ['..rrrr..', '.rqqqqr.', 'rqnnnnqr', 'rqnnnnqr', 'rqnnnnqr', 'rqnnYnqr', 'rqnnnnqr', 'rrnnnnrr'], // bocca di un dungeon (Mondo Sotterraneo)
  lanterna: ['...nn...', '.nnnnnn.', 'nRRRRRRn', 'nRYYRRRn', 'nRYYRRRn', 'nRRRRRRn', '.nnnnnn.', '...YY...'], // lanterna di carta del molo del Porto
  mete: ['..YYYY..', '.YnRRnY.', 'YnnRRnnY', 'YnnRRnnY', 'YnnwwnnY', 'YnnwwnnY', '.YnwwnY.', '..YYYY..'], // bussola: ago rosso a nord (menù delle mete)
  pesca: ['........', '..DDD...', '.AAAAA.D', 'AnAAAADD', 'AAAAAADD', '.wwwwA.D', '..DDD...', '........'], // pesce (Pesca dalla barca, #66)
  contrabbando: ['...cc...', '..crrc..', '.rnnnnr.', 'rnnnnnnr', 'rnnnnnnr', 'rnnnnYYY', '.rnnYOOY', '..rrYYYY'], // sacco scuro e monete d'oro (Contrabbandiere)
  mercante: ['..cccc..', '.c....c.', 'aaaaaaaa', 'abbbbbba', 'abpwwpba', 'abpwwpba', 'abbppbba', '.aaaaaa.'], // sacchetto con le Perle (Mercante del Porto)
  bacheca: ['cccccccc', 'cwwRawwc', 'cwwawwwc', 'cawwRwwc', 'cwwwawwc', 'cccccccc', '.c....c.', '.c....c.'], // bacheca con i foglietti delle missioni
  parla: ['.wwwwww.', 'wwwwwwww', 'wnwnwnww', 'wwwwwwww', '.wwwwww.', '..ww....', '.ww.....', '........'], // fumetto: parla con la gente del Porto
  arrembaggio: ['...R....', '...nn...', '..nnnn..', '.nnpnnn.', '.nnnnnn.', '...b....', 'bbbbbbbb', '.cccccc.'], // Tempesta: nave pirata dalla vela nera
  lava: ['...Y....', '..YOY...', '.YOROY..', '.ORRRO..', '..ORO...', 'rrrrrrrr', 'rnrrnrrn', 'nnnnnnnn'], // Vulcano: fiamma di lava sul basalto
  perle: ['..pppp..', '.pwwppq.', '.pwpppq.', '.ppppqq.', '..qqqq..', 'rr....rr', 'rqqrrqqr', '.rrrrrr.'], // perla sulla conchiglia aperta (Perle)
  isole: ['..EEE...', '.E.bEE..', '....b...', '....b...', '..ssbss.', '.ssssss.', 'AAAAAAAA', '.AA..AA.'], // isoletta con la palma (sezione «Isole» delle mete)
  // isole a tema (#68): fulmine dalla nuvola, fiocco di neve, vulcano che fuma lava, fiore di ciliegio; lucchetto = isola chiusa
  tempesta: ['..nnnn..', '.nrrrrn.', 'nrrrrrrn', '.nnnYnn.', '...YY...', '..YYYY..', '....YY..', '....Y...'],
  ghiacci: ['...p....', '.C.p.C..', '..ppp...', 'ppppppp.', '..ppp...', '.C.p.C..', '...p....', '........'],
  vulcano: ['..R.O...', '...OR...', '..nOOn..', '..nnnn..', '.nnrnnn.', '.nnnnrn.', 'nnrnnnnn', 'nnnnnnnn'],
  giardino: ['...kk...', '.kkkkkk.', '.kkYYkk.', 'kkkYYkkk', '.kkkkkk.', '...kk...', '...EE...', '..EEEE..'],
  lucchetto: ['..rrrr..', '.r....r.', '.r....r.', 'YYYYYYYY', 'YYYnnYYY', 'YYYnnYYY', 'YYYYYYYY', '.YYYYYY.'],
  libro: ['........', '.ww..ww.', 'wqqwwqqw', 'wwwRwwww', 'wqqRwqqw', 'wwwRwwww', 'cccccccc', '........'], // libro degli ospiti aperto, col nastro rosso (#86)
  record: ['.YYYYYY.', 'YYwYYYYY', 'Y.YwYY.Y', '.YYYYYY.', '..YYYY..', '...YY...', '..cccc..', '.cccccc.'], // coppa del Tabellone dei record (#110)
  faro: ['...YY...', '..nYYn..', '..RRRR..', '..wwww..', '..RRRR..', '..wwww..', '.RRRRRR.', 'rrrrrrrr'], // Faro comune del Porto (#111)
  martello: ['.qqqqqq.', 'rqqqqqqr', '.rrbbrr.', '...ba...', '...ba...', '...ba...', '...ba...', '...cc...'],
  consegne: ['.nnnnnn.', 'nsssRssn', 'nsssRssn', 'nRRRRRRn', 'nsssRssn', 'nsssRssn', 'nsssRssn', '.nnnnnn.'], // pacco del corriere, spago rosso
  pinguini: ['..nnnn..', '.nwnnwn.', '.nnOOnn.', 'nnppppnn', 'nnppppnn', '.nppppn.', '.nnppnn.', '.OO..OO.'], // Ghiacci: pinguino (Pinguini sul ghiaccio)
  koi: ['........', '.....RR.', 'p..pRRpp', 'pppppRpn', 'p..RRppp', '....pp..', '........', '........'], // Giardino: carpa koi bianca e rossa
  ingorgo: ['qqq.ppp.', '........', 'RRRRR.Y.', 'RwwRRRYY', 'RRRRR.Y.', '........', '.ppp.qqq', '........'], // barca rossa che esce dall'ingorgo
};

const cache = new Map<string, string>();
/** `pix` = icona di luogo (PIX): serve perché «perle» è sia una risorsa (la perla rosa) sia un luogo (l'ostrica del tuffo). */
function svg(id: ResId | PixId, pix = false): string {
  const key = (pix ? 'pix:' : 'res:') + id;
  let s = cache.get(key);
  if (s) return s;
  const rows = pix ? PIX[id as PixId] : (ART as Record<string, string[]>)[id] ?? PIX[id as PixId];
  let rects = '';
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = COL[row[x] ?? '.']; if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; } });
  s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">${rects}</svg>`;
  cache.set(key, s);
  return s;
}

function iconSpan(id: ResId | PixId, px: number, pix = false): HTMLSpanElement {
  const e = document.createElement('span');
  e.className = 'mz-ico';
  e.style.width = e.style.height = px + 'px';
  e.innerHTML = svg(id, pix); // SVG statico generato qui, nessun dato esterno
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
  const e = iconSpan(id, px, true);
  e.setAttribute('aria-hidden', 'true');
  return e;
}
/** Disegna un'icona di luogo su una tela 2D (minimappa): 8×8 celle da `s` pixel, angolo in alto a sinistra in (x, y). */
export function drawPix(g: CanvasRenderingContext2D, id: PixId, x: number, y: number, s: number): void {
  PIX[id].forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const c = COL[row[xx] ?? '.']; if (c) { g.fillStyle = c; g.fillRect(x + xx * s, y + yy * s, s, s); } } });
}
