// Testo del feed (M1 · Fetta 3, CONTRACTS §13): il DO Sfide scrive righe strutturate, il Worker le legge e qui le trasforma in frasi brevi
// in italiano con i nomi delle persone. Funzioni pure: niente Cloudflare, niente I/O (i nomi arrivano da `nomeDi`).
import { MINIGAMES_CFG } from '@marea/content';
import { alGioco } from '@marea/content/porto_amici.ts';
import type { FeedItem, FeedTipo } from '@marea/protocol';

/** `dati` di una riga. */
export type FeedDati = {
  /** Record: il minigioco. */
  minigame?: string;
  /** Visita (#86): il saluto della firma nel libro. */
  emote?: string;
};
/** Riga come la restituisce il DO Sfide (rotta `feed`). */
export type FeedRow = { id: number; quando: number; tipo: FeedTipo; sfida: string | null; altro: string | null; dati: FeedDati; letto: boolean };

const nomeGioco = (id: string | undefined): string => {
  const cfg = id ? (MINIGAMES_CFG as Record<string, { nome?: string } | undefined>)[id] : undefined;
  return cfg?.nome ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'gioco');
};

export function feedText(row: FeedRow, nomeDi: (id: string) => string): string {
  const chi = row.altro ? nomeDi(row.altro) : 'Qualcuno';
  const d = row.dati ?? {};
  switch (row.tipo) {
    case 'visita':
      return `${chi} è passato sulla tua isola e ha firmato il libro`;
    case 'record': // #110
      return `${chi} ha battuto il tuo record ${alGioco(d.minigame ?? '', nomeGioco(d.minigame))}`;
  }
  return 'Novità';
}

export function toFeedItem(row: FeedRow, nomeDi: (id: string) => string): FeedItem {
  const item: FeedItem = { id: row.id, quando: row.quando, tipo: row.tipo, testo: feedText(row, nomeDi), letto: !!row.letto };
  if (row.altro) item.da = row.altro;
  if (row.tipo === 'visita' && typeof row.dati?.emote === 'string') item.emote = row.dati.emote;
  return item;
}
