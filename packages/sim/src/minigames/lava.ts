// Fuga dalla lava (Isola Vulcano, GDD §6, docs/LAVA.md): corsa senza fine a scorrimento laterale, a schermo intero, nello stile di Super Mario
// Run. Corri da solo verso destra, un dito solo: TOCCA = salto (tenuto = più alto), in aria un altro tocco = giravolta; gli ostacoli bassi si
// scavalcano da soli, sui nemici si salta sopra. Un muro di lava ti insegue: colpi e tuffi nella lava gli fanno guadagnare terreno, quando ti
// raggiunge sei bruciato. Punti = tile percorsi + gemme + trucchi − penalità; il percorso e i premi nascono dal seed (classifica tra amici).
// Fisica in lava_fisica.ts, percorso in lava_percorso.ts, pilota in lava_pilota.ts. Numeri in content (minigames/lava.json).
import { MINIGAMES_CFG } from '@marea/content';
import type { LavaCosa } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';
import { T, X0, avanza, azzera, corpoNuovo, nuovoEvento } from './lava_fisica.ts';
import type { Corpo, Evento, Gemma, Mondo } from './lava_fisica.ts';
import { H_PARTENZA, MAX_TICKS, genera } from './lava_percorso.ts';
import { autopilotaLava } from './lava_pilota.ts';

export { T as LAVA_TILE, geyserAvvisa, getto, magminoX, velocitaA } from './lava_fisica.ts';

const C = MINIGAMES_CFG.lava;
const PRESA_X = 8, PRESA_Y = 9;

export type LavaState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  c: Corpo;
  mondo: Mondo;
  gemme: Gemma[];
  /** Magmini già calpestati (stesso ordine di `mondo.magmini`). */
  morti: boolean[];
  /** Indice della prima gemma non ancora superata (le gemme sono in ordine di x). */
  gi: number;
  /** Punti oltre ai tile: gemme e trucchi; e quelli persi nei colpi. */
  bonus: number;
  penalita: number;
  punti: number;
  prese: Record<LavaCosa, number>;
  nemici: number; belli: number; colpi: number; bagni: number; salti: number;
  /** Eventi dell'ultimo tick (suoni ed effetti del client). */
  ultimo: Evento & { presi: LavaCosa[] };
  /** 'bruciato' = ti ha raggiunto il muro di lava; 'traguardo' = hai corso fino al tempo massimo. */
  fine: 'bruciato' | 'traguardo' | null;
  done: boolean;
};
export type LavaView = {
  x: number; y: number; vy: number; terra: boolean; inv: number; tick: number; ms: number; margine: number;
  punti: number; metri: number; prese: Record<LavaCosa, number>; colpi: number; salti: number; fine: LavaState['fine'];
  medals: { oro: number; argento: number; bronzo: number }; done: boolean;
};

export const metriDi = (x: number): number => Math.max(0, Math.floor((x - X0) / T));
const punteggio = (s: LavaState): number => Math.max(0, metriDi(s.c.x) + s.bonus - s.penalita);
function medalOf(p: number): Medal {
  const m = C.medaglie;
  return p >= m.oro ? 'oro' : p >= m.argento ? 'argento' : p >= m.bronzo ? 'bronzo' : null;
}
const prende = (x: number, y: number, g: Gemma) => Math.abs(g.x - x) < PRESA_X && Math.abs(g.y - (y - 6.5)) < PRESA_Y;

export const lava: MinigameModule<LavaState> = {
  id: 'lava',
  version: 2,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const { gemme, ...mondo } = genera(seed >>> 0, difficulty);
    return {
      seed: seed >>> 0, difficulty, tick: 0, c: corpoNuovo(-H_PARTENZA * T), mondo, gemme, morti: mondo.magmini.map(() => false), gi: 0,
      bonus: 0, penalita: 0, punti: 0, prese: { ossidiana: 0, scintilla: 0, rubino: 0 }, nemici: 0, belli: 0, colpi: 0, bagni: 0, salti: 0,
      ultimo: { ...nuovoEvento(), presi: [] }, fine: null, done: false,
    };
  },
  step(s, input: InputFrame) {
    if (s.done) return;
    s.tick++;
    const e = azzera(s.ultimo);
    avanza(s.c, s.mondo, s.tick, !!input.a, s.morti, e);
    const presi: LavaCosa[] = [];
    if (e.salto) s.salti++;
    if (e.bello) { s.belli++; s.bonus += C.punti.scavalcoBello; }
    if (e.nemico) { s.nemici++; s.bonus += C.punti.nemico[Math.min(e.nemico, C.punti.nemico.length) - 1]!; }
    if (e.colpo) { s.colpi++; s.penalita += C.colpo.punti; }
    if (e.bagno === 2) { s.bagni++; s.penalita += C.bagno.punti; }
    while (s.gi < s.gemme.length && s.gemme[s.gi]!.x < s.c.x - PRESA_X) s.gi++;
    for (let i = s.gi; i < s.gemme.length && s.gemme[i]!.x <= s.c.x + PRESA_X; i++) {
      const g = s.gemme[i]!;
      if (g.preso || !prende(s.c.x, s.c.y, g)) continue;
      g.preso = true; s.prese[g.k]++; s.bonus += C.punti[g.k]; presi.push(g.k);
    }
    s.ultimo.presi = presi;
    s.punti = punteggio(s);
    if (s.c.margine <= 0) { s.fine = 'bruciato'; s.done = true; } else if (s.tick >= MAX_TICKS) { s.fine = 'traguardo'; s.done = true; }
  },
  /** score = punti; medaglia dai punti (soglie in content). */
  result(s): MinigameResult {
    return {
      done: s.done, score: s.punti, medal: medalOf(s.punti),
      detail: {
        punti: s.punti, metri: metriDi(s.c.x), gemme: s.prese.ossidiana + s.prese.scintilla + s.prese.rubino,
        ossidiana: s.prese.ossidiana, scintille: s.prese.scintilla, rubini: s.prese.rubino, nemici: s.nemici, belli: s.belli, colpi: s.colpi, bagni: s.bagni, salti: s.salti,
        arrivato: s.fine === 'traguardo' ? 1 : 0, ms: Math.round((s.tick / TICK_HZ) * 1000),
      },
    };
  },
  autopilot(s: LavaState, _rng: Rng): InputFrame { return autopilotaLava(s); },
  view(s): LavaView {
    return {
      x: s.c.x, y: s.c.y, vy: s.c.vy, terra: s.c.terra, inv: s.c.inv, tick: s.tick, ms: Math.round((s.tick / TICK_HZ) * 1000), margine: Math.round(s.c.margine),
      punti: s.punti, metri: metriDi(s.c.x), prese: s.prese, colpi: s.colpi, salti: s.salti, fine: s.fine, medals: C.medaglie, done: s.done,
    };
  },
};
