// Aiuti per i test del dungeon: eroi costruiti a mano (indipendenti dai dati di R-rpg), un'arena vuota, partite con l'autopilot.
import type { DungeonDef } from '@marea/content/rpg.ts';
import type { RunHero, RunWeapon } from '../src/rpg/types.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { createState } from '../src/dungeon/state.ts';
import type { DungeonState } from '../src/dungeon/state.ts';
import { quantizeDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { createRng } from '../src/rng.ts';

export const katana = (o: Partial<RunWeapon> = {}): RunWeapon => ({
  id: 'katana_bronzo', kind: 'mischia', skill: 'armiLeggere', classe: 'leggera', danno: 10, tempo: 0.65, portata: 1.8, carica: 0.9, caricaMolt: 2.5, gittata: 0, traits: {}, ...o,
});

/** Eroe di partenza ragionevole: katana di bronzo, corazza di bronzo, 3 pozioni minori, Fiammata. */
export function heroBase(o: Partial<RunHero> = {}): RunHero {
  return {
    livello: 1,
    max: { vita: 100, magicka: 100, stamina: 100 },
    regen: { vita: 0.5, magicka: 4, stamina: 12 },
    camminata: 3.2, corsa: 5.6, staminaCorsa: 20, mentreCarichi: 0.4, raggio: 0.35,
    arma: katana(),
    frecce: null,
    armatura: { id: 'armatura_bronzo', difesa: 30, malus: 0.1, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1 },
    magie: [{ id: 'fiammata', scuola: 'distruzione', costo: 15, ricarica: 0.8, danno: 14, velocita: 12, raggio: 0.5, sanguina: 2, evoca: null, durata: 0 }],
    magia: 0,
    pozioni: [{ id: 'pozione_vita_minore', n: 3, cura: { vita: 40 }, buff: null }],
    pozione: 0,
    skill: { armiLeggere: 15, armiPesanti: 15, arceria: 15, distruzione: 15, evocazione: 15, forgiatura: 15, alchimia: 15 },
    carico: 25, caricoMax: 150,
    pesi: { lingotto_bronzo: 1, lingotto_ferro: 1, lingotto_argento: 1, pepita_oro: 0.5, erba_curativa: 0.1, zanna_lupo: 0.2, seta_ragno: 0.1, ossa_mostro: 3, pietra_pesante: 2 },
    ...o,
  };
}

/** Eroe forte (spadone d'argento, corazza di ferro, 5 pozioni). */
export function heroForte(): RunHero {
  return heroBase({
    livello: 8, max: { vita: 180, magicka: 100, stamina: 140 },
    arma: { id: 'spadone_argento', kind: 'mischia', skill: 'armiPesanti', classe: 'pesante', danno: 26, tempo: 1.25, portata: 2.2, carica: 1.5, caricaMolt: 3, gittata: 0, traits: { bonusVs: { nonmorto: 2, mostro: 2 } } },
    armatura: { id: 'armatura_ferro', difesa: 50, malus: 0.12, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 0, velocitaMolt: 1 },
    pozioni: [{ id: 'pozione_vita', n: 5, cura: { vita: 80 }, buff: null }],
  });
}

/** Arena 20×14 senza nemici: scala in basso a sinistra, l'eroe parte sopra la scala. */
export const ARENA: DungeonDef = {
  id: 'arena_test', nome: 'Arena', descr: 'test', stile: 'cripta', tile: 2, difficolta: 99,
  rows: [
    '####################',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#<.................#',
    '####################',
  ],
  legenda: {},
  ingresso: { island: 'neon', at: [20, 13] },
};
export function arena(hero: RunHero, seed = 1): DungeonState {
  const s = createState(ARENA, seed, hero);
  s.hero.x = 20; s.hero.z = 14; s.hero.fx = 1; s.hero.fz = 0;
  return s;
}

export const inp = (o: Partial<DungeonInput> = {}): DungeonInput => ({ ...NO_DUNGEON_INPUT, ...o });
/** Avanza n tick con lo stesso input; ritorna tutti gli eventi. */
export function run(s: DungeonState, n: number, f: DungeonInput = inp()): DungeonState['eventi'] {
  const ev: DungeonState['eventi'] = [];
  for (let i = 0; i < n && !s.done; i++) { dungeon.step(s, f); ev.push(...s.eventi); }
  return ev;
}

/** Partita intera con l'autopilot (input quantizzati come il client). `filtro` può ritoccare l'input prima del passo. */
export function playAuto(id: string, seed: number, hero: RunHero, filtro?: (f: DungeonInput, s: DungeonState) => DungeonInput): { s: DungeonState; log: DungeonInput[] } {
  const s = dungeon.create({ seed, dungeon: id, hero });
  const rng = createRng(seed);
  const log: DungeonInput[] = [];
  while (!s.done) {
    let f = quantizeDungeon(dungeon.autopilot(s, rng));
    if (filtro) f = quantizeDungeon(filtro(f, s));
    log.push(f);
    dungeon.step(s, f);
  }
  return { s, log };
}
