// Arena dei Templari: dalle righe di templari/mappa.json (tools/templari_mappa.mjs) alle griglie della partita. Tre griglie con gli stessi
// muri: `eroe` (le finestre lo fermano sempre), `zombie` (le finestre lo fermano finché hanno assi), `percorso` (il flow field degli zombie
// passa dalle finestre). Le porte chiuse fermano tutti; aperte diventano pavimento. Celle: (cx, cz), centro ((cx + 0.5) × tile, …).
import type { TMappaDef } from '@marea/content/templari.ts';
import type { Griglia } from '../dungeon/map.ts';

/** Codici di cella. */
export const C = { fuori: 0, pavimento: 1, muro: 2, colonna: 3, basso: 4, finestra: 5, porta: 6, terra: 7 } as const;

type P = { x: number; z: number };
export type Finestra = { cx: number; cz: number; x: number; z: number;
  /** Centro della cella di pavimento dentro (dove l'eroe ripara) e di quella fuori (dove lo zombie strappa). */
  dentro: P; fuori: P };
export type Porta = { id: string; celle: number[] };
export type Comparsa = { x: number; z: number; zona: string };
/** Arma sul muro: la cella davanti (dove si compra) e il muro accanto col disegno a gesso (`n` = verso dal muro alla cella). */
export type Muro = { arma: string; x: number; z: number; wx: number; wz: number; nx: number; nz: number };
/** Posto della cassa del tesoro (la cella della cassa) e da che parte guarda (via dal muro). */
export type PostoCassa = { x: number; z: number; fx: number; fz: number };
export type Arena = {
  w: number; h: number; tile: number;
  cell: Uint8Array; opaque: Uint8Array;
  spawn: { x: number; z: number; fx: number; fz: number };
  altare: P;
  finestre: Finestra[];
  /** Indice della finestra per cella (-1 = nessuna). */
  finestraDi: Int16Array;
  porte: Porta[];
  comparse: Comparsa[];
  /** Bracieri (ostacoli bassi che fanno luce) e altari laterali: solo per la resa. */
  bracieri: P[]; altarini: P[];
  muri: Muro[];
  casse: PostoCassa[];
  /** Celle calpestabili dall'eroe all'inizio (per i test e l'autopilota). */
  dentro: number[];
};

const CACHE = new WeakMap<TMappaDef, Arena>();
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function parseArena(def: TMappaDef): Arena {
  const c0 = CACHE.get(def);
  if (c0) return c0;
  const rows = def.rows, h = rows.length, w = Math.max(...rows.map((r) => r.length)), t = def.tile;
  const cell = new Uint8Array(w * h), opaque = new Uint8Array(w * h), finestraDi = new Int16Array(w * h).fill(-1);
  const ctr = (cx: number, cz: number) => ({ x: (cx + 0.5) * t, z: (cz + 0.5) * t });
  let spawn = { x: 0, z: 0, fx: 1, fz: 0 }, altSum = { x: 0, z: 0, n: 0 };
  const finestre: Finestra[] = [], porteMap = new Map<string, number[]>(), comparse: Comparsa[] = [], bracieri: P[] = [], altarini: P[] = [];
  const muriC: { arma: string; cx: number; cz: number }[] = [], casseC: { cx: number; cz: number }[] = [];
  for (let cz = 0; cz < h; cz++) for (let cx = 0; cx < w; cx++) {
    const ch = rows[cz]![cx] ?? ' ', i = cz * w + cx;
    switch (ch) {
      case ' ': cell[i] = C.fuori; break;
      case '#': cell[i] = C.muro; opaque[i] = 1; break;
      case 'o': cell[i] = C.colonna; opaque[i] = 1; break;
      case 'A': cell[i] = C.basso; altSum = { x: altSum.x + (cx + 0.5) * t, z: altSum.z + (cz + 0.5) * t, n: altSum.n + 1 }; break;
      case 'p': case 'r': case 'q': cell[i] = C.basso; break;
      case 'b': cell[i] = C.basso; bracieri.push(ctr(cx, cz)); break;
      case 'a': cell[i] = C.basso; altarini.push(ctr(cx, cz)); break;
      case 'C': cell[i] = C.basso; casseC.push({ cx, cz }); break;
      case 'W': cell[i] = C.finestra; finestraDi[i] = finestre.length; finestre.push({ cx, cz, ...ctr(cx, cz), dentro: ctr(cx, cz), fuori: ctr(cx, cz) }); break;
      case '.': cell[i] = C.pavimento; break;
      case ',': cell[i] = C.terra; break;
      case 'S': cell[i] = C.pavimento; spawn = { ...ctr(cx, cz), fx: 1, fz: 0 }; break;
      case 'z': cell[i] = C.terra; comparse.push({ ...ctr(cx, cz), zona: 'fuori' }); break;
      default: {
        const l = def.legenda[ch];
        if (l?.porta) { cell[i] = C.porta; const a = porteMap.get(l.porta) ?? []; a.push(i); porteMap.set(l.porta, a); break; }
        if (l?.muro) { cell[i] = C.pavimento; muriC.push({ arma: l.muro, cx, cz }); break; }
        throw new Error(`Arena dei Templari: lettera '${ch}' senza legenda (${cx},${cz})`);
      }
    }
  }
  if (!altSum.n) throw new Error('Arena dei Templari senza altare');
  const k = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= w || cz >= h ? C.fuori : cell[cz * w + cx]!);
  // finestre: il lato di pavimento (dentro) e quello di terra (fuori), nei 4 vicini
  for (const f of finestre) for (const [dx, dz] of N4) {
    if (k(f.cx + dx, f.cz + dz) === C.pavimento) f.dentro = ctr(f.cx + dx, f.cz + dz);
    if (k(f.cx + dx, f.cz + dz) === C.terra) f.fuori = ctr(f.cx + dx, f.cz + dz);
  }
  // armi sul muro: il muro (o l'altare laterale) accanto alla cella; casse: guardano via dal muro
  const muri: Muro[] = muriC.map(({ arma, cx, cz }) => {
    const d = N4.find(([dx, dz]) => k(cx + dx, cz + dz) === C.muro) ?? N4.find(([dx, dz]) => k(cx + dx, cz + dz) === C.basso) ?? [0, -1];
    const c = ctr(cx, cz), wc = ctr(cx + d[0], cz + d[1]);
    return { arma, ...c, wx: wc.x, wz: wc.z, nx: -d[0], nz: -d[1] };
  });
  const casse: PostoCassa[] = casseC.map(({ cx, cz }) => {
    const d = N4.find(([dx, dz]) => k(cx + dx, cz + dz) === C.muro) ?? [0, -1];
    return { ...ctr(cx, cz), fx: -d[0], fz: -d[1] };
  });
  // l'eroe guarda verso l'altare
  const alt = { x: altSum.x / altSum.n, z: altSum.z / altSum.n };
  const dx = alt.x - spawn.x, dz = alt.z - spawn.z, dd = Math.sqrt(dx * dx + dz * dz) || 1;
  spawn = { ...spawn, fx: dx / dd, fz: dz / dd };
  const a: Arena = {
    w, h, tile: t, cell, opaque, spawn, altare: alt, finestre, finestraDi,
    porte: [...porteMap.entries()].map(([id, celle]) => ({ id, celle })), comparse, bracieri, altarini, muri, casse, dentro: [],
  };
  // celle dell'eroe all'inizio: a 4 vicini dalla partenza, senza attraversare finestre e porte
  const seen = new Uint8Array(w * h), q = [Math.floor(spawn.z / t) * w + Math.floor(spawn.x / t)];
  seen[q[0]!] = 1;
  while (q.length) {
    const i = q.pop()!;
    a.dentro.push(i);
    const cx = i % w, cz = (i - cx) / w;
    for (const [ex, ez] of N4) {
      const nx = cx + ex, nz = cz + ez, j = nz * w + nx;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h || seen[j] || cell[j] !== C.pavimento) continue;
      seen[j] = 1; q.push(j);
    }
  }
  a.dentro.sort((x, y) => x - y);
  CACHE.set(def, a);
  return a;
}

export type Griglie = { eroe: Griglia; zombie: Griglia; percorso: Griglia };

/** Griglie della partita (nuove a ogni partita: porte e finestre cambiano). */
export function creaGriglie(a: Arena): Griglie {
  const n = a.w * a.h, eroe = new Uint8Array(n), zombie = new Uint8Array(n), percorso = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const k = a.cell[i]!;
    const pieno = k === C.fuori || k === C.muro || k === C.colonna || k === C.basso || k === C.porta;
    eroe[i] = pieno || k === C.finestra ? 1 : 0;
    zombie[i] = pieno || k === C.finestra ? 1 : 0;
    percorso[i] = pieno ? 1 : 0;
  }
  const g = (solid: Uint8Array): Griglia => ({ w: a.w, h: a.h, tile: a.tile, solid, opaque: a.opaque });
  return { eroe: g(eroe), zombie: g(zombie), percorso: g(percorso) };
}

/** Assi di una finestra cambiate: la cella ferma gli zombie solo se ne resta almeno una. */
export function setFinestra(a: Arena, gr: Griglie, f: number, assi: number): void {
  const w = a.finestre[f]!, i = w.cz * a.w + w.cx;
  gr.zombie.solid[i] = assi > 0 ? 1 : 0;
}
