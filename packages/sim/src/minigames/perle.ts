// Caccia alle perle (GDD §3 minigiochi universali, §6): dalla barca ferma su acqua bassa ti tuffi. Vista di profilo del fondale: la
// corrente porta il sub verso destra a velocità costante, TIENI PREMUTO = nuota giù, LASCIA = sale (stile «Flappy» morbido, un dito).
// Prendi perle (bianche, conchiglie, rosa nelle ostriche che si aprono e chiudono, nere in fondo ai crepacci), eviti meduse e granchi,
// l'aria cala sott'acqua e si ricarica a galla o con le bolle. Senz'aria risali da solo e perdi tempo. Finisce quando scade il tempo.
// Fondale, perle, pericoli, alghe e coralli nascono dal seed. Solo + − × ÷ (niente trigonometria: stessi numeri nel browser e nel
// Worker). Numeri in content (minigames/perle.json). Unità = pixel della schermata: y = 0 il pelo dell'acqua, cresce verso il fondo.
import { MINIGAMES_CFG } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Archipelago } from '../world/archipelago.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const C = MINIGAMES_CFG.perle;
const MAX_TICKS = Math.round(C.maxSeconds * TICK_HZ);
/** x del sub al tick 0 (px): poi `x = PERLE_X0 + velocita × tick`. */
export const PERLE_X0 = 40;
/** Fin dove arriva il sub (contenuti), e fin dove si disegna il fondale (un po' di schermo oltre). */
const FINE = PERLE_X0 + C.velocita * MAX_TICKS;
export const PERLE_LUNGHEZZA = Math.ceil(FINE + 320);
const PASSO = C.fondale.passo;
const DRAIN = 1 / (C.aria.secondi * TICK_HZ);
const REFILL = 1 / (C.aria.ricaricaSecondi * TICK_HZ);
const INV = Math.round(C.colpo.invulnerabileSecondi * TICK_HZ);
const OST_PER = Math.round(C.ostrica.periodoSecondi * TICK_HZ);
const OST_OPEN = Math.round(C.ostrica.apertaSecondi * TICK_HZ);
/** Mezza altezza del sub (non entra nel fondale) e distanza entro cui è «a galla» (respira). */
const MEZZO = 4, GALLA = 1;
/** Mezzi lati delle prese: perle e bolle, pericoli. */
const PRESA = 7, URTO_X = 8, URTO_Y = 6;

export type PerlaKind = 'bianca' | 'conchiglia' | 'rosa' | 'nera' | 'bolla';
/** Una cosa da prendere: `fase` sfasa l'ostrica (solo rosa: la perla si prende quando è aperta). */
export type PerleItem = { k: PerlaKind; x: number; y: number; preso: boolean; fase: number };
/** medusa: x fisso, y = y + amp × onda(t). granchio: y sul fondale, x = x + amp × onda(t) (pattuglia). Onda triangolare in [−1, 1]. */
export type PerlePericolo = { k: 'medusa' | 'granchio'; x: number; y: number; amp: number; per: number; fase: number };
/** Solo estetica (ma dal seed): alga alta `h`, corallo, roccia; `v` = variante di colore/forma. */
export type PerleDecor = { k: 'alga' | 'corallo' | 'roccia'; x: number; h: number; v: number };
export type PerleState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  x: number;
  y: number;
  vy: number;
  /** Stava nuotando giù in questo tick (dopo l'affanno: sempre false). */
  hold: boolean;
  aria: number;
  /** Senz'aria: risale da solo finché non arriva a galla. */
  affanno: boolean;
  /** Tick di invulnerabilità dopo un colpo. */
  inv: number;
  punti: number;
  /** Punti di tutto il fondale (le medaglie sono frazioni di questo). */
  totale: number;
  prese: Record<PerlaKind, number>;
  colpi: number;
  affanni: number;
  /** Profondità del fondale ogni `fondale.passo` px. */
  fondo: number[];
  items: PerleItem[];
  pericoli: PerlePericolo[];
  decor: PerleDecor[];
  done: boolean;
};
export type PerleView = {
  x: number; y: number; vy: number; hold: boolean; aria: number; affanno: boolean; inv: number;
  tick: number; ms: number; maxMs: number; punti: number; totale: number; prese: Record<PerlaKind, number>; colpi: number; affanni: number;
  /** Soglie delle medaglie in punti. */
  medals: { oro: number; argento: number; bronzo: number };
  fondo: readonly number[]; passo: number; lunghezza: number;
  items: readonly PerleItem[];
  /** Pericoli dove sono adesso (`dir` = verso in cui si muovono: −1 / 1). */
  pericoli: { k: 'medusa' | 'granchio'; x: number; y: number; dir: number }[];
  decor: readonly PerleDecor[];
  done: boolean;
};

/** Onda triangolare in [−1, 1] di periodo `per` tick (interi: esatta ovunque). */
function onda(t: number, per: number, fase: number): number {
  const p = ((t + fase) % per) / per;
  return Math.abs(2 * p - 1) * 2 - 1;
}
/** Profondità del fondale in x (interpolazione lineare tra i punti). */
export function fondoAt(fondo: readonly number[], x: number): number {
  const f = x / PASSO;
  const i = Math.max(0, Math.min(fondo.length - 2, Math.floor(f)));
  const t = Math.max(0, Math.min(1, f - i));
  return fondo[i]! * (1 - t) + fondo[i + 1]! * t;
}
/** L'ostrica (perla rosa) è aperta al tick t? */
export function ostricaAperta(it: PerleItem, t: number): boolean {
  return (t + it.fase) % OST_PER < OST_OPEN;
}
/** Dove sta un pericolo al tick t. */
export function pericoloAt(h: PerlePericolo, fondo: readonly number[], t: number): { x: number; y: number } {
  if (h.k === 'medusa') return { x: h.x, y: h.y + h.amp * onda(t, h.per, h.fase) };
  const x = h.x + h.amp * onda(t, h.per, h.fase);
  return { x, y: fondoAt(fondo, x) - 3 };
}
const valore = (k: PerlaKind): number => (k === 'bolla' ? 0 : C.punti[k]);

// ---------------- dove ci si tuffa (regola del «posto mobile», usata dal client) ----------------
export type PerleQui = { ok: boolean; perche: 'acqua' | 'molo' | 'veloce' | null };
/** Ci si può tuffare qui? In barca quasi ferma, su acqua bassa ',', senza moli entro `posto.moloM` (lì A fa scendere a terra). */
export function perleQui(arch: Archipelago, x: number, z: number, speed: number): PerleQui {
  const m = arch.map, tile = arch.tile, cx = Math.floor(x / tile), cz = Math.floor(z / tile);
  if (m.at(cx, cz) !== ',') return { ok: false, perche: 'acqua' };
  const r = Math.ceil(C.posto.moloM / tile);
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      const t = m.at(cx + dx, cz + dz);
      if (t !== 'd' && t !== 'B') continue;
      if (Math.hypot((cx + dx + 0.5) * tile - x, (cz + dz + 0.5) * tile - z) <= C.posto.moloM) return { ok: false, perche: 'molo' };
    }
  if (Math.abs(speed) > C.posto.fermoMs) return { ok: false, perche: 'veloce' };
  return { ok: true, perche: null };
}
/** Il punto da tuffo più vicino a (x, z), al centro di una cella (per i test e per la guida). */
export function cercaPerle(arch: Archipelago, x: number, z: number): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null, bestD = Infinity;
  const m = arch.map, tile = arch.tile;
  for (let cz = 0; cz < m.h; cz++)
    for (let cx = 0; cx < m.w; cx++) {
      if (m.at(cx, cz) !== ',') continue;
      const px = (cx + 0.5) * tile, pz = (cz + 0.5) * tile, d = Math.hypot(px - x, pz - z);
      if (d < bestD && perleQui(arch, px, pz, 0).ok) { best = { x: px, z: pz }; bestD = d; }
    }
  return best;
}

// ---------------- generazione dal seed ----------------
type Pattern = 'arco' | 'scia' | 'conchiglie' | 'ostrica' | 'bolle' | 'nera';
const MAZZO: Pattern[] = ['nera', 'nera', 'nera', 'ostrica', 'ostrica', 'ostrica', 'ostrica', 'bolle', 'bolle', 'bolle', 'bolle', 'conchiglie', 'conchiglie', 'conchiglie', 'conchiglie', 'arco', 'arco', 'arco', 'arco', 'scia', 'scia', 'scia'];
const LARGO: Record<Pattern, number> = { arco: 120, scia: 120, conchiglie: 110, ostrica: 130, bolle: 110, nera: 150 };

function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); const t = a[i]!; a[i] = a[j]!; a[j] = t; }
  return a;
}

function genera(seed: number, difficulty: Difficulty): Pick<PerleState, 'fondo' | 'items' | 'pericoli' | 'decor' | 'totale'> {
  const rng = createRng(seed).fork('perle');
  const F = C.fondale, mult = C.pericoli[difficulty - 1]!;
  const n = Math.ceil(PERLE_LUNGHEZZA / PASSO) + 2;
  // fondale: passeggiata casuale lenta tra min+10 e max−12, poi i motivi lo scavano o lo alzano
  const fondo: number[] = [];
  let d = (F.min + F.max) / 2, dv = 0;
  for (let i = 0; i < n; i++) {
    dv = Math.max(-3, Math.min(3, dv + rng.int(-2, 2)));
    d = Math.max(F.min + 10, Math.min(F.max - 12, d + dv));
    if (d === F.min + 10 || d === F.max - 12) dv = -dv;
    fondo.push(d);
  }
  const idx = (x: number) => Math.round(x / PASSO);
  /** Fondale a profondità `y` tra x0 e x1 (con un punto di raccordo per lato). */
  const piano = (x0: number, x1: number, y: number) => { for (let i = idx(x0); i <= idx(x1); i++) if (i >= 0 && i < n) fondo[i] = y; };
  const items: PerleItem[] = [], pericoli: PerlePericolo[] = [];
  const add = (k: PerlaKind, x: number, y: number, fase = 0) => items.push({ k, x, y, preso: false, fase });
  const medusa = (x: number, y: number, chance: number) => {
    if (rng.next() < chance * mult) pericoli.push({ k: 'medusa', x, y, amp: rng.int(10, 18), per: rng.int(150, 230), fase: rng.int(0, 229) });
  };

  let mazzo: Pattern[] = [];
  let x = 170, primo = 0;
  while (x + 100 < FINE - 40) {
    let p: Pattern;
    if (primo === 0) p = 'arco'; else if (primo === 1) p = 'scia';
    else { if (!mazzo.length) mazzo = shuffle([...MAZZO], rng); p = mazzo.pop()!; }
    primo++;
    const w = LARGO[p];
    switch (p) {
      case 'arco': {
        const top = rng.int(14, 28), dip = rng.int(24, 44);
        for (let i = 0; i < 5; i++) add('bianca', x + 18 + i * 20, top + dip * (1 - ((i - 2) * (i - 2)) / 4));
        if (primo > 3) medusa(x + 58, top + dip + 22, 0.3);
        break;
      }
      case 'scia': {
        const y1 = fondoAt(fondo, x + 96) - 6;
        for (let i = 0; i < 4; i++) add('bianca', x + 14 + i * 20, 18 + ((y1 - 30) * i) / 4);
        add('conchiglia', x + 96, fondoAt(fondo, x + 96) - 3);
        break;
      }
      case 'conchiglie': {
        const y = Math.min(F.max - 14, fondoAt(fondo, x + 55));
        piano(x + 16, x + 94, y);
        add('conchiglia', x + 28, y - 3); add('conchiglia', x + 82, y - 3);
        medusa(x + 55, y - 34, 0.85);
        break;
      }
      case 'ostrica': {
        const y = rng.int(F.min + 14, F.max - 16);
        piano(x + 24, x + 112, y);
        // l'ostrica si apre quando il sub sta arrivando (≈ 40 px prima) e si richiude poco dopo: tempismo, non fortuna
        const passa = Math.round((x + 68 - PERLE_X0) / C.velocita) - 50;
        add('rosa', x + 68, y - 3, (((OST_PER - (passa % OST_PER)) % OST_PER) + OST_PER) % OST_PER);
        // il granchio pattuglia accanto all'ostrica (mai sopra): arriva a 12 px dalla perla
        const lato = rng.next() < 0.5 ? -1 : 1;
        pericoli.push({ k: 'granchio', x: x + 68 + lato * 34, y, amp: 22, per: rng.int(240, 320), fase: rng.int(0, 319) });
        add('bianca', x + 20, y - 40); add('bianca', x + 116, y - 40);
        break;
      }
      case 'bolle': {
        const y = Math.min(F.max - 10, fondoAt(fondo, x + 55) + 6);
        piano(x + 10, x + 100, y);
        add('bolla', x + 46, y - 38);
        for (let i = 0; i < 3; i++) add('bianca', x + 22 + i * 30, y - 12);
        add('bolla', x + 92, y - 28);
        medusa(x + 60, 26, 0.3);
        break;
      }
      case 'nera': {
        // crepaccio: bordi alti (scogli), fondo giù a fondale.max, la perla nera sul fondo, due meduse di guardia
        const alto = rng.int(F.min - 6, F.min + 6);
        piano(x + 10, x + 34, alto); piano(x + 118, x + 140, alto);
        piano(x + 52, x + 100, F.max);
        add('nera', x + 76, F.max - 4);
        add('bianca', x + 76, 34);
        medusa(x + 42, 46, 0.85); medusa(x + 112, 58, 0.85);
        break;
      }
    }
    x += w;
  }
  // alghe, coralli e rocce dove il fondale lo permette (si disegnano dietro, non toccano il gioco)
  const decor: PerleDecor[] = [];
  for (let dx = 8; dx < PERLE_LUNGHEZZA; dx += rng.int(6, 16)) {
    const r = rng.next();
    if (r < 0.42) decor.push({ k: 'alga', x: dx, h: rng.int(8, 26), v: rng.int(0, 2) });
    else if (r < 0.7) decor.push({ k: 'corallo', x: dx, h: rng.int(5, 11), v: rng.int(0, 3) });
    else if (r < 0.86) decor.push({ k: 'roccia', x: dx, h: rng.int(3, 7), v: rng.int(0, 1) });
  }
  items.sort((a, b) => a.x - b.x);
  const totale = items.reduce((t, it) => t + valore(it.k), 0);
  return { fondo, items, pericoli, decor, totale };
}

// ---------------- fisica (la stessa per step e per l'autopilota) ----------------
type Corpo = { y: number; vy: number; aria: number; affanno: boolean };
/** Un tick del sub in x (già avanzato): spinta, fondale, superficie, aria. Restituisce true se l'aria è appena finita. */
function muovi(c: Corpo, giu: boolean, fondo: readonly number[], x: number): boolean {
  const F = C.fisica;
  c.vy = (c.vy + (giu && !c.affanno ? F.giu : -F.su)) * F.attrito;
  c.vy = Math.max(-F.maxSu, Math.min(F.maxGiu, c.vy));
  c.y += c.vy;
  const fy = fondoAt(fondo, x) - MEZZO;
  if (c.y > fy) { c.y = fy; if (c.vy > 0) c.vy = 0; }
  if (c.y < 0) { c.y = 0; if (c.vy < 0) c.vy = 0; }
  if (c.y <= GALLA) { c.aria = Math.min(1, c.aria + REFILL); c.affanno = false; return false; }
  c.aria -= DRAIN;
  if (c.aria <= 0) { c.aria = 0; if (!c.affanno) { c.affanno = true; return true; } }
  return false;
}
const tocca = (ax: number, ay: number, bx: number, by: number, rx: number, ry: number) => Math.abs(ax - bx) < rx && Math.abs(ay - by) < ry;

/** Soglie delle medaglie in punti (frazioni dei punti di tutto il fondale, arrotondate in su). */
function soglie(totale: number): { oro: number; argento: number; bronzo: number } {
  const m = C.medaglie, q = (f: number) => Math.max(1, Math.ceil(totale * f - 1e-9));
  return { oro: q(m.oro), argento: q(m.argento), bronzo: q(m.bronzo) };
}
function medalOf(s: PerleState): Medal {
  const m = soglie(s.totale), p = s.punti;
  return p >= m.oro ? 'oro' : p >= m.argento ? 'argento' : p >= m.bronzo ? 'bronzo' : null;
}
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const SI: InputFrame = { mx: 0, my: 0, a: true, b: false };

// ---------------- autopilota: prova qualche «piano» (giù per d tick, poi su; su e poi giù; giù, su, giù) e sceglie il migliore ----------------
const H = C.autopilota.orizzonte;
const PIANI: ((k: number) => boolean)[] = [];
for (const d of [0, 3, 6, 10, 14, 20, 28, 36, 48, 64, 84, H]) PIANI.push((k) => k < d);
for (const r of [6, 14, 24, 36, 50, 70]) for (const d of [10, 22, 40]) PIANI.push((k) => k >= r && k < r + d);
for (const d1 of [8, 20, 34]) for (const r of [12, 28]) for (const d2 of [14, 30]) PIANI.push((k) => k < d1 || (k >= d1 + r && k < d1 + r + d2));

type Previsione = { vicini: PerleItem[]; rischi: { x: number; y: number }[][]; oltre: PerleItem[] };
function valuta(s: PerleState, piano: (k: number) => boolean, pr: Previsione): number {
  const c: Corpo = { y: s.y, vy: s.vy, aria: s.aria, affanno: s.affanno };
  const { vicini, rischi, oltre } = pr;
  let inv = s.inv, v = 0, x = s.x, presi = 0;
  for (let k = 0; k < H; k++) {
    const t = s.tick + 1 + k;
    x = PERLE_X0 + C.velocita * t;
    if (muovi(c, piano(k), s.fondo, x)) v -= 400;
    if (inv > 0) inv--;
    const peso = 1 - k / (H * 3);
    for (let i = 0; i < vicini.length; i++) {
      const it = vicini[i]!;
      if (presi & (1 << i) || !tocca(x, c.y, it.x, it.y, PRESA, PRESA)) continue;
      if (it.k === 'rosa' && !ostricaAperta(it, t)) continue;
      presi |= 1 << i;
      if (it.k === 'bolla') { v += c.aria < 0.7 ? 40 : 2; c.aria = Math.min(1, c.aria + C.aria.bolla); }
      else v += valore(it.k) * peso;
    }
    if (inv === 0) for (const r of rischi) {
      const p = r[k]!;
      if (tocca(x, c.y, p.x, p.y, URTO_X + 2, URTO_Y + 2)) { v -= 80; inv = INV; c.vy = -C.colpo.spinta; c.aria = Math.max(0, c.aria - C.aria.colpo); break; }
    }
  }
  // a fine piano deve avere l'aria per tornare su
  const serve = (c.y / C.fisica.maxSu + 20) * DRAIN + 0.06;
  if (!c.affanno && c.y > GALLA && c.aria < serve) v -= 300;
  // le prossime perle oltre l'orizzonte: valgono (un po') se da qui ci si arriva in tempo
  for (let i = 0; i < oltre.length; i++) {
    const it = oltre[i]!, ticks = (it.x - x) / C.velocita, dy = Math.abs(it.y - c.y);
    if (dy <= ticks * 1.1 + 6) v += valore(it.k) * 0.3;
    if (i === 0) v -= dy * 0.05;
  }
  return v + c.aria * 8;
}

export function autopilotaPerle(s: PerleState): InputFrame {
  if (s.done) return NO;
  const x0 = s.x - PRESA, x1 = s.x + C.velocita * (H + 2) + PRESA;
  const vicini = s.items.filter((it) => !it.preso && it.x >= x0 && it.x <= x1).slice(0, 30);
  const oltre = s.items.filter((it) => !it.preso && it.k !== 'bolla' && it.x > x1).slice(0, 3);
  const rischi = s.pericoli.filter((h) => h.x + h.amp + 12 >= x0 && h.x - h.amp - 12 <= x1)
    .map((h) => Array.from({ length: H }, (_, k) => pericoloAt(h, s.fondo, s.tick + 1 + k)));
  const pr: Previsione = { vicini, rischi, oltre };
  let best = -Infinity, scelta = false;
  for (const p of PIANI) {
    const v = valuta(s, p, pr);
    if (v > best) { best = v; scelta = p(0); }
  }
  return scelta ? SI : NO;
}

export const perle: MinigameModule<PerleState> = {
  id: 'perle',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const g = genera(seed >>> 0, difficulty);
    return {
      seed: seed >>> 0, difficulty, tick: 0, x: PERLE_X0, y: 0, vy: 0, hold: false, aria: 1, affanno: false, inv: 0, punti: 0,
      prese: { bianca: 0, conchiglia: 0, rosa: 0, nera: 0, bolla: 0 }, colpi: 0, affanni: 0, done: false, ...g,
    };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    s.x = PERLE_X0 + C.velocita * s.tick;
    s.hold = !!input.a && !s.affanno;
    const c: Corpo = { y: s.y, vy: s.vy, aria: s.aria, affanno: s.affanno };
    if (muovi(c, s.hold, s.fondo, s.x)) s.affanni++;
    s.y = c.y; s.vy = c.vy; s.aria = c.aria; s.affanno = c.affanno;
    if (s.inv > 0) s.inv--;
    for (const it of s.items) {
      if (it.preso || it.x < s.x - PRESA) continue;
      if (it.x > s.x + PRESA) break; // ordinati per x
      if (!tocca(s.x, s.y, it.x, it.y, PRESA, PRESA) || (it.k === 'rosa' && !ostricaAperta(it, s.tick))) continue;
      it.preso = true; s.prese[it.k]++;
      if (it.k === 'bolla') s.aria = Math.min(1, s.aria + C.aria.bolla);
      else s.punti += valore(it.k);
    }
    if (s.inv === 0) for (const h of s.pericoli) {
      if (Math.abs(h.x - s.x) > h.amp + URTO_X + 2) continue;
      const p = pericoloAt(h, s.fondo, s.tick);
      if (!tocca(s.x, s.y, p.x, p.y, URTO_X, URTO_Y)) continue;
      s.colpi++; s.inv = INV; s.vy = -C.colpo.spinta; s.aria = Math.max(0, s.aria - C.aria.colpo);
      break;
    }
    if (s.tick >= MAX_TICKS) s.done = true;
  },
  /** score = punti; medaglia = frazione dei punti di tutto il fondale (medaglie in content). */
  result(s): MinigameResult {
    return {
      done: s.done, score: s.punti, medal: medalOf(s),
      detail: {
        punti: s.punti, totale: s.totale, perle: s.prese.bianca + s.prese.rosa + s.prese.nera + s.prese.conchiglia,
        bianche: s.prese.bianca, conchiglie: s.prese.conchiglia, rosa: s.prese.rosa, nere: s.prese.nera, bolle: s.prese.bolla,
        colpi: s.colpi, affanni: s.affanni, ms: Math.round((s.tick / TICK_HZ) * 1000),
      },
    };
  },
  /** Diario del capitano (#87): perle e conchiglie prese, per tipo (le bolle non sono un tesoro). */
  raccolta(s): Record<string, number> {
    return { bianca: s.prese.bianca, conchiglia: s.prese.conchiglia, rosa: s.prese.rosa, nera: s.prese.nera };
  },
  /** Pilota di riferimento (deve fare oro): a ogni tick prova i piani e tiene premuto se il migliore comincia giù. */
  autopilot(s): InputFrame { return autopilotaPerle(s); },
  view(s): PerleView {
    return {
      x: s.x, y: s.y, vy: s.vy, hold: s.hold, aria: s.aria, affanno: s.affanno, inv: s.inv,
      tick: s.tick, ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: C.maxSeconds * 1000, punti: s.punti, totale: s.totale,
      prese: s.prese, colpi: s.colpi, affanni: s.affanni,
      medals: soglie(s.totale),
      fondo: s.fondo, passo: PASSO, lunghezza: PERLE_LUNGHEZZA, items: s.items,
      pericoli: s.pericoli.map((h) => {
        const p = pericoloAt(h, s.fondo, s.tick), q = pericoloAt(h, s.fondo, s.tick + 1);
        return { k: h.k, x: p.x, y: p.y, dir: h.k === 'medusa' ? (q.y >= p.y ? 1 : -1) : q.x >= p.x ? 1 : -1 };
      }),
      decor: s.decor, done: s.done,
    };
  },
};
