// Come si disegna un insetto di Borgo Marea: la posa (ali su e giù, la posa speciale), la quota, la grandezza, l'ombra
// di chi è in aria e le cose che si porta dietro (il nido della vespa, il filo del ragno, il lume della lucciola, la pallina dello
// stercorario, il mucchietto del lombrico). Lo chiama game/insetti.ts a ogni frame per ogni insetto vicino.
import type * as THREE from 'three';
import type { Disegna } from './animali_vita.ts';
import type { Attore } from './insetti_vita.ts';
import { FILO, LUME, MUCCHIO, NIDO, OMBRA, PALLINA, formeInsetto } from '../render/insetti_forme.ts';

/** Quanto più grandi del vero (le forme sono già grandi): dalla camera diorama si devono vedere. */
const SCALA = 1.7;
/** Chi è più grande (o più piccolo) degli altri. */
const TAGLIA: Record<string, number> = {
  regina: 1.35, atlante: 1.9, falena_luna: 1.3, scolopendra: 1.15, calabrone: 1.35, tarantola: 1.3, cervo_volante: 1.2, sfinge: 1.2, stecco: 0.9,
  mosca: 0.7, collembolo: 0.6, pesciolino: 0.9,
};
/** Chi da fermo prende la posa speciale (palla, guscio, foglia, chele, ali chiuse, rametto, sassolino…). */
const POSA_FERMO = new Set(['pausa', 'guscio', 'foglia', 'fissa', 'chele', 'impenna', 'orchidea', 'corazza', 'lascia', 'rametto', 'fiori', 'stella', 'intimidisce']);

/** Disegna l'insetto `a` (terreno a quota `g`); `notte`: la lucciola accende il lume (nella mesh `luce` che brilla, col colore `giallo`). */
export function disegnaInsetto(a: Attore, g: number, notte: boolean, put: Disegna, luce: Disegna, giallo: THREE.Color, suolo: (x: number, z: number) => number): void {
  const fm = formeInsetto(a.def), b = a.def.comportamento;
  const inAria = a.def.tipo === 'volante' || a.stato === 'plana' || (b === 'calabrone' && a.stato === 'carica') || (a.stato === 'via' && a.y > 0.2);
  const passo = Math.floor(a.vita * (inAria ? 14 : 7) + a.seme * 5) % 2 === 0;
  let posa = passo ? fm.a : fm.b, roll = 0, pitch = 0, su = 0;
  if ((a.stato === 'fermo' && POSA_FERMO.has(b)) || ((b === 'chele' || b === 'impenna' || b === 'intimidisce') && a.stato === 'carica') || (a.stato === 'salta' && a.def.tipo !== 'volante') || a.stato === 'rotola') posa = fm.c;
  if (b === 'termiche' && a.stato === 'fermo') posa = fm.b; // planata ad ali aperte
  if (b === 'fisarmonica') posa = Math.sin(a.vita * 3) > 0 ? fm.a : fm.b;
  if (a.stato === 'stordito') { roll = Math.PI; posa = fm.b; su = 0.12; }
  if (b === 'morde' && a.stato === 'fermo') pitch = 0.6; // la scolopendra si impenna
  if (a.stato === 'plana') pitch = -0.15;
  if (b === 'lascia' && a.stato === 'fermo' && a.y > 0.05) roll = Math.sin(a.t * 6) * 0.5;
  if (b === 'molla') su = Math.abs(Math.sin(a.vita * 9)) * 0.22; // il saltello si vede, ma si prende sull'ombra
  if (b === 'nido' && (a.stato === 'cade' || a.stato === 'fermo')) { put(NIDO, a.x, g + Math.max(0, a.y - 0.3), a.z, 0); if (a.stato === 'cade') return; }
  if (b === 'nido' && a.stato !== 'cade') put(NIDO, a.cx, g, a.cz, 0);
  if (a.stato === 'appeso') { put(FILO, a.x, g + a.y, a.z, 0, 0, 0, 1); put(FILO, a.x, g + a.y + 1, a.z, 0, 0, 0, Math.max(0.01, a.filo - 1)); }
  if (b === 'pallina') { const bx = a.u ? a.sx : a.x + Math.sin(a.h) * 0.3, bz = a.u ? a.sz : a.z - Math.cos(a.h) * 0.3; put(PALLINA, bx, suolo(bx, bz), bz, a.h, a.u ? a.vita * 6 : a.vita * 3); }
  if (b === 'fisarmonica' && a.stato === 'via') put(MUCCHIO, a.x, g, a.z, a.seme * 6);
  const s = SCALA * (TAGLIA[a.def.id] ?? (a.def.forma === 'formica' ? 0.85 : 1)), y = g + su + a.y;
  put(posa, a.x, y, a.z, a.h, pitch, roll, s * (a.stato === 'via' || a.stato === 'acqua' ? Math.max(0.3, a.alfa) : 1));
  if ((inAria || b === 'molla') && a.stato !== 'via' && a.stato !== 'acqua') put(OMBRA, a.x, g + 0.02, a.z, 0, 0, 0, s * 0.7);
  if (b === 'lucciola' && notte && (a.vita + a.seme * 3) % 2.2 < 1.4) luce(LUME, a.x - Math.sin(a.h) * 0.12, y, a.z + Math.cos(a.h) * 0.12, 0, 0, 0, 1, giallo, giallo);
}
