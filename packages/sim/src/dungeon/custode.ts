// Mausoleo Cinetico, il capo: il Custode dell'Egida (docs/RPG.md §2f). Il robot personale della Regina, a guardia del sarcofago, con tre
// cuori e tre fasi. ACQUA (sopra i due terzi della vita): l'ONDATA (anello d'acqua che si allarga da lui: ci si salva nei varchi o dietro
// le colonne) e i FENDENTI (ventagli di lame d'acqua). VAPORE (fino a un terzo): lo SCATTO (la nebbia segna dove ricompare, alle spalle
// dell'eroe; poi ci scatta e batte a terra) e i GEYSER dal pavimento. ENERGIA CINETICA (l'ultimo terzo): tutto insieme, e ha addosso un
// pezzo della Barriera: ogni tot colpi presi scarica un'onda d'urto a 360° (combat.ts → scarica). Tra una fase e l'altra «cambia cuore»:
// per qualche secondo è intoccabile. Da vicino batte a terra. Dopo ogni attacco una pausa: il momento per colpirlo.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { cellCenter, cellOf, isSolid, lineOfSight, moveCircle, stepDown } from './map.ts';
import { ondaDa } from './onde.ts';
import { COLPISCE_TICKS, DIR16, GEYSER_DIR, MAGIA_Y } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
function setState(e: Enemy, st: Enemy['st'], dur: number): void { e.st = st; e.stT = 0; e.stDur = dur; }
/** Danno del Custode (un Chierico potrebbe potenziarlo, come gli altri). */
const danno = (s: DungeonState, e: Enemy): number => e.def.danno * (e.potT !== undefined && e.potT > s.tick ? e.potM ?? 1 : 1);

/** Cammina verso l'eroe di turno: dritto se è vicino e lo vede, se no lungo il flow field. */
function muovi(s: DungeonState, e: Enemy): void {
  const h = s.hero, passo = e.def.velocita * DT;
  let tx = h.x, tz = h.z;
  const ax = h.x - e.x, az = h.z - e.z;
  if (!(ax * ax + az * az < 16 && lineOfSight(s.map, e.x, e.z, h.x, h.z))) {
    const n = stepDown(s.map, s.flow, cellOf(s.map, e.x, e.z));
    if (n >= 0) { const c = cellCenter(s.map, n); tx = c.x; tz = c.z; }
  }
  const dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  e.fx = dx / d; e.fz = dz / d;
  moveCircle(s.map, e, e.fx * Math.min(d, passo), e.fz * Math.min(d, passo), e.def.raggio);
}

type Modo = 'ondata' | 'fendenti' | 'scatto' | 'geyser' | 'colpo';
/** Dove ricompare con lo scatto: `dietro` m alle spalle dell'eroe di turno (se lì c'è un muro, di lato; se no addosso a lui). */
function meta(s: DungeonState, dietro: number): { x: number; z: number } {
  const h = s.hero, t = s.map.tile;
  for (const [ux, uz] of [[-h.fx, -h.fz], [-h.fz, h.fx], [h.fz, -h.fx]] as const) {
    const x = h.x + ux * dietro, z = h.z + uz * dietro;
    if (!isSolid(s.map, Math.floor(x / t), Math.floor(z / t))) return { x, z };
  }
  return { x: h.x, z: h.z };
}

/** Comincia un attacco (telegrafato in `prepara`): lo scatto prende la meta adesso e non la cambia più. */
function inizia(s: DungeonState, e: Enemy, modo: Modo): void {
  const C = e.def.custode!, h = s.hero;
  e.modo = modo; e.salve = 0; e.tiro = modo === 'fendenti'; e.area = modo === 'colpo'; e.mira = undefined;
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
  let prep = e.def.preparazione;
  if (modo === 'ondata') prep = C.ondata.prep;
  else if (modo === 'fendenti') prep = C.fendenti.prep;
  else if (modo === 'geyser') prep = C.geyser.prep;
  else if (modo === 'colpo' && e.def.area) prep = e.def.preparazione * e.def.area.prep;
  else if (modo === 'scatto') {
    const m = meta(s, C.scatto.dietro), mx = m.x - e.x, mz = m.z - e.z, ml = Math.sqrt(mx * mx + mz * mz);
    e.mira = { dx: ml > 1e-6 ? mx / ml : e.fx, dz: ml > 1e-6 ? mz / ml : e.fz, len: ml };
    prep = C.scatto.avviso;
  }
  setState(e, 'prepara', secToTicks(prep));
}

/** Una salva di fendenti: `n` lame d'acqua a ventaglio verso l'eroe di turno. */
function fendenti(s: DungeonState, e: Enemy): void {
  const F = e.def.custode!.fendenti, h = s.hero;
  e.salve = (e.salve ?? 0) + 1;
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz), ux = d > 1e-6 ? dx / d : e.fx, uz = d > 1e-6 ? dz / d : e.fz;
  for (let k = 0; k < F.n; k++) {
    const o = (k - (F.n - 1) / 2) * F.apertura, vx = ux - uz * o, vz = uz + ux * o, l = Math.sqrt(vx * vx + vz * vz);
    s.proj.push({
      id: s.nextId++, tipo: 'lama_nemica', x: e.x + (vx / l) * (e.def.raggio + 0.2), y: MAGIA_Y, z: e.z + (vz / l) * (e.def.raggio + 0.2),
      vx: (vx / l) * F.velocita, vy: 0, vz: (vz / l) * F.velocita, g: 0, danno: F.danno * (danno(s, e) / e.def.danno), life: secToTicks(F.gittata / F.velocita),
      traits: {}, raggio: 0, colpiti: [], dalNemico: true, contundente: false, magico: false, arrowId: null,
    });
  }
}

/** I varchi della prossima ondata (cambiano a ogni ondata; si vedono già mentre la prepara). */
export function varchiDi(e: Enemy): [number, number][] {
  const O = e.def.custode!.ondata, passo = Math.max(1, Math.floor(DIR16.length / Math.max(1, O.varchi))), varchi: [number, number][] = [];
  for (let k = 0; k < O.varchi; k++) { const [vx, vz] = DIR16[(e.attacchi * 5 + k * passo) % DIR16.length]!; varchi.push([vx, vz]); }
  return varchi;
}
/** L'ondata: un anello d'acqua coi varchi. */
function ondata(s: DungeonState, e: Enemy): void {
  ondaDa(s, e.x, e.z, e.def.custode!.ondata, varchiDi(e));
  ev(s, { t: 'ondata', x: r2(e.x), z: r2(e.z) });
}

/** Geyser dal pavimento: uno sotto ogni eroe in gioco e `n` attorno a lui (sui muri niente). */
function geyser(s: DungeonState, e: Enemy): void {
  const G = e.def.custode!.geyser, punti: { x: number; z: number }[] = [];
  for (const i of inGioco(s)) { const h = s.eroi[i]!.hero; punti.push({ x: h.x, z: h.z }); }
  for (let k = 0; k < G.n; k++) { const [dx, dz] = GEYSER_DIR[(e.attacchi + k) % GEYSER_DIR.length]!; punti.push({ x: e.x + dx * G.distanza, z: e.z + dz * G.distanza }); }
  for (const p of punti) {
    if (isSolid(s.map, Math.floor(p.x / s.map.tile), Math.floor(p.z / s.map.tile))) continue;
    s.geyser.push({ id: s.nextId++, x: p.x, z: p.z, r: G.raggio, t: 0, avviso: secToTicks(G.avviso), getto: secToTicks(G.getto), danno: G.danno, colpiti: [] });
  }
}

/** Batte a terra: tutti gli eroi entro `raggio` m prendono il colpo (× `molt`). */
function batte(s: DungeonState, e: Enemy, raggio: number, molt: number): void {
  for (const i of inGioco(s)) conEroe(s, i, () => {
    const h = s.hero, dx = h.x - e.x, dz = h.z - e.z, r = raggio + s.runHero.raggio;
    if (dx * dx + dz * dz <= r * r) hitHero(s, danno(s, e) * molt, 'contundente', h.x, h.z);
    else ev(s, { t: 'schivato', x: r2(h.x), z: r2(h.z) });
  });
}

/** Lo scatto: dalla nebbia ricompare dove l'aveva segnato (i muri lo tengono fuori) e batte subito a terra. */
function scatta(s: DungeonState, e: Enemy): void {
  const S = e.def.custode!.scatto, m = e.mira!;
  e.x += m.dx * m.len; e.z += m.dz * m.len;
  moveCircle(s.map, e, 0.01 * m.dx, 0.01 * m.dz, e.def.raggio);
  ev(s, { t: 'scatto' });
  batte(s, e, S.raggio, S.danno);
}

/** Fine dell'attacco: pausa della fase (il momento per colpirlo). */
function riposa(s: DungeonState, e: Enemy): void {
  const C = e.def.custode!;
  e.modo = undefined; e.mira = undefined; e.area = false; e.tiro = false;
  setState(e, 'recupera', secToTicks(C.pausa[Math.min(e.fase ?? 0, C.pausa.length - 1)] ?? 1));
}

/** Sotto la soglia: cambia cuore. Per `cambio` s è fermo e intoccabile (combat.ts), poi riparte con la fase nuova. */
function cambia(s: DungeonState, e: Enemy): void {
  const C = e.def.custode!;
  e.fase = (e.fase ?? 0) + 1; e.colpiB = 0;
  e.modo = 'cambio'; e.mira = undefined; e.area = false; e.tiro = false;
  setState(e, 'recupera', secToTicks(C.cambio));
  ev(s, { t: 'fase', n: e.fase });
}

/** La Barriera della terza fase: troppi colpi presi, scarica a 360° (senza varchi). La chiama combat.ts. */
export function scarica(s: DungeonState, e: Enemy): void {
  const B = e.def.custode!.barriera;
  e.colpiB = 0;
  ondaDa(s, e.x, e.z, { velocita: B.velocita, raggio: B.raggio, spessore: 0.9, danno: B.danno, spinta: B.spinta, largo: 2 }, [], true);
  ev(s, { t: 'ondata', x: r2(e.x), z: r2(e.z), barriera: true });
}

/** Passo del Custode sveglio (dorme e veglia li fa enemies.ts). */
export function stepCustode(s: DungeonState, e: Enemy): void {
  const C = e.def.custode!, h = s.hero, rh = s.runHero, fase = e.fase ?? 0;
  if (e.modo !== 'cambio' && fase < C.soglie.length && e.vita <= e.max * C.soglie[fase]!) { cambia(s, e); return; }
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
      const vicino = d <= e.def.portata + e.def.raggio + rh.raggio;
      if (!vicino) muovi(s, e); else if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      if (e.cdTiro > 0 || d > e.def.vista || !lineOfSight(s.map, e.x, e.z, h.x, h.z)) return;
      if (vicino && e.attacchi % 2 === 1) { e.attacchi++; inizia(s, e, 'colpo'); return; } // da vicino, un attacco sì e uno no batte a terra
      const ciclo = C.cicli[Math.min(fase, C.cicli.length - 1)]!;
      const modo = ciclo[e.attacchi % ciclo.length]!;
      e.attacchi++;
      inizia(s, e, modo);
      return;
    }
    case 'prepara':
      if (e.stT < e.stDur) return;
      switch (e.modo) {
        case 'ondata': ondata(s, e); setState(e, 'colpisce', COLPISCE_TICKS * 2); break;
        case 'fendenti': fendenti(s, e); setState(e, 'colpisce', secToTicks(C.fendenti.ogni * C.fendenti.salve)); break;
        case 'scatto': scatta(s, e); setState(e, 'colpisce', COLPISCE_TICKS * 2); break;
        case 'geyser': geyser(s, e); setState(e, 'colpisce', COLPISCE_TICKS * 2); break;
        default: batte(s, e, e.def.area?.raggio ?? 3, e.def.area?.danno ?? 1); setState(e, 'colpisce', COLPISCE_TICKS);
      }
      return;
    case 'colpisce':
      if (e.modo === 'fendenti' && (e.salve ?? 0) < C.fendenti.salve && e.stT % secToTicks(C.fendenti.ogni) === 0) fendenti(s, e);
      if (e.stT >= e.stDur) riposa(s, e);
      return;
    case 'recupera':
      if (e.stT < e.stDur) return;
      e.modo = undefined; e.cdTiro = 0;
      setState(e, 'insegue', 0);
      return;
    default:
  }
}
