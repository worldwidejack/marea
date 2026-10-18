// Le stanze della casa (#386): il piano terra e, con gli ampliamenti del mobiliere (borgo.json `casa.livelli`), le stanze più grandi, la cantina e il
// secondo piano. Il livello della casa sta in `LotState.casa.livello` (assente = 0, la stanza di sempre). Le celle sono quelle del template `lotto`:
// la pianta MASSIMA di ogni stanza è già nelle sue righe (islands.json), il livello sblocca un pezzo alla volta (rettangoli sempre annidati: il
// nuovo contiene il vecchio). Puro: lo usano il DO (valida le pose), la sim (celle del giardino) e il client (disegno, collisioni).
import { BORGO } from '@marea/content';
import type { CasaLivello } from '@marea/content';

/** Rettangolo di celle [x0, z0, x1, z1): x1 e z1 esclusi. */
export type Rect = readonly [number, number, number, number];
export type StanzaId = 'terra' | 'cantina' | 'piano';
/** Una stanza al livello di casa dato: `retro` = la cella davanti alla porta sul fondo (solo il piano terra: porta il giardino). */
export type Stanza = { id: StanzaId; pavimento: Rect; retro: readonly [number, number] | null };

export const LIVELLI_CASA: readonly CasaLivello[] = BORGO.casa.livelli;
export const MAX_LIVELLO_CASA = LIVELLI_CASA.length;

/** Il livello della casa di un lotto (0..max), dal campo `casa` dello stato. */
export const livelloCasa = (casa: { livello?: number } | null | undefined): number => Math.max(0, Math.min(MAX_LIVELLO_CASA, Math.floor(casa?.livello ?? 0)));
/** L'ampliamento che porta la casa dal livello dato al successivo; null = già al massimo. */
export const prossimoAmpliamento = (livello: number): CasaLivello | null => LIVELLI_CASA[Math.max(0, Math.floor(livello))] ?? null;

const dentro = (r: Rect, c: readonly [number, number]): boolean => c[0] >= r[0] && c[0] < r[2] && c[1] >= r[1] && c[1] < r[3];
const cache = new Map<number, readonly Stanza[]>();
/** Le stanze che ci sono a quel livello (il piano terra per primo). */
export function stanzeDi(livello: number): readonly Stanza[] {
  const l = Math.max(0, Math.min(MAX_LIVELLO_CASA, Math.floor(livello)));
  let out = cache.get(l);
  if (!out) {
    const r = new Map<StanzaId, Rect>([['terra', BORGO.stanza.pavimento]]);
    for (const lv of LIVELLI_CASA.slice(0, l)) r.set(lv.stanza, lv.pavimento);
    out = [...r].map(([id, pavimento]): Stanza => ({ id, pavimento, retro: id === 'terra' ? [BORGO.stanza.retro[0], pavimento[1]] : null }));
    cache.set(l, out);
  }
  return out;
}
/** La stanza (a quel livello) il cui pavimento contiene la cella, o null. */
export const stanzaAt = (livello: number, c: readonly [number, number]): Stanza | null => stanzeDi(livello).find((s) => dentro(s.pavimento, c)) ?? null;
/** Il piano terra a quel livello. */
export const stanzaTerra = (livello: number): Stanza => stanzeDi(livello)[0]!;

/** La pianta massima di ogni stanza: il rettangolo più grande che avrà mai (l'ultimo della tabella, o quello di serie). */
export const PIANTE_MAX: readonly { id: StanzaId; pavimento: Rect }[] = stanzeDi(MAX_LIVELLO_CASA).map((s) => ({ id: s.id, pavimento: s.pavimento }));
/** La cella è sul pavimento di una stanza della casa alla pianta massima (anche se quel pezzo non è ancora sbloccato): lì niente giardino. */
export const inPianteMax = (c: readonly [number, number]): boolean => PIANTE_MAX.some((s) => dentro(s.pavimento, c));
