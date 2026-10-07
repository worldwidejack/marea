// Colpi di mischia come archi spazzati dalla lama (docs/RPG.md §4): stile del colpo dall'arma, angolo della lama a ogni fase dello swing e
// test «la lama è già passata su questo nemico?». La sim (hero.ts) colpisce con questi numeri e il client (rpg/dungeon_hero.ts) anima
// braccio, arma e scia con le stesse funzioni: quel che si vede è quel che colpisce. Angoli relativi alla faccia dell'eroe, positivi a
// destra; la lama gira verso sinistra. Niente funzioni trascendenti (regola in types.ts): l'angolo di un vettore è un arcotangente
// polinomiale fatto solo di + − × ÷ (errore < 0,001°), identico su ogni motore JS.
import type { RunWeapon } from '../rpg/types.ts';
import { hasItem, itemDef } from '../rpg/items.ts';
import { COLPI } from './tuning.ts';

export type SwingStyle = keyof typeof COLPI;
const TAU = 2 * Math.PI;

/** Stile del colpo: caricato pieno = giro completo; lancia = affondo stretto; pugni = gancio; il resto = fendente largo. */
export function swingStyle(a: RunWeapon, caricato: boolean): SwingStyle {
  if (caricato) return 'giro';
  if (a.kind === 'pugni') return 'pugno';
  return a.id && hasItem(a.id) && itemDef(a.id).tipo === 'lancia' ? 'affondo' : 'fendente';
}

/** 0..1: quanto dell'arco la lama ha già spazzato alla fase `t` (0..1) dello swing. */
export function swept(st: SwingStyle, t: number): number {
  const c = COLPI[st];
  return Math.max(0, Math.min(1, (t - c.da) / (c.a - c.da)));
}

/** Angolo della lama (rad, relativo alla faccia, + = destra) alla fase `t`: fermo a `inizio` prima della finestra, a `inizio − arco` dopo. */
export function bladeAngle(st: SwingStyle, t: number): number {
  const c = COLPI[st];
  return c.inizio - c.arco * swept(st, t);
}

/** atan2(y, x) in [−π, π] con un polinomio (Abramowitz-Stegun 4.4.49) sull'ottante: solo + − × ÷. */
export function angolo(y: number, x: number): number {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax === 0 && ay === 0) return 0;
  const r = ax >= ay ? ay / ax : ax / ay, r2 = r * r;
  let a = r * (0.9998660 + r2 * (-0.3302995 + r2 * (0.1801410 + r2 * (-0.0851330 + r2 * 0.0208351))));
  if (ay > ax) a = Math.PI / 2 - a;
  if (x < 0) a = Math.PI - a;
  return y < 0 ? -a : a;
}

const mod2pi = (v: number): number => v - TAU * Math.floor(v / TAU);

/**
 * Di quanto (rad, 0..2π) la lama deve girare dall'inizio dell'arco per toccare un bersaglio a (dx, dz) dall'eroe che guarda (fx, fz),
 * di raggio `r`: 0 se l'inizio dell'arco cade già sopra di lui (o se è attaccato all'eroe, `addosso`). Il bersaglio è colpito quando
 * `swept × arco ≥` questo valore.
 */
export function sweepTo(st: SwingStyle, fx: number, fz: number, dx: number, dz: number, r: number, addosso: boolean): number {
  if (addosso) return 0;
  const d2 = dx * dx + dz * dz;
  if (d2 <= r * r) return 0;
  const fwd = dx * fx + dz * fz, rt = dz * fx - dx * fz; // componenti avanti e a destra (destra = (−fz, fx))
  const phi = angolo(rt, fwd), w = angolo(r, Math.sqrt(d2 - r * r)); // mezza larghezza angolare del bersaglio
  const ini = COLPI[st].inizio, lead = mod2pi(ini - (phi + w)), trail = mod2pi(ini - (phi - w));
  return trail < lead ? 0 : lead;
}
