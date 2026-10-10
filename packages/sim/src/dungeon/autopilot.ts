// Pilota automatico (test e modalità demo): esplora verso nemici e bottini vicini, combatte schivando i colpi telegrafati,
// beve sotto il 35 % di vita, torna alla scala quando non c'è più niente (o lo zaino è pieno, o il tempo stringe) e preme A.
// Drenaggio: gira le valvole chiuse che raggiunge (come un bottino) e non combatte chi sta oltre l'acqua. Archivio: gira i timoni allo
// stesso modo, combatte chi sta sulle grate solo se ci arriva con l'arma, e con un'arma da mischia aspetta che chi vola scenda.
// Fucina: aspetta la crosta prima di mettere piede sulla lava (e sopra corre), gira alle spalle del Golem-Palombaro, e col Mastro
// Forgiatore acceso si mette con una cascata tra sé e lui finché la carica non lo spegne; spento, gli va addosso.
// Mausoleo: aspetta che la lancetta passi prima di entrare nel suo giro (dentro, corre), gira alle spalle della Sentinella come del
// Palombaro, e col Custode corre nel varco dell'ondata (o dietro una colonna), si toglie da dove ricompare con lo scatto e non lo colpisce
// mentre cambia cuore.
// Non tocca lo stato della sim: la sua memoria sta in una WeakMap (il replay non la vede).
import type { Rng } from '../rng.ts';
import type { DungeonInput } from './types.ts';
import { NO_DUNGEON_INPUT } from './types.ts';
import type { DungeonState, Enemy } from './state.ts';
import { parte } from './state.ts';
import { bfs, cellCenter, cellOf, clearPath, lineOfSight, stepDown } from './map.ts';
import { fits, pesoZaino } from './loot.ts';
import { vicinoUscita } from './hero.ts';
import { valvolaVicina } from './acque.ts';
import { timoneVicino } from './vento.ts';
import { alto } from './muove.ts';
import { areaRaggio } from './enemies.ts';
import { inGetto, statoLava } from './fuoco.ts';
import { lancettaDir } from './onde.ts';
import { varchiDi } from './custode.ts';
import { GEYSER_DIR, HZ } from './tuning.ts';

type Mem = {
  field: Int32Array; fieldGoal: number; fieldTick: number;
  heroField: Int32Array; heroFieldTick: number;
  prevA: boolean; prevC: boolean; prevD: boolean;
  goal: string; anchorX: number; anchorZ: number; anchorTick: number;
  ban: Map<string, number>;
  /** Fucina: fermo davanti alla lava che scorre (non conta come bloccato). */
  aspetta: boolean;
};
/** Una memoria per eroe (insieme ognuno ha il suo pilota). */
const MEM = new WeakMap<DungeonState, Map<number, Mem>>();
function mem(s: DungeonState): Mem {
  let all = MEM.get(s);
  if (!all) { all = new Map(); MEM.set(s, all); }
  let m = all.get(s.cur);
  if (!m) {
    const n = s.map.w * s.map.h;
    m = { field: new Int32Array(n), fieldGoal: -2, fieldTick: -999, heroField: new Int32Array(n), heroFieldTick: -999, prevA: false, prevC: false, prevD: false, goal: '', anchorX: s.hero.x, anchorZ: s.hero.z, anchorTick: s.tick, ban: new Map(), aspetta: false };
    all.set(s.cur, m);
  }
  return m;
}

type Out = { mx: number; my: number; a: boolean; b: boolean; c: boolean; d: boolean };
const norm = (dx: number, dz: number): { x: number; z: number } => {
  const d = Math.sqrt(dx * dx + dz * dz);
  return d > 1e-6 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
};

/** Fucina: dall'asciutto, il prossimo passo lungo (dx, dz) mette piede su una colata che scorre, sta per scorrere o ha la crosta ancora
 *  per poco (non basta a passare): meglio aspettare. Già sopra la lava si va avanti. */
function lavaDavanti(s: DungeonState, dx: number, dz: number): boolean {
  const h = s.hero, m = s.map;
  if (m.lava[cellOf(m, h.x, h.z)]) return false;
  for (const k of [0.5, 1.1]) {
    const i = cellOf(m, h.x + dx * k, h.z + dz * k), n = i >= 0 ? m.lava[i]! : 0;
    if (!n) continue;
    const v = m.lave.find((l) => l.n === n)!, st = statoLava(s, v);
    return st.stato !== 'crosta' || (1 - st.t) * v.crosta < 1.7;
  }
  return false;
}

/** Direzione verso un punto: dritto se il corridoio è libero, altrimenti lungo il campo BFS dalla meta. null = irraggiungibile. Fucina:
 *  davanti alla lava che scorre (0, 0): si aspetta la crosta. */
function nav(s: DungeonState, m: Mem, gx: number, gz: number): { x: number; z: number } | null {
  const v = navDir(s, m, gx, gz);
  m.aspetta = !!v && ((s.map.lave.length > 0 && lavaDavanti(s, v.x, v.z)) || (s.map.lancette.length > 0 && lancettaDavanti(s, v.x, v.z)));
  return m.aspetta ? { x: 0, z: 0 } : v;
}

/** Mausoleo: in (x, z) passa una lancetta entro `sec` secondi (con un po' di margine). */
function lancettaSu(s: DungeonState, x: number, z: number, sec: number): boolean {
  const r = s.runHero.raggio + 0.35;
  for (const l of s.map.lancette) {
    const rx = x - l.x, rz = z - l.z;
    if (rx * rx + rz * rz > (l.lunga + r) * (l.lunga + r)) continue;
    for (let t = 0; t <= sec * HZ; t += 6) {
      const [dx, dz] = lancettaDir(l, s.tick + t), lungo = rx * dx + rz * dz;
      if (lungo >= -r && lungo <= l.lunga + r && Math.abs(rx * dz - rz * dx) <= l.largo + r) return true;
    }
  }
  return false;
}
/** Mausoleo: dal sicuro, il prossimo passo lungo (dx, dz) finisce dove la lancetta sta per passare: meglio aspettare. Già in pericolo si
 *  va avanti (fermarsi lì è peggio). */
function lancettaDavanti(s: DungeonState, dx: number, dz: number): boolean {
  const h = s.hero;
  if (lancettaSu(s, h.x, h.z, 0.5)) return false;
  return lancettaSu(s, h.x + dx * 1.3, h.z + dz * 1.3, 1.7);
}

/** Mausoleo, il Custode: dove mettersi per l'ondata (che sta per partire o è in corsa): nel varco più vicino alla stessa distanza da lui,
 *  o restare fermi se già nel varco o dietro una colonna. null = nessuna ondata da schivare. */
function schivaOnda(s: DungeonState, e: Enemy): { x: number; z: number } | null {
  const h = s.hero, onde = s.onde.map((o) => ({ x: o.x, z: o.z, r: o.r, max: o.max, varchi: o.varchi, largo: o.largo }));
  if (e.st === 'prepara' && e.modo === 'ondata' && e.def.custode) onde.push({ x: e.x, z: e.z, r: 0, max: e.def.custode.ondata.raggio, varchi: varchiDi(e), largo: e.def.custode.ondata.largo });
  for (const o of onde) {
    const dx = h.x - o.x, dz = h.z - o.z, d = Math.sqrt(dx * dx + dz * dz);
    if (o.r > d + 1 || d > o.max + 1 || d < 1e-6) continue; // già passata o non arriva
    if (!lineOfSight(s.map, o.x, o.z, h.x, h.z)) return { x: h.x, z: h.z };
    let best: { x: number; z: number } | null = null, bd = Infinity;
    for (const [vx, vz] of o.varchi) {
      if ((dx * vx + dz * vz) / d >= o.largo + 0.02) return { x: h.x, z: h.z };
      const k = Math.max(d, 3), x = o.x + vx * k, z = o.z + vz * k, c = cellOf(s.map, x, z);
      if (c < 0 || s.map.solid[c]) continue;
      const q = (x - h.x) * (x - h.x) + (z - h.z) * (z - h.z);
      if (q < bd) { bd = q; best = { x, z }; }
    }
    if (best) return best;
  }
  return null;
}
function navDir(s: DungeonState, m: Mem, gx: number, gz: number): { x: number; z: number } | null {
  const h = s.hero, r = s.runHero.raggio + 0.05;
  if (clearPath(s.map, h.x, h.z, gx, gz, r)) return norm(gx - h.x, gz - h.z);
  const goal = cellOf(s.map, gx, gz);
  if (goal !== m.fieldGoal || s.tick - m.fieldTick > 120) { bfs(s.map, goal, m.field); m.fieldGoal = goal; m.fieldTick = s.tick; }
  const here = cellOf(s.map, h.x, h.z);
  if (here < 0 || m.field[here]! < 0) return null;
  const n1 = stepDown(s.map, m.field, here);
  if (n1 < 0) return norm(gx - h.x, gz - h.z);
  const n2 = stepDown(s.map, m.field, n1);
  const p = n2 >= 0 && clearPath(s.map, h.x, h.z, cellCenter(s.map, n2).x, cellCenter(s.map, n2).z, r) ? cellCenter(s.map, n2) : cellCenter(s.map, n1);
  return norm(p.x - h.x, p.z - h.z);
}

function heroField(s: DungeonState, m: Mem): Int32Array {
  if (s.tick - m.heroFieldTick >= 30) { bfs(s.map, cellOf(s.map, s.hero.x, s.hero.z), m.heroField); m.heroFieldTick = s.tick; }
  return m.heroField;
}

/** Combattimento contro `e`: schiva i colpi in preparazione, si avvicina, attacca (mischia, arco o magia). */
function fight(s: DungeonState, m: Mem, e: Enemy, o: Out): void {
  const h = s.hero, rh = s.runHero, a = h.arma;
  const dx = e.x - h.x, dz = e.z - h.z, d = Math.sqrt(dx * dx + dz * dz), u = norm(dx, dz);
  const vede = lineOfSight(s.map, h.x, h.z, e.x, e.z);
  // magia: distruzione se vede il bersaglio, evocazione se non c'è già un alleato
  const sp = rh.magia !== null ? rh.magie[rh.magia] : undefined, acceso = !!e.def.forgiatore && !e.spento;
  if (sp && h.act === 'idle' && h.cdMagia === 0 && h.magicka >= sp.costo && !m.prevC && vede && d < 14 && !(acceso && sp.scuola === 'distruzione')) {
    const alleato = s.enemies.some((x) => x.alleato && x.st !== 'morto' && (x.padrone ?? 0) === s.cur);
    if (sp.scuola === 'distruzione' || !alleato) { o.c = true; o.mx = u.x * 0.2; o.my = u.z * 0.2; return; }
  }
  // Mausoleo, il Custode: l'ondata si prende nel varco, lo scatto si schiva, mentre cambia cuore non si colpisce
  if (e.def.custode) {
    const p = schivaOnda(s, e);
    if (p) {
      const ex = p.x - h.x, ez = p.z - h.z;
      if (ex * ex + ez * ez > 0.09) { const v = nav(s, m, p.x, p.z); if (v) { o.mx = v.x; o.my = v.z; o.b = true; } }
      return;
    }
    if (e.st === 'prepara' && e.modo === 'scatto' && e.mira) {
      const mx = e.x + e.mira.dx * e.mira.len, mz = e.z + e.mira.dz * e.mira.len, ax = h.x - mx, az = h.z - mz, ad = Math.sqrt(ax * ax + az * az);
      if (ad < e.def.custode.scatto.raggio + 1.2) {
        const u2 = ad > 1e-6 ? { x: ax / ad, z: az / ad } : { x: -h.fx, z: -h.fz }, v = nav(s, m, h.x + u2.x * 3, h.z + u2.z * 3) ?? u2;
        o.mx = v.x; o.my = v.z; o.b = true;
        return;
      }
    }
    if (e.modo === 'cambio') { if (d < 4) { const v = nav(s, m, h.x - u.x * 3, h.z - u.z * 3); if (v) { o.mx = v.x; o.my = v.z; } } return; }
  }
  // schivata: il nemico sta per colpire e siamo nel suo raggio → via (correndo se il colpo è ad area)
  if (e.st === 'prepara' && !e.tiro && (h.act === 'idle' || h.act === 'press')) {
    const raggio = e.area ? areaRaggio(e.def) + rh.raggio + 0.6 : e.def.portata + e.def.raggio + rh.raggio + 0.6;
    if (d < raggio) {
      const back = nav(s, m, h.x - u.x * 3, h.z - u.z * 3) ?? { x: -u.x, z: -u.z };
      o.mx = back.x; o.my = back.z; o.b = e.area;
      return;
    }
  }
  // Fucina: il Mastro acceso non si colpisce, si aspetta la sua carica con una cascata in mezzo
  if (acceso) {
    const p = esca(s, e);
    if (!p) return;
    const ex = p.x - h.x, ez = p.z - h.z;
    if (ex * ex + ez * ez > 0.16) { const v = nav(s, m, p.x, p.z); if (v) { o.mx = v.x; o.my = v.z; o.b = true; } }
    return;
  }
  // il Golem-Palombaro e la Sentinella (finché lo scudo regge) parano da davanti: prima di lato, poi alle spalle
  if ((e.def.scafandro || (e.def.scudo && !(e.rotto !== undefined && e.rotto > s.tick))) && d > 1e-6) {
    const k = (-dx * e.fx - dz * e.fz) / d;
    if (k > -0.3) {
      const r = e.def.raggio + rh.raggio + Math.min(a.portata, 1.8) * 0.7, lato = -dx * -e.fz + -dz * e.fx >= 0 ? 1 : -1;
      const tx = k > 0.4 ? e.x - e.fz * lato * r * 1.3 : e.x - e.fx * r, tz = k > 0.4 ? e.z + e.fx * lato * r * 1.3 : e.z - e.fz * r;
      const v = nav(s, m, tx, tz);
      if (v) { o.mx = v.x; o.my = v.z; o.b = true; }
      return;
    }
  }
  // chi vola alto: con la mischia gli si sta sotto e si aspetta che scenda
  if (a.kind !== 'arco' && alto(s, e)) {
    if (d > a.portata) { const v = nav(s, m, e.x, e.z); if (v) { o.mx = v.x; o.my = v.z; } }
    return;
  }
  if (a.kind === 'arco') {
    if (h.frecce <= 0) return;
    if (!vede || d > 14) { const v = nav(s, m, e.x, e.z); if (v) { o.mx = v.x; o.my = v.z; } return; }
    if (h.act === 'tende') { o.a = h.carica < 1; o.mx = u.x * 0.15; o.my = u.z * 0.15; return; }
    if (h.act === 'idle' && !m.prevA) { o.a = true; o.mx = u.x * 0.15; o.my = u.z * 0.15; }
    return;
  }
  const reach = a.portata + e.def.raggio - 0.15;
  if (d > reach || !vede) { const v = nav(s, m, e.x, e.z); if (v) { o.mx = v.x; o.my = v.z; } return; }
  // attacco normale: premi un tick, rilascia il successivo (lo swing parte al rilascio)
  if (h.act === 'idle' && !m.prevA) { o.a = true; o.mx = u.x * 0.15; o.my = u.z * 0.15; }
}

/** Fucina: in (x, z) scotta (lava che scorre o sta per scorrere, chiazza di fuoco, palla di magma in arrivo). */
function scotta(s: DungeonState, x: number, z: number): boolean {
  const m = s.map, i = cellOf(m, x, z), n = i >= 0 ? m.lava[i]! : 0, r = s.runHero.raggio;
  if (n) { const v = m.lave.find((l) => l.n === n)!, st = statoLava(s, v); if (st.stato !== 'crosta' || (1 - st.t) * v.crosta < 0.6) return true; }
  for (const f of s.fuochi) { const dx = x - f.x, dz = z - f.z, rr = f.r + r; if (dx * dx + dz * dz < rr * rr) return true; }
  for (const g of s.geyser) { if (!g.magma || g.t > g.avviso) continue; const dx = x - g.x, dz = z - g.z, rr = g.r + r; if (dx * dx + dz * dz < rr * rr) return true; }
  return false;
}
/** Fucina: se sotto i piedi scotta, la direzione verso il posto sicuro più vicino (null = va bene così, o non c'è dove andare). */
function viaDalFuoco(s: DungeonState): { x: number; z: number } | null {
  const h = s.hero, r = s.runHero.raggio;
  if (!scotta(s, h.x, h.z)) return null;
  for (const k of [1.2, 2.2, 3.2]) for (const [dx, dz] of GEYSER_DIR) {
    const x = h.x + dx * k, z = h.z + dz * k;
    if (!scotta(s, x, z) && clearPath(s.map, h.x, h.z, x, z, r)) return { x: dx, z: dz };
  }
  return null;
}

/** Fucina: il posto dove aspettare la carica del Mastro: una cascata in mezzo tra lui e noi, un passo oltre (il più vicino a noi). */
function esca(s: DungeonState, e: Enemy): { x: number; z: number } | null {
  const h = s.hero, m = s.map;
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (const g of m.getti) {
    const gx = g.x - e.x, gz = g.z - e.z, gl = Math.sqrt(gx * gx + gz * gz);
    if (gl < 2.5) continue; // ci sta già accanto: non ci passerebbe correndo
    const x = g.x + (gx / gl) * 1.9, z = g.z + (gz / gl) * 1.9, c = cellOf(m, x, z);
    if (c < 0 || m.solid[c] || m.getto[c] || m.lava[c] || inGetto(s, x, z, s.runHero.raggio)) continue;
    if (!clearPath(m, e.x, e.z, x, z, e.def.raggio)) continue; // la carica deve arrivarci dritta
    const dx = x - h.x, dz = z - h.z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = { x, z }; }
  }
  return best;
}

export function autopilot(s: DungeonState, rng: Rng): DungeonInput {
  void rng;
  if (s.done) return { ...NO_DUNGEON_INPUT };
  const m = mem(s), h = s.hero, rh = s.runHero;
  const o: Out = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
  const finish = (): DungeonInput => { m.prevA = o.a; m.prevC = o.c; m.prevD = o.d; return o; };
  // tieni A mentre carichi o tendi (lo decide fight); altrimenti un tocco per volta
  if (h.vita < rh.max.vita * 0.35 && h.pozioni > 0 && h.act === 'idle' && !m.prevD) { o.d = true; return finish(); }
  // Fucina: prima di tutto, via da dove scotta
  if (s.map.lave.length || s.map.getti.length) { const v = viaDalFuoco(s); if (v) { o.mx = v.x; o.my = v.z; o.b = true; return finish(); } }
  for (const [k, until] of m.ban) if (until <= s.tick) m.ban.delete(k);
  const libero = rh.caricoMax - pesoZaino(s);
  const tempo = s.tick > 20 * 60 * HZ - 3 * 60 * HZ;
  const ritirata = h.vita < rh.max.vita * 0.25 && h.pozioni <= 0;
  const disarmato = h.arma.kind === 'arco' && h.frecce <= 0;
  // Drenaggio: accanto a una valvola chiusa la gira
  if (s.map.valvole.length && valvolaVicina(s) >= 0 && !m.prevA && h.act === 'idle') { o.a = true; return finish(); }
  // Archivio: accanto a un timone libero lo gira
  if (s.map.timoni.length && timoneVicino(s) >= 0 && !m.prevA && h.act === 'idle') { o.a = true; return finish(); }
  // minaccia: un ostile in aggro vicino, o uno che si vede da vicino (col Drenaggio non chi sta oltre l'acqua)
  const oltre = s.map.bacini.length || s.map.grate.length ? heroField(s, m) : null;
  let threat: Enemy | null = null, td = Infinity;
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto' || e.st === 'scappa') continue;
    if (oltre && e.def.muove !== 'vola' && (oltre[cellOf(s.map, e.x, e.z)] ?? -1) < 0) {
      // oltre l'acqua o sulle grate: solo se l'arma ci arriva da qui
      const rx = e.x - h.x, rz = e.z - h.z, r = h.arma.kind === 'arco' ? 14 : h.arma.portata + e.def.raggio - 0.15;
      if (rx * rx + rz * rz > r * r || !lineOfSight(s.map, h.x, h.z, e.x, e.z)) continue;
    }
    const dx = e.x - h.x, dz = e.z - h.z, d2 = dx * dx + dz * dz;
    if (d2 >= td) continue;
    if ((e.aggro && d2 < 14 * 14) || (d2 < 7 * 7 && lineOfSight(s.map, h.x, h.z, e.x, e.z))) { threat = e; td = d2; }
  }
  if (threat && !tempo && !ritirata && !disarmato) { fight(s, m, threat, o); m.goal = 'fight'; m.anchorTick = s.tick; return finish(); }
  // meta: il bottino o il nemico più vicino (per strada), poi la scala
  let goal = 'exit', gx = s.map.exit.x, gz = s.map.exit.z;
  if (!tempo && !ritirata && libero >= 0.5) {
    const f = heroField(s, m);
    let best = Infinity;
    for (const l of s.loot) {
      if (parte(s, l).vuoto || m.ban.has(`l${l.id}`) || !fits(s, l)) continue;
      const c = f[cellOf(s.map, l.x, l.z)] ?? -1;
      if (c >= 0 && c < best) { best = c; goal = `l${l.id}`; gx = l.x; gz = l.z; }
    }
    s.map.valvole.forEach((v, i) => {
      if (s.bacini.find((b) => b.n === v.n)?.aperta || m.ban.has(`v${i}`)) return;
      const c = f[cellOf(s.map, v.x, v.z)] ?? -1;
      if (c >= 0 && c < best) { best = c; goal = `v${i}`; gx = v.x; gz = v.z; }
    });
    s.map.timoni.forEach((t, i) => {
      if (s.correnti.find((c) => c.n === t.n)?.ferma || m.ban.has(`t${i}`)) return;
      const c = f[cellOf(s.map, t.x, t.z)] ?? -1;
      if (c >= 0 && c < best) { best = c; goal = `t${i}`; gx = t.x; gz = t.z; }
    });
    if (!disarmato)
      for (const e of s.enemies) {
        if (e.alleato || e.st === 'morto' || e.st === 'scappa' || m.ban.has(`e${e.id}`)) continue;
        const c = f[cellOf(s.map, e.x, e.z)] ?? -1;
        if (c >= 0 && c < best) { best = c; goal = `e${e.id}`; gx = e.x; gz = e.z; }
      }
  }
  // bloccati? se in 1,5 s non ci siamo mossi di 0,6 m, la meta va in castigo per 20 s
  if (goal !== m.goal) { m.goal = goal; m.anchorX = h.x; m.anchorZ = h.z; m.anchorTick = s.tick; }
  else if (m.aspetta) { m.anchorX = h.x; m.anchorZ = h.z; m.anchorTick = s.tick; } // fermo davanti alla lava: non è bloccato
  else if (s.tick - m.anchorTick >= 90) {
    const mx = h.x - m.anchorX, mz = h.z - m.anchorZ;
    if (mx * mx + mz * mz < 0.36 && goal !== 'exit') m.ban.set(goal, s.tick + 20 * HZ);
    m.anchorX = h.x; m.anchorZ = h.z; m.anchorTick = s.tick;
  }
  if (goal === 'exit' && vicinoUscita(s)) { o.a = !m.prevA; return finish(); }
  const v = nav(s, m, gx, gz);
  if (!v) { if (goal !== 'exit') m.ban.set(goal, s.tick + 20 * HZ); return finish(); }
  o.mx = v.x; o.my = v.z;
  // corre verso la scala o quando ha stamina in abbondanza (e sulla lava sempre, e dove gira una lancetta)
  o.b = goal === 'exit' ? h.stamina > 10 : h.stamina > rh.max.stamina * 0.6 || !!s.map.lava[cellOf(s.map, h.x, h.z)] || (s.map.lancette.length > 0 && lancettaSu(s, h.x, h.z, 1.5));
  return finish();
}
