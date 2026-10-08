// Stato della partita a ondate e sua creazione. Tutto il resto (passo, vista, risultato) lavora su questo.
import { TEMPLARI, TEMPLARI_MAPPA, armaDef, nemicoDef } from '@marea/content/templari.ts';
import type { TArmaDef, TNemicoDef } from '@marea/content/templari.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import { TICK_HZ } from '../constants.ts';
import type { SwingStyle } from '../dungeon/swing.ts';
import { bfs, cellOf } from '../dungeon/map.ts';
import { creaGriglie, parseArena } from './mappa.ts';
import type { Arena, Griglie } from './mappa.ts';
import type { TEsito, TEvento, TFase, TOpzioni, TZombieAnim } from './types.ts';

export const HZ = TICK_HZ;
export const secToTicks = (sec: number): number => Math.max(1, Math.round(sec * HZ));
/** A tenuto oltre questo = carica il giro (come nel dungeon). */
export const HOLD_TICKS = Math.round(0.2 * HZ);
/** Flow field degli zombie ricalcolato al massimo ogni N tick (e solo se l'eroe ha cambiato cella). */
export const FLOW_OGNI = 10;
/** Il nemico colpisce solo se l'eroe è ancora davanti a lui (~145°) e in portata (+ tolleranza). */
export const COS_CONO_NEMICO = 0.3;
export const TOLLERANZA = 0.25;
/** Tick dei fotogrammi brevi. */
export const COLPITO_TICKS = Math.round(0.2 * HZ);
export const COLPISCE_TICKS = Math.round(0.15 * HZ);
/** Durata della caduta di uno zombie morto prima di sparire. */
export const MORTO_TICKS = Math.round(1.2 * HZ);

export type Slot = { id: string; colpi: number; riserva: number };
export type EroeAct = 'idle' | 'press' | 'carica' | 'swing';
export type Eroe = {
  x: number; z: number; fx: number; fz: number;
  vita: number; max: number;
  /** Tick dall'ultimo colpo preso (rigenera dopo regenDopo). */
  quiete: number;
  fiato: number; corre: boolean; moving: boolean;
  act: EroeAct; actT: number; actDur: number;
  caricato: boolean; stile: SwingStyle; colpiti: number[]; colpito: boolean; carica: number;
  armi: (Slot | null)[]; cur: number;
  hurt: number;
  /** Tick dell'ultimo AZIONE su una finestra (ritmo della riparazione). */
  riparaT: number;
  prevA: boolean; prevC: boolean; prevD: boolean;
};
export type ZombieSt = 'sorge' | 'insegue' | 'strappa' | 'prepara' | 'colpisce' | 'recupera' | 'morto';
export type Zombie = {
  id: number; tipo: string; def: TNemicoDef;
  x: number; z: number; fx: number; fz: number;
  vita: number; max: number; vel: number;
  st: ZombieSt; stT: number; stDur: number;
  /** Finestra che sta strappando (-1 = nessuna). */
  finestra: number;
  hurt: number;
  /** Progresso verso l'eroe: distanza minima sul campo e tick dell'ultimo miglioramento (per chi resta bloccato). */
  best: number; bestT: number;
  /** Prossimo grido (tick). */
  grido: number;
};

export type TState = {
  v: 1; seed: number; tick: number; opzioni: TOpzioni;
  arena: Arena; gr: Griglie;
  rng: Rng;
  eroe: Eroe;
  punti: number; guadagnati: number; uccisioni: number;
  fase: TFase; faseT: number;
  ondata: number;
  /** Zombie dell'ondata: quanti in tutto, quanti già usciti, prossima comparsa (tick). */
  quanti: number; usciti: number; prossima: number;
  /** Punti dalle assi in questa ondata (hanno un tetto). */
  puntiAssi: number;
  assi: number[];
  porte: Record<string, boolean>;
  zombie: Zombie[];
  nextId: number;
  flow: Int32Array; flowCell: number; flowTick: number;
  done: boolean; esito: TEsito | null;
  eventi: TEvento[];
};

export function slotDi(a: TArmaDef): Slot { return { id: a.id, colpi: a.colpi ?? 0, riserva: a.riserva ?? 0 }; }
export const armaIn = (s: TState): TArmaDef => armaDef(s.eroe.armi[s.eroe.cur]?.id ?? TEMPLARI.partenza.arma);
export const ev = (s: TState, e: TEvento): void => { s.eventi.push(e); };

export function createState(seed: number, opzioni: TOpzioni = {}): TState {
  const arena = parseArena(TEMPLARI_MAPPA), gr = creaGriglie(arena), c = TEMPLARI.eroe;
  const sp = arena.spawn;
  const s: TState = {
    v: 1, seed: seed >>> 0, tick: 0, opzioni: { ...(opzioni.subito ? { subito: true } : {}) }, arena, gr, rng: createRng(seed >>> 0),
    eroe: {
      x: sp.x, z: sp.z, fx: sp.fx, fz: sp.fz, vita: c.vita, max: c.vita, quiete: 9999, fiato: c.fiato, corre: false, moving: false,
      act: 'idle', actT: 0, actDur: 0, caricato: false, stile: 'fendente', colpiti: [], colpito: false, carica: 0,
      armi: [slotDi(armaDef(TEMPLARI.partenza.arma)), null], cur: 0, hurt: 0, riparaT: -999, prevA: false, prevC: false, prevD: false,
    },
    punti: TEMPLARI.partenza.punti, guadagnati: 0, uccisioni: 0,
    fase: opzioni.subito ? 'inizio' : 'altare', faseT: 0, ondata: 0, quanti: 0, usciti: 0, prossima: 0, puntiAssi: 0,
    assi: arena.finestre.map(() => TEMPLARI.barricate.assi),
    porte: Object.fromEntries(arena.porte.map((p) => [p.id, false])),
    zombie: [], nextId: 1,
    flow: new Int32Array(arena.w * arena.h), flowCell: -1, flowTick: -999,
    done: false, esito: null, eventi: [],
  };
  s.flowCell = cellOf(gr.percorso, s.eroe.x, s.eroe.z);
  bfs(gr.percorso, s.flowCell, s.flow);
  s.flowTick = 0;
  return s;
}

/** Vita degli zombie all'ondata n (come COD: +100 a ondata fino alla 9, poi ×1,1 a ondata). */
export function vitaOndata(n: number): number {
  const v = TEMPLARI.ondate.vita, k = Math.max(1, n);
  if (k <= v.finoA) return v.base + v.perOndata * (k - 1);
  let x = v.base + v.perOndata * (v.finoA - 1);
  for (let i = v.finoA; i < k; i++) x *= v.molt;
  return Math.round(x);
}
/** Zombie dell'ondata n. */
export function quantiOndata(n: number): number {
  const q = TEMPLARI.ondate.quanti, k = Math.max(1, n) - 1;
  return Math.min(q.max, Math.round(q.base + q.lin * k + q.quad * k * k));
}
/** Secondi tra due comparse all'ondata n. */
export function intervalloOndata(n: number): number {
  const i = TEMPLARI.ondate.intervallo;
  return Math.max(i.min, i.base + i.perOndata * (Math.max(1, n) - 1));
}

export function nuovoZombie(s: TState, tipo: string, x: number, z: number, vel: number): Zombie {
  const def = nemicoDef(tipo), max = Math.round(vitaOndata(s.ondata) * def.vitaMolt);
  const zz: Zombie = {
    id: s.nextId++, tipo, def, x, z, fx: 0, fz: 1, vita: max, max, vel, st: 'sorge', stT: 0, stDur: secToTicks(def.sorge),
    finestra: -1, hurt: 0, best: 1e9, bestT: s.tick, grido: s.tick + secToTicks(2 + s.rng.next() * 6),
  };
  s.zombie.push(zz);
  return zz;
}

export function animZombie(z: Zombie): TZombieAnim {
  switch (z.st) {
    case 'sorge': return 'sorge';
    case 'strappa': return 'strappa';
    case 'prepara': return 'prepara';
    case 'colpisce': return 'colpisce';
    case 'recupera': return 'recupera';
    case 'morto': return 'morto';
    default: return z.vel > z.def.velocita.cammina * 1.3 ? 'corre' : 'cammina';
  }
}
