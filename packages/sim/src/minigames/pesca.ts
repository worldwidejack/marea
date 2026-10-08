// Pesca dalla barca (#66, GDD §3 «minigiochi universali»): si gioca ovunque in mare aperto, a barca ferma. Tocchi per lanciare,
// aspetti (il galleggiante a volte trema per finta: chi tira troppo presto spaventa il pesce), quando va sotto hai una finestra breve
// per tirare; poi il recupero: una barra va avanti e indietro e tocchi quando è nella zona verde (pesci rari = zona più stretta,
// barra più veloce, più colpi). Più punti in 60 s = medaglia. Il pesce dipende dal MARE (isola più vicina): opzione `mare`.
// Un solo ingresso: il fronte di salita di `a` (un pollice). Tutto a tick interi, niente trigonometria. Numeri in content (minigames/pesca.json).
import { MINIGAMES_CFG } from '@marea/content';
import type { PescaPesce, PescaRarita } from '@marea/content';
import { TICK_HZ } from '../constants.ts';
import { createRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { InputFrame } from '../types.ts';
import type { Archipelago } from '../world/archipelago.ts';
import type { Difficulty, Medal, MinigameModule, MinigameOpzioni, MinigameResult } from './types.ts';

const CFG = MINIGAMES_CFG.pesca;
const T = (s: number) => Math.round(s * TICK_HZ);
const MAX_TICKS = CFG.maxSeconds * TICK_HZ;
const LANCIO = T(CFG.lancioSecondi), FINTA = T(CFG.attesa.fintaSecondi), PRESTO = T(CFG.prestoSecondi);
const SCAPPATO = T(CFG.scappatoSecondi), PRESO = T(CFG.presoSecondi), RECUPERO_MAX = T(CFG.recupero.maxSecondi);
const REAZIONE = T(CFG.autopilotaReazioneSecondi);
/** Lanci pregenerati: più di quanti se ne possano fare in una partita (il più corto dura LANCIO + PRESTO ≈ 1,5 s). */
const LANCI = 64;
/** Mezza corsa della barra: va da 0 a 1000 e torna. */
const CORSA = 1000;
export const RARITA: readonly PescaRarita[] = ['comune', 'noncomune', 'raro', 'leggendario'];
export const PESCI: readonly PescaPesce[] = CFG.pesci;
export const MARI: readonly string[] = Object.keys(CFG.mari);

export type PescaFase = 'pronto' | 'lancio' | 'attesa' | 'abbocca' | 'recupero' | 'preso' | 'scappato' | 'presto';
/** Perché è scappato: tirato troppo tardi, troppi strappi nel recupero, recupero troppo lungo. */
export type PescaPerche = 'lento' | 'strappi' | 'tempo' | null;
/** Un lancio, deciso dal seed: quanto si aspetta, quando trema per finta, che pesce abbocca, dove sta la zona verde a ogni colpo. */
export type PescaLancio = { attesa: number; finte: number[]; pesce: string; rarita: PescaRarita; centri: number[] };
export type PescaState = {
  seed: number;
  difficulty: Difficulty;
  mare: string;
  tick: number;
  fase: PescaFase;
  faseTick: number;
  lanci: PescaLancio[];
  /** Lancio in corso (indice in `lanci`). */
  n: number;
  prevA: boolean;
  colpi: number;
  strappi: number;
  perche: PescaPerche;
  punti: number;
  presi: string[];
  /** Ultimo tocco nel recupero (per il riscontro a schermo). */
  ultimoTocco: { tick: number; ok: boolean } | null;
  done: boolean;
};
export type PescaView = {
  fase: PescaFase;
  /** Tick passati nella fase. */
  faseT: number;
  mare: string;
  mareNome: string;
  ms: number;
  maxMs: number;
  punti: number;
  presi: string[];
  /** Pesce del lancio: si vede solo da preso (durante il recupero si vede la rarità). */
  pesce: string | null;
  rarita: PescaRarita | null;
  perche: PescaPerche;
  /** Il galleggiante trema per finta adesso. */
  finta: boolean;
  /** Finestra per tirare: quanto ne resta, 0..1. */
  abbocca: number;
  /** Recupero: barra 0..1000, zona verde (centro e larghezza su 1000), colpi fatti/servono, strappi fatti/tollerati. */
  cursore: number;
  zona: { c: number; w: number } | null;
  colpi: number;
  colpiServono: number;
  strappi: number;
  strappiMax: number;
  ultimoTocco: { ok: boolean; fa: number } | null;
  medals: { oro: number; argento: number; bronzo: number };
  done: boolean;
};

const raritaDi = (r: PescaRarita) => CFG.rarita[r];
const velocita = (r: PescaRarita) => Math.round((CORSA * raritaDi(r).velocita) / TICK_HZ);
const finestra = (d: Difficulty) => T(CFG.abboccaSecondi[d - 1]!);

/** Mare valido (sconosciuto → quello di serie). */
export function marePesca(v: unknown): string {
  return typeof v === 'string' && Object.hasOwn(CFG.mari, v) ? v : CFG.mareDiSerie;
}

function scegliPesce(rng: Rng, mare: string): PescaPesce {
  const tot = RARITA.reduce((a, r) => a + raritaDi(r).peso, 0);
  let k = rng.int(1, tot), rar: PescaRarita = 'comune';
  for (const r of RARITA) { k -= raritaDi(r).peso; if (k <= 0) { rar = r; break; } }
  const qui = CFG.mari[mare]!.pesci.map((id) => PESCI.find((p) => p.id === id)!).filter((p) => p.rarita === rar);
  return rng.pick(qui);
}
function nuovoLancio(rng: Rng, mare: string): PescaLancio {
  const attesa = rng.int(T(CFG.attesa.secondi[0]), T(CFG.attesa.secondi[1]));
  const nf = rng.int(CFG.attesa.finte[0], CFG.attesa.finte[1]);
  const finte: number[] = [];
  for (let i = 0; i < nf; i++) finte.push(rng.int(12, Math.max(12, attesa - FINTA - 12)));
  finte.sort((a, b) => a - b);
  const p = scegliPesce(rng, mare), r = raritaDi(p.rarita), half = Math.round(r.zona / 2);
  const centri = Array.from({ length: r.colpi }, () => rng.int(half + 30, CORSA - half - 30));
  return { attesa, finte, pesce: p.id, rarita: p.rarita, centri };
}

/** Posizione della barra al tick `t` del recupero: avanti e indietro tra 0 e 1000. */
export function cursorePesca(rarita: PescaRarita, t: number): number {
  const u = (t * velocita(rarita)) % (2 * CORSA);
  return u <= CORSA ? u : 2 * CORSA - u;
}
const lancio = (s: PescaState): PescaLancio => s.lanci[s.n % LANCI]!;
const zonaOra = (s: PescaState) => { const l = lancio(s); return { c: l.centri[Math.min(s.colpi, l.centri.length - 1)]!, w: raritaDi(l.rarita).zona }; };
const inZona = (s: PescaState, tick: number, margine = 0) => {
  const z = zonaOra(s), pos = cursorePesca(lancio(s).rarita, tick - s.faseTick);
  return Math.abs(pos - z.c) <= z.w / 2 - margine;
};
function fase(s: PescaState, f: PescaFase): void { s.fase = f; s.faseTick = s.tick; }
function scappa(s: PescaState, perche: PescaPerche): void { s.perche = perche; s.n++; fase(s, 'scappato'); }
function medalOf(punti: number): Medal {
  const m = CFG.medaglie;
  return punti >= m.oro ? 'oro' : punti >= m.argento ? 'argento' : punti >= m.bronzo ? 'bronzo' : null;
}
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };
const TAP: InputFrame = { mx: 0, my: 0, a: true, b: false };

export const pesca: MinigameModule<PescaState> = {
  id: 'pesca',
  version: 1,
  maxTicks: MAX_TICKS,
  opzioni(v): MinigameOpzioni {
    const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    return { mare: marePesca(o['mare']) };
  },
  create({ seed, difficulty, opzioni }) {
    const mare = marePesca(opzioni?.['mare']);
    // un flusso per mare: stesso seed, mari diversi = pesci diversi (ma stesse attese e zone, a parità di rarità)
    const rng = createRng(seed).fork('pesca:' + mare);
    const lanci = Array.from({ length: LANCI }, () => nuovoLancio(rng, mare));
    return {
      seed, difficulty, mare, tick: 0, fase: 'pronto', faseTick: 0, lanci, n: 0, prevA: false, colpi: 0, strappi: 0, perche: null,
      punti: 0, presi: [], ultimoTocco: null, done: false,
    };
  },
  step(s, input) {
    if (s.done) return;
    s.tick++;
    const tap = input.a && !s.prevA;
    s.prevA = input.a;
    const t = s.tick - s.faseTick, l = lancio(s);
    switch (s.fase) {
      case 'pronto':
        if (tap) { s.perche = null; fase(s, 'lancio'); }
        break;
      case 'lancio':
        if (t >= LANCIO) fase(s, 'attesa');
        break;
      case 'attesa':
        if (tap) { s.n++; fase(s, 'presto'); } // tirato prima che abboccasse: il pesce scappa
        else if (t >= l.attesa) fase(s, 'abbocca');
        break;
      case 'abbocca':
        if (tap) { s.colpi = 0; s.strappi = 0; s.ultimoTocco = null; fase(s, 'recupero'); }
        else if (t >= finestra(s.difficulty)) scappa(s, 'lento');
        break;
      case 'recupero':
        if (tap) {
          const ok = inZona(s, s.tick);
          s.ultimoTocco = { tick: s.tick, ok };
          if (ok) {
            s.colpi++;
            if (s.colpi >= l.centri.length) { s.punti += raritaDi(l.rarita).punti; s.presi.push(l.pesce); s.n++; fase(s, 'preso'); }
          } else if (++s.strappi > CFG.recupero.strappi) scappa(s, 'strappi');
        } else if (t >= RECUPERO_MAX) scappa(s, 'tempo');
        break;
      case 'preso': if (t >= PRESO) fase(s, 'pronto'); break;
      case 'scappato': if (t >= SCAPPATO) fase(s, 'pronto'); break;
      case 'presto': if (t >= PRESTO) fase(s, 'pronto'); break;
    }
    if (s.tick >= MAX_TICKS) s.done = true;
  },
  /** score = punti (comune 1, non comune 2, raro 3, leggendario 6); medaglia per punti. */
  result(s): MinigameResult {
    const per = (r: PescaRarita) => s.presi.filter((id) => PESCI.find((p) => p.id === id)?.rarita === r).length;
    return {
      done: s.done, score: s.punti, medal: medalOf(s.punti),
      detail: {
        punti: s.punti, pesci: s.presi.length, lanci: s.n, ms: Math.round((s.tick / TICK_HZ) * 1000),
        comune: per('comune'), noncomune: per('noncomune'), raro: per('raro'), leggendario: per('leggendario'),
        mare: Math.max(0, MARI.indexOf(s.mare)),
      },
    };
  },
  /** Diario del capitano (#87): quanti pesci per specie. */
  raccolta(s): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of s.presi) out[id] = (out[id] ?? 0) + 1;
    return out;
  },
  /** Pilota di riferimento (deve fare oro): lancia subito, tira dopo 0,3 s, nel recupero tocca quando la barra è a metà della zona verde. */
  autopilot(s): InputFrame {
    if (s.done || s.prevA) return NO;
    const t = s.tick - s.faseTick;
    if (s.fase === 'pronto') return TAP;
    if (s.fase === 'abbocca') return t + 1 >= REAZIONE ? TAP : NO;
    if (s.fase === 'recupero') return inZona(s, s.tick + 1, zonaOra(s).w / 4) ? TAP : NO;
    return NO;
  },
  view(s): PescaView {
    const t = s.tick - s.faseTick, l = lancio(s);
    const reel = s.fase === 'recupero';
    const fatto = s.fase === 'preso' ? s.lanci[(s.n - 1) % LANCI]! : null;
    const finta = s.fase === 'attesa' && l.finte.some((f) => t >= f && t < f + FINTA);
    return {
      fase: s.fase, faseT: t, mare: s.mare, mareNome: CFG.mari[s.mare]!.nome, ms: Math.round((s.tick / TICK_HZ) * 1000), maxMs: MAX_TICKS / TICK_HZ * 1000,
      punti: s.punti, presi: [...s.presi], pesce: fatto ? fatto.pesce : null, rarita: reel ? l.rarita : fatto ? fatto.rarita : null, perche: s.perche,
      finta, abbocca: s.fase === 'abbocca' ? Math.max(0, 1 - t / finestra(s.difficulty)) : 0,
      cursore: reel ? cursorePesca(l.rarita, t) : 0, zona: reel ? zonaOra(s) : null,
      colpi: reel ? s.colpi : 0, colpiServono: reel ? l.centri.length : 0, strappi: reel ? s.strappi : 0, strappiMax: CFG.recupero.strappi,
      ultimoTocco: s.ultimoTocco ? { ok: s.ultimoTocco.ok, fa: s.tick - s.ultimoTocco.tick } : null,
      medals: { ...CFG.medaglie }, done: s.done,
    };
  },
};

// ---------- dove si pesca (puro: lo usano il client per il bottone PESCA e i test) ----------
export type PescaQui = { ok: boolean; mare: string; perche: 'terra' | 'riva' | 'veloce' | null };

/** Il mare del punto (x, z): quello dell'isola più vicina entro `mareVicinoM` dal suo rettangolo, altrimenti quello di serie. */
export function mareDi(arch: Archipelago, x: number, z: number): string {
  let best = CFG.mareDiSerie, bestD = CFG.mareVicinoM;
  for (const p of arch.places) {
    const mare = MARI.find((m) => CFG.mari[m]!.isole.includes(p.island));
    if (!mare) continue;
    const x0 = p.origin[0] * arch.tile, z0 = p.origin[1] * arch.tile, x1 = x0 + p.w * arch.tile, z1 = z0 + p.h * arch.tile;
    const d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
    if (d <= bestD) { bestD = d; best = mare; }
  }
  return best;
}
/** Si può pescare qui? In barca quasi ferma, su acqua profonda, senza riva entro `posto.rivaM`. */
export function pescaQui(arch: Archipelago, x: number, z: number, speed: number): PescaQui {
  const mare = mareDi(arch, x, z), m = arch.map, tile = arch.tile;
  const cx = Math.floor(x / tile), cz = Math.floor(z / tile);
  if (m.at(cx, cz) !== '~') return { ok: false, mare, perche: 'terra' };
  const r = Math.ceil(CFG.posto.rivaM / tile);
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      if (m.at(cx + dx, cz + dz) === '~') continue;
      if (Math.hypot((cx + dx + 0.5) * tile - x, (cz + dz + 0.5) * tile - z) <= CFG.posto.rivaM) return { ok: false, mare, perche: 'riva' };
    }
  if (Math.abs(speed) > CFG.posto.fermoMs) return { ok: false, mare, perche: 'veloce' };
  return { ok: true, mare, perche: null };
}
/** Il punto da pesca nel mare `mare` più vicino a (x, z), cercando a passi di 4 m (per i test e per la guida). */
export function cercaPesca(arch: Archipelago, mare: string, x: number, z: number): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null, bestD = Infinity;
  const W = arch.map.w * arch.tile, H = arch.map.h * arch.tile;
  for (let pz = 2; pz < H; pz += 4)
    for (let px = 2; px < W; px += 4) {
      const d = Math.hypot(px - x, pz - z);
      if (d >= bestD) continue;
      const q = pescaQui(arch, px, pz, 0);
      if (q.ok && q.mare === mare) { best = { x: px, z: pz }; bestD = d; }
    }
  return best;
}
