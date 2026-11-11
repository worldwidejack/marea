// Gladiatore automatico dell'Arena (allenamento, posti vuoti sul server, test): come l'autopilota dei dungeon, ma contro gli avversari e con
// in testa la modalità. Sceglie l'avversario più vicino che la sua squadra vede (chi sta nell'erba alta non lo vede: gli va incontro dove
// l'ha visto l'ultima volta), lo slot giusto per la distanza (mischia vicino, arco o magia lontano se lo vede), gli va incontro lungo il campo
// BFS, colpisce quando è in portata, tende l'arco fino in fondo, schiva (non sempre, come una persona) i caricati che stanno per partire e i
// proiettili in arrivo, mira davvero con arco e magie (con un po' d'anticipo se si muove), lancia l'ulti quando è piena e serve (ultiOra).
// Senza un avversario vicino fa la modalità: nella Sopravvivenza rompe le casse, raccoglie le monete rosse e sta lontano dalla nube; nel
// Controllo va nella zona aperta più vicina e ci resta; fra i Rapinatori chi attacca va a colpire la cassaforte avversaria e chi difende (il
// terzo della squadra, o nel 2 contro 2 il secondo quando un avversario è vicino alla sua) resta accanto alla propria; nella Caccia alle
// stelle cerca gli avversari. Non tocca lo stato della partita: la sua memoria sta in una WeakMap e quello che fa passa da input e azioni,
// registrati come quelli di un giocatore.
import { ARENA, arenaMappa, arenaUlti } from '@marea/content/arena.ts';
import type { Rng } from '../rng.ts';
import type { DungeonInput } from '../dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../dungeon/types.ts';
import type { RunHero } from '../rpg/types.ts';
import { visibileDa } from '../dungeon/erba.ts';
import { bfs, cellCenter, cellOf, clearPath, lineOfSight, stepDown } from '../dungeon/map.ts';
import { aimIndex } from '../dungeon/mira.ts';
import { portataIndex } from '../dungeon/portata.ts';
import type { ArenaAzione, PartitaState } from './partita.ts';
import { partenza } from './partita.ts';
import { lungoRaggio } from './ulti.ts';

type Punto = { x: number; z: number };
type Mem = { field: Int32Array; goal: number; fieldT: number; prevA: boolean; tieni: number; lato: number; latoT: number; slotT: number; visto: Punto | null; giro: number; prima: Punto | null };
const MEM = new WeakMap<PartitaState, Mem[]>();
function mem(d: PartitaState, i: number): Mem {
  let all = MEM.get(d);
  if (!all) { all = []; MEM.set(d, all); }
  return (all[i] ??= { field: new Int32Array(d.s.map.w * d.s.map.h), goal: -1, fieldT: -999, prevA: false, tieni: 0, lato: 1, latoT: 0, slotT: 0, visto: null, giro: 0, prima: null });
}
const norm = (x: number, z: number) => { const l = Math.sqrt(x * x + z * z); return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 }; };
const dist2 = (a: Punto, b: Punto) => (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);

type Tipo = 'mischia' | 'arco' | 'magia' | 'evoca' | 'cura' | null;
/** Da dove scappare adesso (direzione della schivata), o null: un avversario vicino che sta per colpire (caricato quasi pieno o colpo appena
 *  partito) o un suo proiettile che sta per arrivare. */
function minaccia(d: PartitaState, i: number): { x: number; z: number } | null {
  const s = d.s, h = s.eroi[i]!.hero;
  for (let j = 0; j < s.eroi.length; j++) {
    const r = s.eroi[j]!, o = r.hero;
    if (d.squadre[j] === d.squadre[i] || r.done) continue;
    const dx = h.x - o.x, dz = h.z - o.z, dist = Math.sqrt(dx * dx + dz * dz), via = dist > 1e-6 ? { x: dx / dist, z: dz / dist } : { x: 1, z: 0 };
    if (o.act === 'carica' && o.carica > 0.7 && dist < r.runHero.arma.portata + 1.2) return via;
    if (o.act === 'swing' && o.actT < 5 && o.caricato && dist < r.runHero.arma.portata + 0.6) return via;
  }
  for (const p of s.proj) {
    if (p.da === undefined || d.squadre[p.da] === d.squadre[i]) continue;
    const v2 = p.vx * p.vx + p.vz * p.vz;
    if (v2 < 1e-6) continue;
    const rx = h.x - p.x, rz = h.z - p.z, t = (rx * p.vx + rz * p.vz) / v2;
    if (t < 0 || t > 0.35) continue;
    const cx = rx - p.vx * t, cz = rz - p.vz * t;
    if (cx * cx + cz * cz < 0.8 * 0.8) { const l = Math.sqrt(v2), lato = cx * -p.vz + cz * p.vx >= 0 ? 1 : -1; return { x: (-p.vz / l) * lato, z: (p.vx / l) * lato }; }
  }
  return null;
}
/** L'ulti piena serve adesso? Furia e Aura vicino all'avversario (l'Aura anche sotto metà vita), Scatto e Velo per andargli incontro o
 *  scappare, il Raggio e l'Arpione se è davanti, dritto e in portata. */
function ultiOra(d: PartitaState, i: number, dist: number, vede: boolean, dx: number, dz: number): boolean {
  const u = d.ul[i]!, h = d.s.eroi[i]!.hero, rh = d.s.eroi[i]!.runHero, U = arenaUlti(u.id);
  if (u.carica < 100 || u.fase !== 'no' || !vede) return false;
  if (u.id === 'furia') return dist < 3.5;
  if (u.id === 'aura') return dist < 5 || h.vita < rh.max.vita * 0.5;
  if (u.id === 'scatto' || u.id === 'velo') return dist > 6 || h.vita < rh.max.vita * 0.4;
  const l = Math.max(1e-6, dist), lungo = lungoRaggio(d.s, h.x, h.z, dx / l, dz / l, U.gittata ?? 10);
  return dist < (U.gittata ?? 10) - 1 && lungo >= dist - 0.5;
}
function tipoDi(v: RunHero | null): Tipo {
  if (!v) return null;
  if (v.manoMagia && v.magia !== null) { const sp = v.magie[v.magia]!; return sp.evoca ? 'evoca' : sp.cura || sp.furia ? 'cura' : 'magia'; }
  return v.arma.kind === 'arco' ? 'arco' : 'mischia';
}

/** L'avversario più vicino a `i` che la sua squadra vede, entro `max` m (null = nessuno: tutti a terra, nell'erba alta o lontani). */
function bersaglio(d: PartitaState, i: number, max: number): number | null {
  const s = d.s, h = s.eroi[i]!.hero;
  let out: number | null = null, best = max * max;
  for (let j = 0; j < s.eroi.length; j++) {
    const o = s.eroi[j]!;
    if (d.squadre[j] === d.squadre[i] || o.done || !visibileDa(s, j, d.squadre[i]!)) continue;
    const q = dist2(o.hero, h);
    if (q < best) { best = q; out = j; }
  }
  return out;
}

/** Cosa fare senza un avversario vicino: dove andare, la cosa da colpire lì (una cassa, la cassaforte avversaria) e quanto stargli attorno. */
type Meta = { p: Punto; colpo: Punto | null; resta: number };
function meta(d: PartitaState, i: number, m: Mem, h: Punto): Meta {
  const s = d.s, q = d.squadre[i]!, k = i - d.squadre.indexOf(q), tile = s.map.tile, viva = (id: number) => s.enemies.find((e) => e.id === id && e.st !== 'morto');
  const c = { x: (s.map.w * tile) / 2, z: (s.map.h * tile) / 2 };
  if (d.modo === 'sopravvivenza') {
    const dentro = (p: Punto) => dist2(p, c) < (d.nube - 2.5) * (d.nube - 2.5);
    const mucchio = d.mucchi.filter(dentro).sort((a, b) => dist2(a, h) - dist2(b, h))[0];
    if (mucchio && dist2(mucchio, h) < 14 * 14) return { p: mucchio, colpo: null, resta: 0 };
    const cassa = d.casse.map(viva).filter((e): e is NonNullable<typeof e> => !!e && dentro(e)).sort((a, b) => dist2(a, h) - dist2(b, h))[0];
    if (cassa) return { p: cassa, colpo: cassa, resta: 0 };
  }
  if (d.modo === 'controllo') {
    const z = d.zone.filter((x) => x.di < 0).sort((a, b) => dist2(a, h) - dist2(b, h))[0];
    if (z) return { p: z, colpo: null, resta: 2 };
  }
  if (d.modo === 'rapina') {
    const mia = viva(d.casseforti[q]!), sua = viva(d.casseforti[1 - q]!);
    const minacciata = !!mia && d.s.eroi.some((r, j) => d.squadre[j] !== q && !r.done && dist2(r.hero, mia) < 9 * 9);
    if (mia && (k === 2 || (k === 1 && minacciata))) return { p: mia, colpo: null, resta: 4 };
    if (sua) return { p: sua, colpo: sua, resta: 0 };
  }
  // l'ultimo punto dove ha visto un avversario, se no la partenza di un'altra squadra e poi il centro
  if (m.visto && dist2(m.visto, h) < 1.5 * 1.5) m.visto = null; // arrivato: non c'è più
  if (m.visto) return { p: m.visto, colpo: null, resta: 0 };
  const [cx, cz] = partenza(arenaMappa(d.mappa), d.nSquadre, d.per, (q + 1) % d.nSquadre, k);
  const tappe: Punto[] = [{ x: (cx + 0.5) * tile, z: (cz + 0.5) * tile }, c];
  if (dist2(tappe[m.giro % tappe.length]!, h) < 4) m.giro++;
  return { p: tappe[m.giro % tappe.length]!, colpo: null, resta: d.modo === 'sopravvivenza' ? 3 : 0 };
}

/** Input e azione (o null) dell'eroe i adesso. */
export function botArena(d: PartitaState, i: number, rng: Rng): { input: DungeonInput; azione: ArenaAzione | null } {
  const s = d.s, me = s.eroi[i];
  if (!me || d.fase === 'finita' || me.done) return { input: { ...NO_DUNGEON_INPUT }, azione: null };
  const m = mem(d, i), h = me.hero, rt = d.rt[i]!, e = d.eroi[i]!;
  // l'avversario: solo se è vicino quando c'è qualcosa da fare per la modalità, se no il più vicino che si vede; chi va alla cassaforte
  // avversaria si ferma solo per chi gli capita davanti, e sotto la cassaforte solo per chi gli sta addosso
  const vicina = d.modo === 'rapina' ? meta(d, i, m, h) : null, sotto = !!vicina?.colpo && dist2(vicina.colpo, h) < 6 * 6;
  const j = bersaglio(d, i, d.modo === 'stelle' ? Infinity : sotto ? 2.5 : vicina?.colpo ? 4.5 : 9), lui = j === null ? null : s.eroi[j]!;
  const mt = lui ? null : vicina ?? meta(d, i, m, h);
  const o: Punto | null = lui?.hero ?? mt?.colpo ?? null;
  // quanto si è mosso l'avversario dall'ultimo tick (per l'anticipo della mira)
  const vx = lui && m.prima ? (lui.hero.x - m.prima.x) * 60 : 0, vz = lui && m.prima ? (lui.hero.z - m.prima.z) * 60 : 0;
  m.prima = lui ? { x: lui.hero.x, z: lui.hero.z } : null;
  if (lui) m.visto = { x: lui.hero.x, z: lui.hero.z };
  const dx = o ? o.x - h.x : 0, dz = o ? o.z - h.z : 0, dist = o ? Math.sqrt(dx * dx + dz * dz) : Infinity, vede = !!o && lineOfSight(s.map, h.x, h.z, o.x, o.z);
  // l'ulti, quando serve (contro un avversario): prima si gira verso di lui (il raggio e l'arpione partono dritti davanti)
  if (lui && d.fase === 'gioca' && ultiOra(d, i, dist, vede, dx, dz)) {
    const l = Math.max(1e-6, dist);
    if ((h.fx * dx + h.fz * dz) / l > 0.97) return { input: { ...NO_DUNGEON_INPUT }, azione: { t: 'ulti' } };
    return { input: { ...NO_DUNGEON_INPUT, mx: (dx / l) * 0.2, my: (dz / l) * 0.2 }, azione: null };
  }
  // raggio della Marea in corso: lo tiene su di lui
  if (d.ul[i]!.fase !== 'no' && d.ul[i]!.id === 'marea' && o) return { input: { ...NO_DUNGEON_INPUT, mx: dx, my: dz }, azione: null };
  // la schivata: costa Vigore, la si tiene per quando serve (riflessi umani: non sempre in tempo)
  if (d.fase === 'gioca' && h.act !== 'schiva' && !((h.rollCd ?? 0) > 0) && h.stamina >= ARENA.build.staminaSchivata) {
    const fuga = minaccia(d, i);
    if (fuga && rng.next() < 0.15) return { input: { ...NO_DUNGEON_INPUT, mx: fuga.x, my: fuga.z, roll: true }, azione: null };
  }
  // lo slot giusto per la distanza (non più di uno al secondo)
  if (d.tick - m.slotT > 60) {
    const tipi = e.varianti.map(tipoDi), ok = (t: Tipo, n: number) => tipi[n] === t && (t !== 'arco' || (rt.frecce[n] ?? 0) > 0 || n === rt.slot && h.frecce > 0);
    const cerca = (...ts: Tipo[]) => { for (const t of ts) for (let n = 0; n < tipi.length; n++) if (ok(t, n)) return n; return -1; };
    const vuole = dist > 4.5 && vede ? cerca('arco', 'magia', 'mischia') : cerca('mischia', 'magia', 'arco');
    if (vuole >= 0 && vuole !== rt.slot) { m.slotT = d.tick; return { input: { ...NO_DUNGEON_INPUT }, azione: { t: 'slot', n: vuole } }; }
  }
  if (d.fase !== 'gioca') return { input: { ...NO_DUNGEON_INPUT }, azione: null };
  const tipo = tipoDi(e.varianti[rt.slot] ?? null), rh = me.runHero;
  const sp = rh.magia !== null ? rh.magie[rh.magia] : undefined;
  const puoTirare = vede || (!!o && sp?.forma === 'bomba');
  // movimento: verso di lui (o la cosa da colpire) lungo il campo BFS; senza niente da colpire verso la meta (e lì ci gira attorno);
  // di lato ogni tanto quando si tira da lontano
  if (d.tick - m.latoT > 90) { m.latoT = d.tick; m.lato = rng.next() < 0.5 ? -1 : 1; }
  let mv = { x: 0, z: 0 };
  const lontano = tipo === 'mischia' ? rh.arma.portata + 0.2 + (lui ? 0 : 0.6) : tipo === 'arco' ? 9 : 6;
  if (!o && mt) {
    if (dist2(mt.p, h) > mt.resta * mt.resta) mv = vai(d, m, h, mt.p.x, mt.p.z, rh.raggio);
    else { const u = norm(mt.p.x - h.x + m.lato * 0.7, mt.p.z - h.z - m.lato * 0.7); mv = { x: -u.z * m.lato * 0.5, z: u.x * m.lato * 0.5 }; }
  } else if (o && (dist > lontano || !puoTirare)) mv = vai(d, m, h, o.x, o.z, rh.raggio);
  else if (o && tipo !== 'mischia') { const u = norm(dx, dz); mv = { x: -u.z * m.lato * 0.6, z: u.x * m.lato * 0.6 }; }
  else if (o && !lui) mv = { x: (dx / Math.max(1e-6, dist)) * 0.15, z: (dz / Math.max(1e-6, dist)) * 0.15 }; // davanti alla cassa: girato verso di lei
  // Sopravvivenza: via dalla nube prima di tutto
  if (d.modo === 'sopravvivenza') {
    const c = { x: (s.map.w * s.map.tile) / 2, z: (s.map.h * s.map.tile) / 2 };
    if (dist2(h, c) > (d.nube - 1.5) * (d.nube - 1.5)) mv = vai(d, m, h, c.x, c.z, rh.raggio);
  }
  // attacco: mischia in portata a colpi brevi (ogni tanto caricati), arco teso fino in fondo, magia a colpo singolo o raggio tenuto
  let a = false;
  if (puoTirare) {
    if (tipo === 'mischia' && dist <= rh.arma.portata + rh.raggio + 0.3 + (lui ? 0 : 0.4)) {
      if (m.tieni <= 0 && h.act === 'idle' && !m.prevA) m.tieni = lui && rng.next() < 0.25 ? Math.round(rh.arma.carica * 60) + 6 : 2;
    } else if (tipo === 'arco' && dist < 16 && h.frecce > 0) a = h.act !== 'tende' ? !m.prevA : h.carica < 1;
    else if ((tipo === 'magia' || tipo === 'evoca') && dist < (tipo === 'evoca' ? 12 : 9)) {
      if (sp && h.magicka >= sp.costo) a = sp.forma === 'raggio' ? dist < (sp.gittata ?? 5) : h.act !== 'punta' ? !m.prevA : false;
    } else if (tipo === 'cura' && h.vita < rh.max.vita * 0.8) a = !m.prevA;
  }
  if (m.tieni > 0) { m.tieni--; a = true; }
  m.prevA = a;
  // con l'arco o una magia la mira va su di lui, a metà dell'anticipo giusto (un umano medio)
  let mira = 0, portata = 0;
  if (o && puoTirare && (tipo === 'arco' || tipo === 'magia') && (a || h.act === 'tende' || h.act === 'punta')) {
    const v = tipo === 'arco' ? Math.max(8, rh.arma.gittata + (rh.frecce?.gittata ?? 0)) : sp?.forma === 'bomba' ? dist / Math.max(0.2, sp.volo ?? 1) : sp?.forma === 'raggio' ? 1e9 : Math.max(6, sp?.velocita ?? 12);
    const t = (dist / v) * 0.5, tx = o.x + vx * t - h.x, tz = o.z + vz * t - h.z;
    mira = aimIndex(tx, tz);
    if (sp?.forma === 'bomba') portata = portataIndex(Math.sqrt(tx * tx + tz * tz), sp.gittata ?? 9); // la bomba la tira dove prevede che sarà, come una persona
  }
  return { input: { mx: mv.x, my: mv.z, a, b: lui !== null && dist > 8 && tipo === 'mischia' && h.stamina > 30, c: false, d: false, ...(mira ? { m: mira } : {}), ...(mira && portata ? { p: portata } : {}) }, azione: null };
}

/** Direzione verso (gx, gz): dritto se il corridoio è libero, se no lungo il campo BFS dalla meta (rifatto ogni mezzo secondo). */
function vai(d: PartitaState, m: Mem, h: { x: number; z: number }, gx: number, gz: number, r: number): { x: number; z: number } {
  const map = d.s.map;
  if (clearPath(map, h.x, h.z, gx, gz, r + 0.05)) return norm(gx - h.x, gz - h.z);
  const goal = cellOf(map, gx, gz);
  if (goal !== m.goal || d.tick - m.fieldT > 30) { bfs(map, goal, m.field); m.goal = goal; m.fieldT = d.tick; }
  const here = cellOf(map, h.x, h.z), n1 = here >= 0 ? stepDown(map, m.field, here) : -1;
  if (n1 < 0) return norm(gx - h.x, gz - h.z);
  const c = cellCenter(map, n1);
  return norm(c.x - h.x, c.z - h.z);
}
