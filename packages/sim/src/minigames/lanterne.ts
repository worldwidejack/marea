// Lanterne (GDD §6 n. 2): 6 lanterne sul molo del Porto. Si accendono in sequenza a ritmo, le tocchi nello stesso ordine; ogni sequenza
// completata ne aggiunge una (stile Simon: la sequenza nuova è la vecchia più una lanterna). Un errore chiude, 60 s al massimo.
// Il tocco nell'InputFrame: fronte di salita di `a` con mx = (lanterna + 1) / 8 (esatto dopo la quantizzazione a 1/32, niente
// trigonometria). Numeri in content (minigames/lanterne.json).
import { MINIGAMES_CFG } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const CFG = MINIGAMES_CFG.lanterne;
export const LANTERNE_N = CFG.lanterne;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const OFF = Math.round(CFG.mostra.spentaSecondi * TICK_HZ);
const WAIT = Math.round(CFG.mostra.attesaSecondi * TICK_HZ);
const AUTO = Math.round(CFG.autopilotaSecondi * TICK_HZ);
/** Quanto resta accesa la lanterna toccata (riscontro a schermo, non cambia la partita). */
const FLASH = 12;
/** Sequenza pregenerata: più lunga di quanto si possa arrivare in 60 s. */
const SEQ_MAX = 64;

export type LanternePhase = 'mostra' | 'tocca';
export type LanterneState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  seq: number[];
  /** Lunghezza della sequenza di questo giro. */
  len: number;
  phase: LanternePhase;
  phaseTick: number;
  /** Prossima lanterna da toccare (indice nella sequenza). */
  pos: number;
  giuste: number;
  completate: number;
  /** `a` del tick precedente (il tocco è il fronte di salita). */
  prevA: boolean;
  lastTap: { tick: number; idx: number; ok: boolean } | null;
  /** Lanterna sbagliata (−1 se nessuna). */
  wrong: number;
  done: boolean;
  on: number;
};
export type LanterneView = {
  n: number;
  phase: LanternePhase;
  /** Lanterna accesa adesso (−1 = nessuna) e perché: mostrata dalla sequenza, toccata giusta, toccata sbagliata. */
  lit: number;
  litKind: 'mostra' | 'ok' | 'no' | null;
  len: number;
  pos: number;
  completate: number;
  giuste: number;
  ms: number;
  maxMs: number;
  done: boolean;
  wrong: number;
  /** Quella giusta, quando hai sbagliato (per fargliela vedere). */
  expected: number;
  /** Fine per tempo (non per errore). */
  timeUp: boolean;
  medals: { oro: number; argento: number; bronzo: number };
  score: number;
};

/** Il frame di un tocco sulla lanterna `i` (0..5). */
export function tapFrame(i: number): InputFrame {
  return { mx: (i + 1) / 8, my: 0, a: true, b: false };
}
const decode = (mx: number): number => Math.round(mx * 8) - 1;
const showTicks = (s: LanterneState) => WAIT + s.len * (s.on + OFF);
const onOf = (d: Difficulty) => Math.round(CFG.mostra.accesaSecondi[d - 1]! * TICK_HZ);

function medalOf(s: LanterneState): Medal {
  const m = CFG.medaglie, c = s.completate;
  return c >= m.oro ? 'oro' : c >= m.argento ? 'argento' : c >= m.bronzo ? 'bronzo' : null;
}
const scoreOf = (s: LanterneState) => s.giuste * Math.max(1, s.completate);
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

export const lanterne: MinigameModule<LanterneState> = {
  id: 'lanterne',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const rng = createRng(seed).fork('lanterne');
    const seq: number[] = [rng.int(0, LANTERNE_N - 1)];
    // mai la stessa lanterna due volte di fila: si legge meglio
    while (seq.length < SEQ_MAX) seq.push((seq[seq.length - 1]! + 1 + rng.int(0, LANTERNE_N - 2)) % LANTERNE_N);
    return {
      seed, difficulty, tick: 0, seq, len: CFG.primaSequenza, phase: 'mostra', phaseTick: 0, pos: 0, giuste: 0, completate: 0,
      prevA: false, lastTap: null, wrong: -1, done: false, on: onOf(difficulty),
    };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    const press = input.a && !s.prevA;
    s.prevA = input.a;
    if (s.phase === 'mostra') {
      if (s.tick - s.phaseTick >= showTicks(s)) { s.phase = 'tocca'; s.phaseTick = s.tick; }
    } else if (press) {
      const idx = decode(input.mx);
      if (idx >= 0 && idx < LANTERNE_N) {
        const ok = idx === s.seq[s.pos];
        s.lastTap = { tick: s.tick, idx, ok };
        if (!ok) { s.wrong = idx; s.done = true; return; }
        s.giuste++; s.pos++;
        if (s.pos >= s.len) {
          s.completate++; s.pos = 0; s.len++; s.phase = 'mostra'; s.phaseTick = s.tick;
          if (s.len > s.seq.length) { s.done = true; return; }
        }
      }
    }
    if (s.tick >= MAX_TICKS) s.done = true;
  },
  /** score = lanterne giuste × max(1, sequenze completate); medaglia per sequenze completate. */
  result(s): MinigameResult {
    return {
      done: s.done, score: scoreOf(s), medal: medalOf(s),
      detail: { giuste: s.giuste, sequenze: s.completate, lunghezza: s.len, ms: Math.round((s.tick / TICK_HZ) * 1000), sbagliata: s.wrong },
    };
  },
  /** Autopilot di riferimento (deve fare oro): tocca la lanterna giusta ogni `autopilotaSecondi`. */
  autopilot(s): InputFrame {
    if (s.phase !== 'tocca' || s.prevA) return NO;
    const last = Math.max(s.phaseTick, s.lastTap?.tick ?? 0);
    return s.tick - last >= AUTO ? tapFrame(s.seq[s.pos]!) : NO;
  },
  view(s): LanterneView {
    let lit = -1, litKind: LanterneView['litKind'] = null;
    if (s.lastTap && s.tick - s.lastTap.tick < FLASH) { lit = s.lastTap.idx; litKind = s.lastTap.ok ? 'ok' : 'no'; }
    else if (s.phase === 'mostra') {
      const t = s.tick - s.phaseTick - WAIT;
      const k = Math.floor(t / (s.on + OFF));
      if (t >= 0 && k < s.len && t - k * (s.on + OFF) < s.on) { lit = s.seq[k]!; litKind = 'mostra'; }
    }
    if (s.done && s.wrong >= 0) { lit = s.wrong; litKind = 'no'; }
    return {
      n: LANTERNE_N, phase: s.phase, lit, litKind, len: s.len, pos: s.pos, completate: s.completate, giuste: s.giuste,
      ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: CFG.maxSeconds * 1000, done: s.done, wrong: s.wrong,
      expected: s.wrong >= 0 ? s.seq[s.pos]! : -1, timeUp: s.done && s.wrong < 0, medals: { ...CFG.medaglie }, score: scoreOf(s),
    };
  },
};
