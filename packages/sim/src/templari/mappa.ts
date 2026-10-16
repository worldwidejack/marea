// Arena dei Templari: dalle righe di templari/mappa.json (tools/templari_mappa.mjs) alle griglie della partita. Tre griglie con gli stessi
// muri: `eroe` (le finestre lo fermano sempre), `zombie` (le finestre lo fermano finché hanno assi), `percorso` (il flow field degli zombie
// passa dalle finestre). Le porte chiuse fermano tutti; aperte diventano pavimento. Celle: (cx, cz), centro ((cx + 0.5) × tile, …).
// Fuori dalla chiesa le zone (piazza, cimitero, taverna, spiaggia) si aprono con le porte: case e tende sono muri, muretti, tombe e
// carretti ostacoli bassi. Per la resa ogni cella ha anche il suolo (`suolo`) e cos'è (`tipo`).
import type { TMappaDef } from '@marea/content/templari.ts';
import { TEMPLARI } from '@marea/content/templari.ts';
import type { Griglia } from '../dungeon/map.ts';

/** Codici di cella. */
export const C = { fuori: 0, pavimento: 1, muro: 2, colonna: 3, basso: 4, finestra: 5, porta: 6, terra: 7 } as const;
/** Suolo delle celle (solo per la resa): pietre della chiesa, terra del sagrato, acciottolato, erba, sabbia, assito. */
export const SUOLO = { niente: 0, pietra: 1, terra: 2, ciottoli: 3, erba: 4, sabbia: 5, assi: 6 } as const;
/** Cos'è una cella piena (solo per la resa). */
export const TIPO = { niente: 0, chiesa: 1, casa: 2, tenda: 3, colonna: 4, stallo: 5, maceria: 6, muretto: 7, tomba: 8, cosa: 9, braciere: 10, altare: 11, altarino: 12, cassa: 13, leva: 14, tramezzo: 15, sarcofago: 16, armadio: 17, fuoco: 18,
  /** Segreti (§9c): una campanella sul palo, il muro crepato, l'altare della cripta, la scala della cripta. */
  campanella: 19, crepa: 20, altareCripta: 21, scala: 22 } as const;
const SUOLO_DI: Record<string, number> = { '.': SUOLO.pietra, ',': SUOLO.terra, v: SUOLO.ciottoli, e: SUOLO.erba, s: SUOLO.sabbia, w: SUOLO.assi };
const TIPO_DI: Record<string, number> = { N: TIPO.tramezzo, V: TIPO.sarcofago, Y: TIPO.armadio, '#': TIPO.chiesa, h: TIPO.casa, t: TIPO.tenda, o: TIPO.colonna, p: TIPO.stallo, r: TIPO.maceria, q: TIPO.maceria, m: TIPO.muretto, g: TIPO.tomba, k: TIPO.cosa, b: TIPO.braciere, A: TIPO.altare, a: TIPO.altarino, C: TIPO.cassa };

type P = { x: number; z: number };
export type Finestra = { cx: number; cz: number; x: number; z: number;
  /** Centro della cella di pavimento dentro (dove l'eroe ripara) e di quella fuori (dove lo zombie strappa). */
  dentro: P; fuori: P };
export type Porta = { id: string; celle: number[] };
/** Comparsa degli zombie: `zona` = 'fuori' (il sagrato, sempre accesa) o la zona che apre una porta. */
export type Comparsa = { x: number; z: number; zona: string };
/** Trappola: le sue celle e la leva (cella piena accanto alla quale si usa). */
export type Trappola = { id: string; celle: number[]; leva: P };
/** Arma sul muro: la cella davanti (dove si compra) e il muro accanto col disegno a gesso (`n` = verso dal muro alla cella). */
export type Muro = { arma: string; x: number; z: number; wx: number; wz: number; nx: number; nz: number };
/** Albero (o lampione) su una cella di fuori che tocca il campo: la cella ferma come un cerchio grande come il tronco (`TEMPLARI.alberi`).
 *  `h` = numero fisso della cella (0..1) per altezza e colore. */
/** Strega o Mercante: il posto dove si parla con loro (cella del campo sul bordo) e da che parte stanno, fuori (`fx, fz`). */
export type Personaggio = { id: 'mercante' | 'strega'; x: number; z: number; fx: number; fz: number };
/** Un fuoco da accendere (il braciere grande, cella piena) e i posti possibili di un pezzo della campana. */
export type Fuoco = { id: string; x: number; z: number };
export type PostiPezzo = { id: string; posti: P[] };
/** La cripta sotto la chiesa (docs/TEMPLARI.md §9c): il muro crepato della rotonda e la scala in fondo alla cripta sono i due capi della
 *  stessa scala (la sim porta eroi e zombie dall'uno all'altro). `su` = la cella di chiesa davanti al muro (ci arrivi tornando su), `giu` =
 *  quella della cripta davanti alla scala (ci arrivi scendendo), col verso in cui guardi arrivando; `dentro` = le celle della cripta. */
export type Cripta = { muro: P & { cella: number }; su: P & { fx: number; fz: number }; scala: P & { cella: number }; giu: P & { fx: number; fz: number }; altare: P; dentro: Uint8Array };
/** Una campanella o un teschio dei segreti: id e cella. */
export type Segreto = { id: string; x: number; z: number };
export type Albero = { x: number; z: number; cella: number; tipo: 'cipresso' | 'palma' | 'lampione'; h: number };
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
  trappole: Trappola[];
  alberi: Albero[];
  personaggi: Personaggio[];
  /** Fuochi da accendere e posti dei pezzi della campana (docs/TEMPLARI.md §9b). */
  fuochi: Fuoco[]; pezzi: PostiPezzo[];
  /** Segreti (§9c): la cripta, le campanelle, il muro con l'ordine delle campane (come un'arma sul muro: la cella davanti e il muro), i teschi. */
  cripta: Cripta | null; campanelle: Segreto[]; indizio: Omit<Muro, 'arma'> | null; teschi: Segreto[];
  /** Indice della trappola per cella (-1 = nessuna). */
  trappolaDi: Int8Array;
  /** Per la resa: suolo e tipo di ogni cella (SUOLO, TIPO). */
  suolo: Uint8Array; tipo: Uint8Array;
};

const CACHE = new WeakMap<TMappaDef, Arena>();
/** Numero fisso 0..1 di una cella (come cellHash del client): dove vanno gli alberi è uguale per tutti. */
export function hashCella(cx: number, cz: number, salt = 0): number {
  let h = (cx * 374761393 + cz * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Alberi e lampioni: solo sulle celle di fuori che toccano il campo (a sud o a est c'è terreno), a nord e a ovest perché la camera guarda
 *  da sud-est (dall'altra parte coprirebbero il campo). Mai più in là: un albero a due celle lasciava davanti un muro invisibile.
 *  Cipressi dietro l'erba del cimitero, palme e lampioni dietro acciottolato, sabbia e terra. */
function trovaAlberi(w: number, h: number, cell: Uint8Array, suolo: Uint8Array, t: number, liberi: { cx: number; cz: number }[]): Albero[] {
  const out: Albero[] = [];
  for (let cz = 0; cz < h; cz++) for (let cx = 0; cx < w; cx++) {
    const i = cz * w + cx;
    if (cell[i] !== C.fuori) continue;
    if (liberi.some((p) => Math.abs(p.cx - cx) <= 2 && Math.abs(p.cz - cz) <= 2)) continue; // davanti a Strega e Mercante niente alberi: si devono vedere
    const vic = [[cx, cz + 1], [cx + 1, cz]].filter(([x, z]) => x! < w && z! < h && cell[z! * w + x!] !== C.fuori).map(([x, z]) => suolo[z! * w + x!]!);
    if (!vic.length) continue;
    const p = { x: (cx + 0.5) * t, z: (cz + 0.5) * t, cella: i };
    if (vic.includes(SUOLO.erba)) { if ((cx + cz * 2) % 3 === 0) out.push({ ...p, tipo: 'cipresso', h: hashCella(cx, cz, 41) }); continue; }
    const s = vic.find((x) => x === SUOLO.ciottoli || x === SUOLO.sabbia || x === SUOLO.terra);
    if (s === undefined) continue;
    const k = hashCella(cx, cz, 91);
    if (k < 0.12) out.push({ ...p, tipo: 'palma', h: k });
    else if (k > 0.95 && s !== SUOLO.terra) out.push({ ...p, tipo: 'lampione', h: k });
  }
  return out;
}
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function parseArena(def: TMappaDef): Arena {
  const c0 = CACHE.get(def);
  if (c0) return c0;
  const rows = def.rows, h = rows.length, w = Math.max(...rows.map((r) => r.length)), t = def.tile;
  const cell = new Uint8Array(w * h), opaque = new Uint8Array(w * h), finestraDi = new Int16Array(w * h).fill(-1);
  const suolo = new Uint8Array(w * h), tipo = new Uint8Array(w * h), trappolaDi = new Int8Array(w * h).fill(-1);
  const trapMap = new Map<string, number[]>(), leve = new Map<string, P>();
  const ctr = (cx: number, cz: number) => ({ x: (cx + 0.5) * t, z: (cz + 0.5) * t });
  let spawn = { x: 0, z: 0, fx: 1, fz: 0 }, altSum = { x: 0, z: 0, n: 0 };
  const finestre: Finestra[] = [], porteMap = new Map<string, number[]>(), comparse: Comparsa[] = [], bracieri: P[] = [], altarini: P[] = [];
  const muriC: { arma: string; cx: number; cz: number }[] = [], casseC: { cx: number; cz: number }[] = [];
  const posti: { id: 'mercante' | 'strega'; cx: number; cz: number }[] = [];
  const fuochi: Fuoco[] = [], pezziMap = new Map<string, P[]>();
  const campanelle: Segreto[] = [], teschi: Segreto[] = [], cr = { muro: -1, scala: -1, altare: [] as P[] };
  let indizioC: { cx: number; cz: number } | null = null;
  for (let cz = 0; cz < h; cz++) for (let cx = 0; cx < w; cx++) {
    const ch = rows[cz]![cx] ?? ' ', i = cz * w + cx;
    suolo[i] = SUOLO_DI[ch] ?? SUOLO.niente; tipo[i] = TIPO_DI[ch] ?? TIPO.niente;
    switch (ch) {
      case ' ': cell[i] = C.fuori; break;
      case '#': case 'h': case 't': case 'N': cell[i] = C.muro; opaque[i] = 1; break;
      case 'o': cell[i] = C.colonna; opaque[i] = 1; break;
      case 'A': cell[i] = C.basso; altSum = { x: altSum.x + (cx + 0.5) * t, z: altSum.z + (cz + 0.5) * t, n: altSum.n + 1 }; break;
      case 'p': case 'r': case 'q': case 'm': case 'g': case 'k': case 'V': case 'Y': cell[i] = C.basso; break;
      case 'b': cell[i] = C.basso; bracieri.push(ctr(cx, cz)); break;
      case 'a': cell[i] = C.basso; altarini.push(ctr(cx, cz)); break;
      case 'C': cell[i] = C.basso; casseC.push({ cx, cz }); break;
      case 'W': cell[i] = C.finestra; finestraDi[i] = finestre.length; finestre.push({ cx, cz, ...ctr(cx, cz), dentro: ctr(cx, cz), fuori: ctr(cx, cz) }); break;
      case '.': case 'w': cell[i] = C.pavimento; break;
      case ',': case 'v': case 'e': case 's': cell[i] = C.terra; break;
      case 'S': cell[i] = C.pavimento; spawn = { ...ctr(cx, cz), fx: 1, fz: 0 }; break;
      case 'z': cell[i] = C.terra; comparse.push({ ...ctr(cx, cz), zona: 'fuori' }); break;
      default: {
        const l = def.legenda[ch];
        if (l?.porta) { cell[i] = C.porta; const a = porteMap.get(l.porta) ?? []; a.push(i); porteMap.set(l.porta, a); break; }
        if (l?.muro) { cell[i] = C.pavimento; muriC.push({ arma: l.muro, cx, cz }); break; }
        if (l?.comparsa) { cell[i] = C.terra; comparse.push({ ...ctr(cx, cz), zona: l.comparsa }); break; }
        if (l?.trappola) { cell[i] = C.pavimento; const a = trapMap.get(l.trappola) ?? []; a.push(i); trapMap.set(l.trappola, a); break; }
        if (l?.leva) { cell[i] = C.basso; tipo[i] = TIPO.leva; leve.set(l.leva, ctr(cx, cz)); break; }
        if (l?.personaggio) { cell[i] = C.terra; posti.push({ id: l.personaggio, cx, cz }); break; }
        if (l?.fuoco) { cell[i] = C.basso; tipo[i] = TIPO.fuoco; fuochi.push({ id: l.fuoco, ...ctr(cx, cz) }); break; }
        if (l?.pezzo) { cell[i] = C.terra; const a = pezziMap.get(l.pezzo) ?? []; a.push(ctr(cx, cz)); pezziMap.set(l.pezzo, a); break; }
        if (l?.cripta === 'muro') { cell[i] = C.muro; opaque[i] = 1; tipo[i] = TIPO.crepa; cr.muro = i; break; }
        if (l?.cripta === 'scala') { cell[i] = C.pavimento; tipo[i] = TIPO.scala; cr.scala = i; break; }
        if (l?.cripta === 'altare') { cell[i] = C.basso; tipo[i] = TIPO.altareCripta; cr.altare.push(ctr(cx, cz)); break; }
        if (l?.campanella) { cell[i] = C.basso; tipo[i] = TIPO.campanella; campanelle.push({ id: l.campanella, ...ctr(cx, cz) }); break; }
        if (l?.indizio) { cell[i] = C.pavimento; indizioC = { cx, cz }; break; }
        if (l?.teschio) { cell[i] = C.pavimento; teschi.push({ id: l.teschio, ...ctr(cx, cz) }); break; }
        throw new Error(`Arena dei Templari: lettera '${ch}' senza legenda (${cx},${cz})`);
      }
    }
  }
  if (!altSum.n) throw new Error('Arena dei Templari senza altare');
  const k = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= w || cz >= h ? C.fuori : cell[cz * w + cx]!);
  // suolo delle celle segnate (comparse, trappole, porte, armi, cose piene): quello più comune attorno; trappole fuori = terra
  for (let pass = 0; pass < 3; pass++) for (let cz = 0; cz < h; cz++) for (let cx = 0; cx < w; cx++) {
    const i = cz * w + cx;
    if (suolo[i] || cell[i] === C.fuori) continue;
    const n = new Uint8Array(7);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x >= 0 && z >= 0 && x < w && z < h) n[suolo[z * w + x]!]!++;
    }
    let best = 0, bn = 0;
    for (let j = 1; j < 7; j++) if (n[j]! > bn) { bn = n[j]!; best = j; }
    if (best) suolo[i] = best;
  }
  const trappole: Trappola[] = [...trapMap.entries()].map(([id, celle], ti) => {
    for (const c of celle) { trappolaDi[c] = ti; if (suolo[c] !== SUOLO.pietra && suolo[c] !== SUOLO.assi) cell[c] = C.terra; }
    return { id, celle, leva: leve.get(id) ?? ctr(celle[0]! % w, Math.floor(celle[0]! / w)) };
  });
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
  /** La cripta: i due capi della scala con la cella davanti (la prima libera dei 4 vicini) e le celle della cripta (dalla scala in giù). */
  function cripta(): Cripta | null {
    if (cr.muro < 0 || cr.scala < 0) return null;
    const capo = (i: number) => {
      const cx = i % w, cz = (i - cx) / w, d = N4.find(([dx, dz]) => { const c = k(cx + dx, cz + dz); return c === C.pavimento || c === C.terra; }) ?? [1, 0];
      return { cella: i, ...ctr(cx, cz), davanti: { ...ctr(cx + d[0], cz + d[1]), fx: d[0], fz: d[1] } };
    };
    const m = capo(cr.muro), sc = capo(cr.scala), dentro = new Uint8Array(w * h);
    const q = [Math.floor(sc.davanti.z / t) * w + Math.floor(sc.davanti.x / t)];
    dentro[q[0]!] = 1;
    while (q.length) {
      const i = q.pop()!, cx = i % w, cz = (i - cx) / w;
      for (const [dx, dz] of N4) {
        const nx = cx + dx, nz = cz + dz, j = nz * w + nx, c = k(nx, nz);
        if (dentro[j] || (c !== C.pavimento && c !== C.terra)) continue;
        dentro[j] = 1; q.push(j);
      }
    }
    const n = Math.max(1, cr.altare.length), alt = cr.altare.reduce((s, p) => ({ x: s.x + p.x / n, z: s.z + p.z / n }), { x: 0, z: 0 });
    return { muro: { cella: m.cella, x: m.x, z: m.z }, su: m.davanti, scala: { cella: sc.cella, x: sc.x, z: sc.z }, giu: sc.davanti, altare: alt, dentro };
  }
  /** Il muro con l'ordine delle campane: la cella davanti e il muro accanto (come le armi sul muro). */
  function indizio(): Omit<Muro, 'arma'> | null {
    if (!indizioC) return null;
    const { cx, cz } = indizioC, d = N4.find(([dx, dz]) => k(cx + dx, cz + dz) === C.muro) ?? [0, -1], c = ctr(cx, cz), wc = ctr(cx + d[0], cz + d[1]);
    return { ...c, wx: wc.x, wz: wc.z, nx: -d[0], nz: -d[1] };
  }
  // l'eroe guarda verso l'altare
  const alt = { x: altSum.x / altSum.n, z: altSum.z / altSum.n };
  const dx = alt.x - spawn.x, dz = alt.z - spawn.z, dd = Math.sqrt(dx * dx + dz * dz) || 1;
  spawn = { ...spawn, fx: dx / dd, fz: dz / dd };
  const a: Arena = {
    w, h, tile: t, cell, opaque, spawn, altare: alt, finestre, finestraDi,
    porte: [...porteMap.entries()].map(([id, celle]) => ({ id, celle })), comparse, bracieri, altarini, muri, casse, dentro: [],
    trappole, alberi: trovaAlberi(w, h, cell, suolo, t, posti), trappolaDi, suolo, tipo,
    fuochi, pezzi: [...pezziMap.entries()].map(([id, p]) => ({ id, posti: p })),
    cripta: cripta(), campanelle, teschi, indizio: indizio(),
    personaggi: posti.map(({ id, cx, cz }) => { const d = N4.find(([dx, dz]) => k(cx + dx, cz + dz) === C.fuori) ?? [0, -1]; return { id, ...ctr(cx, cz), fx: d[0], fz: d[1] }; }),
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
  // i tronchi fermano eroe e zombie solo quanto sono grossi; il flow field li tiene pieni (nessuno ci passa attraverso)
  const tondi = new Map(a.alberi.map((x) => [x.cella, TEMPLARI.alberi[x.tipo]] as const));
  const g = (solid: Uint8Array, tonde = false): Griglia => ({ w: a.w, h: a.h, tile: a.tile, solid, opaque: a.opaque, ...(tonde ? { tondi } : {}) });
  return { eroe: g(eroe, true), zombie: g(zombie, true), percorso: g(percorso) };
}

/** Assi di una finestra cambiate: la cella ferma gli zombie solo se ne resta almeno una. */
export function setFinestra(a: Arena, gr: Griglie, f: number, assi: number): void {
  const w = a.finestre[f]!, i = w.cz * a.w + w.cx;
  gr.zombie.solid[i] = assi > 0 ? 1 : 0;
}
