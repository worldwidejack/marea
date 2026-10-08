// Fuga dalla lava (Isola Vulcano): la schermata della corsa sul basalto (chunk scaricato alla prima partita). Corri da solo verso destra;
// TOCCA = salto, TIENI PREMUTO = salto lungo. Le rocce crepate affondano, i geyser bollono e poi eruttano, la lava ti insegue.
// Schermata comune in ui/schermo_pixel.ts, disegno in ui/lava_disegno.ts.
import { MINIGAMES_CFG } from '@marea/content';
import type { LavaState } from '@marea/sim';
import { createSchermoPixel } from './schermo_pixel.ts';
import type { SchermoPixel } from './schermo_pixel.ts';
import { PAL } from './style.ts';
import { H, W, createPittoreLava, effettiLava, scenaLava } from './lava_disegno.ts';
import type { ScenaLava } from './lava_disegno.ts';

const CFG = MINIGAMES_CFG.lava;
const soglie = (tot: number) => {
  const q = (f: number) => Math.max(1, Math.ceil(tot * f - 1e-9));
  return { oro: q(CFG.medaglie.oro), argento: q(CFG.medaglie.argento), bronzo: q(CFG.medaglie.bronzo) };
};

export function createLava(o: { root: HTMLElement }): SchermoPixel {
  return createSchermoPixel<LavaState, ScenaLava>(o.root, {
    id: 'lava', domId: 'mzLava', btnId: 'mzLavaSalta', titolo: `${CFG.nome} · vulcano`,
    W, H, velo: 'rgba(35,32,31,.72)', bordo: PAL.rosso,
    regole: '<div><b>TOCCA</b>: salti · <b>TIENI PREMUTO</b>: salto lungo</div>'
      + '<div>Le rocce <span class="r">crepate</span> affondano, i <span class="o">geyser</span> bollono e poi eruttano</div>'
      + `<div><span class="v">Ossidiana ${CFG.punti.ossidiana}</span> · <b>scintille ${CFG.punti.scintilla}</b> · <span class="r">rubini ${CFG.punti.rubino}</span> · lava −${CFG.scottatura.punti}</div>`
      + '<div class="go">TOCCA PER PARTIRE</div>',
    barre: [{ nome: 'TEMPO', cls: 'tempo' }],
    tasti: ['ArrowUp', 'KeyW', 'KeyJ'],
    scena: scenaLava,
    pittore: createPittoreLava,
    dopoPasso: effettiLava,
    stato(s, _sc, { held, intro, auto }) {
      const ms = (s.tick / 60) * 1000, maxMs = CFG.maxSeconds * 1000;
      const presi = s.prese.ossidiana + s.prese.scintilla + s.prese.rubino;
      const col = s.terra >= 0 ? s.colonne[s.terra] : undefined, affonda = col?.k === 'affonda' && s.tocchi[s.terra]! >= 0;
      const msg: [string, string, '' | 'go' | 'bad' | 'ok'] = intro ? ['Pronti?', 'il tempo parte al primo tocco', 'go']
        : s.done ? ['Tempo!', `${presi} pezzi raccolti`, 'go']
        : s.inv > 20 ? ['Scotta!', 'salta via dalla lava', 'bad']
        : affonda ? ['Affonda!', 'salta sulla prossima', 'bad']
        : s.terra < 0 ? (s.vy < 0 && held ? ['Salto lungo…', 'lascia per scendere', ''] : ['In volo…', 'tieni premuto per andare lontano', ''])
        : ['Corri!', 'tocca = salto · tieni = salto lungo', 'ok'];
      const bottone: [string, '' | 'giu' | 'wait' | 'bad'] = intro ? ['TOCCA PER SALTARE', ''] : s.done ? ['FINE', 'wait']
        : held && !auto ? ['▲ SALTO ▲', 'giu'] : s.inv > 20 ? ['SALTA!', 'bad'] : ['SALTA', ''];
      return { msg, bottone, punti: s.punti, medals: soglie(s.totale), barre: [{ w: 1 - ms / maxMs, low: maxMs - ms < 10_000 }] };
    },
    vista: (s) => ({ punti: s.punti, totale: s.totale, tick: s.tick, done: s.done, y: +s.y.toFixed(2), terra: s.terra >= 0, salti: s.salti, scottature: s.scottature, prese: s.prese, medals: soglie(s.totale) }),
    esito(detail) {
      const n = (k: string) => (typeof detail[k] === 'number' ? (detail[k] as number) : 0);
      const rari = [n('rubini') ? `${n('rubini')} rubin${n('rubini') === 1 ? 'o' : 'i'}` : '', n('scintille') ? `${n('scintille')} scintill${n('scintille') === 1 ? 'a' : 'e'}` : ''].filter(Boolean).join(', ');
      return `${n('presi')} pezzi${rari ? ` (${rari})` : ''} · ${n('punti')} punti`;
    },
  });
}
