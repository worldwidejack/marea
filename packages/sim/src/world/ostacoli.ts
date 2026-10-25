// Cose solide a terra (Borgo Marea): cerchi e rettangoli ruotati in coordinate mondo, in un indice a celle da CELLA m per trovarle in
// fretta. Le fisse (alberi, sassi, case, banchi) si mettono una volta; le mobili (la gente che passeggia) si spostano ogni frame per id.
// La forma di ogni cosa sta in content/collisioni.json. Puro e deterministico: solo + − × ÷, Math.sqrt e trig.ts.
import { COLLISIONI } from '@marea/content';
import * as trig from '../trig.ts';

/** Forma in coordinate locali dell'oggetto: cerchio di raggio `r` o rettangolo `box` [largo X, profondo Z]; `at` = spostamento locale [x, z]. */
export type FormaSolida = { r: number; at?: readonly [number, number] } | { box: readonly [number, number]; at?: readonly [number, number] };
/** Un solido nel mondo: cerchio (`r`) o rettangolo con mezze misure `hx`, `hz` e coseno/seno della rotazione Y (convenzione three). */
export type Solido = { x: number; z: number; r: number } | { x: number; z: number; hx: number; hz: number; c: number; s: number };
export type Ostacoli = {
  /** Aggiunge un solido fisso. */
  fisso(o: Solido): void;
  /** Mette (o sposta) il solido mobile `id`; null lo toglie. */
  mobile(id: string, o: Solido | null): void;
  /** Fissi e mobili che possono toccare il cerchio (x, z, r). `salta` = id mobile da non contare (chi si sta muovendo). */
  vicini(x: number, z: number, r: number, salta?: string): Solido[];
  /** Tutti i fissi (per la rete dei percorsi). */
  readonly fissi: readonly Solido[];
  /** Cresce a ogni fisso aggiunto: chi ha costruito qualcosa sopra (la rete dei percorsi) sa quando rifarlo. */
  readonly versione: number;
};

const CELLA = 4;
const isBox = (o: Solido): o is Extract<Solido, { hx: number }> => 'hx' in o;

/** Il solido di una forma posata in (x, z) con rotazione `rot` (radianti, come three) e scala `sc`. */
export function solidoDi(f: FormaSolida, x: number, z: number, rot = 0, sc = 1): Solido {
  const c = trig.cos(rot), s = trig.sin(rot), lx = (f.at?.[0] ?? 0) * sc, lz = (f.at?.[1] ?? 0) * sc;
  const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
  return 'box' in f ? { x: wx, z: wz, hx: (f.box[0] / 2) * sc, hz: (f.box[1] / 2) * sc, c, s } : { x: wx, z: wz, r: f.r * sc };
}

/** Posa come fisse le forme di `kind` (collisioni.json) in (x, z) con rotazione e scala; ritorna quante (0 = cosa che non è solida).
 *  `isola`: la forma `<isola>:<kind>`, se c'è, vince su quella di `kind` (il faro delle Corse non è quello del Borgo). */
export function posaForma(o: Pick<Ostacoli, 'fisso'>, kind: string, x: number, z: number, rot = 0, sc = 1, isola?: string): number {
  const fs = (isola ? COLLISIONI.forme[`${isola}:${kind}`] : undefined) ?? COLLISIONI.forme[kind] ?? [];
  for (const f of fs) o.fisso(solidoDi(f, x, z, rot, sc));
  return fs.length;
}

/** Raggio del cerchio che contiene il solido (per l'indice). */
function ingombro(o: Solido): number {
  return isBox(o) ? Math.sqrt(o.hx * o.hx + o.hz * o.hz) : o.r;
}

/** Quanto il cerchio (x, z, r) entra nel solido (m, ≤ 0 = fuori) e verso dove uscire (normale nel mondo). */
export function penetra(o: Solido, x: number, z: number, r: number): { d: number; nx: number; nz: number } {
  if (!isBox(o)) {
    const dx = x - o.x, dz = z - o.z, l = trig.hypot(dx, dz);
    return l < 1e-9 ? { d: r + o.r, nx: 1, nz: 0 } : { d: r + o.r - l, nx: dx / l, nz: dz / l };
  }
  // nel sistema del rettangolo: locale = trasposta della rotazione
  const wx = x - o.x, wz = z - o.z, lx = wx * o.c - wz * o.s, lz = wx * o.s + wz * o.c;
  const qx = Math.max(-o.hx, Math.min(o.hx, lx)), qz = Math.max(-o.hz, Math.min(o.hz, lz));
  let dx = lx - qx, dz = lz - qz, d: number;
  const l = trig.hypot(dx, dz);
  if (l > 1e-9) { d = r - l; dx /= l; dz /= l; } else {
    // centro dentro: esci dal lato più vicino
    const ex = o.hx - Math.abs(lx), ez = o.hz - Math.abs(lz);
    if (ex < ez) { dx = lx < 0 ? -1 : 1; dz = 0; d = r + ex; } else { dx = 0; dz = lz < 0 ? -1 : 1; d = r + ez; }
  }
  // normale di nuovo nel mondo
  return { d, nx: dx * o.c + dz * o.s, nz: -dx * o.s + dz * o.c };
}

/** Spinge il cerchio (x, z, r) fuori dai solidi `os` (fino a 4 giri, così negli angoli tra due solidi si esce da tutti e due). */
export function spingiFuori(os: readonly Solido[], x0: number, z0: number, r: number): { x: number; z: number; hit: boolean } {
  let x = x0, z = z0, hit = false;
  for (let it = 0; it < 4; it++) {
    let moved = false;
    for (const o of os) {
      const p = penetra(o, x, z, r);
      if (p.d <= 1e-6) continue;
      x += p.nx * p.d; z += p.nz * p.d; moved = true; hit = true;
    }
    if (!moved) break;
  }
  return { x, z, hit };
}

export function createOstacoli(): Ostacoli {
  const celle = new Map<number, Solido[]>();
  const fissi: Solido[] = [];
  const mobili = new Map<string, Solido>();
  let versione = 0;
  const k = (cx: number, cz: number) => cz * 65536 + cx;
  return {
    get fissi() { return fissi; },
    get versione() { return versione; },
    fisso(o) {
      const g = ingombro(o);
      const c0x = Math.floor((o.x - g) / CELLA), c1x = Math.floor((o.x + g) / CELLA), c0z = Math.floor((o.z - g) / CELLA), c1z = Math.floor((o.z + g) / CELLA);
      for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) { const l = celle.get(k(cx, cz)); if (l) l.push(o); else celle.set(k(cx, cz), [o]); }
      fissi.push(o); versione++;
    },
    mobile(id, o) { if (o) mobili.set(id, o); else mobili.delete(id); },
    vicini(x, z, r, salta) {
      const out: Solido[] = [];
      const c0x = Math.floor((x - r) / CELLA), c1x = Math.floor((x + r) / CELLA), c0z = Math.floor((z - r) / CELLA), c1z = Math.floor((z + r) / CELLA);
      for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) for (const o of celle.get(k(cx, cz)) ?? []) if (!out.includes(o)) out.push(o);
      for (const [id, o] of mobili) if (id !== salta && Math.abs(o.x - x) < r + ingombro(o) && Math.abs(o.z - z) < r + ingombro(o)) out.push(o);
      return out;
    },
  };
}
