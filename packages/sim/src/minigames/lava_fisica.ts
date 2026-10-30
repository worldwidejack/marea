// Fuga dalla lava, la fisica del corridore (GDD §6, docs/LAVA.md): un tick di corsa, uguale per la partita e per il pilota che prova i piani.
// Corri da solo verso destra; un solo tasto: TOCCA = salto (tenuto = più alto), tocco in aria = giravolta. Gli ostacoli bassi si scavalcano da
// soli (un tocco nel momento giusto dà lo scavalco bello), il bordo vicino ti tira su, il salto «prenotato» poco prima di atterrare e il
// salto subito dopo il bordo (coyote) perdonano il ritardo. Un muro di lava ti insegue: ogni colpo e ogni tuffo nella lava ti fanno perdere
// vantaggio. Solo + − × ÷ e Math.sqrt (niente trigonometria). Unità: px del mondo e tick (60 al secondo), y verso l'alto è negativa.
import { MINIGAMES_CFG } from '@marea/content';
import type { LavaCosa } from '@marea/content';
import { TICK_HZ } from '../constants.ts';

const C = MINIGAMES_CFG.lava;
const F = C.fisica, S = F.scavalco, R = C.corsa;
export const T = C.tile;
/** Mezza larghezza dei piedi, altezza del corridore, x di partenza. */
export const HW = 4, ALTO = 13, X0 = 48;
/** Mezza larghezza (px) per i pericoli: più stretta del corpo, così chi sfiora non si fa male. */
const HP = 3;
const ATT = Math.round(C.geyser.attivoSecondi * TICK_HZ), AVV = Math.round(C.geyser.avvisoSecondi * TICK_HZ), RAMPA = 6;

export type Pezzo = { x0: number; x1: number; h: number };
export type Spuntone = { x: number; h: number };
/** Magmino: cammina avanti e indietro attorno a `x` (±amp px, un giro ogni `per` tick) sulla roccia a `h` tile. */
export type Magmino = { x: number; h: number; amp: number; per: number; fase: number };
export type Geyser = { x: number; h: number; alto: number; per: number; fase: number };
export type Gemma = { k: LavaCosa; x: number; y: number; preso: boolean };
/** Il mondo (fisso, dal seed): rocce e mensole (si salgono solo da sotto, si atterra da sopra) in ordine di x. */
export type Mondo = { pezzi: Pezzo[]; mensole: Pezzo[]; spuntoni: Spuntone[]; magmini: Magmino[]; geyser: Geyser[] };
export type Corpo = {
  x: number; y: number; vy: number; terra: boolean; coyote: number; anticipo: number;
  /** La giravolta in aria c'è ancora. */
  spin: boolean; prevA: boolean;
  /** Gravità in salita imposta (scavalco, tuffo); 0 = quella del salto. */
  gSu: number;
  /** Tick che restano per il tocco dello scavalco bello. */
  scav: number; inv: number; stag: number; margine: number; combo: number;
};
/** Cosa è successo in un tick (suoni, effetti, punti). colpo: 1 muro, 2 pericolo; bagno: 1 gratis (ancora invulnerabile), 2 costoso. */
export type Evento = { salto: boolean; spin: boolean; scavalco: boolean; bello: boolean; atterra: boolean; aggancio: boolean; colpo: 0 | 1 | 2; bagno: 0 | 1 | 2; nemico: number };

export const nuovoEvento = (): Evento => ({ salto: false, spin: false, scavalco: false, bello: false, atterra: false, aggancio: false, colpo: 0, bagno: 0, nemico: 0 });
export function azzera(e: Evento): Evento {
  e.salto = e.spin = e.scavalco = e.bello = e.atterra = e.aggancio = false; e.colpo = 0; e.bagno = 0; e.nemico = 0;
  return e;
}
export const corpoNuovo = (y: number): Corpo => ({ x: X0, y, vy: 0, terra: true, coyote: 0, anticipo: 99, spin: false, prevA: false, gSu: 0, scav: 0, inv: 0, stag: 0, margine: C.muro.margine, combo: 0 });

/** Velocità di corsa a x (px/tick): sale piano lungo la corsa, così il percorso sa quanto sono lunghi i salti. */
export function velocitaA(x: number): number {
  const u = Math.min(1, Math.max(0, (x - X0) / (R.rampaTile * T)));
  return R.velocitaMin + (R.velocitaMax - R.velocitaMin) * u;
}
/** Tick in aria di un salto tenuto fino in cima (la portata in px è velocità × questo). */
export const ARIA_PIENO = F.salto / F.gravitaSu + Math.sqrt((F.salto * F.salto) / F.gravitaSu / F.gravitaGiu);

/** Triangolo in [−1, 1] con periodo 1. */
const onda = (u: number): number => { const k = u - Math.floor(u); return k < 0.5 ? 4 * k - 1 : 3 - 4 * k; };
export const magminoX = (m: Magmino, t: number): number => m.x + m.amp * onda((t + m.fase) / m.per);
/** Altezza del getto al tick t (0 = spento; sale e scende in RAMPA tick) e se sta per eruttare. */
export function getto(g: Geyser, t: number): number {
  const k = (t + g.fase) % g.per;
  return k >= ATT ? 0 : (g.alto * Math.min(RAMPA, k + 1, ATT - k)) / RAMPA;
}
export const geyserAvvisa = (g: Geyser, t: number): boolean => (t + g.fase) % g.per >= g.per - AVV;

/** Primo indice con `chiave(a[i]) ≥ v` (ricerca binaria su un array ordinato). */
function inf<A>(a: readonly A[], v: number, chiave: (e: A) => number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (chiave(a[m]!) < v) lo = m + 1; else hi = m; }
  return lo;
}
/** Indice del pezzo che copre x (−1 = lava). */
function pezzoA(p: readonly Pezzo[], x: number): number {
  const i = inf(p, x, (e) => e.x1);
  return i < p.length && p[i]!.x0 <= x ? i : -1;
}
/** Cima (y) della roccia a x, +Infinity se sotto c'è solo lava. */
const cimaA = (p: readonly Pezzo[], x: number): number => { const i = pezzoA(p, x); return i < 0 ? Infinity : -p[i]!.h * T; };
/** La superficie più alta sotto i piedi (cima ≥ y − 0.01) nell'ampiezza del corpo attorno a x: roccia o mensola. +Infinity = niente. */
function appoggio(w: Mondo, x: number, y: number): number {
  let best = Infinity;
  for (const lista of [w.pezzi, w.mensole]) {
    for (let i = inf(lista, x - HW, (e) => e.x1); i < lista.length && lista[i]!.x0 <= x + HW; i++) {
      const top = -lista[i]!.h * T;
      if (top >= y - 0.01 && top < best) best = top;
    }
  }
  return best;
}

function colpo(c: Corpo, e: Evento, tipo: 1 | 2): void {
  const Q = C.colpo;
  c.margine -= Q.margine; c.inv = Q.invulnerabile; c.stag = Q.tick; c.vy = -2.6; c.gSu = 0; c.terra = false; c.coyote = 0; c.spin = true; c.combo = 0; e.colpo = tipo;
}
/** Un salto automatico sopra qualcosa alto `alt` px: arriva `sopra` px più su, finestra di tick per il tocco dello scavalco bello. */
function scavalca(c: Corpo, e: Evento, alt: number): void {
  c.vy = -Math.sqrt(2 * S.gravita * (alt + S.sopra)); c.gSu = S.gravita; c.terra = false; c.coyote = 0; c.scav = S.finestra; c.spin = true; e.scavalco = true;
}
/** Tick che servono a uno scavalco per salire di `alt` px (+ 4 per stare sopra il bordo). */
function tempoScavalco(alt: number): number {
  const v0 = Math.sqrt(2 * S.gravita * (alt + S.sopra));
  return (v0 - Math.sqrt(v0 * v0 - 2 * S.gravita * (alt + 4))) / S.gravita;
}
/** Fuori dalla lava: una spinta che porta sopra la prossima roccia. */
function tuffo(c: Corpo, w: Mondo, e: Evento): void {
  const B = C.bagno, i = inf(w.pezzi, c.x + HW, (p) => p.x1), alto = i < w.pezzi.length ? w.pezzi[i]!.h * T : 3 * T;
  c.y = 0; c.vy = -Math.sqrt(2 * B.gravita * (alto + B.sopra)); c.gSu = B.gravita; c.terra = false; c.coyote = 0; c.spin = true; c.scav = 0;
  if (c.inv === 0) { c.margine -= B.margine; c.inv = B.invulnerabile; c.stag = B.tick; c.combo = 0; e.bagno = 2; } else e.bagno = 1;
}

/** Pericoli e nemici attorno a (c.x, c.y); `py` = y del tick prima. I magmini si calpestano (anche da invulnerabili). */
function incontri(c: Corpo, w: Mondo, t: number, a: boolean, py: number, morti: boolean[], e: Evento): void {
  const x = c.x, y = c.y;
  for (let i = inf(w.magmini, x - 40, (m) => m.x + m.amp); i < w.magmini.length && w.magmini[i]!.x - w.magmini[i]!.amp < x + 40; i++) {
    const m = w.magmini[i]!;
    if (morti[i]) continue;
    const ty = -m.h * T, mx = magminoX(m, t);
    if (c.terra && c.scav === 0 && mx - x > 0 && mx - x < 14 && y > ty - 7) { scavalca(c, e, 11); continue; } // ci arrivi di corsa: lo scavalchi in anticipo
    if (Math.abs(x - mx) >= 8 || y <= ty - 9 + 2 || y - ALTO >= ty) continue;
    if (c.vy > 0 && py <= ty - 9 + 6) { // calpestato
      morti[i] = true; c.combo++; e.nemico = c.combo; c.vy = -F.rimbalzo[a ? 1 : 0]; c.gSu = 0; c.terra = false; c.coyote = 0; c.spin = true;
    } else if (c.scav > 0 || c.inv > 0) continue;
    else if (c.terra) scavalca(c, e, 11);
    else colpo(c, e, 2);
    if (e.colpo || e.nemico) return;
  }
  if (c.inv > 0) return;
  for (let i = inf(w.spuntoni, x - 12, (s) => s.x); i < w.spuntoni.length && w.spuntoni[i]!.x < x + 12; i++) {
    const s = w.spuntoni[i]!;
    if (Math.abs(x - s.x) < HP + 3 && y > -s.h * T - 8) { colpo(c, e, 2); return; }
  }
  for (let i = inf(w.geyser, x - 14, (g) => g.x); i < w.geyser.length && w.geyser[i]!.x < x + 14; i++) {
    const g = w.geyser[i]!, h = getto(g, t), base = -g.h * T;
    if (h > 0 && Math.abs(x - g.x) < HP + 4 && y > base - h + 2 && y - ALTO < base) { colpo(c, e, 2); return; }
  }
}

/** Un tick di corsa. `t` = numero del tick; `morti` = i magmini già calpestati (si aggiorna). */
export function avanza(c: Corpo, w: Mondo, t: number, a: boolean, morti: boolean[], e: Evento): void {
  const press = a && !c.prevA; c.prevA = a;
  c.anticipo = press ? 0 : Math.min(99, c.anticipo + 1);
  if (c.inv > 0) c.inv--;
  if (c.stag > 0) c.stag--;
  if (c.scav > 0) c.scav--;
  // ---- salto, scavalco bello, giravolta ----
  if (press && c.scav > 0 && c.gSu > 0 && c.vy < 0) {
    c.vy = -F.salto * S.bello; c.gSu = 0; c.scav = 0; c.anticipo = 99; e.bello = e.salto = true;
  } else if ((c.terra || c.coyote > 0) && c.anticipo <= F.anticipo) {
    c.vy = -F.salto; c.gSu = 0; c.terra = false; c.coyote = 0; c.anticipo = 99; c.spin = true; e.salto = true;
  } else if (press && !c.terra && c.coyote === 0 && c.spin && c.vy > -F.spin && !(c.vy > 0 && appoggio(w, c.x, c.y) - c.y <= c.vy * F.anticipo)) {
    // (a un attimo dall'atterraggio il tocco non è una giravolta: resta prenotato e fa saltare appena tocchi terra)
    c.vy = -F.spin; c.gSu = 0; c.spin = false; e.spin = true;
  }
  if (!c.terra) {
    c.vy = Math.min(F.cadutaMax, c.vy + (c.vy < 0 ? (c.gSu > 0 ? c.gSu : a ? F.gravitaSu : F.gravitaTaglio) : F.gravitaGiu));
    if (c.vy >= 0) c.gSu = 0;
    if (c.coyote > 0) c.coyote--;
  }
  // ---- avanti, con muri, scavalchi e bordi ----
  const vb = velocitaA(c.x), x0 = c.x;
  if (c.terra) { // la roccia qui accanto è più alta di poco: si salta in anticipo, così sei sopra il bordo quando ci arrivi
    const j = pezzoA(w.pezzi, x0 + HW), n = j >= 0 ? w.pezzi[j + 1] : undefined, alt = n ? c.y + n.h * T : 0;
    if (n && alt > 0.5 && alt <= S.altezzaMax && n.x0 - w.pezzi[j]!.x1 < 1 && n.x0 - (x0 + HW) <= vb * (tempoScavalco(alt) + 1)) scavalca(c, e, alt);
  }
  let nx = x0 + vb * (c.stag > 0 ? 1 - (1 - C.colpo.rallenta) * (c.stag / C.colpo.tick) : 1);
  const topF = cimaA(w.pezzi, nx + HW);
  if (topF < c.y - 0.5) {
    const alt = c.y - topF;
    if (c.gSu === S.gravita && c.vy < 0 && alt <= S.altezzaMax + 8) { /* scavalco in salita: il bordo lo supera */ }
    else if (c.terra && alt <= S.altezzaMax) scavalca(c, e, alt);
    else if (!c.terra && alt <= F.aggancio) { c.y = topF; c.vy = 0; c.terra = true; c.gSu = 0; e.aggancio = true; }
    else {
      const p = w.pezzi[pezzoA(w.pezzi, nx + HW)]!;
      nx = Math.max(x0, Math.min(nx, p.x0 - HW - 0.01));
      if (c.inv === 0) colpo(c, e, 1);
    }
  }
  c.x = nx;
  // ---- verticale: sotto i piedi, atterraggio, lava ----
  const py = c.y;
  if (c.terra) {
    const s = appoggio(w, c.x, c.y - 0.5);
    if (s > c.y + 0.5) { c.terra = false; c.coyote = F.coyote; c.vy = 0; c.spin = true; } else c.y = s;
  }
  if (!c.terra) {
    c.y += c.vy;
    if (c.vy >= 0) {
      const s = appoggio(w, c.x, py);
      if (s <= c.y) { c.y = s; c.vy = 0; c.terra = true; c.gSu = 0; c.combo = 0; e.atterra = true; }
    }
  }
  if (c.y > 0) tuffo(c, w, e);
  incontri(c, w, t, a, py, morti, e);
  c.margine = Math.min(C.muro.margine, c.margine + (c.x - x0) - C.muro.frazione * vb);
}
