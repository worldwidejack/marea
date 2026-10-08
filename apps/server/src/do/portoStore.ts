// Porto tra amici (#110 #111) nel SQLite del DO Sfide (il coordinatore unico): tabellone dei record e Faro comune in una tabella chiave →
// JSON, più i versamenti al faro in sospeso (l'intento si scrive PRIMA di toccare il lotto: se il DO muore a metà, lo sweep lo riprende).
// Solo SQL sincrono, come feedStore.ts. Le regole stanno in @marea/sim/economy/record.ts e faro.ts.
import { faroNuovo } from '@marea/sim/economy/faro.ts';
import type { FaroDono, FaroStato } from '@marea/sim/economy/faro.ts';
import { tabelloneNuovo } from '@marea/sim/economy/record.ts';
import type { TabelloneRecord } from '@marea/sim/economy/record.ts';

/** Versamento al faro iniziato: `tutti` = chi ha un'isola (per il feed e i livelli se il faro sale). */
export type DonoAperto = { id: string; persona: string; dono: FaroDono; tutti: string[]; quando: number };

export function creaTabellePorto(sql: SqlStorage): void {
  sql.exec('CREATE TABLE IF NOT EXISTS porto (k TEXT PRIMARY KEY, json TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS faro_doni (id TEXT PRIMARY KEY, persona TEXT NOT NULL, json TEXT NOT NULL, quando INTEGER NOT NULL)');
}

function leggi<T>(sql: SqlStorage, k: string, vuoto: () => T): T {
  const r = sql.exec<{ json: string }>('SELECT json FROM porto WHERE k = ?', k).toArray()[0];
  if (!r) return vuoto();
  try { return JSON.parse(r.json) as T; } catch { return vuoto(); }
}
const scrivi = (sql: SqlStorage, k: string, v: unknown): void => { sql.exec('INSERT OR REPLACE INTO porto (k, json) VALUES (?, ?)', k, JSON.stringify(v)); };

export const leggiTabellone = (sql: SqlStorage): TabelloneRecord => leggi(sql, 'record', tabelloneNuovo);
export const scriviTabellone = (sql: SqlStorage, t: TabelloneRecord): void => scrivi(sql, 'record', t);
export const leggiFaro = (sql: SqlStorage): FaroStato => leggi(sql, 'faro', faroNuovo);
export const scriviFaro = (sql: SqlStorage, f: FaroStato): void => scrivi(sql, 'faro', f);

export function apriDono(sql: SqlStorage, d: DonoAperto): void {
  sql.exec('INSERT INTO faro_doni (id, persona, json, quando) VALUES (?, ?, ?, ?)', d.id, d.persona, JSON.stringify({ dono: d.dono, tutti: d.tutti }), d.quando);
}
export function chiudiDono(sql: SqlStorage, id: string): void { sql.exec('DELETE FROM faro_doni WHERE id = ?', id); }
export function doniAperti(sql: SqlStorage): DonoAperto[] {
  return sql.exec<{ id: string; persona: string; json: string; quando: number }>('SELECT id, persona, json, quando FROM faro_doni ORDER BY quando').toArray().map((r) => {
    let x: { dono?: FaroDono; tutti?: string[] } = {};
    try { x = JSON.parse(r.json) as typeof x; } catch { /* riga rotta: versamento vuoto, lo sweep la chiude */ }
    return { id: r.id, persona: r.persona, dono: x.dono ?? { legno: 0, pietra: 0 }, tutti: Array.isArray(x.tutti) ? x.tutti : [], quando: r.quando };
  });
}
