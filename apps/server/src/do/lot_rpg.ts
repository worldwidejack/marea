// Mondo Sotterraneo nel DO del lotto (CONTRACTS §15). Il personaggio sta dentro LotState (hero, forziere, dungeon.pending): niente D1.
// POST /rpg {azione} → LotState · /dungeon_start {dungeon} → {dungeon, seed, hero, lot} · /dungeon_finish {inputs (array o stringa di encodeDungeon), hash} → il DO rigioca
// gli input (replayDungeon) e applica il risultato del server → {result, tenuto, monete, livelliSu, lot}. Gli EconomyError li traduce Lot.fetch.
import { DUNGEONS } from '@marea/content/rpg.ts';
import { dungeon as dungeonSim } from '@marea/sim/dungeon/dungeon.ts';
import { decodeDungeon, isPackedDungeon, replayDungeon } from '@marea/sim/dungeon/replay.ts';
import type { LotState } from '@marea/sim/economy/types.ts';
import { applyRpgAction, parseRpgAction } from '@marea/sim/rpg/actions.ts';
import { finishDungeon, startDungeon } from '@marea/sim/rpg/run.ts';

export const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const RPG_ACTS = new Set(['rpg', 'dungeon_start', 'dungeon_finish']);

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
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
    const next = startDungeon(lot, d, seed, now);
    save(next);
    const p = next.dungeon!.pending!;
    return json({ dungeon: p.dungeon, seed: p.seed, hero: p.hero, lot: next });
  }
  // dungeon_finish
  const p = lot.dungeon?.pending;
  if (!p) return json({ error: 'Nessuna spedizione aperta: rientra dall’ingresso', code: 'spedizione' }, 409);
  // input come array RLE o compressi dal client con encodeDungeon (stringa base64, ~4× più leggera)
  const raw = body['inputs'];
  const inputs = typeof raw === 'string' ? decodeDungeon(raw, dungeonSim.maxTicks) : raw;
  if (!isPackedDungeon(inputs, dungeonSim.maxTicks)) return json({ error: 'Spedizione non valida' }, 400);
  const result = replayDungeon(p.seed, p.dungeon, p.hero, inputs);
  const hash = body['hash'];
  if (hash !== result.hash) console.warn('[marea] dungeon hash diverso', { owner: lot.owner, dungeon: p.dungeon, seed: p.seed, client: hash, server: result.hash, ticks: result.ticks });
  const out = finishDungeon(lot, result, now);
  save(out.lot);
  return json({ result, tenuto: out.tenuto, monete: out.monete, livelliSu: out.livelliSu, lot: out.lot });
}
