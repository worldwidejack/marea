// Arrembaggio (Isola della Tempesta): la schermata del cannone sul faro (chunk scaricato alla prima partita). TIENI PREMUTO = la potenza
// sale e scende, LASCIA = fuoco; il mirino mostra la prima metà del tiro, il vento (bandiera e frecce) sposta le palle e cambia a raffiche.
// Navi piccole e veloci valgono di più. Schermata comune in ui/schermo_pixel.ts, disegno in ui/arrembaggio_disegno.ts.
import { MINIGAMES_CFG } from '@marea/content';
import { potenzaDi } from '@marea/sim';
import type { ArrembaggioState } from '@marea/sim';
import { createSchermoPixel } from './schermo_pixel.ts';
import { PAL } from './style.ts';
import type { SchermoPixel } from './schermo_pixel.ts';
import { H, W, createPittoreArrembaggio, effettiArrembaggio, scenaArrembaggio } from './arrembaggio_disegno.ts';
import type { ScenaArr } from './arrembaggio_disegno.ts';

const CFG = MINIGAMES_CFG.arrembaggio;
const N = CFG.navi;
const soglie = (tot: number) => {
  const q = (f: number) => Math.max(1, Math.ceil(tot * f - 1e-9));
  return { oro: q(CFG.medaglie.oro), argento: q(CFG.medaglie.argento), bronzo: q(CFG.medaglie.bronzo) };
};

export function createArrembaggio(o: { root: HTMLElement }): SchermoPixel {
  return createSchermoPixel<ArrembaggioState, ScenaArr>(o.root, {
    id: 'arrembaggio', domId: 'mzArrembaggio', btnId: 'mzArrembaggioFuoco', titolo: `${CFG.nome} · faro della tempesta`,
    W, H, velo: 'rgba(22,63,115,.72)', bordo: PAL.pietraScura,
    regole: '<div><b>TIENI PREMUTO</b>: carichi il cannone · <b>LASCIA</b>: fuoco!</div>'
      + `<div>Il <span class="c">vento</span> sposta le palle: guarda la bandiera · <b>${CFG.tiro.palle} palle</b></div>`
      + `<div>${N.galeone.nome} ${N.galeone.punti} · ${N.brigantino.nome} ${N.brigantino.punti} · <span class="o">${N.sloop.nome} ${N.sloop.punti}</span> · <b>${N.tesoro.nome} ${N.tesoro.punti}</b></div>`
      + '<div class="go">TIENI PREMUTO PER CARICARE</div>',
    barre: [{ nome: 'POTENZA', cls: 'potenza' }, { nome: 'PALLE', cls: 'palle' }, { nome: 'TEMPO', cls: 'tempo' }],
    tasti: ['KeyF', 'ArrowUp', 'KeyW'],
    scena: scenaArrembaggio,
    pittore: createPittoreArrembaggio,
    dopoPasso: effettiArrembaggio,
    stato(s, sc, { held, intro, auto }) {
      const ms = (s.tick / 60) * 1000, maxMs = CFG.maxSeconds * 1000, p = potenzaDi(s.carica);
      const navi = s.affondate.galeone + s.affondate.brigantino + s.affondate.sloop + s.affondate.tesoro;
      const msg: [string, string, '' | 'go' | 'bad' | 'ok'] = intro ? ['Pronti?', 'il tempo parte al primo tocco', 'go']
        : s.done ? ['Tempo!', `${navi} navi affondate`, 'go']
        : sc.colpo && s.tick - sc.colpo.tick < 50 ? ['Affondata!', `${sc.colpo.nome} · +${sc.colpo.punti}`, 'ok']
        : s.tick - sc.tonfo < 40 && s.carica < 0 ? ['In acqua!', 'occhio al vento e alla velocità', 'bad']
        : s.munizioni === 0 && s.carica < 0 ? ['Palle finite!', 'guarda le ultime affondare', 'bad']
        : s.carica >= 0 ? ['Carica…', p > 0.85 ? 'piena! lascia per sparare' : 'lascia per sparare', '']
        : s.ricarica > 0 ? ['Ricarica…', 'il cannone si raffredda', ''] : ['Pronto!', 'tieni premuto per caricare', 'ok'];
      const bottone: [string, '' | 'giu' | 'wait' | 'bad'] = intro ? ['TIENI PREMUTO', ''] : s.done ? ['FINE', 'wait']
        : s.munizioni === 0 && s.carica < 0 ? ['PALLE FINITE', 'wait'] : s.carica >= 0 || (held && !auto) ? ['▲ CARICA · LASCIA ▲', 'giu'] : s.ricarica > 0 ? ['RICARICA', 'wait'] : ['TIENI PREMUTO', ''];
      return {
        msg, bottone, punti: s.punti, medals: soglie(s.totale),
        barre: [{ w: Math.max(0, p), low: false }, { w: s.munizioni / CFG.tiro.palle, low: s.munizioni <= 5 }, { w: 1 - ms / maxMs, low: maxMs - ms < 10_000 }],
      };
    },
    vista: (s) => ({ punti: s.punti, totale: s.totale, tick: s.tick, done: s.done, spari: s.spari, munizioni: s.munizioni, carica: s.carica, palle: s.palle.length, affondate: s.affondate, medals: soglie(s.totale), navi: s.navi.filter((n) => n.t0 <= s.tick).length }),
    esito(detail) {
      const n = (k: string) => (typeof detail[k] === 'number' ? (detail[k] as number) : 0);
      const tes = n('tesori') ? ` (${n('tesori')} del tesoro)` : '';
      return `${n('navi')} navi affondate${tes} · ${n('punti')} punti`;
    },
  });
}
