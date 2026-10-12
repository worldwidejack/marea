// La mountain bike della discesa (banco provadiscesa3d.html, #229; ADRENALINA.md §7, CORSE.md A6 «Due ruote»). Vive sul nastro del
// sentiero come i veicoli delle Corse (s lungo il centro, lat a destra, h sopra), ma è un mezzo diverso:
// - niente motore: spinge la pendenza; si pedala solo piano (sotto `pedaleFinoA`) e pedalare consuma l'energia (`energia`, 0..1), che
//   torna quando non si pedala; senza energia si pedala piano. Lo scatto è un colpo di pedale: si fa con l'energia carica e la svuota;
// - le salite (strappi) si fanno pedalando o con lo slancio; le paraboliche (curve sopraelevate) tengono di più: la presa cresce con
//   la sopraelevazione verso l'interno;
// - lo sterzo dipende dalla velocità: piano gira stretto (interasse e angolo dello sterzo), forte lo limita la presa laterale, quindi
//   le curve strette vogliono il freno prima. La piega in curva (per la grafica) è v·ω/g;
// - sentiero, erba ai lati (frena e scuote), poi il muro (alberi o pendio): urtarlo di traverso fa cadere;
// - radici e sassolini scuotono e frenano; sassi e ceppi sul sentiero si schivano (presi forte = caduta);
// - rampe e tronchi sono un rilievo vero sopra il sentiero (`rilievo`): la bici ci sale sopra e vola quando il terreno scende più in
//   fretta di quanto la tira giù la gravità (dal labbro della rampa, dalla cima del tronco, dai dossi presi forte); il tronco la
//   sospensione lo assorbe quasi tutto; atterraggi troppo duri o storti = caduta;
// - i sassi si urtano con le ruote (davanti e dietro), non con un cerchio largo attorno alla bici;
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
  /** Secondi da quando è caduto (0 = in sella); energia (0..1); tasto dello scatto tenuto (si scatta quando si preme, non tenendo);
   *  scossa per la camera (0..1, cala da sola); secondi in aria. */
  caduto: number; energia: number; scattoTenuto: boolean; scossa: number; volo: number;
  /** Sotto le ruote: sentiero, radici, erba o tavole (le paraboliche di legno). */
  sup: 'sentiero' | 'radici' | 'erba' | 'legno';
  /** Perché è caduto l'ultima volta (per i messaggi e le prove). */
  perche: '' | 'sasso' | 'muro' | 'atterraggio';
  tick: number; fine: number; cadute: number; salti: number;
};

export function nuovaBici(): Bici {
  return { s: 2, lat: 0, h: 0, vh: 0, ang: 0, v: 0, st: 0, w: 0, aria: false, caduto: 0, energia: 1, scattoTenuto: false, scossa: 0, volo: 0, sup: 'sentiero', perche: '', tick: 0, fine: 0, cadute: 0, salti: 0 };
}

export type Comandi = { sterzo: number; gas: number; freno: boolean; scatto: boolean };

function cadi(b: Bici, perche: Bici['perche']): void {
  b.caduto = DT; b.cadute++; b.perche = perche; b.v = 0; b.w = 0; b.scossa = 1;
}
function riparti(b: Bici, S: Sentiero): void {
  const l = campo(S.n, S.n.l, b.s);
  b.lat = clamp(b.lat, -l * 0.3, l * 0.3); b.ang = 0; b.h = 0; b.vh = 0; b.aria = false; b.volo = 0; b.caduto = 0; b.st = 0; b.v = BICI.caduta.ripartenza;
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
  const l = campo(n, n.l, b.s), fuori = Math.abs(b.lat) - l;
  b.sup = fuori > 0 ? 'erba' : dentro(d.radici, b.s) ? 'radici' : dentro(d.legno, b.s) ? 'legno' : 'sentiero';
  const cs = cos(b.ang), sn = sin(b.ang);
  if (!b.aria) {
    // la pendenza lungo la direzione della bici, le resistenze, la pedalata (solo piano), il freno
    const k = cella(n, b.s), ty = n.ty[k.i]! + (n.ty[k.j]! - n.ty[k.i]!) * k.t, ry = n.ry[k.i]! + (n.ry[k.j]! - n.ry[k.i]!) * k.t;
    let a = -G * (ty * cs + ry * sn) - (b.sup === 'erba' ? B.rotolamentoErba : B.rotolamento) * G - B.aria * b.v * b.v;
    // sul rilievo (rampa, tronco) si sale e si scende: la gravità lungo la sua pendenza
    const mr = rilievo(S, b.s, b.lat).m * cs;
    if (mr !== 0) a -= (G * mr) / Math.sqrt(1 + mr * mr);
    // pedalare: piena forza con l'energia, piano senza (in salita non ci si pianta mai); consuma, e torna quando non si pedala
    const E = B.energia, gas = clamp(c.gas, 0, 1);
    if (gas > 0.05 && b.v < B.pedaleFinoA) {
      a += B.pedale * gas * (1 - b.v / B.pedaleFinoA) * (E.stanco + (1 - E.stanco) * b.energia);
      b.energia = Math.max(0, b.energia - E.consumo * gas * DT);
    } else b.energia = Math.min(1, b.energia + E.ricarica * DT);
    if (c.freno) a -= B.freno;
    if (b.sup === 'radici') { a -= B.radici.frena; b.scossa = Math.max(b.scossa, B.radici.scossa * clamp(b.v / 10, 0.3, 1)); }
    if (b.sup === 'erba') b.scossa = Math.max(b.scossa, B.erba.scossa * clamp(b.v / 10, 0.3, 1));
    b.v = clamp(b.v + a * DT, 0, B.vMax);
    // lo scatto: quando si preme il tasto, con abbastanza energia; la svuota tutta
    if (c.scatto && !b.scattoTenuto && b.energia >= B.scatto.energia && b.v < B.scatto.finoA) { b.v += B.scatto.spinta; b.energia = 0; }
    // sterzo: piano gira stretto, forte lo limita la presa; la parabolica aiuta chi gira verso il suo interno (più basso) e ostacola
    // chi gira verso l'esterno (ry = quanto sale il lato destro: negativo se scende)
    const verso = b.st >= 0 ? 1 : -1, presa = B.presa + clamp(-G * ry * verso, -B.presa * 0.5, G);
    const wMax = presa / Math.max(1, b.v);
    b.w = clamp((b.v * b.st * B.sterzoMax) / B.interasse, -wMax, wMax);
  } else b.w = b.st * 0.5; // in aria si gira un filo il manubrio
  b.scattoTenuto = c.scatto;
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

/** Il rilievo sopra il nastro: quota (m), pendenza lungo il sentiero, e quanta spinta in su resta al decollo (1 = tutta, come dal
 *  labbro di una rampa; poca = la sospensione assorbe, come su un tronco). */
export type Rilievo = { g: number; m: number; molla: number };
const RIL: Rilievo = { g: 0, m: 0, molla: 1 };
/** Rampe e tronchi a `s`, `lat` (un oggetto condiviso: si legge subito, non si tiene).
 *  - Rampa alta `alto` m e lunga 3 × alto (il modello cs_d_rampa scalato): profilo ≈ alto·(0,3t + 0,7t²) come il kit, il labbro a `s`
 *    (pendenza finale 1,7·alto/lungo, ~30°), dietro il labbro il vuoto; piano largo ±0,7·alto, poi i fianchi di terra che scendono.
 *  - Tronco: la ruota (raggio 0,35) che ci passa sopra fa una gobba tonda alta `alto`, lunga ±`BICI.tronco.mezzo` m, da bordo a bordo. */
export function rilievo(S: Sentiero, s: number, lat: number): Rilievo {
  RIL.g = 0; RIL.m = 0; RIL.molla = 1;
  const T = BICI.tronco;
  for (const r of S.def.rampe) {
    if (r.tipo === 'tronco') {
      const u = (s - r.s) / T.mezzo;
      if (u <= -1 || u >= 1) continue;
      const w = 1 - u * u;
      RIL.g = r.alto * w * w; RIL.m = (-4 * r.alto * u * w) / T.mezzo; RIL.molla = T.molla;
      return RIL;
    }
    const L = r.alto * 3, x = s - (r.s - L);
    if (x <= 0 || x > L) continue;
    const t = x / L, g = r.alto * (0.3 * t + 0.7 * t * t), W = r.alto * 0.7, fianco = r.alto * 0.3 + g * 0.55, fuori = Math.abs(lat) - W;
    const k = fuori <= 0 ? 1 : fuori >= fianco ? 0 : 1 - fuori / fianco;
    if (k <= 0) continue;
    RIL.g = g * k; RIL.m = ((r.alto * (0.3 + 1.4 * t)) / L) * k;
    return RIL;
  }
  return RIL;
}

/** Salti e atterraggi. La bici resta sul terreno (nastro + rilievo) finché il terreno non scende più in fretta della caduta libera:
 *  lì vola, con la velocità in su che aveva (ridotta dalla `molla` del rilievo). Così si sale sulla rampa e si stacca dal labbro. */
function verticale(S: Sentiero, b: Bici, s0: number): void {
  const B = BICI, G = B.gravita, n = S.n, k = cella(n, b.s);
  const uy = n.uy[k.i]! + (n.uy[k.j]! - n.uy[k.i]!) * k.t, kv = n.kv[k.i]! + (n.kv[k.j]! - n.kv[k.i]!) * k.t;
  // in aria, rispetto al nastro: la gravità e il nastro che curva sotto (un dosso scende via, una conca viene su)
  const aAria = -G * uy - b.v * b.v * kv;
  const R = rilievo(S, b.s, b.lat), suolo = R.g, molla = R.molla, vhSuolo = b.v * cos(b.ang) * R.m;
  if (b.aria) {
    b.volo += DT;
    b.vh += aAria * DT;
    b.h += b.vh * DT;
    if (b.h <= suolo) {
      const urto = vhSuolo - b.vh; // quanto in fretta si sbatte contro il terreno
      b.h = suolo; b.vh = vhSuolo; b.aria = false;
      if (b.volo > 0.25) b.salti++;
      b.volo = 0;
      if (urto > B.caduta.atterraggio || Math.abs(b.ang) > B.caduta.storto) { cadi(b, 'atterraggio'); return; }
      b.scossa = Math.max(b.scossa, clamp(urto / 7, 0.3, 1));
      b.v *= 0.97;
    }
    return;
  }
  // a terra: si vola se, lasciata andare, la bici starebbe sopra il terreno (margine di 1 m/s², così sui dossi piani non frulla)
  const libera = b.vh + (aAria - 1) * DT, spinta = libera > 0 ? libera * molla : libera;
  if (spinta > vhSuolo) { b.aria = true; b.vh = spinta; b.h = Math.max(suolo, b.h + spinta * DT); b.volo = 0; return; } // b.h = dov'era: il labbro
  // il colpo del tronco: frena un poco, una volta, entrando
  if (molla < 1 && rilievo(S, s0, b.lat).g === 0) { b.v *= 1 - B.tronco.frena; b.scossa = Math.max(b.scossa, 0.7); }
  b.h = suolo; b.vh = vhSuolo;
}

/** Erba ai lati e poi il muro (alberi o pendio): di traverso e forte si cade, di striscio si scivola lungo. */
function bordi(S: Sentiero, b: Bici): void {
  const lim = campo(S.n, S.n.l, b.s) + (dentro(S.def.legno, b.s) ? BICI.bordoLegno : S.def.bordo);
  if (Math.abs(b.lat) <= lim) return;
  const lato = b.lat > 0 ? 1 : -1, contro = b.v * sin(b.ang) * lato; // velocità verso il muro
  b.lat = lato * lim;
  if (contro > BICI.caduta.urtoLato && !b.aria) { cadi(b, 'muro'); return; }
  if (b.ang * lato > 0) b.ang *= 0.4; // si striscia
  b.v *= 0.96; b.scossa = Math.max(b.scossa, 0.6);
}

/** Sassi e ceppi: si urtano con le ruote (a ±mezzo interasse dal centro della bici, lungo la sua direzione) contro la base vera del
 *  modello (`BICI.sasso.base` × r) più mezzo copertone. Presi forte si cade, piano ci si ferma contro e si scivola di lato. */
function ostacoli(S: Sentiero, b: Bici): void {
  const os = S.def.ostacoli, mezzo = BICI.interasse / 2, cs = cos(b.ang), sn = sin(b.ang);
  // sono in ordine di s: si salta ai vicini
  let lo = 0, hi = os.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (os[m]!.s < b.s - 2) lo = m + 1; else hi = m; }
  for (let i = lo; i < os.length && os[i]!.s < b.s + 2; i++) {
    const o = os[i]!;
    if (b.h > o.alto) continue;
    const r = o.r * BICI.sasso.base + BICI.sasso.copertone;
    for (const verso of [1, -1]) {
      const ds = b.s + verso * mezzo * cs - o.s, dl = b.lat + verso * mezzo * sn - o.lat;
      if (ds * ds + dl * dl > r * r) continue;
      if (b.v > BICI.caduta.urto) { cadi(b, 'sasso'); return; }
      const d = Math.sqrt(ds * ds + dl * dl) || 0.01, spingi = r - d;
      b.s += (ds / d) * spingi; b.lat += (dl / d) * spingi; b.v *= 0.3; b.scossa = Math.max(b.scossa, 0.8);
    }
  }
}

/** Il pilota automatico (prove, test, taratura): tiene il centro, schiva i sassi, frena prima delle curve strette, pedala piano. */
export function pilotaBici(S: Sentiero, b: Bici, prudenza = 0.85): Comandi {
  const B = BICI, n = S.n, os = S.def.ostacoli;
  let meta = 0;
  for (const o of os) if (o.s > b.s && o.s < b.s + 14 && Math.abs(b.lat - o.lat) < o.r + 0.9) { meta = o.lat > 0 ? o.lat - o.r - 0.9 : o.lat + o.r + 0.9; break; }
  let vLim = B.vMax;
  for (let d = 0; d < 40; d += 2) {
    const kk = campo(n, n.k, b.s + d), k = Math.abs(kk), banca = clamp(-B.gravita * campo(n, n.ry, b.s + d) * (kk >= 0 ? 1 : -1), -B.presa * 0.5, B.gravita);
    if (k > 1e-4) { const v = Math.sqrt(((B.presa + banca) * prudenza) / k) + d * 0.35; if (v < vLim) vLim = v; }
  }
  const kap = campo(n, n.k, b.s), angVoluto = clamp((meta - b.lat) * 0.25, -0.35, 0.35);
  const w = kap * b.v + (angVoluto - b.ang) * 2.2;
  const sterzo = b.aria ? clamp(-b.ang * 4, -1, 1) : clamp((w * B.interasse) / (Math.max(1, b.v) * B.sterzoMax), -1, 1);
  return { sterzo, gas: b.v < vLim - 1 ? 1 : 0, freno: b.v > vLim + 0.3, scatto: b.v < 6 && b.v < vLim - 2 && !b.scattoTenuto };
}
