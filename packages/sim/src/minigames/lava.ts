// Fuga dalla lava (Isola Vulcano, GDD §3 e §6): corsa a scorrimento laterale sulle colonne di basalto sopra un mare di lava.
// Vista di profilo: corri da solo verso destra a velocità costante; TOCCA = salto, TIENI PREMUTO = salto più lungo e più alto (un dito).
// Le rocce crepate affondano poco dopo che ci metti piede, i geyser di lava eruttano a tempo (bollono prima: si vede quando arrivano).
// Prendi frammenti di ossidiana, scintille (in alto: salto lungo) e rubini. Toccare la lava o un geyser scotta: qualche punto in meno e
// un rimbalzo in su (non si muore mai), e per un secondo non raccogli niente. Percorso, rocce, geyser e premi nascono dal seed. Solo + − × ÷ (niente trigonometria).
// Numeri in content (minigames/lava.json). Unità = pixel della schermata 192×136 (y cresce verso il basso), per tick.
import { MINIGAMES_CFG } from '@marea/content';
import type { LavaCosa } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const C = MINIGAMES_CFG.lava;
const F = C.fisica;
const MAX_TICKS = Math.round(C.maxSeconds * TICK_HZ);
/** x del corridore al tick 0 (px): poi `x = LAVA_X0 + velocita × tick`. */
export const LAVA_X0 = 40;
const FINE = LAVA_X0 + C.velocita * MAX_TICKS;
/** Fin dove arriva il percorso (contenuti) più un po' di schermo oltre. */
export const LAVA_LUNGHEZZA = Math.ceil(FINE + 320);
export const LAVA_Y = C.scena.lava;
const RIT = Math.round(C.affonda.ritardoSecondi * TICK_HZ);
const INV = Math.round(C.scottatura.invulnerabileSecondi * TICK_HZ);
const ATT = Math.round(C.geyser.attivoSecondi * TICK_HZ);
const AVV = Math.round(C.geyser.avvisoSecondi * TICK_HZ);
/** Mezza larghezza dei piedi, altezza del corridore, mezza larghezza di un geyser, salita/discesa del getto (tick). */
const PIEDE = 3, ALTO = 12, GEY = 4, RAMPA = 6;
/** Presa dei premi: distanza dal centro del corpo. */
const PRESA_X = 7, PRESA_Y = 9;

export type LavaColonna = { x0: number; x1: number; top: number; k: 'basalto' | 'affonda' };
/** Geyser in x: erutta da `base` (la lava o la cima di una colonna) fino a `alto` px più su quando (t + fase) % per < attivo. */
export type LavaGeyser = { x: number; base: number; alto: number; per: number; fase: number };
export type LavaItem = { k: LavaCosa; x: number; y: number; preso: boolean };
export type LavaState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  x: number;
  /** y dei piedi. */
  y: number;
  vy: number;
  /** Colonna sotto i piedi (−1 = in aria). */
  terra: number;
  coyote: number;
  /** Tick dall'ultimo tocco (salto «prenotato» poco prima di atterrare). */
  anticipo: number;
  /** Tick di salto lungo che restano finché tieni premuto. */
  tenuto: number;
  prevA: boolean;
  inv: number;
  punti: number;
  totale: number;
  prese: Record<LavaCosa, number>;
  scottature: number;
  salti: number;
  colonne: LavaColonna[];
  /** Tick del primo passo su ogni colonna (−1 = mai toccata): le rocce crepate affondano da lì. */
  tocchi: number[];
  geyser: LavaGeyser[];
  items: LavaItem[];
  /** Eventi dell'ultimo tick (suoni ed effetti del client). */
  ultimo: { salto: boolean; scotta: boolean; presi: LavaCosa[]; atterra: boolean };
  done: boolean;
};
export type LavaView = {
  x: number; y: number; vy: number; terra: boolean; inv: number; tick: number; ms: number; maxMs: number;
  punti: number; totale: number; prese: Record<LavaCosa, number>; scottature: number; salti: number;
  medals: { oro: number; argento: number; bronzo: number };
  done: boolean;
};

/** Cima della colonna i al tick t (le crepate scendono dopo il primo passo). */
export function cimaAt(c: LavaColonna, tocco: number, t: number): number {
  return c.k === 'affonda' && tocco >= 0 ? c.top + Math.max(0, t - tocco - RIT) * C.affonda.velocita : c.top;
}
/** Indice della colonna sotto x (con la larghezza dei piedi), −1 = lava. Colonne ordinate e separate. */
export function colonnaSotto(cols: readonly LavaColonna[], x: number): number {
  let lo = 0, hi = cols.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1, c = cols[m]!;
    if (x + PIEDE < c.x0) hi = m - 1; else if (x - PIEDE > c.x1) lo = m + 1; else return m;
  }
  return -1;
}
/** Altezza del getto del geyser al tick t (0 = spento; sale e scende in RAMPA tick). */
export function getto(g: LavaGeyser, t: number): number {
  const k = (t + g.fase) % g.per;
  return k >= ATT ? 0 : (g.alto * Math.min(RAMPA, k + 1, ATT - k)) / RAMPA;
}
/** Il geyser bolle (sta per eruttare) al tick t. */
export function geyserAvvisa(g: LavaGeyser, t: number): boolean {
  const k = (t + g.fase) % g.per;
  return k >= g.per - AVV;
}

// ---------------- fisica (la stessa per step e per l'autopilota) ----------------
type Corpo = { y: number; vy: number; terra: number; coyote: number; anticipo: number; tenuto: number; prevA: boolean; inv: number };
type Evento = { salto: boolean; scotta: 0 | 1 | 2; atterra: boolean };
/** Un tick del corridore in x (già avanzato al tick t). scotta: 1 = scottatura vera, 2 = rimbalzo mentre è ancora invulnerabile. */
function muovi(c: Corpo, a: boolean, t: number, x: number, cols: readonly LavaColonna[], tocchi: number[], gs: readonly LavaGeyser[]): Evento {
  const ev: Evento = { salto: false, scotta: 0, atterra: false };
  const press = a && !c.prevA; c.prevA = a;
  c.anticipo = press ? 0 : Math.min(99, c.anticipo + 1);
  if (c.inv > 0) c.inv--;
  if ((c.terra >= 0 || c.coyote > 0) && c.anticipo <= F.anticipo) {
    c.vy = -F.salto; c.tenuto = F.tenutoMax; c.terra = -1; c.coyote = 0; c.anticipo = 99; ev.salto = true;
  }
  let brucia = false;
  if (c.terra < 0) {
    const lungo = a && c.tenuto > 0 && c.vy < 0;
    c.tenuto = lungo ? c.tenuto - 1 : 0;
    c.vy = Math.min(F.cadutaMax, c.vy + (lungo ? F.gravitaTenuto : F.gravita));
    const prima = c.y; c.y += c.vy;
    if (c.coyote > 0) c.coyote--;
    const i = colonnaSotto(cols, x);
    if (i >= 0) {
      const top = cimaAt(cols[i]!, tocchi[i]!, t);
      if (c.vy >= 0 && prima <= top + 0.5 && c.y >= top) {
        c.y = top; c.vy = 0; c.terra = i; ev.atterra = true;
        if (tocchi[i]! < 0) tocchi[i] = t;
      } else if (c.y > top + F.gradino && prima > top + 0.5) brucia = true; // contro il fianco rovente della colonna
    }
  } else {
    const i = colonnaSotto(cols, x);
    if (i < 0) { c.terra = -1; c.coyote = F.coyote; c.vy = 0; } // finita la roccia: giù (ma per un attimo si salta ancora)
    else {
      const top = cimaAt(cols[i]!, tocchi[i]!, t);
      if (top < c.y - F.gradino) brucia = true; // gradino troppo alto: sbatti contro la roccia
      else if (top > c.y + 3) { c.terra = -1; c.coyote = F.coyote; c.vy = 0; } // gradino in giù: cadi un po'
      else { c.y = top; c.terra = i; if (tocchi[i]! < 0) tocchi[i] = t; }
    }
  }
  if (c.y >= LAVA_Y - 1) { c.y = LAVA_Y - 1; brucia = true; }
  for (const g of gs) {
    if (Math.abs(g.x - x) > GEY + PIEDE) continue;
    const h = getto(g, t);
    if (h > 0 && c.y > g.base - h && c.y - ALTO < g.base) brucia = true;
  }
  if (brucia) {
    ev.scotta = c.inv > 0 ? 2 : 1;
    if (c.inv === 0) c.inv = INV;
    c.vy = -C.scottatura.rimbalzo; c.terra = -1; c.tenuto = 0; c.coyote = 0;
  }
  return ev;
}
const prende = (x: number, y: number, it: LavaItem) => Math.abs(it.x - x) < PRESA_X && Math.abs(it.y - (y - ALTO / 2)) < PRESA_Y;

// ---------------- generazione dal seed ----------------
type Pattern = 'salto' | 'lungo' | 'scalini' | 'affonda' | 'isolotti' | 'geyser' | 'sfiato' | 'alto';
const MAZZO: Pattern[] = ['salto', 'salto', 'lungo', 'lungo', 'scalini', 'scalini', 'affonda', 'affonda', 'isolotti', 'isolotti', 'geyser', 'geyser', 'sfiato', 'alto', 'alto'];

function genera(seed: number, difficulty: Difficulty): Pick<LavaState, 'colonne' | 'geyser' | 'items' | 'totale'> {
  const rng = createRng(seed).fork('lava');
  const S = C.scena, mb = C.difficolta.buchi[difficulty - 1]!, mg = C.difficolta.geyser[difficulty - 1]!;
  const [p0, p1] = C.geyser.periodoSecondi.map((v) => Math.round(v * TICK_HZ)) as [number, number];
  const colonne: LavaColonna[] = [], geyser: LavaGeyser[] = [], items: LavaItem[] = [];
  const clamp = (y: number) => Math.max(S.alto, Math.min(S.basso, y));
  let x = 0, top = 92;
  const buco = (a: number, b: number) => { x += Math.round(rng.int(a, b) * mb); };
  const col = (w: number, t: number, k: LavaColonna['k'] = 'basalto') => { top = clamp(t); colonne.push({ x0: x, x1: x + w, top, k }); x += w; };
  const add = (k: LavaCosa, ix: number, iy: number) => items.push({ k, x: Math.round(ix), y: Math.round(iy), preso: false });
  const gey = (gx: number, base: number, alto: number) => geyser.push({ x: Math.round(gx), base, alto, per: rng.int(p0, p1), fase: rng.int(0, p1) });
  /** Arco di `n` premi sopra un buco da a a b: in alto `su` px sopra la cima più alta dei due lati. */
  const arco = (k: LavaCosa, a: number, b: number, yTop: number, n: number, su: number) => {
    for (let i = 0; i < n; i++) { const u = n === 1 ? 0.5 : i / (n - 1); add(k, a + (b - a) * u, yTop - su + su * 0.45 * (2 * u - 1) * (2 * u - 1)); }
  };
  col(150, 92);
  for (let i = 0; i < 4; i++) add('ossidiana', 96 + i * 14, 84);
  let mazzo: Pattern[] = [], n = 0;
  while (x < FINE + 40) {
    let p: Pattern;
    if (n === 0) p = 'salto'; else if (n === 1) p = 'lungo';
    else {
      if (!mazzo.length) { mazzo = [...MAZZO]; for (let i = mazzo.length - 1; i > 0; i--) { const j = rng.int(0, i); const t = mazzo[i]!; mazzo[i] = mazzo[j]!; mazzo[j] = t; } }
      p = mazzo.pop()!;
      if ((p === 'geyser' || p === 'sfiato') && rng.next() > mg) p = p === 'geyser' ? 'lungo' : 'alto';
    }
    n++;
    const t0 = top;
    switch (p) {
      case 'salto': {
        const a = x; buco(16, 24); const b = x;
        col(rng.int(46, 70), t0 + rng.int(-12, 8));
        arco('ossidiana', a + 2, b - 2, Math.min(t0, top), 3, 24);
        add('ossidiana', b + 20, top - 8);
        break;
      }
      case 'lungo': {
        const a = x; buco(28, 34); const b = x;
        col(rng.int(50, 70), t0 + rng.int(-6, 10));
        arco('ossidiana', a, b, Math.min(t0, top), 4, 36);
        if (rng.next() < 0.5) add('scintilla', (a + b) / 2, Math.min(t0, top) - 48);
        break;
      }
      case 'scalini': {
        const dir = t0 > (S.alto + S.basso) / 2 ? -1 : 1;
        for (let i = 0; i < 3; i++) { buco(12, 16); col(rng.int(24, 32), top + dir * rng.int(9, 13)); add('ossidiana', x - 12, top - 9); }
        break;
      }
      case 'affonda': {
        buco(16, 22);
        const a = x; col(rng.int(70, 88), t0 + rng.int(-10, 6), 'affonda'); const b = x;
        add('ossidiana', a + 16, top - 9); add('ossidiana', a + (b - a) * 0.55, top - 24); add('scintilla', a + (b - a) * 0.55, top - 46);
        break;
      }
      case 'isolotti': {
        const k = rng.int(3, 4);
        for (let i = 0; i < k; i++) { buco(14, 19); col(rng.int(14, 18), t0 + rng.int(-8, 8), 'affonda'); add('ossidiana', x - 8, top - 10); }
        if (rng.next() < 0.5) add('rubino', x - 8, top - 34);
        break;
      }
      case 'geyser': {
        const a = x; buco(26, 32); const b = x;
        col(rng.int(50, 70), t0 + rng.int(-6, 6));
        gey((a + b) / 2, LAVA_Y, C.geyser.alto);
        add('scintilla', (a + b) / 2, Math.min(t0, top) - 40);
        add('ossidiana', a + 4, Math.min(t0, top) - 20); add('ossidiana', b - 4, Math.min(t0, top) - 20);
        break;
      }
      case 'sfiato': {
        buco(16, 20);
        const a = x; col(rng.int(84, 100), t0 + rng.int(-8, 8)); const b = x;
        const gx = (a + b) / 2;
        gey(gx, top, 36);
        add('ossidiana', a + 14, top - 8); add('ossidiana', b - 14, top - 8);
        add(rng.next() < 0.5 ? 'rubino' : 'scintilla', gx, top - 44);
        break;
      }
      case 'alto': {
        buco(16, 22);
        const a = x; col(rng.int(84, 100), t0 + rng.int(-8, 8)); const b = x;
        add('scintilla', a + (b - a) * 0.3, top - 42); add('scintilla', a + (b - a) * 0.75, top - 42);
        add('ossidiana', a + (b - a) * 0.52, top - 8);
        break;
      }
    }
  }
  buco(18, 22);
  col(Math.max(60, LAVA_LUNGHEZZA - x), top);
  // niente premi oltre il traguardo
  const dentro = items.filter((it) => it.x < FINE - 4).sort((a, b) => a.x - b.x);
  const totale = dentro.reduce((a, it) => a + C.punti[it.k], 0);
  return { colonne, geyser, items: dentro, totale };
}

function soglie(totale: number): { oro: number; argento: number; bronzo: number } {
  const m = C.medaglie, q = (f: number) => Math.max(1, Math.ceil(totale * f - 1e-9));
  return { oro: q(m.oro), argento: q(m.argento), bronzo: q(m.bronzo) };
}
function medalOf(s: LavaState): Medal {
  const m = soglie(s.totale), p = s.punti;
  return p >= m.oro ? 'oro' : p >= m.argento ? 'argento' : p >= m.bronzo ? 'bronzo' : null;
}
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const SI: InputFrame = { mx: 0, my: 0, a: true, b: false };

// ---------------- autopilota: prova qualche «piano» (un salto con la sua durata, due salti, niente) e sceglie il migliore ----------------
const H = C.autopilota.orizzonte;
const PIANI: ((k: number) => boolean)[] = [() => false];
for (const d of [0, 2, 5, 9, 14, 20, 28, 38]) for (const h of [1, 8, 16]) PIANI.push((k) => k >= d && k < d + h);
for (const d1 of [0, 6]) for (const h1 of [1, 16]) for (const g of [28, 44]) for (const h2 of [1, 16]) PIANI.push((k) => (k >= d1 && k < d1 + h1) || (k >= d1 + g && k < d1 + g + h2));

function valuta(s: LavaState, piano: (k: number) => boolean, vicini: LavaItem[], gs: LavaGeyser[]): number {
  const c: Corpo = { y: s.y, vy: s.vy, terra: s.terra, coyote: s.coyote, anticipo: s.anticipo, tenuto: s.tenuto, prevA: s.prevA, inv: s.inv };
  const tocchi = s.tocchi.slice();
  let v = 0, presi = 0, x = s.x;
  for (let k = 0; k < H; k++) {
    const t = s.tick + 1 + k;
    x = LAVA_X0 + C.velocita * t;
    const ev = muovi(c, piano(k), t, x, s.colonne, tocchi, gs);
    if (ev.scotta === 1) v -= 400; else if (ev.scotta === 2) v -= 60;
    const peso = 1 - k / (H * 3);
    if (c.inv === 0) for (let i = 0; i < vicini.length; i++) {
      if (presi & (1 << i)) continue;
      if (!prende(x, c.y, vicini[i]!)) continue;
      presi |= 1 << i; v += C.punti[vicini[i]!.k] * peso;
    }
  }
  // meglio finire con i piedi su una roccia che non affonda, e un po' in alto
  if (c.terra >= 0) v += s.colonne[c.terra]!.k === 'basalto' ? 30 : 10;
  return v - c.y * 0.05;
}

export function autopilotaLava(s: LavaState): InputFrame {
  if (s.done) return NO;
  const x0 = s.x - PRESA_X, x1 = s.x + C.velocita * (H + 2) + PRESA_X;
  const vicini = s.items.filter((it) => !it.preso && it.x >= x0 && it.x <= x1).slice(0, 30);
  const gs = s.geyser.filter((g) => g.x >= x0 - 10 && g.x <= x1 + 10);
  let best = -Infinity, scelta = false;
  for (const p of PIANI) {
    const v = valuta(s, p, vicini, gs);
    if (v > best) { best = v; scelta = p(0); }
  }
  return scelta ? SI : NO;
}

export const lava: MinigameModule<LavaState> = {
  id: 'lava',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const g = genera(seed >>> 0, difficulty);
    return {
      seed: seed >>> 0, difficulty, tick: 0, x: LAVA_X0, y: g.colonne[0]!.top, vy: 0, terra: 0, coyote: 0, anticipo: 99, tenuto: 0, prevA: false, inv: 0,
      punti: 0, prese: { ossidiana: 0, scintilla: 0, rubino: 0 }, scottature: 0, salti: 0, tocchi: g.colonne.map(() => -1),
      ultimo: { salto: false, scotta: false, presi: [], atterra: false }, done: false, ...g,
    };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    s.x = LAVA_X0 + C.velocita * s.tick;
    const c: Corpo = { y: s.y, vy: s.vy, terra: s.terra, coyote: s.coyote, anticipo: s.anticipo, tenuto: s.tenuto, prevA: s.prevA, inv: s.inv };
    const ev = muovi(c, !!input.a, s.tick, s.x, s.colonne, s.tocchi, s.geyser);
    s.y = c.y; s.vy = c.vy; s.terra = c.terra; s.coyote = c.coyote; s.anticipo = c.anticipo; s.tenuto = c.tenuto; s.prevA = c.prevA; s.inv = c.inv;
    const u: LavaState['ultimo'] = { salto: ev.salto, scotta: ev.scotta === 1, presi: [], atterra: ev.atterra };
    s.ultimo = u;
    if (ev.salto) s.salti++;
    if (ev.scotta === 1) { s.scottature++; s.punti = Math.max(0, s.punti - C.scottatura.punti); }
    if (s.inv === 0) for (const it of s.items) { // scottato: per un attimo non si raccoglie niente
      if (it.preso || it.x < s.x - PRESA_X) continue;
      if (it.x > s.x + PRESA_X) break; // ordinati per x
      if (!prende(s.x, s.y, it)) continue;
      it.preso = true; s.prese[it.k]++; s.punti += C.punti[it.k]; u.presi.push(it.k);
    }
    if (s.tick >= MAX_TICKS) s.done = true;
  },
  /** score = punti; medaglia = frazione dei punti di tutto il percorso (medaglie in content). */
  result(s): MinigameResult {
    return {
      done: s.done, score: s.punti, medal: medalOf(s),
      detail: {
        punti: s.punti, totale: s.totale, presi: s.prese.ossidiana + s.prese.scintilla + s.prese.rubino,
        ossidiana: s.prese.ossidiana, scintille: s.prese.scintilla, rubini: s.prese.rubino, scottature: s.scottature, salti: s.salti,
        ms: Math.round((s.tick / TICK_HZ) * 1000),
      },
    };
  },
  /** Pilota di riferimento (deve fare oro): a ogni tick prova i piani e tiene premuto se il migliore comincia premuto. */
  autopilot(s: LavaState, _rng: Rng): InputFrame { return autopilotaLava(s); },
  view(s): LavaView {
    return {
      x: s.x, y: s.y, vy: s.vy, terra: s.terra >= 0, inv: s.inv, tick: s.tick, ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: C.maxSeconds * 1000,
      punti: s.punti, totale: s.totale, prese: s.prese, scottature: s.scottature, salti: s.salti, medals: soglie(s.totale), done: s.done,
    };
  },
};
