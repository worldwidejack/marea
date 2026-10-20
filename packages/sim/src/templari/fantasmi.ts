// I fantasmi (docs/TEMPLARI.md §12b punto 5, idea di birbasan): sull'isola ce n'è sempre lo stesso numero (`fantasma.quanti`, insieme
// `squadra`) dall'ondata 1, così la probabilità di incontrarne uno non cresce con le ondate. Non escono dalle ondate e non contano per
// finirle. Trapassano tutto e girano a caso piano per il sopra dell'isola. Di base non attaccano: chi gli passa attraverso (o li colpisce)
// li fa arrabbiare, e allora puntano quell'eroe in linea retta, attraverso i muri, finché uno dei due non muore. Si uccidono con qualsiasi
// arma; ucciso uno, dopo `torna` s ne compare un altro lontano dagli eroi. Sono zombie del tipo `fantasma` (stesse armi, stessi colpi); il
// colpo è quello degli zombie (zombie.ts), il resto è qui. Dove vanno lo decide un rng a parte (`rngF`): il resto della partita non cambia.
import { TEMPLARI } from '@marea/content/templari.ts';
import type { TNemicoDef } from '@marea/content/templari_types.ts';
import { DT } from '../constants.ts';
import { C } from './mappa.ts';
import type { Arena } from './mappa.ts';
import type { TState, Zombie } from './stato.ts';
import { ev, inPiedi, nuovoZombie, secToTicks, usa } from './stato.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
/** Il nemico fantasma (null = la configurazione non ne ha). */
const DEF = (): (TNemicoDef & { fantasma: NonNullable<TNemicoDef['fantasma']> }) | null => {
  const d = TEMPLARI.nemici.find((n) => n.fantasma);
  return d?.fantasma ? (d as TNemicoDef & { fantasma: NonNullable<TNemicoDef['fantasma']> }) : null;
};
/** Un fantasma calmo: non lo si mira da soli, non lo insegue l'autopilota. */
export const calmo = (z: Zombie): boolean => !!z.def.fantasma && !z.arrabbiato;

/** Le celle libere del sopra (dove i fantasmi compaiono e vanno a girare). */
const LIBERE = new WeakMap<Arena, number[]>();
function libere(a: Arena): number[] {
  let l = LIBERE.get(a);
  if (!l) {
    l = [];
    for (let i = 0; i < a.sopra * a.w; i++) if (a.cell[i] === C.pavimento || a.cell[i] === C.terra) l.push(i);
    LIBERE.set(a, l);
  }
  return l;
}
const centro = (a: Arena, i: number) => ({ x: ((i % a.w) + 0.5) * a.tile, z: (Math.floor(i / a.w) + 0.5) * a.tile });

/** Si arrabbia con l'eroe `chi`: rosso, urla, lo punta. */
export function arrabbia(s: TState, z: Zombie, chi: number): void {
  if (!z.def.fantasma || z.arrabbiato || z.st === 'morto') return;
  z.arrabbiato = true; z.preda = chi; z.cd = secToTicks(0.4);
  ev(s, { t: 'fantasma', id: z.id, fase: 'arrabbiato', x: r2(z.x), z: r2(z.z) });
}

/** Ogni tick: dall'ondata 1 tiene il numero fisso (chi manca torna dopo `torna` s) e fa comparire chi è atteso. */
export function stepFantasmi(s: TState): void {
  const d = DEF();
  if (!d || s.ondata < 1) return;
  const n = s.eroi.length > 1 ? d.fantasma.squadra : d.fantasma.quanti;
  const vivi = s.zombie.filter((z) => z.def.fantasma && z.st !== 'morto').length;
  if (!s.fantasmi) s.fantasmi = Array.from({ length: n }, (_, k) => s.tick + secToTicks(1 + k * 3)); // all'inizio arrivano uno alla volta
  while (vivi + s.fantasmi.length < n) s.fantasmi.push(s.tick + secToTicks(d.fantasma.torna));
  if (!s.fantasmi.some((t) => t <= s.tick)) return;
  s.fantasmi = s.fantasmi.filter((t) => {
    if (t > s.tick) return true;
    const p = posto(s, d.fantasma.lontano);
    const z = nuovoZombie(s, d.id, p.x, p.z, d.velocita.cammina);
    z.tx = p.x; z.tz = p.z;
    ev(s, { t: 'fantasma', id: z.id, fase: 'compare', x: r2(z.x), z: r2(z.z) });
    return false;
  });
}
/** Una cella libera del sopra lontana almeno `lontano` m da tutti gli eroi in piedi (al più 24 tentativi, poi l'ultima). */
function posto(s: TState, lontano: number): { x: number; z: number } {
  const a = s.arena, l = libere(a);
  let p = centro(a, l[0] ?? 0);
  for (let k = 0; k < 24; k++) {
    p = centro(a, l[s.rngF.int(0, l.length - 1)]!);
    if (inPiedi(s).every((i) => { const h = s.eroi[i]!; return (h.x - p.x) * (h.x - p.x) + (h.z - p.z) * (h.z - p.z) >= lontano * lontano; })) break;
  }
  return p;
}

/** Vola dritto verso (tx, tz) attraverso tutto. */
function vola(z: Zombie, tx: number, tz: number, v: number): void {
  const dx = tx - z.x, dz = tz - z.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  const step = Math.min(d, v * DT);
  z.fx = dx / d; z.fz = dz / d; z.x += z.fx * step; z.z += z.fz * step;
}

/** Il passo di un fantasma che compare o si muove (true = fatto; false = sta colpendo: fa zombie.ts, con la sua preda come eroe di turno). */
export function stepFantasma(s: TState, z: Zombie): boolean {
  const def = z.def;
  if (z.st !== 'sorge' && z.st !== 'insegue') {
    if (z.preda >= 0 && s.eroi[z.preda]) usa(s, z.preda);
    return false;
  }
  z.stT++;
  if (z.hurt > 0) z.hurt--;
  if (z.cd > 0) z.cd--;
  if (z.st === 'sorge') { if (z.stT >= z.stDur) { z.st = 'insegue'; z.stT = 0; z.stDur = 0; } return true; }
  // chi gli passa attraverso lo fa arrabbiare
  if (!z.arrabbiato) for (const i of inPiedi(s)) {
    const h = s.eroi[i]!, dx = h.x - z.x, dz = h.z - z.z, rr = def.raggio + TEMPLARI.eroe.raggio;
    if (dx * dx + dz * dz <= rr * rr) { arrabbia(s, z, i); break; }
  }
  if (z.arrabbiato) {
    const vivi = inPiedi(s);
    if (!vivi.includes(z.preda)) {
      // la preda è caduta (insieme) o uscita: punta il più vicino; nessuno in piedi = si calma
      let best = -1, bd = Infinity;
      for (const i of vivi) { const h = s.eroi[i]!, d = (h.x - z.x) * (h.x - z.x) + (h.z - z.z) * (h.z - z.z); if (d < bd) { bd = d; best = i; } }
      if (best < 0) { z.arrabbiato = false; z.preda = -1; return true; }
      z.preda = best;
    }
    usa(s, z.preda);
    const h = s.eroe, dx = h.x - z.x, dz = h.z - z.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d <= def.portata + def.raggio + TEMPLARI.eroe.raggio && z.cd <= 0) {
      if (d > 1e-6) { z.fx = dx / d; z.fz = dz / d; }
      z.modo = 'mischia'; z.st = 'prepara'; z.stT = 0; z.stDur = secToTicks(def.preparazione);
      return true;
    }
    vola(z, h.x, h.z, def.velocita.corre);
    return true;
  }
  // calmo: gira a caso, da un punto all'altro del sopra
  if ((z.tx - z.x) * (z.tx - z.x) + (z.tz - z.z) * (z.tz - z.z) < 0.25) { const l = libere(s.arena), p = centro(s.arena, l[s.rngF.int(0, l.length - 1)]!); z.tx = p.x; z.tz = p.z; }
  vola(z, z.tx, z.tz, def.velocita.cammina);
  return true;
}
