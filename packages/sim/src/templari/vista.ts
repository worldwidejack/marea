// Vista per il client (TView), risultato (TRisultato) e hash dello stato a fine partita (uguale tra client e server se gli input coincidono).
import { TEMPLARI } from '@marea/content/templari.ts';
import { hashJson } from '../hash.ts';
import type { DungeonView, HeroAnim } from '../dungeon/types.ts';
import type { TRisultato, TView } from './types.ts';
import type { TState } from './stato.ts';
import { animZombie } from './stato.ts';
import { faseS } from './ondate.ts';
import { prompt } from './eroe.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Ondate superate: chi cade nella pausa dopo l'ondata n l'ha superata; chi cade durante l'ondata n ne ha superate n − 1. */
export function superate(s: TState): number {
  if (s.fase === 'pausa') return s.ondata;
  return Math.max(0, s.ondata - 1);
}

function animEroe(s: TState): HeroAnim {
  const h = s.eroe;
  if (s.done && s.esito === 'morto') return 'morto';
  if (h.act === 'swing') return 'attacca';
  if (h.act === 'carica') return 'carica';
  if (h.hurt > 0) return 'colpito';
  return h.moving ? (h.corre ? 'corre' : 'cammina') : 'fermo';
}

export function viewOf(s: TState): TView {
  const h = s.eroe, a = h.armi[h.cur];
  const posa: DungeonView['hero'] = {
    x: r2(h.x), z: r2(h.z), fx: h.fx, fz: h.fz, anim: animEroe(s),
    t: h.act === 'swing' ? h.actT / Math.max(1, h.actDur) : 0, carica: h.act === 'carica' ? h.carica : 0,
    vita: h.vita, magicka: 0, stamina: h.fiato, max: { vita: h.max, magicka: 0, stamina: TEMPLARI.eroe.fiato },
    ricaricaMagia: 0, frecce: 0, pozioni: 0, protetto: false, arma: a?.id ?? null,
    ...(h.act === 'swing' ? { stile: h.stile } : {}),
  };
  const vivi = s.zombie.filter((z) => z.st !== 'morto').length;
  return {
    tick: s.tick, fase: s.fase, ondata: s.ondata, faseS: faseS(s), done: s.done, esito: s.esito, posa,
    eroe: {
      x: r2(h.x), z: r2(h.z), vita: h.vita, max: h.max, fiato: h.fiato / TEMPLARI.eroe.fiato, punti: s.punti,
      ferita: h.quiete < 90 ? 1 - h.quiete / 90 : 0,
      arma: a?.id ?? TEMPLARI.partenza.arma, armi: h.armi.map((x) => (x ? { ...x } : null)), cur: h.cur,
    },
    zombie: s.zombie.map((z) => ({
      id: z.id, tipo: z.tipo, x: r2(z.x), z: r2(z.z), fx: z.fx, fz: z.fz, anim: animZombie(z),
      t: z.stDur > 0 ? Math.min(1, z.stT / z.stDur) : 0, vita: Math.max(0, z.vita), max: z.max, vel: z.vel,
    })),
    finestre: s.arena.finestre.map((f, i) => ({ x: f.x, z: f.z, assi: s.assi[i] ?? 0, max: TEMPLARI.barricate.assi })),
    porte: s.arena.porte.map((p) => ({ id: p.id, aperta: !!s.porte[p.id] })),
    prompt: prompt(s),
    restano: s.fase === 'combatti' ? s.quanti - s.usciti + vivi : 0,
    uccisioni: s.uccisioni,
    eventi: s.eventi,
  };
}

export function hashOf(s: TState): number {
  const h = s.eroe;
  return hashJson({
    v: s.v, seed: s.seed, tick: s.tick, fase: s.fase, ondata: s.ondata, punti: s.punti, guadagnati: s.guadagnati, uccisioni: s.uccisioni,
    eroe: [Math.round(h.x * 100), Math.round(h.z * 100), Math.round(h.vita * 100), h.cur, h.armi.map((x) => (x ? [x.id, x.colpi, x.riserva] : null))],
    zombie: s.zombie.map((z) => [z.id, z.tipo, Math.round(z.x * 100), Math.round(z.z * 100), Math.round(z.vita), z.st]),
    assi: s.assi, porte: s.porte, esito: s.esito,
  });
}

export function resultOf(s: TState): TRisultato {
  return {
    done: s.done, esito: s.esito, ticks: s.tick, ondata: s.ondata, superate: superate(s),
    uccisioni: s.uccisioni, punti: s.punti, guadagnati: s.guadagnati, hash: hashOf(s),
  };
}
