// Eroe della partita a ondate (docs/TEMPLARI.md §5-7): movimento (corsa col fiato), due armi più lo scudo templare. Mischia: fendente con
// mira assistita, tenuto = giro (gli archi di dungeon/swing.ts: quel che si vede è quel che colpisce); la spada di de Molay lascia fiamme.
// Arco: tieni = tendi, lascia = freccia. Fuoco: un colpo per tocco, ricarica da sola a caricatore vuoto (il trombone spara pallini a
// ventaglio). Fuoco greco: un vaso che esplode dove cade. Scudo: sulle spalle para da dietro; in mano (SCAMBIA) para davanti, rallenta
// e la A dà una spallata. AZIONE: posa la reliquia, apre la cassa o ne prende l'arma, raccoglie lo scudo, compra le armi sul muro (o le
// loro munizioni), ripara le finestre tenendolo premuto.
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import type { TArmaDef } from '@marea/content/templari.ts';
import { DT } from '../constants.ts';
import { lineOfSight, moveCircle } from '../dungeon/map.ts';
import { COLPI, GIRO_TEMPO } from '../dungeon/tuning.ts';
import { sweepTo, swept } from '../dungeon/swing.ts';
import type { TInput, TPrompt } from './types.ts';
import type { Slot, TState, Zombie } from './stato.ts';
import { HOLD_TICKS, armaIn, ev, secToTicks, slotDi, slotIn } from './stato.ts';
import { accendi, colpisci, dai, spendi } from './colpi.ts';
import { setFinestra } from './mappa.ts';
import type { Muro } from './mappa.ts';
import { ruota, tira } from './proiettili.ts';
import { usaCassa, vicinoCassa } from './cassa.ts';
import { accendiTrappola, apriPorta, levaVicina, portaDef, portaVicina, trappolaAccesa, trappolaDef, trappolaPronta } from './porte.ts';

const vivi = (s: TState): Zombie[] => s.zombie.filter((z) => z.st !== 'morto' && z.st !== 'sorge');
const ANIM_TIRO = Math.round(0.25 * 60), ANIM_LANCIO = Math.round(0.35 * 60);
/** Mira a distanza: aiuta solo dentro un cono di ~35° davanti (sennò il colpo va dritto dove guardi). */
const COS_TIRO = 0.82;
/** Joystick sfiorato (sotto questa spinta): l'eroe si gira sul posto senza muoversi (mira fine col dito, il mouse da PC). */
export const GIRA_SUL_POSTO = 0.3;

/** Mira in mischia: lo zombie più vicino entro `range` nel mezzo cerchio davanti (quello alle spalle no: ti giri tu). */
export function mira(s: TState, range: number): Zombie | null {
  const h = s.eroe;
  let best: Zombie | null = null, bd = Infinity;
  for (const z of vivi(s)) {
    const dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz), reach = d - z.def.raggio;
    const dot = d > 1e-6 ? (dx * h.fx + dz * h.fz) / d : 1;
    if (reach <= range && dot >= 0.2 && d < bd) { bd = d; best = z; }
  }
  return best;
}
/** Mira a distanza: lo zombie in vista entro la gittata dentro il cono davanti; nessuno = il colpo va dritto dove guardi. */
export function miraTiro(s: TState, gittata: number): Zombie | null {
  const h = s.eroe, g = s.gr.percorso;
  let best: Zombie | null = null, bd = Infinity;
  for (const z of vivi(s)) {
    const dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > gittata || !lineOfSight(g, h.x, h.z, z.x, z.z)) continue;
    const dot = d > 1e-6 ? (dx * h.fx + dz * h.fz) / d : 1;
    if (dot >= COS_TIRO && d < bd) { bd = d; best = z; }
  }
  return best;
}
function guarda(s: TState, z: { x: number; z: number } | null): void {
  if (!z) return;
  const h = s.eroe, dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) { h.fx = dx / d; h.fz = dz / d; }
}

/** Uno zombie a portata del fendente adesso. */
export function aPortata(s: TState): boolean {
  const a = armaIn(s);
  if (a.tipo !== 'mischia' || s.eroe.inMano) return false;
  const h = s.eroe, p = (a.portata ?? 1.5) + TEMPLARI.eroe.raggio * 0.5;
  for (const z of vivi(s)) {
    const dx = z.x - h.x, dz = z.z - h.z, r = p + z.def.raggio;
    if (dx * dx + dz * dz <= r * r) return true;
  }
  return false;
}
/** AUTO (di serie): la A che il client preme da solo questo tick. Mischia: un tocco quando uno è a portata. Arco: tiene teso finché è
 *  pieno, poi lascia. Fuoco e fuoco greco: un tocco quando c'è un bersaglio in vista ed è carico. Con lo scudo in mano niente. */
export function autoA(s: TState): boolean {
  const h = s.eroe, a = armaIn(s), sl = slotIn(s);
  if (h.inMano || s.done) return false;
  if (a.tipo === 'mischia') return aPortata(s) && h.act === 'idle' && !h.prevA;
  if (a.tipo === 'arco' && h.act === 'tende') return h.carica < 1;
  const pronto = h.act === 'idle' && h.cd <= 0 && h.ricarica <= 0 && !!sl && sl.colpi > 0 && !h.prevA;
  return pronto && !!miraTiro(s, (a.gittata ?? 20) * (a.tipo === 'lancio' ? 1 : 0.9));
}

// ---------------- armi ----------------
function inizia(s: TState, a: TArmaDef, caricato: boolean): void {
  const h = s.eroe, portata = a.portata ?? 1.5;
  guarda(s, mira(s, portata * 1.5));
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
      const dirX = d > 1e-6 ? dx / d : h.fx, dirZ = d > 1e-6 ? dz / d : h.fz;
      colpisci(s, z, { danno, mischia: true, caricato: h.caricato, dirX, dirZ, spinta: (a.spinta ?? 0) * (h.caricato ? 2 : 1) });
    }
  }
  if (k >= 1 && !h.colpito) {
    h.colpito = true;
    if (a.scia) accendi(s, h.x + h.fx * 1.4, h.z + h.fz * 1.4, a.scia); // la spada di de Molay: fiamme dove passa
    if (!h.colpiti.length) ev(s, { t: 'mancato' });
  }
}
/** Ricarica: dalla riserva al caricatore, se c'è qualcosa da mettere. */
function ricarica(s: TState, a: TArmaDef, sl: Slot): void {
  if (s.eroe.ricarica > 0 || sl.riserva <= 0 || sl.colpi >= (a.colpi ?? 0)) return;
  const h = s.eroe;
  h.ricaricaDur = secToTicks(a.ricarica ?? 0.6); h.ricarica = h.ricaricaDur;
  ev(s, { t: 'ricarica', arma: a.id });
}
function fineRicarica(s: TState): void {
  const sl = slotIn(s);
  if (!sl) return;
  const a = armaDef(sl.id), n = Math.min(sl.riserva, (a.colpi ?? 0) - sl.colpi);
  if (n > 0) { sl.colpi += n; sl.riserva -= n; }
}
/** Un colpo a distanza: freccia (tensione `k`), palla, ventaglio di pallini, vaso. */
function spara(s: TState, a: TArmaDef, sl: Slot, k: number): void {
  const h = s.eroe, g = a.gittata ?? 20, t = miraTiro(s, g);
  guarda(s, t);
  sl.colpi--;
  h.cd = secToTicks(a.tempo);
  const danno = a.danno * k;
  if (a.tipo === 'lancio') {
    const fino = t ? Math.min(g, Math.sqrt((t.x - h.x) * (t.x - h.x) + (t.z - h.z) * (t.z - h.z))) : g * 0.6;
    tira(s, a, h.fx, h.fz, danno, Math.max(2, fino));
  } else if ((a.pallini ?? 1) > 1) {
    const n = a.pallini!, cono = ((a.cono ?? 10) * Math.PI) / 180;
    for (let i = 0; i < n; i++) { const [fx, fz] = ruota(h.fx, h.fz, cono * (-1 + (2 * i) / (n - 1))); tira(s, a, fx, fz, danno, g); }
  } else tira(s, a, h.fx, h.fz, danno, g);
  ev(s, { t: 'sparo', arma: a.id, x: Math.round(h.x * 100) / 100, z: Math.round(h.z * 100) / 100 });
  if (sl.colpi <= 0) ricarica(s, a, sl);
}
function spallata(s: TState): void {
  const h = s.eroe, k = TEMPLARI.scudo.spallata;
  for (const z of vivi(s)) {
    const dx = z.x - h.x, dz = z.z - h.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > k.portata + z.def.raggio || (d > 1e-6 && (dx * h.fx + dz * h.fz) / d < 0.5)) continue;
    colpisci(s, z, { danno: k.danno, mischia: true, caricato: false, dirX: d > 1e-6 ? dx / d : h.fx, dirZ: d > 1e-6 ? dz / d : h.fz, spinta: k.spinta });
  }
}

/** Un'arma nuova: se ce l'hai già ricarica tutto; sennò nello slot libero, o al posto di quella in mano. */
export function daiArma(s: TState, id: string): void {
  const h = s.eroe, a = armaDef(id);
  const gia = h.armi.findIndex((x) => x?.id === id);
  if (gia >= 0) { h.armi[gia] = slotDi(a); return; }
  const libero = h.armi.findIndex((x) => x === null);
  const i = libero >= 0 ? libero : h.cur;
  h.armi[i] = slotDi(a); h.cur = i; h.inMano = false;
  h.act = 'idle'; h.actT = 0; h.ricarica = 0; h.cd = 0;
  ev(s, { t: 'scambia', arma: id });
}

// ---------------- AZIONE ----------------
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
export function vicinoAltare(s: TState): boolean {
  const h = s.eroe, a = s.arena.altare, r = TEMPLARI.altare.raggio;
  const dx = a.x - h.x, dz = a.z - h.z;
  return dx * dx + dz * dz <= r * r;
}
function muroVicino(s: TState): Muro | null {
  const h = s.eroe, r = TEMPLARI.muro.raggio;
  let best: Muro | null = null, bd = Infinity;
  for (const m of s.arena.muri) { const d = (m.x - h.x) * (m.x - h.x) + (m.z - h.z) * (m.z - h.z); if (d <= r * r && d < bd) { bd = d; best = m; } }
  return best;
}
function dropVicino(s: TState): number {
  const h = s.eroe;
  return s.drops.findIndex((d) => d.tipo === 'scudo' && d.fine > s.tick && (d.x - h.x) * (d.x - h.x) + (d.z - h.z) * (d.z - h.z) <= 2.25);
}
/** Cosa fa l'arma sul muro per te: comprarla, ricaricarla (e quanto), o niente (null = ce l'hai già, piena o senza munizioni). */
function offerta(s: TState, m: Muro): { munizioni: boolean; prezzo: number } | null {
  const a = armaDef(m.arma), sl = s.eroe.armi.find((x) => x?.id === m.arma);
  if (!sl) return { munizioni: false, prezzo: a.prezzo ?? 0 };
  if (a.tipo === 'mischia' || a.prezzoMunizioni === undefined) return null;
  if (sl.colpi >= (a.colpi ?? 0) && sl.riserva >= (a.riserva ?? 0)) return null;
  return { munizioni: true, prezzo: a.prezzoMunizioni };
}

/** Cosa farebbe AZIONE adesso (il bottone lo dice). */
export function prompt(s: TState): TPrompt {
  if (s.done) return null;
  if (s.fase === 'altare' && vicinoAltare(s)) return { cosa: 'reliquia', testo: 'Posa il calice', prezzo: 0, puoi: true };
  if (vicinoCassa(s)) {
    const c = s.cassa;
    if (c.fase === 'chiusa') return { cosa: 'cassa', testo: 'Cassa del tesoro', prezzo: TEMPLARI.cassa.prezzo, puoi: s.punti >= TEMPLARI.cassa.prezzo };
    if (c.fase === 'pronta' && c.arma) return { cosa: 'prendi', testo: `Prendi: ${armaDef(c.arma).nome}`, prezzo: 0, puoi: true };
  }
  if (dropVicino(s) >= 0 && (!s.eroe.scudo || s.eroe.scudo.vita < TEMPLARI.scudo.vita)) return { cosa: 'scudo', testo: 'Prendi lo scudo templare', prezzo: 0, puoi: true };
  const m = muroVicino(s), o = m ? offerta(s, m) : null;
  if (m && o) {
    const a = armaDef(m.arma);
    return { cosa: o.munizioni ? 'munizioni' : 'compra', testo: o.munizioni ? `Munizioni: ${a.nome}` : o.prezzo ? a.nome : `Prendi: ${a.nome}`, prezzo: o.prezzo, puoi: s.punti >= o.prezzo };
  }
  const f = finestraVicina(s);
  if (f >= 0) return { cosa: 'ripara', testo: 'Ripara la finestra', prezzo: 0, puoi: !strappata(s, f) };
  const p = portaVicina(s);
  if (p) { const d = portaDef(p.id); return { cosa: 'porta', testo: d.nome, prezzo: d.prezzo, puoi: s.punti >= d.prezzo }; }
  const l = levaVicina(s);
  if (l >= 0) {
    const d = trappolaDef(s.arena.trappole[l]!.id);
    if (trappolaAccesa(s, l)) return { cosa: 'trappola', testo: `${d.nome}: in funzione`, prezzo: 0, puoi: false };
    if (!trappolaPronta(s, l)) return { cosa: 'trappola', testo: `${d.nome}: si ricarica`, prezzo: 0, puoi: false };
    return { cosa: 'trappola', testo: d.nome, prezzo: d.prezzo, puoi: s.punti >= d.prezzo };
  }
  return null;
}

function azione(s: TState, dDown: boolean, dHeld: boolean): void {
  const h = s.eroe;
  if (s.fase === 'altare' && vicinoAltare(s)) {
    if (dDown) { s.fase = 'inizio'; s.faseT = 0; ev(s, { t: 'reliquia' }); }
    return;
  }
  if (dDown && vicinoCassa(s) && (s.cassa.fase === 'chiusa' || s.cassa.fase === 'pronta')) {
    const presa = usaCassa(s);
    if (presa) daiArma(s, presa);
    return;
  }
  const di = dropVicino(s);
  if (dDown && di >= 0 && (!h.scudo || h.scudo.vita < TEMPLARI.scudo.vita)) {
    h.scudo = { vita: TEMPLARI.scudo.vita };
    s.drops.splice(di, 1);
    ev(s, { t: 'scudo', preso: true });
    return;
  }
  const m = muroVicino(s), o = m ? offerta(s, m) : null;
  if (dDown && m && o) {
    if (!spendi(s, o.prezzo)) return;
    daiArma(s, m.arma);
    ev(s, { t: 'compra', arma: m.arma, munizioni: o.munizioni });
    return;
  }
  if (!dHeld) return;
  const f = finestraVicina(s);
  if (f < 0) {
    // niente finestre da riparare qui: le porte e le leve delle trappole (un tocco)
    if (!dDown) return;
    const p = portaVicina(s);
    if (p) { apriPorta(s, p); return; }
    const l = levaVicina(s);
    if (l >= 0) accendiTrappola(s, l);
    return;
  }
  if (strappata(s, f)) return;
  if (s.tick - h.riparaT < secToTicks(TEMPLARI.barricate.ripara)) return;
  h.riparaT = s.tick;
  const n = Math.min(TEMPLARI.barricate.assi, (s.assi[f] ?? 0) + 1);
  s.assi[f] = n;
  setFinestra(s.arena, s.gr, f, n);
  ev(s, { t: 'asse', finestra: f, assi: n, da: 'eroe' });
  const p = Math.min(TEMPLARI.punti.asse, Math.max(0, TEMPLARI.punti.assiMaxOndata - s.puntiAssi));
  if (p > 0) { s.puntiAssi += p; dai(s, p, 'asse'); }
}

/** SCAMBIA: arma 1 → arma 2 → scudo in mano → arma 1 (solo quello che hai). */
function scambia(s: TState): void {
  const h = s.eroe;
  if (h.act !== 'idle') return;
  const altro = h.armi.findIndex((x, i) => i !== h.cur && x !== null);
  if (h.inMano) { h.inMano = false; h.cur = h.armi[0] ? 0 : h.cur; ev(s, { t: 'scambia', arma: h.armi[h.cur]!.id }); return; }
  if (altro > h.cur) { h.cur = altro; h.ricarica = 0; ev(s, { t: 'scambia', arma: h.armi[altro]!.id }); return; }
  if (h.scudo) { h.inMano = true; h.ricarica = 0; ev(s, { t: 'scambia', arma: 'scudo' }); return; }
  if (altro >= 0) { h.cur = altro; h.ricarica = 0; ev(s, { t: 'scambia', arma: h.armi[altro]!.id }); }
}

export function stepEroe(s: TState, inp: TInput): void {
  const h = s.eroe, c = TEMPLARI.eroe;
  if (h.hurt > 0) h.hurt--;
  if (h.cd > 0) h.cd--;
  if (h.ricarica > 0 && --h.ricarica === 0) fineRicarica(s);
  const aDown = inp.a && !h.prevA, cDown = inp.c && !h.prevC, dDown = inp.d && !h.prevD;
  h.prevA = inp.a; h.prevC = inp.c; h.prevD = inp.d;
  azione(s, dDown, inp.d);
  if (cDown) scambia(s);
  const a = armaIn(s), sl = slotIn(s);
  // attacco
  h.actT++;
  switch (h.act) {
    case 'idle':
      h.actT = 0;
      if (!aDown) break;
      if (h.inMano) { h.act = 'spallata'; h.actDur = secToTicks(TEMPLARI.scudo.spallata.tempo); break; }
      if (a.tipo === 'mischia') { h.act = 'press'; break; }
      if (!sl || sl.colpi <= 0) { if (sl && sl.riserva > 0) ricarica(s, a, sl); else if (sl) ev(s, { t: 'vuoto', arma: a.id }); break; }
      if (h.ricarica > 0 || h.cd > 0) break;
      if (a.tipo === 'arco') { h.act = 'tende'; h.actDur = secToTicks(a.tempo); h.carica = 0; guarda(s, miraTiro(s, a.gittata ?? 20)); }
      else { spara(s, a, sl, 1); h.act = a.tipo === 'lancio' ? 'lancia' : 'spara'; h.actDur = a.tipo === 'lancio' ? ANIM_LANCIO : ANIM_TIRO; }
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
    case 'tende':
      h.carica = Math.min(1, h.actT / h.actDur);
      if (!inp.a && sl) { spara(s, a, sl, Math.max(0.25, h.carica)); h.act = 'tira'; h.actT = 0; h.actDur = ANIM_TIRO; h.carica = 0; }
      break;
    case 'spallata':
      if (h.actT === Math.floor(h.actDur / 2)) spallata(s);
      if (h.actT >= h.actDur) { h.act = 'idle'; h.actT = 0; }
      break;
    default: // tira, spara, lancia
      if (h.actT >= h.actDur) { h.act = 'idle'; h.actT = 0; }
  }
  // movimento: corsa con B o col joystick in fondo, finché c'è fiato; con lo scudo in mano piano
  let mx = inp.mx, my = inp.my;
  const mag = Math.sqrt(mx * mx + my * my);
  if (mag > 1) { mx /= mag; my /= mag; }
  // sfiorato: si gira sul posto (non durante un colpo che tiene la sua direzione)
  if (mag > 0.05 && mag <= GIRA_SUL_POSTO) {
    if (h.act !== 'swing' && h.act !== 'tira' && h.act !== 'spara' && h.act !== 'lancia') { h.fx = mx / mag; h.fz = my / mag; }
    mx = 0; my = 0;
  }
  h.moving = mag > GIRA_SUL_POSTO;
  const lento = h.act !== 'idle';
  h.corre = h.moving && (inp.b || mag > 0.92) && !lento && !h.inMano && h.fiato > 0;
  if (h.corre) h.fiato = Math.max(0, h.fiato - DT);
  else h.fiato = Math.min(c.fiato, h.fiato + (c.fiato / c.fiatoPieno) * DT * (h.moving ? 0.5 : 1));
  let v = h.corre ? c.corsa : c.camminata;
  if (lento) v *= c.mentreAttacca;
  if (h.inMano) v *= TEMPLARI.scudo.lentezza;
  if (h.moving) {
    moveCircle(s.gr.eroe, h, mx * v * DT, my * v * DT, c.raggio);
    if (h.act !== 'swing' && h.act !== 'tende' && h.act !== 'tira' && h.act !== 'spara' && h.act !== 'lancia') { h.fx = mx / mag; h.fz = my / mag; }
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
