// Snowboard dell'Isola dell'Adrenalina (docs/ADRENALINA.md §7, bozza del 12 ott 2026; CONTRACTS §42): discesa arcade su una pista a
// nastro (`adrenalina/pista.ts`, il nastro delle Corse aperto), punti per porte, salti, trick e presa, tutto per la barra Adrenalina.
// - A terra: `mx` curva (velocità di lato pronta, una curva stretta frena), niente gas (spinge la pendenza). `a` tenuto = accucciato
//   che carica; lasciare = salto (sul trampolino conta quando: proprio sul bordo è il salto grande; se non lasci voli basso).
// - In aria: un gesto (un fronte di `my` o `mx` oltre 0,5) fa un trick (su = mortale avanti, giù = indietro, destra/sinistra = 360),
//   uno dopo l'altro nello stesso salto (combo). `a` premuto di nuovo in aria = presa, vale finché tieni. Atterrare a metà di un trick
//   o ancora in presa = caduta.
// - Su un dosso o un bordo (la cornice, la roccia) a velocità ci si stacca da soli: per restare attaccati alla neve servirebbe più
//   della gravità (v²·curvatura). Atterrare troppo duro (in piano da troppo in alto) è una caduta.
// - Caduta (albero, roccia, bosco oltre la neve fresca, atterraggio storto o troppo duro): 2 s fermi, barra a zero, si riparte da lì.
// Coordinate di pista: s (m lungo il centro), lat (m, + = destra); in aria la quota `y` è quella del mondo (la neve sotto scende).
// Solo + − × ÷ e Math.sqrt (tools/check_static.mjs): il server rigioca gli input (passo 3b).
import { BARRA, SNOWBOARD } from '@marea/content/adrenalina.ts';
import type { SnowboardTrickId } from '@marea/content/adrenalina.ts';
import { DT } from '../constants.ts';
import type { InputFrame } from '../types.ts';
import type { MinigameModule, MinigameOpzioni } from './types.ts';
import { azzeraBarra, moltiplicatore, nuovaBarra, passoBarra, riempiBarra } from '../adrenalina/barra.ts';
import type { Barra } from '../adrenalina/barra.ts';
import { altezzaRampa, bordoA, curvaturaA, fuoripistaA, neveA, pendenzaA, pistaSnowboard, quotaA, rampaA } from '../adrenalina/pista.ts';
import type { PistaNeve } from '../adrenalina/pista.ts';

export const TRICKS: readonly SnowboardTrickId[] = ['avanti', 'indietro', 'giro_dx', 'giro_sx'];
export type EventoNeve = { t: number; k: 'porta' | 'mancata' | 'trick' | 'presa' | 'atterra' | 'caduta' | 'rasente' | 'grande' | 'fuoripista' | 'rientro' | 'arrivo'; n: number; x?: string };
export type SnowState = {
  tick: number; pista: string;
  s: number; lat: number; v: number; vl: number; y: number; vy: number; h: number; aria: boolean;
  /** 0-1 accucciato; `tenuto` = `a` del tick prima; `rilascio` = tick in cui hai lasciato; `rilRampa` = indice del trampolino dove hai lasciato. */
  carica: number; tenuto: boolean; rilascio: number; rilRampa: number;
  /** Trick in corso (indice in TRICKS, −1 = nessuno) e secondi da quando è partito. */
  trick: number; trickT: number;
  presa: boolean; presaT: number;
  /** Il salto in corso: secondi in aria, quota massima sopra la neve, trick chiusi, punti in sospeso (prima della barra), quando si è chiuso l'ultimo, salto grande. */
  ariaT: number; hMax: number; combo: number; sospesi: number; chiuso: number; grande: boolean;
  /** L'ultimo gesto (per sentire il fronte). */
  gesto: number;
  /** Secondi di caduta che restano (0 = in piedi), perché. */
  caduta: number; perche: string;
  barra: Barra;
  punti: number; porta: number; porte: number; mancate: number; cadute: number; salti: number; trickFatti: number; maxCombo: number;
  /** Ostacoli già rasentati (indice → 1). */
  visti: number[];
  eventi: EventoNeve[];
  done: boolean; arrivato: boolean; arrivoTick: number;
};

const C = SNOWBOARD, F = SNOWBOARD.fisica, J = SNOWBOARD.salto;
const MAX_TICKS = Math.round(C.maxSecondi / DT);
/** Altezza degli ostacoli (m): sopra si passa in volo. */
const ALTO = { abete: 5, roccia: 1.6 } as const;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const abs = (v: number) => (v < 0 ? -v : v);

function evento(s: SnowState, k: EventoNeve['k'], n: number, x?: string): void {
  s.eventi.push(x === undefined ? { t: s.tick, k, n } : { t: s.tick, k, n, x });
  if (s.eventi.length > 8) s.eventi.shift();
}
/** Dove sta la neve sotto i piedi: la pista, più la salita del trampolino. */
function suolo(p: PistaNeve, s: number, lat: number): number {
  const r = rampaA(p, s, lat);
  return quotaA(p, s, lat) + (r >= 0 ? altezzaRampa(p.def.rampe[r]!, s) : 0);
}
function decolla(s: SnowState, vy: number, grande: boolean): void {
  s.aria = true; s.vy = vy; s.ariaT = 0; s.hMax = 0; s.combo = 0; s.sospesi = 0; s.chiuso = -1; s.grande = grande;
  s.carica = 0; s.trick = -1; s.presa = false; s.gesto = 0;
  if (grande) { riempiBarra(s.barra, BARRA, 'salto_grande'); evento(s, 'grande', 0); }
}
function cade(s: SnowState, p: PistaNeve, perche: string): void {
  s.caduta = C.caduta; s.perche = perche; s.cadute++;
  s.v = 0; s.vl = 0; s.aria = false; s.vy = 0; s.h = 0; s.y = quotaA(p, s.s, s.lat);
  s.trick = -1; s.presa = false; s.carica = 0; s.combo = 0; s.sospesi = 0;
  azzeraBarra(s.barra);
  evento(s, 'caduta', 0, perche);
}
/** Di nuovo in piedi dove sei caduto: dentro la pista e lontano dall'ostacolo che ti ha fermato. */
function riparti(s: SnowState, p: PistaNeve): void {
  const l = bordoA(p, s.s);
  s.lat = clamp(s.lat, -(l - 1.5), l - 1.5);
  for (const o of p.def.ostacoli) {
    if (abs(o.s - s.s) > o.r + 2) continue;
    const d = s.lat - o.lat, m = o.r + C.corpo + 0.8;
    if (abs(d) < m) s.lat = clamp(o.lat + (d >= 0 ? m : -m), -(l - 0.5), l - 0.5);
  }
  s.caduta = 0; s.v = F.vRipartenza; s.y = suolo(p, s.s, s.lat);
}

function nuova(o: { opzioni?: MinigameOpzioni }): SnowState {
  const id = o.opzioni?.['pista'] ?? 'snowboard_verde';
  const p = pistaSnowboard(id), s0 = p.def.partenza;
  return {
    tick: 0, pista: id, s: s0, lat: 0, v: F.vPartenza, vl: 0, y: quotaA(p, s0, 0), vy: 0, h: 0, aria: false,
    carica: 0, tenuto: false, rilascio: -999, rilRampa: -1, trick: -1, trickT: 0, presa: false, presaT: 0,
    ariaT: 0, hMax: 0, combo: 0, sospesi: 0, chiuso: -1, grande: false, gesto: 0, caduta: 0, perche: '',
    barra: nuovaBarra(), punti: 0, porta: 0, porte: 0, mancate: 0, cadute: 0, salti: 0, trickFatti: 0, maxCombo: 0,
    visti: p.def.ostacoli.map(() => 0), eventi: [], done: false, arrivato: false, arrivoTick: 0,
  };
}

function atterra(s: SnowState, p: PistaNeve, quota: number): void {
  // la botta: la velocità contro la neve, lungo la sua normale (su un pendio ripido si atterra morbidi, in piano no)
  const sn = pendenzaA(p, s.s), cs = Math.sqrt(1 - sn * sn), botta = -(s.v * cs * sn + s.vy * cs);
  s.aria = false; s.y = quota; s.vy = 0; s.h = 0;
  if (botta > F.botta) { cade(s, p, 'botta'); return; }
  // su un pendio ripido la caduta diventa velocità lungo la neve (come nella realtà: si atterra in discesa e si riparte forte)
  if (botta > 0) s.v = clamp(s.v + (botta / cs) * sn, 0, F.vmax);
  if (s.trick >= 0) { cade(s, p, 'storto'); return; }
  if (s.presa) { cade(s, p, 'presa'); return; }
  const molt = moltiplicatore(s.barra, BARRA);
  if (s.chiuso >= 0 && s.ariaT - s.chiuso <= C.ultimoIstante) riempiBarra(s.barra, BARRA, 'ultimo_istante');
  if (s.ariaT >= J.lungo) riempiBarra(s.barra, BARRA, 'salto_lungo');
  const salto = s.hMax > 1 ? s.hMax * C.punti.saltoMetro : 0;
  if (s.hMax > 1) s.salti++;
  const tot = Math.round((s.sospesi + salto) * molt);
  if (tot > 0) { s.punti += tot; evento(s, 'atterra', tot, molt > 1 ? `×${molt}` : undefined); }
  if (s.combo > s.maxCombo) s.maxCombo = s.combo;
  s.combo = 0; s.sospesi = 0; s.chiuso = -1;
}

function step(s: SnowState, f: InputFrame): void {
  if (s.done) return;
  const p = pistaSnowboard(s.pista), d = p.def;
  s.tick++;
  const s0 = s.s;
  passoBarra(s.barra, BARRA, DT);
  const a = f.a, mx = clamp(f.mx, -1, 1), my = clamp(f.my, -1, 1);
  if (s.caduta > 0) {
    s.caduta -= DT;
    if (s.caduta <= 0) riparti(s, p);
    s.tenuto = a;
  } else if (!s.aria) {
    // ---- a terra: la pendenza spinge, la curva stretta frena, la neve fresca rallenta ----
    let v = s.v + (C.fisica.gravita * pendenzaA(p, s.s) - (s.v > 0 ? F.attrito : 0) - F.aria * s.v * s.v) * DT;
    const voluto = mx * (s.v * F.latFrazione < F.latMax ? s.v * F.latFrazione : F.latMax);
    s.vl += (voluto - s.vl) * (F.presaCurva * DT < 1 ? F.presaCurva * DT : 1);
    v -= F.frenoCurva * mx * mx * v * DT;
    if (abs(s.lat) > bordoA(p, s.s) && v > F.vNeve) v -= (v - F.vNeve) * F.frenoNeve * DT;
    else if (fuoripistaA(p, s.s) && v > F.vFuoripista) v -= (v - F.vFuoripista) * F.frenoNeve * DT;
    s.v = clamp(v, 0, F.vmax);
    // ---- il salto: tieni = carica, lasci = salti (sul trampolino si aspetta il bordo) ----
    const rampa = rampaA(p, s.s, s.lat);
    if (a) s.carica = s.carica + DT / J.carica > 1 ? 1 : s.carica + DT / J.carica;
    if (s.tenuto && !a) {
      s.rilascio = s.tick; s.rilRampa = rampa;
      if (rampa < 0) decolla(s, J.ollie + J.ollieCarica * s.carica, false);
    }
    if (!a && rampa < 0) s.carica = 0;
    s.tenuto = a;
    const prima = s.s;
    s.s += s.v * DT; s.lat += s.vl * DT;
    // sul bordo del trampolino si vola sempre: grande se hai lasciato proprio lì, basso se tieni ancora
    for (let i = 0; i < d.rampe.length && !s.aria; i++) {
      const r = d.rampe[i]!;
      if (!(prima < r.s && s.s >= r.s && s.lat >= r.lat[0] && s.lat <= r.lat[1])) continue;
      const dopo = (s.tick - s.rilascio) * DT, mio = s.rilRampa === i && !a;
      const k = !mio ? J.basso : dopo <= J.grande ? 1 : dopo <= J.finestra ? (1 + J.basso) / 2 : J.basso;
      // la spinta del trampolino è rispetto alla neve che scende: su un pendio ripido si parte già in discesa con lei
      s.y = quotaA(p, s.s, s.lat) + r.alto;
      decolla(s, r.salto * k - s.v * pendenzaA(p, s.s), mio && dopo <= J.grande);
      s.rilRampa = -1;
    }
    // il dosso: se per seguire la neve servisse più della gravità, si vola (con la velocità verticale che si aveva)
    const kv = curvaturaA(p, s.s);
    if (!s.aria && kv < 0 && s.v * s.v * -kv > C.fisica.gravita * F.stacco && rampaA(p, s.s, s.lat) < 0) {
      const vy = -s.v * pendenzaA(p, s.s), a0 = s.tenuto;
      decolla(s, vy, false); s.tenuto = a0;
    }
    if (!s.aria) { s.y = suolo(p, s.s, s.lat); s.h = 0; }
  } else {
    // ---- in aria: si vola dritti, i gesti fanno i trick, `a` premuto di nuovo è la presa ----
    s.ariaT += DT;
    s.vy -= C.fisica.gravita * DT;
    s.y += s.vy * DT;
    s.v = clamp(s.v - F.aria * s.v * s.v * DT, 0, F.vmax);
    s.s += s.v * DT; s.lat += s.vl * DT;
    const g = abs(my) >= abs(mx) ? (my > 0.5 ? 1 : my < -0.5 ? 2 : 0) : mx > 0.5 ? 3 : mx < -0.5 ? 4 : 0;
    if (g && !s.gesto && s.trick < 0 && !s.presa) { s.trick = g - 1; s.trickT = 0; }
    s.gesto = g;
    if (s.trick >= 0) {
      s.trickT += DT;
      const t = C.trick[TRICKS[s.trick]!];
      if (s.trickT >= t.durata) {
        s.combo++; s.trickFatti++;
        const n = t.punti * (1 + C.combo * (s.combo - 1));
        s.sospesi += n; s.chiuso = s.ariaT; s.trick = -1;
        evento(s, 'trick', Math.round(n), s.combo > 1 ? `${t.nome} ×${s.combo}` : t.nome);
      }
    }
    if (a && !s.tenuto && s.trick < 0 && !s.presa) { s.presa = true; s.presaT = 0; }
    if (s.presa) {
      if (a) s.presaT += DT;
      else {
        s.presa = false;
        if (s.presaT >= C.presa.minima) { const n = s.presaT * C.presa.puntiSecondo; s.sospesi += n; s.chiuso = s.ariaT; evento(s, 'presa', Math.round(n)); }
      }
    }
    s.tenuto = a;
    const q = suolo(p, s.s, s.lat);
    s.h = s.y - q;
    if (s.h > s.hMax) s.hMax = s.h;
    if (s.h <= 0 && s.vy < 0) atterra(s, p, q);
  }
  if (s.caduta <= 0) {
    // ---- il bosco oltre la neve fresca (nella gola la roccia), gli ostacoli, le porte ----
    const l = bordoA(p, s.s);
    // al bivio del fuoripista il sentiero gira a sinistra: chi va dritto (a destra del sentiero) finisce contro l'abete caduto
    const bivio = !!d.fuoripista && s.s >= d.fuoripista.da && s.s < d.fuoripista.da + 40 && s.lat > 0;
    if (s.h < 2 && abs(s.lat) > l + neveA(p, s.s)) cade(s, p, bivio ? 'tronco' : neveA(p, s.s) > 0 ? 'bosco' : 'roccia');
    for (let i = 0; i < d.ostacoli.length && s.caduta <= 0; i++) {
      const o = d.ostacoli[i]!, ds = o.s - s.s;
      if (ds < -3) continue;
      if (ds > 3) break;
      if (s.h > ALTO[o.tipo]) continue;
      const dl = o.lat - s.lat, d2 = ds * ds + dl * dl, r = o.r + C.corpo;
      if (d2 < r * r) cade(s, p, o.tipo);
      else if (!s.visti[i] && d2 < (r + C.rasente) * (r + C.rasente)) { s.visti[i] = 1; riempiBarra(s.barra, BARRA, 'rasente'); evento(s, 'rasente', 0, o.tipo); }
    }
  }
  const fp = d.fuoripista;
  if (fp && s0 < fp.da && s.s >= fp.da) evento(s, 'fuoripista', 0);
  if (fp && s0 < fp.a && s.s >= fp.a) evento(s, 'rientro', 0);
  while (s.porta < d.porte.length && s.s >= d.porte[s.porta]!.s) {
    const g = d.porte[s.porta++]!, dentro = g.w / 2 - abs(s.lat - g.lat);
    if (dentro >= 0 && s.caduta <= 0) {
      s.porte++;
      const n = C.punti.porta * moltiplicatore(s.barra, BARRA);
      s.punti += n; evento(s, 'porta', n);
      if (dentro < C.rasente) riempiBarra(s.barra, BARRA, 'palo');
    } else { s.mancate++; s.punti -= C.punti.portaMancata; evento(s, 'mancata', -C.punti.portaMancata); }
  }
  if (s.s >= d.arrivo && !s.aria) { s.done = true; s.arrivato = true; s.arrivoTick = s.tick; evento(s, 'arrivo', 0); }
  else if (s.tick >= MAX_TICKS) s.done = true;
}

/** Il pilota automatico (test, autopilota, il punteggio di riferimento delle medaglie al 3b). `pigro` = niente trick né presa. */
export function pilotaSnowboard(s: SnowState, pigro = false): InputFrame {
  const p = pistaSnowboard(s.pista), d = p.def, l = bordoA(p, s.s);
  if (s.caduta > 0 || s.done) return { mx: 0, my: 0, a: false, b: false };
  if (s.aria) {
    // tempo prima di toccare (neve piatta: in discesa ce n'è un po' di più)
    const g = C.fisica.gravita, resta = (s.vy + Math.sqrt(s.vy * s.vy + 2 * g * (s.h > 0 ? s.h : 0))) / g;
    if (s.presa) return { mx: 0, my: 0, a: resta > 0.25, b: false };
    if (pigro || s.trick >= 0 || s.gesto) return { mx: 0, my: 0, a: false, b: false };
    const t = C.trick[TRICKS[s.combo % 2 ? 2 : 0]!];
    if (resta > t.durata + 0.2) return s.combo % 2 ? { mx: 1, my: 0, a: false, b: false } : { mx: 0, my: 1, a: false, b: false };
    if (resta > 0.6 && !s.tenuto) return { mx: 0, my: 0, a: true, b: false };
    return { mx: 0, my: 0, a: false, b: false };
  }
  // ---- a terra: verso la prossima porta o il prossimo trampolino, scansando gli ostacoli ----
  let meta = 0, entro = 1e9;
  const g = d.porte[s.porta];
  if (g && g.s - s.s < 70) { meta = g.lat; entro = g.s - s.s; }
  let rampa = -1;
  for (let i = 0; i < d.rampe.length; i++) { const r = d.rampe[i]!; if (r.s > s.s && r.s - s.s < 45 && r.s - s.s < entro + 25) { rampa = i; meta = (r.lat[0] + r.lat[1]) / 2; break; } }
  for (const o of d.ostacoli) {
    const ds = o.s - s.s;
    if (ds < -1 || ds > 22) continue;
    const m = o.r + C.corpo + 1.4;
    if (abs(meta - o.lat) < m) meta = o.lat + (s.lat >= o.lat ? m : -m);
  }
  meta = clamp(meta, -(l - 1.2), l - 1.2);
  const vlMax = s.v * F.latFrazione < F.latMax ? s.v * F.latFrazione : F.latMax;
  const mx = clamp(((meta - s.lat) * 1.1 - s.vl * 0.15) / (vlMax > 1 ? vlMax : 1), -1, 1);
  let a = false;
  if (rampa >= 0) {
    const r = d.rampe[rampa]!, t = (r.s - s.s) / (s.v > 1 ? s.v : 1);
    a = s.s > r.s - r.lungo - 12 && t > 0.07;
  }
  return { mx, my: 0, a, b: false };
}

/** I tempi della discesa (ms): quello vero, gli abbuoni (punti → secondi), le penalità (porte mancate), il finale che fa classifica.
 *  Chi non arriva non ha tempo finale (Infinity). */
export function tempiSnowboard(s: SnowState): { ms: number; abbuono: number; penalita: number; finale: number } {
  const ms = Math.round((s.arrivato ? s.arrivoTick : s.tick) * DT * 1000), T = C.tempo;
  const abbuono = Math.round(((s.punti > 0 ? s.punti : 0) / T.puntiAlSecondo) * 1000), penalita = s.mancate * T.portaMancata * 1000;
  const f = ms - abbuono + penalita;
  return { ms, abbuono, penalita, finale: s.arrivato ? (f > 0 ? f : 0) : Infinity };
}

export type SnowView = SnowState & { molt: 1 | 2 | 3; bordo: number; neve: number; len: number; arrivo: number };
export const snowboard: MinigameModule<SnowState> = {
  id: 'snowboard',
  version: 1,
  maxTicks: MAX_TICKS,
  create: (o) => nuova(o),
  opzioni: (v) => {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, id = String(o['pista'] ?? '');
    return { pista: id === 'snowboard_verde' ? id : 'snowboard_verde' };
  },
  step,
  // la medaglia viene dalla classifica a tempo del gruppo (il fantasma del record): la decide il server (adrenalina/classifica.ts)
  result: (s) => {
    const t = tempiSnowboard(s), sc = s.arrivato ? C.tempo.scoreBase - Math.round(t.finale / 10) : 0;
    return {
    done: s.done, score: sc > 1 ? sc : s.arrivato ? 1 : 0, medal: null,
    detail: { ms: t.ms, finale: s.arrivato ? t.finale : 0, abbuono: t.abbuono, penalita: t.penalita, punti: s.punti, arrivato: s.arrivato ? 1 : 0, porte: s.porte, mancate: s.mancate, cadute: s.cadute, salti: s.salti, trick: s.trickFatti, combo: s.maxCombo },
    };
  },
  autopilot: (s) => pilotaSnowboard(s),
  view: (s): SnowView => {
    const p = pistaSnowboard(s.pista);
    return { ...s, molt: moltiplicatore(s.barra, BARRA), bordo: bordoA(p, s.s), neve: neveA(p, s.s), len: p.n.len, arrivo: p.def.arrivo };
  },
};
