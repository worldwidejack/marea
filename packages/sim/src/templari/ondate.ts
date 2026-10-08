// Regista delle ondate (docs/TEMPLARI.md §4): reliquia sull'altare → presentazione → ondata 1; in ogni ondata un numero fisso di zombie,
// mai più di `insieme` vivi, uno ogni `intervallo` secondi dalle comparse attive più vicine all'eroe; ucciso l'ultimo, pausa, poi la prossima.
// Chi corre e chi scatta lo decide il seed, con più corridori a ogni ondata.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { Comparsa } from './mappa.ts';
import type { TState } from './stato.ts';
import { ev, intervalloOndata, nuovoZombie, quantiOndata, secToTicks } from './stato.ts';

/** Comparse attive (le porte chiuse spengono le loro zone: per ora c'è solo il sagrato). */
const attive = (s: TState): Comparsa[] => s.arena.comparse;

/** Una comparsa tra le più vicine all'eroe (a caso dal seed), lontana almeno 6 m da lui; null se non ce n'è. */
export function comparsaVicina(s: TState): Comparsa | null {
  const h = s.eroe;
  const ok = attive(s).map((c) => ({ c, d: (c.x - h.x) * (c.x - h.x) + (c.z - h.z) * (c.z - h.z) })).filter((x) => x.d >= 36).sort((a, b) => a.d - b.d);
  if (!ok.length) return null;
  const k = Math.min(ok.length, TEMPLARI.ondate.comparseVicine);
  return ok[s.rng.int(0, k - 1)]!.c;
}

/** Velocità di uno zombie nuovo dell'ondata n: cammina, corre o scatta (frazioni da TEMPLARI.ondate). */
function velocita(s: TState, cammina: number, corre: number, scatta: number): number {
  const o = TEMPLARI.ondate, n = s.ondata;
  const fr = (f: { da: number; perOndata: number; max: number }) => (n >= f.da ? Math.min(f.max, f.perOndata * (n - f.da + 1)) : 0);
  const pS = fr(o.scatto), pC = fr(o.corsa), r = s.rng.next();
  return r < pS ? scatta : r < pS + pC ? corre : cammina;
}

function nuovaOndata(s: TState): void {
  s.ondata++;
  s.fase = 'combatti'; s.faseT = 0;
  s.quanti = quantiOndata(s.ondata); s.usciti = 0; s.prossima = s.tick + secToTicks(1); s.puntiAssi = 0;
  ev(s, { t: 'ondata', n: s.ondata });
}

export function stepOndate(s: TState): void {
  const o = TEMPLARI.ondate;
  s.faseT++;
  switch (s.fase) {
    case 'altare': return;
    case 'inizio':
      if (s.faseT >= secToTicks(o.inizio)) nuovaOndata(s);
      return;
    case 'pausa':
      if (s.faseT >= secToTicks(o.pausa)) nuovaOndata(s);
      return;
    case 'combatti': {
      const vivi = s.zombie.filter((z) => z.st !== 'morto').length;
      if (s.usciti < s.quanti && vivi < o.insieme && s.tick >= s.prossima) {
        const c = comparsaVicina(s);
        if (c) {
          const v = TEMPLARI.nemici.find((n) => n.id === 'fante')!.velocita;
          const z = nuovoZombie(s, 'fante', c.x, c.z, velocita(s, v.cammina, v.corre, v.scatta));
          s.usciti++;
          ev(s, { t: 'sorge', id: z.id, x: c.x, z: c.z });
        }
        s.prossima = s.tick + secToTicks(intervalloOndata(s.ondata));
      }
      if (s.usciti >= s.quanti && vivi === 0) {
        ev(s, { t: 'ondataFinita', n: s.ondata });
        s.fase = 'pausa'; s.faseT = 0;
      }
    }
  }
}

/** Secondi che restano alla fase (presentazione e pausa), 0 nelle altre. */
export function faseS(s: TState): number {
  const o = TEMPLARI.ondate;
  if (s.fase === 'inizio') return Math.max(0, o.inizio - s.faseT / 60);
  if (s.fase === 'pausa') return Math.max(0, o.pausa - s.faseT / 60);
  return 0;
}
