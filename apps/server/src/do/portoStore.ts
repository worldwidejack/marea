// Porto tra amici nel SQLite del DO Sfide: tabellone dei record e collezionisti in una tabella chiave → JSON. Solo SQL sincrono,
// come feedStore.ts. Le regole stanno in @marea/sim/economy/record.ts. Il Faro comune è stato tolto (tag archivio/spenti-faro): la sua
// chiave `faro` e la tabella `faro_doni` restano nel database, non si usano più.
import { tabelloneNuovo } from '@marea/sim/economy/record.ts';
import type { TabelloneRecord } from '@marea/sim/economy/record.ts';

export function creaTabellePorto(sql: SqlStorage): void {
  sql.exec('CREATE TABLE IF NOT EXISTS porto (k TEXT PRIMARY KEY, json TEXT NOT NULL)');
}

function leggi<T>(sql: SqlStorage, k: string, vuoto: () => T): T {
  const r = sql.exec<{ json: string }>('SELECT json FROM porto WHERE k = ?', k).toArray()[0];
  if (!r) return vuoto();
  try { return JSON.parse(r.json) as T; } catch { return vuoto(); }
}
const scrivi = (sql: SqlStorage, k: string, v: unknown): void => { sql.exec('INSERT OR REPLACE INTO porto (k, json) VALUES (?, ?)', k, JSON.stringify(v)); };

export const leggiTabellone = (sql: SqlStorage): TabelloneRecord => leggi(sql, 'record', tabelloneNuovo);
export const scriviTabellone = (sql: SqlStorage, t: TabelloneRecord): void => scrivi(sql, 'record', t);
/** I collezionisti (#457): per persona quanti pesci e insetti ha consegnato al mobiliere (lo scrive il Worker dopo ogni consegna). */
export type Collezione = Record<string, { pesci: number; insetti: number; quando: number }>;
export const leggiCollezione = (sql: SqlStorage): Collezione => leggi(sql, 'collezione', () => ({}));
export const scriviCollezione = (sql: SqlStorage, c: Collezione): void => scrivi(sql, 'collezione', c);
