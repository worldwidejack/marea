// La guida sui binari (#228, docs/CORSE.md A6): i carrelli da miniera della Giungla. Il carrello sta sempre su una rotaia:
// - la pendenza spinge forte (in discesa si vola), il GAS è la leva che spinge in piano, il FRENO frena; niente retromarcia;
// - nelle curve conta la spinta di lato (v² × curvatura): sopra il limite si va su due ruote e il carrello frena da solo;
//   molto sopra (chi entra lanciato senza piegarsi), se ci si resta, si deraglia;
// - piegarsi verso l'interno (lo sterzo) alza il limite; piegati al limite si carica il turbo a 3 livelli, come il drift,
//   e parte raddrizzandosi o uscendo dalla curva;
// - DRIFT = salto: in aria lo sterzo sceglie la rotaia accanto (così si cambiano binario, si prendono i bivi e si saltano le rotaie
//   rotte); atterrare lontano da una rotaia è un deragliamento.
// I bivi sono rami con le loro rotaie: ci entra chi passa l'imbocco sulla rotaia giusta. Solo + − × ÷ e Math.sqrt.
import { CORSE } from '@marea/content/corse.ts';
import type { CVeicoloDef } from '@marea/content/corse.ts';
import { TICK_HZ } from '../constants.ts';
import { campo, cella } from './nastro.ts';
import { VUOTO, effetto, nastroDi, rotaieDi, superficieA } from './pista.ts';
import type { Pista } from './pista.ts';
import { avanza, daiTurbo, livelloDrift, riparti, verticale } from './veicolo.ts';
import type { Regole, Veicolo } from './veicolo.ts';

const DT = 1 / TICK_HZ;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** L'indice della rotaia più vicina a `lat`. */
export function rotaiaVicina(rot: readonly number[], lat: number): number {
  let best = 0;
  for (let i = 1; i < rot.length; i++) if (Math.abs(rot[i]! - lat) < Math.abs(rot[best]! - lat)) best = i;
  return best;
}

/** Il limite della spinta di lato (m/s²) con la piega `dentro` (−1..1, + = verso l'interno della curva). Piegati fuori tiene meno. */
export function limiteCurva(V: CVeicoloDef, presaSup: number, dentro: number): number {
  const B = CORSE.famiglie.binari.binari!;
  return B.presa * (V.presaCurva ?? 1) * presaSup * (1 + (B.piega - 1) * clamp(dentro, 0, 1)) * (1 - 0.25 * clamp(-dentro, 0, 1));
}

/** Deraglia: si cade (dopo `caduta.secondi` si riparte da dove si era a terra, su una rotaia). */
function deraglia(k: Veicolo): void {
  k.caduto = DT; k.cadute++; k.aria = true; k.vh = 2; k.drift = 0; k.carica = 0; k.bilico = 0;
}

/** Un tick sui binari: sterzo = piega (−1..1), gas = leva (sotto −0,3 freno), btn = DRIFT (salto). Stessa firma di `muovi`. */
export function muoviBinari(p: Pista, k: Veicolo, V: CVeicoloDef, sterzo: number, gas: number, btn: boolean, vmax: number, giro: number, R: Regole): void {
  const C = CORSE, F = C.famiglie[V.famiglia], B = F.binari!, D = C.drift, K = C.veicolo, G = C.gravita;
  if (k.caduto > 0) {
    k.caduto += DT;
    if (k.caduto >= C.caduta.secondi) {
      riparti(p, k, V);
      // si riparte sulla rotaia più vicina al centro che non ha buchi nei prossimi 50 m (sennò si ricadrebbe nello stesso punto)
      const rot = rotaieDi(p, -1), libera = (i: number) => { for (let d = 0; d <= 50; d += 1.5) if (superficieA(p, -1, p.n.chiuso ? (k.s + d) % p.n.len : Math.min(p.n.len, k.s + d), rot[i]!, giro) === VUOTO) return false; return true; };
      k.rot = rotaiaVicina(rot, 0);
      if (!libera(k.rot)) for (let d = 1; d < rot.length; d++) { if (k.rot + d < rot.length && libera(k.rot + d)) { k.rot += d; break; } if (k.rot - d >= 0 && libera(k.rot - d)) { k.rot -= d; break; } }
      k.lat = rot[k.rot]!; k.piega = 0; k.bilico = 0;
    }
    return;
  }
  if (k.fermo > 0) { k.fermo = Math.max(0, k.fermo - DT); gas = 0; } // motore ingolfato: la leva non spinge
  let rot = rotaieDi(p, k.ramo);
  if (k.rot < 0 || k.rot >= rot.length) k.rot = rotaiaVicina(rot, k.lat);
  // la piega segue lo sterzo, alla velocità del carrello (in aria resta com'è)
  if (!k.aria) k.piega += clamp(sterzo - k.piega, -V.sterzo * DT, V.sterzo * DT);
  // DRIFT: a terra salta (in aria, un'altra pressione è l'acrobazia, ma non nei salti fatti da sé: −1 come le onde)
  if (k.aria && k.acro >= 0) k.acro = k.acro > 0 ? k.acro + DT : R.acrobazie && btn && k.tenuto === 0 && !k.drift ? DT : 0;
  if (!k.aria && btn && k.tenuto === 0 && k.v > 2) {
    k.aria = true; k.vh = B.salto; k.salti++; k.acro = -1; k.rot0 = k.rot;
    if (k.drift) { const lv = livelloDrift(k.carica); if (lv) daiTurbo(k, D.spinta[lv - 1]!, lv, R.somma); k.drift = 0; k.carica = 0; }
  }
  // in aria lo sterzo sceglie la rotaia: quella accanto dalla parte dove spingi, o quella da cui sei saltato
  if (k.aria && k.rot0 >= 0) k.rot = clamp(k.rot0 + (sterzo > 0.4 ? 1 : sterzo < -0.4 ? -1 : 0), 0, rot.length - 1);
  const n = nastroDi(p, k.ramo), sup = superficieA(p, k.ramo, k.s, k.lat, giro);
  k.sup = sup;
  const E = effetto(V, sup === VUOTO ? F.casa : sup), terra = !k.aria;
  // ---- velocità: leva, freno, pendenza, attrito oltre il massimo della leva ----
  let top = V.velocita * vmax * E.velocita;
  if (k.turbo > 0) { top *= 1 + D.turbo; k.turbo = Math.max(0, k.turbo - DT); if (k.turbo === 0) k.livello = 0; }
  const c = cella(n, k.s);
  if (terra) {
    const acc = k.turbo > 0 ? D.turboAccelerazione : V.accelerazione * E.accelerazione;
    if (gas > 0.05) { if (k.v < top * gas) k.v = Math.min(top * gas, k.v + acc * DT); }
    else if (gas < -0.3) k.v = k.v > 0 ? Math.max(0, k.v - K.frenata * DT) : Math.min(0, k.v + K.frenata * DT);
    else k.v = k.v > 0 ? Math.max(0, k.v - K.folle * 0.3 * DT) : Math.min(0, k.v + K.folle * 0.3 * DT); // il carrello rotola
    const gy = n.ty[c.i]! + (n.ty[c.j]! - n.ty[c.i]!) * c.t;
    k.v -= G * gy * F.pendenza * (n.ad[c.i]! && n.ad[c.j]! ? 0.3 : 1) * DT;
    if (k.v > top) k.v -= B.attrito * (k.v - top) * DT;
    k.v = Math.max(-K.retro, k.v); // in salita, senza spinta, si torna indietro
  }
  // ---- curve: spinta di lato, due ruote, deragliamento, carica del turbo ----
  const kap = campo(n, n.k, k.s), lato = kap > 0 ? 1 : -1, dentro = k.piega * lato;
  const lim = limiteCurva(V, E.presa, dentro), quota = (k.v * k.v * Math.abs(kap)) / lim;
  if (terra) {
    if (quota > 1) k.v = Math.max(0, k.v - B.frenaBilico * (quota - 1) * DT); // su due ruote: le ruote di fuori strisciano
    if (quota > B.deraglia) { k.bilico += DT; if (k.bilico >= B.bilico) { deraglia(k); return; } } // un attimo di troppo si perdona
    else k.bilico = 0;
    if (quota >= B.carica && dentro > 0.5 && k.v >= D.velocitaMin) {
      if (k.drift !== lato) { k.drift = lato; k.carica = 0; }
      k.carica += DT * (1 + D.stringi * clamp((quota - B.carica) / (1 - B.carica), 0, 1)); // più vicino al limite, prima carica
    } else if (k.drift && (quota < B.scarica || dentro < 0.2)) {
      const lv = livelloDrift(k.carica);
      if (lv) daiTurbo(k, D.spinta[lv - 1]!, lv, R.somma);
      k.drift = 0; k.carica = 0;
    }
  }
  // ---- di lato: verso la rotaia (in aria quella scelta, a terra si scivola sullo scambio dopo un bivio) ----
  const latPrima = k.lat, voluta = rot[k.rot]!, passo = B.cambio * DT;
  k.lat += clamp(voluta - k.lat, -passo, passo);
  // ---- avanti lungo il nastro: chi sta all'interno della curva fa meno strada ----
  const ds = (k.v * DT) / Math.max(0.4, 1 - kap * k.lat), sPrima = k.s, ramoPrima = k.ramo;
  k.hf = 1; k.hl = 0; k.mf = 1; k.ml = 0;
  avanza(p, k, ds);
  if (k.ramo !== ramoPrima) { rot = rotaieDi(p, k.ramo); k.rot = rotaiaVicina(rot, k.lat); k.rot0 = k.aria ? k.rot : -1; }
  const eraInAria = k.aria;
  verticale(p, k, V, sPrima, ramoPrima, giro, R);
  if (eraInAria && !k.aria) { // atterrato: sulla rotaia o fuori
    const r = rotaiaVicina(rot, k.lat);
    if (Math.abs(rot[r]! - k.lat) > B.tolleranza) { deraglia(k); return; }
    k.rot = r; k.rot0 = -1;
  }
  // il muso guarda un filo dove va di lato (per il disegno): il moto resta lungo la rotaia
  const vl = (k.lat - latPrima) / DT, hl = clamp(vl / Math.max(4, Math.abs(k.v)), -0.35, 0.35);
  k.hl = hl; k.hf = Math.sqrt(1 - hl * hl);
  if (!k.aria && k.ramo < 0 && superficieA(p, -1, k.s, k.lat, giro) !== VUOTO) k.terra = k.s;
}
