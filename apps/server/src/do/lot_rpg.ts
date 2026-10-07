// Mondo Sotterraneo nel DO del lotto (CONTRACTS §15). Il personaggio sta dentro LotState (hero, forziere, dungeon.pending): niente D1.
// POST /rpg {azione} → LotState · /dungeon_start {dungeon} → {dungeon, seed, hero, lot, recuperato} · /dungeon_save {inputs, hash} → il DO
// rigioca gli input fino all'altare e li tiene in pending.salvataggio → {ok, salvato, ticks} · /dungeon_finish {inputs (array o stringa di
// encodeDungeon), hash} → il DO rigioca gli input (replayDungeon) e applica il risultato del server → {result, tenuto, monete, livelliSu, lot}.
// Una spedizione lasciata aperta con un salvataggio si chiude alla discesa dopo (o quando scade, in Lot.load). Gli EconomyError li traduce Lot.fetch.
import { DUNGEONS } from '@marea/content/rpg.ts';
import { dungeon as dungeonSim } from '@marea/sim/dungeon/dungeon.ts';
import { decodeDungeon, encodeDungeon, isPackedDungeon, replayDungeon } from '@marea/sim/dungeon/replay.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { chiudiSalvata } from '@marea/sim/dungeon/settle.ts';
import type { LotState } from '@marea/sim/economy/types.ts';
import { applyRpgAction, parseRpgAction } from '@marea/sim/rpg/actions.ts';
import { finishDungeon, startDungeon } from '@marea/sim/rpg/run.ts';

export const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const RPG_ACTS = new Set(['rpg', 'dungeon_start', 'dungeon_save', 'dungeon_finish']);

/** Input come array RLE o compressi dal client con encodeDungeon (stringa base64, ~4× più leggera); null se non validi. */
function inputsOf(raw: unknown): PackedDungeon | null {
  const inputs = typeof raw === 'string' ? decodeDungeon(raw, dungeonSim.maxTicks) : raw;
  return isPackedDungeon(inputs, dungeonSim.maxTicks) ? inputs : null;
}

/** Rotte GDR: `save` scrive il lotto nello storage del DO. Lancia EconomyError (le traduce chi chiama). */
export function rpgRoute(lot: LotState, act: string, body: Record<string, unknown>, now: number, save: (l: LotState) => void): Response {
  if (act === 'rpg') {
    const a = parseRpgAction(body['azione']);
    if (!a) return json({ error: 'Azione non valida' }, 400);
    const next = applyRpgAction(lot, a, now);
    save(next);
    return json(next);
  }
  if (act === 'dungeon_start') {
    const d = body['dungeon'];
    if (typeof d !== 'string' || !DUNGEONS.some((x) => x.id === d)) return json({ error: 'Dungeon sconosciuto' }, 400);
    // la spedizione di prima è rimasta aperta dopo un altare: si chiude tenendo quel bottino
    const prima = chiudiSalvata(lot, now);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
    const next = startDungeon(prima ? prima.lot : lot, d, seed, now);
    save(next);
    const p = next.dungeon!.pending!;
    return json({ dungeon: p.dungeon, seed: p.seed, hero: p.hero, lot: next, recuperato: prima ? { tenuto: prima.tenuto, monete: prima.monete } : null });
  }
  const p = lot.dungeon?.pending;
  if (!p) return json({ error: 'Nessuna spedizione aperta: rientra dall’ingresso', code: 'spedizione' }, 409);
  const inputs = inputsOf(body['inputs']);
  if (!inputs) return json({ error: 'Spedizione non valida' }, 400);
  const result = replayDungeon(p.seed, p.dungeon, p.hero, inputs);
  const hash = body['hash'];
  if (hash !== result.hash) console.warn('[marea] dungeon hash diverso', { act, owner: lot.owner, dungeon: p.dungeon, seed: p.seed, client: hash, server: result.hash, ticks: result.ticks });
  if (act === 'dungeon_save') {
    if (result.done || !result.salvato) return json({ error: 'Nessun altare toccato in questa spedizione', code: 'altare' }, 409);
    // un salvataggio arrivato in ritardo non copre uno più recente
    if ((p.salvataggio?.ticks ?? -1) >= result.ticks) return json({ ok: true, salvato: result.salvato, ticks: p.salvataggio!.ticks });
    const enc = typeof body['inputs'] === 'string' ? body['inputs'] : encodeDungeon(inputs);
    save({ ...lot, version: lot.version + 1, dungeon: { pending: { ...p, salvataggio: { inputs: enc, ticks: result.ticks } } } });
    return json({ ok: true, salvato: result.salvato, ticks: result.ticks });
  }
  // dungeon_finish
  const out = finishDungeon(lot, result, now);
  save(out.lot);
  return json({ result, tenuto: out.tenuto, monete: out.monete, livelliSu: out.livelliSu, lot: out.lot });
}
