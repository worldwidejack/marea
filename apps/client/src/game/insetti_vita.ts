// Come si muovono gli insetti di Borgo Marea (#445): le quattro macchine a stati del foglio «Specifiche FSM» dell'Excel di Riccardo
// (volanti, a terra, dai sassi, dagli alberi scossi), ritoccate dal comportamento della specie (insetti.json `comportamento`).
// Solo client e solo aspetto: dove sta un insetto lo decide questo file, chi esce e se è stato preso lo decide il server
// (@marea/sim economy/insetti.ts e rpg/insetti.ts). Niente three: game/insetti.ts disegna.
import { INSETTI_CFG } from '@marea/content/insetti.ts';
import type { InsettoDef } from '@marea/content/insetti.ts';

export type Stato =
  | 'giro'      // in giro (vola o cammina attorno a casa)
  | 'fermo'     // fermo: mantide che ti guarda, porcellino a palla, chiocciola nel guscio, scorpione con le chele alzate, foglia che dorme
  | 'calmo'     // scorpione con le chele giù: si può avvicinare
  | 'scappa'    // corre via a terra
  | 'salta'     // locusta e grillo in volo di un balzo
  | 'carica'    // scorpione e vespa che ti puntano
  | 'cade'      // giù dall'albero
  | 'stordito'  // a terra a pancia in su (cimice, cicala, Ercole)
  | 'appeso'    // ragno e verme col filo
  | 'via'       // vola via (sale e sparisce) o si infila sotto terra
  | 'preso';    // nel retino
export type Attore = {
  k: string; def: InsettoDef;
  x: number; z: number; y: number; h: number;
  /** Casa: la cella del turno (in giro), il sasso o l'albero (usciti). */
  cx: number; cz: number;
  stato: Stato; t: number; vita: number;
  /** Velocità a terra (pattina: inerzia). */
  vx: number; vz: number;
  /** Fino a quando si può prendere (s di `vita`); Infinity = in giro. */
  fino: number;
  seme: number;
  /** 0..1: quanto si vede (sparisce volando via). */
  alfa: number;
  /** Ragno e verme: lunghezza del filo; vespa: il nido. */
  filo: number; cima: number;
  /** Per il balzo: da dove a dove. */
  sx: number; sz: number; ex: number; ez: number;
};
/** Chi gioca, visto dagli insetti. */
export type Chi = { x: number; z: number; v: number; corre: boolean; fermoDa: number; retino: boolean };
export type Eventi = { punto?: string; tonfo?: boolean };
/** Il mondo: si può camminare qui? quota del terreno. */
export type Mondo = { terra(x: number, z: number): boolean; y(x: number, z: number): number };

const PASSI = INSETTI_CFG.passi;
export const volante = (a: Attore): boolean => a.def.tipo === 'volante' || a.stato === 'via' && a.def.tipo !== 'sasso';
const d2 = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
/** Prua (rad) per andare verso (dx, dz): come prua() degli animali, avanti = −Z. */
const prua = (dx: number, dz: number) => Math.atan2(dx, -dz);
const avanti = (a: Attore, v: number, dt: number, m: Mondo, solo = true): void => {
  const nx = a.x + Math.sin(a.h) * v * dt, nz = a.z - Math.cos(a.h) * v * dt;
  if (!solo || m.terra(nx, nz)) { a.x = nx; a.z = nz; } else a.h = wrap(a.h + Math.PI * (0.6 + 0.4 * Math.sin(a.seme * 9 + a.vita)));
};
const verso = (a: Attore, tx: number, tz: number, k: number, dt: number) => { a.h = wrap(a.h + wrap(prua(tx - a.x, tz - a.z) - a.h) * Math.min(1, k * dt)); };
const via = (a: Attore) => { if (a.stato !== 'via' && a.stato !== 'preso') { a.stato = 'via'; a.t = 0; } };

/** Nuovo attore: `x, z` dove compare, `cx, cz` la sua casa. */
export function nuovoAttore(k: string, def: InsettoDef, x: number, z: number, seme: number, cx = x, cz = z): Attore {
  return { k, def, x, z, y: 0, h: seme * Math.PI * 2, cx, cz, stato: 'giro', t: 0, vita: 0, vx: 0, vz: 0, fino: Infinity, seme, alfa: 1, filo: 0, cima: 0, sx: x, sz: z, ex: x, ez: z };
}
/** Uscito da un sasso: dove e come parte. */
export function daSasso(a: Attore): Attore {
  a.fino = a.def.finestra;
  a.stato = a.def.comportamento === 'pausa' || a.def.comportamento === 'intontito' ? 'fermo' : 'scappa';
  return a;
}
/** Caduto da un albero: dall'alto della chioma. */
export function daAlbero(a: Attore, chioma: number): Attore {
  a.fino = a.def.finestra; a.cima = chioma;
  if (a.def.comportamento === 'filo') { a.stato = 'appeso'; a.filo = 0; a.y = chioma; }
  else { a.stato = 'cade'; a.y = chioma; }
  return a;
}

/** Può finire nel retino adesso? (la chiocciola nel guscio no, chi è già volato via no). */
export function prendibile(a: Attore): boolean {
  if (a.stato === 'via' || a.stato === 'preso' || a.stato === 'cade') return false;
  if (a.def.comportamento === 'guscio' && a.stato === 'fermo') return false;
  return a.vita <= a.fino;
}

/** Un passo di vita. Ritorna gli eventi per chi gioca (punture, tonfi). */
export function vive(a: Attore, chi: Chi, dt: number, m: Mondo): Eventi {
  const ev: Eventi = {}, def = a.def, b = def.comportamento, v = PASSI[def.velocita] ?? 1.2, dist = d2(a.x, a.z, chi.x, chi.z);
  a.t += dt; a.vita += dt;
  if (a.stato === 'preso') return ev;
  if (a.stato === 'via') {
    a.alfa = Math.max(0, 1 - a.t / 1.5);
    if (def.tipo === 'sasso' || (def.tipo === 'terra' && b !== 'calpesta' && b !== 'fissa' && b !== 'trillo')) { a.y -= dt * 0.3; avanti(a, v, dt, m, false); } // si infila sotto terra o tra i cespugli
    else { a.y += dt * 2.2; avanti(a, v * 2, dt, m, false); }
    return ev;
  }
  // scaduta la finestra: chi è uscito da un sasso si rintana, chi è caduto da un albero riparte (il ragno si riavvolge)
  if (a.vita > a.fino && a.stato !== 'appeso') { via(a); return ev; }
  const allerta = def.allerta, vicino = dist < allerta, sgambetto = chi.corre && dist < 0.6;
  switch (def.tipo) {
    case 'volante': {
      if (chi.corre && vicino) { via(a); break; }
      const base = b === 'lucciola' || b === 'basso' ? 0.5 : 1.0;
      a.y = base + Math.sin(a.vita * (b === 'maestosa' ? 1.4 : 3.1) + a.seme * 7) * (b === 'maestosa' ? 0.25 : 0.15);
      if (b === 'diagonale') { a.h = Math.PI + Math.sin(a.vita * 0.9 + a.seme) * 0.5; avanti(a, v * 0.5, dt, m, false); if (a.z - a.cz > 30) { a.z = a.cz - 30; } break; }
      if (b === 'cerchi') { const ang = a.vita * 1.6 + a.seme * 6; a.x = a.cx + Math.cos(ang) * 1.3; a.z = a.cz + Math.sin(ang) * 1.3; a.h = ang + Math.PI; a.y = 1.6 + Math.sin(a.vita * 4) * 0.12; break; }
      // gli altri girano attorno a casa entro 4 m: zig-zag, soste a mezz'aria (ape), scatti con pausa di un secondo (libellula)
      const ciclo = b === 'scatti' ? (a.vita + a.seme * 3) % 1.6 : b === 'soste' ? (a.vita + a.seme * 3) % 2.5 : 0;
      const fermo = b === 'scatti' ? ciclo > 0.6 : b === 'soste' ? ciclo > 1.5 : false;
      const vel = b === 'scatti' ? (fermo ? 0 : v) : b === 'maestosa' ? v * 0.5 : v * 0.6;
      if (d2(a.x, a.z, a.cx, a.cz) > 4) verso(a, a.cx, a.cz, 2.5, dt);
      else a.h = wrap(a.h + Math.sin(a.vita * (b === 'zigzag' ? 3.2 : 1.3) + a.seme * 11) * dt * (b === 'zigzag' ? 3 : 1.2));
      if (!fermo) avanti(a, vel, dt, m, false);
      break;
    }
    case 'terra': {
      if (b === 'gruppo') { // formiche: in fila, piano, non scappano mai
        a.h = wrap(a.h + Math.sin(a.vita * 0.7 + a.seme * 5) * dt * 0.8); if (d2(a.x, a.z, a.cx, a.cz) > 2.5) verso(a, a.cx, a.cz, 2, dt);
        avanti(a, v * 0.5, dt, m); break;
      }
      if (b === 'calpesta' || b === 'cammina') { if (sgambetto || (b === 'cammina' && chi.corre && vicino)) { via(a); break; } }
      if (b === 'fissa') {
        if (vicino && chi.corre) { via(a); break; }
        if (vicino) { a.stato = 'fermo'; verso(a, chi.x, chi.z, 4, dt); break; }
        a.stato = 'giro';
      }
      if (b === 'trillo' && vicino && chi.corre) { salta(a, chi, 3.5); a.fino = a.vita + 2; break; }
      if (b === 'foglia') {
        if (a.stato === 'giro' && a.fino === Infinity) { a.stato = 'fermo'; }
        if (a.stato === 'fermo') { if (vicino) { a.stato = 'scappa'; a.t = 0; a.fino = a.vita + def.finestra; } break; }
      }
      if (b === 'chele') { if (scorpione(a, chi, dist, dt, m, v, ev)) break; }
      if (b === 'balzi') {
        if (a.stato === 'salta') { balzo(a, dt, m); break; }
        if (vicino) { salta(a, chi, 3 + (a.seme * 2) % 1.5); break; }
      }
      if (a.stato === 'salta') { balzo(a, dt, m); break; }
      const scappa = a.stato === 'scappa' || (vicino && (b === 'pattuglia' || b === 'pattina' || b === 'cammina' || b === 'foglia'));
      if (scappa) {
        const lontano = prua(a.x - chi.x, a.z - chi.z);
        if (b === 'pattina') {
          // pattina: gira di colpo ma la velocità segue piano (scivola)
          a.h = lontano; const tx = Math.sin(a.h) * v, tz = -Math.cos(a.h) * v, k = Math.min(1, dt * 1.2);
          a.vx += (tx - a.vx) * k; a.vz += (tz - a.vz) * k;
          const nx = a.x + a.vx * dt, nz = a.z + a.vz * dt; if (m.terra(nx, nz)) { a.x = nx; a.z = nz; } else { a.vx *= -0.5; a.vz *= -0.5; }
        } else { verso(a, a.x + Math.sin(lontano), a.z - Math.cos(lontano), 6, dt); avanti(a, v, dt, m); }
        if (!vicino && a.stato !== 'scappa') a.stato = 'giro';
        if (dist > allerta * 3 && a.stato === 'scappa' && b !== 'foglia') a.stato = 'giro';
        break;
      }
      // in giro: due passi e una sosta attorno a casa
      if (d2(a.x, a.z, a.cx, a.cz) > 3.5) verso(a, a.cx, a.cz, 2, dt); else a.h = wrap(a.h + Math.sin(a.vita * 0.9 + a.seme * 13) * dt * 1.4);
      if ((a.vita + a.seme * 4) % 3 < 2) avanti(a, v * 0.35, dt, m);
      break;
    }
    case 'sasso': {
      if (b === 'guscio') {
        if (a.stato === 'fermo') { if (chi.fermoDa >= 2) { a.stato = 'giro'; a.t = 0; } break; }
        if (chi.corre && dist < allerta) { a.stato = 'fermo'; a.t = 0; break; }
        if (d2(a.x, a.z, a.cx, a.cz) < 2.5) { verso(a, a.x + (a.x - a.cx), a.z + (a.z - a.cz), 2, dt); avanti(a, v * 0.4, dt, m); }
        break;
      }
      if (a.stato === 'fermo') { if (a.t >= (b === 'intontito' ? 1.5 : 1)) { a.stato = 'scappa'; a.t = 0; } break; } // a palla (o intontito) poi via
      if (b === 'giratondo') { const ang = a.vita * (v / 0.9) + a.seme * 6; a.x = a.cx + Math.cos(ang) * 0.9; a.z = a.cz + Math.sin(ang) * 0.9; a.h = ang + Math.PI; break; }
      const lontano = prua(a.x - chi.x, a.z - chi.z) + (b === 'subito' ? Math.sin(a.vita * 9) * 0.9 : b === 'intontito' ? Math.sin(a.vita * 3) * 1.2 : 0);
      verso(a, a.x + Math.sin(lontano), a.z - Math.cos(lontano), 8, dt);
      avanti(a, b === 'intontito' ? v * 0.6 : v, dt, m);
      break;
    }
    case 'albero': {
      if (a.stato === 'cade') {
        a.y = Math.max(0, a.y - dt * 7);
        if (a.y <= 0) { a.y = 0; a.t = 0; a.stato = b === 'nido' ? 'fermo' : b === 'striscia' ? 'scappa' : 'stordito'; if (def.id === 'ercole') ev.tonfo = true; }
        break;
      }
      if (a.stato === 'appeso') {
        const scade = a.vita > a.fino;
        a.filo = scade ? Math.max(0, a.filo - dt * (b === 'filo' && def.id === 'astuccio' ? 4 : 2)) : Math.min(a.cima - 1.0, a.filo + dt * 2.5);
        a.y = a.cima - a.filo; a.x = a.cx + Math.sin(a.vita * 2.2 + a.seme) * 0.12;
        if (scade && a.filo <= 0) { a.alfa = 0; a.stato = 'via'; a.t = 99; }
        break;
      }
      if (b === 'nido') { // la vespa esce dal nido dopo un attimo e ti insegue: col retino in mano la prendi, se no punge
        if (a.stato === 'fermo') { a.y = 0.3; if (a.t > 0.6) { a.stato = 'carica'; a.t = 0; } break; }
        a.y = 1.0 + Math.sin(a.vita * 20) * 0.05; verso(a, chi.x, chi.z, 8, dt); avanti(a, v * 0.75, dt, m, false);
        if (d2(a.x, a.z, chi.x, chi.z) < 0.45) { ev.punto = 'Ahi! La vespa ti ha punto'; via(a); }
        break;
      }
      if (a.stato === 'scappa') { const lontano = prua(a.x - chi.x, a.z - chi.z); verso(a, a.x + Math.sin(lontano), a.z - Math.cos(lontano), 2, dt); avanti(a, v * 0.4, dt, m); }
      break; // stordito: fermo a pancia in su finché non scade la finestra
    }
  }
  return ev;
}
/** Lo scorpione (Excel BUG-020): col retino in mano e vicino alza le chele per 2 s; se ti muovi mentre ti punta, carica e punge. */
function scorpione(a: Attore, chi: Chi, dist: number, dt: number, m: Mondo, v: number, ev: Eventi): boolean {
  if (a.stato === 'carica') {
    verso(a, chi.x, chi.z, 10, dt); avanti(a, v, dt, m);
    if (dist < 0.5) { ev.punto = 'Ahi! Lo scorpione ti ha punto'; via(a); }
    else if (a.t > 2.5) { a.stato = 'giro'; a.t = 0; }
    return true;
  }
  if (a.stato === 'fermo') {
    verso(a, chi.x, chi.z, 6, dt);
    if (chi.v > 0.3 && a.t > 0.25) { a.stato = 'carica'; a.t = 0; }
    else if (a.t > 2) { a.stato = 'calmo'; a.t = 0; }
    return true;
  }
  if (a.stato === 'calmo') { if (a.t > 3) { a.stato = 'giro'; a.t = 0; } return true; }
  if (chi.retino && dist < a.def.allerta) { a.stato = 'fermo'; a.t = 0; return true; }
  return false;
}
function salta(a: Attore, chi: Chi, lungo: number): void {
  const h = prua(a.x - chi.x, a.z - chi.z) + Math.sin(a.seme * 17 + a.vita) * 0.5;
  a.stato = 'salta'; a.t = 0; a.sx = a.x; a.sz = a.z; a.ex = a.x + Math.sin(h) * lungo; a.ez = a.z - Math.cos(h) * lungo; a.h = h;
}
function balzo(a: Attore, dt: number, m: Mondo): void {
  const k = Math.min(1, a.t / 0.6);
  const nx = a.sx + (a.ex - a.sx) * k, nz = a.sz + (a.ez - a.sz) * k;
  if (m.terra(nx, nz)) { a.x = nx; a.z = nz; } else { a.ex = a.x; a.ez = a.z; }
  a.y = Math.sin(k * Math.PI) * 0.9;
  if (k >= 1) { a.y = 0; a.stato = a.def.comportamento === 'trillo' ? 'scappa' : 'giro'; a.t = 0; }
  void dt;
}
