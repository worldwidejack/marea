// La chiacchierata con un paesano di Borgo Marea, nel chunk del pannello del Porto (ui/porto_ui.ts la disegna nella scheda in
// basso). Qui si decide cosa dice, pagina per pagina: la battuta della chiacchiera (economy/paesani.ts `chiacchiera`: momento, stagione,
// tempo che fa, lore, primo incontro, insistente, senza ripetersi), oppure il favore in corso (messaggio da portare, pesce o insetto da
// regalare, scaduto), e alla fine il favore che chiede adesso, con SÌ / NON ORA. I cambi di stato passano dal server (/api/lot/paesani/*):
// il client li calcola uguali con la sim, così la battuta giusta esce subito e il server conferma (monete che volano, mobile nel magazzino).
import { INSETTI } from '@marea/content/insetti.ts';
import { PAESANI, PAESANI_CFG } from '@marea/content/paesani.ts';
import { PESCI } from '@marea/content/pesci.ts';
import { MOBILI } from '@marea/content';
import type { LotState } from '@marea/sim';
import { createRng } from '@marea/sim/rng.ts';
import {
  chiacchiera, chiamato, cosaSpecie, cosaSuccede, durataTesto, nomeSpecie, offertaDi, paesaniOf, riempi, unaDi,
} from '@marea/sim/economy/paesani.ts';
import type { EventoPaesano, Favore, FavorePorta, Offerta, Premio } from '@marea/sim/economy/paesani.ts';
import { ApiError } from '../net/api.ts';
import type { PortoCtx } from '../game/porto.ts';

export type Scelta = { label: string; act: string; principale?: boolean; fai(): void | Promise<void> };
/** Una pagina della scheda: la battuta, una nota piccola sotto (cosa fare), e le scelte (se no AVANTI / CIAO). */
export type Pagina = { testo: string; nota?: string; scelte?: Scelta[] };
/** Cosa può fare una scelta sulla scheda aperta. */
export type Scheda = {
  /** Aggiunge pagine dopo quella di adesso e ci va. */
  poi(p: Pagina[]): void;
  /** Mette una nota (errore del server) sulla pagina di adesso. */
  nota(t: string): void;
  chiudi(): void;
  /** La scheda è ancora quella (non chiusa e riaperta nel frattempo). */
  viva(): boolean;
  /** Le monete del premio volano verso la barra. */
  vola(monete: number): void;
};
export type Cielo = { pioggia: number; vento: number };

// ———— memoria del telefono: chi conosci (anche senza link personale) e le battute dette da poco ————
const KEY = 'mz-paesani';
type Memoria = { conosciuti: string[]; recenti: Record<string, string[]> };
function leggi(): Memoria {
  try { const m = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Memoria | null; if (m && Array.isArray(m.conosciuti) && m.recenti && typeof m.recenti === 'object') return m; } catch { /* pazienza */ }
  return { conosciuti: [], recenti: {} };
}
function scrivi(m: Memoria): void { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* pazienza */ } }
/** Quando hai parlato con chi (ms del telefono), per l'«insistente». */
const parlate = new Map<string, number[]>();

const nomeMobile = (id: string) => MOBILI.find((m) => m.id === id)?.nome ?? 'un mobile';
/** Dove e quando si trova il pesce o l'insetto chiesto. */
function dritta(f: { cosa: 'pesce' | 'insetto'; id: string }): string {
  if (f.cosa === 'pesce') {
    const p = PESCI.find((x) => x.id === f.id);
    if (!p) return '';
    return (p.zona === 'riva' ? 'Si pesca dalla riva del Borgo' : 'Si pesca dalla barca, al largo') + (p.fascia === 'giorno' ? ', di giorno' : p.fascia === 'notte' ? ', di notte' : '');
  }
  const i = INSETTI.find((x) => x.id === f.id);
  if (!i) return '';
  const dove = { volante: 'Vola in giro per il Borgo', terra: 'Cammina nell\'erba del Borgo', sasso: 'Esce dai sassi colpiti con la pala', albero: 'Cade dagli alberi scossi' }[i.tipo];
  return dove + (i.fascia === 'giorno' ? ', di giorno' : i.fascia === 'notte' ? ', di notte' : '');
}
const MAIUSCOLA = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type ChiacchierataOpts = { id: string; ctx: PortoCtx; cielo: Cielo | null; cancello: boolean; ora: number; scheda: Scheda };

/** Le pagine della chiacchierata col paesano `id` adesso. Fa partire da sola le chiamate al server che servono. */
export function chiacchierata(o: ChiacchierataOpts): Pagina[] {
  const { id, ctx, scheda } = o, p = PAESANI[id];
  if (!p) return [];
  const V = p.favori, now = o.ora, rng = createRng((Math.random() * 4294967296) >>> 0);
  const online = !!ctx.api?.enabled, lot = online ? ctx.getLot() : null;
  const mem = leggi(), sulServer = !!lot && paesaniOf(lot, now).conosciuti.includes(id);
  const primo = !sulServer && !mem.conosciuti.includes(id);
  const t = performance.now(), fila = (parlate.get(id) ?? []).filter((x) => t - x < PAESANI_CFG.insistente.finestraS * 1000);
  fila.push(t); parlate.set(id, fila);
  const ev: EventoPaesano = lot ? cosaSuccede(lot, id, now) : { k: 'niente' };
  const da = (f: Favore) => chiamato(f.da), cosa = (f: { cosa: 'pesce' | 'insetto'; id: string }) => cosaSpecie(f.cosa, f.id);
  const resto = (f: Favore) => durataTesto(Math.max(15 * 60_000, f.scade - now));
  const premioTesto = (pr: Premio) => ('monete' in pr ? riempi(unaDi(V.monete, rng), { monete: pr.monete }) : riempi(unaDi(V.mobile, rng), { mobile: nomeMobile(pr.mobile) }));
  const premioNota = (pr: Premio) => ('monete' in pr ? undefined : 'Il mobile è nel magazzino di casa: ARREDA per sistemarlo');
  const pagine: Pagina[] = [];

  // il server: primo incontro, messaggio portato, favore riscosso o scaduto
  const servePar = online && (!sulServer || ev.k === 'messaggio' || ev.k === 'fatto' || ev.k === 'scaduto');
  if (servePar && ctx.api) {
    ctx.api.paesani('parla', { id }).then((r) => {
      ctx.setLot(r.lot);
      if (r.premio && 'monete' in r.premio) scheda.vola(r.premio.monete);
      if (r.premio && 'mobile' in r.premio) ctx.hud.toast(`Nuovo mobile in casa: ${nomeMobile(r.premio.mobile)}`, 3000);
    }, (e) => { if (ev.k !== 'niente' && scheda.viva()) scheda.nota(e instanceof ApiError ? e.message : 'Qualcosa non va: riprova tra poco'); });
  }

  const chiacchiere = (): void => {
    const c = chiacchiera(id, { ms: now, cancello: o.cancello, pioggia: o.cielo?.pioggia ?? 0, vento: o.cielo?.vento ?? 0, primo, diFila: fila.length, recenti: mem.recenti[id] ?? [] }, rng);
    for (const r of c.righe) pagine.push({ testo: r });
    mem.recenti[id] = [...(mem.recenti[id] ?? []), ...c.chiavi].slice(-PAESANI_CFG.memoria);
  };

  if (primo && ev.k !== 'niente') chiacchiere(); // chi non ti conosce si presenta, poi viene al punto
  switch (ev.k) {
    case 'messaggio': {
      const f = ev.favore;
      pagine.push({ testo: riempi(V.messaggi[f.msg].risponde, { da: da(f) }), nota: `Messaggio portato: torna da ${da(f)}` });
      break;
    }
    case 'fatto': {
      const f = ev.favore;
      pagine.push({ testo: riempi(PAESANI[f.da]!.favori.messaggi[f.msg].grazie, { a: chiamato(f.a) }) });
      pagine.push({ testo: premioTesto(f.premio), ...(premioNota(f.premio) ? { nota: premioNota(f.premio)! } : {}) });
      break;
    }
    case 'attesa': {
      const f = ev.favore;
      pagine.push({ testo: riempi(unaDi(V.attesa, rng), { a: chiamato(f.a) }), nota: `${PAESANI[f.a]?.dove ?? ''} Ti resta ${resto(f)}.`.trim() });
      break;
    }
    case 'promemoria': {
      const f = ev.favore;
      pagine.push({ testo: riempi(unaDi(V.promemoria, rng), { cosa: cosa(f), nome: nomeSpecie(f.cosa, f.id) }), nota: `${dritta(f)}. Ti resta ${resto(f)}.` });
      break;
    }
    case 'dono': {
      const f = ev.favore;
      pagine.push({ testo: riempi(unaDi(V.dono, rng), { cosa: cosa(f), nome: nomeSpecie(f.cosa, f.id) }), scelte: [
        { label: `Regala`, act: 'regala', principale: true, fai: () => regala(f) },
        { label: 'Non ancora', act: 'non-ancora', fai: () => scheda.chiudi() },
      ] });
      break;
    }
    case 'scaduto':
      pagine.push({ testo: unaDi(V.scaduto, rng) });
      break;
    default: {
      chiacchiere();
      const insiste = fila.length >= PAESANI_CFG.insistente.dalla;
      const off = !primo && !insiste && lot ? offertaDi(lot, id, now) : null;
      if (off) pagine.push(richiesta(off));
    }
  }
  scrivi({ ...mem, conosciuti: mem.conosciuti.includes(id) ? mem.conosciuti : [...mem.conosciuti, id] });
  return pagine;

  function richiesta(off: Offerta): Pagina {
    const testo = off.tipo === 'parla'
      ? riempi(V.messaggi[off.msg].chiede, { a: chiamato(off.a) })
      : riempi(unaDi(off.cosa === 'pesce' ? V.pesce : V.insetto, rng), { cosa: cosa(off), tempo: durataTesto(off.durata) });
    const nota = off.tipo === 'parla' ? PAESANI[off.a]?.dove ?? '' : dritta(off) + '.';
    return { testo, nota, scelte: [
      { label: 'Va bene', act: 'accetta', principale: true, fai: () => accetta(off) },
      { label: 'Non ora', act: 'rifiuta', fai: () => rifiuta() },
    ] };
  }
  async function accetta(off: Offerta): Promise<void> {
    if (!ctx.api) return;
    try {
      const r = await ctx.api.paesani('accetta', { id, slot: off.slot });
      ctx.setLot(r.lot);
      if (!scheda.viva()) return;
      const cosaFare = off.tipo === 'parla'
        ? `Favore: vai a dirlo a ${chiamato(off.a)}, poi torna da ${chiamato(id)} (entro ${durataTesto(off.durata)})`
        : `Favore: regala ${cosa(off)} a ${chiamato(id)} entro ${durataTesto(off.durata)}`;
      scheda.poi([{ testo: unaDi(V.si, rng), nota: cosaFare }]);
    } catch (e) { if (scheda.viva()) scheda.nota(e instanceof ApiError ? e.message : 'Qualcosa non va: riprova tra poco'); }
  }
  async function rifiuta(): Promise<void> {
    if (ctx.api) ctx.api.paesani('rifiuta', { id }).then((r) => ctx.setLot(r.lot), () => { /* la pausa è solo una gentilezza */ });
    scheda.poi([{ testo: unaDi(V.no, rng) }]);
  }
  async function regala(f: FavorePorta): Promise<void> {
    if (!ctx.api) return;
    try {
      const r = await ctx.api.paesani('dona', { id });
      ctx.setLot(r.lot);
      const pr = r.premio ?? f.premio;
      if ('monete' in pr) scheda.vola(pr.monete); else ctx.hud.toast(`Nuovo mobile in casa: ${nomeMobile(pr.mobile)}`, 3000);
      if (!scheda.viva()) return;
      scheda.poi([{ testo: MAIUSCOLA(riempi(unaDi(V.grazie, rng), { cosa: cosa(f), nome: nomeSpecie(f.cosa, f.id) })) }, { testo: premioTesto(pr), ...(premioNota(pr) ? { nota: premioNota(pr)! } : {}) }]);
    } catch (e) { if (scheda.viva()) scheda.nota(e instanceof ApiError ? e.message : 'Qualcosa non va: riprova tra poco'); }
  }
}

/** Il favore in corso, in una riga (la Bacheca lo mostra in cima): null se non ce n'è. */
export function favoreInCorso(lot: LotState | null, now: number): { testo: string; scade: number } | null {
  const f = paesaniOf(lot, now).favore;
  if (!f || now > f.scade) return null;
  const testo = f.tipo === 'parla'
    ? (f.detto ? `Torna da ${chiamato(f.da)}: il messaggio per ${chiamato(f.a)} è arrivato` : `Vai a dire a ${chiamato(f.a)} quello che ti ha chiesto ${chiamato(f.da)}`)
    : `Regala ${cosaSpecie(f.cosa, f.id)} a ${chiamato(f.da)}`;
  return { testo, scade: f.scade };
}
