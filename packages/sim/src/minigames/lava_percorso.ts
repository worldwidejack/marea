// Fuga dalla lava, il percorso dal seed (docs/LAVA.md): una corsa senza fine fatta di pezzi presi da un mazzo, come il Toad Rally di Super
// Mario Run: un po' di riposo, un'idea alla volta, e ogni 150 tile entrano pezzi più difficili. Le gemme disegnano la traiettoria giusta
// (come le monete di Mario). Larghezza dei buchi in funzione della velocità di quel punto, così un salto tenuto basta sempre. Solo + − × ÷.
import { MINIGAMES_CFG } from '@marea/content';
import type { LavaCosa } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Difficulty } from './types.ts';
import { ARIA_PIENO, T, X0, velocitaA } from './lava_fisica.ts';
import type { Gemma, Mondo } from './lava_fisica.ts';

const C = MINIGAMES_CFG.lava;
export const MAX_TICKS = Math.round(C.maxSeconds * TICK_HZ);
/** Fin dove arriva il percorso: la corsa più lunga possibile più qualche schermata. */
export const LUNGHEZZA = Math.ceil(X0 + C.corsa.velocitaMax * MAX_TICKS + 40 * T);
/** Altezza (tile) della roccia di partenza. */
export const H_PARTENZA = 2;

type Pezzo = { liv: number; peso: number; f: () => void };

export function genera(seed: number, difficulty: Difficulty): Mondo & { gemme: Gemma[] } {
  const rng = createRng(seed).fork('lava');
  const mb = C.difficolta.buchi[difficulty - 1]!, mo = C.difficolta.ostacoli[difficulty - 1]!;
  const [p0, p1] = C.geyser.periodoSecondi.map((v) => Math.round(v * TICK_HZ)) as [number, number];
  const per = Math.round(C.magmino.periodoSecondi * TICK_HZ), amp = (C.magmino.pattuglia * T) / 2;
  const w: Mondo = { pezzi: [], mensole: [], spuntoni: [], magmini: [], geyser: [] }, gemme: Gemma[] = [];
  let x = 0, h = H_PARTENZA;
  const ri = (a: number, b: number) => rng.int(a, b), sino = (p: number) => rng.next() < p;
  const terra = (len: number, hh = h) => { hh = Math.max(1, Math.min(6, hh)); w.pezzi.push({ x0: x, x1: x + len * T, h: hh }); x += len * T; h = hh; };
  const buco = (len: number) => { x += len * T; };
  const gem = (k: LavaCosa, gx: number, gy: number) => gemme.push({ k, x: Math.round(gx), y: Math.round(gy), preso: false });
  /** y delle gemme a `d` px sopra la roccia alta `hh` tile. */
  const su = (hh: number, d = 12) => -hh * T - d;
  const fila = (k: LavaCosa, xa: number, xb: number, y: number, n: number) => { for (let i = 0; i < n; i++) gem(k, xa + (xb - xa) * (n === 1 ? 0.5 : i / (n - 1)), y); };
  /** Arco di `n` gemme da xa a xb: parte da y e sale di `apex` px a metà (la traiettoria del salto). */
  const arco = (k: LavaCosa, xa: number, xb: number, y: number, apex: number, n: number) => {
    for (let i = 0; i < n; i++) { const u = n === 1 ? 0.5 : i / (n - 1); gem(k, xa + (xb - xa) * u, y - apex * 4 * u * (1 - u)); }
  };
  /** Larghezza di un buco in tile: la frazione `f` di un salto tenuto alla velocità di qui. */
  const gap = (f: number) => Math.max(2, Math.round((f * ARIA_PIENO * velocitaA(x) * mb) / T));
  const quanti = (a: number, b: number) => Math.max(1, Math.round(ri(a, b) * mo));

  // ---- i pezzi del mazzo ----
  const piano = () => { const a = x; terra(ri(7, 11)); fila('ossidiana', a + 2 * T, x - 2 * T, su(h), ri(3, 5)); };
  const fossa = (f: number) => {
    terra(ri(2, 3)); const h0 = h, a = x; buco(gap(f)); const b = x; terra(ri(4, 6), h + ri(-1, 1));
    arco('ossidiana', a - 6, b + 6, su(Math.max(h0, h), 8), 22 + 38 * f, 5);
  };
  const gradinoSu = () => {
    if (h >= 5) return gradinoGiu();
    terra(ri(3, 4)); const a = x, h0 = h; terra(ri(5, 7), h + ri(1, 2));
    arco('ossidiana', a - 14, a + 22, su(h0, 10), 26, 4); fila('ossidiana', a + 2 * T, x - T, su(h), 3);
  };
  function gradinoGiu(): void {
    if (h <= 1) return piano();
    terra(ri(3, 4)); terra(ri(5, 7), h - ri(1, 3)); fila('ossidiana', x - 5 * T, x - T, su(h), 4);
  }
  const trincea = () => {
    terra(3); const h0 = h; terra(ri(5, 7), h - 2); fila('ossidiana', x - 5 * T, x - T, su(h), 4); terra(4, h0);
  };
  const spuntoni = (liv: number) => {
    terra(ri(3, 4));
    for (let i = quanti(1, 3); i > 0; i--) {
      const len = ri(4, 6), a = x; terra(len);
      const sx = a + (len * T) / 2;
      w.spuntoni.push({ x: sx, h });
      if (liv >= 3 && sino(0.5)) w.spuntoni.push({ x: sx + 10, h });
      arco('ossidiana', sx - 22, sx + 22, su(h, 14), 32, 3);
    }
  };
  const magmini = () => {
    const a = x; terra(ri(9, 12));
    for (let i = 0; i < quanti(1, 2); i++) {
      const mx = a + (3 + i * 5) * T;
      w.magmini.push({ x: mx, h, amp, per, fase: ri(0, per) });
      arco('ossidiana', mx - 14, mx + 14, su(h, 24), 20, 3);
    }
  };
  const isolotti = () => {
    terra(3);
    for (let i = ri(3, 4); i > 0; i--) { buco(gap(0.36)); terra(ri(2, 3), h + ri(-1, 1)); gem('ossidiana', x - T, su(h, 14)); }
  };
  const sfiato = () => {
    const a = x, len = ri(9, 11); terra(len);
    w.geyser.push({ x: a + (len * T) / 2, h, alto: ri(C.geyser.alto[0], C.geyser.alto[1]), per: ri(p0, p1), fase: ri(0, p1) });
    arco('ossidiana', a + (len * T) / 2 - 30, a + (len * T) / 2 + 30, su(h, 12), 62, 5);
  };
  const mensola = () => {
    const a = x; terra(ri(10, 12));
    w.mensole.push({ x0: a + 3.5 * T, x1: a + 6.5 * T, h: h + 3 });
    arco('ossidiana', a + 2 * T, a + 4 * T, su(h, 10), 40, 3);
    gem(sino(0.3) ? 'rubino' : 'scintilla', a + 5 * T, su(h + 3, 12));
  };
  const muro = () => {
    if (h > 3) terra(3, 2);
    terra(4); const h0 = h; terra(2, h0 + 3); gem('scintilla', x - T, su(h, 12)); terra(5, h0);
    arco('ossidiana', x - 9 * T, x - 7 * T, su(h0, 10), 54, 3);
  };
  const scalinata = () => {
    terra(3);
    for (let i = 0; i < 4; i++) { terra(3, h + 1); gem('ossidiana', x - T, su(h, 12)); }
    terra(5, h - 3);
  };
  const ponte = () => {
    terra(2);
    for (let i = 0; i < 4; i++) { buco(gap(0.36)); terra(2); gem('ossidiana', x - T, su(h, 14)); }
    gem('rubino', x - T, su(h, 40));
  };
  const MAZZO = (liv: number): Pezzo[] => [
    { liv: 0, peso: 4, f: () => fossa(0.36) }, { liv: 0, peso: 3, f: gradinoSu }, { liv: 0, peso: 2, f: gradinoGiu },
    { liv: 1, peso: 3, f: () => spuntoni(liv) }, { liv: 1, peso: 3, f: magmini }, { liv: 1, peso: 3, f: () => fossa(0.58) }, { liv: 1, peso: 2, f: trincea },
    { liv: 2, peso: 2, f: isolotti }, { liv: 2, peso: 2, f: sfiato }, { liv: 2, peso: 2, f: mensola }, { liv: 2, peso: 2, f: muro }, { liv: 2, peso: 3, f: () => fossa(0.8) },
    { liv: 3, peso: 2, f: scalinata }, { liv: 3, peso: 2, f: ponte },
  ];

  terra(14); fila('ossidiana', 6 * T, 12 * T, su(h), 4);
  piano(); fossa(0.36); piano(); gradinoSu();
  let ultimo = -1;
  while (x < LUNGHEZZA) {
    const liv = Math.min(C.livelli.max, Math.floor(x / (C.livelli.ogniTile * T))), mazzo = MAZZO(liv).filter((p) => p.liv <= liv);
    if (sino(0.55 - 0.13 * liv)) piano();
    for (let n = 1 + (liv >= 3 && sino(0.3 * (liv - 2)) ? 1 : 0); n > 0; n--) { // dal livello 3 qualche pezzo viene dietro l'altro, senza respiro
      let i = 0;
      for (let prova = 0; prova < 4; prova++) {
        let r = ri(0, mazzo.reduce((a, p) => a + p.peso, 0) - 1);
        for (i = 0; r >= mazzo[i]!.peso; i++) r -= mazzo[i]!.peso;
        if (i !== ultimo) break;
      }
      ultimo = i; mazzo[i]!.f();
    }
  }
  terra(40);
  gemme.sort((a, b) => a.x - b.x);
  return { ...w, gemme };
}
