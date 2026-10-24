// Gladiatore automatico dell'Arena (stanza di prova ?net=0&arena=banco, allenamento, posti vuoti delle squadre sul server, test): come
// l'autopilota dei dungeon, ma contro gli avversari. Sceglie l'avversario più vicino che la sua squadra vede (chi sta nell'erba alta non lo
// vede: gli va incontro dove l'ha visto l'ultima volta, se no verso la partenza avversaria e poi il centro), lo slot giusto per la distanza
// (mischia vicino, arco o magia lontano se lo vede), gli va incontro lungo il campo BFS, colpisce quando è in portata, tende l'arco fino in
// fondo, beve sotto metà vita. Non tocca lo stato del duello: la sua memoria sta in una WeakMap e quello che fa passa da input e azioni,
// registrati come quelli di un giocatore.
import { arenaMappa } from '@marea/content/arena.ts';
import type { Rng } from '../rng.ts';
import type { DungeonInput } from '../dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../dungeon/types.ts';
import type { RunHero } from '../rpg/types.ts';
import { visibileDa } from '../dungeon/erba.ts';
import { bfs, cellCenter, cellOf, clearPath, lineOfSight, stepDown } from '../dungeon/map.ts';
import type { ArenaAzione, DuelloState } from './duello.ts';

type Punto = { x: number; z: number };
type Mem = { field: Int32Array; goal: number; fieldT: number; prevA: boolean; tieni: number; lato: number; latoT: number; slotT: number; visto: Punto | null; giro: number };
const MEM = new WeakMap<DuelloState, Mem[]>();
function mem(d: DuelloState, i: number): Mem {
  let all = MEM.get(d);
  if (!all) { all = []; MEM.set(d, all); }
  return (all[i] ??= { field: new Int32Array(d.s.map.w * d.s.map.h), goal: -1, fieldT: -999, prevA: false, tieni: 0, lato: 1, latoT: 0, slotT: 0, visto: null, giro: 0 });
}
const norm = (x: number, z: number) => { const l = Math.sqrt(x * x + z * z); return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 }; };

type Tipo = 'mischia' | 'arco' | 'magia' | 'evoca' | 'cura' | null;
function tipoDi(v: RunHero | null): Tipo {
  if (!v) return null;
  if (v.manoMagia && v.magia !== null) { const sp = v.magie[v.magia]!; return sp.evoca ? 'evoca' : sp.cura || sp.furia ? 'cura' : 'magia'; }
  return v.arma.kind === 'arco' ? 'arco' : 'mischia';
}

/** L'avversario più vicino a `i` che la sua squadra vede (null = nessuno: sono tutti a terra o nell'erba alta). */
function bersaglio(d: DuelloState, i: number): number | null {
  const s = d.s, h = s.eroi[i]!.hero;
  let out: number | null = null, best = Infinity;
  for (let j = 0; j < s.eroi.length; j++) {
    const o = s.eroi[j]!;
    if (d.squadre[j] === d.squadre[i] || o.done || !visibileDa(s, j, d.squadre[i]!)) continue;
    const dx = o.hero.x - h.x, dz = o.hero.z - h.z, q = dx * dx + dz * dz;
    if (q < best) { best = q; out = j; }
  }
  return out;
}

/** Dove andare senza un avversario in vista: l'ultimo punto dove ne ha visto uno, se no la partenza avversaria (la sua, in ordine) e poi il centro. */
function pattuglia(d: DuelloState, i: number, m: Mem, h: Punto): Punto {
  const map = d.s.map, tile = map.tile, vicino = (p: Punto, r: number) => { const dx = p.x - h.x, dz = p.z - h.z; return dx * dx + dz * dz < r * r; };
  if (m.visto && vicino(m.visto, 1.5)) m.visto = null; // arrivato: non c'è più
  if (m.visto) return m.visto;
  const nemica = arenaMappa(d.mappa).spawn[1 - d.squadre[i]!]!, dentro = d.squadre.slice(0, i).filter((q) => q === d.squadre[i]).length;
  const tappe: Punto[] = [{ x: (nemica[dentro]![0] + 0.5) * tile, z: (nemica[dentro]![1] + 0.5) * tile }, { x: map.w * tile / 2, z: map.h * tile / 2 }];
  if (vicino(tappe[m.giro % tappe.length]!, 2)) m.giro++;
  return tappe[m.giro % tappe.length]!;
}

/** Input e azione (o null) dell'eroe i adesso. */
export function botArena(d: DuelloState, i: number, rng: Rng): { input: DungeonInput; azione: ArenaAzione | null } {
  const s = d.s, me = s.eroi[i], j = bersaglio(d, i), lui = j === null ? null : s.eroi[j]!;
  if (!me || d.fase === 'finita' || me.done) return { input: { ...NO_DUNGEON_INPUT }, azione: null };
  const m = mem(d, i), h = me.hero, o = lui?.hero ?? null, rt = d.rt[i]!, e = d.eroi[i]!;
  if (o) m.visto = { x: o.x, z: o.z };
  const dx = o ? o.x - h.x : 0, dz = o ? o.z - h.z : 0, dist = o ? Math.sqrt(dx * dx + dz * dz) : Infinity, vede = !!o && lineOfSight(s.map, h.x, h.z, o.x, o.z);
  // pozione sotto metà vita (quella che cura di più tra quelle rimaste)
  if (d.fase === 'gioca' && h.vita < me.runHero.max.vita * 0.5) {
    const k = e.pozioni.map((p, n) => ({ n, v: rt.bevute[n] ? -1 : p.cura.vita ?? 0 })).sort((a, b) => b.v - a.v)[0];
    if (k && k.v > 0) return { input: { ...NO_DUNGEON_INPUT }, azione: { t: 'pozione', n: k.n } };
  }
  // lo slot giusto per la distanza (non più di uno al secondo)
  if (d.tick - m.slotT > 60) {
    const tipi = e.varianti.map(tipoDi), ok = (t: Tipo, n: number) => tipi[n] === t && (t !== 'arco' || (rt.frecce[n] ?? 0) > 0 || n === rt.slot && h.frecce > 0);
    const cerca = (...ts: Tipo[]) => { for (const t of ts) for (let n = 0; n < tipi.length; n++) if (ok(t, n)) return n; return -1; };
    const mieEvoc = s.enemies.some((x) => x.alleato && x.st !== 'morto' && (x.padrone ?? 0) === i);
    const vuole = !mieEvoc && h.magicka > 60 && dist > 4 ? cerca('evoca', 'arco', 'magia', 'mischia') : dist > 4.5 && vede ? cerca('arco', 'magia', 'mischia') : cerca('mischia', 'magia', 'arco');
    if (vuole >= 0 && vuole !== rt.slot) { m.slotT = d.tick; return { input: { ...NO_DUNGEON_INPUT }, azione: { t: 'slot', n: vuole } }; }
  }
  if (d.fase !== 'gioca') return { input: { ...NO_DUNGEON_INPUT }, azione: null };
  const tipo = tipoDi(e.varianti[rt.slot] ?? null), rh = me.runHero;
  // movimento: verso di lui lungo il campo BFS (senza un avversario in vista, verso dove l'ha visto o la pattuglia), di lato ogni tanto quando si tira da lontano
  if (d.tick - m.latoT > 90) { m.latoT = d.tick; m.lato = rng.next() < 0.5 ? -1 : 1; }
  let mv = { x: 0, z: 0 };
  const lontano = tipo === 'mischia' ? rh.arma.portata + 0.2 : tipo === 'arco' ? 9 : 6;
  if (!o) { const g = pattuglia(d, i, m, h); mv = vai(d, m, h, g.x, g.z, rh.raggio); }
  else if (dist > lontano || !vede) mv = vai(d, m, h, o.x, o.z, rh.raggio);
  else if (tipo !== 'mischia') { const u = norm(dx, dz); mv = { x: -u.z * m.lato * 0.6, z: u.x * m.lato * 0.6 }; }
  // attacco: mischia in portata a colpi brevi (ogni tanto caricati), arco teso fino in fondo, magia a colpo singolo o raggio tenuto
  let a = false;
  if (vede) {
    if (tipo === 'mischia' && dist <= rh.arma.portata + rh.raggio + 0.3) {
      if (m.tieni <= 0 && h.act === 'idle' && !m.prevA) m.tieni = rng.next() < 0.25 ? Math.round(rh.arma.carica * 60) + 6 : 2;
    } else if (tipo === 'arco' && dist < 16 && h.frecce > 0) a = h.act !== 'tende' ? !m.prevA : h.carica < 1;
    else if ((tipo === 'magia' || tipo === 'evoca') && dist < (tipo === 'evoca' ? 12 : 9)) {
      const sp = rh.magia !== null ? rh.magie[rh.magia] : undefined;
      if (sp && h.magicka >= sp.costo) a = sp.forma === 'raggio' ? dist < (sp.gittata ?? 5) : h.act !== 'punta' ? !m.prevA : false;
    } else if (tipo === 'cura' && h.vita < rh.max.vita * 0.8) a = !m.prevA;
  }
  if (m.tieni > 0) { m.tieni--; a = true; }
  m.prevA = a;
  return { input: { mx: mv.x, my: mv.z, a, b: dist > 8 && tipo === 'mischia' && h.stamina > 30, c: false, d: false }, azione: null };
}

/** Direzione verso (gx, gz): dritto se il corridoio è libero, se no lungo il campo BFS dalla meta (rifatto ogni mezzo secondo). */
function vai(d: DuelloState, m: Mem, h: { x: number; z: number }, gx: number, gz: number, r: number): { x: number; z: number } {
  const map = d.s.map;
  if (clearPath(map, h.x, h.z, gx, gz, r + 0.05)) return norm(gx - h.x, gz - h.z);
  const goal = cellOf(map, gx, gz);
  if (goal !== m.goal || d.tick - m.fieldT > 30) { bfs(map, goal, m.field); m.goal = goal; m.fieldT = d.tick; }
  const here = cellOf(map, h.x, h.z), n1 = here >= 0 ? stepDown(map, m.field, here) : -1;
  if (n1 < 0) return norm(gx - h.x, gz - h.z);
  const c = cellCenter(map, n1);
  return norm(c.x - h.x, c.z - h.z);
}
