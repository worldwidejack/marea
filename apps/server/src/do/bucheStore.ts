// Buche nel terreno di Borgo Marea (#438), nella SQLite del DO Sfide (`tavolo`, singleton dell'arcipelago).
// Una buca aperta (`stato = 'aperta'`) si può chiudere o riempire seppellendo un oggetto/mobile/monete (`stato = 'seppellita'`, croce nel
// terreno); un oggetto seppellito resta lì a tempo indeterminato finché un giocatore non lo scava fuori con la pala.
import { cellKeyBorgo, isCellaScavabileBorgo } from '@marea/sim/economy/pala.ts';
import type { BucaBorgo, BucaDono, BucaStato } from '@marea/sim/economy/pala.ts';
import type { LotState } from '@marea/sim/economy/types.ts';
import { parseBucaDono } from '@marea/sim/rpg/pala.ts';
import type { Env } from '../env.ts';

const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export function ensureBucheSchema(sql: SqlStorage): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS buche (
    cell TEXT PRIMARY KEY,
    cx INTEGER NOT NULL,
    cz INTEGER NOT NULL,
    stato TEXT NOT NULL,
    chi TEXT NOT NULL,
    quando INTEGER NOT NULL,
    json TEXT
  )`);
}

function rowToBuca(r: Record<string, SqlStorageValue>): BucaBorgo {
  const cx = Number(r['cx'] ?? 0), cz = Number(r['cz'] ?? 0);
  const stato: BucaStato = r['stato'] === 'seppellita' ? 'seppellita' : 'aperta';
  let dono: BucaDono | undefined;
  if (typeof r['json'] === 'string' && r['json']) {
    try { dono = parseBucaDono(JSON.parse(r['json'])) ?? undefined; } catch { /* json rotto */ }
  }
  return { cell: [cx, cz], stato, chi: String(r['chi'] ?? ''), quando: Number(r['quando'] ?? 0), ...(dono ? { dono } : {}) };
}

export function listBuche(sql: SqlStorage): BucaBorgo[] {
  ensureBucheSchema(sql);
  return [...sql.exec('SELECT cx, cz, stato, chi, quando, json FROM buche ORDER BY quando ASC')].map(rowToBuca);
}

export function getBuca(sql: SqlStorage, cell: readonly [number, number]): BucaBorgo | null {
  ensureBucheSchema(sql);
  const r = [...sql.exec('SELECT cx, cz, stato, chi, quando, json FROM buche WHERE cell = ?', cellKeyBorgo(cell))][0];
  return r ? rowToBuca(r) : null;
}

export function setBuca(sql: SqlStorage, cell: readonly [number, number], stato: BucaStato, chi: string, quando: number, dono?: BucaDono): BucaBorgo {
  ensureBucheSchema(sql);
  sql.exec(
    'INSERT OR REPLACE INTO buche (cell, cx, cz, stato, chi, quando, json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    cellKeyBorgo(cell), cell[0], cell[1], stato, chi, quando, dono ? JSON.stringify(dono) : null,
  );
  return { cell: [cell[0], cell[1]], stato, chi, quando, ...(dono ? { dono } : {}) };
}

export function deleteBuca(sql: SqlStorage, cell: readonly [number, number]): void {
  ensureBucheSchema(sql);
  sql.exec('DELETE FROM buche WHERE cell = ?', cellKeyBorgo(cell));
}

/** Coordina scavo, chiusura e seppellimento dentro `Sfide.locked` parlando col DO `Lot` di chi agisce. */
export async function handleBuca(sql: SqlStorage, me: string, body: Record<string, unknown>, now: number, env: Env): Promise<Response> {
  const op = body['op'], c = body['cell'];
  if (!Array.isArray(c) || c.length !== 2 || !Number.isInteger(c[0]) || !Number.isInteger(c[1])) return json({ error: 'Cella non valida' }, 400);
  const cell: [number, number] = [c[0] as number, c[1] as number];
  if (!isCellaScavabileBorgo(cell)) return json({ error: 'Qui non si può scavare' }, 400);
  const buca = getBuca(sql, cell);
  const lotFetch = (path: string, b: unknown) =>
    env.LOT.get(env.LOT.idFromName(me)).fetch(new Request('https://lot/' + path, {
      method: 'POST', body: JSON.stringify(b), headers: { 'x-persona': me, 'x-now': String(now), 'content-type': 'application/json' },
    }));

  if (op === 'chiudi') {
    if (!buca || buca.stato !== 'aperta') return json({ error: 'Non c’è una buca aperta qui' }, 409);
    deleteBuca(sql, cell);
    return json({ ok: true, esito: 'chiusa', buche: listBuche(sql) });
  }
  if (op === 'seppellisci') {
    if (!buca || buca.stato !== 'aperta') return json({ error: 'Serve una buca aperta per seppellire' }, 409);
    const pr = await lotFetch('pala_seppellisci', { dono: body['dono'] });
    if (!pr.ok) return pr;
    const d = (await pr.json()) as { lot: LotState; dono: BucaDono; nome: string };
    setBuca(sql, cell, 'seppellita', me, now, d.dono);
    return json({ ok: true, esito: 'seppellita', dono: d.dono, nome: d.nome, lot: d.lot, buche: listBuche(sql) });
  }
  if (op === 'scava') {
    if (buca?.stato === 'seppellita' && buca.dono) {
      const pr = await lotFetch('pala_dissotterra', { dono: buca.dono });
      if (!pr.ok) return pr;
      const d = (await pr.json()) as { lot: LotState; nome: string };
      deleteBuca(sql, cell);
      return json({ ok: true, esito: 'trovato', dono: buca.dono, nome: d.nome, lot: d.lot, buche: listBuche(sql) });
    }
    if (buca?.stato === 'aperta') return json({ error: 'C’è già una buca aperta qui' }, 409);
    const pr = await lotFetch('pala_scava', { cell });
    if (!pr.ok) return pr;
    const d = (await pr.json()) as { bottino: boolean; monete?: number; nome?: string; lot: LotState };
    if (d.bottino) return json({ ok: true, esito: 'bottino', monete: d.monete, nome: d.nome, lot: d.lot, buche: listBuche(sql) });
    setBuca(sql, cell, 'aperta', me, now);
    return json({ ok: true, esito: 'aperta', lot: d.lot, buche: listBuche(sql) });
  }
  return json({ error: 'Operazione sconosciuta' }, 400);
}
