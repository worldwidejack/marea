// Stato della partita a ondate e sua creazione. Tutto il resto (passo, vista, risultato) lavora su questo.
import { TEMPLARI, TEMPLARI_MAPPA, armaDef, nemicoDef } from '@marea/content/templari.ts';
import type { TArmaDef, TNemicoDef, TPotere, TPozione } from '@marea/content/templari.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import { TICK_HZ } from '../constants.ts';
import type { SwingStyle } from '../dungeon/swing.ts';
import { bfs, cellOf, moveCircle } from '../dungeon/map.ts';
import { creaGriglie, parseArena } from './mappa.ts';
import type { Arena, Griglie } from './mappa.ts';
import type { TEsito, TEvento, TEventoDi, TFase, TOpzioni, TZombieAnim } from './types.ts';

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

/** `pot`: potenziata dal Mercante. */
export type Slot = { id: string; colpi: number; riserva: number; pot?: boolean };
/** Mischia: press → carica → swing · arco: tende → tira · fuoco: spara · fuoco greco: lancia · scudo in mano: spallata · beve una pozione. */
export type EroeAct = 'idle' | 'press' | 'carica' | 'swing' | 'tende' | 'tira' | 'spara' | 'lancia' | 'spallata' | 'beve';
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
  /** Pozioni della Strega che hai bevuto (al massimo TEMPLARI.strega.max), elisir del risorto comprati, intoccabile fino al tick. */
  pozioni: TPozione[]; elisir: number; intoccabile: number;
  /** Insieme: caduto (si rialza all'ondata dopo) e uscito dalla partita (non torna). Da solo cadere chiude la partita. */
  giu: boolean; fuori: boolean;
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
  /** Danni che lo scudo davanti regge ancora (0 = niente scudo, o spaccato). */
  scudo: number;
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
/** `chi` = l'eroe che l'ha aperta (insieme: l'arma esce tra quelle che non ha lui). */
export type Cassa = { posto: number; usi: number; max: number; fase: CassaFase; inizio: number; fine: number; arma: string | null; chi?: number };

export type TState = {
  v: 1; seed: number; tick: number; opzioni: TOpzioni;
  arena: Arena; gr: Griglie;
  rng: Rng;
  /** L'eroe di turno: quello che si muove, colpisce, compra (s.eroi[s.chi]); gli zombie lo puntano uno alla volta (usa()). */
  eroe: Eroe;
  /** Tutti gli eroi (insieme: uno per giocatore, nell'ordine della squadra; da solo uno). Punti, cassa e porte sono della squadra. */
  eroi: Eroe[]; chi: number;
  punti: number; guadagnati: number; uccisioni: number;
  fase: TFase; faseT: number;
  ondata: number;
  /** Zombie dell'ondata: quanti in tutto, quanti già usciti, prossima comparsa (tick). */
  quanti: number; usciti: number; prossima: number;
  /** Quanti ne sono usciti per tipo in questa ondata (i tipi con `maxOndata` arrivano piano piano). */
  tipiUsciti: Record<string, number>;
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
  /** Insieme: il flow field degli zombie ha come origine queste celle (gli eroi in piedi); da solo si usa flowCell. */
  flowCelle: number[];
  /** Power-up: Ira di Dio e Decima accese fino al tick, quanti ne sono usciti in questa ondata, l'ultimo uscito. */
  poteri: { ira: number; decima: number; ondata: number; ultimo: string };
  nextId: number;
  flow: Int32Array; flowCell: number; flowTick: number;
  done: boolean; esito: TEsito | null;
  eventi: TEventoDi[];
};

export function slotDi(a: TArmaDef, pot = false): Slot {
  const p = pot ? potenziata(a) : a;
  return { id: a.id, colpi: p.colpi ?? 0, riserva: p.riserva ?? 0, ...(pot ? { pot: true } : {}) };
}
/** L'arma potenziata dal Mercante: danno × (le miracolose meno), caricatore e riserva più grandi, ricarica più svelta, nome nuovo. */
const POT = new Map<string, TArmaDef>();
export function potenziata(a: TArmaDef): TArmaDef {
  let p = POT.get(a.id);
  if (!p) {
    const k = TEMPLARI.mercante.potenzia;
    p = { ...a, nome: a.nomePot, danno: a.danno * (a.miracolosa ? k.dannoMiracolosa : k.danno),
      ...(a.colpi !== undefined ? { colpi: Math.ceil(a.colpi * k.colpi) } : {}), ...(a.riserva !== undefined ? { riserva: Math.ceil(a.riserva * k.riserva) } : {}),
      ...(a.ricarica !== undefined ? { ricarica: a.ricarica * k.ricarica } : {}) };
    POT.set(a.id, p);
  }
  return p;
}
export const haPozione = (s: TState, id: TPozione): boolean => s.eroe.pozioni.includes(id);
export const pozioneDef = (id: TPozione) => TEMPLARI.strega.pozioni.find((p) => p.id === id)!;
/** L'arma di uno slot come la usi adesso: potenziata se lo è, poi le pozioni (Infuso lesto: ricarica e arco; Grappa: armi a distanza). */
export function armaDi(s: TState, sl: Slot | null): TArmaDef {
  const base = armaDef(sl?.id ?? TEMPLARI.partenza.arma), a = sl?.pot ? potenziata(base) : base;
  const lesto = haPozione(s, 'lesto'), bomb = haPozione(s, 'bombardiere') && a.tipo !== 'mischia';
  if (!lesto && !bomb) return a;
  const l = pozioneDef('lesto').ricarica ?? 1, b = pozioneDef('bombardiere');
  return {
    ...a,
    danno: a.danno * (bomb ? b.danno ?? 1 : 1),
    tempo: a.tempo * (bomb ? b.tempo ?? 1 : 1) * (lesto && a.tipo === 'arco' ? l : 1),
    ...(a.ricarica !== undefined ? { ricarica: a.ricarica * (lesto ? l : 1) } : {}),
  };
}
export const armaIn = (s: TState): TArmaDef => armaDi(s, s.eroe.armi[s.eroe.cur] ?? null);
/** Fiato pieno (il Brodo del viandante lo raddoppia). */
export const fiatoMax = (s: TState): number => TEMPLARI.eroe.fiato * (haPozione(s, 'viandante') ? pozioneDef('viandante').fiato ?? 1 : 1);
export const slotIn = (s: TState): Slot | null => s.eroe.armi[s.eroe.cur] ?? null;
/** Un evento; insieme porta `e` = l'eroe di turno (il client mostra a ciascuno solo i suoi colpi presi, la sua caduta…). */
export const ev = (s: TState, e: TEvento): void => { s.eventi.push(s.eroi.length > 1 ? { ...e, e: s.chi } : e); };
/** L'eroe i diventa quello di turno. */
export function usa(s: TState, i: number): void { s.chi = i; s.eroe = s.eroi[i]!; }
/** Gli eroi ancora in partita e in piedi (indici). */
export function inPiedi(s: TState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.eroi.length; i++) { const h = s.eroi[i]!; if (!h.giu && !h.fuori) out.push(i); }
  return out;
}
/** Insieme: quanti eroi al massimo. */
export const MAX_EROI = 4;

function nuovoEroe(x: number, z: number, fx: number, fz: number): Eroe {
  const c = TEMPLARI.eroe;
  return {
    x, z, fx, fz, vita: c.vita, max: c.vita, quiete: 9999, fiato: c.fiato, corre: false, moving: false,
    act: 'idle', actT: 0, actDur: 0, caricato: false, stile: 'fendente', colpiti: [], colpito: false, carica: 0,
    armi: [slotDi(armaDef(TEMPLARI.partenza.arma)), null], cur: 0, hurt: 0, riparaT: -999, cd: 0, ricarica: 0, ricaricaDur: 1, scudo: null, inMano: false,
    prevA: false, prevC: false, prevD: false, pozioni: [], elisir: 0, intoccabile: 0, giu: false, fuori: false,
  };
}
/** Insieme: dove compare (o si rialza) l'eroe i: accanto alla partenza, a giro, senza finire nei muri. */
export function posaEroe(s: TState, h: Eroe, i: number): void {
  const sp = s.arena.spawn, k = [[0, 0], [1.3, 0], [-1.3, 0], [0, 1.3]][i % MAX_EROI]!;
  h.x = sp.x; h.z = sp.z; h.fx = sp.fx; h.fz = sp.fz;
  if (k[0] || k[1]) moveCircle(s.gr.eroe, h, k[0]!, k[1]!, TEMPLARI.eroe.raggio);
}

export function createState(seed: number, opzioni: TOpzioni = {}): TState {
  const arena = parseArena(TEMPLARI_MAPPA), gr = creaGriglie(arena);
  const sp = arena.spawn, n = Math.max(1, Math.min(MAX_EROI, Math.floor(opzioni.eroi ?? 1)));
  const eroe = nuovoEroe(sp.x, sp.z, sp.fx, sp.fz);
  const s: TState = {
    v: 1, seed: seed >>> 0, tick: 0, opzioni: { ...(opzioni.subito ? { subito: true } : {}), ...(n > 1 ? { eroi: n } : {}) }, arena, gr, rng: createRng(seed >>> 0),
    eroe, eroi: [eroe], chi: 0,
    punti: TEMPLARI.partenza.punti, guadagnati: 0, uccisioni: 0,
    fase: opzioni.subito ? 'inizio' : 'altare', faseT: 0, ondata: 0, quanti: 0, usciti: 0, prossima: 0, tipiUsciti: {}, puntiAssi: 0,
    assi: arena.finestre.map(() => TEMPLARI.barricate.assi),
    porte: Object.fromEntries(arena.porte.map((p) => [p.id, false])),
    zombie: [], proj: [], fiamme: [], drops: [], tiri: [], boss: null,
    cassa: { posto: postoIniziale(arena), usi: 0, max: TEMPLARI.cassa.usiMax, fase: 'chiusa', inizio: 0, fine: 0, arma: null },
    trappole: arena.trappole.map(() => ({ fine: 0, pronta: 0, colpo: 0 })),
    poteri: { ira: 0, decima: 0, ondata: 0, ultimo: '' },
    nextId: 1,
    flow: new Int32Array(arena.w * arena.h), flowCell: -1, flowTick: -999, flowCelle: [],
    done: false, esito: null, eventi: [],
  };
  for (let i = 1; i < n; i++) { const h = nuovoEroe(sp.x, sp.z, sp.fx, sp.fz); s.eroi.push(h); posaEroe(s, h, i); }
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
    scudo: def.scudo !== undefined ? Math.round(vitaOndata(s.ondata) * (def.scudoVita ?? 1)) : 0,
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
