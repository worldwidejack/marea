// Gran Premio (Isola delle Corse, docs/CORSE.md): kart arcade su una pista chiusa, 3 giri contro 4 bot, camera dietro al kart.
// Niente fisica vera: il kart ha un muso e una direzione del moto (vettori unitari) e una velocità. Lo sterzo gira il muso, la «presa»
// porta il moto verso il muso (bassa = scivola), il drift gira di più e carica il turbo (2 livelli). Fuori dalla carreggiata c'è il
// prato (lento), poi il muro (rimbalzo). Il progresso si misura lungo la pista (centro campionato ogni `passo` m): niente scorciatoie.
// Solo + − × ÷ e Math.sqrt, come il dungeon e i Templari (tools/check_static.mjs): seno e arcotangente danno risultati un filo diversi
// tra Safari e V8, e in 5000 tick il replay del server divergerebbe da quello che hai visto. Le rotazioni sono vettori ruotati con
// seno e coseno in serie (angoli di un tick, piccoli) e rinormalizzati.
// La guida (morbida / media / nervosa, da provare A/B) è il PRIMO input della partita: corseStartFrame(i) (mx = (i + 1) / 32, esatto dopo la
// quantizzazione); il primo tick non muove niente. Input del pilota: mx = sterzo (+ destra), my = gas (+1 avanti, < −0,3 freno e retro),
// a = drift (tenuto). Medaglia = posizione all'arrivo; punteggio = scoreBase − centesimi (più veloce = più alto, per il tabellone).
// Numeri in content (minigames/corse.json).
import { MINIGAMES_CFG } from '@marea/content';
import type { CorseGuida } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const CFG = MINIGAMES_CFG.corse;
const DT = 1 / TICK_HZ;
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const len2 = (x: number, z: number) => Math.sqrt(x * x + z * z);
/** Angolo con segno da `a` a `b` (+ = `b` sta a destra di `a`), vettori unitari: una misura monotona che
 *  coincide col seno per angoli piccoli e arriva a ±3 per il giro completo (niente arcotangente). */
export function svolta(ax: number, az: number, bx: number, bz: number): number {
  const s = ax * bz - az * bx, c = ax * bx + az * bz;
  return c >= 0 ? s : (s >= 0 ? 1 : -1) * (2 - c);
}
/** Ruota (x, z) di `t` rad (piccoli: un tick; t > 0 = verso sinistra) con seno e coseno in serie; il risultato è rinormalizzato. */
function ruota(x: number, z: number, t: number): [number, number] {
  const t2 = t * t, s = t * (1 - t2 / 6 + (t2 * t2) / 120), c = 1 - t2 / 2 + (t2 * t2) / 24;
  const nx = x * c + z * s, nz = -x * s + z * c, l = len2(nx, nz) || 1;
  return [nx / l, nz / l];
}
/** Avvicina il vettore unitario `a` a `b` della frazione `k` (0..0,45) e lo rinormalizza. */
function verso(ax: number, az: number, bx: number, bz: number, k: number): [number, number] {
  const nx = ax + (bx - ax) * k, nz = az + (bz - az) * k, l = len2(nx, nz);
  return l > 1e-6 ? [nx / l, nz / l] : [ax, az];
}

// ——— la pista ———
/** Centro della pista campionato: punti, tangenti unitarie, distanza cumulata; `len` = un giro (m), `w` = mezza carreggiata. */
export type Pista = { n: number; x: number[]; z: number[]; tx: number[]; tz: number[]; s: number[]; len: number; w: number; erba: number };
let PISTA: Pista | null = null;
/** La pista del Gran Premio (anello chiuso levigato con Catmull-Rom uniforme), calcolata una volta. */
export function corsePista(): Pista {
  if (PISTA) return PISTA;
  const P = CFG.pista.punti, N = P.length, x: number[] = [], z: number[] = [];
  for (let i = 0; i < N; i++) {
    const p0 = P[(i - 1 + N) % N]!, p1 = P[i]!, p2 = P[(i + 1) % N]!, p3 = P[(i + 2) % N]!;
    const k = Math.max(1, Math.ceil(len2(p2[0] - p1[0], p2[1] - p1[1]) / CFG.pista.passo));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      x.push(cr(p0[0], p1[0], p2[0], p3[0])); z.push(cr(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  const n = x.length, s: number[] = [0], tx: number[] = [], tz: number[] = [];
  for (let i = 1; i <= n; i++) s.push(s[i - 1]! + len2(x[i % n]! - x[i - 1]!, z[i % n]! - z[i - 1]!));
  for (let i = 0; i < n; i++) {
    const dx = x[(i + 1) % n]! - x[(i - 1 + n) % n]!, dz = z[(i + 1) % n]! - z[(i - 1 + n) % n]!, l = len2(dx, dz) || 1;
    tx.push(dx / l); tz.push(dz / l);
  }
  PISTA = { n, x, z, tx, tz, s, len: s[n]!, w: CFG.pista.larghezza, erba: CFG.pista.erba };
  return PISTA;
}
/** Dove sta un punto rispetto alla pista: segmento `i` (da i a i+1), distanza lungo il giro, scarto laterale (+ = a destra del verso di
 *  marcia). Cerca vicino a `hint`; se il punto è lontano da lì (non dovrebbe: c'è il muro) cerca su tutta la pista. */
export function corseDove(p: Pista, px: number, pz: number, hint: number): { i: number; along: number; lat: number } {
  const best = { i: 0, t: 0, d: Infinity };
  const prova = (i: number) => {
    const a = i % p.n, b = (a + 1) % p.n, dx = p.x[b]! - p.x[a]!, dz = p.z[b]! - p.z[a]!, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((px - p.x[a]!) * dx + (pz - p.z[a]!) * dz) / l2, 0, 1);
    const ex = p.x[a]! + dx * t - px, ez = p.z[a]! + dz * t - pz, d = ex * ex + ez * ez;
    if (d < best.d) { best.i = a; best.t = t; best.d = d; }
  };
  for (let k = -4; k <= 8; k++) prova(hint + k + p.n);
  const lim = p.w + p.erba + 3;
  if (best.d > lim * lim) for (let i = 0; i < p.n; i++) prova(i);
  const a = best.i, b = (a + 1) % p.n;
  const cx = p.x[a]! + (p.x[b]! - p.x[a]!) * best.t, cz = p.z[a]! + (p.z[b]! - p.z[a]!) * best.t;
  const fx = p.tx[a]!, fz = p.tz[a]!; // destra = (−fz, fx)
  return { i: a, along: p.s[a]! + (p.s[a + 1]! - p.s[a]!) * best.t, lat: (px - cx) * -fz + (pz - cz) * fx };
}
/** Punto della pista a distanza `d` dal via (anche negativa o oltre il giro), spostato di `lat` m a destra; tangente (fx, fz). */
export function corsePunto(p: Pista, d: number, lat = 0): { x: number; z: number; fx: number; fz: number; i: number } {
  let q = d % p.len; if (q < 0) q += p.len;
  let i = 0;
  while (i < p.n - 1 && p.s[i + 1]! <= q) i++;
  const t = (q - p.s[i]!) / ((p.s[i + 1]! - p.s[i]!) || 1), b = (i + 1) % p.n;
  const fx = p.tx[i]!, fz = p.tz[i]!;
  return { x: p.x[i]! + (p.x[b]! - p.x[i]!) * t - fz * lat, z: p.z[i]! + (p.z[b]! - p.z[i]!) * t + fx * lat, fx, fz, i };
}

// ——— i kart ———
export type Kart = {
  x: number; z: number;
  /** Muso (fx, fz) e direzione del moto (ux, uz), vettori unitari: in drift il moto resta indietro e il kart scivola. */
  fx: number; fz: number; ux: number; uz: number;
  /** Velocità lungo il moto (m/s, negativa = retro). */
  v: number;
  /** Segmento della pista, distanza lungo il giro, scarto laterale, progresso totale dal via (m, negativo sulla griglia). */
  seg: number; along: number; lat: number; prog: number;
  /** Drift: 0 no, ±1 verso destra/sinistra; carica (s); partito col bottone (finisce quando lo lasci) o da solo (finisce quando molli lo sterzo). */
  drift: number; carica: number; daBottone: boolean; autoT: number;
  /** Turbo rimasto (s) e il suo livello (1 o 2, per gli effetti). */
  turbo: number; livello: number;
  /** Contro il muro in questo tick (il rimbalzo frena una volta sola). */
  muro: boolean;
  /** Giri: quello in corso (0 = il primo), tick d'inizio, miglior giro (tick, 0 = nessuno), tick d'arrivo (0 = in gara). */
  giro: number; giroTick: number; best: number; fine: number;
};
export type CorseState = {
  seed: number;
  difficulty: Difficulty;
  /** Tick della sim: il tick 1 è la scelta della guida, la gara parte dal 2. */
  tick: number;
  /** Indice in CFG.guide (−1 finché il primo tick non l'ha scelta). */
  guida: number;
  /** karts[0] = tu, poi i bot. */
  karts: Kart[];
  /** Corsia dei bot (−1..1 della mezza carreggiata) e fase della sua oscillazione (0..1). */
  corsie: { base: number; fase: number }[];
  done: boolean;
  timeUp: boolean;
};
export type CorseView = {
  karts: readonly Kart[];
  guida: number;
  /** Posizione (1-5) di ognuno, nello stesso ordine di karts. */
  posizioni: number[];
  giro: number; giri: number;
  ms: number; maxMs: number;
  /** Tempo del giro in corso e del migliore (ms; 0 = nessuno). */
  giroMs: number; bestMs: number;
  done: boolean; finished: boolean; timeUp: boolean;
  tick: number;
};

/** Il primo frame della partita: guida `i` (indice di CFG.guide). */
export function corseStartFrame(i: number): InputFrame {
  return { mx: (i + 1) / 32, my: 0, a: false, b: false };
}
const guidaDi = (s: CorseState): CorseGuida => CFG.guide[s.guida < 0 ? CFG.guidaDiSerie : s.guida]!;
const MEDIA = CFG.guide[CFG.guidaDiSerie]!;

function nuovoKart(p: Pista, d: number, lat: number): Kart {
  const q = corsePunto(p, d, lat), w = corseDove(p, q.x, q.z, q.i);
  return { x: q.x, z: q.z, fx: q.fx, fz: q.fz, ux: q.fx, uz: q.fz, v: 0, seg: w.i, along: w.along, lat: w.lat, prog: d, drift: 0, carica: 0, daBottone: false, autoT: 0, turbo: 0, livello: 0, muro: false, giro: 0, giroTick: 1, best: 0, fine: 0 };
}

/** Un tick di guida di un kart: sterzo −1..1 (+ destra), gas −1..1, drift tenuto; `vmax` = moltiplicatore della velocità massima. */
function guida(p: Pista, k: Kart, G: CorseGuida, sterzo: number, gas: number, driftBtn: boolean, vmax: number): void {
  const K = CFG.kart, D = CFG.drift;
  const fuori = Math.abs(k.lat) > p.w;
  // ---- drift ----
  const sa = Math.abs(sterzo);
  if (!k.drift) {
    k.autoT = sa >= D.autoSterzo && gas > 0 ? k.autoT + DT : 0;
    const auto = D.autoSecondi > 0 && k.autoT >= D.autoSecondi;
    if ((driftBtn || auto) && sa >= D.tieniSterzo && k.v >= D.velocitaMin) { k.drift = sterzo > 0 ? 1 : -1; k.carica = 0; k.daBottone = driftBtn; }
  } else {
    const tiene = (k.daBottone ? driftBtn : sterzo * k.drift >= D.tieniSterzo) && k.v >= D.velocitaMin * 0.7 && gas > 0;
    if (!tiene) {
      const lv = k.carica >= D.carica[1] ? 2 : k.carica >= D.carica[0] ? 1 : 0;
      if (lv) { k.turbo = D.spinta[lv - 1]!; k.livello = lv; }
      k.drift = 0; k.carica = 0; k.autoT = 0;
    } else k.carica += DT;
  }
  // ---- velocità ----
  let top = G.velocita * vmax * (fuori ? K.erbaVelocita : 1);
  if (k.turbo > 0) { top *= 1 + D.turbo; k.turbo = Math.max(0, k.turbo - DT); if (k.turbo === 0) k.livello = 0; }
  if (gas > 0.05) {
    const t = top * gas, acc = k.turbo > 0 ? D.turboAccelerazione : G.accelerazione * (k.v < 0 ? 2 : 1);
    if (k.v < t) k.v = Math.min(t, k.v + acc * DT);
    else k.v = Math.max(t, k.v - (fuori ? K.frenata : K.folle * 2) * DT);
  } else if (gas < -0.3) {
    k.v = k.v > 0 ? Math.max(0, k.v - K.frenata * DT) : Math.max(-K.retro, k.v - G.accelerazione * 0.5 * DT);
  } else k.v = k.v > 0 ? Math.max(0, k.v - K.folle * DT) : Math.min(0, k.v + K.folle * DT);
  // ---- sterzo: in drift si gira sempre verso il lato del drift, lo sterzo stringe (fino a ×1,3) o allarga (fino a ×0,1) ----
  const presa = Math.min(1, Math.abs(k.v) / K.sterzoPieno) * (k.v < 0 ? -1 : 1);
  const giri = k.drift ? k.drift * G.sterzo * G.drift * 0.75 * (0.7 + 0.6 * sterzo * k.drift) : sterzo * G.sterzo; // rad/s, + = verso destra
  [k.fx, k.fz] = ruota(k.fx, k.fz, -giri * presa * DT); // ruota() gira a sinistra con t > 0
  const g = (k.drift ? G.presaDrift : G.presa) * (fuori ? 0.7 : 1);
  [k.ux, k.uz] = verso(k.ux, k.uz, k.fx, k.fz, Math.min(0.45, g * DT));
  k.x += k.ux * k.v * DT; k.z += k.uz * k.v * DT;
}

/** Dopo il moto: dove sta sulla pista, il muro, il progresso e i giri. */
function dopo(s: CorseState, p: Pista, k: Kart): void {
  let w = corseDove(p, k.x, k.z, k.seg);
  const lim = p.w + p.erba;
  if (Math.abs(w.lat) > lim) {
    const fx = p.tx[w.i]!, fz = p.tz[w.i]!, over = w.lat - (w.lat > 0 ? lim : -lim);
    k.x -= -fz * over; k.z -= fx * over; // indietro verso la pista lungo la destra
    if (!k.muro) k.v *= CFG.pista.muro;
    const sv = k.v < 0 ? -1 : 1;
    [k.ux, k.uz] = verso(k.ux, k.uz, fx * sv, fz * sv, 0.45); // strisci lungo il muro
    k.muro = true;
    w = corseDove(p, k.x, k.z, w.i);
  } else k.muro = false;
  let d = w.along - k.along;
  if (d > p.len / 2) d -= p.len; else if (d < -p.len / 2) d += p.len;
  k.prog += d; k.seg = w.i; k.along = w.along; k.lat = w.lat;
  if (k.fine) return;
  const giro = k.prog < 0 ? 0 : Math.floor(k.prog / p.len);
  if (giro > k.giro) {
    const t = s.tick - k.giroTick;
    if (!k.best || t < k.best) k.best = t;
    k.giro = giro; k.giroTick = s.tick;
    if (giro >= CFG.giri) k.fine = s.tick;
  }
}

/** Dove punta chi guida da solo: un punto `sguardo` m più avanti sulla pista, spostato di `corsia` (−1..1 della mezza carreggiata).
 *  `curva` = quanto gira la pista nei prossimi 14 m (+ = a destra; per il drift del pilota automatico). */
function puntaA(p: Pista, k: Kart, corsia: number): { sterzo: number; curva: number } {
  const look = CFG.bot.sguardo[0] + CFG.bot.sguardo[1] * Math.max(0, k.v);
  const j = (k.seg + Math.max(1, Math.round(look / CFG.pista.passo))) % p.n;
  const lat = corsia * p.w;
  const tx = p.x[j]! - p.tz[j]! * lat - k.x, tz = p.z[j]! + p.tx[j]! * lat - k.z, l = len2(tx, tz) || 1;
  const diff = svolta(k.fx, k.fz, tx / l, tz / l);
  const j2 = (k.seg + Math.round(14 / CFG.pista.passo)) % p.n;
  const curva = svolta(p.tx[k.seg]!, p.tz[k.seg]!, p.tx[j2]!, p.tz[j2]!);
  return { sterzo: clamp(diff * CFG.bot.sterzo, -1, 1), curva };
}

/** Separa i kart che si toccano (in ordine fisso: deterministico). */
function urti(ks: Kart[]): void {
  const r2 = CFG.kart.raggio * 2;
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = ks[i]!, b = ks[j]!, dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 >= r2 * r2) continue;
    const d = Math.sqrt(d2) || 0.001, push = (r2 - d) / 2, nx = dx / d, nz = dz / d;
    a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    // chi è dietro perde un filo di velocità
    if (a.prog < b.prog) a.v *= 0.985; else b.v *= 0.985;
  }
}

function posizioni(s: CorseState): number[] {
  const ord = s.karts.map((k, i) => ({ i, f: k.fine || Infinity, p: k.prog })).sort((a, b) => (a.f !== b.f ? a.f - b.f : b.p - a.p || a.i - b.i));
  const out: number[] = new Array(s.karts.length).fill(0);
  ord.forEach((o, n) => { out[o.i] = n + 1; });
  return out;
}
/** Onda a triangolo −1..1 di periodo 1 (al posto del seno: le corsie dei bot ondeggiano piano). */
const triangolo = (t: number) => { const f = t - Math.floor(t); return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; };

const tickMs = (t: number) => Math.round((t / TICK_HZ) * 1000);
/** Tick di gara (il primo tick è la scelta della guida). */
const raceTicks = (s: CorseState, k: Kart) => Math.max(0, (k.fine || s.tick) - 1);

/** Il pilota automatico (test e prove): segue il centro, drift nelle curve lunghe, sempre col gas. `pigro` = metà gas, niente drift. */
export function corsePilota(s: CorseState, pigro = false): InputFrame {
  if (s.guida < 0) return corseStartFrame(CFG.guidaDiSerie);
  const p = corsePista(), k = s.karts[0]!, a = puntaA(p, k, 0);
  if (pigro) return { mx: a.sterzo, my: 0.55, a: false, b: false };
  // drift solo nelle curve lunghe, verso il lato della curva; si molla quando la pista si raddrizza o il punto da seguire passa dall'altra parte
  const lato = a.curva > 0 ? 1 : -1, ac = Math.abs(a.curva);
  const drift = k.drift ? ac > 0.1 && lato === k.drift && a.sterzo * k.drift > -0.95 : ac > 0.3 && a.sterzo * lato > 0.15 && k.v > CFG.drift.velocitaMin + 2;
  return { mx: a.sterzo, my: 1, a: drift, b: false };
}

export const corse: MinigameModule<CorseState> = {
  id: 'corse',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const p = corsePista(), rng = createRng(seed).fork('corse'), G = CFG.griglia;
    const karts = [nuovoKart(p, G[G.length - 1]![0], G[G.length - 1]![1])];
    for (let i = 0; i < CFG.bot.bravura.length; i++) karts.push(nuovoKart(p, G[i]![0], G[i]![1]));
    const corsie = CFG.bot.bravura.map(() => ({ base: (rng.next() * 2 - 1) * CFG.bot.corsia, fase: rng.next() }));
    return { seed, difficulty, tick: 0, guida: -1, karts, corsie, done: false, timeUp: false };
  },
  step(s, f) {
    if (s.done) return;
    s.tick++;
    if (s.guida < 0) { s.guida = clamp(Math.round(f.mx * 32) - 1, 0, CFG.guide.length - 1); return; } // primo tick: la guida
    const p = corsePista(), me = s.karts[0]!, B = CFG.bot, E = B.elastico;
    guida(p, me, guidaDi(s), clamp(f.mx, -1, 1), clamp(f.my, -1, 1), f.a, 1);
    // i bot: puntano la loro corsia, l'elastico li tiene vicini a te (rallentano se sono davanti, spingono se sono dietro)
    for (let i = 1; i < s.karts.length; i++) {
      const k = s.karts[i]!, c = s.corsie[i - 1]!;
      const corsia = clamp(c.base + 0.3 * triangolo(k.prog / 280 + c.fase), -0.8, 0.8);
      const a = puntaA(p, k, corsia), diff = k.prog - me.prog;
      const el = diff > 0 ? 1 - Math.min(E.davantiMax, diff * E.davanti) : 1 + Math.min(E.dietroMax, -diff * E.dietro);
      guida(p, k, MEDIA, a.sterzo, k.fine ? 0.5 : 1, false, B.bravura[i - 1]! * el);
    }
    urti(s.karts);
    for (const k of s.karts) dopo(s, p, k);
    if (me.fine) s.done = true;
    else if (s.tick >= MAX_TICKS) { s.done = true; s.timeUp = true; }
  },
  result(s): MinigameResult {
    const me = s.karts[0]!, fin = me.fine > 0, ms = tickMs(raceTicks(s, me)), pos = posizioni(s)[0]!;
    const medal: Medal = fin ? (pos === 1 ? 'oro' : pos === 2 ? 'argento' : pos === 3 ? 'bronzo' : null) : null;
    const score = fin ? Math.max(1000, CFG.scoreBase - Math.floor(ms / 10)) : Math.floor(Math.max(0, me.prog) / 10);
    return { done: s.done, score, medal, detail: { ms, pos, giri: Math.min(me.giro, CFG.giri), tot: CFG.giri, giro: tickMs(me.best), guida: Math.max(0, s.guida) } };
  },
  autopilot(s: CorseState, _rng: Rng): InputFrame {
    return corsePilota(s);
  },
  view(s): CorseView {
    const me = s.karts[0]!;
    return {
      karts: s.karts, guida: s.guida, posizioni: posizioni(s), giro: Math.min(CFG.giri, me.giro + 1), giri: CFG.giri,
      ms: tickMs(raceTicks(s, me)), maxMs: CFG.maxSeconds * 1000,
      giroMs: me.fine ? 0 : tickMs(Math.max(0, s.tick - Math.max(1, me.giroTick))), bestMs: tickMs(me.best),
      done: s.done, finished: me.fine > 0, timeUp: s.timeUp, tick: s.tick,
    };
  },
};
