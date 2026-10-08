// Effetti sonori (chunk audio): ognuno è una ricetta di toni e soffi, chiptune morbida e lo-fi (ART_BIBLE: mondo PS1/pixel, niente
// epica). Ogni volta un filo diverso (vari): tono ±3-6 %, volume ±10-15 %, così i suoni ripetuti (passi, monete) non stancano.
import type { SuonoId } from './ponte.ts';
import { hz, vari } from './motore.ts';
import type { Motore } from './motore.ts';

type Ricetta = (m: Motore, t: number, k: number) => void;

/** Arpeggio di note MIDI su onda impulso, filtrato: le fanfare delle medaglie. */
function arpeggio(m: Motore, t: number, note: number[], passo: number, vol: number, coda: number): void {
  note.forEach((n, i) => {
    const ultima = i === note.length - 1;
    m.tono({ f: hz(n), onda: 'impulso', t: t + i * passo, dur: ultima ? coda : passo * 1.6, vol, lp: 3200, a: 0.004 });
    if (ultima) m.tono({ f: hz(n - 12), onda: 'triangle', t: t + i * passo, dur: coda, vol: vol * 0.8, a: 0.01 });
  });
}
/** Campanella: due parziali sinusoidali con coda lunga. */
function campana(m: Motore, t: number, f: number, vol: number, dur = 0.7): void {
  m.tono({ f, onda: 'sine', t, dur, vol, a: 0.002 });
  m.tono({ f: f * 2.76, onda: 'sine', t, dur: dur * 0.4, vol: vol * 0.35, a: 0.002 });
}

export const SUONI: Record<SuonoId, Ricetta> = {
  // ---- passi: la tile sotto i piedi ----
  passo_sabbia: (m, t) => m.soffio({ f: 700 * vari(0.15), f2: 380, q: 0.9, t, dur: 0.11, vol: 0.13 * vari(0.15), a: 0.015 }),
  passo_erba: (m, t) => { m.soffio({ f: 2600 * vari(0.15), q: 1.4, t, dur: 0.07, vol: 0.07 * vari(0.15), a: 0.01 }); m.soffio({ f: 1500, q: 1, t: t + 0.03, dur: 0.06, vol: 0.04 }); },
  passo_legno: (m, t) => { m.tono({ f: 190 * vari(0.06), f2: 130, onda: 'triangle', t, dur: 0.09, vol: 0.2 * vari(0.12) }); m.soffio({ f: 1300, q: 2, t, dur: 0.03, vol: 0.06 }); },
  passo_pietra: (m, t) => { m.soffio({ f: 3200 * vari(0.1), q: 3, t, dur: 0.045, vol: 0.09 * vari(0.15) }); m.tono({ f: 420 * vari(0.05), onda: 'sine', t, dur: 0.035, vol: 0.05 }); },
  passo_acqua: (m, t) => m.soffio({ tipo: 'lowpass', f: 1800 * vari(0.15), f2: 500, t, dur: 0.16, vol: 0.12 * vari(0.15), a: 0.01 }),
  passo_dungeon: (m, t) => {
    // pietra con eco corta: siamo sotto terra
    for (const [dt, v] of [[0, 0.09], [0.11, 0.035], [0.22, 0.014]] as const) { m.soffio({ f: 2400 * vari(0.1), q: 2.5, t: t + dt, dur: 0.05, vol: v }); m.tono({ f: 150 * vari(0.05), f2: 90, onda: 'sine', t: t + dt, dur: 0.06, vol: v * 1.4 }); }
  },
  // ---- barca ----
  barca_su: (m, t) => {
    m.tono({ f: 120, f2: 52, onda: 'sine', t, dur: 0.28, vol: 0.26 }); // tonfo dello scafo
    m.tono({ f: 210, f2: 150, onda: 'triangle', t, dur: 0.08, vol: 0.12 });
    m.soffio({ tipo: 'lowpass', f: 2600, f2: 500, t: t + 0.03, dur: 0.42, vol: 0.2, a: 0.02 }); // spruzzo
    m.soffio({ f: 4000, q: 1.5, t: t + 0.05, dur: 0.2, vol: 0.05 });
  },
  barca_giu: (m, t) => {
    m.tono({ f: 230, f2: 170, onda: 'triangle', t, dur: 0.08, vol: 0.16 }); // piede sul molo
    m.tono({ f: 200, f2: 150, onda: 'triangle', t: t + 0.14, dur: 0.08, vol: 0.13 });
    m.soffio({ tipo: 'lowpass', f: 1400, f2: 400, t: t + 0.02, dur: 0.3, vol: 0.1, a: 0.02 }); // la barca dondola
  },
  remata: (m, t, k) => { m.soffio({ f: 650 * vari(0.12), f2: 380, q: 1.2, t, dur: 0.32, vol: (0.04 + 0.08 * k) * vari(0.15), a: 0.06 }); m.soffio({ f: 3000, q: 1, t: t + 0.04, dur: 0.12, vol: 0.02 + 0.03 * k, a: 0.02 }); },
  // ---- isola ----
  moneta: (m, t, k) => {
    // la moneta di ogni gioco a 8 bit; in fila (k) sale di un tono, così una raccolta grossa «canta»
    const n = [0, 2, 4, 5, 7, 9, 11, 12][Math.min(7, Math.round(k * 7))]!;
    m.tono({ f: hz(83 + n) * vari(0.01), onda: 'impulso', t, dur: 0.05, vol: 0.09, lp: 5200 });
    m.tono({ f: hz(88 + n) * vari(0.01), onda: 'impulso', t: t + 0.05, dur: 0.22, vol: 0.09, lp: 5200 });
  },
  martello: (m, t) => {
    for (let i = 0; i < 3; i++) {
      const ti = t + i * 0.17;
      m.tono({ f: 260 * vari(0.05), f2: 170, onda: 'square', t: ti, dur: 0.06, vol: 0.09, lp: 1800 });
      m.soffio({ f: 2600 * vari(0.1), q: 4, t: ti, dur: 0.05, vol: 0.12 });
      m.tono({ f: 1900 * vari(0.03), onda: 'sine', t: ti, dur: 0.12, vol: 0.03 }); // squillo del ferro
    }
  },
  // ---- medaglie: oro, argento e bronzo hanno fanfare diverse (più note, più in alto) ----
  medaglia_oro: (m, t) => { arpeggio(m, t, [72, 76, 79, 84, 88], 0.085, 0.11, 0.9); arpeggio(m, t + 0.5, [84, 88, 91], 0.06, 0.06, 0.5); },
  medaglia_argento: (m, t) => arpeggio(m, t, [67, 71, 74, 79], 0.09, 0.1, 0.7),
  medaglia_bronzo: (m, t) => arpeggio(m, t, [64, 67, 72], 0.1, 0.09, 0.55),
  fine: (m, t) => { m.tono({ f: hz(72), onda: 'triangle', t, dur: 0.2, vol: 0.12 }); m.tono({ f: hz(67), onda: 'triangle', t: t + 0.18, dur: 0.4, vol: 0.12 }); },
  // ---- regata ----
  boa: (m, t) => { campana(m, t, 1318 * vari(0.01), 0.14); campana(m, t + 0.09, 1976, 0.08, 0.6); },
  bip: (m, t) => m.tono({ f: 660, onda: 'impulso', t, dur: 0.14, vol: 0.1, lp: 3000 }),
  via: (m, t) => m.tono({ f: 1320, onda: 'impulso', t, dur: 0.45, vol: 0.11, lp: 3500 }),
  arrivo: (m, t) => { for (const [dt, n] of [[0, 67], [0.16, 72], [0.32, 76]] as const) m.tono({ f: hz(n), onda: 'sawtooth', t: t + dt, dur: dt === 0.32 ? 0.7 : 0.18, vol: 0.07, lp: 1600, a: 0.02 }); },
  raffica: (m, t, k) => {
    m.soffio({ f: 380, f2: 1500, q: 1.6, t, dur: 0.7, vol: 0.06 + 0.12 * k, a: 0.35 });
    m.soffio({ f: 1500, f2: 500, q: 1.4, t: t + 0.6, dur: 0.9, vol: 0.05 + 0.08 * k, a: 0.1 });
  },
  // ---- pesca ----
  lancio: (m, t) => { m.soffio({ f: 900, f2: 2800, q: 2, t, dur: 0.3, vol: 0.07, a: 0.08 }); m.tono({ f: 2400, f2: 1500, onda: 'sine', t: t + 0.05, dur: 0.25, vol: 0.025 }); }, // la lenza fischia
  plop: (m, t) => { m.tono({ f: 300 * vari(0.08), f2: 900, onda: 'sine', t, dur: 0.07, vol: 0.14 }); m.soffio({ tipo: 'lowpass', f: 1600, f2: 400, t: t + 0.02, dur: 0.18, vol: 0.06 }); },
  abbocca: (m, t) => { m.soffio({ tipo: 'lowpass', f: 2400, f2: 600, t, dur: 0.3, vol: 0.18, a: 0.01 }); m.tono({ f: hz(84), onda: 'impulso', t, dur: 0.08, vol: 0.08, lp: 4000 }); m.tono({ f: hz(84), onda: 'impulso', t: t + 0.11, dur: 0.08, vol: 0.08, lp: 4000 }); },
  pesce: (m, t) => { m.soffio({ tipo: 'lowpass', f: 3000, f2: 700, t, dur: 0.35, vol: 0.16 }); arpeggio(m, t + 0.08, [72, 79, 84], 0.07, 0.09, 0.4); },
  scappato: (m, t) => { m.tono({ f: hz(67), f2: hz(60), onda: 'triangle', t, dur: 0.35, vol: 0.12 }); m.soffio({ tipo: 'lowpass', f: 1200, f2: 300, t, dur: 0.25, vol: 0.07 }); },
  // ---- interfaccia ----
  apri: (m, t) => { m.tono({ f: 520 * vari(0.03), f2: 400, onda: 'triangle', t, dur: 0.05, vol: 0.13 }); m.tono({ f: 780 * vari(0.03), f2: 620, onda: 'triangle', t: t + 0.06, dur: 0.06, vol: 0.11 }); m.soffio({ f: 1900, q: 3, t, dur: 0.025, vol: 0.05 }); },
  chiudi: (m, t) => { m.tono({ f: 700 * vari(0.03), f2: 560, onda: 'triangle', t, dur: 0.05, vol: 0.11 }); m.tono({ f: 430 * vari(0.03), f2: 330, onda: 'triangle', t: t + 0.06, dur: 0.07, vol: 0.12 }); m.soffio({ f: 1500, q: 3, t: t + 0.06, dur: 0.025, vol: 0.05 }); },
  click: (m, t) => m.tono({ f: 1100 * vari(0.04), f2: 800, onda: 'triangle', t, dur: 0.03, vol: 0.06 }),
  emote: (m, t) => { m.tono({ f: 560 * vari(0.05), f2: 940, onda: 'sine', t, dur: 0.09, vol: 0.14 }); m.tono({ f: 1250 * vari(0.03), onda: 'impulso', t: t + 0.09, dur: 0.08, vol: 0.05, lp: 3500 }); },
  notifica: (m, t) => { campana(m, t, hz(88), 0.08, 0.5); campana(m, t + 0.12, hz(95), 0.07, 0.6); },
  // ---- dungeon ----
  colpo_dato: (m, t) => { m.soffio({ f: 1700 * vari(0.1), q: 1.5, t, dur: 0.06, vol: 0.12 }); m.tono({ f: 170 * vari(0.06), f2: 60, onda: 'square', t, dur: 0.09, vol: 0.09, lp: 1200 }); },
  colpo_critico: (m, t) => { m.soffio({ f: 2600, q: 1.5, t, dur: 0.08, vol: 0.14 }); m.tono({ f: 240, f2: 70, onda: 'square', t, dur: 0.13, vol: 0.11, lp: 1600 }); m.tono({ f: 1568, onda: 'impulso', t: t + 0.02, dur: 0.12, vol: 0.05, lp: 4000 }); },
  colpo_preso: (m, t) => { m.tono({ f: 110 * vari(0.05), f2: 45, onda: 'square', t, dur: 0.16, vol: 0.12, lp: 900 }); m.soffio({ tipo: 'lowpass', f: 900, t, dur: 0.12, vol: 0.12 }); },
  schivato: (m, t) => m.soffio({ f: 900, f2: 2600, q: 2, t, dur: 0.16, vol: 0.07, a: 0.05 }),
  nemico_ko: (m, t) => { for (let i = 0; i < 4; i++) m.tono({ f: hz(64 - i * 3), onda: 'impulso', t: t + i * 0.06, dur: 0.07, vol: 0.07, lp: 2400 }); },
  raccolto: (m, t) => { m.tono({ f: hz(79), onda: 'impulso', t, dur: 0.06, vol: 0.08, lp: 4000 }); m.tono({ f: hz(86), onda: 'impulso', t: t + 0.06, dur: 0.12, vol: 0.08, lp: 4000 }); },
  pozione: (m, t) => { for (let i = 0; i < 4; i++) m.tono({ f: 380 + i * 140, f2: 620 + i * 160, onda: 'sine', t: t + i * 0.07, dur: 0.07, vol: 0.08 }); },
  magia: (m, t) => { m.tono({ f: 300, f2: 1200, onda: 'triangle', t, dur: 0.4, vol: 0.09, vib: { f: 14, d: 0.05 } }); m.soffio({ f: 3000, f2: 6000, q: 2, t, dur: 0.35, vol: 0.04, a: 0.1 }); },
  altare: (m, t) => { campana(m, t, hz(76), 0.09, 1.1); campana(m, t + 0.15, hz(83), 0.07, 1.1); campana(m, t + 0.3, hz(88), 0.06, 1.3); },
  vuoto: (m, t) => m.tono({ f: 180, f2: 140, onda: 'square', t, dur: 0.12, vol: 0.06, lp: 900 }),
  goccia: (m, t) => { const f = 1100 * vari(0.25); for (const [dt, v] of [[0, 0.05], [0.18, 0.018]] as const) m.tono({ f, f2: f * 1.7, onda: 'sine', t: t + dt, dur: 0.06, vol: v }); },
};
