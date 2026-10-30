// I punteggi dei minigiochi a classifica (Fuga dalla lava) nel SQLite del DO Sfide: per minigioco e periodo il miglior punteggio di ciascuno.
// Periodo 0 = di sempre, altrimenti il giorno UTC (oggi); i giorni vecchi si buttano. Niente migrazioni D1, come le discese e il Tabellone.
// Solo SQL sincrono. Le regole (ordine, chi migliora, cosa mostrare) stanno in @marea/sim/economy/classifica.ts.
import type { VocePunteggio } from '@marea/sim/economy/classifica.ts';

/** Quanti giorni si tengono i punteggi di «oggi». */
const GIORNI_TENUTI = 3;

export function creaTabellaPunteggi(sql: SqlStorage): void {
  sql.exec('CREATE TABLE IF NOT EXISTS punteggi (gioco TEXT NOT NULL, periodo INTEGER NOT NULL, chi TEXT NOT NULL, score INTEGER NOT NULL, quando INTEGER NOT NULL, detail TEXT NOT NULL, PRIMARY KEY (gioco, periodo, chi))');
}

/** Tutti i punteggi di un minigioco in un periodo (non ordinati: li ordina @marea/sim). */
export function leggiPunteggi(sql: SqlStorage, gioco: string, periodo: number): VocePunteggio[] {
  return sql.exec<{ chi: string; score: number; quando: number; detail: string }>('SELECT chi, score, quando, detail FROM punteggi WHERE gioco = ? AND periodo = ?', gioco, periodo).toArray()
    .map((r) => {
      let detail: Record<string, number> = {};
      try { detail = JSON.parse(r.detail) as Record<string, number>; } catch { /* dettaglio rotto: resta vuoto */ }
      return { chi: r.chi, score: r.score, quando: r.quando, detail };
    });
}

export function scriviPunteggio(sql: SqlStorage, gioco: string, periodo: number, v: VocePunteggio): void {
  sql.exec('INSERT OR REPLACE INTO punteggi (gioco, periodo, chi, score, quando, detail) VALUES (?, ?, ?, ?, ?, ?)', gioco, periodo, v.chi, v.score, v.quando, JSON.stringify(v.detail));
}

/** Butta i punteggi dei giorni vecchi (quelli di sempre restano). */
export function potaPunteggi(sql: SqlStorage, giorno: number): void {
  sql.exec('DELETE FROM punteggi WHERE periodo > 0 AND periodo <= ?', giorno - GIORNI_TENUTI);
}
