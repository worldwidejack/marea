// Isola dei Templari nel DO del lotto (docs/TEMPLARI.md §10, CONTRACTS «Templari»). La partita sta dentro LotState.templari: niente D1.
// POST /templari_start {subito?} → {seed, subito, lot} · /templari_finish {inputs (array o stringa di encodeDungeon), azioni, hash} → il DO
// rigioca (replayTemplari) e paga le ondate superate entro il tetto del giorno → {result, premio, pieno, tetto, record, lot} ·
// /templari_reliquia {} → il calice dello scheletro della Tempesta nel lotto (serve la Tempesta aperta) → {lot, nuova}.
// Insieme (PROTOCOL §9): /templari_party_start {seed, run, idx} solo dal DO TemplariInsieme, mai dal Worker; /templari_finish con la
// partita insieme aperta rigioca il log della squadra (`body.gruppo`, chiesto da Lot.ts al DO) senza input dal client.
// Gli EconomyError li traduce Lot.fetch.
import type { LotState } from '@marea/sim/economy/types.ts';
import { inputsTemplari, parseTAzioni, parseTAzioniInsieme, replayTemplari, replayTemplariInsieme } from '@marea/sim/templari/replay.ts';
import type { TAzioniInsieme } from '@marea/sim/templari/replay.ts';
import { finishTemplari, prendiReliquia, startTemplari, startTemplariInsieme, templariOf } from '@marea/sim/templari/premio.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { json } from './lot_rpg.ts';

export const TEMPLARI_ACTS = new Set(['templari_start', 'templari_party_start', 'templari_finish', 'templari_reliquia']);

/** Il log della squadra come lo manda il DO TemplariInsieme: seed, input di ogni eroe (encodeDungeon), tick a cui è uscito (null = no) e
 *  acquisti [tick, eroe, azione]. */
export type LogTemplari = { seed: number; inputs: string[]; uscite: (number | null)[]; azioni?: TAzioniInsieme };
function logDi(v: unknown): { seed: number; inputs: PackedDungeon[]; uscite: (number | null)[]; azioni: TAzioniInsieme } | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as Partial<LogTemplari>;
  if (!Number.isInteger(g.seed) || !Array.isArray(g.inputs) || !Array.isArray(g.uscite) || g.inputs.length < 2 || g.inputs.length > 4 || g.uscite.length !== g.inputs.length) return null;
  const inputs = g.inputs.map((x) => inputsTemplari(x));
  if (inputs.some((x) => !x) || !g.uscite.every((u) => u === null || (Number.isInteger(u) && (u as number) >= 0))) return null;
  const azioni = parseTAzioniInsieme(g.azioni, inputs.length);
  if (!azioni) return null;
  return { seed: g.seed as number, inputs: inputs as PackedDungeon[], uscite: g.uscite, azioni };
}

export function templariRoute(lot: LotState, act: string, body: Record<string, unknown>, now: number, save: (l: LotState) => void): Response {
  if (act === 'templari_reliquia') {
    const r = prendiReliquia(lot);
    if (r.nuova) save(r.lot);
    return json({ lot: r.lot, nuova: r.nuova });
  }
  if (act === 'templari_party_start') {
    const seed = body['seed'], run = body['run'], idx = body['idx'];
    if (!Number.isInteger(seed) || (seed as number) < 0 || typeof run !== 'string' || run.length > 64 || !Number.isInteger(idx) || (idx as number) < 0 || (idx as number) > 3) return json({ error: 'Squadra non valida' }, 400);
    const next = startTemplariInsieme(lot, seed as number, now, run, idx as number);
    save(next);
    return json({ ok: true, lot: next });
  }
  if (act === 'templari_start') {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
    const next = startTemplari(lot, seed, now, body['subito'] === true);
    save(next);
    const p = next.templari!.pending!;
    return json({ seed: p.seed, subito: p.subito, lot: next });
  }
  const p = templariOf(lot, now).pending;
  if (!p) return json({ error: 'Nessuna partita aperta: rientra dalla chiesa', code: 'partita' }, 409);
  if (p.party) {
    // insieme: l'esito viene dal log della squadra (Lot.ts lo chiede al DO TemplariInsieme e lo passa in `gruppo`)
    const g = logDi(body['gruppo']);
    if (!g || g.seed !== p.seed || p.party.idx >= g.inputs.length) {
      const chiusa: LotState = { ...lot, version: lot.version + 1, templari: { ...templariOf(lot, now), pending: null } };
      save(chiusa);
      return json({ error: 'La partita insieme non si trova più: niente premio stavolta', code: 'gruppo', lot: chiusa }, 409);
    }
    const result = replayTemplariInsieme(g.seed, g.inputs, g.uscite, p.party.idx, g.azioni);
    const out = finishTemplari(lot, result, now);
    save(out.lot);
    return json({ result, premio: out.premio, pieno: out.pieno, tetto: out.tetto, record: out.record, lot: out.lot });
  }
  const inputs = inputsTemplari(body['inputs']), azioni = parseTAzioni(body['azioni']);
  if (!inputs || !azioni) return json({ error: 'Partita non valida' }, 400);
  const result = replayTemplari(p.seed, p.subito ? { subito: true } : {}, inputs, azioni);
  if (body['hash'] !== result.hash) console.warn('[marea] templari hash diverso', { owner: lot.owner, seed: p.seed, client: body['hash'], server: result.hash, ticks: result.ticks });
  const out = finishTemplari(lot, result, now);
  save(out.lot);
  return json({ result, premio: out.premio, pieno: out.pieno, tetto: out.tetto, record: out.record, lot: out.lot });
}
