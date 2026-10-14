// Partita a ondate dell'Isola dei Templari (docs/TEMPLARI.md, CONTRACTS «Templari»): pura e deterministica come il dungeon (niente funzioni
// trascendenti, vedi types.ts). Un tick: eroe, zombie, regista delle ondate, poi l'alba. Moduli: mappa, stato, eroe, zombie, ondate, colpi,
// vista, autopilota, proiettili, cassa, porte (e trappole), poteri, raggiungi; replay e premio per il server in replay.ts e premio.ts.
// Insieme (opzioni.eroi): un input per eroe a ogni tick, eroi uno dopo l'altro nell'ordine della squadra; il resto vale per tutti (gli
// zombie puntano l'eroe in piedi più vicino). Chi cade si rialza all'ondata dopo; la partita finisce quando non ne resta nessuno in piedi.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { TAzione, TEvento, TInput, TModulo } from './types.ts';
import { HZ, createState, ev, inPiedi, usa } from './stato.ts';
import type { TState } from './stato.ts';
import { stepEroe } from './eroe.ts';
import { stepZombi } from './zombie.ts';
import { stepOndate } from './ondate.ts';
import { stepProiettili } from './proiettili.ts';
import { stepFiamme } from './colpi.ts';
import { stepCassa } from './cassa.ts';
import { stepTrappole } from './porte.ts';
import { stepPoteri } from './poteri.ts';
import { stepSuper } from './super.ts';
import { resultOf, viewOf } from './vista.ts';
import { autopilota } from './autopilota.ts';
import { compra } from './bottega.ts';

export type { TState } from './stato.ts';
export const MAX_TICKS = TEMPLARI.maxMinuti * 60 * HZ;

const FERMO: TInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };

export function stepTemplari(s: TState, inp: TInput): void { stepTemplariInsieme(s, [inp]); }

/** Un tick con un input per eroe (da solo: uno). */
export function stepTemplariInsieme(s: TState, inps: readonly TInput[]): void {
  s.eventi = [];
  if (s.done) return;
  for (let i = 0; i < s.eroi.length && !s.done; i++) {
    const h = s.eroi[i]!;
    if (h.giu || h.fuori) continue;
    usa(s, i); stepEroe(s, inps[i] ?? FERMO);
  }
  // per il resto del tick l'eroe di riferimento è il primo in piedi (gli zombie scelgono il loro bersaglio da soli)
  usa(s, inPiedi(s)[0] ?? 0);
  if (!s.done) stepProiettili(s);
  if (!s.done) stepSuper(s);
  if (!s.done) stepFiamme(s);
  if (!s.done) stepZombi(s);
  if (!s.done) stepTrappole(s);
  if (!s.done) stepOndate(s);
  if (!s.done) stepPoteri(s);
  stepCassa(s);
  if (s.drops.length && s.drops[0]!.fine <= s.tick) s.drops = s.drops.filter((d) => d.fine > s.tick);
  s.tick++;
  if (!s.done && s.tick >= MAX_TICKS) { s.done = true; s.esito = 'alba'; ev(s, { t: 'alba' }); }
}

/** Un'azione dal menu dell'eroe `io` (insieme: chi compra dal Mercante o dalla Strega; da solo 0). */
function act(s: TState, a: TAzione, io = 0): TEvento[] | null {
  if (s.done || !a || typeof a !== 'object') return null;
  if (a.t === 'esci') { s.done = true; s.esito = 'uscito'; return []; }
  if (a.t === 'compra') {
    const h = s.eroi[io];
    if (!h || h.giu || h.fuori) return null;
    const prima = s.chi;
    usa(s, io);
    const out = compra(s, a);
    usa(s, prima);
    return out;
  }
  if (a.t === 'ritira') {
    const h = s.eroi[a.eroe];
    if (!h || h.fuori) return null;
    h.fuori = true; h.act = 'idle';
    // non resta nessuno: finita (caduti tutti gli altri = morto; usciti tutti = uscito)
    if (!inPiedi(s).length) { s.done = true; s.esito = s.eroi.some((x) => x.giu && !x.fuori) ? 'morto' : 'uscito'; }
    return [];
  }
  return null;
}

export const templari: TModulo<TState> = {
  id: 'templari', version: TEMPLARI.version, maxTicks: MAX_TICKS,
  create: ({ seed, opzioni }) => createState(seed, opzioni ?? {}),
  step: stepTemplari,
  stepInsieme: stepTemplariInsieme,
  act,
  result: resultOf,
  view: viewOf,
  autopilot: autopilota,
};
