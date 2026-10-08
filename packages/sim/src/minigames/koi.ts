// Carpe koi (minigioco dell'Isola Giardino, GDD §6; solo a isola aperta). Lo stagno visto dall'alto dal ponticello rosso: il ciliegio
// lascia cadere petali (e ogni tanto una briciola d'oro) a ritmo; tocchi il cibo e la carpa colorata libera più vicina ci corre e lo
// mangia (punti, combo che fa fiorire il ciliegio). La carpa nera è ingorda: punta il cibo che vede e se arriva prima lo ruba (la combo
// si azzera); la tocchi e scappa via per un po'. Rilassante, un pollice: tocchi il cibo, ogni tanto scacci la nera.
// Ingresso: fronte di salita di `a` = un tocco in (mx, my) ∈ [−1, 1]² sullo stagno (1/32 dopo la quantizzazione, ~2,5 px).
// Tutto dal seed (orari e posti del cibo, giri delle carpe); solo + − × ÷ e radice quadrata (esatta in IEEE 754): il replay del server
// coincide. Unità = pixel dello stagno (koi.json `stagno`).
import { MINIGAMES_CFG } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const CFG = MINIGAMES_CFG.koi;
export const KOI_W = CFG.stagno.w, KOI_H = CFG.stagno.h;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
/** Carpe colorate (la nera è a parte). */
export const KOI_COLORATE = 3;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const WP = 40; // tappe del giro di ogni carpa (dal seed)

/** Stato del cibo: 0 cade (si vede l'ombra), 1 a galla, 2 mangiato, 3 rubato dalla nera, 4 affondato. */
export type CiboStato = 0 | 1 | 2 | 3 | 4;
export type Cibo = { id: number; x: number; y: number; t0: number; oro: boolean; stato: CiboStato; da: number; fine: number; punti: number };
export type KoiModo = 'giro' | 'corsa' | 'mangia' | 'caccia' | 'spavento' | 'sazia';
export type Carpa = { x: number; y: number; hx: number; hy: number; v: number; modo: KoiModo; meta: number; wp: number; t: number };
export type KoiState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  cibo: Cibo[];
  /** 0..2 le colorate, 3 la nera. */
  carpe: Carpa[];
  giri: [number, number][][];
  punti: number;
  combo: number;
  comboMax: number;
  mangiati: number;
  ori: number;
  rubati: number;
  affondati: number;
  spaventi: number;
  tocchi: number;
  totale: number;
  prevA: boolean;
  done: boolean;
  /** Ultimo tocco (per l'increspatura sul client). */
  tocco: { x: number; y: number; tick: number; cosa: 'cibo' | 'nera' | 'acqua' } | null;
};
export type KoiView = {
  w: number; h: number; tick: number; ms: number; maxMs: number; done: boolean;
  punti: number; combo: number; molt: number; totale: number; medals: { oro: number; argento: number; bronzo: number };
  carpe: (Carpa & { nera: boolean })[];
  /** Cibo che sta cadendo (entro `caduta` tick) o a galla. */
  cibo: Cibo[];
  mangiati: number; rubati: number; affondati: number;
  tocco: KoiState['tocco'];
};

/** Il frame di un tocco nel punto (x, y) dello stagno (pixel). */
export function koiTocco(x: number, y: number): InputFrame {
  return { mx: (x / KOI_W) * 2 - 1, my: (y / KOI_H) * 2 - 1, a: true, b: false };
}
/** Punto dello stagno di un frame (dopo la quantizzazione). */
export function koiPunto(f: InputFrame): { x: number; y: number } {
  return { x: ((Math.max(-1, Math.min(1, f.mx)) + 1) / 2) * KOI_W, y: ((Math.max(-1, Math.min(1, f.my)) + 1) / 2) * KOI_H };
}
/** Moltiplicatore della combo. */
export const koiMolt = (combo: number) => Math.min(CFG.punti.comboMax, 1 + Math.floor(combo / CFG.punti.combo));
const valore = (c: Cibo) => (c.oro ? CFG.punti.oro : CFG.punti.petalo);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));

/** Il cibo della partita: un colpo ogni ritmo[0..1] tick, a volte due, dal seed. */
function cibo(rng: Rng): Cibo[] {
  const b = CFG.stagno.bordo, out: Cibo[] = [];
  const posto = (): [number, number] => [b + rng.int(0, KOI_W - 2 * b), b + rng.int(0, KOI_H - 2 * b)];
  for (let t = 50; t < MAX_TICKS - 90; t += rng.int(CFG.cibo.ritmo[0], CFG.cibo.ritmo[1])) {
    const n = rng.next() < CFG.cibo.doppio ? 2 : 1;
    let prima: [number, number] | null = null;
    for (let k = 0; k < n; k++) {
      let p = posto();
      for (let i = 0; i < 8 && prima && dist(p[0], p[1], prima[0], prima[1]) < 40; i++) p = posto();
      prima = p;
      out.push({ id: out.length, x: p[0], y: p[1], t0: t + k * 8, oro: rng.next() < CFG.cibo.oro, stato: 0, da: -1, fine: 0, punti: 0 });
    }
  }
  return out;
}
/** Punti di tutto il cibo mangiato in fila, con la combo che sale (la base delle medaglie). */
function totaleDi(c: readonly Cibo[]): number {
  return c.reduce((a, x, k) => a + valore(x) * koiMolt(k), 0);
}
function medalOf(s: KoiState): Medal {
  const m = CFG.medaglie, t = s.totale;
  return s.punti >= Math.ceil(t * m.oro) ? 'oro' : s.punti >= Math.ceil(t * m.argento) ? 'argento' : s.punti >= Math.ceil(t * m.bronzo) ? 'bronzo' : null;
}

/** Gira la carpa verso (tx, ty) e la porta avanti alla velocità `v` (con un po' d'inerzia). */
function nuota(k: Carpa, tx: number, ty: number, v: number, virata: number): void {
  let dx = tx - k.x, dy = ty - k.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-6) {
    dx /= d; dy /= d;
    let hx = k.hx + (dx - k.hx) * virata, hy = k.hy + (dy - k.hy) * virata;
    let n = Math.sqrt(hx * hx + hy * hy);
    if (n < 1e-3) { hx = -k.hy; hy = k.hx; n = 1; } // girata di 180°: di lato
    k.hx = hx / n; k.hy = hy / n;
  }
  k.v += Math.max(-0.08, Math.min(0.08, v - k.v));
  const passo = Math.min(k.v, d); // non oltrepassa la meta
  k.x += k.hx * passo; k.y += k.hy * passo;
  dentro(k);
}
function dentro(k: Carpa): void {
  const m = 4;
  if (k.x < m) { k.x = m; k.hx = Math.abs(k.hx); } else if (k.x > KOI_W - m) { k.x = KOI_W - m; k.hx = -Math.abs(k.hx); }
  if (k.y < m) { k.y = m; k.hy = Math.abs(k.hy); } else if (k.y > KOI_H - m) { k.y = KOI_H - m; k.hy = -Math.abs(k.hy); }
}
function giro(s: KoiState, i: number): void {
  const k = s.carpe[i]!, g = s.giri[i]!, p = g[k.wp % g.length]!;
  if (dist(k.x, k.y, p[0], p[1]) < 6) k.wp++;
  const q = g[k.wp % g.length]!;
  nuota(k, q[0], q[1], CFG.carpe.giro, CFG.carpe.virata);
}

/** Il tocco: sulla nera la scaccia; vicino al cibo (a galla o che sta cadendo) chiama la colorata libera più vicina. */
function tocca(s: KoiState, x: number, y: number): void {
  s.tocchi++;
  const nera = s.carpe[KOI_COLORATE]!;
  if (dist(x, y, nera.x, nera.y) <= CFG.nera.tocco) {
    if (nera.modo !== 'spavento') s.spaventi++;
    let fx = nera.x - x, fy = nera.y - y;
    const n = Math.sqrt(fx * fx + fy * fy);
    if (n > 1e-3) { nera.hx = fx / n; nera.hy = fy / n; }
    nera.modo = 'spavento'; nera.t = CFG.nera.spavento; nera.meta = -1; nera.v = CFG.nera.fuga;
    s.tocco = { x, y, tick: s.tick, cosa: 'nera' };
    return;
  }
  let best: Cibo | null = null, bd = CFG.cibo.chiamata;
  for (const c of s.cibo) {
    if (!(c.stato === 1 || (c.stato === 0 && c.t0 - s.tick <= CFG.cibo.caduta))) continue;
    const d = dist(x, y, c.x, c.y);
    if (d <= bd) { bd = d; best = c; }
  }
  if (!best) { s.tocco = { x, y, tick: s.tick, cosa: 'acqua' }; return; }
  s.tocco = { x, y, tick: s.tick, cosa: 'cibo' };
  for (let i = 0; i < KOI_COLORATE; i++) if (s.carpe[i]!.modo === 'corsa' && s.carpe[i]!.meta === best.id) return; // ci sta già andando una
  let ki = -1, kd = Infinity;
  for (let i = 0; i < KOI_COLORATE; i++) {
    const k = s.carpe[i]!;
    if (k.modo === 'mangia') continue;
    const d = dist(k.x, k.y, best.x, best.y);
    if (d < kd) { kd = d; ki = i; }
  }
  if (ki < 0) return;
  const k = s.carpe[ki]!;
  k.modo = 'corsa'; k.meta = best.id;
}

/** Tick dell'ultimo tocco dell'autopilota (fuori dallo stato: il replay del server non lo vede). */
const ULTIMO = new WeakMap<KoiState, number>();

export const koi: MinigameModule<KoiState> = {
  id: 'koi',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const rng = createRng(seed).fork('koi');
    const c = cibo(rng.fork('cibo'));
    const gr = rng.fork('giri');
    const giri = Array.from({ length: KOI_COLORATE + 1 }, () => Array.from({ length: WP }, (): [number, number] => [gr.int(14, KOI_W - 14), gr.int(14, KOI_H - 14)]));
    const start: [number, number][] = [[KOI_W * 0.25, KOI_H * 0.3], [KOI_W * 0.72, KOI_H * 0.28], [KOI_W * 0.5, KOI_H * 0.72], [KOI_W * 0.86, KOI_H * 0.8]];
    const carpe: Carpa[] = start.map(([x, y], i) => ({ x, y, hx: i % 2 ? -1 : 1, hy: 0, v: 0, modo: 'giro', meta: -1, wp: 0, t: 0 }));
    return {
      seed, difficulty, tick: 0, cibo: c, carpe, giri, punti: 0, combo: 0, comboMax: 0, mangiati: 0, ori: 0, rubati: 0, affondati: 0, spaventi: 0,
      tocchi: 0, totale: totaleDi(c), prevA: false, done: false, tocco: null,
    };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    // il cibo arriva a galla e, se nessuno lo mangia, affonda
    for (const c of s.cibo) {
      if (c.stato === 0 && s.tick >= c.t0) c.stato = 1;
      else if (c.stato === 1 && s.tick >= c.t0 + CFG.cibo.galla) { c.stato = 4; c.fine = s.tick; s.affondati++; }
    }
    if (input.a && !s.prevA) { const p = koiPunto(input); tocca(s, p.x, p.y); }
    s.prevA = input.a;
    // colorate
    for (let i = 0; i < KOI_COLORATE; i++) {
      const k = s.carpe[i]!;
      if (k.modo === 'mangia') { k.v = Math.max(0, k.v - 0.1); if (--k.t <= 0) k.modo = 'giro'; continue; }
      if (k.modo === 'corsa') {
        const c = s.cibo[k.meta];
        if (!c || c.stato > 1) { k.modo = 'giro'; k.meta = -1; }
        else {
          nuota(k, c.x, c.y, CFG.carpe.corsa, CFG.carpe.virata * 2);
          if (c.stato === 1 && dist(k.x, k.y, c.x, c.y) <= CFG.carpe.bocca) {
            c.stato = 2; c.da = i; c.fine = s.tick; c.punti = valore(c) * koiMolt(s.combo);
            s.punti += c.punti; s.combo++; s.comboMax = Math.max(s.comboMax, s.combo); s.mangiati++; if (c.oro) s.ori++;
            k.modo = 'mangia'; k.t = CFG.carpe.mangia; k.meta = -1;
          }
          continue;
        }
      }
      giro(s, i);
    }
    // la nera: gira, punta il cibo che vede, ruba; scacciata scappa, dopo un furto è sazia
    const n = s.carpe[KOI_COLORATE]!, vn = CFG.nera.velocita[s.difficulty - 1] ?? CFG.nera.velocita[1];
    if (n.modo === 'spavento') {
      n.x += n.hx * n.v; n.y += n.hy * n.v; dentro(n);
      if (--n.t <= 0) { n.modo = 'giro'; }
    } else {
      if (n.modo === 'sazia' && --n.t <= 0) n.modo = 'giro';
      if (n.modo === 'caccia') { const c = s.cibo[n.meta]; if (!c || c.stato !== 1) { n.modo = 'giro'; n.meta = -1; } }
      if (n.modo === 'giro') {
        let best = -1, bd = CFG.nera.vista;
        for (const c of s.cibo) if (c.stato === 1) { const d = dist(n.x, n.y, c.x, c.y); if (d < bd) { bd = d; best = c.id; } }
        if (best >= 0) { n.modo = 'caccia'; n.meta = best; }
      }
      if (n.modo === 'caccia') {
        const c = s.cibo[n.meta]!;
        nuota(n, c.x, c.y, vn, CFG.carpe.virata * 1.5);
        if (dist(n.x, n.y, c.x, c.y) <= CFG.carpe.bocca) {
          c.stato = 3; c.da = KOI_COLORATE; c.fine = s.tick; s.rubati++; s.combo = 0;
          n.modo = 'sazia'; n.t = CFG.nera.sazia; n.meta = -1;
        }
      } else giro(s, KOI_COLORATE);
    }
    if (s.tick >= MAX_TICKS) s.done = true;
  },
  /** score = punti; medaglia = punti contro il totale di tutto il cibo con la combo piena (koi.json `medaglie`). */
  result(s): MinigameResult {
    return {
      done: s.done, score: s.punti, medal: medalOf(s),
      detail: {
        punti: s.punti, totale: s.totale, mangiati: s.mangiati, ori: s.ori, rubati: s.rubati, affondati: s.affondati, combo: s.comboMax,
        spaventi: s.spaventi, tocchi: s.tocchi, cibo: s.cibo.length, ms: Math.round((s.tick / TICK_HZ) * 1000),
      },
    };
  },
  /** Autopilota di riferimento: scaccia la nera quando punta un cibo che nessuna colorata prende prima, poi chiama le carpe sul cibo
   *  più vicino ad affondare (l'oro prima). Un tocco al massimo ogni 8 tick, come un pollice vero. Deve fare oro. */
  autopilot(s): InputFrame {
    if (s.done || s.prevA) return NO;
    const ult = ULTIMO.get(s) ?? -99;
    if (s.tick - ult < 8) return NO;
    const tap = (x: number, y: number) => { ULTIMO.set(s, s.tick); return koiTocco(x, y); };
    const n = s.carpe[KOI_COLORATE]!;
    if (n.modo === 'caccia') {
      const c = s.cibo[n.meta]!, dn = dist(n.x, n.y, c.x, c.y) / Math.max(0.3, n.v || 0.3);
      let mia = Infinity;
      for (let i = 0; i < KOI_COLORATE; i++) { const k = s.carpe[i]!; if (k.modo === 'corsa' && k.meta === c.id) mia = dist(k.x, k.y, c.x, c.y) / CFG.carpe.corsa; }
      if (mia > dn - 6 && dn < 90) return tap(n.x + n.hx * n.v * 2, n.y + n.hy * n.v * 2);
    }
    let best: Cibo | null = null, bk = Infinity;
    for (const c of s.cibo) {
      if (!(c.stato === 1 || (c.stato === 0 && c.t0 - s.tick <= CFG.cibo.caduta - 4))) continue;
      if (s.carpe.some((k, i) => i < KOI_COLORATE && k.modo === 'corsa' && k.meta === c.id)) continue;
      const k = c.t0 + CFG.cibo.galla - s.tick - (c.oro ? 200 : 0);
      if (k < bk) { bk = k; best = c; }
    }
    return best ? tap(best.x, best.y) : NO;
  },
  view(s): KoiView {
    const m = CFG.medaglie;
    return {
      w: KOI_W, h: KOI_H, tick: s.tick, ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: CFG.maxSeconds * 1000, done: s.done,
      punti: s.punti, combo: s.combo, molt: koiMolt(s.combo), totale: s.totale,
      medals: { oro: Math.ceil(s.totale * m.oro), argento: Math.ceil(s.totale * m.argento), bronzo: Math.ceil(s.totale * m.bronzo) },
      carpe: s.carpe.map((k, i) => ({ ...k, nera: i === KOI_COLORATE })),
      cibo: s.cibo.filter((c) => (c.stato === 0 && c.t0 - s.tick <= CFG.cibo.caduta) || c.stato === 1).map((c) => ({ ...c })),
      mangiati: s.mangiati, rubati: s.rubati, affondati: s.affondati, tocco: s.tocco,
    };
  },
};
