// La canzone segreta dei Templari (docs/TEMPLARI.md §9c): parte quando la squadra trova i tre teschi, come le canzoni nascoste di COD
// Zombies. «Inno dei crociati», scritto qui nota per nota (originale, niente copiato) e suonato dal nostro motore (motore.ts): Re minore
// che chiude in Re maggiore, 72 bpm, 30 battute (~100 s).
//   Introduzione (4): l'organo apre piano su Re, il coro mormora la quinta, il rullo di timpano cresce.
//   A (8): il coro canta il tema (Re, Fa, La…) sull'organo: Rem Si♭ Fa Do | Rem Solm La La.
//   B (8): gli ottoni prendono una seconda melodia più alta, timpani sul primo e terzo tempo: Si♭ Fa Solm Rem | Si♭ Do La La.
//   A' (8): tutto insieme, gli ottoni rifanno il tema un'ottava sopra, le campane ogni due battute; l'ultima battuta apre in Re maggiore.
//   Coda (2): Re maggiore tenuto, la campana grande e il colpo finale.
import { hz } from './motore.ts';
import type { Motore } from './motore.ts';

export const INNO_BPM = 72;
const B = 60 / INNO_BPM; // un tempo (s)
const BAR = B * 4;

type N = [nota: number, tempi: number];
type Ev = { t: number; f: (mt: Motore, at: number, out: AudioNode) => void };

// ---- timbri ----
/** Organo: fondamentale, ottava e due ottave sopra (8', 4', 2'), tenuto. */
const organo = (mt: Motore, at: number, out: AudioNode, n: number, dur: number, vol: number) => {
  const f = hz(n);
  mt.tono({ f, onda: 'sine', t: at, dur, vol, a: 0.08, rel: 0.3, bus: out });
  mt.tono({ f: f * 2, onda: 'triangle', t: at, dur, vol: vol * 0.38, a: 0.08, rel: 0.3, lp: 2400, bus: out });
  mt.tono({ f: f * 4, onda: 'sine', t: at, dur, vol: vol * 0.12, a: 0.1, rel: 0.3, bus: out });
};
/** Coro: due voci un filo stonate, dente di sega attraverso le formanti della «a», attacco lento e vibrato. */
const coro = (mt: Motore, at: number, out: AudioNode, n: number, dur: number, vol: number) => {
  for (const k of [1, 1.004]) {
    const f = hz(n) * k, vib = { f: 5.2, d: 0.007 };
    mt.tono({ f, onda: 'sawtooth', t: at, dur, vol, a: 0.14, rel: 0.25, bp: 720, q: 4, vib, bus: out });
    mt.tono({ f, onda: 'sawtooth', t: at, dur, vol: vol * 0.55, a: 0.14, rel: 0.25, bp: 1150, q: 5, vib, bus: out });
  }
};
/** Ottoni: dente di sega filtrato e un'impulso sotto, attacco deciso. */
const ottoni = (mt: Motore, at: number, out: AudioNode, n: number, dur: number, vol: number) => {
  mt.tono({ f: hz(n), onda: 'sawtooth', t: at, dur, vol, a: 0.04, rel: 0.15, lp: 1700, vib: { f: 5, d: 0.004 }, bus: out });
  mt.tono({ f: hz(n), onda: 'impulso', t: at, dur, vol: vol * 0.35, a: 0.04, rel: 0.15, lp: 1200, bus: out });
};
/** Timpano: tonfo che scende appena, con la pelle. */
const timpano = (mt: Motore, at: number, out: AudioNode, n: number, vol: number) => {
  mt.tono({ f: hz(n), f2: hz(n) * 0.93, onda: 'sine', t: at, dur: 0.9, vol, a: 0.003, bus: out });
  mt.soffio({ tipo: 'lowpass', f: 260, t: at, dur: 0.25, vol: vol * 0.6, bus: out });
};
/** Campana di bronzo: parziali stonate con code diverse. */
const campana = (mt: Motore, at: number, out: AudioNode, n: number, vol: number) => {
  for (const [r, v, d] of [[0.5, 0.5, 2.5], [1, 1, 3], [1.19, 0.45, 1.8], [1.5, 0.3, 1.2], [2, 0.35, 1], [3.01, 0.15, 0.5]] as const)
    mt.tono({ f: hz(n) * r, onda: 'sine', t: at, dur: d, vol: vol * v, a: 0.003, bus: out });
};

// ---- la partitura ----
const ACC: Record<string, { v: number[]; b: number }> = {
  Rem: { v: [57, 62, 65], b: 38 }, Sib: { v: [58, 62, 65], b: 34 }, Fa: { v: [57, 60, 65], b: 41 }, Do: { v: [55, 60, 64], b: 36 },
  Solm: { v: [58, 62, 67], b: 43 }, La: { v: [57, 61, 64], b: 33 }, Re: { v: [57, 62, 66], b: 38 },
};
const GIRO_A = ['Rem', 'Sib', 'Fa', 'Do', 'Rem', 'Solm', 'La', 'La'];
const GIRO_B = ['Sib', 'Fa', 'Solm', 'Rem', 'Sib', 'Do', 'La', 'La'];
const GIRO_A2 = ['Rem', 'Sib', 'Fa', 'Do', 'Rem', 'Solm', 'La', 'Re'];
const TEMA: N[][] = [
  [[62, 2], [65, 1], [69, 1]], [[70, 2], [69, 1], [67, 1]], [[65, 1.5], [67, 0.5], [69, 2]], [[67, 2], [64, 2]],
  [[62, 1], [65, 1], [69, 1], [74, 1]], [[72, 1], [70, 1], [69, 1], [67, 1]], [[69, 2], [73, 2]], [[69, 4]],
];
const SECONDA: N[][] = [
  [[77, 2], [74, 2]], [[72, 2], [69, 1], [72, 1]], [[74, 1.5], [72, 0.5], [70, 1], [74, 1]], [[69, 4]],
  [[70, 1], [74, 1], [77, 2]], [[76, 1], [74, 1], [72, 1], [76, 1]], [[73, 2], [76, 2]], [[81, 4]],
];

function partitura(): Ev[] {
  const ev: Ev[] = [], add = (t: number, f: Ev['f']) => ev.push({ t, f });
  const accordo = (bar: number, nome: string, vol: number, conBasso = true) => {
    const a = ACC[nome]!, t = bar * BAR;
    for (const n of a.v) add(t, (mt, at, o) => organo(mt, at, o, n, BAR * 1.02, vol));
    if (conBasso) add(t, (mt, at, o) => organo(mt, at, o, a.b, BAR * 1.02, vol * 1.3));
  };
  const melodia = (bar0: number, frasi: N[][], suona: (mt: Motore, at: number, o: AudioNode, n: number, d: number) => void, sposta = 0) => {
    frasi.forEach((fr, k) => {
      let t = (bar0 + k) * BAR;
      for (const [n, tempi] of fr) { const d = tempi * B; add(t, (mt, at, o) => suona(mt, at, o, n + sposta, d * 0.97)); t += d; }
    });
  };
  // introduzione: organo piano su Re, il coro sulla quinta, il rullo che cresce nell'ultima battuta
  ['Rem', 'Rem', 'Sib', 'La'].forEach((c, k) => accordo(k, c, 0.022 + k * 0.004));
  add(0, (mt, at, o) => { coro(mt, at, o, 50, BAR * 2, 0.02); coro(mt, at, o, 57, BAR * 2, 0.02); });
  add(BAR * 2, (mt, at, o) => { coro(mt, at, o, 53, BAR * 2, 0.022); coro(mt, at, o, 57, BAR * 2, 0.022); });
  for (let i = 0; i < 40; i++) add(BAR * 3 + i * (BAR / 40), (mt, at, o) => timpano(mt, at, o, 38, 0.02 + 0.1 * (i / 40)));
  add(BAR * 4, (mt, at, o) => campana(mt, at, o, 50, 0.07));
  // A: il coro canta il tema
  GIRO_A.forEach((c, k) => accordo(4 + k, c, 0.026));
  melodia(4, TEMA, (mt, at, o, n, d) => coro(mt, at, o, n, d, 0.05));
  for (let k = 0; k < 8; k++) add((4 + k) * BAR, (mt, at, o) => timpano(mt, at, o, k % 4 === 3 ? 33 : 38, 0.08));
  // B: gli ottoni, il coro tiene l'accordo, timpani sul primo e terzo tempo
  GIRO_B.forEach((c, k) => {
    accordo(12 + k, c, 0.026);
    const a = ACC[c]!;
    add((12 + k) * BAR, (mt, at, o) => { for (const n of a.v) coro(mt, at, o, n, BAR, 0.017); });
    for (const tp of [0, 2]) add((12 + k) * BAR + tp * B, (mt, at, o) => timpano(mt, at, o, a.b + (a.b < 36 ? 12 : 0), tp ? 0.07 : 0.1));
  });
  melodia(12, SECONDA, (mt, at, o, n, d) => ottoni(mt, at, o, n, d, 0.045));
  // A': tutto insieme, ottoni un'ottava sopra, campane ogni due battute, il rullo prima della fine
  GIRO_A2.forEach((c, k) => {
    accordo(20 + k, c, 0.03);
    const a = ACC[c]!;
    for (const tp of [0, 1, 2, 3]) add((20 + k) * BAR + tp * B, (mt, at, o) => timpano(mt, at, o, a.b + (a.b < 36 ? 12 : 0), tp % 2 ? 0.05 : 0.1));
    if (k % 2 === 0) add((20 + k) * BAR, (mt, at, o) => campana(mt, at, o, 62, 0.045));
  });
  melodia(20, TEMA.slice(0, 7), (mt, at, o, n, d) => coro(mt, at, o, n, d, 0.05));
  melodia(20, TEMA.slice(0, 7), (mt, at, o, n, d) => ottoni(mt, at, o, n, d, 0.035), 12);
  // l'ultima del tema apre in Re maggiore: il coro sul Re, gli ottoni sulla terza e la quinta
  add(27 * BAR, (mt, at, o) => { coro(mt, at, o, 74, BAR, 0.05); ottoni(mt, at, o, 78, BAR, 0.035); ottoni(mt, at, o, 81, BAR, 0.03); });
  for (let i = 0; i < 24; i++) add(27 * BAR + BAR / 2 + i * (BAR / 48), (mt, at, o) => timpano(mt, at, o, 38, 0.03 + 0.08 * (i / 24)));
  // coda: Re maggiore tenuto due battute, la campana grande, il colpo finale
  add(28 * BAR, (mt, at, o) => {
    for (const n of [50, 57, 62, 66, 69]) organo(mt, at, o, n, BAR * 2, 0.03);
    organo(mt, at, o, 26 + 12, BAR * 2, 0.04);
    for (const n of [62, 66, 69, 74]) coro(mt, at, o, n, BAR * 2, 0.03);
    ottoni(mt, at, o, 74, BAR * 2, 0.035); ottoni(mt, at, o, 78, BAR * 2, 0.03);
    campana(mt, at, o, 38, 0.09); timpano(mt, at, o, 38, 0.14);
  });
  add(29 * BAR, (mt, at, o) => campana(mt, at, o, 50, 0.07));
  add(30 * BAR - B, (mt, at, o) => { timpano(mt, at, o, 38, 0.16); timpano(mt, at, o, 26 + 12, 0.1); });
  return ev.sort((a, b) => a.t - b.t);
}

/** Quanto dura l'inno (s), coda compresa. */
export const INNO_DURATA = 30 * BAR + 3;

/** L'inno su `out` a partire da `t0` (orologio dell'audio): `programma(fino)` mette in coda le note fino a `fino`; false = finito. */
export function creaInno(mt: Motore, out: AudioNode, t0: number): { programma(fino: number): boolean } {
  const ev = partitura();
  let i = 0;
  return {
    programma(fino) {
      while (i < ev.length && t0 + ev[i]!.t < fino) { const e = ev[i++]!; e.f(mt, Math.max(mt.now(), t0 + e.t), out); }
      return i < ev.length;
    },
  };
}
