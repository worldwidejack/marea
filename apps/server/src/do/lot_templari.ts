// Isola dei Templari nel DO del lotto (docs/TEMPLARI.md §10, CONTRACTS «Templari»). La partita sta dentro LotState.templari: niente D1.
// POST /templari_start {subito?} → {seed, subito, lot} · /templari_finish {inputs (array o stringa di encodeDungeon), azioni, hash} → il DO
// rigioca (replayTemplari) e paga le ondate superate entro il tetto del giorno → {result, premio, pieno, tetto, record, lot} ·
// /templari_reliquia {} → il calice dello scheletro della Tempesta nel lotto (serve la Tempesta aperta) → {lot, nuova}.
// Gli EconomyError li traduce Lot.fetch.
import type { LotState } from '@marea/sim/economy/types.ts';
import { inputsTemplari, parseTAzioni, replayTemplari } from '@marea/sim/templari/replay.ts';
import { finishTemplari, prendiReliquia, startTemplari, templariOf } from '@marea/sim/templari/premio.ts';
import { json } from './lot_rpg.ts';

export const TEMPLARI_ACTS = new Set(['templari_start', 'templari_finish', 'templari_reliquia']);

export function templariRoute(lot: LotState, act: string, body: Record<string, unknown>, now: number, save: (l: LotState) => void): Response {
  if (act === 'templari_reliquia') {
    const r = prendiReliquia(lot);
    if (r.nuova) save(r.lot);
    return json({ lot: r.lot, nuova: r.nuova });
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
  const inputs = inputsTemplari(body['inputs']), azioni = parseTAzioni(body['azioni']);
  if (!inputs || !azioni) return json({ error: 'Partita non valida' }, 400);
  const result = replayTemplari(p.seed, p.subito ? { subito: true } : {}, inputs, azioni);
  if (body['hash'] !== result.hash) console.warn('[marea] templari hash diverso', { owner: lot.owner, seed: p.seed, client: body['hash'], server: result.hash, ticks: result.ticks });
  const out = finishTemplari(lot, result, now);
  save(out.lot);
  return json({ result, premio: out.premio, pieno: out.pieno, tetto: out.tetto, record: out.record, lot: out.lot });
}
