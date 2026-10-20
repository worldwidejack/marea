// Testo del feed (M1 · Fetta 3, CONTRACTS §13): il DO Sfide scrive righe strutturate, il Worker le legge e qui le trasforma in frasi brevi
// in italiano con i nomi delle persone. Funzioni pure: niente Cloudflare, niente I/O (i nomi arrivano da `nomeDi`).
import { MINIGAMES_CFG } from '@marea/content';
import { FARO, alGioco } from '@marea/content/porto_amici.ts';
import type { FeedItem, FeedTipo } from '@marea/protocol';

/** `dati` di una riga. */
export type FeedDati = {
  /** Record (#110): il minigioco. */
  minigame?: string;
  /** Visita (#86): il saluto della firma nel libro. */
  emote?: string;
  /** Faro comune (#111): il livello raggiunto. */
  livello?: number;
};
/** Riga come la restituisce il DO Sfide (rotta `feed`). */
export type FeedRow = { id: number; quando: number; tipo: FeedTipo; sfida: string | null; altro: string | null; dati: FeedDati; letto: boolean };

const nomeGioco = (id: string | undefined): string => {
  const cfg = id ? (MINIGAMES_CFG as Record<string, { nome?: string } | undefined>)[id] : undefined;
  return cfg?.nome ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'gioco');
};
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function feedText(row: FeedRow, nomeDi: (id: string) => string): string {
  const chi = row.altro ? nomeDi(row.altro) : 'Qualcuno';
  const d = row.dati ?? {};
  switch (row.tipo) {
    case 'visita':
      return `${chi} è passato sulla tua isola e ha firmato il libro`;
    case 'record': // #110
      return `${chi} ha battuto il tuo record ${alGioco(d.minigame ?? '', nomeGioco(d.minigame))}`;
    case 'faro': { // #111
      const lv = num(d.livello), bonus = Math.round((FARO.livelli[lv - 1]?.bonus ?? 0) * 100);
      return `Il Grande Faro è salito al livello ${lv}, grazie a ${chi}: Segherie e Cave +${bonus} % per tutti`;
    }
  }
  return 'Novità';
}

export function toFeedItem(row: FeedRow, nomeDi: (id: string) => string): FeedItem {
  const item: FeedItem = { id: row.id, quando: row.quando, tipo: row.tipo, testo: feedText(row, nomeDi), letto: !!row.letto };
  if (row.altro) item.da = row.altro;
  if (row.tipo === 'visita' && typeof row.dati?.emote === 'string') item.emote = row.dati.emote;
  return item;
}
