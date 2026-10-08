// Musica generativa (chunk audio): lo-fi giapponese a 8 bit, mai uguale. Su una griglia di crome: accordi morbidi (triangolo filtrato,
// attacco lento), basso, una melodia pentatonica che ricorda la sua frase e la varia (motivo A, A', poi una frase nuova), eco
// lo-fi sulla melodia e una batteria leggera con lo swing. Quattro stili: giorno (Re maggiore pentatonico, 76 bpm), notte (La minore
// pentatonico, 62 bpm, flauto e niente cassa), gara (Regata: 128 bpm, arpeggi e rullante) e dungeon (scala «in», 54 bpm, solo pad e
// pizzichi). Lo scheduler mette in coda le note di ~0,3 s in avanti sull'orologio dell'audio (programma), così il tempo non balla.
import type { MusicaModo } from './ponte.ts';
import { hz } from './motore.ts';
import type { Motore, Onda } from './motore.ts';

type Stile = {
  bpm: number; swing: number;
  /** accordi (note MIDI) e il loro basso; `barre` = battute per accordo */
  accordi: number[][]; bassi: number[]; barre: number;
  /** note della melodia (MIDI, in ordine), timbro e quanto suona (0..1) */
  scala: number[]; mel: { onda: Onda; lp: number; a: number; dur: number; vol: number; vib?: number }; densita: number;
  batteria: 'lofi' | 'gara' | 'spazzola' | null; arpeggio: boolean; pad: number;
};
const STILI: Record<Exclude<MusicaModo, 'silenzio'>, Stile> = {
  giorno: {
    bpm: 76, swing: 0.16, barre: 2, pad: 0.03,
    accordi: [[50, 54, 57, 61], [47, 50, 54, 57], [55, 59, 62, 66], [52, 57, 59, 64]], bassi: [38, 35, 43, 45],
    scala: [69, 71, 74, 76, 78, 81, 83, 86, 88], mel: { onda: 'impulso', lp: 2200, a: 0.01, dur: 1.7, vol: 0.06 }, densita: 0.75,
    batteria: 'lofi', arpeggio: false,
  },
  notte: {
    bpm: 62, swing: 0.1, barre: 2, pad: 0.032,
    accordi: [[57, 60, 64, 67], [53, 57, 60, 64], [50, 57, 60, 65], [52, 55, 59, 62]], bassi: [45, 41, 38, 40],
    scala: [64, 67, 69, 72, 74, 76, 79, 81], mel: { onda: 'triangle', lp: 1800, a: 0.05, dur: 2.6, vol: 0.075, vib: 0.012 }, densita: 0.5,
    batteria: 'spazzola', arpeggio: false,
  },
  gara: {
    bpm: 128, swing: 0, barre: 1, pad: 0.022,
    accordi: [[50, 54, 57, 62], [47, 50, 54, 59], [43, 47, 50, 55], [45, 49, 52, 57]], bassi: [38, 35, 43, 45],
    scala: [74, 76, 78, 81, 83, 86, 88, 90], mel: { onda: 'impulso', lp: 3000, a: 0.005, dur: 0.9, vol: 0.05 }, densita: 0.9,
    batteria: 'gara', arpeggio: true,
  },
  dungeon: {
    bpm: 54, swing: 0, barre: 2, pad: 0.03,
    accordi: [[50, 57, 62, 64], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 62]], bassi: [38, 34, 31, 33],
    scala: [62, 63, 67, 69, 70, 74, 75, 79], mel: { onda: 'impulso', lp: 1400, a: 0.004, dur: 1.2, vol: 0.055 }, densita: 0.35,
    batteria: null, arpeggio: false,
  },
};

export type Musica = { readonly modo: MusicaModo; set(m: MusicaModo, t?: number): void; programma(fino: number): void };

export function createMusica(mt: Motore): Musica {
  const { ctx } = mt;
  // eco della melodia: ritardo con ritorno filtrato (suona «nastro»), dentro il bus musica
  const eco = ctx.createDelay(2), fb = ctx.createGain(), ecoLp = ctx.createBiquadFilter(), ecoOut = ctx.createGain();
  fb.gain.value = 0.33; ecoLp.type = 'lowpass'; ecoLp.frequency.value = 1600; ecoOut.gain.value = 0.5;
  eco.connect(ecoLp); ecoLp.connect(fb); fb.connect(eco); ecoLp.connect(ecoOut); ecoOut.connect(mt.duck);

  let modo: MusicaModo = 'silenzio', st: Stile | null = null, step = 0, tNext = 0;
  let layer: GainNode | null = null, mel: GainNode | null = null;
  let frase: (number | null)[] = [], idx = 3;

  /** Una frase di 2 battute (16 crome): passi brevi sulla scala, più note sui tempi forti, qualche pausa. */
  const nuovaFrase = (s: Stile): (number | null)[] => {
    const f: (number | null)[] = [];
    for (let i = 0; i < 16; i++) {
      const pos = i % 8, p = (pos === 0 ? 0.8 : pos % 2 === 0 ? 0.5 : 0.22) * s.densita;
      if (Math.random() < p) { idx = Math.max(0, Math.min(s.scala.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]!)); f.push(idx); }
      else f.push(null);
    }
    return f;
  };
  const varia = (f: (number | null)[], s: Stile) => f.map((n, i) => (i >= 13 ? null : n !== null && Math.random() < 0.25 ? Math.max(0, Math.min(s.scala.length - 1, n + (Math.random() < 0.5 ? -1 : 1))) : n));
  let corrente: (number | null)[] = [];

  const cassa = (t: number, v: number) => mt.tono({ f: 130, f2: 42, onda: 'sine', t, dur: 0.22, vol: v, bus: layer! });
  const charleston = (t: number, v: number) => mt.soffio({ tipo: 'highpass', f: 7000, t, dur: 0.04, vol: v, bus: layer! });
  const rullante = (t: number, v: number) => { mt.soffio({ f: 1800, q: 0.8, t, dur: 0.12, vol: v, bus: layer! }); mt.tono({ f: 210, f2: 150, onda: 'triangle', t, dur: 0.07, vol: v * 0.6, bus: layer! }); };

  function suonaStep(s: Stile, n: number, t0: number): void {
    const sd = 60 / s.bpm / 2, pos = n % 8, bar = Math.floor(n / 8), t = t0 + (pos % 2 === 1 ? s.swing * sd : 0);
    const ci = Math.floor(bar / s.barre) % s.accordi.length, acc = s.accordi[ci]!, basso = s.bassi[ci]!;
    const L = layer!;
    // accordo: all'inizio del suo giro, lungo quanto il giro, attacco lento
    if (pos === 0 && bar % s.barre === 0) {
      const dur = sd * 8 * s.barre;
      for (const nn of acc) mt.tono({ f: hz(nn), onda: 'triangle', t, dur: dur * 1.05, vol: s.pad, a: Math.min(0.6, dur * 0.2), lp: 1300, vib: { f: 0.6, d: 0.002 }, bus: L });
    }
    // basso
    if (s.batteria === 'gara') { if (pos % 2 === 0) mt.tono({ f: hz(basso + (pos % 4 === 2 ? 12 : 0)), onda: 'triangle', t, dur: sd * 1.6, vol: 0.13, bus: L }); }
    else if (pos === 0) mt.tono({ f: hz(basso), onda: 'triangle', t, dur: sd * 3.5, vol: 0.14, a: 0.01, bus: L });
    else if (pos === 5 && s.batteria) mt.tono({ f: hz(basso + 7), onda: 'triangle', t, dur: sd * 2.5, vol: 0.1, a: 0.01, bus: L });
    // arpeggio (gara): l'accordo su, una nota per croma, un'ottava sopra
    if (s.arpeggio) mt.tono({ f: hz(acc[pos % acc.length]! + 12), onda: 'impulso', t, dur: sd * 0.9, vol: 0.03, lp: 2600, bus: L });
    // melodia: frase A, A', poi (ogni 4 battute) se ne inventa una nuova; le battute 4n+3 respirano di più
    const k = n % 32;
    if (k === 0) { if (!corrente.length || Math.random() < 0.6) frase = nuovaFrase(s); corrente = frase; }
    if (k === 16) corrente = varia(frase, s);
    const ni = corrente[k % 16];
    if (ni !== null && ni !== undefined) {
      const f = hz(s.scala[ni]!), m = s.mel;
      mt.tono({ f, onda: m.onda, t, dur: sd * m.dur, vol: m.vol * (pos === 0 ? 1 : 0.85), a: m.a, lp: m.lp, ...(m.vib ? { vib: { f: 5, d: m.vib } } : {}), bus: mel! });
    }
    // batteria
    if (s.batteria === 'lofi') {
      if (pos === 0) cassa(t, 0.16); if (pos === 5) cassa(t, 0.09);
      if (pos === 4) mt.soffio({ f: 1700, q: 1.2, t, dur: 0.09, vol: 0.05, bus: L });
      if (pos % 2 === 1) charleston(t, 0.022 + Math.random() * 0.01);
    } else if (s.batteria === 'gara') {
      if (pos === 0 || pos === 4) cassa(t, 0.18);
      if (pos === 2 || pos === 6) rullante(t, 0.08);
      charleston(t, pos % 2 ? 0.03 : 0.018);
    } else if (s.batteria === 'spazzola') {
      if (pos % 2 === 1 && Math.random() < 0.5) mt.soffio({ f: 5000, q: 0.6, t, dur: 0.08, vol: 0.012, a: 0.02, bus: L });
    }
  }

  const api: Musica = {
    get modo() { return modo; },
    set(m, t = ctx.currentTime) {
      if (m === modo) return;
      modo = m;
      // dissolvenza: lo strato vecchio scende in 1,5 s (le sue note già in coda finiscono lì), il nuovo sale in 2 s
      if (layer) { const old = layer, oldMel = mel; old.gain.setTargetAtTime(0, t, 0.5); if (typeof setTimeout === 'function') setTimeout(() => { old.disconnect(); oldMel?.disconnect(); }, 4000); }
      st = m === 'silenzio' ? null : STILI[m];
      layer = null; mel = null;
      if (!st) return;
      layer = ctx.createGain(); layer.gain.setValueAtTime(0.0001, t); layer.gain.linearRampToValueAtTime(1, t + 2); layer.connect(mt.duck);
      mel = ctx.createGain(); mel.connect(layer); mel.connect(eco);
      eco.delayTime.setValueAtTime((60 / st.bpm) * 0.75, t); // eco a 3 crome
      step = 0; tNext = t + 0.1; corrente = []; idx = Math.floor(st.scala.length / 2);
    },
    programma(fino) {
      if (!st) return;
      const sd = 60 / st.bpm / 2;
      if (tNext < ctx.currentTime - 0.05) tNext = ctx.currentTime + 0.05; // la scheda era in pausa: si riparte, niente raffica di note
      while (tNext < fino) { suonaStep(st, step, tNext); tNext += sd; step++; }
    },
  };
  return api;
}
