// Input della partita a ondate dalla rete e replay deterministico per il server. Il formato degli input è quello del dungeon (RLE a ottavi,
// o la stringa compatta di encodeDungeon); le azioni dal menu sono [tick, azione] con tick = passi già fatti (come nel dungeon).
import { TEMPLARI, eroeDef } from '@marea/content/templari.ts';
import type { TClasse } from '@marea/content/templari.ts';
import { decodeDungeon, frameOfRiga, isPackedDungeon } from '../dungeon/replay.ts';
import type { PackedDungeon } from '../dungeon/types.ts';
import type { TAzione, TAzioni, TInput, TOpzioni, TRisultato } from './types.ts';
import { MAX_TICKS, stepTemplari, stepTemplariInsieme, templari } from './templari.ts';
import { superate } from './vista.ts';
import { usa } from './stato.ts';

/** Input come array RLE o stringa base64 di encodeDungeon; null se non validi. */
export function inputsTemplari(raw: unknown): PackedDungeon | null {
  const v = typeof raw === 'string' ? decodeDungeon(raw, MAX_TICKS) : raw;
  return isPackedDungeon(v, MAX_TICKS) ? v : null;
}

/** Uscire e gli acquisti dal Mercante e dalla Strega (una partita lunga ne fa qualche decina). */
const MAX_AZIONI = 400;
function parseAzione(v: unknown): TAzione | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o['t'] === 'esci') return { t: 'esci' };
  if (o['t'] !== 'compra') return null;
  if (o['da'] === 'mercante' && (o['cosa'] === 'potenzia' || o['cosa'] === 'munizioni') && (o['slot'] === 0 || o['slot'] === 1)) return { t: 'compra', da: 'mercante', cosa: o['cosa'], slot: o['slot'] };
  if (o['da'] === 'strega') { const p = TEMPLARI.strega.pozioni.find((x) => x.id === o['cosa']); if (p) return { t: 'compra', da: 'strega', cosa: p.id }; }
  return null;
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
  for (const r of inputs) {
    const n = r[0], f = frameOfRiga(r); // compresa la mira (mouse o joystick di mira, riga di 5)
    for (let i = 0; i < n && !s.done; i++) { azioniFinoA(s.tick); if (s.done) break; stepTemplari(s, f); }
    if (s.done) break;
  }
  if (!s.done) azioniFinoA(Number.MAX_SAFE_INTEGER);
  return templari.result(s);
}

/** Gli eroi del menù della squadra dalla rete (uno per eroe; sconosciuto o mancante = senza). */
export function parseClassi(v: unknown, eroi: number): (TClasse | null)[] {
  return Array.from({ length: eroi }, (_, i) => (Array.isArray(v) ? eroeDef(typeof v[i] === 'string' ? v[i] : null)?.id ?? null : null));
}

/** Insieme: azioni dal menu della squadra [[tick, eroe, azione], …] (solo acquisti: chi esce è in `uscite`); null se non valide. */
export type TAzioniInsieme = [number, number, TAzione][];
export function parseTAzioniInsieme(v: unknown, eroi: number): TAzioniInsieme | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_AZIONI * eroi) return null;
  const out: TAzioniInsieme = [];
  let last = 0;
  for (const r of v) {
    if (!Array.isArray(r) || r.length !== 3 || !Number.isInteger(r[0]) || r[0] < last || r[0] > MAX_TICKS || !Number.isInteger(r[1]) || r[1] < 0 || r[1] >= eroi) return null;
    const a = parseAzione(r[2]);
    if (!a || a.t !== 'compra') return null;
    out.push([r[0], r[1], a]); last = r[0];
  }
  return out;
}

/** Insieme: il log della squadra (un PackedDungeon per eroe, tutti lunghi uguale: i turni del server), le azioni dal menu di ciascuno e il
 *  tick a cui ognuno è uscito (null = mai). Rigioca fino alla fine della partita o del log; il risultato è quello della squadra, con le
 *  ondate superate da `io` (quelle fino a quando è uscito lui: chi esce prima prende per le ondate che ha visto). */
export function replayTemplariInsieme(seed: number, inputs: readonly PackedDungeon[], uscite: readonly (number | null)[], io: number, azioni: TAzioniInsieme = [], classi: readonly (TClasse | null)[] = []): TRisultato {
  const n = inputs.length;
  const s = templari.create({ seed, opzioni: { subito: true, eroi: n, ...(classi.some(Boolean) ? { classi: [...classi] } : {}) } });
  const riga = inputs.map(() => 0), resto = inputs.map((p) => p[0]?.[0] ?? 0);
  const FERMO: TInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
  const frame = (k: number): TInput => { const r = inputs[k]![riga[k]!]; return r ? frameOfRiga(r) : FERMO; };
  const fine = Math.min(MAX_TICKS, ...inputs.map((p) => p.reduce((t, r) => t + r[0], 0)));
  let mie: number | null = null, ai = 0;
  while (!s.done && s.tick < fine) {
    for (let k = 0; k < n; k++) if (uscite[k] !== null && uscite[k]! <= s.tick && !s.eroi[k]!.fuori) {
      if (k === io) mie = superate(s);
      templari.act(s, { t: 'ritira', eroe: k });
    }
    while (!s.done && ai < azioni.length && azioni[ai]![0] <= s.tick) { const [, k, a] = azioni[ai++]!; templari.act(s, a, k); }
    if (s.done) break;
    stepTemplariInsieme(s, inputs.map((_, k) => frame(k)));
    for (let k = 0; k < n; k++) { if (--resto[k]! <= 0) { riga[k]!++; resto[k] = inputs[k]![riga[k]!]?.[0] ?? 0; } }
  }
  usa(s, io); // i punti nel risultato sono i suoi
  const r = templari.result(s);
  return mie === null ? r : { ...r, superate: Math.min(r.superate, mie) };
}
