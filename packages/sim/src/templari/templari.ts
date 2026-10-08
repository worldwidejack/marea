// Partita a ondate dell'Isola dei Templari (docs/TEMPLARI.md, CONTRACTS «Templari»): pura e deterministica come il dungeon (niente funzioni
// trascendenti, vedi types.ts). Un tick: eroe, zombie, regista delle ondate, poi l'alba. Moduli: mappa, stato, eroe, zombie, ondate, colpi,
// vista, autopilota; replay e premio per il server in replay.ts e premio.ts.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { TAzione, TEvento, TInput, TModulo } from './types.ts';
import { HZ, createState, ev } from './stato.ts';
import type { TState } from './stato.ts';
import { stepEroe } from './eroe.ts';
import { stepZombi } from './zombie.ts';
import { stepOndate } from './ondate.ts';
import { resultOf, viewOf } from './vista.ts';
import { autopilota } from './autopilota.ts';

export type { TState } from './stato.ts';
export const MAX_TICKS = TEMPLARI.maxMinuti * 60 * HZ;

export function stepTemplari(s: TState, inp: TInput): void {
  s.eventi = [];
  if (s.done) return;
  stepEroe(s, inp);
  if (!s.done) stepZombi(s);
  if (!s.done) stepOndate(s);
  s.tick++;
  if (!s.done && s.tick >= MAX_TICKS) { s.done = true; s.esito = 'alba'; ev(s, { t: 'alba' }); }
}

function act(s: TState, a: TAzione): TEvento[] | null {
  if (s.done || !a || typeof a !== 'object') return null;
  if (a.t === 'esci') { s.done = true; s.esito = 'uscito'; return []; }
  return null;
}

export const templari: TModulo<TState> = {
  id: 'templari', version: TEMPLARI.version, maxTicks: MAX_TICKS,
  create: ({ seed, opzioni }) => createState(seed, opzioni ?? {}),
  step: stepTemplari,
  act,
  result: resultOf,
  view: viewOf,
  autopilot: autopilota,
};
