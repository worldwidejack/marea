// La gara del motore v2 (docs/CORSE.md A11): una pista, il tuo veicolo e gli animali piloti (bot), a giri (circuito) o da A a B (fuga).
// È un MinigameModule come gli altri. Per ora lo usa solo il banco di prova (provapiste.html); il server lo rigiocherà quando il
// circuito della Spiaggia prenderà il posto del Gran Premio. Opzioni: pista, veicolo (della famiglia della pista), bot ('0' = da solo),
// e le regole (#170, '0' = spenta, di serie accese): sterzo (curva, rampa e velocità), partenza (turbo al semaforo), acrobazie, scia, somma.
// Gli oggetti alla Mario Kart (#250, oggetti.ts) invece sono di serie spenti: oggetti = '1' (gara CON OGGETTI); USA = il bottone b.
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
import { VUOTO, effetto, nastroDi, pistaCorse, rotaieDi, suBinari, superficieA, veicoloCorse } from './pista.ts';
import type { Pista } from './pista.ts';
import { guida, limiteCurva, rotaiaVicina } from './binari.ts';
import { nuoviOggetti, passoOggetti } from './oggetti.ts';
import type { OggettiState } from './oggetti.ts';
import { daiTurbo, nuovoVeicolo, urti } from './veicolo.ts';
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
  /** Gli oggetti (gara CON OGGETTI), `null` = guida pura. */
  oggetti: OggettiState | null;
  done: boolean; timeUp: boolean;
};
export type GaraView = {
  pista: string; veicoli: readonly Veicolo[];
  /** Posizione (1…) di ognuno, nello stesso ordine di veicoli. */
  posizioni: number[];
  giro: number; giri: number;
  /** L'inseguitore: dov'è (m dal via, `null` = non c'è) e quanto sei lontano da lui (m, negativo = ti ha preso). */
  onda: number | null; ondaDist: number;
  /** Scatole, tasche, trappole e colpi (gara CON OGGETTI), `null` = guida pura. */
  oggetti: OggettiState | null;
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
  if (o['oggetti'] === '1') out['oggetti'] = '1'; // di serie spenti: le gare di prima restano identiche
  // gara tra amici: il tuo posto tra gli amici, 0 = il primo (senza bot davanti a tutti, coi bot subito dietro di loro; manca = in fondo, come da solo)
  if (typeof o['posto'] === 'string' && /^[0-7]$/.test(o['posto'])) out['posto'] = o['posto'];
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
/** Lo sterzo del giocatore: curva del joystick e rampa. La rampa vale per gli ingressi «tutto o niente» (tasti, joystick a fondo o
 *  lasciato): niente scatti, arriva in qualche decimo e torna più in fretta. I valori di mezzo del joystick passano subito (un ritardo
 *  lì fa pendolare chi corregge di continuo, in acqua soprattutto). */
function sterzoGiocatore(k: Veicolo, mx: number, R: Regole): number {
  if (!R.sterzo) return (k.st = mx);
  const S = CORSE.sterzo, x = curvaSterzo(mx), a = Math.abs(mx);
  if (a > 0.001 && a < 0.999) return (k.st = x);
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

/** Il VIA: chi tiene il GAS a fondo da poco parte col turbo (da meno di `razzo` s: razzo), chi da troppo ingolfa il motore (come Mario Kart). */
function partenza(k: Veicolo, R: Regole): void {
  const P = CORSE.partenza;
  if (!R.partenza || k.gasT < 0) return;
  if (k.gasT > P.finestra) { k.fermo = P.ingolfato; k.partenza = -1; return; }
  const razzo = k.gasT <= P.razzo;
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

/** Chi guida da solo sui binari (#228): stacca il gas prima delle curve (oltre 1,2 × `prudenza` × il limite, piegato), si piega verso l'interno,
 *  salta per cambiare rotaia (verso l'imbocco di un bivio che conviene o lontano da una rotaia rotta) e salta i buchi.
 *  `osa` = prende i bivi rischiosi delle piste ibride (rami a binari aperti a tutti): i bot uno sì e uno no. */
export function pilotaBinari(p: Pista, k: Veicolo, prudenza: number, bot: boolean, osa = true): { sterzo: number; gas: number; salto: boolean } {
  const V = veicoloCorse(k.id), n = nastroDi(p, k.ramo), rot = rotaieDi(p, k.ramo);
  const fino = (m: number) => (n.chiuso ? (k.s + m) % n.len : Math.min(n.len, k.s + m));
  // la curva più stretta nei prossimi metri (quanti ne servono per frenare) dice la velocità giusta
  let kmax = 0;
  for (let d = 0; d <= 8 + Math.max(0, k.v) * 1.1; d += 2) kmax = Math.max(kmax, Math.abs(campo(n, n.k, fino(d))));
  const vGiusta = kmax > 1e-4 ? Math.sqrt((limiteCurva(V, 1, 1) * prudenza) / kmax) : 1e9;
  // in curva non si cade: oltre la velocità giusta stacca solo il gas (su due ruote si frena già da soli), e solo se è molto oltre
  const gas = k.v > vGiusta * 1.2 ? 0 : 1;
  const kq = campo(n, n.k, fino(3));
  let sterzo = Math.abs(kq) > 0.006 ? (kq > 0 ? 1 : -1) : 0;
  // la rotaia dove andare: l'imbocco di un bivio che conviene (i bot solo quelli della loro famiglia), poi una rotaia senza buchi davanti
  // chi non prende un bivio a binari che ha davanti si sposta dalla sua rotaia (sennò ci entrerebbe)
  let voluta = k.rot, evita = -1;
  if (k.ramo < 0) for (const r of p.rami) {
    let d = r.def.da - k.s;
    if (p.n.chiuso && d < 0) d += p.n.len;
    if (!(d > 0 && d < 60)) continue;
    const f = r.def.famiglie, prende = r.def.scorciatoia && (r.def.binari && !f ? osa : bot ? !!f && f.includes(V.famiglia) : !f || f.includes(V.famiglia));
    if (prende) { voluta = rotaiaVicina(rot, r.latIngresso); evita = -1; break; }
    if (r.def.binari) evita = rotaiaVicina(rot, r.latIngresso);
  }
  if (evita >= 0 && voluta === evita) voluta = evita > 0 ? evita - 1 : evita + 1;
  const rotta = (i: number) => { for (let d = 2; d <= 10 + Math.max(0, k.v) * 1.2; d += 1.5) if (superficieA(p, k.ramo, fino(d), rot[i]!, k.giro + 1) === VUOTO) return d; return 0; };
  const qui = rotta(voluta);
  if (qui) { let meglio = -1; for (let i = 0; i < rot.length; i++) if (!rotta(i) && (meglio < 0 || Math.abs(i - k.rot) < Math.abs(meglio - k.rot))) meglio = i; if (meglio >= 0) voluta = meglio; }
  if (k.aria) return { sterzo: voluta > (k.rot0 >= 0 ? k.rot0 : k.rot) ? 1 : voluta < (k.rot0 >= 0 ? k.rot0 : k.rot) ? -1 : 0, gas, salto: false };
  if (voluta !== k.rot && k.v > 4) return { sterzo: voluta > k.rot ? 1 : -1, gas, salto: k.tenuto < 0 };
  // un buco su tutte le rotaie: salta all'ultimo (il salto dura mezzo secondo)
  const buco = rotta(k.rot);
  if (buco && buco < 2 + k.v * 0.12) return { sterzo: 0, gas: 1, salto: k.tenuto < 0 };
  return { sterzo, gas, salto: false };
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

/** Il pilota automatico (prove e test): segue il centro (o l'imbocco delle scorciatoie), drift nelle curve lunghe. `pigro` = metà gas, niente drift.
 *  Con gli oggetti li usa appena la roulette si ferma (un colpo di USA ogni mezzo secondo). */
export function pilotaGara(s: GaraState, pigro = false, osa = true): InputFrame {
  const f = guidaAuto(s, pigro, osa), t = s.oggetti?.tasche[0];
  if (t?.ogg && t.roulette === 0 && s.tick % Math.round(TICK_HZ / 2) === 0) f.b = true;
  return f;
}
function guidaAuto(s: GaraState, pigro: boolean, osa: boolean): InputFrame {
  const p = pistaCorse(s.pista), k = s.veicoli[0]!;
  if (suBinari(p, k.ramo, k.s, veicoloCorse(k.id).famiglia) && s.tick > 0) {
    if (k.aria && !pigro && s.regole.acrobazie && k.acro === 0 && !k.caduto) return { mx: 0, my: 1, a: k.tenuto < 0, b: false }; // salti dalle rampe: acrobazia
    const a = pilotaBinari(p, k, pigro ? 0.7 : 0.95, false, osa), giu = (x: number) => (s.regole.sterzo ? senzaCurva(x) : x);
    return { mx: giu(a.sterzo), my: pigro ? Math.min(a.gas, 0.55) : a.gas, a: a.salto, b: false };
  }
  // al semaforo dà gas a metà della finestra del razzo; in aria (fuori dal drift) fa l'acrobazia appena stacca
  if (s.tick <= 0) return { mx: 0, my: !pigro && s.regole.partenza && -s.tick <= Math.round(CORSE.partenza.razzo * 0.5 * TICK_HZ) ? 1 : 0, a: false, b: false };
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
    const nBot = o['bot'] === '0' ? 0 : Math.min(CORSE.bot.bravura.length, G.length - 1);
    const mia = veicoloCorse(o['veicolo']!).famiglia, posto = o['posto'] === undefined ? -1 : nBot + Number(o['posto']);
    // da solo in fondo alla griglia; tra amici al proprio posto dietro ai bot (oltre la griglia, file da 6 m più indietro, alternate a destra e sinistra)
    const tu = posto < 0 ? G[G.length - 1]! : G[posto] ?? [G[G.length - 1]![0] - 6 * (posto - G.length + 1), posto % 2 ? 2.5 : -2.5];
    const lat = posto < 0 ? C?.[mia] ?? tu[1] : C?.[mia] !== undefined ? C[mia]! + (tu[1] < 0 ? -1.4 : 1.4) : tu[1];
    const veicoli = [nuovoVeicolo(p, o['veicolo']!, tu[0], lat)];
    // piste miste: i bot si alternano tra le famiglie e partono nella corsia della loro (un po' di lato, per non stare in fila)
    for (let i = 0; i < nBot; i++) {
      const f = fams[i % fams.length]!, lista = CORSE.bot.veicoli[f], c = C?.[f];
      veicoli.push(nuovoVeicolo(p, lista[Math.floor(i / fams.length) % lista.length]!, G[i]![0], c !== undefined ? c + (G[i]![1] < 0 ? -1.4 : 1.4) : G[i]![1]));
    }
    // sui binari si parte sopra una rotaia
    if (fams.includes('binari')) { const rot = rotaieDi(p, -1); for (const k of veicoli) { k.rot = rotaiaVicina(rot, k.lat); k.lat = rot[k.rot]!; } }
    for (const k of veicoli) k.agg = suBinari(p, k.ramo, k.s, veicoloCorse(k.id).famiglia);
    const corsie = veicoli.slice(1).map(() => ({ base: (rng.next() * 2 - 1) * CORSE.bot.corsia, fase: rng.next() }));
    const oggetti = o['oggetti'] === '1' ? nuoviOggetti(p, veicoli.length) : null;
    return { seed, difficulty, pista: o['pista']!, tick: -VIA, regole: regoleDa(o), veicoli, pesi: veicoli.map((k) => veicoloCorse(k.id).peso), corsie, onda: p.def.inseguitore?.parte ?? 0, oggetti, done: false, timeUp: false };
  },
  step(s, f) {
    if (s.done) return;
    s.tick++;
    const p = pistaCorse(s.pista), me = s.veicoli[0]!, B = CORSE.bot, E = B.elastico, O = p.def.inseguitore, R = s.regole;
    me.tenuto = f.a ? (me.tenuto >= 0 ? me.tenuto + DT : 0) : -1;
    me.gasT = f.my > 0.5 ? (me.gasT >= 0 ? me.gasT + DT : 0) : -1;
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
    guida(p, me, veicoloCorse(me.id), sterzo, clamp(f.my, -1, 1), f.a, dentro(me), me.giro + 1, R);
    // i bot: puntano la loro corsia, frenano prima delle curve strette, l'elastico li tiene vicini a te
    for (let i = 1; i < s.veicoli.length; i++) {
      const k = s.veicoli[i]!, c = s.corsie[i - 1]!;
      const V = veicoloCorse(k.id);
      if (suBinari(p, k.ramo, k.s, V.famiglia)) { // sui binari: più prudenti di te, tanto più quanto sono indietro nella griglia
        const b = pilotaBinari(p, k, 0.9 - 0.03 * (i - 1), true, i % 2 === 1), diff = k.prog - me.prog;
        const el = diff > 0 ? 1 - Math.min(E.davantiMax, diff * E.davanti) : 1 + Math.min(E.dietroMax, -diff * E.dietro);
        k.tenuto = b.salto ? (k.tenuto >= 0 ? k.tenuto + DT : 0) : -1;
        guida(p, k, V, b.sterzo, k.fine ? 0.5 : b.gas, b.salto, B.bravura[i - 1]! * B.bravuraFamiglia[V.famiglia] * el * dentro(k), k.giro + 1, R);
        continue;
      }
      const corsia = clamp(c.base + 0.3 * triangolo(k.prog / 280 + c.fase), -0.8, 0.8), lat = latObiettivo(p, k, true);
      const a = lat !== null ? pilota(p, k, 0, lat + c.base * 1.2) : pilota(p, k, corsia), diff = k.prog - me.prog;
      const el = diff > 0 ? 1 - Math.min(E.davantiMax, diff * E.davanti) : 1 + Math.min(E.dietroMax, -diff * E.dietro);
      guida(p, k, V, a.sterzo, k.fine ? 0.5 : a.gas, false, B.bravura[i - 1]! * B.bravuraFamiglia[V.famiglia] * el * dentro(k), k.giro + 1, R);
    }
    if (s.oggetti) passoOggetti(s.oggetti, p, s.veicoli, f.b, () => posizioni(s), s.seed, s.tick, R);
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
    const detail: Record<string, number> = { ms, pos, giri: Math.min(me.giro, p.def.giri), tot: p.def.giri, giro: tickMs(me.best), salti: me.salti, cadute: me.cadute, travolti: me.travolto };
    if (s.oggetti) { detail['oggetti'] = s.oggetti.usati[0]!; detail['colpito'] = s.oggetti.presi[0]!; }
    return { done: s.done, score, medal, detail };
  },
  autopilot(s: GaraState, _rng: Rng): InputFrame {
    return pilotaGara(s);
  },
  view(s): GaraView {
    const p = pistaCorse(s.pista), me = s.veicoli[0]!;
    return {
      pista: s.pista, veicoli: s.veicoli, posizioni: posizioni(s), giro: Math.min(p.def.giri, me.giro + 1), giri: p.def.giri,
      onda: p.def.inseguitore ? s.onda : null, ondaDist: p.def.inseguitore ? me.prog - s.onda : 0, oggetti: s.oggetti,
      ms: tickMs(garaTicks(s, me)), maxMs: CORSE.maxSeconds * 1000,
      giroMs: me.fine ? 0 : tickMs(Math.max(0, s.tick - Math.max(1, me.giroTick))), bestMs: tickMs(me.best),
      done: s.done, finished: me.fine > 0, timeUp: s.timeUp, tick: s.tick, via: s.tick < 0 ? -s.tick / TICK_HZ : 0,
    };
  },
};
