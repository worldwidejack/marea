// Arredo della prima persona: da dentro gli occhi dell'eroe i dungeon fatti a celle sembravano scatole tutte uguali e ci si perdeva.
// Qui si aggiunge solo scenografia ferma, calcolata una volta dalla mappa (la sim non cambia, niente che si attraversi a metà cella):
// - zoccolo e cornice lungo i muri, pilastri negli angoli, sugli spigoli delle porte e a ritmo lungo i muri dritti, travi al soffitto ogni 4 m;
// - ogni stanza ha il suo colore (stendardi appesi ai muri; nella Grotta funghi luminosi): «la stanza rossa», «quella azzurra»;
// - Grotta: massi alla base dei muri e sporgenze di roccia, stalattiti; muri e pavimenti con tre toni a cella (dungeon_scene.ts).
// La foschia di lontananza a gradini sta in render/finestra.ts; il Vuoto (niente muri) in fp_vuoto.ts.
import * as THREE from 'three';
import type { DungeonDef } from '@marea/content/rpg.ts';
import type { DMap } from '@marea/sim/dungeon/map.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import { cellHash, flat } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';

/** Mette un tipo di pezzo su più posti (una InstancedMesh per parte): `acceso` = una volta visto resta pieno (le cose che brillano);
 *  `colori` = un colore di palette per istanza, che moltiplica quello del pezzo (i pezzi da tingere sono dipinti di bianco). */
export type Posa = (ps: Part[], mats: THREE.Matrix4[], name: string, modo: 'pieno' | 'acceso', colori?: string[]) => void;
export type Pianta = { def: DungeonDef; map: DMap; ch(cx: number, cz: number): string; isFloor(cx: number, cz: number): boolean; top: number; soffitto: number };

/** Stile in prima persona: foschia [da m, a m, colore, quanto copre], raggi della vista, fondo; zoccolo e cornice, pilastri, travi (null = niente). */
export type StileFp = {
  foschia: readonly [number, number, string, number]; raggi?: readonly [number, number]; fondo?: string;
  fascia: readonly [string, string] | null; pilastro: string | null; travi: string | null; stendardi: boolean; grotta?: true; vuoto?: true;
  /** Tappeto del colore della stanza nel mezzo delle sale (le stanze «abitate»: cripta, archivio, mausoleo, baita, orto). */
  tappeto?: true;
};
const COSTRUITO = (z: string, c: string, p: string, t: string, nebbia: string, tappeto = false): StileFp => ({ foschia: [6, 22, nebbia, 0.75], fascia: [z, c], pilastro: p, travi: t, stendardi: true, ...(tappeto ? { tappeto: true as const } : {}) });
/** Una riga per stile. Uno stile senza riga prende `BASE_FP` (pietra, come la Cripta): un dungeon nuovo ha subito foschia, arredo e colori
 *  per stanza; la riga sua serve solo per dargli i suoi colori o un arredo diverso (grotta, vuoto). */
export const STILI_FP: Record<string, StileFp> = {
  grotta: { foschia: [5, 20, PAL.ombraCalda, 0.8], fascia: null, pilastro: null, travi: null, stendardi: false, grotta: true },
  cripta: COSTRUITO(PAL.pietraScura, PAL.pietra, PAL.pietra, PAL.pietraScura, PAL.neroCaldo, true),
  vuoto: { foschia: [5, 15, PAL.abisso, 1], raggi: [5, 15], fondo: PAL.abisso, fascia: null, pilastro: null, travi: null, stendardi: false, vuoto: true },
  drenaggio: COSTRUITO(PAL.acquaProfonda, PAL.roccia, PAL.pietra, PAL.roccia, PAL.acquaProfonda),
  archivio: COSTRUITO(PAL.legnoScuro, PAL.legno, PAL.legnoScuro, PAL.legnoScuro, PAL.ombraCalda, true),
  fucina: COSTRUITO(PAL.neroCaldo, PAL.pietraScura, PAL.pietraScura, PAL.neroCaldo, PAL.neroCaldo),
  mausoleo: COSTRUITO(PAL.pietra, PAL.pietraChiara, PAL.pietraChiara, PAL.pietra, PAL.abisso, true),
  diga: COSTRUITO(PAL.legnoScuro, PAL.legnoScuro, PAL.legnoScuro, PAL.legnoScuro, PAL.acquaProfonda),
  baita: COSTRUITO(PAL.legnoScuro, PAL.legnoScuro, PAL.legnoScuro, PAL.legnoScuro, PAL.ombraCalda, true),
  ceneri: COSTRUITO(PAL.neroCaldo, PAL.roccia, PAL.neroCaldo, PAL.neroCaldo, PAL.neroCaldo),
  orto: COSTRUITO(PAL.ombraCalda, PAL.legno, PAL.legnoChiaro, PAL.legno, PAL.ombraCalda, true),
};
export const BASE_FP: StileFp = COSTRUITO(PAL.pietraScura, PAL.pietra, PAL.pietra, PAL.pietraScura, PAL.neroCaldo, true);
/** I colori delle stanze, in giro (palette). */
export const ACCENTI = [PAL.rosso, PAL.acquaBassa, PAL.giallo, PAL.viola, PAL.erba, PAL.arancio, PAL.rosaNeon, PAL.pietraChiara] as const;

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const BIANCO = '#ffffff'; // solo per i pezzi tinti a istanza: il colore vero è quello della stanza
let vcMat: THREE.MeshLambertMaterial | null = null, tappetoMat: THREE.MeshLambertMaterial | null = null;
/** Disegno del tappeto (16 × 16, si tinge col colore della stanza): fondo chiaro, rombo e puntini più scuri. */
function rombi(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d')!, px = (col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(BIANCO, 0, 0, 16, 16);
  for (let k = 0; k < 8; k++) { px(PAL.pietra, 8 + k, k, 1, 1); px(PAL.pietra, 8 - k, k, 1, 1); px(PAL.pietra, k, 8 + k, 1, 1); px(PAL.pietra, 16 - k, 8 + k, 1, 1); }
  px(PAL.pietra, 7, 7, 2, 2); px(PAL.pietraChiara, 0, 0, 2, 2); px(PAL.pietraChiara, 14, 14, 2, 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const vc = (): THREE.MeshLambertMaterial => (vcMat ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
const parte = (geo: THREE.BufferGeometry): Part[] => [{ geo, mat: vc() }];
/** Posto di un pezzo: cella (cx, cz), spostato di (ox, oz) m, girato in modo che il suo −z guardi verso (dx, dz). */
export const posto = (T: number, cx: number, cz: number, dx: number, dz: number, ox = 0, oz = 0, s = 1, sy = s): THREE.Matrix4 =>
  M((cx + 0.5) * T + ox, 0, (cz + 0.5) * T + oz, 0, Math.atan2(-dx, -dz), 0, s, sy, s);

/** Stanze: celle di pavimento con tutte le 8 vicine di pavimento, unite a gruppi (almeno 4); ogni pavimento a 2 celle da una stanza ne prende il numero. */
export function stanze(p: Pianta): { di: Int16Array; n: number; celle: number[][] } {
  const { w: W, h: H } = p.map, di = new Int16Array(W * H).fill(-1), celle: number[][] = [];
  const piena = (cx: number, cz: number) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!p.isFloor(cx + dx, cz + dz)) return false; return true; };
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (di[cz * W + cx] !== -1 || !piena(cx, cz)) continue;
    const gruppo: number[] = [], coda = [cz * W + cx]; di[cz * W + cx] = celle.length;
    while (coda.length) {
      const i = coda.pop()!, x = i % W, z = (i - x) / W; gruppo.push(i);
      for (const [dx, dz] of N4) { const j = (z + dz) * W + x + dx; if (x + dx >= 0 && x + dx < W && z + dz >= 0 && z + dz < H && di[j] === -1 && piena(x + dx, z + dz)) { di[j] = celle.length; coda.push(j); } }
    }
    if (gruppo.length < 4) { for (const i of gruppo) di[i] = -2; continue; }
    celle.push(gruppo);
  }
  for (let i = 0; i < di.length; i++) if (di[i] === -2) di[i] = -1;
  // le celle attorno (corridoi d'ingresso, bordo della stanza) prendono il numero della stanza più vicina, fino a 2 passi
  for (let giro = 0; giro < 2; giro++) {
    const prima = di.slice();
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      if (prima[cz * W + cx] !== -1 || !p.isFloor(cx, cz)) continue;
      for (const [dx, dz] of N4) { const j = (cz + dz) * W + cx + dx; if (cx + dx >= 0 && cx + dx < W && cz + dz >= 0 && cz + dz < H && prima[j]! >= 0) { di[cz * W + cx] = prima[j]!; break; } }
    }
  }
  return { di, n: celle.length, celle };
}

/** Facce di muro viste da un pavimento: cella del pavimento e verso del muro. `vuoto`: le facce sul nulla (bordo delle piattaforme). */
export function facce(p: Pianta, vuoto = false): { cx: number; cz: number; dx: number; dz: number }[] {
  const out: { cx: number; cz: number; dx: number; dz: number }[] = [];
  for (let cz = 0; cz < p.map.h; cz++) for (let cx = 0; cx < p.map.w; cx++) {
    if (!p.isFloor(cx, cz)) continue;
    for (const [dx, dz] of N4) { const c = p.ch(cx + dx, cz + dz); if (vuoto ? c === ' ' : c === '#') out.push({ cx, cz, dx, dz }); }
  }
  return out;
}

/** Arredo dei dungeon costruiti e della Grotta. */
export function arreda(p: Pianta, st: StileFp, posa: Posa): void {
  const { map, top, soffitto: S } = p, T = map.tile, W = map.w, H = map.h;
  const muri = facce(p), { di } = stanze(p);
  const luci = new Set<number>(); // le celle con la torcia: lì niente stendardo
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) if (p.def.legenda[p.ch(cx, cz)]?.luce) luci.add(cz * W + cx);
  const uscita = (cx: number, cz: number) => Math.abs(cx - map.exit.cx) + Math.abs(cz - map.exit.cz) <= 1;

  // ---- zoccolo e cornice ----
  if (st.fascia) {
    const [z, c] = st.fascia;
    const g = merged([
      painted(box(T, 0.26, 0.1), z, M(0, top + 0.13, -T / 2 - 0.05 + 0.1)), painted(box(T, 0.05, 0.14), c, M(0, top + 0.28, -T / 2 + 0.07)),
      painted(box(T, 0.16, 0.16), c, M(0, S - 0.08, -T / 2 + 0.08)), painted(box(T, 0.06, 0.22), z, M(0, S - 0.19, -T / 2 + 0.11)),
    ]);
    posa(parte(g), muri.map((f) => posto(T, f.cx, f.cz, f.dx, f.dz)), 'fp_fascia', 'pieno');
  }

  // ---- pilastri: sui vertici della griglia che toccano muro e pavimento (nella Grotta pile di massi che arrotondano gli spigoli) ----
  if (st.pilastro || st.grotta) {
    const pc = st.pilastro ?? PAL.roccia, base = st.fascia?.[0] ?? pc;
    const g = st.grotta ? merged([
      painted(new THREE.IcosahedronGeometry(0.62, 0), PAL.roccia, M(0, top + 0.4, 0, 0, 0, 0, 1, 0.75, 1)), painted(new THREE.IcosahedronGeometry(0.5, 0), PAL.pietraScura, M(0.08, top + 1.1, -0.05, 0.5, 0.3, 0, 1, 0.9, 1)),
      painted(new THREE.IcosahedronGeometry(0.44, 0), PAL.roccia, M(-0.05, top + 1.75, 0.04, 0.2, 1.1, 0.3, 1, 0.85, 1)), painted(new THREE.IcosahedronGeometry(0.55, 0), PAL.ombraCalda, M(0, S - 0.15, 0, 0.7, 0.4, 0, 1.1, 0.7, 1.1)),
    ]) : merged([
      painted(box(0.52, 0.24, 0.52), base, M(0, top + 0.12, 0)), painted(box(0.38, S - top - 0.5, 0.38), pc, M(0, (S + top) / 2, 0)),
      painted(box(0.52, 0.22, 0.52), base, M(0, S - 0.15, 0)), painted(box(0.44, 0.06, 0.44), pc, M(0, S - 0.29, 0)),
    ]);
    const mats: THREE.Matrix4[] = [];
    const muro = (cx: number, cz: number) => p.ch(cx, cz) === '#';
    for (let gz = 1; gz < H; gz++) for (let gx = 1; gx < W; gx++) {
      const q = [[gx - 1, gz - 1], [gx, gz - 1], [gx - 1, gz], [gx, gz]] as const; // NO, NE, SO, SE
      const m = q.map(([x, z]) => muro(x, z)), f = q.map(([x, z]) => p.isFloor(x, z));
      const nm = m.filter(Boolean).length, nf = f.filter(Boolean).length;
      if (nm + nf < 4 || !nm || !nf) continue;
      let ox = 0, oz = 0;
      if (nm === 3) { const k = f.indexOf(true); ox = k % 2 ? 0.14 : -0.14; oz = k > 1 ? 0.14 : -0.14; } // angolo dentro la stanza
      else if (nm === 2) {
        const dritto = (m[0] && m[1]) || (m[2] && m[3]) || (m[0] && m[2]) || (m[1] && m[3]);
        if (!dritto || (st.grotta ? cellHash(gx, gz, 13) > 0.35 : (gx + gz) % 2)) continue; // lungo i muri dritti: uno ogni 4 m, staccato di poco dal muro
        if (m[0] && m[1]) oz = 0.1; else if (m[2] && m[3]) oz = -0.1; else if (m[0] && m[2]) ox = 0.1; else ox = -0.1;
      }
      mats.push(st.grotta ? M(gx * T + ox, 0, gz * T + oz, 0, cellHash(gx, gz, 14) * 6, 0, 0.85 + 0.4 * cellHash(gx, gz, 15), 1, 0.85 + 0.4 * cellHash(gx, gz, 16)) : M(gx * T + ox, 0, gz * T + oz));
    }
    posa(parte(g), mats, 'fp_pilastro', 'pieno');
  }

  // ---- travi al soffitto: sulle linee pari della griglia, tra due pavimenti ----
  if (st.travi) {
    const g = merged([painted(box(T, 0.24, 0.3), st.travi, M(0, S - 0.12, 0))]), mats: THREE.Matrix4[] = [];
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      if (!p.isFloor(cx, cz)) continue;
      if (cz % 2 === 0 && p.isFloor(cx, cz - 1)) mats.push(M((cx + 0.5) * T, 0, cz * T));
      if (cx % 2 === 0 && p.isFloor(cx - 1, cz)) mats.push(M(cx * T, 0, (cz + 0.5) * T, 0, Math.PI / 2, 0));
    }
    posa(parte(g), mats, 'fp_trave', 'pieno');
  }

  // ---- stendardi: due o tre per stanza, del colore della stanza, distanti tra loro ----
  if (st.stendardi) {
    const asta = merged([
      painted(box(1.0, 0.07, 0.07), PAL.legnoScuro, M(0, S - 0.42, -T / 2 + 0.16)), painted(box(0.1, 0.1, 0.1), PAL.giallo, M(-0.52, S - 0.42, -T / 2 + 0.16)), painted(box(0.1, 0.1, 0.1), PAL.giallo, M(0.52, S - 0.42, -T / 2 + 0.16)),
      painted(box(0.3, 0.3, 0.03), PAL.giallo, M(0, S - 1.05, -T / 2 + 0.135)), painted(box(0.16, 0.16, 0.035), PAL.neroCaldo, M(0, S - 1.05, -T / 2 + 0.135)),
    ]);
    const telo = merged([
      painted(box(0.84, 1.25, 0.03), BIANCO, M(0, S - 1.07, -T / 2 + 0.12)),
      painted(box(0.36, 0.26, 0.03), BIANCO, M(-0.24, S - 1.8, -T / 2 + 0.12)), painted(box(0.36, 0.26, 0.03), BIANCO, M(0.24, S - 1.8, -T / 2 + 0.12)), // coda a rondine
    ]);
    const presi: { cx: number; cz: number; r: number }[] = [], mats: THREE.Matrix4[] = [], colori: string[] = [];
    const ordinati = muri.filter((f) => di[f.cz * W + f.cx]! >= 0 && !luci.has(f.cz * W + f.cx) && !uscita(f.cx, f.cz))
      .sort((a, b) => cellHash(a.cx * 4 + a.dx + 2, a.cz * 4 + a.dz + 2, 11) - cellHash(b.cx * 4 + b.dx + 2, b.cz * 4 + b.dz + 2, 11));
    const quanti = new Map<number, number>();
    for (const f of ordinati) {
      const r = di[f.cz * W + f.cx]!, n = quanti.get(r) ?? 0;
      if (n >= 3 || presi.some((q) => Math.abs(q.cx - f.cx) + Math.abs(q.cz - f.cz) < 4)) continue;
      presi.push({ cx: f.cx, cz: f.cz, r }); quanti.set(r, n + 1);
      mats.push(posto(T, f.cx, f.cz, f.dx, f.dz)); colori.push(ACCENTI[r % ACCENTI.length]!);
    }
    posa(parte(asta), mats, 'fp_stendardo', 'pieno');
    posa(parte(telo), mats, 'fp_stendardo_telo', 'pieno', colori);
  }

  if (st.tappeto) tappeto(p, di, posa, uscita);
  if (st.grotta) grotta(p, muri, di, posa, uscita);
}

/** Tappeto: al centro della sala (al massimo 3 × 3 celle), sulle celle a due passi da ogni muro e libere (niente colonne, acqua, grate, lava,
 *  getti, rottami, altari), col disegno a rombi del colore della stanza e il bordo giallo. */
function tappeto(p: Pianta, di: Int16Array, posa: Posa, uscita: (cx: number, cz: number) => boolean): void {
  const { map, top } = p, T = map.tile, W = map.w, H = map.h, altari = new Set(map.altari.map((a) => a.cz * W + a.cx));
  const libera = (cx: number, cz: number) => { const i = cz * W + cx; return p.isFloor(cx, cz) && !map.solid[i] && !map.grata[i] && !map.lava[i] && !map.getto[i] && !map.rottami[i] && !altari.has(i) && !uscita(cx, cz); };
  const su = new Uint8Array(W * H);
  for (let cz = 2; cz < H - 2; cz++) for (let cx = 2; cx < W - 2; cx++) {
    if (di[cz * W + cx]! < 0 || !libera(cx, cz)) continue;
    let ok = true; for (let dz = -2; dz <= 2 && ok; dz++) for (let dx = -2; dx <= 2; dx++) if (!p.isFloor(cx + dx, cz + dz)) { ok = false; break; }
    if (ok) su[cz * W + cx] = 1;
  }
  // il centro: la cella buona più vicina al baricentro della stanza; il tappeto resta a un passo da lì
  const centri = new Map<number, { cx: number; cz: number }>(), somme = new Map<number, [number, number, number]>();
  for (let i = 0; i < W * H; i++) if (di[i]! >= 0 && p.isFloor(i % W, Math.floor(i / W))) { const s = somme.get(di[i]!) ?? [0, 0, 0]; s[0] += i % W; s[1] += Math.floor(i / W); s[2]++; somme.set(di[i]!, s); }
  for (let i = 0; i < W * H; i++) {
    if (!su[i]) continue;
    const r = di[i]!, s = somme.get(r)!, cx = i % W, cz = Math.floor(i / W), c = centri.get(r);
    const d = (x: number, z: number) => (x - s[0] / s[2]) ** 2 + (z - s[1] / s[2]) ** 2;
    if (!c || d(cx, cz) < d(c.cx, c.cz)) centri.set(r, { cx, cz });
  }
  for (let i = 0; i < W * H; i++) { const c = centri.get(di[i]!); if (su[i] && (!c || Math.abs(c.cx - (i % W)) > 1 || Math.abs(c.cz - Math.floor(i / W)) > 1)) su[i] = 0; }
  const pezze: THREE.Matrix4[] = [], colori: string[] = [], orli: THREE.Matrix4[] = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (!su[cz * W + cx]) continue;
    pezze.push(M((cx + 0.5) * T, 0, (cz + 0.5) * T)); colori.push(ACCENTI[di[cz * W + cx]! % ACCENTI.length]!);
    for (const [dx, dz] of N4) if (!su[(cz + dz) * W + cx + dx]) orli.push(posto(T, cx, cz, dx, dz));
  }
  const g = box(T, 0.03, T); g.translate(0, top + 0.015, 0);
  posa([{ geo: g, mat: (tappetoMat ??= new THREE.MeshLambertMaterial({ map: rombi(), flatShading: true })) }], pezze, 'fp_tappeto', 'pieno', colori);
  posa(parte(merged([painted(box(T + 0.02, 0.04, 0.22), PAL.giallo, M(0, top + 0.02, -T / 2 + 0.11))])), orli, 'fp_tappeto_orlo', 'pieno');
}

/** Grotta: massi alla base dei muri e sporgenze sulle pareti, stalattiti, funghi luminosi del colore della stanza. */
function grotta(p: Pianta, muri: ReturnType<typeof facce>, di: Int16Array, posa: Posa, uscita: (cx: number, cz: number) => boolean): void {
  const { map, top, soffitto: S } = p, T = map.tile, W = map.w, H = map.h;
  const masso = parte(merged([painted(new THREE.IcosahedronGeometry(1, 0), BIANCO)]));
  const massi: THREE.Matrix4[] = [], toni: string[] = [], TONI = [PAL.roccia, PAL.pietraScura, PAL.ombraCalda];
  muri.forEach((f, k) => {
    const h = cellHash(f.cx * 4 + f.dx + 2, f.cz * 4 + f.dz + 2, 21), lungo = (cellHash(k, 3, 22) - 0.5) * 1.2, r = 0.3 + 0.35 * cellHash(k, 4, 23);
    const sx = f.dz !== 0 ? lungo : 0, sz = f.dx !== 0 ? lungo : 0, giro = cellHash(k, 5, 24) * 6;
    if (h < 0.6) { // masso alla base, mezzo dentro il muro
      massi.push(new THREE.Matrix4().compose(new THREE.Vector3((f.cx + 0.5 + f.dx * 0.5) * T - f.dx * r * 0.45 + sx, top + r * 0.35, (f.cz + 0.5 + f.dz * 0.5) * T - f.dz * r * 0.45 + sz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(giro, giro * 1.7, 0)), new THREE.Vector3(r * 1.2, r * 0.8, r)));
      toni.push(TONI[k % 3]!);
    }
    if (cellHash(k, 6, 25) < 0.45) { // sporgenza della parete, più in alto
      const y = top + 0.7 + 1.1 * cellHash(k, 7, 26), q = 0.35 + 0.3 * cellHash(k, 8, 27);
      massi.push(new THREE.Matrix4().compose(new THREE.Vector3((f.cx + 0.5 + f.dx * 0.5) * T - f.dx * q * 0.3 - sx, y, (f.cz + 0.5 + f.dz * 0.5) * T - f.dz * q * 0.3 - sz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(giro * 0.5, giro, giro * 0.3)), new THREE.Vector3(q * 1.4, q, q * 1.1)));
      toni.push(TONI[(k + 1) % 3]!);
    }
  });
  posa(masso, massi, 'fp_massi', 'pieno', toni);
  // stalattiti: su un terzo delle celle, da una a tre
  const cono = parte(merged([painted(new THREE.ConeGeometry(0.22, 1, 5), BIANCO, M(0, -0.5, 0, Math.PI, 0, 0))]));
  const stal: THREE.Matrix4[] = [], ts: string[] = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (!p.isFloor(cx, cz) || cellHash(cx, cz, 31) > 0.34 || uscita(cx, cz)) continue;
    const n = 1 + Math.floor(cellHash(cx, cz, 32) * 3);
    for (let k = 0; k < n; k++) {
      const l = 0.35 + 0.75 * cellHash(cx, cz, 33 + k), s = 0.6 + 0.8 * cellHash(cx, cz, 36 + k);
      stal.push(M((cx + 0.15 + 0.7 * cellHash(cx, cz, 40 + k)) * T, S + 0.05, (cz + 0.15 + 0.7 * cellHash(cx, cz, 44 + k)) * T, 0, k, 0, s, l, s));
      ts.push(TONI[(cx + k) % 2]!);
    }
  }
  posa(cono, stal, 'fp_stalattiti', 'pieno', ts);
  // funghi luminosi: un ciuffo ogni tanto alla base dei muri delle stanze, la cappella del colore della stanza
  const gambo = merged([painted(new THREE.CylinderGeometry(0.04, 0.05, 0.26, 5), PAL.sabbiaChiara, M(-0.12, top + 0.13, 0)), painted(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 5), PAL.sabbiaChiara, M(0.1, top + 0.09, 0.08)), painted(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 5), PAL.sabbiaChiara, M(0.02, top + 0.07, -0.1))]);
  const cappelle = (c: string): Part[] => [{ geo: merged([painted(new THREE.ConeGeometry(0.14, 0.1, 6), BIANCO, M(-0.12, top + 0.3, 0)), painted(new THREE.ConeGeometry(0.1, 0.08, 6), BIANCO, M(0.1, top + 0.21, 0.08)), painted(new THREE.ConeGeometry(0.08, 0.06, 6), BIANCO, M(0.02, top + 0.16, -0.1))]), mat: flat(c, true) }];
  const perColore = new Map<string, THREE.Matrix4[]>(), gambi: THREE.Matrix4[] = [];
  muri.forEach((f, k) => {
    const r = di[f.cz * W + f.cx]!;
    if (r < 0 || cellHash(k, 9, 51) > 0.22) return;
    const c = ACCENTI[r % ACCENTI.length]!, m = posto(T, f.cx, f.cz, f.dx, f.dz, -f.dx * 0.25 + (f.dx * T) / 2, -f.dz * 0.25 + (f.dz * T) / 2, 1.3);
    gambi.push(m);
    let l = perColore.get(c); if (!l) { l = []; perColore.set(c, l); } l.push(m);
  });
  posa(parte(gambo), gambi, 'fp_funghi', 'pieno');
  for (const [c, l] of perColore) posa(cappelle(c), l, 'fp_funghi_luce', 'acceso');
}
