// Il super degli eroi del menù d'ingresso (docs/TEMPLARI.md §4b, numeri in templari.json `eroi[].super`): si carica a ogni uccisione
// dell'eroe (colpi suoi, frecce e palle sue; non le fiamme, le trappole, i power-up né il super stesso) e si usa col bottone SUPER (input e).
// - Giudizio (Crociato): colpo a terra attorno all'eroe, spinge via, qualche istante intoccabile.
// - Bordata (Bucaniera): cannonate dalla nave che cadono in fila lungo la mira, una dopo l'altra.
// - Pioggia di frecce (Arciere): un cerchio dove piovono frecce per qualche secondo (come le fiamme: danno al secondo agli zombie dentro).
// Il danno è × la vita degli zombie dell'ondata: resta utile a ogni ondata (i boss ne perdono una fetta). Lo scudo dello scudato non para.
import type { TSuperDef } from '@marea/content/templari.ts';
import { lineOfSight } from '../dungeon/map.ts';
import type { TState, Zombie } from './stato.ts';
import { classeDi, ev, secToTicks, usa, vitaOndata } from './stato.ts';
import { colpisci } from './colpi.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const vivi = (s: TState): Zombie[] => s.zombie.filter((z) => z.st !== 'morto' && z.st !== 'sorge');
/** Cono davanti in cui si cerca il bersaglio senza mira (come le armi a distanza, un po' più largo). */
const COS_BERSAGLIO = 0.7;

/** Dove cade il super a distanza: lungo la mira il primo zombie vicino alla linea (in vista), sennò 3/5 della gittata; senza mira lo zombie
 *  in vista più vicino nel cono davanti, sennò davanti a te. */
function bersaglio(s: TState, d: TSuperDef, dir: readonly [number, number] | null): { x: number; z: number; fx: number; fz: number } {
  const h = s.eroe, g = d.gittata ?? 12, fx = dir ? dir[0] : h.fx, fz = dir ? dir[1] : h.fz;
  let best = g * 0.6, bd = Infinity, preso: Zombie | null = null;
  for (const z of vivi(s)) {
    const dx = z.x - h.x, dz = z.z - h.z, lungo = dx * fx + dz * fz;
    if (lungo <= 0 || lungo > g || !lineOfSight(s.gr.percorso, h.x, h.z, z.x, z.z)) continue;
    if (dir) {
      const lato = dx * fz - dz * fx;
      if (lato * lato > (z.def.raggio + 1.2) * (z.def.raggio + 1.2) || lungo >= bd) continue;
      bd = lungo; best = lungo;
    } else {
      const dd = Math.sqrt(dx * dx + dz * dz);
      if (dd < 1e-6 || lungo / dd < COS_BERSAGLIO || dd >= bd) continue;
      bd = dd; preso = z;
    }
  }
  if (preso) {
    const dx = preso.x - h.x, dz = preso.z - h.z, dd = Math.sqrt(dx * dx + dz * dz) || 1;
    return { x: preso.x, z: preso.z, fx: dx / dd, fz: dz / dd };
  }
  return { x: h.x + fx * best, z: h.z + fz * best, fx, fz };
}

/** SUPER: se è carico lo usa (verso la mira `dir`, o davanti); true se è partito. */
export function usaSuper(s: TState, dir: readonly [number, number] | null): boolean {
  const h = s.eroe, cl = classeDi(h);
  if (!cl || h.superK < 1 || h.giu || h.fuori || h.act === 'beve' || s.done) return false;
  const d = cl.super, danno = vitaOndata(s.ondata) * d.danno;
  h.superK = 0;
  if (d.id === 'giudizio') {
    ev(s, { t: 'super', tipo: d.id, x: r2(h.x), z: r2(h.z), da: { x: r2(h.x), z: r2(h.z) } });
    for (const z of vivi(s)) {
      const dx = z.x - h.x, dz = z.z - h.z, dd = Math.sqrt(dx * dx + dz * dz);
      if (dd > d.raggio + z.def.raggio) continue;
      colpisci(s, z, { danno, mischia: false, caricato: true, dirX: dd > 1e-6 ? dx / dd : h.fx, dirZ: dd > 1e-6 ? dz / dd : h.fz, spinta: d.spinta ?? 0, scudo: false, super: true });
      if (s.done) return true;
    }
    h.intoccabile = Math.max(h.intoccabile, s.tick + secToTicks(d.intoccabile ?? 0));
    return true;
  }
  const b = bersaglio(s, d, dir);
  h.fx = b.fx; h.fz = b.fz;
  ev(s, { t: 'super', tipo: d.id, x: r2(b.x), z: r2(b.z), da: { x: r2(h.x), z: r2(h.z) } });
  if (d.id === 'pioggia') {
    if (s.fiamme.length >= 14) s.fiamme.shift();
    s.fiamme.push({ id: s.nextId++, x: b.x, z: b.z, r: d.raggio, dps: danno, fine: s.tick + secToTicks(d.durata ?? 4), frecce: true, ...(s.eroi.length > 1 ? { chi: s.chi } : {}) });
    return true;
  }
  // bordata: le cannonate in fila lungo la mira, centrate sul bersaglio
  const n = d.colpi ?? 3, passo = d.passo ?? 2;
  for (let i = 0; i < n; i++) {
    const k = (i - (n - 1) / 2) * passo;
    s.cannonate.push({ id: s.nextId++, x: b.x + b.fx * k, z: b.z + b.fz * k, r: d.raggio, danno, inizio: s.tick, fine: s.tick + secToTicks((d.primo ?? 0.5) + i * (d.ogni ?? 0.3)), ...(s.eroi.length > 1 ? { chi: s.chi } : {}) });
  }
  return true;
}

/** Le cannonate che arrivano in questo tick: colpo a chi sta nel raggio (lo scudo non para), niente carica del super. */
export function stepSuper(s: TState): void {
  if (!s.cannonate.length) return;
  const resto = [], prima = s.chi;
  for (const c of s.cannonate) {
    if (c.fine > s.tick) { resto.push(c); continue; }
    ev(s, { t: 'cannonata', x: r2(c.x), z: r2(c.z), r: c.r });
    if (c.chi !== undefined && c.chi !== s.chi && s.eroi[c.chi]) usa(s, c.chi); // i punti a chi ha chiamato la Bordata
    for (const z of vivi(s)) {
      const dx = z.x - c.x, dz = z.z - c.z, dd = Math.sqrt(dx * dx + dz * dz);
      if (dd > c.r + z.def.raggio) continue;
      colpisci(s, z, { danno: c.danno, mischia: false, caricato: false, dirX: dd > 1e-6 ? dx / dd : 0, dirZ: dd > 1e-6 ? dz / dd : 1, spinta: 1, scudo: false, super: true });
      if (s.done) { if (s.chi !== prima) usa(s, prima); return; }
    }
  }
  s.cannonate = resto;
  if (s.chi !== prima) usa(s, prima);
}
