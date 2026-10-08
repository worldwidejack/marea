// Input della partita a ondate dalla rete e replay deterministico per il server. Il formato degli input è quello del dungeon (RLE a ottavi,
// o la stringa compatta di encodeDungeon); le azioni dal menu sono [tick, azione] con tick = passi già fatti (come nel dungeon).
import { decodeDungeon, isPackedDungeon } from '../dungeon/replay.ts';
import type { PackedDungeon } from '../dungeon/types.ts';
import type { TAzione, TAzioni, TOpzioni, TRisultato } from './types.ts';
import { MAX_TICKS, stepTemplari, templari } from './templari.ts';

/** Input come array RLE o stringa base64 di encodeDungeon; null se non validi. */
export function inputsTemplari(raw: unknown): PackedDungeon | null {
  const v = typeof raw === 'string' ? decodeDungeon(raw, MAX_TICKS) : raw;
  return isPackedDungeon(v, MAX_TICKS) ? v : null;
}

const MAX_AZIONI = 16;
function parseAzione(v: unknown): TAzione | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return (v as Record<string, unknown>)['t'] === 'esci' ? { t: 'esci' } : null;
}
/** Azioni dalla rete: [[tick, azione], …] con tick non decrescenti; null se non valide. */
export function parseTAzioni(v: unknown): TAzioni | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_AZIONI) return null;
  const out: TAzioni = [];
  let last = 0;
  for (const r of v) {
    if (!Array.isArray(r) || r.length !== 2 || !Number.isInteger(r[0]) || r[0] < last || r[0] > MAX_TICKS) return null;
    const a = parseAzione(r[1]);
    if (!a) return null;
    out.push([r[0], a]); last = r[0];
  }
  return out;
}

/** Rigioca la partita: azioni prima del passo del loro tick, quelle oltre l'ultimo input alla fine. */
export function replayTemplari(seed: number, opzioni: TOpzioni, inputs: PackedDungeon, azioni: TAzioni = []): TRisultato {
  const s = templari.create({ seed, opzioni });
  let ai = 0;
  const azioniFinoA = (t: number) => { while (ai < azioni.length && azioni[ai]![0] <= t) templari.act(s, azioni[ai++]![1]); };
  for (const [n, mx, my, b] of inputs) {
    const f = { mx: mx / 8, my: my / 8, a: (b & 1) !== 0, b: (b & 2) !== 0, c: (b & 4) !== 0, d: (b & 8) !== 0 };
    for (let i = 0; i < n && !s.done; i++) { azioniFinoA(s.tick); if (s.done) break; stepTemplari(s, f); }
    if (s.done) break;
  }
  if (!s.done) azioniFinoA(Number.MAX_SAFE_INTEGER);
  return templari.result(s);
}
