// Avversario automatico dell'Arena (stanza di prova ?net=0&arena=banco, test): come l'autopilota dei dungeon, ma contro l'altro eroe.
// Sceglie lo slot giusto per la distanza (mischia vicino, arco o magia lontano se lo vede), gli va incontro lungo il campo BFS, colpisce
// quando è in portata, tende l'arco fino in fondo, beve sotto metà vita. Non tocca lo stato del duello: la sua memoria sta in una WeakMap
// e quello che fa passa da input e azioni, registrati come quelli di un giocatore.
import type { Rng } from '../rng.ts';
import type { DungeonInput } from '../dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../dungeon/types.ts';
import type { RunHero } from '../rpg/types.ts';
import { bfs, cellCenter, cellOf, clearPath, lineOfSight, stepDown } from '../dungeon/map.ts';
import type { ArenaAzione, DuelloState } from './duello.ts';

type Mem = { field: Int32Array; goal: number; fieldT: number; prevA: boolean; tieni: number; lato: number; latoT: number; slotT: number };
const MEM = new WeakMap<DuelloState, Mem[]>();
function mem(d: DuelloState, i: number): Mem {
  let all = MEM.get(d);
  if (!all) { all = []; MEM.set(d, all); }
  return (all[i] ??= { field: new Int32Array(d.s.map.w * d.s.map.h), goal: -1, fieldT: -999, prevA: false, tieni: 0, lato: 1, latoT: 0, slotT: 0 });
}
const norm = (x: number, z: number) => { const l = Math.sqrt(x * x + z * z); return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 }; };

type Tipo = 'mischia' | 'arco' | 'magia' | 'evoca' | 'cura' | null;
function tipoDi(v: RunHero | null): Tipo {
  if (!v) return null;
  if (v.manoMagia && v.magia !== null) { const sp = v.magie[v.magia]!; return sp.evoca ? 'evoca' : sp.cura || sp.furia ? 'cura' : 'magia'; }
  return v.arma.kind === 'arco' ? 'arco' : 'mischia';
}

/** Input e azione (o null) dell'eroe i adesso. */
export function botArena(d: DuelloState, i: number, rng: Rng): { input: DungeonInput; azione: ArenaAzione | null } {
  const s = d.s, me = s.eroi[i], lui = s.eroi[1 - i];
  if (!me || !lui || d.fase === 'finita' || me.done) return { input: { ...NO_DUNGEON_INPUT }, azione: null };
  const m = mem(d, i), h = me.hero, o = lui.hero, rt = d.rt[i]!, e = d.eroi[i]!;
  const dx = o.x - h.x, dz = o.z - h.z, dist = Math.sqrt(dx * dx + dz * dz), vede = lineOfSight(s.map, h.x, h.z, o.x, o.z);
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
  // movimento: verso di lui lungo il campo BFS, di lato ogni tanto quando si tira da lontano
  if (d.tick - m.latoT > 90) { m.latoT = d.tick; m.lato = rng.next() < 0.5 ? -1 : 1; }
  let mv = { x: 0, z: 0 };
  const lontano = tipo === 'mischia' ? rh.arma.portata + 0.2 : tipo === 'arco' ? 9 : 6;
  if (dist > lontano || !vede) mv = vai(d, m, h, o.x, o.z, rh.raggio);
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
