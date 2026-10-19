// La partita a ondate nel lotto (docs/TEMPLARI.md §10): il server apre la partita col seed, a fine partita rigioca gli input e paga le ondate
// superate (monete a ondata, fino a maxOndate, #414) entro il tetto del giorno UTC. Il record resta nel lotto. Pura.
// In più lo sblocco dell'isola (§2): il calice preso accanto allo scheletro sotto il faro della Tempesta resta nel lotto (`reliquie`).
import { ARCHIPELAGO } from '@marea/content';
import { TEMPLARI, eroeDef } from '@marea/content/templari.ts';
import { sbloccoTema, viaggiatore } from '../world/temi.ts';
import { advance } from '../economy/advance.ts';
import { guadagna } from '../economy/monete.ts';
import { EconomyError } from '../economy/types.ts';
import type { LotState, TemplariLotto } from '../economy/types.ts';
import type { TRisultato } from './types.ts';

const DAY = 86_400_000;
const NESSUNO: TemplariLotto = { pending: null, giorno: 0, preso: 0, record: 0, partite: 0 };

/** Stato dei Templari del lotto, col premio del giorno azzerato se è cambiato il giorno UTC (nei salvataggi di prima `preso` era in risorse: vale 0). */
export function templariOf(lot: LotState, nowMs: number): TemplariLotto {
  const t0 = lot.templari ?? NESSUNO, g = Math.floor(nowMs / DAY);
  const t = typeof t0.preso === 'number' ? t0 : { ...t0, preso: 0 };
  return t.giorno === g ? t : { ...t, giorno: g, preso: 0 };
}

/** Il calice dei Templari (la reliquia `id`) preso accanto allo scheletro sotto il faro della Tempesta: serve aver aperto la Tempesta (lo
 *  scheletro sta lì), poi la nebbia rossa si dirada per sempre. `nuova` false = ce l'avevi già (niente cambia). */
export function prendiReliquia(lot: LotState, id = 'templari'): { lot: LotState; nuova: boolean } {
  if ((lot.reliquie ?? []).includes(id)) return { lot, nuova: false };
  const tempesta = ARCHIPELAGO.islands.find((i) => i.island === 'tempesta')?.tema?.sblocco;
  if (tempesta && !sbloccoTema(tempesta, viaggiatore(lot, null)).aperta) throw new EconomyError('requisito', 'La tempesta non ti lascia arrivare al relitto: prima alza il Molo');
  return { lot: { ...lot, version: lot.version + 1, reliquie: [...(lot.reliquie ?? []), id] }, nuova: true };
}

/** Monete piene per `superate` ondate (prima del tetto). */
export function premioOndate(superate: number): number {
  const p = TEMPLARI.premio, n = Math.max(0, Math.min(p.maxOndate, Math.floor(superate)));
  return p.perOndata * n;
}

/** Insieme: il DO TemplariInsieme apre la partita della squadra nel lotto di ciascuno (seed comune, io = idx). */
export function startTemplariInsieme(lot: LotState, seed: number, nowMs: number, run: string, idx: number): LotState {
  const t = templariOf(lot, nowMs);
  return { ...lot, version: lot.version + 1, templari: { ...t, pending: { seed: seed >>> 0, subito: true, startMs: nowMs, party: { run, idx } } } };
}

/** Il server apre una partita (una sola aperta: la nuova sostituisce la vecchia, che non paga niente); `classe` = l'eroe del menù (uno
 *  sconosciuto non si tiene). */
export function startTemplari(lot: LotState, seed: number, nowMs: number, subito = false, classe?: unknown): LotState {
  const t = templariOf(lot, nowMs), cl = typeof classe === 'string' ? eroeDef(classe)?.id : undefined;
  return { ...lot, version: lot.version + 1, templari: { ...t, pending: { seed: seed >>> 0, subito: !!subito, startMs: nowMs, ...(cl ? { classe: cl } : {}) } } };
}

export type TemplariEsito = { lot: LotState; premio: number; pieno: number; tetto: boolean; record: boolean; superate: number };

/** Chiude la partita aperta col risultato che il server ha ricalcolato: premio entro il tetto di oggi, record, partite. */
export function finishTemplari(lot0: LotState, r: TRisultato, nowMs: number): TemplariEsito {
  const t = templariOf(lot0, nowMs);
  if (!t.pending) throw new EconomyError('partita', 'Nessuna partita aperta: rientra dalla chiesa');
  const pieno = premioOndate(r.superate), cap = TEMPLARI.premio.tetto;
  const premio = Math.max(0, Math.min(pieno, cap - t.preso));
  const tetto = premio < pieno;
  const record = r.ondata > t.record;
  const lot = advance(lot0, nowMs);
  return {
    premio, pieno, tetto, record, superate: r.superate,
    lot: guadagna({
      ...lot,
      version: lot.version + 1,
      templari: { pending: null, giorno: t.giorno, preso: t.preso + premio, record: Math.max(t.record, r.ondata), partite: t.partite + 1 },
    }, premio),
  };
}
