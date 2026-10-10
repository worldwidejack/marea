// Il veicolo del motore v2 (docs/CORSE.md A11) in coordinate di pista: s lungo il nastro, lat a destra, h sopra la superficie.
// Muso e moto sono versori nel piano della pista, (avanti, destra). La guida è quella del Gran Premio, che piace:
// - sterzo, «presa» (quanto in fretta il moto raggiunge il muso), drift che carica il turbo;
// - (#170) sterzo che cala con la velocità (in drift no: il drift serve a stringere), drift a 3 livelli che carica più in fretta
//   stringendo e si perde contro il muro, acrobazie in aria (turbo all'atterraggio), turbo che si sommano, motore ingolfato;
// - in più la pendenza, i salti (rampe, dossi presi forte, creste delle onde), i giri della morte, le cadute e la ripartenza;
// - le superfici cambiano velocità, presa e accelerazione, per famiglia e per i veicoli buffi;
// - quando la pista curva, sotto il veicolo gira lei: muso e moto ruotano al contrario.
// Solo + − × ÷ e Math.sqrt (tools/check_static.mjs): seno e coseno in serie, per angoli piccoli (un tick).
import { CORSE } from '@marea/content/corse.ts';
import type { CVeicoloDef } from '@marea/content/corse.ts';
import { TICK_HZ } from '../constants.ts';
import { campo, cella, dove, punto } from './nastro.ts';
import type { Nastro } from './nastro.ts';
import { VUOTO, bordoDi, effetto, muroA, nastroDi, superficieA } from './pista.ts';
import type { Pista } from './pista.ts';

const DT = 1 / TICK_HZ;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export type Veicolo = {
  /** Id del veicolo (CORSE.veicoli). */
  id: string;
  /** −1 = pista principale, altrimenti l'indice del ramo. */
  ramo: number;
  s: number; lat: number; h: number; vh: number;
  /** Muso (hf avanti, hl destra) e moto (mf, ml): versori nel piano della pista. */
  hf: number; hl: number; mf: number; ml: number;
  /** Velocità lungo il moto (m/s, negativa = retro). */
  v: number;
  /** Progresso dal via (m, negativo sulla griglia): dice la posizione e i giri. */
  prog: number;
  /** In aria (salto o caduta); secondi da quando è caduto (0 = no). */
  aria: boolean; caduto: number;
  /** Ultimo punto a terra, sulla principale (per ripartire dopo una caduta). */
  terra: number;
  drift: number; carica: number; daBottone: boolean; autoT: number;
  /** Turbo rimasto (s) e da dove viene (1-3 = livello del drift, per i colori). */
  turbo: number; livello: number;
  /** Sterzo del giocatore dopo curva e rampa (gara.ts); secondi da cui DRIFT è tenuto (−1 = lasciato, 0 = premuto ora). */
  st: number; tenuto: number;
  /** Secondi da cui il GAS è tenuto a fondo (−1 = no): serve al turbo della partenza. */
  gasT: number;
  /** Acrobazia in corso (s da quando è partita, 0 = no, −1 = salto da un'onda); scia caricata (s); motore ingolfato (s fermo); partenza (−1 ingolfato, 1 buona, 2 razzo). */
  acro: number; scia: number; fermo: number; partenza: number;
  muro: boolean;
  /** Superficie sotto (per gli effetti del client). */
  sup: string;
  /** Salti fatti (rampe, dossi, onde) e cadute: per le prove e le statistiche. */
  salti: number; cadute: number;
  /** Preso dall'inseguitore (l'onda delle fughe): 0 = no, 1 = sì (una volta sola: poi il fronte è passato). */
  travolto: number;
  giro: number; giroTick: number; best: number; fine: number;
};

/** Ruota il versore (f, l) di `a` rad verso destra (angoli piccoli; il risultato è rinormalizzato). */
export function gira(f: number, l: number, a: number): [number, number] {
  const a2 = a * a, s = a * (1 - a2 / 6 + (a2 * a2) / 120), c = 1 - a2 / 2 + (a2 * a2) / 24;
  const nf = f * c - l * s, nl = f * s + l * c, n = Math.sqrt(nf * nf + nl * nl) || 1;
  return [nf / n, nl / n];
}
function verso(af: number, al: number, bf: number, bl: number, k: number): [number, number] {
  const nf = af + (bf - af) * k, nl = al + (bl - al) * k, n = Math.sqrt(nf * nf + nl * nl);
  return n > 1e-6 ? [nf / n, nl / n] : [af, al];
}

/** Un veicolo fermo sulla principale a `prog` m dal via, `lat` m a destra. */
export function nuovoVeicolo(p: Pista, id: string, prog: number, lat: number): Veicolo {
  const s = posa(p, p.def.via + prog);
  return {
    id, ramo: -1, s, lat, h: 0, vh: 0, hf: 1, hl: 0, mf: 1, ml: 0, v: 0, prog, aria: false, caduto: 0, terra: s,
    drift: 0, carica: 0, daBottone: false, autoT: 0, turbo: 0, livello: 0, st: 0, tenuto: -1, gasT: -1, acro: 0, scia: 0, fermo: 0, partenza: 0, muro: false, sup: p.def.superficie, salti: 0, cadute: 0, travolto: 0,
    giro: 0, giroTick: 1, best: 0, fine: 0,
  };
}
/** Le regole accese (opzioni della gara, interruttori del banco di prova). */
export type Regole = { sterzo: boolean; partenza: boolean; acrobazie: boolean; scia: boolean; somma: boolean };
export const REGOLE_TUTTE: Regole = { sterzo: true, partenza: true, acrobazie: true, scia: true, somma: true };

/** Dà `sec` secondi di turbo: sommati a quelli che restano (alla Crash Team Racing, fino a turbo.max) o, senza `somma`, il più lungo dei due. */
export function daiTurbo(k: Veicolo, sec: number, livello: number, somma: boolean): void {
  k.turbo = somma ? Math.min(CORSE.turbo.max, k.turbo + sec) : Math.max(k.turbo, sec);
  k.livello = livello;
}

/** s dentro la principale (sulla chiusa si gira intorno, sull'aperta si resta tra 0 e la fine). */
function posa(p: Pista, s: number): number {
  const L = p.n.len;
  if (p.n.chiuso) { const q = s - Math.floor(s / L) * L; return q >= L ? 0 : q; }
  return clamp(s, 0, L);
}

const P3: [number, number, number] = [0, 0, 0];
/** Passa da un nastro all'altro tenendo il punto del mondo e la direzione: muso e moto riespressi nella terna nuova. */
function cambiaNastro(k: Veicolo, da: Nastro, sDa: number, a: Nastro, sA: number, latA: number, ramo: number): void {
  const c = cella(da, sDa), i = c.i;
  const Wx = da.tx[i]! * k.hf + da.rx[i]! * k.hl, Wy = da.ty[i]! * k.hf + da.ry[i]! * k.hl, Wz = da.tz[i]! * k.hf + da.rz[i]! * k.hl;
  const Mx = da.tx[i]! * k.mf + da.rx[i]! * k.ml, My = da.ty[i]! * k.mf + da.ry[i]! * k.ml, Mz = da.tz[i]! * k.mf + da.rz[i]! * k.ml;
  const j = cella(a, sA).i;
  const nuovo = (x: number, y: number, z: number): [number, number] => {
    const f = x * a.tx[j]! + y * a.ty[j]! + z * a.tz[j]!, l = x * a.rx[j]! + y * a.ry[j]! + z * a.rz[j]!, n = Math.sqrt(f * f + l * l) || 1;
    return [f / n, l / n];
  };
  [k.hf, k.hl] = nuovo(Wx, Wy, Wz); [k.mf, k.ml] = nuovo(Mx, My, Mz);
  k.ramo = ramo; k.s = sA; k.lat = latA;
}

/** Avanza di `ds` m lungo il nastro su cui sta: progresso, giro intorno, entrata e uscita dai rami. */
function avanza(p: Pista, k: Veicolo, ds: number): void {
  if (k.ramo >= 0) {
    const r = p.rami[k.ramo]!;
    k.s += ds; k.prog += ds * r.scala;
    if (k.s >= r.n.len) { // fine del ramo: si ritrova la principale a `a`
      const oltre = k.s - r.n.len;
      punto(r.n, r.n.len, k.lat, 0, P3);
      const w = dove(p.n, P3[0], P3[1], P3[2], r.def.a, 20);
      cambiaNastro(k, r.n, r.n.len, p.n, posa(p, w.s + oltre), w.lat, -1);
    } else if (k.s < 0) { // in retromarcia fuori dall'imbocco
      punto(r.n, 0, k.lat, 0, P3);
      const w = dove(p.n, P3[0], P3[1], P3[2], r.def.da, 20);
      cambiaNastro(k, r.n, 0, p.n, posa(p, w.s + k.s), w.lat, -1);
    }
    return;
  }
  const s0 = k.s;
  k.prog += ds;
  k.s = posa(p, s0 + ds);
  if (ds <= 0) return;
  // imbocco di un ramo: passando `da` dalla parte giusta si entra
  for (let i = 0; i < p.rami.length; i++) {
    const r = p.rami[i]!;
    const passa = p.n.chiuso && s0 + ds >= p.n.len ? s0 < r.def.da || r.def.da <= k.s : s0 < r.def.da && r.def.da <= s0 + ds;
    if (!passa) continue;
    punto(p.n, r.def.da, k.lat, 0, P3);
    const w = dove(r.n, P3[0], P3[1], P3[2], 0, 12);
    if (Math.abs(w.lat) <= campo(r.n, r.n.l, w.s) && w.s < 6) { cambiaNastro(k, p.n, r.def.da, r.n, w.s, w.lat, i); return; }
  }
}

/** Riparte dopo una caduta: un po' prima dell'ultimo punto a terra, in mezzo alla pista, dritto, a mezza velocità. */
function riparti(p: Pista, k: Veicolo, V: CVeicoloDef): void {
  const C = CORSE.caduta, indietro = 25;
  const sNuovo = p.n.chiuso ? posa(p, k.terra - indietro) : Math.max(0, k.terra - indietro);
  let d = k.ramo >= 0 ? 0 : sNuovo - k.s;
  if (p.n.chiuso) { if (d > p.n.len / 2) d -= p.n.len; else if (d < -p.n.len / 2) d += p.n.len; }
  if (k.ramo >= 0) {
    const r = p.rami[k.ramo]!;
    let dietro = r.def.da - sNuovo;
    if (p.n.chiuso && dietro < 0) dietro += p.n.len;
    d = -k.s * r.scala - dietro;
  }
  k.prog += d;
  k.ramo = -1; k.s = sNuovo; k.lat = 0; k.h = 0; k.vh = 0; k.hf = 1; k.hl = 0; k.mf = 1; k.ml = 0;
  k.v = V.velocita * C.ripartenza; k.aria = false; k.caduto = 0; k.drift = 0; k.carica = 0; k.turbo = 0; k.livello = 0; k.muro = false; k.acro = 0; k.scia = 0;
}

/** Un tick di guida: sterzo −1..1 (+ destra), gas −1..1, drift tenuto; `vmax` = moltiplicatore della velocità massima; `giro` = giro in corso (1…).
 *  `k.tenuto` (da quanto DRIFT è premuto) lo aggiorna gara.ts prima: 0 = premuto in questo tick. */
export function muovi(p: Pista, k: Veicolo, V: CVeicoloDef, sterzo: number, gas: number, btn: boolean, vmax: number, giro: number, R: Regole = REGOLE_TUTTE): void {
  const C = CORSE, K = C.veicolo, D = C.drift, F = C.famiglie[V.famiglia], G = C.gravita;
  if (k.caduto > 0) { k.caduto += DT; if (k.caduto >= C.caduta.secondi) riparti(p, k, V); return; }
  if (k.fermo > 0) { k.fermo = Math.max(0, k.fermo - DT); gas = 0; } // motore ingolfato: niente gas
  // DRIFT premuto in aria = acrobazia (−1 = salto da un'onda: lì il turbo lo dà già l'atterraggio dritto)
  if (k.aria && k.acro >= 0) k.acro = k.acro > 0 ? k.acro + DT : R.acrobazie && btn && k.tenuto === 0 && !k.drift ? DT : 0;
  const n = nastroDi(p, k.ramo);
  const sup = superficieA(p, k.ramo, k.s, k.lat, giro);
  k.sup = sup;
  const terra = !k.aria;
  const E = effetto(V, sup === VUOTO ? F.casa : sup);
  if (V.tira) sterzo = clamp(sterzo + V.tira, -1, 1);
  // ---- drift (a terra; in aria resta com'è) ----
  const sa = Math.abs(sterzo);
  if (terra) {
    if (!k.drift) {
      k.autoT = sa >= D.autoSterzo && gas > 0 ? k.autoT + DT : 0;
      const auto = D.autoSecondi > 0 && k.autoT >= D.autoSecondi;
      // col bottone: il lato si sceglie entro `pronto` s da quando lo premi (come il saltello di Mario Kart), poi non parte più finché non lo ripremi
      const bottone = btn && k.tenuto >= 0 && k.tenuto <= D.pronto;
      if ((bottone || auto) && sa >= D.tieniSterzo && k.v >= D.velocitaMin) { k.drift = sterzo > 0 ? 1 : -1; k.carica = 0; k.daBottone = btn; }
    } else {
      const tiene = (k.daBottone ? btn : sterzo * k.drift >= D.tieniSterzo) && k.v >= D.velocitaMin * 0.7 && gas > 0;
      if (!tiene) {
        const lv = livelloDrift(k.carica);
        if (lv) daiTurbo(k, D.spinta[lv - 1]!, lv, R.somma);
        k.drift = 0; k.carica = 0; k.autoT = 0;
      } else k.carica += DT * (1 + D.stringi * clamp(sterzo * k.drift, -1, 1)); // stringendo carica prima, allargando dopo
    }
  }
  // ---- velocità ----
  let top = V.velocita * vmax * E.velocita;
  if (k.turbo > 0) { top *= 1 + D.turbo; k.turbo = Math.max(0, k.turbo - DT); if (k.turbo === 0) k.livello = 0; }
  if (terra) {
    const acc = k.turbo > 0 ? D.turboAccelerazione : V.accelerazione * E.accelerazione * (k.v < 0 ? 2 : 1);
    if (gas > 0.05) {
      const t = top * gas;
      if (k.v < t) k.v = Math.min(t, k.v + acc * DT);
      else k.v = Math.max(t, k.v - (E.velocita < 0.9 ? K.frenata : K.folle * 2) * DT);
    } else if (gas < -0.3) {
      k.v = k.v > 0 ? Math.max(0, k.v - K.frenata * DT) : Math.max(-K.retro, k.v - K.retroAccelerazione * DT); // Jack (10 ott): la retro deve servire a staccarsi dal muro
    } else k.v = k.v > 0 ? Math.max(0, k.v - K.folle * DT) : Math.min(0, k.v + K.folle * DT);
    // la pendenza: la gravità lungo la direzione del moto (in salita frena, in discesa spinge); nei giri della morte conta poco
    const c = cella(n, k.s), gy = (n.ty[c.i]! + (n.ty[c.j]! - n.ty[c.i]!) * c.t) * k.mf + (n.ry[c.i]! + (n.ry[c.j]! - n.ry[c.i]!) * c.t) * k.ml;
    k.v -= G * gy * F.pendenza * (n.ad[c.i]! && n.ad[c.j]! ? 0.3 : 1) * DT;
    // la corrente spinge lungo la pista
    const sp = C.superfici[sup]?.spinta;
    if (sp && k.v < top * 1.15) k.v += sp[0] * DT;
    if (sp) k.lat += sp[1] * DT;
  }
  // ---- sterzo ----
  const presa = k.v < 0 ? -Math.min(1, -k.v / K.retroSterzoPieno) : Math.min(1, k.v / K.sterzoPieno);
  // fuori dal drift lo sterzo cala con la velocità (a tutta velocità −alto): le curve strette prese forte vogliono il drift
  const S = C.sterzo, alto = R.sterzo ? 1 - (F.sterzoAlto ?? S.alto) * clamp((Math.abs(k.v) - S.da) / Math.max(1, V.velocita - S.da), 0, 1) : 1;
  // in drift si gira verso il lato del drift; lo sterzo stringe o allarga (tieni = [base, ± quanto]). Jack (#170): «ruota troppo, quasi ingovernabile»
  const giri = k.drift ? k.drift * V.sterzo * V.drift * D.giro * (D.tieni[0] + D.tieni[1] * sterzo * k.drift) : sterzo * V.sterzo * (R.sterzo ? S.normale : 1) * alto;
  if (terra) {
    [k.hf, k.hl] = gira(k.hf, k.hl, giri * presa * DT);
    const g = (k.drift ? V.presaDrift : V.presa) * E.presa;
    [k.mf, k.ml] = verso(k.mf, k.ml, k.hf, k.hl, Math.min(0.45, g * DT));
  } else [k.hf, k.hl] = gira(k.hf, k.hl, giri * presa * 0.3 * DT); // in aria il muso si gira un filo, il moto no
  // ---- moto lungo il nastro: chi sta all'interno della curva fa meno strada ----
  const kap = campo(n, n.k, k.s), d = k.v * DT;
  const ds = (k.mf * d) / Math.max(0.4, 1 - kap * k.lat);
  k.lat += k.ml * d;
  const sPrima = k.s, ramoPrima = k.ramo;
  avanza(p, k, ds);
  // la pista gira sotto il veicolo: muso e moto ruotano al contrario
  [k.hf, k.hl] = gira(k.hf, k.hl, -kap * ds);
  [k.mf, k.ml] = gira(k.mf, k.ml, -kap * ds);
  verticale(p, k, V, sPrima, ramoPrima, giro, R);
  bordi(p, k);
  if (k.muro && k.drift) k.carica = 0; // contro il muro la carica del drift si perde
  if (!k.aria && k.ramo < 0 && superficieA(p, -1, k.s, k.lat, giro) !== VUOTO && Math.abs(k.lat) <= campo(p.n, p.n.l, k.s)) k.terra = k.s;
}

/** Salti, atterraggi, giri della morte, cadute; rampe, onde e tappeti del turbo. */
function verticale(p: Pista, k: Veicolo, V: CVeicoloDef, sPrima: number, ramoPrima: number, giro: number, R: Regole): void {
  const C = CORSE, G = C.gravita, F = C.famiglie[V.famiglia], n = nastroDi(p, k.ramo), c = cella(n, k.s);
  const uy = n.uy[c.i]! + (n.uy[c.j]! - n.uy[c.i]!) * c.t, kv = n.kv[c.i]! + (n.kv[c.j]! - n.kv[c.i]!) * c.t, ad = n.ad[c.i]! && n.ad[c.j]!;
  const sup = superficieA(p, k.ramo, k.s, k.lat, giro);
  const l = campo(n, n.l, k.s), lim = l + bordoDi(p, k.ramo);
  const suolo = sup !== VUOTO && Math.abs(k.lat) <= lim + 0.01;
  if (k.aria) {
    // in aria: la gravità tira giù e la pista curva sotto di te (sui dossi si sale rispetto a lei)
    k.vh += (-G * uy - k.v * k.v * kv) * DT;
    k.h += k.vh * DT;
    if (k.h <= 0 && k.h > -0.8 && suolo) { // sotto la pista di più vuol dire che si è già passati di sotto
      const urto = -k.vh;
      k.h = 0; k.vh = 0; k.aria = false;
      if (urto > C.atterraggio.duro) k.v *= C.atterraggio.perdita;
      const at = F.atterraggioTurbo;
      if (at && Math.abs(k.hf * k.ml - k.hl * k.mf) < at.allineato && k.v > 5) { k.turbo = Math.max(k.turbo, at.secondi); k.livello = Math.max(k.livello, 1); }
      if (k.acro > 0) daiTurbo(k, C.acrobazia.turbo, 2, R.somma);
      k.acro = 0;
    } else if (k.h < -C.caduta.quota || (ad && k.h > 4)) { k.caduto = DT; k.cadute++; }
    return;
  }
  if (!suolo) { k.aria = true; k.vh = 0; k.h = 0; return; } // niente sotto: si cade
  // attaccati alla pista finché la spinta verso la superficie basta (nei giri della morte: finché si va abbastanza forte)
  const normale = k.v * k.v * kv + G * uy;
  if (ad ? uy < 0.3 && Math.abs(k.v) < C.giroVelocitaMin : normale < -1) { k.aria = true; k.vh = 0; k.salti++; return; }
  k.h = 0; k.vh = 0;
  if (k.ramo !== ramoPrima || k.v <= 0) return;
  const passa = (s: number) => (k.s >= sPrima ? sPrima < s && s <= k.s : sPrima < s || s <= k.s);
  if (k.ramo < 0) {
    for (const r of p.def.rampe) {
      if (passa(r.s) && (!r.lat || (k.lat >= r.lat[0] && k.lat <= r.lat[1]))) {
        k.aria = true; k.vh = Math.max(r.salto, k.v * C.rampa.quota); k.salti++; return;
      }
    }
  }
  for (const t of k.ramo < 0 ? p.def.turbo : p.rami[k.ramo]!.def.turbo ?? []) {
    const dentro = k.s >= t.s && k.s < t.s + t.lungo && k.lat >= t.lat[0] && k.lat <= t.lat[1];
    if (dentro) { k.turbo = Math.max(k.turbo, C.tappetoTurbo); k.livello = 2; }
  }
  // creste delle onde: chi galleggia salta, tanto più quanto va forte
  const onde = C.superfici[sup]?.onde;
  if (onde && F.onde && Math.floor(k.s / onde.passo) !== Math.floor(sPrima / onde.passo) && k.v > 8) {
    k.aria = true; k.vh = Math.min(F.onde.max, F.onde.salto * k.v); k.salti++; k.acro = -1;
  }
}

/** Livello della carica del drift: 0 (niente), 1 blu, 2 arancio, 3 viola. */
export function livelloDrift(carica: number): number {
  const c = CORSE.drift.carica;
  return carica >= c[2] ? 3 : carica >= c[1] ? 2 : carica >= c[0] ? 1 : 0;
}

/** Muri e bordi: col muro si striscia (e si frena la prima volta), senza muro si vola giù. */
function bordi(p: Pista, k: Veicolo): void {
  const n = nastroDi(p, k.ramo), lim = campo(n, n.l, k.s) + bordoDi(p, k.ramo);
  if (Math.abs(k.lat) <= lim) { k.muro = false; return; }
  const lato = k.lat > 0 ? 1 : -1;
  if (!muroA(p, k.ramo, k.s, lato)) { if (!k.aria) { k.aria = true; k.vh = 0; } k.muro = false; return; }
  if (k.aria && k.h > 1.2) return; // in aria alta si passa sopra il muretto (si ricade dentro o fuori)
  k.lat = lato * lim;
  if (!k.muro) k.v *= p.def.muro;
  const sv = k.mf < 0 ? -1 : 1;
  [k.mf, k.ml] = verso(k.mf, k.ml, sv, 0, 0.45); // si striscia lungo il muro
  k.muro = true;
}

/** Separa i veicoli che si toccano sullo stesso nastro (in ordine fisso: deterministico). Chi pesa di più sposta di più. */
export function urti(p: Pista, ks: Veicolo[], pesi: number[]): void {
  const r2 = CORSE.veicolo.raggio * 2;
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = ks[i]!, b = ks[j]!;
    if (a.ramo !== b.ramo || a.caduto || b.caduto || Math.abs(a.h - b.h) > 1.5) continue;
    const n = nastroDi(p, a.ramo);
    let ds = b.s - a.s;
    if (n.chiuso) { if (ds > n.len / 2) ds -= n.len; else if (ds < -n.len / 2) ds += n.len; }
    const dl = b.lat - a.lat, d2 = ds * ds + dl * dl;
    if (d2 >= r2 * r2) continue;
    const d = Math.sqrt(d2) || 0.001, push = r2 - d, nf = ds / d, nl = dl / d;
    const wa = pesi[j]! / (pesi[i]! + pesi[j]!), wb = 1 - wa;
    a.lat -= nl * push * wa; b.lat += nl * push * wb;
    a.s -= nf * push * wa; b.s += nf * push * wb; a.prog -= nf * push * wa; b.prog += nf * push * wb;
    if (n.chiuso) { a.s = (a.s + n.len) % n.len; b.s = (b.s + n.len) % n.len; } else { a.s = clamp(a.s, 0, n.len); b.s = clamp(b.s, 0, n.len); }
    // chi è dietro perde un filo di velocità
    if (a.prog < b.prog) a.v *= 0.985; else b.v *= 0.985;
  }
}
