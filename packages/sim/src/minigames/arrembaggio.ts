// Arrembaggio (Isola della Tempesta, GDD §3 e §6): dal faro in rovina spari palle di cannone alle navi pirata che passano sul mare.
// Vista di profilo: il cannone in alto a sinistra, il mare in basso. TIENI PREMUTO = la potenza sale e scende (barra), LASCIA = spari;
// la palla vola a parabola, il vento della tempesta la spinge di lato e cambia a raffiche. Una palla che tocca una nave la affonda:
// le navi piccole e veloci valgono di più (e la nave del tesoro più di tutte). Le palle sono contate (sparare a caso non basta).
// Finisce quando scade il tempo; niente si perde.
// Navi, raffiche e lampi nascono dal seed. Solo + − × ÷ (niente trigonometria: stessi numeri nel browser e nel Worker).
// Numeri in content (minigames/arrembaggio.json). Unità = pixel della schermata 192×136 (y cresce verso il basso), per tick.
import { MINIGAMES_CFG } from '@marea/content';
import type { ArrembaggioNave } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Difficulty, Medal, MinigameModule, MinigameResult } from './types.ts';

const C = MINIGAMES_CFG.arrembaggio;
const MAX_TICKS = Math.round(C.maxSeconds * TICK_HZ);
const CARICA = Math.round(C.tiro.caricaSecondi * TICK_HZ);
const RICARICA = Math.round(C.tiro.ricaricaSecondi * TICK_HZ);
const CAMBIO = Math.round(C.vento.cambioSecondi * TICK_HZ);
const [BX, BY] = C.scena.cannone;
const MARE = C.scena.mare, USCITA = C.scena.uscita;
/** Le navi che vanno a destra spuntano da dietro la scogliera, qui. */
const DA_SINISTRA = 14;
/** La prima nave è già in vista quando parte il tempo (x). */
const PRIMA_X = 168;
/** Margine della presa sulla sagoma di una nave (px). */
const PRESA = 2;

/** Una nave: parte al tick `t0` da `x0` e va nel verso `dir` a `v` px/tick; `affondata` = tick del colpo (−1 = a galla). */
export type ArrNave = { id: number; k: ArrembaggioNave; t0: number; x0: number; dir: 1 | -1; v: number; affondata: number };
export type ArrPalla = { x: number; y: number; vx: number; vy: number };
/** Raffica: dal tick `t` il vento va verso `v` (ci arriva in `cambioSecondi`). */
export type ArrRaffica = { t: number; v: number };
export type ArrembaggioState = {
  seed: number;
  difficulty: Difficulty;
  tick: number;
  /** Tick da quando tieni premuto (−1 = non stai caricando). */
  carica: number;
  /** Tick prima di poter caricare di nuovo. */
  ricarica: number;
  palle: ArrPalla[];
  navi: ArrNave[];
  raffiche: ArrRaffica[];
  /** Tick dei fulmini (solo scena, dal seed). */
  lampi: number[];
  punti: number;
  totale: number;
  spari: number;
  /** Palle che restano (tiro.palle a partita). */
  munizioni: number;
  affondate: Record<ArrembaggioNave, number>;
  /** Eventi dell'ultimo tick (per suoni ed effetti del client): spari, tonfi in acqua, navi colpite. */
  ultimo: { sparo: boolean; tonfi: { x: number; y: number }[]; colpi: number[] };
  done: boolean;
};
export type ArrembaggioView = {
  tick: number; ms: number; maxMs: number; punti: number; totale: number; spari: number; munizioni: number; affondate: Record<ArrembaggioNave, number>;
  /** Potenza 0..1 mentre carichi, −1 altrimenti; ricarica 0..1 (1 = appena sparato). */
  potenza: number; ricarica: number; vento: number;
  medals: { oro: number; argento: number; bronzo: number };
  navi: { id: number; k: ArrembaggioNave; x: number; dir: 1 | -1; affondata: number }[];
  palle: readonly ArrPalla[];
  done: boolean;
};

/** Potenza 0..1 dopo `c` tick di carica: sale in CARICA tick e poi scende, avanti e indietro (onda triangolare esatta, a interi). */
export function potenzaDi(c: number): number {
  if (c < 0) return -1;
  const p = c % (2 * CARICA);
  return (p <= CARICA ? p : 2 * CARICA - p) / CARICA;
}
/** Vento (px/tick², + = verso destra) al tick t. */
export function ventoAt(raffiche: readonly ArrRaffica[], t: number): number {
  let i = 0;
  while (i + 1 < raffiche.length && raffiche[i + 1]!.t <= t) i++;
  const r = raffiche[i]!, prima = i > 0 ? raffiche[i - 1]!.v : r.v, k = t - r.t;
  return k >= CAMBIO ? r.v : prima + ((r.v - prima) * k) / CAMBIO;
}
/** x della nave al tick t (o null se non è in mare: non ancora partita, uscita dallo schermo). */
export function naveX(n: ArrNave, t: number): number | null {
  if (t < n.t0) return null;
  const x = n.x0 + n.dir * n.v * (t - n.t0), m = C.navi[n.k].lungo;
  return x < DA_SINISTRA - m || x > USCITA + m ? null : x;
}
/** La palla tocca la nave (sagoma: lunga `lungo`, alta `alto` sopra il mare)? */
function tocca(n: ArrNave, nx: number, p: ArrPalla): boolean {
  const d = C.navi[n.k];
  return Math.abs(p.x - nx) <= d.lungo / 2 + PRESA && p.y >= MARE - d.alto && p.y <= MARE + PRESA;
}
/** Palla nuova dal cannone con potenza p (0..1). */
export function sparo(p: number): ArrPalla {
  const v = C.tiro.vMin + (C.tiro.vMax - C.tiro.vMin) * p;
  return { x: BX, y: BY, vx: C.tiro.dir[0] * v, vy: C.tiro.dir[1] * v };
}
/** Un tick di volo: vento, gravità, spostamento. */
export function muoviPalla(b: ArrPalla, vento: number): void {
  b.vx += vento; b.vy += C.tiro.gravita; b.x += b.vx; b.y += b.vy;
}
/** La nave colpita dalla palla al tick t (indice in s.navi, −1 = nessuna); `salta` = navi da non contare. */
function colpita(s: ArrembaggioState, b: ArrPalla, t: number, salta?: Set<number>): number {
  for (let i = 0; i < s.navi.length; i++) {
    const n = s.navi[i]!;
    if (n.affondata >= 0 || salta?.has(i)) continue;
    const x = naveX(n, t);
    if (x !== null && tocca(n, x, b)) return i;
  }
  return -1;
}
const fuori = (b: ArrPalla) => b.y >= MARE + PRESA || b.x > USCITA || b.x < -10;

/** Dove va a finire una palla (per l'autopilota e per il mirino): la nave colpita o −1, e il punto d'arrivo. Dal tick t0 in poi. */
export function volo(s: ArrembaggioState, b0: ArrPalla, t0: number, salta?: Set<number>): { nave: number; x: number; y: number; t: number } {
  const b = { ...b0 };
  for (let t = t0; t < t0 + 400; t++) {
    muoviPalla(b, ventoAt(s.raffiche, t));
    const i = colpita(s, b, t, salta);
    if (i >= 0 || fuori(b)) return { nave: i, x: b.x, y: b.y, t };
  }
  return { nave: -1, x: b.x, y: b.y, t: t0 + 400 };
}

// ---------------- generazione dal seed ----------------
function genera(seed: number, difficulty: Difficulty): Pick<ArrembaggioState, 'navi' | 'raffiche' | 'lampi' | 'totale'> {
  const rng = createRng(seed).fork('arrembaggio');
  const vel = C.difficolta.velocita[difficulty - 1]!, vmul = C.difficolta.vento[difficulty - 1]!;
  const tipi = Object.keys(C.navi) as ArrembaggioNave[];
  const mazzoBase: ArrembaggioNave[] = [];
  for (const k of tipi) for (let i = 0; i < C.navi[k].peso; i++) mazzoBase.push(k);
  let mazzo: ArrembaggioNave[] = [];
  const navi: ArrNave[] = [];
  const [i0, i1] = C.arrivi.intervalloSecondi.map((x) => Math.round(x * TICK_HZ)) as [number, number];
  // le prime due vengono da destra, lente (la prima già in vista): si capisce subito il gioco
  for (let t = Math.round(C.arrivi.primoSecondi * TICK_HZ), n = 0; t < MAX_TICKS - 90; t += rng.int(i0, i1), n++) {
    if (!mazzo.length) { mazzo = [...mazzoBase]; for (let i = mazzo.length - 1; i > 0; i--) { const j = rng.int(0, i); const x = mazzo[i]!; mazzo[i] = mazzo[j]!; mazzo[j] = x; } }
    const k = n < 2 ? (n === 0 ? 'galeone' : 'brigantino') : mazzo.pop()!;
    const d = C.navi[k], dir: 1 | -1 = n < 2 ? -1 : rng.next() < 0.5 ? -1 : 1;
    const v = d.velocita * vel * (0.9 + rng.next() * 0.2);
    navi.push({ id: navi.length, k, t0: t, x0: n === 0 ? PRIMA_X : dir < 0 ? USCITA + d.lungo / 2 : DA_SINISTRA - d.lungo / 2, dir, v, affondata: -1 });
  }
  const raffiche: ArrRaffica[] = [{ t: 0, v: 0 }];
  const [r0, r1] = C.vento.rafficaSecondi.map((x) => Math.round(x * TICK_HZ)) as [number, number];
  let segno = rng.next() < 0.5 ? -1 : 1;
  for (let t = r0; t < MAX_TICKS + 400; t += rng.int(r0, r1)) {
    // a volte calma, di solito una raffica dall'altra parte (la tempesta gira)
    segno = rng.next() < 0.7 ? -segno : segno;
    const forza = rng.next() < 0.15 ? 0 : rng.int(1, 4) / 4;
    raffiche.push({ t, v: segno * forza * C.vento.max * vmul });
  }
  const lampi: number[] = [];
  const [l0, l1] = C.lampiSecondi.map((x) => Math.round(x * TICK_HZ)) as [number, number];
  for (let t = rng.int(60, l0); t < MAX_TICKS; t += rng.int(l0, l1)) lampi.push(t);
  const totale = navi.reduce((a, n) => a + C.navi[n.k].punti, 0);
  return { navi, raffiche, lampi, totale };
}

function soglie(totale: number): { oro: number; argento: number; bronzo: number } {
  const m = C.medaglie, q = (f: number) => Math.max(1, Math.ceil(totale * f - 1e-9));
  return { oro: q(m.oro), argento: q(m.argento), bronzo: q(m.bronzo) };
}
function medalOf(s: ArrembaggioState): Medal {
  const m = soglie(s.totale), p = s.punti;
  return p >= m.oro ? 'oro' : p >= m.argento ? 'argento' : p >= m.bronzo ? 'bronzo' : null;
}
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const SI: InputFrame = { mx: 0, my: 0, a: true, b: false };

/** Pilota di riferimento: carica quando il cannone è pronto e c'è una nave in mare; lascia appena la palla (vento compreso)
 *  affonderebbe una nave che non è già sotto tiro. */
export function autopilotaArrembaggio(s: ArrembaggioState): InputFrame {
  if (s.done) return NO;
  if (s.carica < 0) return s.ricarica === 0 && s.munizioni > 0 && s.navi.some((n) => n.affondata < 0 && naveX(n, s.tick + 30) !== null) ? SI : NO;
  // navi già condannate dalle palle in volo
  const salta = new Set<number>();
  for (const b of s.palle) { const r = volo(s, b, s.tick + 1, salta); if (r.nave >= 0) salta.add(r.nave); }
  const r = volo(s, sparo(potenzaDi(s.carica)), s.tick + 1, salta);
  return r.nave >= 0 ? NO : SI;
}

export const arrembaggio: MinigameModule<ArrembaggioState> = {
  id: 'arrembaggio',
  version: 1,
  maxTicks: MAX_TICKS,
  create({ seed, difficulty }) {
    const g = genera(seed >>> 0, difficulty);
    return {
      seed: seed >>> 0, difficulty, tick: 0, carica: -1, ricarica: 0, palle: [], punti: 0, spari: 0, munizioni: C.tiro.palle,
      affondate: { galeone: 0, brigantino: 0, sloop: 0, tesoro: 0 }, ultimo: { sparo: false, tonfi: [], colpi: [] }, done: false, ...g,
    };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    const t = s.tick, u: ArrembaggioState['ultimo'] = { sparo: false, tonfi: [], colpi: [] };
    s.ultimo = u;
    if (s.carica >= 0) {
      if (input.a) s.carica++;
      else { s.palle.push(sparo(potenzaDi(s.carica))); s.carica = -1; s.ricarica = RICARICA; s.spari++; s.munizioni--; u.sparo = true; }
    } else if (input.a && s.ricarica === 0 && s.munizioni > 0) s.carica = 0;
    else if (s.ricarica > 0) s.ricarica--;
    const vento = ventoAt(s.raffiche, t);
    s.palle = s.palle.filter((b) => {
      muoviPalla(b, vento);
      const i = colpita(s, b, t);
      if (i >= 0) {
        const n = s.navi[i]!;
        n.affondata = t; s.punti += C.navi[n.k].punti; s.affondate[n.k]++; u.colpi.push(i);
        return false;
      }
      if (fuori(b)) { if (b.y >= MARE) u.tonfi.push({ x: b.x, y: MARE }); return false; }
      return true;
    });
    if (t >= MAX_TICKS) s.done = true;
  },
  /** score = punti delle navi affondate; medaglia = frazione dei punti di tutte le navi (medaglie in content). */
  result(s): MinigameResult {
    return {
      done: s.done, score: s.punti, medal: medalOf(s),
      detail: {
        punti: s.punti, totale: s.totale, navi: s.affondate.galeone + s.affondate.brigantino + s.affondate.sloop + s.affondate.tesoro,
        galeoni: s.affondate.galeone, brigantini: s.affondate.brigantino, sloop: s.affondate.sloop, tesori: s.affondate.tesoro,
        spari: s.spari, ms: Math.round((s.tick / TICK_HZ) * 1000),
      },
    };
  },
  autopilot(s: ArrembaggioState, _rng: Rng): InputFrame { return autopilotaArrembaggio(s); },
  view(s): ArrembaggioView {
    const navi: ArrembaggioView['navi'] = [];
    for (const n of s.navi) {
      const t = n.affondata >= 0 ? n.affondata : s.tick, x = naveX(n, t);
      if (x !== null && (n.affondata < 0 || s.tick - n.affondata < 90)) navi.push({ id: n.id, k: n.k, x, dir: n.dir, affondata: n.affondata });
    }
    return {
      tick: s.tick, ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: C.maxSeconds * 1000, punti: s.punti, totale: s.totale, spari: s.spari, munizioni: s.munizioni,
      affondate: s.affondate, potenza: potenzaDi(s.carica), ricarica: s.ricarica / RICARICA, vento: ventoAt(s.raffiche, s.tick),
      medals: soglie(s.totale), navi, palle: s.palle, done: s.done,
    };
  },
};
