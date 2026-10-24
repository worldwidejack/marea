// Duello dell'Arena (docs/ARENA.md §1, §5): 1v1, 2v2 o 3v3, al meglio di ARENA.round.vittorie round. Ogni round è una partita nuova della sim
// del dungeon su una mappa dell'Arena (ARENA.mappe) con gli eroi in due squadre (s.pvp): vita, posizioni, slot, frecce e pozioni tornano come
// all'inizio. Il round: `conta` secondi di conto alla rovescia (fermi), `secondi` di gioco, poi `pausa` col risultato. Vince il round la squadra
// che resta in piedi; a tempo scaduto quella con più Vita in tutto (sotto `pariSotto` punti di differenza è pari e non conta); cadute insieme =
// pari. La partita finisce a `vittorie` round vinti, alla resa di tutta una squadra (azione `resa`: anche il server la mette per chi ha perso la
// linea troppo a lungo; chi si arrende da una squadra di più resta fuori dai round che seguono) o dopo `massimo` round (più round vinti, o pareggio).
// Azioni tra due tick, come il menu del dungeon: `slot` (barra dei 4 slot), `pozione` (i 2 bottoni), `resa`; registrate [tick, eroe, azione]
// e rigiocate dal server (replayDuello). Erba alta: chi ci sta dentro non lo vedono gli avversari (dungeon/erba.ts).
// Pura e deterministica: niente funzioni trascendenti (regola di dungeon/types.ts).
import { ARENA, ARENA_SQUADRA_MAX, arenaMappa } from '@marea/content/arena.ts';
import { hashJson } from '../hash.ts';
import type { RunHero } from '../rpg/types.ts';
import type { ArenaEroe } from '../rpg/arena.ts';
import { createParty, conEroe, secToTicks } from '../dungeon/state.ts';
import type { DungeonState } from '../dungeon/state.ts';
import { stepParty } from '../dungeon/dungeon.ts';
import { applyPotion } from '../dungeon/hero.ts';
import { fermaCanale } from '../dungeon/magie.ts';
import { nellErba, visibileDa } from '../dungeon/erba.ts';
import { hashOf, viewOf } from '../dungeon/view.ts';
import { frameOfRiga } from '../dungeon/replay.ts';
import type { DungeonEvent, DungeonInput, DungeonView, PackedDungeon } from '../dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../dungeon/types.ts';

export type ArenaAzione = { t: 'slot'; n: number } | { t: 'pozione'; n: number } | { t: 'resa' };
/** [tick, eroe, azione] con tick non decrescenti (= passi del duello già fatti quando l'azione è avvenuta). */
export type ArenaAzioni = [number, number, ArenaAzione][];
export type DuelloFase = 'conta' | 'gioca' | 'pausa' | 'finita';
/** Esito di un round: la squadra che l'ha vinto (null = pari) e come. */
export type RoundEsito = { vincitore: number | null; perche: 'ko' | 'tempo' | 'pari' };
/** Esito della partita: la squadra che ha vinto (null = pareggio), come, round vinti da ciascuna squadra. */
export type DuelloEsito = { vincitore: number | null; perche: 'round' | 'resa' | 'pari'; vinti: number[] };
/** Eventi del duello in questo tick (oltre a quelli della sim del round, in `s.eventi`). */
export type DuelloEvento = { t: 'via'; round: number } | { t: 'round'; round: number; esito: RoundEsito } | { t: 'fine'; esito: DuelloEsito };
/** Per eroe, nel round: slot in mano, frecce rimaste per slot (gli archi), pozioni già bevute. */
export type DuelloEroeRt = { slot: number; frecce: number[]; bevute: boolean[] };
/** Chi partecipa e dove: la squadra (0 o 1) di ogni eroe, in ordine (tutte e due le squadre dello stesso numero, da 1 a 3), e la mappa. */
export type DuelloFormato = { squadre: number[]; mappa: string };

export type DuelloState = {
  v: 1; seed: number; eroi: readonly ArenaEroe[];
  /** La squadra di ogni eroe e la mappa (id di ARENA.mappe). */
  squadre: number[]; mappa: string;
  /** Passi del duello (tutte le fasi), round in corso (da 0), round vinti per squadra, esiti dei round finiti. */
  tick: number; round: number; vinti: number[]; rounds: RoundEsito[];
  fase: DuelloFase; faseT: number;
  /** La partita del round (sim del dungeon con s.pvp) e lo stato degli slot di ogni eroe; `fuori[i]`: l'eroe i si è arreso, non gioca più. */
  s: DungeonState; rt: DuelloEroeRt[]; fuori: boolean[];
  esito: DuelloEsito | null;
  eventi: DuelloEvento[];
};

const R = ARENA.round;
export const CONTA_TICKS = secToTicks(R.conta), ROUND_TICKS = secToTicks(R.secondi), PAUSA_TICKS = secToTicks(R.pausa);
/** Il duello più lungo possibile (tutti i round a tempo pieno) più un margine: oltre, il replay si ferma. */
export const MAX_TICKS_DUELLO = (CONTA_TICKS + ROUND_TICKS + PAUSA_TICKS) * R.massimo + 600;

/** Il primo slot pieno (quello con cui si parte). */
const primoSlot = (e: ArenaEroe): number => Math.max(0, e.varianti.findIndex((v) => v !== null));
const varianteDi = (e: ArenaEroe, n: number): RunHero => (e.varianti[n] ?? e.varianti[primoSlot(e)])!;

/** Il formato di una partita di `n` eroi per squadra: prima la squadra 0, poi la 1. */
export const formatoDi = (n: number, mappa = 'colosseo'): DuelloFormato => ({ squadre: [...Array.from({ length: n }, () => 0), ...Array.from({ length: n }, () => 1)], mappa });

/** Duello nuovo: gli eroi (fotografie di buildArenaEroe) con squadre e mappa (senza: due eroi, uno per squadra, nel colosseo); primo round al
 *  conto alla rovescia. */
export function createDuello(o: { seed: number; eroi: readonly ArenaEroe[]; squadre?: readonly number[]; mappa?: string }): DuelloState {
  const squadre = o.squadre ? [...o.squadre] : o.eroi.map((_, i) => i), mappa = arenaMappa(o.mappa ?? 'colosseo').id;
  const k = squadre.filter((q) => q === 0).length;
  if (o.eroi.length !== squadre.length || k < 1 || k > ARENA_SQUADRA_MAX || squadre.length !== 2 * k || squadre.some((q) => q !== 0 && q !== 1) || squadre.filter((q) => q === 1).length !== k) throw new Error('Duello: servono due squadre uguali di 1-3 eroi');
  if (o.eroi.some((e) => !e.varianti.some((v) => v))) throw new Error('Duello: eroe senza armi né pugni');
  if (arenaMappa(mappa).spawn.some((l) => l.length < k)) throw new Error(`Duello: la mappa ${mappa} non è per ${k} eroi a squadra`);
  const d = { v: 1, seed: o.seed >>> 0, eroi: o.eroi, squadre, mappa, tick: 0, round: 0, vinti: [0, 0], rounds: [], fase: 'conta', faseT: 0, fuori: o.eroi.map(() => false), esito: null, eventi: [] } as unknown as DuelloState;
  nuovoRound(d);
  return d;
}

/** Round nuovo: partita nuova sulla mappa, eroi alle partenze della loro squadra, slot e scorte come all'inizio (chi si è arreso resta fuori). */
function nuovoRound(d: DuelloState): void {
  const seed = (d.seed ^ Math.imul(d.round + 1, 0x9e3779b1)) >>> 0, mappa = arenaMappa(d.mappa);
  const s = createParty(mappa, seed, d.eroi.map((e) => ({ hero: varianteDi(e, primoSlot(e)) })), null);
  s.pvp = { squadre: [...d.squadre], rivela: d.eroi.map(() => 0) };
  const dentro = [0, 0];
  d.eroi.forEach((_, i) => {
    const q = d.squadre[i]!, [cx, cz, fx, fz] = mappa.spawn[q]![dentro[q]!++]!, r = s.eroi[i]!;
    r.hero.x = (cx + 0.5) * s.map.tile; r.hero.z = (cz + 0.5) * s.map.tile; r.hero.fx = fx; r.hero.fz = fz;
    if (d.fuori[i]) fuoriGioco(r);
  });
  d.s = s;
  d.rt = d.eroi.map((e) => ({ slot: primoSlot(e), frecce: e.varianti.map((v) => v?.frecce?.n ?? 0), bevute: e.pozioni.map(() => false) }));
  d.eroi.forEach((e, i) => { const h = s.eroi[i]!.hero; h.pozioni = e.pozioni.length; h.frecce = d.rt[i]!.frecce[d.rt[i]!.slot] ?? 0; });
  d.fase = 'conta'; d.faseT = 0;
}
const fuoriGioco = (r: DungeonState['eroi'][number]): void => { r.done = true; r.outcome = 'morto'; r.hero.vita = 0; };

/** Un passo del duello con un input per eroe. Nel conto alla rovescia e nella pausa gli eroi stanno fermi. */
export function stepDuello(d: DuelloState, inputs: readonly DungeonInput[]): void {
  d.eventi = [];
  if (d.fase === 'finita') return;
  d.tick++;
  if (d.fase === 'conta') {
    d.s.eventi = [];
    if (++d.faseT >= CONTA_TICKS) { d.fase = 'gioca'; d.faseT = 0; d.eventi.push({ t: 'via', round: d.round }); }
    return;
  }
  if (d.fase === 'pausa') {
    d.s.eventi = [];
    if (++d.faseT >= PAUSA_TICKS) { d.round++; nuovoRound(d); }
    return;
  }
  stepParty(d.s, inputs);
  d.faseT++;
  const inPiedi = [0, 1].map((q) => d.s.eroi.some((r, i) => d.squadre[i] === q && !r.done));
  if (!inPiedi[0] || !inPiedi[1]) fineRound(d, !inPiedi[0] && !inPiedi[1] ? { vincitore: null, perche: 'pari' } : { vincitore: inPiedi[0] ? 0 : 1, perche: 'ko' });
  else if (d.faseT >= ROUND_TICKS) {
    const [a, b] = [0, 1].map((q) => d.s.eroi.reduce((t, r, i) => (d.squadre[i] === q ? t + Math.max(0, r.hero.vita) : t), 0));
    fineRound(d, Math.abs(a! - b!) < R.pariSotto ? { vincitore: null, perche: 'pari' } : { vincitore: a! > b! ? 0 : 1, perche: 'tempo' });
  }
}

function fineRound(d: DuelloState, e: RoundEsito): void {
  d.rounds.push(e);
  if (e.vincitore !== null) d.vinti[e.vincitore]!++;
  d.eventi.push({ t: 'round', round: d.round, esito: e });
  const [a, b] = d.vinti as [number, number];
  if (a >= R.vittorie || b >= R.vittorie || d.rounds.length >= R.massimo) chiudi(d, { vincitore: a === b ? null : a > b ? 0 : 1, perche: a === b ? 'pari' : 'round', vinti: [a, b] });
  else { d.fase = 'pausa'; d.faseT = 0; }
}
function chiudi(d: DuelloState, e: DuelloEsito): void {
  d.esito = e; d.fase = 'finita'; d.faseT = 0;
  d.eventi.push({ t: 'fine', esito: e });
}

/** Azione dell'eroe i adesso (tra due tick): eventi della sim, o null se non si può (allora non si registra). */
export function actDuello(d: DuelloState, i: number, a: ArenaAzione): DungeonEvent[] | null {
  if (d.fase === 'finita' || !Number.isInteger(i) || i < 0 || i >= d.eroi.length || !a || typeof a !== 'object') return null;
  const s = d.s, e = d.eroi[i]!, rt = d.rt[i]!;
  if (a.t === 'resa') {
    if (d.fuori[i]) return null;
    d.fuori[i] = true;
    const q = d.squadre[i]!;
    if (d.eroi.every((_, j) => d.squadre[j] !== q || d.fuori[j])) chiudi(d, { vincitore: 1 - q, perche: 'resa', vinti: [...d.vinti] }); // tutta la squadra è fuori
    else if (!s.eroi[i]!.done) fuoriGioco(s.eroi[i]!); // gli altri della squadra continuano
    return [];
  }
  if (s.eroi[i]!.done || (d.fase !== 'gioca' && d.fase !== 'conta')) return null;
  if (a.t === 'slot') {
    if (!Number.isInteger(a.n) || a.n === rt.slot || !e.varianti[a.n]) return null;
    return conEroe(s, i, () => cambiaSlot(d, i, a.n));
  }
  if (a.t === 'pozione') {
    const p = e.pozioni[a.n];
    if (d.fase !== 'gioca' || !Number.isInteger(a.n) || !p || rt.bevute[a.n]) return null;
    rt.bevute[a.n] = true;
    return conEroe(s, i, () => {
      applyPotion(s, p);
      const h = s.hero;
      h.pozioni = rt.bevute.filter((x) => !x).length;
      if (h.act === 'idle') { h.act = 'beve'; h.actT = 0; h.actDur = secToTicks(0.4); }
      return [{ t: 'pozione', id: p.id }];
    });
  }
  return null;
}

/** L'eroe di turno passa allo slot n: la RunHero di quello slot, l'arma (o la magia) in mano, le frecce di quell'arco. Quello che stava
 *  facendo (colpo, carica, arco teso, raggio) si interrompe; le barre restano dove sono. */
function cambiaSlot(d: DuelloState, i: number, n: number): DungeonEvent[] {
  const s = d.s, h = s.hero, rt = d.rt[i]!, rh = d.eroi[i]!.varianti[n]!;
  rt.frecce[rt.slot] = h.frecce;
  if (h.canale > 0) fermaCanale(s, s.runHero.magia !== null ? s.runHero.magie[s.runHero.magia] : undefined);
  rt.slot = n;
  s.runHero = rh;
  h.arma = { ...rh.arma, traits: { ...rh.arma.traits } };
  h.incanta = !!rh.manoMagia;
  h.frecce = rt.frecce[n] ?? 0;
  h.colpiFragile = 0; h.pressione = rh.arma.traits.lame?.cariche ?? 0; h.molla = rh.arma.traits.carillon?.colpi ?? 0; h.mollaT = 0; h.ritmo = 0; h.tic = -1; h.rintocco = false;
  h.raffica = 0; h.massimaP = 0; h.massimo = false; h.poppa = false;
  if (h.act === 'press' || h.act === 'carica' || h.act === 'swing' || h.act === 'tende' || h.act === 'punta') {
    h.act = 'idle'; h.actT = 0; h.actDur = 0; h.carica = 0; h.caricato = false; h.colpiti = []; h.colpito = false;
  }
  if (!rh.armatura.barriera) h.barr = 0;
  const sp = rh.magia !== null ? rh.magie[rh.magia] : undefined;
  return [{ t: 'equip', slot: h.incanta ? 'magia' : 'arma', item: h.incanta ? sp?.id ?? null : rh.arma.id }];
}

/** Un altro eroe del duello visto da `io`: squadra, vita (massimo), slot in mano, a terra o fuori, e se non lo vedo (nell'erba alta). */
export type DuelloAltro = { i: number; squadra: number; vita: number; max: number; slot: number; giu: boolean; nascosto: boolean };
/** Quello che serve al client per disegnare il duello visto dall'eroe `io`: la vista della sim del round più round, tempo, slot e pozioni.
 *  `dungeon.compagni` ha solo gli altri eroi che `io` vede (non quelli nascosti nell'erba alta); `altri` li ha tutti. */
export type DuelloView = {
  fase: DuelloFase; round: number; vinti: number[]; rounds: RoundEsito[]; esito: DuelloEsito | null;
  /** Secondi che mancano: al via (conto alla rovescia), alla fine del round (gioco), al round dopo (pausa). */
  secondi: number;
  slot: number; frecce: number[]; bevute: boolean[];
  /** La mia squadra, e se gli avversari non mi vedono (sono nell'erba alta). */
  mia: number; nascosto: boolean;
  altri: DuelloAltro[];
  dungeon: DungeonView;
  eventi: DuelloEvento[];
};
export function viewDuello(d: DuelloState, io: number): DuelloView {
  const s = d.s, prima = s.cur, mia = d.squadre[io]!;
  s.cur = io;
  const dungeon = viewOf(s);
  s.cur = prima;
  dungeon.compagni = dungeon.compagni.filter((c) => visibileDa(s, c.i, mia));
  const rt = d.rt[io]!;
  const resto = d.fase === 'conta' ? CONTA_TICKS - d.faseT : d.fase === 'gioca' ? ROUND_TICKS - d.faseT : d.fase === 'pausa' ? PAUSA_TICKS - d.faseT : 0;
  const altri = d.eroi.flatMap((_, j): DuelloAltro[] => (j === io ? [] : [{
    i: j, squadra: d.squadre[j]!, vita: Math.max(0, s.eroi[j]!.hero.vita), max: s.eroi[j]!.runHero.max.vita, slot: d.rt[j]!.slot, giu: s.eroi[j]!.done, nascosto: !visibileDa(s, j, mia),
  }]));
  return {
    fase: d.fase, round: d.round, vinti: [...d.vinti], rounds: d.rounds.map((r) => ({ ...r })), esito: d.esito ? { ...d.esito, vinti: [...d.esito.vinti] } : null,
    secondi: Math.max(0, Math.ceil(resto / 60)),
    slot: rt.slot, frecce: rt.frecce.map((n, k) => (k === rt.slot ? s.eroi[io]!.hero.frecce : n)), bevute: [...rt.bevute],
    mia, nascosto: nellErba(s, io) && !visibileDa(s, io, 1 - mia), altri,
    dungeon, eventi: d.eventi,
  };
}

/** Hash dello stato del duello (round, vinti, fase, slot e scorte, squadre, erba, più lo stato della sim del round con tutti gli eroi). */
export function hashDuello(d: DuelloState): number {
  return hashJson({ v: d.v, seed: d.seed, squadre: d.squadre, mappa: d.mappa, tick: d.tick, round: d.round, vinti: d.vinti, rounds: d.rounds, fase: d.fase, faseT: d.faseT, esito: d.esito, rt: d.rt, fuori: d.fuori, rivela: d.s.pvp?.rivela ?? [], s: hashOf(d.s) });
}

export type DuelloRisultato = { esito: DuelloEsito | null; rounds: RoundEsito[]; ticks: number; hash: number };
/** Il log del duello: input di ogni eroe (PackedDungeon, un frame per tick) e azioni [tick, eroe, azione]. */
export type DuelloLog = { inputs: readonly PackedDungeon[]; azioni: ArenaAzioni };

/** Rigioca il duello dal log (il server, e i test: deve dare lo stesso hash del client). Si ferma alla fine della partita o degli input. */
export function replayDuello(seed: number, eroi: readonly ArenaEroe[], log: DuelloLog, formato?: DuelloFormato): DuelloRisultato {
  const d = createDuello({ seed, eroi, ...(formato ?? {}) });
  const righe = log.inputs.map((p) => ({ p, k: 0, resto: p[0]?.[0] ?? 0 }));
  const lunghezza = Math.min(MAX_TICKS_DUELLO, ...log.inputs.map((p) => p.reduce((t, r) => t + r[0], 0)));
  let a = 0;
  for (let t = 0; t < lunghezza && d.fase !== 'finita'; t++) {
    while (a < log.azioni.length && log.azioni[a]![0] <= t) { const [, i, az] = log.azioni[a++]!; actDuello(d, i, az); }
    if ((d.fase as DuelloFase) === 'finita') break;
    const f = righe.map((r) => {
      while (r.resto <= 0 && r.k < r.p.length - 1) { r.k++; r.resto = r.p[r.k]![0]; }
      r.resto--;
      const riga = r.p[r.k];
      return riga ? frameOfRiga(riga) : NO_DUNGEON_INPUT;
    });
    stepDuello(d, f);
  }
  // le azioni dopo l'ultimo input (la resa di chi è uscito) contano ancora
  while (a < log.azioni.length && d.fase !== 'finita') { const [, i, az] = log.azioni[a++]!; actDuello(d, i, az); }
  return { esito: d.esito, rounds: d.rounds.map((r) => ({ ...r })), ticks: d.tick, hash: hashDuello(d) };
}

/** Forma delle azioni dalla rete. null = non valida. */
export function parseArenaAzione(v: unknown): ArenaAzione | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>, n = o['n'];
  if (o['t'] === 'resa') return { t: 'resa' };
  if ((o['t'] === 'slot' || o['t'] === 'pozione') && typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < (o['t'] === 'slot' ? ARENA.slot : ARENA.pozioni)) return { t: o['t'], n };
  return null;
}
