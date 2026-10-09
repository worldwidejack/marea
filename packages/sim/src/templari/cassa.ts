// Cassa del tesoro templare (docs/TEMPLARI.md §6, la «mystery box»): AZIONE e 950 punti → gira per qualche secondo → esce un'arma a caso
// (pesi `cassa` delle armi, niente spada e niente armi che hai già; le miracolose rare) da prendere entro `pronta` secondi. Dopo un numero
// di aperture deciso dal seed esce il teschio: la cassa ride, ti rende i punti e sparisce, per ricomparire in un altro dei suoi posti.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { TState } from './stato.ts';
import { ev, secToTicks } from './stato.ts';
import { rendi, spendi } from './colpi.ts';
import { raggiungePunto } from './raggiungi.ts';

/** Posti della cassa dove l'eroe arriva adesso (con le porte aperte). */
const postiAperti = (s: TState): number[] => s.arena.casse.map((p, i) => (raggiungePunto(s, p.x, p.z) ? i : -1)).filter((i) => i >= 0);

/** L'eroe è vicino alla cassa? */
export function vicinoCassa(s: TState): boolean {
  const p = s.arena.casse[s.cassa.posto];
  if (!p || s.cassa.fase === 'vola' || s.cassa.fase === 'teschio') return false;
  const dx = p.x - s.eroe.x, dz = p.z - s.eroe.z, r = TEMPLARI.cassa.raggio;
  return dx * dx + dz * dz <= r * r;
}

/** Un'arma dalla cassa: a caso coi pesi, senza quelle che hai già (e mai la stessa spada di partenza). */
function pesca(s: TState): string {
  const mie = new Set(s.eroe.armi.filter(Boolean).map((x) => x!.id));
  const pool = TEMPLARI.armi.filter((a) => (a.cassa ?? 0) > 0 && !mie.has(a.id) && a.id !== TEMPLARI.partenza.arma);
  const tot = pool.reduce((t, a) => t + (a.cassa ?? 0), 0);
  let r = s.rng.next() * tot;
  for (const a of pool) { r -= a.cassa ?? 0; if (r < 0) return a.id; }
  return pool[pool.length - 1]?.id ?? TEMPLARI.armi[1]!.id;
}

/** AZIONE vicino alla cassa: la apre (se hai i punti) o prende l'arma uscita. Ritorna l'arma presa (da dare all'eroe), o null. */
export function usaCassa(s: TState): string | null {
  const c = s.cassa, k = TEMPLARI.cassa;
  if (c.fase === 'chiusa') {
    if (!spendi(s, k.prezzo)) return null;
    c.fase = 'gira'; c.inizio = s.tick; c.fine = s.tick + secToTicks(k.gira);
    ev(s, { t: 'cassa', fase: 'gira' });
    return null;
  }
  if (c.fase === 'pronta' && c.arma) {
    const a = c.arma;
    c.fase = 'chiusa'; c.arma = null;
    ev(s, { t: 'cassa', fase: 'presa', arma: a });
    return a;
  }
  return null;
}

export function stepCassa(s: TState): void {
  const c = s.cassa, k = TEMPLARI.cassa;
  if (c.fase === 'chiusa' || s.tick < c.fine) return;
  switch (c.fase) {
    case 'gira':
      c.usi++;
      if (c.usi >= c.max && postiAperti(s).length > 1) {
        c.fase = 'teschio'; c.inizio = s.tick; c.fine = s.tick + secToTicks(3);
        rendi(s, k.prezzo);
        ev(s, { t: 'cassa', fase: 'teschio' });
      } else {
        c.fase = 'pronta'; c.arma = pesca(s); c.inizio = s.tick; c.fine = s.tick + secToTicks(k.pronta);
        ev(s, { t: 'cassa', fase: 'arma', arma: c.arma });
      }
      return;
    case 'pronta': c.fase = 'chiusa'; c.arma = null; return;
    case 'teschio': c.fase = 'vola'; c.inizio = s.tick; c.fine = s.tick + secToTicks(k.vola); ev(s, { t: 'cassa', fase: 'vola' }); return;
    case 'vola': {
      // ricompare in un altro dei posti che si raggiungono (le zone chiuse no)
      const altri = postiAperti(s).filter((i) => i !== c.posto);
      if (altri.length) c.posto = altri[s.rng.int(0, altri.length - 1)]!;
      c.usi = 0; c.max = s.rng.int(k.usiMin, k.usiMax); c.fase = 'chiusa';
      ev(s, { t: 'cassa', fase: 'qui' });
    }
  }
}

/** 0..1 della fase in corso (la cassa che gira, il tempo per prendere l'arma). */
export function faseCassa(s: TState): number {
  const c = s.cassa;
  return c.fine > c.inizio ? Math.max(0, Math.min(1, (s.tick - c.inizio) / (c.fine - c.inizio))) : 0;
}
