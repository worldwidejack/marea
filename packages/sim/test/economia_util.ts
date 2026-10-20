// Aiuti dei test dell'economia e del GDR: riconoscere l'errore giusto.
import { EconomyError } from '../src/economy/types.ts';

/** Per `assert.throws`: un EconomyError col codice `code` e un messaggio in parole (per chi gioca). */
export const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
