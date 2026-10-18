// Le pose della Difesa (#379): quale clip e quale fotogramma mostrare per ogni cosa in campo, dallo stato della sim. Niente canvas: i
// fotogrammi seguono l'orologio della sim (si fermano in pausa e vanno al doppio col veloce); le molle da codice (spuntata, respiro,
// lampo bianco) restano in disegna.ts e usano il tempo di resa.
import type { DState, DNemico, DUnita } from '@marea/sim/difesa/stato.ts';
import { haBersaglio } from '@marea/sim/difesa/unita.ts';
import { TICK_HZ } from '@marea/sim/constants.ts';
import type { ChiaveSprite, NomeClip, Pelle, Posa } from './skin.ts';
import { clipDi, spoglio } from './skin.ts';

/** La memoria di resa di ogni cosa in campo: tempi di resa (s) per le molle, tick della sim e strada fatta per i fotogrammi. */
export type Anim = {
  nato: number; rinculo: number; morso: number; armata: number; passo: number; xPrima: number;
  /** tick dell'ultimo colpo, ultimo `u.t` visto, tick dell'ultimo seme, caselle di strada, orologio della clip (s), ultimo tick visto. */
  kSparo: number; tPrima: number; kSeme: number; strada: number; orologio: number; tick: number;
  /** a caso per ognuno: niente battiti di ciglia tutti insieme. */
  fase: number;
};
export const nuovaAnim = (t: number, tick: number): Anim => {
  const fase = Math.random();
  return { nato: t, rinculo: -9, morso: -9, armata: -9, passo: fase * 6, xPrima: Number.NaN, kSparo: -9999, tPrima: Number.NaN, kSeme: -9999, strada: fase, orologio: fase * 3, tick, fase };
};

const tk = (s: number) => Math.round(s * TICK_HZ);
const quanti = (p: Pelle, k: ChiaveSprite, c: NomeClip) => clipDi(p, k, c)?.c.f.length ?? 0;
const fps = (p: Pelle, k: ChiaveSprite, c: NomeClip, d = 8) => clipDi(p, k, c)?.c.fps || d;
/** La prima clip che la pelle ha, tra quelle chieste; altrimenti `fermo`. */
function prima(p: Pelle, k: ChiaveSprite, ...prova: NomeClip[]): NomeClip {
  for (const c of prova) if (clipDi(p, k, c)) return c;
  return 'fermo';
}
/** Ogni ~4 s un battito di ciglia di 0,13 s (se la pelle ha la clip `chiusi`). */
const battito = (s: DState, a: Anim) => ((s.tick / TICK_HZ + a.fase * 4) % 4.1) < 0.13;

/** Fa avanzare orologio e strada di un'unità o di un nemico (una volta per frame, prima della posa). */
export function aggiorna(s: DState, a: Anim, x: number | null, lento: boolean, inVolo: boolean): void {
  const d = s.tick - a.tick;
  a.tick = s.tick;
  if (d > 0) a.orologio += (d / TICK_HZ) * (lento ? 0.5 : 1);
  if (x === null) return;
  if (!Number.isNaN(a.xPrima) && !inVolo) a.strada += Math.abs(a.xPrima - x);
  a.xPrima = x;
}

export function posaUnita(s: DState, p: Pelle, u: DUnita, a: Anim): Posa {
  const k: ChiaveSprite = u.tipo;
  const fermo = (): Posa => ({ k, clip: battito(s, a) && quanti(p, k, 'chiusi') ? 'chiusi' : 'fermo', i: 0 });
  switch (u.tipo) {
    case 'sparatore': case 'gelo': {
      const dopo = s.tick - a.kSparo;
      if (dopo >= 0 && dopo < tk(0.16) && quanti(p, k, 'spara')) return { k, clip: 'spara', i: Math.floor((dopo / TICK_HZ) * fps(p, k, 'spara', 12)) };
      if (u.t - s.tick <= tk(0.22) && quanti(p, k, 'carica') && haBersaglio(s, u)) return { k, clip: 'carica', i: 0 };
      return fermo();
    }
    case 'produttore': {
      // la sim riprogramma `u.t` quando il seme esce: lì parte la posa del seme
      if (!Number.isNaN(a.tPrima) && u.t > a.tPrima && s.tick > u.nata + 2) a.kSeme = s.tick;
      a.tPrima = u.t;
      if (s.tick - a.kSeme < tk(0.35) && quanti(p, k, 'seme')) return { k, clip: 'seme', i: 0 };
      if (u.t - s.tick < tk(0.9) && quanti(p, k, 'manovella')) return { k, clip: 'manovella', i: Math.floor((s.tick / TICK_HZ) * fps(p, k, 'manovella', 7)) };
      return fermo();
    }
    case 'bomba': {
      const q = (s.tick - u.nata) / Math.max(1, u.t - u.nata);
      return { k, clip: q < 0.35 ? 'fermo' : q < 0.7 ? prima(p, k, 'gonfia') : prima(p, k, 'rovente', 'gonfia'), i: 0 };
    }
    case 'muro': {
      const f = u.vita / u.vitaMax;
      if (f > 2 / 3) return fermo();
      return { k, clip: f > 1 / 3 ? prima(p, k, 'rosicchiato') : prima(p, k, 'mezzo', 'rosicchiato'), i: 0 };
    }
    case 'mina': {
      if (!u.armata) return quanti(p, k, 'sotto') ? { k, clip: 'sotto', i: 0 } : { k: 'minaSotto', clip: 'fermo', i: 0 };
      if (s.tick - u.t < tk(0.3) && quanti(p, k, 'spunta')) return { k, clip: 'spunta', i: 0 };
      const lampo = ((s.tick / TICK_HZ + a.fase) % 1.2) < 0.18;
      return { k, clip: lampo ? prima(p, k, 'lampo') : 'fermo', i: 0 };
    }
  }
  return fermo();
}

/** La chiave da disegnare per un nemico: senza armatura il corpo nudo (lo scarabeo resta scarabeo). */
export function chiaveNemico(p: Pelle, e: DNemico): ChiaveSprite {
  return (e.tipo === 'cono' || e.tipo === 'secchio') && e.armatura <= 0 ? spoglio(p, e.tipo) : e.tipo;
}

export function posaNemico(s: DState, p: Pelle, e: DNemico, a: Anim): Posa {
  const k = chiaveNemico(p, e);
  if (!e.testa) return { k, clip: prima(p, k, 'ko'), i: 0 };
  if (e.salto === 1 && quanti(p, k, 'salta')) {
    const q = (s.tick - e.saltoT0) / Math.max(1, e.saltoT1 - e.saltoT0), n = quanti(p, k, 'salta');
    return { k, clip: 'salta', i: Math.min(n - 1, Math.floor(q * n)) };
  }
  if (e.mangia > 0 && quanti(p, k, 'mangia')) return { k, clip: 'mangia', i: Math.floor(a.orologio * fps(p, k, 'mangia', 7)) };
  const clip = e.corsa > 0 && e.salto === 0 ? prima(p, k, 'corre', 'cammina') : prima(p, k, 'cammina');
  const c = clipDi(p, k, clip)?.c;
  if (!c) return { k, clip: 'fermo', i: 0 };
  if (c.giro > 0) return { k, clip, i: Math.floor((a.strada / c.giro) * c.f.length) };
  return { k, clip, i: Math.floor(a.orologio * (c.fps || 6)) };
}

/** L'annaffiatoio (o il tosaerba): fermo, o la clip `corre` mentre scatta. */
export function posaTosaerba(s: DState, p: Pelle, stato: number): Posa {
  if (stato === 1 && quanti(p, 'tosaerba', 'corre')) return { k: 'tosaerba', clip: 'corre', i: Math.floor((s.tick / TICK_HZ) * fps(p, 'tosaerba', 'corre', 12)) };
  return { k: 'tosaerba', clip: 'fermo', i: 0 };
}
/** C'è una clip vera (più di un fotogramma o una posa diversa da fermo) per questa chiave? Serve a spegnere il movimento da codice. */
export const animato = (p: Pelle, k: ChiaveSprite, ...clip: NomeClip[]) => clip.some((c) => quanti(p, k, c) > 0);
