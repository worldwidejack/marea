// Stato della partita a ondate e sua creazione. Tutto il resto (passo, vista, risultato) lavora su questo.
import { TEMPLARI, TEMPLARI_MAPPA, armaDef, nemicoDef } from '@marea/content/templari.ts';
import type { TArmaDef, TNemicoDef, TPotere } from '@marea/content/templari.ts';
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
/** Mischia: press → carica → swing · arco: tende → tira · fuoco: spara · fuoco greco: lancia · scudo in mano: spallata. */
export type EroeAct = 'idle' | 'press' | 'carica' | 'swing' | 'tende' | 'tira' | 'spara' | 'lancia' | 'spallata';
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
  /** Armi a distanza: tick prima del prossimo colpo, tick di ricarica che restano (0 = no) e quelli in tutto. */
  cd: number; ricarica: number; ricaricaDur: number;
  /** Scudo templare (null = non ce l'hai) e se è in mano (sennò sulle spalle). */
  scudo: { vita: number } | null; inMano: boolean;
  prevA: boolean; prevC: boolean; prevD: boolean;
};
/** `carica` = il cavaliere lanciato in linea retta; `fugge` = de Molay a metà vita che scappa ridendo. */
export type ZombieSt = 'sorge' | 'insegue' | 'strappa' | 'prepara' | 'colpisce' | 'recupera' | 'carica' | 'fugge' | 'morto';
/** Cosa sta preparando: colpo in mischia, carica a cavallo, bomba, palla di fuoco. */
export type ZombieModo = 'mischia' | 'carica' | 'bomba' | 'palla';
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
  /** Colpo in preparazione, tick prima del prossimo colpo speciale (carica, bomba, palla), verso della carica e dove mira la bomba. */
  modo: ZombieModo; cd: number; dx: number; dz: number; tx: number; tz: number;
  /** La carica ha già preso l'eroe; prossima fiamma della scia (de Molay); dove scappa. */
  preso: boolean; scia: number; fuga: { x: number; z: number } | null;
};
/** Tiro di un nemico: bomba del cannoniere (vola a parabola fino a dove eri), palla di fuoco di de Molay (dritta). */
export type TiroNemico = { id: number; tipo: 'bomba' | 'palla'; x: number; z: number; sx: number; sz: number; tx: number; tz: number; vx: number; vz: number; t: number; dur: number; danno: number; r: number };

/** Proiettile dell'eroe: freccia, palla (pistole, moschetto, pallini del trombone), vaso del fuoco greco (esplode dove arriva). */
export type Proj = { id: number; tipo: 'freccia' | 'palla' | 'vaso'; arma: string; x: number; z: number; vx: number; vz: number; danno: number;
  /** Tick di volo che restano, nemici che può ancora trapassare, già colpiti. */
  vita: number; trapassa: number; colpiti: number[] };
/** Fiamme a terra (fuoco greco, scia della spada di de Molay): bruciano gli zombie dentro. */
export type Fiamma = { id: number; x: number; z: number; r: number; dps: number; fine: number;
  /** Fiamme di de Molay: bruciano l'eroe, non gli zombie. */
  nemico?: boolean };
/** Cose a terra: lo scudo dello scudato (si prende con AZIONE) e i power-up (si prendono passandoci sopra). */
export type Drop = { id: number; tipo: 'scudo' | TPotere; x: number; z: number; fine: number };
/** Trappola: accesa fino al tick `fine`, di nuovo pronta dal tick `pronta`, prossimo colpo all'eroe se ci sta dentro. */
export type StatoTrappola = { fine: number; pronta: number; colpo: number };
export type CassaFase = 'chiusa' | 'gira' | 'pronta' | 'teschio' | 'vola';
export type Cassa = { posto: number; usi: number; max: number; fase: CassaFase; inizio: number; fine: number; arma: string | null };

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
  proj: Proj[]; fiamme: Fiamma[]; drops: Drop[]; tiri: TiroNemico[];
  /** Boss dell'ondata: chi, quando esce, se è già uscito. */
  boss: { tipo: string; at: number; uscito: boolean } | null;
  cassa: Cassa;
  trappole: StatoTrappola[];
  /** Power-up: Ira di Dio e Decima accese fino al tick, quanti ne sono usciti in questa ondata, l'ultimo uscito. */
  poteri: { ira: number; decima: number; ondata: number; ultimo: string };
  nextId: number;
  flow: Int32Array; flowCell: number; flowTick: number;
  done: boolean; esito: TEsito | null;
  eventi: TEvento[];
};

export function slotDi(a: TArmaDef): Slot { return { id: a.id, colpi: a.colpi ?? 0, riserva: a.riserva ?? 0 }; }
export const armaIn = (s: TState): TArmaDef => armaDef(s.eroe.armi[s.eroe.cur]?.id ?? TEMPLARI.partenza.arma);
export const slotIn = (s: TState): Slot | null => s.eroe.armi[s.eroe.cur] ?? null;
export const ev = (s: TState, e: TEvento): void => { s.eventi.push(e); };

export function createState(seed: number, opzioni: TOpzioni = {}): TState {
  const arena = parseArena(TEMPLARI_MAPPA), gr = creaGriglie(arena), c = TEMPLARI.eroe;
  const sp = arena.spawn;
  const s: TState = {
    v: 1, seed: seed >>> 0, tick: 0, opzioni: { ...(opzioni.subito ? { subito: true } : {}) }, arena, gr, rng: createRng(seed >>> 0),
    eroe: {
      x: sp.x, z: sp.z, fx: sp.fx, fz: sp.fz, vita: c.vita, max: c.vita, quiete: 9999, fiato: c.fiato, corre: false, moving: false,
      act: 'idle', actT: 0, actDur: 0, caricato: false, stile: 'fendente', colpiti: [], colpito: false, carica: 0,
      armi: [slotDi(armaDef(TEMPLARI.partenza.arma)), null], cur: 0, hurt: 0, riparaT: -999, cd: 0, ricarica: 0, ricaricaDur: 1, scudo: null, inMano: false,
      prevA: false, prevC: false, prevD: false,
    },
    punti: TEMPLARI.partenza.punti, guadagnati: 0, uccisioni: 0,
    fase: opzioni.subito ? 'inizio' : 'altare', faseT: 0, ondata: 0, quanti: 0, usciti: 0, prossima: 0, puntiAssi: 0,
    assi: arena.finestre.map(() => TEMPLARI.barricate.assi),
    porte: Object.fromEntries(arena.porte.map((p) => [p.id, false])),
    zombie: [], proj: [], fiamme: [], drops: [], tiri: [], boss: null,
    cassa: { posto: postoIniziale(arena), usi: 0, max: TEMPLARI.cassa.usiMax, fase: 'chiusa', inizio: 0, fine: 0, arma: null },
    trappole: arena.trappole.map(() => ({ fine: 0, pronta: 0, colpo: 0 })),
    poteri: { ira: 0, decima: 0, ondata: 0, ultimo: '' },
    nextId: 1,
    flow: new Int32Array(arena.w * arena.h), flowCell: -1, flowTick: -999,
    done: false, esito: null, eventi: [],
  };
  s.cassa.max = s.rng.int(TEMPLARI.cassa.usiMin, TEMPLARI.cassa.usiMax);
  s.flowCell = cellOf(gr.percorso, s.eroe.x, s.eroe.z);
  bfs(gr.percorso, s.flowCell, s.flow);
  s.flowTick = 0;
  return s;
}

/** La cassa comincia nel primo dei suoi posti che si raggiunge dalla chiesa (a porte chiuse). */
function postoIniziale(a: Arena): number {
  const dentro = new Set(a.dentro);
  const i = a.casse.findIndex((p) => {
    const cx = Math.floor(p.x / a.tile), cz = Math.floor(p.z / a.tile);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => dentro.has((cz + dz!) * a.w + cx + dx!));
  });
  return Math.max(0, i);
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
    modo: 'mischia', cd: secToTicks(2), dx: 0, dz: 1, tx: 0, tz: 0, preso: false, scia: 0, fuga: null,
  };
  s.zombie.push(zz);
  return zz;
}

export function animZombie(z: Zombie): TZombieAnim {
  switch (z.st) {
    case 'sorge': return 'sorge';
    case 'strappa': return 'strappa';
    case 'prepara': return z.modo === 'bomba' || z.modo === 'palla' ? 'lancia' : 'prepara';
    case 'colpisce': return 'colpisce';
    case 'recupera': return 'recupera';
    case 'morto': return 'morto';
    case 'carica': return 'carica';
    case 'fugge': return 'fugge';
    default: return z.vel > z.def.velocita.cammina * 1.3 ? 'corre' : 'cammina';
  }
}
