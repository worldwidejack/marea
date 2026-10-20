// Perle: la schermata del tuffo, sopra il mondo (chunk scaricato alla prima partita). Fondale a pixel visto di profilo (disegno in
// ui/perle_disegno.ts): la corrente porta il sub verso destra, TIENI PREMUTO = nuota giù, LASCIA = risale. Perle bianche, conchiglie,
// rosa nelle ostriche, nere in fondo ai crepacci; meduse e granchi tolgono aria; si respira a galla o nelle bolle. Un pollice: si tiene
// premuto ovunque sulla schermata (o Spazio / Invio / E / ↓ / S / T). Esc o × = ritirati. Il tempo parte al primo tocco (prima il
// cartello delle regole). Schermata comune (giro a 60 Hz, input per il server, regole, barre, punti) in ui/schermo_pixel.ts.
import { MINIGAMES_CFG } from '@marea/content';
import { createRng, getMinigame } from '@marea/sim';
import type { PerleState, PerleView } from '@marea/sim';
import { createSchermoPixel } from './schermo_pixel.ts';
import type { SchermoPixel } from './schermo_pixel.ts';
import { PAL } from './style.ts';
import { H, W, createPittore, effetti } from './perle_disegno.ts';
import type { Scena } from './perle_disegno.ts';
import { suona } from '../audio/ponte.ts';

const P = PAL;
const CFG = MINIGAMES_CFG.perle;
/** Colori solo delle Perle sopra la schermata comune: barra dell'aria (lampeggia quando manca), bottone premuto, regole. */
const CSS = `
#mzPerleGioco .bar.aria i { background: ${P.acquaBassa}; }
#mzPerleGioco .bar.aria.low i { background: ${P.rosso}; }
#mzPerleGioco .bar.aria.low { animation: mzPrBlink .4s steps(2) infinite; }
@keyframes mzPrBlink { 50% { border-color: ${P.rosso}; } }
#mzPerleGioco .rules { background: rgba(35,32,31,.7); }
#mzPerleGioco .rules .rosa { color: ${P.rosaNeon}; } #mzPerleGioco .rules .nera { color: ${P.pietraChiara}; text-decoration: underline ${P.viola} 2px; }
#mzPerleGioco .act.giu { background: ${P.acquaBassa}; }
`;

/** Profilo a colline separate da tratti vuoti (isole all'orizzonte, scogli lontani): solo estetica, dal seed. */
function colline(seed: number, label: string, n: number, gap: [number, number], largo: [number, number], alto: [number, number], vuoto: number, pieno: (u: number, h: number) => number): number[] {
  const r = createRng(seed).fork(label), out: number[] = [];
  while (out.length < n) {
    const g = r.int(gap[0], gap[1]), w = r.int(largo[0], largo[1]), h = r.int(alto[0], alto[1]);
    for (let i = 0; i < g; i++) out.push(vuoto);
    for (let i = 0; i < w; i++) out.push(pieno(1 - (2 * (i / (w - 1)) - 1) ** 2, h) + (r.next() < 0.2 ? 1 : 0));
  }
  return out;
}

export function createPerle(o: { root: HTMLElement }): SchermoPixel {
  const mod = getMinigame('perle');
  const vista = (s: PerleState) => mod.view(s) as PerleView;
  return createSchermoPixel<PerleState, Scena>(o.root, {
    id: 'perle', domId: 'mzPerleGioco', btnId: 'mzPerleGiu', titolo: `${CFG.nome} · tuffo`,
    W, H, velo: 'rgba(22,63,115,.6)', bordo: P.legnoChiaro, css: CSS, suoni: { via: 'plop', apri: null },
    regole: '<div><b>TIENI PREMUTO</b>: nuoti giù · <b>LASCIA</b>: risali</div>'
      + `<div>Perle ${CFG.punti.bianca} · conchiglie ${CFG.punti.conchiglia} · <span class="rosa">rosa ${CFG.punti.rosa}</span> (ostrica aperta) · <span class="nera">nere ${CFG.punti.nera}</span></div>`
      + '<div>Meduse e granchi ti tolgono aria: respira a galla o nelle bolle</div>'
      + '<div class="go">TIENI PREMUTO PER TUFFARTI</div>',
    barre: [{ nome: 'ARIA', cls: 'aria' }, { nome: 'TEMPO', cls: 'tempo' }],
    tasti: ['KeyT', 'ArrowDown', 'KeyS'],
    scena(_s, seed) {
      const isole = colline(seed, 'isole', 640, [30, 90], [18, 44], [3, 7], 0, (u, h) => Math.max(1, Math.round(h * u)));
      const scogli = colline(seed, 'scogli', 900, [10, 50], [30, 80], [20, 40], 999, (u, h) => Math.round(96 - h * u));
      return { prevY: 0, prima: { punti: 0, bolle: 0, colpi: 0, rare: 0 }, preso: new Set(), colpi: 0, fx: [], bolle: [], shake: 0, isole, scogli };
    },
    pittore: createPittore,
    primaPasso(s, sc) { sc.prevY = s.y; sc.prima = { punti: s.punti, bolle: s.prese.bolla, colpi: s.colpi, rare: s.prese.rosa + s.prese.nera }; },
    dopoPasso(s, sc) {
      effetti(s, sc);
      const p = sc.prima;
      if (s.colpi > p.colpi) suona('colpo_preso');
      else if (s.prese.rosa + s.prese.nera > p.rare) suona('moneta');
      else if (s.punti > p.punti) suona('raccolto');
      else if (s.prese.bolla > p.bolle) suona('goccia');
    },
    stato(s, _sc, { held, intro, auto }) {
      const v = vista(s);
      const msg: [string, string, '' | 'go' | 'bad' | 'ok'] = intro ? ['Pronti?', 'il tempo parte quando ti tuffi', 'go']
        : v.done ? ['Tempo!', `${v.prese.bianca + v.prese.conchiglia + v.prese.rosa + v.prese.nera} perle nel sacchetto`, 'go']
        : v.affanno ? ['Senz\'aria!', 'risali da solo…', 'bad']
        : v.aria < 0.3 && v.y > 2 ? ['Poca aria!', 'lascia e risali', 'bad']
        : v.y <= 2 ? ['A galla', 'tieni premuto per tuffarti', 'ok']
        : v.hold ? ['Giù…', 'lascia per risalire', ''] : ['Su…', 'tieni premuto per scendere', ''];
      const bottone: [string, '' | 'giu' | 'wait' | 'bad'] = intro ? ['TIENI PREMUTO', ''] : v.done ? ['FINE', 'wait'] : v.affanno ? ['SENZ\'ARIA', 'bad']
        : held || (auto && v.hold) ? ['▼ GIÙ ▼', 'giu'] : ['TIENI PREMUTO', ''];
      return { msg, bottone, punti: v.punti, medals: v.medals, barre: [{ w: v.aria, low: !intro && (v.aria < 0.3 || v.affanno) }, { w: 1 - v.ms / v.maxMs, low: v.maxMs - v.ms < 10_000 }] };
    },
    vista(s) { const v = vista(s); return { punti: v.punti, totale: v.totale, aria: +v.aria.toFixed(3), y: +v.y.toFixed(2), tick: v.tick, done: v.done, prese: v.prese, colpi: v.colpi, medals: v.medals }; },
    esito(detail) {
      const n = (k: string) => (typeof detail[k] === 'number' ? (detail[k] as number) : 0);
      const rare = [n('nere') ? `${n('nere')} ner${n('nere') === 1 ? 'a' : 'e'}` : '', n('rosa') ? `${n('rosa')} rosa` : ''].filter(Boolean).join(', ');
      return `${n('perle')} prese${rare ? ` (${rare})` : ''} · ${n('punti')} punti`;
    },
  });
}
