// Il corpo della montagna dello snowboard: la quota del terreno lontano dalla pista, in (x, z) del mondo. Vicino alla pista c'è il nastro
// di pista3d (fino a FASCIA m oltre la neve fresca; più in là, nelle curve, le sue file si incrocerebbero); oltre, un
// versante largo che scende piano fino al fondovalle, con dorsali e canaloni. Il nastro finisce esattamente su questa quota, la griglia del
// corpo (sfondo.ts) la segue: niente scalini tra i due.
import type { PistaNeve } from '@marea/sim/adrenalina/pista.ts';
import { bordoA, neveA, quotaA } from '@marea/sim/adrenalina/pista.ts';

/** Metri oltre la neve fresca dove il nastro di pista3d finisce e comincia il corpo. */
export const FASCIA = 64;

const h01 = (a: number, b: number): number => { let x = (a * 374761393 + b * 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
/** Rumore liscio 0-1 su una griglia di lato 1 (valori a caso negli incroci, raccordati). */
export function liscio(x: number, z: number, seme: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const v = (a: number, b: number) => h01(a * 7 + seme * 101, b * 13 - seme * 37);
  return (v(ix, iz) * (1 - sx) + v(ix + 1, iz) * sx) * (1 - sz) + (v(ix, iz + 1) * (1 - sx) + v(ix + 1, iz + 1) * sx) * sz;
}

export type Corpo = {
  /** Quota del terreno in (x, z). Sotto il nastro scende fino a 14 m più in basso (lì si vede il nastro). */
  quota(x: number, z: number): number;
  /** Metri oltre la fine del nastro di pista3d (negativo = sotto il nastro), dall'ultimo `quota`. */
  fuori(): number;
  /** Il fondovalle: 260 m sotto l'arrivo. */
  valle: number;
  /** Il limite del bosco: sotto gli abeti (dalla cornice in giù; lo slalom in alto resta nudo, neve e rocce). */
  bosco: number;
};

const CACHE = new Map<string, Corpo>();
export function corpoMontagna(p: PistaNeve): Corpo {
  const c = CACHE.get(p.def.id);
  if (c) return c;
  const camp: { x: number; z: number; y: number; e: number }[] = [];
  let yMin = Infinity;
  for (let i = 0; i < p.n.n; i++) yMin = Math.min(yMin, p.n.y[i]!);
  for (let i = 0; i < p.n.n; i += 8) camp.push({ x: p.n.x[i]!, z: p.n.z[i]!, y: p.n.y[i]!, e: bordoA(p, i * p.n.passo) + neveA(p, i * p.n.passo) + FASCIA });
  const valle = yMin - 260;
  const D = new Float64Array(camp.length), cornice = p.def.zone.find((z) => z.id === 'cornice');
  let ultimo = 0;
  const quota = (x: number, z: number): number => {
    // la pista più vicina, ma mescolata coi suoi vicini (pesi che calano in 40 m): dove il punto più vicino salta da un tratto alto a uno
    // più basso della pista (nelle curve) il terreno resta continuo, senza gradini
    let dMin = Infinity;
    for (let i = 0; i < camp.length; i++) { const k = camp[i]!, d = Math.sqrt((k.x - x) * (k.x - x) + (k.z - z) * (k.z - z)) - k.e; D[i] = d; if (d < dMin) dMin = d; }
    let y = 0, sw = 0;
    for (let i = 0; i < camp.length; i++) { const t = (D[i]! - dMin) / 40; if (t < 4) { const w = Math.exp(-t * t); y += camp[i]!.y * w; sw += w; } }
    y /= sw;
    const fuori = dMin; ultimo = dMin;
    if (fuori < 0) return y - 2 + Math.max(-12, fuori * 0.35); // sotto il nastro (lì si vede lui), a filo del suo bordo
    const giu = Math.max(1, y - 2 - valle), ru = (liscio(x / 140, z / 140, 5) - 0.5) * 40 * Math.min(1, fuori / 200);
    return valle + giu * Math.exp((-fuori * 0.28) / giu) + ru;
  };
  const corpo = { quota, valle, fuori: () => ultimo, bosco: cornice ? quotaA(p, cornice.da, 0) + 20 : -Infinity };
  CACHE.set(p.def.id, corpo);
  return corpo;
}
