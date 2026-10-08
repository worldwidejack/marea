// Eroe della partita a ondate: movimento (corsa col fiato), fendente con mira assistita e giro caricato (gli archi di dungeon/swing.ts:
// quel che si vede è quel che colpisce), AZIONE (posa la reliquia, ripara le finestre), scambio d'arma, rigenerazione.
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { DT } from '../constants.ts';
import type { TArmaDef } from '@marea/content/templari.ts';
import { moveCircle } from '../dungeon/map.ts';
import { COLPI, GIRO_TEMPO } from '../dungeon/tuning.ts';
import { sweepTo, swept } from '../dungeon/swing.ts';
import type { TInput, TPrompt } from './types.ts';
import type { TState, Zombie } from './stato.ts';
import { HOLD_TICKS, armaIn, ev, secToTicks } from './stato.ts';
import { colpisci, dai } from './colpi.ts';
import { setFinestra } from './mappa.ts';

const vivi = (s: TState): Zombie[] => s.zombie.filter((z) => z.st !== 'morto' && z.st !== 'sorge');

/** Mira assistita: lo zombie più vicino entro `range` nel semicerchio davanti, altrimenti il più vicino entro `fallback`. */
export function mira(s: TState, range: number, fallback: number): Zombie | null {
  const h = s.eroe;
  let best: Zombie | null = null, bd = Infinity, near: Zombie | null = null, nd = Infinity;
  for (const z of vivi(s)) {
    const dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz), reach = d - z.def.raggio;
    const dot = d > 1e-6 ? (dx * h.fx + dz * h.fz) / d : 1;
    if (reach <= range && dot >= 0 && d < bd) { bd = d; best = z; }
    if (reach <= fallback && d < nd) { nd = d; near = z; }
  }
  return best ?? near;
}
function guarda(s: TState, z: Zombie | null): void {
  if (!z) return;
  const h = s.eroe, dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { h.fx = dx / d; h.fz = dz / d; }
}

/** Uno zombie a portata del fendente adesso (per AUTO: il client preme A da solo). */
export function aPortata(s: TState): boolean {
  const a = armaIn(s);
  if (a.tipo !== 'mischia') return false;
  const h = s.eroe, p = (a.portata ?? 1.5) + TEMPLARI.eroe.raggio * 0.5;
  for (const z of vivi(s)) {
    const dx = z.x - h.x, dz = z.z - h.z, r = p + z.def.raggio;
    if (dx * dx + dz * dz <= r * r) return true;
  }
  return false;
}

function inizia(s: TState, a: TArmaDef, caricato: boolean): void {
  const h = s.eroe, portata = a.portata ?? 1.5;
  guarda(s, mira(s, portata * 1.5, portata));
  h.stile = caricato ? 'giro' : 'fendente';
  h.act = 'swing'; h.actT = 0; h.actDur = secToTicks(a.tempo * (caricato ? GIRO_TEMPO : 1));
  h.caricato = caricato; h.colpiti = []; h.colpito = false; h.carica = 0;
  ev(s, { t: 'fendente', caricato });
}

/** La lama spazza il suo arco: colpisce una volta ogni zombie in portata appena la lama gli passa sopra. */
function spazza(s: TState, a: TArmaDef): void {
  const h = s.eroe, k = swept(h.stile, h.actT / h.actDur), fatto = k * COLPI[h.stile].arco;
  if (k > 0) {
    const danno = a.danno * (h.caricato ? a.caricaMolt ?? 1 : 1), portata = a.portata ?? 1.5;
    for (const z of vivi(s)) {
      if (h.colpiti.includes(z.id)) continue;
      const dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > portata + z.def.raggio) continue;
      if (sweepTo(h.stile, h.fx, h.fz, dx, dz, z.def.raggio, d <= z.def.raggio + TEMPLARI.eroe.raggio) > fatto) continue;
      h.colpiti.push(z.id);
      const dirX = h.stile === 'giro' && d > 1e-6 ? dx / d : h.fx, dirZ = h.stile === 'giro' && d > 1e-6 ? dz / d : h.fz;
      colpisci(s, z, { danno, mischia: true, caricato: h.caricato, dirX, dirZ, spinta: (a.spinta ?? 0) * (h.caricato ? 2 : 1) });
    }
  }
  if (k >= 1 && !h.colpito) { h.colpito = true; if (!h.colpiti.length) ev(s, { t: 'mancato' }); }
}

/** Finestra da riparare a portata (la più vicina con assi mancanti), o -1. */
export function finestraVicina(s: TState): number {
  const h = s.eroe, r = TEMPLARI.barricate.raggio;
  let best = -1, bd = Infinity;
  s.arena.finestre.forEach((f, i) => {
    if ((s.assi[i] ?? 0) >= TEMPLARI.barricate.assi) return;
    const dx = f.dentro.x - h.x, dz = f.dentro.z - h.z, d = dx * dx + dz * dz;
    if (d <= r * r && d < bd) { bd = d; best = i; }
  });
  return best;
}
/** Uno zombie sta strappando questa finestra (non si ripara sotto le sue mani). */
const strappata = (s: TState, f: number): boolean => s.zombie.some((z) => z.st === 'strappa' && z.finestra === f);

/** Vicino all'altare? */
export function vicinoAltare(s: TState): boolean {
  const h = s.eroe, a = s.arena.altare, r = TEMPLARI.altare.raggio;
  const dx = a.x - h.x, dz = a.z - h.z;
  return dx * dx + dz * dz <= r * r;
}

/** Cosa farebbe AZIONE adesso. */
export function prompt(s: TState): TPrompt {
  if (s.done) return null;
  if (s.fase === 'altare') return vicinoAltare(s) ? { cosa: 'reliquia', testo: 'Posa la reliquia', prezzo: 0, puoi: true } : null;
  const f = finestraVicina(s);
  if (f >= 0) return { cosa: 'ripara', testo: 'Ripara la finestra', prezzo: 0, puoi: !strappata(s, f) };
  return null;
}

function azione(s: TState, dDown: boolean, dHeld: boolean): void {
  const h = s.eroe;
  if (s.fase === 'altare') {
    if (dDown && vicinoAltare(s)) { s.fase = 'inizio'; s.faseT = 0; ev(s, { t: 'reliquia' }); }
    return;
  }
  if (!dHeld) return;
  const f = finestraVicina(s);
  if (f < 0 || strappata(s, f)) return;
  if (s.tick - h.riparaT < secToTicks(TEMPLARI.barricate.ripara)) return;
  h.riparaT = s.tick;
  const n = Math.min(TEMPLARI.barricate.assi, (s.assi[f] ?? 0) + 1);
  s.assi[f] = n;
  setFinestra(s.arena, s.gr, f, n);
  ev(s, { t: 'asse', finestra: f, assi: n, da: 'eroe' });
  const p = Math.min(TEMPLARI.punti.asse, Math.max(0, TEMPLARI.punti.assiMaxOndata - s.puntiAssi));
  if (p > 0) { s.puntiAssi += p; dai(s, p, 'asse'); }
}

export function stepEroe(s: TState, inp: TInput): void {
  const h = s.eroe, c = TEMPLARI.eroe, a = armaIn(s);
  if (h.hurt > 0) h.hurt--;
  const aDown = inp.a && !h.prevA, cDown = inp.c && !h.prevC, dDown = inp.d && !h.prevD;
  h.prevA = inp.a; h.prevC = inp.c; h.prevD = inp.d;
  azione(s, dDown, inp.d);
  // scambio d'arma (solo da fermi con l'arma: a metà fendente no)
  if (cDown && h.act === 'idle') {
    const altro = h.armi.findIndex((x, i) => i !== h.cur && x !== null);
    if (altro >= 0) { h.cur = altro; ev(s, { t: 'scambia', arma: h.armi[altro]!.id }); }
  }
  // attacco
  h.actT++;
  switch (h.act) {
    case 'idle':
      h.actT = 0;
      if (aDown && a.tipo === 'mischia') { h.act = 'press'; h.actT = 0; }
      break;
    case 'press':
      if (!inp.a) inizia(s, a, false);
      else if (h.actT >= HOLD_TICKS) { h.act = 'carica'; h.actT = 0; h.actDur = secToTicks(a.carica ?? 1); h.carica = 0; }
      break;
    case 'carica':
      h.carica = Math.min(1, h.actT / h.actDur);
      if (!inp.a) inizia(s, a, h.carica >= 1);
      break;
    case 'swing':
      if (!h.colpito) spazza(s, armaDef(h.armi[h.cur]!.id));
      if (h.actT >= h.actDur) { h.act = 'idle'; h.actT = 0; }
      break;
  }
  // movimento: corsa con B o col joystick in fondo, finché c'è fiato
  let mx = inp.mx, my = inp.my;
  const mag = Math.sqrt(mx * mx + my * my);
  if (mag > 1) { mx /= mag; my /= mag; }
  h.moving = Math.min(1, mag) > 0.1;
  const lento = h.act !== 'idle';
  h.corre = h.moving && (inp.b || mag > 0.92) && !lento && h.fiato > 0;
  if (h.corre) h.fiato = Math.max(0, h.fiato - DT);
  else h.fiato = Math.min(c.fiato, h.fiato + (c.fiato / c.fiatoPieno) * DT * (h.moving ? 0.5 : 1));
  let v = h.corre ? c.corsa : c.camminata;
  if (lento) v *= c.mentreAttacca;
  if (h.moving) {
    moveCircle(s.gr.eroe, h, mx * v * DT, my * v * DT, c.raggio);
    if (h.act !== 'swing') { h.fx = mx / mag; h.fz = my / mag; }
  }
  // gli zombie sono solidi: l'eroe non li attraversa
  for (const z of s.zombie) {
    if (z.st === 'morto' || z.st === 'sorge') continue;
    const dx = h.x - z.x, dz = h.z - z.z, d2 = dx * dx + dz * dz, rr = c.raggio + z.def.raggio;
    if (d2 >= rr * rr || d2 < 1e-12) continue;
    const d = Math.sqrt(d2), k = (rr - d) / d;
    moveCircle(s.gr.eroe, h, dx * k * 0.5, dz * k * 0.5, c.raggio);
  }
  // rigenerazione dopo qualche secondo senza colpi
  h.quiete++;
  if (h.quiete >= secToTicks(c.regenDopo)) h.vita = Math.min(h.max, h.vita + c.regen * DT);
}
