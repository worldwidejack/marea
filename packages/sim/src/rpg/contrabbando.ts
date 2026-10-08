// Contrabbandiere del Porto (accanto alla Grotta della Marea): ogni giorno vende un'arma, un'armatura, un materiale e un ingrediente
// pescati da RPG.contrabbando.banco (niente di troppo raro) e compra tutto quello che viene dai dungeon a una frazione del valore.
// Puro e deterministico: il banco di oggi dipende solo dal giorno (cambia a mezzanotte di Roma), così client e server lo calcolano uguale.
import { RECIPES, RPG } from '@marea/content/rpg.ts';
import { createRng } from '../rng.ts';
import { hasItem, itemDef } from './items.ts';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const C = RPG.contrabbando;

export type CategoriaLosca = keyof typeof C.banco;
export const CATEGORIE_LOSCHE: readonly CategoriaLosca[] = ['arma', 'armatura', 'materiale', 'ingrediente'];

/** Ore avanti rispetto a UTC a Roma: 2 dall'ultima domenica di marzo all'ultima di ottobre (all'1:00 UTC), se no 1. */
function oreRoma(ms: number): number {
  const y = new Date(ms).getUTCFullYear();
  const ultimaDomenica = (m: number): number => { const fine = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, fine.getUTCDate() - fine.getUTCDay(), 1); };
  return ms >= ultimaDomenica(2) && ms < ultimaDomenica(9) ? 2 : 1;
}
/** Giorno del calendario italiano (cambia a mezzanotte di Roma). */
export const giornoRoma = (ms: number): number => Math.floor((ms + oreRoma(ms) * HOUR) / DAY);
/** Millisecondi alla prossima mezzanotte di Roma (merce nuova). */
export const finoAMezzanotte = (ms: number): number => (giornoRoma(ms) + 1) * DAY - oreRoma(ms) * HOUR - ms;

/** Il banco di una categoria rimescolato per il giro `c` (un giro = tanti giorni quanti oggetti: in un giro esce tutto una volta). */
function giro(cat: CategoriaLosca, c: number): string[] {
  const a = [...C.banco[cat]], rng = createRng(`contrabbando:${cat}:${c}`);
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
/** La merce di oggi: un id per categoria. Mai lo stesso del giorno prima: se il primo del giro è l'ultimo del giro prima, al suo posto
 *  esce l'ultimo di questo giro (con almeno 3 oggetti non tocca i giorni accanto). */
export function bancoDi(ms: number): Record<CategoriaLosca, string> {
  const g = giornoRoma(ms), out = {} as Record<CategoriaLosca, string>;
  for (const cat of CATEGORIE_LOSCHE) {
    const n = C.banco[cat].length, c = Math.floor(g / n), j = g - c * n, cur = giro(cat, c);
    out[cat] = n < 3 ? C.banco[cat][g % n]! : j === 0 && cur[0] === giro(cat, c - 1)[n - 1] ? cur[n - 1]! : cur[j]!;
  }
  return out;
}
export function inVendita(ms: number, id: string): boolean { return Object.values(bancoDi(ms)).includes(id); }

const memo = new Map<string, number>();
/** Valore di riferimento di un oggetto in monete (prima di ricarico o sconto). */
export function valoreDi(id: string): number {
  const v = memo.get(id);
  if (v !== undefined) return v;
  let out = C.valori[id];
  if (out === undefined && hasItem(id)) {
    const it = itemDef(id);
    if (it.unico) out = C.tipi.unico ?? 0;
    else if (it.forgia) out = Object.entries(it.forgia.costo).reduce((s, [m, q]) => s + (C.valori[m] ?? 0) * q, 0) * C.lavoro / (it.forgia.n ?? 1);
    else {
      const r = RECIPES.filter((x) => x.risultato === id).map((x) => Object.entries(x.ingredienti).reduce((s, [m, q]) => s + valoreDi(m) * q, 0) * C.pozione / x.n);
      out = r.length ? Math.min(...r) : C.tipi[it.kind] ?? 0;
    }
  }
  memo.set(id, out ?? 0);
  return out ?? 0;
}
/** Quanto chiede lui per un pezzo (almeno 1 moneta). */
export const prezzoLosco = (id: string): number => Math.max(1, Math.ceil(valoreDi(id) * C.vendita));
/** Quanto ti dà lui per n pezzi: arrotondato giù sul totale (roba che non vale niente = 0, non la prende). */
export const offertaLosca = (id: string, n: number): number => Math.floor(valoreDi(id) * C.compra * n + 1e-9);
