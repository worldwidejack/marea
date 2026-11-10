// Ulti e Vigore dell'Arena (docs/ARENA.md §7): sopra la sim del round, senza toccare quella dei dungeon.
// Ulti: ogni eroe ne ha una (ArenaEroe.ulti, numeri in arena.json → ulti). Si carica giocando (al secondo, col danno dato e preso), resta da un
// round all'altro, si lancia piena con l'azione `ulti`. Furia e Scatto sono buff (furiaDanno, passo e corsaGratis); Aura cura chi le sta vicino;
// Raggio della Marea: fermo, carica e poi un raggio dritto che si gira piano; Arpione: un gancio dritto, chi prende viene tirato fino a te e
// resta stordito; Velo: per un po' gli avversari non ti vedono, come nell'erba alta (dungeon/erba.ts). Chi carica, spara, lancia o è tirato sta
// fermo: il suo input non conta.
// Vigore: serve a correre e a schivare, non a colpire; la schivata in Arena costa ARENA.build.staminaSchivata (più che nei dungeon).
// Pura e deterministica: solo + − × ÷ e Math.sqrt.
import { ARENA, arenaUlti } from '@marea/content/arena.ts';
import { RPG } from '@marea/content/rpg.ts';
import { DT } from '../constants.ts';
import type { DungeonInput } from '../dungeon/types.ts';
import { NO_DUNGEON_INPUT } from '../dungeon/types.ts';
import { conEroe, secToTicks } from '../dungeon/state.ts';
import type { DungeonState } from '../dungeon/state.ts';
import { isOpaque, moveCircle } from '../dungeon/map.ts';
import { colpisciEroe, eroiNemici } from '../dungeon/pvp.ts';
import { scopri } from '../dungeon/erba.ts';
import type { ArenaEroe } from '../rpg/arena.ts';

/** Ulti di un eroe: la carica (0..max) e, se è in corso, la fase e quanti tick restano. Arpione: dove sta il gancio, quanta strada ha fatto,
 *  chi ha preso (-1 nessuno). Raggio: quanto è lungo adesso (fino al primo muro). `stordito`: tick in cui l'eroe resta fermo (preso
 *  dall'arpione di un altro). Vigore: l'azione dell'eroe al tick prima. `fatti`/`presi`:
 *  il danno del round già contato per la carica. */
export type UltiRt = {
  id: string; carica: number;
  fase: 'no' | 'su' | 'carica' | 'fuoco' | 'volo' | 'tiro'; resto: number;
  x: number; z: number; fx: number; fz: number; strada: number; preso: number; lungo: number;
  stordito: number; act: string; fatti: number; presi: number;
};
/** Il pezzo di DuelloState che serve qui. */
type D = { s: DungeonState; eroi: readonly ArenaEroe[]; ul: UltiRt[]; fase: string; squadre: number[] };

const C = ARENA.ulti.carica, OGNI = Math.round(secToTicks(1) / 6); // effetti a impulsi: 6 al secondo
const r2 = (v: number): number => Math.round(v * 100) / 100;
export const nuovaUlti = (e: ArenaEroe): UltiRt => ({ id: arenaUlti(e.ulti).id, carica: 0, fase: 'no', resto: 0, x: 0, z: 0, fx: 0, fz: 1, strada: 0, preso: -1, lungo: 0, stordito: 0, act: 'idle', fatti: 0, presi: 0 });
/** Round nuovo: niente ulti in corso, danno contato da zero; la carica resta. */
export function roundUlti(d: D): void { for (const u of d.ul) { u.fase = 'no'; u.resto = 0; u.preso = -1; u.stordito = 0; u.act = 'idle'; u.fatti = 0; u.presi = 0; } }
/** Chi sta fermo per un'ulti: chi carica o spara il raggio, chi lancia l'arpione, chi ne è stato preso. */
export const fermo = (d: D, i: number): boolean => {
  const u = d.ul[i]!;
  return u.fase === 'carica' || u.fase === 'fuoco' || u.fase === 'volo' || u.fase === 'tiro' || d.ul.some((v) => v.fase === 'tiro' && v.preso === i) || stordito(d, i);
};
const stordito = (d: D, i: number): boolean => (d.ul[i]?.stordito ?? 0) > 0;
const pronta = (u: UltiRt): boolean => u.carica >= C.max && u.fase === 'no';

/** L'eroe i lancia la sua ulti (piena, nessuna in corso, in gioco): true = partita. */
export function attivaUlti(d: D, i: number): boolean {
  const u = d.ul[i], r = d.s.eroi[i];
  if (!u || !r || r.done || d.fase !== 'gioca' || !pronta(u) || stordito(d, i)) return false;
  const U = arenaUlti(u.id), h = r.hero, s = d.s;
  u.carica = 0; u.fx = h.fx; u.fz = h.fz;
  const fine = s.tick + secToTicks(U.secondi ?? 0);
  if (u.id === 'furia') h.buffs.push({ mod: 'furiaDanno', valore: U.danno ?? 1, fine });
  else if (u.id === 'scatto') h.buffs.push({ mod: 'passo', valore: U.passo ?? 1, fine }, { mod: 'corsaGratis', valore: 1, fine });
  if (u.id === 'marea') { u.fase = 'carica'; u.resto = secToTicks(U.carica ?? 0.5); }
  else if (u.id === 'arpione') { u.fase = 'volo'; u.x = h.x + h.fx * 0.4; u.z = h.z + h.fz * 0.4; u.strada = 0; u.preso = -1; u.resto = secToTicks(1); }
  else { u.fase = 'su'; u.resto = secToTicks(U.secondi ?? 1); }
  if (u.id === 'velo' && s.pvp) { (s.pvp.velo ??= s.eroi.map(() => 0))[i] = fine; s.pvp.rivela[i] = 0; }
  return true;
}

/** Gli input del tick: fermi quelli presi da un'ulti; chi non ha il Vigore che costa una schivata non la comincia. Chi carica o spara il raggio della Marea
 *  si gira piano verso dove spinge il joystick. */
export function inputUlti(d: D, inputs: readonly DungeonInput[]): DungeonInput[] {
  return inputs.map((inp, i) => {
    const r = d.s.eroi[i], u = d.ul[i];
    if (!r || !u || r.done) return inp;
    if (fermo(d, i)) {
      if ((u.fase === 'carica' || u.fase === 'fuoco') && (inp.mx || inp.my)) gira(u, inp.mx, inp.my, arenaUlti(u.id).giro ?? 1);
      return { ...NO_DUNGEON_INPUT };
    }
    return inp.roll && r.hero.stamina < ARENA.build.staminaSchivata ? { ...inp, roll: false } : inp;
  });
}
/** Il raggio si gira verso (mx, my) di al massimo `giro` al secondo (in radianti, circa): niente trigonometria, una media normalizzata. */
function gira(u: UltiRt, mx: number, my: number, giro: number): void {
  const l = Math.sqrt(mx * mx + my * my), k = Math.min(1, giro * DT);
  const x = u.fx + (mx / l - u.fx) * k, z = u.fz + (my / l - u.fz) * k, n = Math.sqrt(x * x + z * z);
  if (n > 1e-6) { u.fx = x / n; u.fz = z / n; }
}

/** Dopo il passo della sim: il di più del Vigore delle schivate appena partite, gli effetti delle ulti in corso, la carica. */
export function dopoUlti(d: D): void {
  const s = d.s;
  for (let i = 0; i < d.ul.length; i++) {
    const u = d.ul[i]!, r = s.eroi[i]!, h = r.hero;
    if (u.stordito > 0) u.stordito--;
    // Vigore: la schivata appena partita costa più che nei dungeon (la sim ne ha tolto RPG.schivata.stamina)
    if (h.act === 'schiva' && u.act !== 'schiva') h.stamina = Math.max(0, h.stamina - (ARENA.build.staminaSchivata - RPG.schivata.stamina));
    u.act = h.act;
    if (r.done) { if (u.fase !== 'no') { u.fase = 'no'; u.preso = -1; } continue; }
    if (u.fase !== 'no') effetto(d, i, u);
    // la carica: niente mentre un'ulti è in corso
    const dato = r.danniFatti - u.fatti, preso = r.danniPresi - u.presi;
    u.fatti = r.danniFatti; u.presi = r.danniPresi;
    if (u.fase === 'no' && u.carica < C.max) u.carica = Math.min(C.max, u.carica + C.alSecondo * DT + C.dato * dato + C.preso * preso);
  }
}

function effetto(d: D, i: number, u: UltiRt): void {
  const s = d.s, U = arenaUlti(u.id), h = s.eroi[i]!.hero, impulso = s.tick % OGNI === 0;
  if (u.id === 'aura' && impulso) {
    const R = U.raggio ?? 4;
    s.eroi.forEach((o, j) => {
      if (o.done || d.squadre[j] !== d.squadre[i]) return;
      const dx = o.hero.x - h.x, dz = o.hero.z - h.z;
      if (dx * dx + dz * dz <= R * R) o.hero.vita = Math.min(o.runHero.max.vita, o.hero.vita + (U.cura ?? 0) / 6);
    });
  }
  if (u.id === 'marea') {
    h.fx = u.fx; h.fz = u.fz;
    if (u.fase === 'fuoco') {
      u.lungo = lungoRaggio(s, h.x, h.z, u.fx, u.fz, U.gittata ?? 12);
      if (impulso) for (const j of eroiNelRaggio(d, i, u)) conEroe(s, i, () => colpisciEroe(s, j, { danno: (U.danno ?? 0) / 6, traits: {}, magico: true, skill: null, caricato: false, dirX: u.fx, dirZ: u.fz, daAlleato: false, ox: h.x, oz: h.z }));
      scopri(s, i);
    }
  }
  if (u.id === 'arpione') { arpione(d, i, u); return; }
  if (--u.resto > 0) return;
  if (u.fase === 'carica') { u.fase = 'fuoco'; u.resto = secToTicks(U.secondi ?? 1); u.lungo = lungoRaggio(s, h.x, h.z, u.fx, u.fz, U.gittata ?? 12); }
  else u.fase = 'no';
}

/** Quanto va lontano un raggio da (x, z) verso (fx, fz) prima di un muro o di una colonna (a passi di 0,25 m), al massimo `max`. */
export function lungoRaggio(s: DungeonState, x: number, z: number, fx: number, fz: number, max: number): number {
  const T = s.map.tile;
  for (let t = 0.25; t <= max; t += 0.25) if (isOpaque(s.map, Math.floor((x + fx * t) / T), Math.floor((z + fz * t) / T))) return t;
  return max;
}
/** Gli avversari dentro il raggio della Marea di i (distanza dal segmento entro la larghezza più il loro raggio). */
function eroiNelRaggio(d: D, i: number, u: UltiRt): number[] {
  const s = d.s, h = s.eroi[i]!.hero, w = arenaUlti(u.id).larghezza ?? 0.6;
  return conEroe(s, i, () => eroiNemici(s)).filter((j) => {
    const o = s.eroi[j]!, px = o.hero.x - h.x, pz = o.hero.z - h.z, t = Math.max(0, Math.min(u.lungo, px * u.fx + pz * u.fz));
    const qx = px - u.fx * t, qz = pz - u.fz * t, rr = w + o.runHero.raggio;
    return qx * qx + qz * qz <= rr * rr;
  });
}

/** L'arpione: vola dritto finché prende un avversario (lo tira) o un muro, o finisce la corda; tirato fino a te resta stordito. */
function arpione(d: D, i: number, u: UltiRt): void {
  const s = d.s, U = arenaUlti(u.id), me = s.eroi[i]!.hero, T = s.map.tile;
  if (u.fase === 'volo') {
    const passi = Math.max(1, Math.ceil(((U.velocita ?? 20) * DT) / 0.25)), step = ((U.velocita ?? 20) * DT) / passi;
    for (let k = 0; k < passi; k++) {
      u.x += u.fx * step; u.z += u.fz * step; u.strada += step;
      if (isOpaque(s.map, Math.floor(u.x / T), Math.floor(u.z / T)) || u.strada >= (U.gittata ?? 10)) { u.fase = 'no'; return; }
      const j = conEroe(s, i, () => eroiNemici(s)).find((q) => { const o = s.eroi[q]!, dx = o.hero.x - u.x, dz = o.hero.z - u.z, rr = o.runHero.raggio + 0.3; return dx * dx + dz * dz <= rr * rr; });
      if (j !== undefined) {
        u.fase = 'tiro'; u.preso = j; u.resto = secToTicks(1.2);
        conEroe(s, i, () => colpisciEroe(s, j, { danno: U.danno ?? 0, traits: {}, magico: false, skill: null, caricato: false, dirX: u.fx, dirZ: u.fz, daAlleato: false, ox: me.x, oz: me.z }));
        return;
      }
    }
    return;
  }
  // tiro: chi è preso viene verso di me finché è a un passo (o finisce il tempo, o cade)
  const o = s.eroi[u.preso];
  if (!o || o.done) { u.fase = 'no'; u.preso = -1; return; }
  const dx = me.x - o.hero.x, dz = me.z - o.hero.z, dist = Math.sqrt(dx * dx + dz * dz), stop = s.eroi[i]!.runHero.raggio + o.runHero.raggio + 0.5;
  const v = (U.tiro ?? 16) * DT;
  if (dist > stop && --u.resto > 0) { const k = Math.min(v, dist - stop) / Math.max(1e-6, dist); moveCircle(s.map, o.hero, dx * k, dz * k, o.runHero.raggio); u.x = o.hero.x; u.z = o.hero.z; return; }
  d.ul[u.preso]!.stordito = secToTicks(U.stordito ?? 0.5);
  if (o.hero.act !== 'schiva') { o.hero.act = 'idle'; o.hero.actT = 0; o.hero.carica = 0; }
  u.fase = 'no'; u.preso = -1;
}

/** Quello che il client disegna di un'ulti: la carica (0..1), la fase, il gancio, il raggio. */
export type UltiView = { id: string; carica: number; fase: UltiRt['fase']; x: number; z: number; fx: number; fz: number; lungo: number; preso: number };
export const ultiView = (u: UltiRt): UltiView => ({ id: u.id, carica: r2(u.carica / C.max), fase: u.fase, x: r2(u.x), z: r2(u.z), fx: r2(u.fx), fz: r2(u.fz), lungo: r2(u.lungo), preso: u.preso });
