// Tabellone dei record del Porto (#110, GDD §5 «Porto tra amici»): per ogni minigioco da solo, il migliore di oggi (giorno UTC) e il
// migliore di sempre tra gli amici. Il punteggio lo scrive solo il server, dopo aver rigiocato la partita (Lot DO `solo_play`); lo
// stato sta nel DO coordinatore `Sfide`. Pure: nessun orologio, `nowMs` lo passa chi chiama. Più alto vince; a pari punteggio resta
// chi c'era prima. Non esportato da @marea/sim (index.ts): si importa per percorso.
import type { Medal } from '../minigames/types.ts';
import { giornoDi } from './missioni.ts';

export type RecordVoce = { chi: string; score: number; medal: Medal; quando: number; detail: Record<string, number> };
export type TabelloneRecord = { giorno: number; oggi: Record<string, RecordVoce>; sempre: Record<string, RecordVoce> };
export type EsitoRecord = { tab: TabelloneRecord; oggi: boolean; sempre: boolean; /** Chi teneva il record di sempre ed è stato superato da un altro. */ superato: string | null };

export const tabelloneNuovo = (): TabelloneRecord => ({ giorno: 0, oggi: {}, sempre: {} });

const DETAIL_MAX = 16;
/** Il `detail` del risultato tenuto corto: solo numeri finiti, chiavi brevi, al massimo 16 (serve a mostrare tempo, pacchi, mosse…). */
export function detailCorto(d: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!d || typeof d !== 'object') return out;
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (Object.keys(out).length >= DETAIL_MAX) break;
    if (k.length <= 24 && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** I record validi adesso: quelli di oggi spariscono quando cambia il giorno (UTC). */
export function recordDi(tab: TabelloneRecord, nowMs: number): { oggi: Record<string, RecordVoce>; sempre: Record<string, RecordVoce> } {
  return { oggi: tab.giorno === giornoDi(nowMs) ? tab.oggi : {}, sempre: tab.sempre };
}

/** Una partita verificata dal server: se batte il migliore di oggi o di sempre di quel minigioco, prende il suo posto. */
export function segnaRecord(tab: TabelloneRecord, minigame: string, p: { chi: string; score: number; medal: Medal; detail?: unknown }, nowMs: number): EsitoRecord {
  const giorno = giornoDi(nowMs), ora = recordDi(tab, nowMs);
  const voce: RecordVoce = { chi: p.chi, score: p.score, medal: p.medal, quando: nowMs, detail: detailCorto(p.detail) };
  const batte = (v: RecordVoce | undefined) => !v || p.score > v.score;
  const prima = ora.sempre[minigame];
  const oggi = batte(ora.oggi[minigame]), sempre = batte(prima);
  if (!oggi && !sempre && tab.giorno === giorno) return { tab, oggi, sempre, superato: null };
  return {
    tab: {
      giorno,
      oggi: oggi ? { ...ora.oggi, [minigame]: voce } : ora.oggi,
      sempre: sempre ? { ...tab.sempre, [minigame]: voce } : tab.sempre,
    },
    oggi, sempre, superato: sempre && prima && prima.chi !== p.chi ? prima.chi : null,
  };
}
