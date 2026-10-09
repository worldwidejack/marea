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

// ---- Isola dei Templari: alla Call of Duty Zombies ma nostri, tutto sintetizzato (docs/TEMPLARI.md §11) ----
/** Una sillaba: dente di sega (gola) passato da due formanti (la vocale) e un filo di fiato; `ruvido` = vibrato veloce (voce da morto). */
function sillaba(m: Motore, t: number, f0: number, f1: number, F1: number, F2: number, dur: number, vol: number, ruvido = 0.05): void {
  const vib = { f: 23, d: ruvido };
  m.tono({ f: f0, f2: f1, onda: 'sawtooth', t, dur, vol, a: 0.02, bp: F1, q: 5, vib });
  m.tono({ f: f0, f2: f1, onda: 'sawtooth', t, dur, vol: vol * 0.6, a: 0.02, bp: F2, q: 7, vib });
  m.soffio({ f: F2 * 1.4, q: 1.5, t, dur: dur * 0.7, vol: vol * 0.25, a: 0.01 });
}
/** Campana grande di bronzo: parziali stonate (ronzio, fondamentale, terza minore, quinta, ottava…) con code diverse. */
function campanone(m: Motore, t: number, f: number, vol: number, dur = 3.2): void {
  for (const [r, v, d] of [[0.5, 0.6, 1], [1, 1, 0.85], [1.19, 0.5, 0.6], [1.5, 0.35, 0.45], [2, 0.45, 0.4], [2.52, 0.25, 0.25], [3.01, 0.18, 0.18]] as const)
    m.tono({ f: f * r, onda: 'sine', t, dur: dur * d, vol: vol * v, a: 0.003 });
  m.soffio({ f: f * 4, q: 2, t, dur: 0.05, vol: vol * 0.5 }); // il colpo del battaglio
}
/** Ottone scuro (corno, fanfara): dente di sega filtrato, attacco lento. */
const ottone = (m: Motore, t: number, n: number, dur: number, vol: number, n2?: number) =>
  m.tono({ f: hz(n), ...(n2 !== undefined ? { f2: hz(n2) } : {}), onda: 'sawtooth', t, dur, vol, a: 0.09, lp: 1100, vib: { f: 5, d: 0.006 } });
/** Timpano: tonfo basso che scende, con la pelle (rumore). */
const timpano = (m: Motore, t: number, vol: number) => { m.tono({ f: 68, f2: 44, onda: 'sine', t, dur: 0.9, vol, a: 0.004 }); m.soffio({ tipo: 'lowpass', f: 500, f2: 120, t, dur: 0.35, vol: vol * 0.6 }); };
/** Volume dei versi con la distanza (k 0 lontano … 1 vicino). */
const lontano = (k: number) => 0.3 + 0.7 * k;

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
  // ---- Tempesta: Arrembaggio ----
  cannone: (m, t) => {
    m.tono({ f: 95 * vari(0.06), f2: 38, onda: 'square', t, dur: 0.32, vol: 0.16, lp: 700 }); // botto
    m.soffio({ tipo: 'lowpass', f: 2200, f2: 300, t, dur: 0.5, vol: 0.22, a: 0.004 }); // vampata e fumo
    m.soffio({ f: 3400, q: 1.2, t, dur: 0.05, vol: 0.08 });
  },
  tuono: (m, t, k) => {
    m.soffio({ tipo: 'lowpass', f: 900, f2: 120, t, dur: 1.6, vol: 0.12 + 0.1 * k, a: 0.03 }); // rombo lontano
    m.tono({ f: 55 * vari(0.1), f2: 35, onda: 'triangle', t: t + 0.05, dur: 1.2, vol: 0.09 });
    m.soffio({ tipo: 'lowpass', f: 1400, f2: 200, t: t + 0.35, dur: 0.9, vol: 0.07, a: 0.05 });
  },
  // ---- Vulcano: Fuga dalla lava ----
  salto: (m, t) => m.tono({ f: 330 * vari(0.04), f2: 660, onda: 'impulso', t, dur: 0.09, vol: 0.06, lp: 3000 }),
  sfrigola: (m, t) => { m.soffio({ f: 5200 * vari(0.1), q: 0.8, t, dur: 0.45, vol: 0.09, a: 0.01 }); m.tono({ f: 140, f2: 70, onda: 'square', t, dur: 0.18, vol: 0.06, lp: 800 }); },
  // ---- Isola dei Templari ----
  // «Deus vult!» gridato da una gola morta: DE-us VULT (e, u, u), voce bassa e ruvida
  tpl_deus: (m, t, k) => {
    const v = 0.11 * lontano(k), f = 125 * vari(0.12);
    sillaba(m, t, f * 1.1, f * 1.2, 480, 1850, 0.16, v);
    sillaba(m, t + 0.15, f * 1.2, f, 360, 850, 0.18, v * 0.9);
    m.soffio({ f: 1500, q: 2, t: t + 0.36, dur: 0.05, vol: v * 0.5 }); // la v
    sillaba(m, t + 0.39, f * 1.35, f * 0.8, 340, 760, 0.42, v * 1.1, 0.08);
    m.soffio({ f: 3200, q: 3, t: t + 0.8, dur: 0.05, vol: v * 0.4 }); // la t in fondo
  },
  // rantolo: un «ooh» lungo che trema e cala, dalla pancia
  tpl_rantolo: (m, t, k) => {
    const v = 0.1 * lontano(k), f = 78 * vari(0.15);
    sillaba(m, t, f, f * 0.82, 420, 950, 0.95 * vari(0.2), v, 0.12);
    m.soffio({ tipo: 'lowpass', f: 650, f2: 300, t, dur: 0.8, vol: v * 0.6, a: 0.12 });
  },
  // urlo di chi scatta: sale stridulo
  tpl_urlo: (m, t, k) => {
    const v = 0.1 * lontano(k), f = 380 * vari(0.1);
    sillaba(m, t, f, f * 2.1, 900, 2300, 0.55, v, 0.1);
    m.soffio({ f: 2600, f2: 4200, q: 1.2, t, dur: 0.5, vol: v * 0.5, a: 0.05 });
  },
  // la terra che si apre: zolle e un tonfo sordo
  tpl_sorge: (m, t, k) => {
    const v = lontano(k);
    m.soffio({ tipo: 'lowpass', f: 700, f2: 140, t, dur: 0.7, vol: 0.16 * v, a: 0.06 });
    m.tono({ f: 72, f2: 40, onda: 'sine', t, dur: 0.45, vol: 0.12 * v });
    for (let i = 0; i < 4; i++) m.soffio({ f: 1200 * vari(0.3), q: 3, t: t + 0.1 + i * 0.09 * vari(0.3), dur: 0.04, vol: 0.05 * v });
  },
  // l'asse strappata dalla finestra: schianto di legno e scricchiolio dei chiodi
  tpl_asse: (m, t, k) => {
    const v = lontano(k);
    m.soffio({ f: 950 * vari(0.15), q: 2, t, dur: 0.09, vol: 0.2 * v });
    m.tono({ f: 230 * vari(0.1), f2: 85, onda: 'square', t, dur: 0.13, vol: 0.09 * v, lp: 1500 });
    m.tono({ f: 210, f2: 120, onda: 'sawtooth', t: t + 0.06, dur: 0.28, vol: 0.05 * v, bp: 750, q: 9, vib: { f: 31, d: 0.08 } });
  },
  // stacco d'inizio ondata: timpano, ottoni bassi in Re con il Mi bemolle che stona, la campana in fondo
  tpl_ondata: (m, t) => {
    timpano(m, t, 0.2); timpano(m, t + 0.42, 0.13);
    ottone(m, t + 0.05, 38, 2.4, 0.09); ottone(m, t + 0.05, 45, 2.4, 0.06);
    ottone(m, t + 0.95, 39, 1.6, 0.07); ottone(m, t + 0.95, 50, 1.4, 0.05, 51);
    campanone(m, t + 1.6, hz(50), 0.07, 2.6);
  },
  // fine ondata: un coro che respira e scende, una campanella
  tpl_ondata_fine: (m, t) => {
    for (const [n, dt] of [[62, 0], [65, 0], [69, 0], [60, 1.1], [64, 1.1], [67, 1.1]] as const)
      m.tono({ f: hz(n), onda: 'triangle', t: t + dt, dur: 1.5, vol: 0.05, a: 0.3, lp: 1500, vib: { f: 4.5, d: 0.01 } });
    campana(m, t + 0.2, hz(86), 0.05, 1.6);
  },
  // la campana grande (la trappola, Campane a martello): `k` alto = più forte
  tpl_campana: (m, t, k) => { campanone(m, t, hz(48) * vari(0.01), 0.07 + 0.06 * k); campanone(m, t + 1.1, hz(48), 0.05 + 0.04 * k, 2.4); },
  // il corno del Templare a cavallo: lungo, sale di una quarta, con l'eco della valle
  tpl_corno: (m, t, k) => {
    const v = 0.08 + 0.05 * k;
    ottone(m, t, 46, 0.5, v, 46); ottone(m, t + 0.45, 51, 1.3, v); ottone(m, t + 0.45, 58, 1.3, v * 0.5);
    ottone(m, t + 1.5, 51, 1.0, v * 0.3); // eco
  },
  // la risata di de Molay: HA ha ha ha che scende, con una voce sotto di un'ottava e l'eco
  tpl_risata: (m, t, k) => {
    const v = 0.1 + 0.04 * k;
    for (let i = 0; i < 5; i++) {
      const ti = t + i * 0.17, f = 215 - i * 16;
      sillaba(m, ti, f, f * 0.9, 760, 1250, 0.13, v * (i === 0 ? 1.2 : 1), 0.03);
      m.tono({ f: f / 2, f2: f * 0.45, onda: 'sawtooth', t: ti, dur: 0.13, vol: v * 0.5, bp: 500, q: 4 });
      m.soffio({ f: 1700, q: 1.5, t: ti, dur: 0.04, vol: v * 0.35 }); // la h
      sillaba(m, ti + 0.6, f, f * 0.9, 760, 1250, 0.12, v * 0.25, 0.03); // eco
    }
  },
  // armi da fuoco: pietra focaia, scoppio, tuono del moschetto, ventaglio del trombone
  tpl_pistola: (m, t) => {
    m.soffio({ f: 4200, q: 3, t, dur: 0.02, vol: 0.08 }); // la pietra
    m.soffio({ f: 2400 * vari(0.1), q: 0.6, t: t + 0.03, dur: 0.12, vol: 0.22 });
    m.tono({ f: 170 * vari(0.06), f2: 50, onda: 'square', t: t + 0.03, dur: 0.15, vol: 0.1, lp: 1300 });
    m.soffio({ tipo: 'lowpass', f: 1300, f2: 250, t: t + 0.06, dur: 0.4, vol: 0.12 });
  },
  tpl_moschetto: (m, t) => {
    m.soffio({ f: 4200, q: 3, t, dur: 0.02, vol: 0.08 });
    m.soffio({ f: 1800 * vari(0.1), q: 0.5, t: t + 0.04, dur: 0.2, vol: 0.27 });
    m.tono({ f: 120 * vari(0.05), f2: 34, onda: 'square', t: t + 0.04, dur: 0.32, vol: 0.13, lp: 900 });
    m.soffio({ tipo: 'lowpass', f: 900, f2: 140, t: t + 0.1, dur: 0.7, vol: 0.13, a: 0.02 });
  },
  tpl_trombone: (m, t) => {
    m.soffio({ tipo: 'lowpass', f: 3200, f2: 380, t, dur: 0.5, vol: 0.3 });
    m.tono({ f: 95 * vari(0.06), f2: 30, onda: 'square', t, dur: 0.35, vol: 0.14, lp: 800 });
    for (let i = 0; i < 5; i++) m.soffio({ f: 2600 * vari(0.3), q: 4, t: t + 0.05 + i * 0.03, dur: 0.03, vol: 0.05 }); // i pallini
  },
  tpl_freccia: (m, t) => { m.tono({ f: 340 * vari(0.05), f2: 150, onda: 'triangle', t, dur: 0.12, vol: 0.12 }); m.soffio({ f: 1100, f2: 3200, q: 1.8, t: t + 0.02, dur: 0.22, vol: 0.06, a: 0.03 }); },
  tpl_fendente: (m, t, k) => m.soffio({ f: 600 * vari(0.15), f2: 2400, q: 1.5, t, dur: 0.17 + 0.1 * k, vol: 0.09 + 0.05 * k, a: 0.05 }),
  // una porta che cede: cigolio lungo, poi il tonfo e la polvere
  tpl_porta: (m, t) => {
    m.tono({ f: 95, f2: 150, onda: 'sawtooth', t, dur: 0.75, vol: 0.07, bp: 620, q: 9, vib: { f: 7, d: 0.12 } });
    m.tono({ f: 82, f2: 40, onda: 'sine', t: t + 0.75, dur: 0.4, vol: 0.18 });
    m.soffio({ tipo: 'lowpass', f: 1100, f2: 300, t: t + 0.76, dur: 0.6, vol: 0.12, a: 0.02 });
  },
  // un power-up esce da terra: luccichio che sale
  tpl_potere: (m, t) => {
    for (let i = 0; i < 6; i++) m.tono({ f: hz([81, 86, 88, 93, 95, 100][i]!), onda: 'sine', t: t + i * 0.05, dur: 0.35, vol: 0.04, vib: { f: 9, d: 0.01 } });
    m.soffio({ f: 6000, q: 1.5, t, dur: 0.4, vol: 0.03, a: 0.1 });
  },
  // preso: accordo d'ottoni e campanella (k = quale power-up: la tonalità cambia)
  tpl_potere_preso: (m, t, k) => {
    const s = Math.round(k * 4) * 2;
    for (const n of [50, 54, 57, 62]) ottone(m, t, n + s, 0.9, 0.05);
    m.soffio({ f: 900, f2: 4000, q: 1, t, dur: 0.3, vol: 0.06, a: 0.1 });
    campana(m, t + 0.1, hz(86 + s), 0.06, 1.0);
  },
  // la cassa del tesoro: un carillon che gira per 4 s, poi rallenta
  tpl_cassa: (m, t) => {
    const scala = [84, 86, 88, 91, 93, 96, 98];
    let ti = t;
    for (let i = 0; i < 14; i++) { const n = scala[Math.floor(Math.random() * scala.length)]!; m.tono({ f: hz(n), onda: 'sine', t: ti, dur: 0.5, vol: 0.05, a: 0.002 }); m.tono({ f: hz(n) * 3, onda: 'sine', t: ti, dur: 0.15, vol: 0.012 }); ti += 0.22 + i * 0.012; }
  },
  // il teschio della cassa: risata corta e un accordo che stona
  tpl_teschio: (m, t) => {
    for (let i = 0; i < 3; i++) sillaba(m, t + i * 0.15, 150 - i * 12, 130 - i * 12, 700, 1150, 0.11, 0.09, 0.04);
    for (const n of [38, 44, 49]) m.tono({ f: hz(n), onda: 'sawtooth', t: t + 0.5, dur: 1.2, vol: 0.04, lp: 700, a: 0.05 });
  },
  // il rogo che prende: fiammata e crepitio
  tpl_rogo: (m, t) => {
    m.soffio({ tipo: 'lowpass', f: 1300, f2: 550, t, dur: 1.5, vol: 0.2, a: 0.18 });
    for (let i = 0; i < 9; i++) m.soffio({ f: 3000 * vari(0.4), q: 4, t: t + 0.1 + i * 0.12 * vari(0.4), dur: 0.03, vol: 0.05 });
  },
  // sei caduto: il cuore che rallenta su un bordone basso
  tpl_caduto: (m, t) => {
    m.tono({ f: 55, onda: 'sine', t, dur: 3, vol: 0.09, a: 0.4 }); m.tono({ f: 58.3, onda: 'sine', t, dur: 3, vol: 0.06, a: 0.4 });
    for (const [dt, v] of [[0, 0.2], [0.22, 0.13], [0.9, 0.16], [1.13, 0.1], [2.0, 0.11], [2.25, 0.06]] as const) m.tono({ f: 62, f2: 40, onda: 'sine', t: t + dt, dur: 0.2, vol: v });
  },
};
