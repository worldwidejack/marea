// Il fantasma del record (passo 3b, birbasan 12 ott 2026): la discesa di chi ha il miglior tempo sulla pista, rigiocata coi suoi input
// nella stessa sim (deterministica: fa esattamente quello che aveva fatto). Si calcola tutta all'inizio (pochi millisecondi), così a ogni tick
// si sa dov'è e di quanti secondi sei davanti o dietro a lui nello stesso punto della pista. Niente urti: è un fantasma.
import type { InputFrame, PackedInputs } from '@marea/sim';
import { unpackInputs } from '@marea/sim';
import { snowboard } from '@marea/sim/minigames/snowboard.ts';

/** Un tick del fantasma: quanto basta per disegnarlo (posizione, volo, trick, presa, caduta). */
export type PassoFantasma = { s: number; lat: number; y: number; v: number; vl: number; aria: boolean; trick: number; trickT: number; presa: boolean; caduta: number; carica: number };
export type CorsaFantasma = {
  /** Il fantasma al tick `t` (dopo la fine resta all'arrivo). */
  a(t: number): PassoFantasma;
  /** Secondi tra te e lui nello stesso punto `s` al tuo tick `t` (+ = sei dietro). null prima della partenza. */
  distacco(s: number, t: number): number | null;
  readonly ticks: number;
};

export function corsaFantasma(o: { seed: number; opzioni: Record<string, string>; inputs: PackedInputs }): CorsaFantasma {
  const st = snowboard.create({ seed: o.seed, difficulty: 1, opzioni: o.opzioni });
  const frames: InputFrame[] = unpackInputs(o.inputs);
  const passi: PassoFantasma[] = [];
  const foto = (): PassoFantasma => ({ s: st.s, lat: st.lat, y: st.y, v: st.v, vl: st.vl, aria: st.aria, trick: st.trick, trickT: st.trickT, presa: st.presa, caduta: st.caduta, carica: st.carica });
  passi.push(foto());
  for (const f of frames) { if (st.done) break; snowboard.step(st, f); passi.push(foto()); }
  return {
    ticks: passi.length - 1,
    a: (t) => passi[Math.max(0, Math.min(passi.length - 1, Math.floor(t)))]!,
    distacco(s, t) {
      if (t <= 0) return null;
      // il primo tick in cui il fantasma è passato da `s` (le s crescono: ricerca binaria)
      let lo = 0, hi = passi.length - 1;
      if (passi[hi]!.s < s) return null; // oltre il suo arrivo
      while (lo < hi) { const m = (lo + hi) >> 1; if (passi[m]!.s < s) lo = m + 1; else hi = m; }
      return (t - lo) / 60;
    },
  };
}
