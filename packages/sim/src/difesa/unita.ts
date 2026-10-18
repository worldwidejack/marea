// I difensori della Difesa (docs/DIFESA.md §2.2): si piantano spendendo valuta (e la carta si ricarica), chi spara tira a ritmo fisso
// quando nella sua corsia c'è un nemico, il produttore fa cadere monete, la bomba scoppia dopo la miccia nel 3 × 3, la mina si arma e
// scoppia a chi la tocca, il muro ha solo tanta vita. Qui anche i colpi in volo.
import type { DTipoUnita } from '@marea/content/difesa.ts';
import { DIFESA } from '@marea/content/difesa.ts';
import type { DState, DUnita } from './stato.ts';
import { caso, prof, tick, tra, unitaIn, vivo } from './stato.ts';
import { BOCCA, CORPO, ferisci } from './nemici.ts';
import { nuovaMoneta } from './monete.ts';

/** Pianta un difensore: carta della partita, carta carica, abbastanza valuta, corsia aperta e casella libera. */
export function pianta(s: DState, tipo: DTipoUnita, corsia: number, col: number): DUnita | null {
  const d = prof(s).unita[tipo], carta = s.carte.find((c) => c.tipo === tipo);
  const no = (motivo: 'valuta' | 'ricarica' | 'occupata' | 'fuori' | 'carta') => { s.ev.push({ e: 'rifiuto', motivo }); return null; };
  if (!carta) return no('carta');
  if (!s.corsie.includes(corsia) || col < 0 || col >= DIFESA.campo.colonne || col !== Math.floor(col)) return no('fuori');
  if (unitaIn(s, corsia, col)) return no('occupata');
  if (carta.pronta > s.tick) return no('ricarica');
  if (s.valuta < d.costo) return no('valuta');
  s.valuta -= d.costo; s.stats.spesa += d.costo; s.stats.piantate++;
  carta.pronta = s.tick + tick(d.ricarica);
  const vita = d.vita ?? 300;
  const t = d.tipo === 'tiro' ? s.tick + tick(caso(s) * (d.cadenza ?? 1.5))
    : d.tipo === 'produce' ? s.tick + tick(tra(s, d.primo ?? [3, 12]))
    : d.tipo === 'bomba' ? s.tick + tick(d.miccia ?? 1)
    : d.tipo === 'mina' ? s.tick + tick(d.arma ?? 15) : 0;
  const u: DUnita = { id: s.nid++, tipo, corsia, col, vita, vitaMax: vita, t, armata: false, nata: s.tick, morsa: -9999 };
  s.unita.push(u);
  s.attesa = false;
  s.ev.push({ e: 'pianta', id: u.id, tipo, corsia, col });
  return u;
}
/** La pala: toglie il difensore (senza rimborso, come in PvZ). */
export function pala(s: DState, corsia: number, col: number): void {
  const u = unitaIn(s, corsia, col);
  if (!u) return;
  s.unita.splice(s.unita.indexOf(u), 1);
  s.ev.push({ e: 'pala', tipo: u.tipo, corsia, col });
}

/** C'è un nemico da colpire nella corsia, davanti al difensore (o addosso) e già nel campo? (La usa anche la resa per la posa di carica.) */
export function haBersaglio(s: DState, u: DUnita): boolean {
  for (const e of s.nemici) if (e.corsia === u.corsia && vivo(e) && e.x >= u.col && e.x <= DIFESA.campo.visibile && e.salto !== 1) return true;
  return false;
}
function scoppia(s: DState, u: DUnita, corsie: number, x0: number, x1: number, danno: number, tipo: 'bomba' | 'mina'): void {
  for (const e of [...s.nemici]) if (Math.abs(e.corsia - u.corsia) <= corsie && e.x >= x0 && e.x <= x1) ferisci(s, e, danno);
  s.unita.splice(s.unita.indexOf(u), 1);
  s.ev.push({ e: 'esplode', tipo, corsia: u.corsia, col: u.col });
}

export function passoUnita(s: DState): void {
  const P = prof(s);
  for (const u of [...s.unita]) {
    const d = P.unita[u.tipo];
    if (d.tipo === 'tiro') {
      if (u.t > s.tick) continue;
      u.t = s.tick + tick((d.cadenza ?? 1.5) - caso(s) * (d.cadenzaCaso ?? 0));
      if (!haBersaglio(s, u)) continue;
      const x = u.col + 0.8;
      s.colpi.push({ id: s.nid++, corsia: u.corsia, x, danno: d.danno ?? 20, gelo: !!d.gelo, vel: (d.colpoVel ?? 4) / tick(1) });
      s.ev.push({ e: 'spara', id: u.id, corsia: u.corsia, x, gelo: !!d.gelo });
    } else if (d.tipo === 'produce') {
      if (u.t > s.tick) continue;
      u.t = s.tick + tick(tra(s, d.ogni ?? [24, 25]));
      nuovaMoneta(s, u.col + 0.35 + caso(s) * 0.3, u.corsia + 0.15, u.corsia + 0.55, d.valore ?? 25, false);
    } else if (d.tipo === 'bomba') {
      if (u.t > s.tick) continue;
      const c = d.caselle ?? 1.5;
      scoppia(s, u, d.corsie ?? 1, u.col + 0.5 - c, u.col + 0.5 + c, d.danno ?? 1800, 'bomba');
    } else if (d.tipo === 'mina') {
      if (!u.armata) {
        if (u.t <= s.tick) { u.armata = true; s.ev.push({ e: 'armata', id: u.id }); }
        continue;
      }
      const tocca = s.nemici.some((e) => e.corsia === u.corsia && vivo(e) && e.salto !== 1 && e.x - BOCCA <= u.col + 1 && e.x >= u.col - 0.2);
      if (tocca) scoppia(s, u, 0, u.col - 0.3, u.col + 1 + (d.caselle ?? 0.9), d.danno ?? 1800, 'mina');
    }
  }
}

/** I colpi in volo: avanzano e colpiscono il primo nemico (il più a sinistra) che toccano nella loro corsia. */
export function passoColpi(s: DState): void {
  for (const c of [...s.colpi]) {
    c.x += c.vel;
    let best = null as null | (typeof s.nemici)[number];
    for (const e of s.nemici) {
      if (e.corsia !== c.corsia || !vivo(e) || e.salto === 1) continue;
      if (Math.abs(e.x - c.x) <= CORPO && (!best || e.x < best.x)) best = e;
    }
    if (best) { s.colpi.splice(s.colpi.indexOf(c), 1); ferisci(s, best, c.danno, c.gelo); continue; }
    if (c.x > DIFESA.campo.colonne + 0.8) s.colpi.splice(s.colpi.indexOf(c), 1);
  }
}
