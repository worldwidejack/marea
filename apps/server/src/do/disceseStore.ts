// Le discese dell'Isola dell'Adrenalina nel SQLite del DO Sfide (passo 3b, birbasan 12 ott 2026): per pista il miglior tempo finale di
// ciascuno e gli input di quella discesa (il fantasma che gli altri vedono scendere). Niente migrazioni D1: come il Tabellone del Porto.
// Solo SQL sincrono. Le regole (posizione, medaglia, chi migliora) stanno in @marea/sim/adrenalina/classifica.ts.
import { SNOWBOARD_PISTE } from '@marea/content/adrenalina.ts';
import type { VoceDiscesa } from '@marea/sim/adrenalina/classifica.ts';
import type { PackedInputs } from '@marea/sim/replay.ts';

export type RigaDiscesa = VoceDiscesa & { quando: number };
/** La discesa salvata del migliore (il fantasma, senza nome né look: quelli li aggiunge il Worker, @marea/protocol `Fantasma`). */
export type DiscesaSalvata = RigaDiscesa & { seed: number; opzioni: Record<string, string>; inputs: PackedInputs };

/** La pista nella tabella: con la sua versione, così quando il tracciato cambia classifica e fantasma ripartono (le righe vecchie restano
 *  lì, non le legge più nessuno). */
const chiave = (pista: string): string => { const v = SNOWBOARD_PISTE[pista]?.versione ?? 1; return v > 1 ? `${pista}@${v}` : pista; };

export function creaTabellaDiscese(sql: SqlStorage): void {
  sql.exec('CREATE TABLE IF NOT EXISTS discese (pista TEXT NOT NULL, chi TEXT NOT NULL, ms INTEGER NOT NULL, quando INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (pista, chi))');
}

/** La classifica della pista: il miglior tempo finale di ciascuno, dal più veloce. */
export function classificaDiscese(sql: SqlStorage, pista: string): RigaDiscesa[] {
  return sql.exec<{ chi: string; ms: number; quando: number }>('SELECT chi, ms, quando FROM discese WHERE pista = ? ORDER BY ms, quando', chiave(pista)).toArray()
    .map((r) => ({ chi: r.chi, ms: r.ms, quando: r.quando }));
}

/** Il fantasma: la discesa del primo, con gli input per rigiocarla. */
export function fantasmaDiscesa(sql: SqlStorage, pista: string): DiscesaSalvata | null {
  const r = sql.exec<{ chi: string; ms: number; quando: number; json: string }>('SELECT chi, ms, quando, json FROM discese WHERE pista = ? ORDER BY ms, quando LIMIT 1', chiave(pista)).toArray()[0];
  if (!r) return null;
  try {
    const d = JSON.parse(r.json) as { seed: number; opzioni: Record<string, string>; inputs: PackedInputs };
    return { chi: r.chi, ms: r.ms, quando: r.quando, seed: d.seed, opzioni: d.opzioni, inputs: d.inputs };
  } catch { return null; }
}

export function scriviDiscesa(sql: SqlStorage, pista: string, f: DiscesaSalvata): void {
  sql.exec('INSERT OR REPLACE INTO discese (pista, chi, ms, quando, json) VALUES (?, ?, ?, ?, ?)', chiave(pista), f.chi, f.ms, f.quando, JSON.stringify({ seed: f.seed, opzioni: f.opzioni, inputs: f.inputs }));
}
