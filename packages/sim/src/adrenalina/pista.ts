// Le piste dell'Isola dell'Adrenalina in memoria (docs/ADRENALINA.md §4, CONTRACTS §42): il nastro 3D delle Corse
// (`corse/nastro.ts`, percorso aperto) costruito una volta per pista, più le domande che fanno la sim e il client: quanta neve fresca c'è
// oltre il bordo, su quale trampolino si è, quanto è alto lì. Solo + − × ÷ e Math.sqrt (tools/check_static.mjs).
import { SNOWBOARD_PISTE } from '@marea/content/adrenalina.ts';
import type { SPistaDef, SRampaDef } from '@marea/content/adrenalina.ts';
import { campo, costruisciNastro, punto } from '../corse/nastro.ts';
import type { Nastro } from '../corse/nastro.ts';

export type PistaNeve = { def: SPistaDef; n: Nastro };

const CACHE = new Map<string, PistaNeve>();
export function pistaSnowboard(id: string): PistaNeve {
  let p = CACHE.get(id);
  if (!p) {
    const def = SNOWBOARD_PISTE[id];
    if (!def) throw new Error(`Pista sconosciuta: ${id}`);
    p = { def, n: costruisciNastro(def.punti, { chiuso: false, passo: def.passo, larghezza: def.larghezza }) };
    CACHE.set(id, p);
  }
  return p;
}

/** Mezza carreggiata (m) a `s`. */
export const bordoA = (p: PistaNeve, s: number): number => campo(p.n, p.n.l, s);
/** Neve fresca oltre il bordo (m) a `s`: nelle gole niente, oltre il bordo c'è la roccia. */
export function neveA(p: PistaNeve, s: number): number {
  for (const g of p.def.gole) if (s >= g.da && s <= g.a) return 0;
  return fuoripistaA(p, s) ? p.def.fuoripista!.neve : p.def.neve;
}
/** Si è nel fuoripista (il sentiero nel bosco dopo l'abete caduto). */
export const fuoripistaA = (p: PistaNeve, s: number): boolean => !!p.def.fuoripista && s >= p.def.fuoripista.da && s < p.def.fuoripista.a;
/** Curvatura verso il sopra a `s` (1/m: + = conca, − = dosso). */
export const curvaturaA = (p: PistaNeve, s: number): number => campo(p.n, p.n.kv, s);
/** Pendenza a `s`: quanto scende la pista per metro (seno dell'angolo; + = in discesa). */
export const pendenzaA = (p: PistaNeve, s: number): number => -campo(p.n, p.n.ty, s);

const P3: [number, number, number] = [0, 0, 0];
/** Quota (y del mondo) della neve a (s, lat). */
export function quotaA(p: PistaNeve, s: number, lat: number): number { return punto(p.n, s, lat, 0, P3)[1]; }

/** Il trampolino sotto (s, lat): tra l'inizio della salita e il bordo, dentro la sua fascia. -1 = nessuno. */
export function rampaA(p: PistaNeve, s: number, lat: number): number {
  const r = p.def.rampe;
  for (let i = 0; i < r.length; i++) { const q = r[i]!; if (s >= q.s - q.lungo && s <= q.s && lat >= q.lat[0] && lat <= q.lat[1]) return i; }
  return -1;
}
/** Altezza della salita del trampolino a `s` (0 all'inizio, `alto` sul bordo; una curva che si alza di più verso il bordo). */
export function altezzaRampa(r: SRampaDef, s: number): number {
  const k = (s - (r.s - r.lungo)) / r.lungo;
  return k <= 0 ? 0 : k >= 1 ? r.alto : r.alto * k * k;
}
