// Vista per il client (TView), risultato (TRisultato) e hash dello stato a fine partita (uguale tra client e server se gli input coincidono).
import { TEMPLARI } from '@marea/content/templari.ts';
import { hashJson } from '../hash.ts';
import type { DungeonView, HeroAnim } from '../dungeon/types.ts';
import type { TRisultato, TView } from './types.ts';
import type { TState } from './stato.ts';
import { animZombie } from './stato.ts';
import { faseS } from './ondate.ts';
import { prompt } from './eroe.ts';
import { faseCassa } from './cassa.ts';

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
  if (h.act === 'tende') return 'tende';
  if (h.act === 'tira') return 'tira';
  if (h.act === 'spara' || h.act === 'lancia' || h.act === 'spallata') return 'lancia';
  if (h.hurt > 0) return 'colpito';
  return h.moving ? (h.corre ? 'corre' : 'cammina') : 'fermo';
}

export function viewOf(s: TState): TView {
  const h = s.eroe, a = h.armi[h.cur];
  const posa: DungeonView['hero'] = {
    x: r2(h.x), z: r2(h.z), fx: h.fx, fz: h.fz, anim: animEroe(s),
    t: h.act !== 'idle' && h.act !== 'press' && h.act !== 'carica' && h.act !== 'tende' ? Math.min(1, h.actT / Math.max(1, h.actDur)) : 0, carica: h.act === 'carica' || h.act === 'tende' ? h.carica : 0,
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
      arma: h.inMano ? 'scudo' : a?.id ?? TEMPLARI.partenza.arma, armi: h.armi.map((x) => (x ? { ...x } : null)), cur: h.cur,
      ricarica: h.ricarica > 0 ? 1 - h.ricarica / Math.max(1, h.ricaricaDur) : 0,
      scudo: h.scudo ? { vita: h.scudo.vita, max: TEMPLARI.scudo.vita, inMano: h.inMano } : null,
    },
    zombie: s.zombie.map((z) => ({
      id: z.id, tipo: z.tipo, x: r2(z.x), z: r2(z.z), fx: z.fx, fz: z.fz, anim: animZombie(z),
      t: z.stDur > 0 ? Math.min(1, z.stT / z.stDur) : 0, vita: Math.max(0, z.vita), max: z.max, vel: z.vel, boss: !!z.def.boss,
    })),
    tiri: s.tiri.map((b) => ({ id: b.id, tipo: b.tipo, x: r2(b.x), z: r2(b.z), tx: r2(b.tx), tz: r2(b.tz), r: b.r, k: b.dur > 0 ? Math.min(1, b.t / b.dur) : 0 })),
    boss: bossVista(s),
    proiettili: s.proj.map((p) => ({ id: p.id, tipo: p.tipo, x: r2(p.x), z: r2(p.z), vx: p.vx, vz: p.vz })),
    fiamme: s.fiamme.map((f) => ({ id: f.id, x: r2(f.x), z: r2(f.z), r: f.r, resta: Math.max(0, (f.fine - s.tick) / 60) })),
    drops: s.drops.map((d) => ({ id: d.id, tipo: d.tipo, x: r2(d.x), z: r2(d.z), resta: Math.max(0, (d.fine - s.tick) / 60) })),
    poteri: { ira: Math.max(0, (s.poteri.ira - s.tick) / 60), decima: Math.max(0, (s.poteri.decima - s.tick) / 60) },
    trappole: s.arena.trappole.map((t, i) => {
      const st = s.trappole[i]!;
      return { id: t.id, accesa: Math.max(0, (st.fine - s.tick) / 60), pronta: s.tick >= st.pronta, ricarica: Math.max(0, (st.pronta - s.tick) / 60) };
    }),
    cassa: { ...(s.arena.casse[s.cassa.posto] ?? { x: 0, z: 0, fx: 0, fz: 1 }), fase: s.cassa.fase, arma: s.cassa.arma, t: faseCassa(s) },
    finestre: s.arena.finestre.map((f, i) => ({ x: f.x, z: f.z, assi: s.assi[i] ?? 0, max: TEMPLARI.barricate.assi })),
    porte: s.arena.porte.map((p) => ({ id: p.id, aperta: !!s.porte[p.id] })),
    prompt: prompt(s),
    restano: s.fase === 'combatti' ? s.quanti - s.usciti + vivi : 0,
    uccisioni: s.uccisioni,
    eventi: s.eventi,
  };
}

function bossVista(s: TState): TView['boss'] {
  const z = s.zombie.find((x) => x.def.boss && x.st !== 'morto');
  return z ? { id: z.id, tipo: z.tipo, nome: z.def.nome, vita: Math.max(0, z.vita), max: z.max, fugge: z.def.fugge ?? 0 } : null;
}

export function hashOf(s: TState): number {
  const h = s.eroe;
  return hashJson({
    v: s.v, seed: s.seed, tick: s.tick, fase: s.fase, ondata: s.ondata, punti: s.punti, guadagnati: s.guadagnati, uccisioni: s.uccisioni,
    eroe: [Math.round(h.x * 100), Math.round(h.z * 100), Math.round(h.vita * 100), h.cur, h.armi.map((x) => (x ? [x.id, x.colpi, x.riserva] : null)), h.scudo ? Math.round(h.scudo.vita) : -1, h.inMano ? 1 : 0],
    cassa: [s.cassa.posto, s.cassa.usi, s.cassa.fase, s.cassa.arma], proj: s.proj.length, fiamme: s.fiamme.length, tiri: s.tiri.length, boss: s.boss,
    zombie: s.zombie.map((z) => [z.id, z.tipo, Math.round(z.x * 100), Math.round(z.z * 100), Math.round(z.vita), z.st]),
    assi: s.assi, porte: s.porte, esito: s.esito,
    trappole: s.trappole.map((t) => [t.fine, t.pronta]), poteri: [s.poteri.ira, s.poteri.decima, s.poteri.ondata], drops: s.drops.map((d) => [d.id, d.tipo]),
  });
}

export function resultOf(s: TState): TRisultato {
  return {
    done: s.done, esito: s.esito, ticks: s.tick, ondata: s.ondata, superate: superate(s),
    uccisioni: s.uccisioni, punti: s.punti, guadagnati: s.guadagnati, hash: hashOf(s),
  };
}
