// La mountain bike della discesa (banco provadiscesa3d.html, #229; ADRENALINA.md §7, CORSE.md A6 «Due ruote»). Vive sul nastro del
// sentiero come i veicoli delle Corse (s lungo il centro, lat a destra, h sopra), ma è un mezzo diverso:
// - niente motore: spinge la pendenza; si pedala solo piano (sotto `pedaleFinoA`), lo scatto è un colpo di pedale che poi ricarica;
// - lo sterzo dipende dalla velocità: piano gira stretto (interasse e angolo dello sterzo), forte lo limita la presa laterale, quindi
//   le curve strette vogliono il freno prima. La piega in curva (per la grafica) è v·ω/g;
// - sentiero, erba ai lati (frena e scuote), poi il muro (alberi o pendio): urtarlo di traverso fa cadere;
// - radici e sassolini scuotono e frenano; sassi e ceppi sul sentiero si schivano (presi forte = caduta);
// - rampe e tronchi fanno volare, anche i dossi presi forte; atterraggi troppo duri o storti = caduta;
// - cadere costa `caduta.secondi` e si riparte da lì, in mezzo al sentiero, piano (ADRENALINA §4: non si muore mai).
// Solo + − × ÷, Math.sqrt e trig.ts (tools/check_static.mjs): come il resto della sim, deterministica.
import { BICI } from '@marea/content/corse_discesa.ts';
import type { DSentieroDef } from '@marea/content/corse_discesa.ts';
import { TICK_HZ } from '../constants.ts';
import { cos, sin } from '../trig.ts';
import { campo, cella, costruisciNastro } from './nastro.ts';
import type { Nastro } from './nastro.ts';

const DT = 1 / TICK_HZ;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export type Sentiero = { def: DSentieroDef; n: Nastro };
const cache = new Map<string, Sentiero>();
export function sentiero(def: DSentieroDef): Sentiero {
  let s = cache.get(def.id);
  if (!s) cache.set(def.id, (s = { def, n: costruisciNastro(def.punti, { chiuso: false, passo: def.passo, larghezza: def.larghezza }) }));
  return s;
}

export type Bici = {
  s: number; lat: number; h: number; vh: number;
  /** Direzione rispetto al sentiero (rad, + = a destra), velocità (m/s, mai indietro), sterzo applicato (−1..1), svolta (rad/s). */
  ang: number; v: number; st: number; w: number;
  aria: boolean;
  /** Secondi da quando è caduto (0 = in sella); ricarica dello scatto (s); scossa per la camera (0..1, cala da sola). */
  caduto: number; ricarica: number; scossa: number;
  /** Sotto le ruote: sentiero, radici o erba. */
  sup: 'sentiero' | 'radici' | 'erba';
  /** Perché è caduto l'ultima volta (per i messaggi e le prove). */
  perche: '' | 'sasso' | 'muro' | 'atterraggio';
  tick: number; fine: number; cadute: number; salti: number;
};

export function nuovaBici(): Bici {
  return { s: 2, lat: 0, h: 0, vh: 0, ang: 0, v: 0, st: 0, w: 0, aria: false, caduto: 0, ricarica: 0, scossa: 0, sup: 'sentiero', perche: '', tick: 0, fine: 0, cadute: 0, salti: 0 };
}

export type Comandi = { sterzo: number; gas: number; freno: boolean; scatto: boolean };

function cadi(b: Bici, perche: Bici['perche']): void {
  b.caduto = DT; b.cadute++; b.perche = perche; b.v = 0; b.w = 0; b.scossa = 1;
}
function riparti(b: Bici, S: Sentiero): void {
  const l = campo(S.n, S.n.l, b.s);
  b.lat = clamp(b.lat, -l * 0.3, l * 0.3); b.ang = 0; b.h = 0; b.vh = 0; b.aria = false; b.caduto = 0; b.st = 0; b.v = BICI.caduta.ripartenza;
}
const dentro = (t: { da: number; a: number }[], s: number) => { for (const x of t) if (s >= x.da && s < x.a) return true; return false; };

/** Un tick (1/60 s). */
export function pedala(S: Sentiero, b: Bici, c: Comandi): void {
  const B = BICI, G = B.gravita, n = S.n, d = S.def;
  if (b.fine) return;
  b.tick++;
  b.scossa = Math.max(0, b.scossa - 2.5 * DT);
  if (b.caduto > 0) { b.caduto += DT; if (b.caduto >= B.caduta.secondi) riparti(b, S); return; }
  b.st += clamp(clamp(c.sterzo, -1, 1) - b.st, -B.rampaSterzo * DT, B.rampaSterzo * DT);
  b.ricarica = Math.max(0, b.ricarica - DT);
  const l = campo(n, n.l, b.s), fuori = Math.abs(b.lat) - l;
  b.sup = fuori > 0 ? 'erba' : dentro(d.radici, b.s) ? 'radici' : 'sentiero';
  const cs = cos(b.ang), sn = sin(b.ang);
  if (!b.aria) {
    // la pendenza lungo la direzione della bici, le resistenze, la pedalata (solo piano), il freno
    const k = cella(n, b.s), ty = n.ty[k.i]! + (n.ty[k.j]! - n.ty[k.i]!) * k.t, ry = n.ry[k.i]! + (n.ry[k.j]! - n.ry[k.i]!) * k.t;
    let a = -G * (ty * cs + ry * sn) - (b.sup === 'erba' ? B.rotolamentoErba : B.rotolamento) * G - B.aria * b.v * b.v;
    if (c.gas > 0.05 && b.v < B.pedaleFinoA) a += B.pedale * clamp(c.gas, 0, 1) * (1 - b.v / B.pedaleFinoA);
    if (c.freno) a -= B.freno;
    if (b.sup === 'radici') { a -= B.radici.frena; b.scossa = Math.max(b.scossa, B.radici.scossa * clamp(b.v / 10, 0.3, 1)); }
    if (b.sup === 'erba') b.scossa = Math.max(b.scossa, B.erba.scossa * clamp(b.v / 10, 0.3, 1));
    b.v = clamp(b.v + a * DT, 0, B.vMax);
    if (c.scatto && b.ricarica === 0 && b.v < B.scatto.finoA) { b.v += B.scatto.spinta; b.ricarica = B.scatto.ricarica; }
    // sterzo: piano gira stretto, forte lo limita la presa
    const wMax = B.presa / Math.max(1, b.v);
    b.w = clamp((b.v * b.st * B.sterzoMax) / B.interasse, -wMax, wMax);
  } else b.w = b.st * 0.5; // in aria si gira un filo il manubrio
  b.ang += b.w * DT;
  // avanti lungo il nastro: chi sta all'interno della curva fa meno strada; la pista gira sotto la bici
  const kap = campo(n, n.k, b.s), ds = (b.v * cs * DT) / Math.max(0.4, 1 - kap * b.lat);
  b.lat += b.v * sn * DT;
  const s0 = b.s;
  b.s = clamp(b.s + ds, 0, n.len);
  b.ang -= kap * ds;
  if (b.ang > 1.5) b.ang = 1.5; else if (b.ang < -1.5) b.ang = -1.5; // mai di traverso del tutto
  if (b.s >= d.arrivo) { b.fine = b.tick; return; }
  verticale(S, b, s0);
  if (b.caduto) return;
  bordi(S, b);
  if (!b.caduto) ostacoli(S, b);
}

/** Salti, atterraggi; rampe e tronchi. */
function verticale(S: Sentiero, b: Bici, s0: number): void {
  const B = BICI, G = B.gravita, n = S.n, k = cella(n, b.s);
  const uy = n.uy[k.i]! + (n.uy[k.j]! - n.uy[k.i]!) * k.t, kv = n.kv[k.i]! + (n.kv[k.j]! - n.kv[k.i]!) * k.t;
  if (b.aria) {
    b.vh += (-G * uy - b.v * b.v * kv) * DT;
    b.h += b.vh * DT;
    if (b.h <= 0) {
      const urto = -b.vh;
      b.h = 0; b.vh = 0; b.aria = false;
      if (urto > B.caduta.atterraggio || Math.abs(b.ang) > B.caduta.storto) { cadi(b, 'atterraggio'); return; }
      b.scossa = Math.max(b.scossa, clamp(urto / 7, 0.3, 1));
      b.v *= 0.97;
    }
    return;
  }
  // attaccati al sentiero finché la spinta verso il terreno basta (sui dossi presi forte si vola)
  if (b.v * b.v * kv + G * uy < -1) { b.aria = true; b.vh = 0; b.salti++; return; }
  for (const r of S.def.rampe) {
    if (s0 < r.s && r.s <= b.s && Math.abs(b.lat) <= campo(n, n.l, r.s) + 0.2) {
      b.aria = true; b.vh = Math.max(r.salto, b.v * B.rampa.quota); b.salti++; return;
    }
  }
}

/** Erba ai lati e poi il muro (alberi o pendio): di traverso e forte si cade, di striscio si scivola lungo. */
function bordi(S: Sentiero, b: Bici): void {
  const lim = campo(S.n, S.n.l, b.s) + S.def.bordo;
  if (Math.abs(b.lat) <= lim) return;
  const lato = b.lat > 0 ? 1 : -1, contro = b.v * sin(b.ang) * lato; // velocità verso il muro
  b.lat = lato * lim;
  if (contro > BICI.caduta.urtoLato && !b.aria) { cadi(b, 'muro'); return; }
  if (b.ang * lato > 0) b.ang *= 0.4; // si striscia
  b.v *= 0.96; b.scossa = Math.max(b.scossa, 0.6);
}

/** Sassi e ceppi: presi forte si cade, piano ci si ferma contro. */
function ostacoli(S: Sentiero, b: Bici): void {
  const os = S.def.ostacoli;
  // sono in ordine di s: si salta ai vicini
  let lo = 0, hi = os.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (os[m]!.s < b.s - 2) lo = m + 1; else hi = m; }
  for (let i = lo; i < os.length && os[i]!.s < b.s + 2; i++) {
    const o = os[i]!;
    if (b.h > o.alto) continue;
    const ds = b.s - o.s, dl = b.lat - o.lat, r = o.r + 0.3;
    if (ds * ds + dl * dl > r * r) continue;
    if (b.v > BICI.caduta.urto) { cadi(b, 'sasso'); return; }
    // piano: ci si ferma contro e si scivola di lato
    const d = Math.sqrt(ds * ds + dl * dl) || 0.01;
    b.s = o.s + (ds / d) * r; b.lat = o.lat + (dl / d) * r; b.v *= 0.3; b.scossa = Math.max(b.scossa, 0.8);
  }
}

/** Il pilota automatico (prove, test, taratura): tiene il centro, schiva i sassi, frena prima delle curve strette, pedala piano. */
export function pilotaBici(S: Sentiero, b: Bici, prudenza = 0.85): Comandi {
  const B = BICI, n = S.n, os = S.def.ostacoli;
  let meta = 0;
  for (const o of os) if (o.s > b.s && o.s < b.s + 14 && Math.abs(b.lat - o.lat) < o.r + 0.9) { meta = o.lat > 0 ? o.lat - o.r - 0.9 : o.lat + o.r + 0.9; break; }
  let vLim = B.vMax;
  for (let d = 0; d < 40; d += 2) {
    const k = Math.abs(campo(n, n.k, b.s + d));
    if (k > 1e-4) { const v = Math.sqrt((B.presa * prudenza) / k) + d * 0.35; if (v < vLim) vLim = v; }
  }
  const kap = campo(n, n.k, b.s), angVoluto = clamp((meta - b.lat) * 0.25, -0.35, 0.35);
  const w = kap * b.v + (angVoluto - b.ang) * 2.2;
  const sterzo = b.aria ? clamp(-b.ang * 4, -1, 1) : clamp((w * B.interasse) / (Math.max(1, b.v) * B.sterzoMax), -1, 1);
  return { sterzo, gas: b.v < vLim - 1 ? 1 : 0, freno: b.v > vLim + 0.3, scatto: b.v < 6 && b.v < vLim - 2 };
}
