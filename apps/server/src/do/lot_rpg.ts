// Mondo Sotterraneo nel DO del lotto (CONTRACTS §15). Il personaggio sta dentro LotState (hero, forziere, dungeon.pending): niente D1.
// POST /rpg {azione} → LotState · /dungeon_start {dungeon, da?: 'lanterna'} → {dungeon, seed, hero, stato, partenza, lot, recuperato} ·
// /dungeon_save {inputs, azioni, hash} → il DO rigioca input e azioni fino al SALVA sulla lanterna e li tiene in pending.salvataggio →
// {ok, salvato, ticks} · /dungeon_finish {inputs (array o stringa di encodeDungeon), azioni, hash} → il DO rigioca (replayDungeon) e applica
// il risultato del server → {result, tenuto, monete, livelliSu, lot}. Azioni = cambi d'equipaggiamento, butta via, salva, esci (dungeon v5).
// Una spedizione lasciata aperta con un salvataggio si chiude alla discesa dopo (o quando scade, in Lot.load). Gli EconomyError li traduce Lot.fetch.
// Insieme (#118): /dungeon_party_start dal DO Spedizioni apre la spedizione con pending.party; /dungeon_finish la chiude rigiocando il log
// della squadra (`body.gruppo`, chiesto da Lot.ts al DO Spedizioni), senza input dal client.
import { DUNGEONS } from '@marea/content/rpg.ts';
import { dungeon as dungeonSim } from '@marea/sim/dungeon/dungeon.ts';
import { decodeDungeon, encodeDungeon, isPackedDungeon, parseDungeonAzioni, replayDungeon } from '@marea/sim/dungeon/replay.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { chiudiGruppo, chiudiSalvata, risultatoGruppo } from '@marea/sim/dungeon/settle.ts';
import type { LotState } from '@marea/sim/economy/types.ts';
import { applyRpgAction, parseRpgAction } from '@marea/sim/rpg/actions.ts';
import { finishDungeon, startDungeon } from '@marea/sim/rpg/run.ts';

export const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** `dungeon_party_start {dungeon, seed, run, idx}` → {hero, stato, lot} arriva solo dal DO Spedizioni (dungeon insieme, #118), mai dal Worker. */
export const RPG_ACTS = new Set(['rpg', 'dungeon_start', 'dungeon_party_start', 'dungeon_save', 'dungeon_finish']);
/** Rotte che, con una spedizione insieme aperta, hanno bisogno del log della squadra (Lot.ts lo chiede prima e lo mette in `gruppo`). */
export const SERVE_GRUPPO = new Set(['dungeon_start', 'dungeon_party_start', 'dungeon_finish']);

/** Input come array RLE o compressi dal client con encodeDungeon (stringa base64, ~4× più leggera); null se non validi. */
function inputsOf(raw: unknown): PackedDungeon | null {
  const inputs = typeof raw === 'string' ? decodeDungeon(raw, dungeonSim.maxTicks) : raw;
  return isPackedDungeon(inputs, dungeonSim.maxTicks) ? inputs : null;
}

/** Rotte GDR: `save` scrive il lotto nello storage del DO; `tornato` ritocca il lotto di una spedizione chiusa (contatori delle missioni). Lancia EconomyError (le traduce chi chiama). */
export function rpgRoute(lot: LotState, act: string, body: Record<string, unknown>, now: number, save: (l: LotState) => void, tornato: (l: LotState) => LotState = (l) => l): Response {
  if (act === 'rpg') {
    const a = parseRpgAction(body['azione']);
    if (!a) return json({ error: 'Azione non valida' }, 400);
    const next = applyRpgAction(lot, a, now);
    save(next);
    return json(next);
  }
  if (act === 'dungeon_start' || act === 'dungeon_party_start') {
    const d = body['dungeon'];
    if (typeof d !== 'string' || !DUNGEONS.some((x) => x.id === d)) return json({ error: 'Dungeon sconosciuto' }, 400);
    // la spedizione di prima è rimasta aperta dopo un altare (o era insieme): si chiude tenendo quel bottino
    const prima = lot.dungeon?.pending?.party ? chiudiGruppo(lot, body['gruppo'], now) : chiudiSalvata(lot, now);
    const recuperato = prima ? { tenuto: prima.tenuto, monete: prima.monete } : null;
    if (act === 'dungeon_party_start') {
      // dal DO Spedizioni: seed della squadra, questo eroe è il numero idx; sempre dall'ingresso
      const seed = body['seed'], run = body['run'], idx = body['idx'];
      if (!Number.isInteger(seed) || (seed as number) < 0 || typeof run !== 'string' || run.length > 64 || !Number.isInteger(idx) || (idx as number) < 0 || (idx as number) > 7) return json({ error: 'Squadra non valida' }, 400);
      const aperta = startDungeon(prima ? prima.lot : lot, d, seed as number, now);
      const next: LotState = { ...aperta, dungeon: { pending: { ...aperta.dungeon!.pending!, party: { run, idx: idx as number } } } };
      save(next);
      const p = next.dungeon!.pending!;
      return json({ hero: p.hero, stato: p.stato ?? null, lot: next, recuperato });
    }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
    const next = startDungeon(prima ? prima.lot : lot, d, seed, now, { lanterna: body['da'] === 'lanterna' });
    save(next);
    const p = next.dungeon!.pending!;
    return json({ dungeon: p.dungeon, seed: p.seed, hero: p.hero, stato: p.stato ?? null, partenza: p.partenza ?? null, lot: next, recuperato });
  }
  const p = lot.dungeon?.pending;
  if (!p) return json({ error: 'Nessuna spedizione aperta: rientra dall’ingresso', code: 'spedizione' }, 409);
  if (p.party) {
    // insieme (#118): l'esito viene dal log della squadra (Lot.ts lo chiede al DO Spedizioni e lo passa in `gruppo`)
    if (act === 'dungeon_save') return json({ error: 'Insieme si salva alla lanterna senza consegnare', code: 'gruppo' }, 409);
    const result = risultatoGruppo(lot, body['gruppo']);
    if (!result) {
      const chiusa = chiudiGruppo(lot, null, now)!;
      save(chiusa.lot);
      return json({ error: 'La spedizione insieme non si trova più: niente bottino stavolta', code: 'gruppo', lot: chiusa.lot }, 409);
    }
    const out = finishDungeon(lot, result, now);
    const next = tornato(out.lot);
    save(next);
    return json({ result, tenuto: out.tenuto, monete: out.monete, livelliSu: out.livelliSu, lot: next });
  }
  const inputs = inputsOf(body['inputs']);
  const azioni = parseDungeonAzioni(body['azioni'], dungeonSim.maxTicks);
  if (!inputs || !azioni) return json({ error: 'Spedizione non valida' }, 400);
  const result = replayDungeon(p.seed, p.dungeon, p.hero, inputs, { stato: p.stato ?? null, partenza: p.partenza ?? null, azioni });
  const hash = body['hash'];
  if (hash !== result.hash) console.warn('[marea] dungeon hash diverso', { act, owner: lot.owner, dungeon: p.dungeon, seed: p.seed, client: hash, server: result.hash, ticks: result.ticks });
  if (act === 'dungeon_save') {
    if (result.done || !result.salvato) return json({ error: 'Non hai salvato a nessuna lanterna in questa spedizione', code: 'altare' }, 409);
    // un salvataggio arrivato in ritardo non copre uno più recente
    if ((p.salvataggio?.ticks ?? -1) >= result.ticks) return json({ ok: true, salvato: result.salvato, ticks: p.salvataggio!.ticks });
    const enc = typeof body['inputs'] === 'string' ? body['inputs'] : encodeDungeon(inputs);
    save({ ...lot, version: lot.version + 1, dungeon: { pending: { ...p, salvataggio: { inputs: enc, ticks: result.ticks, azioni } } } });
    return json({ ok: true, salvato: result.salvato, ticks: result.ticks });
  }
  // dungeon_finish
  const out = finishDungeon(lot, result, now);
  const next = tornato(out.lot); // missioni della Bacheca: una spedizione chiusa
  save(next);
  return json({ result, tenuto: out.tenuto, monete: out.monete, livelliSu: out.livelliSu, lot: next });
}
