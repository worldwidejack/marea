// Fuga dalla lava, il pilota di riferimento (deve fare oro): ogni pochi tick prova una novantina di «piani» (nessun tocco, un salto con la sua
// durata, due salti) con la fisica vera, tiene quello che dà di più (gemme, nemici, niente colpi né tuffi, vantaggio sul muro) e lo segue.
import { MINIGAMES_CFG } from '@marea/content';
import type { InputFrame } from '../types.ts';
import { avanza, azzera, nuovoEvento } from './lava_fisica.ts';
import type { Corpo, Gemma } from './lava_fisica.ts';
import type { LavaState } from './lava.ts';

const C = MINIGAMES_CFG.lava;
const H = C.autopilota.orizzonte;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const SI: InputFrame = { mx: 0, my: 0, a: true, b: false };
/** Un piano = tocchi [tick d'inizio, quanti tick tenuto] contati dal tick prossimo. */
type Piano = readonly (readonly [number, number])[];
const PIANI: Piano[] = [[]];
for (const d of [0, 2, 4, 6, 9, 12, 16, 21, 27, 34]) for (const h of [2, 7, 13, 22, 40]) PIANI.push([[d, h]]);
for (const d of [0, 4, 9]) for (const h of [2, 10]) for (const g of [14, 24, 34]) for (const h2 of [2, 14]) PIANI.push([[d, h], [d + g, h2]]);
const tiene = (p: Piano, k: number): boolean => p.some(([d, h]) => k >= d && k < d + h);
const prende = (x: number, y: number, g: Gemma) => Math.abs(g.x - x) < 8 && Math.abs(g.y - (y - 6.5)) < 9;

function valuta(s: LavaState, piano: Piano, vicine: Gemma[]): number {
  const c: Corpo = { ...s.c }, morti = s.morti.slice(), e = nuovoEvento(), xs: number[] = [], ys: number[] = [];
  let v = -0.3 * piano.length;
  for (let k = 0; k < H; k++) {
    azzera(e);
    avanza(c, s.mondo, s.tick + 1 + k, tiene(piano, k), morti, e);
    if (e.colpo) v -= 300;
    if (e.bagno === 2) v -= 500; else if (e.bagno === 1) v -= 120;
    if (e.nemico) v += 14 * e.nemico;
    if (e.bello) v += 6;
    if (c.margine <= 0) return v - 5000 + k;
    xs.push(c.x); ys.push(c.y);
  }
  v += (c.x - s.c.x) * 0.5 + c.margine * 0.6 + (c.terra ? 12 : 0);
  for (const g of vicine) for (let i = 0; i < H; i++) if (prende(xs[i]!, ys[i]!, g)) { v += C.punti[g.k] * (1 - i / (2 * H)); break; }
  return v;
}

/** Il piano in corso per ogni partita: si rifà ogni `ogni` tick o quando succede qualcosa. */
const IN_CORSO = new WeakMap<LavaState, { dal: number; piano: Piano }>();

export function autopilotaLava(s: LavaState): InputFrame {
  if (s.done) return NO;
  let m = IN_CORSO.get(s);
  const u = s.ultimo;
  if (!m || s.tick - m.dal >= C.autopilota.ogni || (s.tick !== m.dal && (u.colpo || u.bagno || u.nemico || u.aggancio || u.scavalco || u.atterra))) {
    const fino = s.c.x + C.corsa.velocitaMax * (H + 2) + 12, vicine: Gemma[] = [];
    for (let i = s.gi; i < s.gemme.length && s.gemme[i]!.x <= fino && vicine.length < 24; i++) if (!s.gemme[i]!.preso) vicine.push(s.gemme[i]!);
    let best = -Infinity, scelto: Piano = [];
    for (const p of PIANI) { const v = valuta(s, p, vicine); if (v > best) { best = v; scelto = p; } }
    m = { dal: s.tick, piano: scelto };
    IN_CORSO.set(s, m);
  }
  return tiene(m.piano, s.tick - m.dal) ? SI : NO;
}
