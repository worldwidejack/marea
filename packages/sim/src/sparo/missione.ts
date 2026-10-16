// La Missione 0 · Il piazzale (#355, docs/SPARO.md §4): elimina le sentinelle → sabota la gru (tieni AZIONE nel cerchio ai suoi
// piedi; intanto non spari, e se lasci si ricomincia) mentre arrivano tre rinforzi → raggiungi la barca. La medaglia viene dal tempo.
// A terra: dopo un attimo la missione è persa.
import { SPARO } from '@marea/content/sparo.ts';
import type { SCerchio } from '@marea/content/sparo.ts';
import type { SInput, SState } from './stato.ts';
import { nuovoBot, secTick } from './stato.ts';

const M = SPARO.mappa, C = SPARO.missione;

export const inCerchio = (x: number, z: number, c: SCerchio): boolean => (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) <= c.r * c.r;

/** Sta sabotando la gru: obiettivo 1, nel cerchio, AZIONE premuto. */
export const sabotando = (s: SState, inp: SInput): boolean => !!s.missione && s.missione.obiettivo === 1 && !s.g.morto && inp.azione && inCerchio(s.g.x, s.g.z, M.gru);

/** I tre rinforzi: arrivano già in allerta, sapendo dove sei. */
function rinforzi(s: SState): void {
  const mi = s.missione!;
  if (mi.rinforzi) return;
  mi.rinforzi = true;
  s.ev.push({ t: 'rinforzi' });
  M.rinforzi.forEach((p, k) => {
    const b = nuovoBot(p, s.bot.length, 'nemico', -1, SPARO.nemici.vita);
    b.rinforzo = true; b.ux = s.g.x; b.uz = s.g.z; b.vistoT = s.tick;
    b.stato = 'allerta'; b.allertaT = s.tick + secTick(0.8 + 0.4 * k); b.timer = b.allertaT;
    s.bot.push(b);
  });
}

export function passoMissione(s: SState, inp: SInput): void {
  const mi = s.missione;
  if (!mi || mi.esito) return;
  const g = s.g;
  if (g.morto) {
    if (s.tick - g.morto >= secTick(C.caduto)) { mi.esito = 'persa'; mi.fine = s.tick; s.ev.push({ t: 'fine', esito: 'persa', medaglia: '' }); }
    return;
  }
  if (mi.obiettivo === 0) {
    if (s.bot.every((b) => b.rinforzo || b.morto)) { mi.obiettivo = 1; s.ev.push({ t: 'obiettivo', i: 1 }); rinforzi(s); }
  } else if (mi.obiettivo === 1) {
    mi.sabota = sabotando(s, inp) ? mi.sabota + 1 : 0;
    if (mi.sabota >= secTick(C.sabota)) { mi.obiettivo = 2; mi.sabota = 0; s.ev.push({ t: 'sabotata' }, { t: 'obiettivo', i: 2 }); }
  } else if (mi.obiettivo === 2 && inCerchio(g.x, g.z, M.barca.uscita)) {
    mi.obiettivo = 3; mi.esito = 'vinta'; mi.fine = s.tick;
    const sec = (mi.fine - mi.inizio) / secTick(1);
    mi.medaglia = sec <= C.medaglie.oro ? 'oro' : sec <= C.medaglie.argento ? 'argento' : 'bronzo';
    s.ev.push({ t: 'obiettivo', i: 3 }, { t: 'fine', esito: 'vinta', medaglia: mi.medaglia });
  }
}
