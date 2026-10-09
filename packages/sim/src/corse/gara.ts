// La gara del motore v2 (docs/CORSE.md A11): una pista, il tuo veicolo e gli animali piloti (bot), a giri (circuito) o da A a B (fuga).
// È un MinigameModule come gli altri. Per ora lo usa solo il banco di prova (provapiste.html); il server lo rigiocherà quando il
// circuito della Spiaggia prenderà il posto del Gran Premio. Opzioni: pista, veicolo (della famiglia della pista), bot ('0' = da solo),
// e le regole (#170, '0' = spenta, di serie accese): sterzo (curva, rampa e velocità), partenza (turbo al semaforo), acrobazie, scia, somma.
// La gara parte col conto alla rovescia (tick negativi fino al VIA): i tempi contano dal VIA.
// Medaglia = posizione all'arrivo (da solo: oro se arrivi). Punteggio = scoreBase − centesimi.
// Piste miste (il porto): più famiglie sulla stessa pista, ognuna nella sua corsia; i bot sono misti. Fughe con l'inseguitore (l'onda).
import { CORSE, CORSE_PISTE } from '@marea/content/corse.ts';
import type { CFamigliaId, CPistaDef } from '@marea/content/corse.ts';
import { DT, TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameOpzioni, MinigameResult } from '../minigames/types.ts';
import { campo, svoltaTra } from './nastro.ts';
import { effetto, nastroDi, pistaCorse, superficieA, veicoloCorse } from './pista.ts';
import type { Pista } from './pista.ts';
import { daiTurbo, muovi, nuovoVeicolo, urti } from './veicolo.ts';
import type { Regole, Veicolo } from './veicolo.ts';

const MAX_TICKS = CORSE.maxSeconds * TICK_HZ;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const PISTE = Object.keys(CORSE_PISTE);
/** Tick del conto alla rovescia: la gara parte a tick −VIA e il VIA è il tick 1. */
export const VIA = Math.round(CORSE.partenza.secondi * TICK_HZ);
const REGOLE = ['sterzo', 'partenza', 'acrobazie', 'scia', 'somma'] as const;

export type GaraState = {
  seed: number; difficulty: Difficulty;
  pista: string;
  /** Tick della gara: negativo nel conto alla rovescia, 1 = il VIA. */
  tick: number;
  regole: Regole;
  /** veicoli[0] = tu, poi i bot. */
  veicoli: Veicolo[];
  pesi: number[];
  /** Corsia dei bot (−1..1 della mezza carreggiata) e fase della sua oscillazione (0..1). */
  corsie: { base: number; fase: number }[];
  /** Fughe con l'inseguitore: dov'è il suo fronte (m dal via). Senza inseguitore resta 0. */
  onda: number;
  done: boolean; timeUp: boolean;
};
export type GaraView = {
  pista: string; veicoli: readonly Veicolo[];
  /** Posizione (1…) di ognuno, nello stesso ordine di veicoli. */
  posizioni: number[];
  giro: number; giri: number;
  /** L'inseguitore: dov'è (m dal via, `null` = non c'è) e quanto sei lontano da lui (m, negativo = ti ha preso). */
  onda: number | null; ondaDist: number;
  ms: number; maxMs: number; giroMs: number; bestMs: number;
  /** Secondi al VIA (0 = partiti). */
  via: number;
  done: boolean; finished: boolean; timeUp: boolean; tick: number;
};

/** Le famiglie che corrono sulla pista (di serie una). */
export const famiglieDi = (d: CPistaDef): CFamigliaId[] => d.famiglie ?? [d.famiglia];

/** Opzioni normalizzate: pista conosciuta, veicolo della sua famiglia, bot sì o no. */
export function opzioniGara(v: unknown): MinigameOpzioni {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const pista = typeof o['pista'] === 'string' && Object.hasOwn(CORSE_PISTE, o['pista']) ? o['pista'] : PISTE[0]!;
  const fams = famiglieDi(CORSE_PISTE[pista]!);
  const adatti = CORSE.veicoli.filter((x) => fams.includes(x.famiglia));
  const veicolo = typeof o['veicolo'] === 'string' && adatti.some((x) => x.id === o['veicolo']) ? o['veicolo'] : adatti[0]!.id;
  const out: MinigameOpzioni = { pista, veicolo, bot: o['bot'] === '0' ? '0' : '1' };
  for (const r of REGOLE) out[r] = o[r] === '0' ? '0' : '1';
  return out;
}

/** Curva del joystick: uscita = x × (lineare + (1 − lineare) × |x|) (al centro risponde piano, in fondo tutto). */
export function curvaSterzo(x: number): number {
  const L = CORSE.sterzo.lineare;
  return x * (L + (1 - L) * Math.abs(x));
}
/** L'inversa della curva (il pilota automatico sa già quanto vuole sterzare). */
function senzaCurva(y: number): number {
  const L = CORSE.sterzo.lineare, a = Math.abs(y);
  if (L >= 1) return y;
  const u = (-L + Math.sqrt(L * L + 4 * (1 - L) * a)) / (2 * (1 - L));
  return y < 0 ? -u : u;
}
/** Lo sterzo del giocatore: curva del joystick e rampa (da tastiera niente scatti: arriva in qualche decimo e torna più in fretta). */
function sterzoGiocatore(k: Veicolo, mx: number, R: Regole): number {
  if (!R.sterzo) return (k.st = mx);
  const S = CORSE.sterzo, x = curvaSterzo(mx);
  const sale = Math.abs(x) > Math.abs(k.st) && x * k.st >= 0, passo = (sale ? S.rampa : S.ritorno) * DT;
  k.st += clamp(x - k.st, -passo, passo);
  return k.st;
}

/** La scia: chi sta dietro a un altro (vicino e in fila) per `secondi` prende un turbo. Ordine fisso: deterministico. */
function scia(s: GaraState, p: Pista): void {
  const C = CORSE.scia;
  for (const k of s.veicoli) {
    if (k.fine || k.caduto || k.aria || k.v < C.velocitaMin) { k.scia = Math.max(0, k.scia - 2 * DT); continue; }
    const n = nastroDi(p, k.ramo);
    let dentro = false;
    for (const o of s.veicoli) {
      if (o === k || o.ramo !== k.ramo || o.caduto) continue;
      let ds = o.s - k.s;
      if (n.chiuso) { if (ds > n.len / 2) ds -= n.len; else if (ds < -n.len / 2) ds += n.len; }
      if (ds >= C.metri[0] && ds <= C.metri[1] && Math.abs(o.lat - k.lat) <= C.lato) { dentro = true; break; }
    }
    if (!dentro) { k.scia = Math.max(0, k.scia - 2 * DT); continue; }
    k.scia += DT;
    if (k.scia >= C.secondi) { daiTurbo(k, C.turbo, 1, s.regole.somma); k.scia = 0; }
  }
}

/** Il VIA: chi tiene DRIFT premuto da poco parte col turbo (da meno di `razzo` s: razzo), chi da troppo ingolfa il motore. */
function partenza(k: Veicolo, R: Regole): void {
  const P = CORSE.partenza;
  if (!R.partenza || k.tenuto < 0) return;
  if (k.tenuto > P.finestra) { k.fermo = P.ingolfato; k.partenza = -1; return; }
  const razzo = k.tenuto <= P.razzo;
  daiTurbo(k, P.turbo[razzo ? 1 : 0]!, razzo ? 3 : 1, R.somma);
  k.partenza = razzo ? 2 : 1;
}

/** Dove punta chi guida da solo: la sua corsia (frazione della mezza carreggiata) o uno scarto fisso, un po' più avanti.
 *  `curva` = quanto gira la pista nei prossimi 14 m (+ = a destra), `gas` = tolto prima delle curve strette. */
export function pilota(p: Pista, k: Veicolo, corsia: number, latFissa: number | null = null): { sterzo: number; gas: number; curva: number } {
  const n = nastroDi(p, k.ramo), B = CORSE.bot;
  const fino = (m: number) => (n.chiuso ? k.s + m : Math.min(n.len, k.s + m));
  const look = B.sguardo[0] + B.sguardo[1] * Math.max(0, k.v), sa = fino(look);
  const dth = svoltaTra(n, k.s, sa);
  const target = latFissa ?? corsia * campo(n, n.l, sa);
  const voluto = (target - k.lat) / look + 0.5 * dth;
  const sterzo = clamp((voluto - k.hl) * B.sterzo, -1, 1);
  const curva = svoltaTra(n, k.s, fino(14));
  const avanti = Math.abs(svoltaTra(n, k.s, fino(B.prudenza.metri)));
  const gas = avanti > B.prudenza.curva ? 1 - Math.min(B.prudenza.freno, (avanti - B.prudenza.curva) * 0.5) : 1;
  return { sterzo, gas, curva };
}

/** Dove punta chi guida da solo, se ha un motivo per non stare al centro: l'imbocco di una scorciatoia della sua famiglia (i bot solo
 *  quelle che nominano la loro famiglia), la corsia della sua famiglia (piste miste) e, per il pilota automatico, una corsia veloce
 *  dove la superficie davanti rallenta (la secca nella baia, la pozzanghera, la sabbia dentro le curve). `null` = nessuno. */
export function latObiettivo(p: Pista, k: Veicolo, bot: boolean): number | null {
  const V = veicoloCorse(k.id);
  if (k.ramo < 0) for (const r of p.rami) {
    const f = r.def.famiglie, prende = r.def.scorciatoia && (bot ? !!f && f.includes(V.famiglia) : !f || f.includes(V.famiglia));
    if (!prende) continue;
    let d = r.def.da - k.s;
    if (p.n.chiuso && d < 0) d += p.n.len;
    if (d > 0 && d < 70) return r.latIngresso;
  }
  if (k.ramo < 0) { const c = p.def.corsie?.[V.famiglia]; if (c !== undefined) return c; }
  if (bot) return null;
  const n = nastroDi(p, k.ramo), sa = n.chiuso ? k.s + 15 : Math.min(n.len, k.s + 15), l = campo(n, n.l, sa);
  const veloce = (x: number) => effetto(V, superficieA(p, k.ramo, sa, x, k.giro + 1)).velocita >= 0.95;
  if (!veloce(0)) for (const x of [0.55, -0.55, 0.8, -0.8]) if (veloce(x * l)) return x * l;
  return null;
}

/** Il pilota automatico (prove e test): segue il centro (o l'imbocco delle scorciatoie), drift nelle curve lunghe. `pigro` = metà gas, niente drift. */
export function pilotaGara(s: GaraState, pigro = false): InputFrame {
  const p = pistaCorse(s.pista), k = s.veicoli[0]!;
  // al semaforo preme DRIFT a metà della finestra del razzo; in aria (fuori dal drift) fa l'acrobazia appena stacca
  if (s.tick <= 0) return { mx: 0, my: 1, a: !pigro && s.regole.partenza && -s.tick <= Math.round(CORSE.partenza.razzo * 0.5 * TICK_HZ), b: false };
  const lat = latObiettivo(p, k, false);
  const a = pilota(p, k, 0, lat), giu = (x: number) => (s.regole.sterzo ? senzaCurva(x) : x);
  if (k.aria && !k.drift && !pigro && s.regole.acrobazie && !k.caduto) return { mx: giu(a.sterzo), my: 1, a: k.acro === 0 && k.tenuto < 0, b: false };
  if (pigro) return { mx: giu(a.sterzo), my: 0.55, a: false, b: false };
  const D = CORSE.drift, lato = a.curva > 0 ? 1 : -1, ac = Math.abs(a.curva);
  // in acqua il pilota automatico non fa drift: con la presa bassa delle barche porta sulle boe (76 s liscio contro 83 in drift)
  const drift = p.def.famiglia === 'acqua' ? false : k.aria ? k.drift !== 0 : k.drift ? ac > 0.1 && lato === k.drift && a.sterzo * k.drift > -0.95 : ac > 0.3 && a.sterzo * lato > 0.15 && k.v > D.velocitaMin + 2;
  // per partire in drift lo sterzo deve passare la soglia: nelle curve larghe basterebbe meno
  const mx = drift && !k.drift ? lato * Math.max(Math.abs(giu(a.sterzo)), 1) : giu(a.sterzo);
  return { mx, my: a.gas, a: drift, b: false };
}

function posizioni(s: GaraState): number[] {
  const ord = s.veicoli.map((k, i) => ({ i, f: k.fine || Infinity, p: k.prog })).sort((a, b) => (a.f !== b.f ? a.f - b.f : b.p - a.p || a.i - b.i));
  const out: number[] = new Array(s.veicoli.length).fill(0);
  ord.forEach((o, n) => { out[o.i] = n + 1; });
  return out;
}
/** Onda a triangolo −1..1 di periodo 1 (al posto del seno: le corsie dei bot ondeggiano piano). */
const triangolo = (t: number) => { const f = t - Math.floor(t); return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; };
const tickMs = (t: number) => Math.round((t / TICK_HZ) * 1000);
const garaTicks = (s: GaraState, k: Veicolo) => Math.max(0, k.fine || s.tick);
const regoleDa = (o: MinigameOpzioni): Regole => ({ sterzo: o['sterzo'] !== '0', partenza: o['partenza'] !== '0', acrobazie: o['acrobazie'] !== '0', scia: o['scia'] !== '0', somma: o['somma'] !== '0' });

/** Dopo il moto: giri e arrivo. */
function dopo(s: GaraState, p: Pista, k: Veicolo): void {
  if (k.fine) return;
  if (p.def.tipo === 'fuga') { if (k.prog >= p.arrivo) { k.fine = s.tick; k.giro = 1; k.best = s.tick; } return; }
  const giro = k.prog < 0 ? 0 : Math.floor(k.prog / p.arrivo);
  if (giro > k.giro) {
    const t = s.tick - k.giroTick;
    if (!k.best || t < k.best) k.best = t;
    k.giro = giro; k.giroTick = s.tick;
    if (giro >= p.def.giri) k.fine = s.tick;
  }
}

export const garaCorse: MinigameModule<GaraState> = {
  id: 'corse',
  version: 2,
  maxTicks: MAX_TICKS,
  opzioni: opzioniGara,
  create({ seed, difficulty, opzioni }) {
    const o = opzioniGara(opzioni), p = pistaCorse(o['pista']!), G = p.def.griglia, fams = famiglieDi(p.def), C = p.def.corsie;
    const rng = createRng(seed).fork('corse2');
    const tu = G[G.length - 1]!, mia = veicoloCorse(o['veicolo']!).famiglia;
    const veicoli = [nuovoVeicolo(p, o['veicolo']!, tu[0], C?.[mia] ?? tu[1])];
    const nBot = o['bot'] === '0' ? 0 : Math.min(CORSE.bot.bravura.length, G.length - 1);
    // piste miste: i bot si alternano tra le famiglie e partono nella corsia della loro (un po' di lato, per non stare in fila)
    for (let i = 0; i < nBot; i++) {
      const f = fams[i % fams.length]!, lista = CORSE.bot.veicoli[f], c = C?.[f];
      veicoli.push(nuovoVeicolo(p, lista[Math.floor(i / fams.length) % lista.length]!, G[i]![0], c !== undefined ? c + (G[i]![1] < 0 ? -1.4 : 1.4) : G[i]![1]));
    }
    const corsie = veicoli.slice(1).map(() => ({ base: (rng.next() * 2 - 1) * CORSE.bot.corsia, fase: rng.next() }));
    return { seed, difficulty, pista: o['pista']!, tick: -VIA, regole: regoleDa(o), veicoli, pesi: veicoli.map((k) => veicoloCorse(k.id).peso), corsie, onda: p.def.inseguitore?.parte ?? 0, done: false, timeUp: false };
  },
  step(s, f) {
    if (s.done) return;
    s.tick++;
    const p = pistaCorse(s.pista), me = s.veicoli[0]!, B = CORSE.bot, E = B.elastico, O = p.def.inseguitore, R = s.regole;
    me.tenuto = f.a ? (me.tenuto >= 0 ? me.tenuto + DT : 0) : -1;
    const sterzo = sterzoGiocatore(me, clamp(f.mx, -1, 1), R);
    if (s.tick <= 0) return; // conto alla rovescia: fermi (anche l'onda)
    if (s.tick === 1) partenza(me, R);
    // l'inseguitore (l'onda): avanza da solo e, se ti stacchi troppo, accelera; chi prende prende un colpo e va piano finché il corpo passa
    if (O) {
      const gap = me.prog - s.onda;
      s.onda = Math.min(p.arrivo, s.onda + (Math.min(O.vmax, O.v0 + O.accel * (s.tick / TICK_HZ)) + Math.max(0, gap - O.distMax) * O.recupero) * DT);
      for (const k of s.veicoli) if (!k.fine && !k.travolto && k.prog <= s.onda) { k.travolto = 1; k.v *= O.colpo; }
    }
    const dentro = (k: Veicolo) => (O && !k.fine && k.prog <= s.onda && k.prog > s.onda - O.spessore ? O.rallenta : 1);
    muovi(p, me, veicoloCorse(me.id), sterzo, clamp(f.my, -1, 1), f.a, dentro(me), me.giro + 1, R);
    // i bot: puntano la loro corsia, frenano prima delle curve strette, l'elastico li tiene vicini a te
    for (let i = 1; i < s.veicoli.length; i++) {
      const k = s.veicoli[i]!, c = s.corsie[i - 1]!;
      const corsia = clamp(c.base + 0.3 * triangolo(k.prog / 280 + c.fase), -0.8, 0.8), lat = latObiettivo(p, k, true);
      const a = lat !== null ? pilota(p, k, 0, lat + c.base * 1.2) : pilota(p, k, corsia), diff = k.prog - me.prog;
      const el = diff > 0 ? 1 - Math.min(E.davantiMax, diff * E.davanti) : 1 + Math.min(E.dietroMax, -diff * E.dietro);
      muovi(p, k, veicoloCorse(k.id), a.sterzo, k.fine ? 0.5 : a.gas, false, B.bravura[i - 1]! * B.bravuraFamiglia[veicoloCorse(k.id).famiglia] * el * dentro(k), k.giro + 1, R);
    }
    if (R.scia) scia(s, p);
    urti(p, s.veicoli, s.pesi);
    for (const k of s.veicoli) dopo(s, p, k);
    if (me.fine) s.done = true;
    else if (s.tick >= MAX_TICKS) { s.done = true; s.timeUp = true; }
  },
  result(s): MinigameResult {
    const p = pistaCorse(s.pista), me = s.veicoli[0]!, fin = me.fine > 0, ms = tickMs(garaTicks(s, me)), pos = posizioni(s)[0]!;
    const medal: Medal = fin ? (pos === 1 ? 'oro' : pos === 2 ? 'argento' : pos === 3 ? 'bronzo' : null) : null;
    const score = fin ? Math.max(1000, CORSE.scoreBase - Math.floor(ms / 10)) : Math.floor(Math.max(0, me.prog) / 10);
    return { done: s.done, score, medal, detail: { ms, pos, giri: Math.min(me.giro, p.def.giri), tot: p.def.giri, giro: tickMs(me.best), salti: me.salti, cadute: me.cadute, travolti: me.travolto } };
  },
  autopilot(s: GaraState, _rng: Rng): InputFrame {
    return pilotaGara(s);
  },
  view(s): GaraView {
    const p = pistaCorse(s.pista), me = s.veicoli[0]!;
    return {
      pista: s.pista, veicoli: s.veicoli, posizioni: posizioni(s), giro: Math.min(p.def.giri, me.giro + 1), giri: p.def.giri,
      onda: p.def.inseguitore ? s.onda : null, ondaDist: p.def.inseguitore ? me.prog - s.onda : 0,
      ms: tickMs(garaTicks(s, me)), maxMs: CORSE.maxSeconds * 1000,
      giroMs: me.fine ? 0 : tickMs(Math.max(0, s.tick - Math.max(1, me.giroTick))), bestMs: tickMs(me.best),
      done: s.done, finished: me.fine > 0, timeUp: s.timeUp, tick: s.tick, via: s.tick < 0 ? -s.tick / TICK_HZ : 0,
    };
  },
};
