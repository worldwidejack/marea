// Stato della partita nel dungeon e creazione da DungeonDef + RunHero + seed. Tutto il resto (passo, vista, risultato) lavora su questo.
// Dungeon insieme (#118): la partita può avere più eroi (`eroi`, uno per giocatore, stessi nemici). I campi «dell'eroe» di DungeonState
// (hero, runHero, bottino, monete, done, outcome, … elencati in PER_EROE) sono accessori verso l'eroe di turno `eroi[cur]`: le funzioni della
// sim lavorano sull'eroe di turno come quando era uno solo, il passo (dungeon.ts) li scorre tutti. Da solo cur resta 0 e tutto va come prima.
import { RPG, enemyDef } from '@marea/content/rpg.ts';
import type { DungeonDef, EnemyDef, Traits } from '@marea/content/rpg.ts';
import type { EquipSlot, HeroState, RunHero, RunOutcome, RunWeapon } from '../rpg/types.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { DungeonEvent, HeroAnim } from './types.ts';
import type { SwingStyle } from './swing.ts';
import { bfs, cellOf, moveCircle, parseDungeon } from './map.ts';
import type { DMap, Griglia } from './map.ts';
import { rollLoot } from './loot.ts';
import { HZ, P_DORME } from './tuning.ts';

export type Bag = Record<string, number>;
/** Azione in corso dell'eroe. press = A appena premuto (si decide al rilascio o dopo HOLD_TICKS). */
export type HeroAct = 'idle' | 'press' | 'carica' | 'swing' | 'tende' | 'tira' | 'lancia' | 'beve';
export type HeroRt = {
  x: number; z: number; fx: number; fz: number;
  vita: number; magicka: number; stamina: number;
  act: HeroAct; actT: number; actDur: number;
  /** Swing: caricato, stile del colpo (swing.ts), nemici già colpiti da questo swing, finestra del colpo chiusa. */
  caricato: boolean; stile: SwingStyle; colpiti: number[]; colpito: boolean;
  /** 0..1 carica o tensione corrente. */
  carica: number;
  moving: boolean; running: boolean; hurt: number;
  /** Tick di protezione dopo il risveglio all'altare: niente danni. */
  protetto: number;
  arma: RunWeapon; frecce: number; pozioni: number;
  /** Le mani tengono la magia preparata (v6): la A la lancia, l'arma sta a riposo. Si alterna col tasto C (o con `equip` dal menu). */
  incanta: boolean;
  cdMagia: number;
  buffs: { mod: string; valore: number; fine: number }[];
  /** Colpi a segno con l'arma fragile (per usura e rottura). */
  colpiFragile: number;
  /** Rallentato (Tubo-strisciante): tick rimasti e moltiplicatore della velocità. */
  lento: number; lentoMolt: number;
  /** Archivio: spinta da fuori (arpione, raffica dell'Astrolabio, bomba): velocità in m/s per `spT` tick; `spUrto` = danno se sbatte
   *  contro un muro (0 = niente). */
  spX: number; spZ: number; spT: number; spUrto: number;
  /** Fucina: brucia (tick rimasti, vita al secondo) e danno accumulato non ancora mostrato (un numero ogni mezzo secondo). */
  brucia: number; bruciaDps: number; bruciaAcc: number;
  /** Mausoleo, gli unici della Regina (unici.ts): carica della Barriera Cinetica (0..1); pressione del Fendiflutti; tick dell'ultimo attacco
   *  in mischia; ritmo della Grande Lancetta (colpi a tempo di fila), tick del prossimo tic e se il colpo in corso è il Rintocco; colpi
   *  caricati dell'Arco Carillon e tick della prossima ricarica; tick dell'ultima onda dell'Eco della Marea; per ogni lancetta (indice in
   *  map.lancette) il tick fino a cui non lo riprende. */
  barr: number; pressione: number; ultimoAttacco: number; ritmo: number; tic: number; rintocco: boolean; molla: number; mollaT: number; ecoT: number; lancT: number[];
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
  /** Capo del dungeon (legenda `capo`): morto lui, la spedizione completa il dungeon (`RunResult.capo`). Fuori dall'hash. */
  capo?: true;
  /** Insieme: alleato evocato da questo eroe (indice in `eroi`). Fuori dall'hash. */
  padrone?: number;
  /** Insieme: ultimo eroe che l'ha colpito (a lui il danno del sanguinamento e l'uccisione). Fuori dall'hash. */
  ultimo?: number;
  /** Archivio: l'Archivista a Molla ricarica la molla (recupero lungo). */
  molla?: boolean;
  /** Archivio, l'Astrolabio (astrolabio.ts): attacco in corso, direzione e lunghezza del raggio, salve già tirate, anelli staccati.
   *  Gli anelli: id del loro Astrolabio e versore della loro posizione attorno a lui. */
  modo?: 'rosa' | 'raffica' | 'raggio' | 'carica' | 'magma' | 'zoccolo' | 'cura' | 'ondata' | 'fendenti' | 'scatto' | 'geyser' | 'colpo' | 'cambio';
  mira?: { dx: number; dz: number; len: number };
  salve?: number;
  diviso?: boolean;
  padre?: number; ux?: number; uz?: number;
  /** Fucina, il Mastro Forgiatore (forgiatore.ts): spento da una cascata (prende danni), metri già corsi nella carica, eroi già travolti.
   *  La Fornace Semovente: dove ha lasciato l'ultima chiazza di fuoco e quando. */
  spento?: boolean; corsa?: number; presi?: number[];
  sciaX?: number; sciaZ?: number; sciaT?: number;
  /** Mausoleo: potenziato da un Chierico fino al tick `potT` (danno × `potM`); scudo della Sentinella sfondato fino al tick `rotto`;
   *  stordito dal Rintocco fino al tick `stordito`; colpi della combinazione già dati (Guardia d'Onore) e se l'ultimo attacco era in
   *  mischia. Il Custode (custode.ts): fase (0 acqua, 1 vapore, 2 moto) e colpi presi verso la scarica della Barriera. */
  potT?: number; potM?: number; rotto?: number; stordito?: number; comboN?: number; mischia?: boolean; fase?: number; colpiB?: number;
};
/** Mausoleo: `lama` = lama d'acqua del Fendiflutti (dell'eroe, trapassa), `lama_nemica` = quella della Guardia d'Onore e del Custode. */
export type ProjKind = 'freccia' | 'magia' | 'freccia_nemica' | 'magia_nemica' | 'acqua_nemica' | 'arpione_nemico' | 'vento_nemico' | 'lama' | 'lama_nemica';
export type Proj = {
  id: number; tipo: ProjKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number;
  danno: number; life: number;
  /** Eroe: tratti uniti di arco e frecce, magia (raggio esplosione, sanguina). */
  traits: Traits; raggio: number; colpiti: number[];
  dalNemico: boolean; contundente: boolean; magico: boolean; arrowId: string | null;
  /** Insieme: eroe che l'ha tirato (indice in `eroi`; assente = 0). */
  da?: number;
  /** Arpione (Drone Idro-Ragno): chi è preso è tirato di `tira` m all'indietro lungo il volo in `tiraT` tick. */
  tira?: number; tiraT?: number;
};
/** Drenaggio: un bacino allagato. `aperta` = la sua valvola è girata; `scolo` = tick che mancano all'asciutto (livello = scolo / SCOLO). */
export type Bacino = { n: number; aperta: boolean; scolo: number };
/** Geyser di vapore del Capoturno: avviso (cerchio a terra) e poi getto; `colpiti` = eroi già presi da questo getto. */
export type Geyser = { id: number; x: number; z: number; r: number; t: number; avviso: number; getto: number; danno: number; colpiti: number[];
  /** Archivio: è una bomba a pressione dell'Aerostato-Spia, che spinge via di `spinta` m chi prende. */
  spinta?: number;
  /** Fucina: è una palla di magma del Mastro Forgiatore; dove cade lascia una pozza che brucia (fuoco.ts). */
  magma?: { durata: number; raggio: number; dps: number; secondi: number } };
/** Archivio: una corrente d'aria (le celle e i numeri stanno in map.venti); `ferma` = il suo timone è girato. */
export type Corrente = { n: number; ferma: boolean };
/** Fucina: chiazza di fuoco a terra (scia della Fornace Semovente, pozza di magma) fino al tick `fine`: chi ci sta dentro brucia. */
export type Fuoco = { id: number; x: number; z: number; r: number; fine: number; durata: number; dps: number; secondi: number };
/** Mausoleo: un'onda d'acqua che si allarga da (x, z) (l'ondata del Custode, la scarica della Barriera): raggio `r` adesso, fino a `max`;
 *  prende chi ci sta sopra (entro `spessore`) tranne nei `varchi` (versori, coseno `largo`) e dietro le colonne; `colpiti` = eroi già presi. */
export type Onda = { id: number; x: number; z: number; r: number; v: number; max: number; spessore: number; danno: number; spinta: number; varchi: [number, number][]; largo: number; colpiti: number[]; barriera?: true };
/** Ultimo altare toccato: il bottino e le monete di quel momento sono al sicuro (docs/RPG.md §4). */
export type Salvato = { altare: number; tick: number; bottino: Bag; monete: number };
/** Quello che resta in un bottino per un eroe: da solo sono i campi del bottino stesso; insieme ogni eroe ha la sua parte (`altri`). */
export type LootParte = { items: Bag; monete: number; vuoto: boolean; pieno: boolean };
/** I campi di LootParte sono la parte dell'eroe 0; insieme `altri[i - 1]` è quella dell'eroe i: ognuno raccoglie il suo, uguale. */
export type Loot = LootParte & { id: number; x: number; z: number; tipo: 'cadavere' | 'forziere' | 'libro'; altri?: LootParte[] };
/** Un eroe della spedizione: i suoi campi in DungeonState sono quelli dell'eroe di turno (`cur`). */
export type EroeRt = {
  hero: HeroRt; runHero: RunHero;
  /** Finita per questo eroe (uscito, morto, tempo, ritirato) ed esito. */
  done: boolean; outcome: RunOutcome | null;
  // risultato
  bottino: Bag; monete: number; xp: Record<string, number>; usati: Bag; rotti: Bag; usura: Bag; uccisi: Bag;
  danniFatti: number; danniPresi: number;
  /** Altare su cui sta l'eroe adesso (-1 = nessuno): salva solo entrandoci. */
  altare: number;
  salvato: Salvato | null;
  /** Morti con risveglio all'altare in questa spedizione. */
  cadute: number;
  /** Il personaggio all'entrata (dungeon v5): con lui si rifà RunHero quando cambia l'equipaggiamento. null = niente cambi (test, spedizioni
   *  aperte prima del v5): si gioca con la fotografia `runHero` e basta. */
  stato: HeroState | null;
  /** Equipaggiato adesso (parte da stato.equip). */
  equip: Partial<Record<EquipSlot, string>>;
  /** Buttati via da quello portato da casa (quelli raccolti qui escono da `bottino`). */
  buttati: Bag;
  /** Lanterna di partenza (-1 = ingresso) e lanterna da cui si è usciti (-1 = no). */
  partenza: number;
  uscitaLanterna: number;
};
export const PER_EROE = [
  'hero', 'runHero', 'done', 'outcome', 'bottino', 'monete', 'xp', 'usati', 'rotti', 'usura', 'uccisi', 'danniFatti', 'danniPresi',
  'altare', 'salvato', 'cadute', 'stato', 'equip', 'buttati', 'partenza', 'uscitaLanterna',
] as const satisfies readonly (keyof EroeRt)[];
export type DungeonState = EroeRt & {
  v: 1; seed: number; dungeon: string; def: DungeonDef; map: DMap;
  tick: number; anim: HeroAnim;
  enemies: Enemy[]; proj: Proj[]; loot: Loot[];
  nextId: number;
  /** Flow field verso l'eroe (BFS dalla sua cella; insieme dalle celle di tutti) e tick del calcolo. */
  flow: Int32Array; flowTick: number; flowCell: number; flowKey: string;
  rng: Rng;
  eventi: DungeonEvent[];
  /** Gli eroi della spedizione (da solo uno) e quello di turno: i campi di EroeRt qui sopra sono i suoi. */
  eroi: EroeRt[];
  cur: number;
  /** Drenaggio (acque.ts): i bacini (uguali per tutti gli eroi) e i geyser in corso (anche le bombe dell'Archivio). Negli altri dungeon vuoti. */
  bacini: Bacino[];
  geyser: Geyser[];
  /** Archivio (vento.ts): le correnti d'aria (uguali per tutti). Negli altri dungeon vuote. */
  correnti: Corrente[];
  /** Archivio: griglie e flow field di chi sale sulle grate o vola (enemies.ts), fatti alla prima richiesta. Fuori dall'hash. */
  griglie: Partial<Record<'grate' | 'vola' | 'asciutto', Griglia>>;
  flowAlt: Partial<Record<'grate' | 'vola' | 'asciutto', { field: Int32Array; key: string; tick: number }>>;
  /** Fucina (fuoco.ts): chiazze di fuoco a terra (uguali per tutti). Negli altri dungeon vuote. */
  fuochi: Fuoco[];
  /** Mausoleo (mausoleo.ts): onde d'acqua in corsa (uguali per tutti). Negli altri dungeon vuote. */
  onde: Onda[];
};

/** Accessori dei campi dell'eroe di turno (prototipo comune a tutti gli stati). */
const PROTO: object = (() => {
  const p = {};
  for (const k of PER_EROE) {
    Object.defineProperty(p, k, {
      get(this: DungeonState) { return this.eroi[this.cur]![k]; },
      set(this: DungeonState, v: unknown) { (this.eroi[this.cur] as Record<string, unknown>)[k] = v; },
      enumerable: true,
    });
  }
  return p;
})();

/** Evento del tick: insieme porta l'eroe di turno (`eroe`), da solo resta com'era. */
export function ev(s: DungeonState, e: DungeonEvent): void { s.eventi.push(s.eroi.length > 1 ? { ...e, eroe: s.cur } : e); }
/** La parte dell'eroe di turno in un bottino. */
export function parte(s: DungeonState, l: Loot): LootParte { return s.cur === 0 ? l : l.altri?.[s.cur - 1] ?? l; }
/** La spedizione è finita per tutti. */
export const finita = (s: DungeonState): boolean => s.eroi.every((e) => e.done);
/** Indici degli eroi ancora in gioco. */
export function inGioco(s: DungeonState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.eroi.length; i++) if (!s.eroi[i]!.done) out.push(i);
  return out;
}
/** Fa `fn` con l'eroe i di turno, poi rimette quello di prima. */
export function conEroe<T>(s: DungeonState, i: number, fn: () => T): T {
  const prima = s.cur;
  s.cur = i;
  try { return fn(); } finally { s.cur = prima; }
}

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

/** Un eroe per la spedizione: `hero` = la fotografia, `stato` = il personaggio all'entrata (v5, null = niente cambi d'equipaggiamento). */
export type EroeDef = { hero: RunHero; stato?: HeroState | null };

export function createState(def: DungeonDef, seed: number, hero: RunHero, o: { stato?: HeroState | null; partenza?: number | null } = {}): DungeonState {
  return createParty(def, seed, [{ hero, stato: o.stato ?? null }], o.partenza ?? null);
}

/** Vita dei nemici insieme: × (1 + vitaPerCompagno × (eroi − 1)), da RPG.dungeon.gruppo (#118). */
export function moltVita(n: number): number {
  const k = RPG.dungeon?.gruppo?.vitaPerCompagno ?? 0.6;
  return n > 1 ? 1 + k * (n - 1) : 1;
}

/** Spedizione con uno o più eroi (insieme, #118): tutti partono dall'ingresso (o dalla lanterna `partenza`), stessi nemici, la vita dei
 *  nemici cresce con moltVita, ogni eroe ha la sua parte di ogni bottino. Con un eroe solo è la spedizione di sempre. */
export function createParty(def: DungeonDef, seed: number, eroi: readonly EroeDef[], partenza: number | null = null): DungeonState {
  if (eroi.length < 1) throw new Error('Spedizione senza eroi');
  // con l'acqua le celle dei bacini diventano calpestabili quando si svuotano: ogni partita ha la sua copia di `solid`
  const base = parseDungeon(def), map: DMap = base.bacini.length ? { ...base, solid: base.solid.slice() } : base;
  const rng = createRng(seed);
  const s = Object.create(PROTO) as DungeonState;
  Object.assign(s, {
    v: 1, seed, dungeon: def.id, def, map, tick: 0, anim: 'fermo',
    enemies: [], proj: [], loot: [], nextId: 1, bacini: map.bacini.map((b) => ({ n: b.n, aperta: false, scolo: 0 })), geyser: [],
    correnti: map.venti.map((v) => ({ n: v.n, ferma: false })), griglie: {}, flowAlt: {}, fuochi: [], onde: [],
    flow: new Int32Array(map.w * map.h), flowTick: -999, flowCell: -1, flowKey: '', rng, eventi: [],
    eroi: eroi.map(({ hero, stato }): EroeRt => ({
      hero: {
        x: map.spawn.x, z: map.spawn.z, fx: map.spawn.fx, fz: map.spawn.fz,
        vita: hero.max.vita, magicka: hero.max.magicka, stamina: hero.max.stamina,
        act: 'idle', actT: 0, actDur: 0, caricato: false, stile: 'fendente', colpiti: [], colpito: false, carica: 0,
        moving: false, running: false, hurt: 0, protetto: 0, arma: { ...hero.arma, traits: { ...hero.arma.traits } },
        frecce: hero.frecce ? hero.frecce.n : 0,
        pozioni: hero.pozione !== null ? (hero.pozioni[hero.pozione]?.n ?? 0) : 0,
        incanta: !!hero.manoMagia && hero.magia !== null,
        cdMagia: 0, buffs: [], colpiFragile: hero.arma.usura ?? 0, lento: 0, lentoMolt: 1, spX: 0, spZ: 0, spT: 0, spUrto: 0, brucia: 0, bruciaDps: 0, bruciaAcc: 0,
        barr: 0, pressione: hero.arma.traits.lame?.cariche ?? 0, ultimoAttacco: -1e6, ritmo: 0, tic: -1, rintocco: false, molla: hero.arma.traits.carillon?.colpi ?? 0, mollaT: 0, ecoT: -1e6, lancT: [],
        prevA: false, prevC: false, prevD: false,
      },
      runHero: hero, done: false, outcome: null,
      bottino: {}, monete: 0, xp: {}, usati: {}, rotti: {}, usura: {}, uccisi: {}, danniFatti: 0, danniPresi: 0,
      altare: -1, salvato: null, cadute: 0,
      stato: stato ?? null, equip: { ...(stato?.equip ?? {}) }, buttati: {}, partenza: -1, uscitaLanterna: -1,
    })),
    cur: 0,
  });
  // ripartenza da una lanterna (quella da cui si è usciti l'ultima volta): l'eroe è lì sopra e la lanterna è già quella dei risvegli
  const p = partenza;
  const daLanterna = typeof p === 'number' && Number.isInteger(p) && p >= 0 && p < map.altari.length;
  s.eroi.forEach((e, i) => {
    if (daLanterna) {
      const a = map.altari[p]!;
      e.hero.x = a.x; e.hero.z = a.z;
      e.partenza = p; e.altare = p;
      e.salvato = { altare: p, tick: 0, bottino: {}, monete: 0 };
    }
    // insieme: gli altri un passo di lato (e il quarto anche dietro) al primo, i muri li fermano: così non partono uno dentro l'altro
    if (i > 0) {
      const h = e.hero, lato = i === 2 ? -0.9 : 0.9, dietro = i === 3 ? 0.9 : 0;
      moveCircle(map, h, -h.fz * lato - h.fx * dietro, h.fx * lato - h.fz * dietro, e.runHero.raggio);
    }
  });
  // Drenaggio: ripartendo da una lanterna oltre l'acqua, i bacini che avevi svuotato per arrivarci sono già vuoti
  if (daLanterna) for (const n of map.altari[p]!.asciutti ?? []) {
    const b = s.bacini.find((x) => x.n === n);
    if (!b) continue;
    b.aperta = true; b.scolo = 0;
    for (const i of map.bacini.find((x) => x.n === n)?.celle ?? []) map.solid[i] = 0;
  }
  // Archivio: ripartendo dalla lanterna oltre il Condotto, le correnti che avevi fermato per arrivarci sono già ferme
  if (daLanterna) for (const n of map.altari[p]!.ferme ?? []) { const c = s.correnti.find((x) => x.n === n); if (c) c.ferma = true; }
  const sonno = rng.fork('sonno');
  const kv = moltVita(eroi.length);
  for (const n of map.nemici) {
    const e = newEnemy(s, n.tipo, (n.cx + 0.5) * map.tile, (n.cz + 0.5) * map.tile);
    if (n.capo) e.capo = true;
    if (kv !== 1) { e.max = e.def.vita * kv; e.vita = e.max; }
    // i boss vegliano sempre; gli altri dormono a caso (il seed decide)
    const dorme = sonno.next() < P_DORME && !e.def.boss;
    e.st = dorme ? 'dorme' : 'veglia';
    const dir = sonno.int(0, 3);
    e.fx = dir === 0 ? 1 : dir === 1 ? -1 : 0; e.fz = dir === 2 ? 1 : dir === 3 ? -1 : 0;
  }
  map.forzieri.forEach((f, i) => {
    const r = rollLoot(f.tabella, rng.fork(`forziere:${i}`), { molt: 1, raro: false });
    s.loot.push(nuovoBottino(s, { id: s.nextId++, x: (f.cx + 0.5) * map.tile, z: (f.cz + 0.5) * map.tile, tipo: 'forziere', items: r.items, monete: r.monete, vuoto: false, pieno: false }));
  });
  for (const l of map.libri) s.loot.push(nuovoBottino(s, { id: s.nextId++, x: (l.cx + 0.5) * map.tile, z: (l.cz + 0.5) * map.tile, tipo: 'libro', items: { [l.item]: 1 }, monete: 0, vuoto: false, pieno: false }));
  if (s.eroi.length === 1) {
    s.flowCell = cellOf(map, s.hero.x, s.hero.z);
    bfs(map, s.flowCell, s.flow);
  } else {
    const celle = s.eroi.map((e) => cellOf(map, e.hero.x, e.hero.z));
    s.flowKey = celle.join(',');
    bfs(map, celle, s.flow);
  }
  s.flowTick = 0;
  return s;
}

/** Bottino nuovo: insieme ogni eroe oltre il primo ne riceve una copia uguale (`altri`). */
export function nuovoBottino(s: DungeonState, l: Loot): Loot {
  if (s.eroi.length > 1) l.altri = s.eroi.slice(1).map(() => ({ items: { ...l.items }, monete: l.monete, vuoto: l.vuoto, pieno: false }));
  return l;
}

export const secToTicks = (sec: number): number => Math.max(1, Math.round(sec * HZ));
export function add(bag: Bag, k: string, n: number): void { bag[k] = (bag[k] ?? 0) + n; }
