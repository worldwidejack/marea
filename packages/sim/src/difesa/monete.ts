// La valuta della Difesa (docs/DIFESA.md §2.1): cade dal cielo sempre più di rado (come il sole di PvZ), salta fuori dai produttori,
// si raccoglie toccandola (anche mentre cade) e sparisce se resta a terra troppo. Con la raccolta automatica si prende da sola appena
// tocca terra.
import type { DMoneta, DState } from './stato.ts';
import { caso, prof, tick } from './stato.ts';

export function nuovaMoneta(s: DState, x: number, y0: number, yFine: number, valore: number, cielo: boolean): DMoneta {
  const E = prof(s).economia;
  const volo = cielo ? Math.max(0.5, (yFine - y0) / E.cielo.cade) : 0.6;
  const m: DMoneta = { id: s.nid++, x, y0, yFine, valore, cielo, nata: s.tick, atterra: s.tick + tick(volo), sparisce: 0 };
  m.sparisce = m.atterra + tick(E.aTerra);
  s.monete.push(m);
  s.ev.push({ e: 'moneta', id: m.id, cielo });
  return m;
}

/** Il cielo: la prossima dopo min(max, base + passo × già cadute) + fino a `caso` secondi. */
export function passoCielo(s: DState): void {
  const C = prof(s).economia.cielo;
  if (--s.cielo.conto > 0) return;
  s.cielo.caduti++;
  s.cielo.conto = tick(Math.min(C.max, C.base + s.cielo.caduti * C.passo) + caso(s) * C.caso);
  nuovaMoneta(s, 0.75 + caso(s) * 6.9, -0.6, 0.6 + caso(s) * 3.6, C.valore, true);
}

export function raccogli(s: DState, id: number): boolean {
  const i = s.monete.findIndex((m) => m.id === id);
  if (i < 0) return false;
  const m = s.monete[i]!;
  s.monete.splice(i, 1);
  s.valuta += m.valore; s.stats.raccolte += m.valore;
  s.ev.push({ e: 'raccolta', id: m.id, valore: m.valore });
  return true;
}

export function passoMonete(s: DState): void {
  for (const m of [...s.monete]) {
    if (s.raccoltaAuto && s.tick >= m.atterra + tick(0.4)) { raccogli(s, m.id); continue; }
    if (s.tick >= m.sparisce) { s.monete.splice(s.monete.indexOf(m), 1); s.ev.push({ e: 'sparita', id: m.id }); }
  }
}
