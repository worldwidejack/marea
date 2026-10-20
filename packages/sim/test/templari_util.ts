// Aiuti dei test dei Templari: l'input fermo e i passi della partita.
import type { DungeonInput } from '../src/dungeon/types.ts';
import { stepTemplari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';

/** Nessun tasto, joystick al centro. */
export const FERMO: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
/** `n` passi a 60 Hz con l'input fermo più `inp`; si ferma prima se la partita finisce. */
export const passi = (s: TState, n: number, inp: Partial<DungeonInput> = {}): void => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, { ...FERMO, ...inp }); };
