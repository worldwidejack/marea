// Testo del feed (M1 · Fetta 3, CONTRACTS §13): il DO Sfide scrive righe strutturate, il Worker le legge e qui le trasforma in frasi brevi
// in italiano con i nomi delle persone. Funzioni pure: niente Cloudflare, niente I/O (i nomi arrivano da `nomeDi`).
import { BALANCE, MINIGAMES_CFG, RESOURCES } from '@marea/content';
import type { FeedItem, FeedTipo } from '@marea/protocol';
import type { Resources } from '@marea/sim/economy/types.ts';

type Medal = 'oro' | 'argento' | 'bronzo' | null;
/** `dati` di una riga: `stake` sempre; a sfida chiusa anche `pot` (null in parità), `medal`, `esito` e le Perle della medaglia. */
export type FeedDati = {
  stake?: Resources;
  minigame?: string;
  pot?: Resources | null;
  medal?: Medal;
  esito?: 'vittoria' | 'sconfitta' | 'parita';
  perle?: number;
};
/** Riga come la restituisce il DO Sfide (rotta `feed`). */
export type FeedRow = { id: number; quando: number; tipo: FeedTipo; sfida: string | null; altro: string | null; dati: FeedDati; letto: boolean };

const KEYS = ['legno', 'pietra', 'perle'] as const;
const nomeRisorsa = (k: (typeof KEYS)[number], n: number): string => {
  const nome = RESOURCES.find((r) => r.id === k)?.nome ?? k;
  return k === 'perle' && Math.abs(n) === 1 ? 'Perla' : nome;
};
const nomeGioco = (id: string | undefined): string => {
  const cfg = id ? (MINIGAMES_CFG as Record<string, { nome?: string } | undefined>)[id] : undefined;
  return cfg?.nome ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'sfida');
};
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** «20 Legno», «20 Legno e 10 Pietra», «20 Legno, 10 Pietra e 5 Perle» (solo le risorse > 0). */
export function postaText(r: Partial<Resources> | undefined): string {
  const parts = KEYS.filter((k) => num(r?.[k]) > 0).map((k) => `${num(r?.[k])} ${nomeRisorsa(k, num(r?.[k]))}`);
  if (parts.length <= 1) return parts[0] ?? 'niente';
  return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1];
}
/** «+20 Legno, +10 Perle» / «−20 Legno, +2 Perle»: i valori a zero non si scrivono. */
function deltaText(d: Resources): string {
  return KEYS.filter((k) => d[k] !== 0).map((k) => `${d[k] > 0 ? '+' : '−'}${Math.abs(d[k])} ${nomeRisorsa(k, d[k])}`).join(', ');
}
/** Netto di una sfida chiusa per chi legge: `pot − stake` a chi vince, `−stake` a chi perde, 0 in parità; più le Perle della medaglia. */
export function nettoChiusa(d: FeedDati): Resources {
  const out: Resources = { legno: 0, pietra: 0, perle: 0 };
  for (const k of KEYS) {
    const s = num(d.stake?.[k]);
    out[k] = d.esito === 'vittoria' ? num(d.pot?.[k]) - s : d.esito === 'sconfitta' ? -s : 0;
  }
  out.perle += num(d.perle);
  return out;
}

export function feedText(row: FeedRow, nomeDi: (id: string) => string): string {
  const chi = row.altro ? nomeDi(row.altro) : 'Qualcuno';
  const d = row.dati ?? {};
  switch (row.tipo) {
    case 'sfida_ricevuta':
      return `${chi} ti sfida alla ${nomeGioco(d.minigame)}: posta ${postaText(d.stake)}. Rispondi al Tavolo entro ${BALANCE.wager.scadenzaOre} h`;
    case 'sfida_accettata':
      return `${chi} ha accettato la tua sfida`;
    case 'sfida_rifiutata':
      return `${chi} ha rifiutato: posta restituita`;
    case 'sfida_scaduta':
      return `La sfida con ${chi} è scaduta: posta restituita`;
    case 'sfida_chiusa': {
      const netto = deltaText(nettoChiusa(d));
      const coda = netto ? `: ${netto}` : '';
      if (d.esito === 'vittoria') return `Hai battuto ${chi}${coda}`;
      if (d.esito === 'sconfitta') return `${chi} ti ha battuto${coda}`;
      return `Pari con ${chi}: posta restituita${netto ? ', ' + netto : ''}`;
    }
  }
  return 'Novità dal Tavolo';
}

export function toFeedItem(row: FeedRow, nomeDi: (id: string) => string): FeedItem {
  const item: FeedItem = { id: row.id, quando: row.quando, tipo: row.tipo, testo: feedText(row, nomeDi), letto: !!row.letto };
  if (row.sfida) item.sfida = row.sfida;
  if (row.altro) item.da = row.altro;
  return item;
}
