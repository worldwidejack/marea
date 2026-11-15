// Gli eventi della sim dei difensori e degli insetti nuovi (livelli 7-12) → effetti e suoni: il mortaio che tira e il colpo che cade, il
// colpo che passa sul potenziatore, la mangiatutto che inghiotte, il bruco che si infuria. main.ts li smista qui per restare corto.
import type { DEvento, DState } from '@marea/sim/difesa/stato.ts';
import type { Effetti } from './effetti.ts';
import type { Resa } from './disegna.ts';
import type { Pelle } from './skin.ts';
import type { SuoniDifesa } from './suoni.ts';

export type ContestoEventi = {
  s: DState; pelle: Pelle; fx: Effetti; resa: Resa; suoni: SuoniDifesa; t: number;
  /** Punto di schermo di una posizione del campo (x in caselle, y in corsie) e altezza di una casella della corsia. */
  sullo: (x: number, y: number) => [number, number];
  altezza: (corsia: number) => number;
};

export function eventoNuovo(ev: DEvento, c: ContestoEventi): void {
  const { s, fx, resa, suoni, sullo, altezza, t } = c;
  switch (ev.e) {
    case 'lancia': { const a = resa.anim(ev.id, t); a.rinculo = t; a.kSparo = s.tick; suoni.lancia(); break; }
    case 'cade': {
      const [x, y] = sullo(ev.x, ev.y + 0.3), H = altezza(Math.max(0, Math.min(4, Math.floor(ev.y))));
      fx.anello(x, y, H * 1.2, '#fff2a8'); fx.schegge(x, y, '#2f8a3a', 8, 260); fx.sbuffo(x, y, H * 0.5, 'rgba(230,80,70,0.85)', 8); fx.sbuffo(x, y, H * 0.5, 'rgba(90,70,50,0.7)', 5);
      suoni.botto(false);
      break;
    }
    case 'potenziato': {
      const [x, y] = sullo(ev.col + 0.5, ev.corsia + 0.45), H = altezza(ev.corsia);
      fx.sbuffo(x, y, H * 0.3, 'rgba(255,170,60,0.9)', 6); fx.scintille(x, y, 5, '#ffd23f');
      suoni.potenzia();
      break;
    }
    case 'inghiottito': {
      const [x, y] = sullo(ev.x, ev.corsia + 0.6), H = altezza(ev.corsia);
      fx.sbuffo(x, y, H * 0.4, 'rgba(255,255,255,0.85)', 6); fx.schegge(x, y, '#c9262a', 5, 160);
      suoni.inghiotte();
      break;
    }
    case 'furia': {
      const e = s.nemici.find((n) => n.id === ev.id);
      if (!e) break;
      const [x, y] = sullo(e.x, e.corsia + 0.3), H = altezza(e.corsia);
      fx.sbuffo(x, y, H * 0.3, 'rgba(255,90,60,0.85)', 8); fx.scintille(x, y, 6, '#ff5a3c');
      suoni.furia();
      break;
    }
  }
}
