// Feed nel SQLite del DO Sfide (CONTRACTS §13): una riga per persona a ogni novità (firma al libro, record battuto, Faro comune).
// Solo SQL sincrono. Il DO non conosce i nomi: il testo lo compone il Worker (`feed.ts`).
// Le righe delle vecchie sfide con posta (tipo `sfida_…`, codice tolto) restano nel database ma non si leggono e non si contano.
import type { FeedTipo } from '@marea/protocol';
import type { FeedDati, FeedRow } from '../feed.ts';

const MAX_PER_PERSONA = 100;
const PAGINA = 30;
const VIVE = "tipo NOT LIKE 'sfida%'";

export function creaTabellaFeed(sql: SqlStorage): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT, persona TEXT NOT NULL, quando INTEGER NOT NULL, tipo TEXT NOT NULL,
    sfida TEXT, altro TEXT, dati TEXT NOT NULL DEFAULT '{}', letto INTEGER NOT NULL DEFAULT 0)`);
  sql.exec('CREATE INDEX IF NOT EXISTS feed_persona ON feed (persona, id)');
}

/** Scrive una riga (una sola per persona, chiave `sfida` e tipo: niente doppioni) e tiene le ultime 100 per persona. */
export function scriviFeed(sql: SqlStorage, r: { persona: string; tipo: FeedTipo; sfida: string; altro: string; dati: FeedDati; letto: boolean; quando: number }): void {
  const gia = sql.exec('SELECT 1 AS x FROM feed WHERE persona = ? AND sfida = ? AND tipo = ? LIMIT 1', r.persona, r.sfida, r.tipo).toArray().length > 0;
  if (gia) return;
  sql.exec('INSERT INTO feed (persona, quando, tipo, sfida, altro, dati, letto) VALUES (?, ?, ?, ?, ?, ?, ?)',
    r.persona, r.quando, r.tipo, r.sfida, r.altro, JSON.stringify(r.dati), r.letto ? 1 : 0);
  sql.exec(`DELETE FROM feed WHERE persona = ?1 AND id NOT IN (SELECT id FROM feed WHERE persona = ?1 ORDER BY id DESC LIMIT ${MAX_PER_PERSONA})`, r.persona);
}

export function nonLetti(sql: SqlStorage, persona: string): number {
  return sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM feed WHERE persona = ? AND letto = 0 AND ${VIVE}`, persona).one().n;
}

/** Le ultime 30 righe di `persona`, le più recenti prima. */
export function leggiFeed(sql: SqlStorage, persona: string): FeedRow[] {
  return sql.exec<{ id: number; quando: number; tipo: string; sfida: string | null; altro: string | null; dati: string; letto: number }>(
    `SELECT id, quando, tipo, sfida, altro, dati, letto FROM feed WHERE persona = ? AND ${VIVE} ORDER BY id DESC LIMIT ${PAGINA}`, persona,
  ).toArray().map((x) => {
    let dati: FeedDati = {};
    try { dati = JSON.parse(x.dati) as FeedDati; } catch { /* riga vecchia o rotta: senza dati */ }
    return { id: x.id, quando: x.quando, tipo: x.tipo as FeedTipo, sfida: x.sfida, altro: x.altro, dati, letto: x.letto === 1 };
  });
}

/** Segna letti gli id ≤ `fino` (tutti senza `fino`). */
export function segnaLetti(sql: SqlStorage, persona: string, fino?: number): void {
  if (fino === undefined) sql.exec('UPDATE feed SET letto = 1 WHERE persona = ? AND letto = 0', persona);
  else sql.exec('UPDATE feed SET letto = 1 WHERE persona = ? AND letto = 0 AND id <= ?', persona, fino);
}
