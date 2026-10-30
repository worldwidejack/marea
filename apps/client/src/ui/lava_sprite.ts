// Fuga dalla lava, gli sprite e le trame (pixel art, solo colori della palette: ART_BIBLE §2). Ogni disegno diventa una volta sola un
// canvas fuori schermo; il pittore (ui/lava_vista.ts) li copia a ogni fotogramma. Il corridore guarda a destra.
import { PAL } from './style.ts';
import type { Col } from './pixel_kit.ts';
import { dith, hash } from './pixel_kit.ts';

export type Sprite = HTMLCanvasElement;
const MAP: Record<string, Col> = {
  n: 'neroCaldo', r: 'roccia', q: 'pietraScura', Q: 'pietra', p: 'pietraChiara', s: 'sabbia', w: 'sabbiaChiara', c: 'legnoScuro', b: 'legno',
  R: 'rosso', O: 'arancio', Y: 'giallo', v: 'viola', k: 'rosaNeon', A: 'acqua', D: 'acquaProfonda',
};

/** Righe di caratteri → canvas ('.' = trasparente). */
function sprite(rows: readonly string[]): Sprite {
  const cv = document.createElement('canvas');
  cv.width = rows[0]!.length; cv.height = rows.length;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
    const c = MAP[rows[y]![x]!];
    if (c) { g.fillStyle = PAL[c]; g.fillRect(x, y, 1, 1); }
  }
  return cv;
}
/** Un canvas vuoto di w×h con un disegno fatto da `fn(x, y)` → nome del colore (o null). */
function trama(w: number, h: number, fn: (x: number, y: number) => Col | null): Sprite {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) { g.fillStyle = PAL[c]; g.fillRect(x, y, 1, 1); } }
  return cv;
}

// ---- il corridore (9×13) con la Lanterna in testa ----
const TESTA = ['...nn....', '..nRRn...', '..RYYR...', '..nRRn...', '...ss....', '..ssns...', '..ss.....'];
const gambe = (braccia: string[], g: string[]) => [...TESTA, ...braccia, ...g];
const B1 = ['.DAAAs...', '.sAAA....'], B2 = ['..AAAD...', '..AAAs...'];
export type Omino = { corsa: Sprite[]; salto: Sprite; cade: Sprite; scotta: Sprite; scavalca: Sprite };
export function creaOmino(): Omino {
  return {
    corsa: [
      sprite(gambe(B1, ['..AAA....', '..cc.c...', '.cc...c..', '.n....nn.'])),
      sprite(gambe(B2, ['..AAA....', '...cc....', '...cc....', '..nnn....'])),
      sprite(gambe(B1, ['..AAA....', '..c..cc..', '.cc..c...', '.nn...n..'])),
      sprite(gambe(B2, ['..AAA....', '...cc.c..', '...c.cc..', '..nn..nn.'])),
    ],
    salto: sprite([...TESTA.slice(0, 6), 's.ss..s..', '.sAAAAs..', '..AAA....', '..AAA....', '.cc.cc...', 'nc...cn..', '.........']),
    cade: sprite([...TESTA.slice(0, 6), 's.ss..s..', '.sAAAAs..', '..AAA....', '..AAA....', '..c.c....', '..c.c....', '..n.n....']),
    scotta: sprite(['..Y.Y....', '..nRRn...', '..RYYR...', '..nRRn...', '...ss....', '..sOOs...', 'sOss.Os..', '.sAAAAs..', '..AAA....', '..AAA....', '.cc.cc...', 'nc...cn..', '.........']),
    scavalca: sprite([...TESTA.slice(0, 5), '..ssns...', 's.sss.s..', '.sAAAAs..', '..AAA....', '.cAAc....', 'cc...cc..', 'n.....n..', '.........']),
  };
}

// ---- cose del mondo ----
export type CoseLava = {
  roccia: Sprite; lava: Sprite; bagliore: Sprite; spuntone: Sprite; sfiato: Sprite; magmino: Sprite[]; ossidiana: Sprite; scintilla: Sprite[]; rubino: Sprite;
};
export function creaCose(): CoseLava {
  return {
    // basalto a canne: giunti scuri ogni 8 px, grana di pietra
    roccia: trama(16, 16, (x, y) => {
      const j = (x + 1) % 8;
      if (j === 0 || (j === 7 && y % 5 < 2)) return 'neroCaldo';
      const h = hash(x, y) % 9;
      return h === 0 ? 'pietraScura' : h === 1 && y > 2 ? 'neroCaldo' : x % 8 === 1 && y % 3 === 0 ? 'pietraScura' : 'roccia';
    }),
    // lava: magma rosso e arancio con croste scure e scintille gialle, a tessere di 64×32 che si ripetono
    lava: trama(64, 32, (x, y) => {
      const h = hash(Math.floor(x / 3), Math.floor(y / 2)) % 20;
      return h < 3 && y > 5 ? 'roccia' : h === 3 && y > 2 ? 'giallo' : h < 9 || y % 16 > 11 ? 'rosso' : 'arancio';
    }),
    // il basalto in basso si scalda: puntini rossi sempre più fitti verso la lava (6 px)
    bagliore: trama(16, 6, (x, y) => (dith(x, y, (y + 1) / 7) ? (y > 3 ? 'arancio' : 'rosso') : null)),
    spuntone: sprite(['...RR...', '...nn...', '..nqqn..', '..nqqn..', '.nqqqqn.', '.nqQqqn.', 'nqqQqqqn', 'nqqqqqqn', 'nnnnnnnn']),
    sfiato: sprite(['.nrrrrrrn.', 'nrRRRRRRrn', 'nnORYYROnn', '.nnnnnnnn.']),
    magmino: [
      sprite(['..........', '...OOOO...', '..OYYYYO..', '.OYnYYnYO.', '.OYYYYYYO.', 'OORYYYYROO', 'ORRRRRRRRO', '.RRRRRRRR.', '..n....n..']),
      sprite(['..........', '...OOOO...', '..OYYYYO..', '.OYnYYnYO.', '.OYYYYYYO.', 'OORYYYYROO', 'ORRRRRRRRO', '.RRRRRRRR.', '.n......n.']),
    ],
    ossidiana: sprite(['..v..', '.vnv.', 'vnpnv', 'vnnrv', '.vnv.', '..v..']),
    scintilla: [sprite(['..Y..', '..Y..', 'YYOYY', '..Y..', '..Y..']), sprite(['.....', '.Y.Y.', '..O..', '.Y.Y.', '.....'])],
    rubino: sprite(['.RRRR.', 'RkkRRR', 'RkRRRR', '.RRRR.', '..RR..']),
  };
}
