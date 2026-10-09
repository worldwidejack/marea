// Fucina a Pressione, il capo: il Mastro Forgiatore (docs/RPG.md §2e). Centauro meccanico con la fornace al posto della pancia: finché è
// acceso non prende danni (combat.ts, «parato»); si spegne solo dentro una cascata d'acqua, e camminando le gira attorno (muove:
// 'asciutto'), quindi ci finisce dentro soltanto CARICANDO: linea d'avviso, poi corre dritto fino a qualche metro dopo dove stavi. Chi la
// vede arrivare si mette con una cascata tra sé e lui (se stai sotto la cascata non carica: ti tira il magma). MAGMA: palle che cadono
// dove sei e attorno (cerchio d'avviso, poi il colpo e una pozza che brucia: fuoco.ts). Da vicino pesta gli zoccoli (colpo ad area).
// Spento resta fermo e prende danni per qualche secondo; poi si riaccende e il fuoco cauterizza il sanguinamento. Niente funzioni
// trascendenti: le direzioni sono versori.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { cellCenter, cellOf, isSolid, lineOfSight, moveCircle, stepDown } from './map.ts';
import { flowDi, grigliaDi } from './muove.ts';
import { spingi } from './vento.ts';
import { inGetto } from './fuoco.ts';
import { COLPISCE_TICKS, GEYSER_DIR } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
function setState(e: Enemy, st: Enemy['st'], dur: number): void { e.st = st; e.stT = 0; e.stDur = dur; }

/** Cammina verso l'eroe di turno sulla sua griglia (le cascate sono muri): dritto se è vicino e lo vede, se no lungo il flow field. */
function muovi(s: DungeonState, e: Enemy): void {
  const h = s.hero, g = grigliaDi(s, e), passo = e.def.velocita * DT;
  let tx = h.x, tz = h.z;
  const ax = h.x - e.x, az = h.z - e.z;
  if (!(ax * ax + az * az < 16 && lineOfSight(s.map, e.x, e.z, h.x, h.z))) {
    const n = stepDown(g, flowDi(s, e), cellOf(g, e.x, e.z));
    if (n >= 0) { const c = cellCenter(g, n); tx = c.x; tz = c.z; }
  }
  const dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  e.fx = dx / d; e.fz = dz / d;
  moveCircle(g, e, e.fx * Math.min(d, passo), e.fz * Math.min(d, passo), e.def.raggio);
}

/** Fin dove arriva la carica da (x, z) lungo (dx, dz): fino al primo muro, colonna o lava della Colata, al massimo `max`. */
function corsaFino(s: DungeonState, x: number, z: number, dx: number, dz: number, max: number): number {
  const t = s.map.tile;
  let l = 0;
  while (l < max) {
    const nl = l + 0.25;
    if (isSolid(s.map, Math.floor((x + dx * nl) / t), Math.floor((z + dz * nl) / t))) break;
    l = nl;
  }
  return l;
}

/** Comincia un attacco (telegrafato in `prepara`): la carica prende la mira adesso e non la cambia più. */
function inizia(s: DungeonState, e: Enemy, modo: 'carica' | 'magma' | 'zoccolo'): void {
  const F = e.def.forgiatore!, h = s.hero;
  e.modo = modo; e.salve = 0; e.tiro = false; e.area = modo === 'zoccolo'; e.mira = undefined;
  const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
  if (modo === 'carica') {
    e.mira = { dx: e.fx, dz: e.fz, len: corsaFino(s, e.x, e.z, e.fx, e.fz, Math.min(F.carica.gittata, d + F.carica.oltre)) };
    setState(e, 'prepara', secToTicks(F.carica.avviso));
  } else setState(e, 'prepara', secToTicks(e.def.preparazione * (modo === 'zoccolo' && e.def.area ? e.def.area.prep : 1)));
}

/** Dentro una cascata: la fornace si spegne, sta fermo e prende danni per `spento` s. */
function spegni(s: DungeonState, e: Enemy): void {
  e.spento = true; e.modo = undefined; e.mira = undefined; e.area = false;
  setState(e, 'recupera', secToTicks(e.def.forgiatore!.spento));
  ev(s, { t: 'spento', x: r2(e.x), z: r2(e.z) });
}
/** Fine dell'attacco: pausa (o fermo spento, se l'ha spento la cascata). */
function riposa(s: DungeonState, e: Enemy): void {
  e.modo = undefined; e.mira = undefined; e.area = false;
  setState(e, 'recupera', secToTicks(e.def.forgiatore!.pausa));
}

/** Un passo della carica: corre dritto, travolge chi trova (una volta), si spegne in una cascata, si ferma contro un muro o a fine corsa. */
function corre(s: DungeonState, e: Enemy): void {
  const C = e.def.forgiatore!.carica, m = e.mira!, passo = C.velocita * DT;
  const x0 = e.x, z0 = e.z;
  moveCircle(s.map, e, m.dx * passo, m.dz * passo, e.def.raggio);
  const fx = e.x - x0, fz = e.z - z0, fatto = Math.sqrt(fx * fx + fz * fz);
  e.corsa = (e.corsa ?? 0) + fatto;
  const presi = e.presi ?? (e.presi = []);
  for (const i of inGioco(s)) {
    if (presi.includes(i)) continue;
    conEroe(s, i, () => {
      const h = s.hero, dx = h.x - e.x, dz = h.z - e.z, r = e.def.raggio + s.runHero.raggio + 0.2;
      if (dx * dx + dz * dz > r * r) return;
      presi.push(i);
      const arriva = h.protetto <= 0;
      hitHero(s, e.def.danno * C.danno, 'contundente', h.x, h.z);
      if (!arriva || s.done) return;
      // via di lato, dalla parte dove stava rispetto alla corsa (in mezzo: a destra)
      const lato = dx * m.dz - dz * m.dx >= 0 ? -1 : 1, px = -m.dz * lato + m.dx * 0.5, pz = m.dx * lato + m.dz * 0.5, l = Math.sqrt(px * px + pz * pz);
      spingi(s, px / l, pz / l, C.spinta, 0.3);
    });
  }
  if (inGetto(s, e.x, e.z, e.def.raggio * 0.5)) { spegni(s, e); return; }
  if (fatto < passo * 0.5) { ev(s, { t: 'urto', x: r2(e.x), z: r2(e.z) }); riposa(s, e); return; } // contro il muro
  if (e.corsa >= m.len) riposa(s, e);
}

/** Una palla di magma dove sta l'eroe di turno (la prima) o attorno (le altre): cerchio d'avviso, colpo e pozza (acque.ts, stepGeyser). */
function palla(s: DungeonState, e: Enemy): void {
  const M = e.def.forgiatore!.magma, k = e.salve ?? 0, h = s.hero;
  e.salve = k + 1;
  const [ox, oz] = k === 0 ? [0, 0] : GEYSER_DIR[(e.attacchi * 3 + k) % GEYSER_DIR.length]!;
  const x = h.x + ox * M.sparpaglia, z = h.z + oz * M.sparpaglia;
  if (isSolid(s.map, Math.floor(x / s.map.tile), Math.floor(z / s.map.tile))) return;
  s.geyser.push({
    id: s.nextId++, x, z, r: M.raggio, t: 0, avviso: secToTicks(M.caduta), getto: secToTicks(0.25), danno: M.danno, colpiti: [],
    magma: { durata: M.fuoco, raggio: M.raggio * 0.8, dps: M.dps, secondi: M.secondi },
  });
}

/** Zoccoli: tutti gli eroi in gioco entro il cerchio prendono il colpo. */
function zoccoli(s: DungeonState, e: Enemy): void {
  const A = e.def.area;
  if (!A) return;
  for (const i of inGioco(s)) conEroe(s, i, () => {
    const h = s.hero, dx = h.x - e.x, dz = h.z - e.z, r = A.raggio + s.runHero.raggio;
    if (dx * dx + dz * dz <= r * r) hitHero(s, e.def.danno * A.danno, 'contundente', h.x, h.z);
    else ev(s, { t: 'schivato', x: r2(h.x), z: r2(h.z) });
  });
}

/** Passo del Mastro Forgiatore sveglio (dorme e veglia li fa enemies.ts). */
export function stepForgiatore(s: DungeonState, e: Enemy): void {
  const F = e.def.forgiatore!, h = s.hero, rh = s.runHero;
  switch (e.st) {
    case 'insegue': {
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.sqrt(dx * dx + dz * dz);
      const vicino = d <= e.def.portata + e.def.raggio + rh.raggio;
      if (!vicino) muovi(s, e); else if (d > 1e-6) { e.fx = dx / d; e.fz = dz / d; }
      if (e.cdTiro > 0 || d > e.def.vista || !lineOfSight(s.map, e.x, e.z, h.x, h.z)) return;
      if (vicino) { inizia(s, e, 'zoccolo'); return; }
      let modo = F.ciclo[e.attacchi % F.ciclo.length]!;
      if (modo === 'carica' && inGetto(s, h.x, h.z, rh.raggio)) modo = 'magma'; // sotto la cascata non carica: ti bombarda
      if (modo === 'magma' && d > F.magma.gittata) return;
      e.attacchi++;
      inizia(s, e, modo);
      return;
    }
    case 'prepara':
      if (e.stT < e.stDur) return;
      if (e.modo === 'carica') { e.corsa = 0; e.presi = []; ev(s, { t: 'carica' }); setState(e, 'colpisce', secToTicks(F.carica.gittata / F.carica.velocita) + 1); }
      else if (e.modo === 'magma') { palla(s, e); setState(e, 'colpisce', secToTicks(F.magma.ogni * F.magma.n)); }
      else { zoccoli(s, e); setState(e, 'colpisce', COLPISCE_TICKS); }
      return;
    case 'colpisce':
      if (e.modo === 'carica') { corre(s, e); if (e.st === 'colpisce' && e.stT >= e.stDur) riposa(s, e); return; }
      if (e.modo === 'magma' && (e.salve ?? 0) < F.magma.n && e.stT % secToTicks(F.magma.ogni) === 0) palla(s, e);
      if (e.stT >= e.stDur) riposa(s, e);
      return;
    case 'recupera':
      if (e.stT < e.stDur) return;
      if (e.spento) { e.spento = false; e.bleed = 0; e.bleedT = 0; ev(s, { t: 'riacceso' }); }
      e.cdTiro = 0;
      setState(e, 'insegue', 0);
      return;
    default:
  }
}
