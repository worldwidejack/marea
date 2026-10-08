// Celle del lotto (CONTRACTS §11): tutte le isole personali usano il template `lotto` di islands.json. Le celle di LotState sono locali
// al template ([cx, cz] dall'angolo in alto a sinistra). Edifici solo su celle `L` libere; decorazioni su sabbia/erba libere; il Molo sul `d`.
import { ISLANDS, RIENTRO } from '@marea/content';
import type { LotState } from './types.ts';

/** Basta la griglia ASCII: vanno bene sia un IslandDef sia un GridMap. */
export type LotTemplate = { readonly rows: readonly string[] };

export const LOT_TEMPLATE_ID = 'lotto';

/** Il template `lotto` da @marea/content, o null se non c'è ancora (allora le celle non si validano: vedi TODO sotto). */
export function lotTemplate(): LotTemplate | null {
  return ISLANDS.find((i) => i.id === LOT_TEMPLATE_ID) ?? null;
}
// TODO(M1): quando `lotto` è in islands.json (M1-mondo) il fallback `null` non scatta più; toglierlo quando il template è stabile.
const DEFAULT_TEMPLATE = lotTemplate();
export function defaultTemplate(): LotTemplate | null {
  return DEFAULT_TEMPLATE;
}

export function tileAt(t: LotTemplate, cx: number, cz: number): string {
  if (!Number.isInteger(cx) || !Number.isInteger(cz) || cz < 0 || cx < 0) return '~';
  return t.rows[cz]?.[cx] ?? '~';
}

/** Tile su cui si possono mettere le decorazioni: camminabili ma non slot edificio (`L`), non molo (`d`), non spawn (`P`). */
export const DECOR_TILES: ReadonlySet<string> = new Set(['.', 'g']);

const same = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] === b[0] && a[1] === b[1];
export function occupied(lot: LotState, cell: readonly [number, number]): boolean {
  return lot.buildings.some((b) => same(b.cell, cell)) || lot.decor.some((d) => same(d.cell, cell));
}

/** Perché una cella non va: 'posizione' = tipo di cella sbagliato (richiesta rotta, 400), 'cella' = occupata (conflitto, 409). */
export type CellProblem = { code: 'posizione' | 'cella'; msg: string };
const OCCUPATA: CellProblem = { code: 'cella', msg: 'Cella occupata' };

/** null se l'edificio può stare in `cell`. Senza template accetta ogni cella libera. */
export function buildCellError(lot: LotState, cell: readonly [number, number], t: LotTemplate | null): CellProblem | null {
  if (t && tileAt(t, cell[0], cell[1]) !== 'L') return { code: 'posizione', msg: 'Qui non si può costruire: scegli uno spazio edificio' };
  return occupied(lot, cell) ? OCCUPATA : null;
}

/**
 * Celle del template `lotto` già prese da cose fisse (#108): il leggio del libro degli ospiti (RIENTRO.libro.lotto) e le decorazioni
 * fisse del template (`props`, cella più vicina). Valgono solo per il template vero (stesse righe di islands.json); gli altri template
 * (test) non ne hanno.
 */
const LOTTO = lotTemplate() as (LotTemplate & { props?: readonly { at: readonly [number, number] }[] }) | null;
const LOTTO_ROWS = LOTTO ? LOTTO.rows.join('\n') : null;
const RISERVATE: readonly (readonly [number, number])[] = LOTTO
  ? [RIENTRO.libro.lotto, ...(LOTTO.props ?? []).map((p): [number, number] => [Math.round(p.at[0]), Math.round(p.at[1])])]
  : [];
const isLotto = (t: LotTemplate): boolean => !!LOTTO && (t.rows === LOTTO.rows || t.rows.join('\n') === LOTTO_ROWS);
export function riservate(t: LotTemplate | null): readonly (readonly [number, number])[] {
  return t && isLotto(t) ? RISERVATE : [];
}

/** null se la decorazione può stare in `cell`: sabbia/erba del template, non sul libro degli ospiti, libera. Senza template accetta ogni cella libera. */
export function decorCellError(lot: LotState, cell: readonly [number, number], t: LotTemplate | null): CellProblem | null {
  if (t && !DECOR_TILES.has(tileAt(t, cell[0], cell[1]))) return { code: 'posizione', msg: 'Qui non si può mettere una decorazione' };
  if (riservate(t).some((c) => same(c, cell))) return { code: 'posizione', msg: 'Qui c’è già qualcosa dell’isola' };
  return occupied(lot, cell) ? OCCUPATA : null;
}

/** Celle di un tipo in ordine di lettura (riga per riga). */
export function cellsOf(t: LotTemplate, ch: string): [number, number][] {
  const out: [number, number][] = [];
  t.rows.forEach((row, cz) => { for (let cx = 0; cx < row.length; cx++) if (row[cx] === ch) out.push([cx, cz]); });
  return out;
}

/** Cella del Molo: il primo `d` del template (in alto a sinistra), [0, 0] senza template. */
export function dockCell(t: LotTemplate | null): [number, number] {
  return (t && cellsOf(t, 'd')[0]) || [0, 0];
}

/**
 * Riporta un lotto vecchio dentro il template: il Molo sul `d`, gli altri edifici su celle `L` libere (in ordine), le decorazioni fuori posto
 * su celle di sabbia/erba libere. Serve ai lotti creati prima del template (celle arbitrarie). Non tocca risorse né libro mastro.
 */
export function fitToTemplate(lot: LotState, t: LotTemplate | null): LotState {
  if (!t) return lot;
  const dock = dockCell(t);
  const taken: [number, number][] = [];
  const isTaken = (c: readonly [number, number]) => taken.some((x) => same(x, c));
  const fits = (b: { building: string; cell: [number, number] }) => (b.building === 'molo' ? same(b.cell, dock) : tileAt(t, b.cell[0], b.cell[1]) === 'L');
  // 1) restano dove sono gli edifici già in regola (il primo che occupa una cella la tiene)
  const keep = lot.buildings.map((b) => { const ok = fits(b) && !isTaken(b.cell); if (ok) taken.push(b.cell); return ok; });
  const keepDecor = lot.decor.map((d) => { const ok = DECOR_TILES.has(tileAt(t, d.cell[0], d.cell[1])) && !isTaken(d.cell); if (ok) taken.push(d.cell); return ok; });
  if (keep.every(Boolean) && keepDecor.every(Boolean)) return lot;
  // 2) gli altri vanno nella prima cella giusta libera (se non ce n'è, restano dove sono)
  const slots = cellsOf(t, 'L');
  const buildings = lot.buildings.map((b, i) => {
    if (keep[i]) return b;
    const free = b.building === 'molo' ? (isTaken(dock) ? undefined : dock) : slots.find((c) => !isTaken(c));
    if (!free) return b;
    taken.push(free);
    return { ...b, cell: free };
  });
  const spots = [...cellsOf(t, '.'), ...cellsOf(t, 'g')];
  const decor = lot.decor.map((d, i) => {
    if (keepDecor[i]) return d;
    const free = spots.find((c) => !isTaken(c));
    if (!free) return d;
    taken.push(free);
    return { ...d, cell: free };
  });
  return { ...lot, buildings, decor };
}
