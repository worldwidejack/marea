// Regista delle ondate (docs/TEMPLARI.md §4): reliquia sull'altare → presentazione → ondata 1; in ogni ondata un numero fisso di zombie,
// mai più di `insieme` vivi, uno ogni `intervallo` secondi dalle comparse attive più vicine all'eroe; ucciso l'ultimo, pausa, poi la prossima.
// Chi corre e chi scatta lo decide il seed, con più corridori a ogni ondata.
import { TEMPLARI, nemicoDef } from '@marea/content/templari.ts';
import type { Comparsa } from './mappa.ts';
import type { TState } from './stato.ts';
import { ev, intervalloOndata, nuovoZombie, quantiOndata, secToTicks } from './stato.ts';
import { zonaAperta } from './porte.ts';

/** Comparse attive: il sagrato sempre, le zone quando una loro porta è aperta. */
export const attive = (s: TState): Comparsa[] => s.arena.comparse.filter((c) => zonaAperta(s, c.zona));

/** Una comparsa tra le più vicine all'eroe (a caso dal seed), lontana almeno 6 m da lui; null se non ce n'è. */
export function comparsaVicina(s: TState): Comparsa | null {
  const h = s.eroe;
  const ok = attive(s).map((c) => ({ c, d: (c.x - h.x) * (c.x - h.x) + (c.z - h.z) * (c.z - h.z) })).filter((x) => x.d >= 36).sort((a, b) => a.d - b.d);
  if (!ok.length) return null;
  const k = Math.min(ok.length, TEMPLARI.ondate.comparseVicine);
  return ok[s.rng.int(0, k - 1)]!.c;
}

/** Chi esce: ogni nemico con `da` ≤ ondata ha la sua quota (crescente), il fante fa il resto. */
function tipoNuovo(s: TState): string {
  let r = s.rng.next();
  for (const n of TEMPLARI.nemici) {
    if (n.da === undefined || !n.quota || s.ondata < n.da) continue;
    const q = Math.min(n.quota.max, n.quota.base + n.quota.perOndata * (s.ondata - n.da));
    if (r < q) return n.id;
    r -= q;
  }
  return 'fante';
}

/** Velocità di uno zombie nuovo dell'ondata n: cammina, corre o scatta (frazioni da TEMPLARI.ondate). */
function velocita(s: TState, cammina: number, corre: number, scatta: number): number {
  const o = TEMPLARI.ondate, n = s.ondata;
  const fr = (f: { da: number; perOndata: number; max: number }) => (n >= f.da ? Math.min(f.max, f.perOndata * (n - f.da + 1)) : 0);
  const pS = fr(o.scatto), pC = fr(o.corsa), r = s.rng.next();
  return r < pS ? scatta : r < pS + pC ? corre : cammina;
}

/** Il boss dell'ondata n: de Molay alle 10, 20, 30…; il cavaliere alle 5, 15, 25… e, dalla 20, anche nelle altre; null = nessuno.
 *  `solo` = ondata del boss (escono meno fanti). */
export function bossDi(n: number): { tipo: string; solo: boolean } | null {
  const b = TEMPLARI.boss;
  if (n >= b.molay.da && n % b.molay.ogni === 0) return { tipo: 'molay', solo: true };
  if (n >= b.cavaliere.da && (n - b.cavaliere.da) % b.cavaliere.ogni === 0) return { tipo: 'cavaliere', solo: true };
  if (n >= b.cavaliere.insiemeDa) return { tipo: 'cavaliere', solo: false };
  return null;
}

function nuovaOndata(s: TState): void {
  s.ondata++;
  s.fase = 'combatti'; s.faseT = 0;
  s.quanti = quantiOndata(s.ondata); s.usciti = 0; s.prossima = s.tick + secToTicks(1); s.puntiAssi = 0; s.poteri.ondata = 0;
  const b = bossDi(s.ondata);
  s.boss = b ? { tipo: b.tipo, at: s.tick + secToTicks(b.solo ? TEMPLARI.boss.attesa : intervalloOndata(s.ondata) * s.quanti * 0.5), uscito: false } : null;
  if (b?.solo) s.quanti = Math.max(1, Math.round(s.quanti * TEMPLARI.boss.quotaFanti));
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
          const tipo = tipoNuovo(s), v = nemicoDef(tipo).velocita;
          const z = nuovoZombie(s, tipo, c.x, c.z, velocita(s, v.cammina, v.corre, v.scatta));
          s.usciti++;
          ev(s, { t: 'sorge', id: z.id, x: c.x, z: c.z });
        }
        s.prossima = s.tick + secToTicks(intervalloOndata(s.ondata));
      }
      // il boss esce quando è l'ora, dalla comparsa più vicina all'eroe (il cavaliere al galoppo, de Molay a passo lento)
      if (s.boss && !s.boss.uscito && s.tick >= s.boss.at) {
        const c = comparsaVicina(s);
        if (c) {
          const z = nuovoZombie(s, s.boss.tipo, c.x, c.z, nemicoDef(s.boss.tipo).velocita.cammina);
          s.boss.uscito = true;
          ev(s, { t: 'sorge', id: z.id, x: c.x, z: c.z }); ev(s, { t: 'boss', tipo: s.boss.tipo });
        }
      }
      if (s.usciti >= s.quanti && vivi === 0 && (!s.boss || s.boss.uscito)) {
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
