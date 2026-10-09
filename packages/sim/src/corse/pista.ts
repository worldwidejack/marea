// Una pista del motore v2 (docs/CORSE.md A11): il nastro principale, i rami (scorciatoie che lasciano e ritrovano la principale),
// e cosa c'è sopra:
// - le superfici (asfalto, sabbia, acqua…), con gli eventi firma che cambiano un tratto da un certo giro in poi;
// - i buchi da saltare e i bordi senza muro, da dove si cade;
// - le rampe e i tappeti del turbo.
// Si costruisce una volta per pista e si tiene in memoria. Numeri in @marea/content/corse.
import { CORSE, CORSE_PISTE } from '@marea/content/corse.ts';
import type { CEffetto, CPistaDef, CRamoDef, CTrattoDef, CVeicoloDef } from '@marea/content/corse.ts';
import { campo, costruisciNastro, dove, punto } from './nastro.ts';
import type { Nastro } from './nastro.ts';

export const VUOTO = 'vuoto';

export type Ramo = {
  def: CRamoDef; n: Nastro;
  /** Metri della principale tra `da` e `a`, e quanti ne vale un metro del ramo (per il progresso). */
  lungo: number; scala: number;
  /** Scarto laterale (sulla principale, a `da`) dove comincia il ramo: lì punta il pilota automatico. */
  latIngresso: number;
};
export type Pista = {
  def: CPistaDef; n: Nastro; rami: Ramo[];
  /** Dove finisce la gara di una fuga (m dal via); sui circuiti = un giro. */
  arrivo: number;
};

const CACHE = new Map<string, Pista>();
const P3: [number, number, number] = [0, 0, 0];

/** La pista `id` (costruita la prima volta). */
export function pistaCorse(id: string): Pista {
  const c = CACHE.get(id);
  if (c) return c;
  const def = CORSE_PISTE[id];
  if (!def) throw new Error(`Pista sconosciuta: ${id}`);
  const n = costruisciNastro(def.punti, { chiuso: def.chiusa, passo: def.passo, larghezza: def.larghezza });
  const rami = def.rami.map((r): Ramo => {
    const rn = costruisciNastro(r.punti, { chiuso: false, passo: def.passo, larghezza: r.larghezza });
    const lungo = def.chiusa && r.a < r.da ? n.len - r.da + r.a : r.a - r.da;
    punto(rn, 0, 0, 0, P3);
    const w = dove(n, P3[0], P3[1], P3[2], r.da, 20);
    return { def: r, n: rn, lungo, scala: lungo / rn.len, latIngresso: w.lat };
  });
  const arrivo = def.tipo === 'circuito' ? n.len : n.len - def.via - 8;
  const p: Pista = { def, n, rami, arrivo };
  CACHE.set(id, p);
  return p;
}

/** Il nastro su cui sta chi è sul ramo `ramo` (−1 = la principale). */
export const nastroDi = (p: Pista, ramo: number): Nastro => (ramo < 0 ? p.n : p.rami[ramo]!.n);

/** `s` sta nel tratto (su una chiusa `da` > `a` passa dal via)? */
export function nelTratto(t: CTrattoDef, s: number, lat: number, n: Nastro): boolean {
  const dentro = n.chiuso && t.da > t.a ? s >= t.da || s < t.a : s >= t.da && s < t.a;
  if (!dentro) return false;
  return !t.lat || (lat >= t.lat[0] && lat <= t.lat[1]);
}

/** La superficie sotto (s, lat) al giro `giro` (1 = il primo): `vuoto` nei buchi e nei crolli. */
export function superficieA(p: Pista, ramo: number, s: number, lat: number, giro: number): string {
  if (ramo >= 0) {
    const r = p.rami[ramo]!, l = campo(r.n, r.n.l, s);
    let tipo = Math.abs(lat) <= l ? r.def.superficie : r.def.bordoTipo;
    for (const t of r.def.superfici ?? []) if (nelTratto(t, s, lat, r.n)) tipo = t.tipo;
    return tipo;
  }
  const d = p.def, n = p.n;
  for (const v of d.vuoti) if (nelTratto(v, s, lat, n)) return VUOTO;
  const l = campo(n, n.l, s);
  let tipo = Math.abs(lat) <= l ? d.superficie : d.bordoTipo;
  for (const t of d.superfici) if (nelTratto(t, s, lat, n)) tipo = t.tipo;
  for (const e of d.eventi) if (giro >= e.daGiro && nelTratto(e, s, lat, n)) tipo = e.superficie;
  return tipo;
}

/** C'è il muro dal lato `lato` (−1 sinistra, 1 destra)? Nei buchi no; sui rami sempre. */
export function muroA(p: Pista, ramo: number, s: number, lato: number): boolean {
  if (ramo >= 0) return true;
  for (const v of p.def.vuoti) if (nelTratto(v, s, 0, p.n)) return false;
  for (const m of p.def.senzaMuro) if ((m.lato === 0 || m.lato === lato) && nelTratto(m, s, 0, p.n)) return false;
  return true;
}

/** Il bordo oltre la carreggiata (m) del nastro su cui si sta. */
export const bordoDi = (p: Pista, ramo: number): number => (ramo < 0 ? p.def.bordo : p.rami[ramo]!.def.bordo);

const PIENO: CEffetto = { velocita: 1, presa: 1, accelerazione: 1 };
/** Come va il veicolo su quella superficie: prima i suoi effetti (i buffi), poi quelli della famiglia. */
export function effetto(v: CVeicoloDef, sup: string): CEffetto {
  return v.effetti?.[sup] ?? CORSE.superfici[sup]?.per[v.famiglia] ?? PIENO;
}

const VEICOLI = new Map(CORSE.veicoli.map((v) => [v.id, v]));
export function veicoloCorse(id: string): CVeicoloDef {
  const v = VEICOLI.get(id);
  if (!v) throw new Error(`Veicolo sconosciuto: ${id}`);
  return v;
}
