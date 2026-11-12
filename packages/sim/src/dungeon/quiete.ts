// Nemici in quiete (dorme o veglia: non ti hanno ancora visto). Vedono in un cono (davanti col raggio pieno, di lato meno, dietro poco) e
// sentono i passi, i colpi e le lotte vicine (`udito` di ciascuno; dietro un muro meno). Il sospetto (0..1, solo nel motore: a schermo niente
// barra) sale in fretta se sei vicino e davanti, piano se sei al bordo, e cala piano. Da `cerca` in su va a vedere dove ti ha visto o sentito
// (la vista lo segna `cerca`: il client mette il «?»); pieno ti ha visto: aggro e allarme ai vicini (il «!»). Finché nessuno li disturba
// metà di chi cammina fa la ronda tra pochi punti attorno a dove sta, gli altri restano lì e si guardano intorno; chi dorme non vede e sente
// poco, e se sente abbastanza si sveglia (veglia) e va a vedere. Finita la ricerca torna a casa. I numeri: balance.json `dungeon.quiete`.
import { DT } from '../constants.ts';
import { RPG } from '@marea/content/rpg.ts';
import type { DungeonState, Enemy, HeroAct } from './state.ts';
import { secToTicks } from './state.ts';
import { wake } from './combat.ts';
import { bfs, cellCenter, cellOf, clearPath, isSolid, lineOfSight, stepDown } from './map.ts';
import type { DMap } from './map.ts';
import { flowDi, grigliaDi } from './muove.ts';
import { girata, giraVerso, moveToward } from './passi.ts';
import { furtivita } from './fruga.ts';
import { RAGGIO_ALLARME } from './tuning.ts';

/** Lo stato di un nemico in quiete: sospetto, casa (dove è nato), punti della ronda (casa compresa) con la tappa e la fine della sosta (tick,
 *  0 = in cammino), dove cerca (null = nessuno) e fino a che tick, dove guarda e quando cambia, se torna a casa (e la strada, fatta col BFS). */
export type Quiete = {
  sosp: number; casa: [number, number]; ronda: [number, number][]; tappa: number; sosta: number;
  cerca: [number, number] | null; fino: number; gx: number; gz: number; cambia: number; torna: boolean; via?: Int32Array;
};

const Q = () => RPG.dungeon.quiete;
const S2 = 0.7071067811865476;
/** Le otto direzioni in cui ci si guarda intorno. */
const DIR8: readonly (readonly [number, number])[] = [[1, 0], [S2, S2], [0, 1], [-S2, S2], [-1, 0], [-S2, -S2], [0, -1], [S2, -S2]];
/** Chi fa la ronda (se no sta fermo e si guarda intorno): chi cammina e combatte a modo suo resta lì (torrette, chi vola, i capi). */
const RONDA = new Set<string>(['mischia', 'arciere', 'mago', 'chierico', 'fuciliere', 'lanciatore', 'sciamano', 'acrobata', 'alchimista']);
/** L'eroe che colpisce, tira o lancia fa rumore come un colpo. */
const COLPI = new Set<HeroAct>(['press', 'carica', 'swing', 'tende', 'tira', 'lancia']);
/** Chi lotta fa rumore: chi colpisce, chi è colpito. */
const LOTTA = new Set<Enemy['st']>(['prepara', 'colpisce']);

const fermo = (e: Enemy): boolean => e.def.comportamento === 'torretta' || e.def.comportamento === 'anello';
const tra = (r: readonly [number, number], k: number): number => r[0] + (r[1] - r[0]) * k;

/** Il percorso da `ax, az` a `bx, bz` passa solo su pavimento senza pericoli (lava, rottami, cascate, correnti, ghiaccio). */
function sicuro(m: DMap, ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax, dz = bz - az, n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / 0.5));
  for (let k = 0; k <= n; k++) {
    const i = cellOf(m, ax + (dx * k) / n, az + (dz * k) / n);
    if (i < 0 || m.lava[i] || m.rottami[i] || m.getto[i] || m.zona[i] || m.ghiaccio[i]) return false;
  }
  return true;
}

/** Ronda: casa, un punto, casa, un altro punto (ognuno raggiungibile in linea dritta da casa, da `minRonda` a `raggioRonda` m). */
function puntiRonda(s: DungeonState, e: Enemy): [number, number][] {
  const C = Q(), m = s.map, t = m.tile, r = s.rng.fork(`ronda:${e.id}`);
  if (r.next() >= C.ronda) return [];
  const cx0 = Math.floor(e.x / t), cz0 = Math.floor(e.z / t), n = Math.ceil(C.raggioRonda / t), cand: [number, number][] = [];
  for (let dz = -n; dz <= n; dz++) {
    for (let dx = -n; dx <= n; dx++) {
      if (isSolid(m, cx0 + dx, cz0 + dz)) continue;
      const x = (cx0 + dx + 0.5) * t, z = (cz0 + dz + 0.5) * t, d2 = (x - e.x) * (x - e.x) + (z - e.z) * (z - e.z);
      if (d2 < C.minRonda * C.minRonda || d2 > C.raggioRonda * C.raggioRonda) continue;
      if (clearPath(m, e.x, e.z, x, z, e.def.raggio) && sicuro(m, e.x, e.z, x, z)) cand.push([x, z]);
    }
  }
  if (!cand.length) return [];
  const a = cand[r.int(0, cand.length - 1)]!, casa: [number, number] = [e.x, e.z];
  const lontani = cand.filter(([x, z]) => (x - a[0]) * (x - a[0]) + (z - a[1]) * (z - a[1]) >= C.minRonda * C.minRonda);
  return lontani.length ? [casa, a, casa, lontani[r.int(0, lontani.length - 1)]!] : [casa, a];
}

function nuova(s: DungeonState, e: Enemy): Quiete {
  const d = e.def, ronda = !d.boss && d.muove === undefined && RONDA.has(d.comportamento);
  return { sosp: 0, casa: [e.x, e.z], ronda: ronda ? puntiRonda(s, e) : [], tappa: 0, sosta: 0, cerca: null, fino: 0, gx: e.fx, gz: e.fz, cambia: 0, torna: false };
}

/** Verso (x, z): dritto se c'è la strada, se no lungo il flow field verso l'eroe (chi ha sentito un rumore dietro un muro lo aggira). */
function vaVerso(s: DungeonState, e: Enemy, x: number, z: number, v: number): void {
  const g = grigliaDi(s, e);
  if (clearPath(g, e.x, e.z, x, z, e.def.raggio)) { moveToward(s, e, x, z, v); return; }
  const c = cellOf(g, e.x, e.z), nx = stepDown(g, flowDi(s, e), c);
  if (nx >= 0 && nx !== c) { const p = cellCenter(g, nx); moveToward(s, e, p.x, p.z, v); }
}

/** Si gira piano verso dove guarda; ogni tanto sceglie un'altra delle otto direzioni (non contro un muro). `svelto`: cercando, più spesso. */
function guardati(s: DungeonState, e: Enemy, q: Quiete, svelto: boolean): void {
  const C = Q(), t = s.map.tile;
  if (s.tick >= q.cambia) {
    const r = s.rng.fork(`guarda:${e.id}:${s.tick}`), k0 = r.int(0, 7);
    for (let k = 0; k < 8; k++) {
      const [ux, uz] = DIR8[(k0 + k) % 8]!;
      if (!isSolid(s.map, Math.floor((e.x + ux * t * 1.2) / t), Math.floor((e.z + uz * t * 1.2) / t))) { q.gx = ux; q.gz = uz; break; }
    }
    q.cambia = s.tick + secToTicks(tra(C.guarda, r.next()) * (svelto ? 0.4 : 1));
  }
  giraVerso(e, q.gx, q.gz, Math.min(girata(e.def) ?? C.gira, C.gira) * DT);
}

/** Va a vedere dove ti ha visto o sentito: prima si gira, poi ci va (non oltre `guinzaglio` da casa); arrivato si guarda intorno. */
function cercaPasso(s: DungeonState, e: Enemy, q: Quiete): void {
  const C = Q(), [x, z] = q.cerca!, dx = x - e.x, dz = z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  const hx = e.x - q.casa[0], hz = e.z - q.casa[1];
  if (d < 1 || fermo(e) || hx * hx + hz * hz > C.guinzaglio * C.guinzaglio) { guardati(s, e, q, true); return; }
  q.torna = true;
  if (giraVerso(e, dx / d, dz / d, Math.min(girata(e.def) ?? C.gira, C.gira) * DT) < 0.7) return;
  vaVerso(s, e, x, z, e.def.velocita * C.passoCerca);
}

/** Torna a casa lungo il BFS da casa (fatto alla prima volta); arrivato riprende la ronda dal principio. */
function tornaPasso(s: DungeonState, e: Enemy, q: Quiete): void {
  const g = grigliaDi(s, e), [x, z] = q.casa, dx = x - e.x, dz = z - e.z;
  if (dx * dx + dz * dz < 0.16) { q.torna = false; q.via = undefined; q.tappa = 0; q.sosta = 0; return; }
  const v = e.def.velocita * Q().passoRonda;
  if (clearPath(g, e.x, e.z, x, z, e.def.raggio)) { moveToward(s, e, x, z, v); return; }
  q.via ??= bfs(g, cellOf(g, x, z));
  const c = cellOf(g, e.x, e.z), nx = stepDown(g, q.via, c);
  if (nx < 0) { q.torna = false; q.via = undefined; q.casa = [e.x, e.z]; q.ronda = []; return; } // non c'è strada: casa nuova, qui
  const p = cellCenter(g, nx);
  moveToward(s, e, p.x, p.z, v);
}

/** Senza sospetti: ronda (cammina, sosta e si guarda intorno) o sta a casa e si guarda intorno. */
function routine(s: DungeonState, e: Enemy, q: Quiete): void {
  if (q.torna) { tornaPasso(s, e, q); return; }
  if (!q.ronda.length || fermo(e)) { guardati(s, e, q, false); return; }
  const C = Q(), [x, z] = q.ronda[q.tappa % q.ronda.length]!, dx = x - e.x, dz = z - e.z;
  if (q.sosta === 0 && dx * dx + dz * dz > 0.09) { moveToward(s, e, x, z, e.def.velocita * C.passoRonda); return; }
  if (q.sosta === 0) q.sosta = s.tick + secToTicks(tra(C.sosta, s.rng.fork(`sosta:${e.id}:${s.tick}`).next()));
  if (s.tick >= q.sosta) { q.tappa = (q.tappa + 1) % q.ronda.length; q.sosta = 0; return; }
  guardati(s, e, q, false);
}

/** Ti ha visto: aggro, e si svegliano quelli vicini. */
function allarme(s: DungeonState, e: Enemy): void {
  wake(s, e);
  for (const o of s.enemies) {
    if (o === e || o.aggro || o.alleato || o.st === 'morto') continue;
    const ox = o.x - e.x, oz = o.z - e.z;
    if (ox * ox + oz * oz <= RAGGIO_ALLARME * RAGGIO_ALLARME) wake(s, o);
  }
}

/** Un tick di un nemico in quiete (st 'dorme' o 'veglia'). */
export function stepQuiete(s: DungeonState, e: Enemy): void {
  const C = Q(), q = (e.q ??= nuova(s, e)), dorme = e.st === 'dorme', udito = (e.def.udito ?? 1) * (dorme ? C.dorme : 1);
  let vista = 0, sente = 0, px = 0, pz = 0, pv = 0; // quanto sale il sospetto e da dove (pv: forza di quel che l'ha messo in allarme)
  /** Un rumore di raggio `n` da (x, z), a distanza d. */
  const senti = (x: number, z: number, d: number, n: number): void => {
    const r = n * udito * (lineOfSight(s.map, e.x, e.z, x, z) ? 1 : C.muro);
    if (d >= r) return;
    const k = DT * C.orecchio * (1 - d / r);
    sente = Math.max(sente, k);
    if (k > pv) { pv = k; px = x; pz = z; }
  };
  for (const r of s.eroi) {
    if (r.done) continue;
    const h = r.hero, dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
    if (!dorme && d > 1e-6) {
      const cos = (dx * e.fx + dz * e.fz) / d, R = e.def.vista * furtivita(r) * (cos >= C.cono.fronte ? 1 : cos >= C.cono.lato ? C.cono.vistaLato : C.cono.vistaDietro);
      if (d <= R && lineOfSight(s.map, e.x, e.z, h.x, h.z)) {
        const k = DT / (C.nota.vicino + ((C.nota.lontano - C.nota.vicino) * d) / R);
        vista = Math.max(vista, k);
        if (k + 1 > pv) { pv = k + 1; px = h.x; pz = h.z; } // vedere conta più che sentire
      }
    }
    const n = h.running ? C.rumore.corsa : COLPI.has(h.act) ? C.rumore.colpo : h.moving ? C.rumore.cammina : 0;
    if (n > 0) senti(h.x, h.z, d, n);
  }
  for (const o of s.enemies) {
    if (o === e || o.st === 'morto' || !o.aggro || (!LOTTA.has(o.st) && o.hurt <= 0)) continue;
    const dx = o.x - e.x, dz = o.z - e.z, d2 = dx * dx + dz * dz, n = C.rumore.lotta * udito;
    if (d2 < n * n) senti(o.x, o.z, Math.sqrt(d2), C.rumore.lotta);
  }
  if (vista > 0) q.sosp = Math.min(1, q.sosp + vista);
  if (sente > 0 && q.sosp < C.tettoUdito) q.sosp = Math.min(C.tettoUdito, q.sosp + sente);
  if (vista === 0 && sente === 0) q.sosp = Math.max(0, q.sosp - DT / C.calo);
  if (q.sosp >= 1) { allarme(s, e); return; }
  if (pv > 0 && q.sosp >= C.cerca) {
    q.cerca = [px, pz]; q.fino = s.tick + secToTicks(C.indaga);
    if (dorme) { e.st = 'veglia'; e.stT = 0; } // si sveglia, ma non ti ha ancora visto
  }
  if (q.cerca && s.tick < q.fino) { cercaPasso(s, e, q); return; }
  q.cerca = null;
  if (e.st !== 'dorme') routine(s, e, q);
}
