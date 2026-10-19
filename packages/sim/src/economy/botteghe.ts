// Le botteghe di Borgo Marea (#414, VISIONE §2): livelli in monete e vetrine del giorno. Fabbro = il Banco da Lavoro di prima (il livello
// sblocca i materiali da forgiare, RPG §5), Cantiere navale = il Molo a livelli (velocità della barca, la Tempesta al 2), Alchimista = Tavolo
// Alchemico + Serra (senza livelli: le ricette le apre l'abilità). Puro e deterministico: la vetrina dipende solo dal giorno di Roma e da
// botteghe.json, così client e server calcolano la stessa cosa. Le vetrine di oggetti (Fabbro, Alchimista) stanno in rpg/botteghe.ts.
import { BOTTEGHE } from '@marea/content/botteghe.ts';
import type { BottegaId, BottegaLivello } from '@marea/content/botteghe.ts';
import { createRng } from '../rng.ts';
import { advance } from './advance.ts';
import { coloreBarca, compraColoreBarca } from './barca.ts';
import { giornoRoma } from './giorno.ts';
import { spendi } from './monete.ts';
import { EconomyError } from './types.ts';
import type { LotState } from './types.ts';

/** Le botteghe che si migliorano a monete. */
export type BottegaConLivelli = 'fabbro' | 'cantiere';

const livelloEdificio = (lot: LotState, id: string): number =>
  Math.max(0, ...lot.buildings.filter((b) => b.building === id).map((b) => b.level), ...(lot.magazzinoEdifici ?? []).filter((b) => b.building === id).map((b) => b.level));

/** Il tuo livello col Fabbro (1-3): il primo è di tutti; chi aveva il Banco da Lavoro tiene il suo livello. */
export function livelloFabbro(lot: LotState | null): number {
  if (!lot) return 1;
  return Math.min(BOTTEGHE.fabbro.livelli?.length ?? 3, Math.max(1, lot.botteghe?.fabbro ?? 0, livelloEdificio(lot, 'banco')));
}
/** Il livello della barca al Cantiere (1-3) = il livello del Molo (velocità, la Tempesta al 2). */
export function livelloCantiere(lot: LotState | null): number {
  if (!lot) return 1;
  return Math.min(BOTTEGHE.cantiere.livelli?.length ?? 3, Math.max(1, livelloEdificio(lot, 'molo')));
}
export const livelloBottega = (lot: LotState | null, b: BottegaConLivelli): number => (b === 'fabbro' ? livelloFabbro(lot) : livelloCantiere(lot));
/** Il prossimo livello (quanto costa e cosa dà) o null se sei già al massimo. */
export function prossimoLivello(lot: LotState | null, b: BottegaConLivelli): (BottegaLivello & { livello: number }) | null {
  const liv = livelloBottega(lot, b), l = BOTTEGHE[b].livelli?.[liv];
  return l ? { ...l, livello: liv + 1 } : null;
}

/** Migliora il Fabbro o la barca di un livello, a monete, subito. `da` = il livello che vede chi chiede: se nel frattempo è cambiato,
 *  EconomyError 'livello' (niente si paga due volte). */
export function miglioraBottega(lot0: LotState, b: BottegaConLivelli, da: number, nowMs: number): LotState {
  const lot = advance(lot0, nowMs), liv = livelloBottega(lot, b);
  if (da !== liv) throw new EconomyError('livello', 'È già cambiato: guarda com’è adesso');
  const next = prossimoLivello(lot, b);
  if (!next) throw new EconomyError('livello', b === 'fabbro' ? 'Col Fabbro sei già al massimo' : 'La barca è già al massimo');
  const pagato = spendi(lot, next.monete);
  if (b === 'fabbro') return { ...pagato, version: lot.version + 1, botteghe: { ...pagato.botteghe, fabbro: next.livello } };
  const molo = pagato.buildings.find((x) => x.building === 'molo');
  if (!molo) throw new EconomyError('requisito', 'Non hai una barca da migliorare');
  return { ...pagato, version: lot.version + 1, buildings: pagato.buildings.map((x) => (x === molo ? { ...x, level: next.livello } : x)) };
}

/** Un oggetto del `pool` per il giorno `g`: in un giro (tanti giorni quanti oggetti) esce tutto una volta, in ordine rimescolato; mai lo
 *  stesso due giorni di fila (con almeno 3 oggetti). Come il banco del Contrabbandiere (rpg/contrabbando.ts). */
export function delGiorno(pool: readonly string[], chiave: string, g: number): string {
  const n = pool.length;
  if (n < 3) return pool[((g % n) + n) % n]!;
  const giro = (c: number): string[] => {
    const a = [...pool], rng = createRng(`bottega:${chiave}:${c}`);
    for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
  };
  const c = Math.floor(g / n), j = g - c * n, cur = giro(c);
  return j === 0 && cur[0] === giro(c - 1)[n - 1] ? cur[n - 1]! : cur[j]!;
}
/** Gli id della vetrina di una bottega il giorno `g` di Roma: uno per scomparto, nell'ordine degli scomparti (Fabbro: già incrociati col
 *  materiale del giorno, `tipo_materiale`). */
export function vetrinaBottegaDel(b: BottegaId, g: number): string[] {
  const def = BOTTEGHE[b], mat = def.materiali;
  return def.scomparti.map((s, i) => {
    const pool = mat ? s.flatMap((t) => mat.map((m) => `${t}_${m}`)) : s;
    return delGiorno(pool, `${b}:${i}`, g);
  });
}
export const vetrinaBottega = (b: BottegaId, ms: number): string[] => vetrinaBottegaDel(b, giornoRoma(ms));
export const inVetrinaBottega = (b: BottegaId, ms: number, id: string): boolean => vetrinaBottega(b, ms).includes(id);
/** Compra un colore della barca (#107) al banco giusto: le esclusive dal Mercante sempre, le vernici del Cantiere solo il giorno che sono
 *  nella sua vetrina (EconomyError 'requisito'). La usa il server (POST /api/barca/colore). */
export function compraColoreDelGiorno(lot: LotState, id: string, nowMs: number): LotState {
  const k = coloreBarca(id);
  if (k?.cantiere && !inVetrinaBottega('cantiere', nowMs, id)) throw new EconomyError('requisito', 'Oggi il Cantiere non ce l’ha: la vetrina cambia a mezzanotte');
  return compraColoreBarca(lot, id, nowMs);
}
