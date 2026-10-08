// IA dei nemici e degli alleati evocati: dorme/veglia → aggro (vista + linea di vista), inseguimento col flow field, preparazione
// telegrafata → colpo → recupero; arcieri e maghi tengono la distanza e tirano; i boss alternano un colpo ad area; i deboli scappano dalle ossa.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, finita, inGioco, secToTicks } from './state.ts';
import { hitEnemy, hitHero, kill, wake } from './combat.ts';
import { bfs, cellCenter, cellOf, lineOfSight, moveCircle, stepDown } from './map.ts';
import {
  ALLEATO_SEGUE, BOSS_AREA_DANNO, BOSS_AREA_OGNI, BOSS_AREA_PREP, BOSS_AREA_RAGGIO, COLPISCE_TICKS, COS_CONO_NEMICO, DISTANZA_TIRATORI,
  FLOW_OGNI, MAGIA_Y, RAGGIO_ALLARME, RAGGIO_ATTIVO, TOLLERANZA_NEMICO, VISTA_DORMENDO,
} from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
/** Funzione (non confronto diretto): lo stato può cambiare dentro stepFoe/stepAlly. */
const vivo = (e: Enemy): boolean => e.st !== 'morto';

function refreshFlow(s: DungeonState): void {
  if (s.tick - s.flowTick < FLOW_OGNI) return;
  s.flowTick = s.tick;
  if (s.eroi.length === 1) {
    const c = cellOf(s.map, s.hero.x, s.hero.z);
    if (c === s.flowCell) return;
    s.flowCell = c;
    bfs(s.map, c, s.flow);
    return;
  }
  // insieme: verso l'eroe in gioco più vicino
  const celle = inGioco(s).map((i) => { const h = s.eroi[i]!.hero; return cellOf(s.map, h.x, h.z); });
  const key = celle.join(',');
  if (key === s.flowKey) return;
  s.flowKey = key;
  bfs(s.map, celle, s.flow);
}

/** Insieme: l'eroe che un nemico punta, il più vicino ancora in gioco (chi è appena risvegliato e protetto solo se non c'è nessun altro). */
function bersaglio(s: DungeonState, e: Enemy): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < s.eroi.length; i++) {
    const r = s.eroi[i]!;
    if (r.done) continue;
    const dx = r.hero.x - e.x, dz = r.hero.z - e.z, d = dx * dx + dz * dz + (r.hero.protetto > 0 ? 1e6 : 0);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
/** Un eroe in gioco entro `vista` e in linea di vista (da solo: l'eroe). */
function vedeEroe(s: DungeonState, e: Enemy, vista: number): boolean {
  for (const r of s.eroi) {
    if (r.done) continue;
    const dx = r.hero.x - e.x, dz = r.hero.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d <= vista && lineOfSight(s.map, e.x, e.z, r.hero.x, r.hero.z)) return true;
  }
  return false;
}

/** Passo verso l'eroe: diretto se lo vede ed è vicino, altrimenti lungo il flow field (aggira i muri). */
function chase(s: DungeonState, e: Enemy, speed: number, verso: 1 | -1): void {
  const h = s.hero;
  let tx = h.x, tz = h.z;
  const dx0 = h.x - e.x, dz0 = h.z - e.z, d0 = Math.sqrt(dx0 * dx0 + dz0 * dz0);
  if (verso === -1) {
    // scappa: verso la cella vicina più lontana dall'eroe sul campo
    const c = cellOf(s.map, e.x, e.z), cx = c % s.map.w, cz = (c - cx) / s.map.w;
    let best = -1, bd = s.flow[c] ?? -1;
    for (const [ddx, ddz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const j = (cz + ddz) * s.map.w + cx + ddx, v = s.flow[j] ?? -1;
      if (cx + ddx >= 0 && cx + ddx < s.map.w && v > bd) { bd = v; best = j; }
    }
    if (best < 0) return;
    const p = cellCenter(s.map, best); tx = p.x; tz = p.z;
  } else if (!(d0 < 4 && lineOfSight(s.map, e.x, e.z, h.x, h.z))) {
    const nx = stepDown(s.map, s.flow, cellOf(s.map, e.x, e.z));
    if (nx >= 0 && nx !== cellOf(s.map, e.x, e.z)) { const p = cellCenter(s.map, nx); tx = p.x; tz = p.z; }
  }
  moveToward(s, e, tx, tz, speed);
}
function moveToward(s: DungeonState, e: Enemy, tx: number, tz: number, speed: number): void {
  const dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  const step = Math.min(d, speed * DT);
  e.fx = dx / d; e.fz = dz / d;
  moveCircle(s.map, e, e.fx * step, e.fz * step, e.def.raggio);
}
function setState(e: Enemy, st: Enemy['st'], dur: number): void { e.st = st; e.stT = 0; e.stDur = dur; }

function startPrep(s: DungeonState, e: Enemy, tx: number, tz: number, tiro: boolean): void {
  const dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
  e.attacchi++;
  e.area = !tiro && !!e.def.boss && e.attacchi % BOSS_AREA_OGNI === 0;
  e.tiro = tiro;
  setState(e, 'prepara', secToTicks(e.def.preparazione * (e.area ? BOSS_AREA_PREP : 1)));
}

/** Fine preparazione contro l'eroe: colpo in mischia (se è ancora in portata e davanti), ad area, o proiettile. */
function resolveAttack(s: DungeonState, e: Enemy): void {
  const h = s.hero, rh = s.runHero;
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (e.tiro) {
    const p = e.def.proiettile!;
    e.tiro = false;
    e.cdTiro = secToTicks(p.ricarica);
    if (d < 1e-6) return;
    const mago = e.def.comportamento === 'mago' || e.def.comportamento === 'mischia';
    const vx = (dx / d) * p.velocita, vz = (dz / d) * p.velocita;
    s.proj.push({
      id: s.nextId++, tipo: mago ? 'magia_nemica' : 'freccia_nemica', x: e.x + e.fx * (e.def.raggio + 0.1), y: MAGIA_Y, z: e.z + e.fz * (e.def.raggio + 0.1),
      vx, vy: 0, vz, g: 0, danno: p.danno, life: secToTicks(p.gittata / p.velocita), traits: {}, raggio: 0, colpiti: [],
      dalNemico: true, contundente: false, magico: mago, arrowId: null,
    });
    return;
  }
  const kind = e.def.contundente ? 'contundente' : 'taglio';
  if (e.area) {
    if (s.eroi.length > 1) { areaSuTutti(s, e, kind); return; }
    if (d <= e.def.portata * BOSS_AREA_RAGGIO + rh.raggio) hitHero(s, e.def.danno * BOSS_AREA_DANNO, kind, h.x, h.z);
    else ev(s, { t: 'schivato', x: r2(h.x), z: r2(h.z) });
    return;
  }
  const dot = d > 1e-6 ? (dx * e.fx + dz * e.fz) / d : 1;
  if (d <= e.def.portata + e.def.raggio + rh.raggio + TOLLERANZA_NEMICO && dot >= COS_CONO_NEMICO) hitHero(s, e.def.danno, kind, h.x, h.z);
  else ev(s, { t: 'schivato', x: r2(h.x), z: r2(h.z) });
}

/** Insieme: il colpo ad area del boss prende tutti gli eroi nel cerchio; il bersaglio, se è fuori, l'ha schivato. */
function areaSuTutti(s: DungeonState, e: Enemy, kind: 'taglio' | 'contundente'): void {
  const t = s.cur;
  let preso = false;
  for (const i of inGioco(s)) {
    conEroe(s, i, () => {
      const h = s.hero, dx = h.x - e.x, dz = h.z - e.z;
      if (Math.sqrt(dx * dx + dz * dz) > e.def.portata * BOSS_AREA_RAGGIO + s.runHero.raggio) return;
      hitHero(s, e.def.danno * BOSS_AREA_DANNO, kind, h.x, h.z);
      if (i === t) preso = true;
    });
  }
  if (!preso && !s.eroi[t]!.done) ev(s, { t: 'schivato', x: r2(s.hero.x), z: r2(s.hero.z) });
}

function fearful(s: DungeonState, e: Enemy): boolean {
  const t = s.runHero.armatura.terrore;
  return t > 0 && e.def.pauroso !== undefined && e.def.pauroso <= t;
}

function stepFoe(s: DungeonState, e: Enemy): void {
  const h = s.hero, rh = s.runHero, def = e.def;
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  e.stT++;
  switch (e.st) {
    case 'dorme': case 'veglia': {
      const vista = def.vista * (e.st === 'dorme' ? VISTA_DORMENDO : 1);
      if (vedeEroe(s, e, vista)) {
        wake(s, e);
        for (const o of s.enemies) {
          if (o === e || o.aggro || o.alleato || o.st === 'morto') continue;
          const ox = o.x - e.x, oz = o.z - e.z;
          if (ox * ox + oz * oz <= RAGGIO_ALLARME * RAGGIO_ALLARME) wake(s, o);
        }
      }
      return;
    }
    case 'insegue': {
      if (fearful(s, e)) { setState(e, 'scappa', 0); return; }
      const reach = def.portata + def.raggio + rh.raggio, p = def.proiettile;
      if (d <= reach) { startPrep(s, e, h.x, h.z, false); return; }
      const vede = !!p && d <= p.gittata && lineOfSight(s.map, e.x, e.z, h.x, h.z);
      if (def.comportamento !== 'mischia' && vede) {
        // arcieri e maghi: tengono la distanza e tirano quando sono carichi
        if (d < p!.gittata * DISTANZA_TIRATORI) chase(s, e, def.velocita * 0.8, -1);
        e.fx = dx / d; e.fz = dz / d;
        if (e.cdTiro <= 0) startPrep(s, e, h.x, h.z, true);
        return;
      }
      // i boss con un proiettile tirano da lontano
      if (vede && d > def.portata * 2.5 && e.cdTiro <= 0) { startPrep(s, e, h.x, h.z, true); return; }
      chase(s, e, def.velocita, 1);
      return;
    }
    case 'prepara':
      if (e.stT >= e.stDur) { resolveAttack(s, e); setState(e, 'colpisce', COLPISCE_TICKS); }
      return;
    case 'colpisce':
      if (e.stT >= e.stDur) setState(e, 'recupera', secToTicks(def.recupero));
      return;
    case 'recupera':
      if (e.stT >= e.stDur) setState(e, 'insegue', 0);
      return;
    case 'scappa':
      if (!fearful(s, e)) { setState(e, 'insegue', 0); return; }
      if (d < def.vista * 1.5) chase(s, e, def.velocita, -1);
      return;
    default:
  }
}

/** Alleato: attacca il nemico ostile più vicino che vede, altrimenti segue l'eroe. Sparisce allo scadere. */
function stepAlly(s: DungeonState, e: Enemy): void {
  const h = s.hero, def = e.def;
  if (s.tick >= e.scade) { e.st = 'morto'; ev(s, { t: 'morte', id: e.id, tipo: e.tipo }); return; }
  e.stT++;
  let t = e.bersaglio >= 0 ? s.enemies.find((o) => o.id === e.bersaglio && o.st !== 'morto') : undefined;
  if (!t) {
    let bd = Infinity;
    for (const o of s.enemies) {
      if (o.alleato || o.st === 'morto') continue;
      const ox = o.x - e.x, oz = o.z - e.z, od = ox * ox + oz * oz;
      if (od < bd && od <= def.vista * def.vista && lineOfSight(s.map, e.x, e.z, o.x, o.z)) { bd = od; t = o; }
    }
    e.bersaglio = t ? t.id : -1;
  }
  if (e.st === 'prepara') {
    if (e.stT >= e.stDur) {
      if (t) {
        const ox = t.x - e.x, oz = t.z - e.z;
        const reach = def.portata + def.raggio + t.def.raggio + TOLLERANZA_NEMICO;
        if (ox * ox + oz * oz <= reach * reach) hitEnemy(s, t, { danno: def.danno, traits: {}, magico: false, skill: null, caricato: false, dirX: e.fx, dirZ: e.fz, daAlleato: true });
      }
      setState(e, 'recupera', secToTicks(def.recupero));
    }
    return;
  }
  if (e.st === 'recupera') { if (e.stT >= e.stDur) setState(e, 'insegue', 0); return; }
  if (t) {
    const ox = t.x - e.x, oz = t.z - e.z, od = Math.sqrt(ox * ox + oz * oz);
    if (od <= def.portata + def.raggio + t.def.raggio) { e.fx = ox / od; e.fz = oz / od; setState(e, 'prepara', secToTicks(def.preparazione)); return; }
    moveToward(s, e, t.x, t.z, def.velocita);
    return;
  }
  const hx = h.x - e.x, hz = h.z - e.z;
  if (hx * hx + hz * hz > ALLEATO_SEGUE * ALLEATO_SEGUE) chase(s, e, def.velocita, 1);
}

/** Separa i nemici tra loro e dagli eroi (cerchi solidi). */
function separate(s: DungeonState, act: Enemy[]): void {
  for (let i = 0; i < act.length; i++) {
    const a = act[i]!;
    for (let j = i + 1; j < act.length; j++) {
      const b = act[j]!;
      const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, rr = a.def.raggio + b.def.raggio;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2);
      const ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0, k = (rr - d) / 2;
      moveCircle(s.map, a, -ux * k, -uz * k, a.def.raggio);
      moveCircle(s.map, b, ux * k, uz * k, b.def.raggio);
    }
    if (a.alleato) continue;
    for (const r of s.eroi) {
      if (r.done) continue;
      const h = r.hero, dx = a.x - h.x, dz = a.z - h.z, d2 = dx * dx + dz * dz, rr = a.def.raggio + r.runHero.raggio;
      if (d2 < rr * rr && d2 > 1e-12) { const d = Math.sqrt(d2), k = (rr - d) / d; moveCircle(s.map, a, dx * k, dz * k, a.def.raggio); }
    }
  }
}

/** Nemici e alleati. Insieme ogni nemico lavora sul suo bersaglio (l'eroe in gioco più vicino) e ogni alleato sul suo padrone: per la
 *  durata del suo passo quello è l'eroe di turno. Il sanguinamento va a chi l'ha colpito per ultimo. */
export function stepEnemies(s: DungeonState): void {
  refreshFlow(s);
  const multi = s.eroi.length > 1, prima = s.cur, act: Enemy[] = [];
  for (const e of s.enemies) {
    if (e.st === 'morto') continue;
    let t = prima;
    if (multi) {
      t = e.alleato ? e.padrone ?? 0 : bersaglio(s, e);
      if (t < 0) continue;
      s.cur = t;
      // il padrone è uscito o caduto: l'evocazione sparisce con lui
      if (e.alleato && s.done) { e.st = 'morto'; ev(s, { t: 'morte', id: e.id, tipo: e.tipo }); continue; }
    }
    const h = s.hero, dx = h.x - e.x, dz = h.z - e.z;
    if (!e.alleato && dx * dx + dz * dz > RAGGIO_ATTIVO * RAGGIO_ATTIVO) continue;
    if (e.hurt > 0) e.hurt--;
    if (e.cdTiro > 0) e.cdTiro--;
    if (e.bleedT > 0) {
      if (multi) s.cur = e.ultimo ?? t;
      e.bleedT--; e.vita -= e.bleed * DT; s.danniFatti += e.bleed * DT;
      if (e.vita <= 0) { kill(s, e); continue; }
      s.cur = t;
    }
    if (e.alleato) stepAlly(s, e); else stepFoe(s, e);
    if (finita(s)) { s.cur = prima; return; }
    if (vivo(e)) act.push(e);
  }
  s.cur = prima;
  separate(s, act);
}
