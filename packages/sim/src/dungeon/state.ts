// Stato della partita nel dungeon e creazione da DungeonDef + RunHero + seed. Tutto il resto (passo, vista, risultato) lavora su questo.
import { enemyDef } from '@marea/content/rpg.ts';
import type { DungeonDef, EnemyDef, Traits } from '@marea/content/rpg.ts';
import type { RunHero, RunOutcome, RunWeapon } from '../rpg/types.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { DungeonEvent, HeroAnim } from './types.ts';
import { bfs, cellOf, parseDungeon } from './map.ts';
import type { DMap } from './map.ts';
import { rollLoot } from './loot.ts';
import { HZ, P_DORME } from './tuning.ts';

export type Bag = Record<string, number>;
/** Azione in corso dell'eroe. press = A appena premuto (si decide al rilascio o dopo HOLD_TICKS). */
export type HeroAct = 'idle' | 'press' | 'carica' | 'swing' | 'tende' | 'tira' | 'lancia' | 'beve';
export type HeroRt = {
  x: number; z: number; fx: number; fz: number;
  vita: number; magicka: number; stamina: number;
  act: HeroAct; actT: number; actDur: number;
  /** Swing: caricato, colpo già risolto. */
  caricato: boolean; colpito: boolean;
  /** 0..1 carica o tensione corrente. */
  carica: number;
  moving: boolean; running: boolean; hurt: number;
  /** Tick di protezione dopo il risveglio all'altare: niente danni. */
  protetto: number;
  arma: RunWeapon; frecce: number; pozioni: number;
  cdMagia: number;
  buffs: { mod: string; valore: number; fine: number }[];
  /** Colpi a segno con l'arma fragile (per usura e rottura). */
  colpiFragile: number;
  prevA: boolean; prevC: boolean; prevD: boolean;
};
export type EnemyState = 'dorme' | 'veglia' | 'insegue' | 'prepara' | 'colpisce' | 'recupera' | 'scappa' | 'morto';
export type Enemy = {
  id: number; tipo: string; def: EnemyDef;
  x: number; z: number; fx: number; fz: number;
  vita: number; max: number;
  st: EnemyState; stT: number; stDur: number;
  alleato: boolean; scade: number;
  aggro: boolean; hurt: number;
  bleed: number; bleedT: number;
  cdTiro: number; attacchi: number; area: boolean;
  /** Il colpo in preparazione è un tiro (proiettile). */
  tiro: boolean;
  /** Bersaglio dell'alleato (id nemico) o -1. */
  bersaglio: number;
  /** Ultimo colpo subito: per dropRaro e dropMolt alla morte. */
  dropRaro: boolean; dropMolt: number;
};
export type ProjKind = 'freccia' | 'magia' | 'freccia_nemica' | 'magia_nemica';
export type Proj = {
  id: number; tipo: ProjKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number;
  danno: number; life: number;
  /** Eroe: tratti uniti di arco e frecce, magia (raggio esplosione, sanguina). */
  traits: Traits; raggio: number; colpiti: number[];
  dalNemico: boolean; contundente: boolean; magico: boolean; arrowId: string | null;
};
/** Ultimo altare toccato: il bottino e le monete di quel momento sono al sicuro (docs/RPG.md §4). */
export type Salvato = { altare: number; tick: number; bottino: Bag; monete: number };
export type Loot = { id: number; x: number; z: number; tipo: 'cadavere' | 'forziere' | 'libro'; items: Bag; monete: number; vuoto: boolean; pieno: boolean };
export type DungeonState = {
  v: 1; seed: number; dungeon: string; def: DungeonDef; map: DMap; runHero: RunHero;
  tick: number; done: boolean; outcome: RunOutcome | null;
  hero: HeroRt; anim: HeroAnim;
  enemies: Enemy[]; proj: Proj[]; loot: Loot[];
  nextId: number;
  /** Flow field verso l'eroe (BFS dalla sua cella) e tick del calcolo. */
  flow: Int32Array; flowTick: number; flowCell: number;
  rng: Rng;
  // risultato
  bottino: Bag; monete: number; xp: Record<string, number>; usati: Bag; rotti: Bag; usura: Bag; uccisi: Bag;
  danniFatti: number; danniPresi: number;
  /** Altare su cui sta l'eroe adesso (-1 = nessuno): salva solo entrandoci. */
  altare: number;
  salvato: Salvato | null;
  /** Morti con risveglio all'altare in questa spedizione. */
  cadute: number;
  eventi: DungeonEvent[];
};

export function newEnemy(s: DungeonState, tipo: string, x: number, z: number, alleato = false): Enemy {
  const def = enemyDef(tipo);
  const e: Enemy = {
    id: s.nextId++, tipo, def, x, z, fx: 0, fz: 1, vita: def.vita, max: def.vita,
    st: 'veglia', stT: 0, stDur: 0, alleato, scade: 0, aggro: false, hurt: 0, bleed: 0, bleedT: 0,
    cdTiro: 0, attacchi: 0, area: false, tiro: false, bersaglio: -1, dropRaro: false, dropMolt: 1,
  };
  s.enemies.push(e);
  return e;
}

export function createState(def: DungeonDef, seed: number, hero: RunHero): DungeonState {
  const map = parseDungeon(def);
  const rng = createRng(seed);
  const arma: RunWeapon = { ...hero.arma, traits: { ...hero.arma.traits } };
  const s: DungeonState = {
    v: 1, seed, dungeon: def.id, def, map, runHero: hero,
    tick: 0, done: false, outcome: null,
    hero: {
      x: map.spawn.x, z: map.spawn.z, fx: map.spawn.fx, fz: map.spawn.fz,
      vita: hero.max.vita, magicka: hero.max.magicka, stamina: hero.max.stamina,
      act: 'idle', actT: 0, actDur: 0, caricato: false, colpito: false, carica: 0,
      moving: false, running: false, hurt: 0, protetto: 0, arma,
      frecce: hero.frecce ? hero.frecce.n : 0,
      pozioni: hero.pozione !== null ? (hero.pozioni[hero.pozione]?.n ?? 0) : 0,
      cdMagia: 0, buffs: [], colpiFragile: hero.arma.usura ?? 0, prevA: false, prevC: false, prevD: false,
    },
    anim: 'fermo', enemies: [], proj: [], loot: [], nextId: 1,
    flow: new Int32Array(map.w * map.h), flowTick: -999, flowCell: -1, rng,
    bottino: {}, monete: 0, xp: {}, usati: {}, rotti: {}, usura: {}, uccisi: {}, danniFatti: 0, danniPresi: 0,
    altare: -1, salvato: null, cadute: 0, eventi: [],
  };
  const sonno = rng.fork('sonno');
  for (const n of map.nemici) {
    const e = newEnemy(s, n.tipo, (n.cx + 0.5) * map.tile, (n.cz + 0.5) * map.tile);
    // i boss vegliano sempre; gli altri dormono a caso (il seed decide)
    const dorme = sonno.next() < P_DORME && !e.def.boss;
    e.st = dorme ? 'dorme' : 'veglia';
    const dir = sonno.int(0, 3);
    e.fx = dir === 0 ? 1 : dir === 1 ? -1 : 0; e.fz = dir === 2 ? 1 : dir === 3 ? -1 : 0;
  }
  map.forzieri.forEach((f, i) => {
    const r = rollLoot(f.tabella, rng.fork(`forziere:${i}`), { molt: 1, raro: false });
    s.loot.push({ id: s.nextId++, x: (f.cx + 0.5) * map.tile, z: (f.cz + 0.5) * map.tile, tipo: 'forziere', items: r.items, monete: r.monete, vuoto: false, pieno: false });
  });
  for (const l of map.libri) s.loot.push({ id: s.nextId++, x: (l.cx + 0.5) * map.tile, z: (l.cz + 0.5) * map.tile, tipo: 'libro', items: { [l.item]: 1 }, monete: 0, vuoto: false, pieno: false });
  s.flowCell = cellOf(map, s.hero.x, s.hero.z);
  bfs(map, s.flowCell, s.flow);
  s.flowTick = 0;
  return s;
}

export const secToTicks = (sec: number): number => Math.max(1, Math.round(sec * HZ));
export function add(bag: Bag, k: string, n: number): void { bag[k] = (bag[k] ?? 0) + n; }
