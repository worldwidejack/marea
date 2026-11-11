// Partita dell'Arena (docs/ARENA.md): una delle quattro modalità (Sopravvivenza, Caccia alle stelle, Controllo, Rapinatori) su una mappa
// dell'Arena (ARENA.mappe), giocata con la sim del dungeon e gli eroi in squadre (s.pvp). Gli eroi sono in fila per squadra: l'eroe i sta
// nella squadra indicata da squadre[i]; in Sopravvivenza a coppie alcuni gruppi possono avere un solo eroe. Fasi: `conta` secondi
// di conto alla rovescia (fermi), poi il gioco fino alla fine della modalità o del tempo. Chi cade, nelle modalità che lo prevedono,
// rinasce dopo `rinascita` s alla partenza della sua squadra, con la build com'era all'inizio (la carica dell'ulti resta) e per un attimo
// intoccabile. Le regole di ogni modalità (punti, nube, casse e monete rosse, stelle, zone, casseforti, chi vince): modi.ts. Ulti e Vigore
// dei colpi: ulti.ts. La partita finisce anche quando si arrende tutta una squadra (azione `resa`: anche il server la mette per chi ha perso la
// linea troppo a lungo; nella Sopravvivenza chi si arrende è fuori).
// Azioni tra due tick, come il menu del dungeon: `slot` (la barra degli slot), `ulti`, `resa`; registrate [tick, eroe, azione] e rigiocate dal
// server (replayPartita). Erba alta: chi ci sta dentro non lo vedono gli avversari (dungeon/erba.ts).
// Pura e deterministica: niente funzioni trascendenti (regola di dungeon/types.ts).
import { ARENA, arenaMappa, arenaModo, eroiDi, mappaPer } from '@marea/content/arena.ts';
import type { ArenaMappa, ArenaModo } from '@marea/content/arena.ts';
import { DT } from '../constants.ts';
import { hashJson } from '../hash.ts';
import type { RunHero } from '../rpg/types.ts';
import type { ArenaEroe } from '../rpg/arena.ts';
import { createParty, conEroe, secToTicks } from '../dungeon/state.ts';
import type { DungeonState, HeroRt } from '../dungeon/state.ts';
import { stepParty } from '../dungeon/dungeon.ts';
import { fermaCanale } from '../dungeon/magie.ts';
import { nellErba, velato, visibileDa } from '../dungeon/erba.ts';
import { hashOf, viewOf } from '../dungeon/view.ts';
import { frameOfRiga } from '../dungeon/replay.ts';
import type { DungeonEvent, DungeonInput, DungeonView, PackedDungeon } from '../dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../dungeon/types.ts';
import { attivaUlti, dopoUlti, fermo, inputUlti, nuovaUlti, rinasceUlti, ultiView } from './ulti.ts';
import type { UltiRt, UltiView } from './ulti.ts';
import { apriModo, dopoModo, fineModo, modoHash, modoView, quandoCade } from './modi.ts';
import type { ModoView, Mucchio, ZonaRt } from './modi.ts';

export type ArenaAzione = { t: 'slot'; n: number } | { t: 'ulti' } | { t: 'resa' };
/** [tick, eroe, azione] con tick non decrescenti (= passi della partita già fatti quando l'azione è avvenuta). */
export type ArenaAzioni = [number, number, ArenaAzione][];
export type PartitaFase = 'conta' | 'gioca' | 'finita';
/** Esito: la squadra che ha vinto (null = pareggio) e come; `punti` per squadra (stelle, % di conquista, % di vita della cassaforte; nella
 *  Sopravvivenza il posto in classifica, 1 = prima). */
export type PartitaEsito = { vincitore: number | null; perche: 'ultimo' | 'zone' | 'cassaforte' | 'tempo' | 'resa' | 'pari'; punti: number[] };
/** Eventi della partita in questo tick (oltre a quelli della sim, in `s.eventi`): il via, la fine, un'ulti lanciata, chi cade (e chi l'ha
 *  buttato giù, -1 nessuno) e chi rinasce, stelle prese, monete rosse raccolte, una zona conquistata, una squadra fuori (Sopravvivenza). */
export type PartitaEvento = { t: 'via' } | { t: 'fine'; esito: PartitaEsito } | { t: 'ulti'; i: number; id: string } | { t: 'ko'; i: number; da: number }
  | { t: 'rinasce'; i: number } | { t: 'stelle'; q: number; n: number; da: number } | { t: 'rosse'; i: number; n: number } | { t: 'zona'; z: number; q: number }
  | { t: 'fuori'; q: number; posto: number };
/** Per eroe: slot in mano, frecce per slot e ultimo tick passato ad attaccare. */
export type PartitaEroeRt = { slot: number; frecce: number[]; ultimoAttacco: number };
/** Chi gioca e dove: modalità, eroi per squadra, mappa (id di ARENA.mappe). */
export type PartitaFormato = { modo: ArenaModo; per: number; mappa: string; soli?: readonly number[] };

export type PartitaState = {
  v: 2; seed: number; eroi: readonly ArenaEroe[];
  modo: ArenaModo; per: number; mappa: string;
  /** La squadra di ogni eroe e quante sono. */
  squadre: number[]; nSquadre: number;
  tick: number; fase: PartitaFase; faseT: number;
  /** La sim (dungeon con s.pvp), lo stato degli slot di ogni eroe; `fuori[i]`: l'eroe i si è arreso, non gioca più. */
  s: DungeonState; rt: PartitaEroeRt[]; fuori: boolean[];
  /** Le RunHero degli slot di ogni eroe (copie: le monete rosse ne alzano la Vita) e com'era l'eroe alla partenza (per rinascere; fuori dall'hash). */
  var: (RunHero | null)[][]; base: HeroRt[];
  /** L'ulti di ogni eroe (ulti.ts). */
  ul: UltiRt[];
  /** A terra al tick prima; tick a cui rinasce (0 = no); quanti ne ha buttati giù e quante volte è caduto. */
  giu: boolean[]; torna: number[]; ko: number[]; cadute: number[];
  /** Punti per squadra (modi.ts): stelle, % di conquista, % di vita della cassaforte, posto nella Sopravvivenza (0 = ancora in gioco). */
  punti: number[];
  /** Sopravvivenza: monete rosse di ogni eroe, mucchi a terra, casse ancora chiuse (id dei nemici), raggio della nube. Stelle: la taglia.
   *  Controllo: le zone. Rapinatori: l'id della cassaforte di ogni squadra. Vuoti nelle altre modalità. */
  rosse: number[]; mucchi: Mucchio[]; casse: number[]; nube: number; taglia: number[]; zone: ZonaRt[]; casseforti: number[];
  esito: PartitaEsito | null;
  eventi: PartitaEvento[];
};

const M = ARENA.modi;
const RECUPERO = ARENA.build.recuperoVita, ATTESA_VITA = secToTicks(RECUPERO.attesa);
export const CONTA_TICKS = secToTicks(M.conta), RINASCITA_TICKS = secToTicks(M.rinascita);
/** La partita più lunga possibile più un margine: oltre, il replay si ferma. */
export const MAX_TICKS_PARTITA = CONTA_TICKS + secToTicks(Math.max(...M.lista.map((m) => m.secondi))) + 600;

/** Senza compagni (tutti contro tutti) gli slot con Cura o Furia restano vuoti (se non resta niente, com'era). */
function senzaSupporto(e: ArenaEroe): ArenaEroe {
  const varianti = e.varianti.map((v) => (v?.manoMagia && v.magia !== null && v.magie[v.magia]?.scuola === 'supporto' ? null : v));
  return varianti.some((v) => v) ? { ...e, varianti } : e;
}
/** Il primo slot pieno (quello con cui si parte). */
const primoSlot = (e: ArenaEroe): number => Math.max(0, e.varianti.findIndex((v) => v !== null));
const varianteDi = (d: PartitaState, i: number, n: number): RunHero => (d.var[i]![n] ?? d.var[i]![primoSlot(d.eroi[i]!)])!;
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Il formato di una partita: la modalità, gli eroi per squadra (il primo possibile se non va) e la mappa (dal seed se non c'è o non va). */
export function formatoDi(modo: ArenaModo, per: number, seed: number, mappa?: string): PartitaFormato {
  const m = arenaModo(modo), p = m.per.includes(per) ? per : m.per[0]!;
  const mp = mappa && arenaMappa(mappa).id === mappa && arenaMappa(mappa).modi.includes(m.id) ? mappa : mappaPer(m.id, seed).id;
  return { modo: m.id, per: p, mappa: mp };
}
/** Quanti eroi servono per il formato. */
export const eroiPer = (f: { modo: ArenaModo; per: number }): number => eroiDi(arenaModo(f.modo), f.per);

/** La partenza [cx, cz, fx, fz] del k-esimo della squadra q (n squadre, `per` a squadra). */
export function partenza(mp: ArenaMappa, n: number, per: number, q: number, k: number): [number, number, number, number] {
  return n <= mp.spawn.length ? mp.spawn[q]![k % mp.spawn[q]!.length]! : mp.spawn.flat()[(q * per + k) % mp.spawn.flat().length]!;
}

/** Partita nuova: gli eroi (fotografie di buildArenaEroe, tanti quanti ne chiede il formato) alle partenze, al conto alla rovescia. */
export function createPartita(o: { seed: number; eroi: readonly ArenaEroe[] } & PartitaFormato): PartitaState {
  const f = formatoDi(o.modo, o.per, o.seed, o.mappa), n = eroiPer(f), nSquadre = n / f.per;
  const soli = new Set(o.soli);
  if (soli.size && (f.modo !== 'sopravvivenza' || f.per !== 2 || [...soli].some((q) => !Number.isInteger(q) || q < 0 || q >= nSquadre))) throw new Error('Arena: squadre in solitaria non valide');
  if (f.mappa !== o.mappa || f.per !== o.per) throw new Error(`Arena: la mappa ${o.mappa} o le squadre da ${o.per} non vanno per ${o.modo}`);
  if (o.eroi.length !== n - soli.size) throw new Error(`Arena: ${o.modo} da ${o.per} vuole ${n - soli.size} eroi`);
  if (o.eroi.some((e) => !e.varianti.some((v) => v))) throw new Error('Arena: eroe senza armi né pugni');
  const squadre = Array.from({ length: nSquadre }, (_, q) => Array<number>(soli.has(q) ? 1 : f.per).fill(q)).flat();
  const eroi = o.eroi.map((e, i) => f.per === 1 || soli.has(squadre[i]!) ? senzaSupporto(e) : e), mp = arenaMappa(f.mappa);
  const v = eroi.map((e) => e.varianti.map((x) => (x ? { ...x, max: { ...x.max } } : null)));
  const s = createParty(mp, o.seed >>> 0, eroi.map((e, i) => ({ hero: v[i]![primoSlot(e)]! })), null);
  s.pvp = { squadre: [...squadre], rivela: eroi.map(() => 0), ultimo: eroi.map(() => -1), di: {} };
  s.loot = [];
  eroi.forEach((_, i) => {
    const q = squadre[i]!, [cx, cz, fx, fz] = partenza(mp, nSquadre, o.per, q, i - squadre.indexOf(q)), h = s.eroi[i]!.hero;
    h.x = (cx + 0.5) * s.map.tile; h.z = (cz + 0.5) * s.map.tile; h.fx = fx; h.fz = fz;
  });
  const d: PartitaState = {
    v: 2, seed: o.seed >>> 0, eroi, modo: f.modo, per: f.per, mappa: f.mappa, squadre, nSquadre, tick: 0, fase: 'conta', faseT: 0,
    s, rt: eroi.map((e) => ({ slot: primoSlot(e), ultimoAttacco: CONTA_TICKS, frecce: e.varianti.map((x) => x?.frecce?.n ?? 0) })), fuori: eroi.map(() => false),
    var: v, base: [], ul: eroi.map(nuovaUlti), giu: eroi.map(() => false), torna: eroi.map(() => 0), ko: eroi.map(() => 0), cadute: eroi.map(() => 0),
    punti: Array.from({ length: nSquadre }, () => 0), rosse: [], mucchi: [], casse: [], nube: 0, taglia: [], zone: [], casseforti: [], esito: null, eventi: [],
  };
  eroi.forEach((_, i) => { const h = s.eroi[i]!.hero; h.pozioni = 0; h.frecce = d.rt[i]!.frecce[d.rt[i]!.slot] ?? 0; });
  d.base = s.eroi.map((r) => copia(r.hero));
  apriModo(d);
  return d;
}

/** L'eroe i rinasce alla partenza della sua squadra: com'era all'inizio (primo slot, frecce piene), intoccabile per `protetto` s. */
function rinasci(d: PartitaState, i: number): void {
  const s = d.s, r = s.eroi[i]!, q = d.squadre[i]!, mp = arenaMappa(d.mappa), [cx, cz, fx, fz] = partenza(mp, d.nSquadre, d.per, q, i - d.squadre.indexOf(q));
  const e = d.eroi[i]!, slot = primoSlot(e);
  r.hero = copia(d.base[i]!);
  r.hero.x = (cx + 0.5) * s.map.tile; r.hero.z = (cz + 0.5) * s.map.tile; r.hero.fx = fx; r.hero.fz = fz;
  r.hero.protetto = secToTicks(M.protetto);
  r.runHero = varianteDi(d, i, slot); r.done = false; r.outcome = null;
  d.rt[i] = { slot, ultimoAttacco: d.tick, frecce: e.varianti.map((x) => x?.frecce?.n ?? 0) };
  r.hero.frecce = d.rt[i]!.frecce[slot] ?? 0;
  if (s.pvp) { s.pvp.rivela[i] = 0; if (s.pvp.velo) s.pvp.velo[i] = 0; if (s.pvp.ultimo) s.pvp.ultimo[i] = -1; }
  rinasceUlti(d.ul[i]!);
  d.torna[i] = 0; d.giu[i] = false;
  d.eventi.push({ t: 'rinasce', i });
}
const fuoriGioco = (r: DungeonState['eroi'][number]): void => { r.done = true; r.outcome = 'morto'; r.hero.vita = 0; };

/** Un passo della partita con un input per eroe. Nel conto alla rovescia gli eroi stanno fermi. */
export function stepPartita(d: PartitaState, inputs: readonly DungeonInput[]): void {
  d.eventi = [];
  if (d.fase === 'finita') return;
  d.tick++;
  if (d.fase === 'conta') {
    d.s.eventi = [];
    if (++d.faseT >= CONTA_TICKS) { d.fase = 'gioca'; d.faseT = 0; d.eventi.push({ t: 'via' }); }
    return;
  }
  stepParty(d.s, inputUlti(d, inputs));
  d.s.eroi.forEach((r, i) => {
    if (r.done) return;
    const h = r.hero, rt = d.rt[i]!, u = d.ul[i]!;
    const attacca = h.act !== 'idle' && h.act !== 'beve' && h.act !== 'schiva';
    const ultiOffensiva = u.fase !== 'no' && (u.id === 'marea' || u.id === 'arpione');
    if (attacca || h.canale > 0 || ultiOffensiva) rt.ultimoAttacco = d.tick;
    else if (d.tick - rt.ultimoAttacco >= ATTESA_VITA) h.vita = Math.min(r.runHero.max.vita, h.vita + RECUPERO.alSecondo * DT);
  });
  dopoUlti(d);
  d.faseT++;
  d.s.loot.length = 0; // in Arena non si fruga
  dopoModo(d);
  // chi è appena caduto: chi l'ha buttato giù, le regole della modalità, quando rinasce
  const rinasce = !!arenaModo(d.modo).rinasce;
  d.s.eroi.forEach((r, i) => {
    if (!r.done || d.giu[i]) return;
    d.giu[i] = true;
    const j = d.s.pvp?.ultimo?.[i] ?? -1, da = j >= 0 && d.squadre[j] !== d.squadre[i] ? j : -1;
    d.cadute[i]!++;
    if (da >= 0) d.ko[da]!++;
    d.eventi.push({ t: 'ko', i, da });
    quandoCade(d, i, da);
    if (rinasce && !d.fuori[i]) d.torna[i] = d.tick + RINASCITA_TICKS;
  });
  d.torna.forEach((t, i) => { if (t && d.tick >= t && !d.fuori[i]) rinasci(d, i); });
  const e = fineModo(d);
  if (e) chiudi(d, e);
}

function chiudi(d: PartitaState, e: PartitaEsito): void {
  d.esito = e; d.fase = 'finita'; d.faseT = 0;
  d.eventi.push({ t: 'fine', esito: e });
}

/** Azione dell'eroe i adesso (tra due tick): eventi della sim, o null se non si può (allora non si registra). */
export function actPartita(d: PartitaState, i: number, a: ArenaAzione): DungeonEvent[] | null {
  if (d.fase === 'finita' || !Number.isInteger(i) || i < 0 || i >= d.eroi.length || !a || typeof a !== 'object') return null;
  const s = d.s, e = d.eroi[i]!, rt = d.rt[i]!;
  if (a.t === 'resa') {
    if (d.fuori[i]) return null;
    d.fuori[i] = true; d.torna[i] = 0;
    const q = d.squadre[i]!, mie = d.eroi.flatMap((_, j) => (d.squadre[j] === q ? [j] : []));
    if (d.nSquadre === 2 && mie.every((j) => d.fuori[j])) chiudi(d, { vincitore: 1 - q, perche: 'resa', punti: [...d.punti] }); // tutta la squadra è fuori
    else if (!s.eroi[i]!.done) fuoriGioco(s.eroi[i]!); // gli altri continuano
    return [];
  }
  if (s.eroi[i]!.done) return null;
  if (a.t === 'slot') {
    if (!Number.isInteger(a.n) || a.n === rt.slot || !e.varianti[a.n] || fermo(d, i)) return null;
    return conEroe(s, i, () => cambiaSlot(d, i, a.n));
  }
  if (a.t === 'ulti') {
    if (!attivaUlti(d, i)) return null;
    d.eventi.push({ t: 'ulti', i, id: d.ul[i]!.id });
    return [];
  }
  return null;
}

/** L'eroe di turno passa allo slot n: la RunHero di quello slot, l'arma (o la magia) in mano, le frecce di quell'arco. Quello che stava
 *  facendo (colpo, carica, arco teso, raggio) si interrompe; le barre restano dove sono. */
function cambiaSlot(d: PartitaState, i: number, n: number): DungeonEvent[] {
  const s = d.s, h = s.hero, rt = d.rt[i]!, rh = varianteDi(d, i, n);
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

/** Un altro eroe visto da `io`: squadra, vita (massimo), slot in mano, a terra, se non lo vedo (nell'erba alta) e il numero sopra la testa
 *  (stelle della taglia o monete rosse; 0 = niente). */
export type PartitaAltro = { i: number; squadra: number; vita: number; max: number; slot: number; giu: boolean; nascosto: boolean; segno: number };
/** Quello che serve al client per disegnare la partita vista dall'eroe `io`: la vista della sim più tempo, slot, punti e le cose della
 *  modalità (modi.ts). `dungeon.compagni` ha solo gli altri eroi che `io` vede (non quelli nascosti nell'erba alta); `altri` li ha tutti. */
export type PartitaView = ModoView & {
  modo: ArenaModo; fase: PartitaFase; esito: PartitaEsito | null;
  /** Secondi che mancano: al via (conto alla rovescia) o alla fine (gioco). */
  secondi: number;
  slot: number; frecce: number[];
  /** La mia squadra, se gli avversari non mi vedono (erba alta o Velo), secondi alla mia rinascita (0 = no), se sono fuori per sempre, il
   *  mio numero sopra la testa. */
  mia: number; nascosto: boolean; torna: number; fuori: boolean; segno: number;
  punti: number[]; nSquadre: number;
  /** Le ulti di tutti (in ordine di eroe): la mia per il bottone, quelle degli altri per disegnarle. */
  ulti: UltiView[];
  altri: PartitaAltro[];
  dungeon: DungeonView;
  eventi: PartitaEvento[];
};
const segnoDi = (d: PartitaState, j: number): number => d.taglia[j] ?? d.rosse[j] ?? 0;
export function viewPartita(d: PartitaState, io: number): PartitaView {
  const s = d.s, prima = s.cur, mia = d.squadre[io]!;
  s.cur = io;
  const dungeon = viewOf(s);
  s.cur = prima;
  dungeon.compagni = dungeon.compagni.filter((c) => visibileDa(s, c.i, mia));
  const rt = d.rt[io]!, durata = secToTicks(arenaModo(d.modo).secondi);
  const resto = d.fase === 'conta' ? CONTA_TICKS - d.faseT : d.fase === 'gioca' ? durata - d.faseT : 0;
  const altri = d.eroi.flatMap((_, j): PartitaAltro[] => (j === io ? [] : [{
    i: j, squadra: d.squadre[j]!, vita: Math.max(0, s.eroi[j]!.hero.vita), max: s.eroi[j]!.runHero.max.vita, slot: d.rt[j]!.slot, giu: s.eroi[j]!.done, nascosto: !visibileDa(s, j, mia), segno: segnoDi(d, j),
  }]));
  const vede = d.squadre.some((q, j) => q !== mia && !s.eroi[j]!.done && visibileDa(s, io, q));
  return {
    ...modoView(d, io),
    modo: d.modo, fase: d.fase, esito: d.esito ? { ...d.esito, punti: [...d.esito.punti] } : null,
    secondi: Math.max(0, Math.ceil(resto / 60)),
    slot: rt.slot, frecce: rt.frecce.map((n, k) => (k === rt.slot ? s.eroi[io]!.hero.frecce : n)),
    mia, nascosto: (nellErba(s, io) || velato(s, io)) && !vede, torna: d.torna[io] ? Math.max(1, Math.ceil((d.torna[io]! - d.tick) / 60)) : 0,
    fuori: s.eroi[io]!.done && !d.torna[io], segno: segnoDi(d, io), punti: [...d.punti], nSquadre: d.nSquadre, altri, ulti: d.ul.map(ultiView),
    dungeon, eventi: d.eventi,
  };
}

/** Hash dello stato della partita (fase, slot e scorte, squadre, erba, punti e cose della modalità, più lo stato della sim con tutti gli eroi). */
export function hashPartita(d: PartitaState): number {
  return hashJson({
    v: d.v, seed: d.seed, modo: d.modo, per: d.per, mappa: d.mappa, tick: d.tick, fase: d.fase, faseT: d.faseT, esito: d.esito, rt: d.rt, fuori: d.fuori, ul: d.ul,
    torna: d.torna, ko: d.ko, cadute: d.cadute, punti: d.punti, ...modoHash(d), rivela: d.s.pvp?.rivela ?? [], velo: d.s.pvp?.velo ?? [], s: hashOf(d.s),
  });
}

export type PartitaRisultato = { esito: PartitaEsito | null; ticks: number; hash: number };
/** Il log della partita: input di ogni eroe (PackedDungeon, un frame per tick) e azioni [tick, eroe, azione]. */
export type PartitaLog = { inputs: readonly PackedDungeon[]; azioni: ArenaAzioni };

/** Rigioca la partita dal log (il server, e i test: deve dare lo stesso hash del client). Si ferma alla fine della partita o degli input. */
export function replayPartita(seed: number, eroi: readonly ArenaEroe[], log: PartitaLog, formato: PartitaFormato): PartitaRisultato {
  const d = createPartita({ seed, eroi, ...formato });
  const righe = log.inputs.map((p) => ({ p, k: 0, resto: p[0]?.[0] ?? 0 }));
  const lunghezza = Math.min(MAX_TICKS_PARTITA, ...log.inputs.map((p) => p.reduce((t, r) => t + r[0], 0)));
  let a = 0;
  for (let t = 0; t < lunghezza && d.fase !== 'finita'; t++) {
    while (a < log.azioni.length && log.azioni[a]![0] <= t) { const [, i, az] = log.azioni[a++]!; actPartita(d, i, az); }
    if ((d.fase as PartitaFase) === 'finita') break;
    const f = righe.map((r) => {
      while (r.resto <= 0 && r.k < r.p.length - 1) { r.k++; r.resto = r.p[r.k]![0]; }
      r.resto--;
      const riga = r.p[r.k];
      return riga ? frameOfRiga(riga) : NO_DUNGEON_INPUT;
    });
    stepPartita(d, f);
  }
  // le azioni dopo l'ultimo input (la resa di chi è uscito) contano ancora
  while (a < log.azioni.length && d.fase !== 'finita') { const [, i, az] = log.azioni[a++]!; actPartita(d, i, az); }
  return { esito: d.esito, ticks: d.tick, hash: hashPartita(d) };
}

/** Forma delle azioni dalla rete. null = non valida. */
export function parseArenaAzione(v: unknown): ArenaAzione | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>, n = o['n'];
  if (o['t'] === 'resa') return { t: 'resa' };
  if (o['t'] === 'ulti') return { t: 'ulti' };
  if (o['t'] === 'slot' && typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < ARENA.slot) return { t: 'slot', n };
  return null;
}
